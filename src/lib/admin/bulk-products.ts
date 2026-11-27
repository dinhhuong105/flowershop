// Thao tác hàng loạt sản phẩm (Ngày 17 P3): kiểm hợp lệ đầu vào
// thuần cho action ẩn/hiện nhiều sản phẩm. CHỈ ẩn/hiện — không có
// xóa hàng loạt (sản phẩm không có đường xóa cứng: đơn hàng tham
// chiếu tới sản phẩm). Giới hạn 50 id/lần để một lần bấm không khóa
// bảng quá lâu; id trùng/lạ bị loại, id không tồn tại được tầng DB
// báo lại (missing) thay vì lỗi 500.

export const BULK_PRODUCTS_MAX = 50;

export type BulkToggleInput = {
  ids: number[];
  isActive: boolean;
  error: string | null;
};

export function parseBulkToggleInput(
  rawIds: unknown[],
  isActiveRaw: unknown,
): BulkToggleInput {
  if (isActiveRaw !== "true" && isActiveRaw !== "false") {
    return { ids: [], isActive: false, error: "Thao tác không hợp lệ." };
  }
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const raw of rawIds) {
    if (typeof raw !== "string" || !/^\d+$/.test(raw)) continue;
    const n = Number(raw);
    if (!Number.isSafeInteger(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    ids.push(n);
  }
  if (ids.length === 0) {
    return { ids: [], isActive: false, error: "Chưa chọn sản phẩm nào." };
  }
  if (ids.length > BULK_PRODUCTS_MAX) {
    return {
      ids: [],
      isActive: false,
      error: `Tối đa ${BULK_PRODUCTS_MAX} sản phẩm mỗi lần.`,
    };
  }
  return { ids, isActive: isActiveRaw === "true", error: null };
}
