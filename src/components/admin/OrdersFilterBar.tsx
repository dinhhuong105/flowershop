// Thanh lọc trang đơn hàng (25/11, theo góp ý của Henry: lọc tự
// động, không còn nút "Lọc"). Chọn radio/ngày giao là lọc ngay;
// gõ tìm kiếm thì debounce ~400 ms, Enter lọc ngay. Param tab và
// exclude KHÔNG nằm ở đây nhưng vẫn được giữ nguyên trên URL (xem
// useFilterNavigation). Là client component — trang server bọc
// trong <Suspense> vì dùng useSearchParams gián tiếp qua hook.

"use client";

import { FilterSearchInput, RadioPills, useFilterNavigation } from "./filter-controls";

export default function OrdersFilterBar({
  q,
  payment,
  method,
  date,
}: {
  q: string;
  payment: string;
  method: string;
  date: string;
}) {
  const { updateFilter } = useFilterNavigation();
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <FilterSearchInput
        id="admin-order-q"
        label="Tìm theo mã đơn, tên, SĐT"
        placeholder="Ví dụ: QAFNN907ZY, Hoa, 0900..."
        initialValue={q}
        onSearch={(value) => updateFilter("q", value)}
      />
      <RadioPills
        legend="Thanh toán"
        name="payment-filter"
        options={[
          { value: "all", label: "Tất cả" },
          { value: "UNPAID", label: "Chưa thanh toán" },
          { value: "PAID", label: "Đã thanh toán" },
        ]}
        value={payment}
        onChange={(value) => updateFilter("payment", value)}
      />
      <RadioPills
        legend="Phương thức"
        name="method-filter"
        options={[
          { value: "all", label: "Tất cả" },
          { value: "BANK_TRANSFER", label: "Chuyển khoản" },
          { value: "COD", label: "COD" },
        ]}
        value={method}
        onChange={(value) => updateFilter("method", value)}
      />
      <div>
        <label htmlFor="admin-order-date" className="block text-sm font-semibold text-slate-900">
          Ngày giao
        </label>
        <input
          id="admin-order-date"
          type="date"
          value={date}
          onChange={(e) => updateFilter("date", e.target.value)}
          className="mt-1 block min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
        />
      </div>
    </div>
  );
}
