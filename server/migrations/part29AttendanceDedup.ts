/**
 * Part 29 — dedupe active attendance rows per staff+day and enforce a partial
 * unique index so only one non-deleted record can exist for (staff_id, date).
 */
import { eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "../db";
import {
  compareAttendanceRecords,
  normalizeAttendanceDate,
} from "../services/calculationEngine";

const { attendance } = schema;
const usePostgres = !!process.env.DATABASE_URL?.startsWith("postgresql");

async function run(statement: string) {
  const query = sql.raw(statement);
  if (usePostgres) {
    await (db as { execute: (q: ReturnType<typeof sql.raw>) => Promise<unknown> }).execute(query);
  } else {
    await db.run(query);
  }
}

export async function runPart29AttendanceDedup(): Promise<void> {
  const rows = await db.select().from(attendance).where(isNull(attendance.deletedAt));

  const groups = new Map<string, (typeof rows)[number][]>();
  for (const row of rows) {
    const key = `${row.staffId}|${normalizeAttendanceDate(row.date)}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  let removed = 0;
  for (const [, group] of groups) {
    if (group.length <= 1) {
      const only = group[0];
      const normDate = normalizeAttendanceDate(only.date);
      if (only.date !== normDate) {
        await db.update(attendance).set({ date: normDate, updatedAt: new Date() }).where(eq(attendance.id, only.id));
      }
      continue;
    }

    const sorted = [...group].sort((a, b) => compareAttendanceRecords(b, a));
    const keeper = sorted[0];
    const normDate = normalizeAttendanceDate(keeper.date);
    if (keeper.date !== normDate) {
      await db.update(attendance).set({ date: normDate, updatedAt: new Date() }).where(eq(attendance.id, keeper.id));
    }

    for (const dup of sorted.slice(1)) {
      await db
        .update(attendance)
        .set({ deletedAt: new Date(), deletedBy: "migration-part29", updatedAt: new Date() })
        .where(eq(attendance.id, dup.id));
      removed += 1;
    }
  }

  try {
    await run("DROP INDEX IF EXISTS attendance_staff_date_unique");
  } catch {
    /* legacy index may not exist */
  }

  const partialUnique =
    "CREATE UNIQUE INDEX IF NOT EXISTS attendance_staff_date_active_unique ON attendance(staff_id, date) WHERE deleted_at IS NULL";
  try {
    await run(partialUnique);
  } catch (error: unknown) {
    const msg = String((error as Error)?.message ?? "");
    if (!msg.includes("already exists") && !msg.includes("duplicate")) {
      throw error;
    }
  }

  if (removed > 0) {
    console.log(`[migration] Part 29: soft-deleted ${removed} duplicate attendance row(s)`);
  }
}
