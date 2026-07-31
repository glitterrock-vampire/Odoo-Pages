import { Router, type IRouter } from "express";
import { ListTuitionFeesQueryParams } from "@workspace/api-zod";
import {
  isOdooConfigured,
  listOdooEducationStudents,
  listOdooStudentFees,
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

router.get("/tuition/fees", async (req, res): Promise<void> => {
  const params = ListTuitionFeesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!requireOdoo(res)) return;

  const today = new Date().toISOString().slice(0, 10);
  const [fees, students] = await Promise.all([
    listOdooStudentFees(
      params.data.search?.trim() ?? "",
      params.data.status ?? undefined,
    ),
    listOdooEducationStudents("", undefined, 1000),
  ]);
  const studentById = new Map(students.map((student) => [student.id, student]));

  res.json(fees.map((fee) => {
    const student = fee.student_id ? studentById.get(fee.student_id[0]) : undefined;
    return {
      id: fee.id,
      reference: fee.name,
      studentId: fee.student_id ? fee.student_id[0] : 0,
      studentName: fee.student_id ? fee.student_id[1] : "Unknown student",
      feeSchedule: fee.fee_schedule_id ? fee.fee_schedule_id[1] : null,
      feeStructure: fee.fee_structure_id ? fee.fee_structure_id[1] : "Unassigned",
      dueDate: fee.due_date,
      amount: fee.amount,
      amountPaid: fee.amount_paid,
      balance: fee.balance,
      currency: fee.currency_id ? fee.currency_id[1] : "JMD",
      status: fee.state,
      overdue: fee.balance > 0
        && fee.due_date < today
        && fee.state !== "paid"
        && fee.state !== "cancelled",
      invoiceId: fee.invoice_id ? fee.invoice_id[0] : null,
      invoiceName: fee.invoice_id ? fee.invoice_id[1] : null,
      invoiceState: fee.invoice_state === "cancel" ? "cancelled" : fee.invoice_state || null,
      paymentState: fee.payment_state || null,
      contactId: student?.contactId ?? null,
      programName: student?.programName ?? null,
      classIds: student?.classIds ?? [],
      classNames: student?.classNames ?? [],
      sampleData: student?.sampleData ?? false,
    };
  }));
});

export default router;
