import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { getSettings } from "@/lib/settings-cache";
import SeoSettingsForm from "@/components/admin/SeoSettingsForm";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cài đặt SEO",
  robots: { index: false, follow: false },
};

// Trang Cài đặt SEO (Ngày 13 C2): mẫu tiêu đề, mô tả mặc định,
// ảnh OG mặc định, từ khóa, cho phép lập chỉ mục. Lưu xong mặt
// shop cập nhật ngay nhờ revalidateTag("site-settings") trong
// action (C3 đọc getSettings() có cache theo tag).
export default async function AdminSeoSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://flowershop-steel.vercel.app";
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Cài đặt SEO</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        Mẫu tiêu đề, mô tả và ảnh chia sẻ mặc định cho toàn site. Trang sản phẩm,
        danh mục và trang tĩnh giữ tiêu đề riêng của chúng trong mẫu này. Tên shop
        hiện nay: {siteConfig.name}.
      </p>
      <div className="mt-6 max-w-2xl">
        <SeoSettingsForm
          initial={{
            titleTemplate: settings.titleTemplate,
            defaultDescription: settings.defaultDescription,
            defaultOgImage: settings.defaultOgImage,
            metaKeywords: settings.metaKeywords,
            allowIndexing: settings.allowIndexing,
          }}
          siteUrl={siteUrl}
          siteName={settings.siteName}
        />
      </div>
    </div>
  );
}
