// Bộ đọc dữ liệu nhập sản phẩm (Ngày 20, phần C2) — thuần, không I/O.
// Đọc CSV/JSON thành NormalizedRow để bước ánh xạ dùng tiếp.
//
// CSV:
// - UTF-8 có/không BOM; tự nhận dấu phân tách `,` `;` tab (dấu cho
//   nhiều cột nhất ở dòng đầu; hòa thì ưu tiên `,` rồi `;` rồi tab).
// - Ngoặc kép: `""` = một `"`; xuống dòng trong ô có ngoặc kép được giữ.
// - Dòng đầu là header. Header rỗng/trùng tên sau chuẩn hóa
//   (lowercase + trim + khoảng trắng liên tiếp → `_`, KHÔNG bỏ dấu)
//   → lỗi toàn cục. Dòng trống (toàn ô rỗng) được bỏ qua.
// - Số dòng logic (kể cả header) ≤ 2.000, vượt thì lỗi toàn cục,
//   không parse tiếp. `totalLines` và số dòng trong lỗi đều đếm theo
//   dòng logic (ô có xuống dòng trong ngoặc kép tính là 1 dòng).
//
// JSON:
// - Mảng ở gốc, hoặc object có khóa `items` / `products` / `data`
//   chứa mảng. ≤ 2.000 phần tử (đếm trước khi duyệt sâu). Độ sâu
//   ≤ 6 (B2), kiểm bằng duyệt lặp (stack riêng) nên JSON lồng 1.000
//   tầng cũng không stack overflow. Khóa `__proto__` /
//   `constructor` / `prototype` ở mọi tầng bị từ chối (B2).
// - CSV tối đa 40 cột, mỗi ô tối đa 5000 ký tự (B2); tệp nhị
//   phân/UTF-16 (chứa byte NUL) bị từ chối.
//
// Chuẩn hóa mỗi dòng/object thành NormalizedRow (xem kiểu bên dưới).
// Lỗi từng dòng được thu thập (không dừng cả tệp); lỗi toàn cục có
// line = 0, trừ lỗi header thì line = 1. JSON: line = chỉ số phần
// tử + 1.
//
// Ô bắt đầu bằng `=`, `+`, `-`, `@`, tab, CR được GIỮ NGUYÊN dữ liệu
// nhưng đánh cờ `formulaFlagged: true` (ghi rõ field trong
// `flaggedFields`) — chống CSV injection ở bước sau, không tự sửa
// dữ liệu. `raw` giữ object gốc của dòng (mọi trường khác) để bước
// ánh xạ dùng; khi sao chép dùng Object.fromEntries (không dùng
// Object.assign / gán trực tiếp) để khóa `__proto__` không làm
// nhiễm prototype.

export const MAX_IMPORT_ROWS = 2000;
export const MAX_JSON_DEPTH = 6;
/** CSV: tối đa 40 cột, mỗi ô tối đa 5000 ký tự (B2). */
export const MAX_CSV_COLUMNS = 40;
export const MAX_CELL_CHARS = 5000;
/** Khóa JSON bị cấm ở mọi tầng (B2): chống nhiễm prototype. */
export const FORBIDDEN_JSON_KEYS = ["__proto__", "constructor", "prototype"];
/** Ảnh mỗi hàng tối đa 8 URL (B3). */
export const MAX_IMAGE_URLS = 8;
// Giới hạn số nút duyệt khi kiểm độ sâu JSON (chống JSON phình to
// bất thường; giới hạn này cao hơn nhiều so với tệp feed ≤ 5 MB).
const MAX_JSON_NODES = 5_000_000;

export type ParseError = {
  /** Số dòng (CSV: dòng logic kể cả header; JSON: chỉ số phần tử + 1).
   *  0 = lỗi toàn cục, 1 = lỗi header. */
  line: number;
  reason: string;
};

export type NormalizedRow = {
  externalId: string;
  name: string;
  description: string;
  price: number;
  salePrice: number | null;
  categoryName: string | null;
  imageUrls: string[];
  stock: number | null;
  sku: string | null;
  /** true khi có ít nhất một ô bắt đầu bằng ký tự công thức. */
  formulaFlagged: boolean;
  /** Tên field (chuẩn) hoặc tên cột/key (chuẩn hóa) bị đánh cờ. */
  flaggedFields: string[];
  /** Object gốc của dòng (CSV: key = header đã trim, value = chuỗi;
   *  JSON: object phần tử như lúc parse). */
  raw: Record<string, unknown>;
};

