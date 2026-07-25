import { useListTasks, useDeleteTask, getListTasksQueryKey, useCreateTask } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Tasks() {
  const { data: tasks, isLoading } = useListTasks();
  const deleteTask = useDeleteTask();
  const createTask = useCreateTask();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    if (confirm("Delete this task?")) {
      deleteTask.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast({ title: "Task deleted successfully" });
        }
      });
    }
  };

  const handleAdd = () => {
    createTask.mutate({
      data: {
        title: "New Task",
        stage: "todo",
        priority: "normal",
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        toast({ title: "Draft task created. Please edit to add details." });
      }
    });
  };

  const stages = ['todo', 'in_progress', 'done'];
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-rose-600 bg-rose-500/10 border-rose-200';
      case 'normal': return 'text-amber-600 bg-amber-500/10 border-amber-200';
      case 'low': return 'text-blue-600 bg-blue-500/10 border-blue-200';
      default: return 'text-gray-600 bg-gray-500/10 border-gray-200';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-primary font-display">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage school operations and assignments.</p>
        </div>
        <Button className="gap-2 rounded-full font-bold shadow-md bg-secondary text-secondary-foreground hover:bg-secondary/90" onClick={handleAdd}>
          <Plus className="w-4 h-4" /> New Task
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="animate-pulse font-medium text-muted-foreground">Loading tasks...</div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {stages.map(stage => {
            const stageTasks = tasks?.filter(t => t.stage === stage) || [];
            
            return (
              <div key={stage} className="bg-muted/40 rounded-3xl p-4 min-h-[500px] border border-border/50">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="font-bold text-lg capitalize flex items-center gap-2 text-primary font-display">
                    {stage.replace('_', ' ')}
                    <Badge variant="secondary" className="rounded-full bg-background border shadow-sm px-2">
                      {stageTasks.length}
                    </Badge>
                  </h3>
                </div>
                
                <div className="space-y-4">
                  {stageTasks.map(task => (
                    <Card key={task.id} className="border-none shadow-sm hover:shadow-md transition-all group cursor-pointer bg-card rounded-2xl">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-primary leading-tight">{task.title}</h4>
                          <Badge variant="outline" className={`px-2 py-0 capitalize text-[10px] font-bold shadow-sm ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </Badge>
                        </div>
                        
                        {task.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">{task.description}</p>
                        )}
                        
                        <div className="flex items-center justify-between pt-3 border-t mt-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            {task.deadline ? (
                              <>
                                <Clock className="w-3.5 h-3.5" />
                                {format(new Date(task.deadline), "MMM d")}
                              </>
                            ) : (
                              <span className="italic opacity-50">No due date</span>
                            )}
                          </div>
                          
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-secondary hover:bg-secondary/10" onClick={(e) => { e.stopPropagation(); toast({ title: "Edit coming soon" }); }}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {stageTasks.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground/50 text-sm font-medium border-2 border-dashed border-muted-foreground/10 rounded-2xl bg-background/50">
                      No tasks in this stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
