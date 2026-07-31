import { useState } from "react";
import { useListInvoices, useGetFinancialSummary } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, DollarSign, ArrowUpRight, AlertCircle, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function Finances() {
  const [search, setSearch] = useState("");
  const { data: invoicesResponse, isLoading: isLoadingInvoices, isError: isInvoicesError } = useListInvoices({ search: search || undefined });
  const { data: summary, isLoading: isLoadingSummary, isError: isSummaryError } = useGetFinancialSummary();
  const invoices = Array.isArray(invoicesResponse) ? invoicesResponse : [];

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
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Invoices</h1>
        <p className="text-muted-foreground mt-1">Customer invoices, payments, and financial overview from Odoo.</p>
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
                <p className="text-sm font-semibold text-primary-foreground/80 uppercase tracking-wider">Total Revenue</p>
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
