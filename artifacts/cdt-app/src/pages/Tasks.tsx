import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListTasksQueryKey,
  useCreateTask,
  useDeleteTask,
  useListTasks,
  useUpdateTask,
  type Task,
  type TaskInputPriority,
  type TaskInputStage,
  type TaskInput,
} from "@workspace/api-client-react";
import { ArrowRight, CalendarClock, Check, Clock, Edit2, LoaderCircle, Plus, Trash2, UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

type TaskForm = Required<Pick<TaskInput, "title">> & {
  description: string;
  stage: TaskInputStage;
  assigneeName: string;
  deadline: string;
  priority: TaskInputPriority;
  projectName: string;
};

const blankTask: TaskForm = {
  title: "",
  description: "",
  stage: "todo",
  assigneeName: "",
  deadline: "",
  priority: "normal",
  projectName: "CDT School Operations",
};

const columns: Array<{ key: TaskInputStage; label: string; description: string }> = [
  { key: "todo", label: "To do", description: "Ready to be assigned" },
  { key: "in_progress", label: "In progress", description: "Work currently underway" },
  { key: "done", label: "Done", description: "Completed work" },
  { key: "cancelled", label: "Cancelled", description: "Closed without completion" },
];

export default function Tasks() {
  const { data: tasksResponse, isLoading, isError } = useListTasks();
  const tasks = Array.isArray(tasksResponse) ? tasksResponse : [];
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<TaskForm>(blankTask);
  const [formError, setFormError] = useState("");

  const refreshTasks = () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
  const saving = createTask.isPending || updateTask.isPending;

  const openNewTask = () => {
    setEditingTask(null);
    setForm(blankTask);
    setFormError("");
    setEditorOpen(true);
  };

  const openEditTask = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      stage: task.stage,
      assigneeName: task.assigneeName ?? "",
      deadline: task.deadline ?? "",
      priority: task.priority,
      projectName: task.projectName ?? "CDT School Operations",
    });
    setFormError("");
    setEditorOpen(true);
  };

  const submitTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setFormError("Enter a task title before saving.");
      return;
    }
    const projectName = form.projectName.trim();
    if (!projectName) {
      setFormError("Enter an Odoo project before saving.");
      return;
    }
    setFormError("");
    const data: TaskInput = {
      title,
      description: form.description.trim(),
      stage: form.stage,
      assigneeName: form.assigneeName.trim(),
      deadline: form.deadline,
      priority: form.priority,
      projectName,
    };
    const options = {
      onSuccess: () => {
        refreshTasks();
        setEditorOpen(false);
        toast({ title: editingTask ? "Task updated" : "Task created", description: "The change has been saved directly to Odoo." });
      },
      onError: () => setFormError("Odoo could not save this task. Check the task details and try again."),
    };
    if (editingTask) updateTask.mutate({ id: editingTask.id, data }, options);
    else createTask.mutate({ data }, options);
  };

  const moveTask = (task: Task, stage: TaskInputStage) => {
    updateTask.mutate({ id: task.id, data: { stage } }, {
      onSuccess: () => { refreshTasks(); toast({ title: "Task stage updated", description: `${task.title} moved to ${columns.find((column) => column.key === stage)?.label}.` }); },
      onError: () => toast({ title: "Task stage was not updated", description: "Odoo rejected the change. Please try again.", variant: "destructive" }),
    });
  };

  const removeTask = (task: Task) => {
    if (!confirm(`Delete “${task.title}”? This also removes it from Odoo.`)) return;
    deleteTask.mutate({ id: task.id }, {
      onSuccess: () => { refreshTasks(); toast({ title: "Task deleted", description: "The task was removed from Odoo." }); },
      onError: () => toast({ title: "Task was not deleted", description: "Odoo rejected the request.", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Odoo project tasks</p><h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Tasks & to-do</h1><p className="mt-1 text-muted-foreground">Create, assign, schedule, and complete school operations work.</p></div>
        <Button className="min-h-11 gap-2" onClick={openNewTask}><Plus aria-hidden="true" className="h-4 w-4" />New task</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="flex items-center gap-2 font-medium text-muted-foreground"><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />Loading Odoo tasks…</div></div>
      ) : isError ? (
        <div className="border border-amber-300/70 bg-amber-50 p-5 text-sm text-amber-950">Odoo tasks could not be loaded. Check the integration settings.</div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => {
            const stageTasks = tasks.filter((task) => task.stage === column.key);
            return (
              <section key={column.key} aria-labelledby={`tasks-${column.key}`} className="min-h-[430px] border bg-muted/25 p-4">
                <div className="mb-4 px-1"><div className="flex items-center justify-between"><h2 id={`tasks-${column.key}`} className="font-display text-base font-semibold text-primary">{column.label}</h2><Badge variant="secondary" className="border bg-background">{stageTasks.length}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{column.description}</p></div>
                <div className="space-y-3">
                  {stageTasks.map((task) => <TaskCard key={task.id} task={task} moving={updateTask.isPending} onEdit={openEditTask} onDelete={removeTask} onMove={moveTask} />)}
                  {stageTasks.length === 0 && <div className="border border-dashed bg-background/60 px-4 py-10 text-center text-sm text-muted-foreground">No tasks in this stage.</div>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={(open) => { if (!saving) setEditorOpen(open); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-display text-xl">{editingTask ? "Edit task" : "Create task"}</DialogTitle><DialogDescription>{editingTask ? "Update the Odoo task details and workflow stage." : "Add a school operations task directly to Odoo."}</DialogDescription></DialogHeader>
          <form onSubmit={submitTask} className="space-y-5">
            {formError && <div role="alert" className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{formError}</div>}
            <div className="space-y-2"><Label htmlFor="task-title">Task title <span aria-hidden="true" className="text-destructive">*</span></Label><Input id="task-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} onBlur={() => { if (!form.title.trim()) setFormError("Enter a task title before saving."); }} required autoFocus className="min-h-11" /></div>
            <div className="space-y-2"><Label htmlFor="task-description">Description</Label><Textarea id="task-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="Add the outcome, context, or instructions for this task." /></div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="task-stage">Stage</Label><select id="task-stage" value={form.stage} onChange={(event) => setForm((current) => ({ ...current, stage: event.target.value as TaskInputStage }))} className="min-h-11 w-full border border-input bg-background px-3 text-sm">{columns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="task-priority">Priority</Label><select id="task-priority" value={form.priority === "low" ? "normal" : form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as TaskInputPriority }))} className="min-h-11 w-full border border-input bg-background px-3 text-sm"><option value="normal">Normal</option><option value="high">High</option></select></div>
              <div className="space-y-2"><Label htmlFor="task-assignee">Assignee name</Label><Input id="task-assignee" value={form.assigneeName} onChange={(event) => setForm((current) => ({ ...current, assigneeName: event.target.value }))} placeholder="Match an Odoo user's name" className="min-h-11" /><p className="text-xs text-muted-foreground">Leave blank to keep the task unassigned.</p></div>
              <div className="space-y-2"><Label htmlFor="task-deadline">Due date</Label><Input id="task-deadline" type="date" value={form.deadline} onChange={(event) => setForm((current) => ({ ...current, deadline: event.target.value }))} className="min-h-11" /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="task-project">Project</Label><Input id="task-project" value={form.projectName} onChange={(event) => setForm((current) => ({ ...current, projectName: event.target.value }))} required className="min-h-11" /><p className="text-xs text-muted-foreground">Tasks use the CDT School Operations project by default. Odoo creates another project when a new name is entered.</p></div>
            </div>
            <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={() => setEditorOpen(false)} disabled={saving} className="min-h-11">Cancel</Button><Button type="submit" disabled={saving || !form.title.trim() || !form.projectName.trim()} className="min-h-11 gap-2">{saving ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Check aria-hidden="true" className="h-4 w-4" />}{saving ? "Saving…" : editingTask ? "Save changes" : "Create task"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskCard({ task, moving, onEdit, onDelete, onMove }: { task: Task; moving: boolean; onEdit: (task: Task) => void; onDelete: (task: Task) => void; onMove: (task: Task, stage: TaskInputStage) => void }) {
  const next = task.stage === "todo" ? { stage: "in_progress" as const, label: "Start" } : task.stage === "in_progress" ? { stage: "done" as const, label: "Complete" } : task.stage === "done" ? { stage: "todo" as const, label: "Reopen" } : { stage: "todo" as const, label: "Restore" };
  const priorityClass = task.priority === "high" ? "border-rose-200 bg-rose-50 text-rose-700" : task.priority === "low" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-800";
  return <Card><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-semibold leading-snug text-primary">{task.title}</h3><Badge variant="outline" className={`shrink-0 capitalize ${priorityClass}`}>{task.priority}</Badge></div>{task.description && <p className="line-clamp-3 text-sm leading-5 text-muted-foreground">{task.description}</p>}<div className="space-y-1.5 border-t pt-3 text-xs text-muted-foreground">{task.assigneeName && <p className="flex items-center gap-2"><UserRound aria-hidden="true" className="h-3.5 w-3.5" />{task.assigneeName}</p>}{task.deadline ? <p className="flex items-center gap-2"><CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />Due {format(parseISO(task.deadline), "MMM d, yyyy")}</p> : <p className="flex items-center gap-2 italic"><Clock aria-hidden="true" className="h-3.5 w-3.5" />No due date</p>}{task.projectName && <p className="truncate">{task.projectName}</p>}</div><div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><Button type="button" size="sm" variant="outline" onClick={() => onMove(task, next.stage)} disabled={moving} className="min-h-9 gap-1.5">{next.label}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Button><div className="flex gap-1"><Button aria-label={`Edit ${task.title}`} type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={() => onEdit(task)}><Edit2 aria-hidden="true" className="h-4 w-4" /></Button><Button aria-label={`Delete ${task.title}`} type="button" variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:bg-destructive/10" onClick={() => onDelete(task)}><Trash2 aria-hidden="true" className="h-4 w-4" /></Button></div></div></CardContent></Card>;
}
