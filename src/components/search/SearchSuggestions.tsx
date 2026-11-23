"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatVND } from "@/lib/format";

// Gợi ý tìm kiếm khi gõ (mục 2.4 + 2.5 đặc tả Ngày 6). Chỉ tải khi
// người dùng focus vào ô tìm lần đầu (dynamic import từ SearchBox).
// Gắn listener vào ô nhập (được truyền qua inputRef): sau 200 ms
// không gõ thì gọi GET /api/search/suggest?q=, hủy yêu cầu cũ khi có
// yêu cầu mới (AbortController), chỉ gọi khi có ≥ 2 ký tự.
//
// Truy cập (mẫu combobox): danh sách role="listbox", các mục
// role="option"; phím ↓/↑ di chuyển, Enter chọn (mục đang chọn thì
// tới trang sản phẩm; không chọn gì thì form gửi tới /tim-kiem?q=),
// Esc đóng. Số kết quả đọc qua vùng aria-live="polite".
// Chuyển động: hộp gợi ý opacity + translateY(-4px → 0) 150 ms; mục
// đang chọn đổi nền 100 ms; reduced-motion tắt chuyển động (globals.css).

type Suggestion = {
  name: string;
  slug: string;
  categorySlug: string;
  price: number;
  salePrice: number | null;
  image: string | null;
};

export default function SearchSuggestions({
  inputRef,
  listboxId,
  onNavigate,
  onOpenChange,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  listboxId: string;
  onNavigate?: () => void;
  // Báo trạng thái mở/đóng về ô nhập để cập nhật aria-expanded
  // (React sở hữu thuộc tính này trên ô nhập, không thể để effect
  // setAttribute trực tiếp — sẽ bị ghi đè khi render lại).
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  // Ref đồng bộ để handler keydown (gắn một lần) luôn đọc giá trị mới nhất.
  const stateRef = useRef({ open: false, active: -1, items: [] as Suggestion[] });
  stateRef.current = { open, active, items };

  // Đồng bộ aria-expanded / aria-activedescendant lên ô nhập.
  // aria-expanded đi qua onOpenChange để SearchBox (chủ sở hữu React
  // của ô nhập) cập nhật prop; aria-activedescendant không có trong
  // JSX nên setAttribute trực tiếp được.
  useEffect(() => {
    onOpenChange?.(open);
    const input = inputRef.current;
    if (!input) return;
    if (active >= 0 && items[active]) {
      input.setAttribute("aria-activedescendant", `${listboxId}-option-${active}`);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }, [open, active, items, inputRef, listboxId, onOpenChange]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const fetchSuggestions = (q: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      void fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: unknown) => {
          if (Array.isArray(data)) {
            setItems(data as Suggestion[]);
            setOpen(true);
            setActive(-1);
          }
        })
        .catch(() => {
          // Yêu cầu bị hủy (gõ tiếp) hoặc lỗi mạng: im lặng, giữ gợi ý cũ.
        });
    };

    const schedule = () => {
      const q = input.value;
      setQuery(q);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (q.trim().length < 2) {
        setItems([]);
        setOpen(false);
        setActive(-1);
        return;
      }
      timerRef.current = window.setTimeout(() => fetchSuggestions(q), 200);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const { open: isOpen, active: current, items: currentItems } = stateRef.current;
      if (event.key === "Escape") {
        setOpen(false);
        setActive(-1);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (!isOpen || currentItems.length === 0) return;
        event.preventDefault();
        setActive((prev) => {
          if (event.key === "ArrowDown") {
            return prev < currentItems.length - 1 ? prev + 1 : 0;
          }
          return prev > 0 ? prev - 1 : currentItems.length - 1;
        });
        return;
      }
      if (event.key === "Enter" && current >= 0 && currentItems[current]) {
        // Có mục đang chọn: tới trang sản phẩm thay vì gửi form.
        event.preventDefault();
        const item = currentItems[current];
        onNavigate?.();
        router.push(`/${item.categorySlug}/${item.slug}`);
      }
      // Enter khi không chọn gì: để form gửi mặc định tới /tim-kiem?q=.
    };

    const onBlur = (event: FocusEvent) => {
      // Đóng khi focus rời khỏi ô nhập và khỏi hộp gợi ý (để bấm được
      // vào gợi ý trước khi blur đóng hộp).
      const next = event.relatedTarget as Node | null;
      const box = document.getElementById(listboxId);
      if (next && box?.contains(next)) return;
      window.setTimeout(() => {
        if (document.activeElement !== input) {
          setOpen(false);
          setActive(-1);
        }
      }, 150);
    };

    input.addEventListener("input", schedule);
    input.addEventListener("keydown", onKeyDown);
    input.addEventListener("blur", onBlur);
    // Ô đã có ≥ 2 ký tự trước khi component mount (gõ rất nhanh):
    // tìm gợi ý ngay.
    if (input.value.trim().length >= 2) schedule();
    return () => {
      input.removeEventListener("input", schedule);
      input.removeEventListener("keydown", onKeyDown);
      input.removeEventListener("blur", onBlur);
      abortRef.current?.abort();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [inputRef, listboxId, onNavigate, router]);

  if (!open) {
    return (
      <div aria-live="polite" className="sr-only">
        {items.length > 0 ? `${items.length} gợi ý` : ""}
      </div>
    );
  }

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {items.length > 0 ? `${items.length} gợi ý cho “${query}”` : ""}
      </div>
      <div
        id={listboxId}
        role="listbox"
        aria-label="Gợi ý tìm kiếm"
        data-testid="search-suggestions"
        className="suggest-drop absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-[3px] border border-line bg-white shadow-[0_12px_28px_rgba(8,56,42,0.14)]"
      >
        {items.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">Không có gợi ý phù hợp.</p>
        ) : (
          <ul>
            {items.map((item, index) => (
              <li key={item.slug} role="option" id={`${listboxId}-option-${index}`} aria-selected={index === active}>
                <Link
                  href={`/${item.categorySlug}/${item.slug}`}
                  onClick={onNavigate}
                  onMouseEnter={() => setActive(index)}
                  className={`flex items-center gap-3 px-3 py-2 transition-colors duration-100 ${
                    index === active ? "bg-cream-100" : "bg-white"
                  }`}
                >
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      className="h-12 w-12 shrink-0 rounded-[2px] object-cover"
                    />
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {item.name}
                    </span>
                    <span className="mt-0.5 block text-sm font-bold text-green-800">
                      {formatVND(item.salePrice ?? item.price)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/tim-kiem?q=${encodeURIComponent(query)}`}
          onClick={onNavigate}
          data-testid="search-suggestions-all"
          className="block border-t border-line bg-cream-100 px-4 py-2.5 text-sm font-semibold text-green-800 hover:underline"
        >
          Xem tất cả kết quả cho “{query}”
        </Link>
      </div>
    </>
  );
}
