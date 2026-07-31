import { Router, type IRouter } from "express";
import { ListStudentsQueryParams } from "@workspace/api-zod";
import { isOdooConfigured, listOdooEducationStudents } from "../lib/odoo";

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

function odooDateTime(value: string): string {
  return `${value.replace(" ", "T")}Z`;
}

function formatStudent(student: Awaited<ReturnType<typeof listOdooEducationStudents>>[number]) {
  return {
    id: student.id,
    studentNumber: student.name,
    firstName: student.first_name,
    lastName: student.last_name,
    contactId: student.contactId,
    contactName: student.partner_id ? student.partner_id[1] : `${student.first_name} ${student.last_name}`,
    email: student.email || null,
    phone: student.phone || null,
    dateOfBirth: student.date_of_birth || null,
    status: student.active && student.status === "active" ? "active" : "inactive",
    academicStatus: student.status,
    enrolledClassIds: student.classIds,
    classNames: student.classNames,
    programName: student.programName,
    tuitionBilled: student.tuitionBilled,
    tuitionPaid: student.tuitionPaid,
    tuitionBalance: student.tuitionBalance,
    tuitionStatus: student.tuitionStatus,
    currency: student.currency,
    guardianName: null,
    guardianPhone: null,
    notes: null,
    sampleData: student.sampleData,
    createdAt: odooDateTime(student.create_date),
  };
}

router.get("/students", async (req, res): Promise<void> => {
  const params = ListStudentsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!requireOdoo(res)) return;

  const students = await listOdooEducationStudents(
    params.data.search?.trim() ?? "",
    params.data.status ?? undefined,
  );
  const filtered = params.data.classId
    ? students.filter((student) => student.classIds.includes(params.data.classId as number))
    : students;
  res.json(filtered.map(formatStudent));
});

router.get("/students/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (!requireOdoo(res)) return;
  const student = (await listOdooEducationStudents("", undefined, 1000)).find((item) => item.id === id);
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  res.json(formatStudent(student));
});

function odooManagedResponse(res: import("express").Response): void {
  res.status(409).json({
    error: "Students, class enrollment, and tuition are now managed together in Odoo. Use the Odoo Education workspace for changes so these linked records remain consistent.",
  });
}

router.post("/students", (_req, res): void => odooManagedResponse(res));
router.patch("/students/:id", (_req, res): void => odooManagedResponse(res));
router.delete("/students/:id", (_req, res): void => odooManagedResponse(res));

export default router;
