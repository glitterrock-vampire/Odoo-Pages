import { Router, type IRouter } from "express";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db, studentsTable, classesTable, studentClassesTable } from "@workspace/db";
import {
  CreateStudentBody,
  UpdateStudentBody,
  ListStudentsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function getEnrolledClassIds(studentId: number): Promise<number[]> {
  const rows = await db
    .select({ classId: studentClassesTable.classId })
    .from(studentClassesTable)
    .where(eq(studentClassesTable.studentId, studentId));
  return rows.map((r) => r.classId);
}

async function setEnrolledClasses(studentId: number, classIds: number[]): Promise<void> {
  await db.delete(studentClassesTable).where(eq(studentClassesTable.studentId, studentId));
  if (classIds.length > 0) {
    await db.insert(studentClassesTable).values(classIds.map((classId) => ({ studentId, classId })));
  }
}

router.get("/students", async (req, res): Promise<void> => {
  const params = ListStudentsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { search, status } = params.data;
  const conditions = [];
  if (search) conditions.push(ilike(studentsTable.firstName, `%${search}%`));
  if (status) conditions.push(eq(studentsTable.status, status));

  const students = await db
    .select()
    .from(studentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(studentsTable.lastName);

  const result = await Promise.all(
    students.map(async (s) => ({
      ...s,
      enrolledClassIds: await getEnrolledClassIds(s.id),
      dateOfBirth: s.dateOfBirth ?? null,
      email: s.email ?? null,
      phone: s.phone ?? null,
      guardianName: s.guardianName ?? null,
      guardianPhone: s.guardianPhone ?? null,
      notes: s.notes ?? null,
      createdAt: s.createdAt.toISOString(),
    }))
  );

  res.json(result);
});

router.post("/students", async (req, res): Promise<void> => {
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { enrolledClassIds = [], ...studentData } = parsed.data as {
    enrolledClassIds?: number[];
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    status?: string;
    guardianName?: string;
    guardianPhone?: string;
    notes?: string;
  };

  const [student] = await db
    .insert(studentsTable)
    .values({
      firstName: studentData.firstName,
      lastName: studentData.lastName,
      email: studentData.email,
      phone: studentData.phone,
      dateOfBirth: studentData.dateOfBirth,
      status: studentData.status ?? "active",
      guardianName: studentData.guardianName,
      guardianPhone: studentData.guardianPhone,
      notes: studentData.notes,
    })
    .returning();

  await setEnrolledClasses(student.id, enrolledClassIds);

  res.status(201).json({
    ...student,
    enrolledClassIds,
    createdAt: student.createdAt.toISOString(),
    email: student.email ?? null,
    phone: student.phone ?? null,
    dateOfBirth: student.dateOfBirth ?? null,
    guardianName: student.guardianName ?? null,
    guardianPhone: student.guardianPhone ?? null,
    notes: student.notes ?? null,
  });
});

router.get("/students/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const enrolledClassIds = await getEnrolledClassIds(id);
  res.json({
    ...student,
    enrolledClassIds,
    createdAt: student.createdAt.toISOString(),
    email: student.email ?? null,
    phone: student.phone ?? null,
    dateOfBirth: student.dateOfBirth ?? null,
    guardianName: student.guardianName ?? null,
    guardianPhone: student.guardianPhone ?? null,
    notes: student.notes ?? null,
  });
});

router.patch("/students/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateStudentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { enrolledClassIds, ...rest } = parsed.data as { enrolledClassIds?: number[] } & Record<string, unknown>;

  const [student] = await db
    .update(studentsTable)
    .set(rest as Partial<typeof studentsTable.$inferInsert>)
    .where(eq(studentsTable.id, id))
    .returning();

  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  if (enrolledClassIds !== undefined) {
    await setEnrolledClasses(id, enrolledClassIds);
  }

  const classIds = enrolledClassIds ?? (await getEnrolledClassIds(id));
  res.json({
    ...student,
    enrolledClassIds: classIds,
    createdAt: student.createdAt.toISOString(),
    email: student.email ?? null,
    phone: student.phone ?? null,
    dateOfBirth: student.dateOfBirth ?? null,
    guardianName: student.guardianName ?? null,
    guardianPhone: student.guardianPhone ?? null,
    notes: student.notes ?? null,
  });
});

router.delete("/students/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(studentsTable).where(eq(studentsTable.id, id));
  res.sendStatus(204);
});

export default router;
