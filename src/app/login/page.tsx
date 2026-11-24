import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession, isAdminConfigured } from "@/lib/admin/auth";
import LoginForm from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đăng nhập quản trị",
  robots: { index: false, follow: false },
};

// Trang đăng nhập quản trị (Ngày 7 §2): TÀI KHOẢN + MẬT KHẨU.
// ?error=1 → sai tài khoản/mật khẩu; ?error=rate → bị giới hạn thử;
// ?u= → giữ lại tên đăng nhập đã nhập. Đã đăng nhập rồi thì chuyển
// thẳng vào danh sách sản phẩm.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; u?: string }>;
}) {
  // Chưa cấu hình: middleware đã trả 503 trước khi tới đây; đây chỉ
  // là phòng thủ khi gọi trực tiếp.
  if (!isAdminConfigured()) {
    return (
      <div className="shell py-12">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Chưa cấu hình quản trị
        </h1>
        <p className="mt-3 text-sm text-ink-soft">
          Shop chưa đặt tài khoản quản trị (thiếu ADMIN_USERNAME hoặc
          ADMIN_PASSWORD_HASH). Vui lòng liên hệ người quản trị hệ thống.
        </p>
      </div>
    );
  }
  const session = await getAdminSession();
  if (session) redirect("/admin/orders"); // Ngày 8: đơn hàng là trang quản trị chính.
  const params = await searchParams;
  const serverError =
    params.error === "rate"
      ? "Quá nhiều lần đăng nhập sai, vui lòng thử lại sau 15 phút."
      : params.error === "1"
        ? "Tên đăng nhập hoặc mật khẩu không đúng."
        : null;
  return (
    <div className="shell py-12">
      <div className="mx-auto max-w-md rounded-[3px] border border-line bg-white p-6">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Đăng nhập quản trị
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Chỉ chủ shop đăng nhập được trang này.
        </p>
        <LoginForm initialUsername={params.u ?? ""} serverError={serverError} />
      </div>
    </div>
  );
}
