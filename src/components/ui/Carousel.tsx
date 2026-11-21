"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Carousel sản phẩm (mục 3.3 phụ lục): scroll-snap ngang, nút trước/sau
// cuộn mượt đúng một "trang" thẻ, nút mờ đi (disabled) ở hai đầu,
// vuốt/kéo tự nhiên. Dùng cho "Sản phẩm liên quan" ở Ngày 4; gói UI-1
// tạo sẵn theo danh sách file mục 6.
export default function Carousel({
  children,
  title,
  ariaLabel = "Danh sách sản phẩm",
}: {
  children: ReactNode;
  title?: string;
  ariaLabel?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  const buttonClass =
    "flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink transition-all duration-150 hover:border-green-800 hover:text-green-800 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-30";

  return (
    <div>
      {title ? (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl text-ink sm:text-3xl">{title}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Cuộn về trước"
              disabled={!canPrev}
              onClick={() => scrollByPage(-1)}
              className={buttonClass}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Cuộn tiếp"
              disabled={!canNext}
              onClick={() => scrollByPage(1)}
              className={buttonClass}
            >
              ›
            </button>
          </div>
        </div>
      ) : null}
      <div
        ref={trackRef}
        onScroll={update}
        role="region"
        aria-label={ariaLabel}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
      >
        {children}
      </div>
    </div>
  );
}
