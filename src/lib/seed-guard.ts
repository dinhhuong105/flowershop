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
