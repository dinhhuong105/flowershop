import type { Metadata } from "next";
import { headers } from "next/headers";
import { siteConfig } from "@/config/site";
import { getNavCategories } from "@/lib/queries";
import { getCartCount } from "@/lib/cart";
import { getSettings } from "@/lib/settings-cache";
import type { ShopSettings } from "@/lib/settings";
import {
  resolveTitleTemplateForNext,
  validateTitleTemplate,
} from "@/lib/title-template";
import { toAbsoluteImageUrl } from "@/lib/storage";
import { escapeJsonForScript } from "@/lib/security-headers";
import { listFooterPages } from "@/lib/admin/pages";
import { getLegacyReplacements } from "@/lib/admin/pages";
import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import FloatingContact from "@/components/layout/FloatingContact";
import BackToTop from "@/components/ui/BackToTop";
import Toast from "@/components/ui/Toast";
import "@fontsource/playfair-display/latin-600.css";
import "@fontsource/playfair-display/vietnamese-600.css";
import "./globals.css";

// Layout đọc DB để lấy menu (qua Header), nên không được truy vấn
// DB lúc `next build`.
export const dynamic = "force-dynamic";

// Tiêu đề/mô tả/favicon lấy từ Cài đặt shop (Ngày 11 B5, Ngày 13
// C3, Ngày 14 B1): đổi tên trong admin thì tiêu đề tab + mô tả +
// favicon đổi theo. Layout đọc titleTemplate, defaultDescription,
// defaultOgImage, metaKeywords, allowIndexing từ getSettings(). Mẫu
// rỗng/không hợp lệ (theo validateTitleTemplate) thì dùng lại mẫu
// mặc định — không bao giờ để tiêu đề trống. Mẫu chứa {siteName}
// được thay bằng tên shop TRƯỚC khi đưa cho Next (Next thay %s
// toàn cục nên tên shop chứa "%s" được chèn ký tự zero-width để
// không nhầm với chỗ giữ %s — xem title-template.ts). Mô tả rỗng
// thì dùng slogan (siteConfig).
// Sitemap, robots và canonical vẫn lấy từ env (siteConfig.url).
// JSON-LD Organization (chỉ field đã điền — không bịa đánh giá,
// tọa độ hay giờ mở cửa có cấu trúc) nằm trong RootLayout bên dưới.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const templateValid = validateTitleTemplate(settings.titleTemplate) === null;
  const template = templateValid
    ? resolveTitleTemplateForNext(settings.titleTemplate, settings.siteName)
    : `%s | ${siteConfig.name}`;
  const description =
    settings.defaultDescription !== ""
      ? settings.defaultDescription
      : siteConfig.description;
  const ogImage = toAbsoluteImageUrl(settings.defaultOgImage);
  return {
    title: {
      default: settings.siteName,
      template,
    },
    description,
    ...(settings.metaKeywords !== "" ? { keywords: settings.metaKeywords } : {}),
    metadataBase: new URL(siteConfig.url),
    openGraph: {
      title: settings.siteName,
      description,
      type: "website",
      locale: "vi_VN",
      ...(ogImage !== ""
        ? { images: [{ url: ogImage, width: 1200, height: 630 }] }
        : {}),
    },
    ...(settings.allowIndexing
      ? {}
      : { robots: { index: false, follow: false } }),
    ...(settings.favicon ? { icons: { icon: settings.favicon } } : {}),
  };
}

