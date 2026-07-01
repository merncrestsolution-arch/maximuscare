import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, "template.svg");
const OUTPUT_DIR = path.join(__dirname, "output");

/** QR box center (730 + 220/2) for horizontally centered label under the code */
const QR_LABEL_X = 840;
const QR_LABEL_Y = 380;

/**
 * Generate a QR code data URL for the patient's public profile link.
 */
async function generateQrDataUrl(patientId) {
  const url = `https://maximuscare.lk/patient/${patientId}`;
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 400,
  });
}

/**
 * Replace template placeholders with patient fields.
 */
function fillTemplate(svgTemplate, patient, qrDataUrl) {
  return svgTemplate
    .replaceAll("{{QR_PLACEHOLDER}}", qrDataUrl)
    .replaceAll("{patient.name}", patient.name)
    .replaceAll("{patient.id}", patient.id)
    .replaceAll("{patient.phone}", patient.phone)
    .replaceAll("{patient.address}", patient.address)
    .replaceAll("{patient.cardId}", patient.cardId);
}

/**
 * Insert patient ID label centered under the QR image.
 */
function addQrPatientIdLabel(svgContent, patientId) {
  const label = `<text x="${QR_LABEL_X}" y="${QR_LABEL_Y}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#1a3a6e">${patientId}</text>`;

  const qrImagePattern = /(<image[^>]*id="patient-qr"[^>]*\/>)/;
  if (!qrImagePattern.test(svgContent)) {
    throw new Error('Could not find QR image element (id="patient-qr") in template.');
  }

  return svgContent.replace(qrImagePattern, `$1\n  ${label}`);
}

/**
 * Rasterize SVG to PNG at 300 DPI for print.
 */
async function convertSvgToPng(svgContent, pngPath) {
  await sharp(Buffer.from(svgContent), { density: 300 }).png().toFile(pngPath);
}

/**
 * Generate patient ID card SVG and PNG from template.svg.
 * @param {{ id: string, name: string, phone: string, address: string, cardId: string }} patient
 * @returns {Promise<{ svgPath: string, pngPath: string }>}
 */
export async function generatePatientCard(patient) {
  const svgFileName = `${patient.id}-card.svg`;
  const pngFileName = `${patient.id}-card.png`;
  const svgPath = path.join(OUTPUT_DIR, svgFileName);
  const pngPath = path.join(OUTPUT_DIR, pngFileName);

  try {
    // Step 1: Generate QR code data URL
    let qrDataUrl;
    try {
      qrDataUrl = await generateQrDataUrl(patient.id);
    } catch (err) {
      console.error(`Failed to generate QR code for patient "${patient.id}":`, err.message);
      throw err;
    }

    // Step 2: Read SVG template
    let svgTemplate;
    try {
      svgTemplate = await fs.readFile(TEMPLATE_PATH, "utf8");
    } catch (err) {
      console.error(`Failed to read template at "${TEMPLATE_PATH}":`, err.message);
      throw err;
    }

    // Step 3: Replace placeholders with patient data
    let svgContent = fillTemplate(svgTemplate, patient, qrDataUrl);

    // Step 4: Add patient ID label under QR code
    svgContent = addQrPatientIdLabel(svgContent, patient.id);

    // Step 5: Ensure output folder exists and save SVG
    try {
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
      await fs.writeFile(svgPath, svgContent, "utf8");
    } catch (err) {
      console.error(`Failed to write SVG to "${svgPath}":`, err.message);
      throw err;
    }

    // Step 6: Convert SVG to PNG at 300 DPI
    try {
      await convertSvgToPng(svgContent, pngPath);
    } catch (err) {
      console.error(`Failed to convert SVG to PNG at "${pngPath}":`, err.message);
      throw err;
    }

    return { svgPath, pngPath };
  } catch (err) {
    console.error("generatePatientCard failed:", err.message);
    throw err;
  }
}

// Step 8: Example usage when run directly
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const samplePatient = {
    id: "MC-CMB-2026-0042",
    name: "John Perera",
    phone: "+94 77 123 4567",
    address: "123 Galle Road, Colombo 03",
    cardId: "MCCMB42A1B2C3D4",
  };

  generatePatientCard(samplePatient)
    .then(({ svgPath, pngPath }) => {
      console.log("ID card generated successfully:");
      console.log("  SVG:", svgPath);
      console.log("  PNG:", pngPath);
    })
    .catch(() => {
      process.exitCode = 1;
    });
}
