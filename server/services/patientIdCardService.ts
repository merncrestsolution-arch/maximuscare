import fs from "fs/promises";
import path from "path";
import QRCode from "qrcode";
import sharp from "sharp";

export interface PatientCardInput {
  id: string;
  name: string;
  phone: string;
  address: string;
  cardId: string;
  /** Signed QR token encoded into the card (matches in-app scan flow). */
  qrToken: string;
}

export interface PatientCardFiles {
  svg: Buffer;
  png: Buffer;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function resolveProjectRoot(): Promise<string> {
  const candidates = [process.cwd(), path.join(process.cwd(), "..")];
  for (const root of candidates) {
    try {
      await fs.access(path.join(root, "template.svg"));
      return root;
    } catch {
      // try next
    }
  }
  throw new Error("template.svg not found in the project root.");
}

async function loadBackgroundDataUrl(root: string): Promise<string> {
  const bgPath = path.join(root, "assets", "id-card-background.png");
  try {
    const bg = await fs.readFile(bgPath);
    return `data:image/png;base64,${bg.toString("base64")}`;
  } catch {
    throw new Error(
      "assets/id-card-background.png not found. Run: node script/extract-template-bg.mjs"
    );
  }
}

async function generateQrDataUrl(qrToken: string): Promise<string> {
  return QRCode.toDataURL(qrToken, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 400,
  });
}

function fillTemplate(
  svgTemplate: string,
  patient: PatientCardInput,
  qrDataUrl: string,
  backgroundDataUrl: string
): string {
  return svgTemplate
    .replaceAll("{{BACKGROUND_IMAGE}}", backgroundDataUrl)
    .replaceAll("{{QR_PLACEHOLDER}}", qrDataUrl)
    .replace(/\{patient\.name\}/g, escapeXml(patient.name))
    .replace(/\{patient\.id\}/g, escapeXml(patient.id))
    .replace(/\{patient\.phone\}/g, escapeXml(patient.phone))
    .replace(/\{patient\.address\}/g, escapeXml(patient.address))
    .replace(/\{patient\.cardId\}/g, escapeXml(patient.cardId));
}

/** Short unique card id printed on the card footer area. */
export function generateCardId(seed: string): string {
  const cleanSeed = (seed || "").trim();
  let base = "";
  const match = /^MC\/([A-Z]+)\/\d+\/(\d+)$/i.exec(cleanSeed);
  if (match) {
    const branch = match[1].toUpperCase();
    const seq = parseInt(match[2], 10);
    base = `MC${branch}${seq}`;
  } else {
    base = cleanSeed.replace(/[^a-z0-9]+/gi, "").toUpperCase().slice(0, 8) || "PT";
  }
  const chars = "0123456789ABCDEF";
  let hash = "";
  for (let i = 0; i < 8; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return `MX-${base}-${hash}`;
}

export async function generatePatientCardBuffers(
  patient: PatientCardInput
): Promise<PatientCardFiles> {
  const root = await resolveProjectRoot();
  const templatePath = path.join(root, "template.svg");
  const [svgTemplate, backgroundDataUrl] = await Promise.all([
    fs.readFile(templatePath, "utf8"),
    loadBackgroundDataUrl(root),
  ]);
  const qrDataUrl = await generateQrDataUrl(patient.qrToken);
  const svgContent = fillTemplate(svgTemplate, patient, qrDataUrl, backgroundDataUrl);

  const svg = Buffer.from(svgContent, "utf8");
  const png = await sharp(svg, { density: 300 }).png().toBuffer();
  return { svg, png };
}
