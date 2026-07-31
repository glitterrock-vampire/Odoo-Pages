from odoo import api, fields, models
from odoo.exceptions import ValidationError


class AssessmentCriterion(models.Model):
    _name = "cdt.assessment.criterion"
    _description = "Assessment Criterion"
    _order = "name"

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    description = fields.Text()
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "criterion_code_unique",
            "unique(code)",
            "The assessment criterion code must be unique.",
        ),
    ]


class AssessmentGroup(models.Model):
    _name = "cdt.assessment.group"
    _description = "Assessment Group"
    _order = "sequence, name"

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    parent_id = fields.Many2one("cdt.assessment.group", ondelete="cascade")
    child_ids = fields.One2many("cdt.assessment.group", "parent_id")
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "assessment_group_code_unique",
            "unique(code)",
            "The assessment group code must be unique.",
        ),
    ]


class GradingScale(models.Model):
    _name = "cdt.grading.scale"
    _description = "Grading Scale"
    _order = "name"

    name = fields.Char(required=True)
    description = fields.Text()
    line_ids = fields.One2many("cdt.grading.scale.line", "scale_id")
    active = fields.Boolean(default=True)


class GradingScaleLine(models.Model):
    _name = "cdt.grading.scale.line"
    _description = "Grading Scale Line"
    _order = "minimum_percentage desc"

    scale_id = fields.Many2one("cdt.grading.scale", required=True, ondelete="cascade")
    grade = fields.Char(required=True)
    minimum_percentage = fields.Float(required=True)
    maximum_percentage = fields.Float(required=True)
    description = fields.Char()
    passing_grade = fields.Boolean(default=True)

    @api.constrains("minimum_percentage", "maximum_percentage")
    def _check_range(self):
        for line in self:
            if (
                line.minimum_percentage < 0
                or line.maximum_percentage > 100
                or line.maximum_percentage < line.minimum_percentage
            ):
                raise ValidationError("Grade ranges must remain between 0 and 100 percent.")


class AssessmentPlan(models.Model):
    _name = "cdt.assessment.plan"
    _description = "Assessment Plan"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "assessment_date desc, id desc"

    name = fields.Char(required=True, copy=False, default="New")
    title = fields.Char(required=True, tracking=True)
    assessment_group_id = fields.Many2one("cdt.assessment.group", required=True)
    course_id = fields.Many2one("cdt.course", required=True, ondelete="restrict")
    student_group_id = fields.Many2one(
        "cdt.student.group", required=True, ondelete="restrict"
    )
    academic_year_id = fields.Many2one("cdt.academic.year", required=True)
    academic_term_id = fields.Many2one("cdt.academic.term")
    assessment_date = fields.Date(required=True)
    start_datetime = fields.Datetime()
    end_datetime = fields.Datetime()
    room_id = fields.Many2one("cdt.education.room")
    examiner_id = fields.Many2one("cdt.instructor")
    supervisor_id = fields.Many2one("cdt.instructor")
    maximum_score = fields.Float(default=100, required=True)
    grading_scale_id = fields.Many2one("cdt.grading.scale", required=True)
    criterion_ids = fields.Many2many("cdt.assessment.criterion")
    result_ids = fields.One2many("cdt.assessment.result", "plan_id")
    result_count = fields.Integer(compute="_compute_result_count")
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
    instructions = fields.Html()

    _sql_constraints = [
        (
            "assessment_plan_number_unique",
            "unique(name)",
            "The assessment plan number must be unique.",
        ),
    ]

    @api.depends("result_ids")
    def _compute_result_count(self):
        for plan in self:
            plan.result_count = len(plan.result_ids)

    @api.model_create_multi
    def create(self, values_list):
        for values in values_list:
            if values.get("name", "New") == "New":
                values["name"] = self.env["ir.sequence"].next_by_code(
                    "cdt.assessment.plan"
                ) or "New"
        return super().create(values_list)

    @api.onchange("course_id")
    def _onchange_course_id(self):
        if self.course_id:
            self.grading_scale_id = self.course_id.default_grading_scale_id
            self.criterion_ids = self.course_id.assessment_criterion_ids

    @api.constrains("maximum_score", "start_datetime", "end_datetime")
    def _check_values(self):
        for plan in self:
            if plan.maximum_score <= 0:
                raise ValidationError("Maximum score must be greater than zero.")
            if plan.start_datetime and plan.end_datetime and plan.end_datetime <= plan.start_datetime:
                raise ValidationError("Assessment end time must follow its start time.")

    def action_confirm(self):
        self.write({"state": "confirmed"})

    def action_populate_students(self):
        for plan in self:
            active_members = plan.student_group_id.member_line_ids.filtered("active")
            for member in active_members:
                result = plan.result_ids.filtered(
                    lambda item, member=member: item.student_id == member.student_id
                )
                if not result:
                    self.env["cdt.assessment.result"].create(
                        {"plan_id": plan.id, "student_id": member.student_id.id}
                    )

    def action_complete(self):
        self.write({"state": "completed"})


