// Quy tắc tải ảnh (Ngày 7 §4) — PHẦN THUẦN, không import node:*
// nên dùng được cả trong component client (ProductForm) và server.
// Phần đọc/ghi đĩa nằm ở ./uploads.ts.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB/ảnh
export const MAX_UPLOAD_CONTENT_LENGTH = 5.5 * 1024 * 1024; // từ chối sớm
export const MAX_IMAGES_PER_PRODUCT = 6;
export const UPLOAD_NAME_RE = /^[a-f0-9]{12}\.(jpg|png|webp)$/;

export type ImageType = "jpg" | "png" | "webp";

// Kiểm MAGIC BYTES (không tin Content-Type hay đuôi file):
// JPEG FF D8 FF; PNG 89 50 4E 47 0D 0A 1A 0A; WebP "RIFF" + "WEBP"
// ở byte 8–11. SVG, GIF, HEIC, file rỗng, file giả đuôi → null.
export function detectImageType(buf: Buffer): ImageType | null {
  if (buf.length === 0) return null;
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "png";
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function contentTypeForImage(name: string): string {
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

// Kiểm Content-Length trước khi đọc body (Ngày 8 K-2): thiếu hoặc
// không phải số (body chunked) → 411, KHÔNG đọc hết body vào RAM;
// > 5,5 MB → 413. Trả null khi qua được kiểm tra.
export function checkUploadContentLength(
  header: string | null,
): { status: 411 | 413; error: string } | null {
  if (header === null || header.trim() === "") {
    return { status: 411, error: "Thiếu Content-Length." };
  }
  const n = Number(header);
  if (!Number.isFinite(n) || n < 0) {
    return { status: 411, error: "Content-Length không hợp lệ." };
  }
  if (n > MAX_UPLOAD_CONTENT_LENGTH) {
    return { status: 413, error: "File quá lớn (tối đa 5 MB/ảnh)." };
  }
  return null;
}
