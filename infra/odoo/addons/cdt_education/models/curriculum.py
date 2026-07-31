from odoo import api, fields, models
from odoo.exceptions import ValidationError


class CourseTopic(models.Model):
    _name = "cdt.course.topic"
    _description = "Course Topic"
    _order = "name"

    name = fields.Char(required=True)
    code = fields.Char()
    description = fields.Html()
    active = fields.Boolean(default=True)


class EducationCourse(models.Model):
    _name = "cdt.course"
    _description = "Course"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "name"

    name = fields.Char(required=True, tracking=True)
    code = fields.Char(required=True, tracking=True)
    department_id = fields.Many2one("cdt.education.department")
    description = fields.Html()
    credit_hours = fields.Float(default=0)
    topic_ids = fields.Many2many("cdt.course.topic", string="Topics")
    assessment_criterion_ids = fields.Many2many(
        "cdt.assessment.criterion", string="Assessment Criteria"
    )
    default_grading_scale_id = fields.Many2one("cdt.grading.scale")
    instructor_ids = fields.Many2many("cdt.instructor", string="Instructors")
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("course_code_unique", "unique(code)", "The course code must be unique."),
    ]


class EducationProgram(models.Model):
    _name = "cdt.program"
    _description = "Education Program"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "name"

    name = fields.Char(required=True, tracking=True)
    code = fields.Char(required=True, tracking=True)
    department_id = fields.Many2one("cdt.education.department")
    description = fields.Html()
    duration_terms = fields.Integer(default=1)
    published = fields.Boolean(default=False)
    course_line_ids = fields.One2many("cdt.program.course", "program_id")
    course_count = fields.Integer(compute="_compute_course_count")
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("program_code_unique", "unique(code)", "The program code must be unique."),
    ]

    @api.depends("course_line_ids")
    def _compute_course_count(self):
        for program in self:
            program.course_count = len(program.course_line_ids)

    @api.constrains("duration_terms")
    def _check_duration(self):
        for program in self:
            if program.duration_terms < 1:
                raise ValidationError("Program duration must be at least one term.")


class ProgramCourse(models.Model):
    _name = "cdt.program.course"
    _description = "Program Course"
    _order = "recommended_term, sequence, id"

    program_id = fields.Many2one("cdt.program", required=True, ondelete="cascade")
    course_id = fields.Many2one("cdt.course", required=True, ondelete="restrict")
    required = fields.Boolean(default=True)
    recommended_term = fields.Integer(default=1)
    sequence = fields.Integer(default=10)

    _sql_constraints = [
        (
            "program_course_unique",
            "unique(program_id, course_id)",
            "A course can only appear once in a program.",
        ),
    ]


class CourseOffering(models.Model):
    _name = "cdt.course.offering"
    _description = "Course Offering"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "academic_year_id desc, academic_term_id desc, name"

    name = fields.Char(required=True, copy=False, default="New")
    legacy_id = fields.Char(index=True, copy=False)
    course_id = fields.Many2one("cdt.course", required=True, ondelete="restrict")
    program_id = fields.Many2one("cdt.program")
    academic_year_id = fields.Many2one("cdt.academic.year", required=True)
    academic_term_id = fields.Many2one("cdt.academic.term")
    instructor_ids = fields.Many2many("cdt.instructor", string="Instructors")
    capacity = fields.Integer(default=20)
    delivery_mode = fields.Selection(
        [("in_person", "In person"), ("online", "Online"), ("hybrid", "Hybrid")],
        default="in_person",
        required=True,
    )
    state = fields.Selection(
        [
            ("draft", "Draft"),
            ("open", "Open"),
            ("in_progress", "In Progress"),
            ("completed", "Completed"),
            ("cancelled", "Cancelled"),
        ],
        default="draft",
        required=True,
        tracking=True,
    )
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "offering_legacy_unique",
            "unique(legacy_id)",
            "The legacy class identifier must be unique.",
        ),
    ]

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if values.get("name", "New") == "New":
                values["name"] = self.env["ir.sequence"].next_by_code(
                    "cdt.course.offering"
                ) or "New"
        return super().create(values_list)

    @api.constrains("academic_year_id", "academic_term_id", "capacity")
    def _check_values(self):
        for offering in self:
            if offering.capacity < 1:
                raise ValidationError("Class capacity must be at least one.")
            if (
                offering.academic_term_id
                and offering.academic_term_id.academic_year_id
                != offering.academic_year_id
            ):
                raise ValidationError("The term must belong to the selected academic year.")


