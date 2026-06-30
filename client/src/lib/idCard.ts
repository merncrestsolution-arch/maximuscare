import { jsPDF } from "jspdf";
import QRCode from "qrcode";

/** Fixed hospital hotline printed on every patient ID card. */
export const HOSPITAL_HOTLINE = "077 647 9364";
const FOOTER_TEXT = "Powered by MERNcrest Solutions (Pvt) Ltd";

export type OrganizationId = "maximus" | "nexus";

export function organizationDisplayName(org: OrganizationId | string | null | undefined): string {
  return org === "nexus" ? "Nexus Physio & Rehab" : "Maximus Care";
}

export interface PatientIdCardData {
  organizationId: OrganizationId | string | null | undefined;
  logoUri: string;
  /** Signed QR token (encoded into the card's QR — never the raw patient id). */
  qrToken: string;
  patientName: string;
  patientIdNumber: string;
  phone: string;
}

/** Load any image URL (asset path or data URL) into a PNG data URL for jsPDF. */
async function loadImageDataUrl(src: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!src) return null;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const loaded = await new Promise<HTMLImageElement | null>((resolve) => {
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    if (!loaded) return null;
    const canvas = document.createElement("canvas");
    canvas.width = loaded.naturalWidth || 256;
    canvas.height = loaded.naturalHeight || 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(loaded, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

/** A short, human-readable, unique card identifier printed in the footer. */
export function generateCardId(seed: string): string {
  const base = (seed || "PT").replace(/[^a-z0-9]+/gi, "").toUpperCase().slice(0, 6) || "PT";
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `MX-${base}-${stamp}${rand}`;
}

/**
 * Build and download a print-ready CR80 (85.6mm × 54mm) patient ID card PDF.
 * Layout: org logo + name (top), patient details (left), signed QR (right),
 * hotline, and a MERNcrest footer with a unique Card ID.
 */
export async function downloadPatientIdCard(data: PatientIdCardData): Promise<void> {
  const W = 85.6;
  const H = 54;
  const cardId = generateCardId(data.patientIdNumber || data.patientName);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [W, H] });

  // Card background + border.
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, "F");
  doc.setDrawColor(16, 86, 145); // brand blue
  doc.setLineWidth(0.6);
  doc.roundedRect(1.2, 1.2, W - 2.4, H - 2.4, 2.4, 2.4, "S");

  // Top brand band.
  doc.setFillColor(16, 86, 145);
  doc.roundedRect(1.2, 1.2, W - 2.4, 12, 2.4, 2.4, "F");
  doc.rect(1.2, 7, W - 2.4, 6.4, "F"); // square off the band's lower corners

  const logo = await loadImageDataUrl(data.logoUri);
  if (logo) {
    const size = 8.5;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(3, 2.6, size + 1, size + 1, 1, 1, "F");
    doc.addImage(logo.dataUrl, "PNG", 3.5, 3.1, size, size);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(organizationDisplayName(data.organizationId), 14.5, 6.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.6);
  doc.text("Patient Identification Card", 14.5, 10.4);

  // QR code (right side).
  const qrDataUrl = await QRCode.toDataURL(data.qrToken, {
    margin: 0,
    width: 240,
    errorCorrectionLevel: "M",
  });
  const qrSize = 24;
  const qrX = W - qrSize - 5;
  const qrY = 17;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.3);
  doc.roundedRect(qrX - 1.2, qrY - 1.2, qrSize + 2.4, qrSize + 2.4, 1.2, 1.2, "FD");
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(4.6);
  doc.text("Scan to view patient", qrX + qrSize / 2, qrY + qrSize + 3, { align: "center" });

  // Patient details (left column).
  let y = 20.5;
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const name = doc.splitTextToSize(data.patientName || "—", qrX - 9);
  doc.text(name[0] ?? "—", 5, y);

  const detail = (label: string, value: string) => {
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.6);
    doc.setTextColor(120, 120, 120);
    doc.text(label.toUpperCase(), 5, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    doc.text(value || "—", 5, y + 3.4);
  };
  detail("Patient ID", data.patientIdNumber || "—");
  detail("Phone", data.phone || "—");
  detail("Hospital Hotline", HOSPITAL_HOTLINE);

  // Footer.
  doc.setDrawColor(225, 225, 225);
  doc.setLineWidth(0.2);
  doc.line(4, H - 6.4, W - 4, H - 6.4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.6);
  doc.setTextColor(120, 120, 120);
  doc.text(FOOTER_TEXT, 5, H - 3.6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 86, 145);
  doc.text(`Card ID: ${cardId}`, W - 5, H - 3.6, { align: "right" });

  const safeName = (data.patientName || "patient").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`patient-id-card-${safeName}.pdf`);
}