export type ParseResult = {
  rows: NormalizedRow[];
  errors: ParseError[];
  totalLines: number;
};

/** Ô có bắt đầu bằng ký tự công thức (`=`, `+`, `-`, `@`, tab, CR)? */
export function isFormulaCell(value: string): boolean {
  if (value === "") return false;
  const first = value[0];
  return (
    first === "=" ||
    first === "+" ||
    first === "-" ||
    first === "@" ||
    first === "\t" ||
    first === "\r"
  );
}

// Chuẩn hóa tên header/key: lowercase + trim + khoảng trắng liên tiếp
// thành `_`. KHÔNG bỏ dấu tiếng Việt.
function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

type CanonicalField =
  | "externalId"
  | "sku"
  | "name"
  | "description"
  | "price"
  | "salePrice"
  | "categoryName"
  | "imageUrls"
  | "stock";

// Tên cột/key chấp nhận được cho từng field (đã ở dạng chuẩn hóa).
const FIELD_ALIASES: Record<CanonicalField, string[]> = {
  externalId: [
    "externalid",
    "external_id",
    "id",
    "mã",
    "ma",
    "mã_sản_phẩm",
    "ma_san_pham",
  ],
  sku: ["sku"],
  name: [
    "name",
    "tên",
    "ten",
    "tên_sản_phẩm",
    "ten_san_pham",
    "product_name",
    "productname",
  ],
  description: ["description", "mô_tả", "mo_ta", "mota", "mô_ta_sản_phẩm"],
  price: ["price", "giá", "gia", "giá_bán", "gia_ban"],
  salePrice: [
    "saleprice",
    "sale_price",
    "giá_khuyến_mãi",
    "gia_khuyen_mai",
    "giá_km",
    "gia_km",
    "giá_sale",
  ],
  categoryName: [
    "categoryname",
    "category_name",
    "category",
    "danh_mục",
    "danh_muc",
    "tên_danh_mục",
    "ten_danh_muc",
    "danh_mục_sản_phẩm",
  ],
  imageUrls: [
    "imageurls",
    "image_urls",
    "images",
    "image",
    "ảnh",
    "anh",
    "hình_ảnh",
    "hinh_anh",
    "ảnh_sản_phẩm",
  ],
  stock: [
    "stock",
    "tồn_kho",
    "ton_kho",
    "số_lượng",
    "so_luong",
    "quantity",
    "số_lượng_tồn",
  ],
};

// Tìm giá trị của một field trong record (CSV: key = header đã trim;
// JSON: key gốc). Trả undefined khi cột/key không có.
function findField(
  record: Record<string, unknown>,
  field: CanonicalField,
): unknown {
  const aliases = FIELD_ALIASES[field];
  const keys = Object.keys(record);
  for (const alias of aliases) {
    for (const key of keys) {
      if (normalizeHeaderName(key) === alias) return record[key];
    }
  }
  return undefined;
}

// Tên field chuẩn của một key (để ghi vào flaggedFields); null khi
// key không thuộc field chuẩn nào.
function canonicalNameOfKey(key: string): CanonicalField | null {
  const normalized = normalizeHeaderName(key);
  for (const field of Object.keys(FIELD_ALIASES) as CanonicalField[]) {
    if (FIELD_ALIASES[field].includes(normalized)) return field;
  }
  return null;
}

// Giá trị vô hướng (string/number/boolean) → chuỗi; còn lại → null
// (null/undefined/object/mảng coi như "không có").
function toText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

