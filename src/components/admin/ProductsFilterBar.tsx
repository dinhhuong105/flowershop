// Thanh lọc trang sản phẩm (25/11, theo góp ý của Henry: lọc tự
// động, không còn nút "Lọc"). Chọn dropdown là lọc ngay; gõ tìm kiếm
// thì debounce ~400 ms, Enter lọc ngay. Là client component —
// trang server bọc trong <Suspense> vì dùng useSearchParams gián
// tiếp qua hook.

"use client";

import { FilterSearchInput, FilterSelect, useFilterNavigation } from "./filter-controls";
import { PRODUCT_SOURCES, PRODUCT_SOURCE_LABELS } from "@/lib/admin/product-source";

export default function ProductsFilterBar({
  q,
  category,
  status,
  source,
  categories,
}: {
  q: string;
  category: string;
  status: string;
  // Nguồn (Ngày 17 P2): "" = tất cả, còn lại đúng 3 giá trị.
  source: string;
  categories: Array<{ id: number; name: string }>;
}) {
  const { updateFilter } = useFilterNavigation();
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <FilterSearchInput
        id="admin-q"
        label="Tìm theo tên/SKU"
        placeholder="Ví dụ: hong, HT-001"
        initialValue={q}
        onSearch={(value) => updateFilter("q", value)}
      />
      <FilterSelect
        id="admin-category"
        label="Danh mục"
        name="category"
        options={[
          { value: "", label: "Tất cả" },
          ...categories.map((c) => ({ value: String(c.id), label: c.name })),
        ]}
        value={category}
        onChange={(value) => updateFilter("category", value)}
      />
      <FilterSelect
        id="admin-status"
        label="Trạng thái"
        name="status"
        options={[
          { value: "all", label: "Tất cả" },
          { value: "active", label: "Đang bán" },
          { value: "hidden", label: "Đã ẩn" },
        ]}
        value={status}
        onChange={(value) => updateFilter("status", value)}
      />
      <FilterSelect
        id="admin-source"
        label="Nguồn"
        name="source"
        options={[
          { value: "", label: "Tất cả" },
          ...PRODUCT_SOURCES.map((s) => ({ value: s, label: PRODUCT_SOURCE_LABELS[s] })),
        ]}
        value={source}
        onChange={(value) => updateFilter("source", value)}
      />
    </div>
  );
}
