/**
 * Part 18 — GPS coordinates on attendance records (Bug 6).
 * Stores the real device latitude/longitude captured at check-in so the dashboard
 * can show the staff member's location and link it to Google Maps.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";

const usePostgres = !!process.env.DATABASE_URL?.startsWith("postgres");

async function run(statement: string) {
  const query = sql.raw(statement);
  if (usePostgres) {
    await (db as { execute: (q: ReturnType<typeof sql.raw>) => Promise<unknown> }).execute(query);
  } else {
    await db.run(query);
  }
}

async function addColumn(table: string, column: string, definition: string) {
  try {
    if (usePostgres) {
      await run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
    } else {
      await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  } catch (error: unknown) {
    const msg = String((error as Error)?.message ?? "");
    if (msg.includes("duplicate column") || msg.includes("already exists")) return;
    throw error;
  }
}

export async function runPart18AttendanceGeo() {
  await addColumn("attendance", "latitude", "TEXT");
  await addColumn("attendance", "longitude", "TEXT");
  await addColumn("attendance", "location_label", "TEXT");
}
