"use client";

import { useState } from "react";
import { MAX_QTY } from "@/config/cart";

// Bộ chọn số lượng trang chi tiết (mục 5.2 đặc tả Ngày 4 + mục 3.3
// phụ lục): nút −/+ kẹp 1..MAX_QTY, số ở giữa trượt dọc 150ms khi đổi
// (lớp animate-qty-slide), bấm giữ nút không tăng liên tục. Giá trị
// mang theo form qua input ẩn `quantity`; nút −/+ là type="button"
// nên không submit form. Khi tắt JS: số lượng cố định 1, nút "Thêm
// vào giỏ" vẫn submit được (ghi rõ ở báo cáo Ngày 4).
export default function QuantityStepper({
  name = "quantity",
  defaultValue = 1,
  disabled = false,
}: {
  name?: string;
  defaultValue?: number;
  disabled?: boolean;
}) {
  const [qty, setQty] = useState(defaultValue);
  const dec = () => setQty((q) => Math.max(1, q - 1));
  const inc = () => setQty((q) => Math.min(MAX_QTY, q + 1));
  const buttonClass =
    "flex h-11 w-11 items-center justify-center border border-line bg-white text-lg text-ink transition-all duration-150 hover:border-green-800 hover:text-green-800 active:scale-[0.9] disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="flex items-stretch">
      <button
        type="button"
        aria-label="Giảm số lượng"
        onClick={dec}
        disabled={disabled || qty <= 1}
        className={`${buttonClass} rounded-l-[3px]`}
      >
        −
      </button>
      <span
        key={qty}
        aria-live="polite"
        className="animate-qty-slide flex h-11 min-w-12 items-center justify-center border-y border-line bg-white px-2 text-base font-semibold text-ink"
      >
        {qty}
      </span>
      <input type="hidden" name={name} value={qty} />
      <button
        type="button"
        aria-label="Tăng số lượng"
        onClick={inc}
        disabled={disabled || qty >= MAX_QTY}
        className={`${buttonClass} rounded-r-[3px]`}
      >
        +
      </button>
    </div>
  );
}
