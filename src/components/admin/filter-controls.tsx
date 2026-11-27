// Điều khiển lọc tự động cho trang quản trị (25/11, theo góp ý của
// Henry: chọn lọc là lọc ngay, không bấm nút "Lọc" nữa).
// ĐỢT 3 — 25/11: các nhóm nhiều lựa chọn (thanh toán, phương thức,
// danh mục, trạng thái) ĐỔI từ radio pill sang dropdown <select>
// gốc đã tạo kiểu (Henry yêu cầu) — đảo ngược hướng radio pill ở
// đợt 2. Hành vi lọc tự động KHÔNG đổi: đổi dropdown là cập nhật
// ngay param đó trên URL, giữ các param còn lại, về trang 1.
//
// Cách hoạt động: mỗi lần đổi lọc chỉ cập nhật đúng param đó trong
// URL (giữ nguyên các param còn lại: tab, exclude, q, ...) và về
// trang 1 (bỏ param page), bằng router.replace để nút Back không
// bị ngập lịch sử lọc. Tên và giá trị param GIỮ NGUYÊN như form GET
// cũ (payment, method, date, q, tab, exclude, category, status)
// nên link từ thẻ dashboard (vd method=BANK_TRANSFER +
// exclude=CANCELLED) và bookmark vẫn chạy; trạng thái lọc trên UI
// lấy từ URL khi tải trang (server truyền xuống qua props).
//
// Lưu ý: đọc param hiện tại từ window.location.search thay vì
// snapshot của useSearchParams, NHƯNG window.location.search vẫn
// lag một lần replace chưa commit — xem pendingRef trong
// useFilterNavigation (Ngày 16). Chỉ gọi trong event handler
// (phía client) nên window luôn có. Lọc cần JavaScript (admin vốn
// đã cần JS cho dialog, toggle, tooltip).

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

export function useFilterNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  // Param của lần replace chưa commit: router.replace là bất đồng bộ —
  // window.location.search chỉ đổi SAU khi điều hướng commit (vài
  // chục–vài trăm ms). Hai lần đổi lọc liên tiếp trong khoảng đó mà
  // cùng đọc window.location.search thì lần sau đè mất lần trước
  // (Ngày 16, probe CDP: đặt from rồi to ngay → URL chỉ còn to).
  // Nên giữ lại param của lần replace chưa commit và gộp lần đổi sau
  // vào đó; chỉ dùng khi lần replace đó xuất phát đúng từ URL hiện
  // tại (from khớp) và còn mới (< 2 s — điều hướng thường commit
  // trong < 500 ms). Sau 2 s thì bỏ param chờ và đọc lại URL.
  // Giới hạn còn lại: bấm Back về đúng URL cũ rồi đổi lọc trong 2 s
  // sau một lần đổi lọc có thể làm param cũ hiện lại — cửa sổ hẹp,
  // param hiện rõ trên URL và xóa được bằng cách xóa lọc.
  const pendingRef = useRef<{ from: string; params: URLSearchParams; at: number } | null>(null);
  const updateFilter = useCallback(
    (key: string, value: string) => {
      const currentSearch = window.location.search;
      let base: URLSearchParams;
      const pending = pendingRef.current;
      if (pending && pending.from === currentSearch && Date.now() - pending.at < 2000) {
        base = pending.params;
      } else {
        base = new URLSearchParams(currentSearch);
      }
      const params = new URLSearchParams(base);
      if (value === "") params.delete(key);
      else params.set(key, value);
      params.delete("page");
      pendingRef.current = { from: currentSearch, params, at: Date.now() };
      const query = params.toString();
      router.replace(query === "" ? pathname : `${pathname}?${query}`);
    },
    [router, pathname],
  );
  return { updateFilter };
}

export type FilterSelectOption = { value: string; label: string };

// Dropdown <select> gốc đã tạo kiểu (đợt 3 — 25/11, Henry yêu cầu
// các nhóm nhiều lựa chọn để trong dropdown thay vì radio pill):
// appearance-none + mũi tên chevron tự vẽ, bo tròn, viền slate,
// focus có viền xanh dương, chữ navy. Select gốc nên bàn phím,
// đọc màn hình và hành vi trên mobile đều đúng mặc định.
// Bản có điều khiển (dùng cho thanh lọc trang đơn/sản phẩm):
// value lấy từ URL, đổi là lọc ngay qua onChange.
export function FilterSelect({
  id,
  label,
  name,
  options,
  value,
  onChange,
  testId,
}: {
  id: string;
  label: string;
  name: string;
  options: FilterSelectOption[];
  value: string;
  onChange: (value: string) => void;
  testId?: string;
}) {
  return (
    <div className="min-w-48">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          data-testid={testId}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 block min-h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

// Dropdown không điều khiển (dùng trong ProductForm, gửi theo form
// như <select> cũ): defaultValue từ giá trị đã lưu, lỗi validation
// hiện dưới nhóm qua <p role="alert"> ở form như cũ.
export function FilterSelectField({
  id,
  label,
  name,
  options,
  defaultValue,
}: {
  id: string;
  label: string;
  name: string;
  options: FilterSelectOption[];
  defaultValue: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          name={name}
          defaultValue={defaultValue}
          className="mt-1 block min-h-11 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

// Ô tìm kiếm lọc tự động: gõ xong ~400 ms thì lọc; Enter thì lọc
// ngay (không chờ debounce). Đồng bộ lại khi giá trị trên URL đổi
// từ bên ngoài (bấm tab, Back/Forward, chip ✕).
export function FilterSearchInput({
  id,
  label,
  placeholder,
  initialValue,
  onSearch,
  testId,
}: {
  id: string;
  label: string;
  placeholder: string;
  initialValue: string;
  onSearch: (value: string) => void;
  testId?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (value === initialValue) return;
    timerRef.current = window.setTimeout(() => {
      onSearchRef.current(value.trim());
    }, 400);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [value, initialValue]);

  function applyNow() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    onSearchRef.current(value.trim());
  }

  return (
    <div className="min-w-48 flex-1">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        data-testid={testId}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            applyNow();
          }
        }}
        className="mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
      />
    </div>
  );
}

// Nhãn + ô checkbox tự vẽ dùng chung (25/11): ô vuông ~20 px bo
// tròn, viền slate; khi checked nền xanh dương + dấu tích trắng
// (dấu tích luôn có trong DOM nhưng trắng trên nền trắng nên chỉ
// hiện khi nền xanh). Input checkbox thật (sr-only, peer) nên vẫn
// gửi form bình thường (name/value "on") và bàn phím vẫn đúng.
export function StyledCheckbox({
  name,
  defaultChecked,
  children,
}: {
  name: string;
  defaultChecked: boolean;
  children: ReactNode;
}) {
  return (
    <label className="group flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-900">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span
        aria-hidden="true"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white transition-colors group-hover:border-blue-600 peer-checked:border-blue-600 peer-checked:bg-blue-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      {children}
    </label>
  );
}
