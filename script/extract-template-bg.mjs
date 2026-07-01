import fs from "fs";
import path from "path";

const svg = fs.readFileSync("template.svg", "utf8");
const match = svg.match(/<image[^>]+(?:xlink:)?href="(data:image\/[^"]+)"/i);
if (!match) {
  console.error("No embedded image found in template.svg");
  process.exit(1);
}
const dataUrl = match[1];
const comma = dataUrl.indexOf(",");
const header = dataUrl.slice(0, comma);
const base64 = dataUrl.slice(comma + 1);
const ext = header.includes("png") ? "png" : "jpg";
const outDir = "assets";
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `id-card-background.${ext}`);
fs.writeFileSync(outPath, Buffer.from(base64, "base64"));
console.log("Wrote", outPath, fs.statSync(outPath).size, "bytes");
