// Nguồn dữ liệu của sản phẩm/danh mục (Ngày 17 P1): giá trị lấy từ
// đâu — seed mẫu Ngày 1, nhập tay trong admin, hay nhập file.
// Chỉ là nhãn nguồn gốc, KHÔNG phải quyền hay trạng thái: đổi nguồn
// không đổi hành vi hiển thị/bán của sản phẩm. Giá trị "import" hiện
// chưa có luồng nhập file nào ghi — giữ sẵn để lọc không vỡ khi nhập
// file được thêm sau (Ngày 17 §9 có "nhập sản phẩm/danh mục").

export const PRODUCT_SOURCES = ["seed", "manual", "import"] as const;

export type ProductSource = (typeof PRODUCT_SOURCES)[number];

export const PRODUCT_SOURCE_LABELS: Record<ProductSource, string> = {
  seed: "Seed mẫu",
  manual: "Nhập tay",
  import: "Nhập file",
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
