import { Router, type IRouter } from "express";
import {
  listOdooTasks,
  createOdooTask,
  updateOdooTask,
  deleteOdooTask,
  isOdooConfigured,
  type OdooTask,
} from "../lib/odoo";
import {
  CreateTaskBody,
  UpdateTaskBody,
  ListTasksQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireOdoo(res: import("express").Response): boolean {
  if (!isOdooConfigured()) {
    res.status(503).json({
      error: "Odoo integration not configured",
      hint: "Set ODOO_URL, ODOO_DB, and ODOO_API_KEY environment secrets.",
    });
    return false;
  }
  return true;
}

const STAGE_MAP: Record<string, string> = {
  "New": "todo",
  "In Progress": "in_progress",
  "Done": "done",
  "Cancelled": "cancelled",
};

const PRIORITY_MAP: Record<string, string> = {
  "0": "low",
  "1": "normal",
  "2": "high",
  "3": "high",
};

const PRIORITY_REVERSE: Record<string, string> = {
  low: "0",
  normal: "1",
  high: "2",
};

function formatTask(t: OdooTask) {
  return {
    id: t.id,
    title: t.name,
    description: t.description || null,
    stage: t.stage_id ? (STAGE_MAP[t.stage_id[1]] ?? "todo") : "todo",
    assigneeName: t.user_ids.length > 0 ? (t.user_ids[0] as unknown as [number, string])[1] : null,
    deadline: t.date_deadline || null,
    priority: PRIORITY_MAP[t.priority] ?? "normal",
    projectName: t.project_id ? t.project_id[1] : null,
    odooId: t.id,
    createdAt: t.create_date || null,
  };
}

router.get("/tasks", async (req, res): Promise<void> => {
  const params = ListTasksQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!requireOdoo(res)) return;

  const tasks = await listOdooTasks(params.data.search ?? "", params.data.stage ?? undefined);
  res.json(tasks.map(formatTask));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!requireOdoo(res)) return;

  const odooId = await createOdooTask({
    name: parsed.data.title,
    description: parsed.data.description,
    date_deadline: parsed.data.deadline,
    priority: PRIORITY_REVERSE[parsed.data.priority ?? "normal"] ?? "1",
  });

  // Re-fetch from Odoo to return canonical shape
  const tasks = await listOdooTasks("", undefined, 1000);
  const created = tasks.find((t) => t.id === odooId);
  if (!created) { res.status(500).json({ error: "Task created in Odoo but could not be retrieved" }); return; }
  res.status(201).json(formatTask(created));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!requireOdoo(res)) return;

  await updateOdooTask(id, {
    name: parsed.data.title,
    description: parsed.data.description,
    date_deadline: parsed.data.deadline,
    ...(parsed.data.priority ? { priority: PRIORITY_REVERSE[parsed.data.priority] ?? "1" } : {}),
  });

  const tasks = await listOdooTasks("", undefined, 1000);
  const updated = tasks.find((t) => t.id === id);
  if (!updated) { res.status(404).json({ error: "Task not found" }); return; }
  res.json(formatTask(updated));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!requireOdoo(res)) return;

  await deleteOdooTask(id);
  res.sendStatus(204);
});

export default router;
