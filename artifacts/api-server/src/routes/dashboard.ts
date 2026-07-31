import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, studentsTable, classesTable, performancesTable } from "@workspace/db";
import {
  getOdooDashboardSnapshot,
  isOdooConfigured,
} from "../lib/odoo";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res): Promise<void> => {
  const [studentCount, classCount, upcomingCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(studentsTable).where(eq(studentsTable.status, "active")),
    db.select({ count: sql<number>`count(*)` }).from(classesTable).where(eq(classesTable.status, "active")),
    db.select({ count: sql<number>`count(*)` }).from(performancesTable).where(eq(performancesTable.status, "upcoming")),
  ]);

  const dashboardStats: {
    totalDonations: number | null;
    openTasks: number | null;
    monthlyRevenue: number | null;
    pendingInvoices: number | null;
    newContactsThisMonth: number | null;
    feesBilled: number | null;
    feesCollected: number | null;
    feesOutstanding: number | null;
    unbilledFees: number | null;
    overdueFeesCount: number | null;
    currency: string;
    paymentProviderName: string | null;
    paymentProviderState: string | null;
    paymentJournalName: string | null;
    teamMembers: number | null;
    repertoireItems: number | null;
    totalPerformances: number | null;
    mediaItems: number | null;
    contentLastSyncAt: string | null;
    contentSyncStatus: string | null;
  } = {
    totalDonations: null,
    openTasks: null,
    monthlyRevenue: null,
    pendingInvoices: null,
    newContactsThisMonth: null,
    feesBilled: null,
    feesCollected: null,
    feesOutstanding: null,
    unbilledFees: null,
    overdueFeesCount: null,
    currency: "JMD",
    paymentProviderName: null,
    paymentProviderState: null,
    paymentJournalName: null,
    teamMembers: null,
    repertoireItems: null,
    totalPerformances: null,
    mediaItems: null,
    contentLastSyncAt: null,
    contentSyncStatus: null,
  };

  let totalStudents = Number(studentCount[0]?.count ?? 0);
  let activeClasses = Number(classCount[0]?.count ?? 0);
  let upcomingPerformances = Number(upcomingCount[0]?.count ?? 0);

  if (isOdooConfigured()) {
    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      const month = monthStart.toISOString().split("T")[0];
      const odoo = await getOdooDashboardSnapshot(month);
      const {
        activeStudents: odooActiveStudents,
        activeClasses: odooActiveClasses,
        upcomingPerformances: odooUpcomingPerformances,
        ...odooAdministrativeStats
      } = odoo;
      totalStudents = odooActiveStudents;
      activeClasses = odooActiveClasses;
      upcomingPerformances = odooUpcomingPerformances;
      Object.assign(dashboardStats, odooAdministrativeStats);
    } catch (err) {
      req.log.error({ err }, "Failed to fetch Odoo dashboard stats");
    }
  }

  res.json({
    totalStudents,
    activeClasses,
    upcomingPerformances,
    odooConfigured: isOdooConfigured(),
    ...dashboardStats,
  });
});

export default router;
