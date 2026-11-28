// Server Actions bộ nhập sản phẩm (Ngày 20 C4/C6).
//
// MỌI action mở đầu bằng `await requireAdmin()`. Tạo lô + hoàn tác
// (hủy dữ liệu) cần thêm mã TOTP khi 2FA đang bật — cùng mẫu với
// lưu ngân hàng (bộ đếm riêng totp:import:ip, 5 lần/15 phút, bộ đếm
// lỗi → ĐÓNG). Các bước sau (ánh xạ/xác nhận/chạy) chỉ cần phiên
// admin — lô đã được tạo sau khi xác minh TOTP; chạy theo khối thì
// không thể đòi mã mới mỗi lần gọi. Nhóm import có rate-limit riêng
// (import:ip, 30 lần/10 phút, bộ đếm lỗi → ĐÓNG).

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/auth";
import { checkRateLimitFailClosed } from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/admin/ip";
import { hashIp } from "@/lib/admin/rate-limit";
import {
  isTotpLoginRequired,
  verifyTotpOrRecoveryCode,
} from "@/lib/admin/totp-store";
import {
  IMPORT_FILE_MAX_BYTES,
  approveImportedProducts,
  cancelImportBatch,
  computePreview,
  confirmImportRights,
  createImportBatch,
  getImportBatch,
  listImportBatches,
  rejectImportedProduct,
  runImportChunk,
  saveImportMapping,
  undoImportBatch,
  type ImportBatchKind,
  type ImportBatchView,
  type ImportPreview,
  type PriceOptions,
} from "@/lib/admin/import-batches";
import type { FieldMapping } from "@/lib/import/parse";

export type ImportStartState = {
  ok: boolean;
  batchId: number | null;
  error: string | null;
};

export type ImportActionState = {
  ok: boolean;
  error: string | null;
  message: string | null;
};

function formDataString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

async function importIpHash(): Promise<string> {
  return hashIp(clientIpFromHeaders(await headers()));
}

async function checkImportLimit(ipHash: string): Promise<string | null> {
  const limited = await checkRateLimitFailClosed({
    key: `import:ip:${ipHash}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!limited.allowed) {
    return limited.counterUnavailable
      ? "Hệ thống đang bận, vui lòng thử lại sau."
      : "Bạn thao tác nhập quá nhiều lần trong thời gian ngắn, vui lòng thử lại sau.";
  }
  return null;
}

/** Xác minh mã TOTP (khi 2FA bật) cho hành động nhạy cảm của bộ
 *  nhập. Trả thông báo lỗi hoặc null khi qua. */
async function checkImportTotp(
  ipHash: string,
  totpCode: string,
): Promise<string | null> {
  if (!(await isTotpLoginRequired())) return null;
  const totpLimit = await checkRateLimitFailClosed({
    key: `totp:import:ip:${ipHash}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!totpLimit.allowed) {
    return totpLimit.counterUnavailable
      ? "Hệ thống đang bận, vui lòng thử lại sau."
      : "Nhập sai mã xác thực quá nhiều lần, vui lòng thử lại sau 15 phút.";
  }
  const code = totpCode.trim();
  if (code === "" || !(await verifyTotpOrRecoveryCode(code))) {
    return "Mã xác thực không đúng, chưa thực hiện thay đổi.";
  }
  return null;
}

// --- Bước 1: nguồn ---

export async function startImportAction(
  _prevState: ImportStartState,
  formData: FormData,
): Promise<ImportStartState> {
  await requireAdmin();
  const ipHash = await importIpHash();
  const limitError = await checkImportLimit(ipHash);
  if (limitError) return { ok: false, batchId: null, error: limitError };
  const totpError = await checkImportTotp(
    ipHash,
    formDataString(formData, "totpCode"),
  );
  if (totpError) return { ok: false, batchId: null, error: totpError };

  const sourceName = formDataString(formData, "sourceName");
  const kind = formDataString(formData, "kind") as ImportBatchKind;
  if (kind !== "file" && kind !== "feed") {
    return { ok: false, batchId: null, error: "Chọn nguồn: tệp hoặc feed." };
  }
  if (kind === "file") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, batchId: null, error: "Chưa chọn tệp CSV/JSON." };
    }
    if (file.size > IMPORT_FILE_MAX_BYTES) {
      return { ok: false, batchId: null, error: "Tệp vượt quá 5 MB." };
    }
    const content = await file.text();
    const result = await createImportBatch({
      sourceName,
      kind: "file",
      fileName: file.name,
      fileContent: content,
      createdBy: "admin",
    });
    if (!result.ok) return { ok: false, batchId: null, error: result.error };
    revalidatePath("/admin/products/import");
    return { ok: true, batchId: result.batchId, error: null };
  }
  const result = await createImportBatch({
    sourceName,
    kind: "feed",
    sourceUrl: formDataString(formData, "feedUrl"),
    createdBy: "admin",
  });
  if (!result.ok) return { ok: false, batchId: null, error: result.error };
  revalidatePath("/admin/products/import");
  return { ok: true, batchId: result.batchId, error: null };
}

