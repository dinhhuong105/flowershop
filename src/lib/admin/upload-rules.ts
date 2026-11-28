// Quy tắc tải ảnh (Ngày 7 §4) — PHẦN THUẦN, không import node:*
// nên dùng được cả trong component client (ProductForm) và server.
// Phần đọc/ghi đĩa nằm ở ./uploads.ts.

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB/ảnh sản phẩm (Ngày 17 S5; trước đây 5 MB)
export const MAX_UPLOAD_CONTENT_LENGTH = 2.5 * 1024 * 1024; // từ chối sớm
export const MAX_IMAGES_PER_PRODUCT = 6; // ≤ 8 theo S5 — giữ 6 như cũ (chặt hơn)
// Kích thước điểm ảnh tối đa (Ngày 17 S5, chống bom giải nén):
// mỗi chiều ≤ 6000 px (ảnh 6000×6000 RGBA ~144 MB khi giải nén).
export const MAX_IMAGE_DIMENSION = 6000;
// Logo shop (Ngày 11 B2): tối đa 1 MB; favicon: tối đa 256 KB.
export const MAX_LOGO_BYTES = 1 * 1024 * 1024;
export const MAX_FAVICON_BYTES = 256 * 1024;
export const UPLOAD_NAME_RE = /^[a-f0-9]{12}\.(jpg|png|webp|svg|avif)$/;

export type ImageType = "jpg" | "png" | "webp" | "svg" | "avif";

// Kiểm MAGIC BYTES (không tin Content-Type hay đuôi file):
// JPEG FF D8 FF; PNG 89 50 4E 47 0D 0A 1A 0A; WebP "RIFF" + "WEBP"
// ở byte 8–11; AVIF "ftyp" + "avif" ở byte 4–11 (Ngày 20 C3/C5 —
// ảnh nhập qua safe-fetch cũng xác thực AVIF). SVG, GIF, HEIC,
// file rỗng, file giả đuôi → null.
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
  if (
    buf.length >= 12 &&
    buf.subarray(4, 8).toString("ascii") === "ftyp" &&
    buf.subarray(8, 12).toString("ascii") === "avif"
  ) {
    return "avif";
  }
  return null;
}

export function contentTypeForImage(name: string): string {
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".svg")) return "image/svg+xml";
  if (name.endsWith(".avif")) return "image/avif";
  return "image/jpeg";
}

// Đọc kích thước điểm ảnh từ header file (không giải nén toàn bộ):
// PNG: IHDR (width/height BE 32-bit ở byte 16–23); JPEG: segment
// SOF0/1/2; WebP: VP8X / VP8L / VP8 (lossy). Trả null khi không đọc
// được (file hỏng hoặc định dạng lạ) — tầng gọi coi null là từ chối
// vì magic bytes đã khớp nhưng header kích thước không đọc được.
export function imageDimensions(buf: Buffer): { width: number; height: number } | null {
  const type = detectImageType(buf);
  if (type === "png") {
    if (buf.length < 24) return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (type === "webp") {
    if (buf.length < 12 || buf.subarray(12, 16).toString("ascii") === "VP8X") {
      if (buf.length < 30) return null;
      const w = buf.readUIntLE(24, 3) + 1;
      const h = buf.readUIntLE(27, 3) + 1;
      return { width: w, height: h };
    }
    const fourcc = buf.subarray(12, 16).toString("ascii");
    if (fourcc === "VP8L") {
      if (buf.length < 25) return null;
      const b1 = buf[21]!;
      const b2 = buf[22]!;
      const b3 = buf[23]!;
      const b4 = buf[24]!;
      const w = (b1 | ((b2 & 0x3f) << 8)) + 1;
      const h = ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)) + 1;
      return { width: w, height: h };
    }
    if (fourcc === "VP8 ") {
      if (buf.length < 30) return null;
      if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
      const w = buf.readUInt16LE(26) & 0x3fff;
      const h = buf.readUInt16LE(28) & 0x3fff;
      return { width: w, height: h };
    }
    return null;
  }
  if (type === "jpg") {
    // Quét segment JPEG: 0xFF + marker; segment có độ dài (2 byte
    // BE, tính cả 2 byte độ dài). SOF0/1/2 chứa height/width.
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1]!;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      if (len < 2 || i + 2 + len > buf.length) return null;
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return null;
  }
  return null;
}

// Kiểm SVG an toàn — GIỮ LẠI chỉ để kiểm SVG ĐÃ TẢI TRƯỚC Ngày 17
// (logo SVG cũ vẫn hiển thị bằng <img>, không bao giờ nội tuyến).
// Từ Ngày 17 S5 KHÔNG nhận SVG mới (route settings/upload từ chối);
// logo/favicon dùng png/webp. Hàm vẫn được test để không mất
// hàng rào phòng thủ nếu sau này cần kiểm lại file cũ.
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
// > 2,5 MB → 413. Trả null khi qua được kiểm tra.
export function checkUploadContentLength(
  header: string | null,
  // Giới hạn trần cho lần kiểm sớm (mặc định 2,5 MB của ảnh sản phẩm;
  // upload logo/favicon Ngày 11 truyền trần riêng nhỏ hơn).
  maxBytes: number = MAX_UPLOAD_CONTENT_LENGTH,
  maxLabel: string = "2 MB/ảnh",
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
