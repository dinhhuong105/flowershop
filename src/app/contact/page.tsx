import type { Metadata } from "next";
import Link from "next/link";
import { telHref, zaloHref } from "@/config/site";
import { getSettings } from "@/lib/settings-cache";
import { redirectIfReplaced } from "@/lib/legacy-redirect";
import { getLegacyReplacements } from "@/lib/admin/pages";
import { resolveLegacyLink } from "@/lib/legacy-paths";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Chuyển vĩnh viễn sang trang tĩnh thay thế khi Henry đã xuất bản
// (Ngày 14 C2); chưa thay thì hiện trang cũ như thường.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  await redirectIfReplaced("/contact", await searchParams);
  return {
    title: "Liên hệ",
    description:
      "Liên hệ Hoa Tươi Demo — số điện thoại, Zalo, địa chỉ và giờ mở cửa.",
  };
}

// Trang liên hệ (Ngày 9, lộ trình gốc; Ngày 11 B5: đọc từ Cài đặt
// shop). Trường nào trống thì ẩn dòng đó — không hiện "Đang cập
// nhật." từng dòng, không gắn tel:/zalo.me tới số giả. Khi TẤT CẢ
// đều trống mới hiện một dòng "Đang cập nhật." chung.
export default async function ContactPage({ searchParams }: Props) {
  await redirectIfReplaced("/contact", await searchParams);
  const settings = await getSettings();
  // Link nội bộ trỏ sang trang tĩnh thay thế khi có (Ngày 14 C3).
  const faqHref = resolveLegacyLink("/faq", await getLegacyReplacements());
  const rows = [
    settings.hotline
      ? {
          label: "Hotline",
          node: (
            <a href={telHref(settings.hotline)} className="font-bold text-green-800 hover:underline">
              {settings.hotline}
            </a>
          ),
        }
      : null,
    settings.zalo
      ? {
          label: "Zalo",
          node: (
            <a
              href={zaloHref(settings.zalo)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-green-800 hover:underline"
            >
              {settings.zalo}
            </a>
          ),
        }
      : null,
    settings.email
      ? {
          label: "Email",
          node: (
            <a href={`mailto:${settings.email}`} className="font-bold text-green-800 hover:underline">
              {settings.email}
            </a>
          ),
        }
      : null,
    settings.address ? { label: "Địa chỉ cửa hàng", node: settings.address } : null,
    settings.openHours ? { label: "Giờ mở cửa", node: settings.openHours } : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <div className="shell pb-12 pt-6">
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
        Liên hệ
      </h1>

      <div className="mt-6 max-w-3xl space-y-6 text-sm leading-relaxed text-ink-soft sm:text-base">
        {rows.length > 0 ? (
          <dl className="space-y-3">
            {rows.map((row) => (
              <div key={row.label} className="flex flex-wrap gap-2">
                <dt className="font-semibold text-ink">{row.label}:</dt>
                <dd>{row.node}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Đang cập nhật.</p>
        )}

        <p>
          Để kiểm tra đơn hàng đã đặt, mở trang đơn theo mã đơn của bạn
          (địa chỉ dạng /order/MÃĐƠN). Câu hỏi thường gặp xem ở trang{" "}
          <Link href={faqHref} className="font-bold text-green-800 hover:underline">
            Câu hỏi thường gặp
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
