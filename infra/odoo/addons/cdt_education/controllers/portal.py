import base64

from odoo import fields, http
from odoo.http import request
from odoo.addons.portal.controllers.portal import CustomerPortal


MAX_PORTAL_DOCUMENT_BYTES = 8 * 1024 * 1024
ALLOWED_PORTAL_DOCUMENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}
CONSENT_TYPES = {
    "programme",
    "medical",
    "media",
    "transport",
    "data",
    "other",
}
DOCUMENT_CATEGORIES = {
    "identification",
    "medical",
    "consent",
    "academic",
    "other",
}


class CdtEducationPortal(CustomerPortal):
    def _portal_family(self):
        user = request.env.user
        students = request.env["cdt.student"].sudo().search(
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
        return guardian, students

    def _ensure_portal_enabled(self):
        institution = request.env["cdt.education.institution"].sudo().search([], limit=1)
        return not institution or institution.portal_enabled

    def _owned_student(self, student_id):
        guardian, students = self._portal_family()
        try:
            student_id = int(student_id)
        except (TypeError, ValueError):
            return guardian, request.env["cdt.student"]
        return guardian, students.filtered(lambda student: student.id == student_id)

    def _redirect_portal(self, notice=None, error=None):
        query = []
        if notice:
            query.append(f"notice={notice}")
        if error:
            query.append(f"error={error}")
        suffix = f"?{'&'.join(query)}" if query else ""
        return request.redirect(f"/my/education{suffix}#family-actions")

    @http.route(["/my/education"], type="http", auth="user", website=True)
    def portal_my_education(self, **kwargs):
        if not self._ensure_portal_enabled():
            return request.not_found()

        guardian, students = self._portal_family()
        student_ids = students.ids
        upcoming_schedule = (
            request.env["cdt.course.schedule"]
            .sudo()
            .search(
                [
                    ("student_group_id.member_line_ids.student_id", "in", student_ids),
                    ("start_datetime", ">=", fields.Datetime.now()),
                    ("state", "=", "planned"),
                ],
                order="start_datetime",
                limit=20,
            )
            if student_ids
            else request.env["cdt.course.schedule"]
        )
        attendance = (
            request.env["cdt.student.attendance"]
            .sudo()
            .search([("student_id", "in", student_ids)], order="date desc", limit=30)
            if student_ids
            else request.env["cdt.student.attendance"]
        )
        results = (
            request.env["cdt.assessment.result"]
            .sudo()
            .search(
                [("student_id", "in", student_ids), ("published", "=", True)],
                order="assessment_date desc",
                limit=30,
            )
            if student_ids
            else request.env["cdt.assessment.result"]
        )
        fees = (
            request.env["cdt.student.fee"]
            .sudo()
            .search([("student_id", "in", student_ids)], order="due_date desc", limit=30)
            if student_ids
            else request.env["cdt.student.fee"]
        )
        leave_requests = (
            request.env["cdt.student.leave"]
            .sudo()
            .search([("student_id", "in", student_ids)], order="date_from desc", limit=20)
            if student_ids
            else request.env["cdt.student.leave"]
        )
        consent_records = (
            request.env["cdt.guardian.consent"]
            .sudo()
            .search([("student_id", "in", student_ids)], order="submitted_at desc", limit=20)
            if student_ids
            else request.env["cdt.guardian.consent"]
        )
        student_documents = (
            request.env["cdt.student.document"]
            .sudo()
            .search([("student_id", "in", student_ids)], order="submitted_at desc", limit=20)
            if student_ids
            else request.env["cdt.student.document"]
        )

        values = self._prepare_portal_layout_values()
        total_fees = sum(fees.mapped("amount"))
        total_paid = sum(fees.mapped("amount_paid"))
        total_balance = sum(fees.mapped("balance"))
        notice_messages = {
            "absence-submitted": "The absence notice was submitted for staff review.",
            "consent-recorded": "Your consent decision was recorded.",
            "document-uploaded": "The student document was uploaded for staff review.",
        }
        error_messages = {
            "invalid-student": "Select a student linked to your family account.",
            "invalid-dates": "Enter a valid start and end date.",
            "reason-required": "Enter a reason for the absence.",
            "invalid-consent": "Complete every required consent field.",
            "invalid-document": "Choose a PDF, JPG, or PNG file no larger than 8 MB.",
        }
        fee_portal_urls = {
            fee.id: fee.invoice_id.sudo().get_portal_url()
            for fee in fees
            if fee.invoice_id and fee.invoice_id.state == "posted"
        }
        values.update(
            {
                "page_name": "education",
                "is_guardian_view": bool(guardian),
                "students": students,
                "upcoming_schedule": upcoming_schedule,
                "attendance_records": attendance,
                "assessment_results": results,
                "student_fees": fees,
                "leave_requests": leave_requests,
                "consent_records": consent_records,
                "student_documents": student_documents,
                "fee_portal_urls": fee_portal_urls,
                "total_fees": total_fees,
                "total_paid": total_paid,
                "total_balance": total_balance,
                "portal_currency": fees[:1].currency_id
                if fees
                else request.env.company.currency_id,
                "portal_notice": notice_messages.get(kwargs.get("notice")),
                "portal_error": error_messages.get(kwargs.get("error")),
            }
        )
        return request.render("cdt_education.portal_my_education", values)

    @http.route(
        ["/my/education/absence"],
        type="http",
        auth="user",
        website=True,
        methods=["POST"],
    )
    def portal_submit_absence(self, **post):
        if not self._ensure_portal_enabled():
            return request.not_found()
        guardian, student = self._owned_student(post.get("student_id"))
        if not student:
            return self._redirect_portal(error="invalid-student")
        date_from = post.get("date_from")
        date_to = post.get("date_to")
        try:
            parsed_from = fields.Date.to_date(date_from)
            parsed_to = fields.Date.to_date(date_to)
        except (TypeError, ValueError):
            return self._redirect_portal(error="invalid-dates")
        if not parsed_from or not parsed_to or parsed_to < parsed_from:
            return self._redirect_portal(error="invalid-dates")
        reason = (post.get("reason") or "").strip()
        if not reason:
            return self._redirect_portal(error="reason-required")

        leave = request.env["cdt.student.leave"].sudo().create(
            {
                "student_id": student.id,
                "date_from": parsed_from,
                "date_to": parsed_to,
                "reason": reason,
                "state": "submitted",
            }
        )
        upload = request.httprequest.files.get("supporting_document")
        if upload and upload.filename:
            upload_data = upload.read(MAX_PORTAL_DOCUMENT_BYTES + 1)
            if (
                len(upload_data) > MAX_PORTAL_DOCUMENT_BYTES
                or upload.mimetype not in ALLOWED_PORTAL_DOCUMENT_TYPES
            ):
                leave.unlink()
                return self._redirect_portal(error="invalid-document")
            attachment = request.env["ir.attachment"].sudo().create(
                {
                    "name": upload.filename,
                    "datas": base64.b64encode(upload_data),
                    "mimetype": upload.mimetype,
                    "res_model": "cdt.student.leave",
                    "res_id": leave.id,
                }
            )
            leave.supporting_document_id = attachment
        leave.message_post(body="Absence notice submitted through the family portal.")
        return self._redirect_portal(notice="absence-submitted")

    @http.route(
        ["/my/education/consent"],
        type="http",
        auth="user",
        website=True,
        methods=["POST"],
    )
    def portal_submit_consent(self, **post):
        if not self._ensure_portal_enabled():
            return request.not_found()
        guardian, student = self._owned_student(post.get("student_id"))
        consent_type = post.get("consent_type")
        decision = post.get("decision")
        signature_name = (post.get("signature_name") or "").strip()
        if (
            not student
            or consent_type not in CONSENT_TYPES
            or decision not in ("granted", "declined")
            or not signature_name
            or post.get("acknowledged") != "yes"
        ):
            return self._redirect_portal(error="invalid-consent")
        request.env["cdt.guardian.consent"].sudo().create(
            {
                "student_id": student.id,
                "guardian_id": guardian.id if guardian else False,
                "consent_type": consent_type,
                "decision": decision,
                "signature_name": signature_name,
                "notes": (post.get("notes") or "").strip() or False,
                "submitted_by_id": request.env.user.id,
                "source": "portal",
            }
        )
        return self._redirect_portal(notice="consent-recorded")

    @http.route(
        ["/my/education/document"],
        type="http",
        auth="user",
        website=True,
        methods=["POST"],
    )
    def portal_upload_document(self, **post):
        if not self._ensure_portal_enabled():
            return request.not_found()
        guardian, student = self._owned_student(post.get("student_id"))
        category = post.get("category")
        upload = request.httprequest.files.get("student_document")
        if not student or category not in DOCUMENT_CATEGORIES or not upload or not upload.filename:
            return self._redirect_portal(error="invalid-document")
        upload_data = upload.read(MAX_PORTAL_DOCUMENT_BYTES + 1)
        if (
            len(upload_data) > MAX_PORTAL_DOCUMENT_BYTES
            or upload.mimetype not in ALLOWED_PORTAL_DOCUMENT_TYPES
        ):
            return self._redirect_portal(error="invalid-document")
        attachment = request.env["ir.attachment"].sudo().create(
            {
                "name": upload.filename,
                "datas": base64.b64encode(upload_data),
                "mimetype": upload.mimetype,
                "res_model": "cdt.student",
                "res_id": student.id,
            }
        )
        request.env["cdt.student.document"].sudo().create(
            {
                "name": upload.filename,
                "student_id": student.id,
                "guardian_id": guardian.id if guardian else False,
                "category": category,
                "attachment_id": attachment.id,
                "submitted_by_id": request.env.user.id,
                "notes": (post.get("notes") or "").strip() or False,
            }
        )
        return self._redirect_portal(notice="document-uploaded")

    @http.route(
        ["/my/education/fees/<int:fee_id>/document"],
        type="http",
        auth="user",
        website=True,
    )
    def portal_fee_document(self, fee_id, **kwargs):
        if not self._ensure_portal_enabled():
            return request.not_found()
        _guardian, students = self._portal_family()
        fee = request.env["cdt.student.fee"].sudo().search(
            [("id", "=", fee_id), ("student_id", "in", students.ids)], limit=1
        )
        if not fee or not fee.invoice_id:
            return request.not_found()
        pdf, _content_type = request.env["ir.actions.report"].sudo()._render_qweb_pdf(
            "account.account_invoices", fee.invoice_id.ids
        )
        return request.make_response(
            pdf,
            headers=[
                ("Content-Type", "application/pdf"),
                ("Content-Length", str(len(pdf))),
                (
                    "Content-Disposition",
                    f'attachment; filename="{fee.name}-invoice.pdf"',
                ),
            ],
        )
