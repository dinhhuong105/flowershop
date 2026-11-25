// Thanh lọc trang sản phẩm (25/11, theo góp ý của Henry: lọc tự
// động, không còn nút "Lọc"). Chọn radio là lọc ngay; gõ tìm kiếm
// thì debounce ~400 ms, Enter lọc ngay. Là client component —
// trang server bọc trong <Suspense> vì dùng useSearchParams gián
// tiếp qua hook.

"use client";

import { FilterSearchInput, RadioPills, useFilterNavigation } from "./filter-controls";

export default function ProductsFilterBar({
  q,
  category,
  status,
  categories,
}: {
  q: string;
  category: string;
  status: string;
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
      <RadioPills
        legend="Danh mục"
        name="category-filter"
        options={[
          { value: "", label: "Tất cả" },
          ...categories.map((c) => ({ value: String(c.id), label: c.name })),
        ]}
        value={category}
        onChange={(value) => updateFilter("category", value)}
      />
      <RadioPills
        legend="Trạng thái"
        name="status-filter"
        options={[
          { value: "all", label: "Tất cả" },
          { value: "active", label: "Đang bán" },
          { value: "hidden", label: "Đã ẩn" },
        ]}
        value={status}
        onChange={(value) => updateFilter("status", value)}
      />
    </div>
  );
}
