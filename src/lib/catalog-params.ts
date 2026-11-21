import { priceRanges, sortOptions, tagLabels } from "@/config/catalog";

// Tham số bộ lọc/sắp xếp/phân trang của trang danh mục, đã qua allowlist.
export type CatalogParams = {
  dip: string | null;
  gia: string | null;
  sx: string | null;
  trang: number;
};

const DIP_VALUES: Set<string> = new Set(tagLabels.map((t) => t.slug));
const GIA_VALUES: Set<string> = new Set(priceRanges.map((r) => r.slug));
const SX_VALUES: Set<string> = new Set(sortOptions.map((s) => s.slug));

// Nếu tham số xuất hiện nhiều lần (?dip=a&dip=b), dùng giá trị đầu tiên.
function firstValue(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

// Chỉ nhận giá trị trong allowlist; mọi giá trị khác thành null (trang = 1).
export function parseCatalogParams(
  raw: Record<string, string | string[] | undefined>,
): CatalogParams {
  const dipRaw = firstValue(raw.dip);
  const giaRaw = firstValue(raw.gia);
  const sxRaw = firstValue(raw.sx);
  const trangRaw = firstValue(raw.trang);

  let trang = 1;
  if (trangRaw !== undefined && /^\d+$/.test(trangRaw)) {
    const n = Number(trangRaw);
    if (Number.isSafeInteger(n) && n >= 1) trang = n;
  }

  return {
    dip: dipRaw !== undefined && DIP_VALUES.has(dipRaw) ? dipRaw : null,
    gia: giaRaw !== undefined && GIA_VALUES.has(giaRaw) ? giaRaw : null,
    sx: sxRaw !== undefined && SX_VALUES.has(sxRaw) ? sxRaw : null,
    trang,
  };
}

// Tạo URL /<slug> kèm query chỉ gồm tham số có giá trị, theo thứ tự cố
// định dip, gia, sx, trang; trang=1 bị bỏ khỏi URL. Khi đổi dip, gia hoặc
// sx thì bỏ trang (về trang 1).
export function buildCatalogHref(
  categorySlug: string,
  params: CatalogParams,
  overrides: Partial<CatalogParams> = {},
): string {
  const next: CatalogParams = { ...params, ...overrides };
  if (
    "dip" in overrides ||
    "gia" in overrides ||
    "sx" in overrides
  ) {
    next.trang = 1;
  }
  const parts: string[] = [];
  if (next.dip) parts.push(`dip=${encodeURIComponent(next.dip)}`);
  if (next.gia) parts.push(`gia=${encodeURIComponent(next.gia)}`);
  if (next.sx) parts.push(`sx=${encodeURIComponent(next.sx)}`);
  if (next.trang > 1) parts.push(`trang=${next.trang}`);
  return parts.length > 0 ? `/${categorySlug}?${parts.join("&")}` : `/${categorySlug}`;
}

// true nếu dip, gia hoặc sx khác null (không tính trang).
export function hasActiveFilter(params: CatalogParams): boolean {
  return params.dip !== null || params.gia !== null || params.sx !== null;
}
