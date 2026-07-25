import { Router, type IRouter } from "express";
import { eq, ilike, gte, and } from "drizzle-orm";
import { db, performancesTable, performanceClassesTable } from "@workspace/db";
import {
  CreatePerformanceBody,
  UpdatePerformanceBody,
  ListPerformancesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getParticipatingClassIds(performanceId: number): Promise<number[]> {
  const rows = await db
    .select({ classId: performanceClassesTable.classId })
    .from(performanceClassesTable)
    .where(eq(performanceClassesTable.performanceId, performanceId));
  return rows.map((r) => r.classId);
}

async function setParticipatingClasses(performanceId: number, classIds: number[]): Promise<void> {
  await db.delete(performanceClassesTable).where(eq(performanceClassesTable.performanceId, performanceId));
  if (classIds.length > 0) {
    await db.insert(performanceClassesTable).values(classIds.map((classId) => ({ performanceId, classId })));
  }
}

function formatPerformance(p: typeof performancesTable.$inferSelect, classIds: number[]) {
  return {
    ...p,
    participatingClassIds: classIds,
    time: p.time ?? null,
    description: p.description ?? null,
    ticketPrice: p.ticketPrice != null ? parseFloat(p.ticketPrice) : null,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/performances", async (req, res): Promise<void> => {
  const params = ListPerformancesQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { search, upcoming } = params.data;
  const conditions = [];
  if (search) conditions.push(ilike(performancesTable.title, `%${search}%`));
  if (upcoming) {
    conditions.push(eq(performancesTable.status, "upcoming"));
  }

  const performances = await db
    .select()
    .from(performancesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(performancesTable.date);

  const result = await Promise.all(
    performances.map(async (p) => formatPerformance(p, await getParticipatingClassIds(p.id)))
  );
  res.json(result);
});

router.post("/performances", async (req, res): Promise<void> => {
  const parsed = CreatePerformanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { participatingClassIds = [], ticketPrice, ...rest } = parsed.data as {
    participatingClassIds?: number[];
    ticketPrice?: number;
  } & Record<string, unknown>;

  const [performance] = await db
    .insert(performancesTable)
    .values({
      ...rest as Partial<typeof performancesTable.$inferInsert>,
      ticketPrice: ticketPrice != null ? String(ticketPrice) : undefined,
      status: (rest.status as string) ?? "upcoming",
    })
    .returning();

  await setParticipatingClasses(performance.id, participatingClassIds);
  res.status(201).json(formatPerformance(performance, participatingClassIds));
});

router.get("/performances/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [performance] = await db.select().from(performancesTable).where(eq(performancesTable.id, id));
  if (!performance) { res.status(404).json({ error: "Performance not found" }); return; }

  const classIds = await getParticipatingClassIds(id);
  res.json(formatPerformance(performance, classIds));
});

router.patch("/performances/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdatePerformanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { participatingClassIds, ticketPrice, ...rest } = parsed.data as {
    participatingClassIds?: number[];
    ticketPrice?: number;
  } & Record<string, unknown>;

  const updateData: Partial<typeof performancesTable.$inferInsert> = { ...rest as Partial<typeof performancesTable.$inferInsert> };
  if (ticketPrice !== undefined) updateData.ticketPrice = ticketPrice != null ? String(ticketPrice) : undefined;

  const [performance] = await db
    .update(performancesTable)
    .set(updateData)
    .where(eq(performancesTable.id, id))
    .returning();

  if (!performance) { res.status(404).json({ error: "Performance not found" }); return; }

  if (participatingClassIds !== undefined) {
    await setParticipatingClasses(id, participatingClassIds);
  }

  const classIds = participatingClassIds ?? await getParticipatingClassIds(id);
  res.json(formatPerformance(performance, classIds));
});

router.delete("/performances/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(performancesTable).where(eq(performancesTable.id, id));
  res.sendStatus(204);
});

export default router;
