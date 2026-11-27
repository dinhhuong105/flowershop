// Thanh lọc trang danh mục (Ngày 17 P2): lọc theo nguồn — cùng mẫu
// lọc tự động của trang sản phẩm (đổi dropdown là lọc ngay).

"use client";

import { FilterSelect, useFilterNavigation } from "./filter-controls";
import { PRODUCT_SOURCES, PRODUCT_SOURCE_LABELS } from "@/lib/admin/product-source";

export default function CategoriesFilterBar({ source }: { source: string }) {
  const { updateFilter } = useFilterNavigation();
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <FilterSelect
        id="admin-category-source"
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
