const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const ALLOWED_EXT = new Set(["pdf", "docx", "jpg", "jpeg", "png", "webp"]);

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function validateFileUpload(params: {
  mimeType?: string;
  extension?: string;
  sizeBytes: number;
}): { ok: true } | { ok: false; message: string } {
  if (params.sizeBytes > MAX_UPLOAD_BYTES) {
    return { ok: false, message: "File must be 10 MB or smaller" };
  }
  const ext = (params.extension ?? "").toLowerCase().replace(/^\./, "");
  const mime = (params.mimeType ?? "").toLowerCase();
  if (mime && ALLOWED_MIME.has(mime)) return { ok: true };
  if (ext && ALLOWED_EXT.has(ext)) return { ok: true };
  return { ok: false, message: "File type not allowed. Use PDF, DOCX, JPG, PNG, or WEBP." };
}

export function validateDataUriUpload(dataUri: string, maxBytes = MAX_UPLOAD_BYTES): { ok: true } | { ok: false; message: string } {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return { ok: false, message: "Invalid file data URI" };
  const mime = match[1];
  const bytes = Buffer.byteLength(match[2], "base64");
  return validateFileUpload({ mimeType: mime, sizeBytes: bytes });
}
