import { Router, type IRouter } from "express";
import { listOdooInvoices, getOdooFinancialSummary, isOdooConfigured } from "../lib/odoo";
import { ListInvoicesQueryParams } from "@workspace/api-zod";

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

router.get("/finances/invoices", async (req, res): Promise<void> => {
  const params = ListInvoicesQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!requireOdoo(res)) return;
  const invoices = await listOdooInvoices(params.data.search ?? "", params.data.state ?? undefined);
  res.json(invoices.map((invoice) => ({
    id: String(invoice.id),
    name: invoice.name,
    partnerName: invoice.partner_id ? invoice.partner_id[1] : "Unknown",
    amountTotal: invoice.amount_total,
    amountDue: invoice.amount_residual,
    currency: invoice.currency_id ? invoice.currency_id[1] : "JMD",
    invoiceDate: invoice.invoice_date || null,
    dueDate: invoice.invoice_date_due || null,
    state: invoice.state === "cancel" ? "cancelled" : invoice.state,
    paymentState: invoice.payment_state || null,
    odooId: String(invoice.id),
  })));
});

router.get("/finances/summary", async (_req, res): Promise<void> => {
  if (!requireOdoo(res)) return;
  res.json(await getOdooFinancialSummary());
});

export default router;
