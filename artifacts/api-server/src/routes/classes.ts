import { Router, type IRouter } from "express";
import { eq, ilike, sql } from "drizzle-orm";
import { db, classesTable, studentClassesTable } from "@workspace/db";
import {
  CreateClassBody,
  UpdateClassBody,
  ListClassesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getEnrolledCount(classId: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(studentClassesTable)
    .where(eq(studentClassesTable.classId, classId));
  return Number(result[0]?.count ?? 0);
}

function formatClass(c: typeof classesTable.$inferSelect, enrolledCount: number) {
  return {
    ...c,
    enrolledCount,
    fee: c.fee != null ? parseFloat(c.fee) : null,
    description: c.description ?? null,
    ageGroup: c.ageGroup ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/classes", async (req, res): Promise<void> => {
  const params = ListClassesQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { search } = params.data;
  const classes = await db
    .select()
    .from(classesTable)
    .where(search ? ilike(classesTable.name, `%${search}%`) : undefined)
    .orderBy(classesTable.name);

  const result = await Promise.all(
    classes.map(async (c) => formatClass(c, await getEnrolledCount(c.id)))
  );
  res.json(result);
});

router.post("/classes", async (req, res): Promise<void> => {
  const parsed = CreateClassBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { fee, ...rest } = parsed.data as { fee?: number } & Record<string, unknown>;
  const [cls] = await db
    .insert(classesTable)
    .values({ ...rest as Partial<typeof classesTable.$inferInsert>, fee: fee != null ? String(fee) : undefined })
    .returning();

  res.status(201).json(formatClass(cls, 0));
});

router.get("/classes/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [cls] = await db.select().from(classesTable).where(eq(classesTable.id, id));
  if (!cls) { res.status(404).json({ error: "Class not found" }); return; }

  res.json(formatClass(cls, await getEnrolledCount(id)));
});

router.patch("/classes/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateClassBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { fee, ...rest } = parsed.data as { fee?: number } & Record<string, unknown>;
  const updateData: Partial<typeof classesTable.$inferInsert> = { ...rest as Partial<typeof classesTable.$inferInsert> };
  if (fee !== undefined) updateData.fee = fee != null ? String(fee) : undefined;

  const [cls] = await db
    .update(classesTable)
    .set(updateData)
    .where(eq(classesTable.id, id))
    .returning();

  if (!cls) { res.status(404).json({ error: "Class not found" }); return; }
  res.json(formatClass(cls, await getEnrolledCount(id)));
});

router.delete("/classes/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(classesTable).where(eq(classesTable.id, id));
  res.sendStatus(204);
});

export default router;
