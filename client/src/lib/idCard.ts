import { jsPDF } from "jspdf";
import QRCode from "qrcode";

/**
 * Default clinic hotline printed on every patient ID card. The label on the card
 * reads "CLINIC HOTLINE" (previously "Hospital Hotline").
 */
export const CLINIC_HOTLINE = "077 647 9364";
/** @deprecated kept for backwards compatibility — use {@link CLINIC_HOTLINE}. */
export const HOSPITAL_HOTLINE = CLINIC_HOTLINE;

/** Patient-facing hospital website (distinct from the MERNcrest dev-company site). */
const HOSPITAL_WEBSITE = "maximuscare.lk";

/** Fine-print attribution — rendered as the smallest text element on the card. */
const MERNCREST_TEXT = "Powered by MERNcrest Solutions (Pvt) Ltd";
const MERNCREST_WEB = "merncrest.lk";
const MERNCREST_PHONE = "0713838638";

export type OrganizationId = "maximus" | "nexus";

// Brand palette sampled to match the reference card.
const NAVY: RGB = [26, 77, 143];
const ORANGE: RGB = [245, 130, 31];
const INK: RGB = [33, 37, 41];
const SUBTLE: RGB = [110, 116, 124];
const DIVIDER: RGB = [228, 231, 236];
const WHITE: RGB = [255, 255, 255];

type RGB = [number, number, number];

export function organizationDisplayName(org: OrganizationId | string | null | undefined): string {
  return org === "nexus" ? "Nexus Physio & Rehab" : "Maximus Care";
}

function organizationSubtitle(org: OrganizationId | string | null | undefined): string {
  return org === "nexus"
    ? "PHYSIO & REHAB CENTER"
    : "PHYSIO AND REHAB UNIT (PVT) LTD";
}

export interface PatientIdCardData {
  organizationId: OrganizationId | string | null | undefined;
  logoUri: string;
  /** Signed QR token (encoded into the card's QR — never the raw patient id). */
  qrToken: string;
  patientName: string;
  patientIdNumber: string;
  phone: string;
  address?: string;
  /** Dynamic "Our Branches" list for the patient's organization. */
  branches?: string[];
  /** Clinic hotline; defaults to {@link CLINIC_HOTLINE}. */
  clinicHotline?: string;
  /** Patient-facing website; defaults to {@link HOSPITAL_WEBSITE}. */
  website?: string;
}

