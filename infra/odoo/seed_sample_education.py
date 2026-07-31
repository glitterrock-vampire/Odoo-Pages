"""Idempotent local CDT education sample data.

Run with:
  docker compose -f infra/odoo/compose.yaml exec -T web \
    odoo shell -d cdt_jamaica --no-http \
    --db_host=db --db_port=5432 --db_user=odoo --db_password=odoo_local_dev \
    < infra/odoo/seed_sample_education.py

The script creates exactly three sample students from existing Sanity-synced
contacts and links them to one class, programme enrollment, and tuition fee.
"""

from datetime import date, datetime, timedelta


STUDENT_CONTACTS = [
    {
        "name": "Andrew Bailey",
        "ref": "sanity:sbvvl9vs:production:dancer:A4Y0Z7BaeLULYQlAsULI3x",
        "document_id": "A4Y0Z7BaeLULYQlAsULI3x",
        "payment_target": 0,
    },
    {
        "name": "Abigail Berry",
        "ref": "sanity:sbvvl9vs:production:dancer:maVOxMM17f3txmd5go96aR",
        "document_id": "maVOxMM17f3txmd5go96aR",
        "payment_target": 15000,
    },
    {
        "name": "Joel Brown",
        "ref": "sanity:sbvvl9vs:production:dancer:maVOxMM17f3txmd5go96w7",
        "document_id": "maVOxMM17f3txmd5go96w7",
        "payment_target": 30000,
    },
]


def exactly_one(model, domain, label):
    records = model.search(domain, limit=2)
    if len(records) != 1:
        raise RuntimeError(f"Expected exactly one {label}; found {len(records)}")
    return records


def one_or_create(model, domain, values, label):
    records = model.search(domain, limit=2)
    if len(records) > 1:
        raise RuntimeError(f"Expected at most one {label}; found {len(records)}")
    return records or model.create(values)


partners = []
for contact in STUDENT_CONTACTS:
    partner = exactly_one(
        env["res.partner"],
        [("ref", "=", contact["ref"]), ("active", "=", True)],
        f"contact {contact['name']}",
    )
    if partner.name != contact["name"]:
        raise RuntimeError(
            f"Contact ref {contact['ref']} belongs to {partner.name}, not {contact['name']}"
        )
    partners.append(partner)

year = one_or_create(
    env["cdt.academic.year"],
    [("code", "=", "DEMO-2026-27")],
    {
        "name": "2026–2027 Sample Academic Year",
        "code": "DEMO-2026-27",
        "date_start": date(2026, 9, 1),
        "date_end": date(2027, 8, 31),
        "state": "current",
    },
    "sample academic year",
)
term = one_or_create(
    env["cdt.academic.term"],
    [("code", "=", "DEMO-T1"), ("academic_year_id", "=", year.id)],
    {
        "name": "Sample Term 1",
        "code": "DEMO-T1",
        "academic_year_id": year.id,
        "date_start": date(2026, 9, 1),
        "date_end": date(2026, 12, 18),
    },
    "sample academic term",
)
department = one_or_create(
    env["cdt.education.department"],
    [("code", "=", "DEMO-DANCE")],
    {"name": "Sample Dance Education", "code": "DEMO-DANCE"},
    "sample department",
)
course = one_or_create(
    env["cdt.course"],
    [("code", "=", "DEMO-DANCE-101")],
    {
        "name": "Dance Foundations",
        "code": "DEMO-DANCE-101",
        "department_id": department.id,
        "description": "Sample foundations class used to verify student, class, and tuition links.",
    },
    "sample course",
)
program = one_or_create(
    env["cdt.program"],
    [("code", "=", "DEMO-PERFORM")],
    {
        "name": "CDT Dance Foundations",
        "code": "DEMO-PERFORM",
        "department_id": department.id,
        "duration_terms": 1,
    },
    "sample programme",
)
one_or_create(
    env["cdt.program.course"],
    [("program_id", "=", program.id), ("course_id", "=", course.id)],
    {"program_id": program.id, "course_id": course.id, "required": True},
    "sample programme course",
)

