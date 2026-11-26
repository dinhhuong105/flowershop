// Chặn seed hồi sinh dữ liệu demo (mục 1 verdict Ngày 10).
// Vấn đề: lệnh build trên Vercel chạy `prisma db seed` MỖI lần deploy,
// mà seed dùng upsert — kể cả với `update: {}` thì dòng đã bị xóa vẫn
// được TẠO LẠI (upsert = tạo mới khi chưa có). Henry xóa sản phẩm hay
// khu vực demo trong admin thì lần deploy sau nó mọc lại.
// Cách chặn: chỉ seed khi CẢ 3 bảng danh mục/sản phẩm/khu vực đều
// trống. DB đã có dữ liệu thì seed là no-op, trừ khi chạy tay với
// cờ --force. Module thuần (không import DB) nên test được trực tiếp.

export type SeedCounts = {
  categories: number;
  products: number;
  shippingZones: number;
};

export function shouldSeed(counts: SeedCounts, force: boolean): boolean {
  if (force) return true;
  return (
    counts.categories === 0 &&
    counts.products === 0 &&
    counts.shippingZones === 0
  );
}

// Nhận diện DB production qua host của DATABASE_URL (Ngày 11 A3):
// production = host KHÔNG phải localhost. Dùng cho chặn --force
// của seed và cho script dọn production. URL trống/không đọc được
// → false (script từ chối chạy vì thiếu DATABASE_URL ở chỗ khác;
// seed sẽ lỗi kết nối ồn ào, không động vào dữ liệu).
export function dbUrlHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    // IPv6: Node giữ dấu ngoặc vuông trong hostname ("[::1]").
    return new URL(url).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return null;
  }
}

export function isProductionDatabaseUrl(url: string | undefined): boolean {
  const host = dbUrlHost(url);
  if (host === null) return false;
  return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
}
