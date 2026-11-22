"use client";

import { useEffect, useState } from "react";

// Nút "Lên đầu trang" (mục 3.3 phụ lục): ẩn ở đầu trang, hiện sau khi
// cuộn quá 600px (fade + translateY), bấm thì cuộn mượt lên đầu. Khi
// thanh mua hàng cố định trên trang chi tiết hiện (sự kiện
// `sticky-buy:visible`), nút này ẩn để khỏi chồng chéo.
export default function BackToTop() {
  const [show, setShow] = useState(false);
  const [stickyBuyVisible, setStickyBuyVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onStickyBuy = (event: Event) => {
      setStickyBuyVisible(Boolean((event as CustomEvent<boolean>).detail));
    };
    window.addEventListener("sticky-buy:visible", onStickyBuy);
    return () => window.removeEventListener("sticky-buy:visible", onStickyBuy);
  }, []);

  const visible = show && !stickyBuyVisible;

  const scrollTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      data-testid="back-to-top"
      aria-label="Lên đầu trang"
      onClick={scrollTop}
      className={`fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-green-800 text-xl text-white shadow-lg transition-all duration-300 hover:bg-green-700 active:scale-[0.97] ${
        visible ? "visible translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0"
      }`}
    >
      ↑
    </button>
  );
}
