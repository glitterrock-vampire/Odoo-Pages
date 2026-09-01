from odoo import api, fields, models


class EducationStudent(models.Model):
    _name = "cdt.student"
    _description = "Student"
    _inherit = ["mail.thread", "mail.activity.mixin", "portal.mixin"]
    _rec_name = "full_name"
    _order = "full_name"

    name = fields.Char(
        string="Student Number", required=True, copy=False, default="New", index=True
    )
    legacy_id = fields.Char(index=True, copy=False)
    first_name = fields.Char(required=True, tracking=True)
    middle_name = fields.Char()
    last_name = fields.Char(required=True, tracking=True)
    full_name = fields.Char(compute="_compute_full_name", store=True, index=True)
    partner_id = fields.Many2one(
        "res.partner", required=True, ondelete="restrict", tracking=True
    )
    portal_user_id = fields.Many2one("res.users", string="Portal User")
    image = fields.Image(related="partner_id.image_1920", readonly=False)
    email = fields.Char(related="partner_id.email", readonly=False, store=True)
    phone = fields.Char(related="partner_id.phone", readonly=False, store=True)
    mobile = fields.Char(related="partner_id.mobile", readonly=False, store=True)
    street = fields.Char(related="partner_id.street", readonly=False, store=True)
    city = fields.Char(related="partner_id.city", readonly=False, store=True)
    country_id = fields.Many2one(
        related="partner_id.country_id", readonly=False, store=True
    )
    date_of_birth = fields.Date(tracking=True)
    gender = fields.Selection(
        [
            ("female", "Female"),
            ("male", "Male"),
            ("non_binary", "Non-binary"),
            ("not_stated", "Prefer not to say"),
        ]
    )
    blood_group = fields.Selection(
        [
            ("a+", "A+"),
            ("a-", "A-"),
            ("b+", "B+"),
            ("b-", "B-"),
            ("ab+", "AB+"),
            ("ab-", "AB-"),
            ("o+", "O+"),
            ("o-", "O-"),
        ]
    )
    joining_date = fields.Date(default=fields.Date.context_today, tracking=True)
    leaving_date = fields.Date()
    status = fields.Selection(
        [
            ("applicant", "Applicant"),
            ("active", "Active"),
            ("graduated", "Graduated"),
            ("left", "Left"),
            ("suspended", "Suspended"),
        ],
        default="active",
        required=True,
        tracking=True,
    )
    category_id = fields.Many2one("cdt.student.category")
    batch_id = fields.Many2one("cdt.student.batch")
    house_id = fields.Many2one("cdt.student.house")
    current_program_id = fields.Many2one("cdt.program")
    guardian_line_ids = fields.One2many(
        "cdt.student.guardian", "student_id", string="Guardians"
    )
    sibling_ids = fields.Many2many(
        "cdt.student",
        "cdt_student_sibling_rel",
        "student_id",
        "sibling_id",
        string="Siblings",
    )
    enrollment_ids = fields.One2many("cdt.program.enrollment", "student_id")
    attendance_ids = fields.One2many("cdt.student.attendance", "student_id")
    result_ids = fields.One2many("cdt.assessment.result", "student_id")
    fee_ids = fields.One2many("cdt.student.fee", "student_id")
    log_ids = fields.One2many("cdt.student.log", "student_id")
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("student_number_unique", "unique(name)", "The student number must be unique."),
        (
            "legacy_id_unique",
            "unique(legacy_id)",
            "The legacy student identifier must be unique.",
        ),
    ]

    @api.depends("first_name", "middle_name", "last_name")
    def _compute_full_name(self):
        for student in self:
            student.full_name = " ".join(
                part
                for part in (student.first_name, student.middle_name, student.last_name)
                if part
            )

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if values.get("name", "New") == "New":
                values["name"] = self.env["ir.sequence"].next_by_code(
                    "cdt.student"
                ) or "New"
            if not values.get("partner_id"):
                full_name = " ".join(
                    part
                    for part in (
                        values.get("first_name"),
                        values.get("middle_name"),
                        values.get("last_name"),
                    )
                    if part
                )
                partner = self.env["res.partner"].create(
                    {
                        "name": full_name,
                        "email": values.pop("email", False),
                        "phone": values.pop("phone", False),
                        "is_company": False,
                    }
                )
                values["partner_id"] = partner.id
        return super().create(values_list)

    def write(self, values):
        result = super().write(values)
        if {"first_name", "middle_name", "last_name"}.intersection(values):
            for student in self:
                student.partner_id.name = student.full_name
        return result

    def action_graduate(self):
        self.write({"status": "graduated"})

    def action_mark_left(self):
        self.write({"status": "left", "leaving_date": fields.Date.context_today(self)})


