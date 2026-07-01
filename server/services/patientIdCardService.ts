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

type MaskRect = { x: number; y: number; w: number; h: number; fill?: string };

type FieldSpec = {
  key: keyof Pick<PatientCardInput, "name" | "id" | "phone" | "address" | "cardId">;
  x: number;
  y: number;
  size: number;
  color: string;
  weight?: string;
  anchor?: "start" | "middle" | "end";
  mask: MaskRect;
};

/**
 * Coordinates for the Maximus patient ID card raster template
 * (viewBox 0 0 1152 728). Masks cover baked-in placeholder pixels before
 * drawing real values on top.
 */
const CARD_LAYOUT = {
  fields: [
    {
      key: "name",
      x: 138,
      y: 217,
      size: 22,
      weight: "bold",
      color: "#1a3a6e",
      mask: { x: 115, y: 190, w: 450, h: 40, fill: "#ffffff" },
    },
    {
      key: "id",
      x: 310,
      y: 267,
      size: 18,
      color: "#1a3a6e",
      mask: { x: 250, y: 248, w: 360, h: 34, fill: "#ffffff" },
    },
    {
      key: "phone",
      x: 310,
      y: 317,
      size: 18,
      color: "#1a3a6e",
      mask: { x: 250, y: 298, w: 360, h: 34, fill: "#ffffff" },
    },
    {
      key: "address",
      x: 310,
      y: 367,
      size: 18,
      color: "#1a3a6e",
      mask: { x: 250, y: 348, w: 420, h: 38, fill: "#ffffff" },
    },
  ] satisfies FieldSpec[],
  cardId: {
    x: 872,
    y: 704,
    size: 15,
    color: "#ffffff",
    anchor: "start" as const,
    mask: { x: 850, y: 684, w: 295, h: 32, fill: "#1f5f9f" },
  },
  qr: {
    x: 790,
    y: 155,
    size: 200,
    mask: { x: 780, y: 145, w: 220, h: 220, fill: "#ffffff" },
  },
  /** Covers baked-in mock XML text under the QR in some template exports. */
  qrCaptionMask: { x: 748, y: 336, w: 310, h: 52, fill: "#ffffff" },
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

function hasRasterBackground(svgTemplate: string): boolean {
  return /<image[^>]+(?:xlink:)?href="data:image\//i.test(svgTemplate);
}

function hasSvgPlaceholders(svgTemplate: string): boolean {
  return /\{patient\.(?:name|id|phone|address|cardId)\}/.test(svgTemplate);
}

function fillPlaceholderTemplate(
  svgTemplate: string,
  patient: PatientCardInput,
  qrDataUrl: string
): string {
  return svgTemplate
    .replaceAll("{{QR_PLACEHOLDER}}", qrDataUrl)
    .replace(/\{patient\.name\}/g, escapeXml(patient.name))
    .replace(/\{patient\.id\}/g, escapeXml(patient.id))
    .replace(/\{patient\.phone\}/g, escapeXml(patient.phone))
    .replace(/\{patient\.address\}/g, escapeXml(patient.address))
    .replace(/\{patient\.cardId\}/g, escapeXml(patient.cardId));
}

function maskRect(rect: MaskRect): string {
  const fill = rect.fill ?? "#ffffff";
  return `<rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" fill="${fill}"/>`;
}

function textNode(
  x: number,
  y: number,
  value: string,
  options: { size: number; color: string; weight?: string; anchor?: "start" | "middle" | "end" }
): string {
  const anchor = options.anchor ? ` text-anchor="${options.anchor}"` : "";
  const weight = options.weight ? ` font-weight="${options.weight}"` : "";
  return `<text x="${x}" y="${y}"${anchor} font-family="Arial, Helvetica, sans-serif" font-size="${options.size}"${weight} fill="${options.color}">${escapeXml(value)}</text>`;
}

function buildRasterOverlay(patient: PatientCardInput, qrDataUrl: string): string {
  const masks = [
    ...CARD_LAYOUT.fields.map((field) => maskRect(field.mask)),
    maskRect(CARD_LAYOUT.cardId.mask),
    maskRect(CARD_LAYOUT.qr.mask),
    maskRect(CARD_LAYOUT.qrCaptionMask),
  ].join("\n    ");

  const labels = CARD_LAYOUT.fields
    .map((field) =>
      textNode(field.x, field.y, patient[field.key], {
        size: field.size,
        color: field.color,
        weight: field.weight,
        anchor: field.anchor,
      })
    )
    .join("\n    ");

  const cardId = textNode(CARD_LAYOUT.cardId.x, CARD_LAYOUT.cardId.y, `CARD ID: ${patient.cardId}`, {
    size: CARD_LAYOUT.cardId.size,
    color: CARD_LAYOUT.cardId.color,
    anchor: CARD_LAYOUT.cardId.anchor,
  });

  const qr = `<image id="patient-qr" x="${CARD_LAYOUT.qr.x}" y="${CARD_LAYOUT.qr.y}" width="${CARD_LAYOUT.qr.size}" height="${CARD_LAYOUT.qr.size}" xlink:href="${qrDataUrl}" href="${qrDataUrl}"/>`;

  return `<g id="patient-card-dynamic">
    ${masks}
    ${labels}
    ${cardId}
    ${qr}
  </g>`;
}

function injectBeforeClosingSvg(svgTemplate: string, fragment: string): string {
  if (!svgTemplate.includes("</svg>")) {
    throw new Error("Invalid template.svg: missing closing </svg> tag.");
  }
  return svgTemplate.replace("</svg>", `  ${fragment}\n</svg>`);
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

  let svgContent = fillPlaceholderTemplate(svgTemplate, patient, qrDataUrl);

  if (hasRasterBackground(svgContent) || hasSvgPlaceholders(svgContent)) {
    svgContent = injectBeforeClosingSvg(svgContent, buildRasterOverlay(patient, qrDataUrl));
  } else if (!/id="patient-qr"/.test(svgContent)) {
    const qrOnly = `<image id="patient-qr" x="${CARD_LAYOUT.qr.x}" y="${CARD_LAYOUT.qr.y}" width="${CARD_LAYOUT.qr.size}" height="${CARD_LAYOUT.qr.size}" xlink:href="${qrDataUrl}" href="${qrDataUrl}"/>`;
    svgContent = injectBeforeClosingSvg(svgContent, qrOnly);
  }

  const svg = Buffer.from(svgContent, "utf8");
  const png = await sharp(svg, { density: 300 }).png().toBuffer();
  return { svg, png };
}
