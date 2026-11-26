import { siteConfig } from "@/config/site";
import { isBankConfiguredFromSettings } from "@/lib/bank";
import { getSettings } from "@/lib/settings-cache";

function UspIcon({ icon }: { icon: string }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  } as const;
  if (icon === "truck") {
    return (
      <svg {...common}>
        <path d="M1 8h13v8H1z" />
        <path d="M14 11h4l3 3v2h-7" />
        <circle cx="6" cy="18" r="1.8" />
        <circle cx="17" cy="18" r="1.8" />
      </svg>
    );
  }
  if (icon === "flower") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.5" />
        <circle cx="12" cy="16" r="3.5" />
        <circle cx="8" cy="12" r="3.5" />
        <circle cx="16" cy="12" r="3.5" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (icon === "chat") {
    return (
      <svg {...common}>
        <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" />
        <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

// Dải USP 4 mục (mục 4.3 phụ lục), nội dung từ siteConfig.usp.
// H-5: câu "…hoặc chuyển khoản" ở mục "Thanh toán an toàn" chỉ hiện
// khi ngân hàng đã cấu hình trong cài đặt (B4); chưa cấu hình thì
// chỉ nhắc thanh toán khi nhận hàng (nhận biết mục thanh toán qua
// icon "shield").
export default async function UspStrip() {
  const settings = await getSettings();
  const bankConfigured = isBankConfiguredFromSettings(settings);
  return (
    <section aria-label="Lợi ích khi mua hoa" data-testid="usp-strip" className="border-b border-line bg-cream-100">
      <div className="shell grid grid-cols-1 gap-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
        {siteConfig.usp.map((item) => (
          <div key={item.title} className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-gold-500">
              <UspIcon icon={item.icon} />
            </span>
            <span>
              <span className="block font-semibold text-ink">{item.title}</span>
              <span className="mt-0.5 block text-sm leading-relaxed text-muted">
                {!bankConfigured && item.icon === "shield"
                  ? "Thanh toán khi nhận hàng."
                  : item.text}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
