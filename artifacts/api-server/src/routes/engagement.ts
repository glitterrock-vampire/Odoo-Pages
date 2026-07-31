import { Router, type IRouter } from "express";
import {
  getOdooSchoolEngagementSnapshot,
  isOdooConfigured,
} from "../lib/odoo";

const router: IRouter = Router();

router.get("/school-engagement", async (_req, res): Promise<void> => {
  if (!isOdooConfigured()) {
    res.status(503).json({ error: "Odoo integration not configured" });
    return;
  }
  res.json(await getOdooSchoolEngagementSnapshot());
});

export default router;
