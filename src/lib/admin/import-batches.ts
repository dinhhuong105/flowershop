// Lô nhập sản phẩm (Ngày 20 C1/C4/C5/C6, căn chỉnh B1 bản sau
// Retry) — logic phía máy chủ. Chỉ admin gọi qua Server Action
// (mỗi action mở đầu requireAdmin). Hàng nhập luôn source=import,
// needsReview=true, ẨN khỏi shop / sitemap / tìm kiếm (bộ lọc
// needsReview=false ở catalog, product, queries, search, sitemap,
// quick-view).
//
// Mô hình B1: trạng thái từng hàng nằm ở bảng import_rows (không
// còn trong payload JSON); mappingJson giữ ánh xạ + tùy chọn giá;
// payload chỉ còn dữ liệu chạy tạm (lỗi đọc ban đầu, thời điểm bắt
// đầu, hạn giữ lô). Chunk runner giữ lô bằng hạn giữ (lease) trong
// payload + ghi trạng thái cuối của từng hàng có điều kiện
// WHERE status='PENDING' (chống hai lần chạy trùng xử lý trùng hàng).

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  MAX_IMPORT_ROWS,
  detectFieldMapping,
  mergeSavedMapping,
  normalizeMappedRecord,
  parseCsv,
  parseJson,
  type FieldMapping,
  type NormalizedRow,
  type ParseError,
} from "@/lib/import/parse";
import { SafeFetchError, safeFetch, HTML_NOT_DATA_MESSAGE } from "@/lib/safe-fetch";
import { checkRateLimitFailClosed } from "@/lib/rate-limit";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { deleteImage, saveImage, type ImageType } from "@/lib/storage";
import { PRODUCT_SKU_RE, slugifyName } from "./product-validation";
import {
  lifecycleAuditRow,
  writeCatalogAudits,
} from "./catalog-audit";
import { productAuditPrefix } from "./products";
import { BULK_PRODUCTS_MAX } from "./bulk-products";

// CHỈ CHO TEST LOCAL (C8): cho phép safe-fetch tới loopback khi chạy
// probe với máy chủ giả trên chính máy này (VM không nối hairpin về
// IP ngoài của mình nên máy chủ giả chỉ tới được qua 127.0.0.1).
// Bật bằng SAFE_FETCH_ALLOW_LOOPBACK=1 khi khởi động server local.
// KHÔNG BAO GIỜ đặt biến này trên Vercel — ở đó VERCEL=1 nên cờ này
// luôn bị ép tắt, SSRF vẫn chặn loopback. Mặc định: tắt.
const allowLoopbackForTest =
  process.env.SAFE_FETCH_ALLOW_LOOPBACK === "1" && process.env.VERCEL !== "1";

/** Mỗi lần gọi chạy tối đa 10 hàng hoặc ~8 giây (B5, bản sau Retry):
 *  Vercel Hobby giới hạn Server Action ~15 s; dừng sớm khi quá 8 s
 *  để không bị cắt giữa chừng; lần gọi sau chạy tiếp từ import_rows. */
export const IMPORT_CHUNK_ROWS = 10;
export const IMPORT_MAX_BATCHES_PER_DAY = 20;
/** Bắt đầu lô tối đa 5 lần/giờ (B9, bản sau Retry). */
export const IMPORT_MAX_BATCHES_PER_HOUR = 5;
/** Tải feed URL tối đa 10 lần/giờ (B9, bản sau Retry). */
export const IMPORT_MAX_FEED_FETCHES_PER_HOUR = 10;
export const IMPORT_RUN_TIMEOUT_MS = 20 * 60 * 1000;
// Mỗi lần gọi chạy tối đa ~8 s (Vercel Hobby giới hạn Server
// Action ~15 s): đủ 10 dòng nhẹ, dừng sớm khi quá 8 s để không
// bị cắt giữa chừng; lần gọi sau chạy tiếp từ import_rows.
export const IMPORT_CHUNK_MAX_MS = 8_000;
// Hạn giữ lô của một lần gọi chạy (30 s > tối đa 10 s của khối):
// lần gọi khác chỉ được giữ lô khi hạn này đã hết (lần gọi trước
// chết giữa chừng thì sau 30 s chạy tiếp được).
export const IMPORT_RUN_LEASE_MS = 30_000;
export const IMPORT_SOURCE_NAME_MIN = 3;
export const IMPORT_SOURCE_NAME_MAX = 80;
export const IMPORT_FILE_MAX_BYTES = 5 * 1024 * 1024;
/** Dữ liệu tạm từng hàng (import_rows.payload) tối đa 8 KB (B2). */
export const IMPORT_ROW_PAYLOAD_MAX_BYTES = 8 * 1024;

export type ImportBatchKind = "file" | "feed";
export type ImportSourceKind = "CSV" | "JSON" | "FEED_URL";
export type ImportBatchStatus =
  | "PREVIEW"
  | "RUNNING"
  | "DONE"
  | "FAILED"
  | "ROLLED_BACK";
export type ImportRowStatus =
  | "PENDING"
  | "CREATED"
  | "UPDATED"
  | "SKIPPED"
  | "ERROR";

/** Tùy chọn giá (B3): hệ số nhân + làm tròn. Mặc định hệ số 1,
 *  không làm tròn (giữ nguyên giá nguồn). */
export type PriceOptions = {
  multiplier: number;
  rounding: "none" | "1000" | "10000";
};

export const DEFAULT_PRICE_OPTIONS: PriceOptions = {
  multiplier: 1,
  rounding: "none",
};

/** Kiểm tra tùy chọn giá (B3): hệ số 0,1–10, tối đa 2 chữ số
 *  thập phân; làm tròn none/1000/10000. Trả thông báo lỗi hoặc null. */
export function validatePriceOptions(opts: unknown): string | null {
  if (opts === null || typeof opts !== "object" || Array.isArray(opts)) {
    return "Tùy chọn giá không hợp lệ.";
  }
  const o = opts as Record<string, unknown>;
  const m = o.multiplier;
  if (typeof m !== "number" || !Number.isFinite(m) || m < 0.1 || m > 10) {
    return "Hệ số nhân phải từ 0,1 đến 10.";
  }
  if (Math.abs(m * 100 - Math.round(m * 100)) > 1e-9) {
    return "Hệ số nhân tối đa 2 chữ số thập phân.";
  }
  if (o.rounding !== "none" && o.rounding !== "1000" && o.rounding !== "10000") {
    return "Làm tròn phải là không, 1.000 hoặc 10.000.";
  }
  return null;
}

/** Áp hệ số + làm tròn lên giá/salePrice của một dòng (B3): nhân
 *  hệ số, làm tròn về số nguyên VND trước, rồi làm tròn theo mức
 *  (1000/10000: về bội số gần nhất). Trả giá đã chuyển đổi. */
export function applyPriceOptions(
  row: NormalizedRow,
  opts: PriceOptions,
): { price: number; salePrice: number | null } {
  const convert = (value: number): number => {
    let v = Math.round(value * opts.multiplier);
    if (opts.rounding === "1000") v = Math.round(v / 1000) * 1000;
    else if (opts.rounding === "10000") v = Math.round(v / 10000) * 10000;
    return v;
  };
  return {
    price: convert(row.price),
    salePrice: row.salePrice === null ? null : convert(row.salePrice),
  };
}

/** Một hàng đã lưu trong import_rows, kèm số dòng gốc + trạng thái
 *  (view cho wizard/xem trước). */
export type StoredImportRow = NormalizedRow & {
  rowId: number;
  line: number;
  status: ImportRowStatus;
  message: string | null;
  productId: number | null;
  imageWarnings?: string[];
};

/** Dữ liệu chạy tạm trên lô (payload JSON, gọn): chỉ lỗi đọc ban
 *  đầu + thời điểm bắt đầu + hạn giữ lô. Trạng thái từng hàng ở
 *  import_rows; ánh xạ ở mappingJson. */
export type ImportRunPayload = {
  parseErrors: ParseError[];
  runStartedAt: string | null;
  runLeaseUntil: string | null;
};

/** Ánh xạ + tùy chọn của lô (mappingJson). */
export type ImportMappingJson = {
  mapping: FieldMapping;
  mappingSaved: boolean;
  categoryMapping: Record<string, number | "skip">;
  defaultCategoryId: number | null;
  priceOptions: PriceOptions;
};

/** Payload view cho wizard (lắp từ mappingJson + import_rows +
 *  payload gọn) — giữ nguyên hình dạng Ngày 20 để wizard không
 *  phải đổi, chỉ thêm priceOptions + runLeaseUntil. */
