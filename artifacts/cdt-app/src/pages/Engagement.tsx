import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowUpRight,
  CalendarCheck,
  Check,
  ClipboardList,
  Database,
  Mail,
  ShieldCheck,
  RefreshCw,
  TicketCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";

interface EngagementSnapshot {
  generatedAt: string;
  summary: {
    upcomingEvents: number;
    registrations: number;
    checkedIn: number;
    registeredTicketValue: number;
    mailingRecipients: number;
    campaignDrafts: number;
    openAdmissions: number;
    applications: number;
    guardianHouseholds: number;
    portalUsers: number;
    currency: string;
  };
  events: Array<{
    id: number;
    eventId: number | null;
    title: string;
    date: string;
    venue: string;
    status: string;
    capacity: number;
    ticketTiers: number;
    registrations: number;
    checkedIn: number;
    seatsAvailable: number;
    registeredTicketValue: number;
  }>;
  mailingLists: Array<{ id: number; name: string; contacts: number; activeContacts: number; optOut: number; campaigns: number }>;
  campaigns: Array<{
    id: number;
    subject: string;
    state: string;
    delivered: number;
    recipients: number;
    scheduledDate: string | null;
  }>;
  emailMarketing: {
    source: string;
    migrationSource: string;
    status: string;
    lastSyncAt: string | null;
    audienceTotal: number;
    audienceActive: number;
    audienceOptOut: number;
    outgoingMailConfigured: boolean;
    sendingRole: string;
    draftingRole: string;
    adminUrl: string | null;
  };
  admissions: Array<{
    id: number;
    name: string;
    program: string | null;
    academicYear: string | null;
    applicationStart: string;
    applicationEnd: string;
    capacity: number;
    applicationFee: number;
    applications: number;
    state: string;
  }>;
  applicants: Array<{
    id: number;
    reference: string;
    name: string;
    round: string | null;
    applicationDate: string;
    guardianName: string | null;
    state: string;
  }>;
  familyPortal: {
    guardians: number;
    portalUsers: number;
    portalUrl: string | null;
    admissionsUrl: string | null;
    demoLogin: string;
  };
}

const emptySummary: EngagementSnapshot["summary"] = {
  upcomingEvents: 0,
  registrations: 0,
  checkedIn: 0,
  registeredTicketValue: 0,
  mailingRecipients: 0,
  campaignDrafts: 0,
  openAdmissions: 0,
  applications: 0,
  guardianHouseholds: 0,
  portalUsers: 0,
  currency: "JMD",
};

const emptyEmailMarketing: EngagementSnapshot["emailMarketing"] = {
  source: "Odoo Email Marketing",
  migrationSource: "Not available in this API response",
  status: "not_available",
  lastSyncAt: null,
  audienceTotal: 0,
  audienceActive: 0,
  audienceOptOut: 0,
  outgoingMailConfigured: false,
  sendingRole: "Communications Manager",
  draftingRole: "Communications User",
  adminUrl: null,
};

const emptyFamilyPortal: EngagementSnapshot["familyPortal"] = {
  guardians: 0,
  portalUsers: 0,
  portalUrl: null,
  admissionsUrl: null,
  demoLogin: "Not configured",
};

