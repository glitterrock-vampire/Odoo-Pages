import { Router, type IRouter } from "express";
import {
  listOdooDonations,
  getOdooDonation,
  createOdooDonation,
  isOdooConfigured,
  type OdooDonation,
} from "../lib/odoo";
import {
  CreateDonationBody,
  ListDonationsQueryParams,
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

function formatDonation(d: OdooDonation) {
  return {
    id: d.id,
    donorName: d.partner_id ? d.partner_id[1] : "Unknown",
    amount: d.amount,
    currency: d.currency_id ? d.currency_id[1] : "JMD",
    date: d.donation_date || null,
    status: d.state,
    campaign: d.campaign_id ? d.campaign_id[1] : null,
    odooId: d.id,
  };
}

router.get("/donations", async (req, res): Promise<void> => {
  const params = ListDonationsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  if (!requireOdoo(res)) return;

  const donations = await listOdooDonations(params.data.search ?? "", params.data.status ?? undefined);
  res.json(donations.map(formatDonation));
});

router.post("/donations", async (req, res): Promise<void> => {
  const parsed = CreateDonationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!requireOdoo(res)) return;

  const odooId = await createOdooDonation({
    partner_id: parsed.data.partnerId,
    amount: parsed.data.amount,
    donation_date: parsed.data.date,
    state: parsed.data.status ?? "draft",
  });

  const donation = await getOdooDonation(odooId);
  if (!donation) { res.status(500).json({ error: "Donation created in Odoo but could not be retrieved" }); return; }
  res.status(201).json(formatDonation(donation));
});

router.get("/donations/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!requireOdoo(res)) return;

  const donation = await getOdooDonation(id);
  if (!donation) { res.status(404).json({ error: "Donation not found" }); return; }
  res.json(formatDonation(donation));
});

export default router;
