import fs from "fs/promises";
import path from "path";
import QRCode from "qrcode";
import sharp from "sharp";
import { Resvg } from "@resvg/resvg-js";
import type { OrganizationId } from "@shared/branchAccess";
import { signPatientQrToken, verifyPatientQrToken } from "./qrTokenService";

export interface PatientCardInput {
  id: string;
  name: string;
  phone: string;
  address: string;
  cardId: string;
  /** Signed patient QR token — same payload as the in-app “Show QR Code” button. */
  qrToken: string;
}

export interface PatientCardFiles {
  svg: Buffer;
  png: Buffer;
  pdf: Buffer;
}

/** ISO/IEC 7810 ID-1 (credit card) landscape — matches the Canva template aspect ratio. */
const CARD_WIDTH_MM = 85.6;
const CARD_HEIGHT_MM = 53.98;

type FieldLayout = {
  x: number;
  y: number;
  size: number;
  bold?: boolean;
  color: string;
};

type CardLayoutConfig = {
  viewBox: { width: number; height: number };
  outputWidth: number;
  fields: {
    name: FieldLayout;
    id: FieldLayout;
    phone: FieldLayout;
    address: FieldLayout;
    cardId: FieldLayout;
  };
  qr: {
    x: number;
    y: number;
    size: number;
    margin: number;
    box?: { x: number; y: number; width: number; height: number };
    padding?: number;
    paddingTop?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingBottom?: number;
  };
};

