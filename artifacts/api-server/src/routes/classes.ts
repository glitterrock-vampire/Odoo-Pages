import { Router, type IRouter } from "express";
import { ListClassesQueryParams } from "@workspace/api-zod";
import { isOdooConfigured, listOdooEducationClasses } from "../lib/odoo";

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

function formatClass(classRecord: Awaited<ReturnType<typeof listOdooEducationClasses>>[number]) {
  return {
    id: classRecord.id,
    name: classRecord.className,
    style: classRecord.programName ?? "Dance education",
    instructor: classRecord.instructorNames.join(", ") || "Not assigned",
    schedule: classRecord.scheduleLabel,
    location: classRecord.locationLabel,
    capacity: classRecord.capacity,
    enrolledCount: classRecord.enrolledCount,
    status: classRecord.active && ["open", "in_progress"].includes(classRecord.state) ? "active" : "inactive",
    classStatus: classRecord.state,
    academicYear: classRecord.academic_year_id ? classRecord.academic_year_id[1] : null,
    academicTerm: classRecord.academic_term_id ? classRecord.academic_term_id[1] : null,
    deliveryMode: classRecord.delivery_mode,
    studentIds: classRecord.studentIds,
    studentNames: classRecord.studentNames,
    description: classRecord.programName,
    ageGroup: null,
    fee: classRecord.tuitionAmount,
    currency: classRecord.currency,
    sampleData: classRecord.sampleData,
    createdAt: odooDateTime(classRecord.create_date),
  };
}

router.get("/classes", async (req, res): Promise<void> => {
  const params = ListClassesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!requireOdoo(res)) return;
  const classes = await listOdooEducationClasses(params.data.search?.trim() ?? "");
  res.json(classes.map(formatClass));
});

router.get("/classes/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (!requireOdoo(res)) return;
  const classRecord = (await listOdooEducationClasses("", 1000)).find((item) => item.id === id);
  if (!classRecord) {
    res.status(404).json({ error: "Class not found" });
    return;
  }
  res.json(formatClass(classRecord));
});

function odooManagedResponse(res: import("express").Response): void {
  res.status(409).json({
    error: "Classes, enrollment, and tuition are now managed together in Odoo. Use the Odoo Education workspace for changes so these linked records remain consistent.",
  });
}

router.post("/classes", (_req, res): void => odooManagedResponse(res));
router.patch("/classes/:id", (_req, res): void => odooManagedResponse(res));
router.delete("/classes/:id", (_req, res): void => odooManagedResponse(res));

export default router;
