"""Idempotently import published CDT website content from Sanity into Odoo.

Run from the repository root:

    docker compose -f infra/odoo/compose.yaml exec -T web \
      odoo shell -d cdt_jamaica --no-http --db_host db --db_port 5432 \
      --db_user odoo --db_password odoo_local_dev \
      < infra/odoo/addons/cdt_content/tools/import_sanity.py

The script expects Odoo shell's global ``env`` variable. Set SANITY_IMPORT_DRY_RUN=1
to exercise the complete import and roll it back.
"""

import base64
import html
import json
import os
import time
from datetime import date, datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl
from urllib.request import Request, urlopen

from odoo import Command


PROJECT_ID = os.getenv("SANITY_PROJECT_ID", "sbvvl9vs")
DATASET = os.getenv("SANITY_DATASET", "production")
API_VERSION = os.getenv("SANITY_API_VERSION", "2023-05-03")
DRY_RUN = os.getenv("SANITY_IMPORT_DRY_RUN", "").lower() in {"1", "true", "yes"}
SOURCE_PREFIX = f"sanity:{PROJECT_ID}:{DATASET}"

QUERY = r'''
*[
  _type in ["dancer", "management", "boardMember", "performance", "repertoireItem", "siteSettings"]
  && !(_id in path("drafts.**"))
] | order(_type asc, order asc, title asc, name asc) {
  ...,
  "headshotUrl": headshot.asset->url,
  "imageUrl": image.asset->url,
  "thumbnailUrl": thumbnail.asset->url,
  "heroImageUrl": heroImage.asset->url,
  "lightLogoUrl": lightLogo.asset->url,
  "darkLogoUrl": darkLogo.asset->url,
  "homePageHeroImageUrl": homePageHeroImage.asset->url,
  "videos": videos[]{
    ...,
    "videoFileUrl": videoFile.asset->url,
    "thumbnailUrl": thumbnail.asset->url
  }
}
'''.strip()


def open_url(request, timeout=60, attempts=3):
    for attempt in range(1, attempts + 1):
        try:
            return urlopen(request, timeout=timeout)
        except HTTPError:
            raise
        except (URLError, TimeoutError):
            if attempt == attempts:
                raise
            time.sleep(0.25 * attempt)


def fetch_json(url):
    request = Request(url, headers={"User-Agent": "CDT-Odoo-Sanity-Importer/1.0"})
    with open_url(request) as response:
        return json.load(response)


def fetch_documents():
    url = (
        f"https://{PROJECT_ID}.api.sanity.io/v{API_VERSION}/data/query/{DATASET}?"
        + urlencode({"query": QUERY})
    )
    payload = fetch_json(url)
    if "result" not in payload:
        raise RuntimeError(f"Sanity query failed: {payload}")
    return payload["result"]


image_cache = {}


def resized_image_url(url):
    if not url:
        return None
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    query.update({"w": "1600", "fit": "max"})
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def download_image(url):
    if not url:
        return False
    if url in image_cache:
        return image_cache[url]
    try:
        request = Request(
            resized_image_url(url),
            headers={"User-Agent": "CDT-Odoo-Sanity-Importer/1.0"},
        )
        with open_url(request) as response:
            content = response.read(20 * 1024 * 1024 + 1)
        if len(content) > 20 * 1024 * 1024:
            raise ValueError("image exceeds the 20 MB import limit")
        encoded = base64.b64encode(content)
        image_cache[url] = encoded
        return encoded
    except Exception as error:
        print(f"IMAGE_WARNING {url}: {error}")
        image_cache[url] = False
        return False


def plain_text(value):
    if not value:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        paragraphs = []
        for item in value:
            if isinstance(item, str):
                paragraphs.append(item)
                continue
            if not isinstance(item, dict):
                continue
            children = item.get("children") or []
            text = "".join(
                child.get("text", "")
                for child in children
                if isinstance(child, dict)
            ).strip()
            if text:
                paragraphs.append(text)
        return "\n\n".join(paragraphs)
    return str(value)


def html_text(value):
    text = plain_text(value)
    if not text:
        return False
    return "".join(
        f"<p>{html.escape(paragraph)}</p>"
        for paragraph in text.split("\n\n")
        if paragraph.strip()
    )


def slug_value(value):
    return value.get("current") if isinstance(value, dict) else value or False


def odoo_datetime(value):
    if not value:
        return False
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed.strftime("%Y-%m-%d %H:%M:%S")


summary = {
    "created": {},
    "updated": {},
    "people": 0,
    "performances": 0,
    "repertoire": 0,
    "settings": 0,
    "media": 0,
}


def bump(bucket, model):
    summary[bucket][model] = summary[bucket].get(model, 0) + 1