instructor_partner = exactly_one(
    env["res.partner"],
    [("ref", "like", "sanity:%"), ("name", "=", "Terry Hall")],
    "sample instructor contact Terry Hall",
)
instructor = one_or_create(
    env["cdt.instructor"],
    [("partner_id", "=", instructor_partner.id)],
    {"partner_id": instructor_partner.id, "department_id": department.id},
    "sample instructor",
)
room = one_or_create(
    env["cdt.education.room"],
    [("name", "=", "Sample Studio A")],
    {
        "name": "Sample Studio A",
        "room_number": "DEMO-A",
        "building": "CDT Jamaica",
        "capacity": 12,
        "location": "Kingston",
    },
    "sample room",
)
offering_legacy_id = "demo:education:v1:offering:DEMO-DANCE-101:DEMO-2026-27:DEMO-T1"
offering = one_or_create(
    env["cdt.course.offering"],
    [("legacy_id", "=", offering_legacy_id)],
    {
        "legacy_id": offering_legacy_id,
        "course_id": course.id,
        "program_id": program.id,
        "academic_year_id": year.id,
        "academic_term_id": term.id,
        "instructor_ids": [(6, 0, instructor.ids)],
        "capacity": 12,
        "delivery_mode": "in_person",
        "state": "in_progress",
    },
    "sample course offering",
)
offering.write(
    {
        "course_id": course.id,
        "program_id": program.id,
        "academic_year_id": year.id,
        "academic_term_id": term.id,
        "instructor_ids": [(6, 0, instructor.ids)],
        "capacity": 12,
        "delivery_mode": "in_person",
        "state": "in_progress",
    }
)
group = one_or_create(
    env["cdt.student.group"],
    [
        ("name", "=", "[DEMO] Dance Foundations — 2026–27 Term 1"),
        ("academic_year_id", "=", year.id),
        ("academic_term_id", "=", term.id),
        ("offering_id", "=", offering.id),
    ],
    {
        "name": "[DEMO] Dance Foundations — 2026–27 Term 1",
        "group_type": "course",
        "program_id": program.id,
        "academic_year_id": year.id,
        "academic_term_id": term.id,
        "course_id": course.id,
        "offering_id": offering.id,
        "instructor_ids": [(6, 0, instructor.ids)],
        "capacity": 12,
    },
    "sample student group",
)

schedule_start = datetime(2026, 9, 7, 16, 0)
schedule = one_or_create(
    env["cdt.course.schedule"],
    [
        ("offering_id", "=", offering.id),
        ("start_datetime", "=", schedule_start),
    ],
    {
        "student_group_id": group.id,
        "offering_id": offering.id,
        "course_id": course.id,
        "instructor_id": instructor.id,
        "room_id": room.id,
        "start_datetime": schedule_start,
        "end_datetime": schedule_start + timedelta(hours=1, minutes=30),
        "state": "planned",
    },
    "sample class schedule",
)

fee_category = one_or_create(
    env["cdt.fee.category"],
    [("code", "=", "DEMO-TUITION")],
    {"name": "Sample Tuition", "code": "DEMO-TUITION"},
    "sample tuition category",
)
fee_structure = one_or_create(
    env["cdt.fee.structure"],
    [
        ("name", "=", "[DEMO] Dance Foundations Tuition — 2026–27 T1"),
        ("program_id", "=", program.id),
        ("academic_year_id", "=", year.id),
        ("academic_term_id", "=", term.id),
        ("company_id", "=", env.company.id),
    ],
    {
        "name": "[DEMO] Dance Foundations Tuition — 2026–27 T1",
        "program_id": program.id,
        "academic_year_id": year.id,
        "academic_term_id": term.id,
        "company_id": env.company.id,
    },
    "sample fee structure",
)
fee_line = one_or_create(
    env["cdt.fee.structure.line"],
    [("structure_id", "=", fee_structure.id), ("category_id", "=", fee_category.id)],
    {
        "structure_id": fee_structure.id,
        "category_id": fee_category.id,
        "description": "Term 1 Dance Foundations tuition",
        "amount": 30000,
    },
    "sample fee structure line",
)
fee_line.write({"amount": 30000, "discount_percent": 0})

