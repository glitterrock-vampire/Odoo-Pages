from odoo import api, fields, models
from odoo.exceptions import ValidationError


class GuardianConsent(models.Model):
    _name = "cdt.guardian.consent"
    _description = "Guardian Consent Record"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "submitted_at desc, id desc"

    name = fields.Char(required=True, copy=False, default="New")
    student_id = fields.Many2one(
        "cdt.student", required=True, ondelete="cascade", tracking=True
    )
    guardian_id = fields.Many2one(
        "cdt.guardian", ondelete="set null", tracking=True
    )
    consent_type = fields.Selection(
        [
            ("programme", "Programme Participation"),
            ("medical", "Emergency Medical Care"),
            ("media", "Photography and Media"),
            ("transport", "Transport and Off-site Activities"),
            ("data", "Information and Privacy"),
            ("other", "Other"),
        ],
        required=True,
        tracking=True,
    )
    decision = fields.Selection(
        [("granted", "Granted"), ("declined", "Declined")],
        required=True,
        tracking=True,
    )
    signature_name = fields.Char(required=True)
    notice_version = fields.Char(required=True, default="CDT Family Consent v1")
    notes = fields.Text()
    submitted_at = fields.Datetime(
        required=True, default=fields.Datetime.now, readonly=True
    )
    submitted_by_id = fields.Many2one(
        "res.users", default=lambda self: self.env.user, readonly=True
    )
    source = fields.Selection(
        [("portal", "Family Portal"), ("staff", "Staff Entry")],
        required=True,
        default="staff",
        readonly=True,
    )

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if values.get("name", "New") == "New":
                values["name"] = self.env["ir.sequence"].next_by_code(
                    "cdt.guardian.consent"
                ) or "New"
        return super().create(values_list)


class StudentDocument(models.Model):
    _name = "cdt.student.document"
    _description = "Student Document"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "submitted_at desc, id desc"

    name = fields.Char(required=True)
    student_id = fields.Many2one(
        "cdt.student", required=True, ondelete="cascade", tracking=True
    )
    guardian_id = fields.Many2one("cdt.guardian", ondelete="set null")
    category = fields.Selection(
        [
            ("identification", "Identification"),
            ("medical", "Medical"),
            ("consent", "Consent"),
            ("academic", "Academic"),
            ("other", "Other"),
        ],
        required=True,
        default="other",
    )
    attachment_id = fields.Many2one(
        "ir.attachment", required=True, ondelete="cascade"
    )
    submitted_at = fields.Datetime(
        required=True, default=fields.Datetime.now, readonly=True
    )
    submitted_by_id = fields.Many2one(
        "res.users", default=lambda self: self.env.user, readonly=True
    )
    verified = fields.Boolean(tracking=True)
    verified_by_id = fields.Many2one("res.users", readonly=True)
    verified_at = fields.Datetime(readonly=True)
    notes = fields.Text()

    def write(self, values):
        if "verified" in values:
            if values["verified"]:
                values.update(
                    {
                        "verified_by_id": self.env.user.id,
                        "verified_at": fields.Datetime.now(),
                    }
                )
            else:
                values.update({"verified_by_id": False, "verified_at": False})
        return super().write(values)

    @api.constrains("attachment_id")
    def _check_attachment(self):
        for document in self:
            if document.attachment_id.res_model not in (
                False,
                "cdt.student",
                "cdt.student.document",
            ):
                raise ValidationError(
                    "The attachment must belong to this student document."
                )
