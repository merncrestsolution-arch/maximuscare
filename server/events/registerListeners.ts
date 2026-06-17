import { onEvent } from "./eventBus";
import { storage } from "../storage";
import { sendNotification } from "../services/notificationService";
import { logAudit } from "../services/auditService";

/** Wire domain events to notification + audit side effects. */
export function registerEventListeners() {
  onEvent("task.assigned", async (event) => {
    const p = event.payload as { staffId: string; title: string; taskId: string };
    await sendNotification(storage, {
      staffId: p.staffId,
      title: "Task assigned",
      message: p.title,
      type: "task_assignment",
    });
  });

  onEvent("salary.approved", async (event) => {
    const p = event.payload as { staffId: string; month: string; amount: string };
    await sendNotification(storage, {
      staffId: p.staffId,
      title: "Salary approved",
      message: `Your salary for ${p.month} has been approved (${p.amount}).`,
      type: "salary",
    });
  });

  onEvent("fine.created", async (event) => {
    const p = event.payload as { staffId: string; amount: string; date: string };
    await sendNotification(storage, {
      staffId: p.staffId,
      title: "Fine recorded",
      message: `A fine of ${p.amount} was recorded for ${p.date}.`,
      type: "fine",
    });
  });

  onEvent("visit.created", async (event) => {
    const p = event.payload as { visitId: string; patientName: string };
    await logAudit(storage, {
      userId: event.userId ?? "system",
      userName: "System",
      module: "visit",
      action: "create",
      recordId: p.visitId,
      newValue: p,
    });
  });

  onEvent("patient.registered", async (event) => {
    const p = event.payload as { patientId: string; name: string };
    await logAudit(storage, {
      userId: event.userId ?? "system",
      userName: "System",
      module: "patient",
      action: "create",
      recordId: p.patientId,
      newValue: p,
    });
  });

  onEvent("notification.delivered", async (event) => {
    const p = event.payload as { notificationId: string; staffId: string; type: string };
    await logAudit(storage, {
      userId: "system",
      userName: "System",
      module: "notification",
      action: "deliver",
      recordId: p.notificationId,
      newValue: p,
    });
  });
}
