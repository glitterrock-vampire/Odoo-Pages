import { useGetEnrollmentReport, useGetFinanceReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';

export default function Reports() {
  const { data: enrollmentResponse, isLoading: loadingEnrollment, isError: enrollmentError } = useGetEnrollmentReport();
  const { data: financeResponse, isLoading: loadingFinance, isError: financeError } = useGetFinanceReport();
  const enrollment = Array.isArray(enrollmentResponse) ? enrollmentResponse : [];
  const finance = Array.isArray(financeResponse) ? financeResponse : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">Visualize school performance and financial health.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base font-semibold text-foreground">Enrollment by Class</CardTitle>
            <CardDescription className="text-base">Current student numbers vs capacity</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingEnrollment ? (
              <div className="h-[350px] flex items-center justify-center animate-pulse text-muted-foreground font-medium">Loading enrollment data...</div>
            ) : enrollmentError ? (
              <div className="h-[350px] flex items-center justify-center text-destructive font-medium">Enrollment data could not be loaded.</div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={enrollment} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                    <XAxis dataKey="className" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} dy={10} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} dx={-10} />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.5)' }} 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      itemStyle={{ fontWeight: 600 }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                    <Bar dataKey="enrolledCount" name="Enrolled" fill="hsl(var(--secondary))" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="capacity" name="Capacity" fill="hsl(var(--primary)/0.15)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-base font-semibold text-foreground">Financial Overview</CardTitle>
            <CardDescription className="text-base">Monthly revenue and donations</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingFinance ? (
              <div className="h-[350px] flex items-center justify-center animate-pulse text-muted-foreground font-medium">Loading financial data...</div>
            ) : financeError ? (
              <div className="h-[350px] flex items-center justify-center px-6 text-center text-amber-900 font-medium">Odoo finance data is unavailable. Check the integration settings.</div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={finance} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} dy={10} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} dx={-10} tickFormatter={(val) => `$${val}`} />
                    <Tooltip 
                      cursor={{ stroke: 'hsl(var(--muted))', strokeWidth: 2 }} 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                      itemStyle={{ fontWeight: 600 }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))" }} activeDot={{ r: 7, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="donations" name="Donations" stroke="hsl(var(--secondary))" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))" }} activeDot={{ r: 7, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
