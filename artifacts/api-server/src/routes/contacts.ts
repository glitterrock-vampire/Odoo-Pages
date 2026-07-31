import { Router, type IRouter } from "express";
import {
  listOdooPartners,
  getOdooPartner,
  createOdooPartner,
  updateOdooPartner,
  isOdooConfigured,
} from "../lib/odoo";
import { CreateContactBody, UpdateContactBody, ListContactsQueryParams } from "@workspace/api-zod";

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

function formatPartner(partner: NonNullable<Awaited<ReturnType<typeof getOdooPartner>>>) {
  return {
    id: String(partner.id),
    name: partner.name,
    email: partner.email || null,
    phone: partner.phone || null,
    type: partner.is_company ? "company" : "individual",
    company: partner.company_name || null,
    street: partner.street || null,
    city: partner.city || null,
    country: partner.country_id ? partner.country_id[1] : null,
    odooId: String(partner.id),
    createdAt: partner.create_date,
    managedBySanity: typeof partner.ref === "string" && partner.ref.startsWith("sanity:"),
  };
}

function optionalOdooText(value: string | undefined): string | false | undefined {
  if (value === undefined) return undefined;
  return value.trim() || false;
}

function isValidOptionalEmail(value: string | undefined): boolean {
  if (!value?.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

router.get("/contacts", async (req, res): Promise<void> => {
  const params = ListContactsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!requireOdoo(res)) return;
  const contacts = (await listOdooPartners(params.data.search ?? "")).map(formatPartner);
  res.json(params.data.type ? contacts.filter((contact) => contact.type === params.data.type) : contacts);
});

router.post("/contacts", async (req, res): Promise<void> => {
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const name = parsed.data.name.trim();
  if (!name) { res.status(400).json({ error: "Contact name cannot be blank." }); return; }
  if (!isValidOptionalEmail(parsed.data.email)) { res.status(400).json({ error: "Enter a valid email address." }); return; }
  if (!requireOdoo(res)) return;
  const id = await createOdooPartner({
    name,
    email: parsed.data.email?.trim(),
    phone: parsed.data.phone?.trim(),
    is_company: parsed.data.type === "company",
    street: parsed.data.street,
    city: parsed.data.city,
  });
  const partner = await getOdooPartner(id);
  if (!partner) { res.status(500).json({ error: "Contact was created but could not be reloaded." }); return; }
  res.status(201).json(formatPartner(partner));
});

router.get("/contacts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!requireOdoo(res)) return;
  const partner = await getOdooPartner(id);
  if (!partner) { res.status(404).json({ error: "Contact not found" }); return; }
  res.json(formatPartner(partner));
});

router.patch("/contacts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (Object.keys(parsed.data).length === 0) { res.status(400).json({ error: "Provide at least one contact field to update." }); return; }
  if (!isValidOptionalEmail(parsed.data.email)) { res.status(400).json({ error: "Enter a valid email address." }); return; }
  if (!requireOdoo(res)) return;
  const existing = await getOdooPartner(id);
  if (!existing) { res.status(404).json({ error: "Contact not found" }); return; }

  const managedBySanity = typeof existing.ref === "string" && existing.ref.startsWith("sanity:");
  const requestedName = parsed.data.name?.trim();
  const changesSanityManagedField = managedBySanity && (
    (requestedName !== undefined && requestedName !== existing.name) ||
    (parsed.data.type !== undefined && (parsed.data.type === "company") !== existing.is_company)
  );
  if (changesSanityManagedField) {
    res.status(409).json({
      error: "This public profile name and type are still managed by Sanity. Edit its Odoo contact details here, or update the profile in Sanity until the website cutover is complete.",
    });
    return;
  }

  if (requestedName !== undefined && !requestedName) {
    res.status(400).json({ error: "Contact name cannot be blank." });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (requestedName !== undefined) updates.name = requestedName;
  if (parsed.data.email !== undefined) updates.email = optionalOdooText(parsed.data.email);
  if (parsed.data.phone !== undefined) updates.phone = optionalOdooText(parsed.data.phone);
  if (parsed.data.type !== undefined) updates.is_company = parsed.data.type === "company";
  if (parsed.data.street !== undefined) updates.street = optionalOdooText(parsed.data.street);
  if (parsed.data.city !== undefined) updates.city = optionalOdooText(parsed.data.city);

  await updateOdooPartner(id, updates);
  const updated = await getOdooPartner(id);
  if (!updated) { res.status(404).json({ error: "Contact not found" }); return; }
  res.json(formatPartner(updated));
});

export default router;
