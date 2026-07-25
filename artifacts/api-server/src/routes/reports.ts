import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, classesTable, studentClassesTable } from "@workspace/db";
import { listOdooInvoices, listOdooDonations, isOdooConfigured } from "../lib/odoo";
import { GetFinanceReportQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Enrollment report — always available from local DB
router.get("/reports/enrollment", async (req, res): Promise<void> => {
  const classes = await db.select().from(classesTable).orderBy(classesTable.name);

  const enrollmentCounts = await db
    .select({
      classId: studentClassesTable.classId,
      count: sql<number>`count(*)`,
    })
    .from(studentClassesTable)
    .groupBy(studentClassesTable.classId);

  const countMap = new Map(enrollmentCounts.map((e) => [e.classId, Number(e.count)]));

  res.json(
    classes.map((c) => ({
      classId: c.id,
      className: c.name,
      style: c.style,
      enrolledCount: countMap.get(c.id) ?? 0,
      capacity: c.capacity,
    }))
  );
});

// Finance report — requires Odoo
router.get("/reports/finances", async (req, res): Promise<void> => {
  const params = GetFinanceReportQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  if (!isOdooConfigured()) {
    res.status(503).json({
      error: "Odoo integration not configured",
      hint: "Set ODOO_URL, ODOO_DB, and ODOO_API_KEY environment secrets.",
    });
    return;
  }

  const year = params.data.year ?? new Date().getFullYear();

  const [invoices, donations] = await Promise.all([
    listOdooInvoices("", "posted", 1000),
    listOdooDonations("", "paid", 1000),
  ]);

  const revenueByMonth: Record<string, { revenue: number; invoiceCount: number }> = {};
  const donationByMonth: Record<string, number> = {};

  for (const inv of invoices) {
    if (!inv.invoice_date) continue;
    const d = new Date(inv.invoice_date);
    if (d.getFullYear() !== year) continue;
    const m = MONTHS[d.getMonth()];
    if (!revenueByMonth[m]) revenueByMonth[m] = { revenue: 0, invoiceCount: 0 };
    revenueByMonth[m].revenue += inv.amount_total;
    revenueByMonth[m].invoiceCount++;
  }

  for (const don of donations) {
    if (!don.donation_date) continue;
    const d = new Date(don.donation_date);
    if (d.getFullYear() !== year) continue;
    const m = MONTHS[d.getMonth()];
    donationByMonth[m] = (donationByMonth[m] ?? 0) + don.amount;
  }

  res.json(
    MONTHS.map((m) => ({
      month: m,
      revenue: revenueByMonth[m]?.revenue ?? 0,
      invoiceCount: revenueByMonth[m]?.invoiceCount ?? 0,
      donations: donationByMonth[m] ?? 0,
    }))
  );
});

export default router;
