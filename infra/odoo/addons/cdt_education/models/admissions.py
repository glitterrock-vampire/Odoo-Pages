from odoo import api, fields, models
from odoo.exceptions import ValidationError


class StudentAdmission(models.Model):
    _name = "cdt.student.admission"
    _description = "Student Admission Round"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "application_start desc, id desc"

    name = fields.Char(required=True, tracking=True)
    program_id = fields.Many2one("cdt.program", required=True, ondelete="restrict")
    academic_year_id = fields.Many2one(
        "cdt.academic.year", required=True, ondelete="restrict"
    )
    application_start = fields.Date(required=True)
    application_end = fields.Date(required=True)
    minimum_age = fields.Integer(default=0)
    maximum_age = fields.Integer(default=99)
    capacity = fields.Integer(default=20)
    application_fee = fields.Monetary(default=0)
    currency_id = fields.Many2one(
        "res.currency", required=True, default=lambda self: self.env.company.currency_id
    )
    introduction = fields.Html()
    published = fields.Boolean(default=False)
    applicant_ids = fields.One2many("cdt.student.applicant", "admission_id")
    state = fields.Selection(
        [
            ("draft", "Draft"),
            ("open", "Open"),
            ("closed", "Closed"),
            ("cancelled", "Cancelled"),
        ],
        default="draft",
        required=True,
        tracking=True,
    )

    @api.constrains(
        "application_start",
        "application_end",
        "minimum_age",
        "maximum_age",
        "capacity",
    )
    def _check_values(self):
        for admission in self:
            if admission.application_end < admission.application_start:
                raise ValidationError("The application end date must follow its start date.")
            if admission.minimum_age < 0 or admission.maximum_age < admission.minimum_age:
                raise ValidationError("Enter a valid applicant age range.")
            if admission.capacity < 1:
                raise ValidationError("Admission capacity must be at least one.")

    def action_open(self):
        self.write({"state": "open", "published": True})

    def action_close(self):
        self.write({"state": "closed", "published": False})


