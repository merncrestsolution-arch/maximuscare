import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { signPatientQrToken } from "./server/services/qrTokenService";
import { generateCardId, generatePatientCardBuffers } from "./server/services/patientIdCardService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Generate ID card PDF in output/ — run: npx tsx generateIdCard.ts */
export async function generatePatientCard(patient: {
  id: string;
  name: string;
  phone: string;
  address: string;
  cardId?: string;
}) {
  const token = signPatientQrToken({ patientId: patient.id, organizationId: "maximus" });
  const { pdf } = await generatePatientCardBuffers({
    ...patient,
    cardId: patient.cardId ?? generateCardId(patient.id),
    qrToken: token,
  });
  const outputDir = path.join(__dirname, "output");
  await fs.mkdir(outputDir, { recursive: true });
  const pdfPath = path.join(outputDir, `${patient.id}-card.pdf`);
  await fs.writeFile(pdfPath, pdf);
  return { pdfPath };
}

const sample = {
  id: "MC-CMB-2026-0042",
  name: "John Perera",
  phone: "+94 77 123 4567",
  address: "123 Galle Road, Colombo 03",
};

generatePatientCard(sample)
  .then(({ pdfPath }) => {
    console.log("ID card generated:");
    console.log(" ", pdfPath);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
