import { useState } from "react";
import { useListContacts, getListContactsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Building2, User, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Contacts() {
  const [search, setSearch] = useState("");
  const { data: contacts, isLoading } = useListContacts({ search: search || undefined });
  const { toast } = useToast();

  const handleAdd = () => {
    toast({ title: "Feature coming soon", description: "Add contact form is under construction." });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-primary font-display">Contacts</h1>
          <p className="text-muted-foreground mt-1">Manage individuals and companies synced from Odoo.</p>
        </div>
        <Button className="gap-2 rounded-full font-bold shadow-md bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={handleAdd}>
          <Plus className="w-4 h-4" /> Add Contact
        </Button>
      </div>

      <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-card">
        <div className="p-4 border-b border-border bg-muted/10">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search contacts..." 
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
                <TableHead className="font-semibold text-primary">Name</TableHead>
                <TableHead className="font-semibold text-primary">Type</TableHead>
                <TableHead className="font-semibold text-primary">Contact Info</TableHead>
                <TableHead className="font-semibold text-primary">Location</TableHead>
                <TableHead className="text-right font-semibold text-primary">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium animate-pulse">Loading contacts...</TableCell></TableRow>
              ) : contacts?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">No contacts found.</TableCell></TableRow>
              ) : (
                contacts?.map(contact => (
                  <TableRow key={contact.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell>
                      <div className="font-bold text-primary flex items-center gap-2">
                        {contact.type === 'company' ? <Building2 className="w-4 h-4 text-secondary" /> : <User className="w-4 h-4 text-primary/60" />}
                        {contact.name}
                      </div>
                      {contact.company && contact.type === 'individual' && (
                        <div className="text-xs text-muted-foreground mt-0.5 ml-6">{contact.company}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize shadow-sm">
                        {contact.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{contact.email || <span className="text-muted-foreground italic">-</span>}</div>
                      <div className="text-xs text-muted-foreground">{contact.phone || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{contact.city || <span className="text-muted-foreground italic">-</span>}</div>
                      <div className="text-xs text-muted-foreground">{contact.country || ''}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-secondary hover:bg-secondary/10" onClick={() => toast({ title: "Edit coming soon" })}>
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