export type ImportPayload = {
  rows: StoredImportRow[];
  errors: ParseError[];
  mapping: FieldMapping;
  mappingSaved: boolean;
  categoryMapping: Record<string, number | "skip">;
  defaultCategoryId: number | null;
  priceOptions: PriceOptions;
  processed: number;
  runErrors: Array<{ line: number; reason: string; kind: "row" | "image" }>;
  runStartedAt: string | null;
  runLeaseUntil: string | null;
};

export type ImportBatchView = {
  id: number;
  sourceName: string;
  kind: ImportBatchKind;
  sourceKind: ImportSourceKind;
  fileName: string | null;
  fileSha256: string | null;
  sourceUrl: string | null;
  rightsConfirmed: boolean;
  rightsConfirmedAt: Date | null;
  rightsConfirmedBy: string | null;
  status: ImportBatchStatus;
  rowsTotal: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  createdBy: string;
  createdAt: Date;
  finishedAt: Date | null;
  notes: string | null;
  payload: ImportPayload;
};

function emptyMappingJson(): ImportMappingJson {
  return {
    mapping: {},
    mappingSaved: false,
    categoryMapping: {},
    defaultCategoryId: null,
    priceOptions: { ...DEFAULT_PRICE_OPTIONS },
  };
}

function emptyRunPayload(): ImportRunPayload {
  return { parseErrors: [], runStartedAt: null, runLeaseUntil: null };
}

function parseMappingJson(value: unknown): ImportMappingJson {
  const base = emptyMappingJson();
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return base;
  }
  const v = value as Record<string, unknown>;
  const priceOptions =
    v.priceOptions !== null &&
    typeof v.priceOptions === "object" &&
    !Array.isArray(v.priceOptions)
      ? (v.priceOptions as Record<string, unknown>)
      : {};
  return {
    mapping:
      v.mapping !== null && typeof v.mapping === "object" && !Array.isArray(v.mapping)
        ? (v.mapping as FieldMapping)
        : {},
    mappingSaved: v.mappingSaved === true,
    categoryMapping:
      v.categoryMapping !== null &&
      typeof v.categoryMapping === "object" &&
      !Array.isArray(v.categoryMapping)
        ? (v.categoryMapping as Record<string, number | "skip">)
        : {},
    defaultCategoryId:
      typeof v.defaultCategoryId === "number" ? v.defaultCategoryId : null,
    priceOptions: {
      multiplier:
        typeof priceOptions.multiplier === "number" &&
        Number.isFinite(priceOptions.multiplier)
          ? priceOptions.multiplier
          : 1,
      rounding:
        priceOptions.rounding === "1000" ||
        priceOptions.rounding === "10000"
          ? priceOptions.rounding
          : "none",
    },
  };
}

function parseRunPayload(value: unknown): ImportRunPayload {
  const base = emptyRunPayload();
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return base;
  }
  const v = value as Record<string, unknown>;
  // Tương thích lô cũ (migration đã đổi errors → parseErrors).
  const parseErrors = Array.isArray(v.parseErrors)
    ? (v.parseErrors as ParseError[])
    : Array.isArray(v.errors)
      ? (v.errors as ParseError[])
      : [];
  return {
    parseErrors,
    runStartedAt:
      typeof v.runStartedAt === "string" ? v.runStartedAt : null,
    runLeaseUntil:
      typeof v.runLeaseUntil === "string" ? v.runLeaseUntil : null,
  };
}

type BatchRowWithRows = {
  id: number;
  sourceName: string;
  kind: string;
  sourceKind: string;
  fileName: string | null;
  fileSha256: string | null;
  sourceUrl: string | null;
  rightsConfirmed: boolean;
  rightsConfirmedAt: Date | null;
  rightsConfirmedBy: string | null;
  status: string;
  rowsTotal: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  createdBy: string;
  createdAt: Date;
  finishedAt: Date | null;
  notes: string | null;
  mappingJson: unknown;
  payload: unknown;
  rows: Array<{
    id: number;
    rowIndex: number;
    externalId: string;
    status: string;
    message: string | null;
    productId: number | null;
    payload: unknown;
  }>;
};

function toBatchView(row: BatchRowWithRows): ImportBatchView {
  const mapping = parseMappingJson(row.mappingJson);
  const run = parseRunPayload(row.payload);
  const rows: StoredImportRow[] = row.rows.map((r) => {
    const stored =
      r.payload !== null && typeof r.payload === "object" && !Array.isArray(r.payload)
        ? (r.payload as Record<string, unknown>)
        : {};
    const { line, imageWarnings, ...rest } = stored as Record<string, unknown> & {
      line?: unknown;
      imageWarnings?: unknown;
    };
    return {
      ...(rest as unknown as NormalizedRow),
      rowId: r.id,
      line: typeof line === "number" ? line : r.rowIndex + 2,
      status: r.status as ImportRowStatus,
      message: r.message,
      productId: r.productId,
      imageWarnings: Array.isArray(imageWarnings)
        ? (imageWarnings as string[])
        : undefined,
    };
  });
  const processed = rows.filter((r) => r.status !== "PENDING").length;
  const runErrors: ImportPayload["runErrors"] = [];
  for (const r of rows) {
    if (r.status === "ERROR" || r.status === "SKIPPED") {
      runErrors.push({
        line: r.line,
        reason: r.message ?? "",
        kind: "row",
      });
    } else if (
      (r.status === "CREATED" || r.status === "UPDATED") &&
      r.imageWarnings !== undefined
    ) {
      for (const w of r.imageWarnings) {
        runErrors.push({ line: r.line, reason: w, kind: "image" });
      }
    }
  }
  return {
    id: row.id,
    sourceName: row.sourceName,
    kind: row.kind as ImportBatchKind,
    sourceKind: row.sourceKind as ImportSourceKind,
    fileName: row.fileName,
    fileSha256: row.fileSha256,
    sourceUrl: row.sourceUrl,
    rightsConfirmed: row.rightsConfirmed,
    rightsConfirmedAt: row.rightsConfirmedAt,
    rightsConfirmedBy: row.rightsConfirmedBy,
    status: row.status as ImportBatchStatus,
    rowsTotal: row.rowsTotal,
    created: row.created,
    updated: row.updated,
    skipped: row.skipped,
    failed: row.failed,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
    notes: row.notes,
    payload: {
      rows,
      errors: run.parseErrors,
      mapping: mapping.mapping,
      mappingSaved: mapping.mappingSaved,
      categoryMapping: mapping.categoryMapping,
      defaultCategoryId: mapping.defaultCategoryId,
      priceOptions: mapping.priceOptions,
      processed,
      runErrors: runErrors.slice(-200),
      runStartedAt: run.runStartedAt,
      runLeaseUntil: run.runLeaseUntil,
    },
  };
}

const BATCH_WITH_ROWS = {
  include: { rows: { orderBy: { rowIndex: "asc" as const } } },
} as const;

export async function getImportBatch(id: number): Promise<ImportBatchView | null> {
  const row = await db.importBatch.findUnique({
    where: { id },
    ...BATCH_WITH_ROWS,
  });
  return row ? toBatchView(row as unknown as BatchRowWithRows) : null;
}

export async function listImportBatches(limit = 10): Promise<ImportBatchView[]> {
  const rows = await db.importBatch.findMany({
    orderBy: { id: "desc" },
    take: limit,
    ...BATCH_WITH_ROWS,
  });
  return rows.map((r) => toBatchView(r as unknown as BatchRowWithRows));
}

// Đầu ngày theo giờ VN (UTC+7 cố định, không DST) — giới hạn 20 lô/ngày (B9).
function vnDayStart(now: Date): Date {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  vn.setUTCHours(0, 0, 0, 0);
  return new Date(vn.getTime() - 7 * 60 * 60 * 1000);
}

export async function countBatchesToday(now = new Date()): Promise<number> {
  return db.importBatch.count({
    where: { createdAt: { gte: vnDayStart(now) } },
  });
}

export async function getRunningBatch(): Promise<{ id: number; sourceName: string } | null> {
  return db.importBatch.findFirst({
    where: { status: "RUNNING" },
    select: { id: true, sourceName: true },
  });
}

function validateSourceName(sourceName: string): string | null {
  const name = sourceName.trim();
  if (name.length < IMPORT_SOURCE_NAME_MIN || name.length > IMPORT_SOURCE_NAME_MAX) {
    return `Tên nguồn phải từ ${IMPORT_SOURCE_NAME_MIN} đến ${IMPORT_SOURCE_NAME_MAX} ký tự.`;
  }
  return null;
}

