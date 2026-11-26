import { telHref, zaloHref } from "@/config/site";

// Nút nổi Gọi/Zalo (mục 3.3 phụ lục): hover nở ra hiện nhãn, vòng sóng
// tỏa tối đa 3 lần sau khi tải trang rồi dừng. Hiện KHÔNG render gì vì
// chưa có số điện thoại thật trong Cài đặt shop (số 0900000000 trong
// .env mẫu là số giữ chỗ, đã bị lọc ở site.ts) — gắn tel:/zalo.me tới
// số giả sẽ là "ô chết". Khi Henry cung cấp số thật, component này tự
// hiện lại. Hotline/Zalo lấy từ Cài đặt shop (Ngày 11 B5) qua prop.
export default function FloatingContact({
  hotline,
  zalo,
}: {
  hotline: string;
  zalo: string;
}) {
  if (!hotline && !zalo) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
      {hotline ? (
        <a
          href={telHref(hotline)}
          aria-label="Gọi cho shop"
          className="group relative flex h-12 items-center justify-center rounded-full bg-green-800 text-white shadow-lg transition-all duration-200 hover:bg-green-700"
        >
          <span
            aria-hidden="true"
            className="animate-ripple-ring absolute inset-0 rounded-full bg-green-800"
          />
          <span className="relative flex h-12 w-12 items-center justify-center">
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
          </span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-200 group-hover:max-w-24 group-hover:pr-4">
            Gọi
          </span>
        </a>
      ) : null}
      {zalo ? (
        <a
          href={zaloHref(zalo)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Nhắn Zalo cho shop"
          className="group relative flex h-12 items-center justify-center rounded-full bg-[#0068ff] text-white shadow-lg transition-all duration-200 hover:opacity-90"
        >
          <span className="relative flex h-12 w-12 items-center justify-center text-xs font-bold">
            Zalo
          </span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-200 group-hover:max-w-24 group-hover:pr-4">
            Zalo
          </span>
        </a>
      ) : null}
    </div>
  );
}
