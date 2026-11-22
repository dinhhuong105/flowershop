// Nút sao chép một giá trị (mã đơn, số tài khoản, nội dung chuyển
// khoản...). Dùng Clipboard API, có dự phòng khi trình duyệt không hỗ trợ.

"use client";

import { useState } from "react";

export default function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Dự phòng cho trình duyệt cũ / không có quyền clipboard.
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-[3px] border border-green-800 px-3 py-1 text-sm font-bold text-green-800 transition-colors duration-150 hover:bg-green-800 hover:text-white"
    >
      {copied ? "Đã sao chép" : label}
    </button>
  );
}
