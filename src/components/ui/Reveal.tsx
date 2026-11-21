"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Reveal khi cuộn: IntersectionObserver, chạy một lần, so le 60ms theo
// thứ tự thẻ trong lưới (tối đa 6 bước). Nội dung vẫn hiển thị khi tắt
// JS vì CSS chỉ ẩn `.reveal` khi <html> có class `js` (mục 3.1.5).
export default function Reveal({
  children,
  index = 0,
  className = "",
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const delay = Math.min(index, 5) * 60;
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