/** Nhận dạng định dạng BẰNG NỘI DUNG (B2, bản sau Retry): không
 *  tin đuôi tệp hay Content-Type — nội dung bắt đầu bằng `{`/`[`
 *  là JSON, còn lại là CSV. */
export function detectFormat(content: string): "csv" | "json" {
  const trimmed = content.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[") ? "json" : "csv";
}

/** Nội dung có phải trang web HTML không (bỏ BOM UTF-8 + khoảng
 *  trắng đầu, rồi bắt đầu bằng `<`)? Trang web không phải dữ liệu
 *  nhập (B2). */
export function isHtmlContent(content: string): boolean {
  let text = content;
  if (text.startsWith("﻿")) text = text.slice(1);
  const trimmed = text.trimStart();
  return trimmed.startsWith("<");
}

/** Gán số dòng gốc cho từng dòng hợp lệ: đi lần lượt các dòng dữ
 *  liệu (CSV bắt đầu từ dòng 2 vì dòng 1 là header; JSON từ 1),
 *  bỏ qua các dòng đã lỗi (có trong errors). */
function assignRowLines(
  parsed: { rows: NormalizedRow[]; errors: ParseError[]; totalLines: number },
  format: "csv" | "json",
): number[] {
  const errorLines = new Set(
    parsed.errors.map((e) => e.line).filter((l) => l > 0),
  );
  const lines: number[] = [];
  const first = format === "csv" ? 2 : 1;
  for (let line = first; line <= parsed.totalLines; line++) {
    if (errorLines.has(line)) continue;
    lines.push(line);
    if (lines.length === parsed.rows.length) break;
  }
  // Phòng thủ: nếu lệch (không nên xảy ra) thì điền tiếp số dòng.
  while (lines.length < parsed.rows.length) {
    lines.push((lines[lines.length - 1] ?? first) + 1);
  }
  return lines;
}

/** Cắt payload từng hàng về ≤ 8 KB (B1): bỏ các cột thô chưa ánh
 *  xạ (không dùng khi chuẩn hóa lại); vẫn quá thì bỏ hẳn `raw`
 *  (hàng vẫn chạy được với ánh xạ hiện tại, chỉ không ánh xạ lại
 *  được sang cột khác). */
export function trimRowPayload(
  stored: Record<string, unknown>,
  mapping: FieldMapping,
): Record<string, unknown> {
  if (Buffer.byteLength(JSON.stringify(stored), "utf8") <= IMPORT_ROW_PAYLOAD_MAX_BYTES) {
    return stored;
  }
  const raw = stored.raw;
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const mappedCols = new Set(
      Object.values(mapping).filter(
        (c): c is string => typeof c === "string" && c !== "",
      ),
    );
    const kept: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (mappedCols.has(k)) kept[k] = v;
    }
    const slimmed = { ...stored, raw: kept };
    if (Buffer.byteLength(JSON.stringify(slimmed), "utf8") <= IMPORT_ROW_PAYLOAD_MAX_BYTES) {
      return slimmed;
    }
  }
  const rest = { ...stored };
  delete rest.raw;
  return rest;
}

/** Ánh xạ đã nhớ theo tên nguồn (B3): lần nhập sau cùng nguồn thì
 *  gợi ý sẵn ánh xạ lần trước. */
export async function getSavedMapping(
  sourceName: string,
): Promise<ImportMappingJson | null> {
  const row = await db.importMapping.findUnique({
    where: { sourceName },
    select: { mappingJson: true },
  });
  if (!row) return null;
  return parseMappingJson(row.mappingJson);
}

async function saveMappingMemory(
  tx: Prisma.TransactionClient,
  sourceName: string,
  mapping: ImportMappingJson,
): Promise<void> {
  await tx.importMapping.upsert({
    where: { sourceName },
    create: { sourceName, mappingJson: mapping as unknown as object },
    update: { mappingJson: mapping as unknown as object },
  });
}

export type CreateImportBatchResult =
  | { ok: true; batchId: number }
  | { ok: false; error: string };

export async function createImportBatch(input: {
  sourceName: string;
  kind: ImportBatchKind;
  fileName?: string | null;
  fileContent?: string | null;
  sourceUrl?: string | null;
  createdBy: string;
}): Promise<CreateImportBatchResult> {
  const nameError = validateSourceName(input.sourceName);
  if (nameError) return { ok: false, error: nameError };
  const sourceName = input.sourceName.trim();

  const running = await getRunningBatch();
  if (running) {
    return {
      ok: false,
      error: `Đang có lô "${running.sourceName}" chạy — chờ lô đó xong hoặc hủy rồi mới tạo lô mới.`,
    };
  }
  // B9: bắt đầu lô tối đa 5 lần/giờ và 20 lần/ngày (toàn cục).
  // Bộ đếm lỗi → ĐÓNG (fail-closed), không tạo lô.
  let hourCount: number;
  let dayCount: number;
  try {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    [hourCount, dayCount] = await Promise.all([
      db.importBatch.count({ where: { createdAt: { gte: hourAgo } } }),
      countBatchesToday(),
    ]);
  } catch {
    return {
      ok: false,
      error: "Không kiểm được giới hạn tạo lô — thử lại sau.",
    };
  }
  if (hourCount >= IMPORT_MAX_BATCHES_PER_HOUR) {
    return {
      ok: false,
      error: `Đã đủ ${IMPORT_MAX_BATCHES_PER_HOUR} lô trong 1 giờ — thử lại sau.`,
    };
  }
  if (dayCount >= IMPORT_MAX_BATCHES_PER_DAY) {
    return {
      ok: false,
      error: `Đã đủ ${IMPORT_MAX_BATCHES_PER_DAY} lô trong ngày — tạo tiếp vào ngày mai.`,
    };
  }

  let content: string;
  let fileName: string | null = null;
  let sourceUrl: string | null = null;
  if (input.kind === "file") {
    if (!input.fileContent || input.fileContent.length === 0) {
      return { ok: false, error: "Chưa chọn tệp." };
    }
    if (Buffer.byteLength(input.fileContent, "utf8") > IMPORT_FILE_MAX_BYTES) {
      return { ok: false, error: "Tệp vượt quá 5 MB." };
    }
    content = input.fileContent;
    fileName = (input.fileName ?? "tep-nhap").slice(0, 200);
  } else {
    const url = (input.sourceUrl ?? "").trim();
    if (url === "") return { ok: false, error: "Chưa nhập địa chỉ feed." };
    sourceUrl = url;
    // B9: tải feed URL tối đa 10 lần/giờ (toàn cục); bộ đếm lỗi
    // → ĐÓNG (checkRateLimitFailClosed trả allowed=false).
    const fetchLimit = await checkRateLimitFailClosed({
      key: "import:feed-fetch:global",
      limit: IMPORT_MAX_FEED_FETCHES_PER_HOUR,
      windowMs: 60 * 60 * 1000,
    });
    if (!fetchLimit.allowed) {
      return {
        ok: false,
        error: fetchLimit.counterUnavailable
          ? "Không kiểm được giới hạn tải feed — thử lại sau."
          : `Đã đủ ${IMPORT_MAX_FEED_FETCHES_PER_HOUR} lần tải feed trong 1 giờ — thử lại sau.`,
      };
    }
    let fetched;
    try {
      fetched = await safeFetch(url, { kind: "feed", allowLoopbackForTest });
    } catch (err) {
      if (err instanceof SafeFetchError) {
        // Trang web trả về thay vì dữ liệu: trả đúng thông báo
        // của đặc tả, không bọc thêm chữ.
        if (err.message === HTML_NOT_DATA_MESSAGE) {
          return { ok: false, error: HTML_NOT_DATA_MESSAGE };
        }
        return { ok: false, error: `Không tải được feed: ${err.message}` };
      }
      return { ok: false, error: "Không tải được feed (lỗi mạng)." };
    }
    content = fetched.body.toString("utf8");
    fileName = null;
  }

  // Nội dung HTML (trang web) không phải dữ liệu nhập — từ chối
  // với đúng thông báo của đặc tả (phòng thủ thêm sau safeFetch).
  if (isHtmlContent(content)) {
    return { ok: false, error: HTML_NOT_DATA_MESSAGE };
  }

  const format = detectFormat(content);
  const sourceKind: ImportSourceKind =
    input.kind === "feed" ? "FEED_URL" : format === "json" ? "JSON" : "CSV";
  const fileSha256 = createHash("sha256").update(content, "utf8").digest("hex");
  const parsed = format === "csv" ? parseCsv(content) : parseJson(content);
  if (parsed.rows.length === 0 && parsed.errors.length > 0) {
    return {
      ok: false,
      error: `Không đọc được dữ liệu: ${parsed.errors[0].reason}`,
    };
  }
  // B9: lô quá 2.000 hàng bị từ chối. Bộ đọc đã cắt ở 2.000 dòng
  // (lỗi toàn cục → nhánh trên) nên nhánh này chỉ phòng thủ khi
  // bộ đọc trả nhiều dòng hơn giới hạn.
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: `Vượt quá ${MAX_IMPORT_ROWS} dòng mỗi lô.` };
  }

  // Ánh xạ mặc định: nhớ theo tên nguồn (B3) nếu có, còn không thì
  // tự khớp theo alias (bước 2 cho chỉnh lại). Ánh xạ nhớ được
  // HỢP NHẤT với tự nhận diện theo cột của tệp MỚI: cột đã nhớ
  // chỉ giữ khi còn tồn tại trong tệp mới; trường nào nhớ là null
  // (tệp cũ không có cột đó) thì tự nhận diện lại — nếu không, tệp
  // mới có thêm cột salePrice/description sẽ bị bỏ qua âm thầm.
  const sampleKeys =
    parsed.rows.length > 0 ? Object.keys(parsed.rows[0].raw) : [];
  const saved = await getSavedMapping(sourceName);
  const mappingJson: ImportMappingJson = saved
    ? { ...saved, mapping: mergeSavedMapping(saved.mapping, sampleKeys) }
    : {
        ...emptyMappingJson(),
        mapping: mergeSavedMapping(null, sampleKeys),
      };
  const lines = assignRowLines(parsed, format);
  const rowPayloads = parsed.rows.map((row, i) =>
    trimRowPayload({ ...row, line: lines[i] }, mappingJson.mapping),
  );

  const created = await db.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        sourceName,
        kind: input.kind,
        sourceKind,
        fileName,
        fileSha256,
        sourceUrl,
        createdBy: input.createdBy,
        status: "PREVIEW",
        rowsTotal: parsed.rows.length,
        mappingJson: mappingJson as unknown as object,
        payload: {
          parseErrors: parsed.errors,
          runStartedAt: null,
          runLeaseUntil: null,
        } as unknown as object,
      },
      select: { id: true },
    });
    if (rowPayloads.length > 0) {
      await tx.importRow.createMany({
        data: rowPayloads.map((payload, i) => ({
          batchId: batch.id,
          rowIndex: i,
          externalId: parsed.rows[i].externalId,
          status: "PENDING" as const,
          payload: payload as unknown as object,
        })),
      });
    }
    await writeCatalogAudits(tx, [
      {
        key: `import:${batch.id}`,
        oldValue: null,
        newValue: `Đã tạo lô "${sourceName}" (${parsed.rows.length} dòng)`,
      },
    ]);
    return batch;
  });
  return { ok: true, batchId: created.id };
}

