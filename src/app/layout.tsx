import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import FloatingContact from "@/components/layout/FloatingContact";
import "./globals.css";

// Layout đọc DB để lấy menu (qua Header/Footer), nên không được truy vấn
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <a
          href="#noi-dung-chinh"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
        >
          Bỏ qua tới nội dung chính
        </a>
        <TopBar />
        <Header />
        <main id="noi-dung-chinh">{children}</main>
        <Footer />
        <FloatingContact />
      </body>
    </html>
  );
}
