import { Router, type IRouter } from "express";
import {
  isOdooConfigured,
  listOdooMediaItems,
  listOdooRepertoireItems,
  listOdooTeamMembers,
  listOdooWebsiteSettings,
} from "../lib/odoo";
import {
  ListMediaItemsQueryParams,
  ListRepertoireItemsQueryParams,
  ListTeamMembersQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireOdoo(res: import("express").Response): boolean {
  if (!isOdooConfigured()) {
    res.status(503).json({
      error: "Odoo integration not configured",
      hint: "Set ODOO_URL, ODOO_DB, ODOO_USERNAME, and ODOO_API_KEY.",
    });
    return false;
  }
  return true;
}

function odooDateTime(value: string | false): string | null {
  return value ? `${value.replace(" ", "T")}Z` : null;
}

router.get("/content/team", async (req, res): Promise<void> => {
  const parsed = ListTeamMembersQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!requireOdoo(res)) return;
  const records = await listOdooTeamMembers(parsed.data.search ?? "");
  res.json(records.map((record) => ({
    id: record.id,
    name: record.name,
    memberType: record.member_type,
    role: record.role || null,
    yearsActive: record.years_active || null,
    term: record.term || null,
    featured: record.featured,
    sequence: record.sequence,
    headshotUrl: record.headshot_url || null,
    sourceUpdatedAt: odooDateTime(record.sanity_updated_at),
    managedBySanity: Boolean(record.sanity_id),
  })));
});

router.get("/content/repertoire", async (req, res): Promise<void> => {
  const parsed = ListRepertoireItemsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!requireOdoo(res)) return;
  const records = await listOdooRepertoireItems(parsed.data.search ?? "");
  res.json(records.map((record) => ({
    id: record.id,
    title: record.title,
    subtitle: record.subtitle || null,
    slug: record.slug,
    year: record.year,
    runtime: record.runtime || null,
    choreographer: record.choreographer || null,
    genre: record.genre || null,
    stylePeriod: record.style_period || null,
    youtubeId: record.youtube_id || null,
    thumbnailUrl: record.thumbnail_url || null,
    heroImageUrl: record.hero_image_url || null,
    sourceUpdatedAt: odooDateTime(record.sanity_updated_at),
    managedBySanity: Boolean(record.sanity_id),
  })));
});

router.get("/content/media", async (req, res): Promise<void> => {
  const parsed = ListMediaItemsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!requireOdoo(res)) return;
  const records = await listOdooMediaItems(parsed.data.search ?? "");
  res.json(records.map((record) => ({
    id: record.id,
    title: record.title,
    slug: record.slug || null,
    videoType: record.video_type || null,
    duration: record.duration || null,
    publishedAt: odooDateTime(record.published_at),
    featured: record.featured,
    tags: record.tags ? record.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
    category: record.category || null,
    videoUrl: record.video_url || null,
    vimeoUrl: record.vimeo_url || null,
    youtubeUrl: record.youtube_url || null,
    thumbnailUrl: record.thumbnail_url || null,
    sourceUpdatedAt: odooDateTime(record.sanity_updated_at),
    managedBySanity: Boolean(record.sanity_id),
  })));
});

router.get("/content/website-settings", async (_req, res): Promise<void> => {
  if (!requireOdoo(res)) return;
  const record = (await listOdooWebsiteSettings())[0];
  if (!record) { res.status(404).json({ error: "Website settings not found" }); return; }
  res.json({
    id: record.id,
    title: record.title,
    description: record.description || null,
    lightLogoUrl: record.light_logo_url || null,
    darkLogoUrl: record.dark_logo_url || null,
    heroImageUrl: record.hero_image_url || null,
    homeHeroImageUrl: record.home_hero_image_url || null,
    lastSyncAt: odooDateTime(record.last_sync_at),
    lastSyncStatus: record.last_sync_status || null,
    lastSyncMessage: record.last_sync_message || null,
    sourceUpdatedAt: odooDateTime(record.sanity_updated_at),
    managedBySanity: Boolean(record.sanity_id),
  });
});

export default router;