// --- Bước 2: ánh xạ ---

export type SaveMappingResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveImportMapping(
  batchId: number,
  mapping: FieldMapping,
  categoryMapping: Record<string, number | "skip">,
  defaultCategoryId: number | null,
  priceOptions: PriceOptions,
): Promise<SaveMappingResult> {
  const batch = await getImportBatch(batchId);
  if (!batch) return { ok: false, error: "Không tìm thấy lô nhập." };
  if (batch.status !== "PREVIEW") {
    return { ok: false, error: "Lô này đã qua bước ánh xạ, không sửa được nữa." };
  }
  if (!mapping.name) return { ok: false, error: "Chưa chọn cột cho tên sản phẩm." };
  if (!mapping.price) return { ok: false, error: "Chưa chọn cột cho giá." };
  // B3: externalId là trường BẮT BUỘC Ở MỨC HÀNG — mọi hàng phải có
  // mã ngoài để lần nhập sau cập nhật đúng sản phẩm. Cột ánh xạ
  // được chấp nhận là externalId HOẶC sku (parser lấy externalId
  // từ cột SKU khi không có cột mã ngoài riêng — file nguồn thường
  // chỉ có SKU làm mã duy nhất). Đây là diễn giải thực tế của "bắt
  // buộc": hàng nào cũng phải có externalId, không phải cột ánh xạ
  // phải đúng tên externalId.
  if (!mapping.externalId && !mapping.sku) {
    return {
      ok: false,
      error: "Chưa chọn cột cho mã ngoài (externalId) hoặc SKU.",
    };
  }
  const priceError = validatePriceOptions(priceOptions);
  if (priceError) return { ok: false, error: priceError };
  if (!mapping.categoryName && defaultCategoryId === null) {
    return {
      ok: false,
      error: "Nguồn không có cột danh mục — bắt buộc chọn danh mục mặc định.",
    };
  }
  if (defaultCategoryId !== null) {
    const cat = await db.category.findUnique({
      where: { id: defaultCategoryId },
      select: { id: true },
    });
    if (!cat) return { ok: false, error: "Danh mục mặc định không tồn tại." };
  }
  // Mọi giá trị danh mục nguồn khác nhau đều phải có lựa chọn
  // (danh mục có sẵn hoặc "Bỏ qua các dòng này").
  const distinctValues = distinctCategoryValues(batch.payload);
  for (const value of distinctValues) {
    if (!(value in categoryMapping)) {
      return {
        ok: false,
        error: `Chưa ánh xạ giá trị danh mục "${value}".`,
      };
    }
    const target = categoryMapping[value];
    if (target !== "skip") {
      const cat = await db.category.findUnique({
        where: { id: target },
        select: { id: true },
      });
      if (!cat) {
        return { ok: false, error: `Danh mục ánh xạ cho "${value}" không tồn tại.` };
      }
    }
  }
  const mappingJson: ImportMappingJson = {
    mapping,
    mappingSaved: true,
    categoryMapping,
    defaultCategoryId,
    priceOptions,
  };
  await db.$transaction(async (tx) => {
    await tx.importBatch.update({
      where: { id: batchId },
      data: { mappingJson: mappingJson as unknown as object },
    });
    await saveMappingMemory(tx, batch.sourceName, mappingJson);
  });
  return { ok: true };
}

/** Các giá trị danh mục nguồn khác nhau (sau ánh xạ field) — để
 *  bước 2 lập bảng ánh xạ giá trị. */
export function distinctCategoryValues(payload: ImportPayload): string[] {
  const values = new Set<string>();
  for (const row of payload.rows) {
    const re = normalizeMappedRecord(row.raw, payload.mapping);
    if (!("row" in re)) continue;
    const cat = re.row.categoryName;
    if (cat !== null && cat !== "") values.add(cat);
  }
  return [...values].sort();
}

/** Chuẩn hóa lại các dòng CHỜ (PENDING) theo ánh xạ đã chọn
 *  (bước 2 / xem trước / chạy), ÁP TÙY CHỌN GIÁ (B3) rồi kiểm cuối:
 *  giá phải là số nguyên VND 1–1.000.000.000, salePrice < price
 *  nghiêm ngặt. Trả về dòng hợp lệ + lỗi từng dòng (kèm số dòng gốc
 *  + id hàng). Hàng đã có trạng thái cuối không chuẩn hóa lại. */
export function renormalizeRows(batch: ImportBatchView): {
  valid: Array<{ row: NormalizedRow; rowId: number; line: number }>;
  errors: Array<ParseError & { rowId: number }>;
} {
  const valid: Array<{ row: NormalizedRow; rowId: number; line: number }> = [];
  const errors: Array<ParseError & { rowId: number }> = [];
  const priceOptions = batch.payload.priceOptions;
  for (const stored of batch.payload.rows) {
    if (stored.status !== "PENDING") continue;
    const re = normalizeMappedRecord(stored.raw, batch.payload.mapping);
    if ("errors" in re) {
      errors.push({
        line: stored.line,
        reason: re.errors.join("; "),
        rowId: stored.rowId,
      });
      continue;
    }
    const converted = applyPriceOptions(re.row, priceOptions);
    const priceError = validateConvertedPrice(converted);
    if (priceError !== null) {
      errors.push({ line: stored.line, reason: priceError, rowId: stored.rowId });
      continue;
    }
    valid.push({
      row: { ...re.row, price: converted.price, salePrice: converted.salePrice },
      rowId: stored.rowId,
      line: stored.line,
    });
  }
  return { valid, errors };
}

