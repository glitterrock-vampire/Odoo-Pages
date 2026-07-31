from odoo import api, fields, models
from odoo.exceptions import ValidationError


class EducationInstitution(models.Model):
    _name = "cdt.education.institution"
    _description = "Education Institution"
    _inherit = ["mail.thread", "mail.activity.mixin"]

    name = fields.Char(required=True, tracking=True)
    code = fields.Char(required=True, tracking=True)
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        ondelete="restrict",
    )
    partner_id = fields.Many2one("res.partner", string="Institution Contact")
    current_academic_year_id = fields.Many2one(
        "cdt.academic.year", string="Current Academic Year", tracking=True
    )
    current_academic_term_id = fields.Many2one(
        "cdt.academic.term", string="Current Academic Term", tracking=True
    )
    attendance_freeze_date = fields.Date(
        help="Attendance dated on or before this date is locked."
    )
    logo = fields.Image(max_width=512, max_height=512)
    portal_enabled = fields.Boolean(default=True)
    attendance_by_schedule = fields.Boolean(default=True)
    attendance_notifications_enabled = fields.Boolean(
        default=False,
        help="Queue parent/guardian email notifications for absent or late students.",
    )
    automatic_fee_reminders_enabled = fields.Boolean(
        string="Automatic Fee Reminders",
        default=False,
        help="Queue overdue tuition reminders during the daily scheduler. "
        "Messages are added to Odoo's outgoing mail queue and are never force-sent.",
    )
    fee_reminder_delay_days = fields.Integer(
        string="First Reminder After",
        default=7,
        help="Number of days after the due date before the first automatic reminder is queued.",
    )
    fee_reminder_repeat_days = fields.Integer(
        string="Repeat Reminder Every",
        default=7,
        help="Minimum number of days between automatic reminders for the same fee.",
    )
    fee_reminder_template_id = fields.Many2one(
        "mail.template",
        string="Fee Reminder Template",
        domain=[("model", "=", "cdt.student.fee")],
        help="Optional custom template. The standard CDT tuition reminder is used when empty.",
    )
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("code_unique", "unique(code)", "The institution code must be unique."),
    ]

    @api.constrains("current_academic_year_id", "current_academic_term_id")
    def _check_current_term(self):
        for institution in self:
            term = institution.current_academic_term_id
            if (
                term
                and institution.current_academic_year_id
                and term.academic_year_id != institution.current_academic_year_id
            ):
                raise ValidationError(
                    "The current academic term must belong to the current academic year."
                )

    @api.constrains("fee_reminder_delay_days", "fee_reminder_repeat_days")
    def _check_fee_reminder_days(self):
        for institution in self:
            if institution.fee_reminder_delay_days < 0:
                raise ValidationError("The first reminder delay cannot be negative.")
            if institution.fee_reminder_repeat_days < 1:
                raise ValidationError("Reminder repetition must be at least one day.")


class AcademicYear(models.Model):
    _name = "cdt.academic.year"
    _description = "Academic Year"
    _order = "date_start desc"

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    date_start = fields.Date(required=True)
    date_end = fields.Date(required=True)
    term_ids = fields.One2many("cdt.academic.term", "academic_year_id")
    state = fields.Selection(
        [("draft", "Draft"), ("current", "Current"), ("closed", "Closed")],
        default="draft",
        required=True,
    )
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("code_unique", "unique(code)", "The academic year code must be unique."),
    ]

    @api.constrains("date_start", "date_end")
    def _check_dates(self):
        for record in self:
            if record.date_start and record.date_end and record.date_end < record.date_start:
                raise ValidationError("The academic year end date must follow its start date.")

    def action_set_current(self):
        for record in self:
            self.search([("id", "!=", record.id), ("state", "=", "current")]).write(
                {"state": "closed"}
            )
            record.state = "current"
            institutions = self.env["cdt.education.institution"].search([])
            institutions.write({"current_academic_year_id": record.id})

    def action_close(self):
        self.write({"state": "closed"})


class AcademicTerm(models.Model):
    _name = "cdt.academic.term"
    _description = "Academic Term"
    _order = "date_start desc"

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    academic_year_id = fields.Many2one(
        "cdt.academic.year", required=True, ondelete="cascade"
    )
    date_start = fields.Date(required=True)
    date_end = fields.Date(required=True)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "term_code_unique",
            "unique(code, academic_year_id)",
            "The term code must be unique within an academic year.",
        ),
    ]

    @api.constrains("date_start", "date_end", "academic_year_id")
    def _check_dates(self):
        for record in self:
            if record.date_start and record.date_end and record.date_end < record.date_start:
                raise ValidationError("The academic term end date must follow its start date.")
            year = record.academic_year_id
            if year and (
                record.date_start < year.date_start or record.date_end > year.date_end
            ):
                raise ValidationError("The academic term must fall inside its academic year.")


class EducationDepartment(models.Model):
    _name = "cdt.education.department"
    _description = "Education Department"
    _order = "name"

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    manager_id = fields.Many2one("res.users")
    description = fields.Text()
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("department_code_unique", "unique(code)", "The department code must be unique."),
    ]


class EducationRoom(models.Model):
    _name = "cdt.education.room"
    _description = "Classroom or Venue"
    _order = "name"

    name = fields.Char(required=True)
    room_number = fields.Char()
    building = fields.Char()
    capacity = fields.Integer(default=1, required=True)
    location = fields.Char()
    notes = fields.Text()
    active = fields.Boolean(default=True)

    @api.constrains("capacity")
    def _check_capacity(self):
        for room in self:
            if room.capacity < 1:
                raise ValidationError("Room capacity must be at least one.")


class StudentCategory(models.Model):
    _name = "cdt.student.category"
    _description = "Student Category"
    _order = "name"

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    description = fields.Text()
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("category_code_unique", "unique(code)", "The student category code must be unique."),
    ]


class StudentBatch(models.Model):
    _name = "cdt.student.batch"
    _description = "Student Batch"
    _order = "name"

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    academic_year_id = fields.Many2one("cdt.academic.year")
    description = fields.Text()
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("batch_code_unique", "unique(code)", "The student batch code must be unique."),
    ]


class StudentHouse(models.Model):
    _name = "cdt.student.house"
    _description = "Student House"
    _order = "name"

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    colour = fields.Integer(default=0)
    description = fields.Text()
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("house_code_unique", "unique(code)", "The student house code must be unique."),
    ]