class StudentGroup(models.Model):
    _name = "cdt.student.group"
    _description = "Student Group"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "name"

    name = fields.Char(required=True, tracking=True)
    group_type = fields.Selection(
        [("batch", "Batch"), ("course", "Course"), ("activity", "Activity")],
        default="course",
        required=True,
    )
    program_id = fields.Many2one("cdt.program")
    academic_year_id = fields.Many2one("cdt.academic.year", required=True)
    academic_term_id = fields.Many2one("cdt.academic.term")
    batch_id = fields.Many2one("cdt.student.batch")
    course_id = fields.Many2one("cdt.course")
    offering_id = fields.Many2one("cdt.course.offering")
    instructor_ids = fields.Many2many("cdt.instructor", string="Instructors")
    member_line_ids = fields.One2many("cdt.student.group.member", "group_id")
    student_count = fields.Integer(compute="_compute_student_count", store=True)
    capacity = fields.Integer(default=20)
    active = fields.Boolean(default=True)

    @api.depends("member_line_ids", "member_line_ids.active")
    def _compute_student_count(self):
        for group in self:
            group.student_count = len(group.member_line_ids.filtered("active"))

    @api.constrains("capacity", "member_line_ids")
    def _check_capacity(self):
        for group in self:
            if group.capacity < 1:
                raise ValidationError("Group capacity must be at least one.")
            if len(group.member_line_ids.filtered("active")) > group.capacity:
                raise ValidationError("The student group has exceeded its capacity.")


class StudentGroupMember(models.Model):
    _name = "cdt.student.group.member"
    _description = "Student Group Member"
    _order = "student_id"

    group_id = fields.Many2one("cdt.student.group", required=True, ondelete="cascade")
    student_id = fields.Many2one("cdt.student", required=True, ondelete="cascade")
    date_joined = fields.Date(default=fields.Date.context_today)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "group_student_unique",
            "unique(group_id, student_id)",
            "The student is already in this group.",
        ),
    ]


class CourseSchedule(models.Model):
    _name = "cdt.course.schedule"
    _description = "Course Schedule"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "start_datetime desc"

    name = fields.Char(required=True, copy=False, default="New")
    student_group_id = fields.Many2one(
        "cdt.student.group", required=True, ondelete="restrict", tracking=True
    )
    offering_id = fields.Many2one("cdt.course.offering")
    course_id = fields.Many2one("cdt.course", required=True, ondelete="restrict")
    instructor_id = fields.Many2one(
        "cdt.instructor", required=True, ondelete="restrict"
    )
    room_id = fields.Many2one("cdt.education.room", ondelete="restrict")
    start_datetime = fields.Datetime(required=True, tracking=True)
    end_datetime = fields.Datetime(required=True, tracking=True)
    state = fields.Selection(
        [
            ("planned", "Planned"),
            ("completed", "Completed"),
            ("cancelled", "Cancelled"),
        ],
        default="planned",
        required=True,
        tracking=True,
    )
    notes = fields.Html()
    attendance_ids = fields.One2many("cdt.student.attendance", "schedule_id")
    attendance_count = fields.Integer(compute="_compute_attendance_count")

    @api.depends("attendance_ids")
    def _compute_attendance_count(self):
        for schedule in self:
            schedule.attendance_count = len(schedule.attendance_ids)

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if values.get("name", "New") == "New":
                values["name"] = self.env["ir.sequence"].next_by_code(
                    "cdt.course.schedule"
                ) or "New"
        return super().create(values_list)

    @api.constrains(
        "start_datetime",
        "end_datetime",
        "room_id",
        "instructor_id",
        "student_group_id",
        "state",
    )
    def _check_schedule(self):
        for schedule in self:
            if (
                schedule.start_datetime
                and schedule.end_datetime
                and schedule.end_datetime <= schedule.start_datetime
            ):
                raise ValidationError("The class end time must follow its start time.")
            if schedule.state == "cancelled":
                continue
            overlap_domain = [
                ("id", "!=", schedule.id),
                ("state", "!=", "cancelled"),
                ("start_datetime", "<", schedule.end_datetime),
                ("end_datetime", ">", schedule.start_datetime),
            ]
            resources = [
                ("instructor_id", schedule.instructor_id.id, "instructor"),
                ("student_group_id", schedule.student_group_id.id, "student group"),
            ]
            if schedule.room_id:
                resources.append(("room_id", schedule.room_id.id, "room"))
            for field_name, record_id, label in resources:
                if self.search(overlap_domain + [(field_name, "=", record_id)], limit=1):
                    raise ValidationError(
                        f"This time conflicts with another booking for the selected {label}."
                    )

    def action_complete(self):
        self.write({"state": "completed"})

    def action_cancel(self):
        self.write({"state": "cancelled"})


class InstructorLog(models.Model):
    _name = "cdt.instructor.log"
    _description = "Instructor Log"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "date desc, id desc"

    instructor_id = fields.Many2one("cdt.instructor", required=True)
    date = fields.Date(required=True, default=fields.Date.context_today)
    schedule_id = fields.Many2one("cdt.course.schedule")
    course_id = fields.Many2one("cdt.course", required=True)
    student_group_id = fields.Many2one("cdt.student.group")
    topic_id = fields.Many2one("cdt.course.topic")
    duration_hours = fields.Float(default=1)
    details = fields.Html(required=True)
