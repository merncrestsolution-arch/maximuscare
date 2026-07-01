import { jsPDF } from "jspdf";

/**
 * Default clinic hotline printed on every patient ID card. The label on the card
 * reads "CLINIC HOTLINE" (previously "Hospital Hotline").
 */
export const CLINIC_HOTLINE = "+94 77 647 9364";
/** @deprecated kept for backwards compatibility — use {@link CLINIC_HOTLINE}. */
export const HOSPITAL_HOTLINE = CLINIC_HOTLINE;

/** Patient-facing hospital website (distinct from the MERNcrest dev-company site). */
const HOSPITAL_WEBSITE = "maximuscare.lk";

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
  return "Maximus Care";
}

function organizationSubtitle(org: OrganizationId | string | null | undefined): string {
  return "PHYSIO AND REHAB UNIT";
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
  condition?: string;
  /** Dynamic "Our Branches" list for the patient's organization. */
  branches?: string[];
  /** Clinic hotline; defaults to {@link CLINIC_HOTLINE}. */
  clinicHotline?: string;
  /** Patient-facing website; defaults to {@link HOSPITAL_WEBSITE}. */
  website?: string;
  /** Branch label for the card header badge. */
  branchName?: string;
  /** Registration date shown on the card. */
  registeredDate?: string;
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
  const cleanSeed = (seed || "").trim();
  let base = "";
  // Check if it matches MC/BRANCH/DDMM/SEQ
  const match = /^MC\/([A-Z]+)\/\d+\/(\d+)$/i.exec(cleanSeed);
  if (match) {
    const branch = match[1].toUpperCase();
    const seq = parseInt(match[2], 10);
    base = `MC${branch}${seq}`;
  } else {
    base = cleanSeed.replace(/[^a-z0-9]+/gi, "").toUpperCase().slice(0, 8) || "PT";
  }
  // Generate a unique 8-character hex/alphanumeric hash
  const chars = "0123456789ABCDEF";
  let hash = "";
  for (let i = 0; i < 8; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return `MX-${base}-${hash}`;
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
function iconPerson(doc: jsPDF, x: number, y: number, s: number, color: RGB) {
  stroke(doc, color, s * 0.08);
  const cx = x + s / 2;
  doc.circle(cx, y + s * 0.3, s * 0.18, "S");
  doc.lines(
    [[0.08 * s, -0.34 * s, 0.68 * s, -0.34 * s, 0.76 * s, 0]],
    x + 0.12 * s,
    y + 0.92 * s,
    [1, 1],
    "S"
  );
}

function iconIdCard(doc: jsPDF, x: number, y: number, s: number, color: RGB) {
  stroke(doc, color, s * 0.08);
  doc.roundedRect(x + s * 0.04, y + s * 0.2, s * 0.92, s * 0.6, s * 0.08, s * 0.08, "S");
  doc.rect(x + s * 0.14, y + s * 0.34, s * 0.22, s * 0.32, "S");
  doc.line(x + s * 0.45, y + s * 0.4, x + s * 0.84, y + s * 0.4);
  doc.line(x + s * 0.45, y + s * 0.52, x + s * 0.84, y + s * 0.52);
  doc.line(x + s * 0.45, y + s * 0.64, x + s * 0.72, y + s * 0.64);
}

function iconPhoneHandset(doc: jsPDF, x: number, y: number, s: number, color: RGB) {
  stroke(doc, color, s * 0.12);
  doc.setLineCap(1);
  doc.line(x + s * 0.7, y + s * 0.22, x + s * 0.4, y + s * 0.3);
  doc.line(x + s * 0.4, y + s * 0.3, x + s * 0.3, y + s * 0.4);
  doc.line(x + s * 0.3, y + s * 0.4, x + s * 0.22, y + s * 0.7);
  fill(doc, color);
  doc.circle(x + s * 0.72, y + s * 0.22, s * 0.13, "F");
  doc.circle(x + s * 0.22, y + s * 0.72, s * 0.13, "F");
}

function iconPin(doc: jsPDF, x: number, y: number, s: number, color: RGB, innerColor: RGB = WHITE) {
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
  fill(doc, innerColor);
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

function iconPhoneScan(doc: jsPDF, x: number, y: number, s: number, color: RGB) {
  stroke(doc, color, s * 0.08);
  const a = s * 0.24;
  doc.line(x, y + a, x, y);
  doc.line(x, y, x + a, y);
  doc.line(x + s - a, y, x + s, y);
  doc.line(x + s, y, x + s, y + a);
  doc.line(x, y + s - a, x, y + s);
  doc.line(x, y + s, x + a, y + s);
  doc.line(x + s - a, y + s, x + s, y + s);
  doc.line(x + s, y + s, x + s, y + s - a);

  const sw = s * 0.44;
  const sh = s * 0.76;
  const sx = x + (s - sw) / 2;
  const sy = y + (s - sh) / 2;
  stroke(doc, color, s * 0.06);
  doc.roundedRect(sx, sy, sw, sh, s * 0.06, s * 0.06, "S");
  doc.line(sx + sw * 0.35, sy + sh * 0.1, sx + sw * 0.65, sy + sh * 0.1);
  fill(doc, color);
  doc.circle(sx + sw * 0.5, sy + sh * 0.88, s * 0.03, "F");
}

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

function drawTopRightAccent(doc: jsPDF, W: number, H: number) {
  const P0 = { x: W - 25, y: 0.8 };
  const P2 = { x: W - 0.8, y: 17.0 };
  const P1 = { x: W - 8, y: 1.2 };

  const points: { x: number; y: number }[] = [];
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * P0.x + 2 * mt * t * P1.x + t * t * P2.x;
    const y = mt * mt * P0.y + 2 * mt * t * P1.y + t * t * P2.y;
    points.push({ x, y });
  }

  // Draw triangles to fill the shape to the top-right corner (W - 0.8, 0.8)
  const cx = W - 0.8;
  const cy = 0.8;
  fill(doc, NAVY);
  for (let i = 0; i < points.length - 1; i++) {
    doc.triangle(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, cx, cy, "F");
  }

  stroke(doc, ORANGE, 0.6);
  for (let i = 0; i < points.length - 1; i++) {
    doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
  }
}


export async function downloadPatientIdCard(data: PatientIdCardData): Promise<void> {
  const W = 85.6;
  const H = 54;
  const headerH = 12;
  const footerH = 7;
  const bodyTop = headerH;
  const footerY = H - footerH;
  const paddingX = 3.2;
  const clinicHotline = data.clinicHotline || CLINIC_HOTLINE;
  const websiteRaw = data.website || HOSPITAL_WEBSITE;
  const website = websiteRaw.startsWith("www.") ? websiteRaw : "www." + websiteRaw;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [W, H] });

  // Card background + border
  fill(doc, WHITE);
  doc.rect(0, 0, W, H, "F");
  stroke(doc, NAVY, 0.5);
  doc.roundedRect(0.6, 0.6, W - 1.2, H - 1.2, 2.4, 2.4, "S");

  // Header
  fill(doc, NAVY);
  doc.rect(0, 0, W, headerH, "F");

  const logo = await loadImageDataUrl(data.logoUri);
  let textX = paddingX;
  if (logo) {
    const logoH = 8;
    const aspect = logo.width && logo.height ? logo.width / logo.height : 1;
    const logoW = Math.min(Math.max(aspect * logoH, 8), 16);
    const logoY = (headerH - logoH) / 2;
    doc.addImage(logo.dataUrl, "PNG", paddingX, logoY, logoW, logoH);
    textX = paddingX + logoW + 2;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  text(doc, WHITE);
  doc.text("MAXIMUS CARE", textX, 5.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.5);
  doc.text("PHYSIO AND REHAB UNIT", textX, 8.6);

  const branchLabel = (data.branchName || "").toUpperCase();
  if (branchLabel) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(3.8);
    const badgeW = doc.getTextWidth(branchLabel) + 4.2;
    const badgeH = 4.8;
    const badgeX = W - badgeW - paddingX;
    const badgeY = (headerH - badgeH) / 2;
    fill(doc, ORANGE);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.2, 1.2, "F");
    text(doc, WHITE);
    doc.text(branchLabel, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1.1, { align: "center" });
  }

  // Body
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  text(doc, NAVY);
  doc.text(data.patientName || "—", paddingX, bodyTop + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.2);
  text(doc, SUBTLE);
  doc.text(data.condition || "—", paddingX, bodyTop + 11.5);

  const rowY = footerY - 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.6);
  text(doc, SUBTLE);
  doc.text("Patient ID", paddingX, rowY);
  doc.text("Registered", W - paddingX - 12, rowY, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.4);
  text(doc, NAVY);
  doc.text(data.patientIdNumber || "—", paddingX, rowY + 4.2);

  const registered = data.registeredDate ? new Date(data.registeredDate) : null;
  const registeredText =
    registered && !Number.isNaN(registered.getTime())
      ? registered.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "—";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.2);
  text(doc, INK);
  doc.text(registeredText, W - paddingX, rowY + 4.2, { align: "right" });

  // Footer
  fill(doc, ORANGE);
  doc.rect(0, footerY, W, footerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.6);
  text(doc, WHITE);
  doc.text(`☎ ${clinicHotline}`, paddingX, footerY + 4.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.4);
  text(doc, [255, 255, 255]);
  doc.text(website, W / 2, footerY + 4.6, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.2);
  text(doc, [255, 255, 255]);
  doc.text("MERNcrest Solutions", W - paddingX, footerY + 4.6, { align: "right" });

  const safeName = (data.patientName || "patient").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`patient-id-card-${safeName}.pdf`);
}