/** Kiểm giá sau chuyển đổi (B3): số nguyên VND 1–1.000.000.000;
 *  salePrice (nếu có) là số nguyên và NHỎ HƠN giá gốc nghiêm ngặt. */
function validateConvertedPrice(converted: {
  price: number;
  salePrice: number | null;
}): string | null {
  if (!Number.isInteger(converted.price)) {
    return "giá phải là số nguyên (VND)";
  }
  if (converted.price < 1 || converted.price > 1_000_000_000) {
    return "giá phải từ 1 đến 1.000.000.000 ₫";
  }
  if (converted.salePrice !== null) {
    if (!Number.isInteger(converted.salePrice)) {
      return "giá khuyến mãi phải là số nguyên (VND)";
    }
    if (converted.salePrice < 1) {
      return "giá khuyến mãi phải lớn hơn 0";
    }
    if (converted.salePrice >= converted.price) {
      return "giá khuyến mãi phải nhỏ hơn giá gốc";
    }
  }
  return null;
}
// --- Phân loại dòng (C5) ---

type ClassifyContext = {
  existingByKey: Map<string, { id: number; slug: string; sku: string | null; price: number; salePrice: number | null; needsReview: boolean; importedAt: Date | null; updatedAt: Date }>;
  skuOwners: Map<string, { id: number; source: string }>;
  systemSlugs: Set<string>;
  importSlugs: Set<string>;
  categorySlugs: Set<string>;
  staticSlugs: Set<string>;
  seenKeys: Set<string>;
  seenSkus: Set<string>;
  seenImportSlugs: Set<string>;
};

async function buildClassifyContext(
  sourceName: string,
  rows: NormalizedRow[],
): Promise<ClassifyContext> {
  const skus = rows
    .map((r) => (r.sku ?? "").trim().toUpperCase())
    .filter((s) => s !== "");
  const [existing, skuRows, systemProducts, importProducts, categories, pages] = await Promise.all([
    db.product.findMany({
      where: { source: "import", sourceName },
      select: { id: true, sourceExternalId: true, slug: true, sku: true, price: true, salePrice: true, needsReview: true, importedAt: true, updatedAt: true },
    }),
    skus.length > 0
      ? db.product.findMany({
          where: { sku: { in: skus } },
          select: { id: true, sku: true, source: true },
        })
      : Promise.resolve([] as Array<{ id: number; sku: string | null; source: string }>),
    db.product.findMany({
      where: { source: { not: "import" } },
      select: { id: true, categoryId: true, slug: true },
    }),
    // Slug của SP đã nhập (mọi nguồn) — để thêm hậu tố khi trùng (B5).
    db.product.findMany({
      where: { source: "import" },
      select: { categoryId: true, slug: true },
    }),
    db.category.findMany({ select: { slug: true } }),
    db.page.findMany({ where: { isPublished: true }, select: { slug: true } }),
  ]);
  const existingByKey = new Map(
    existing
      .filter((p) => p.sourceExternalId !== null)
      .map((p) => [`${sourceName}\n${p.sourceExternalId as string}`, p]),
  );
  const skuOwners = new Map(
    skuRows
      .filter((p) => p.sku !== null)
      .map((p) => [p.sku as string, { id: p.id, source: p.source }]),
  );
  return {
    existingByKey,
    skuOwners,
    systemSlugs: new Set(systemProducts.map((p) => `${p.categoryId}\n${p.slug}`)),
    importSlugs: new Set(importProducts.map((p) => `${p.categoryId}\n${p.slug}`)),
    categorySlugs: new Set(categories.map((c) => c.slug)),
    staticSlugs: new Set(pages.map((p) => p.slug)),
    seenKeys: new Set(),
    seenSkus: new Set(),
    seenImportSlugs: new Set(),
  };
}

export type RowDisposition =
  | { action: "create"; categoryId: number; slug: string; sku: string | null }
  | { action: "update"; productId: number; categoryId: number; sku: string | null; priceOnly: boolean; priceChanged: boolean }
  | { action: "skip"; reason: string }
  | { action: "error"; reason: string };

function resolveCategory(
  row: NormalizedRow,
  payload: ImportPayload,
): { categoryId: number } | { error: string } | { skip: string } {
  const catName = row.categoryName;
  if (catName === null || catName === "") {
    if (payload.defaultCategoryId !== null) {
      return { categoryId: payload.defaultCategoryId };
    }
    return { error: "thiếu danh mục" };
  }
  const mapped = payload.categoryMapping[catName];
  if (mapped === undefined) return { error: `chưa ánh xạ danh mục "${catName}"` };
  if (mapped === "skip") return { skip: `bỏ qua danh mục "${catName}"` };
  return { categoryId: mapped };
}

function classifyRow(
  row: NormalizedRow,
  payload: ImportPayload,
  ctx: ClassifyContext,
  sourceName: string,
): RowDisposition {
  const sku = (row.sku ?? "").trim().toUpperCase() || null;
  if (sku !== null && !PRODUCT_SKU_RE.test(sku)) {
    return { action: "error", reason: "SKU không hợp lệ (chỉ chữ hoa, số, gạch nối, 2–20 ký tự)" };
  }
  if (!Number.isInteger(row.price)) {
    return { action: "error", reason: "giá phải là số nguyên (VND)" };
  }
  if (row.price < 1 || row.price > 1_000_000_000) {
    return { action: "error", reason: "giá phải từ 1 đến 1.000.000.000 ₫" };
  }
  if (row.salePrice !== null && !Number.isInteger(row.salePrice)) {
    return { action: "error", reason: "giá khuyến mãi phải là số nguyên (VND)" };
  }
  const cat = resolveCategory(row, payload);
  if ("error" in cat) return { action: "error", reason: cat.error };
  if ("skip" in cat) return { action: "skip", reason: cat.skip };
  const categoryId = cat.categoryId;

  const key = `${sourceName}\n${row.externalId}`;
  if (ctx.seenKeys.has(key)) {
    return { action: "error", reason: "trùng mã ngoài trong tệp" };
  }
  ctx.seenKeys.add(key);

  // SKU trùng với SP khác (không cùng SP đích) → hàng LỖI (B5),
  // không còn là "bỏ qua" như Ngày 20. SKU chỉ kiểm khi nó sẽ
  // được ghi (tạo mới hoặc cập nhật đầy đủ); cập nhật chỉ-giá
  // không đụng tới SKU nên không kiểm.
  const skuCollidesWithOther = (targetId: number | null): boolean => {
    if (sku === null) return false;
    if (ctx.seenSkus.has(sku)) return true;
    const owner = ctx.skuOwners.get(sku);
    return owner !== undefined && owner.id !== targetId;
  };

  const existing = ctx.existingByKey.get(key);
  if (existing) {
    if (!existing.needsReview) {
      // B5: SP ĐÃ DUYỆT → chỉ cập nhật price/salePrice, không ghi
      // đè tên/mô tả/ảnh/danh mục đã chỉnh (thay quy tắc "bỏ qua
      // khi sửa tay" của Ngày 20).
      const priceChanged =
        row.price !== existing.price || row.salePrice !== existing.salePrice;
      return {
        action: "update",
        productId: existing.id,
        categoryId,
        sku: existing.sku,
        priceOnly: true,
        priceChanged,
      };
    }
    if (skuCollidesWithOther(existing.id)) {
      return { action: "error", reason: "SKU đã tồn tại" };
    }
    if (sku !== null) ctx.seenSkus.add(sku);
    return { action: "update", productId: existing.id, categoryId, sku, priceOnly: false, priceChanged: false };
  }

  if (skuCollidesWithOther(null)) {
    return { action: "error", reason: "SKU đã tồn tại" };
  }
  if (sku !== null) ctx.seenSkus.add(sku);

  // Slug từ tên, duy nhất bằng hậu tố. Trùng slug HỆ THỐNG trong
  // cùng danh mục → BỎ QUA (không bao giờ ghi đè SP hệ thống);
  // trùng slug đặt trước/danh mục/trang tĩnh/SP đã nhập → thêm hậu
  // tố -2, -3… (B5).
  let base = slugifyName(row.name);
  if (base === "") {
    base = slugifyName(row.externalId);
    if (base === "") return { action: "error", reason: "không tạo được đường dẫn từ tên" };
    base = `sp-${base}`;
  }
  if (base.length > 80) base = base.slice(0, 80).replace(/-+$/, "");
  if (base === "") return { action: "error", reason: "không tạo được đường dẫn từ tên" };
  if (ctx.systemSlugs.has(`${categoryId}\n${base}`)) {
    return { action: "skip", reason: "trùng đường dẫn với sản phẩm hệ thống" };
  }
  let slug = base;
  let n = 2;
  while (
    isReservedSlug(slug) ||
    ctx.categorySlugs.has(slug) ||
    ctx.staticSlugs.has(slug) ||
    ctx.importSlugs.has(`${categoryId}\n${slug}`) ||
    ctx.seenImportSlugs.has(`${categoryId}\n${slug}`)
  ) {
    slug = `${base}-${n}`;
    n += 1;
    if (n > 1000) return { action: "error", reason: "không tạo được đường dẫn duy nhất" };
  }
  ctx.seenImportSlugs.add(`${categoryId}\n${slug}`);
  return { action: "create", categoryId, slug, sku };
}

