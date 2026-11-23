import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_NAME_RE, type ImageType } from "./upload-rules";

// Tải ảnh lên (Ngày 7 §4) — PHẦN MÁY CHỦ (đọc/ghi đĩa). Quy tắc
// thuần (magic bytes, giới hạn) nằm ở ./upload-rules.ts.
// KHÔNG dùng sharp (chưa có trong bản build — không thêm phụ thuộc):
// lưu nguyên file đã kiểm magic bytes. Xem "Khác đặc tả" báo cáo Ngày 7.

export { UPLOAD_NAME_RE, contentTypeForImage, detectImageType } from "./upload-rules";
export type { ImageType } from "./upload-rules";
export {
  MAX_IMAGES_PER_PRODUCT,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_CONTENT_LENGTH,
} from "./upload-rules";

// Thư mục lưu ảnh: env UPLOAD_DIR, mặc định ./data/uploads (tự tạo).
// Đường dẫn tương đối tính từ thư mục làm việc của tiến trình.
export function getUploadDir(): string {
  const dir = (process.env.UPLOAD_DIR ?? "./data/uploads").trim() || "./data/uploads";
  return path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
}

// Tên file do máy chủ sinh: 12 ký tự đầu của sha256 nội dung + đuôi
// theo magic bytes (không dùng tên khách → không path traversal).
// Nội dung trùng thì dùng lại file cũ.
export function uploadFileName(buf: Buffer, ext: ImageType): string {
  const hash = createHash("sha256").update(buf).digest("hex");
  return `${hash.slice(0, 12)}.${ext}`;
}

export async function saveUpload(buf: Buffer, ext: ImageType): Promise<string> {
  const dir = getUploadDir();
  await mkdir(dir, { recursive: true });
  const name = uploadFileName(buf, ext);
  const dest = path.join(dir, name);
  try {
    await stat(dest);
    // File đã có (nội dung trùng) → dùng lại, không ghi đè.
  } catch {
    await writeFile(dest, buf);
  }
  return `/uploads/${name}`;
}

export async function readUpload(name: string): Promise<Buffer | null> {
  if (!UPLOAD_NAME_RE.test(name)) return null;
  try {
    return await readFile(path.join(getUploadDir(), name));
  } catch {
    return null;
  }
}

// Liệt kê file trong thư mục upload (dùng cho scripts/prune-uploads).
export async function listUploadFiles(): Promise<string[]> {
  try {
    const entries = await readdir(getUploadDir());
    return entries.filter((e) => UPLOAD_NAME_RE.test(e));
  } catch {
    return [];
  }
}
