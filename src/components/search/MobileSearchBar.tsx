"use client";

import { useEffect, useState } from "react";
import SearchBox from "./SearchBox";

// Thanh tìm kiếm di động (mục 2.4 đặc tả Ngày 6): biểu tượng kính lúp
// mở thanh tìm kiếm đầy chiều ngang dưới header (trượt xuống 250 ms,
// tự focus vào ô; Esc hoặc nút đóng thu lại). Huy hiệu giỏ và nút menu
// giữ nguyên chỗ. Ô tìm là SearchBox dùng chung — gửi form GET tới
// /tim-kiem nên vẫn tìm được khi tắt JS (khi đó thanh luôn mở vì
// không có JS để đóng).
//
// Vị trí: nút nằm trong cụm phải của hàng 1; bảng trượt đặt absolute
// dưới đáy header (header sticky nên là tổ tiên định vị gần nhất).
export default function MobileSearchBar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Tự focus vào ô khi mở.
    document.getElementById("search-mobile")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Hộp gợi ý đang mở thì để SearchSuggestions đóng gợi ý trước,
      // lần Esc sau mới thu thanh tìm kiếm.
      const input = document.getElementById("search-mobile");
      if (input?.getAttribute("aria-expanded") === "true") return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open ]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={open ? "Đóng tìm kiếm" : "Mở tìm kiếm"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-[3px] text-ink transition-colors duration-150 hover:bg-cream-100 hover:text-green-800"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
      {/* Trượt xuống 250 ms; khi đóng thì ẩn khỏi tab order (inert)
          và khỏi layout (grid 0fr). */}
      <div
        data-testid="mobile-search-panel"
        className="absolute inset-x-0 top-full z-40 grid bg-white shadow-[0_12px_28px_rgba(8,56,42,0.14)] transition-[grid-template-rows] duration-[250ms]"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden" inert={!open ? true : undefined}>
          <div className="flex items-center gap-2 border-t border-line bg-white px-4 py-3">
            <div className="min-w-0 flex-1">
              <SearchBox id="search-mobile" onNavigate={() => setOpen(false)} />
            </div>
            <button
              type="button"
              aria-label="Đóng tìm kiếm"
              onClick={() => setOpen(false)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] text-muted transition-colors duration-150 hover:bg-cream-100 hover:text-ink"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