def upsert(model_name, sanity_id, values):
    model = env[model_name]
    record = model.search([("sanity_id", "=", sanity_id)], limit=2)
    if len(record) > 1:
        raise RuntimeError(f"Duplicate {model_name} records for Sanity ID {sanity_id}")
    if record:
        record.write(values)
        bump("updated", model_name)
        return record
    values["sanity_id"] = sanity_id
    record = model.create(values)
    bump("created", model_name)
    return record


def existing_record(model_name, sanity_id):
    records = env[model_name].search([("sanity_id", "=", sanity_id)], limit=2)
    if len(records) > 1:
        raise RuntimeError(f"Duplicate {model_name} records for Sanity ID {sanity_id}")
    return records


def partner_category(name):
    return env["res.partner.category"].search([("name", "=", name)], limit=1) \
        or env["res.partner.category"].create({"name": name})


def import_person(document):
    source_type = document["_type"]
    member_type = "board" if source_type == "boardMember" else source_type
    role = document.get("role") or document.get("title") or document.get("position") or ""
    category_name = {
        "dancer": "CDT Dancer",
        "management": "CDT Management",
        "boardMember": "CDT Board",
    }[source_type]
    category = partner_category(category_name)
    partner_ref = f"{SOURCE_PREFIX}:{source_type}:{document['_id']}"
    partner = env["res.partner"].search([("ref", "=", partner_ref)], limit=2)
    if len(partner) > 1:
        raise RuntimeError(f"Duplicate res.partner records for {partner_ref}")
    if not partner:
        partner = env["res.partner"].search([
            ("name", "=", document.get("name")),
            ("is_company", "=", False),
        ], limit=1)
    partner_values = {
        "name": document.get("name") or "Unnamed team member",
        "is_company": False,
        "ref": partner_ref,
        "function": role,
        "comment": html_text(document.get("bio")),
        "category_id": [Command.link(category.id)],
    }
    existing = existing_record("cdt.team.member", document["_id"])
    image = False
    if not existing or not existing.headshot or existing.headshot_url != document.get("headshotUrl"):
        image = download_image(document.get("headshotUrl"))
    if image:
        partner_values["image_1920"] = image
    if partner:
        partner.write(partner_values)
    else:
        partner = env["res.partner"].create(partner_values)
    values = {
        "sanity_updated_at": odoo_datetime(document.get("_updatedAt")),
        "member_type": member_type,
        "partner_id": partner.id,
        "role": role,
        "biography": html_text(document.get("bio")),
        "years_active": document.get("yearsActive") or False,
        "term": document.get("term") or False,
        "featured": bool(document.get("featured")),
        "sequence": int(document.get("order") or 10),
        "headshot_url": document.get("headshotUrl") or False,
    }
    if image:
        values["headshot"] = image
    upsert("cdt.team.member", document["_id"], values)
    summary["people"] += 1


def import_performance(document):
    performance_date = document.get("date")
    status = "upcoming"
    if not document.get("isUpcoming", True) or (performance_date and performance_date < date.today().isoformat()):
        status = "completed"
    values = {
        "sanity_updated_at": odoo_datetime(document.get("_updatedAt")),
        "title": document.get("title") or "Untitled performance",
        "slug": slug_value(document.get("slug")),
        "company_name": document.get("company") or "CDT",
        "date": performance_date,
        "time": document.get("time") or False,
        "venue": document.get("venue") or "Venue to be confirmed",
        "location": document.get("location") or False,
        "description": html_text(document.get("description")),
        "category": document.get("category") or False,
        "ticket_url": document.get("ticketUrl") or False,
        "learn_more_url": document.get("learnMoreUrl") or False,
        "status": status,
        "featured": bool(document.get("isFeatured")),
        "image_url": document.get("imageUrl") or False,
        "image_alt": (document.get("image") or {}).get("alt") or False,
    }
    existing = existing_record("cdt.performance", document["_id"])
    image = False
    if not existing or not existing.image or existing.image_url != document.get("imageUrl"):
        image = download_image(document.get("imageUrl"))
    if image:
        values["image"] = image
    upsert("cdt.performance", document["_id"], values)
    summary["performances"] += 1


