// Lô nhập sản phẩm (Ngày 20 C1/C4/C5/C6) — logic phía máy chủ.
// Chỉ admin gọi qua Server Action (mỗi action mở đầu requireAdmin).
// Hàng nhập luôn source=import, needsReview=true, ẨN khỏi shop /
// sitemap / tìm kiếm (bộ lọc needsReview=false ở catalog, product,
// queries, search, sitemap, quick-view).

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  MAX_IMPORT_ROWS,
  detectFieldMapping,
  normalizeMappedRecord,
  parseCsv,
  parseJson,
  type FieldMapping,
  type NormalizedRow,
  type ParseError,
} from "@/lib/import/parse";
import { SafeFetchError, safeFetch } from "@/lib/import/safe-fetch";
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

export const IMPORT_CHUNK_ROWS = 25;
export const IMPORT_MAX_BATCHES_PER_DAY = 5;
export const IMPORT_RUN_TIMEOUT_MS = 20 * 60 * 1000;
// Mỗi lần gọi chạy tối đa ~10 s (Vercel Hobby giới hạn Server
// Action ~15 s): đủ 25 dòng nhẹ, dừng sớm khi quá 10 s để không
// bị cắt giữa chừng; lần gọi sau chạy tiếp từ processed.
export const IMPORT_CHUNK_MAX_MS = 10_000;
export const IMPORT_SOURCE_NAME_MIN = 2;
export const IMPORT_SOURCE_NAME_MAX = 60;
export const IMPORT_FILE_MAX_BYTES = 5 * 1024 * 1024;

export type ImportBatchKind = "file" | "feed";

export type ImportPayload = {
  rows: NormalizedRow[];
  /** Số dòng gốc của từng dòng trong rows (CSV: dòng logic kể cả
   *  header, dòng dữ liệu đầu là 2; JSON: chỉ số phần tử + 1) —
   *  để lỗi sau ánh xạ lại vẫn báo đúng số dòng. */
  lines: number[];
  errors: ParseError[];
  mapping: FieldMapping;
  /** true sau khi bước 2 lưu ánh xạ — wizard dùng để biết đang ở
   *  bước nào khi tải lại trang. */
  mappingSaved: boolean;
  categoryMapping: Record<string, number | "skip">;
  defaultCategoryId: number | null;
  processed: number;
  runErrors: Array<{ line: number; reason: string; kind: "row" | "image" }>;
  overwriteHandEdited: boolean;
  runStartedAt: string | null;
};

export type ImportBatchView = {
  id: number;
  sourceName: string;
  kind: ImportBatchKind;
  fileName: string | null;
  sourceUrl: string | null;
  rightsConfirmed: boolean;
  status: "pending" | "running" | "done" | "cancelled";
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  createdBy: string;
  createdAt: Date;
  finishedAt: Date | null;
  notes: string | null;
  payload: ImportPayload;
};

function emptyPayload(): ImportPayload {
  return {
    rows: [],
    lines: [],
    errors: [],
    mapping: {},
    mappingSaved: false,
    categoryMapping: {},
    defaultCategoryId: null,
    processed: 0,
    runErrors: [],
    overwriteHandEdited: false,
    runStartedAt: null,
  };
}

function toBatchView(row: {
  id: number;
  sourceName: string;
  kind: string;
  fileName: string | null;
  sourceUrl: string | null;
  rightsConfirmed: boolean;
  status: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  createdBy: string;
  createdAt: Date;
  finishedAt: Date | null;
  notes: string | null;
  payload: unknown;
}): ImportBatchView {
  const payload =
    row.payload !== null && typeof row.payload === "object"
      ? (row.payload as ImportPayload)
      : emptyPayload();
  return {
    ...row,
    kind: row.kind as ImportBatchKind,
    status: row.status as ImportBatchView["status"],
    payload: { ...emptyPayload(), ...payload },
  };
}

export async function getImportBatch(id: number): Promise<ImportBatchView | null> {
  const row = await db.importBatch.findUnique({ where: { id } });
  return row ? toBatchView(row) : null;
}