// --- Bước 3: xem trước (KHÔNG ghi DB) ---

export type ImportPreviewRow = {
  line: number;
  name: string;
  price: number;
  salePrice: number | null;
  categoryName: string | null;
  sku: string | null;
  externalId: string;
  disposition: "create" | "update" | "skip" | "error";
  reason: string | null;
  slug: string | null;
  /** Cập nhật chỉ-giá (SP đã duyệt, B5) — xem trước ghi rõ. */
  priceOnly: boolean;
};

export type ImportPreview = {
  total: number;
  valid: number;
  toCreate: number;
  toUpdate: number;
  toSkip: number;
  errorTotal: number;
  errors: ParseError[];
  skipReasons: Record<string, number>;
  errorReasons: Record<string, number>;
  rows: ImportPreviewRow[];
  distinctCategoryValues: string[];
};

export async function computePreview(batchId: number): Promise<ImportPreview | null> {
  const batch = await getImportBatch(batchId);
  if (!batch) return null;
  const payload = batch.payload;
  const { valid, errors: renormErrors } = renormalizeRows(batch);
  const ctx = await buildClassifyContext(batch.sourceName, valid.map((v) => v.row));
  const rows: ImportPreviewRow[] = [];
  const errors: ParseError[] = [...payload.errors, ...renormErrors];
  const skipReasons: Record<string, number> = {};
  const errorReasons: Record<string, number> = {};
  let toCreate = 0;
  let toUpdate = 0;
  let toSkip = 0;
  for (const { row, line } of valid) {
    const d = classifyRow(row, payload, ctx, batch.sourceName);
    if (d.action === "create") toCreate += 1;
    else if (d.action === "update") toUpdate += 1;
    else if (d.action === "skip") {
      toSkip += 1;
      skipReasons[d.reason] = (skipReasons[d.reason] ?? 0) + 1;
    } else {
      errors.push({ line, reason: d.reason });
    }
    if (rows.length < 20) {
      rows.push({
        line,
        name: row.name,
        price: row.price,
        salePrice: row.salePrice,
        categoryName: row.categoryName,
        sku: row.sku,
        externalId: row.externalId,
        disposition: d.action,
        reason:
          d.action === "create" || d.action === "update"
            ? d.action === "update" && d.priceOnly
              ? "chỉ cập nhật giá"
              : null
            : d.reason,
        slug: d.action === "create" ? d.slug : null,
        priceOnly: d.action === "update" && d.priceOnly,
      });
    }
  }
  for (const e of errors) {
    errorReasons[e.reason] = (errorReasons[e.reason] ?? 0) + 1;
  }
  return {
    // Tổng dòng = mọi dòng dữ liệu trong nguồn: dòng đã đọc
    // (rowsTotal) + dòng rớt lúc parse (payload.errors). Dòng lỗi
    // lúc chuẩn hóa lại vẫn nằm trong rowsTotal nên không cộng thêm.
    total: batch.rowsTotal + payload.errors.length,
    valid: valid.length,
    toCreate,
    toUpdate,
    toSkip,
    errorTotal: errors.length,
    errors: errors.slice(0, 50),
    skipReasons,
    errorReasons,
    rows,
    distinctCategoryValues: distinctCategoryValues(payload),
  };
}

// --- Bước 4: xác nhận quyền ---

export async function confirmImportRights(
  batchId: number,
  rightsConfirmed: boolean,
  retypedSourceName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const batch = await getImportBatch(batchId);
  if (!batch) return { ok: false, error: "Không tìm thấy lô nhập." };
  if (batch.status !== "PREVIEW") {
    return { ok: false, error: "Lô này đã qua bước xác nhận." };
  }
  if (!rightsConfirmed) {
    return { ok: false, error: "Bắt buộc tick xác nhận quyền sử dụng dữ liệu." };
  }
  if (retypedSourceName.trim() !== batch.sourceName) {
    return { ok: false, error: "Tên nguồn gõ lại không khớp." };
  }
  await db.importBatch.update({
    where: { id: batchId },
    data: {
      rightsConfirmed: true,
      rightsConfirmedAt: new Date(),
      rightsConfirmedBy: batch.createdBy,
    },
  });
  await db.$transaction(async (tx) => {
    await writeCatalogAudits(tx, [
      {
        key: `import:${batchId}`,
        oldValue: null,
        newValue: `Đã xác nhận quyền sử dụng dữ liệu lô "${batch.sourceName}"`,
      },
    ]);
  });
  return { ok: true };
}

// --- Bước 5: chạy lô (theo khối ~25 dòng) ---

function imageExt(contentType: string): ImageType | null {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/avif") return "avif";
  return null;
}

async function fetchRowImages(
  row: NormalizedRow,
  line: number,
): Promise<{ urls: string[]; imageErrors: Array<{ line: number; reason: string; kind: "image" }> }> {
  const settled = await Promise.allSettled(
    row.imageUrls.map(async (url) => {
      const fetched = await safeFetch(url, { kind: "image", allowLoopbackForTest });
      const ext = imageExt(fetched.contentType.split(";")[0]?.trim().toLowerCase() ?? "");
      if (!ext) throw new Error(`Content-Type ảnh không hỗ trợ: ${fetched.contentType}`);
      return saveImage(fetched.body, ext);
    }),
  );
  const urls: string[] = [];
  const imageErrors: Array<{ line: number; reason: string; kind: "image" }> = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") urls.push(r.value);
    else {
      imageErrors.push({
        line,
        reason: `ảnh ${row.imageUrls[i]} lỗi: ${r.reason instanceof Error ? r.reason.message : "không tải được"}`,
        kind: "image",
      });
    }
  });
  return { urls, imageErrors };
}

export type RunChunkResult =
  | {
      ok: true;
      processed: number;
      total: number;
      created: number;
      updated: number;
      skipped: number;
      errors: number;
      done: boolean;
    }
  | { ok: false; error: string };

/** Ghi trạng thái cuối của một hàng, CÓ ĐIỀU KIỆN chỉ khi hàng còn
 *  PENDING (chống hai lần chạy trùng xử lý trùng hàng). Trả false
 *  khi hàng đã được lần chạy khác nhận (không đếm lại). Chạy trong
 *  transaction truyền vào (để gộp với ghi sản phẩm) hoặc trực tiếp. */
async function markRowTerminal(
  client: Prisma.TransactionClient | typeof db,
  rowId: number,
  status: ImportRowStatus,
  message: string | null,
  productId: number | null,
  imageWarnings?: string[],
): Promise<boolean> {
  const warningsJson =
    imageWarnings !== undefined && imageWarnings.length > 0
      ? JSON.stringify(imageWarnings)
      : null;
  const affected = await client.$executeRaw`
    UPDATE "import_rows"
    SET "status" = ${status}::"ImportRowStatus",
        "message" = ${message},
        "productId" = ${productId},
        "payload" = CASE WHEN ${warningsJson}::jsonb IS NULL THEN "payload"
                         ELSE jsonb_set(COALESCE("payload", '{}'::jsonb), '{imageWarnings}', ${warningsJson}::jsonb) END
    WHERE "id" = ${rowId} AND "status" = 'PENDING'`;
  return affected === 1;
}

const ROW_CLAIMED_ERROR = "hàng đã được lần chạy khác nhận";

/** Giữ lô để chạy (khóa hàng lô + kiểm hạn giữ). Trả "ok" khi giữ
 *  được, "busy" khi lô đang chạy ở yêu cầu khác, "finished" khi lô
 *  đã kết thúc, "timeout" khi lô chạy quá 20 phút (tự chuyển
 *  FAILED). */
