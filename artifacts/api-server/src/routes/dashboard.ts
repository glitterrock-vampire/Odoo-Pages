import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, studentsTable, classesTable, performancesTable } from "@workspace/db";
import {
  listOdooTasks,
  listOdooDonations,
  listOdooInvoices,
  listOdooPartners,
  isOdooConfigured,
} from "../lib/odoo";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  // Local DB counts — always available
  const [studentCount, classCount, upcomingCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(studentsTable).where(eq(studentsTable.status, "active")),
    db.select({ count: sql<number>`count(*)` }).from(classesTable).where(eq(classesTable.status, "active")),
    db.select({ count: sql<number>`count(*)` }).from(performancesTable).where(eq(performancesTable.status, "upcoming")),
  ]);

  // Odoo-sourced stats — null when not configured
  let odooStats: {
    totalDonations: number | null;
    openTasks: number | null;
    monthlyRevenue: number | null;
    pendingInvoices: number | null;
    newContactsThisMonth: number | null;
  } = {
    totalDonations: null,
    openTasks: null,
    monthlyRevenue: null,
    pendingInvoices: null,
    newContactsThisMonth: null,
  };

  if (isOdooConfigured()) {
    try {
      const [tasks, donations, invoices, partners] = await Promise.all([
        listOdooTasks("", undefined, 500),
        listOdooDonations("", "paid", 500),
        listOdooInvoices("", "posted", 500),
        listOdooPartners("", 500),
      ]);

      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStr = monthStart.toISOString().split("T")[0];

      odooStats = {
        openTasks: tasks.filter(
          (t) => t.stage_id && !["Done", "Cancelled"].includes(t.stage_id[1])
        ).length,
        totalDonations: donations.reduce((s, d) => s + d.amount, 0),
        monthlyRevenue: invoices
          .filter((i) => i.invoice_date && i.invoice_date >= monthStr)
          .reduce((s, i) => s + i.amount_total, 0),
        pendingInvoices: invoices.filter((i) => i.payment_state === "not_paid").length,
        newContactsThisMonth: partners.filter((p) => p.create_date && p.create_date >= monthStr).length,
      };
    } catch (err) {
      req.log.error({ err }, "Failed to fetch Odoo dashboard stats");
      // Leave odooStats as null — the client can show a warning
    }
  }

  res.json({
    totalStudents: Number(studentCount[0]?.count ?? 0),
    activeClasses: Number(classCount[0]?.count ?? 0),
    upcomingPerformances: Number(upcomingCount[0]?.count ?? 0),
    odooConfigured: isOdooConfigured(),
    ...odooStats,
  });
});

export default router;