def import_repertoire(document):
    values = {
        "sanity_updated_at": odoo_datetime(document.get("_updatedAt")),
        "title": document.get("title") or "Untitled repertoire item",
        "subtitle": document.get("subtitle") or False,
        "slug": slug_value(document.get("slug")) or document["_id"],
        "year": int(document.get("year") or 0),
        "runtime": (document.get("runTime") or "").strip() or False,
        "choreographer": document.get("choreographer") or False,
        "description": html_text(document.get("description")),
        "company_premiere": document.get("companyPremiere") or False,
        "world_premiere": document.get("worldPremiere") or False,
        "music": "\n".join(document.get("music") or []),
        "costume_design": document.get("costumeDesign") or False,
        "lighting": document.get("lighting") or False,
        "premiered_by": document.get("premieredBy") or False,
        "genre": document.get("genre") or False,
        "style_period": document.get("stylePeriod") or False,
        "youtube_id": document.get("youtubeId") or False,
        "thumbnail_url": document.get("thumbnailUrl") or False,
        "hero_image_url": document.get("heroImageUrl") or False,
    }
    existing = existing_record("cdt.repertoire.item", document["_id"])
    thumbnail = False
    hero_image = False
    if not existing or not existing.thumbnail or existing.thumbnail_url != document.get("thumbnailUrl"):
        thumbnail = download_image(document.get("thumbnailUrl"))
    if not existing or not existing.hero_image or existing.hero_image_url != document.get("heroImageUrl"):
        hero_image = download_image(document.get("heroImageUrl"))
    if thumbnail:
        values["thumbnail"] = thumbnail
    if hero_image:
        values["hero_image"] = hero_image
    upsert("cdt.repertoire.item", document["_id"], values)
    summary["repertoire"] += 1


def import_media(site_document, video):
    video_id = f"{site_document['_id']}:{video.get('_key') or slug_value(video.get('slug')) or video.get('title')}"
    values = {
        "sanity_updated_at": odoo_datetime(site_document.get("_updatedAt")),
        "title": video.get("title") or "Untitled media item",
        "slug": slug_value(video.get("slug")),
        "description": html_text(video.get("description")),
        "video_type": video.get("videoType") or False,
        "duration": video.get("duration") or False,
        "published_at": odoo_datetime(video.get("publishedAt")),
        "featured": bool(video.get("isFeatured")),
        "tags": ", ".join(video.get("tags") or []),
        "category": video.get("category") or False,
        "video_url": video.get("videoFileUrl") or False,
        "vimeo_url": video.get("vimeoUrl") or False,
        "youtube_url": video.get("youtubeUrl") or False,
        "thumbnail_url": video.get("thumbnailUrl") or False,
    }
    existing = existing_record("cdt.media.item", video_id)
    thumbnail = False
    if not existing or not existing.thumbnail or existing.thumbnail_url != video.get("thumbnailUrl"):
        thumbnail = download_image(video.get("thumbnailUrl"))
    if thumbnail:
        values["thumbnail"] = thumbnail
    upsert("cdt.media.item", video_id, values)
    summary["media"] += 1


def import_site_settings(document):
    values = {
        "sanity_updated_at": odoo_datetime(document.get("_updatedAt")),
        "title": document.get("title") or "CDT Jamaica",
        "description": html_text(document.get("description")),
        "light_logo_url": document.get("lightLogoUrl") or False,
        "dark_logo_url": document.get("darkLogoUrl") or False,
        "hero_image_url": document.get("heroImageUrl") or False,
        "home_hero_image_url": document.get("homePageHeroImageUrl") or False,
    }
    existing = existing_record("cdt.site.setting", document["_id"])
    for field_name, url_name in [
        ("light_logo", "lightLogoUrl"),
        ("dark_logo", "darkLogoUrl"),
        ("hero_image", "heroImageUrl"),
        ("home_hero_image", "homePageHeroImageUrl"),
    ]:
        image = False
        if not existing or not existing[field_name] or existing[f"{field_name}_url"] != document.get(url_name):
            image = download_image(document.get(url_name))
        if image:
            values[field_name] = image
    upsert("cdt.site.setting", document["_id"], values)
    summary["settings"] += 1
    for video in document.get("videos") or []:
        import_media(document, video)


def run_import(odoo_env, dry_run=False, commit=False):
    globals()["env"] = odoo_env
    image_cache.clear()
    summary.clear()
    summary.update({
        "created": {},
        "updated": {},
        "people": 0,
        "performances": 0,
        "repertoire": 0,
        "settings": 0,
        "media": 0,
    })

    documents = fetch_documents()
    print(f"SANITY_FETCHED {len(documents)} published documents from {PROJECT_ID}/{DATASET}")

    for document in documents:
        document_type = document.get("_type")
        if document_type in {"dancer", "management", "boardMember"}:
            import_person(document)
        elif document_type == "performance":
            import_performance(document)
        elif document_type == "repertoireItem":
            import_repertoire(document)
        elif document_type == "siteSettings":
            import_site_settings(document)

    result = json.loads(json.dumps(summary))
    if dry_run:
        odoo_env.cr.rollback()
        print("SANITY_IMPORT_ROLLED_BACK")
    elif commit:
        odoo_env.cr.commit()
        print("SANITY_IMPORT_COMMITTED")

    print("SANITY_IMPORT_SUMMARY", json.dumps(result, sort_keys=True))
    return result


if "env" in globals():
    run_import(env, dry_run=DRY_RUN, commit=True)