// --- Bước 2: ánh xạ ---

export async function saveMappingAction(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  await requireAdmin();
  const ipHash = await importIpHash();
  const limitError = await checkImportLimit(ipHash);
  if (limitError) return { ok: false, error: limitError, message: null };
  const batchId = Number(formDataString(formData, "batchId"));
  if (!Number.isSafeInteger(batchId) || batchId <= 0) {
    return { ok: false, error: "Lô nhập không hợp lệ.", message: null };
  }
  let mapping: FieldMapping;
  let categoryMapping: Record<string, number | "skip">;
  try {
    mapping = JSON.parse(formDataString(formData, "mapping")) as FieldMapping;
    categoryMapping = JSON.parse(
      formDataString(formData, "categoryMapping"),
    ) as Record<string, number | "skip">;
  } catch {
    return { ok: false, error: "Dữ liệu ánh xạ không hợp lệ.", message: null };
  }
  const defaultRaw = formDataString(formData, "defaultCategoryId");
  const defaultCategoryId =
    defaultRaw === "" ? null : Number(defaultRaw);
  if (defaultRaw !== "" && (!Number.isSafeInteger(defaultCategoryId) || (defaultCategoryId as number) <= 0)) {
    return { ok: false, error: "Danh mục mặc định không hợp lệ.", message: null };
  }
  let priceOptions: unknown = { multiplier: 1, rounding: "none" };
  try {
    const rawOptions = formDataString(formData, "priceOptions");
    if (rawOptions !== "") priceOptions = JSON.parse(rawOptions) as unknown;
  } catch {
    return { ok: false, error: "Tùy chọn giá không hợp lệ.", message: null };
  }
  const result = await saveImportMapping(
    batchId,
    mapping,
    categoryMapping,
    defaultCategoryId,
    priceOptions as PriceOptions,
  );
  if (!result.ok) return { ok: false, error: result.error, message: null };
  revalidatePath("/admin/products/import");
  return { ok: true, error: null, message: "Đã lưu ánh xạ." };
}

// --- Bước 4: xác nhận quyền ---

export async function confirmRightsAction(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  await requireAdmin();
  const ipHash = await importIpHash();
  const limitError = await checkImportLimit(ipHash);
  if (limitError) return { ok: false, error: limitError, message: null };
  const batchId = Number(formDataString(formData, "batchId"));
  if (!Number.isSafeInteger(batchId) || batchId <= 0) {
    return { ok: false, error: "Lô nhập không hợp lệ.", message: null };
  }
  const result = await confirmImportRights(
    batchId,
    formData.get("rightsConfirmed") === "on",
    formDataString(formData, "retypeSourceName"),
  );
  if (!result.ok) return { ok: false, error: result.error, message: null };
  revalidatePath("/admin/products/import");
  return { ok: true, error: null, message: "Đã xác nhận quyền sử dụng." };
}

// --- Bước 5: chạy / hủy (gọi lặp từ client, mỗi lần ~10 dòng) ---

