import Link from "next/link";
import { siteConfig, telHref, zaloHref } from "@/config/site";
import { isBankConfiguredFromSettings } from "@/lib/bank";
import { resolveLegacyLink } from "@/lib/legacy-paths";
import type { ShopSettings } from "@/lib/settings";

// Footer (mục 4.3 phụ lục): nền green-900, 5 cột. Cột 2–4 ("Về chúng
// tôi", "Hỗ trợ khách hàng", "Chính sách") đã có trang thật từ Ngày 9
// (/about, /faq, /contact, /policy) nên link tới trang đó. Cột "Liên
// hệ" chỉ ghi field có giá trị thật trong Cài đặt shop (Ngày 11 B5:
// tên, slogan, mạng xã hội, địa chỉ, hotline, Zalo, giờ mở cửa);
// field trống thì ẩn dòng đó. Tagline vẫn lấy từ siteConfig (không
// phải trường cài đặt). Không cột newsletter, không logo
// VISA/Mastercard/MoMo/ZaloPay. Thanh dưới: © + badge COD, Chuyển khoản.
//
// Ngày 13 B4, Ngày 14: thêm cột "Trang tĩnh" liệt kê trang đã xuất
// bản + showInFooter (theo sortOrder) — chỉ hiện khi có ít nhất một
// trang. Trang tĩnh ở slug gốc (bỏ /trang theo lệnh Henry 26/11).
// Các mục footer cũ giữ nguyên (không tự gỡ /policy hay các link cũ
// khi có trang thay thế — việc thay thế do Henry quyết từng trang;
// không để link chết vì /policy vẫn tồn tại).
export default function Footer({
  settings,
  footerPages = [],
  legacyReplacements = new Map(),
}: {
  settings: ShopSettings;
  footerPages?: Array<{ slug: string; title: string }>;
  // Đường dẫn cũ → slug trang mới đã xuất bản (Ngày 14 C3).
  legacyReplacements?: ReadonlyMap<string, string>;
}) {
  const year = new Date().getFullYear();
  // Link cũ trỏ sang trang tĩnh thay thế khi có; mục cũ bị ẩn khi
  // đích của nó trùng URL trang tĩnh trong cột "Trang tĩnh" (tránh
  // hai link khác nhau cùng dẫn tới một trang).
  const footerUrls = new Set(footerPages.map((p) => `/${p.slug}`));
  const legacyHref = (path: string) =>
    resolveLegacyLink(path, legacyReplacements);
  const showLegacy = (path: string) => !footerUrls.has(legacyHref(path));
  const hasContact =
    settings.address || settings.hotline || settings.zalo || settings.openHours;
  const socialLinks = [
    { href: settings.facebook, label: "Facebook" },
    { href: settings.instagram, label: "Instagram" },
    { href: settings.tiktok, label: "TikTok" },
  ].filter((s) => s.href !== "");
  return (
    <footer className="bg-green-900 text-white">
      <div
        className={`shell grid gap-10 py-12 sm:grid-cols-2 ${
          footerPages.length > 0 ? "lg:grid-cols-6" : "lg:grid-cols-5"
        }`}
      >
        <div>
          <p className="font-display text-xl font-semibold">{settings.siteName}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-gold-300">
            {siteConfig.tagline}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            {settings.slogan}
          </p>
          {socialLinks.length > 0 ? (
            <ul className="mt-4 flex gap-2">
              {socialLinks.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 text-sm font-bold text-white transition-colors duration-150 hover:border-gold-300 hover:text-gold-300"
                  >
                    {s.label.slice(0, 1)}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {showLegacy("/about") || showLegacy("/faq") ? (
          <nav aria-label="Về chúng tôi">
            <p className="font-semibold">Về chúng tôi</p>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              {showLegacy("/about") ? (
                <li>
                  <Link href={legacyHref("/about")} className="hover:text-white hover:underline">
                    Giới thiệu
                  </Link>
                </li>
              ) : null}
              {showLegacy("/faq") ? (
                <li>
                  <Link href={legacyHref("/faq")} className="hover:text-white hover:underline">
                    Câu hỏi thường gặp
                  </Link>
                </li>
              ) : null}
            </ul>
          </nav>
        ) : null}
        {showLegacy("/faq") || showLegacy("/contact") ? (
          <nav aria-label="Hỗ trợ khách hàng">
            <p className="font-semibold">Hỗ trợ khách hàng</p>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              {showLegacy("/faq") ? (
                <li>
                  <Link href={legacyHref("/faq")} className="hover:text-white hover:underline">
                    Câu hỏi thường gặp
                  </Link>
                </li>
              ) : null}
              {showLegacy("/contact") ? (
                <li>
                  <Link href={legacyHref("/contact")} className="hover:text-white hover:underline">
                    Liên hệ
                  </Link>
                </li>
              ) : null}
            </ul>
          </nav>
        ) : null}
        {showLegacy("/policy") ? (
          <nav aria-label="Chính sách">
            <p className="font-semibold">Chính sách</p>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              <li>
                <Link href={legacyHref("/policy")} className="hover:text-white hover:underline">
                  Chính sách giao hàng, thanh toán, đổi trả
                </Link>
              </li>
            </ul>
          </nav>
        ) : null}
        {footerPages.length > 0 ? (
          <nav aria-label="Trang tĩnh">
            <p className="font-semibold">Trang tĩnh</p>
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              {footerPages.map((page) => (
                <li key={page.slug}>
                  <Link
                    href={`/${page.slug}`}
                    className="hover:text-white hover:underline"
                  >
                    {page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div>
          <p className="font-semibold">Liên hệ</p>
          {hasContact ? (
            <ul className="mt-3 space-y-2 text-sm text-white/80">
              {settings.address ? <li>{settings.address}</li> : null}
              {settings.hotline ? (
                <li>
                  Hotline:{" "}
                  <a href={telHref(settings.hotline)} className="text-white hover:underline">
                    {settings.hotline}
                  </a>
                </li>
              ) : null}
              {settings.zalo ? (
                <li>
                  Zalo:{" "}
                  <a
                    href={zaloHref(settings.zalo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:underline"
                  >
                    {settings.zalo}
                  </a>
                </li>
              ) : null}
              {settings.openHours ? <li>Giờ mở cửa: {settings.openHours}</li> : null}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-white/70">Đang cập nhật.</p>
          )}
        </div>
      </div>
      <div className="border-t border-white/15" data-testid="footer-bottom">
        <div className="shell flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-white/70">
          <p>
            © {year} {settings.siteName}
          </p>
          <p className="flex items-center gap-2">
            <span className="rounded-[2px] border border-white/30 px-2 py-0.5 text-xs font-semibold text-white">
              COD
            </span>
            {/* H-5: huy hiệu "Chuyển khoản" chỉ hiện khi ngân hàng đã
                cấu hình trong cài đặt (B4); chưa cấu hình thì không
                nhắc tới chuyển khoản ở đâu. */}
            {isBankConfiguredFromSettings(settings) ? (
              <span className="rounded-[2px] border border-white/30 px-2 py-0.5 text-xs font-semibold text-white">
                Chuyển khoản
              </span>
            ) : null}
          </p>
        </div>
      </div>
    </footer>
  );
}
