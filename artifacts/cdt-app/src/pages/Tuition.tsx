import { useMemo, useState } from "react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  Search,
  WalletCards,
} from "lucide-react";
import {
  useGetDashboardStats,
  useListTuitionFees,
  type ListTuitionFeesStatus,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type TuitionStatus = Exclude<ListTuitionFeesStatus, null> | "all";

const statusLabels: Record<Exclude<TuitionStatus, "all">, string> = {
  draft: "Draft",
  due: "Due",
  partial: "Partially paid",
  paid: "Paid",
  cancelled: "Cancelled",
};

function money(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return "—";
  const formatted = new Intl.NumberFormat("en-JM", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${currency} ${formatted}`;
}

function statusClass(status: Exclude<TuitionStatus, "all">, overdue: boolean): string {
  if (overdue) return "border-rose-200 bg-rose-50 text-rose-800";
  switch (status) {
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "due":
      return "border-blue-200 bg-blue-50 text-blue-800";
    default:
      return "border-border bg-muted/50 text-muted-foreground";
  }
}

export default function Tuition() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TuitionStatus>("all");
  const query = {
    search: search.trim() || undefined,
    status: status === "all" ? undefined : status,
  };
  const { data: feeResponse, isLoading: isLoadingFees, isError: isFeesError } = useListTuitionFees(query);
  const { data: stats, isLoading: isLoadingStats, isError: isStatsError } = useGetDashboardStats();
  const fees = Array.isArray(feeResponse) ? feeResponse : [];
  const overdueCount = useMemo(() => fees.filter((fee) => fee.overdue).length, [fees]);
  const currency = stats?.currency ?? fees[0]?.currency ?? "JMD";
  const billed = stats?.feesBilled ?? null;
  const collected = stats?.feesCollected ?? null;
  const outstanding = stats?.feesOutstanding ?? null;
  const unbilled = stats?.unbilledFees ?? null;
  const collectionRate = billed && collected !== null ? Math.round((collected / billed) * 100) : 0;
  const paymentMode = stats?.paymentProviderState === "enabled"
    ? "Live payments enabled"
    : stats?.paymentProviderState === "test"
      ? "Payments are in test mode"
      : "Online payments are not configured";

  return (
    <div className="animate-in space-y-6 fade-in duration-300">
      <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Finance &amp; billing</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Tuition &amp; fees</h1>
          <p className="mt-1 text-sm text-muted-foreground">Student charges, collections, balances, and linked Odoo invoices.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/finances">
            <FileText aria-hidden="true" /> View invoices
          </Link>
        </Button>
      </div>

      <div className={`flex items-start gap-3 border px-4 py-3 text-sm ${stats?.paymentProviderState === "enabled" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-300/70 bg-amber-50 text-amber-950"}`}>
        {stats?.paymentProviderState === "enabled"
          ? <CreditCard aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          : <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}
        <div>
          <p className="font-semibold">{isLoadingStats ? "Checking payment readiness" : paymentMode}</p>
          <p className="mt-0.5">
            {stats?.paymentProviderState === "enabled"
              ? `${stats.paymentProviderName ?? "Odoo provider"} is connected to ${stats.paymentJournalName ?? "the configured payment journal"}.`
              : stats?.paymentProviderState === "test"
                ? `${stats.paymentProviderName ?? "The Odoo demo provider"} can validate the workflow, but it must not be used to collect real tuition.`
                : "Configure and publish an Odoo payment provider with an accounting journal before collecting tuition online."}
          </p>
        </div>
      </div>

      {isStatsError ? (
        <div className="border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">Tuition totals could not be loaded from Odoo.</div>
      ) : (
        <section aria-label="Tuition summary" className="grid overflow-hidden border bg-card sm:grid-cols-2 lg:grid-cols-5 lg:divide-x">
          {[
            { label: "Billed", value: money(billed, currency), icon: CircleDollarSign },
            { label: "Collected", value: money(collected, currency), icon: WalletCards },
            { label: "Outstanding", value: money(outstanding, currency), icon: AlertCircle },
            { label: "Unbilled", value: money(unbilled, currency), icon: FileText },
            { label: "Overdue accounts", value: stats?.overdueFeesCount?.toLocaleString() ?? "—", icon: CreditCard },
          ].map((item) => (
            <div key={item.label} className="flex min-h-28 items-start justify-between gap-4 border-b p-5 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-primary">{isLoadingStats ? "…" : item.value}</p>
              </div>
              <item.icon aria-hidden="true" className="h-5 w-5 text-primary/55" />
            </div>
          ))}
        </section>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search tuition fees"
                placeholder="Search student or fee reference"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={status} onValueChange={(value) => setStatus(value as TuitionStatus)}>
              <SelectTrigger aria-label="Filter tuition status" className="h-11 w-full bg-card sm:w-48">
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
          <p className="text-sm text-muted-foreground">{fees.length} records · {overdueCount} overdue · {collectionRate}% collected</p>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead>Fee</TableHead>
                <TableHead>Student / class</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Paid / balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingFees ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center font-medium text-muted-foreground animate-pulse">Loading tuition ledger…</TableCell></TableRow>
              ) : isFeesError ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center font-medium text-destructive">The Odoo tuition ledger could not be loaded.</TableCell></TableRow>
              ) : fees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <div className="mx-auto max-w-xl">
                      <CircleDollarSign aria-hidden="true" className="mx-auto h-8 w-8 text-primary/45" />
                      <p className="mt-3 font-display text-lg font-semibold text-foreground">No tuition charges yet</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">Create a fee structure and billing schedule in Odoo, enroll students, then generate student fees. Balances and payments will appear here automatically.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : fees.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell>
                    <p className="font-mono text-xs font-semibold text-primary">{fee.reference}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{fee.feeStructure}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{fee.studentName}</p>
                      {fee.sampleData && <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[10px] uppercase tracking-wide text-violet-800">Sample</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{fee.programName ?? "No programme"} · Contact #{fee.contactId ?? "—"}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {fee.classNames.map((className) => <Badge key={className} variant="outline" className="bg-background text-[10px] font-medium">{className}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className={fee.overdue ? "font-semibold text-destructive" : "font-medium"}>{format(parseISO(fee.dueDate), "d MMM yyyy")}</p>
                    {fee.overdue && <p className="mt-1 text-xs font-semibold text-destructive">Overdue</p>}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{money(fee.amount, fee.currency)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <p className="font-medium text-emerald-700">{money(fee.amountPaid, fee.currency)}</p>
                    <p className={fee.balance > 0 ? "mt-1 text-xs font-semibold text-destructive" : "mt-1 text-xs text-muted-foreground"}>Balance {money(fee.balance, fee.currency)}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`whitespace-nowrap ${statusClass(fee.status, fee.overdue)}`}>
                      {fee.overdue ? "Overdue" : statusLabels[fee.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {fee.invoiceName ? (
                      <div>
                        <p className="font-mono text-xs font-semibold">{fee.invoiceName}</p>
                        <p className="mt-1 text-xs capitalize text-muted-foreground">{fee.paymentState?.replace("_", " ") ?? fee.invoiceState}</p>
                      </div>
                    ) : <span className="text-sm text-muted-foreground">Not created</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section aria-labelledby="billing-workflow" className="border bg-card p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 id="billing-workflow" className="font-display text-base font-semibold">Billing workflow</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Odoo remains the accounting source of truth: define fee components, generate charges for enrolled students, create and post invoices, then collect through the configured payment provider or register a payment in Odoo.</p>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/finances">Invoice register <ArrowRight aria-hidden="true" /></Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
