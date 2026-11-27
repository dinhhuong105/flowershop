// Nhật ký hoạt động (Ngày 15 C1): đọc bảng settings_audit (chỉ
// đọc, không sửa/xóa), lọc theo khu vực/từ khóa/khoảng ngày,
// phân trang 20/trang, mới nhất trước. Giá trị hiển thị được che
// lại nếu còn sót dãy số dài (STK/token) và cắt ngắn khi quá dài.

import { db } from "../db";
import type { Prisma } from "@prisma/client";

export const ACTIVITY_PAGE_SIZE = 20;

export const ACTIVITY_AREAS = [
  "general",
  "contact",
  "bank",
  "telegram",
  "seo",
  "page",
] as const;

export type ActivityArea = (typeof ACTIVITY_AREAS)[number];

export const ACTIVITY_AREA_LABELS: Record<ActivityArea, string> = {
  general: "Chung",
  contact: "Liên hệ",
  bank: "Ngân hàng",
  telegram: "Telegram",
  seo: "SEO",
  page: "Trang tĩnh",
};

export function isActivityArea(value: string): value is ActivityArea {
  return (ACTIVITY_AREAS as readonly string[]).includes(value);
}

// Khu vực của một khóa nhật ký, suy từ tiền tố khóa (C0):
// "general.*" → Chung, "contact.*" → Liên hệ, "bank.*" (+ "bank.notify") → Ngân hàng,
// "telegram.*" → Telegram, "seo.*" → SEO, "page:<slug>" → Trang tĩnh.
export function activityAreaOf(key: string): ActivityArea {
  if (key.startsWith("page:")) return "page";
  const prefix = key.split(".")[0];
  switch (prefix) {
    case "general":
      return "general";
    case "contact":
      return "contact";
    case "bank":
      return "bank";
    case "telegram":
      return "telegram";
    case "seo":
      return "seo";
    default:
      return "general";
  }
}

// Khóa KHÔNG che khi hiển thị (Ngày 16 #2): hotline/Zalo là thông
// tin công khai trên shop — che đi thì không ai biết đổi từ số nào
// sang số nào.
const ACTIVITY_EXEMPT_KEYS = new Set(["contact.hotline", "contact.zalo"]);

// Che lại khi HIỂN THỊ (phòng thủ thêm — STK đã che lúc ghi, chỉ
// giữ 4 số cuối):
// - khóa miễn (hotline/Zalo): hiện đầy đủ, không che;
// - khóa chứa token/password/secret: che toàn bộ thành "********";
// - khóa còn lại (số tài khoản bank.accountNumber + khóa lạ): quét
//   dãy ≥ 8 chữ số (kể cả có khoảng trắng/gạch nối xen giữa, như
//   STK nhập có dấu cách) → chỉ giữ 4 số cuối. Dãy ngắn hơn
//   (vd mã đơn, năm) giữ nguyên. Giá trị null → "—".
// Tham số key mặc định "" (không biết khóa) → quét dãy số như cũ,
// để code cũ gọi không kèm key vẫn an toàn.
export function maskSensitiveForDisplay(value: string | null, key = ""): string {
  if (value === null) return "—";
  if (ACTIVITY_EXEMPT_KEYS.has(key)) return value;
  const lowerKey = key.toLowerCase();
  if (
    lowerKey.includes("token") ||
    lowerKey.includes("password") ||
    lowerKey.includes("secret")
  ) {
    return "********";
  }
  return value.replace(/\d[\d\s-]{6,}\d/g, (run) => {
    const digits = run.replace(/\D/g, "");
    if (digits.length < 8) return run;
    return `****${digits.slice(-4)}`;
  });
}

// Cắt ngắn giá trị dài khi hiển thị (60 ký tự, kể dấu "…").
export const ACTIVITY_VALUE_MAX = 60;

export function truncateActivityValue(value: string | null): string {
  if (value === null) return "—";
  if (value.length <= ACTIVITY_VALUE_MAX) return value;
  return `${value.slice(0, ACTIVITY_VALUE_MAX - 1)}…`;
}

