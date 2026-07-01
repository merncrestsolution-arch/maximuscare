/**
 * Prepare a Canva-exported SVG for use as template.svg
 *
 * Usage:
 *   1. In Canva, design your card with text placeholders (see below)
 *   2. Download → SVG
 *   3. node script/prepare-canva-template.mjs "C:\Downloads\your-canva-file.svg"
 *
 * Canva text placeholders (type exactly):
 *   {patient.name}  {patient.id}  {patient.phone}  {patient.address}  {patient.cardId}
 *
 * QR box: leave EMPTY (do not paste code). The app injects the QR automatically.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function stripCanvaQrSnippetText(svg) {
  return svg.replace(/<text\b[^>]*>([\s\S]*?)<\/text>/gi, (match, inner) => {
    const compact = inner.replace(/\s+/g, " ");
    if (/<\s*(rect|image|svg)\b/i.test(compact)) return "";
    if (/qrCode|QR_PLACEHOLDER/i.test(compact) && /<\s*(rect|image)/i.test(compact)) return "";
    if (/xlink:href|xmlns=|<\?xml/i.test(compact)) return "";
    return match;
  });
}

const input = process.argv[2];
if (!input) {
  console.error("Usage: node script/prepare-canva-template.mjs <path-to-canva-export.svg>");
  process.exit(1);
}

const src = path.resolve(input);
let svg = fs.readFileSync(src, "utf8");
svg = stripCanvaQrSnippetText(svg);

const required = ["{patient.name}", "{patient.id}", "{patient.phone}", "{patient.address}", "{patient.cardId}"];
const missing = required.filter((p) => !svg.includes(p));
if (missing.length) {
  console.warn("Warning: these placeholders were not found in the SVG:");
  missing.forEach((p) => console.warn("  -", p));
  console.warn("Add them as separate text boxes in Canva, then re-export.");
}

const dest = path.join(root, "template.svg");
fs.writeFileSync(dest, svg, "utf8");
console.log("Saved", dest);
console.log("Next: git add template.svg && git push");
