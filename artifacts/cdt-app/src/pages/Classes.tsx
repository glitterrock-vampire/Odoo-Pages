import { useState } from "react";
import { Link } from "wouter";
import { useListClasses } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Database, Link2, MapPin, Search, Users } from "lucide-react";

function money(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return "Not assigned";
  return `${currency} ${value.toLocaleString("en-JM", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Classes() {
  const [search, setSearch] = useState("");
  const { data: classResponse, isLoading, isError } = useListClasses({ search: search || undefined });
  const classes = Array.isArray(classResponse) ? classResponse : [];

  return (
    <div className="animate-in space-y-6 fade-in duration-300">
      <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">School operations</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Classes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Odoo course offerings with enrolled students and programme tuition.</p>
        </div>
        <Badge variant="outline" className="w-fit gap-2 border-blue-200 bg-blue-50 px-3 py-2 text-blue-800">
          <Database aria-hidden="true" className="h-4 w-4" /> Odoo primary
        </Badge>
      </div>

      <div className="flex items-start gap-3 border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        <Link2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p><span className="font-semibold">Enrollment is linked.</span> Class counts come from Odoo course enrollments, and the tuition amount comes from the matching programme fee structure.</p>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b bg-muted/10 p-4">
          <div className="relative max-w-md">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search classes"
              placeholder="Search classes or programmes"
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
                <TableHead>Class / programme</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Schedule / location</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Tuition</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center font-medium text-muted-foreground animate-pulse">Loading linked classes…</TableCell></TableRow>
              ) : isError || !Array.isArray(classResponse) ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center font-medium text-destructive">Classes could not be loaded from Odoo.</TableCell></TableRow>
              ) : classes.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">No Odoo course offerings found.</TableCell></TableRow>
              ) : classes.map((classRecord) => (
                <TableRow key={classRecord.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-primary">{classRecord.name}</p>
                      {classRecord.sampleData && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[10px] uppercase tracking-wide text-violet-800">Sample</Badge>}
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-secondary">{classRecord.style}</p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground">{classRecord.classStatus.replace("_", " ")}</p>
                  </TableCell>
                  <TableCell className="font-medium">{classRecord.instructor}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm"><Clock aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" /><span>{classRecord.schedule}</span></div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin aria-hidden="true" className="h-3.5 w-3.5" /><span>{classRecord.location}</span></div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users aria-hidden="true" className="h-4 w-4 text-primary/55" />
                      <span className="font-mono text-sm font-semibold">{classRecord.enrolledCount}/{classRecord.capacity}</span>
                    </div>
                    <div className="mt-2 flex max-w-xs flex-wrap gap-1.5">
                      {classRecord.studentNames.map((name) => <Badge key={name} variant="outline" className="bg-background text-xs font-medium">{name}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link href="/tuition" className="block min-h-11 rounded-sm px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <p className="font-semibold tabular-nums text-primary">{money(classRecord.fee, classRecord.currency)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Programme fee · View ledger</p>
                    </Link>
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
