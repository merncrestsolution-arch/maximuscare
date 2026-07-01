import crypto from "crypto";
import type { Patient, InPatientAdmission } from "@shared/schema";
import type { OrganizationId } from "@shared/branchAccess";
import type { IStorage } from "../storage";
import { generatePatientCardPdf, generateCardId } from "./patientIdCardService";
import { getDocumentReadStream, storeGeneratedFile, deleteStoredDocument } from "./fileStorageService";
import { verifyPatientQrToken } from "./qrTokenService";

function isValidToken(token: string, patientId: string, organizationId: OrganizationId): boolean {
  const verified = verifyPatientQrToken(token);
  return (
    verified.ok &&
    verified.payload?.patientId === patientId &&
    verified.payload?.organizationId === organizationId
  );
}

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 12);
}

function cardStorageKey(kind: "patient" | "inpatient", id: string, token: string): string {
  return `id-cards/${kind}/${id}/${tokenHash(token)}.pdf`;
}

async function readCachedPdf(storageKey: string): Promise<Buffer | null> {
  try {
    const { body } = await getDocumentReadStream(storageKey);
    return body;
  } catch {
    return null;
  }
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

  const cachedKey = String((patient as any).idCardPdfKey ?? "");
  const cachedToken = String((patient as any).idCardQrToken ?? "");
  if (cachedKey && cachedToken && cachedToken === desiredToken) {
    const cached = await readCachedPdf(cachedKey);
    if (cached) return cached;
  }

  const pdf = await generatePatientCardPdf({
    id: patient.patientCode ?? patient.id,
    name: patient.name ?? "—",
    phone: patient.phone ?? "",
    address: patient.address ?? "",
    cardId: generateCardId(patient.patientCode ?? patient.id),
    qrToken: desiredToken,
  });

  const storageKey = cardStorageKey("patient", patient.id, desiredToken);
  await storeGeneratedFile(storageKey, pdf, "application/pdf");

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

  const cachedKey = String((admission as any).idCardPdfKey ?? "");
  const cachedToken = String((admission as any).idCardQrToken ?? "");
  if (cachedKey && cachedToken && cachedToken === desiredToken) {
    const cached = await readCachedPdf(cachedKey);
    if (cached) return cached;
  }

  const patientCode = admission.patientCode ?? admission.patientIdNo ?? admission.id;
  const pdf = await generatePatientCardPdf({
    id: patientCode,
    name: admission.patientName ?? "—",
    phone: admission.phone ?? "",
    address: admission.address ?? "",
    cardId: generateCardId(patientCode),
    qrToken: desiredToken,
  });

  const storageKey = cardStorageKey("inpatient", admission.id, desiredToken);
  await storeGeneratedFile(storageKey, pdf, "application/pdf");

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
