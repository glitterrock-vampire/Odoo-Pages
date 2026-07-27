/**
 * Odoo JSON-RPC client utility.
 * Uses Odoo's JSON-RPC API with API key authentication.
 *
 * Required env vars:
 *   ODOO_URL      – https://tobago-east-med.odoo.com
 *   ODOO_DB       – tobago-east-med
 *   ODOO_API_KEY  – API key from Odoo Settings → Technical → API Keys
 */

import { logger } from "./logger";

const ODOO_URL = process.env.ODOO_URL ?? "";
const ODOO_DB = process.env.ODOO_DB ?? "";
const ODOO_API_KEY = process.env.ODOO_API_KEY ?? "";

export function isOdooConfigured(): boolean {
  return Boolean(ODOO_URL && ODOO_DB && ODOO_API_KEY);
}

interface OdooJsonRpcRequest {
  model: string;
  method: string;
  args: unknown[];
  kwargs?: Record<string, unknown>;
}

async function callOdoo<T>(req: OdooJsonRpcRequest): Promise<T> {
  if (!isOdooConfigured()) {
    throw new Error("Odoo is not configured. Set ODOO_URL, ODOO_DB, and ODOO_API_KEY.");
  }

  const body = {
    jsonrpc: "2.0",
    method: "call",
    id: Date.now(),
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DB,
        // For API key auth we pass the API key as the user id (numeric user)
        // and the API key as the password in the standard auth call.
        // But for execute_kw with API key we use uid=1 and password=apikey.
        // Actually Odoo API key auth: uid is resolved via /web/session/authenticate
        // Simpler: use the /api endpoint for Odoo 17+
        ...req.args,
      ],
    },
  };

  // Use the newer /api REST endpoint (Odoo 17+) or fall back to JSON-RPC
  const endpoint = `${ODOO_URL}/web/dataset/call_kw`;

  const rpcBody = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      model: req.model,
      method: req.method,
      args: req.args,
      kwargs: req.kwargs ?? {},
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // API key authentication header for Odoo 16+
      Authorization: `Bearer ${ODOO_API_KEY}`,
    },
    body: JSON.stringify(rpcBody),
  });

  if (!response.ok) {
    logger.error({ status: response.status, url: endpoint }, "Odoo HTTP error");
    throw new Error(`Odoo request failed: ${response.status}`);
  }

  const json = (await response.json()) as { result?: T; error?: { message: string; data?: { message?: string } } };

  if (json.error) {
    const msg = json.error.data?.message ?? json.error.message;
    logger.error({ error: json.error }, "Odoo RPC error");
    throw new Error(`Odoo error: ${msg}`);
  }

  return json.result as T;
}

// ── Partners (Contacts) ────────────────────────────────────────────────────

export interface OdooPartner {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
  is_company: boolean;
  company_name: string | false;
  street: string | false;
  city: string | false;
  country_id: [number, string] | false;
  create_date: string;
}

export async function listOdooPartners(search = "", limit = 100): Promise<OdooPartner[]> {
  const domain: unknown[] = [["active", "=", true]];
  if (search) domain.push(["name", "ilike", search]);

  return callOdoo<OdooPartner[]>({
    model: "res.partner",
    method: "search_read",
    args: [domain],
    kwargs: {
      fields: ["id", "name", "email", "phone", "is_company", "company_name", "street", "city", "country_id", "create_date"],
      limit,
      order: "name asc",
    },
  });
}

export async function getOdooPartner(id: number): Promise<OdooPartner | null> {
  const results = await callOdoo<OdooPartner[]>({
    model: "res.partner",
    method: "search_read",
    args: [[["id", "=", id]]],
    kwargs: {
      fields: ["id", "name", "email", "phone", "is_company", "company_name", "street", "city", "country_id", "create_date"],
      limit: 1,
    },
  });
  return results[0] ?? null;
}

export async function createOdooPartner(data: {
  name: string;
  email?: string;
  phone?: string;
  is_company?: boolean;
  company_name?: string;
  street?: string;
  city?: string;
}): Promise<number> {
  return callOdoo<number>({
    model: "res.partner",
    method: "create",
    args: [data],
  });
}

export async function updateOdooPartner(id: number, data: Partial<{
  name: string;
  email: string;
  phone: string;
  is_company: boolean;
  company_name: string;
  street: string;
  city: string;
}>): Promise<boolean> {
  return callOdoo<boolean>({
    model: "res.partner",
    method: "write",
    args: [[id], data],
  });
}

// ── Invoices ───────────────────────────────────────────────────────────────

export interface OdooInvoice {
  id: number;
  name: string;
  partner_id: [number, string] | false;
  amount_total: number;
  amount_residual: number;
  currency_id: [number, string];
  invoice_date: string | false;
  invoice_date_due: string | false;
  state: string;
  payment_state: string;
}

export async function listOdooInvoices(search = "", state?: string, limit = 100): Promise<OdooInvoice[]> {
  const domain: unknown[] = [["move_type", "=", "out_invoice"]];
  if (search) domain.push(["partner_id.name", "ilike", search]);
  if (state) domain.push(["state", "=", state]);

  return callOdoo<OdooInvoice[]>({
    model: "account.move",
    method: "search_read",
    args: [domain],
    kwargs: {
      fields: ["id", "name", "partner_id", "amount_total", "amount_residual", "currency_id", "invoice_date", "invoice_date_due", "state", "payment_state"],
      limit,
      order: "invoice_date desc",
    },
  });
}

