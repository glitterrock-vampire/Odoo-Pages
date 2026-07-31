from odoo.exceptions import ValidationError
from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestDonationFundTracking(TransactionCase):
    def setUp(self):
        super().setUp()
        self.partner = self.env["res.partner"].create({"name": "Fund Test Donor"})
        self.fund = self.env["donation.fund"].create(
            {
                "name": "Test Scholarship Fund",
                "code": "TEST-SCHOLARSHIP",
                "restriction": "temporary",
                "purpose": "Student scholarships",
                "target_amount": 1000,
            }
        )

    def _donation(self, amount, state):
        return self.env["donation.donation"].create(
            {
                "partner_id": self.partner.id,
                "amount": amount,
                "state": state,
                "fund_id": self.fund.id,
                "designation": "Scholarship support",
            }
        )

    def test_fund_totals_follow_donation_states(self):
        draft = self._donation(100, "draft")
        confirmed = self._donation(300, "confirmed")
        paid = self._donation(250, "paid")
        self._donation(400, "cancelled")

        self.assertEqual(self.fund.pledged_amount, 550)
        self.assertEqual(self.fund.paid_amount, 250)
        self.assertEqual(self.fund.remaining_amount, 750)

        draft.state = "confirmed"
        confirmed.state = "paid"
        self.assertEqual(self.fund.pledged_amount, 650)
        self.assertEqual(self.fund.paid_amount, 550)
        self.assertEqual(self.fund.remaining_amount, 450)

        paid.fund_id = False
        self.assertEqual(self.fund.pledged_amount, 400)
        self.assertEqual(self.fund.paid_amount, 300)
        self.assertEqual(self.fund.remaining_amount, 700)

    def test_negative_target_is_rejected(self):
        with self.assertRaises(ValidationError):
            self.fund.target_amount = -1

    def test_fund_must_match_donation_company(self):
        other_company = self.env["res.company"].create(
            {"name": "Other Donation Test Company"}
        )
        with self.assertRaises(ValidationError):
            self.env["donation.donation"].create(
                {
                    "partner_id": self.partner.id,
                    "amount": 100,
                    "company_id": other_company.id,
                    "currency_id": other_company.currency_id.id,
                    "fund_id": self.fund.id,
                }
            )
