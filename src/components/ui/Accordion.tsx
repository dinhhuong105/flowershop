"use client";

import { useState } from "react";

// Accordion (mục 3.3 phụ lục + mục 5.2 đặc tả Ngày 4): mở/đóng bằng
// grid-template-rows 0fr↔1fr 250ms; dấu + xoay 90° thành –; aria-expanded;
// điều khiển được bằng bàn phím (nút <button>).
export type AccordionItem = {
  title: string;
  content: string;
};

export default function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item, i) => {
        const isOpen = open.has(i);
        return (
          <div key={item.title}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`accordion-panel-${i}`}
                id={`accordion-button-${i}`}
                onClick={() => toggle(i)}
                className="flex min-h-11 w-full items-center justify-between gap-3 py-3 text-left text-base font-semibold text-ink transition-colors duration-150 hover:text-green-800"
              >
                <span>{item.title}</span>
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-lg text-green-800 transition-transform duration-250 ${
                    isOpen ? "rotate-90" : ""
                  }`}
                >
                  +
                </span>
              </button>
            </h3>
            <div
              id={`accordion-panel-${i}`}
              role="region"
              aria-labelledby={`accordion-button-${i}`}
              className={`grid transition-all duration-250 ease-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="pb-4 leading-relaxed text-ink-soft">{item.content}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
