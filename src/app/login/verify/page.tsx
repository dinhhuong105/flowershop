import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminPendingSession, getAdminSession, isAdminConfigured } from "@/lib/admin/auth";
import VerifyForm from "@/components/admin/VerifyForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Xác minh hai bước",
  robots: { index: false, follow: false },
};

// Màn nhập mã TOTP / mã khôi phục (Ngày 19 Phần C): chỉ tới được
// khi đang có phiên "chờ xác minh" (đăng nhập đúng mật khẩu nhưng
// chưa nhập mã). Đã có phiên đầy đủ thì vào thẳng /admin; không có
// phiên chờ thì về /login đăng nhập lại từ đầu.
// ?error=1 → mã sai; ?error=rate → bị giới hạn thử; ?error=expired
// → phiên chờ đã hết hạn (trang này tự redirect về /login nên mã
// này chỉ dùng khi route verify redirect thẳng về /login).
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isAdminConfigured()) redirect("/login");
  const session = await getAdminSession();
  if (session) redirect("/admin");
  const pending = await getAdminPendingSession();
  if (!pending) redirect("/login");
  const params = await searchParams;
  const serverError =
    params.error === "rate"
      ? "Quá nhiều lần thử sai, vui lòng thử lại sau 15 phút."
      : params.error === "1"
        ? "Mã xác thực không đúng."
        : null;
  return (
    <div className="shell py-12">
      <div className="mx-auto max-w-md rounded-[3px] border border-line bg-white p-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Xác minh hai bước</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Nhập mã 6 số trong ứng dụng xác thực (Google Authenticator, Authy, 1Password) hoặc
          một mã khôi phục đã lưu khi bật 2FA. Mã chỉ có hiệu lực trong vài chục giây.
        </p>
        <VerifyForm serverError={serverError} />
        <p className="mt-4 text-sm text-ink-soft">
          Mất điện thoại và mã khôi phục? Liên hệ chủ shop để tạm tắt bước này, rồi đăng nhập lại.
        </p>
      </div>
    </div>
  );
}
