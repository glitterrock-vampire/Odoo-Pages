from datetime import date

from odoo.exceptions import ValidationError
from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestFamilyServices(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.year = cls.env["cdt.academic.year"].create(
            {
                "name": "Portal Service Test Year",
                "code": "PORTAL-SERVICE-YEAR",
                "date_start": date(2035, 1, 1),
                "date_end": date(2035, 12, 31),
            }
        )
        cls.department = cls.env["cdt.education.department"].create(
            {"name": "Portal Service Arts", "code": "PORTAL-SERVICE-ARTS"}
        )
        cls.course = cls.env["cdt.course"].create(
            {
                "name": "Portal Service Dance",
                "code": "PORTAL-SERVICE-DANCE",
                "department_id": cls.department.id,
            }
        )
        cls.program = cls.env["cdt.program"].create(
            {
                "name": "Portal Service Programme",
                "code": "PORTAL-SERVICE-PROGRAMME",
                "department_id": cls.department.id,
            }
        )
        cls.admission = cls.env["cdt.student.admission"].create(
            {
                "name": "Portal Service Admissions",
                "program_id": cls.program.id,
                "academic_year_id": cls.year.id,
                "application_start": date(2034, 9, 1),
                "application_end": date(2034, 12, 1),
                "capacity": 2,
            }
        )

    def _admit(self, first_name, email):
        applicant = self.env["cdt.student.applicant"].create(
            {
                "admission_id": self.admission.id,
                "first_name": first_name,
                "last_name": "Portal Test",
                "email": email,
                "guardian_name": "Portal Test Guardian",
                "guardian_email": "portal-service-guardian@example.test",
                "consent_given": True,
                "consent_date": "2034-09-01 10:00:00",
                "consent_notice_version": "test-v1",
            }
        )
        applicant.action_schedule_audition()
        applicant.action_approve()
        applicant.action_offer()
        applicant.action_accept_offer()
        applicant.action_admit()
        return applicant

    def test_offer_admission_reuses_guardian_and_tracks_capacity(self):
        first = self._admit("First", "first.portal@example.test")
        second = self._admit("Second", "second.portal@example.test")

        self.assertEqual(first.state, "admitted")
        self.assertEqual(second.state, "admitted")
        self.assertEqual(self.admission.admitted_count, 2)
        self.assertEqual(self.admission.remaining_capacity, 0)
        guardian_partners = self.env["res.partner"].search(
            [("email", "=ilike", "portal-service-guardian@example.test")]
        )
        self.assertEqual(len(guardian_partners), 1)

        overflow = self.env["cdt.student.applicant"].create(
            {
                "admission_id": self.admission.id,
                "first_name": "Overflow",
                "last_name": "Portal Test",
            }
        )
        overflow.action_approve()
        with self.assertRaises(ValidationError):
            overflow.action_admit()

    def test_consent_document_and_late_notification(self):
        applicant = self._admit("Family", "family.portal@example.test")
        student = applicant.student_id
        guardian = student.guardian_line_ids.guardian_id

        consent = self.env["cdt.guardian.consent"].create(
            {
                "student_id": student.id,
                "guardian_id": guardian.id,
                "consent_type": "media",
                "decision": "granted",
                "signature_name": guardian.partner_id.name,
                "source": "portal",
            }
        )
        self.assertTrue(consent.name.startswith("CNS-"))

        attachment = self.env["ir.attachment"].create(
            {
                "name": "student-note.pdf",
                "datas": "dGVzdA==",
                "mimetype": "application/pdf",
                "res_model": "cdt.student",
                "res_id": student.id,
            }
        )
        document = self.env["cdt.student.document"].create(
            {
                "name": attachment.name,
                "student_id": student.id,
                "guardian_id": guardian.id,
                "category": "medical",
                "attachment_id": attachment.id,
            }
        )
        document.verified = True
        self.assertEqual(document.verified_by_id, self.env.user)
        self.assertTrue(document.verified_at)

        group = self.env["cdt.student.group"].create(
            {
                "name": "Portal Test Group",
                "program_id": self.program.id,
                "academic_year_id": self.year.id,
                "course_id": self.course.id,
                "member_line_ids": [(0, 0, {"student_id": student.id})],
            }
        )
        with self.assertRaises(ValidationError):
            self.env["cdt.student.attendance"].create(
                {
                    "student_id": student.id,
                    "student_group_id": group.id,
                    "date": date(2035, 2, 1),
                    "status": "present",
                    "minutes_late": 5,
                }
            )
        attendance = self.env["cdt.student.attendance"].create(
            {
                "student_id": student.id,
                "student_group_id": group.id,
                "date": date(2035, 2, 1),
                "status": "late",
                "minutes_late": 5,
            }
        )
        attendance.action_queue_guardian_notification()
        self.assertTrue(attendance.guardian_notification_queued_at)
        queued = self.env["mail.mail"].search(
            [("subject", "=", f"Attendance update for {student.full_name}")]
        )
        self.assertEqual(len(queued), 1)
        self.assertIn(guardian.email, queued.email_to)
