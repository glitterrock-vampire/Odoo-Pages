import { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Database,
  Search,
  ShieldAlert,
  UserRoundX,
} from "lucide-react";
import {
  useGetAttendance,
  type AttendanceRecordStatus,
  type GetAttendanceStatus,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AttendanceFilter = NonNullable<GetAttendanceStatus> | "all";

const statusLabels: Record<AttendanceRecordStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  leave: "Leave",
  excused: "Excused",
};

function statusClass(status: AttendanceRecordStatus): string {
  switch (status) {
    case "present":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "absent":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "late":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "leave":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "excused":
      return "border-violet-200 bg-violet-50 text-violet-800";
  }
}

function formatTime(value: string | null): string {
  return value ? format(new Date(value), "h:mm a") : "—";
}

export default function Attendance() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AttendanceFilter>("all");
  const { data, isLoading, isError } = useGetAttendance({
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  });
  const records = Array.isArray(data?.records) ? data.records : [];
  const summary = data?.summary;

  return (
    <div className="animate-in space-y-6 fade-in duration-300 motion-reduce:animate-none">
      <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">School operations</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Student attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Class registers, absences, approved leave, and check-in history from Odoo.</p>
        </div>
        <Badge variant="outline" className="w-fit gap-2 border-blue-200 bg-blue-50 px-3 py-2 text-blue-800">
          <Database aria-hidden="true" className="h-4 w-4" /> Odoo read-only
        </Badge>
      </div>

      <div className="flex items-start gap-3 border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p><span className="font-semibold">Attendance remains controlled in Odoo.</span> Use the Odoo Education attendance register to mark or correct records; this dashboard updates automatically.</p>
      </div>

      <section aria-label="Attendance summary" className="grid overflow-hidden border bg-card sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:divide-x">
        {[
          { label: "Records", value: summary?.total, detail: "Matching search", icon: CalendarCheck },
          { label: "Present", value: summary?.present, detail: "Attended on time", icon: CheckCircle2 },
          { label: "Late", value: summary?.late, detail: "Attended after start", icon: Clock3 },
          { label: "Absent", value: summary?.absent, detail: "Requires follow-up", icon: UserRoundX },
          { label: "Leave / excused", value: summary ? summary.leave + summary.excused : undefined, detail: `${summary?.leave ?? 0} leave · ${summary?.excused ?? 0} excused`, icon: Clock3 },
          { label: "Attended rate", value: summary?.total ? `${summary.attendanceRate.toFixed(1)}%` : undefined, detail: "Present + late ÷ all records", icon: CalendarCheck },
        ].map((item) => (
          <div key={item.label} className="flex min-h-28 items-start justify-between gap-4 border-b p-5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
              <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-primary">{isLoading ? "…" : item.value ?? "—"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
            </div>
            <item.icon aria-hidden="true" className="h-5 w-5 text-primary/55" />
          </div>
        ))}
      </section>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search attendance"
                placeholder="Search student, class, course, or note"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={status} onValueChange={(value) => setStatus(value as AttendanceFilter)}>
              <SelectTrigger aria-label="Filter attendance status" className="h-11 w-full bg-card sm:w-48">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">{isLoading ? "Loading records…" : `${records.length} record${records.length === 1 ? "" : "s"}`}</p>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Class / course</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check-in / out</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="py-12 text-center font-medium text-muted-foreground animate-pulse motion-reduce:animate-none">Loading attendance register…</TableCell></TableRow>
                ) : isError ? (
                  <TableRow><TableCell colSpan={6} className="py-12 text-center font-medium text-destructive">Attendance could not be loaded from Odoo.</TableCell></TableRow>
                ) : records.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-12 text-center"><CalendarCheck aria-hidden="true" className="mx-auto h-8 w-8 text-primary/35" /><p className="mt-3 font-semibold">No attendance records found.</p><p className="mt-1 text-sm text-muted-foreground">Try another search or status filter.</p></TableCell></TableRow>
                ) : records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-nowrap font-medium">{format(parseISO(record.date), "d MMM yyyy")}</TableCell>
                    <TableCell><p className="font-semibold text-primary">{record.studentName}</p><p className="mt-1 font-mono text-xs text-muted-foreground">Student #{record.studentId}</p></TableCell>
                    <TableCell><p className="font-medium">{record.groupName}</p><p className="mt-1 text-xs text-muted-foreground">{record.courseName ?? record.scheduleName ?? "Course not assigned"}</p></TableCell>
                    <TableCell><Badge variant="outline" className={statusClass(record.status)}>{statusLabels[record.status]}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap">
                      <p className="font-medium">{formatTime(record.checkIn)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Out {formatTime(record.checkOut)}</p>
                      {(record.minutesLate > 0 || record.earlyDepartureMinutes > 0) && (
                        <div className="mt-1.5 space-y-0.5 text-xs font-medium text-amber-800">
                          {record.minutesLate > 0 && <p>{record.minutesLate} min late</p>}
                          {record.earlyDepartureMinutes > 0 && <p>{record.earlyDepartureMinutes} min early departure</p>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">{record.remarks ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
