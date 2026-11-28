import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { getTotpStatus } from "@/lib/admin/totp-store";
import TotpSecurityForm from "@/components/admin/TotpSecurityForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bảo mật",
  robots: { index: false, follow: false },
};

// Trang Bảo mật (Ngày 19 Phần C): bật/tắt xác thực hai bước TOTP
// cho admin, tạo lại mã khôi phục. Trang có Cache-Control: no-store
// (next.config.ts — toàn bộ /admin/*). Bí mật TOTP và mã khôi phục
// KHÔNG BAO GIỜ hiện lại sau khi bật xong (chỉ hiện một lần duy
// nhất ở đúng bước tạo ra chúng).
export default async function AdminSecurityPage() {
  await requireAdmin();
  const status = await getTotpStatus();
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Bảo mật</h1>
      <p className="mt-2 text-sm text-slate-500">
        Xác thực hai bước (TOTP) cho tài khoản quản trị: sau khi nhập đúng mật khẩu, còn phải
        nhập mã 6 số trong ứng dụng xác thực (Google Authenticator, Authy, 1Password) hoặc một
        mã khôi phục. 2FA tắt mặc định — đăng nhập không đổi cho tới khi bạn bật.
      </p>
      <div className="mt-6 max-w-2xl">
        <TotpSecurityForm
          keyAvailable={status.keyAvailable}
          keyUnavailable={status.keyUnavailable}
          enabled={status.enabled}
          enabledAt={status.enabledAt ? status.enabledAt.toISOString() : null}
          recoveryRemaining={status.recoveryRemaining}
          escapeHatchOn={status.escapeHatchOn}
        />
      </div>
    </div>
  );
}
