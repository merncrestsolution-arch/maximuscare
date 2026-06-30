import { jsPDF } from "jspdf";
import QRCode from "qrcode";

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
  const cardId = generateCardId(data.patientIdNumber || data.patientName);
  const org = data.organizationId;
  const branches = (data.branches ?? []).filter(Boolean);
  const clinicHotline = data.clinicHotline || (org === "nexus" ? "+94 77 123 4567" : CLINIC_HOTLINE);
  const websiteRaw = data.website || (org === "nexus" ? "nexusphysio.lk" : HOSPITAL_WEBSITE);
  const website = websiteRaw.startsWith("www.") ? websiteRaw : "www." + websiteRaw;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [W, H] });

  // Card background + border
  fill(doc, WHITE);
  doc.rect(0, 0, W, H, "F");
  stroke(doc, NAVY, 0.5);
  doc.roundedRect(0.8, 0.8, W - 1.6, H - 1.6, 2.4, 2.4, "S");

  // Top-right decorative curve accent
  drawTopRightAccent(doc, W, H);

  // Logo + brand info
  const logo = await loadImageDataUrl(data.logoUri);
  let textX = 4.5;
  if (logo) {
    const logoH = 11;
    const aspect = logo.width && logo.height ? logo.width / logo.height : 1;
    const logoW = Math.min(Math.max(aspect * logoH, 8), 17);
    doc.addImage(logo.dataUrl, "PNG", 4.0, 2.2, logoW, logoH);
    textX = 4.0 + logoW + 2.5;
  }

  drawBrandTitle(doc, organizationDisplayName(org), textX, 5.8, 12.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.2);
  text(doc, NAVY);
  doc.text(organizationSubtitle(org), textX, 8.6);

  // "PATIENT IDENTIFICATION CARD" badge
  const badgeLabel = "PATIENT IDENTIFICATION CARD";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.6);
  const badgeTextW = doc.getTextWidth(badgeLabel);
  const badgeW = badgeTextW + 5.0;
  const badgeH = 4.0;
  const badgeY = 10.0;
  fill(doc, NAVY);
  doc.roundedRect(textX, badgeY, badgeW, badgeH, 1.2, 1.2, "F");
  text(doc, WHITE);
  doc.text(badgeLabel, textX + badgeW / 2, badgeY + badgeH / 2 + 0.6, { align: "center" });
  // Right column: QR code inside bordered rounded box
  const qrDataUrl = await QRCode.toDataURL(data.qrToken, {
    margin: 0,
    width: 320,
    errorCorrectionLevel: "M",
  });
  
  const qrBoxSize = 19.0;
  const qrBoxX = W - qrBoxSize - 4.5;
  const qrBoxY = 16.5;
  
  stroke(doc, NAVY, 0.4);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 1.6, 1.6, "S");
  const qrImageSize = qrBoxSize - 2.4;
  doc.addImage(qrDataUrl, "PNG", qrBoxX + 1.2, qrBoxY + 1.2, qrImageSize, qrImageSize);

  // Caption group centered under QR code
  const capX = qrBoxX + 0.6;
  const capY = qrBoxY + qrBoxSize + 2.4;
  iconPhoneScan(doc, capX, capY, 4.4, NAVY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.8);
  text(doc, NAVY);
  doc.text("Scan to view", capX + 5.2, capY + 1.6);
  doc.text("patient records", capX + 5.2, capY + 3.4);

  // Left column: Patient details rows
  const leftX = 4.5;
  const leftIconX = leftX;
  const leftTextX = leftX + 6.0;
  const leftRightEdge = 39.0;

  function drawIconInCircle(
    iconFunc: any,
    x: number,
    y: number,
    size: number
  ) {
    fill(doc, NAVY);
    doc.circle(x + size / 2, y + size / 2, size / 2, "F");
    const s = size * 0.55;
    const offset = (size - s) / 2;
    if (iconFunc === iconPin) {
      iconPin(doc, x + offset, y + offset, s, WHITE, NAVY);
    } else {
      iconFunc(doc, x + offset, y + offset, s, WHITE);
    }
  }

  // Row 1: Patient Name
  const r1Top = 16.5;
  drawIconInCircle(iconPerson, leftIconX, r1Top + 0.5, 4.4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.0);
  text(doc, SUBTLE);
  doc.text("PATIENT NAME", leftTextX, r1Top + 1.6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  text(doc, INK);
  doc.text(data.patientName ? data.patientName.toUpperCase() : "—", leftTextX, r1Top + 4.9);

  const div1Y = r1Top + 6.3;
  stroke(doc, DIVIDER, 0.25);
  doc.line(leftX, div1Y, leftRightEdge, div1Y);

  // Row 2: Patient ID
  const r2Top = div1Y;
  drawIconInCircle(iconIdCard, leftIconX, r2Top + 0.6, 4.4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.0);
  text(doc, SUBTLE);
  doc.text("PATIENT ID", leftTextX, r2Top + 3.6);
  doc.text(":", 22.5, r2Top + 3.6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.6);
  text(doc, INK);
  doc.text(data.patientIdNumber || "—", 24.0, r2Top + 3.6);

  const div2Y = r2Top + 5.2;
  stroke(doc, DIVIDER, 0.25);
  doc.line(leftX, div2Y, leftRightEdge, div2Y);

  // Row 3: Phone
  const r3Top = div2Y;
  drawIconInCircle(iconPhoneHandset, leftIconX, r3Top + 0.6, 4.4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.0);
  text(doc, SUBTLE);
  doc.text("PHONE", leftTextX, r3Top + 3.6);
  doc.text(":", 22.5, r3Top + 3.6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.6);
  text(doc, INK);
  doc.text(data.phone || "—", 24.0, r3Top + 3.6);

  const div3Y = r3Top + 5.2;
  stroke(doc, DIVIDER, 0.25);
  doc.line(leftX, div3Y, leftRightEdge, div3Y);

  // Row 4: Address
  const r4Top = div3Y;
  drawIconInCircle(iconPin, leftIconX, r4Top + 0.6, 4.4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.0);
  text(doc, SUBTLE);
  doc.text("ADDRESS", leftTextX, r4Top + 3.6);
  doc.text(":", 22.5, r4Top + 3.6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.6);
  text(doc, INK);

  const addrValue = data.address || "—";
  const addrLines = doc.splitTextToSize(addrValue, leftRightEdge - 24.0);
  doc.text(addrLines[0] || "—", 24.0, r4Top + 3.6);
  if (addrLines[1]) {
    doc.text(addrLines[1], 24.0, r4Top + 6.4);
  }

  // Vertical divider separating left and middle columns
  stroke(doc, DIVIDER, 0.25);
  doc.line(40.5, 16.5, 40.5, 44.5);

  // Middle column: Our Branches
  const midX = 42.0;
  iconPin(doc, midX, 16.8, 3.0, ORANGE, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.4);
  text(doc, ORANGE);
  doc.text("OUR BRANCHES", midX + 4.0, 19.2);

  const cleanBranchName = (b: string): string => {
    const lower = b.toLowerCase();
    if (lower.includes("dehiwala")) return "Dehiwala (Main)";
    if (lower.includes("bandaragama")) return "Bandaragama";
    if (lower.includes("neuro") || lower.includes("kalubowila")) return "Kalubowila Neuro Unit";
    if (lower.includes("beruwala") || lower.includes("nexus")) return "Beruwala";
    return b;
  };
  const formattedBranches = branches.map(cleanBranchName);
  const branchList = formattedBranches.length ? formattedBranches : ["—"];
  
  const branchLineH = 3.2;
  let by = 22.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(3.2);
  branchList.slice(0, 5).forEach((b) => {
    fill(doc, ORANGE);
    doc.circle(midX + 1.2, by - 0.8, 0.35, "F");
    text(doc, INK);
    doc.text(b, midX + 2.8, by);
    by += branchLineH;
  });

  // Clinic Hotline
  const hotY = 38.2;
  fill(doc, NAVY);
  doc.circle(midX + 1.8, hotY + 1.8, 1.8, "F");
  iconPhoneHandset(doc, midX + 0.5, hotY + 0.5, 2.6, WHITE);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(3.8);
  text(doc, SUBTLE);
  doc.text("CLINIC HOTLINE", midX + 5.0, hotY + 1.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.2);
  text(doc, INK);
  doc.text(clinicHotline, midX + 5.0, hotY + 4.0);

  // Footer: navy bar
  const footY = H - 8.5;
  fill(doc, NAVY);
  doc.rect(0.8, footY, W - 1.6, H - 0.8 - footY, "F");
  stroke(doc, NAVY, 0.5);
  doc.roundedRect(0.8, 0.8, W - 1.6, H - 1.6, 2.4, 2.4, "S");

  // Globe icon + website name
  const footRow1 = footY + 4.5;
  iconGlobe(doc, 4.5, footRow1 - 3.2, 3.2, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.2);
  text(doc, WHITE);
  doc.text(website, 8.2, footRow1);

  // Outer white rounded badge for CARD ID
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.0);
  const cardIdLabel = "CARD ID:";
  const cardIdLabelW = doc.getTextWidth(cardIdLabel);

  doc.setFontSize(4.4);
  const cardIdValW = doc.getTextWidth(cardId);

  const innerPadding = 1.4;
  const navyPillW = cardIdValW + 2 * innerPadding;

  const outerPadding = 1.0;
  const footBadgeW = outerPadding + cardIdLabelW + 1.2 + navyPillW + outerPadding;
  const footBadgeH = 4.4;
  const footBadgeX = 27.5;
  const footBadgeY = footY + (8.5 - footBadgeH) / 2;

  fill(doc, WHITE);
  doc.roundedRect(footBadgeX, footBadgeY, footBadgeW, footBadgeH, 1.0, 1.0, "F");

  // CARD ID: text inside outer badge
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.0);
  text(doc, NAVY);
  doc.text(cardIdLabel, footBadgeX + outerPadding, footBadgeY + footBadgeH / 2 + 0.6);

  // Navy pill inside white badge
  const navyPillX = footBadgeX + outerPadding + cardIdLabelW + 1.2;
  const navyPillY = footBadgeY + (footBadgeH - 3.4) / 2;
  fill(doc, NAVY);
  doc.roundedRect(navyPillX, navyPillY, navyPillW, 3.4, 0.7, 0.7, "F");

  // Card ID value inside navy pill
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.4);
  text(doc, WHITE);
  doc.text(cardId, navyPillX + navyPillW / 2, navyPillY + 3.4 / 2 + 0.7, { align: "center" });

  // Vertical separator | between badge and Merncrest attribution
  stroke(doc, [200, 214, 232], 0.2);
  doc.line(61.5, footY + 1.5, 61.5, footY + 7.0);

  // Right: MERNcrest Solutions Attribution (stacked, right-aligned)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(2.6);
  text(doc, [200, 214, 232]);
  doc.text("Powered By", W - 4.5, footY + 2.4, { align: "right" });
  doc.text("Merncrest Solutions (Pvt) Ltd", W - 4.5, footY + 4.2, { align: "right" });
  doc.text("Merncrest.lk  |  0713838638", W - 4.5, footY + 6.0, { align: "right" });

  const safeName = (data.patientName || "patient").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`patient-id-card-${safeName}.pdf`);
}

