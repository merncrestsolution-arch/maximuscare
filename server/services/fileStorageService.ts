import { mkdirSync, existsSync, writeFileSync, readFileSync, unlinkSync } from "fs";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");
const MAX_BYTES = Number(process.env.DOCUMENT_MAX_BYTES || 10 * 1024 * 1024);
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isS3Enabled(): boolean {
  return Boolean(process.env.S3_BUCKET);
}

function s3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  return new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: endpoint || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}

export function validateDocumentMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

export function validateDocumentSize(bytes: number): boolean {
  return bytes > 0 && bytes <= MAX_BYTES;
}

export function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1];
  const buffer = Buffer.from(match[2], "base64");
  return { mime, buffer };
}

export async function uploadPatientDocument(
  patientId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string,
): Promise<{ storageKey: string; fileSize: number }> {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `patients/${patientId}/${Date.now()}-${safeName}`;

  if (isS3Enabled()) {
    await s3Client().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return { storageKey, fileSize: buffer.length };
  }

  const localPath = path.join(UPLOAD_ROOT, storageKey);
  const dir = path.dirname(localPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(localPath, buffer);
  return { storageKey, fileSize: buffer.length };
}

export async function getDocumentReadStream(
  storageKey: string,
): Promise<{ body: Buffer; mimeType: string }> {
  if (isS3Enabled()) {
    const res = await s3Client().send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: storageKey,
      }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty file");
    return {
      body: Buffer.from(bytes),
      mimeType: res.ContentType || "application/octet-stream",
    };
  }

  const localPath = path.join(UPLOAD_ROOT, storageKey);
  if (!existsSync(localPath)) throw new Error("File not found");
  return {
    body: readFileSync(localPath),
    mimeType: guessMime(storageKey),
  };
}

export async function getDocumentSignedUrl(storageKey: string, expiresSec = 3600): Promise<string | null> {
  if (!isS3Enabled()) return null;
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: storageKey,
    }),
    { expiresIn: expiresSec },
  );
}

export async function deleteStoredDocument(storageKey: string): Promise<void> {
  if (isS3Enabled()) {
    await s3Client().send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: storageKey,
      }),
    );
    return;
  }
  const localPath = path.join(UPLOAD_ROOT, storageKey);
  if (existsSync(localPath)) unlinkSync(localPath);
}

function guessMime(key: string): string {
  const ext = path.extname(key).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}
