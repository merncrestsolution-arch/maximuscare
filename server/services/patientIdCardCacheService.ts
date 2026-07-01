import type { Patient, InPatientAdmission } from "@shared/schema";
import type { OrganizationId } from "@shared/branchAccess";
import type { IStorage } from "../storage";
import {
  generatePatientCardPdf,
  deterministicCardId,
  computePatientCardContentHash,
} from "./patientIdCardService";
import { getDocumentReadStream, storeGeneratedFile, deleteStoredDocument } from "./fileStorageService";
import { verifyPatientQrToken } from "./qrTokenService";

const TIMING_ENABLED = process.env.ID_CARD_TIMING === "1";

function isValidToken(token: string, patientId: string, organizationId: OrganizationId): boolean {
  const verified = verifyPatientQrToken(token);
  return (
    verified.ok &&
    verified.payload?.patientId === patientId &&
    verified.payload?.organizationId === organizationId
  );
}

function cardStorageKey(kind: "patient" | "inpatient", id: string, contentHash: string): string {
  return `id-cards/${kind}/${id}/${contentHash}.pdf`;
}

async function readCachedPdf(storageKey: string): Promise<Buffer | null> {
  try {
    const { body } = await getDocumentReadStream(storageKey);
    return body;
  } catch {
    return null;
  }
}

export type PatientCardPdfInput = {
  id: string;
  name: string;
  phone: string;
  address: string;
  patientCode: string;
  qrToken: string;
};

export function buildPatientCardPdfInput(
  patient: Patient,
  qrToken: string,
): PatientCardPdfInput {
  const code = patient.patientCode ?? patient.id;
  return {
    id: code,
    name: patient.name ?? "—",
    phone: patient.phone ?? "",
    address: patient.address ?? "",
    patientCode: code,
    qrToken,
  };
}

export function patientCardContentHashFromInput(input: PatientCardPdfInput): string {
  const cardId = deterministicCardId(input.patientCode);
  return computePatientCardContentHash({
    name: input.name,
    phone: input.phone,
    address: input.address,
    id: input.id,
    cardId,
    qrToken: input.qrToken,
  });
}

const ID_CARD_PATIENT_FIELDS = ["name", "phone", "address", "patientCode", "branch"] as const;

/** True when a patient update should invalidate the cached ID card PDF. */
export function patientIdCardFieldsChanged(before: Patient, after: Patient): boolean {
  return ID_CARD_PATIENT_FIELDS.some((key) => {
    const a = String((before as any)[key] ?? "").trim();
    const b = String((after as any)[key] ?? "").trim();
    return a !== b;
  });
}

/** Remove cached PDF file and clear DB keys for a patient. */
export async function invalidatePatientIdCard(storage: IStorage, patient: Patient): Promise<void> {
  const cachedKey = String(patient.idCardPdfKey ?? "").trim();
  if (cachedKey) {
    try {
      await deleteStoredDocument(cachedKey);
    } catch {
      // ignore missing file
    }
  }
  await storage.updatePatient(patient.id, {
    idCardPdfKey: null,
    idCardQrToken: null,
    idCardGeneratedAt: null,
  } as any);
}

async function createAndStorePdf(
  kind: "patient" | "inpatient",
  recordId: string,
  input: PatientCardPdfInput,
  contentHash: string,
): Promise<{ pdf: Buffer; storageKey: string }> {
  const cardId = deterministicCardId(input.patientCode);
  const t0 = Date.now();
  const pdf = await generatePatientCardPdf({
    id: input.id,
    name: input.name,
    phone: input.phone,
    address: input.address,
    cardId,
    qrToken: input.qrToken,
  });
  if (TIMING_ENABLED) {
    console.log(`[id-card] generate pdf (${kind}/${recordId}): ${Date.now() - t0}ms`);
  }
  const storageKey = cardStorageKey(kind, recordId, contentHash);
  await storeGeneratedFile(storageKey, pdf, "application/pdf");
  return { pdf, storageKey };
}

