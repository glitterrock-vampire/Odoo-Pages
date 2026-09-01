import logging
from datetime import timedelta

from odoo import api, fields, models
from odoo.exceptions import ValidationError


_logger = logging.getLogger(__name__)


CHARGE_TYPES = [
    ("tuition", "Tuition"),
    ("deposit", "Deposit"),
    ("installment", "Installment"),
    ("adjustment", "Adjustment"),
]


class FeeCategory(models.Model):
    _name = "cdt.fee.category"
    _description = "Fee Category"
    _order = "name"

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    product_id = fields.Many2one(
        "product.product",
        help="Service product used when an Odoo customer invoice is generated.",
    )
    income_account_id = fields.Many2one(
        "account.account", domain=[("account_type", "in", ("income", "income_other"))]
    )
    description = fields.Text()
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "fee_category_code_unique",
            "unique(code)",
            "The fee category code must be unique.",
        ),
    ]

    def _get_or_create_product(self):
        self.ensure_one()
        if self.product_id:
            return self.product_id
        product = self.env["product.product"].create(
            {
                "name": self.name,
                "type": "service",
                "sale_ok": True,
                "purchase_ok": False,
                "property_account_income_id": self.income_account_id.id,
            }
        )
        self.product_id = product
        return product


class FeeStructure(models.Model):
    _name = "cdt.fee.structure"
    _description = "Fee Structure"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "academic_year_id desc, name"

    name = fields.Char(required=True, tracking=True)
    program_id = fields.Many2one("cdt.program", required=True, ondelete="restrict")
    academic_year_id = fields.Many2one(
        "cdt.academic.year", required=True, ondelete="restrict"
    )
    academic_term_id = fields.Many2one("cdt.academic.term")
    student_category_id = fields.Many2one("cdt.student.category")
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company
    )
    currency_id = fields.Many2one(
        related="company_id.currency_id", store=True, readonly=True
    )
    line_ids = fields.One2many("cdt.fee.structure.line", "structure_id")
    total_amount = fields.Monetary(compute="_compute_total_amount", store=True)
    active = fields.Boolean(default=True)

    @api.depends("line_ids.amount", "line_ids.discount_percent")
    def _compute_total_amount(self):
        for structure in self:
            structure.total_amount = sum(line.net_amount for line in structure.line_ids)

    @api.constrains("academic_year_id", "academic_term_id")
    def _check_term(self):
        for structure in self:
            if (
                structure.academic_term_id
                and structure.academic_term_id.academic_year_id
                != structure.academic_year_id
            ):
                raise ValidationError("The term must belong to the selected academic year.")


class FeeStructureLine(models.Model):
    _name = "cdt.fee.structure.line"
    _description = "Fee Structure Component"
    _order = "sequence, id"

    structure_id = fields.Many2one(
        "cdt.fee.structure", required=True, ondelete="cascade"
    )
    sequence = fields.Integer(default=10)
    category_id = fields.Many2one("cdt.fee.category", required=True)
    description = fields.Char()
    amount = fields.Monetary(required=True)
    discount_percent = fields.Float(default=0)
    net_amount = fields.Monetary(compute="_compute_net_amount", store=True)
    currency_id = fields.Many2one(related="structure_id.currency_id", store=True)

    @api.depends("amount", "discount_percent")
    def _compute_net_amount(self):
        for line in self:
            line.net_amount = line.amount * (1 - line.discount_percent / 100)

    @api.constrains("amount", "discount_percent")
    def _check_values(self):
        for line in self:
            if line.amount < 0:
                raise ValidationError("Fee amounts cannot be negative.")
            if line.discount_percent < 0 or line.discount_percent > 100:
                raise ValidationError("Discount must be between 0 and 100 percent.")


