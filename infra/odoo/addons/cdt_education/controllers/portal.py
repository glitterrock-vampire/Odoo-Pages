from odoo import fields, http
from odoo.http import request
from odoo.addons.portal.controllers.portal import CustomerPortal


class CdtEducationPortal(CustomerPortal):
    @http.route(["/my/education"], type="http", auth="user", website=True)
    def portal_my_education(self, **kwargs):
        user = request.env.user
        Student = request.env["cdt.student"].sudo()
        students = Student.search(
            [
                "|",
                ("partner_id", "=", user.partner_id.id),
                ("portal_user_id", "=", user.id),
            ]
        )
        guardian = request.env["cdt.guardian"].sudo().search(
            [("partner_id", "=", user.partner_id.id)], limit=1
        )
        if guardian:
            students |= guardian.student_line_ids.mapped("student_id")

        student_ids = students.ids
        upcoming_schedule = request.env["cdt.course.schedule"].sudo().search(
            [
                ("student_group_id.member_line_ids.student_id", "in", student_ids),
                ("start_datetime", ">=", fields.Datetime.now()),
                ("state", "=", "planned"),
            ],
            order="start_datetime",
            limit=20,
        ) if student_ids else request.env["cdt.course.schedule"]
        attendance = request.env["cdt.student.attendance"].sudo().search(
            [("student_id", "in", student_ids)], order="date desc", limit=30
        ) if student_ids else request.env["cdt.student.attendance"]
        results = request.env["cdt.assessment.result"].sudo().search(
            [("student_id", "in", student_ids), ("published", "=", True)],
            order="assessment_date desc",
            limit=30,
        ) if student_ids else request.env["cdt.assessment.result"]
        fees = request.env["cdt.student.fee"].sudo().search(
            [("student_id", "in", student_ids)], order="due_date desc", limit=30
        ) if student_ids else request.env["cdt.student.fee"]

        values = self._prepare_portal_layout_values()
        total_fees = sum(fees.mapped("amount"))
        total_paid = sum(fees.mapped("amount_paid"))
        total_balance = sum(fees.mapped("balance"))
        values.update(
            {
                "page_name": "education",
                "is_guardian_view": bool(guardian),
                "students": students,
                "upcoming_schedule": upcoming_schedule,
                "attendance_records": attendance,
                "assessment_results": results,
                "student_fees": fees,
                "total_fees": total_fees,
                "total_paid": total_paid,
                "total_balance": total_balance,
                "portal_currency": fees[:1].currency_id if fees else request.env.company.currency_id,
            }
        )
        return request.render("cdt_education.portal_my_education", values)