class AssessmentResult(models.Model):
    _name = "cdt.assessment.result"
    _description = "Assessment Result"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "plan_id desc, student_id"
    _rec_name = "student_id"

    plan_id = fields.Many2one(
        "cdt.assessment.plan", required=True, ondelete="cascade", tracking=True
    )
    student_id = fields.Many2one(
        "cdt.student", required=True, ondelete="cascade", tracking=True
    )
    course_id = fields.Many2one(related="plan_id.course_id", store=True)
    assessment_date = fields.Date(related="plan_id.assessment_date", store=True)
    maximum_score = fields.Float(related="plan_id.maximum_score", store=True)
    score = fields.Float(default=0, tracking=True)
    percentage = fields.Float(compute="_compute_grade", store=True)
    grade = fields.Char(compute="_compute_grade", store=True)
    passed = fields.Boolean(compute="_compute_grade", store=True)
    criterion_line_ids = fields.One2many(
        "cdt.assessment.result.criterion", "result_id"
    )
    remarks = fields.Text()
    published = fields.Boolean(default=False)

    _sql_constraints = [
        (
            "plan_student_unique",
            "unique(plan_id, student_id)",
            "A student can only have one result for an assessment plan.",
        ),
    ]

    @api.depends(
        "score",
        "maximum_score",
        "plan_id.grading_scale_id.line_ids.minimum_percentage",
        "plan_id.grading_scale_id.line_ids.maximum_percentage",
    )
    def _compute_grade(self):
        for result in self:
            percentage = (
                result.score / result.maximum_score * 100
                if result.maximum_score
                else 0
            )
            result.percentage = percentage
            scale_line = result.plan_id.grading_scale_id.line_ids.filtered(
                lambda line, percentage=percentage: line.minimum_percentage
                <= percentage
                <= line.maximum_percentage
            )[:1]
            result.grade = scale_line.grade if scale_line else False
            result.passed = scale_line.passing_grade if scale_line else False

    @api.constrains("score", "maximum_score")
    def _check_score(self):
        for result in self:
            if result.score < 0 or result.score > result.maximum_score:
                raise ValidationError("The score must be within the assessment maximum.")

    def action_publish(self):
        self.write({"published": True})


class AssessmentResultCriterion(models.Model):
    _name = "cdt.assessment.result.criterion"
    _description = "Assessment Result Criterion"

    result_id = fields.Many2one(
        "cdt.assessment.result", required=True, ondelete="cascade"
    )
    criterion_id = fields.Many2one(
        "cdt.assessment.criterion", required=True, ondelete="restrict"
    )
    maximum_score = fields.Float(default=0)
    score = fields.Float(default=0)
    remarks = fields.Char()

    _sql_constraints = [
        (
            "result_criterion_unique",
            "unique(result_id, criterion_id)",
            "An assessment criterion can only appear once in a result.",
        ),
    ]

    @api.constrains("score", "maximum_score")
    def _check_score(self):
        for line in self:
            if line.score < 0 or line.score > line.maximum_score:
                raise ValidationError("Criterion score must remain within its maximum.")