// Số tiền VN (B3, bản sau Retry — ĐẢO NGƯỢC diễn giải Ngày 20):
// dấu `.` / `,` là phân tách NGHÌN khi nhóm đủ 3 chữ số, còn dấu
// phân tách cuối cùng theo sau là 1–2 chữ số mới là thập phân.
// "890.000" = 890.000 (nghìn), "1234.5" = 1234,5 (thập phân),
// "1.234.567" = 1234567, "1,234,567" = 1234567, "1.234,56" =
// 1234,56 (dấu cuối là thập phân). Chuỗi có chữ, nhiều dấu phân
// tách không theo nhóm 3, khoảng trắng trong số → null.
export function parseVndNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text === "") return null;
  if (!/^[+-]?[\d.,]+$/.test(text)) return null;
  const sign = text.startsWith("-") ? -1 : 1;
  const digits = text.replace(/^[+-]/, "");
  const dotCount = (digits.match(/\./g) ?? []).length;
  const commaCount = (digits.match(/,/g) ?? []).length;
  let normalized: string | null = null;
  if (dotCount === 0 && commaCount === 0) {
    normalized = digits;
  } else if (dotCount > 0 && commaCount > 0) {
    // Cả hai dấu: dấu CUỐI là thập phân, dấu còn lại là nghìn.
    const lastDot = digits.lastIndexOf(".");
    const lastComma = digits.lastIndexOf(",");
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    const sepIndex = decimalSep === "." ? lastDot : lastComma;
    const intPart = digits.slice(0, sepIndex);
    const fracPart = digits.slice(sepIndex + 1);
    if (!/^\d{1,2}$/.test(fracPart)) return null;
    if (!thousandsGroupsOk(intPart, thousandsSep)) return null;
    normalized = `${intPart.replaceAll(thousandsSep, "")}.${fracPart}`;
  } else {
    const sep = dotCount > 0 ? "." : ",";
    const parts = digits.split(sep);
    if (parts.length === 1) {
      normalized = digits;
    } else if (parts.length === 2) {
      const [intPart, fracPart] = parts as [string, string];
      if (fracPart === "" || !/^\d+$/.test(intPart) || intPart === "") return null;
      if (fracPart.length === 3) {
        // Một dấu + đúng 3 chữ số sau → phân tách nghìn.
        normalized = intPart + fracPart;
      } else if (fracPart.length <= 2) {
        // 1–2 chữ số sau → thập phân.
        normalized = `${intPart}.${fracPart}`;
      } else {
        // 4+ chữ số sau → thập phân (vd "1.2345" = 1,2345).
        normalized = `${intPart}.${fracPart}`;
      }
    } else {
      // Nhiều dấu giống nhau → chỉ hợp lệ khi mọi nhóm đều 3 chữ số.
      if (!thousandsGroupsOk(digits, sep)) return null;
      normalized = parts.join("");
    }
  }
  if (normalized === null || normalized === "") return null;
  const num = Number(normalized) * sign;
  return Number.isFinite(num) ? num : null;
}

/** "1.234.567" tách theo dấu nghìn phải cho nhóm đầu 1–3 chữ số,
 *  các nhóm sau đúng 3 chữ số. */
function thousandsGroupsOk(text: string, sep: string): boolean {
  const groups = text.split(sep);
  return groups.every(
    (g, i) => /^\d+$/.test(g) && g !== "" && (i === 0 ? g.length <= 3 : g.length === 3),
  );
}

/** Giữ tên cũ cho tương thích nội bộ (đã đổi nghĩa theo B3). */
export const parseDecimal = parseVndNumber;

// Làm sạch văn bản (B5): bỏ thẻ HTML, ký tự điều khiển, chuẩn hóa
// khoảng trắng (nhiều khoảng → một, cắt đầu/cuối).
export function cleanText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Số nguyên: "5", 5, -1 (để bước kiểm bắt lỗi âm); "1.5" → null.
function parseInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^[+-]?\d+$/.test(text)) return null;
  const num = Number(text);
  return Number.isSafeInteger(num) ? num : null;
}

function flaggedFieldsOf(record: Record<string, unknown>): string[] {
  const flagged = new Set<string>();
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== "string" || !isFormulaCell(value)) continue;
    flagged.add(canonicalNameOfKey(key) ?? normalizeHeaderName(key));
  }
  return [...flagged];
}

