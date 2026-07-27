/**
 * Odoo JSON-RPC client.
 *
 * Authentication flow (works on Odoo 14-17):
 *   1. POST /web/dataset/call_kw  method=common.authenticate  → uid (number)
 *   2. POST /web/dataset/call_kw  method=execute_kw           → data
 *      args: [DB, uid, API_KEY, model, method, positional, keyword]
 *
 * Required env vars:
 *   ODOO_URL       – https://tobago-east-med.odoo.com
 *   ODOO_DB        – tobago-east-med
 *   ODOO_USERNAME  – login email for the Odoo user (non-secret)
 *   ODOO_API_KEY   – API key from Odoo avatar → My Profile → Account Security → New API Key
 */

import { logger } from "./logger";

const ODOO_URL      = process.env.ODOO_URL      ?? "";
const ODOO_DB       = process.env.ODOO_DB       ?? "";
const ODOO_USERNAME = process.env.ODOO_USERNAME  ?? "";
const ODOO_API_KEY  = process.env.ODOO_API_KEY   ?? "";

export function isOdooConfigured(): boolean {
  return Boolean(ODOO_URL && ODOO_DB && ODOO_USERNAME && ODOO_API_KEY);
}

// ── UID cache with promise lock ────────────────────────────────────────────
// Ensures only one authenticate request fires even under parallel call bursts.
let cachedUid: number | null = null;
let authInFlight: Promise<number> | null = null;

async function authenticate(): Promise<number> {
  const body = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "common",
      method: "authenticate",
      args: [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY, {}],
    },
  };

  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Odoo authenticate HTTP ${res.status}`);

  const json = (await res.json()) as { result?: number | false; error?: { message: string } };
  if (json.error) throw new Error(`Odoo auth error: ${json.error.message}`);
  if (!json.result) throw new Error("Odoo authentication failed — check ODOO_USERNAME and ODOO_API_KEY");

  cachedUid = json.result;
  logger.info({ uid: cachedUid }, "Odoo authenticated");
  return cachedUid;
}

async function getUid(): Promise<number> {
  if (cachedUid !== null) return cachedUid;
  // Coalesce all concurrent callers onto the same in-flight promise
  if (!authInFlight) {
    authInFlight = authenticate().finally(() => { authInFlight = null; });
  }
  return authInFlight;
}

// ── Core RPC ───────────────────────────────────────────────────────────────

interface OdooCallOptions {
  model: string;
  method: string;
  args?: unknown[];
  kwargs?: Record<string, unknown>;
}

async function callOdoo<T>(opts: OdooCallOptions): Promise<T> {
  if (!isOdooConfigured()) {
    throw new Error("Odoo is not configured. Set ODOO_URL, ODOO_DB, ODOO_USERNAME, and ODOO_API_KEY.");
  }

  const uid = await getUid();

  const body = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      service: "object",
      method: "execute_kw",
      args: [
        ODOO_DB,
        uid,
        ODOO_API_KEY,
        opts.model,
        opts.method,
        opts.args ?? [],
        opts.kwargs ?? {},
      ],
    },
  };

  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Odoo HTTP ${res.status}`);

  const json = (await res.json()) as { result?: T; error?: { message: string; data?: { message?: string } } };

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
  return callOdoo<number>({ model: "res.partner", method: "create", args: [data] });
}

export async function updateOdooPartner(
  id: number,
  data: Partial<{ name: string; email: string; phone: string; is_company: boolean; company_name: string; street: string; city: string }>
): Promise<boolean> {
  return callOdoo<boolean>({ model: "res.partner", method: "write", args: [[id], data] });
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

export async function getOdooFinancialSummary() {
  const [all, overdueIds, draftIds] = await Promise.all([
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

  return {
    totalRevenue:    all.reduce((s, i) => s + i.amount_total, 0),
    totalOutstanding: all.filter(i => i.payment_state !== "paid").reduce((s, i) => s + i.amount_residual, 0),
    totalPaid:       all.filter(i => i.payment_state === "paid").reduce((s, i) => s + i.amount_total, 0),
    overdueCount:    overdueIds.length,
    draftCount:      draftIds.length,
    currency:        all[0]?.currency_id?.[1] ?? "JMD",
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
  } catch (err) {
    // donation.donation module may not be installed
    logger.warn({ err }, "donation.donation model not available — module may not be installed");
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
  return callOdoo<number>({ model: "donation.donation", method: "create", args: [data] });
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

export async function listOdooTasks(search = "", _stage?: string, limit = 100): Promise<OdooTask[]> {
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
  return callOdoo<number>({ model: "project.task", method: "create", args: [data] });
}

export async function updateOdooTask(
  id: number,
  data: Partial<{ name: string; description: string; date_deadline: string; priority: string }>
): Promise<boolean> {
  return callOdoo<boolean>({ model: "project.task", method: "write", args: [[id], data] });
}

export async function deleteOdooTask(id: number): Promise<boolean> {
  return callOdoo<boolean>({ model: "project.task", method: "unlink", args: [[id]] });
}
