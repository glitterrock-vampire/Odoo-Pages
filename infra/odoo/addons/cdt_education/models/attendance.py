from datetime import timedelta

from odoo import api, fields, models
from odoo.exceptions import ValidationError


class StudentAttendance(models.Model):
    _name = "cdt.student.attendance"
    _description = "Student Attendance"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "date desc, student_id"
    _rec_name = "student_id"

    student_id = fields.Many2one(
        "cdt.student", required=True, ondelete="cascade", tracking=True
    )
    date = fields.Date(required=True, default=fields.Date.context_today, tracking=True)
    student_group_id = fields.Many2one(
        "cdt.student.group", required=True, ondelete="restrict"
    )
    schedule_id = fields.Many2one("cdt.course.schedule", ondelete="cascade")
    course_id = fields.Many2one(related="schedule_id.course_id", store=True)
    status = fields.Selection(
        [
            ("present", "Present"),
            ("absent", "Absent"),
            ("leave", "Leave"),
            ("excused", "Excused"),
        ],
        default="present",
        required=True,
        tracking=True,
    )
    check_in = fields.Datetime()
    check_out = fields.Datetime()
    remarks = fields.Char()
    leave_id = fields.Many2one("cdt.student.leave", ondelete="set null")

    @api.constrains("student_id", "date", "student_group_id", "schedule_id")
    def _check_duplicate(self):
        for attendance in self:
            domain = [
                ("id", "!=", attendance.id),
                ("student_id", "=", attendance.student_id.id),
                ("date", "=", attendance.date),
                ("student_group_id", "=", attendance.student_group_id.id),
                ("schedule_id", "=", attendance.schedule_id.id or False),
            ]
            if self.search_count(domain):
                raise ValidationError(
                    "Attendance has already been recorded for this student and class."
                )

    @api.constrains("date")
    def _check_freeze_date(self):
        institution = self.env["cdt.education.institution"].search([], limit=1)
        if not institution.attendance_freeze_date:
            return
        for attendance in self:
            if attendance.date <= institution.attendance_freeze_date:
                raise ValidationError(
                    "Attendance on or before the configured freeze date is locked."
                )


class StudentLeave(models.Model):
    _name = "cdt.student.leave"
    _description = "Student Leave Application"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "date_from desc, id desc"

    name = fields.Char(required=True, copy=False, default="New")
    student_id = fields.Many2one(
        "cdt.student", required=True, ondelete="cascade", tracking=True
    )
    date_from = fields.Date(required=True)
    date_to = fields.Date(required=True)
    student_group_id = fields.Many2one("cdt.student.group")
    reason = fields.Text(required=True)
    supporting_document_id = fields.Many2one("ir.attachment")
    mark_present = fields.Boolean(
        string="Mark Present",
        help="Use when the student is representing the institution at an approved activity.",
    )
    state = fields.Selection(
        [
            ("draft", "Draft"),
            ("submitted", "Submitted"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("cancelled", "Cancelled"),
        ],
        default="draft",
        required=True,
        tracking=True,
    )
    attendance_ids = fields.One2many("cdt.student.attendance", "leave_id")

    _sql_constraints = [
        (
            "leave_number_unique",
            "unique(name)",
            "The leave application number must be unique.",
        ),
    ]

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if values.get("name", "New") == "New":
                values["name"] = self.env["ir.sequence"].next_by_code(
                    "cdt.student.leave"
                ) or "New"
        return super().create(values_list)

    @api.constrains("date_from", "date_to")
    def _check_dates(self):
        for leave in self:
            if leave.date_to < leave.date_from:
                raise ValidationError("The leave end date must follow its start date.")

    def action_submit(self):
        self.write({"state": "submitted"})

    def action_approve(self):
        for leave in self:
            group = leave.student_group_id
            if not group:
                membership = self.env["cdt.student.group.member"].search(
                    [("student_id", "=", leave.student_id.id), ("active", "=", True)],
                    limit=1,
                )
                group = membership.group_id
            if not group:
                raise ValidationError(
                    "Select a student group before approving this leave application."
                )
            date_cursor = leave.date_from
            while date_cursor <= leave.date_to:
                existing = self.env["cdt.student.attendance"].search(
                    [
                        ("student_id", "=", leave.student_id.id),
                        ("student_group_id", "=", group.id),
                        ("date", "=", date_cursor),
                        ("schedule_id", "=", False),
                    ],
                    limit=1,
                )
                values = {
                    "status": "present" if leave.mark_present else "leave",
                    "leave_id": leave.id,
                    "remarks": leave.reason,
                }
                if existing:
                    existing.write(values)
                else:
                    self.env["cdt.student.attendance"].create(
                        {
                            "student_id": leave.student_id.id,
                            "student_group_id": group.id,
                            "date": date_cursor,
                            **values,
                        }
                    )
                date_cursor += timedelta(days=1)
            leave.write({"state": "approved", "student_group_id": group.id})

    def action_reject(self):
        self.write({"state": "rejected"})

    def action_cancel(self):
        self.mapped("attendance_ids").unlink()
        self.write({"state": "cancelled"})


class AttendanceBulkWizard(models.TransientModel):
    _name = "cdt.attendance.bulk.wizard"
    _description = "Bulk Attendance Tool"

    student_group_id = fields.Many2one(
        "cdt.student.group", required=True, ondelete="cascade"
    )
    date = fields.Date(required=True, default=fields.Date.context_today)
    schedule_id = fields.Many2one("cdt.course.schedule")
    default_status = fields.Selection(
        [
            ("present", "Present"),
            ("absent", "Absent"),
            ("leave", "Leave"),
            ("excused", "Excused"),
        ],
        default="present",
        required=True,
    )

    def action_mark_attendance(self):
        self.ensure_one()
        Attendance = self.env["cdt.student.attendance"]
        members = self.student_group_id.member_line_ids.filtered("active")
        if not members:
            raise ValidationError("The selected student group has no active members.")
        for member in members:
            domain = [
                ("student_id", "=", member.student_id.id),
                ("student_group_id", "=", self.student_group_id.id),
                ("date", "=", self.date),
                ("schedule_id", "=", self.schedule_id.id or False),
            ]
            attendance = Attendance.search(domain, limit=1)
            values = {"status": self.default_status}
            if attendance:
                attendance.write(values)
            else:
                Attendance.create(
                    {
                        "student_id": member.student_id.id,
                        "student_group_id": self.student_group_id.id,
                        "date": self.date,
                        "schedule_id": self.schedule_id.id,
                        **values,
                    }
                )
        return {"type": "ir.actions.act_window_close"}