async function claimBatchForRun(
  batchId: number,
): Promise<"ok" | "busy" | "finished" | "timeout" | "not-found"> {
  return db.$transaction(async (tx) => {
    const found = await tx.$queryRaw<Array<{ status: string; payload: unknown }>>`
      SELECT "status", "payload" FROM "import_batches" WHERE "id" = ${batchId} FOR UPDATE`;
    if (found.length === 0) return "not-found";
    const current = found[0];
    if (current.status === "DONE" || current.status === "ROLLED_BACK") {
      return "finished";
    }
    const run = parseRunPayload(current.payload);
    const nowMs = Date.now();
    if (run.runStartedAt) {
      const elapsed = nowMs - new Date(run.runStartedAt).getTime();
      if (elapsed > IMPORT_RUN_TIMEOUT_MS) {
        await tx.importBatch.update({
          where: { id: batchId },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            notes: "Quá 20 phút — tự hủy.",
            payload: { ...run, runLeaseUntil: null } as unknown as object,
          },
        });
        return "timeout";
      }
    }
    if (run.runLeaseUntil && new Date(run.runLeaseUntil).getTime() > nowMs) {
      return "busy";
    }
    const leaseUntil = new Date(nowMs + IMPORT_RUN_LEASE_MS).toISOString();
    await tx.importBatch.update({
      where: { id: batchId },
      data: {
        status: "RUNNING",
        payload: { ...run, runLeaseUntil: leaseUntil } as unknown as object,
      },
    });
    return "ok";
  });
}

export async function runImportChunk(batchId: number): Promise<RunChunkResult> {
  const batch = await getImportBatch(batchId);
  if (!batch) return { ok: false, error: "Không tìm thấy lô nhập." };
  if (batch.status === "DONE" || batch.status === "ROLLED_BACK") {
    return { ok: false, error: "Lô này đã kết thúc, không chạy tiếp được." };
  }
  if (!batch.rightsConfirmed) {
    return { ok: false, error: "Chưa xác nhận quyền sử dụng ở bước 4." };
  }
  const other = await getRunningBatch();
  if (other && other.id !== batchId) {
    return {
      ok: false,
      error: `Đang có lô "${other.sourceName}" chạy — một lúc chỉ chạy một lô.`,
    };
  }
  const claim = await claimBatchForRun(batchId);
  if (claim === "not-found") return { ok: false, error: "Không tìm thấy lô nhập." };
  if (claim === "finished") {
    return { ok: false, error: "Lô này đã kết thúc, không chạy tiếp được." };
  }
  if (claim === "timeout") {
    return { ok: false, error: "Lô chạy quá 20 phút nên đã tự hủy." };
  }
  if (claim === "busy") {
    return {
      ok: false,
      error: "Lô đang chạy ở một yêu cầu khác, thử lại sau.",
    };
  }

  const startedAt = Date.now();
  const payload = batch.payload;
  // Bộ đếm suy từ import_rows (đúng cả khi khối trước chết giữa
  // chừng mà chưa kịp cập nhật bộ đếm trên lô).
  let created = payload.rows.filter((r) => r.status === "CREATED").length;
  let updated = payload.rows.filter((r) => r.status === "UPDATED").length;
  let skipped = payload.rows.filter((r) => r.status === "SKIPPED").length;
  let errors = payload.rows.filter((r) => r.status === "ERROR").length;
  for (const r of payload.rows) {
    if (
      (r.status === "CREATED" || r.status === "UPDATED") &&
      r.imageWarnings !== undefined
    ) {
      errors += r.imageWarnings.length;
    }
  }
  let processed = payload.processed;
  const auditRows: Array<{ key: string; oldValue: string | null; newValue: string }> = [];
  const isFirstChunk = processed === 0 && batch.status === "PREVIEW";
  if (isFirstChunk) {
    auditRows.push({
      key: `import:${batchId}`,
      oldValue: null,
      newValue: `Bắt đầu chạy lô "${batch.sourceName}"`,
    });
  }

  // Dòng lỗi lúc chuẩn hóa lại: ghi ERROR luôn để không kẹt lô.
  const { valid, errors: renormErrors } = renormalizeRows(batch);
  for (const e of renormErrors) {
    const claimed = await markRowTerminal(db, e.rowId, "ERROR", e.reason, null);
    if (claimed) {
      errors += 1;
      processed += 1;
    }
  }

  const ctx = await buildClassifyContext(batch.sourceName, valid.map((v) => v.row));
  const now = new Date();
  const endIndex = Math.min(valid.length, IMPORT_CHUNK_ROWS);
  let i = 0;
  while (i < endIndex) {
    const { row, rowId, line } = valid[i];
    i += 1;
    const d = classifyRow(row, payload, ctx, batch.sourceName);
    if (d.action === "skip") {
      if (await markRowTerminal(db, rowId, "SKIPPED", d.reason, null)) {
        skipped += 1;
        processed += 1;
      }
      continue;
    }
    if (d.action === "error") {
      if (await markRowTerminal(db, rowId, "ERROR", d.reason, null)) {
        errors += 1;
        processed += 1;
      }
      continue;
    }
    // Lỗi ảnh không hỏng dòng: vẫn tạo/cập nhật với ảnh tải được.
    // Nhưng lỗi ảnh VẪN đếm vào tổng lỗi của lô (ô "Lỗi" ở kết quả)
    // — nếu không, lô có ảnh lỗi vẫn hiện "Lỗi 0".
    // Cập nhật chỉ-giá (SP đã duyệt, B5): không tải ảnh, không
    // đụng tới tên/mô tả/ảnh/danh mục.
    const { urls, imageErrors } = d.action === "update" && d.priceOnly
      ? { urls: [], imageErrors: [] as Array<{ line: number; reason: string; kind: "image" }> }
      : await fetchRowImages(row, line);
    const imageWarnings = imageErrors.map((e) => e.reason);
    try {
      const productId = await db.$transaction(async (tx) => {
        const data = {
          name: row.name,
          description: row.description,
          price: row.price,
          salePrice: row.salePrice,
          categoryId: d.categoryId,
          images: urls,
          inStock: row.stock === null ? true : row.stock > 0,
          sku: d.sku,
          source: "import",
          sourceName: batch.sourceName,
          sourceUrl: batch.sourceUrl,
          sourceExternalId: row.externalId,
          importedAt: now,
          importBatchId: batchId,
        };
        let id: number;
        if (d.action === "create") {
          // Hàng nhập MỚI luôn needsReview=true, isActive=false (ẩn
          // khỏi shop cho tới khi duyệt). Hàng CẬP NHẬT giữ nguyên
          // needsReview/isActive hiện có — SP đã duyệt không bị ẩn
          // lại chỉ vì feed nhập lại.
          const createdRow = await tx.product.create({
            data: { ...data, slug: d.slug, isActive: false, needsReview: true, sortOrder: 0, tags: [], seoTitle: "", seoDescription: "" },
            select: { id: true, sku: true },
          });
          id = createdRow.id;
          auditRows.push(lifecycleAuditRow(productAuditPrefix(createdRow), null, "created"));
        } else if (d.priceOnly) {
          // B5: SP đã duyệt — chỉ cập nhật price/salePrice (và
          // importBatchId để "lô nhập gần nhất" + hoàn tác theo
          // đúng lô đã chạm SP; không đụng tên/mô tả/ảnh/danh mục).
          await tx.product.update({
            where: { id: d.productId },
            data: {
              price: row.price,
              salePrice: row.salePrice,
              importedAt: now,
              importBatchId: batchId,
            },
          });
          id = d.productId;
          auditRows.push(
            lifecycleAuditRow(
              productAuditPrefix({ id: d.productId, sku: d.sku }),
              null,
              "updated",
            ),
          );
        } else {
          await tx.product.update({
            where: { id: d.productId },
            data,
          });
          const target = await tx.product.findUnique({
            where: { id: d.productId },
            select: { id: true, sku: true },
          });
          id = d.productId;
          if (target) {
            auditRows.push(lifecycleAuditRow(productAuditPrefix(target), null, "updated"));
          }
        }
        const terminalStatus = d.action === "create" ? "CREATED" : "UPDATED";
        // B5: cập nhật chỉ-giá ghi "giá đổi" vào kết quả khi giá
        // thực sự đổi; không đổi thì để trống (không tính là lỗi).
        const terminalMessage =
          d.action === "update" && d.priceOnly
            ? d.priceChanged
              ? "giá đổi"
              : null
            : imageWarnings.length > 0
              ? imageWarnings[0]
              : null;
        const claimed = await markRowTerminal(
          tx,
          rowId,
          terminalStatus,
          terminalMessage,
          id,
          imageWarnings,
        );
        if (!claimed) throw new Error(ROW_CLAIMED_ERROR);
        return id;
      });
      void productId;
      if (d.action === "create") created += 1;
      else updated += 1;
      errors += imageErrors.length;
      processed += 1;
    } catch (err) {
      if (err instanceof Error && err.message === ROW_CLAIMED_ERROR) {
        // Lần chạy khác đã nhận hàng này — không đếm lại.
        continue;
      }
      // Ghi sản phẩm lỗi (vd trùng khóa): ghi ERROR cho hàng để
      // khối chạy tiếp, không hỏng cả lô.
      const reason = err instanceof Error ? err.message : "không ghi được sản phẩm";
      if (await markRowTerminal(db, rowId, "ERROR", reason.slice(0, 300), null)) {
        errors += 1;
        processed += 1;
      }
    }
    if (Date.now() - startedAt > IMPORT_CHUNK_MAX_MS && i < endIndex) break;
  }

  const done = processed >= batch.rowsTotal;
  const runPayload: ImportRunPayload = {
    parseErrors: payload.errors,
    runStartedAt: payload.runStartedAt ?? new Date(startedAt).toISOString(),
    runLeaseUntil: null,
  };
  await db.$transaction(async (tx) => {
    await writeCatalogAudits(tx, auditRows);
    await tx.importBatch.update({
      where: { id: batchId },
      data: {
        status: done ? "DONE" : "RUNNING",
        created,
        updated,
        skipped,
        failed: errors,
        finishedAt: done ? now : null,
        payload: runPayload as unknown as object,
      },
    });
    if (done) {
      await writeCatalogAudits(tx, [
        {
          key: `import:${batchId}`,
          oldValue: null,
          newValue: `Hoàn thành lô "${batch.sourceName}": tạo ${created}, cập nhật ${updated}, bỏ qua ${skipped}, lỗi ${errors}`,
        },
      ]);
    }
  });
  return {
    ok: true,
    processed,
    total: batch.rowsTotal,
    created,
    updated,
    skipped,
    errors,
    done,
  };
}

