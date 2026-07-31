import json
import logging

from odoo import api, fields, models, tools
from odoo.exceptions import AccessError


_logger = logging.getLogger(__name__)


class MailingContact(models.Model):
    _inherit = "mailing.contact"

    cdt_source = fields.Selection(
        [
            ("website", "CDT Website"),
            ("mailchimp", "Mailchimp"),
            ("import", "Imported"),
            ("manual", "Manual"),
        ],
        string="CDT Source",
        index=True,
        tracking=True,
    )
    cdt_source_key = fields.Char(string="Source ID", copy=False, index=True)
    cdt_source_status = fields.Selection(
        [
            ("subscribed", "Subscribed"),
            ("unsubscribed", "Unsubscribed"),
            ("cleaned", "Cleaned"),
            ("pending", "Pending"),
            ("transactional", "Transactional"),
            ("archived", "Archived"),
            ("unknown", "Unknown"),
        ],
        string="Source Status",
        copy=False,
        index=True,
    )
    cdt_consent_at = fields.Datetime(string="Consent Recorded", copy=False)
    cdt_last_sync_at = fields.Datetime(string="Last Audience Sync", copy=False, readonly=True)

    _sql_constraints = [
        (
            "cdt_mailing_source_key_unique",
            "unique(cdt_source_key)",
            "This external mailing contact has already been imported.",
        ),
    ]

    @api.model
    def _cdt_website_list(self):
        return self.env.ref("cdt_content.mailing_list_website_subscribers")

    @api.model
    def _cdt_find_contact(self, normalized_email, source_key=False):
        if source_key:
            contact = self.search([("cdt_source_key", "=", source_key)], limit=1)
            if contact:
                return contact
        return self.search([("email", "=ilike", normalized_email)], order="id asc", limit=1)

    @api.model
    def cdt_subscribe_email(self, email, name=False, source="website", source_key=False):
        normalized_email = tools.email_normalize(email)
        if not normalized_email:
            raise ValueError("Invalid email address")

        mailing_list = self._cdt_website_list()
        contact = self._cdt_find_contact(normalized_email, source_key=source_key)
        values = {
            "email": normalized_email,
            "cdt_source": source,
            "cdt_source_status": "subscribed",
            "cdt_consent_at": fields.Datetime.now(),
            "cdt_last_sync_at": fields.Datetime.now(),
        }
        if source_key:
            values["cdt_source_key"] = source_key
        if name:
            values["name"] = name
        if contact:
            contact.write(values)
        else:
            contact = self.create(values)

        subscription = self.env["mailing.subscription"].search(
            [("contact_id", "=", contact.id), ("list_id", "=", mailing_list.id)],
            limit=1,
        )
        if subscription:
            if subscription.opt_out:
                subscription.write({"opt_out": False})
        else:
            self.env["mailing.subscription"].create(
                {"contact_id": contact.id, "list_id": mailing_list.id, "opt_out": False}
            )
        return {"contact_id": contact.id, "list_id": mailing_list.id}


class MailingMailing(models.Model):
    _inherit = "mailing.mailing"

    def _cdt_check_bulk_send_access(self):
        if self.env.is_superuser() or self.env.user.has_group(
            "cdt_content.group_communications_manager"
        ):
            return
        raise AccessError(
            "Only a CDT Communications Manager can send or schedule a bulk campaign. "
            "Communications Users can prepare and review drafts."
        )

    def action_put_in_queue(self):
        self._cdt_check_bulk_send_access()
        return super().action_put_in_queue()

    def action_send_winner_mailing(self):
        self._cdt_check_bulk_send_access()
        return super().action_send_winner_mailing()

    def write(self, values):
        if values.get("state") in {"in_queue", "sending", "done"}:
            self._cdt_check_bulk_send_access()
        return super().write(values)


class CdtSiteSetting(models.Model):
    _inherit = "cdt.site.setting"

    marketing_last_sync_at = fields.Datetime(readonly=True)
    marketing_last_sync_status = fields.Selection(
        [("success", "Success"), ("skipped", "Not Configured"), ("failed", "Failed")],
        readonly=True,
    )
    marketing_last_sync_message = fields.Text(readonly=True)
    marketing_audience_total = fields.Integer(readonly=True)
    marketing_audience_active = fields.Integer(readonly=True)
    marketing_audience_opt_out = fields.Integer(readonly=True)

    @api.model
    def action_sync_marketing_audience(self):
        from ..tools.import_mailchimp import run_import

        try:
            result = run_import(self.env, dry_run=False, commit=False)
            status = "success" if result.get("configured") else "skipped"
            message = json.dumps(result, sort_keys=True)
            self.search([]).write(
                {
                    "marketing_last_sync_at": fields.Datetime.now(),
                    "marketing_last_sync_status": status,
                    "marketing_last_sync_message": message,
                    "marketing_audience_total": result.get("total", 0),
                    "marketing_audience_active": result.get("active", 0),
                    "marketing_audience_opt_out": result.get("opt_out", 0),
                }
            )
            if self.env.context.get("cron_mode"):
                return result
            return {
                "type": "ir.actions.client",
                "tag": "display_notification",
                "params": {
                    "title": "Marketing audience sync",
                    "message": (
                        f"{result.get('active', 0)} subscribed and "
                        f"{result.get('opt_out', 0)} suppressed contacts are stored in Odoo."
                        if result.get("configured")
                        else "Mailchimp credentials are not configured; no audience data changed."
                    ),
                    "type": "success" if result.get("configured") else "warning",
                    "sticky": False,
                    "next": {"type": "ir.actions.client", "tag": "reload"},
                },
            }
        except Exception as error:
            self.search([]).write(
                {
                    "marketing_last_sync_at": fields.Datetime.now(),
                    "marketing_last_sync_status": "failed",
                    "marketing_last_sync_message": str(error),
                }
            )
            _logger.exception("Marketing audience sync failed")
            raise