students = env["cdt.student"]
for contact, partner in zip(STUDENT_CONTACTS, partners):
    student_legacy_id = f"demo:education:v1:student:{contact['document_id']}"
    student = env["cdt.student"].search([("legacy_id", "=", student_legacy_id)], limit=2)
    linked_student = env["cdt.student"].search([("partner_id", "=", partner.id)], limit=2)
    if len(student) > 1 or len(linked_student) > 1:
        raise RuntimeError(f"Duplicate student records found for contact {partner.name}")
    if linked_student and student and linked_student != student:
        raise RuntimeError(f"Contact {partner.name} is already linked to another student")
    if linked_student and not student and linked_student.legacy_id != student_legacy_id:
        raise RuntimeError(f"Contact {partner.name} is already a non-demo student")
    if not student:
        name_parts = partner.name.split()
        student = env["cdt.student"].create(
            {
                "legacy_id": student_legacy_id,
                "first_name": name_parts[0],
                "last_name": " ".join(name_parts[1:]) or "Student",
                "partner_id": partner.id,
                "joining_date": date(2026, 7, 30),
                "status": "active",
            }
        )
    student.write({"partner_id": partner.id, "status": "active", "active": True})
    students |= student

    enrollment_legacy_id = (
        f"demo:education:v1:enrollment:{contact['document_id']}:"
        "DEMO-PERFORM:DEMO-2026-27:DEMO-T1"
    )
    enrollment = one_or_create(
        env["cdt.program.enrollment"],
        [("legacy_id", "=", enrollment_legacy_id)],
        {
            "legacy_id": enrollment_legacy_id,
            "student_id": student.id,
            "program_id": program.id,
            "academic_year_id": year.id,
            "academic_term_id": term.id,
            "course_ids": [(6, 0, course.ids)],
            "fee_structure_id": fee_structure.id,
            "fees_due_date": date(2026, 8, 31),
        },
        f"sample enrollment for {partner.name}",
    )
    enrollment.write(
        {
            "course_ids": [(6, 0, course.ids)],
            "fee_structure_id": fee_structure.id,
            "fees_due_date": date(2026, 8, 31),
        }
    )
    if enrollment.state != "confirmed":
        enrollment.action_confirm()
    course_enrollment = exactly_one(
        env["cdt.course.enrollment"],
        [("program_enrollment_id", "=", enrollment.id), ("course_id", "=", course.id)],
        f"course enrollment for {partner.name}",
    )
    course_enrollment.write({"offering_id": offering.id, "status": "in_progress"})
    one_or_create(
        env["cdt.student.group.member"],
        [("group_id", "=", group.id), ("student_id", "=", student.id)],
        {"group_id": group.id, "student_id": student.id, "date_joined": date(2026, 7, 30)},
        f"class membership for {partner.name}",
    )

fee_schedule = one_or_create(
    env["cdt.fee.schedule"],
    [("name", "=", "DEMO-FEE-2026-27-T1-001")],
    {
        "name": "DEMO-FEE-2026-27-T1-001",
        "title": "Sample Term 1 Tuition",
        "fee_structure_id": fee_structure.id,
        "student_group_id": group.id,
        "posting_date": date(2026, 7, 30),
        "due_date": date(2026, 8, 31),
        "installment_number": 1,
    },
    "sample fee schedule",
)
fee_schedule.action_generate_fees()

journal = exactly_one(
    env["account.journal"],
    [("code", "=", "FEES"), ("company_id", "=", env.company.id)],
    "CDT Student Fee Payments journal",
)
manual_method = journal.inbound_payment_method_line_ids.filtered(
    lambda line: line.payment_method_id.code == "manual"
)[:1]
if not manual_method:
    raise RuntimeError("The fee journal has no inbound Manual Payment method")

for contact in STUDENT_CONTACTS:
    student = exactly_one(
        env["cdt.student"],
        [("legacy_id", "=", f"demo:education:v1:student:{contact['document_id']}")],
        f"sample student {contact['name']}",
    )
    fee = exactly_one(
        env["cdt.student.fee"],
        [("fee_schedule_id", "=", fee_schedule.id), ("student_id", "=", student.id)],
        f"sample tuition fee for {student.full_name}",
    )
    if fee.invoice_id and not fee.currency_id.is_zero(fee.invoice_id.amount_total - fee.amount):
        invoice = fee.invoice_id
        payments = invoice._get_reconciled_payments()
        invoice.line_ids.remove_move_reconcile()
        for payment in payments:
            if payment.state != "draft":
                payment.action_draft()
            payment.action_cancel()
        fee.invoice_id = False
        if invoice.state != "draft":
            invoice.button_draft()
        invoice.with_context(force_delete=True).unlink()
    if not fee.invoice_id:
        fee.action_create_invoice()
    if fee.invoice_id.state == "draft":
        fee.action_post_invoice()
    fee.invalidate_recordset()
    target = contact["payment_target"]
    payment_difference = target - fee.amount_paid
    if payment_difference > fee.currency_id.rounding:
        wizard = env["account.payment.register"].with_context(
            active_model="account.move",
            active_ids=fee.invoice_id.ids,
        ).create(
            {
                "journal_id": journal.id,
                "payment_method_line_id": manual_method.id,
                "payment_date": date(2026, 7, 30),
                "amount": payment_difference,
            }
        )
        wizard.action_create_payments()

env.flush_all()
env.cr.commit()

sample_fees = env["cdt.student.fee"].search(
    [("fee_schedule_id", "=", fee_schedule.id)], order="student_id"
)
print(
    {
        "students": [(student.id, student.full_name, student.partner_id.id) for student in students],
        "class": (offering.id, course.name, len(students)),
        "tuition": [
            (fee.student_id.full_name, fee.amount, fee.amount_paid, fee.balance, fee.state)
            for fee in sample_fees
        ],
        "schedule": schedule.name,
    }
)
