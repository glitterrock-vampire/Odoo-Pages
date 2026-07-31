import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { LayoutDashboard, Users, CalendarDays, Contact2, HeartHandshake, FileText, CheckSquare, BarChart3, Settings, ShieldCheck, Menu, X, UsersRound, BookOpen, Images, Globe2, Clapperboard, CircleDollarSign, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const navigationSections = [
  {
    label: "Overview",
    items: [{ name: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    label: "School operations",
    items: [
      { name: "Students", href: "/students", icon: Users },
      { name: "Classes", href: "/classes", icon: CalendarDays },
    ],
  },
  {
    label: "Engagement & access",
    items: [
      { name: "Events & families", href: "/engagement", icon: MailCheck },
    ],
  },
  {
    label: "Website content",
    status: "Sanity mirror",
    items: [
      { name: "Team", href: "/team", icon: UsersRound },
      { name: "Performances", href: "/performances", icon: Clapperboard },
      { name: "Repertoire", href: "/repertoire", icon: BookOpen },
      { name: "Media library", href: "/media", icon: Images },
      { name: "Website settings", href: "/website-settings", icon: Globe2 },
    ],
  },
  {
    label: "Administration",
    items: [
      { name: "Tasks", href: "/tasks", icon: CheckSquare },
      { name: "Contacts", href: "/contacts", icon: Contact2 },
    ],
  },
  {
    label: "Finance & billing",
    items: [
      { name: "Tuition & fees", href: "/tuition", icon: CircleDollarSign },
      { name: "Invoices", href: "/finances", icon: FileText },
      { name: "Donations", href: "/donations", icon: HeartHandshake },
      { name: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [{ name: "Settings", href: "/settings", icon: Settings }],
  },
];

const navigation = navigationSections.flatMap((section) => section.items);

function syncTime(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-JM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Waiting for first sync";
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { data: dashboardStats } = useGetDashboardStats();
  const currentPage = navigation.find((item) => item.href === location || (item.href !== "/" && location.startsWith(item.href)))?.name ?? "Administration";

  return (
    <div className="min-h-screen bg-background font-sans">
      <a href="#main-content" className="sr-only z-50 bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to main content
      </a>
      <aside className="z-30 flex w-full shrink-0 flex-col border-sidebar-border bg-sidebar text-sidebar-foreground md:fixed md:inset-y-0 md:w-60 md:border-r">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4 md:h-[76px] md:px-5">
          <img
            src="/branding/cdt-logo.png"
            alt="CDT Jamaica"
            width={1920}
            height={1080}
            className="h-11 w-[98px] shrink-0 object-contain object-left brightness-0 invert"
          />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-white">Admin portal</p>
            <p className="text-xs tracking-wide text-sidebar-foreground/65">Operations</p>
          </div>
          <button
            type="button"
            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
            className="ml-auto flex h-11 w-11 items-center justify-center border border-white/20 text-white transition-colors hover:bg-white/10 md:hidden"
          >
            {mobileNavOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
        <nav aria-label="Primary navigation" className={cn(
          "border-b border-sidebar-border px-3 py-3 md:flex md:flex-1 md:flex-col md:gap-4 md:overflow-y-auto md:border-b-0 md:px-3 md:py-5",
          mobileNavOpen ? "block" : "hidden md:flex",
        )}>
          {navigationSections.map((section) => (
            <div key={section.label} className="mb-3 last:mb-0 md:mb-0">
              <div className="flex min-h-7 items-center justify-between gap-2 px-3 pb-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">{section.label}</p>
                {section.status && <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-sidebar-primary">{section.status}</span>}
              </div>
              <div className="grid grid-cols-2 gap-1 md:block md:space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  return (
                    <Link key={item.name} href={item.href} aria-current={isActive ? "page" : undefined} onClick={() => setMobileNavOpen(false)} className={cn(
                      "flex min-h-11 shrink-0 items-center gap-3 border-l-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                      isActive
                        ? "border-sidebar-primary bg-sidebar-accent text-white"
                        : "border-transparent text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-white"
                    )}>
                      <item.icon aria-hidden="true" className={cn("h-4 w-4 shrink-0", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60")} />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="hidden space-y-3 border-t border-sidebar-border p-4 md:block">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-sidebar-foreground/80">
              <span className={cn("h-2 w-2 rounded-full", dashboardStats?.contentSyncStatus === "success" ? "bg-emerald-400" : "bg-amber-400")} aria-hidden="true" />
              {dashboardStats?.contentSyncStatus === "success" ? "Website content synced" : "Website sync pending"}
            </div>
            <p className="mt-1 pl-4 text-[10px] leading-4 text-sidebar-foreground/45">{syncTime(dashboardStats?.contentLastSyncAt)}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/65">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-sidebar-primary" />
            Internal administration system
          </div>
        </div>
      </aside>
      <div className="min-w-0 md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white/95 px-4 backdrop-blur md:h-[76px] md:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Administration portal</p>
            <p className="mt-0.5 font-display text-sm font-semibold text-foreground">{currentPage}</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />
            Local system online
          </div>
        </header>
        <main id="main-content" className="min-h-[calc(100vh-76px)] bg-background">
          <div className="mx-auto max-w-[1500px] p-4 md:p-8 lg:p-10">
          {children}
          </div>
        </main>
      </div>
    </div>
  );
}
