import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, useStaff, useTaskDashboard } from "@/hooks/useData";
import { canManageTasks } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PRIORITY_CLASS: Record<string, string> = {
  Low: "bg-slate-100 text-slate-700",
  Medium: "bg-blue-100 text-blue-800",
  High: "bg-amber-100 text-amber-800",
  Critical: "bg-red-100 text-red-800",
};

function TasksContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMgmt = canManageTasks(user?.role);
  const { data: tasks = [], isLoading } = useTasks({ all: isMgmt });
  const { data: dash } = useTaskDashboard(isMgmt);
  const { data: staff = [] } = useStaff({ includeInactive: false });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [open, setOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState<any>(null);
  const [completionNotes, setCompletionNotes] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedToStaffId: "",
    taskType: "Individual",
    priority: "Medium",
    dueDate: "",
    remarks: "",
  });

  const submit = async () => {
    try {
      await createTask.mutateAsync(form);
      toast({ title: "Task created" });
      setOpen(false);
      setForm({
        title: "",
        description: "",
        assignedToStaffId: "",
        taskType: "Individual",
        priority: "Medium",
        dueDate: "",
        remarks: "",
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const completeTask = async () => {
    if (!completeOpen) return;
    try {
      await updateTask.mutateAsync({
        id: completeOpen.id,
        data: { status: "Completed", completionNotes },
      });
      toast({ title: "Task completed" });
      setCompleteOpen(null);
      setCompletionNotes("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tasks</h1>
        {isMgmt && (
          <Button size="compact" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New task
          </Button>
        )}
      </div>

      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total", value: dash.total },
            { label: "Pending", value: dash.pending },
            { label: "Completed", value: dash.completed },
            { label: "Overdue", value: dash.overdue },
            { label: "Due today", value: dash.dueToday },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="p-3">
                <div className="text-xs text-muted-foreground">{k.label}</div>
                <div className="text-xl font-bold">{k.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((t: any) => {
            const priority = t.priority === "normal" ? "Medium" : t.priority;
            const status = t.status?.charAt(0).toUpperCase() + t.status?.slice(1);
            return (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{t.title}</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${PRIORITY_CLASS[priority] || PRIORITY_CLASS.Medium}`}>
                          {priority}
                        </span>
                        {t.taskType === "Common" && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800">
                            Common
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs uppercase font-bold text-muted-foreground">{status}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                  <p className="text-xs text-muted-foreground">
                    {t.taskType === "Common" ? "All staff" : `Assigned to ${t.assignedToStaffName}`}
                    {t.dueDate ? ` · Due ${t.dueDate}` : ""}
                  </p>
                  <div className="flex gap-2">
                    {status !== "Completed" && status !== "Cancelled" && (
                      <Button size="sm" variant="outline" onClick={() => setCompleteOpen(t)}>
                        Mark completed
                      </Button>
                    )}
                    {isMgmt && (
                      <Button size="sm" variant="ghost" onClick={() => deleteTask.mutate(t.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Task type</Label>
              <Select value={form.taskType} onValueChange={(v) => setForm({ ...form, taskType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Individual">Individual</SelectItem>
                  <SelectItem value="Common">Common (all staff)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.taskType === "Individual" && (
              <div>
                <Label>Assign to</Label>
                <Select value={form.assignedToStaffId} onValueChange={(v) => setForm({ ...form, assignedToStaffId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                  <SelectContent>
                    {staff.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Low", "Medium", "High", "Critical"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <Label>Remarks</Label>
              <Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={!form.title || (form.taskType === "Individual" && !form.assignedToStaffId)}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completeOpen} onOpenChange={(o) => !o && setCompleteOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete task</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Completion notes</Label>
            <Textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={completeTask}>Mark completed</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TasksContent;
