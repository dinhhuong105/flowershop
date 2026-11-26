import type { Metadata } from "next";
import { headers } from "next/headers";
import { siteConfig } from "@/config/site";
import { getNavCategories } from "@/lib/queries";
import { getCartCount } from "@/lib/cart";
import { getSettings } from "@/lib/settings-cache";
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

// Tiêu đề/mô tả/favicon lấy từ Cài đặt shop (Ngày 11 B5): đổi tên
// trong admin thì tiêu đề tab + mô tả + favicon đổi theo. JSON-LD,
// sitemap, robots và canonical vẫn lấy từ env (siteConfig.url) theo
// đặc tả — không đổi ở đây.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: {
      default: settings.siteName,
      template: `%s | ${settings.siteName}`,
    },
    description: settings.slogan,
    metadataBase: new URL(siteConfig.url),
    openGraph: {
      title: settings.siteName,
      description: settings.slogan,
      type: "website",
      locale: "vi_VN",
    },
    ...(settings.favicon ? { icons: { icon: settings.favicon } } : {}),
  };
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
  const categories = isAdminArea ? [] : await getNavCategories();
  const cartCount = isAdminArea ? 0 : await getCartCount();
  // Cài đặt shop (Ngày 11 B5): tên/logo/hotline/Zalo/địa chỉ/giờ
  // mở cửa/mạng xã hội cho Header/Footer/TopBar/nút nổi. Khu vực
  // quản trị không cần — không đọc thừa.
  const settings = isAdminArea ? null : await getSettings();
  return (
    <html lang="vi">
      {/* Gắn class `js` để hiệu ứng reveal không giấu nội dung khi tắt JS. */}
      <script
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
        {/* Dải USP KHÔNG render ở layout nữa (F-2): trang chủ tự render
            USP dưới hero; các trang khác render USP trên footer trong
            chính page của mình. */}
        {isAdminArea || !settings ? null : (
          <>
            <Footer settings={settings} />
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
