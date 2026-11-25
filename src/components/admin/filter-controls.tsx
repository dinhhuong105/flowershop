// Điều khiển lọc tự động cho trang quản trị (25/11, theo góp ý của
// Henry: chọn lọc là lọc ngay, không bấm nút "Lọc" nữa; ô chọn 1
// thành radio kiểu pill, không dùng <select> mặc định).
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
// Lưu ý: đọc param hiện tại từ window.location.search (luôn mới
// nhất) thay vì snapshot của useSearchParams — tránh mất một lần
// đổi lọc khi người dùng đổi 2 lọc liên tiếp trước khi trang kịp
// render lại. Chỉ gọi trong event handler (phía client) nên
// window luôn có. Lọc cần JavaScript (admin vốn đã cần JS cho
// dialog, toggle, tooltip).

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

export function useFilterNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(window.location.search);
      if (value === "") params.delete(key);
      else params.set(key, value);
      params.delete("page");
      const query = params.toString();
      router.replace(query === "" ? pathname : `${pathname}?${query}`);
    },
    [router, pathname],
  );
  return { updateFilter };
}

export type RadioPillOption = { value: string; label: string };

// Một viên pill radio (dùng chung cho cả bản controlled và
// uncontrolled): input radio thật (sr-only, peer) + span hiển thị.
// Đang chọn: nền xanh dương chữ trắng; chưa chọn: nền trắng viền
// slate — đúng ngôn ngữ tab trạng thái sẵn có. Bàn phím và đọc màn
// hình vẫn đúng (radio thật, focus-visible có viền xanh).
function PillOption({
  name,
  value,
  label,
  checked,
  defaultChecked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: () => void;
}) {
  return (
    <label className="cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        className="peer sr-only"
      />
      <span className="flex min-h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 transition-colors hover:border-blue-600 hover:text-blue-600 peer-checked:border-blue-600 peer-checked:bg-blue-600 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600">
        {label}
      </span>
    </label>
  );
}

// Nhóm radio pill có điều khiển (dùng cho thanh lọc trang đơn/sản
// phẩm): checked lấy từ URL, đổi là lọc ngay qua onChange.
export function RadioPills({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: RadioPillOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="block text-sm font-semibold text-slate-900">{legend}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((opt) => (
          <PillOption
            key={opt.value}
            name={name}
            value={opt.value}
            label={opt.label}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
        ))}
      </div>
    </fieldset>
  );
}

// Nhóm radio pill không điều khiển (dùng trong ProductForm, gửi
// theo form như <select> cũ): defaultChecked từ giá trị đã lưu,
// lỗi validation hiện dưới nhóm như cũ.
// Lỗi validation hiện dưới nhóm qua <p role="alert"> ở form
// (aria-invalid không dùng được cho role radio).
export function RadioPillsField({
  legend,
  name,
  options,
  defaultValue,
}: {
  legend: string;
  name: string;
  options: RadioPillOption[];
  defaultValue: string;
}) {
  return (
    <fieldset>
      <legend className="block text-sm font-semibold text-slate-900">{legend}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((opt) => (
          <PillOption
            key={opt.value}
            name={name}
            value={opt.value}
            label={opt.label}
            defaultChecked={defaultValue === opt.value}
          />
        ))}
      </div>
    </fieldset>
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
}: {
  id: string;
  label: string;
  placeholder: string;
  initialValue: string;
  onSearch: (value: string) => void;
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
