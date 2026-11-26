"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatVND } from "@/lib/format";
import { telHref, zaloHref } from "@/config/site";
import { buyNow } from "@/app/actions/cart";
import { asFormAction } from "@/lib/form-action";

// Thanh mua hàng cố định trang chi tiết (mục 5.2 đặc tả Ngày 4):
// chỉ di động (≤767px), hiện khi hộp mua hàng (#pdp-buy-box) đã cuộn
// khỏi màn hình (IntersectionObserver), trượt lên 250ms. Gồm giá hiện
// tại (+ giá gốc gạch ngang), nút Gọi/Zalo (chỉ khi Cài đặt shop có số
// thật — hiện chưa có nên ẩn; Ngày 11 B5 qua prop), nút "Mua ngay" (form buyNow, số lượng
// 1, submit thường → redirect /cart). Khi hiện, phát sự kiện
// `sticky-buy:visible` để BackToTop ẩn đi, tránh chồng chéo; đồng thời
// render một khoảng đệm 76px qua portal vào cuối document.body (sau
// footer) để thanh không che nội dung cuối trang. Hết hàng → không
// render gì.
export default function StickyBuyBar({
  productId,
  current,
  original,
  inStock,
  hotline,
  zalo,
}: {
  productId: number;
  current: number;
  original: number | null;
  inStock: boolean;
  hotline: string;
  zalo: string;
}) {
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Portal cần document.body (chỉ có sau khi mount — tránh lệch SSR).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const target = document.getElementById("pdp-buy-box");
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const shown = inStock && visible && isMobile;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("sticky-buy:visible", { detail: shown }));
  }, [shown]);

  if (!inStock) return null;

  return (
    <>
      {/* Khoảng đệm 76px: portal vào cuối document.body (SAU footer —
          footer nằm trong layout, sau <main> chứa thanh này) để khi
          cuộn tới đáy trang, đáy footer vẫn nằm trên mép thanh cố định
          (~69px) và không bị che. Đặt đệm trong <main> (trước footer)
          thì không có tác dụng này. */}
      {shown && mounted
        ? createPortal(
            <div aria-hidden="true" className="h-[76px] md:hidden" />,
            document.body,
          )
        : null}
      <div
        data-testid="sticky-buy-bar"
        aria-hidden={!shown}
        className={`fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(8,56,42,0.12)] transition-transform duration-250 ease-out md:hidden ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold leading-tight text-ink">
              {formatVND(current)}
            </p>
            {original !== null ? (
              <p className="truncate text-sm text-muted line-through">{formatVND(original)}</p>
            ) : null}
          </div>
          {hotline ? (
            <a
              href={telHref(hotline)}
              aria-label="Gọi cho shop"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-800 text-white transition-colors duration-150 hover:bg-green-700"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9Z" />
              </svg>
            </a>
          ) : null}
          {zalo ? (
            <a
              href={zaloHref(zalo)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Nhắn Zalo cho shop"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0068ff] text-xs font-bold text-white transition-opacity duration-150 hover:opacity-90"
            >
              Zalo
            </a>
          ) : null}
          <form action={asFormAction(buyNow)} className="shrink-0">
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="quantity" value={1} />
            <button
              type="submit"
              className="flex min-h-11 items-center justify-center rounded-[3px] bg-gold-300 px-5 text-sm font-bold uppercase tracking-wide text-green-900 transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
            >
              Mua ngay
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
