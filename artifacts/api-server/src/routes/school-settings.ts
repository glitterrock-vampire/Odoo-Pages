import { Router, type IRouter } from "express";
import {
  getOdooSchoolAutomationSettings,
  isOdooConfigured,
  updateOdooSchoolAutomationSettings,
} from "../lib/odoo";
import { UpdateSchoolSettingsBody } from "@workspace/api-zod";

const router: IRouter = Router();

function requireOdoo(res: import("express").Response): boolean {
  if (!isOdooConfigured()) {
    res.status(503).json({ error: "Odoo integration not configured" });
    return false;
  }
  return true;
}

router.get("/school-settings", async (_req, res): Promise<void> => {
  if (!requireOdoo(res)) return;
  res.json(await getOdooSchoolAutomationSettings());
});

router.patch("/school-settings", async (req, res): Promise<void> => {
  if (!requireOdoo(res)) return;
  const parsed = UpdateSchoolSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const current = await getOdooSchoolAutomationSettings();
  const enablingNotifications = (
    parsed.data.attendanceNotificationsEnabled === true
    || parsed.data.automaticFeeRemindersEnabled === true
  );
  if (enablingNotifications && !current.outgoingMailConfigured) {
    res.status(409).json({
      error: "Configure an active Odoo outgoing mail server before enabling automatic notifications.",
    });
    return;
  }
  res.json(await updateOdooSchoolAutomationSettings(parsed.data));
});

export default router;
