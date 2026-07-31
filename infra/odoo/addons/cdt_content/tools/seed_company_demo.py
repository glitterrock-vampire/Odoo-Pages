"""Idempotent, non-deliverable company-demo data for Events, Marketing and Education."""

from datetime import date, datetime


DEMO_TAG = "CDT company demo"


def _one(env, model, domain, values):
    record = env[model].search(domain, limit=1)
    if record:
        record.write(values)
        return record
    return env[model].create(values)


def run(env):
    websites = env["website"].search([])
    if websites:
        websites.write({"name": "CDT Jamaica"})
    env.company.write({"name": "CDT Jamaica"})

    program = env["cdt.program"].search([], limit=1)
    academic_year = env["cdt.academic.year"].search([], order="id desc", limit=1)
    if not program or not academic_year:
        raise RuntimeError("Run the education sample seed before the company demo seed.")

    admission = _one(
        env,
        "cdt.student.admission",
        [("name", "=", "2026–2027 Dance Programme Intake")],
        {
            "name": "2026–2027 Dance Programme Intake",
            "program_id": program.id,
            "academic_year_id": academic_year.id,
            "application_start": date(2026, 7, 1),
            "application_end": date(2027, 6, 30),
            "minimum_age": 6,
            "maximum_age": 18,
            "capacity": 24,
            "application_fee": 0,
            "introduction": "Applications are open for CDT Jamaica's 2026–2027 youth dance programme. Selected applicants will be invited to an introductory class or audition.",
            "published": True,
            "state": "open",
        },
    )
    for application_reference, first_name, last_name, guardian_name, state in (
        ("CDT-APP-DEMO-001", "Maya", "Grant", "Althea Grant", "approved"),
        ("CDT-APP-DEMO-002", "Noah", "Clarke", "Jerome Clarke", "applied"),
    ):
        _one(
            env,
            "cdt.student.applicant",
            [("name", "=", application_reference)],
            {
                "name": application_reference,
                "admission_id": admission.id,
                "first_name": first_name,
                "last_name": last_name,
                "email": "%s.%s@example.test" % (first_name.lower(), last_name.lower()),
                "guardian_name": guardian_name,
                "guardian_email": guardian_name.lower().replace(" ", ".") + "@example.test",
                "application_date": date(2026, 7, 29),
                "notes": "Safe sample application for the company demonstration.",
                "state": state,
            },
        )

    students = env["cdt.student"].search([], order="id", limit=3)
    student_group = env["cdt.student.group"].search([], order="id desc", limit=1)
    course = student_group.course_id or env["cdt.course"].search([], limit=1)
    if students and student_group:
        _one(
            env,
            "cdt.student.attendance",
            [
                ("student_id", "=", students[0].id),
                ("student_group_id", "=", student_group.id),
                ("date", "=", date(2026, 7, 23)),
                ("schedule_id", "=", False),
            ],
            {
                "student_id": students[0].id,
                "student_group_id": student_group.id,
                "date": date(2026, 7, 23),
                "status": "present",
                "remarks": "Safe sample attendance for the family portal demonstration.",
            },
        )

    if students and student_group and course:
        assessment_group = _one(
            env,
            "cdt.assessment.group",
            [("code", "=", "DEMO-TECH")],
            {"name": "Technique", "code": "DEMO-TECH", "sequence": 10},
        )
        grading_scale = _one(
            env,
            "cdt.grading.scale",
            [("name", "=", "CDT Demonstration Scale")],
            {"name": "CDT Demonstration Scale", "description": "Safe sample grading scale."},
        )
        for grade, minimum, maximum in (("A", 80, 100), ("B", 65, 79.99), ("C", 50, 64.99), ("Needs development", 0, 49.99)):
            _one(
                env,
                "cdt.grading.scale.line",
                [("scale_id", "=", grading_scale.id), ("grade", "=", grade)],
                {
                    "scale_id": grading_scale.id,
                    "grade": grade,
                    "minimum_percentage": minimum,
                    "maximum_percentage": maximum,
                    "passing_grade": minimum >= 50,
                },
            )
        assessment_plan = _one(
            env,
            "cdt.assessment.plan",
            [("name", "=", "DEMO-ASMT-001")],
            {
                "name": "DEMO-ASMT-001",
                "title": "Mid-term technique review",
                "assessment_group_id": assessment_group.id,
                "course_id": course.id,
                "student_group_id": student_group.id,
                "academic_year_id": academic_year.id,
                "academic_term_id": student_group.academic_term_id.id,
                "assessment_date": date(2026, 7, 24),
                "maximum_score": 100,
                "grading_scale_id": grading_scale.id,
                "state": "completed",
            },
        )
        _one(
            env,
            "cdt.assessment.result",
            [("plan_id", "=", assessment_plan.id), ("student_id", "=", students[0].id)],
            {
                "plan_id": assessment_plan.id,
                "student_id": students[0].id,
                "score": 88,
                "remarks": "Strong musicality and consistent technique.",
                "published": True,
            },
        )

    guardian_specs = [
        ("Marcia Bailey", "marcia.bailey@example.test"),
        ("Devon Berry", "devon.berry@example.test"),
        ("Simone Brown", "simone.brown@example.test"),
    ]
    guardians = env["cdt.guardian"]
    for student, (guardian_name, guardian_email) in zip(students, guardian_specs):
        partner = _one(
            env,
            "res.partner",
            [("email", "=", guardian_email)],
            {
                "name": guardian_name,
                "email": guardian_email,
                "phone": "+1 876 555 01%02d" % student.id,
            },
        )
        guardian = _one(
            env,
            "cdt.guardian",
            [("partner_id", "=", partner.id)],
            {"partner_id": partner.id, "occupation": "CDT demo guardian"},
        )
        _one(
            env,
            "cdt.student.guardian",
            [("student_id", "=", student.id), ("guardian_id", "=", guardian.id)],
            {
                "student_id": student.id,
                "guardian_id": guardian.id,
                "relationship": "parent",
                "emergency_contact": True,
                "receives_communications": True,
            },
        )
        guardians |= guardian

    portal_partner = guardians[:1].partner_id
    portal_user = env["res.users"].with_context(no_reset_password=True).search(
        [("login", "=", "parent.demo@cdt.test")], limit=1
    )
    portal_values = {
        "name": "CDT Parent Demo",
        "login": "parent.demo@cdt.test",
        "partner_id": portal_partner.id,
        "groups_id": [(6, 0, [env.ref("base.group_portal").id])],
        "active": True,
    }
    if portal_user:
        portal_user.with_context(no_reset_password=True).write(portal_values)
    else:
        portal_user = env["res.users"].with_context(no_reset_password=True).create(portal_values)
    portal_user.password = "CDT-Parent-Demo-2026!"

    performance = _one(
        env,
        "cdt.performance",
        [("title", "=", "CDT Family Dance Showcase 2026")],
        {
            "title": "CDT Family Dance Showcase 2026",
            "slug": "cdt-family-dance-showcase-2026",
            "date": date(2026, 12, 12),
            "time": "7:00 PM",
            "venue": "The Little Theatre",
            "location": "Kingston, Jamaica",
            "description": "A company-ready demonstration of CDT performances, family invitations, ticket tiers, attendee check-in and revenue reporting.",
            "category": "Season performance",
            "ticket_price": 3500,
            "capacity": 180,
            "featured": True,
            "status": "upcoming",
        },
    )
    performance.action_sync_event()
    event = performance.event_id
    if "is_published" in event._fields:
        event.is_published = True

    tier_specs = [
        ("General Admission", 3500, 120),
        ("Patron Circle", 6000, 40),
        ("Student", 2000, 20),
    ]
    tickets = env["event.event.ticket"]
    for tier_name, tier_price, seats_max in tier_specs:
        product = env["product.product"].search(
            [("default_code", "=", "CDT-EVENT-%s" % tier_name.upper().replace(" ", "-"))],
            limit=1,
        )
        product_values = {
            "name": "CDT Showcase — %s" % tier_name,
            "default_code": "CDT-EVENT-%s" % tier_name.upper().replace(" ", "-"),
            "type": "service",
            "list_price": tier_price,
            "sale_ok": True,
        }
        if "service_tracking" in env["product.product"]._fields:
            product_values["service_tracking"] = "event"
        if product:
            product.write(product_values)
        else:
            product = env["product.product"].create(product_values)
        ticket = _one(
            env,
            "event.event.ticket",
            [("event_id", "=", event.id), ("name", "=", tier_name)],
            {
                "name": tier_name,
                "event_id": event.id,
                "product_id": product.id,
                "price": tier_price,
                "seats_max": seats_max,
            },
        )
        tickets |= ticket

    attendee_specs = [
        ("Nia Campbell", "nia.campbell@example.test", "General Admission", "done"),
        ("Owen Davis", "owen.davis@example.test", "General Admission", "open"),
        ("Keisha Morgan", "keisha.morgan@example.test", "Patron Circle", "open"),
        ("Liam Reid", "liam.reid@example.test", "Student", "open"),
        ("Asha Williams", "asha.williams@example.test", "Student", "open"),
    ]
    for attendee_name, attendee_email, tier_name, state in attendee_specs:
        ticket = tickets.filtered(lambda item: item.name == tier_name)[:1]
        registration = _one(
            env,
            "event.registration",
            [("event_id", "=", event.id), ("email", "=", attendee_email)],
            {
                "event_id": event.id,
                "event_ticket_id": ticket.id,
                "name": attendee_name,
                "email": attendee_email,
                "phone": "+1 876 555 0200",
                "state": state,
            },
        )
        if state == "done" and registration.state != "done":
            registration.action_set_done()

    parent_list = _one(
        env,
        "mailing.list",
        [("name", "=", "CDT Parents & Guardians")],
        {"name": "CDT Parents & Guardians", "active": True},
    )
    class_list = _one(
        env,
        "mailing.list",
        [("name", "=", "Dance Foundations Families")],
        {"name": "Dance Foundations Families", "active": True},
    )
    guest_list = _one(
        env,
        "mailing.list",
        [("name", "=", "Performance Guests")],
        {"name": "Performance Guests", "active": True},
    )
    for guardian in guardians:
        contact = _one(
            env,
            "mailing.contact",
            [("email", "=", guardian.email)],
            {"name": guardian.partner_id.name, "email": guardian.email},
        )
        contact.write({"list_ids": [(6, 0, [parent_list.id, class_list.id])]})
    for attendee_name, attendee_email, _tier_name, _state in attendee_specs:
        contact = _one(
            env,
            "mailing.contact",
            [("email", "=", attendee_email)],
            {"name": attendee_name, "email": attendee_email},
        )
        contact.write({"list_ids": [(4, guest_list.id)]})

    mailing_model = env["ir.model"].search([("model", "=", "mailing.contact")], limit=1)
    for subject, mailing_list, body in (
        (
            "December showcase: save the date",
            parent_list,
            "<p>CDT families: please save 12 December for our annual dance showcase.</p>",
        ),
        (
            "Dance Foundations weekly update",
            class_list,
            "<p>This draft demonstrates class announcements and schedule reminders.</p>",
        ),
        (
            "Your CDT showcase invitation",
            guest_list,
            "<p>This draft demonstrates event invitations and campaign analytics.</p>",
        ),
    ):
        mailing = env["mailing.mailing"].search(
            [("subject", "=", subject), ("state", "=", "draft")], limit=1
        )
        mailing_values = {
            "subject": subject,
            "mailing_type": "mail",
            "body_html": body,
            "contact_list_ids": [(6, 0, [mailing_list.id])],
            "mailing_domain": repr([("list_ids", "in", [mailing_list.id])]),
        }
        if mailing_model:
            mailing_values["mailing_model_id"] = mailing_model.id
        if mailing:
            mailing.write(mailing_values)
        else:
            env["mailing.mailing"].create(mailing_values)

    env.cr.commit()
    return {
        "admission_id": admission.id,
        "performance_id": performance.id,
        "event_id": event.id,
        "ticket_tiers": len(tickets),
        "registrations": len(event.registration_ids),
        "guardians": len(guardians),
        "portal_login": "parent.demo@cdt.test",
        "mailing_lists": 3,
        "campaign_drafts": 3,
        "sample_applications": 2,
    }
