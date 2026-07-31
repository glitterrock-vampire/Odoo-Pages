import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, classesTable, studentClassesTable } from "@workspace/db";
import { listOdooInvoices, listOdooDonations, isOdooConfigured } from "../lib/odoo";
import { GetFinanceReportQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

router.get("/reports/enrollment", async (_req, res): Promise<void> => {
  const classes = await db.select().from(classesTable).orderBy(classesTable.name);
  const counts = await db.select({
    classId: studentClassesTable.classId,
    count: sql<number>`count(*)`,
  }).from(studentClassesTable).groupBy(studentClassesTable.classId);
  const countMap = new Map(counts.map((entry) => [entry.classId, Number(entry.count)]));
  res.json(classes.map((danceClass) => ({
    classId: danceClass.id,
    className: danceClass.name,
    style: danceClass.style,
    enrolledCount: countMap.get(danceClass.id) ?? 0,
    capacity: danceClass.capacity,
  })));
});

router.get("/reports/finances", async (req, res): Promise<void> => {
  const params = GetFinanceReportQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!isOdooConfigured()) {
    res.status(503).json({ error: "Odoo integration not configured" });
    return;
  }
  const year = params.data.year ?? new Date().getFullYear();
  const [invoices, donations] = await Promise.all([
    listOdooInvoices("", "posted", 1000),
    listOdooDonations("", "paid", 1000),
  ]);
  const totals = MONTHS.map((month) => ({ month, revenue: 0, invoiceCount: 0, donations: 0 }));
  for (const invoice of invoices) {
    if (!invoice.invoice_date) continue;
    const date = new Date(invoice.invoice_date);
    if (date.getFullYear() !== year) continue;
    totals[date.getMonth()].revenue += invoice.amount_total;
    totals[date.getMonth()].invoiceCount += 1;
  }
  for (const donation of donations) {
    if (!donation.donation_date) continue;
    const date = new Date(donation.donation_date);
    if (date.getFullYear() === year) totals[date.getMonth()].donations += donation.amount;
  }
  res.json(totals);
});

export default router;
