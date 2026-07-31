from odoo import api, fields, models
from odoo.exceptions import ValidationError


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
    amount = fields.Monetary(related="fee_structure_id.total_amount", store=True)
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

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if values.get("name", "New") == "New":
                values["name"] = self.env["ir.sequence"].next_by_code(
                    "cdt.fee.schedule"
                ) or "New"
        return super().create(values_list)

    @api.constrains("posting_date", "due_date", "installment_number")
    def _check_values(self):
        for schedule in self:
            if schedule.due_date < schedule.posting_date:
                raise ValidationError("The fee due date must follow its posting date.")
            if schedule.installment_number < 1:
                raise ValidationError("Installment number must be at least one.")

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
    due_date = fields.Date(required=True)
    amount = fields.Monetary(required=True, tracking=True)
    currency_id = fields.Many2one(
        related="fee_structure_id.currency_id", store=True, readonly=True
    )
    invoice_id = fields.Many2one("account.move", readonly=True, copy=False)
    invoice_state = fields.Selection(related="invoice_id.state", store=True)
    payment_state = fields.Selection(related="invoice_id.payment_state", store=True)
    amount_paid = fields.Monetary(compute="_compute_payment", store=True)
    balance = fields.Monetary(compute="_compute_payment", store=True)
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
            if not fee.student_id.partner_id:
                raise ValidationError("The student must have a contact before invoicing.")
            if not self.env["account.journal"].search(
                [("type", "=", "sale"), ("company_id", "=", self.env.company.id)],
                limit=1,
            ):
                raise ValidationError(
                    "Configure an Odoo sales journal and chart of accounts before creating fee invoices."
                )
            invoice_lines = []
            for line in fee.fee_structure_id.line_ids:
                product = line.category_id._get_or_create_product()
                invoice_lines.append(
                    (
                        0,
                        0,
                        {
                            "product_id": product.id,
                            "name": line.description or line.category_id.name,
                            "quantity": 1,
                            "price_unit": line.net_amount,
                            "tax_ids": [(6, 0, [])],
                        },
                    )
                )
            if not invoice_lines:
                raise ValidationError("The selected fee structure has no fee components.")
            current_total = sum(fee.fee_structure_id.line_ids.mapped("net_amount"))
            if not fee.currency_id.is_zero(current_total - fee.amount):
                raise ValidationError(
                    "The fee structure total has changed since this student fee was assessed. "
                    "Create a new fee adjustment or restore the original structure before invoicing."
                )
            invoice = self.env["account.move"].create(
                {
                    "move_type": "out_invoice",
                    "partner_id": fee.student_id.partner_id.id,
                    "invoice_date": fields.Date.context_today(self),
                    "invoice_date_due": fee.due_date,
                    "invoice_origin": fee.name,
                    "invoice_line_ids": invoice_lines,
                }
            )
            fee.invoice_id = invoice

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
