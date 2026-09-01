from odoo import fields, models


class EducationInstructor(models.Model):
    _inherit = "cdt.instructor"

    employee_id = fields.Many2one(
        "hr.employee",
        string="Employee Attendance Record",
        ondelete="set null",
        help="Employee used by Odoo's standard staff check-in, kiosk, and attendance reports.",
    )

    def action_open_or_create_employee(self):
        self.ensure_one()
        employee = self.employee_id
        if not employee:
            employee = self.env["hr.employee"].create(
                {
                    "name": self.partner_id.name,
                    "user_id": self.user_id.id,
                    "work_email": self.email,
                    "work_phone": self.phone,
                }
            )
            self.employee_id = employee
        return {
            "type": "ir.actions.act_window",
            "name": "Instructor Employee Record",
            "res_model": "hr.employee",
            "res_id": employee.id,
            "view_mode": "form",
        }
