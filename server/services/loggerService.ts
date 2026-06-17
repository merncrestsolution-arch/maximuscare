import { db, schema } from "../db";
import { sql } from "drizzle-orm";

const usePostgres = !!process.env.DATABASE_URL?.startsWith("postgresql");

export type LogLevel = "info" | "warn" | "error";

export interface SystemLogInput {
  level?: LogLevel;
  category: string;
  message: string;
  userId?: string;
  ipAddress?: string;
  action?: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
}

let systemLogsTableReady = false;

async function ensureSystemLogsTable() {
  if (systemLogsTableReady) return;
  try {
    const { runPart8SchemaMigration } = await import("../migrations/part8SchemaMigration");
    await runPart8SchemaMigration();
    systemLogsTableReady = true;
  } catch {
    /* logging must not crash app */
  }
}

export async function writeSystemLog(input: SystemLogInput): Promise<void> {
  try {
    await ensureSystemLogsTable();
    const id = crypto.randomUUID();
    const now = Date.now();
    const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
    const stmt = usePostgres
      ? sql`INSERT INTO system_logs (id, level, category, message, user_id, ip_address, action, stack_trace, metadata, created_at)
            VALUES (${id}, ${input.level ?? "info"}, ${input.category}, ${input.message}, ${input.userId ?? null}, ${input.ipAddress ?? null}, ${input.action ?? null}, ${input.stackTrace ?? null}, ${metadata}, NOW())`
      : sql`INSERT INTO system_logs (id, level, category, message, user_id, ip_address, action, stack_trace, metadata, created_at)
            VALUES (${id}, ${input.level ?? "info"}, ${input.category}, ${input.message}, ${input.userId ?? null}, ${input.ipAddress ?? null}, ${input.action ?? null}, ${input.stackTrace ?? null}, ${metadata}, ${now})`;
    await db.run(stmt);
  } catch (err) {
    console.error("[LOGGER] Failed to persist log:", err);
  }
}

export function logAuthAttempt(params: {
  email: string;
  success: boolean;
  ipAddress?: string;
  reason?: string;
}) {
  const prefix = params.success ? "AUTH_OK" : "AUTH_FAIL";
  console.log(`[${prefix}] ${params.email} from ${params.ipAddress ?? "unknown"}${params.reason ? ` — ${params.reason}` : ""}`);
  void writeSystemLog({
    level: params.success ? "info" : "warn",
    category: "auth",
    message: params.success ? "Login successful" : `Login failed: ${params.reason ?? "invalid credentials"}`,
    ipAddress: params.ipAddress,
    action: "login",
    metadata: { email: params.email },
  });
}

export function logSystemError(input: Omit<SystemLogInput, "level">) {
  console.error(`[ERROR][${input.category}] ${input.message}`);
  void writeSystemLog({ ...input, level: "error" });
}

export function logFileUploadFailure(message: string, meta?: Record<string, unknown>) {
  void writeSystemLog({ level: "warn", category: "file_upload", message, metadata: meta });
}