async function loadEngagement(): Promise<EngagementSnapshot> {
  const response = await fetch("/api/school-engagement", { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("School engagement data could not be loaded.");
  const payload = await response.json() as Partial<EngagementSnapshot>;

  return {
    generatedAt: payload.generatedAt ?? new Date().toISOString(),
    summary: { ...emptySummary, ...(payload.summary ?? {}) },
    events: Array.isArray(payload.events) ? payload.events : [],
    mailingLists: Array.isArray(payload.mailingLists) ? payload.mailingLists : [],
    campaigns: Array.isArray(payload.campaigns) ? payload.campaigns : [],
    emailMarketing: { ...emptyEmailMarketing, ...(payload.emailMarketing ?? {}) },
    admissions: Array.isArray(payload.admissions) ? payload.admissions : [],
    applicants: Array.isArray(payload.applicants) ? payload.applicants : [],
    familyPortal: { ...emptyFamilyPortal, ...(payload.familyPortal ?? {}) },
  };
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-JM", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-JM", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string | null) {
  if (!value) return "Not synced yet";
  return new Intl.DateTimeFormat("en-JM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value.replace(" ", "T") + "Z"));
}

function statusClass(state: string) {
  if (["approved", "done", "sent"].includes(state)) return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (["open", "in_queue"].includes(state)) return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function odooLink(url: string | null) {
  if (!url || typeof window === "undefined") return url;
  if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) return url;

  try {
    const localUrl = new URL(url);
    localUrl.protocol = "http:";
    localUrl.host = "localhost:8069";
    return localUrl.toString();
  } catch {
    return url;
  }
}

export default function Engagement() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["school-engagement", "normalized-v1"],
    queryFn: loadEngagement,
  });

  if (isLoading) {
    return <div className="border bg-card p-8 text-sm font-medium text-muted-foreground animate-pulse motion-reduce:animate-none">Loading events, communications, admissions, and family access…</div>;
  }
  if (isError || !data) {
    return <div className="border border-destructive/25 bg-destructive/5 p-5 text-sm text-destructive">Company engagement data could not be loaded from Odoo.</div>;
  }

  // React Query can retain a response from an older API version during HMR.
  // Keep rendering safe while the versioned query refreshes in the background.
  const summary = { ...emptySummary, ...(data.summary ?? {}) };
  const emailMarketing = { ...emptyEmailMarketing, ...(data.emailMarketing ?? {}) };
  const familyPortal = { ...emptyFamilyPortal, ...(data.familyPortal ?? {}) };
  const events = Array.isArray(data.events) ? data.events : [];
  const mailingLists = Array.isArray(data.mailingLists) ? data.mailingLists : [];
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
  const admissions = Array.isArray(data.admissions) ? data.admissions : [];
  const applicants = Array.isArray(data.applicants) ? data.applicants : [];
  const emailMarketingUrl = odooLink(emailMarketing.adminUrl);
  const admissionsUrl = odooLink(familyPortal.admissionsUrl);
  const portalUrl = odooLink(familyPortal.portalUrl);

  const stats = [
    { label: "Event registrations", value: summary.registrations + summary.checkedIn, detail: `${summary.checkedIn} checked in`, icon: TicketCheck },
    { label: "Registered ticket value", value: formatMoney(summary.registeredTicketValue, summary.currency), detail: "Before refunds and fees", icon: CalendarCheck },
    { label: "Marketing audience", value: summary.mailingRecipients.toLocaleString("en-JM"), detail: `${summary.campaignDrafts} draft campaigns`, icon: Mail },
    { label: "Applications", value: summary.applications.toLocaleString("en-JM"), detail: `${summary.openAdmissions} open intake`, icon: ClipboardList },
  ];

  return (
    <div className="animate-in space-y-7 fade-in duration-300 motion-reduce:animate-none">
      <div className="flex flex-col justify-between gap-4 border-b pb-5 lg:flex-row lg:items-end">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Company engagement</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Events, communications &amp; family access</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">A company-ready view of ticketing, parent communications, online admissions, and secure guardian services powered by Odoo Community.</p>
        </div>
        <Badge variant="outline" className="w-fit gap-2 border-blue-200 bg-blue-50 px-3 py-2 text-blue-800">
          <Database aria-hidden="true" className="h-4 w-4" /> Live Odoo data
        </Badge>
      </div>

      <section aria-label="Engagement summary" className="overflow-hidden border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 lg:divide-x">
          {stats.map((item) => (
            <div key={item.label} className="flex min-h-32 items-start justify-between gap-4 border-b p-5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-primary">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <item.icon aria-hidden="true" className="h-5 w-5 text-primary/55" />
            </div>
          ))}
        </div>
      </section>

      <section id="events" aria-labelledby="events-heading" className="overflow-hidden border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col justify-between gap-3 border-b px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 id="events-heading" className="font-display text-lg font-semibold">Performances and ticketing</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ticket tiers, registrations, barcode check-in, and registered revenue from Odoo Events.</p>
          </div>
          <Link href="/performances" className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Website performances <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30"><TableRow className="hover:bg-transparent"><TableHead>Event</TableHead><TableHead>Ticket tiers</TableHead><TableHead>Attendance</TableHead><TableHead>Capacity</TableHead><TableHead className="text-right">Registered value</TableHead></TableRow></TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell><p className="font-semibold text-primary">{event.title}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(event.date)} · {event.venue}</p></TableCell>
                  <TableCell><span className="font-semibold">{event.ticketTiers}</span><p className="mt-1 text-xs text-muted-foreground">Configured in Odoo</p></TableCell>
                  <TableCell><span className="font-semibold">{event.registrations + event.checkedIn}</span><p className="mt-1 text-xs text-muted-foreground">{event.checkedIn} checked in</p></TableCell>
                  <TableCell><span className="font-semibold">{event.capacity}</span><p className="mt-1 text-xs text-muted-foreground">{event.seatsAvailable} available</p></TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-primary">{formatMoney(event.registeredTicketValue, summary.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="grid gap-7 xl:grid-cols-2">
        <section id="communications" aria-labelledby="communications-heading" className="overflow-hidden border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col justify-between gap-3 border-b px-5 py-4 sm:flex-row sm:items-start">
            <div><h2 id="communications-heading" className="font-display text-lg font-semibold">Communications</h2><p className="mt-1 text-sm text-muted-foreground">Subscriber consent, parent lists, newsletters, and campaign drafts.</p></div>
            {emailMarketingUrl && <a href={emailMarketingUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center gap-2 px-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open Email Marketing <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>}
          </div>
          <div className="grid border-b bg-slate-50/70 sm:grid-cols-3 sm:divide-x">
            <div className="px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Audience sync</p><div className="mt-2 flex items-center gap-2"><RefreshCw aria-hidden="true" className="h-4 w-4 text-primary"/><span className="font-semibold capitalize">{emailMarketing.status.replace("_", " ")}</span></div><p className="mt-1 text-xs text-muted-foreground">{formatDateTime(emailMarketing.lastSyncAt)}</p></div>
            <div className="px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Sending control</p><p className="mt-2 font-semibold">{emailMarketing.sendingRole}</p><p className="mt-1 text-xs text-muted-foreground">Drafts: {emailMarketing.draftingRole}</p></div>
            <div className="px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Outbound email</p><Badge variant="outline" className={`mt-2 ${emailMarketing.outgoingMailConfigured ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{emailMarketing.outgoingMailConfigured ? "Provider configured" : "Provider required"}</Badge><p className="mt-1 text-xs text-muted-foreground">No live send occurs from this dashboard.</p></div>
          </div>
          <div className="divide-y">
            {mailingLists.map((list) => (
              <div key={list.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div><p className="font-semibold text-foreground">{list.name}</p><p className="mt-1 text-xs text-muted-foreground">{list.campaigns} linked campaign{list.campaigns === 1 ? "" : "s"}</p></div>
                <div className="text-right"><p className="font-display text-xl font-semibold text-primary">{list.activeContacts.toLocaleString("en-JM")}</p><p className="text-xs text-muted-foreground">active · {list.optOut.toLocaleString("en-JM")} opted out</p></div>
              </div>
            ))}
          </div>
          <div className="border-t bg-slate-50/70 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Safe demo campaigns</p>
            <div className="mt-3 space-y-3">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">{campaign.subject}</span><Badge variant="outline" className={statusClass(campaign.state)}>{campaign.state}</Badge></div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">Campaigns remain in draft and all sample addresses use the non-deliverable <code>.test</code> domain.</p>
          </div>
        </section>

        <section id="admissions" aria-labelledby="admissions-heading" className="overflow-hidden border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div><h2 id="admissions-heading" className="font-display text-lg font-semibold">Online admissions</h2><p className="mt-1 text-sm text-muted-foreground">Applications flow directly into the Odoo review and enrolment pipeline.</p></div>
            {admissionsUrl && <a href={admissionsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center gap-2 px-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open form <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>}
          </div>
          {admissions.map((admission) => (
            <div key={admission.id} className="border-b px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-primary">{admission.name}</p><p className="mt-1 text-sm text-muted-foreground">{admission.program} · closes {formatDate(admission.applicationEnd)}</p></div><Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Applications open</Badge></div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${admission.applications} of ${admission.capacity} applications`} aria-valuemin={0} aria-valuemax={admission.capacity} aria-valuenow={admission.applications}><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, admission.applications / admission.capacity * 100)}%` }} /></div>
              <p className="mt-2 text-xs text-muted-foreground">{admission.applications} applications · {admission.capacity} available places</p>
            </div>
          ))}
          <div className="divide-y">
            {applicants.map((applicant) => (
              <div key={applicant.id} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="font-semibold">{applicant.name}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{applicant.reference} · guardian {applicant.guardianName ?? "not supplied"}</p></div><Badge variant="outline" className={statusClass(applicant.state)}>{applicant.state}</Badge></div>
            ))}
          </div>
        </section>
      </div>

      <section id="family-portal" aria-labelledby="family-portal-heading" className="overflow-hidden border border-primary/20 bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
        <div className="grid lg:grid-cols-[1.35fr_1fr]">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3"><UserRoundCheck aria-hidden="true" className="h-6 w-6 text-blue-200" /><h2 id="family-portal-heading" className="font-display text-xl font-semibold">Parent &amp; guardian portal</h2></div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/75">Families use a separate, secure Odoo account. They see only their linked children—not the administrative dashboard.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {["Class schedules", "Attendance history", "Published grades", "Invoices and balances", "Payment status and receipts", "Multiple linked children"].map((feature) => <div key={feature} className="flex items-center gap-2 text-sm"><Check aria-hidden="true" className="h-4 w-4 shrink-0 text-blue-200" />{feature}</div>)}
            </div>
          </div>
          <div className="border-t border-white/15 bg-white/5 p-6 md:p-8 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-blue-200" />Demo family account</div>
            <dl className="mt-4 space-y-3 text-sm"><div><dt className="text-primary-foreground/60">Login</dt><dd className="mt-1 font-mono">{familyPortal.demoLogin}</dd></div><div><dt className="text-primary-foreground/60">Linked households</dt><dd className="mt-1 font-semibold">{familyPortal.guardians} guardians · {familyPortal.portalUsers} portal account</dd></div></dl>
            {portalUrl && <a href={portalUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex min-h-11 items-center gap-2 border border-white/30 bg-white px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Open family portal <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>}
          </div>
        </div>
      </section>

      <div className="flex items-start gap-3 border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950"><Users aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /><p><span className="font-semibold">Ready to show the company.</span> The operational figures above are live from the local Odoo database. Payments and outbound email remain in safe test/draft mode.</p></div>
    </div>
  );
}
