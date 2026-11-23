// Tham số của trang tìm kiếm /tim-kiem (mục 2.3 đặc tả Ngày 6):
// q (từ khóa, giữ nguyên), sx (gia-tang | gia-giam, lạ → null),
// trang (số nguyên ≥ 1, trần 10000 như trang danh mục).
export type SearchPageParams = {
  q: string;
  sx: string | null;
  trang: number;
};

// Nếu tham số xuất hiện nhiều lần (?q=a&q=b), dùng giá trị đầu tiên.
function firstValue(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

export function parseSearchParams(
  raw: Record<string, string | string[] | undefined>,
): SearchPageParams {
  const qRaw = firstValue(raw.q);
  const sxRaw = firstValue(raw.sx);
  const trangRaw = firstValue(raw.trang);

  let trang = 1;
  if (trangRaw !== undefined && /^\d+$/.test(trangRaw)) {
    const n = Number(trangRaw);
    if (Number.isSafeInteger(n) && n >= 1) trang = Math.min(n, 10000);
  }

  return {
    q: qRaw ?? "",
    sx: sxRaw === "gia-tang" || sxRaw === "gia-giam" ? sxRaw : null,
    trang,
  };
}

// Tạo URL /tim-kiem kèm query chỉ gồm tham số có giá trị, theo thứ tự
// cố định q, sx, trang; trang=1 bị bỏ khỏi URL. Khi đổi sx thì bỏ trang
// (về trang 1).
export function buildSearchHref(
  params: SearchPageParams,
  overrides: Partial<SearchPageParams> = {},
): string {
  const next: SearchPageParams = { ...params, ...overrides };
  if ("sx" in overrides) {
    next.trang = 1;
  }
  const parts: string[] = [];
  if (next.q) parts.push(`q=${encodeURIComponent(next.q)}`);
  if (next.sx) parts.push(`sx=${encodeURIComponent(next.sx)}`);
  if (next.trang > 1) parts.push(`trang=${next.trang}`);
  return parts.length > 0 ? `/tim-kiem?${parts.join("&")}` : "/tim-kiem";
}
