# CDT Jamaica School Management Demo

This demonstration includes two separate experiences:

1. An administrative dashboard for CDT staff (React app).
2. A secure parent and guardian portal for family self-service (Odoo).

The demonstration uses Odoo Community as its primary administrative database. Existing Sanity website content and Mailchimp subscriber information have also been brought into the demonstration system.

> **Private demonstration access:** This document contains temporary credentials. Please share it only with the intended reviewers.

## Administrative dashboard (React app)

Open the [CDT administration dashboard](https://many-firm-prix-and.trycloudflare.com/).

The React admin dashboard provides access to:

- Dashboard and school statistics
- Students, classes and attendance
- Tuition plans, deposits, partial payments and outstanding balances
- Invoices, donations and donor-restricted funds
- Contacts, guardians and families
- Online admissions, auditions, offers and enrollment
- Performances, repertoire, events and engagement
- Email audiences and campaign drafts
- Staff, instructors and team management
- Reports, tasks and website content
- Settings and integrations

The dashboard is intentionally presented as a clean, formal school administration system. Odoo remains the source of truth for operational and accounting records.

## Parent and guardian portal (Odoo)

Open the [CDT parent portal](https://heath-vote-warranties-fuel.trycloudflare.com/web/login?db=cdt_jamaica&redirect=/my/education).

At the Odoo login screen, enter:

- **Email:** `parent.demo@cdt.test` 
- **Password:** `CDT-Parent-Demo-2026!` 

The parent portal demonstrates access to:

- Linked students and family information
- Classes and schedules
- Attendance history and absence notices
- Published grades and academic records
- Tuition charges, invoices and outstanding balances
- Downloadable invoice and receipt PDFs
- Consent decisions
- Student document uploads

Parents see only the students linked to their guardian account. They do not have access to the administrative dashboard.

If the portal opens as **Administrator**, sign out of Odoo or open the parent portal link in a private or incognito browser window before entering the parent credentials.

**Parent Login Credentials:**
- **Email:** `parent.demo@cdt.test` 
- **Password:** `CDT-Parent-Demo-2026!`

## Suggested demonstration walkthrough

For a short company demonstration:

1. Open the administrative dashboard and review the school statistics.
2. Open **Students**, **Classes** and **Attendance** to show the linked academic records.
3. Open **Tuition & fees** to show billed, partially paid and fully paid student charges.
4. Open **Invoices** to show operational billing and donor-restricted fund reporting.
5. Open **Events & families** to show event ticketing, communications, admissions and the family portal connection.
6. Open the parent portal in a private window and review schedules, attendance, tuition, receipts and family requests.

## Important demonstration notes

- Both replacement links were verified successfully on **August 2, 2026 at 2:25 PM Jamaica time**.
- The parent portal and administrative dashboard links use Cloudflare tunnels and should remain stable for the duration of the demo session.
- These are temporary demonstration links. The host computer must remain powered on, awake and connected to the internet.
- The system contains demonstration data, including no more than three sample students.
- Email campaigns remain drafts. No live bulk emails will be sent.
- Email addresses ending in `.test` are intentionally non-deliverable.
- Tuition and payment records are for demonstration only.
- Real card payments require a production payment provider, accounting journal and security configuration.
- Final taxes, chart of accounts, bank reconciliation and statutory reports must be configured with a Jamaican accountant.
- Automatic payment and attendance reminders remain disabled until production email delivery is configured.

If either link becomes unavailable, contact the administrator so the demonstration service can be restarted and a new temporary link issued.

If a link displays **Unauthorized** or asks for a username and password, the link has not necessarily expired. Enter the temporary browser access credentials shown in this document. If the browser does not display a credential prompt, open the link in a standard private or incognito browser window.
