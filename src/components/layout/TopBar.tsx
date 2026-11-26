"use client";

import { useEffect, useState } from "react";
import { siteConfig, telHref } from "@/config/site";

// Top bar (mục 4.1 phụ lục): nền green-900, chữ trắng 13px, cao 36px.
// Desktop: 3 mục căn giữa, ngăn cách bằng đường kẻ đứng mảnh. Mobile:
// một dòng duy nhất đổi luân phiên (fade, 4s mỗi mục, dừng khi
// reduced-motion). Mục "Hỗ trợ tư vấn" chỉ gắn tel: khi có số thật.
// Hotline lấy từ Cài đặt shop (Ngày 11 B5) qua prop.
export default function TopBar({ hotline }: { hotline: string }) {
  const items = siteConfig.topBar;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % items.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [items.length]);

  const renderItem = (text: string, key: string) => {
    if (text === "Hỗ trợ tư vấn" && hotline) {
      return (
        <a key={key} href={telHref(hotline)} className="hover:underline">
          {text}: {hotline}
        </a>
      );
    }
    return <span key={key}>{text}</span>;
  };

  return (
    <div className="bg-green-900 text-[13px] text-white" data-testid="topbar">
      <div className="shell flex h-9 items-center justify-center">
        {/* Mobile: một mục đổi luân phiên. */}
        <div className="sm:hidden" aria-live="polite">
          <span key={index} className="animate-topbar-fade">
            {renderItem(items[index], `m-${index}`)}
          </span>
        </div>
        {/* Desktop: 3 mục căn giữa, ngăn cách bằng kẻ đứng. */}
        <div className="hidden items-center justify-center sm:flex">
          {items.map((text, i) => (
            <span key={text} className="flex items-center">
              {i > 0 ? (
                <span aria-hidden="true" className="mx-4 h-4 w-px bg-white/30" />
              ) : null}
              {renderItem(text, `d-${i}`)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
