import { useState } from "react";
import { useListStudents, useCreateStudent, useDeleteStudent, getListStudentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Trash2, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Students() {
  const [search, setSearch] = useState("");
  const { data: students, isLoading } = useListStudents({ search: search || undefined });
  const deleteStudent = useDeleteStudent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this student?")) {
      deleteStudent.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
          toast({ title: "Student deleted successfully" });
        }
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-primary font-display">Students</h1>
          <p className="text-muted-foreground mt-1">Manage enrolled students and their details.</p>
        </div>
        <Button className="gap-2 rounded-full font-bold shadow-md"><Plus className="w-4 h-4" /> Add Student</Button>
      </div>

      <Card className="shadow-xl border-none rounded-2xl overflow-hidden bg-card">
        <div className="p-4 border-b border-border bg-muted/10">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search students by name..." 
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
                <TableHead className="font-semibold text-primary">Name</TableHead>
                <TableHead className="font-semibold text-primary">Status</TableHead>
                <TableHead className="font-semibold text-primary">Contact</TableHead>
                <TableHead className="font-semibold text-primary">Enrolled Classes</TableHead>
                <TableHead className="text-right font-semibold text-primary">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium animate-pulse">Loading students...</TableCell></TableRow>
              ) : students?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground font-medium">No students found.</TableCell></TableRow>
              ) : (
                students?.map(student => (
                  <TableRow key={student.id} className="group transition-colors hover:bg-muted/20">
                    <TableCell className="font-bold text-primary">{student.firstName} {student.lastName}</TableCell>
                    <TableCell>
                      <Badge variant={student.status === 'active' ? 'default' : 'secondary'} className="rounded-md capitalize shadow-sm">
                        {student.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{student.email || <span className="text-muted-foreground italic">No email</span>}</div>
                      <div className="text-xs text-muted-foreground">{student.phone || 'No phone'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono bg-background">
                        {student.enrolledClassIds.length} classes
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-secondary hover:bg-secondary/10">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(student.id)}>
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
