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
  qrToken: string;
}

export interface PatientCardFiles {
  svg: Buffer;
  png: Buffer;
}

type QrLayout = { x: number; y: number; size: number };

const DEFAULT_QR: QrLayout = { x: 905, y: 142, size: 188 };

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
      await fs.access(path.join(root, "template.svg"));
      return root;
    } catch {
      // try next
    }
  }
  throw new Error("template.svg not found in the project root.");
}

async function loadQrLayout(root: string): Promise<QrLayout> {
  try {
    const raw = await fs.readFile(path.join(root, "id-card-layout.json"), "utf8");
    const json = JSON.parse(raw) as { qr?: Partial<QrLayout> };
    return { ...DEFAULT_QR, ...json.qr };
  } catch {
    return DEFAULT_QR;
  }
}

async function loadBackgroundDataUrl(root: string): Promise<string | null> {
  const bgPath = path.join(root, "assets", "id-card-background.png");
  try {
    const bg = await fs.readFile(bgPath);
    return `data:image/png;base64,${bg.toString("base64")}`;
  } catch {
    return null;
  }
}

async function generateQrDataUrl(qrToken: string): Promise<string> {
  return QRCode.toDataURL(qrToken, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 400,
  });
}

/** Remove SVG/XML snippet text accidentally pasted into the Canva QR box. */
export function stripCanvaQrSnippetText(svg: string): string {
  return svg.replace(/<text\b[^>]*>([\s\S]*?)<\/text>/gi, (match, inner: string) => {
    const compact = inner.replace(/\s+/g, " ");
    if (/<\s*(rect|image|svg)\b/i.test(compact)) return "";
    if (/qrCode|QR_PLACEHOLDER/i.test(compact) && /<\s*(rect|image)/i.test(compact)) return "";
    if (/xlink:href|xmlns=|<\?xml/i.test(compact)) return "";
    return match;
  });
}

function fillPatientFields(svg: string, patient: PatientCardInput): string {
  return svg
    .replace(/\{patient\.name\}/g, escapeXml(patient.name))
    .replace(/\{patient\.id\}/g, escapeXml(patient.id))
    .replace(/\{patient\.phone\}/g, escapeXml(patient.phone))
    .replace(/\{patient\.address\}/g, escapeXml(patient.address))
    .replace(/\{patient\.cardId\}/g, escapeXml(patient.cardId));
}

function injectQrImage(svg: string, qrDataUrl: string, layout: QrLayout): string {
  let out = svg
    .replace(/<text\b[^>]*>\s*\{\{QR_PLACEHOLDER\}\}\s*<\/text>/gi, "")
    .replace(/\{\{QR_PLACEHOLDER\}\}/g, qrDataUrl);

  if (out.includes(qrDataUrl)) {
    return out;
  }

  const slot = `<g id="patient-qr-slot">
  <rect x="${layout.x - 4}" y="${layout.y - 4}" width="${layout.size + 8}" height="${layout.size + 8}" fill="#ffffff"/>
  <image id="patient-qr" x="${layout.x}" y="${layout.y}" width="${layout.size}" height="${layout.size}" xlink:href="${qrDataUrl}" href="${qrDataUrl}"/>
</g>`;

  return out.replace(/<\/svg>\s*$/i, `  ${slot}\n</svg>`);
}

function fillTemplate(
  svgTemplate: string,
  patient: PatientCardInput,
  qrDataUrl: string,
  backgroundDataUrl: string | null,
  qrLayout: QrLayout
): string {
  let svg = stripCanvaQrSnippetText(svgTemplate);

  if (backgroundDataUrl && svg.includes("{{BACKGROUND_IMAGE}}")) {
    svg = svg.replaceAll("{{BACKGROUND_IMAGE}}", backgroundDataUrl);
  }

  svg = fillPatientFields(svg, patient);
  svg = injectQrImage(svg, qrDataUrl, qrLayout);
  return svg;
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

export async function generatePatientCardBuffers(
  patient: PatientCardInput
): Promise<PatientCardFiles> {
  const root = await resolveProjectRoot();
  const templatePath = path.join(root, "template.svg");
  const [svgTemplate, qrLayout] = await Promise.all([
    fs.readFile(templatePath, "utf8"),
    loadQrLayout(root),
  ]);

  const backgroundDataUrl = svgTemplate.includes("{{BACKGROUND_IMAGE}}")
    ? await loadBackgroundDataUrl(root)
    : null;

  if (svgTemplate.includes("{{BACKGROUND_IMAGE}}") && !backgroundDataUrl) {
    throw new Error("template.svg uses {{BACKGROUND_IMAGE}} but assets/id-card-background.png is missing.");
  }

  const qrDataUrl = await generateQrDataUrl(patient.qrToken);
  const svgContent = fillTemplate(svgTemplate, patient, qrDataUrl, backgroundDataUrl, qrLayout);
  const svg = Buffer.from(svgContent, "utf8");
  const png = await sharp(svg, { density: 300 }).png().toBuffer();
  return { svg, png };
}