// Chuẩn hóa một record (dòng CSV / phần tử JSON). Trả về dòng hợp lệ,
// hoặc danh sách lý do lỗi (một dòng có thể lỗi nhiều field — gộp
// thành một lỗi duy nhất khi trả về cho caller).
function normalizeRecord(
  record: Record<string, unknown>,
  raw: Record<string, unknown>,
): { row: NormalizedRow } | { errors: string[] } {
  const problems: string[] = [];

  // externalId: bắt buộc, ≤ 100 ký tự; thiếu/rỗng thì lấy từ SKU.
  // (B5: làm sạch văn bản trước khi kiểm — bỏ thẻ HTML, ký tự
  // điều khiển, chuẩn hóa khoảng trắng.)
  let externalId = cleanText(toText(findField(record, "externalId")) ?? "");
  if (externalId === "") {
    externalId = cleanText(toText(findField(record, "sku")) ?? "");
  }
  if (externalId === "") problems.push("thiếu externalId/SKU");
  else if (externalId.length > 100) {
    problems.push("externalId tối đa 100 ký tự");
  }

  const name = cleanText(toText(findField(record, "name")) ?? "");
  if (name.length < 3 || name.length > 160) {
    problems.push("tên phải từ 3 đến 160 ký tự");
  }

  const description = cleanText(toText(findField(record, "description")) ?? "");
  if (description.length > 2000) {
    problems.push("mô tả tối đa 2.000 ký tự");
  }

  const priceRaw = findField(record, "price");
  const price = parseDecimal(priceRaw);
  if (price === null) problems.push("giá không phải số");
  else if (!(price > 0)) problems.push("giá phải lớn hơn 0");

  let salePrice: number | null = null;
  const saleRaw = findField(record, "salePrice");
  const saleText = toText(saleRaw)?.trim() ?? "";
  if (saleRaw !== undefined && saleRaw !== null && saleText !== "") {
    const parsed = parseDecimal(saleRaw);
    if (parsed === null) problems.push("giá khuyến mãi không phải số");
    else if (!(parsed > 0)) {
      problems.push("giá khuyến mãi phải lớn hơn 0");
    } else if (price !== null && parsed >= price) {
      // B3: salePrice < price NGHIÊM NGẶT (bằng giá gốc cũng lỗi).
      problems.push("giá khuyến mãi phải nhỏ hơn giá gốc");
    } else {
      salePrice = parsed;
    }
  }

  const categoryText = cleanText(toText(findField(record, "categoryName")) ?? "");
  let categoryName: string | null = null;
  if (categoryText !== "") {
    if (categoryText.length > 100) {
      problems.push("tên danh mục tối đa 100 ký tự");
    } else {
      categoryName = categoryText;
    }
  }

  let imageUrls: string[] = [];
  const imgRaw = findField(record, "imageUrls");
  if (imgRaw === undefined || imgRaw === null) {
    imageUrls = [];
  } else if (typeof imgRaw === "string") {
    // Chuỗi phân tách bằng `|` (B3); ô rỗng bỏ qua.
    imageUrls = imgRaw
      .split("|")
      .map((u) => u.trim())
      .filter((u) => u !== "");
  } else if (Array.isArray(imgRaw)) {
    if (imgRaw.some((v) => typeof v !== "string")) {
      problems.push("imageUrls phải là chuỗi hoặc mảng chuỗi");
    } else {
      imageUrls = imgRaw
        .map((u) => u.trim())
        .filter((u) => u !== "");
    }
  } else {
    problems.push("imageUrls phải là chuỗi hoặc mảng chuỗi");
  }
  if (imageUrls.length > MAX_IMAGE_URLS) problems.push(`tối đa ${MAX_IMAGE_URLS} ảnh`);
  // B11: chỉ nhận URL http(s) — javascript:/data:/… bị từ chối.
  const badImageUrl = imageUrls.find((u) => !/^https?:\/\//i.test(u));
  if (badImageUrl !== undefined) {
    problems.push("ảnh phải là địa chỉ http(s)");
  }

  let stock: number | null = null;
  const stockRaw = findField(record, "stock");
  const stockText = toText(stockRaw)?.trim() ?? "";
  if (stockRaw === undefined || stockRaw === null || stockText === "") {
    stock = null; // trống = không rõ
  } else {
    const parsed = parseInteger(stockRaw);
    if (parsed === null) problems.push("tồn kho phải là số nguyên");
    else if (parsed < 0) problems.push("tồn kho không được âm");
    else stock = parsed;
  }

  const skuText = cleanText(toText(findField(record, "sku")) ?? "");
  let sku: string | null = null;
  if (skuText !== "") {
    if (skuText.length > 100) problems.push("SKU tối đa 100 ký tự");
    else sku = skuText;
  }

  if (problems.length > 0) return { errors: problems };

  const flaggedFields = flaggedFieldsOf(record);
  return {
    row: {
      externalId,
      name,
      description,
      price: price as number,
      salePrice,
      categoryName,
      imageUrls,
      stock,
      sku,
      formulaFlagged: flaggedFields.length > 0,
      flaggedFields,
      raw,
    },
  };
}

// Tệp nhị phân/UTF-16 (chứa byte NUL) không phải CSV/JSON UTF-8.
export function binaryContentReason(input: string): string | null {
  if (input.indexOf(String.fromCharCode(0)) !== -1) return "tệp không phải văn bản UTF-8 (có thể là tệp nhị phân hoặc UTF-16)";
  return null;
}

/** Tìm khóa JSON bị cấm (__proto__/constructor/prototype) ở mọi
 *  tầng bằng duyệt lặp; trả tên khóa hoặc null. */
export function findForbiddenJsonKey(value: unknown): string | null {
  const stack: unknown[] = [value];
  let visited = 0;
  while (stack.length > 0) {
    const node = stack.pop();
    visited += 1;
    if (visited > MAX_JSON_NODES) return null;
    if (Array.isArray(node)) {
      for (const child of node) stack.push(child);
    } else if (node !== null && typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if ((FORBIDDEN_JSON_KEYS as readonly string[]).includes(k)) return k;
        stack.push(v);
      }
    }
  }
  return null;
}

