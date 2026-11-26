// Module lưu ảnh duy nhất (Ngày 11 B1.3): MỌI chỗ upload (ảnh sản
// phẩm, logo, favicon) đều qua một giao diện saveImage/deleteImage.
// Hai adapter qua cùng interface:
// - disk: thư mục public/uploads trong source — dùng ở local và sau
//   này trên VPS (nơi ổ đĩa bền, upload vào thư mục public là giữ
//   lại được; quyết định của Henry 26/11).
// - blob: Vercel Blob — dùng ở production trên Vercel, nơi hệ thống
//   tệp chỉ đọc ngoài /tmp nên ghi đĩa sẽ lỗi. Chọn adapter theo
//   biến môi trường: có BLOB_READ_WRITE_TOKEN thì dùng Blob, không
//   thì disk (quyết định mới của Henry 26/11 ~07:29).
// URL lưu/trả về LUÔN TUYỆT ĐỐI (quyết định của Henry 26/11):
// URL đã có domain (vd URL Blob) thì giữ nguyên, KHÔNG gắn thêm;
// đường dẫn tương đối (/uploads/x.jpg từ disk) thì gắn domain shop
// (SITE_URL / siteConfig.url). Không gắn domain 2 lần.
//
// LƯU Ý Vercel: store Blob chưa có — Henry tự tạo trong Vercel
// dashboard, Vercel tự thêm BLOB_READ_WRITE_TOKEN vào env vars.
// Chưa có token thì adapter disk được chọn và upload trên Vercel sẽ
// lỗi ghi đĩa (EROFS) với thông báo rõ ràng, KHÔNG mất lặng.
// Kiểm "upload → deploy lại → ảnh vẫn còn" chỉ chạy được SAU KHI
// Henry tạo store xong — xem "Độ lệch" báo cáo Ngày 11.

import { del as blobDel, put as blobPut } from "@vercel/blob";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { siteConfig } from "@/config/site";
import {
  UPLOAD_NAME_RE,
  contentTypeForImage,
  type ImageType,
} from "./admin/upload-rules";
import { getUploadDir, readUpload, saveUpload, uploadFileName } from "./admin/uploads";

// Lỗi ghi ảnh với thông báo HẰNG cho người dùng (không lộ stack).
// `code` là mã lỗi nội bộ (để test + đọc log), KHÔNG hiện cho người
// dùng: "blob-denied" (token/quyền/store), "blob-exists" (tệp đã
// tồn tại), "blob-network" (lỗi mạng tới Blob), "blob-unknown".
export type StorageWriteErrorCode =
  | "blob-denied"
  | "blob-exists"
  | "blob-network"
  | "blob-unknown";

export class StorageWriteError extends Error {
  readonly code: StorageWriteErrorCode | undefined;
  constructor(message: string, code?: StorageWriteErrorCode) {
    super(message);
    this.name = "StorageWriteError";
    this.code = code;
  }
}

// Phân loại lỗi Blob (Ngày 13 A1.1): SDK @vercel/blob ném các lớp
// lỗi riêng (BlobAccessError, BlobPreconditionFailedError,
// BlobStoreNotFoundError, BlobStoreSuspendedError,
// BlobClientTokenExpiredError, BlobServiceNotAvailable,
// BlobServiceRateLimited...). Phân loại theo `error.name` (chuỗi)
// để vẫn đúng khi lỗi bị bọc lại, kèm dự phòng theo thông điệp.
// Thông điệp trả về là câu tiếng Việt phân biệt được; KHÔNG bao
// giờ chứa token (xem sanitizeBlobErrorMessage).
export function classifyBlobError(error: unknown): {
  code: StorageWriteErrorCode;
  message: string;
} {
  const name = error instanceof Error ? error.name : "";
  const rawMessage = error instanceof Error ? error.message : "";
  const message = `${name} ${rawMessage}`.toLowerCase();
  // 412 Precondition Failed: put() không có allowOverwrite gặp tệp
  // đã tồn tại (tên file theo content-hash nên upload lại cùng ảnh
  // sẽ trùng đường dẫn).
  if (
    name === "BlobPreconditionFailedError" ||
    /already exists|precondition failed/.test(message)
  ) {
    return { code: "blob-exists", message: "Tệp đã tồn tại" };
  }
  if (
    name === "BlobAccessError" ||
    name === "BlobClientTokenExpiredError" ||
    name === "BlobStoreNotFoundError" ||
    name === "BlobStoreSuspendedError" ||
    /access denied|unauthorized|forbidden|invalid token|token expired|store (not found|suspended)/.test(
      message,
    )
  ) {
    return {
      code: "blob-denied",
      message: "Nơi lưu ảnh từ chối ghi (kiểm token/quyền)",
    };
  }
  const nodeCode = (error as NodeJS.ErrnoException | null)?.code ?? "";
  if (
    name === "BlobServiceNotAvailable" ||
    name === "BlobServiceRateLimited" ||
    /fetch failed|network|econnreset|econnrefused|enotfound|etimedout|eai_again|socket hang up/.test(
      message,
    ) ||
    ["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN"].includes(nodeCode)
  ) {
    return { code: "blob-network", message: "Lỗi mạng tới nơi lưu ảnh" };
  }
  return { code: "blob-unknown", message: "Không lưu được ảnh, vui lòng thử lại." };
}