/** Load any image URL (asset path or data URL) into a PNG data URL for jsPDF. */
async function loadImageDataUrl(
  src: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
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

// --- tiny color helpers ----------------------------------------------------
function fill(doc: jsPDF, c: RGB) {
  doc.setFillColor(c[0], c[1], c[2]);
}
function stroke(doc: jsPDF, c: RGB, width = 0.25) {
  doc.setDrawColor(c[0], c[1], c[2]);
  doc.setLineWidth(width);
}
function text(doc: jsPDF, c: RGB) {
  doc.setTextColor(c[0], c[1], c[2]);
}

// --- line-art icons (vector, scale-independent) ----------------------------
// Each icon draws inside the box (x, y, s, s).

function iconPerson(doc: jsPDF, x: number, y: number, s: number, color: RGB) {
  stroke(doc, color, s * 0.07);
  const cx = x + s / 2;
  doc.circle(cx, y + s * 0.3, s * 0.17, "S");
  // shoulders — a shallow upward arc
  doc.lines(
    [[0.08 * s, -0.34 * s, 0.68 * s, -0.34 * s, 0.76 * s, 0]],
    x + 0.12 * s,
    y + 0.92 * s,
    [1, 1],
    "S"
  );
}

function iconIdCard(doc: jsPDF, x: number, y: number, s: number, color: RGB) {
  stroke(doc, color, s * 0.07);
  doc.roundedRect(x + s * 0.04, y + s * 0.2, s * 0.92, s * 0.6, s * 0.08, s * 0.08, "S");
  doc.rect(x + s * 0.14, y + s * 0.34, s * 0.22, s * 0.32, "S");
  doc.line(x + s * 0.45, y + s * 0.4, x + s * 0.84, y + s * 0.4);
  doc.line(x + s * 0.45, y + s * 0.52, x + s * 0.84, y + s * 0.52);
  doc.line(x + s * 0.45, y + s * 0.64, x + s * 0.72, y + s * 0.64);
}

function iconPhone(doc: jsPDF, x: number, y: number, s: number, color: RGB) {
  stroke(doc, color, s * 0.07);
  doc.roundedRect(x + s * 0.3, y + s * 0.12, s * 0.4, s * 0.76, s * 0.08, s * 0.08, "S");
  doc.line(x + s * 0.42, y + s * 0.22, x + s * 0.58, y + s * 0.22);
  fill(doc, color);
  doc.circle(x + s * 0.5, y + s * 0.78, s * 0.035, "F");
}

function iconPin(doc: jsPDF, x: number, y: number, s: number, color: RGB) {
  fill(doc, color);
  const cx = x + s / 2;
  doc.circle(cx, y + s * 0.36, s * 0.28, "F");
  doc.triangle(
    cx - s * 0.2,
    y + s * 0.46,
    cx + s * 0.2,
    y + s * 0.46,
    cx,
    y + s * 0.95,
    "F"
  );
  fill(doc, WHITE);
  doc.circle(cx, y + s * 0.36, s * 0.1, "F");
}

function iconGlobe(doc: jsPDF, x: number, y: number, s: number, color: RGB) {
  stroke(doc, color, s * 0.07);
  const cx = x + s / 2;
  const cy = y + s / 2;
  const r = s * 0.42;
  doc.circle(cx, cy, r, "S");
  doc.ellipse(cx, cy, r * 0.42, r, "S");
  doc.line(cx - r, cy, cx + r, cy);
  doc.line(cx - r * 0.86, cy - r * 0.5, cx + r * 0.86, cy - r * 0.5);
  doc.line(cx - r * 0.86, cy + r * 0.5, cx + r * 0.86, cy + r * 0.5);
}

function iconScan(doc: jsPDF, x: number, y: number, s: number, color: RGB) {
  stroke(doc, color, s * 0.09);
  const a = s * 0.28; // bracket arm length
  // corners
  doc.line(x, y + a, x, y); doc.line(x, y, x + a, y);
  doc.line(x + s - a, y, x + s, y); doc.line(x + s, y, x + s, y + a);
  doc.line(x, y + s - a, x, y + s); doc.line(x, y + s, x + a, y + s);
  doc.line(x + s - a, y + s, x + s, y + s); doc.line(x + s, y + s, x + s, y + s - a);
}

/** Render the org wordmark with the brand's orange "X" accent (Maximus). */
function drawBrandTitle(
  doc: jsPDF,
  raw: string,
  x: number,
  baselineY: number,
  size: number
) {
  const title = raw.toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  const xIndex = title.indexOf("X");
  if (xIndex < 0) {
    text(doc, NAVY);
    doc.text(title, x, baselineY);
    return;
  }
  let cursor = x;
  const pre = title.slice(0, xIndex);
  const rest = title.slice(xIndex + 1);
  if (pre) {
    text(doc, NAVY);
    doc.text(pre, cursor, baselineY);
    cursor += doc.getTextWidth(pre);
  }
  text(doc, ORANGE);
  doc.text("X", cursor, baselineY);
  cursor += doc.getTextWidth("X");
  if (rest) {
    text(doc, NAVY);
    doc.text(rest, cursor, baselineY);
  }
}

/**
 * Build and download a print-ready CR80 (85.6mm × 54mm, 300 DPI vector) patient ID
 * card PDF that matches the Maximus Care reference design: branded header with logo
 * lockup + wordmark, a left column of patient details, a middle "OUR BRANCHES" +
 * "CLINIC HOTLINE" column, a scannable QR on the right, and a navy footer carrying
 * the hospital website, a unique Card ID, and small MERNcrest attribution.
 */
export async function downloadPatientIdCard(data: PatientIdCardData): Promise<void> {
  const W = 85.6;
  const H = 54;
  const cardId = generateCardId(data.patientIdNumber || data.patientName);
  const org = data.organizationId;
  const branches = (data.branches ?? []).filter(Boolean);
  const clinicHotline = data.clinicHotline || CLINIC_HOTLINE;
  const website = data.website || HOSPITAL_WEBSITE;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [W, H] });

  // Card background + border.
  fill(doc, WHITE);
  doc.rect(0, 0, W, H, "F");
  stroke(doc, NAVY, 0.5);
  doc.roundedRect(0.8, 0.8, W - 1.6, H - 1.6, 2.4, 2.4, "S");

  // --- Decorative orange swoosh in the top-right corner ---------------------
  stroke(doc, ORANGE, 0.9);
  doc.lines([[14, 0, 18, 6, 18, 14.5]], W - 21, 1.6, [1, 1], "S");
  stroke(doc, ORANGE, 0.5);
  doc.lines([[12, 0, 16, 5.5, 16, 12]], W - 16.5, 1.0, [1, 1], "S");

  // --- Header: logo lockup + wordmark + ID-card badge ----------------------
  const logo = await loadImageDataUrl(data.logoUri);
  let textX = 4.5;
  if (logo) {
    const logoH = 10;
    const aspect = logo.width && logo.height ? logo.width / logo.height : 1;
    const logoW = Math.min(Math.max(aspect * logoH, 8), 17);
    doc.addImage(logo.dataUrl, "PNG", 3.5, 2.4, logoW, logoH);
    textX = 3.5 + logoW + 2.5;
  }

  drawBrandTitle(doc, organizationDisplayName(org), textX, 6.6, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.4);
  text(doc, SUBTLE);
  doc.text(organizationSubtitle(org), textX, 9.4);

  // "PATIENT IDENTIFICATION CARD" navy badge.
  const badgeLabel = "PATIENT IDENTIFICATION CARD";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.2);
  const badgeTextW = doc.getTextWidth(badgeLabel);
  const badgeW = badgeTextW + 5;
  const badgeH = 4.2;
  const badgeY = 10.6;
  fill(doc, NAVY);
  doc.roundedRect(textX, badgeY, badgeW, badgeH, 1.1, 1.1, "F");
  text(doc, WHITE);
  doc.text(badgeLabel, textX + badgeW / 2, badgeY + badgeH / 2 + 0.55, { align: "center" });

  // Header divider.
  stroke(doc, DIVIDER, 0.3);
  doc.line(4, 16, W - 4, 16);

  // --- Right column: QR code -----------------------------------------------
  const qrDataUrl = await QRCode.toDataURL(data.qrToken, {
    margin: 0,
    width: 320,
    errorCorrectionLevel: "M",
  });
  const qrSize = 19;
  const qrX = W - qrSize - 5.5;
  const qrY = 18.5;
  fill(doc, WHITE);
  stroke(doc, NAVY, 0.4);
  doc.roundedRect(qrX - 1.6, qrY - 1.6, qrSize + 3.2, qrSize + 3.2, 1.6, 1.6, "S");
  doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  // Caption with a small scan icon.
  const capY = qrY + qrSize + 3.2;
  const caption = "Scan to view patient records";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.2);
  const capW = doc.getTextWidth(caption);
  const capStart = qrX + qrSize / 2 - (capW + 3) / 2;
  iconScan(doc, capStart, capY - 2.2, 2.2, NAVY);
  text(doc, SUBTLE);
  doc.text(caption, capStart + 3, capY - 0.4);

  // --- Left column: patient details ----------------------------------------
  const leftX = 4.5;
  const leftIconX = leftX;
  const leftTextX = leftX + 6;
  const leftRightEdge = 37;
  const rows: Array<{ icon: (d: jsPDF, x: number, y: number, s: number, c: RGB) => void; label: string; value: string }> = [
    { icon: iconPerson, label: "PATIENT NAME", value: data.patientName || "—" },
    { icon: iconIdCard, label: "PATIENT ID", value: data.patientIdNumber || "—" },
    { icon: iconPhone, label: "PHONE", value: data.phone || "—" },
    { icon: iconPin, label: "ADDRESS", value: data.address || "—" },
  ];
  const rowTop = 18.5;
  const rowH = 6.6;
  rows.forEach((row, i) => {
    const top = rowTop + i * rowH;
    row.icon(doc, leftIconX, top + 0.8, 4, NAVY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(4.2);
    text(doc, SUBTLE);
    doc.text(row.label, leftTextX, top + 1.6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.4);
    text(doc, INK);
    const valueLines = doc.splitTextToSize(row.value, leftRightEdge - leftTextX);
    doc.text(valueLines[0] ?? "—", leftTextX, top + 4.6);
    if (i < rows.length - 1) {
      stroke(doc, DIVIDER, 0.2);
      doc.line(leftX, top + rowH - 0.6, leftRightEdge, top + rowH - 0.6);
    }
  });

  // --- Middle column: Our Branches + Clinic Hotline ------------------------
  const midX = 39.5;
  const midRight = 58.5;
  iconPin(doc, midX, 17.6, 3.4, ORANGE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.4);
  text(doc, ORANGE);
  doc.text("OUR BRANCHES", midX + 4.4, 20.1);

  const branchList = branches.length ? branches : ["—"];
  const branchLineH = branchList.length > 4 ? 2.9 : 3.4;
  let by = 23.6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.4);
  branchList.slice(0, 6).forEach((b) => {
    fill(doc, ORANGE);
    doc.circle(midX + 0.6, by - 0.9, 0.45, "F");
    text(doc, INK);
    const lines = doc.splitTextToSize(b, midRight - (midX + 2.2));
    doc.text(lines[0], midX + 2.2, by);
    by += branchLineH;
  });

  // Clinic Hotline block (navy circle + phone icon).
  const hotY = 40.2;
  fill(doc, NAVY);
  doc.circle(midX + 2, hotY, 2.1, "F");
  iconPhone(doc, midX + 0.55, hotY - 1.45, 2.9, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.2);
  text(doc, SUBTLE);
  doc.text("CLINIC HOTLINE", midX + 5.2, hotY - 0.6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  text(doc, INK);
  doc.text(clinicHotline, midX + 5.2, hotY + 2.4);

  // --- Footer: navy bar with website, Card ID, MERNcrest attribution -------
  const footY = H - 7.6;
  fill(doc, NAVY);
  doc.rect(0.8, footY, W - 1.6, H - 0.8 - footY, "F");
  // re-round the bottom corners by overlaying the rounded border again.
  stroke(doc, NAVY, 0.5);
  doc.roundedRect(0.8, 0.8, W - 1.6, H - 1.6, 2.4, 2.4, "S");

  const footRow1 = footY + 3.1;
  iconGlobe(doc, 4.5, footRow1 - 2.4, 3, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.6);
  text(doc, WHITE);
  doc.text(website, 8.4, footRow1);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.6);
  text(doc, [200, 214, 232]);
  doc.text("CARD ID:", W - 5, footRow1, { align: "right" });
  const cardIdLabelW = doc.getTextWidth("CARD ID: ");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.2);
  text(doc, WHITE);
  doc.text(cardId, W - 5 - cardIdLabelW, footRow1, { align: "right" });

  // Smallest text on the card: MERNcrest attribution line.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.1);
  text(doc, [170, 188, 214]);
  doc.text(
    `${MERNCREST_TEXT}  ·  ${MERNCREST_WEB}  ·  ${MERNCREST_PHONE}`,
    W / 2,
    H - 1.9,
    { align: "center" }
  );

  const safeName = (data.patientName || "patient").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`patient-id-card-${safeName}.pdf`);
}
