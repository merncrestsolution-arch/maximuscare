import { eq, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { organizationForBranch } from "@shared/branchAccess";
import { nextPatientCode, bumpPatientCode } from "@shared/patientId";
import { signPatientQrToken, verifyPatientQrToken } from "../services/qrTokenService";

const usePostgres = !!process.env.DATABASE_URL?.startsWith("postgres");
const { patients } = schema;

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

function tokenExpiryDate(token: string): Date | null {
  const verified = verifyPatientQrToken(token);
  if (!verified.ok || !verified.payload?.exp) return null;
  return new Date(verified.payload.exp * 1000);
}

function isValidToken(token: string, patientId: string, organizationId: string): boolean {
  const verified = verifyPatientQrToken(token);
  return (
    verified.ok &&
    verified.payload?.patientId === patientId &&
    verified.payload?.organizationId === organizationId
  );
}

type PatientRow = {
  id: string;
  branch: string;
  registeredDate: string;
  patientCode: string | null;
  qrToken: string | null;
  dataVersion: number | null;
  dataMigratedAt: Date | string | null;
};

export async function runPart27PatientDataVersion() {
  await addColumn("patients", "data_version", usePostgres ? "INTEGER NOT NULL DEFAULT 2" : "INTEGER NOT NULL DEFAULT 2");
  await addColumn("patients", "data_migrated_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("patients", "qr_token", usePostgres ? "TEXT" : "TEXT");
  await addColumn("patients", "qr_token_expires_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("patients", "id_card_pdf_key", usePostgres ? "TEXT" : "TEXT");
  await addColumn("patients", "id_card_qr_token", usePostgres ? "TEXT" : "TEXT");
  await addColumn("patients", "id_card_generated_at", usePostgres ? "TIMESTAMP" : "INTEGER");

  await addColumn("in_patient_admissions", "qr_token", usePostgres ? "TEXT" : "TEXT");
  await addColumn("in_patient_admissions", "qr_token_expires_at", usePostgres ? "TIMESTAMP" : "INTEGER");
  await addColumn("in_patient_admissions", "id_card_pdf_key", usePostgres ? "TEXT" : "TEXT");
  await addColumn("in_patient_admissions", "id_card_qr_token", usePostgres ? "TEXT" : "TEXT");
  await addColumn("in_patient_admissions", "id_card_generated_at", usePostgres ? "TIMESTAMP" : "INTEGER");

  const rows: PatientRow[] = await db
    .select({
      id: patients.id,
      branch: patients.branch,
      registeredDate: patients.registeredDate,
      patientCode: patients.patientCode,
      qrToken: (patients as any).qrToken,
      dataVersion: (patients as any).dataVersion,
      dataMigratedAt: (patients as any).dataMigratedAt,
    })
    .from(patients);

  if (rows.length === 0) return;

  const assigned = new Set(
    rows.map((r) => String(r.patientCode ?? "").trim()).filter(Boolean),
  );
  const existingCodes = rows.map((r) => r.patientCode);
  const now = new Date();

  for (const row of rows) {
    const patch: Record<string, unknown> = {};
    if (!String(row.patientCode ?? "").trim()) {
      let code = nextPatientCode(existingCodes, row.branch, row.registeredDate);
      let guard = 0;
      while (assigned.has(code) && guard < 1000) {
        code = bumpPatientCode(code);
        guard += 1;
      }
      assigned.add(code);
      existingCodes.push(code);
      patch.patientCode = code;
    }

    const org = organizationForBranch(row.branch);
    const token = String(row.qrToken ?? "").trim();
    if (!token || !isValidToken(token, row.id, org)) {
      const nextToken = signPatientQrToken({ patientId: row.id, organizationId: org });
      patch.qrToken = nextToken;
      patch.qrTokenExpiresAt = tokenExpiryDate(nextToken);
    }

    const needsMigrationStamp =
      !row.dataVersion || row.dataVersion < 2 || !row.dataMigratedAt;
    if (needsMigrationStamp) {
      patch.dataVersion = 2;
      patch.dataMigratedAt = now;
    }

    if (!patch.dataMigratedAt && (patch.patientCode || patch.qrToken)) {
      patch.dataMigratedAt = now;
    }

    if (Object.keys(patch).length > 0) {
      patch.updatedAt = now;
      await db.update(patients).set(patch).where(eq(patients.id, row.id));
    }
  }
}