class EducationGuardian(models.Model):
    _name = "cdt.guardian"
    _description = "Guardian"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _rec_name = "partner_id"
    _order = "partner_id"

    partner_id = fields.Many2one(
        "res.partner", required=True, ondelete="restrict", tracking=True
    )
    email = fields.Char(related="partner_id.email", readonly=False, store=True)
    phone = fields.Char(related="partner_id.phone", readonly=False, store=True)
    mobile = fields.Char(related="partner_id.mobile", readonly=False, store=True)
    occupation = fields.Char()
    employer = fields.Char()
    student_line_ids = fields.One2many("cdt.student.guardian", "guardian_id")
    active = fields.Boolean(default=True)


class StudentGuardian(models.Model):
    _name = "cdt.student.guardian"
    _description = "Student Guardian Relationship"
    _order = "emergency_contact desc, id"

    student_id = fields.Many2one("cdt.student", required=True, ondelete="cascade")
    guardian_id = fields.Many2one("cdt.guardian", required=True, ondelete="cascade")
    relationship = fields.Selection(
        [
            ("mother", "Mother"),
            ("father", "Father"),
            ("parent", "Parent"),
            ("grandparent", "Grandparent"),
            ("sibling", "Sibling"),
            ("other", "Other"),
        ],
        required=True,
        default="parent",
    )
    emergency_contact = fields.Boolean(default=False)
    receives_communications = fields.Boolean(default=True)
    pickup_authorised = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "student_guardian_unique",
            "unique(student_id, guardian_id)",
            "This guardian is already linked to the student.",
        ),
    ]


class EducationInstructor(models.Model):
    _name = "cdt.instructor"
    _description = "Instructor"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _rec_name = "partner_id"
    _order = "partner_id"

    name = fields.Char(
        string="Instructor Number", required=True, copy=False, default="New"
    )
    partner_id = fields.Many2one(
        "res.partner", required=True, ondelete="restrict", tracking=True
    )
    user_id = fields.Many2one("res.users", string="Odoo User")
    department_id = fields.Many2one("cdt.education.department")
    email = fields.Char(related="partner_id.email", readonly=False, store=True)
    phone = fields.Char(related="partner_id.phone", readonly=False, store=True)
    biography = fields.Html()
    qualification = fields.Char()
    course_ids = fields.Many2many("cdt.course", string="Courses")
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "instructor_number_unique",
            "unique(name)",
            "The instructor number must be unique.",
        ),
    ]

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if values.get("name", "New") == "New":
                values["name"] = self.env["ir.sequence"].next_by_code(
                    "cdt.instructor"
                ) or "New"
        return super().create(values_list)


class StudentLog(models.Model):
    _name = "cdt.student.log"
    _description = "Student Log"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "date desc, id desc"

    student_id = fields.Many2one("cdt.student", required=True, ondelete="cascade")
    date = fields.Datetime(required=True, default=fields.Datetime.now)
    log_type = fields.Selection(
        [
            ("academic", "Academic"),
            ("behaviour", "Behaviour"),
            ("health", "Health"),
            ("communication", "Communication"),
            ("achievement", "Achievement"),
            ("other", "Other"),
        ],
        default="academic",
        required=True,
    )
    title = fields.Char(required=True)
    details = fields.Html(required=True)
    confidential = fields.Boolean(default=False)
    author_id = fields.Many2one("res.users", default=lambda self: self.env.user)
