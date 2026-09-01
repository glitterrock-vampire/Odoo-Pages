import { Router, type IRouter } from "express";
import {
  listOdooEducationClasses,
  listOdooInvoices,
  listOdooDonations,
  isOdooConfigured,
} from "../lib/odoo";
import { GetFinanceReportQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

router.get("/reports/enrollment", async (_req, res): Promise<void> => {
  if (!isOdooConfigured()) {
    res.status(503).json({ error: "Odoo integration not configured" });
    return;
  }
  const classes = await listOdooEducationClasses("", 500);
  res.json(classes.map((classRecord) => ({
    classId: classRecord.id,
    className: classRecord.className,
    style: classRecord.programName ?? "Dance education",
    enrolledCount: classRecord.enrolledCount,
    capacity: classRecord.capacity,
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
  const currency = invoices.find((invoice) => invoice.currency_id)?.currency_id
    || donations.find((donation) => donation.currency_id)?.currency_id
    || false;
  const currencyCode = currency ? currency[1] : "JMD";
  const totals = MONTHS.map((month) => ({
    month,
    revenue: 0,
    billed: 0,
    collected: 0,
    outstanding: 0,
    invoiceCount: 0,
    donations: 0,
    currency: currencyCode,
  }));
  for (const invoice of invoices) {
    if (!invoice.invoice_date) continue;
    const date = new Date(invoice.invoice_date);
    if (date.getFullYear() !== year) continue;
    totals[date.getMonth()].revenue += invoice.amount_total;
    totals[date.getMonth()].billed += invoice.amount_total;
    totals[date.getMonth()].collected += invoice.amount_total - invoice.amount_residual;
    totals[date.getMonth()].outstanding += invoice.amount_residual;
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
