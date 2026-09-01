import { useState } from "react";
import { useGetEnrollmentReport, useGetFinanceReport } from "@workspace/api-client-react";
import { BarChart3, CircleDollarSign, GraduationCap, HandHeart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Reports() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { data: enrollmentResponse, isLoading: loadingEnrollment, isError: enrollmentError } = useGetEnrollmentReport();
  const { data: financeResponse, isLoading: loadingFinance, isError: financeError } = useGetFinanceReport({ year });
  const enrollment = Array.isArray(enrollmentResponse) ? enrollmentResponse : [];
  const enrollmentChart = enrollment.map((item) => ({
    classId: item.classId,
    className: item.className,
    enrolledCount: item.enrolledCount,
    capacity: item.capacity,
  }));
  const finance = Array.isArray(financeResponse) ? financeResponse : [];
  const currency = finance[0]?.currency ?? "JMD";
  const money = (value: number) => new Intl.NumberFormat("en-JM", { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: 0 }).format(value);

  const enrolledTotal = enrollment.reduce((sum, item) => sum + item.enrolledCount, 0);
  const capacityTotal = enrollment.reduce((sum, item) => sum + item.capacity, 0);
  const billedTotal = finance.reduce((sum, item) => sum + item.billed, 0);
  const collectedTotal = finance.reduce((sum, item) => sum + item.collected, 0);
  const outstandingTotal = finance.reduce((sum, item) => sum + item.outstanding, 0);
  const donationsTotal = finance.reduce((sum, item) => sum + item.donations, 0);
  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Live Odoo reporting</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Reports & analytics</h1>
          <p className="mt-1 text-muted-foreground">Enrollment capacity, posted billing, collections, balances, and donations.</p>
        </div>
        <div className="w-full space-y-2 sm:w-40">
          <label htmlFor="report-year" className="text-sm font-semibold">Financial year</label>
          <select id="report-year" value={year} onChange={(event) => setYear(Number(event.target.value))} className="min-h-11 w-full border border-input bg-background px-3 text-sm">
            {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
      </div>

      <section aria-label="Report totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active enrollment" value={`${enrolledTotal} / ${capacityTotal}`} detail="Students / available capacity" icon={GraduationCap} />
        <Metric label="Posted invoices" value={money(billedTotal)} detail={`${year} billed total`} icon={CircleDollarSign} />
        <Metric label="Collected" value={money(collectedTotal)} detail={`${money(outstandingTotal)} outstanding`} icon={BarChart3} />
        <Metric label="Paid donations" value={money(donationsTotal)} detail={`${year} confirmed gifts`} icon={HandHeart} />
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader><CardTitle className="font-display text-base font-semibold">Enrollment by class</CardTitle><CardDescription className="text-base">Current active Odoo enrollments compared with class capacity.</CardDescription></CardHeader>
          <CardContent>
            {loadingEnrollment ? (
              <div className="flex h-[320px] items-center justify-center animate-pulse font-medium text-muted-foreground">Loading enrollment data…</div>
            ) : enrollmentError ? (
              <div className="flex h-[320px] items-center justify-center px-6 text-center font-medium text-destructive">Enrollment data could not be loaded from Odoo.</div>
            ) : enrollment.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center px-6 text-center text-sm text-muted-foreground">No active Odoo classes are available for this report.</div>
            ) : (
              <div className="h-[320px] w-full" role="img" aria-label={`Enrollment report showing ${enrolledTotal} students across ${enrollment.length} classes with total capacity ${capacityTotal}.`}>
                <ResponsiveContainer width="100%" height="100%"><BarChart data={enrollmentChart} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" /><XAxis dataKey="className" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} dy={10} /><YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} dx={-10} /><Tooltip cursor={{ fill: "hsl(var(--muted)/0.5)" }} contentStyle={{ border: "1px solid hsl(var(--border))", borderRadius: 0, boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1)", padding: 12 }} /><Legend wrapperStyle={{ paddingTop: 20 }} iconType="square" /><Bar dataKey="enrolledCount" name="Enrolled" fill="hsl(var(--secondary))" maxBarSize={40} /><Bar dataKey="capacity" name="Capacity" fill="hsl(var(--primary)/0.22)" maxBarSize={40} /></BarChart></ResponsiveContainer>
              </div>
            )}
          </CardContent>
          {enrollment.length > 0 && <div className="overflow-x-auto border-t"><table className="w-full text-sm"><thead className="bg-muted/30 text-left"><tr><th className="px-5 py-3 font-semibold">Class</th><th className="px-5 py-3 text-right font-semibold">Enrolled</th><th className="px-5 py-3 text-right font-semibold">Capacity</th></tr></thead><tbody className="divide-y">{enrollment.map((item) => <tr key={item.classId}><td className="px-5 py-3"><p className="font-semibold">{item.className}</p><p className="text-xs text-muted-foreground">{item.style}</p></td><td className="px-5 py-3 text-right tabular-nums">{item.enrolledCount}</td><td className="px-5 py-3 text-right tabular-nums">{item.capacity}</td></tr>)}</tbody></table></div>}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader><CardTitle className="font-display text-base font-semibold">Billing and collections</CardTitle><CardDescription className="text-base">Posted invoices, payments collected, and paid donations for {year}.</CardDescription></CardHeader>
          <CardContent>
            {loadingFinance ? (
              <div className="flex h-[320px] items-center justify-center animate-pulse font-medium text-muted-foreground">Loading financial data…</div>
            ) : financeError ? (
              <div className="flex h-[320px] items-center justify-center px-6 text-center font-medium text-amber-900">Odoo financial data could not be loaded.</div>
            ) : (
              <div className="h-[320px] w-full" role="img" aria-label={`${year} financial report: ${money(billedTotal)} billed, ${money(collectedTotal)} collected, and ${money(donationsTotal)} in paid donations.`}>
                <ResponsiveContainer width="100%" height="100%"><LineChart data={finance} margin={{ top: 10, right: 10, left: 4, bottom: 20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" /><XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} dy={10} /><YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={58} tickFormatter={(value) => new Intl.NumberFormat("en-JM", { notation: "compact", maximumFractionDigits: 1 }).format(value)} /><Tooltip cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }} contentStyle={{ border: "1px solid hsl(var(--border))", borderRadius: 0, boxShadow: "0 10px 25px -5px rgb(0 0 0 / 0.1)", padding: 12 }} formatter={(value: number) => [money(value), undefined]} /><Legend wrapperStyle={{ paddingTop: 20 }} iconType="line" /><Line type="monotone" dataKey="billed" name="Posted invoices" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3 }} /><Line type="monotone" dataKey="collected" name="Collected" stroke="hsl(var(--secondary))" strokeWidth={3} dot={{ r: 3 }} /><Line type="monotone" dataKey="donations" name="Paid donations" stroke="hsl(var(--chart-3))" strokeWidth={3} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>
              </div>
            )}
          </CardContent>
          {finance.length > 0 && <div className="overflow-x-auto border-t"><table className="w-full min-w-[620px] text-sm"><thead className="bg-muted/30 text-left"><tr><th className="px-5 py-3 font-semibold">Month</th><th className="px-5 py-3 text-right font-semibold">Billed</th><th className="px-5 py-3 text-right font-semibold">Collected</th><th className="px-5 py-3 text-right font-semibold">Outstanding</th><th className="px-5 py-3 text-right font-semibold">Donations</th></tr></thead><tbody className="divide-y">{finance.filter((item) => item.billed || item.collected || item.outstanding || item.donations).map((item) => <tr key={item.month}><td className="px-5 py-3 font-semibold">{item.month}</td><td className="px-5 py-3 text-right tabular-nums">{money(item.billed)}</td><td className="px-5 py-3 text-right tabular-nums">{money(item.collected)}</td><td className="px-5 py-3 text-right tabular-nums">{money(item.outstanding)}</td><td className="px-5 py-3 text-right tabular-nums">{money(item.donations)}</td></tr>)}</tbody></table></div>}
        </Card>
      </div>
      <p className="border-l-2 border-primary/30 pl-4 text-xs leading-5 text-muted-foreground">Posted invoices are billed amounts, not profit. Final revenue recognition, taxes, bank reconciliation, and statutory reporting remain the responsibility of CDT's accountant.</p>
    </div>
  );
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof GraduationCap }) {
  return <div className="border bg-card p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl font-semibold tabular-nums text-primary">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><Icon aria-hidden="true" className="h-5 w-5 text-secondary" /></div></div>;
}
