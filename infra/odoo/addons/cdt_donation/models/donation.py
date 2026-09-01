from odoo import api, fields, models
from odoo.exceptions import ValidationError


class Donation(models.Model):
    _name = "donation.donation"
    _description = "Donation"
    _order = "donation_date desc, id desc"

    name = fields.Char(
        string="Reference",
        required=True,
        copy=False,
        default="New",
    )
    partner_id = fields.Many2one(
        "res.partner",
        string="Donor",
        required=True,
        ondelete="restrict",
    )
    amount = fields.Monetary(required=True)
    currency_id = fields.Many2one(
        "res.currency",
        required=True,
        default=lambda self: self.env.company.currency_id,
    )
    donation_date = fields.Date(
        required=True,
        default=fields.Date.context_today,
    )
    state = fields.Selection(
        [
            ("draft", "Draft"),
            ("confirmed", "Confirmed"),
            ("paid", "Paid"),
            ("cancelled", "Cancelled"),
        ],
        required=True,
        default="draft",
    )
    campaign_id = fields.Many2one("utm.campaign", string="Campaign")
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
    )
    fund_id = fields.Many2one(
        "donation.fund",
        string="Fund",
        ondelete="restrict",
        check_company=True,
        domain="[('company_id', '=', company_id)]",
        help="Assign the donation to an unrestricted or donor-restricted fund.",
    )
    designation = fields.Char(
        help="Optional donor wording or internal designation for this gift."
    )
    purpose = fields.Text(
        help="Specific purpose communicated by the donor for this donation."
    )

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if values.get("name", "New") == "New":
                values["name"] = self.env["ir.sequence"].next_by_code(
                    "donation.donation"
                ) or "New"
        return super().create(values_list)

    @api.constrains("fund_id", "company_id")
    def _check_fund_company(self):
        for donation in self:
            if (
                donation.fund_id
                and donation.fund_id.company_id != donation.company_id
            ):
                raise ValidationError(
                    "The donation and its designated fund must belong to the same company."
                )