// Giá trị hiển thị: che nhạy cảm trước, rồi cắt ngắn. Truyền key
// để quy tắc che theo khóa (Ngày 16 #2) áp dụng đúng.
// Giá trị rỗng (null hoặc "") hiện "(trống)" (fixup sau verdict
// Ngày 16): dòng "0900123456 →" không cho biết đó là thêm hay xóa,
// còn "0900123456 → (trống)" thì rõ.
export function displayActivityValue(value: string | null, key = ""): string {
  if (value === null || value === "") return "(trống)";
  return truncateActivityValue(maskSensitiveForDisplay(value, key));
}

// Nhãn tiếng Việt cho cột "Thay đổi" (Ngày 16 #3): các giá trị
// vòng đời trang / hành động ghi bằng tiếng Anh thô (created,
// deleted, updated, draft ↔ published) đổi thành nhãn Việt.
// Trả null khi không khớp mẫu nào → trang hiển thị cặp giá trị
// thô (đã che + cắt) như cũ.
export function formatActivityChange(
  oldValue: string | null,
  newValue: string | null,
): string | null {
  if (newValue === "created") return "Đã tạo";
  if (newValue === "deleted") return "Đã xóa";
  if (newValue === "updated") return "Cập nhật";
  if (oldValue === "draft" && newValue === "published") return "Nháp → Đã xuất bản";
  if (oldValue === "published" && newValue === "draft") return "Đã xuất bản → Nháp";
  return null;
}

// Ngày "yyyy-MM-dd" (từ <input type="date">, hiểu theo giờ VN)
// → mốc UTC: đầu ngày VN = 17:00 UTC hôm trước (VN = UTC+7).
function vnDateStart(dateText: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const utc = new Date(Date.UTC(year, month - 1, day) - 7 * 3600 * 1000);
  // Ngày không thật (vd 2026-02-30) → Date tự tràn sang tháng sau:
  // kiểm lại bằng UTC để loại.
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return utc;
}

export type ActivityFilters = {
  area?: ActivityArea | "";
  q?: string;
  from?: string;
  to?: string;
  page?: number;
};

export type ActivityRow = {
  id: number;
  key: string;
  oldValue: string | null;
  newValue: string | null;
  updatedBy: string | null;
  createdAt: Date;
};

export type ActivityList = {
  rows: ActivityRow[];
  total: number;
  totalPages: number;
  page: number;
};

export async function listActivity(filters: ActivityFilters = {}): Promise<ActivityList> {
  const page = filters.page !== undefined && filters.page >= 1 ? filters.page : 1;
  const where: Prisma.SettingsAuditWhereInput = {};
  if (filters.area) {
    where.key =
      filters.area === "page"
        ? { startsWith: "page:" }
        : { startsWith: `${filters.area}.` };
  }
  const q = (filters.q ?? "").trim();
  if (q !== "") {
    where.OR = [
      { key: { contains: q, mode: "insensitive" } },
      { updatedBy: { contains: q, mode: "insensitive" } },
    ];
  }
  const fromDate = filters.from ? vnDateStart(filters.from) : null;
  const toDate = filters.to ? vnDateStart(filters.to) : null;
  if (fromDate !== null || toDate !== null) {
    where.createdAt = {};
    if (fromDate !== null) where.createdAt.gte = fromDate;
    // Đến hết ngày "to" theo giờ VN (23:59:59.999).
    if (toDate !== null) {
      where.createdAt.lte = new Date(toDate.getTime() + 24 * 3600 * 1000 - 1);
    }
  }
  const [rows, total] = await Promise.all([
    db.settingsAudit.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * ACTIVITY_PAGE_SIZE,
      take: ACTIVITY_PAGE_SIZE,
      select: {
        id: true,
        key: true,
        oldValue: true,
        newValue: true,
        updatedBy: true,
        createdAt: true,
      },
    }),
    db.settingsAudit.count({ where }),
  ]);
  return {
    rows,
    total,
    totalPages: Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE)),
    page,
  };
}
