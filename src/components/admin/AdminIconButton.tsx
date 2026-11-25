// Nút icon dùng chung cho admin (icon actions + tooltip, 25/11 —
// Henry duyệt: mọi nút thao tác trong admin chỉ hiện icon, hover
// thì hiện tooltip). Mỗi nút chỉ có icon; tooltip hiện khi hover
// hoặc focus, mang cùng nội dung với aria-label. KHÔNG dùng
// thuộc tính title (sẽ hiện 2 tooltip chồng nhau: tooltip của
// trình duyệt + tooltip tự làm).
// Tooltip đặt phía trên nút; ở cột Thao tác (cột cuối bảng) dùng
// align="right" để tooltip không tràn khỏi mép phải của bảng
// (bảng có overflow-x-auto nên nội dung tràn sẽ bị cắt).
// Wrapper <span> mang class group: nút disabled không nhận sự
// kiện chuột, nhưng hover trên wrapper vẫn hiện được tooltip
// (vd: nút gửi Telegram khi chưa cấu hình).
// Nút vẫn cao/rộng tối thiểu 44 px (chuẩn chạm). Icon vẽ tay
// theo đúng kiểu icon menu trong AdminNav (viewBox 24, stroke
// currentColor, nét 2, đầu tròn). Không thêm thư viện icon.

import Link from "next/link";
import type { ReactNode } from "react";

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function Icon({ children }: { children: ReactNode }) {
  return <svg {...ICON_PROPS}>{children}</svg>;
}

export const EyeIcon = (
  <Icon>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const EyeOffIcon = (
  <Icon>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </Icon>
);

export const PencilIcon = (
  <Icon>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </Icon>
);

export const ArrowRightIcon = (
  <Icon>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </Icon>
);

export const TrashIcon = (
  <Icon>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Icon>
);

export const BanknoteIcon = (
  <Icon>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M6 12h.01M18 12h.01" />
  </Icon>
);

export const SendIcon = (
  <Icon>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </Icon>
);

export const PrinterIcon = (
  <Icon>
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </Icon>
);

export default function AdminIconButton({
  label,
  icon,
  className = "",
  href,
  type = "button",
  disabled = false,
  onClick,
  tooltipAlign = "center",
}: {
  label: string;
  icon: ReactNode;
  className?: string;
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  tooltipAlign?: "center" | "right";
}) {
  const tooltipPosition =
    tooltipAlign === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  const innerClass = `flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors ${className}`;
  const tooltip = (
    <span
      role="tooltip"
      className={`pointer-events-none invisible absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-md bg-[#0f1e33] px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${tooltipPosition}`}
    >
      {label}
    </span>
  );
  if (href) {
    return (
      <span className="group relative inline-flex">
        <Link href={href} aria-label={label} className={innerClass}>
          {icon}
        </Link>
        {tooltip}
      </span>
    );
  }
  return (
    <span className="group relative inline-flex">
      <button
        type={type}
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        className={innerClass}
      >
        {icon}
      </button>
      {tooltip}
    </span>
  );
}
