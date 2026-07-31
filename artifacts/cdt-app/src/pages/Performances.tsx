import { useState } from "react";
import { useListPerformances, useDeletePerformance, getListPerformancesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Trash2, Edit2, Calendar as CalIcon, MapPin, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ContentSourceBanner } from "@/components/content/ContentSourceBanner";

export default function Performances() {
  const [search, setSearch] = useState("");
  const { data: performances, isLoading } = useListPerformances({ search: search || undefined });
  const deletePerformance = useDeletePerformance();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    const performance = performances?.find((item) => item.id === id);
    if (performance?.managedBySanity) {
      toast({ title: "Managed by Sanity", description: "Delete this public performance in Sanity until the website cutover is complete." });
      return;
    }
    if (confirm("Are you sure you want to delete this performance?")) {
      deletePerformance.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPerformancesQueryKey() });
          toast({ title: "Performance deleted successfully" });
        }
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Performances</h1>
          <p className="text-muted-foreground mt-1">Published shows mirrored into Odoo, with ERP ticketing and class details.</p>
        </div>
        <Button className="gap-2" disabled title="Create website performances in Sanity until cutover"><Plus className="w-4 h-4" /> Add after cutover</Button>
      </div>

      <ContentSourceBanner />

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/10">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search performances..." 
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
                <TableHead className="font-semibold text-primary">Performance</TableHead>
                <TableHead className="font-semibold text-primary">Date & Time</TableHead>
                <TableHead className="font-semibold text-primary">Venue</TableHead>
                <TableHead className="font-semibold text-primary">Status</TableHead>
                <TableHead className="text-right font-semibold text-primary">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium animate-pulse">Loading performances...</TableCell></TableRow>
              ) : performances?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">No performances found.</TableCell></TableRow>
              ) : (
                performances?.map(perf => (
                  <TableRow key={perf.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell>
                      <div className="font-bold text-primary text-base">{perf.title}</div>
                      {perf.managedBySanity && <Badge variant="outline" className="mt-1 text-[10px] uppercase tracking-wide">Sanity managed</Badge>}
                      {perf.ticketPrice && (
                        <div className="flex items-center gap-1 text-xs font-semibold text-secondary mt-1">
                          <Ticket className="w-3 h-3" />
                          ${perf.ticketPrice} / ticket
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <CalIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{format(parseISO(perf.date), "MMM d, yyyy")}</span>
                      </div>
                      {perf.time && <div className="text-xs text-muted-foreground mt-0.5 ml-5">{perf.time}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{perf.venue}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize font-semibold shadow-sm ${getStatusColor(perf.status)}`}>
                        {perf.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                        <Button aria-label={`Edit ${perf.title}`} variant="ghost" size="icon" className="text-primary hover:bg-secondary/60" disabled={perf.managedBySanity} title={perf.managedBySanity ? "Public fields are managed in Sanity" : "Edit performance"}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button aria-label={`Delete ${perf.title}`} variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" disabled={perf.managedBySanity} title={perf.managedBySanity ? "Delete in Sanity until cutover" : "Delete performance"} onClick={() => handleDelete(perf.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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