// Che token trong thông điệp lỗi trước khi ghi log (phòng khi SDK
// hay fetch nhét token vào message/URL).
function sanitizeBlobErrorMessage(error: unknown, token: string | undefined): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
  if (token && token !== "") return raw.split(token).join("[token đã che]");
  return raw;
}

export type StorageKind = "disk" | "blob";

export type StorageAdapter = {
  kind: StorageKind;
  /** Lưu file; disk trả đường dẫn tương đối (/uploads/...), blob trả URL tuyệt đối. */
  save: (buf: Buffer, ext: ImageType) => Promise<string>;
  /** Xóa theo URL (tuyệt đối hoặc tương đối). Trả true nếu đã xóa. */
  remove: (url: string) => Promise<boolean>;
};

// URL ảnh tuyệt đối (quy tắc đường dẫn của Henry 26/11): đã có
// scheme/host thì giữ nguyên; tương đối thì gắn domain shop vào.
// Không gắn 2 lần. Chuỗi rỗng trả về rỗng (không bịa URL).
export function toAbsoluteImageUrl(url: string): string {
  const u = (url ?? "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u) || u.startsWith("//")) return u;
  const base = siteConfig.url.replace(/\/$/, "");
  return u.startsWith("/") ? `${base}${u}` : `${base}/${u}`;
}

// Tách tên file upload khỏi URL (tuyệt đối có domain shop hoặc tương
// đối). Trả null khi không phải URL ảnh upload do máy chủ sinh —
// kể cả URL Blob (ảnh đó nằm trên Vercel Blob, không phải đĩa).
export function diskFileNameFromUrl(url: string): string | null {
  const u = (url ?? "").trim();
  if (!u) return null;
  let pathname = u;
  if (/^https?:\/\//i.test(u)) {
    let parsed: URL;
    try {
      parsed = new URL(u);
    } catch {
      return null;
    }
    // Chỉ nhận URL tuyệt đối cùng domain shop; URL Blob hay domain
    // khác không phải file đĩa.
    let shopHost = "";
    try {
      shopHost = new URL(siteConfig.url).host;
    } catch {
      return null;
    }
    if (parsed.host !== shopHost) return null;
    pathname = parsed.pathname;
  }
  const m = /^\/uploads\/([a-f0-9]{12}\.(?:jpg|png|webp|svg))$/.exec(pathname);
  return m ? m[1] : null;
}

function isBlobUrl(url: string): boolean {
  return /blob\.vercel-storage\.com/i.test(url);
}

// Adapter ĐĨA: ghi vào public/uploads (qua hàm saveUpload sẵn có
// của Ngày 7 — tên file theo hash nội dung, trùng nội dung dùng lại
// file cũ). Lỗi ghi (vd EROFS trên Vercel khi chưa có Blob token)
// thành StorageWriteError với thông báo rõ ràng.
export function createDiskAdapter(): StorageAdapter {
  return {
    kind: "disk",
    save: async (buf, ext) => {
      try {
        return await saveUpload(buf, ext);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | null)?.code;
        if (code === "EROFS" || code === "EACCES" || code === "ENOSPC") {
          throw new StorageWriteError(
            "Không ghi được ảnh trên máy chủ này (hệ thống tệp chỉ đọc). Cần cấu hình BLOB_READ_WRITE_TOKEN để dùng Vercel Blob.",
          );
        }
        throw new StorageWriteError("Không lưu được ảnh, vui lòng thử lại.");
      }
    },
    remove: async (url) => {
      const name = diskFileNameFromUrl(url);
      if (!name) return false;
      try {
        await unlink(path.join(getUploadDir(), name));
        return true;
      } catch {
        return false;
      }
    },
  };
}

export type BlobClient = {
  put: (
    pathname: string,
    body: Buffer,
    options: {
      access: "public";
      contentType: string;
      addRandomSuffix: boolean;
      allowOverwrite?: boolean;
      token?: string;
    },
  ) => Promise<{ url: string }>;
  del: (url: string, options?: { token?: string }) => Promise<void>;
};

const realBlobClient: BlobClient = { put: blobPut, del: blobDel };