export async function cancelImportBatch(
  batchId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const batch = await getImportBatch(batchId);
  if (!batch) return { ok: false, error: "Không tìm thấy lô nhập." };
  if (batch.status !== "RUNNING" && batch.status !== "PREVIEW") {
    return { ok: false, error: "Lô này đã kết thúc." };
  }
  await db.$transaction(async (tx) => {
    await tx.importBatch.update({
      where: { id: batchId },
      data: {
        status: "PREVIEW",
        finishedAt: null,
        payload: {
          parseErrors: batch.payload.errors,
          runStartedAt: batch.payload.runStartedAt,
          runLeaseUntil: null,
        } as unknown as object,
      },
    });
    await writeCatalogAudits(tx, [
      {
        key: `import:${batchId}`,
        oldValue: null,
        newValue: `Đã hủy lô "${batch.sourceName}"`,
      },
    ]);
  });
  return { ok: true };
}

// --- C6: duyệt / từ chối / hoàn tác ---

export async function approveImportedProducts(
  ids: number[],
  alsoShow: boolean,
): Promise<{ approved: number; missing: number[] }> {
  const uniqueIds = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(
    0,
    BULK_PRODUCTS_MAX,
  );
  return db.$transaction(async (tx) => {
    const rows = await tx.product.findMany({
      where: { id: { in: uniqueIds }, needsReview: true },
      select: { id: true, sku: true, name: true },
    });
    const found = new Set(rows.map((r) => r.id));
    const missing = uniqueIds.filter((id) => !found.has(id));
    if (rows.length > 0) {
      // Duyệt là chuyển trạng thái quy trình, KHÔNG phải sửa nội dung:
      // giữ nguyên updatedAt để lần nhập lại sau không nhầm SP đã
      // duyệt thành "đã chỉnh sửa tay" (classifyRow so updatedAt với
      // importedAt). Prisma updateMany luôn tự bump @updatedAt nên
      // phải dùng SQL thô ở đây (chỉ đổi needsReview/isActive).
      const idsSql = Prisma.join(rows.map((r) => r.id));
      if (alsoShow) {
        await tx.$executeRaw(
          Prisma.sql`UPDATE "products" SET "needsReview" = false, "isActive" = true WHERE "id" IN (${idsSql})`,
        );
      } else {
        await tx.$executeRaw(
          Prisma.sql`UPDATE "products" SET "needsReview" = false WHERE "id" IN (${idsSql})`,
        );
      }
      await writeCatalogAudits(
        tx,
        rows.map((r) => ({
          key: `${productAuditPrefix(r)}.needsReview`,
          oldValue: "Chờ duyệt",
          newValue: "Đã duyệt",
        })),
      );
    }
    return { approved: rows.length, missing };
  });
}

export async function rejectImportedProduct(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const product = await db.product.findUnique({
    where: { id },
    select: { id: true, sku: true, name: true, needsReview: true, images: true },
  });
  if (!product) return { ok: false, error: "Không tìm thấy sản phẩm." };
  if (!product.needsReview) {
    return { ok: false, error: "Chỉ từ chối được sản phẩm đang chờ duyệt." };
  }
  const orderCount = await db.orderItem.count({ where: { productId: id } });
  if (orderCount > 0) {
    return { ok: false, error: "Sản phẩm đã có đơn hàng tham chiếu, không xóa được." };
  }
  const images = product.images;
  await db.$transaction(async (tx) => {
    await tx.product.delete({ where: { id } });
    await writeCatalogAudits(tx, [
      lifecycleAuditRow(productAuditPrefix(product), product.name, "deleted"),
    ]);
  });
  await deleteOrphanImages(images);
  return { ok: true };
}

async function deleteOrphanImages(urls: string[]): Promise<void> {
  for (const url of new Set(urls)) {
    const used = await db.product.count({ where: { images: { has: url } } });
    if (used === 0) {
      try {
        await deleteImage(url);
      } catch {
        // Ảnh đã mất hoặc lỗi xóa: không chặn hoàn tác.
      }
    }
  }
}

export type UndoBatchResult =
  | {
      ok: true;
      deleted: number;
      kept: Array<{ id: number; name: string; reason: string }>;
    }
  | { ok: false; error: string };

export async function undoImportBatch(batchId: number): Promise<UndoBatchResult> {
  const batch = await getImportBatch(batchId);
  if (!batch) return { ok: false, error: "Không tìm thấy lô nhập." };
  if (batch.status === "RUNNING") {
    return { ok: false, error: "Lô đang chạy — hủy chạy trước rồi mới hoàn tác." };
  }
  const products = await db.product.findMany({
    where: { importBatchId: batchId, needsReview: true },
    select: { id: true, name: true, images: true },
  });
  const kept: Array<{ id: number; name: string; reason: string }> = [];
  const deletable: Array<{ id: number; images: string[] }> = [];
  for (const p of products) {
    const orderCount = await db.orderItem.count({ where: { productId: p.id } });
    if (orderCount > 0) {
      kept.push({ id: p.id, name: p.name, reason: "đã có đơn hàng tham chiếu" });
    } else {
      deletable.push({ id: p.id, images: p.images });
    }
  }
  // SP của lô đã duyệt cũng được giữ lại (không xóa) — liệt kê luôn
  // để "SP giữ lại" đầy đủ theo đặc tả C6, không chỉ SP chờ duyệt
  // có đơn tham chiếu.
  const approved = await db.product.findMany({
    where: { importBatchId: batchId, needsReview: false },
    select: { id: true, name: true },
  });
  for (const p of approved) {
    kept.push({ id: p.id, name: p.name, reason: "đã duyệt" });
  }
  const allImages = deletable.flatMap((p) => p.images);
  await db.$transaction(async (tx) => {
    if (deletable.length > 0) {
      await tx.product.deleteMany({
        where: { id: { in: deletable.map((p) => p.id) } },
      });
    }
    await tx.importBatch.update({
      where: { id: batchId },
      data: {
        status: "ROLLED_BACK",
        notes: `Đã hoàn tác: xóa ${deletable.length} SP, giữ lại ${kept.length} SP.`,
      },
    });
    await writeCatalogAudits(tx, [
      {
        key: `import:${batchId}`,
        oldValue: null,
        newValue: `Hoàn tác lô "${batch.sourceName}": xóa ${deletable.length} SP chờ duyệt, giữ lại ${kept.length} SP`,
      },
    ]);
  });
  await deleteOrphanImages(allImages);
  return { ok: true, deleted: deletable.length, kept };
}
