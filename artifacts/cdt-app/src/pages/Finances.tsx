import { useState } from "react";
import { useListInvoices, useGetFinancialSummary } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, DollarSign, ArrowUpRight, AlertCircle, FileText, Landmark, ShieldCheck, Target } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function Finances() {
  const [search, setSearch] = useState("");
  const { data: invoicesResponse, isLoading: isLoadingInvoices, isError: isInvoicesError } = useListInvoices({ search: search || undefined });
  const { data: summary, isLoading: isLoadingSummary, isError: isSummaryError } = useGetFinancialSummary();
  const invoices = Array.isArray(invoicesResponse) ? invoicesResponse : [];
  const funds = Array.isArray(summary?.funds) ? summary.funds : [];
  const restrictedFundCount = funds.filter((fund) => fund.restriction !== "unrestricted").length;

  const money = (value: number, currency: string) => `${currency} ${new Intl.NumberFormat("en-JM", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)}`;
  const restrictionLabel = (restriction: string) => {
    if (restriction === "temporary") return "Temporarily restricted";
    if (restriction === "permanent") return "Permanently restricted";
    return "Unrestricted";
  };

  const getPaymentStateColor = (state: string) => {
    switch (state) {
      case 'paid': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'in_payment': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'partial': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'not_paid': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Accounting</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">School finances</h1>
        <p className="text-muted-foreground mt-1">Customer invoices, collections, overdue balances, and donor-restricted funds from Odoo.</p>
      </div>

      {isLoadingSummary ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {Array.from({length: 4}).map((_, i) => (
            <div key={i} className="h-32 border bg-muted"></div>
          ))}
        </div>
      ) : isSummaryError ? (
        <div className="border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-950">Odoo financial totals are unavailable. Check the integration settings.</div>
      ) : summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-primary bg-primary text-primary-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-primary-foreground/80 uppercase tracking-wider">Posted Invoices</p>
                <DollarSign className="w-5 h-5 text-primary-foreground/80" />
              </div>
              <div className="mt-3 font-display text-3xl font-semibold">{summary.currency} {summary.totalRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Paid</p>
                <ArrowUpRight className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="mt-3 font-display text-3xl font-semibold text-primary">{summary.currency} {summary.totalPaid.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Outstanding</p>
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="mt-3 font-display text-3xl font-semibold text-primary">{summary.currency} {summary.totalOutstanding.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Overdue Invoices</p>
                <FileText className="w-5 h-5 text-rose-500" />
              </div>
              <div className="mt-3 font-display text-3xl font-semibold text-destructive">{summary.overdueCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {!isLoadingSummary && !isSummaryError && summary && (
        <section aria-labelledby="funds-heading" className="overflow-hidden border bg-card">
          <div className="flex flex-col justify-between gap-3 border-b px-5 py-4 sm:flex-row sm:items-start">
            <div>
              <div className="flex items-center gap-2"><Landmark aria-hidden="true" className="h-5 w-5 text-primary"/><h2 id="funds-heading" className="font-display text-lg font-semibold">Donor and restricted funds</h2></div>
              <p className="mt-1 text-sm text-muted-foreground">Purpose restrictions, fundraising targets, pledges, and confirmed collections remain visible for stewardship reporting.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck aria-hidden="true" className="h-4 w-4"/>{restrictedFundCount} restricted {restrictedFundCount === 1 ? "fund" : "funds"}</div>
          </div>
          {funds.length === 0 ? (
            <div className="px-5 py-10 text-center"><Target aria-hidden="true" className="mx-auto h-8 w-8 text-primary/45"/><p className="mt-3 font-semibold">No donor funds configured</p><p className="mt-1 text-sm text-muted-foreground">Create a fund in Odoo and assign donations to it to track targets and restrictions here.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b bg-muted/30 text-left"><tr><th className="px-5 py-3 font-semibold">Fund</th><th className="px-5 py-3 font-semibold">Restriction</th><th className="px-5 py-3 text-right font-semibold">Target</th><th className="px-5 py-3 text-right font-semibold">Pledged</th><th className="px-5 py-3 text-right font-semibold">Paid</th><th className="px-5 py-3 text-right font-semibold">Remaining</th></tr></thead>
                <tbody className="divide-y">
                  {funds.map((fund) => (
                    <tr key={fund.id}>
                      <td className="px-5 py-4"><p className="font-semibold text-primary">{fund.name}</p><p className="mt-0.5 font-mono text-xs text-muted-foreground">{fund.code}</p>{fund.purpose && <p className="mt-1 max-w-md text-xs text-muted-foreground">{fund.purpose}</p>}</td>
                      <td className="px-5 py-4"><Badge variant="outline" className={fund.restriction === "unrestricted" ? "border-slate-200 bg-slate-50 text-slate-700" : "border-amber-200 bg-amber-50 text-amber-900"}>{restrictionLabel(fund.restriction)}</Badge></td>
                      <td className="px-5 py-4 text-right tabular-nums">{money(fund.targetAmount, fund.currency)}</td>
                      <td className="px-5 py-4 text-right tabular-nums">{money(fund.pledgedAmount, fund.currency)}</td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-emerald-700">{money(fund.paidAmount, fund.currency)}</td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums">{money(fund.remainingAmount, fund.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t bg-slate-50/70 px-5 py-3 text-xs leading-5 text-muted-foreground">Invoice totals are operational billing figures, not a complete profit-and-loss statement. Final taxes, chart of accounts, bank reconciliation, and statutory reports must be configured and approved by CDT’s Jamaican accountant.</div>
        </section>
      )}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/10">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search invoices..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-primary">Invoice</TableHead>
                <TableHead className="font-semibold text-primary">Customer</TableHead>
                <TableHead className="font-semibold text-primary">Date</TableHead>
                <TableHead className="font-semibold text-primary">Amount</TableHead>
                <TableHead className="font-semibold text-primary text-right">Payment Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingInvoices ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium animate-pulse">Loading invoices...</TableCell></TableRow>
              ) : isInvoicesError ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-destructive font-medium">Odoo invoices could not be loaded. Check the integration settings.</TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">No invoices found.</TableCell></TableRow>
              ) : (
                invoices.map(invoice => (
                  <TableRow key={invoice.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell className="font-bold text-primary font-mono">{invoice.name}</TableCell>
                    <TableCell className="font-medium">{invoice.partnerName}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{invoice.invoiceDate ? format(parseISO(invoice.invoiceDate), "MMM d, yyyy") : '-'}</div>
                      {invoice.dueDate && (
                        <div className="text-xs text-muted-foreground mt-0.5">Due: {format(parseISO(invoice.dueDate), "MMM d, yyyy")}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-bold text-base">{invoice.currency} {invoice.amountTotal.toLocaleString()}</div>
                      {invoice.amountDue > 0 && <div className="text-xs text-rose-500 font-bold mt-0.5">Due: {invoice.currency} {invoice.amountDue.toLocaleString()}</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={`capitalize shadow-sm font-semibold ${getPaymentStateColor(invoice.paymentState)}`}>
                        {invoice.paymentState.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
