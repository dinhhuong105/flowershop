"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// Toast "Đã thêm vào giỏ hàng" (mục 4.4 đặc tả Ngày 4): nghe sự kiện
// `cart:added` do form thêm giỏ phát ra sau khi Server Action trả về
// ok; trượt từ dưới header 250 ms, tự ẩn sau 3 giây, role="status",
// đóng được bằng nút. Render ở layout nên dùng được mọi trang.
//
// G-2: toast KHÔNG còn cố định ở góc trên-phải màn hình (trước đây đè
// lên huy hiệu giỏ đang "bump" và cắt cụt dòng top bar). Toast giờ nằm
// DƯỚI header: đo mép dưới của <header> (sticky) rồi đặt top = đáy
// header + 8px; đo lại khi cuộn/thay đổi kích thước vì chiều cao header
// đổi khi cuộn. Di động: căn giữa; máy tính: góc phải.
export default function Toast() {
  const [visible, setVisible] = useState(false);
  const [top, setTop] = useState(0);
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

  // Đo vị trí dưới header mỗi khi toast hiện và khi cuộn/resize.
  useEffect(() => {
    if (!visible) return;
    const measure = () => {
      const header = document.querySelector("header");
      const bottom = header ? header.getBoundingClientRect().bottom : 0;
      setTop(Math.round(bottom) + 8);
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      data-testid="cart-toast"
      style={{ top }}
      className="toast-slide-in fixed left-1/2 z-[70] flex min-h-11 -translate-x-1/2 items-center gap-3 rounded-[3px] border border-line bg-white px-4 py-2 text-sm font-medium text-ink shadow-[0_12px_28px_rgba(8,56,42,0.14)] sm:left-auto sm:right-4 sm:translate-x-0"
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
