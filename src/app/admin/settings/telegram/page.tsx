import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { getSettings } from "@/lib/settings-cache";
import { getTelegramToken } from "@/lib/telegram";
import TelegramSettingsForm from "@/components/admin/TelegramSettingsForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Telegram",
  robots: { index: false, follow: false },
};

// Trang Telegram (Ngày 12 D2): chat id + bật/tắt + gửi thử. Token
// bot chỉ ở biến môi trường — trang này chỉ báo có/chưa, không
// hiện token. Trang đầy đủ, không phải popup. Chỉ quản trị.
export default async function AdminSettingsTelegramPage() {
  await requireAdmin();
  const settings = await getSettings();
  const tokenPresent = getTelegramToken() !== "";

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Telegram</h1>
      <p className="mt-2 text-sm text-slate-500">
        Nơi nhận thông báo đơn mới và báo đổi thông tin ngân hàng. Token bot do Henry đặt trong
        biến môi trường trên Vercel, không lưu vào cơ sở dữ liệu.
      </p>
      <div className="mt-6 max-w-2xl">
        <TelegramSettingsForm
          initial={{
            telegramChatId: settings.telegramChatId,
            telegramEnabled: settings.telegramEnabled,
          }}
          tokenPresent={tokenPresent}
        />
      </div>
    </div>
  );
}
