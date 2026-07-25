import { Router, type IRouter } from "express";
import {
  listOdooPartners,
  getOdooPartner,
  createOdooPartner,
  updateOdooPartner,
  isOdooConfigured,
} from "../lib/odoo";
import {
  CreateContactBody,
  UpdateContactBody,
  ListContactsQueryParams,
} from "@workspace/api-zod";

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

function formatPartner(p: NonNullable<Awaited<ReturnType<typeof getOdooPartner>>>) {
  return {
    id: p.id,
    name: p.name,
    email: p.email || null,
    phone: p.phone || null,
    type: p.is_company ? "company" : "individual",
    company: p.company_name || null,
    street: p.street || null,
    city: p.city || null,
    country: p.country_id ? p.country_id[1] : null,
    odooId: p.id,
    createdAt: p.create_date || null,
  };
}

router.get("/contacts", async (req, res): Promise<void> => {
  const params = ListContactsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!requireOdoo(res)) return;

  const partners = await listOdooPartners(params.data.search ?? "");
  const contacts = partners.map(formatPartner);

  res.json(
    params.data.type ? contacts.filter((c) => c.type === params.data.type) : contacts
  );
});

router.post("/contacts", async (req, res): Promise<void> => {
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!requireOdoo(res)) return;

  const odooId = await createOdooPartner({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    is_company: parsed.data.type === "company",
    company_name: parsed.data.company,
    street: parsed.data.street,
    city: parsed.data.city,
  });

  const partner = await getOdooPartner(odooId);
  if (!partner) { res.status(500).json({ error: "Contact created in Odoo but could not be retrieved" }); return; }
  res.status(201).json(formatPartner(partner));
});

router.get("/contacts/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!requireOdoo(res)) return;

  const partner = await getOdooPartner(id);
  if (!partner) { res.status(404).json({ error: "Contact not found" }); return; }
  res.json(formatPartner(partner));
});

router.patch("/contacts/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!requireOdoo(res)) return;

  await updateOdooPartner(id, {
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    is_company: parsed.data.type === "company",
    company_name: parsed.data.company,
    street: parsed.data.street,
    city: parsed.data.city,
  });

  const partner = await getOdooPartner(id);
  if (!partner) { res.status(404).json({ error: "Contact not found" }); return; }
  res.json(formatPartner(partner));
});

export default router;