// JSON-LD Organization (Ngày 13 C3): chỉ field đã điền thật trong
// Cài đặt shop — tên, logo (URL tuyệt đối), điện thoại, địa chỉ,
// mạng xã hội (sameAs), url từ env. Không bịa đánh giá, tọa độ hay
// giờ mở cửa có cấu trúc.
function organizationJsonLd(settings: ShopSettings): Record<string, unknown> {
  const sameAs = [settings.facebook, settings.instagram, settings.tiktok].filter(
    (v) => v !== "",
  );
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.siteName,
    url: siteConfig.url,
  };
  if (settings.logo !== "") ld.logo = toAbsoluteImageUrl(settings.logo);
  if (settings.hotline !== "") ld.telephone = settings.hotline;
  if (settings.address !== "") ld.address = settings.address;
  if (sameAs.length > 0) ld.sameAs = sameAs;
  return ld;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Khu vực quản trị (Ngày 7 §2): middleware đặt header x-admin-area
  // cho /admin/* và /login — các trang này dùng layout quản trị riêng,
  // KHÔNG Header/Footer của shop và KHÔNG truy vấn giỏ. (Header này
  // do client tự gửi cũng chỉ giấu chrome shop — không phải cửa bảo
  // mật; xác thực do requireAdmin() ở từng trang/action.)
  const h = await headers();
  const isAdminArea = h.get("x-admin-area") === "1";
  // Nonce CSP do middleware sinh mỗi request (Ngày 17 S10); khi
  // chạy không qua middleware (vd test render trực tiếp) thì nonce
  // rỗng — thẻ script vẫn render (CSP khi đó không có nonce để khớp).
  const nonce = h.get("x-nonce") ?? "";
  const categories = isAdminArea ? [] : await getNavCategories();
  const cartCount = isAdminArea ? 0 : await getCartCount();
  // Cài đặt shop (Ngày 11 B5): tên/logo/hotline/Zalo/địa chỉ/giờ
  // mở cửa/mạng xã hội cho Header/Footer/TopBar/nút nổi. Khu vực
  // quản trị không cần — không đọc thừa.
  const settings = isAdminArea ? null : await getSettings();
  // Trang tĩnh cho chân trang (Ngày 13 B4): chỉ trang đã xuất bản +
  // showInFooter; khu vực quản trị không cần.
  const footerPages = isAdminArea ? [] : await listFooterPages();
  // Đường dẫn cũ đã có trang thay thế (Ngày 14 C3): Footer đổi
  // link cũ sang trang mới; khu vực quản trị không cần.
  const legacyReplacements = isAdminArea
    ? new Map<string, string>()
    : await getLegacyReplacements();
  return (
    <html lang="vi">
      {/* Gắn class `js` để hiệu ứng reveal không giấu nội dung khi tắt JS. */}
      <script
        nonce={nonce === "" ? undefined : nonce}
        dangerouslySetInnerHTML={{
          __html: "document.documentElement.classList.add('js')",
        }}
      />
      <body>
        {isAdminArea || !settings ? null : (
          <>
            <a
              href="#noi-dung-chinh"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[3px] focus:bg-green-800 focus:px-4 focus:py-2 focus:text-white"
            >
              Bỏ qua tới nội dung chính
            </a>
            <TopBar hotline={settings.hotline} />
            <Header categories={categories} cartCount={cartCount} settings={settings} />
          </>
        )}
        <main id="noi-dung-chinh">{children}</main>
        {/* JSON-LD Organization (Ngày 13 C3): chỉ khu vực shop.
            Chỉ field đã điền thật — tên, logo, điện thoại, địa chỉ,
            mạng xã hội (sameAs), url từ env. Không bịa đánh giá,
            tọa độ hay giờ mở cửa có cấu trúc. */}
        {isAdminArea || !settings ? null : (
          <script
            type="application/ld+json"
            nonce={nonce === "" ? undefined : nonce}
            dangerouslySetInnerHTML={{
              // Thoát <, > và & (Ngày 17 S3): tên shop chứa
              // "</script>" không được thoát khỏi thẻ script.
              __html: escapeJsonForScript(JSON.stringify(organizationJsonLd(settings))),
            }}
          />
        )}
        {/* Dải USP KHÔNG render ở layout nữa (F-2): trang chủ tự render
            USP dưới hero; các trang khác render USP trên footer trong
            chính page của mình. */}
        {isAdminArea || !settings ? null : (
          <>
            <Footer
              settings={settings}
              footerPages={footerPages}
              legacyReplacements={legacyReplacements}
            />
            <FloatingContact hotline={settings.hotline} zalo={settings.zalo} />
            <BackToTop />
          </>
        )}
        {/* Toast render Ở MỌI TRANG kể cả admin (Đợt 4 — 25/11):
            trước đây Toast nằm trong nhánh !isAdminArea nên trang
            quản trị không có toast nào — toast Hoàn tác Ẩn/Hiện
            (sự kiện `admin:toast`) vì thế không bao giờ hiện. C3
            (Ngày 11): toast quản trị nằm góc dưới-phải, không đè
            nút "+ Thêm sản phẩm"; mặt shop vẫn dưới header. */}
        <Toast />
      </body>
    </html>
  );
}
