import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";

export const UPLOADS_DIR = path.resolve(__dirname, "..", "..", "uploads");
const BOTTLES_DIR = path.join(UPLOADS_DIR, "bottles");

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const BOTTLE_IMAGE_MIMES = Object.keys(MIME_EXT);
export const BOTTLE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function ensureUploadsDir() {
  mkdirSync(BOTTLES_DIR, { recursive: true });
}

export function saveBottleImage(buffer: Buffer, mimeType: string) {
  ensureUploadsDir();
  const ext = MIME_EXT[mimeType];
  if (!ext) throw new Error("Unsupported image type");
  const filename = `${randomUUID()}.${ext}`;
  writeFileSync(path.join(BOTTLES_DIR, filename), buffer);
  return `/api/v1/media/bottles/${filename}`;
}

export function deleteUploadedFile(imageUrl?: string | null) {
  if (!imageUrl) return;
  const match = imageUrl.match(/\/(?:api\/v1\/media|uploads)\/bottles\/([a-zA-Z0-9-]+\.(?:jpg|png|webp|gif))$/);
  if (!match) return;
  const filePath = path.join(BOTTLES_DIR, match[1]);
  if (existsSync(filePath)) unlinkSync(filePath);
}