export async function runImportChunkAction(
  batchId: number,
): Promise<
  | { ok: true; processed: number; total: number; created: number; updated: number; skipped: number; errors: number; done: boolean }
  | { ok: false; error: string }
> {
  await requireAdmin();
  const ipHash = await importIpHash();
  const limitError = await checkImportLimit(ipHash);
  if (limitError) return { ok: false, error: limitError };
  return runImportChunk(batchId);
}

export async function cancelImportAction(
  batchId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const ipHash = await importIpHash();
  const limitError = await checkImportLimit(ipHash);
  if (limitError) return { ok: false, error: limitError };
  const result = await cancelImportBatch(batchId);
  if (result.ok) revalidatePath("/admin/products/import");
  return result;
}

// --- Bước 6: hoàn tác lô (hủy dữ liệu → cần mã TOTP khi 2FA bật) ---

export async function undoImportBatchAction(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  await requireAdmin();
  const ipHash = await importIpHash();
  const limitError = await checkImportLimit(ipHash);
  if (limitError) return { ok: false, error: limitError, message: null };
  const totpError = await checkImportTotp(
    ipHash,
    formDataString(formData, "totpCode"),
  );
  if (totpError) return { ok: false, error: totpError, message: null };
  const batchId = Number(formDataString(formData, "batchId"));
  if (!Number.isSafeInteger(batchId) || batchId <= 0) {
    return { ok: false, error: "Lô nhập không hợp lệ.", message: null };
  }
  const result = await undoImportBatch(batchId);
  if (!result.ok) return { ok: false, error: result.error, message: null };
  revalidatePath("/admin/products/import");
  revalidatePath("/admin/products");
  return {
    ok: true,
    error: null,
    message: `Đã hoàn tác: xóa ${result.deleted} sản phẩm, giữ lại ${result.kept.length} sản phẩm.`,
  };
}

// --- C6: duyệt / từ chối (dùng ở danh sách sản phẩm + trang lô) ---

export async function approveImportedAction(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  await requireAdmin();
  const ipHash = await importIpHash();
  const limitError = await checkImportLimit(ipHash);
  if (limitError) return { ok: false, error: limitError, message: null };
  const ids = formData
    .getAll("ids")
    .map((v) => Number(v))
    .filter((n) => Number.isSafeInteger(n) && n > 0);
  if (ids.length === 0) {
    return { ok: false, error: "Chưa chọn sản phẩm nào.", message: null };
  }
  const alsoShow = formData.get("alsoShow") === "on";
  const result = await approveImportedProducts(ids, alsoShow);
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/import");
  if (result.approved === 0) {
    return { ok: false, error: "Không duyệt được sản phẩm nào.", message: null };
  }
  return {
    ok: true,
    error: null,
    message: `Đã duyệt ${result.approved} sản phẩm${result.missing.length > 0 ? ` (${result.missing.length} không tìm thấy)` : ""}.`,
  };
}

export async function rejectImportedAction(
  _prevState: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  await requireAdmin();
  const ipHash = await importIpHash();
  const limitError = await checkImportLimit(ipHash);
  if (limitError) return { ok: false, error: limitError, message: null };
  const id = Number(formDataString(formData, "id"));
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { ok: false, error: "Sản phẩm không hợp lệ.", message: null };
  }
  const result = await rejectImportedProduct(id);
  if (!result.ok) return { ok: false, error: result.error, message: null };
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/import");
  return { ok: true, error: null, message: "Đã từ chối (xóa) sản phẩm." };
}

// --- Đọc cho trang (server component) ---

export async function getImportBatchForPage(
  batchId: number,
): Promise<ImportBatchView | null> {
  await requireAdmin();
  return getImportBatch(batchId);
}

export async function getImportPreviewForPage(
  batchId: number,
): Promise<ImportPreview | null> {
  await requireAdmin();
  return computePreview(batchId);
}

export async function listImportBatchesForPage(
  limit = 10,
): Promise<ImportBatchView[]> {
  await requireAdmin();
  return listImportBatches(limit);
}