// Tách văn bản CSV thành các dòng logic (mảng các ô), tôn trọng ngoặc
// kép: `""` trong ngoặc = một `"`, xuống dòng trong ngoặc thuộc về ô.
// Dấu phân tách chỉ có tác dụng ngoài ngoặc kép.
function tokenizeCsv(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = input.length;
  while (i < n) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }
    // Đầu ô (field đang rỗng) gặp `"` → mở ngoặc kép.
    if (ch === '"' && field === "") {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Dòng cuối không có xuống dòng: chỉ đẩy khi còn nội dung
  // (tránh dòng rỗng giả do tệp kết thúc bằng xuống dòng).
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseCsv(input: string): ParseResult {
  const text = input.startsWith("\uFEFF") ? input.slice(1) : input;
  const binaryReason = binaryContentReason(text);
  if (binaryReason !== null) {
    return { rows: [], errors: [{ line: 0, reason: binaryReason }], totalLines: 0 };
  }
  if (text.trim() === "") {
    return {
      rows: [],
      errors: [{ line: 0, reason: "tệp CSV rỗng" }],
      totalLines: 0,
    };
  }

  // Số dòng logic không phụ thuộc dấu phân tách (chỉ phụ thuộc ngoặc
  // kép/xuống dòng) nên đếm bằng lần tách đầu tiên.
  const candidates = [",", ";", "\t"];
  const tokenized = candidates.map((d) => tokenizeCsv(text, d));
  const nonBlank = tokenized[0].filter((r) => r.some((c) => c !== ""));
  if (nonBlank.length > MAX_IMPORT_ROWS) {
    return {
      rows: [],
      errors: [
        {
          line: 0,
          reason: `vượt quá ${MAX_IMPORT_ROWS} dòng`,
        },
      ],
      totalLines: nonBlank.length,
    };
  }

  // Chọn dấu cho nhiều cột nhất ở dòng đầu; hòa thì ưu tiên `,` rồi
  // `;` rồi tab (thứ tự mảng candidates).
  let best = 0;
  for (let i = 1; i < tokenized.length; i++) {
    const firstBest = tokenized[best][0] ?? [];
    const firstCurrent = tokenized[i][0] ?? [];
    if (firstCurrent.length > firstBest.length) best = i;
  }
  const rows = tokenized[best].filter((r) => r.some((c) => c !== ""));

  const headers = rows[0].map((h) => h.trim());
  if (headers.length > MAX_CSV_COLUMNS) {
    return {
      rows: [],
      errors: [{ line: 1, reason: `CSV tối đa ${MAX_CSV_COLUMNS} cột` }],
      totalLines: rows.length,
    };
  }
  const seen = new Set<string>();
  for (const header of headers) {
    const normalized = normalizeHeaderName(header);
    if (normalized === "") {
      return {
        rows: [],
        errors: [{ line: 1, reason: "header có cột rỗng" }],
        totalLines: rows.length,
      };
    }
    if (seen.has(normalized)) {
      return {
        rows: [],
        errors: [
          {
            line: 1,
            reason: `header trùng tên sau chuẩn hóa: "${normalized}"`,
          },
        ],
        totalLines: rows.length,
      };
    }
    seen.add(normalized);
  }

  const result: NormalizedRow[] = [];
  const errors: ParseError[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const hugeCell = cells.find((c) => c.length > MAX_CELL_CHARS);
    if (hugeCell !== undefined) {
      errors.push({ line: i + 1, reason: `ô vượt quá ${MAX_CELL_CHARS} ký tự` });
      continue;
    }
    // Object.fromEntries (không gán trực tiếp) để header `__proto__`
    // không làm nhiễm prototype.
    const record = Object.fromEntries(
      headers.map((h, j) => [h, cells[j] ?? ""] as [string, unknown]),
    );
    const normalized = normalizeRecord(record, record);
    if ("errors" in normalized) {
      errors.push({ line: i + 1, reason: normalized.errors.join("; ") });
    } else {
      result.push(normalized.row);
    }
  }
  return { rows: result, errors, totalLines: rows.length };
}

// Kiểm độ sâu JSON bằng duyệt lặp (stack riêng), không đệ quy:
// true khi có giá trị nằm sâu hơn MAX_JSON_DEPTH, hoặc tổng số nút
// duyệt vượt giới hạn (JSON phình to bất thường).
function jsonTooDeep(value: unknown): boolean {
  const stack: Array<{ node: unknown; depth: number }> = [
    { node: value, depth: 1 },
  ];
  let visited = 0;
  while (stack.length > 0) {
    const item = stack.pop() as { node: unknown; depth: number };
    visited += 1;
    if (visited > MAX_JSON_NODES) return true;
    if (item.depth > MAX_JSON_DEPTH) return true;
    if (Array.isArray(item.node)) {
      for (const child of item.node) {
        stack.push({ node: child, depth: item.depth + 1 });
      }
    } else if (item.node !== null && typeof item.node === "object") {
      for (const child of Object.values(item.node)) {
        stack.push({ node: child, depth: item.depth + 1 });
      }
    }
  }
  return false;
}

export function parseJson(input: string): ParseResult {
  const binaryReasonJson = binaryContentReason(input);
  if (binaryReasonJson !== null) {
    return { rows: [], errors: [{ line: 0, reason: binaryReasonJson }], totalLines: 0 };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    return {
      rows: [],
      errors: [
        {
          line: 0,
          reason: `JSON không hợp lệ: ${err instanceof Error ? err.message : "lỗi cú pháp"}`,
        },
      ],
      totalLines: 0,
    };
  }

  const forbiddenKey = findForbiddenJsonKey(parsed);
  if (forbiddenKey !== null) {
    return {
      rows: [],
      errors: [{ line: 0, reason: `khóa JSON không được phép: ${forbiddenKey}` }],
      totalLines: 0,
    };
  }
  let items: unknown;
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed !== null && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const key = ["items", "products", "data"].find((k) =>
      Array.isArray(obj[k]),
    );
    if (key === undefined) {
      return {
        rows: [],
        errors: [
          {
            line: 0,
            reason:
              "JSON phải là mảng, hoặc object có khóa items/products/data chứa mảng",
          },
        ],
        totalLines: 0,
      };
    }
    items = obj[key];
  } else {
    return {
      rows: [],
      errors: [
        {
          line: 0,
          reason:
            "JSON phải là mảng, hoặc object có khóa items/products/data chứa mảng",
        },
      ],
      totalLines: 0,
    };
  }

  const arr = items as unknown[];
  // Đếm trước khi duyệt sâu: mảng quá lớn thì lỗi ngay, không duyệt
  // từng phần tử (tránh OOM/chậm với mảng 1.000.000 phần tử).
  if (arr.length > MAX_IMPORT_ROWS) {
    return {
      rows: [],
      errors: [
        { line: 0, reason: `vượt quá ${MAX_IMPORT_ROWS} phần tử` },
      ],
      totalLines: arr.length,
    };
  }
  if (jsonTooDeep(parsed)) {
    return {
      rows: [],
      errors: [
        {
          line: 0,
          reason: `JSON lồng quá sâu (tối đa ${MAX_JSON_DEPTH} tầng)`,
        },
      ],
      totalLines: arr.length,
    };
  }

  const rows: NormalizedRow[] = [];
  const errors: ParseError[] = [];
  arr.forEach((element, index) => {
    const line = index + 1;
    if (element === null || typeof element !== "object" || Array.isArray(element)) {
      errors.push({ line, reason: "phần tử phải là object" });
      return;
    }
    // raw = object đã parse (JSON.parse tạo `__proto__` thành own
    // property an toàn); không sao chép lại bằng Object.assign.
    const record = element as Record<string, unknown>;
    const normalized = normalizeRecord(record, record);
    if ("errors" in normalized) {
      errors.push({ line, reason: normalized.errors.join("; ") });
    } else {
      rows.push(normalized.row);
    }
  });
  return { rows, errors, totalLines: arr.length };
}

