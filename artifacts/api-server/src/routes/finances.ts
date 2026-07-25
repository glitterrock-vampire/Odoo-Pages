import { Router, type IRouter } from "express";
import { listOdooInvoices, getOdooFinancialSummary, isOdooConfigured } from "../lib/odoo";
import { ListInvoicesQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function requireOdoo(res: import("express").Response): boolean {
  if (!isOdooConfigured()) {
    res.status(503).json({
      error: "Odoo integration not configured",
      hint: "Set ODOO_URL, ODOO_DB, and ODOO_API_KEY environment secrets.",
    });
    return false;
  }
  return true;
}

router.get("/finances/invoices", async (req, res): Promise<void> => {
  const params = ListInvoicesQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!requireOdoo(res)) return;

  const invoices = await listOdooInvoices(params.data.search ?? "", params.data.state ?? undefined);
  const formatted = invoices.map((inv) => ({
    id: inv.id,
    name: inv.name,
    partnerName: inv.partner_id ? inv.partner_id[1] : "Unknown",
    amountTotal: inv.amount_total,
    amountDue: inv.amount_residual,
    currency: inv.currency_id ? inv.currency_id[1] : "JMD",
    invoiceDate: inv.invoice_date || null,
    dueDate: inv.invoice_date_due || null,
    state: inv.state,
    paymentState: inv.payment_state,
    odooId: inv.id,
  }));
  res.json(formatted);
});

router.get("/finances/summary", async (req, res): Promise<void> => {
  if (!requireOdoo(res)) return;

  const summary = await getOdooFinancialSummary();
  res.json(summary);
});

export default router;
