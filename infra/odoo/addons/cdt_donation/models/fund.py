from odoo import api, fields, models
from odoo.exceptions import ValidationError


class DonationFund(models.Model):
    _name = "donation.fund"
    _description = "Donation Fund"
    _order = "active desc, name"

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    restriction = fields.Selection(
        [
            ("unrestricted", "Unrestricted"),
            ("temporary", "Temporarily Restricted"),
            ("permanent", "Permanently Restricted"),
        ],
        required=True,
        default="unrestricted",
        help="Restricted funds must only be used for the stated purpose.",
    )
    purpose = fields.Text(
        help="Describe how donations assigned to this fund may be used."
    )
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    currency_id = fields.Many2one(
        "res.currency",
        required=True,
        default=lambda self: self.env.company.currency_id,
    )
    target_amount = fields.Monetary(
        string="Fundraising Target",
        currency_field="currency_id",
        default=0,
    )
    active = fields.Boolean(default=True)
    donation_ids = fields.One2many(
        "donation.donation",
        "fund_id",
        string="Donations",
    )
    pledged_amount = fields.Monetary(
        string="Pledged",
        currency_field="currency_id",
        compute="_compute_totals",
        store=True,
        help="Confirmed and paid donations assigned to this fund.",
    )
    paid_amount = fields.Monetary(
        string="Paid",
        currency_field="currency_id",
        compute="_compute_totals",
        store=True,
        help="Paid donations assigned to this fund.",
    )
    remaining_amount = fields.Monetary(
        string="Remaining to Target",
        currency_field="currency_id",
        compute="_compute_totals",
        store=True,
        help="The portion of the fundraising target not yet collected.",
    )

    _sql_constraints = [
        (
            "donation_fund_code_company_unique",
            "unique(code, company_id)",
            "The fund code must be unique within the company.",
        ),
    ]

    @api.depends(
        "target_amount",
        "donation_ids.amount",
        "donation_ids.currency_id",
        "donation_ids.donation_date",
        "donation_ids.state",
        "donation_ids.company_id",
    )
    def _compute_totals(self):
        today = fields.Date.context_today(self)
        for fund in self:
            pledged = 0.0
            paid = 0.0
            for donation in fund.donation_ids.filtered(
                lambda record: record.state in ("confirmed", "paid")
            ):
                converted_amount = donation.currency_id._convert(
                    donation.amount,
                    fund.currency_id,
                    fund.company_id,
                    donation.donation_date or today,
                )
                pledged += converted_amount
                if donation.state == "paid":
                    paid += converted_amount
            fund.pledged_amount = pledged
            fund.paid_amount = paid
            fund.remaining_amount = max(fund.target_amount - paid, 0.0)

    @api.constrains("target_amount")
    def _check_target_amount(self):
        for fund in self:
            if fund.target_amount < 0:
                raise ValidationError("The fundraising target cannot be negative.")
