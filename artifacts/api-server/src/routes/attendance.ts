import { Router, type IRouter } from "express";
import { GetAttendanceQueryParams } from "@workspace/api-zod";
import {
  isOdooConfigured,
  listOdooStudentAttendance,
  type OdooAttendanceStatus,
  type OdooStudentAttendance,
} from "../lib/odoo";

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

function odooDateTime(value: string | false): string | null {
  return value ? `${value.replace(" ", "T")}Z` : null;
}

function formatAttendance(record: OdooStudentAttendance) {
  return {
    id: record.id,
    date: record.date,
    studentId: record.student_id ? record.student_id[0] : 0,
    studentName: record.student_id ? record.student_id[1] : "Unknown student",
    groupId: record.student_group_id ? record.student_group_id[0] : 0,
    groupName: record.student_group_id ? record.student_group_id[1] : "Unknown group",
    courseId: record.course_id ? record.course_id[0] : null,
    courseName: record.course_id ? record.course_id[1] : null,
    scheduleId: record.schedule_id ? record.schedule_id[0] : null,
    scheduleName: record.schedule_id ? record.schedule_id[1] : null,
    status: record.status,
    checkIn: odooDateTime(record.check_in),
    checkOut: odooDateTime(record.check_out),
    minutesLate: record.minutes_late || 0,
    earlyDepartureMinutes: record.early_departure_minutes || 0,
    remarks: record.remarks || null,
  };
}

function countStatus(records: OdooStudentAttendance[], status: OdooAttendanceStatus): number {
  return records.filter((record) => record.status === status).length;
}

function percentage(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function jamaicaDate(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Jamaica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

router.get("/attendance", async (req, res): Promise<void> => {
  const params = GetAttendanceQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!requireOdoo(res)) return;

  const allRecords = await listOdooStudentAttendance(params.data.search?.trim() ?? "");
  const selectedStatus = params.data.status ?? undefined;
  const records = selectedStatus
    ? allRecords.filter((record) => record.status === selectedStatus)
    : allRecords;
  const today = jamaicaDate();
  const todayRecords = allRecords.filter((record) => record.date === today);
  const present = countStatus(allRecords, "present");
  const late = countStatus(allRecords, "late");
  const todayPresent = countStatus(todayRecords, "present");
  const todayLate = countStatus(todayRecords, "late");

  res.json({
    generatedAt: new Date().toISOString(),
    summary: {
      total: allRecords.length,
      present,
      late,
      absent: countStatus(allRecords, "absent"),
      leave: countStatus(allRecords, "leave"),
      excused: countStatus(allRecords, "excused"),
      attendanceRate: percentage(present + late, allRecords.length),
      todayTotal: todayRecords.length,
      todayPresent,
      todayLate,
      todayAbsent: countStatus(todayRecords, "absent"),
      todayRate: percentage(todayPresent + todayLate, todayRecords.length),
    },
    records: records.map(formatAttendance),
  });
});

export default router;
