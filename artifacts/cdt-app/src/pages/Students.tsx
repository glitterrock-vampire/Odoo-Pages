import { useState } from "react";
import { Link } from "wouter";
import { useListStudents } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Database, Link2, Search, WalletCards } from "lucide-react";

function money(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString("en-JM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function tuitionStyle(status: string | null): string {
  switch (status) {
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "due":
      return "border-rose-200 bg-rose-50 text-rose-800";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

export default function Students() {
  const [search, setSearch] = useState("");
  const { data: studentsResponse, isLoading, isError } = useListStudents({ search: search || undefined });
  const students = Array.isArray(studentsResponse) ? studentsResponse : [];

  return (
    <div className="animate-in space-y-6 fade-in duration-300">
      <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">School operations</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">Contact identity, class enrollment, and tuition status from one Odoo record.</p>
        </div>
        <Badge variant="outline" className="w-fit gap-2 border-blue-200 bg-blue-50 px-3 py-2 text-blue-800">
          <Database aria-hidden="true" className="h-4 w-4" /> Odoo primary
        </Badge>
      </div>

      <div className="flex items-start gap-3 border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        <Link2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p><span className="font-semibold">Linked records.</span> These students originate from existing contacts. Class membership and tuition are managed in Odoo so changes cannot drift between systems.</p>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b bg-muted/10 p-4">
          <div className="relative max-w-md">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search students"
              placeholder="Search students by name"
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead>Student / contact</TableHead>
                <TableHead>Programme</TableHead>
                <TableHead>Classes</TableHead>
                <TableHead>Tuition</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center font-medium text-muted-foreground animate-pulse">Loading linked students…</TableCell></TableRow>
              ) : isError || !Array.isArray(studentsResponse) ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center font-medium text-destructive">Students could not be loaded from Odoo.</TableCell></TableRow>
              ) : students.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">No Odoo students found.</TableCell></TableRow>
              ) : students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-primary">{student.firstName} {student.lastName}</p>
                      {student.sampleData && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[10px] uppercase tracking-wide text-violet-800">Sample</Badge>}
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{student.studentNumber} · Contact #{student.contactId ?? "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{student.email ?? student.phone ?? "Contact details not supplied"}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{student.programName ?? "Not enrolled"}</p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">{student.academicStatus}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-xs flex-wrap gap-1.5">
                      {student.classNames.length > 0
                        ? student.classNames.map((className) => <Badge key={className} variant="outline" className="bg-background font-medium">{className}</Badge>)
                        : <span className="text-sm text-muted-foreground">No classes</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link href="/tuition" className="block min-h-11 rounded-sm px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <p className="font-semibold tabular-nums text-primary">{money(student.tuitionBalance, student.currency)}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <WalletCards aria-hidden="true" className="h-3.5 w-3.5" />
                        <span>{money(student.tuitionPaid, student.currency)} paid</span>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1.5">
                      <Badge variant="outline" className={tuitionStyle(student.tuitionStatus)}>
                        {student.tuitionStatus ? student.tuitionStatus.replace("_", " ") : "No fee"}
                      </Badge>
                      <p className="text-xs capitalize text-muted-foreground">Student {student.status}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
