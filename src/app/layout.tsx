import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { getNavCategories } from "@/lib/queries";
import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import UspStrip from "@/components/layout/UspStrip";
import Footer from "@/components/layout/Footer";
import FloatingContact from "@/components/layout/FloatingContact";
import BackToTop from "@/components/ui/BackToTop";
import "@fontsource/playfair-display/latin-600.css";
import "@fontsource/playfair-display/vietnamese-600.css";
import "./globals.css";

// Layout đọc DB để lấy menu (qua Header), nên không được truy vấn
// DB lúc `next build`.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    type: "website",
    locale: "vi_VN",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories = await getNavCategories();
  return (
    <html lang="vi">
      {/* Gắn class `js` để hiệu ứng reveal không giấu nội dung khi tắt JS. */}
      <script
        dangerouslySetInnerHTML={{
          __html: "document.documentElement.classList.add('js')",
        }}
      />
      <body>
        <a
          href="#noi-dung-chinh"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[3px] focus:bg-green-800 focus:px-4 focus:py-2 focus:text-white"
        >
          Bỏ qua tới nội dung chính
        </a>
        <TopBar />
        <Header categories={categories} />
        <main id="noi-dung-chinh">{children}</main>
        <UspStrip />
        <Footer />
        <FloatingContact />
        <BackToTop />
      </body>
    </html>
  );
}
