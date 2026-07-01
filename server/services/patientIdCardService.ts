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

const QR_LABEL_X = 957;
const QR_LABEL_Y = 434;
const QR_IMAGE = { x: 843, y: 183, size: 228 };

/** Layout for raster-only templates (viewBox 0 0 1152 728). */
const OVERLAY_LAYOUT = {
  name: { x: 46, y: 200, size: 36, weight: "bold", color: "#1a4d8f" },
  patientId: { x: 46, y: 263, size: 20, color: "#6e747c", prefix: "Patient ID: " },
  phone: { x: 46, y: 308, size: 20, color: "#6e747c", prefix: "Phone: " },
  address: { x: 46, y: 354, size: 20, color: "#6e747c", prefix: "Address: " },
  cardId: { x: 46, y: 399, size: 20, color: "#6e747c", prefix: "Card ID: " },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function resolveTemplatePath(): Promise<string> {
  const candidates = [
    path.join(process.cwd(), "template.svg"),
    path.join(process.cwd(), "..", "template.svg"),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error("template.svg not found in the project root.");
}

async function generateQrDataUrl(qrToken: string): Promise<string> {
  return QRCode.toDataURL(qrToken, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 400,
  });
}

function fillPlaceholderTemplate(
  svgTemplate: string,
  patient: PatientCardInput,
  qrDataUrl: string
): string {
  return svgTemplate
    .replaceAll("{{QR_PLACEHOLDER}}", qrDataUrl)
    .replaceAll("{patient.name}", escapeXml(patient.name))
    .replaceAll("{patient.id}", escapeXml(patient.id))
    .replaceAll("{patient.phone}", escapeXml(patient.phone))
    .replaceAll("{patient.address}", escapeXml(patient.address))
    .replaceAll("{patient.cardId}", escapeXml(patient.cardId));
}

function addQrPatientIdLabel(svgContent: string, patientId: string): string {
  const label = `<text x="${QR_LABEL_X}" y="${QR_LABEL_Y}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#1a3a6e">${escapeXml(patientId)}</text>`;
  const qrImagePattern = /(<image[^>]*id="patient-qr"[^>]*\/>)/;
  if (!qrImagePattern.test(svgContent)) {
    return svgContent;
  }
  return svgContent.replace(qrImagePattern, `$1\n  ${label}`);
}

function buildOverlayGroup(patient: PatientCardInput, qrDataUrl: string): string {
  const rows = [
    {
      ...OVERLAY_LAYOUT.name,
      text: patient.name,
      weight: OVERLAY_LAYOUT.name.weight,
    },
    { ...OVERLAY_LAYOUT.patientId, text: `${OVERLAY_LAYOUT.patientId.prefix}${patient.id}` },
    { ...OVERLAY_LAYOUT.phone, text: `${OVERLAY_LAYOUT.phone.prefix}${patient.phone}` },
    { ...OVERLAY_LAYOUT.address, text: `${OVERLAY_LAYOUT.address.prefix}${patient.address}` },
    { ...OVERLAY_LAYOUT.cardId, text: `${OVERLAY_LAYOUT.cardId.prefix}${patient.cardId}` },
  ];

  const textNodes = rows
    .map((row) => {
      const weight = "weight" in row && row.weight ? ` font-weight="${row.weight}"` : "";
      return `<text x="${row.x}" y="${row.y}" font-family="Arial, sans-serif" font-size="${row.size}"${weight} fill="${row.color}">${escapeXml(row.text)}</text>`;
    })
    .join("\n    ");

  return `<g id="patient-card-dynamic">
    <image id="patient-qr" x="${QR_IMAGE.x}" y="${QR_IMAGE.y}" width="${QR_IMAGE.size}" height="${QR_IMAGE.size}" xlink:href="${qrDataUrl}" href="${qrDataUrl}"/>
    <text x="${QR_LABEL_X}" y="${QR_LABEL_Y}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#1a3a6e">${escapeXml(patient.id)}</text>
    ${textNodes}
  </g>`;
}

function injectOverlay(svgTemplate: string, patient: PatientCardInput, qrDataUrl: string): string {
  const overlay = buildOverlayGroup(patient, qrDataUrl);
  if (svgTemplate.includes("</svg>")) {
    return svgTemplate.replace("</svg>", `  ${overlay}\n</svg>`);
  }
  throw new Error("Invalid template.svg: missing closing </svg> tag.");
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
  const templatePath = await resolveTemplatePath();
  const svgTemplate = await fs.readFile(templatePath, "utf8");
  const qrDataUrl = await generateQrDataUrl(patient.qrToken);

  let svgContent: string;
  if (svgTemplate.includes("{patient.name}")) {
    svgContent = fillPlaceholderTemplate(svgTemplate, patient, qrDataUrl);
    svgContent = addQrPatientIdLabel(svgContent, patient.id);
  } else {
    svgContent = injectOverlay(svgTemplate, patient, qrDataUrl);
  }

  const svg = Buffer.from(svgContent, "utf8");
  const png = await sharp(svg, { density: 300 }).png().toBuffer();
  return { svg, png };
}
