"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AdminToastDetail } from "@/lib/admin/toggle-toast";

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
//
// ĐỢT 4 — 25/11: thêm sự kiện `admin:toast` cho admin (detail xem
// AdminToastDetail): thông báo + nút hành động tùy chọn (vd: "Hoàn
// tác" khi Ẩn/Hiện sản phẩm). Toast hoàn tác hiện 5 giây (đủ thời
// gian đọc + bấm; toast giỏ giữ nguyên 3 giây theo quy ước cũ).
// Nút hành động chạy callback trong detail rồi tự ẩn; callback có
// thể phát tiếp một toast xác nhận khác.

type ToastPayload = {
  message: string;
  actionLabel?: string;
  linkHref?: string;
  linkLabel?: string;
  tone: "success" | "error";
  testId: "cart-toast" | "admin-toast";
};

export default function Toast() {
  const [payload, setPayload] = useState<ToastPayload | null>(null);
  const [top, setTop] = useState(0);
  const timer = useRef<number | null>(null);
  const actionRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const showToast = (p: ToastPayload, durationMs: number) => {
      setPayload(p);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setPayload(null), durationMs);
    };
    const onAdded = () => {
      showToast(
        {
          message: "Đã thêm vào giỏ hàng",
          linkHref: "/cart",
          linkLabel: "Xem giỏ hàng",
          tone: "success",
          testId: "cart-toast",
        },
        3000,
      );
    };
    const onAdmin = (event: Event) => {
      const detail = (event as CustomEvent<AdminToastDetail>).detail;
      if (!detail || typeof detail.message !== "string") return;
      actionRef.current = detail.onAction ?? null;
      showToast(
        {
          message: detail.message,
          actionLabel: detail.actionLabel,
          tone: detail.tone ?? "success",
          testId: "admin-toast",
        },
        detail.durationMs ?? 5000,
      );
    };
    window.addEventListener("cart:added", onAdded);
    window.addEventListener("admin:toast", onAdmin);
    return () => {
      window.removeEventListener("cart:added", onAdded);
      window.removeEventListener("admin:toast", onAdmin);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  // Đo vị trí dưới header mỗi khi toast hiện và khi cuộn/resize.
  useEffect(() => {
    if (!payload) return;
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
  }, [payload]);

  if (!payload) return null;

  const onAction = () => {
    const fn = actionRef.current;
    actionRef.current = null;
    if (timer.current) window.clearTimeout(timer.current);
    setPayload(null);
    fn?.();
  };

  return (
    <div
      role="status"
      data-testid={payload.testId}
      style={{ top }}
      // Một hàng trên cả mobile (Ngày 9 D9-7): trước đây flex-wrap đẩy
      // nút ✕ xuống dòng riêng, tạo khoảng trống lớn. Nội dung không
      // xuống dòng; nút ✕ giữ 44 px trên mobile (chuẩn chạm).
      className="toast-slide-in fixed inset-x-4 z-[70] flex min-h-11 flex-nowrap items-center gap-2 rounded-[3px] border border-line bg-white px-3 py-2 text-sm font-medium text-ink shadow-[0_12px_28px_rgba(8,56,42,0.14)] sm:inset-x-auto sm:left-auto sm:right-4 sm:max-w-md sm:gap-3 sm:px-4"
    >
      <span
        aria-hidden="true"
        className={
          payload.tone === "error"
            ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger text-xs font-bold text-white"
            : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-xs font-bold text-white"
        }
      >
        {payload.tone === "error" ? "✕" : "✓"}
      </span>
      <span className="whitespace-nowrap leading-snug">{payload.message}</span>
      {payload.linkHref && payload.linkLabel ? (
        <Link
          href={payload.linkHref}
          className="shrink-0 whitespace-nowrap font-bold leading-snug text-green-800 hover:underline"
        >
          {payload.linkLabel}
        </Link>
      ) : null}
      {payload.actionLabel ? (
        <button
          type="button"
          data-testid="admin-toast-action"
          onClick={onAction}
          className="shrink-0 whitespace-nowrap font-bold leading-snug text-blue-600 hover:underline"
        >
          {payload.actionLabel}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Đóng thông báo"
        onClick={() => setPayload(null)}
        className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] text-muted transition-colors duration-150 hover:bg-cream-100 hover:text-ink sm:ml-0 sm:h-8 sm:w-8"
      >
        ✕
      </button>
    </div>
  );
}
