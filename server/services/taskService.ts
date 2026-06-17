import type { IStorage } from "../storage";
import type { InsertTask, Task } from "@shared/schema";
import { clinicDateString, clinicDateOffset } from "../clinicTime";
import { sendNotification } from "./notificationService";

export const TASK_PRIORITY_MAP: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
  normal: "Medium",
};

export const TASK_STATUS_MAP: Record<string, string> = {
  pending: "Pending",
  "in progress": "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  overdue: "Overdue",
};

export function normalizePriority(p: string): string {
  return TASK_PRIORITY_MAP[p.toLowerCase()] ?? p;
}

export function normalizeStatus(s: string): string {
  return TASK_STATUS_MAP[s.toLowerCase()] ?? s;
}

export interface TaskDashboard {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
  dueToday: number;
}

export async function computeTaskDashboard(
  storage: IStorage,
  staffId?: string,
): Promise<TaskDashboard> {
  const today = clinicDateString();
  const tasks = staffId
    ? await storage.getTasksForStaff(staffId)
    : (await storage.getAllTasks()).filter((t) => !t.deletedAt);

  const active = tasks.filter((t) => {
    const st = normalizeStatus(t.status);
    return st !== "Cancelled" && st !== "Completed";
  });

  return {
    total: tasks.length,
    pending: active.filter((t) => normalizeStatus(t.status) === "Pending").length,
    completed: tasks.filter((t) => normalizeStatus(t.status) === "Completed").length,
    overdue: active.filter((t) => isTaskOverdue(t, today)).length,
    dueToday: active.filter((t) => t.dueDate === today).length,
  };
}

export function isTaskOverdue(task: Task, today: string = clinicDateString()): boolean {
  if (!task.dueDate) return false;
  const st = normalizeStatus(task.status);
  if (st === "Completed" || st === "Cancelled") return false;
  return task.dueDate < today;
}

export async function markOverdueTasks(storage: IStorage): Promise<number> {
  const today = clinicDateString();
  const all = await storage.getAllTasks();
  let count = 0;
  for (const t of all) {
    if (isTaskOverdue(t, today) && normalizeStatus(t.status) !== "Overdue") {
      await storage.updateTask(t.id, { status: "Overdue" });
      count++;
    }
  }
  return count;
}

export async function createTaskWithAssignments(
  storage: IStorage,
  data: InsertTask & { assignedStaffIds?: string[] },
  createdBy: { staffId: string; name: string },
): Promise<Task[]> {
  const taskType = data.taskType === "Common" ? "Common" : "Individual";
  const priority = normalizePriority(data.priority ?? "Medium");
  const status = normalizeStatus(data.status ?? "Pending");
  const created: Task[] = [];

  if (taskType === "Common") {
    const activeStaff = await storage.getActiveStaff();
    const primary = activeStaff[0];
    if (!primary) throw new Error("No active staff to assign common task");

    const task = await storage.createTask({
      ...data,
      taskType: "Common",
      priority,
      status,
      assignedToStaffId: primary.id,
      assignedToStaffName: "All Staff",
      createdByStaffId: createdBy.staffId,
      createdByName: createdBy.name,
    } as InsertTask);

    for (const s of activeStaff) {
      await storage.createTaskAssignment({
        taskId: task.id,
        staffId: s.id,
        status: "Pending",
      });
      await sendNotification(storage, {
        staffId: s.id,
        title: "New common task",
        message: data.title,
        type: "task_assignment",
      });
    }
    created.push(task);
  } else {
    const ids = data.assignedStaffIds?.length
      ? data.assignedStaffIds
      : [data.assignedToStaffId];
    for (const staffId of ids) {
      const assignee = await storage.getStaff(staffId);
      if (!assignee || assignee.isActive === false || (assignee.isActive as unknown) === 0) continue;
      const task = await storage.createTask({
        ...data,
        taskType: "Individual",
        priority,
        status,
        assignedToStaffId: assignee.id,
        assignedToStaffName: assignee.name,
        createdByStaffId: createdBy.staffId,
        createdByName: createdBy.name,
      } as InsertTask);
      await storage.createTaskAssignment({
        taskId: task.id,
        staffId: assignee.id,
        status: "Pending",
      });
      await sendNotification(storage, {
        staffId: assignee.id,
        title: "New task assigned",
        message: data.title,
        type: "task_assignment",
      });
      created.push(task);
    }
  }
  return created;
}

/** Send task due-date reminders (24h before, on due date, overdue). */
export async function runTaskReminders(storage: IStorage): Promise<number> {
  const today = clinicDateString();
  const tomorrow = clinicDateOffset(1);
  const all = (await storage.getAllTasks()).filter((t) => !t.deletedAt);
  let count = 0;

  for (const t of all) {
    const st = normalizeStatus(t.status);
    if (st === "Completed" || st === "Cancelled") continue;
    if (!t.dueDate) continue;

    const staffId = t.assignedToStaffId;
    if (t.dueDate === tomorrow && !t.reminderSentAt) {
      await sendNotification(storage, {
        staffId,
        title: "Task due tomorrow",
        message: `"${t.title}" is due on ${t.dueDate}`,
        type: "task_reminder",
      });
      await storage.updateTask(t.id, { reminderSentAt: new Date() } as any);
      count++;
    } else if (t.dueDate === today) {
      await sendNotification(storage, {
        staffId,
        title: "Task due today",
        message: `"${t.title}" is due today`,
        type: "task_reminder",
      });
      count++;
    } else if (isTaskOverdue(t, today) && !t.overdueNotifiedAt) {
      await sendNotification(storage, {
        staffId,
        title: "Task overdue",
        message: `"${t.title}" is overdue`,
        type: "task_reminder",
      });
      await storage.updateTask(t.id, { status: "Overdue", overdueNotifiedAt: new Date() } as any);
      if (normalizePriority(t.priority) === "Critical") {
        const managers = (await storage.getAllStaff()).filter(
          (s) => s.role === "Admin" || s.role === "MD",
        );
        for (const mgr of managers) {
          await sendNotification(storage, {
            staffId: mgr.id,
            title: "Critical task escalated",
            message: `"${t.title}" assigned to ${t.assignedToStaffName} is overdue`,
            type: "task_escalation",
          });
        }
      }
      count++;
    }
  }
  return count;
}
