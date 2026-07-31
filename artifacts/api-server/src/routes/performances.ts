import { Router, type IRouter } from "express";
import {
  createOdooPerformance,
  deleteOdooPerformance,
  getOdooPerformance,
  isOdooConfigured,
  listOdooPerformances,
  updateOdooPerformance,
  type OdooPerformance,
} from "../lib/odoo";
import {
  CreatePerformanceBody,
  UpdatePerformanceBody,
  ListPerformancesQueryParams,
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

function formatPerformance(performance: OdooPerformance) {
  return {
    id: performance.id,
    title: performance.title,
    date: performance.date,
    time: performance.time || null,
    venue: performance.venue,
    description: performance.description || null,
    status: performance.status,
    participatingClassIds: performance.participating_class_ids,
    ticketPrice: performance.ticket_price || null,
    capacity: performance.capacity || null,
    createdAt: performance.create_date,
    managedBySanity: Boolean(performance.sanity_id),
  };
}

function odooValues(data: Record<string, unknown>) {
  const values: Record<string, unknown> = {};
  const directFields = ["title", "date", "time", "venue", "description", "status", "capacity"];
  for (const field of directFields) {
    if (data[field] !== undefined) values[field] = data[field] || false;
  }
  if (data.ticketPrice !== undefined) values.ticket_price = data.ticketPrice || 0;
  if (data.participatingClassIds !== undefined) {
    values.participating_class_ids = [[6, 0, data.participatingClassIds]];
  }
  return values;
}

router.get("/performances", async (req, res): Promise<void> => {
  const params = ListPerformancesQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!requireOdoo(res)) return;
  const records = await listOdooPerformances(params.data.search ?? "", params.data.upcoming ?? false);
  res.json(records.map(formatPerformance));
});

router.post("/performances", async (req, res): Promise<void> => {
  const parsed = CreatePerformanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!requireOdoo(res)) return;
  const performance = await createOdooPerformance(odooValues(parsed.data));
  res.status(201).json(formatPerformance(performance));
});

router.get("/performances/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!requireOdoo(res)) return;
  const performance = await getOdooPerformance(id);
  if (!performance) { res.status(404).json({ error: "Performance not found" }); return; }
  res.json(formatPerformance(performance));
});

router.patch("/performances/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdatePerformanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!requireOdoo(res)) return;
  const existing = await getOdooPerformance(id);
  if (!existing) { res.status(404).json({ error: "Performance not found" }); return; }
  const sourceOwnedFields = ["title", "date", "time", "venue", "description", "status"];
  if (existing.sanity_id && sourceOwnedFields.some((field) => parsed.data[field as keyof typeof parsed.data] !== undefined)) {
    res.status(409).json({
      error: "This performance is still managed by Sanity. Only Odoo-specific classes, ticket price, and capacity can be changed until website cutover.",
    });
    return;
  }
  const performance = await updateOdooPerformance(id, odooValues(parsed.data));
  if (!performance) { res.status(404).json({ error: "Performance not found" }); return; }
  res.json(formatPerformance(performance));
});

router.delete("/performances/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!requireOdoo(res)) return;
  const existing = await getOdooPerformance(id);
  if (!existing) { res.status(404).json({ error: "Performance not found" }); return; }
  if (existing.sanity_id) {
    res.status(409).json({ error: "This performance is managed by Sanity and cannot be deleted from the Odoo mirror." });
    return;
  }
  if (!await deleteOdooPerformance(id)) {
    res.status(404).json({ error: "Performance not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
