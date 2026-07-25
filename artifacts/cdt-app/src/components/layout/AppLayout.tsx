import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, CalendarDays, Contact2, HeartHandshake, FileText, CheckSquare, BarChart3, Settings } from "lucide-react";
import cdtLogo from "@assets/cdt-logo.png";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Students", href: "/students", icon: Users },
  { name: "Classes", href: "/classes", icon: CalendarDays },
  { name: "Performances", href: "/performances", icon: FileText },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Contacts", href: "/contacts", icon: Contact2 },
  { name: "Donations", href: "/donations", icon: HeartHandshake },
  { name: "Finances", href: "/finances", icon: FileText },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row font-sans">
      <div className="w-full md:w-64 bg-sidebar border-r border-sidebar-border shrink-0 flex flex-col shadow-xl z-10">
        <div className="p-6">
          <img src={cdtLogo} alt="CDT Jamaica" className="h-14 w-auto drop-shadow-sm" />
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto pb-6">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-semibold transition-all duration-200",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md translate-x-1" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-1"
              )}>
                <item.icon className={cn("w-5 h-5", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <main className="flex-1 overflow-y-auto bg-muted/30">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
