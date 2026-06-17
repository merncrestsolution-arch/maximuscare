import type { IStorage } from "../storage";

export type AuditModule =
  | "attendance"
  | "salary"
  | "fine"
  | "patient"
  | "task"
  | "expense"
  | "staff"
  | "visit"
  | string;

export type AuditAction = "create" | "update" | "delete";

export async function logAudit(
  storage: IStorage,
  params: {
    userId: string;
    userName: string;
    module: AuditModule;
    action: AuditAction | string;
    recordId?: string;
    entityType?: string;
    entityId?: string;
    oldValue?: unknown;
    newValue?: unknown;
    ipAddress?: string | null;
  }
) {
  try {
    const oldJson = params.oldValue != null ? JSON.stringify(params.oldValue) : null;
    const newJson = params.newValue != null ? JSON.stringify(params.newValue) : null;
    const recordId = params.recordId ?? params.entityId ?? null;
    const entityType = params.entityType ?? params.module;

    await storage.createAuditLog({
      userId: params.userId,
      userName: params.userName,
      module: params.module,
      action: params.action,
      recordId,
      entityType,
      entityId: recordId,
      oldValues: oldJson,
      newValues: newJson,
      oldValue: oldJson,
      newValue: newJson,
      ipAddress: params.ipAddress ?? null,
    } as any);
  } catch (err) {
    console.error("[AUDIT] Failed to write audit log:", err);
  }
}
