from odoo import api, fields, models


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

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if values.get("name", "New") == "New":
                values["name"] = self.env["ir.sequence"].next_by_code(
                    "donation.donation"
                ) or "New"
        return super().create(values_list)
