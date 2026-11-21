import { siteConfig, telHref, zaloHref } from "@/config/site";

export default function FloatingContact() {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
      <a
        href={telHref(siteConfig.hotline)}
        aria-label="Gọi cho shop"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-colors hover:bg-brand-hover"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9Z" />
        </svg>
      </a>
      <a
        href={zaloHref(siteConfig.zaloPhone)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Nhắn Zalo cho shop"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0068ff] text-xs font-bold text-white shadow-lg transition-opacity hover:opacity-90"
      >
        Zalo
      </a>
    </div>
  );
}
