import { useGetDashboardStats } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle,
  Contact,
  CreditCard,
  Database,
  DollarSign,
  FileText,
  Heart,
  Images,
  Mail,
  ClipboardList,
  Star,
  TicketCheck,
  UserRoundCheck,
  Users,
} from "lucide-react";

function fmt(value: number | null | undefined, prefix = ""): string {
  if (value === null || value === undefined) return "—";
  return `${prefix}${value.toLocaleString()}`;
}

function fmtMoney(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return "—";
  return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtSyncTime(value: string | null | undefined): string {
  if (!value) return "Not synced";
  return new Intl.DateTimeFormat("en-JM", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function Dashboard() {
  const { data: stats, isLoading, isError } = useGetDashboardStats();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-64 rounded-sm bg-muted" />
        <div className="grid grid-cols-1 border bg-card sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-28 border-b border-r border-border p-5" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="border border-destructive/25 bg-destructive/5 p-5 text-sm text-destructive">
        Dashboard information could not be loaded. Confirm that the local API is running and try again.
      </div>
    );
  }

  const odooConnected = stats.odooConfigured;

  const academicStats = [
    { title: "Active students", value: fmt(stats.totalStudents), icon: Users },
    { title: "Active classes", value: fmt(stats.activeClasses), icon: Calendar },
    { title: "Upcoming performances", value: fmt(stats.upcomingPerformances), icon: Star },
  ];

  const engagementServices = [
    { title: "Event ticketing", detail: "Ticket tiers, registration and check-in", icon: TicketCheck },
    { title: "Family communications", detail: "Mailing lists, reminders and analytics", icon: Mail },
    { title: "Online admissions", detail: "Applications, documents and approvals", icon: ClipboardList },
    { title: "Guardian portal", detail: "Schedules, grades, invoices and receipts", icon: UserRoundCheck },
  ];

  const administrativeStats = [
    { title: "Open tasks", value: fmt(stats.openTasks), icon: CheckCircle },
    { title: "Monthly revenue", value: fmtMoney(stats.monthlyRevenue, stats.currency), icon: DollarSign },
    { title: "Total donations", value: fmtMoney(stats.totalDonations, stats.currency), icon: Heart },
    { title: "Pending invoices", value: fmt(stats.pendingInvoices), icon: FileText },
    { title: "New contacts", value: fmt(stats.newContactsThisMonth), icon: Contact },
  ];

  const feeStats = [
    { title: "Fees billed", value: fmtMoney(stats.feesBilled, stats.currency), href: "/tuition" },
    { title: "Fees collected", value: fmtMoney(stats.feesCollected, stats.currency), href: "/tuition" },
    { title: "Fees outstanding", value: fmtMoney(stats.feesOutstanding, stats.currency), href: "/tuition" },
    { title: "Unbilled fees", value: fmtMoney(stats.unbilledFees, stats.currency), href: "/tuition" },
  ];

  const paymentState = stats.paymentProviderState === "enabled"
    ? "Live"
    : stats.paymentProviderState === "test"
      ? "Test mode"
      : "Not configured";

  const companyContentStats = [
    { title: "Team members", value: fmt(stats.teamMembers), icon: Users, href: "/team" },
    { title: "Repertoire works", value: fmt(stats.repertoireItems), icon: BookOpen, href: "/repertoire" },
    { title: "Performances", value: fmt(stats.totalPerformances), icon: Star, href: "/performances" },
    { title: "Media items", value: fmt(stats.mediaItems), icon: Images, href: "/media" },
  ];

  const today = new Intl.DateTimeFormat("en-JM", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="animate-in space-y-6 fade-in duration-300">
      <div className="flex flex-col justify-between gap-3 border-b pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">CDT Jamaica</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Operations overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Academic activity and administrative records in one place.</p>
        </div>
        <p className="text-sm font-medium text-muted-foreground">{today}</p>
      </div>

      {!odooConnected && (
        <div className="flex items-start gap-3 border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="font-semibold">Odoo connection required.</strong> Tasks, revenue, donations, invoices, and contacts remain unavailable until the site URL and API credentials are configured.
          </span>
        </div>
      )}

      <section aria-labelledby="academic-overview" className="overflow-hidden border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 id="academic-overview" className="font-display text-base font-semibold">Academic overview</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Current enrolment and programme activity</p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Live</span>
        </div>
        <div className="grid sm:grid-cols-3 sm:divide-x">
          {academicStats.map((item) => (
            <div key={item.title} className="flex items-start justify-between gap-4 border-b p-5 last:border-b-0 sm:border-b-0">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{item.title}</p>
                <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-primary">{item.value}</p>
              </div>
              <item.icon aria-hidden="true" className="h-5 w-5 text-primary/55" />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="engagement-services" className="overflow-hidden border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 id="engagement-services" className="font-display text-base font-semibold">Company engagement services</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Public-facing workflows connected to Odoo Community</p>
          </div>
          <Link href="/engagement" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open live demo</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 lg:divide-x">
          {engagementServices.map((service) => (
            <Link key={service.title} href="/engagement" className="flex min-h-28 items-start gap-3 border-b p-5 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:border-b-0">
              <service.icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary/60" />
              <div><p className="font-semibold text-foreground">{service.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{service.detail}</p></div>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="administrative-overview" className="overflow-hidden border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 id="administrative-overview" className="font-display text-base font-semibold">Administrative overview</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Financial and relationship records from Odoo</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Database aria-hidden="true" className="h-4 w-4" />
            {odooConnected ? "Connected" : "Not configured"}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 lg:divide-x">
          {administrativeStats.map((item) => (
            <div key={item.title} className="flex items-start justify-between gap-3 border-b p-5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{item.title}</p>
                <p className={`mt-2 font-display text-2xl font-semibold tracking-tight ${odooConnected ? "text-primary" : "text-muted-foreground/45"}`}>{item.value}</p>
              </div>
              <item.icon aria-hidden="true" className="h-4 w-4 text-muted-foreground/65" />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="company-content-overview" className="overflow-hidden border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 id="company-content-overview" className="font-display text-base font-semibold">Company content</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Published website content migrated from Sanity into Odoo</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
              {stats.contentSyncStatus === "success" ? "Synced" : "Sync pending"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{fmtSyncTime(stats.contentLastSyncAt)}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 lg:divide-x">
          {companyContentStats.map((item) => (
            <Link key={item.title} href={item.href} aria-label={`View ${item.title.toLowerCase()}`} className="flex min-h-24 items-start justify-between gap-4 border-b p-5 transition-colors duration-150 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{item.title}</p>
                <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-primary">{item.value}</p>
              </div>
              <item.icon aria-hidden="true" className="h-4 w-4 text-muted-foreground/65" />
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="fee-overview" className="overflow-hidden border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 id="fee-overview" className="font-display text-base font-semibold">Fee collection</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Student fees and payment readiness from Odoo</p>
          </div>
          <CreditCard aria-hidden="true" className="h-5 w-5 text-primary/55" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 lg:divide-x">
          {feeStats.map((item) => (
            <Link key={item.title} href={item.href} aria-label={`View ${item.title.toLowerCase()}`} className="border-b p-5 transition-colors duration-150 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:border-b-0">
              <p className="text-sm font-medium text-muted-foreground">{item.title}</p>
              <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-primary">{item.value}</p>
            </Link>
          ))}
          <Link href="/tuition" aria-label="View tuition payment readiness" className="p-5 transition-colors duration-150 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <p className="text-sm font-medium text-muted-foreground">Payment provider</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${stats.paymentProviderState === "enabled" ? "bg-emerald-500" : stats.paymentProviderState === "test" ? "bg-amber-500" : "bg-muted-foreground/40"}`} />
              <p className="font-display text-xl font-semibold tracking-tight text-primary">{paymentState}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.paymentProviderName
                ? `${stats.paymentProviderName} · ${stats.paymentJournalName ?? "No journal"}`
                : "Configure a provider and payment journal in Odoo."}
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