export async function getOdooFinancialSummary(): Promise<{
  totalRevenue: number;
  totalOutstanding: number;
  totalPaid: number;
  overdueCount: number;
  draftCount: number;
  currency: string;
}> {
  const [all, overdue, drafts] = await Promise.all([
    callOdoo<OdooInvoice[]>({
      model: "account.move",
      method: "search_read",
      args: [[["move_type", "=", "out_invoice"], ["state", "=", "posted"]]],
      kwargs: { fields: ["amount_total", "amount_residual", "payment_state", "currency_id"], limit: 1000 },
    }),
    callOdoo<number[]>({
      model: "account.move",
      method: "search",
      args: [[["move_type", "=", "out_invoice"], ["state", "=", "posted"], ["payment_state", "=", "not_paid"], ["invoice_date_due", "<", new Date().toISOString().split("T")[0]]]],
    }),
    callOdoo<number[]>({
      model: "account.move",
      method: "search",
      args: [[["move_type", "=", "out_invoice"], ["state", "=", "draft"]]],
    }),
  ]);

  const totalRevenue = all.reduce((s, i) => s + i.amount_total, 0);
  const totalOutstanding = all.filter(i => i.payment_state !== "paid").reduce((s, i) => s + i.amount_residual, 0);
  const totalPaid = all.filter(i => i.payment_state === "paid").reduce((s, i) => s + i.amount_total, 0);
  const currency = all[0]?.currency_id?.[1] ?? "JMD";

  return {
    totalRevenue,
    totalOutstanding,
    totalPaid,
    overdueCount: overdue.length,
    draftCount: drafts.length,
    currency,
  };
}

// ── Donations ──────────────────────────────────────────────────────────────

export interface OdooDonation {
  id: number;
  partner_id: [number, string] | false;
  amount: number;
  currency_id: [number, string];
  donation_date: string | false;
  state: string;
  campaign_id: [number, string] | false;
}

export async function listOdooDonations(search = "", status?: string, limit = 100): Promise<OdooDonation[]> {
  const domain: unknown[] = [];
  if (search) domain.push(["partner_id.name", "ilike", search]);
  if (status) domain.push(["state", "=", status]);

  try {
    return await callOdoo<OdooDonation[]>({
      model: "donation.donation",
      method: "search_read",
      args: [domain],
      kwargs: {
        fields: ["id", "partner_id", "amount", "currency_id", "donation_date", "state", "campaign_id"],
        limit,
        order: "donation_date desc",
      },
    });
  } catch {
    // donation.donation model may not be installed; return empty
    logger.warn("donation.donation model not available in Odoo");
    return [];
  }
}

export async function getOdooDonation(id: number): Promise<OdooDonation | null> {
  try {
    const results = await callOdoo<OdooDonation[]>({
      model: "donation.donation",
      method: "search_read",
      args: [[["id", "=", id]]],
      kwargs: {
        fields: ["id", "partner_id", "amount", "currency_id", "donation_date", "state", "campaign_id"],
        limit: 1,
      },
    });
    return results[0] ?? null;
  } catch {
    return null;
  }
}

export async function createOdooDonation(data: {
  partner_id: number;
  amount: number;
  donation_date: string;
  state?: string;
}): Promise<number> {
  return callOdoo<number>({
    model: "donation.donation",
    method: "create",
    args: [data],
  });
}

// ── Tasks ──────────────────────────────────────────────────────────────────

export interface OdooTask {
  id: number;
  name: string;
  description: string | false;
  stage_id: [number, string] | false;
  user_ids: [number, string][];
  date_deadline: string | false;
  priority: string;
  project_id: [number, string] | false;
  create_date: string;
}

const STAGE_MAP: Record<string, string> = {
  todo: "todo",
  "In Progress": "in_progress",
  Done: "done",
  Cancelled: "cancelled",
};

const STAGE_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_MAP).map(([k, v]) => [v, k])
);

export async function listOdooTasks(search = "", stage?: string, limit = 100): Promise<OdooTask[]> {
  const domain: unknown[] = [["active", "=", true]];
  if (search) domain.push(["name", "ilike", search]);

  return callOdoo<OdooTask[]>({
    model: "project.task",
    method: "search_read",
    args: [domain],
    kwargs: {
      fields: ["id", "name", "description", "stage_id", "user_ids", "date_deadline", "priority", "project_id", "create_date"],
      limit,
      order: "create_date desc",
    },
  });
}

export async function createOdooTask(data: {
  name: string;
  description?: string;
  date_deadline?: string;
  priority?: string;
}): Promise<number> {
  return callOdoo<number>({
    model: "project.task",
    method: "create",
    args: [data],
  });
}

export async function updateOdooTask(id: number, data: Partial<{
  name: string;
  description: string;
  date_deadline: string;
  priority: string;
}>): Promise<boolean> {
  return callOdoo<boolean>({
    model: "project.task",
    method: "write",
    args: [[id], data],
  });
}

export async function deleteOdooTask(id: number): Promise<boolean> {
  return callOdoo<boolean>({
    model: "project.task",
    method: "unlink",
    args: [[id]],
  });
}
