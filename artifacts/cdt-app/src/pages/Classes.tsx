import { useState } from "react";
import { useListClasses, useDeleteClass, getListClassesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Trash2, Edit2, MapPin, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Classes() {
  const [search, setSearch] = useState("");
  const { data: classes, isLoading } = useListClasses({ search: search || undefined });
  const deleteClass = useDeleteClass();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this class?")) {
      deleteClass.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClassesQueryKey() });
          toast({ title: "Class deleted successfully" });
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-primary font-display">Classes</h1>
          <p className="text-muted-foreground mt-1">Manage dance classes, styles, and schedules.</p>
        </div>
        <Button className="gap-2 rounded-full font-bold shadow-md bg-secondary text-secondary-foreground hover:bg-secondary/90"><Plus className="w-4 h-4" /> Add Class</Button>
      </div>

      <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-card">
        <div className="p-4 border-b border-border bg-muted/10">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search classes by name or style..." 
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
                <TableHead className="font-semibold text-primary">Class Name & Style</TableHead>
                <TableHead className="font-semibold text-primary">Instructor</TableHead>
                <TableHead className="font-semibold text-primary">Schedule & Location</TableHead>
                <TableHead className="font-semibold text-primary">Enrollment</TableHead>
                <TableHead className="text-right font-semibold text-primary">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium animate-pulse">Loading classes...</TableCell></TableRow>
              ) : classes?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">No classes found.</TableCell></TableRow>
              ) : (
                classes?.map(cls => (
                  <TableRow key={cls.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell>
                      <div className="font-bold text-primary text-base">{cls.name}</div>
                      <div className="text-xs font-semibold text-secondary uppercase tracking-wider mt-0.5">{cls.style}</div>
                    </TableCell>
                    <TableCell className="font-medium">{cls.instructor}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{cls.schedule}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{cls.location}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${Math.min(100, (cls.enrolledCount / cls.capacity) * 100)}%` }} 
                          />
                        </div>
                        <span className="text-sm font-medium font-mono">
                          {cls.enrolledCount}/{cls.capacity}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-secondary hover:bg-secondary/10">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(cls.id)}>
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