export async function listImportBatches(limit = 10): Promise<ImportBatchView[]> {
  const rows = await db.importBatch.findMany({
    orderBy: { id: "desc" },
    take: limit,
  });
  return rows.map(toBatchView);
}

// Đầu ngày theo giờ VN (UTC+7 cố định, không DST) — giới hạn 5 lô/ngày.
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
    where: { status: "running" },
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

function detectFormat(fileName: string, content: string): "csv" | "json" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".csv")) return "csv";
  const trimmed = content.trimStart();
  return trimmed.startsWith("{") || trimmed.startsWith("[") ? "json" : "csv";
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
  if ((await countBatchesToday()) >= IMPORT_MAX_BATCHES_PER_DAY) {
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
    let fetched;
    try {
      fetched = await safeFetch(url, { kind: "feed", allowLoopbackForTest });
    } catch (err) {
      if (err instanceof SafeFetchError) {
        return { ok: false, error: `Không tải được feed: ${err.message}` };
      }
      return { ok: false, error: "Không tải được feed (lỗi mạng)." };
    }
    content = fetched.body.toString("utf8");
    fileName = null;
  }

  const format = detectFormat(fileName ?? sourceUrl ?? "", content);
  const parsed = format === "csv" ? parseCsv(content) : parseJson(content);
  if (parsed.rows.length === 0 && parsed.errors.length > 0) {
    return {
      ok: false,
      error: `Không đọc được dữ liệu: ${parsed.errors[0].reason}`,
    };
  }
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: `Vượt quá ${MAX_IMPORT_ROWS} dòng mỗi lô.` };
  }

  // Ánh xạ mặc định theo alias (bước 2 cho chỉnh lại).
  const sampleKeys =
    parsed.rows.length > 0 ? Object.keys(parsed.rows[0].raw) : [];
  const payload: ImportPayload = {
    ...emptyPayload(),
    rows: parsed.rows,
    lines: assignRowLines(parsed, format),
    errors: parsed.errors,
    mapping: detectFieldMapping(sampleKeys),
  };
  const created = await db.importBatch.create({
    data: {
      sourceName,
      kind: input.kind,
      fileName,
      sourceUrl,
      createdBy: input.createdBy,
      payload: payload as unknown as object,
    },
    select: { id: true },
  });
  await db.$transaction(async (tx) => {
    await writeCatalogAudits(tx, [
      {
        key: `import:${created.id}`,
        oldValue: null,
        newValue: `Đã tạo lô "${sourceName}" (${parsed.rows.length} dòng)`,
      },
    ]);
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
  overwriteHandEdited: boolean,
): Promise<SaveMappingResult> {
  const batch = await getImportBatch(batchId);
  if (!batch) return { ok: false, error: "Không tìm thấy lô nhập." };
  if (batch.status !== "pending") {
    return { ok: false, error: "Lô này đã qua bước ánh xạ, không sửa được nữa." };
  }
  if (!mapping.name) return { ok: false, error: "Chưa chọn cột cho tên sản phẩm." };
  if (!mapping.price) return { ok: false, error: "Chưa chọn cột cho giá." };
  if (!mapping.externalId && !mapping.sku) {
    return { ok: false, error: "Chưa chọn cột cho mã ngoài (externalId) hoặc SKU." };
  }
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
  const payload: ImportPayload = {
    ...batch.payload,
    mapping,
    mappingSaved: true,
    categoryMapping,
    defaultCategoryId,
    overwriteHandEdited,
  };
  await db.importBatch.update({
    where: { id: batchId },
    data: { payload: payload as unknown as object },
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

/** Chuẩn hóa lại toàn bộ dòng theo ánh xạ đã chọn (bước 2). Trả
 *  về dòng hợp lệ + lỗi từng dòng (kèm số dòng gốc). */
export function renormalizeRows(payload: ImportPayload): {
  valid: Array<{ row: NormalizedRow; index: number }>;
  errors: ParseError[];
} {
  const valid: Array<{ row: NormalizedRow; index: number }> = [];
  const errors: ParseError[] = [];
  payload.rows.forEach((stored, index) => {
    const re = normalizeMappedRecord(stored.raw, payload.mapping);
    if ("errors" in re) {
      errors.push({
        line: payload.lines[index] ?? index + 2,
        reason: re.errors.join("; "),
      });
    } else {
      valid.push({ row: re.row, index });
    }
  });
  return { valid, errors };
}
// --- Phân loại dòng (C5) ---

type ClassifyContext = {
  existingByKey: Map<string, { id: number; slug: string; sku: string | null; needsReview: boolean; importedAt: Date | null; updatedAt: Date }>;
  skuOwners: Map<string, { id: number; source: string }>;
  systemSlugs: Set<string>;
  categorySlugs: Set<string>;
  staticSlugs: Set<string>;
  seenKeys: Set<string>;
  seenImportSlugs: Set<string>;
};

async function buildClassifyContext(
  sourceName: string,
  rows: NormalizedRow[],
): Promise<ClassifyContext> {
  const skus = rows
    .map((r) => (r.sku ?? "").trim().toUpperCase())
    .filter((s) => s !== "");
  const [existing, skuRows, systemProducts, categories, pages] = await Promise.all([
    db.product.findMany({
      where: { source: "import", sourceName },
      select: { id: true, externalId: true, slug: true, sku: true, needsReview: true, importedAt: true, updatedAt: true },
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
    db.category.findMany({ select: { slug: true } }),
    db.page.findMany({ where: { isPublished: true }, select: { slug: true } }),
  ]);
  const existingByKey = new Map(
    existing
      .filter((p) => p.externalId !== null)
      .map((p) => [`${sourceName}\n${p.externalId as string}`, p]),
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
    categorySlugs: new Set(categories.map((c) => c.slug)),
    staticSlugs: new Set(pages.map((p) => p.slug)),
    seenKeys: new Set(),
    seenImportSlugs: new Set(),
  };
}

export type RowDisposition =
  | { action: "create"; categoryId: number; slug: string; sku: string | null }
  | { action: "update"; productId: number; categoryId: number; sku: string | null }
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

  const existing = ctx.existingByKey.get(key);
  if (existing) {
    if (sku !== null && sku !== existing.sku) {
      const owner = ctx.skuOwners.get(sku);
      if (owner && owner.id !== existing.id) {
        return {
          action: "skip",
          reason:
            owner.source === "import"
              ? "trùng SKU với sản phẩm nhập khác"
              : "trùng SKU hệ thống",
        };
      }
    }
    // "Sửa tay" = updatedAt chênh importedAt quá 1 giây. Dung sai 1 giây
    // vì lần cập nhật do chính lần nhập trước cũng đặt importedAt =
    // thời điểm chạy, còn updatedAt do Prisma tự đặt cùng lúc — hai
    // mốc có thể lệch vài mili-giây. Duyệt (approve) KHÔNG chạm
    // updatedAt (xem approveImportedProducts) nên SP đã duyệt mà
    // chưa sửa tay vẫn được cập nhật ở lần nhập sau.
    if (
      !existing.needsReview &&
      existing.importedAt !== null &&
      existing.updatedAt.getTime() - existing.importedAt.getTime() > 1000 &&
      !payload.overwriteHandEdited
    ) {
      return {
        action: "skip",
        reason: "đã chỉnh sửa tay sau khi nhập (bật ghi đè để cập nhật)",
      };
    }
    return { action: "update", productId: existing.id, categoryId, sku };
  }

  if (sku !== null) {
    const owner = ctx.skuOwners.get(sku);
    if (owner) {
      return {
        action: "skip",
        reason:
          owner.source === "import"
            ? "trùng SKU với sản phẩm nhập khác"
            : "trùng SKU hệ thống",
      };
    }
  }

  // Slug từ tên, duy nhất bằng hậu tố. Trùng slug HỆ THỐNG trong
  // cùng danh mục → BỎ QUA (không bao giờ ghi đè SP hệ thống);
  // trùng slug đặt trước/danh mục/trang tĩnh → thêm hậu tố -2, -3…
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
  const { valid, errors: renormErrors } = renormalizeRows(payload);
  const ctx = await buildClassifyContext(batch.sourceName, valid.map((v) => v.row));
  const rows: ImportPreviewRow[] = [];
  const errors: ParseError[] = [...payload.errors, ...renormErrors];
  const skipReasons: Record<string, number> = {};
  const errorReasons: Record<string, number> = {};
  let toCreate = 0;
  let toUpdate = 0;
  let toSkip = 0;
  for (const { row, index } of valid) {
    const line = payload.lines[index] ?? index + 2;
    const d = classifyRow(row, payload, ctx, batch.sourceName);
    if (d.action === "create") toCreate += 1;
    else if (d.action === "update") toUpdate += 1;
    else if (d.action === "skip") {
      toSkip += 1;
      skipReasons[d.reason] = (skipReasons[d.reason] ?? 0) + 1;
    } else {
      errorReasons[d.reason] = (errorReasons[d.reason] ?? 0) + 1;
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
        reason: d.action === "create" || d.action === "update" ? null : d.reason,
        slug: d.action === "create" ? d.slug : null,
      });
    }
  }
  for (const e of errors) {
    errorReasons[e.reason] = (errorReasons[e.reason] ?? 0) + 1;
  }
  return {
    // Tổng dòng = mọi dòng dữ liệu trong nguồn: dòng đọc được
    // (payload.rows) + dòng rớt lúc parse (payload.errors). Dòng
    // lỗi lúc chuẩn hóa lại (renorm) vẫn nằm trong payload.rows
    // nên không cộng thêm — tránh đếm trùng.
    total: payload.rows.length + payload.errors.length,
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
  if (batch.status !== "pending") {
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
    data: { rightsConfirmed: true },
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

export async function runImportChunk(batchId: number): Promise<RunChunkResult> {
  const batch = await getImportBatch(batchId);
  if (!batch) return { ok: false, error: "Không tìm thấy lô nhập." };
  if (batch.status === "done" || batch.status === "cancelled") {
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
  const payload = batch.payload;
  const startedAt = Date.now();
  if (payload.runStartedAt) {
    const elapsed = startedAt - new Date(payload.runStartedAt).getTime();
    if (elapsed > IMPORT_RUN_TIMEOUT_MS) {
      await db.importBatch.update({
        where: { id: batchId },
        data: { status: "cancelled", finishedAt: new Date(), notes: "Quá 20 phút — tự hủy." },
      });
      return { ok: false, error: "Lô chạy quá 20 phút nên đã tự hủy." };
    }
  }

  const { valid } = renormalizeRows(payload);
  const ctx = await buildClassifyContext(batch.sourceName, valid.map((v) => v.row));
  const now = new Date();
  let processed = payload.processed;
  let created = batch.createdCount;
  let updated = batch.updatedCount;
  let skipped = batch.skippedCount;
  let errors = batch.errorCount;
  const runErrors = [...payload.runErrors];
  const auditRows: Array<{ key: string; oldValue: string | null; newValue: string }> = [];
  const isFirstChunk = processed === 0 && batch.status === "pending";
  if (isFirstChunk) {
    auditRows.push({
      key: `import:${batchId}`,
      oldValue: null,
      newValue: `Bắt đầu chạy lô "${batch.sourceName}"`,
    });
  }

  type PendingWrite =
    | { type: "create"; row: NormalizedRow; categoryId: number; slug: string; sku: string | null; images: string[] }
    | { type: "update"; productId: number; row: NormalizedRow; categoryId: number; sku: string | null; images: string[] };
  const writes: PendingWrite[] = [];
  const endIndex = Math.min(valid.length, processed + IMPORT_CHUNK_ROWS);
  while (processed < endIndex) {
    const { row, index } = valid[processed];
    const line = payload.lines[index] ?? index + 2;
    const d = classifyRow(row, payload, ctx, batch.sourceName);
    if (d.action === "skip") {
      skipped += 1;
      runErrors.push({ line, reason: d.reason, kind: "row" });
      processed += 1;
      continue;
    }
    if (d.action === "error") {
      errors += 1;
      runErrors.push({ line, reason: d.reason, kind: "row" });
      processed += 1;
      continue;
    }
    // Lỗi ảnh không hỏng dòng: vẫn tạo/cập nhật với ảnh tải được.
    // Nhưng lỗi ảnh VẪN đếm vào tổng lỗi của lô (ô "Lỗi" ở kết quả
    // và batch.errorCount) — nếu không, lô có ảnh lỗi vẫn hiện "Lỗi 0".
    const { urls, imageErrors } = await fetchRowImages(row, line);
    runErrors.push(...imageErrors);
    errors += imageErrors.length;
    if (d.action === "create") {
      created += 1;
      writes.push({ type: "create", row, categoryId: d.categoryId, slug: d.slug, sku: d.sku, images: urls });
    } else {
      updated += 1;
      writes.push({ type: "update", productId: d.productId, row, categoryId: d.categoryId, sku: d.sku, images: urls });
    }
    processed += 1;
    if (Date.now() - startedAt > IMPORT_CHUNK_MAX_MS && processed < endIndex) break;
  }

  const done = processed >= valid.length;
  await db.$transaction(async (tx) => {
    for (const w of writes) {
      const data = {
        name: w.row.name,
        description: w.row.description,
        price: w.row.price,
        salePrice: w.row.salePrice,
        categoryId: w.categoryId,
        images: w.images,
        inStock: w.row.stock === null ? true : w.row.stock > 0,
        sku: w.sku,
        source: "import",
        sourceName: batch.sourceName,
        sourceUrl: batch.sourceUrl,
        externalId: w.row.externalId,
        importedAt: now,
        importBatchId: batchId,
      };
      if (w.type === "create") {
        // Hàng nhập MỚI luôn needsReview=true, isActive=false (ẩn
        // khỏi shop cho tới khi duyệt). Hàng CẬP NHẬT giữ nguyên
        // needsReview/isActive hiện có — SP đã duyệt không bị ẩn
        // lại chỉ vì feed nhập lại.
        const createdRow = await tx.product.create({
          data: { ...data, slug: w.slug, isActive: false, needsReview: true, sortOrder: 0, tags: [], seoTitle: "", seoDescription: "" },
          select: { id: true, sku: true },
        });
        auditRows.push(lifecycleAuditRow(productAuditPrefix(createdRow), null, "created"));
      } else {
        await tx.product.update({
          where: { id: w.productId },
          data,
        });
        const target = await tx.product.findUnique({
          where: { id: w.productId },
          select: { id: true, sku: true },
        });
        if (target) {
          auditRows.push(lifecycleAuditRow(productAuditPrefix(target), null, "updated"));
        }
      }
    }
    await writeCatalogAudits(tx, auditRows);
    await tx.importBatch.update({
      where: { id: batchId },
      data: {
        status: done ? "done" : "running",
        createdCount: created,
        updatedCount: updated,
        skippedCount: skipped,
        errorCount: errors,
        finishedAt: done ? now : null,
        payload: {
          ...payload,
          processed,
          runErrors: runErrors.slice(-200),
          runStartedAt: payload.runStartedAt ?? new Date(startedAt).toISOString(),
        } as unknown as object,
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
  return { ok: true, processed, total: valid.length, created, updated, skipped, errors, done };
}

export async function cancelImportBatch(
  batchId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const batch = await getImportBatch(batchId);
  if (!batch) return { ok: false, error: "Không tìm thấy lô nhập." };
  if (batch.status !== "running" && batch.status !== "pending") {
    return { ok: false, error: "Lô này đã kết thúc." };
  }
  await db.$transaction(async (tx) => {
    await tx.importBatch.update({
      where: { id: batchId },
      data: { status: "cancelled", finishedAt: new Date() },
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
  if (batch.status === "running") {
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
        status: "cancelled",
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
