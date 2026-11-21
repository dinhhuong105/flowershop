"use client";

import { useRef } from "react";

// Ô sắp xếp là <select> trong <form method="get"> (gói UI-1 thay chip sắp
// xếp của Ngày 3). dip/gia giữ bằng input ẩn, trang bị bỏ (về trang 1).
// JS bật: tự gửi form khi đổi lựa chọn. JS tắt: bấm nút "Áp dụng".
export default function SortForm({
  dip,
  gia,
  sx,
}: {
  dip: string | null;
  gia: string | null;
  sx: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} method="get" className="flex shrink-0 items-center gap-2">
      <label htmlFor="sx" className="text-sm font-medium text-ink">
        Sắp xếp:
      </label>
      {dip ? <input type="hidden" name="dip" value={dip} /> : null}
      {gia ? <input type="hidden" name="gia" value={gia} /> : null}
      <select
        id="sx"
        name="sx"
        defaultValue={sx ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="min-h-11 rounded-[3px] border border-line bg-white px-3 text-sm font-medium text-ink transition-colors duration-150 focus:border-green-800"
      >
        <option value="">Mặc định</option>
        <option value="gia-tang">Giá tăng dần</option>
        <option value="gia-giam">Giá giảm dần</option>
      </select>
      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center rounded-[3px] border border-line bg-white px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:border-green-800 hover:text-green-800 active:scale-[0.97]"
      >
        Áp dụng
      </button>
    </form>
  );
}
