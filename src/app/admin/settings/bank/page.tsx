import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { getSettings } from "@/lib/settings-cache";
import BankSettingsForm from "@/components/admin/BankSettingsForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ngân hàng & QR",
  robots: { index: false, follow: false },
};

// Trang Ngân hàng & QR (Ngày 12 B2): thông tin ngân hàng nhận
// chuyển khoản + mẫu nội dung + xem trước QR từng đơn. Trang đầy
// đủ, không phải popup. Chỉ quản trị.
export default async function AdminSettingsBankPage() {
  await requireAdmin();
  const settings = await getSettings();

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Ngân hàng &amp; QR</h1>
      <p className="mt-2 text-sm text-slate-500">
        Tài khoản nhận chuyển khoản cho từng đơn (QR từng đơn: số tiền + mã đơn làm nội dung).
        Lưu xong, trang đơn hàng hiện QR mới ngay. Không gửi số tài khoản qua chat hay báo cáo.
      </p>
      <div className="mt-6 max-w-2xl">
        <BankSettingsForm
          initial={{
            bankCode: settings.bankCode,
            accountNumber: settings.accountNumber,
            accountName: settings.accountName,
            transferNoteTemplate: settings.transferNoteTemplate,
            bankEnabled: settings.bankEnabled,
          }}
        />
      </div>
    </div>
  );
}
