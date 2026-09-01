"""Idempotently migrate the existing Mailchimp audience into Odoo Email Marketing.

Credentials are read from ``MAILCHIMP_API_KEY`` and ``MAILCHIMP_LIST_ID`` in the
Odoo process environment. Email addresses and API credentials are never logged.
"""

import base64
import json
import os
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from odoo import fields, tools


PAGE_SIZE = 1000
ACTIVE_STATUS = "subscribed"
KNOWN_STATUSES = {
    "subscribed",
    "unsubscribed",
    "cleaned",
    "pending",
    "transactional",
    "archived",
}


def odoo_datetime(value):
    if not value:
        return False
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed.strftime("%Y-%m-%d %H:%M:%S")


def fetch_page(api_key, list_id, offset):
    datacenter = api_key.rsplit("-", 1)[-1]
    if not datacenter or datacenter == api_key:
        raise RuntimeError("Mailchimp API key does not include a datacenter suffix.")
    query = urlencode(
        {
            "count": PAGE_SIZE,
            "offset": offset,
            "fields": (
                "total_items,members.id,members.email_address,members.status,"
                "members.merge_fields,members.timestamp_signup,members.last_changed"
            ),
        }
    )
    url = f"https://{datacenter}.api.mailchimp.com/3.0/lists/{list_id}/members?{query}"
    authorization = base64.b64encode(f"cdt:{api_key}".encode()).decode()
    request = Request(
        url,
        headers={
            "Authorization": f"Basic {authorization}",
            "Accept": "application/json",
            "User-Agent": "CDT-Odoo-Mailchimp-Importer/1.0",
        },
    )
    try:
        with urlopen(request, timeout=60) as response:
            return json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"Mailchimp audience request failed with HTTP {error.code}.") from error
    except (URLError, TimeoutError) as error:
        raise RuntimeError("Mailchimp audience request could not be completed.") from error


def fetch_members(api_key, list_id):
    members = []
    offset = 0
    total = None
    while total is None or offset < total:
        page = fetch_page(api_key, list_id, offset)
        page_members = page.get("members") or []
        total = int(page.get("total_items") or len(page_members))
        members.extend(page_members)
        if not page_members:
            break
        offset += len(page_members)
    return members


def member_name(member):
    merge_fields = member.get("merge_fields") or {}
    first_name = str(merge_fields.get("FNAME") or "").strip()
    last_name = str(merge_fields.get("LNAME") or "").strip()
    return " ".join(part for part in (first_name, last_name) if part)


def sync_member(odoo_env, member, mailing_list):
    email = tools.email_normalize(member.get("email_address"))
    if not email:
        return "invalid"
    status = member.get("status") if member.get("status") in KNOWN_STATUSES else "unknown"
    source_key = member.get("id") or False
    contact_model = odoo_env["mailing.contact"].sudo()
    contact = contact_model._cdt_find_contact(email, source_key=source_key)
    previous_status = contact.cdt_source_status if contact else False
    values = {
        "email": email,
        "cdt_source": "mailchimp",
        "cdt_source_key": source_key,
        "cdt_source_status": status,
        "cdt_last_sync_at": fields.Datetime.now(),
    }
    name = member_name(member)
    if name:
        values["name"] = name
    if status == ACTIVE_STATUS:
        values["cdt_consent_at"] = (
            odoo_datetime(member.get("timestamp_signup"))
            or odoo_datetime(member.get("last_changed"))
            or fields.Datetime.now()
        )
    if contact:
        contact.write(values)
    else:
        contact = contact_model.create(values)

    subscription = odoo_env["mailing.subscription"].sudo().search(
        [("contact_id", "=", contact.id), ("list_id", "=", mailing_list.id)],
        limit=1,
    )
    source_reconsent = previous_status and previous_status != ACTIVE_STATUS and status == ACTIVE_STATUS
    if subscription:
        if status != ACTIVE_STATUS and not subscription.opt_out:
            subscription.write({"opt_out": True})
        elif source_reconsent and subscription.opt_out:
            subscription.write({"opt_out": False})
    else:
        odoo_env["mailing.subscription"].sudo().create(
            {
                "contact_id": contact.id,
                "list_id": mailing_list.id,
                "opt_out": status != ACTIVE_STATUS,
            }
        )
    return "active" if status == ACTIVE_STATUS else "opt_out"


def run_import(odoo_env, dry_run=False, commit=False):
    parameters = odoo_env["ir.config_parameter"].sudo()
    api_key = (
        os.getenv("MAILCHIMP_API_KEY", "").strip()
        or parameters.get_param("cdt_content.mailchimp_api_key", "").strip()
    )
    list_id = (
        os.getenv("MAILCHIMP_LIST_ID", "").strip()
        or parameters.get_param("cdt_content.mailchimp_list_id", "").strip()
    )
    mailing_list = odoo_env.ref("cdt_content.mailing_list_website_subscribers")
    if not api_key or not list_id:
        subscriptions = odoo_env["mailing.subscription"].sudo().search(
            [("list_id", "=", mailing_list.id)]
        )
        return {
            "configured": False,
            "fetched": 0,
            "total": len(subscriptions),
            "active": len(subscriptions.filtered(lambda item: not item.opt_out)),
            "opt_out": len(subscriptions.filtered("opt_out")),
            "invalid": 0,
        }

    members = fetch_members(api_key, list_id)
    counts = {"active": 0, "opt_out": 0, "invalid": 0}
    for member in members:
        result = sync_member(odoo_env, member, mailing_list)
        counts[result] += 1

    subscriptions = odoo_env["mailing.subscription"].sudo().search(
        [("list_id", "=", mailing_list.id)]
    )
    result = {
        "configured": True,
        "fetched": len(members),
        "total": len(subscriptions),
        "active": len(subscriptions.filtered(lambda item: not item.opt_out)),
        "opt_out": len(subscriptions.filtered("opt_out")),
        "invalid": counts["invalid"],
    }
    if dry_run:
        odoo_env.cr.rollback()
    elif commit:
        odoo_env.cr.commit()
    return result


if "env" in globals():
    print("MAILCHIMP_IMPORT_SUMMARY", json.dumps(run_import(env, commit=True), sort_keys=True))
