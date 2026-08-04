import { Router, type IRouter } from "express";
import {
  listOdooTasks,
  createOdooTask,
  updateOdooTask,
  deleteOdooTask,
  isOdooConfigured,
  type OdooTask,
} from "../lib/odoo";
import { CreateTaskBody, UpdateTaskBody, ListTasksQueryParams } from "@workspace/api-zod";

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

const STAGE_MAP: Record<string, string> = {
  New: "todo",
  "In Progress": "in_progress",
  Done: "done",
  Cancelled: "cancelled",
};

const PRIORITY_MAP: Record<string, string> = { "0": "normal", "1": "high" };

function plainTextDescription(value: string | false): string | null {
  if (!value) return null;
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function formatTask(task: OdooTask) {
  return {
    id: String(task.id),
    title: task.name,
    description: plainTextDescription(task.description),
    stage: task.stage_id ? STAGE_MAP[task.stage_id[1]] ?? "todo" : "todo",
    assigneeName: task.assignee_name ?? null,
    deadline: task.date_deadline ? task.date_deadline.slice(0, 10) : null,
    priority: PRIORITY_MAP[task.priority] ?? "normal",
    projectName: task.project_id ? task.project_id[1] : null,
    odooId: String(task.id),
    createdAt: task.create_date,
  };
}

router.get("/tasks", async (req, res): Promise<void> => {
  const params = ListTasksQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!requireOdoo(res)) return;
  const tasks = await listOdooTasks(params.data.search ?? "", 500);
  const formatted = tasks.map(formatTask);
  res.json(params.data.stage ? formatted.filter((task) => task.stage === params.data.stage) : formatted);
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!requireOdoo(res)) return;
  const task = await createOdooTask(parsed.data);
  res.status(201).json(formatTask(task));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!requireOdoo(res)) return;
  res.json(formatTask(await updateOdooTask(id, parsed.data)));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!requireOdoo(res)) return;
  await deleteOdooTask(id);
  res.sendStatus(204);
});

export default router;
