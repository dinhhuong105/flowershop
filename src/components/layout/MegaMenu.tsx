"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { NavCategory } from "@/lib/queries";

// Dropdown "Danh mục sản phẩm" (mục 3.3 + 4.2 phụ lục): mở bằng hover
// (độ trễ ra 120ms để tránh chớp) và bằng phím/focus, `aria-expanded`,
// vào opacity 0→1 + translateY(8px→0) 200ms, Esc đóng, mũi tên xoay 180°.
// CSS thuần cho hover kết hợp state nhỏ cho bàn phím/chạm.
export default function MegaMenu({ categories }: { categories: NavCategory[] }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const openMenu = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") setOpen(false);
  };
  // Esc phải đóng cả khi mở bằng hover (lúc đó focus vẫn ở body, keydown
  // không nổi bọt qua wrapper) nên nghe thêm ở document khi menu đang mở.
  useEffect(() => {
    if (!open) return;
    const onDocKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onDocKeyDown);
    return () => document.removeEventListener("keydown", onDocKeyDown);
  }, [open ]);
  const onBlur = (event: React.FocusEvent) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        onFocus={openMenu}
        className="flex min-h-11 items-center gap-2 rounded-[3px] bg-green-800 px-4 text-[13px] font-bold uppercase tracking-wide text-white transition-colors duration-150 hover:bg-green-700 active:scale-[0.97]"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        Danh mục sản phẩm
        <span
          aria-hidden="true"
          className={`inline-block text-xs transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      <div
        data-testid="mega-menu"
        className={`absolute left-0 top-full z-50 w-[520px] max-w-[90vw] pt-2 transition-all duration-200 ${
          open
            ? "visible translate-y-0 opacity-100"
            : "invisible translate-y-2 opacity-0 pointer-events-none"
        }`}
      >
        <div className="grid grid-cols-2 gap-1 rounded-[3px] border border-line bg-white p-3 shadow-[0_12px_28px_rgba(8,56,42,0.14)]">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center rounded-[3px] px-3 font-medium text-ink transition-colors duration-150 hover:bg-cream-100 hover:text-green-800"
            >
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
