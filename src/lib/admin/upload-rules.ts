// Quy tắc tải ảnh (Ngày 7 §4) — PHẦN THUẦN, không import node:*
// nên dùng được cả trong component client (ProductForm) và server.
// Phần đọc/ghi đĩa nằm ở ./uploads.ts.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB/ảnh
export const MAX_UPLOAD_CONTENT_LENGTH = 5.5 * 1024 * 1024; // từ chối sớm
export const MAX_IMAGES_PER_PRODUCT = 6;
// Logo shop (Ngày 11 B2): tối đa 1 MB; favicon: tối đa 256 KB.
export const MAX_LOGO_BYTES = 1 * 1024 * 1024;
export const MAX_FAVICON_BYTES = 256 * 1024;
export const UPLOAD_NAME_RE = /^[a-f0-9]{12}\.(jpg|png|webp|svg)$/;

export type ImageType = "jpg" | "png" | "webp" | "svg";

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
  if (name.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

// Kiểm SVG an toàn (Ngày 11 B2 — chỉ logo/favicon được nhận SVG,
// vì SVG là văn bản XML nên magic bytes không áp dụng).
// SVG tải lên được phục vụ cùng origin với shop, nên file SVG chứa
// mã sẽ chạy trong origin của shop (XSS): chỉ nhận SVG "tĩnh".
// Chấp nhận: tài liệu bắt đầu bằng <?xml?> (tùy chọn) rồi <svg>.
// Từ chối: <script>, <foreignObject>, <iframe>, <object>, <embed>,
// <link>, <meta>, <base>, <style>, mọi thuộc tính sự kiện on*,
// "javascript:" và @import ở bất cứ đâu.
export function isSafeSvgText(text: string): boolean {
  const t = text.trim();
  if (!/^(\s*<\?xml[^>]*\?>\s*)?<svg[\s>]/.test(t)) return false;
  if (/<(script|foreignObject|iframe|object|embed|link|meta|base|style)[\s/>]/i.test(t)) {
    return false;
  }
  if (/on\w+\s*=/i.test(t)) return false;
  if (/javascript:/i.test(t)) return false;
  if (/@import/i.test(t)) return false;
  return true;
}

// Kiểm Content-Length trước khi đọc body (Ngày 8 K-2): thiếu hoặc
// không phải số (body chunked) → 411, KHÔNG đọc hết body vào RAM;
// > 5,5 MB → 413. Trả null khi qua được kiểm tra.
export function checkUploadContentLength(
  header: string | null,
  // Giới hạn trần cho lần kiểm sớm (mặc định 5,5 MB của ảnh sản phẩm;
  // upload logo/favicon Ngày 11 truyền trần riêng nhỏ hơn).
  maxBytes: number = MAX_UPLOAD_CONTENT_LENGTH,
  maxLabel: string = "5 MB/ảnh",
): { status: 411 | 413; error: string } | null {
  if (header === null || header.trim() === "") {
    return { status: 411, error: "Thiếu Content-Length." };
  }
  const n = Number(header);
  if (!Number.isFinite(n) || n < 0) {
    return { status: 411, error: "Content-Length không hợp lệ." };
  }
  if (n > maxBytes) {
    return { status: 413, error: `File quá lớn (tối đa ${maxLabel}).` };
  }
  return null;
}