const DEFAULT_LAYOUT: CardLayoutConfig = {
  viewBox: { width: 1152, height: 728.25 },
  outputWidth: 4800,
  fields: {
    name: { x: 138, y: 314, size: 22, bold: true, color: "#1a3a6e" },
    id: { x: 310, y: 388, size: 17, color: "#1a3a6e" },
    phone: { x: 310, y: 453, size: 17, color: "#1a3a6e" },
    address: { x: 310, y: 513, size: 17, color: "#1a3a6e" },
    cardId: { x: 792, y: 682, size: 12, color: "#ffffff" },
  },
  qr: {
    x: 854,
    y: 276,
    size: 164,
    margin: 0,
    box: { x: 868, y: 286, width: 154, height: 154 },
    paddingTop: 3,
    paddingLeft: 3,
    paddingRight: 3,
    paddingBottom: 3,
  },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function resolveProjectRoot(): Promise<string> {
  for (const root of [process.cwd(), path.join(process.cwd(), "..")]) {
    try {
      await fs.access(path.join(root, "assets", "id-card-background.png"));
      return root;
    } catch {
      // try next
    }
  }
  throw new Error("assets/id-card-background.png not found in the project root.");
}

async function loadLayout(root: string): Promise<CardLayoutConfig> {
  try {
    const raw = await fs.readFile(path.join(root, "id-card-layout.json"), "utf8");
    const json = JSON.parse(raw) as Partial<CardLayoutConfig>;
    return {
      ...DEFAULT_LAYOUT,
      ...json,
      viewBox: { ...DEFAULT_LAYOUT.viewBox, ...json.viewBox },
      fields: { ...DEFAULT_LAYOUT.fields, ...json.fields },
      qr: { ...DEFAULT_LAYOUT.qr, ...json.qr },
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

/** Center QR inside the Canva box; asymmetric padding corrects visual offset in the frame. */
function resolveQrRect(layout: CardLayoutConfig): { x: number; y: number; size: number; margin: number } {
  const { qr } = layout;
  if (qr.box) {
    const fallback = qr.padding ?? 8;
    const pt = qr.paddingTop ?? fallback;
    const pl = qr.paddingLeft ?? fallback;
    const pr = qr.paddingRight ?? fallback;
    const pb = qr.paddingBottom ?? fallback;
    const innerW = qr.box.width - pl - pr;
    const innerH = qr.box.height - pt - pb;
    const size = Math.min(innerW, innerH);
    return {
      x: qr.box.x + pl + (innerW - size) / 2,
      y: qr.box.y + pt + (innerH - size) / 2,
      size,
      margin: qr.margin ?? 0,
    };
  }
  return { x: qr.x, y: qr.y, size: qr.size, margin: qr.margin };
}

function textNode(field: FieldLayout, value: string): string {
  const weight = field.bold ? ` font-weight="bold"` : "";
  return `<text x="${field.x}" y="${field.y}" font-family="DejaVu Sans, Arial, Helvetica, sans-serif" font-size="${field.size}"${weight} fill="${field.color}">${escapeXml(value)}</text>`;
}

function buildTextOverlaySvg(patient: PatientCardInput, layout: CardLayoutConfig): string {
  const { viewBox, fields } = layout;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${viewBox.width}" height="${viewBox.height}" viewBox="0 0 ${viewBox.width} ${viewBox.height}">
  <g id="patient-fields">
    ${textNode(fields.name, patient.name)}
    ${textNode(fields.id, patient.id)}
    ${textNode(fields.phone, patient.phone)}
    ${textNode(fields.address, patient.address)}
    ${textNode(fields.cardId, patient.cardId)}
  </g>
</svg>`;
}

function renderSvgWidth(svg: string, width: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: true },
  });
  return Buffer.from(resvg.render().asPng());
}

/** Same QR settings as the in-app “Show QR Code” dialog, scaled to the card box. */
async function generateQrPng(qrToken: string, pixelSize: number, margin: number): Promise<Buffer> {
  const raw = await QRCode.toBuffer(qrToken, {
    type: "png",
    width: pixelSize,
    margin,
    errorCorrectionLevel: "M",
    color: { dark: "#000000ff", light: "#ffffffff" },
  });
  // Remove quiet-zone whitespace so the modules fill the Canva frame evenly.
  return sharp(raw).trim().resize(pixelSize, pixelSize, { fit: "fill" }).png().toBuffer();
}

/** Reuse the dialog QR token when valid; otherwise mint a fresh signed token. */
export function resolvePatientQrTokenForCard(
  provided: string | undefined,
  expectedPatientId: string,
  organizationId: OrganizationId
): string {
  const raw = String(provided ?? "").trim();
  if (raw) {
    const verified = verifyPatientQrToken(raw);
    if (
      verified.ok &&
      verified.payload?.patientId === expectedPatientId &&
      verified.payload?.organizationId === organizationId
    ) {
      return raw;
    }
  }
  return signPatientQrToken({ patientId: expectedPatientId, organizationId });
}

export function generateCardId(seed: string): string {
  const cleanSeed = (seed || "").trim();
  let base = "";
  const match = /^MC\/([A-Z]+)\/\d+\/(\d+)$/i.exec(cleanSeed);
  if (match) {
    base = `MC${match[1].toUpperCase()}${parseInt(match[2], 10)}`;
  } else {
    base = cleanSeed.replace(/[^a-z0-9]+/gi, "").toUpperCase().slice(0, 8) || "PT";
  }
  const chars = "0123456789ABCDEF";
  let hash = "";
  for (let i = 0; i < 8; i++) hash += chars[Math.floor(Math.random() * chars.length)];
  return `MX-${base}-${hash}`;
}

/**
 * Pillow-style compositing: background PNG + text overlay + patient QR stamped
 * at exact pixel coordinates so the code fills the Canva box.
 */
export async function generatePatientCardBuffers(
  patient: PatientCardInput
): Promise<PatientCardFiles> {
  const root = await resolveProjectRoot();
  const layout = await loadLayout(root);
  const bgPath = path.join(root, "assets", "id-card-background.png");
  const background = await fs.readFile(bgPath);

  const outputWidth = layout.outputWidth;
  const bgMeta = await sharp(background).metadata();
  const outputHeight = Math.round(outputWidth * ((bgMeta.height ?? 1) / (bgMeta.width ?? 1)));

  const basePng = await sharp(background).resize(outputWidth, outputHeight).png().toBuffer();
  const textPng = renderSvgWidth(buildTextOverlaySvg(patient, layout), outputWidth);

  const scale = outputWidth / layout.viewBox.width;
  const qrRect = resolveQrRect(layout);
  const qrSize = Math.round(qrRect.size * scale);
  const qrLeft = Math.round(qrRect.x * scale);
  const qrTop = Math.round(qrRect.y * scale);
  const qrPng = await generateQrPng(patient.qrToken, qrSize, qrRect.margin);

  const png = await sharp(basePng)
    .composite([
      { input: textPng, top: 0, left: 0 },
      { input: qrPng, top: qrTop, left: qrLeft },
    ])
    .png()
    .toBuffer();

  const svg = Buffer.from(
    `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${layout.viewBox.width} ${layout.viewBox.height}">
  <!-- Generated via sharp composite; see id-card-layout.json -->
  ${buildTextOverlaySvg(patient, layout)}
</svg>`,
    "utf8"
  );

  return { svg, png, pdf: await pngToIdCardPdfBuffer(png) };
}

/** Embed the rendered card raster in a print-ready PDF (ID-1 landscape). */
export async function pngToIdCardPdfBuffer(png: Buffer): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    unit: "mm",
    format: [CARD_WIDTH_MM, CARD_HEIGHT_MM],
    compress: true,
  });
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
  doc.addImage(dataUrl, "PNG", 0, 0, CARD_WIDTH_MM, CARD_HEIGHT_MM, undefined, "FAST");
  return Buffer.from(doc.output("arraybuffer"));
}

/** Printable patient ID card as PDF only (used by the download API). */
export async function generatePatientCardPdf(patient: PatientCardInput): Promise<Buffer> {
  const { pdf } = await generatePatientCardBuffers(patient);
  return pdf;
}

/** @deprecated Canva cleanup helper — kept for prepare-canva-template.mjs */
export function stripCanvaQrSnippetText(svg: string): string {
  return svg.replace(/<text\b[^>]*>([\s\S]*?)<\/text>/gi, (match, inner: string) => {
    const compact = inner.replace(/\s+/g, " ");
    if (/<\s*(rect|image|svg)\b/i.test(compact)) return "";
    if (/qrCode|QR_PLACEHOLDER/i.test(compact) && /<\s*(rect|image)/i.test(compact)) return "";
    if (/xlink:href|xmlns=|<\?xml/i.test(compact)) return "";
    return match;
  });
}
