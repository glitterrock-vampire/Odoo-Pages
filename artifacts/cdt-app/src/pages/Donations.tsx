import { useState } from "react";
import { useListDonations } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Heart, Edit2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function Donations() {
  const [search, setSearch] = useState("");
  const { data: donations, isLoading } = useListDonations({ search: search || undefined });
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'draft': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'cancelled': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleAdd = () => {
    toast({ title: "Create donation", description: "This will open the donation form." });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-primary font-display">Donations</h1>
          <p className="text-muted-foreground mt-1">Track and manage community contributions.</p>
        </div>
        <Button className="gap-2 rounded-full font-bold shadow-md bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={handleAdd}>
          <Plus className="w-4 h-4" /> Add Donation
        </Button>
      </div>

      <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-card">
        <div className="p-4 border-b border-border bg-muted/10">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by donor name..." 
              className="pl-9 rounded-xl bg-background border-muted shadow-sm focus-visible:ring-secondary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-primary">Donor</TableHead>
                <TableHead className="font-semibold text-primary">Amount</TableHead>
                <TableHead className="font-semibold text-primary">Campaign</TableHead>
                <TableHead className="font-semibold text-primary">Status</TableHead>
                <TableHead className="text-right font-semibold text-primary">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium animate-pulse">Loading donations...</TableCell></TableRow>
              ) : donations?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium flex flex-col items-center justify-center">
                  <Heart className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  No donations found.
                </TableCell></TableRow>
              ) : (
                donations?.map(donation => (
                  <TableRow key={donation.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell>
                      <div className="font-bold text-primary">{donation.donorName}</div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(donation.date), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-lg font-black font-display text-primary">
                        {donation.currency} {donation.amount.toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{donation.campaign || <span className="text-muted-foreground italic">General</span>}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`capitalize shadow-sm font-semibold ${getStatusColor(donation.status)}`}>
                        {donation.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-secondary hover:bg-secondary/10" onClick={() => toast({ title: "Edit clicked" })}>
                          <Edit2 className="w-4 h-4" />
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
