// Thanh lọc danh sách tin tức (Ngày 18): lọc TỰ ĐỘNG như nhật ký
// hoạt động (đổi dropdown là lọc ngay, gõ tìm kiếm debounce
// ~400 ms, Enter lọc ngay) — không có nút "Lọc"/"Xóa lọc". Tên và
// giá trị param GIỮ NGUYÊN (status, q) nên bookmark/link cũ vẫn
// chạy. Là client component — trang server truyền props xuống.
"use client";

import {
  FilterSearchInput,
  FilterSelect,
  useFilterNavigation,
} from "./filter-controls";

export default function NewsFilterBar({
  status,
  q,
}: {
  status: string;
  q: string;
}) {
  const { updateFilter } = useFilterNavigation();
  return (
    <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <FilterSelect
        id="news-status-filter"
        label="Trạng thái"
        name="status"
        options={[
          { value: "all", label: "Tất cả trạng thái" },
          { value: "published", label: "Đã xuất bản" },
          { value: "scheduled", label: "Hẹn giờ" },
          { value: "draft", label: "Nháp" },
        ]}
        value={status}
        testId="news-status-filter"
        onChange={(value) => updateFilter("status", value)}
      />
      <FilterSearchInput
        id="news-search"
        label="Tìm theo tiêu đề hoặc slug"
        placeholder="vd giữ hoa tươi lâu"
        initialValue={q}
        testId="news-search"
        onSearch={(value) => updateFilter("q", value)}
      />
    </div>
  );
}
