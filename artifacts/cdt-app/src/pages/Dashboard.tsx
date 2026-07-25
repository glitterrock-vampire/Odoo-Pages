import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, Star, CheckCircle, DollarSign, FileText, Heart, Contact } from "lucide-react";

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

  const cards = [
    { title: "Total Students", value: stats.totalStudents, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Active Classes", value: stats.activeClasses, icon: Calendar, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Upcoming Perf.", value: stats.upcomingPerformances, icon: Star, color: "text-amber-500", bg: "bg-amber-500/10" },
    { title: "Open Tasks", value: stats.openTasks, icon: CheckCircle, color: "text-purple-500", bg: "bg-purple-500/10" },
    { title: "Monthly Revenue", value: `$${stats.monthlyRevenue.toLocaleString()}`, icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
    { title: "Total Donations", value: `$${stats.totalDonations.toLocaleString()}`, icon: Heart, color: "text-rose-500", bg: "bg-rose-500/10" },
    { title: "Pending Invoices", value: stats.pendingInvoices, icon: FileText, color: "text-orange-500", bg: "bg-orange-500/10" },
    { title: "New Contacts", value: stats.newContactsThisMonth, icon: Contact, color: "text-indigo-500", bg: "bg-indigo-500/10" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight text-primary font-display">Dashboard</h1>
        <p className="text-muted-foreground mt-2 text-lg">Welcome back to CDT Jamaica. Here's your overview.</p>
      </div>

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
              <div className="text-3xl font-black font-display text-primary">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
