import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { getSettings } from "@/lib/settings-cache";
import ContactSettingsForm from "@/components/admin/ContactSettingsForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Liên hệ",
  robots: { index: false, follow: false },
};

// Trang Liên hệ (Ngày 11 B3): hotline, Zalo, email, địa chỉ, giờ mở
// cửa, mạng xã hội. Trang đầy đủ, không phải popup. Chỉ quản trị.
// Trường nào để trống thì mặt shop ẩn dòng đó.
export default async function AdminSettingsContactPage() {
  await requireAdmin();
  const settings = await getSettings();

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Liên hệ</h1>
      <p className="mt-2 text-sm text-slate-500">
        Hotline, Zalo, email, địa chỉ, giờ mở cửa và mạng xã hội hiện trên mặt shop. Trường
        nào để trống thì mặt shop ẩn dòng đó.
      </p>
      <div className="mt-6 max-w-2xl">
        <ContactSettingsForm
          initial={{
            hotline: settings.hotline,
            zalo: settings.zalo,
            email: settings.email,
            address: settings.address,
            openHours: settings.openHours,
            facebook: settings.facebook,
            instagram: settings.instagram,
            tiktok: settings.tiktok,
          }}
        />
      </div>
    </div>
  );
}