// Adapter BLOB (Vercel Blob): tên file theo hash nội dung (giống
// disk), không thêm hậu tố ngẫu nhiên — trùng nội dung dùng lại URL
// cũ. token lấy từ BLOB_READ_WRITE_TOKEN (Vercel tự thêm khi Henry
// tạo store); client truyền vào để test bằng mock.
//
// Ngày 13 A1:
// - put() có `allowOverwrite: true`: cùng nội dung thì cùng đường
//   dẫn, ghi đè an toàn — upload lại cùng ảnh không còn lỗi
//   "đã tồn tại" (trước đây put() mặc định từ chối khi tệp có sẵn).
// - Lỗi put() được bọc thành StorageWriteError có mã nội bộ +
//   console.error đã che token (xem classifyBlobError) để dòng lỗi
//   thật hiện trong Vercel Runtime Logs thay vì 500 chung chung.
// - access: "public" (giá trị đang dùng — xem báo cáo Ngày 13 A1.3;
//   nếu store tạo ở chế độ Private thì ghi bị từ chối, xem log).
export function createBlobAdapter(
  client: BlobClient = realBlobClient,
  token?: string,
): StorageAdapter {
  return {
    kind: "blob",
    save: async (buf, ext) => {
      const name = uploadFileName(buf, ext);
      try {
        const result = await client.put(`uploads/${name}`, buf, {
          access: "public",
          contentType: contentTypeForImage(name),
          addRandomSuffix: false,
          allowOverwrite: true,
          ...(token ? { token } : {}),
        });
        return result.url;
      } catch (error) {
        const classified = classifyBlobError(error);
        console.error(
          `[storage] Blob put lỗi (${classified.code}): ${sanitizeBlobErrorMessage(error, token)}`,
        );
        throw new StorageWriteError(classified.message, classified.code);
      }
    },
    remove: async (url) => {
      try {
        await client.del(url, ...(token ? [{ token }] : []));
        return true;
      } catch (error) {
        const classified = classifyBlobError(error);
        console.error(
          `[storage] Blob del lỗi (${classified.code}): ${sanitizeBlobErrorMessage(error, token)}`,
        );
        return false;
      }
    },
  };
}

// Chọn adapter theo token (thuần, để test được): có token → Blob.
export function resolveStorageKind(token: string | undefined): StorageKind {
  return token !== undefined && token.trim() !== "" ? "blob" : "disk";
}

// Chọn nơi lưu ảnh theo môi trường + token (thuần, Ngày 12 A2):
// - có token → Blob (dù ở đâu).
// - không token + KHÔNG phải Vercel (local/VPS, ổ đĩa bền) → disk.
// - không token + ĐANG ở Vercel (VERCEL có giá trị, hệ thống tệp
//   chỉ đọc ngoài /tmp) → "unconfigured": KHÔNG được ghi disk,
//   phải báo lỗi rõ "Chưa cấu hình nơi lưu ảnh (Blob)".
export type StorageResolution = "blob" | "disk" | "unconfigured";

export function resolveStorageAdapterKind(opts: {
  vercel: boolean;
  token: string | undefined;
}): StorageResolution {
  if (resolveStorageKind(opts.token) === "blob") return "blob";
  return opts.vercel ? "unconfigured" : "disk";
}

export function getStorageAdapter(blobClient?: BlobClient): StorageAdapter {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const kind = resolveStorageAdapterKind({
    vercel: (process.env.VERCEL ?? "").trim() !== "",
    token,
  });
  if (kind === "unconfigured") {
    throw new StorageWriteError("Chưa cấu hình nơi lưu ảnh (Blob)");
  }
  if (kind === "blob") {
    return createBlobAdapter(blobClient, token);
  }
  return createDiskAdapter();
}

// Trạng thái nơi lưu ảnh cho trang Cài đặt Chung (A2): hiện cảnh
// báo vàng khi đang ở Vercel mà chưa có token Blob.
export function getStorageStatus(): { kind: StorageResolution; tokenPresent: boolean } {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return {
    kind: resolveStorageAdapterKind({
      vercel: (process.env.VERCEL ?? "").trim() !== "",
      token,
    }),
    tokenPresent: resolveStorageKind(token) === "blob",
  };
}

// Lưu ảnh qua adapter đang chọn, trả URL TUYỆT ĐỐI (quy tắc Henry).
export async function saveImage(
  buf: Buffer,
  ext: ImageType,
  blobClient?: BlobClient,
): Promise<string> {
  const url = await getStorageAdapter(blobClient).save(buf, ext);
  return toAbsoluteImageUrl(url);
}

// Xóa ảnh: chọn adapter theo HÌNH DẠNG url (mạnh hơn theo env) —
// URL Blob → blob; /uploads/* → disk. Không ném lỗi khi không xóa
// được (file đã mất / URL lạ): trả false.
export async function deleteImage(
  url: string,
  blobClient?: BlobClient,
): Promise<boolean> {
  if (isBlobUrl(url)) {
    return createBlobAdapter(blobClient, process.env.BLOB_READ_WRITE_TOKEN).remove(url);
  }
  return createDiskAdapter().remove(url);
}

// Đọc file upload từ đĩa (dùng cho route /uploads/[name] — chỉ disk
// mới có file local; ảnh Blob phục vụ thẳng từ CDN của Vercel).
export { readUpload };
export { UPLOAD_NAME_RE, contentTypeForImage };
export type { ImageType };