class StudentApplicant(models.Model):
    _name = "cdt.student.applicant"
    _description = "Student Applicant"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "application_date desc, id desc"

    name = fields.Char(
        string="Application Number", required=True, copy=False, default="New"
    )
    admission_id = fields.Many2one(
        "cdt.student.admission", required=True, ondelete="restrict", tracking=True
    )
    program_id = fields.Many2one(
        related="admission_id.program_id", store=True, readonly=True
    )
    academic_year_id = fields.Many2one(
        related="admission_id.academic_year_id", store=True, readonly=True
    )
    application_date = fields.Date(required=True, default=fields.Date.context_today)
    first_name = fields.Char(required=True)
    middle_name = fields.Char()
    last_name = fields.Char(required=True)
    full_name = fields.Char(compute="_compute_full_name", store=True)
    email = fields.Char()
    phone = fields.Char()
    date_of_birth = fields.Date()
    gender = fields.Selection(
        [
            ("female", "Female"),
            ("male", "Male"),
            ("non_binary", "Non-binary"),
            ("not_stated", "Prefer not to say"),
        ]
    )
    category_id = fields.Many2one("cdt.student.category")
    prior_school = fields.Char()
    guardian_name = fields.Char()
    guardian_email = fields.Char()
    guardian_phone = fields.Char()
    notes = fields.Html()
    document_ids = fields.One2many("cdt.applicant.document", "applicant_id")
    application_fee_paid = fields.Boolean(default=False)
    state = fields.Selection(
        [
            ("applied", "Applied"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("admitted", "Admitted"),
            ("withdrawn", "Withdrawn"),
        ],
        default="applied",
        required=True,
        tracking=True,
    )
    student_id = fields.Many2one("cdt.student", readonly=True, copy=False)
    enrollment_id = fields.Many2one(
        "cdt.program.enrollment", readonly=True, copy=False
    )

    _sql_constraints = [
        (
            "application_number_unique",
            "unique(name)",
            "The application number must be unique.",
        ),
    ]

    @api.depends("first_name", "middle_name", "last_name")
    def _compute_full_name(self):
        for applicant in self:
            applicant.full_name = " ".join(
                part
                for part in (
                    applicant.first_name,
                    applicant.middle_name,
                    applicant.last_name,
                )
                if part
            )

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if values.get("name", "New") == "New":
                values["name"] = self.env["ir.sequence"].next_by_code(
                    "cdt.student.applicant"
                ) or "New"
        return super().create(values_list)

    def action_approve(self):
        self.write({"state": "approved"})

    def action_reject(self):
        self.write({"state": "rejected"})

    def action_admit(self):
        for applicant in self:
            if applicant.state not in ("applied", "approved"):
                raise ValidationError("Only applied or approved applicants can be admitted.")
            if applicant.student_id:
                continue
            student = self.env["cdt.student"].create(
                {
                    "first_name": applicant.first_name,
                    "middle_name": applicant.middle_name,
                    "last_name": applicant.last_name,
                    "email": applicant.email,
                    "phone": applicant.phone,
                    "date_of_birth": applicant.date_of_birth,
                    "gender": applicant.gender,
                    "category_id": applicant.category_id.id,
                    "current_program_id": applicant.program_id.id,
                    "status": "active",
                }
            )
            if applicant.guardian_name:
                guardian_partner = self.env["res.partner"].create(
                    {
                        "name": applicant.guardian_name,
                        "email": applicant.guardian_email,
                        "phone": applicant.guardian_phone,
                    }
                )
                guardian = self.env["cdt.guardian"].create(
                    {"partner_id": guardian_partner.id}
                )
                self.env["cdt.student.guardian"].create(
                    {
                        "student_id": student.id,
                        "guardian_id": guardian.id,
                        "relationship": "parent",
                        "emergency_contact": True,
                    }
                )
            required_courses = applicant.program_id.course_line_ids.filtered(
                "required"
            ).mapped("course_id")
            enrollment = self.env["cdt.program.enrollment"].create(
                {
                    "student_id": student.id,
                    "program_id": applicant.program_id.id,
                    "academic_year_id": applicant.academic_year_id.id,
                    "category_id": applicant.category_id.id,
                    "course_ids": [(6, 0, required_courses.ids)],
                }
            )
            applicant.write(
                {
                    "state": "admitted",
                    "student_id": student.id,
                    "enrollment_id": enrollment.id,
                }
            )


class ApplicantDocument(models.Model):
    _name = "cdt.applicant.document"
    _description = "Applicant Document"

    applicant_id = fields.Many2one(
        "cdt.student.applicant", required=True, ondelete="cascade"
    )
    name = fields.Char(required=True)
    attachment_id = fields.Many2one("ir.attachment", required=True, ondelete="cascade")
    verified = fields.Boolean(default=False)
    verified_by_id = fields.Many2one("res.users")
    verified_date = fields.Date()


class ProgramEnrollment(models.Model):
    _name = "cdt.program.enrollment"
    _description = "Program Enrollment"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "enrollment_date desc, id desc"

    name = fields.Char(required=True, copy=False, default="New")
    legacy_id = fields.Char(index=True, copy=False)
    student_id = fields.Many2one(
        "cdt.student", required=True, ondelete="restrict", tracking=True
    )
    program_id = fields.Many2one(
        "cdt.program", required=True, ondelete="restrict", tracking=True
    )
    academic_year_id = fields.Many2one(
        "cdt.academic.year", required=True, ondelete="restrict"
    )
    academic_term_id = fields.Many2one("cdt.academic.term")
    enrollment_date = fields.Date(required=True, default=fields.Date.context_today)
    category_id = fields.Many2one("cdt.student.category")
    batch_id = fields.Many2one("cdt.student.batch")
    house_id = fields.Many2one("cdt.student.house")
    course_ids = fields.Many2many("cdt.course", string="Enrolled Courses")
    course_enrollment_ids = fields.One2many(
        "cdt.course.enrollment", "program_enrollment_id"
    )
    fee_structure_id = fields.Many2one("cdt.fee.structure")
    fees_due_date = fields.Date()
    boarding_student = fields.Boolean(default=False)
    transportation_mode = fields.Selection(
        [
            ("none", "None"),
            ("school", "School transportation"),
            ("private", "Private transportation"),
            ("public", "Public transportation"),
        ],
        default="none",
    )
    vehicle_number = fields.Char()
    state = fields.Selection(
        [
            ("draft", "Draft"),
            ("confirmed", "Confirmed"),
            ("completed", "Completed"),
            ("cancelled", "Cancelled"),
        ],
        default="draft",
        required=True,
        tracking=True,
    )

    _sql_constraints = [
        (
            "enrollment_legacy_unique",
            "unique(legacy_id)",
            "The legacy enrollment identifier must be unique.",
        ),
        (
            "student_program_year_unique",
            "unique(student_id, program_id, academic_year_id, academic_term_id)",
            "The student already has this program enrollment for the selected period.",
        ),
    ]

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if values.get("name", "New") == "New":
                values["name"] = self.env["ir.sequence"].next_by_code(
                    "cdt.program.enrollment"
                ) or "New"
        return super().create(values_list)

    @api.onchange("program_id")
    def _onchange_program_id(self):
        if self.program_id:
            self.course_ids = self.program_id.course_line_ids.filtered(
                "required"
            ).mapped("course_id")

    @api.constrains("academic_year_id", "academic_term_id")
    def _check_term(self):
        for enrollment in self:
            if (
                enrollment.academic_term_id
                and enrollment.academic_term_id.academic_year_id
                != enrollment.academic_year_id
            ):
                raise ValidationError("The term must belong to the selected academic year.")

    def action_confirm(self):
        for enrollment in self:
            for course in enrollment.course_ids:
                existing = enrollment.course_enrollment_ids.filtered(
                    lambda item, course=course: item.course_id == course
                )
                if not existing:
                    self.env["cdt.course.enrollment"].create(
                        {
                            "program_enrollment_id": enrollment.id,
                            "course_id": course.id,
                        }
                    )
            enrollment.write({"state": "confirmed"})
            enrollment.student_id.write(
                {
                    "current_program_id": enrollment.program_id.id,
                    "batch_id": enrollment.batch_id.id,
                    "category_id": enrollment.category_id.id,
                    "house_id": enrollment.house_id.id,
                }
            )

    def action_complete(self):
        self.write({"state": "completed"})

    def action_cancel(self):
        self.write({"state": "cancelled"})


class CourseEnrollment(models.Model):
    _name = "cdt.course.enrollment"
    _description = "Course Enrollment"
    _order = "course_id"

    program_enrollment_id = fields.Many2one(
        "cdt.program.enrollment", required=True, ondelete="cascade"
    )
    student_id = fields.Many2one(
        related="program_enrollment_id.student_id", store=True, readonly=True
    )
    course_id = fields.Many2one("cdt.course", required=True, ondelete="restrict")
    offering_id = fields.Many2one("cdt.course.offering")
    status = fields.Selection(
        [
            ("enrolled", "Enrolled"),
            ("in_progress", "In Progress"),
            ("completed", "Completed"),
            ("withdrawn", "Withdrawn"),
        ],
        default="enrolled",
        required=True,
    )
    progress = fields.Float(default=0)
    final_grade = fields.Char()

    _sql_constraints = [
        (
            "course_enrollment_unique",
            "unique(program_enrollment_id, course_id)",
            "The course is already included in this program enrollment.",
        ),
    ]

    @api.constrains("progress")
    def _check_progress(self):
        for enrollment in self:
            if enrollment.progress < 0 or enrollment.progress > 100:
                raise ValidationError("Course progress must be between 0 and 100 percent.")
