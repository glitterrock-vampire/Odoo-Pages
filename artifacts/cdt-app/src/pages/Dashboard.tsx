import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, Star, CheckCircle, DollarSign, FileText, Heart, Contact, AlertCircle } from "lucide-react";

function fmt(value: number | null | undefined, prefix = ""): string {
  if (value === null || value === undefined) return "—";
  return `${prefix}${value.toLocaleString()}`;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-10 w-64 bg-muted rounded-md"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 bg-card border rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const odooConnected = (stats as { odooConfigured?: boolean }).odooConfigured ?? true;

  const cards = [
    { title: "Total Students",    value: fmt(stats.totalStudents),          icon: Users,        color: "text-blue-500",    bg: "bg-blue-500/10",    odoo: false },
    { title: "Active Classes",    value: fmt(stats.activeClasses),          icon: Calendar,     color: "text-emerald-500", bg: "bg-emerald-500/10", odoo: false },
    { title: "Upcoming Perf.",    value: fmt(stats.upcomingPerformances),   icon: Star,         color: "text-amber-500",   bg: "bg-amber-500/10",   odoo: false },
    { title: "Open Tasks",        value: fmt(stats.openTasks),              icon: CheckCircle,  color: "text-purple-500",  bg: "bg-purple-500/10",  odoo: true  },
    { title: "Monthly Revenue",   value: fmt(stats.monthlyRevenue, "$"),    icon: DollarSign,   color: "text-primary",     bg: "bg-primary/10",     odoo: true  },
    { title: "Total Donations",   value: fmt(stats.totalDonations, "$"),    icon: Heart,        color: "text-rose-500",    bg: "bg-rose-500/10",    odoo: true  },
    { title: "Pending Invoices",  value: fmt(stats.pendingInvoices),        icon: FileText,     color: "text-orange-500",  bg: "bg-orange-500/10",  odoo: true  },
    { title: "New Contacts",      value: fmt(stats.newContactsThisMonth),   icon: Contact,      color: "text-indigo-500",  bg: "bg-indigo-500/10",  odoo: true  },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-primary font-display">Dashboard</h1>
        <p className="text-muted-foreground mt-2 text-lg">Welcome back to CDT Jamaica. Here's your overview.</p>
      </div>

      {!odooConnected && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Odoo is not connected — live tasks, revenue, donations, invoices, and contacts are unavailable.
            Set <code className="font-mono font-semibold">ODOO_URL</code>, <code className="font-mono font-semibold">ODOO_DB</code>, and <code className="font-mono font-semibold">ODOO_API_KEY</code> in environment secrets to enable them.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((c, i) => (
          <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow bg-card rounded-2xl overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{c.title}</CardTitle>
              <div className={`p-2 rounded-xl ${c.bg} group-hover:scale-110 transition-transform`}>
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-black font-display ${c.odoo && !odooConnected ? "text-muted-foreground/40" : "text-primary"}`}>
                {c.value}
              </div>
              {c.odoo && !odooConnected && (
                <p className="text-xs text-muted-foreground mt-1">Requires Odoo</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