class FeeSchedule(models.Model):
    _name = "cdt.fee.schedule"
    _description = "Fee Schedule"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "due_date desc, id desc"

    name = fields.Char(required=True, copy=False, default="New")
    title = fields.Char(required=True)
    fee_structure_id = fields.Many2one(
        "cdt.fee.structure", required=True, ondelete="restrict"
    )
    program_id = fields.Many2one(
        related="fee_structure_id.program_id", store=True, readonly=True
    )
    academic_year_id = fields.Many2one(
        related="fee_structure_id.academic_year_id", store=True, readonly=True
    )
    academic_term_id = fields.Many2one(
        related="fee_structure_id.academic_term_id", store=True, readonly=True
    )
    student_group_id = fields.Many2one("cdt.student.group")
    posting_date = fields.Date(required=True, default=fields.Date.context_today)
    due_date = fields.Date(required=True)
    installment_number = fields.Integer(default=1)
    charge_type = fields.Selection(
        CHARGE_TYPES, required=True, default="tuition", tracking=True
    )
    amount_mode = fields.Selection(
        [
            ("full_structure", "Full Fee Structure"),
            ("percentage", "Percentage of Fee Structure"),
            ("fixed", "Fixed Amount"),
        ],
        required=True,
        default="full_structure",
        tracking=True,
    )
    percentage = fields.Float(default=100, digits=(16, 4))
    fixed_amount = fields.Monetary(default=0)
    amount = fields.Monetary(compute="_compute_amount", store=True)
    currency_id = fields.Many2one(related="fee_structure_id.currency_id", store=True)
    student_fee_ids = fields.One2many("cdt.student.fee", "fee_schedule_id")
    generated_count = fields.Integer(compute="_compute_generated_count")
    state = fields.Selection(
        [
            ("draft", "Draft"),
            ("generated", "Generated"),
            ("closed", "Closed"),
            ("cancelled", "Cancelled"),
        ],
        default="draft",
        required=True,
        tracking=True,
    )

    _sql_constraints = [
        (
            "fee_schedule_number_unique",
            "unique(name)",
            "The fee schedule number must be unique.",
        ),
    ]

    @api.depends("student_fee_ids")
    def _compute_generated_count(self):
        for schedule in self:
            schedule.generated_count = len(schedule.student_fee_ids)

    @api.depends(
        "fee_structure_id.total_amount",
        "amount_mode",
        "percentage",
        "fixed_amount",
        "currency_id",
    )
    def _compute_amount(self):
        for schedule in self:
            structure_total = schedule.fee_structure_id.total_amount
            if schedule.amount_mode == "percentage":
                amount = structure_total * schedule.percentage / 100
            elif schedule.amount_mode == "fixed":
                amount = schedule.fixed_amount
            else:
                amount = structure_total
            schedule.amount = (
                schedule.currency_id.round(amount) if schedule.currency_id else amount
            )

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if values.get("name", "New") == "New":
                values["name"] = self.env["ir.sequence"].next_by_code(
                    "cdt.fee.schedule"
                ) or "New"
        return super().create(values_list)

    @api.constrains(
        "posting_date",
        "due_date",
        "installment_number",
        "amount_mode",
        "percentage",
        "fixed_amount",
    )
    def _check_values(self):
        for schedule in self:
            if schedule.due_date < schedule.posting_date:
                raise ValidationError("The fee due date must follow its posting date.")
            if schedule.installment_number < 1:
                raise ValidationError("Installment number must be at least one.")
            if schedule.amount_mode == "percentage" and not (
                0 < schedule.percentage <= 100
            ):
                raise ValidationError("The fee percentage must be above 0 and at most 100.")
            if schedule.amount_mode == "fixed" and schedule.fixed_amount <= 0:
                raise ValidationError("The fixed fee amount must be greater than zero.")

    def action_generate_fees(self):
        for schedule in self:
            enrollment_domain = [
                ("program_id", "=", schedule.program_id.id),
                ("academic_year_id", "=", schedule.academic_year_id.id),
                ("state", "=", "confirmed"),
            ]
            if schedule.academic_term_id:
                enrollment_domain.append(
                    ("academic_term_id", "=", schedule.academic_term_id.id)
                )
            enrollments = self.env["cdt.program.enrollment"].search(enrollment_domain)
            if schedule.student_group_id:
                group_students = schedule.student_group_id.member_line_ids.filtered(
                    "active"
                ).mapped("student_id")
                enrollments = enrollments.filtered(
                    lambda enrollment: enrollment.student_id in group_students
                )
            for enrollment in enrollments:
                existing = self.env["cdt.student.fee"].search(
                    [
                        ("fee_schedule_id", "=", schedule.id),
                        ("student_id", "=", enrollment.student_id.id),
                    ],
                    limit=1,
                )
                if not existing:
                    self.env["cdt.student.fee"].create(
                        {
                            "student_id": enrollment.student_id.id,
                            "program_enrollment_id": enrollment.id,
                            "fee_schedule_id": schedule.id,
                            "fee_structure_id": schedule.fee_structure_id.id,
                            "due_date": schedule.due_date,
                            "amount": schedule.amount,
                            "charge_type": schedule.charge_type,
                        }
                    )
            schedule.state = "generated"


