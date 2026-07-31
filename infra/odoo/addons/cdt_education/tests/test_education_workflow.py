from datetime import date, datetime, timedelta

from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestEducationWorkflow(TransactionCase):
    def test_full_student_lifecycle(self):
        year = self.env["cdt.academic.year"].create(
            {
                "name": "Test Academic Year",
                "code": "TEST-YEAR",
                "date_start": date(2030, 1, 1),
                "date_end": date(2030, 12, 31),
            }
        )
        term = self.env["cdt.academic.term"].create(
            {
                "name": "Test Term",
                "code": "TEST-TERM",
                "academic_year_id": year.id,
                "date_start": date(2030, 1, 1),
                "date_end": date(2030, 4, 30),
            }
        )
        department = self.env["cdt.education.department"].create(
            {"name": "Test Arts", "code": "TEST-ARTS"}
        )
        course = self.env["cdt.course"].create(
            {
                "name": "Test Dance Foundations",
                "code": "TEST-DANCE-101",
                "department_id": department.id,
                "default_grading_scale_id": self.env.ref(
                    "cdt_education.grading_scale_standard"
                ).id,
            }
        )
        program = self.env["cdt.program"].create(
            {
                "name": "Test Performing Arts",
                "code": "TEST-PERFORM",
                "department_id": department.id,
                "course_line_ids": [
                    (0, 0, {"course_id": course.id, "required": True})
                ],
            }
        )
        admission = self.env["cdt.student.admission"].create(
            {
                "name": "Test 2030 Admissions",
                "program_id": program.id,
                "academic_year_id": year.id,
                "application_start": date(2029, 10, 1),
                "application_end": date(2029, 12, 1),
            }
        )
        applicant = self.env["cdt.student.applicant"].create(
            {
                "admission_id": admission.id,
                "first_name": "Test",
                "last_name": "Student",
                "email": "test.student@example.com",
                "guardian_name": "Test Guardian",
            }
        )
        applicant.action_approve()
        applicant.action_admit()
        student = applicant.student_id
        enrollment = applicant.enrollment_id
        enrollment.write({"academic_term_id": term.id})
        enrollment.action_confirm()

        instructor_partner = self.env["res.partner"].create(
            {"name": "Test Instructor"}
        )
        instructor = self.env["cdt.instructor"].create(
            {
                "partner_id": instructor_partner.id,
                "department_id": department.id,
                "course_ids": [(6, 0, [course.id])],
            }
        )
        room = self.env["cdt.education.room"].create(
            {"name": "Test Studio", "capacity": 20}
        )
        offering = self.env["cdt.course.offering"].create(
            {
                "course_id": course.id,
                "program_id": program.id,
                "academic_year_id": year.id,
                "academic_term_id": term.id,
                "instructor_ids": [(6, 0, [instructor.id])],
            }
        )
        group = self.env["cdt.student.group"].create(
            {
                "name": "Test Group",
                "program_id": program.id,
                "academic_year_id": year.id,
                "academic_term_id": term.id,
                "course_id": course.id,
                "offering_id": offering.id,
                "instructor_ids": [(6, 0, [instructor.id])],
                "member_line_ids": [(0, 0, {"student_id": student.id})],
            }
        )
        start = datetime(2030, 2, 1, 15, 0)
        schedule = self.env["cdt.course.schedule"].create(
            {
                "student_group_id": group.id,
                "offering_id": offering.id,
                "course_id": course.id,
                "instructor_id": instructor.id,
                "room_id": room.id,
                "start_datetime": start,
                "end_datetime": start + timedelta(hours=1),
            }
        )
        attendance = self.env["cdt.student.attendance"].create(
            {
                "student_id": student.id,
                "student_group_id": group.id,
                "schedule_id": schedule.id,
                "date": date(2030, 2, 1),
                "status": "present",
            }
        )

        plan = self.env["cdt.assessment.plan"].create(
            {
                "title": "Test Practical",
                "assessment_group_id": self.env.ref(
                    "cdt_education.assessment_group_exam"
                ).id,
                "course_id": course.id,
                "student_group_id": group.id,
                "academic_year_id": year.id,
                "academic_term_id": term.id,
                "assessment_date": date(2030, 3, 1),
                "maximum_score": 100,
                "grading_scale_id": self.env.ref(
                    "cdt_education.grading_scale_standard"
                ).id,
            }
        )
        plan.action_populate_students()
        result = plan.result_ids
        result.score = 85
        result.action_publish()

        fee_category = self.env["cdt.fee.category"].create(
            {"name": "Test Tuition", "code": "TEST-TUITION"}
        )
        fee_structure = self.env["cdt.fee.structure"].create(
            {
                "name": "Test Tuition Structure",
                "program_id": program.id,
                "academic_year_id": year.id,
                "academic_term_id": term.id,
                "line_ids": [
                    (0, 0, {"category_id": fee_category.id, "amount": 1000})
                ],
            }
        )
        fee_schedule = self.env["cdt.fee.schedule"].create(
            {
                "title": "Test Term Tuition",
                "fee_structure_id": fee_structure.id,
                "student_group_id": group.id,
                "posting_date": date(2030, 1, 1),
                "due_date": date(2030, 1, 31),
            }
        )
        fee_schedule.action_generate_fees()

        self.assertEqual(student.status, "active")
        self.assertEqual(enrollment.state, "confirmed")
        self.assertEqual(enrollment.course_enrollment_ids.course_id, course)
        self.assertEqual(group.student_count, 1)
        self.assertEqual(attendance.status, "present")
        self.assertEqual(result.grade, "A")
        self.assertTrue(result.published)
        self.assertEqual(fee_schedule.generated_count, 1)
        self.assertEqual(fee_schedule.student_fee_ids.amount, 1000)

        student_fee = fee_schedule.student_fee_ids
        student_fee.action_create_invoice()
        self.assertTrue(student_fee.invoice_id)
        self.assertEqual(student_fee.invoice_id.state, "draft")

        student_fee.action_post_invoice()
        self.assertEqual(student_fee.invoice_id.state, "posted")

        payment_action = student_fee.action_register_payment()
        self.assertEqual(payment_action["res_model"], "account.payment.register")
        self.assertEqual(payment_action["context"]["active_ids"], student_fee.invoice_id.ids)