export function parseImport(
  input: string,
  format: "csv" | "json",
): ParseResult {
  return format === "csv" ? parseCsv(input) : parseJson(input);
}

// --- Ánh xạ cột (Ngày 20 C4 bước 2) ---

export type FieldMapping = Partial<Record<CanonicalField, string | null>>;

/** Ánh xạ mặc định: với mỗi field, cột nguồn nào khớp alias của nó
 *  (dựa trên các key mẫu, thường là key của dòng đầu). null khi
 *  không khớp cột nào. */
export function detectFieldMapping(keys: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  for (const field of Object.keys(FIELD_ALIASES) as CanonicalField[]) {
    let found: string | null = null;
    for (const key of keys) {
      if (FIELD_ALIASES[field].includes(normalizeHeaderName(key))) {
        found = key;
        break;
      }
    }
    mapping[field] = found;
  }
  return mapping;
}

/** Chuẩn hóa lại một dòng theo ánh xạ đã chọn: dựng record với key
 *  là tên field chuẩn rồi dùng chung normalizeRecord (alias đã chứa
 *  chính tên chuẩn nên khớp). `raw` giữ nguyên để bước sau dùng. */
export function normalizeMappedRecord(
  raw: Record<string, unknown>,
  mapping: FieldMapping,
): { row: NormalizedRow } | { errors: string[] } {
  const record: Record<string, unknown> = {};
  for (const field of Object.keys(FIELD_ALIASES) as CanonicalField[]) {
    const col = mapping[field];
    if (col !== undefined && col !== null) record[field] = raw[col];
  }
  return normalizeRecord(record, raw);
}

// --- Xuất CSV lỗi/kết quả (B6) ---

/** Vô hiệu công thức trong một ô CSV: ô bắt đầu bằng `=`, `+`,
 *  `-`, `@`, tab, CR thì thêm dấu nháy đơn phía trước (B6). */
export function neutralizeCsvCell(value: string): string {
  return isFormulaCell(value) ? `'${value}` : value;
}

function csvEscapeCell(value: string): string {
  const cell = neutralizeCsvCell(value);
  return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/** Dựng CSV lỗi/kết quả từ danh sách {dòng, lý do} (dùng cho nút
 *  "Tải CSV lỗi" ở bước xem trước và kết quả). */
export function buildErrorsCsv(
  items: Array<{ line: number; reason: string }>,
): string {
  const header = "Dòng,Lý do";
  const body = items.map(
    (e) => `${csvEscapeCell(String(e.line))},${csvEscapeCell(e.reason)}`,
  );
  return [header, ...body].join("\r\n");
}
