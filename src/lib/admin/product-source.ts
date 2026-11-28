// Nguồn dữ liệu của sản phẩm/danh mục (Ngày 17 P1, nhãn căn chỉnh
// bản sau Retry B0/B6): "Hệ thống" = dữ liệu có sẵn của shop (seed
// mẫu Ngày 1 + nhập tay trong admin); "Nhập từ ngoài" = nhập từ
// tệp/feed của nguồn ngoài (chờ duyệt). Chỉ là nhãn nguồn gốc,
// KHÔNG phải quyền hay trạng thái: đổi nguồn không đổi hành vi
// hiển thị/bán của sản phẩm.

export const PRODUCT_SOURCES = ["seed", "manual", "import"] as const;

export type ProductSource = (typeof PRODUCT_SOURCES)[number];

export const PRODUCT_SOURCE_LABELS: Record<ProductSource, string> = {
  seed: "Hệ thống",
  manual: "Hệ thống",
  import: "Nhập từ ngoài",
};

export function isProductSource(value: string): value is ProductSource {
  return (PRODUCT_SOURCES as readonly string[]).includes(value);
}

// Nhãn hiển thị cho cột Nguồn: giá trị lạ (dữ liệu cũ/tay sửa DB)
// hiện "Không rõ" thay vì vỡ trang.
export function productSourceLabel(value: string | null | undefined): string {
  if (value !== null && value !== undefined && isProductSource(value)) {
    return PRODUCT_SOURCE_LABELS[value];
  }
  return "Không rõ";
}
