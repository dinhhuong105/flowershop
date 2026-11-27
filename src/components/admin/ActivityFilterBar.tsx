// Thanh lọc nhật ký hoạt động (Ngày 16 #3): lọc TỰ ĐỘNG như các
// trang đơn/sản phẩm (đổi dropdown/ngày là lọc ngay, gõ tìm kiếm
// debounce ~400 ms, Enter lọc ngay) — không còn nút "Lọc"/"Xóa
// lọc". Tên và giá trị param GIỮ NGUYÊN như form GET cũ (area, q,
// from, to) nên bookmark/link cũ vẫn chạy; trạng thái lọc lấy từ
// URL khi tải trang (server truyền xuống qua props). Là client
// component — trang server bọc trong <Suspense> như trang đơn.

"use client";

import {
  FilterSearchInput,
  FilterSelect,
  useFilterNavigation,
} from "./filter-controls";
import { ACTIVITY_AREAS, ACTIVITY_AREA_LABELS } from "@/lib/admin/activity";

export default function ActivityFilterBar({
  area,
  q,
  from,
  to,
}: {
  area: string;
  q: string;
  from: string;
  to: string;
}) {
  const { updateFilter } = useFilterNavigation();
  return (
    <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <FilterSelect
        id="activity-area-filter"
        label="Khu vực"
        name="area"
        options={[
          { value: "", label: "Tất cả khu vực" },
          ...ACTIVITY_AREAS.map((a) => ({ value: a, label: ACTIVITY_AREA_LABELS[a] })),
        ]}
        value={area}
        testId="activity-area-filter"
        onChange={(value) => updateFilter("area", value)}
      />
      <FilterSearchInput
        id="activity-search"
        label="Tìm theo khóa hoặc người thay đổi"
        placeholder="vd bank.accountNumber hoặc admin"
        initialValue={q}
        testId="activity-search"
        onSearch={(value) => updateFilter("q", value)}
      />
      <div>
        <label htmlFor="activity-from" className="block text-sm font-semibold text-slate-900">
          Từ ngày
        </label>
        <input
          id="activity-from"
          name="from"
          type="date"
          value={from}
          data-testid="activity-from"
          onChange={(e) => updateFilter("from", e.target.value)}
          className="mt-1 block min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
        />
      </div>
      <div>
        <label htmlFor="activity-to" className="block text-sm font-semibold text-slate-900">
          Đến ngày
        </label>
        <input
          id="activity-to"
          name="to"
          type="date"
          value={to}
          data-testid="activity-to"
          onChange={(e) => updateFilter("to", e.target.value)}
          className="mt-1 block min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
        />
      </div>
    </div>
  );
}
