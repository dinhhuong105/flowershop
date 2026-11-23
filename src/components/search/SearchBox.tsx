"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";

// Ô tìm kiếm trên header (mục 2.4 đặc tả Ngày 6).
//
// Biểu mẫu là <form method="get" action="/tim-kiem"> nên vẫn tìm
// được khi tắt JavaScript (D6-11). Gợi ý khi gõ là cải tiến bằng JS:
// component SearchSuggestions chỉ tải khi người dùng focus vào ô lần
// đầu (next/dynamic, ssr: false) để không tăng First Load JS.
// Mỗi ô có id riêng (desktop / mobile) vì hai ô cùng tồn tại trên
// trang và aria-controls phải trỏ đúng danh sách gợi ý của mình.
const SearchSuggestions = dynamic(() => import("./SearchSuggestions"), {
  ssr: false,
});

export default function SearchBox({
  id,
  autoFocus = false,
  onNavigate,
  className = "",
}: {
  id: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <form method="get" action="/tim-kiem" role="search" onSubmit={onNavigate}>
        <label htmlFor={id} className="sr-only">
          Tìm kiếm sản phẩm
        </label>
        <input
          ref={inputRef}
          id={id}
          name="q"
          type="search"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="Tìm hoa, quà tặng, dịp đặc biệt…"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          aria-expanded={expanded}
          onFocus={() => setEnhanced(true)}
          className="min-h-11 w-full rounded-[3px] border border-line bg-white py-2 pl-4 pr-11 text-sm text-ink placeholder:text-muted focus:border-green-800 focus:outline-none focus:ring-2 focus:ring-green-800/30"
        />
        <button
          type="submit"
          aria-label="Tìm kiếm"
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[3px] text-green-800 transition-colors duration-150 hover:bg-cream-100"
        >
          <svg
            width="20"
            height="20"
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
      </form>
      {enhanced ? (
        <SearchSuggestions
          inputRef={inputRef}
          listboxId={`${id}-listbox`}
          onNavigate={onNavigate}
          onOpenChange={setExpanded}
        />
      ) : null}
    </div>
  );
}
