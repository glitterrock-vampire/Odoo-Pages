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
import { format } from "date-fns";

export default function Performances() {
  const [search, setSearch] = useState("");
  const { data: performances, isLoading } = useListPerformances({ search: search || undefined });
  const deletePerformance = useDeletePerformance();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
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
          <h1 className="text-4xl font-extrabold text-primary font-display">Performances</h1>
          <p className="text-muted-foreground mt-1">Manage upcoming shows, venues, and ticketing.</p>
        </div>
        <Button className="gap-2 rounded-full font-bold shadow-md"><Plus className="w-4 h-4" /> Add Performance</Button>
      </div>

      <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-card">
        <div className="p-4 border-b border-border bg-muted/10">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search performances..." 
              className="pl-9 rounded-xl bg-background border-muted shadow-sm focus-visible:ring-primary"
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
                        <span>{format(new Date(perf.date), "MMM d, yyyy")}</span>
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
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-secondary hover:bg-secondary/10">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(perf.id)}>
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
