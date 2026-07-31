import base64

from odoo import fields, http
from odoo.http import request


MAX_DOCUMENT_BYTES = 8 * 1024 * 1024
ALLOWED_DOCUMENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}


class CdtAdmissionsWebsite(http.Controller):
    def _open_rounds(self):
        today = fields.Date.today()
        return request.env["cdt.student.admission"].sudo().search(
            [
                ("state", "=", "open"),
                ("published", "=", True),
                ("application_start", "<=", today),
                ("application_end", ">=", today),
            ],
            order="application_end, id",
        )

    @http.route(["/apply"], type="http", auth="public", website=True, sitemap=True)
    def admissions_home(self, **kwargs):
        return request.render(
            "cdt_education.online_admissions_home",
            {"admission_rounds": self._open_rounds(), "page_name": "apply"},
        )

    @http.route(
        ["/apply/<int:admission_id>"],
        type="http",
        auth="public",
        website=True,
        methods=["GET", "POST"],
        sitemap=True,
    )
    def admissions_form(self, admission_id, **post):
        admission = self._open_rounds().filtered(lambda item: item.id == admission_id)
        if not admission:
            return request.not_found()

        if request.httprequest.method == "GET":
            return request.render(
                "cdt_education.online_admissions_form",
                {"admission": admission, "form_values": {}, "errors": []},
            )

        if post.get("company_website"):
            return request.not_found()

        values = {
            key: (post.get(key) or "").strip()
            for key in (
                "first_name",
                "middle_name",
                "last_name",
                "email",
                "phone",
                "date_of_birth",
                "gender",
                "prior_school",
                "guardian_name",
                "guardian_email",
                "guardian_phone",
                "notes",
            )
        }
        errors = []
        for key, label in (
            ("first_name", "Student first name"),
            ("last_name", "Student last name"),
            ("guardian_name", "Parent or guardian name"),
            ("guardian_email", "Parent or guardian email"),
        ):
            if not values[key]:
                errors.append(f"{label} is required.")
        if post.get("consent") != "yes":
            errors.append("Please confirm that the information may be used to process this application.")

        upload = request.httprequest.files.get("supporting_document")
        upload_data = None
        if upload and upload.filename:
            upload_data = upload.read(MAX_DOCUMENT_BYTES + 1)
            if len(upload_data) > MAX_DOCUMENT_BYTES:
                errors.append("The supporting document must be 8 MB or smaller.")
            if upload.mimetype not in ALLOWED_DOCUMENT_TYPES:
                errors.append("Supporting documents must be PDF, JPG, or PNG files.")

        if errors:
            return request.render(
                "cdt_education.online_admissions_form",
                {"admission": admission, "form_values": values, "errors": errors},
            )

        applicant_values = {
            "admission_id": admission.id,
            "first_name": values["first_name"],
            "middle_name": values["middle_name"] or False,
            "last_name": values["last_name"],
            "email": values["email"] or False,
            "phone": values["phone"] or False,
            "date_of_birth": values["date_of_birth"] or False,
            "gender": values["gender"] or False,
            "prior_school": values["prior_school"] or False,
            "guardian_name": values["guardian_name"],
            "guardian_email": values["guardian_email"],
            "guardian_phone": values["guardian_phone"] or False,
            "notes": values["notes"] or False,
        }
        applicant = request.env["cdt.student.applicant"].sudo().create(applicant_values)

        if upload_data and upload:
            attachment = request.env["ir.attachment"].sudo().create(
                {
                    "name": upload.filename,
                    "datas": base64.b64encode(upload_data),
                    "mimetype": upload.mimetype,
                    "res_model": "cdt.student.applicant",
                    "res_id": applicant.id,
                }
            )
            request.env["cdt.applicant.document"].sudo().create(
                {
                    "applicant_id": applicant.id,
                    "name": upload.filename,
                    "attachment_id": attachment.id,
                }
            )

        return request.render(
            "cdt_education.online_admissions_confirmation",
            {"applicant": applicant, "admission": admission},
        )