export async function getOrCreatePatientCardPdf(options: {
  storage: IStorage;
  patient: Patient;
  organizationId: OrganizationId;
  qrToken: string;
  providedToken?: string;
}): Promise<Buffer> {
  const { storage, patient, organizationId, qrToken, providedToken } = options;
  const expectedPatientId = patient.id;
  const provided = String(providedToken ?? "").trim();
  const desiredToken =
    provided && isValidToken(provided, expectedPatientId, organizationId)
      ? provided
      : qrToken;

  const input = buildPatientCardPdfInput(patient, desiredToken);
  const contentHash = patientCardContentHashFromInput(input);
  const expectedKey = cardStorageKey("patient", patient.id, contentHash);
  const cachedKey = String((patient as any).idCardPdfKey ?? "");

  if (cachedKey === expectedKey) {
    const t0 = Date.now();
    const cached = await readCachedPdf(expectedKey);
    if (cached) {
      if (TIMING_ENABLED) {
        console.log(`[id-card] cache hit (patient/${patient.id}): ${Date.now() - t0}ms`);
      }
      return cached;
    }
  }

  const { pdf, storageKey } = await createAndStorePdf("patient", patient.id, input, contentHash);

  if (cachedKey && cachedKey !== storageKey) {
    await deleteStoredDocument(cachedKey);
  }

  await storage.updatePatient(patient.id, {
    idCardPdfKey: storageKey,
    idCardQrToken: desiredToken,
    idCardGeneratedAt: new Date(),
  });

  return pdf;
}

export async function getOrCreateAdmissionCardPdf(options: {
  storage: IStorage;
  admission: InPatientAdmission;
  organizationId: OrganizationId;
  qrToken: string;
  providedToken?: string;
}): Promise<Buffer> {
  const { storage, admission, organizationId, qrToken, providedToken } = options;
  const expectedPatientId = admission.patientId ?? admission.id;
  const provided = String(providedToken ?? "").trim();
  const desiredToken =
    provided && isValidToken(provided, expectedPatientId, organizationId)
      ? provided
      : qrToken;

  const patientCode = admission.patientCode ?? admission.patientIdNo ?? admission.id;
  const input: PatientCardPdfInput = {
    id: patientCode,
    name: admission.patientName ?? "—",
    phone: admission.phone ?? "",
    address: admission.address ?? "",
    patientCode,
    qrToken: desiredToken,
  };
  const contentHash = patientCardContentHashFromInput(input);
  const expectedKey = cardStorageKey("inpatient", admission.id, contentHash);
  const cachedKey = String((admission as any).idCardPdfKey ?? "");

  if (cachedKey === expectedKey) {
    const cached = await readCachedPdf(expectedKey);
    if (cached) return cached;
  }

  const { pdf, storageKey } = await createAndStorePdf("inpatient", admission.id, input, contentHash);

  if (cachedKey && cachedKey !== storageKey) {
    await deleteStoredDocument(cachedKey);
  }

  await storage.updateInPatientAdmission(admission.id, {
    idCardPdfKey: storageKey,
    idCardQrToken: desiredToken,
    idCardGeneratedAt: new Date(),
  } as any);

  return pdf;
}

/** Generate PDFs for many patients with controlled concurrency (default 5). */
export async function bulkPatientCardPdfs(
  storage: IStorage,
  patients: Patient[],
  organizationIdFor: (p: Patient) => OrganizationId,
  qrTokenFor: (p: Patient) => string,
  concurrency = 5,
): Promise<Array<{ patientId: string; filename: string; pdf: Buffer }>> {
  const results: Array<{ patientId: string; filename: string; pdf: Buffer }> = [];
  for (let i = 0; i < patients.length; i += concurrency) {
    const batch = patients.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (patient) => {
        const qrToken = qrTokenFor(patient);
        const pdf = await getOrCreatePatientCardPdf({
          storage,
          patient,
          organizationId: organizationIdFor(patient),
          qrToken,
        });
        const code = (patient.patientCode ?? patient.id).replace(/[^a-z0-9._-]+/gi, "-");
        return { patientId: patient.id, filename: `${code}-card.pdf`, pdf };
      }),
    );
    results.push(...batchResults);
  }
  return results;
}