class StudentFee(models.Model):
    _name = "cdt.student.fee"
    _description = "Student Fee"
    _inherit = ["mail.thread", "mail.activity.mixin", "portal.mixin"]
    _order = "due_date desc, id desc"

    name = fields.Char(required=True, copy=False, default="New")
    student_id = fields.Many2one(
        "cdt.student", required=True, ondelete="restrict", tracking=True
    )
    program_enrollment_id = fields.Many2one("cdt.program.enrollment")
    fee_schedule_id = fields.Many2one("cdt.fee.schedule", ondelete="restrict")
    fee_structure_id = fields.Many2one(
        "cdt.fee.structure", required=True, ondelete="restrict"
    )
    charge_type = fields.Selection(
        CHARGE_TYPES, required=True, default="tuition", tracking=True
    )
    due_date = fields.Date(required=True)
    amount = fields.Monetary(required=True, tracking=True)
    currency_id = fields.Many2one(
        related="fee_structure_id.currency_id", store=True, readonly=True
    )
    invoice_id = fields.Many2one("account.move", readonly=True, copy=False)
    invoice_state = fields.Selection(related="invoice_id.state", store=True)
    payment_state = fields.Selection(related="invoice_id.payment_state", store=True)
    payer_guardian_id = fields.Many2one(
        "cdt.guardian",
        string="Payer / Guardian",
        tracking=True,
        help="When selected, this guardian's contact is used as the invoice customer. "
        "Leave empty to invoice the student's own contact.",
    )
    invoice_partner_id = fields.Many2one(
        "res.partner",
        string="Invoice Payer",
        compute="_compute_invoice_partner",
        store=True,
        readonly=True,
    )
    amount_paid = fields.Monetary(compute="_compute_payment", store=True)
    balance = fields.Monetary(compute="_compute_payment", store=True)
    is_overdue = fields.Boolean(compute="_compute_overdue")
    days_overdue = fields.Integer(compute="_compute_overdue")
    reminder_ids = fields.One2many("cdt.fee.reminder", "student_fee_id")
    reminder_count = fields.Integer(compute="_compute_reminder_count")
    last_reminder_at = fields.Datetime(readonly=True, copy=False)
    next_reminder_date = fields.Date(readonly=True, copy=False)
    state = fields.Selection(
        [
            ("draft", "Draft"),
            ("due", "Due"),
            ("partial", "Partially Paid"),
            ("paid", "Paid"),
            ("cancelled", "Cancelled"),
        ],
        compute="_compute_payment",
        store=True,
    )

    _sql_constraints = [
        (
            "student_fee_number_unique",
            "unique(name)",
            "The student fee number must be unique.",
        ),
        (
            "schedule_student_unique",
            "unique(fee_schedule_id, student_id)",
            "This fee schedule has already been generated for the student.",
        ),
    ]

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if values.get("name", "New") == "New":
                values["name"] = self.env["ir.sequence"].next_by_code(
                    "cdt.student.fee"
                ) or "New"
        return super().create(values_list)

    @api.depends(
        "student_id.partner_id",
        "payer_guardian_id",
        "payer_guardian_id.partner_id",
    )
    def _compute_invoice_partner(self):
        for fee in self:
            fee.invoice_partner_id = (
                fee.payer_guardian_id.partner_id or fee.student_id.partner_id
            )

    @api.onchange("student_id")
    def _onchange_student_id_payer(self):
        linked_students = self.payer_guardian_id.student_line_ids.mapped("student_id")
        if self.payer_guardian_id and self.student_id not in linked_students:
            self.payer_guardian_id = False

    @api.constrains("student_id", "payer_guardian_id")
    def _check_payer_guardian(self):
        for fee in self.filtered("payer_guardian_id"):
            linked_students = fee.payer_guardian_id.student_line_ids.mapped("student_id")
            if fee.student_id not in linked_students:
                raise ValidationError("The selected payer must be a guardian of this student.")

    @api.depends("due_date", "balance", "state")
    def _compute_overdue(self):
        today = fields.Date.context_today(self)
        for fee in self:
            overdue = bool(
                fee.due_date
                and fee.due_date < today
                and fee.balance > 0
                and fee.state not in ("paid", "cancelled")
            )
            fee.is_overdue = overdue
            fee.days_overdue = (today - fee.due_date).days if overdue else 0

    @api.depends("reminder_ids")
    def _compute_reminder_count(self):
        for fee in self:
            fee.reminder_count = len(fee.reminder_ids)

    @api.depends(
        "amount",
        "invoice_id.amount_total",
        "invoice_id.amount_residual",
        "invoice_id.payment_state",
        "invoice_id.state",
    )
    def _compute_payment(self):
        for fee in self:
            if not fee.invoice_id:
                fee.amount_paid = 0
                fee.balance = fee.amount
                fee.state = "draft"
                continue
            fee.amount_paid = fee.invoice_id.amount_total - fee.invoice_id.amount_residual
            fee.balance = fee.invoice_id.amount_residual
            if fee.invoice_id.state == "cancel":
                fee.state = "cancelled"
            elif fee.invoice_id.payment_state == "paid":
                fee.state = "paid"
            elif fee.amount_paid > 0:
                fee.state = "partial"
            else:
                fee.state = "due"

    def action_create_invoice(self):
        for fee in self:
            if fee.invoice_id:
                continue
            if not fee.invoice_partner_id:
                raise ValidationError(
                    "Select a valid student or guardian contact before invoicing."
                )
            if not self.env["account.journal"].search(
                [("type", "=", "sale"), ("company_id", "=", self.env.company.id)],
                limit=1,
            ):
                raise ValidationError(
                    "Configure an Odoo sales journal and chart of accounts before "
                    "creating fee invoices."
                )
            structure_lines = fee.fee_structure_id.line_ids.sorted("sequence")
            structure_total = sum(structure_lines.mapped("net_amount"))
            if not structure_lines or fee.currency_id.is_zero(structure_total):
                raise ValidationError("The selected fee structure has no billable fee components.")
            if fee.amount <= 0:
                raise ValidationError("The student fee amount must be greater than zero.")

            invoice_lines = []
            allocated_amount = 0
            for index, line in enumerate(structure_lines):
                product = line.category_id._get_or_create_product()
                if index == len(structure_lines) - 1:
                    line_amount = fee.amount - allocated_amount
                else:
                    line_amount = fee.currency_id.round(
                        fee.amount * line.net_amount / structure_total
                    )
                    allocated_amount += line_amount
                invoice_lines.append(
                    (
                        0,
                        0,
                        {
                            "product_id": product.id,
                            "name": line.description or line.category_id.name,
                            "quantity": 1,
                            "price_unit": line_amount,
                            "tax_ids": [(6, 0, [])],
                        },
                    )
                )
            invoice = self.env["account.move"].create(
                {
                    "move_type": "out_invoice",
                    "partner_id": fee.invoice_partner_id.id,
                    "invoice_date": fields.Date.context_today(self),
                    "invoice_date_due": fee.due_date,
                    "invoice_origin": fee.name,
                    "invoice_line_ids": invoice_lines,
                }
            )
            fee.invoice_id = invoice

    def _get_reminder_institution(self):
        self.ensure_one()
        return self.env["cdt.education.institution"].search(
            [("company_id", "=", self.fee_structure_id.company_id.id)], limit=1
        )

    def _queue_reminder(self, trigger="manual", institution=None, raise_on_error=True):
        Reminder = self.env["cdt.fee.reminder"]
        queued = Reminder.browse()
        for fee in self:
            try:
                if not fee.invoice_id or fee.invoice_id.state != "posted":
                    raise ValidationError("Post the tuition invoice before scheduling a reminder.")
                if fee.balance <= 0 or fee.payment_state == "paid":
                    raise ValidationError("A paid tuition fee does not need a reminder.")
                recipient = fee.invoice_partner_id
                if not recipient.email:
                    raise ValidationError("The invoice payer must have an email address.")
                fee_institution = institution or fee._get_reminder_institution()
                template = fee_institution.fee_reminder_template_id or self.env.ref(
                    "cdt_education.mail_template_student_fee_reminder",
                    raise_if_not_found=False,
                )
                if not template:
                    raise ValidationError("Configure a tuition reminder email template.")
                mail_id = template.send_mail(
                    fee.id,
                    force_send=False,
                    raise_exception=raise_on_error,
                    email_values={"email_to": recipient.email},
                )
                if not mail_id:
                    raise ValidationError("Odoo could not add the reminder to the mail queue.")
                now = fields.Datetime.now()
                repeat_days = fee_institution.fee_reminder_repeat_days or 7
                reminder = Reminder.create(
                    {
                        "student_fee_id": fee.id,
                        "trigger": trigger,
                        "queued_at": now,
                        "queued_by_id": self.env.user.id,
                        "recipient_partner_id": recipient.id,
                        "recipient_email": recipient.email,
                        "mail_id": mail_id,
                    }
                )
                fee.write(
                    {
                        "last_reminder_at": now,
                        "next_reminder_date": fields.Date.context_today(fee)
                        + timedelta(days=repeat_days),
                    }
                )
                queued |= reminder
            except Exception:
                if raise_on_error:
                    raise
                _logger.exception("Unable to queue tuition reminder for fee %s", fee.name)
        return queued

    def action_schedule_reminder(self):
        reminders = self._queue_reminder(trigger="manual", raise_on_error=True)
        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": "Tuition reminder scheduled",
                "message": f"{len(reminders)} reminder(s) added to the outgoing mail queue.",
                "type": "success",
                "sticky": False,
            },
        }

    def action_send_reminder(self):
        """Compatibility alias: schedule mail without forcing SMTP delivery."""
        return self.action_schedule_reminder()

    @api.model
    def _cron_queue_fee_reminders(self):
        today = fields.Date.context_today(self)
        institutions = self.env["cdt.education.institution"].search(
            [("automatic_fee_reminders_enabled", "=", True), ("active", "=", True)]
        )
        processed_fee_ids = set()
        for institution in institutions:
            first_due_date = today - timedelta(
                days=institution.fee_reminder_delay_days or 0
            )
            fees = self.search(
                [
                    ("id", "not in", list(processed_fee_ids)),
                    ("fee_structure_id.company_id", "=", institution.company_id.id),
                    ("invoice_id.state", "=", "posted"),
                    ("state", "in", ("due", "partial")),
                    ("balance", ">", 0),
                    ("due_date", "<=", first_due_date),
                ]
            )
            for fee in fees:
                if fee.next_reminder_date and fee.next_reminder_date > today:
                    continue
                fee._queue_reminder(
                    trigger="automatic",
                    institution=institution,
                    raise_on_error=False,
                )
                processed_fee_ids.add(fee.id)
        return True

    def action_post_invoice(self):
        for fee in self:
            if not fee.invoice_id:
                raise ValidationError("Create an invoice before posting it.")
            if fee.invoice_id.state == "draft":
                fee.invoice_id.action_post()

    def action_register_payment(self):
        self.ensure_one()
        if not self.invoice_id:
            raise ValidationError("Create an invoice before registering payment.")
        if self.invoice_id.state != "posted":
            raise ValidationError("Post the invoice before registering payment.")
        if self.invoice_id.payment_state == "paid":
            raise ValidationError("This tuition invoice is already paid.")
        return {
            "name": "Register Tuition Payment",
            "type": "ir.actions.act_window",
            "res_model": "account.payment.register",
            "view_mode": "form",
            "target": "new",
            "context": {
                "active_model": "account.move",
                "active_ids": self.invoice_id.ids,
            },
        }

    def action_view_invoice(self):
        self.ensure_one()
        if not self.invoice_id:
            raise ValidationError("No invoice has been created for this fee.")
        return {
            "type": "ir.actions.act_window",
            "res_model": "account.move",
            "res_id": self.invoice_id.id,
            "view_mode": "form",
        }


class FeeReminder(models.Model):
    _name = "cdt.fee.reminder"
    _description = "Tuition Reminder Queue Entry"
    _order = "queued_at desc, id desc"

    student_fee_id = fields.Many2one(
        "cdt.student.fee", required=True, ondelete="cascade", index=True
    )
    trigger = fields.Selection(
        [("manual", "Manual"), ("automatic", "Automatic")],
        required=True,
        default="manual",
    )
    queued_at = fields.Datetime(required=True, default=fields.Datetime.now)
    queued_by_id = fields.Many2one("res.users", required=True, default=lambda self: self.env.user)
    recipient_partner_id = fields.Many2one("res.partner", required=True, ondelete="restrict")
    recipient_email = fields.Char(required=True)
    mail_id = fields.Many2one("mail.mail", readonly=True, ondelete="set null")
    mail_state = fields.Selection(related="mail_id.state", store=True, readonly=True)
