import { Router, type IRouter } from "express";
import {
  listOdooDonations,
  getOdooDonation,
  createOdooDonation,
  isOdooConfigured,
  type OdooDonation,
} from "../lib/odoo";
import { CreateDonationBody, ListDonationsQueryParams } from "@workspace/api-zod";

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

function formatDonation(donation: OdooDonation) {
  return {
    id: String(donation.id),
    donorName: donation.partner_id ? donation.partner_id[1] : "Unknown",
    amount: donation.amount,
    currency: donation.currency_id ? donation.currency_id[1] : "JMD",
    date: donation.donation_date || null,
    status: donation.state,
    campaign: donation.campaign_id ? donation.campaign_id[1] : null,
    odooId: String(donation.id),
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
  const donation = await createOdooDonation({
    donorName: parsed.data.donorName,
    amount: parsed.data.amount,
    donationDate: parsed.data.date,
    status: parsed.data.status,
    campaign: parsed.data.campaign,
  });
  res.status(201).json(formatDonation(donation));
});

router.get("/donations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!requireOdoo(res)) return;
  const donation = await getOdooDonation(id);
  if (!donation) { res.status(404).json({ error: "Donation not found" }); return; }
  res.json(formatDonation(donation));
});

export default router;
