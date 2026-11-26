import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { getSettings } from "@/lib/settings-cache";
import { getStorageStatus } from "@/lib/storage";
import GeneralSettingsForm from "@/components/admin/GeneralSettingsForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cài đặt chung",
  robots: { index: false, follow: false },
};

// Trang Cài đặt chung (Ngày 11 B3): tên website, slogan, logo,
// favicon. Trang đầy đủ, không phải popup. Chỉ quản trị.
export default async function AdminSettingsGeneralPage() {
  await requireAdmin();
  const settings = await getSettings();
  // A2 (Ngày 12): đang ở Vercel mà chưa có token Blob thì hiện cảnh
  // báo vàng — tải ảnh sẽ lỗi "Chưa cấu hình nơi lưu ảnh (Blob)".
  const storage = getStorageStatus();

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Cài đặt chung</h1>
      <p className="mt-2 text-sm text-slate-500">
        Tên website, slogan, logo và favicon hiện trên mặt shop. Lưu xong mặt shop cập nhật
        ngay.
      </p>
      {storage.kind === "unconfigured" ? (
        <p
          role="alert"
          className="mt-4 max-w-2xl rounded-lg border border-yellow-600/40 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800"
        >
          Chưa cấu hình nơi lưu ảnh (Blob): ảnh tải lên sẽ không lưu được. Tạo Blob store trong
          Vercel (Storage → Create → Blob) rồi triển khai lại để kích hoạt.
        </p>
      ) : null}
      <div className="mt-6 max-w-2xl">
        <GeneralSettingsForm
          initial={{
            siteName: settings.siteName,
            slogan: settings.slogan,
            logo: settings.logo,
            favicon: settings.favicon,
          }}
        />
      </div>
    </div>
  );
}
