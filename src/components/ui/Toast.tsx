"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// Toast "Đã thêm vào giỏ hàng" (mục 4.4 đặc tả Ngày 4): nghe sự kiện
// `cart:added` do form thêm giỏ phát ra sau khi Server Action trả về
// ok; trượt từ góc trên-phải 250 ms, tự ẩn sau 3 giây, role="status",
// đóng được bằng nút. Render ở layout nên dùng được mọi trang.
export default function Toast() {
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const onAdded = () => {
      setVisible(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setVisible(false), 3000);
    };
    window.addEventListener("cart:added", onAdded);
    return () => {
      window.removeEventListener("cart:added", onAdded);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      data-testid="cart-toast"
      className="toast-slide-in fixed right-4 top-4 z-[70] flex min-h-11 items-center gap-3 rounded-[3px] border border-line bg-white px-4 py-2 text-sm font-medium text-ink shadow-[0_12px_28px_rgba(8,56,42,0.14)]"
    >
      <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-xs font-bold text-white">
        ✓
      </span>
      <span>Đã thêm vào giỏ hàng</span>
      <Link href="/gio-hang" className="font-bold text-green-800 hover:underline">
        Xem giỏ hàng
      </Link>
      <button
        type="button"
        aria-label="Đóng thông báo"
        onClick={() => setVisible(false)}
        className="flex h-8 w-8 items-center justify-center rounded-[3px] text-muted transition-colors duration-150 hover:bg-cream-100 hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
