// Form Bảo mật /admin/security (Ngày 19 Phần C): bật/tắt 2FA TOTP,
// tạo lại mã khôi phục. QR vẽ TẠI TRÌNH DUYỆT từ URL otpauth do
// server action trả về (thư viện qrcode đã có — dùng cho VietQR;
// SVG sinh tại chỗ, không gọi dịch vụ ngoài). Bí mật + mã khôi
// phục chỉ hiện MỘT LẦN duy nhất ở đúng bước tạo ra chúng: rời
// trang hoặc bấm "Đã lưu xong" là mất (phải tạo lại mã khôi phục
// nếu chưa cất).
"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  confirmTotpSetupAction,
  disableTotpAction,
  regenerateRecoveryCodesAction,
  startTotpSetupAction,
  type TotpConfirmState,
  type TotpSimpleState,
  type TotpStartState,
} from "@/app/admin/security/actions";

const EMPTY_START: TotpStartState = { ok: false, message: "", otpauthUrl: "", manualKey: "" };
const EMPTY_CONFIRM: TotpConfirmState = { ok: false, message: "", recoveryCodes: [] };
const EMPTY_SIMPLE: TotpSimpleState = { ok: false, message: "", recoveryCodes: [] };

const inputClass =
  "mt-1 block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900";
const labelClass = "block text-sm font-semibold text-slate-900";
const buttonClass =
  "flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function StateMessage({ message, ok }: { message: string; ok: boolean }) {
  if (!message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={
        ok
          ? "rounded-lg border border-green-600/40 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
          : "rounded-lg border border-red-600/40 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
      }
    >
      {message}
    </p>
  );
}

function RecoveryCodesBox({
  codes,
  onSaved,
}: {
  codes: string[];
  onSaved: () => void;
}) {
  return (
    <section
      aria-label="Mã khôi phục"
      className="space-y-4 rounded-xl border border-amber-600/40 bg-amber-50 p-5"
    >
      <h2 className="text-base font-bold text-slate-900">Mã khôi phục — chỉ hiện một lần duy nhất</h2>
      <p className="text-sm text-slate-600">
        Cất 10 mã này ở nơi an toàn (quản lý mật khẩu hoặc giấy). Mỗi mã dùng được đúng một lần
        khi mất điện thoại. Rời trang này là không xem lại được — chưa cất thì bấm tạo lại mã
        sau.
      </p>
      <ul data-testid="totp-recovery-codes" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {codes.map((code) => (
          <li key={code}>
            <code className="block rounded-lg border border-slate-300 bg-white px-3 py-2 text-center font-mono text-base tracking-widest text-slate-900">
              {code}
            </code>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onSaved} data-testid="totp-codes-saved" className={buttonClass}>
        Tôi đã lưu 10 mã khôi phục
      </button>
    </section>
  );
}

export default function TotpSecurityForm({
  keyAvailable,
  enabled,
  enabledAt,
  recoveryRemaining,
  escapeHatchOn,
}: {
  keyAvailable: boolean;
  enabled: boolean;
  enabledAt: string | null;
  recoveryRemaining: number;
  escapeHatchOn: boolean;
}) {
  const router = useRouter();
  const [startState, startAction, startPending] = useActionState(startTotpSetupAction, EMPTY_START);
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmTotpSetupAction,
    EMPTY_CONFIRM,
  );
  const [disableState, disableAction, disablePending] = useActionState(
    disableTotpAction,
    EMPTY_SIMPLE,
  );
  const [regenState, regenAction, regenPending] = useActionState(
    regenerateRecoveryCodesAction,
    EMPTY_SIMPLE,
  );
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [codesAcknowledged, setCodesAcknowledged] = useState(false);

  useEffect(() => {
    if (!startState.otpauthUrl) {
      setQrSvg(null);
      setQrError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const svg = await QRCode.toString(startState.otpauthUrl, {
          type: "svg",
          margin: 1,
          width: 240,
        });
        if (!cancelled) {
          setQrSvg(svg);
          setQrError(null);
        }
      } catch {
        if (!cancelled) {
          setQrSvg(null);
          setQrError("Không vẽ được mã QR, dùng khóa nhập tay bên dưới.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startState.otpauthUrl]);

  const confirmCodes = confirmState.ok && !codesAcknowledged ? confirmState.recoveryCodes : [];
  const regenCodes = regenState.ok && !codesAcknowledged ? regenState.recoveryCodes : [];

  // Sau khi tắt 2FA thành công, tải lại dữ liệu trang để trạng thái
  // hiện "Chưa bật" + nút bắt đầu bật lại (props server không tự
  // đổi sau khi action xong).
  useEffect(() => {
    if (disableState.ok) router.refresh();
  }, [disableState.ok, router]);

  function acknowledgeCodes() {
    setCodesAcknowledged(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section
        aria-label="Trạng thái xác thực hai bước"
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <p data-testid="totp-status" className="text-sm font-semibold text-slate-900">
          {enabled ? "Đang bật" : "Chưa bật"}
          {enabled && enabledAt
            ? ` — từ ${new Date(enabledAt).toLocaleString("vi-VN")}`
            : ""}
          {enabled ? ` · còn ${recoveryRemaining} mã khôi phục` : ""}
        </p>
        {!keyAvailable ? (
          <p role="alert" className="mt-3 text-sm font-medium text-red-700">
            Chưa cấu hình khóa mã hóa (AUTH_ENCRYPTION_KEY) nên tính năng 2FA đang tắt. Đăng nhập
            vẫn chỉ cần mật khẩu. Đặt khóa trong biến môi trường (xem hướng dẫn vận hành) rồi
            tải lại trang.
          </p>
        ) : null}
        {escapeHatchOn && enabled ? (
          <p role="alert" className="mt-3 text-sm font-medium text-amber-700">
            Đang tạm vô hiệu bước TOTP bằng biến môi trường ADMIN_TOTP_DISABLE=1 (thoát hiểm).
            Đăng nhập hiện chỉ cần mật khẩu; mỗi lần dùng đều ghi nhật ký. Gỡ biến này để bật
            lại bước TOTP.
          </p>
        ) : null}
      </section>

      {keyAvailable && !enabled ? (
        <>
          <form action={startAction}>
            <StateMessage message={startState.message} ok={startState.ok} />
            <button
              type="submit"
              disabled={startPending || startState.ok}
              data-testid="totp-start"
              className={`${buttonClass} mt-3`}
            >
              {startState.ok ? "Đã tạo mã QR bên dưới" : "Bắt đầu bật xác thực hai bước"}
            </button>
          </form>

          {startState.ok ? (
            <section
              aria-label="Quét mã QR để bật 2FA"
              className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
            >
              <h2 className="text-base font-bold text-slate-900">Bước 1 — Quét mã QR</h2>
              <p className="text-sm text-slate-600">
                Mở ứng dụng xác thực (Google Authenticator, Authy, 1Password), quét mã dưới đây
                hoặc nhập tay khóa bên dưới. Xong thì nhập mã 6 số vừa hiện trong ứng dụng để
                xác nhận.
              </p>
              {qrError ? (
                <p role="alert" className="text-sm font-medium text-red-700">
                  {qrError}
                </p>
              ) : qrSvg ? (
                <div
                  data-testid="totp-qr"
                  className="w-60 [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <p className="text-sm text-slate-500">Đang vẽ mã QR…</p>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900">Khóa nhập tay:</p>
                <code
                  data-testid="totp-manual-key"
                  className="mt-1 block break-all rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-base tracking-widest text-slate-900"
                >
                  {startState.manualKey}
                </code>
              </div>
              <form action={confirmAction} className="space-y-4">
                <div>
                  <label htmlFor="totp-confirm-code" className={labelClass}>
                    Bước 2 — Nhập mã 6 số trong ứng dụng để xác nhận
                  </label>
                  <input
                    id="totp-confirm-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={6}
                    placeholder="123456"
                    className={inputClass}
                  />
                </div>
                <StateMessage message={confirmState.message} ok={confirmState.ok} />
                <button
                  type="submit"
                  disabled={confirmPending || confirmState.ok}
                  data-testid="totp-confirm"
                  className={buttonClass}
                >
                  {confirmState.ok ? "Đã bật" : "Xác nhận và bật 2FA"}
                </button>
              </form>
            </section>
          ) : null}

          {confirmCodes.length > 0 ? (
            <RecoveryCodesBox codes={confirmCodes} onSaved={acknowledgeCodes} />
          ) : null}
        </>
      ) : null}

      {keyAvailable && enabled ? (
        <>
          <section
            aria-label="Tạo lại mã khôi phục"
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="text-base font-bold text-slate-900">Tạo lại mã khôi phục</h2>
            <p className="text-sm text-slate-600">
              10 mã mới thay thế toàn bộ mã cũ (mã cũ hết hiệu lực ngay). Cần nhập lại mật khẩu
              và mã xác thực hiện tại.
            </p>
            <form action={regenAction} className="space-y-4">
              <div>
                <label htmlFor="totp-regen-password" className={labelClass}>
                  Mật khẩu admin
                </label>
                <input
                  id="totp-regen-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="totp-regen-code" className={labelClass}>
                  Mã xác thực hiện tại (6 số hoặc một mã khôi phục còn hiệu lực)
                </label>
                <input
                  id="totp-regen-code"
                  name="code"
                  type="text"
                  inputMode="text"
                  autoComplete="one-time-code"
                  required
                  maxLength={11}
                  className={inputClass}
                />
              </div>
              <StateMessage message={regenState.message} ok={regenState.ok} />
              <button
                type="submit"
                disabled={regenPending}
                data-testid="totp-regen"
                className={buttonClass}
              >
                Tạo lại 10 mã khôi phục
              </button>
            </form>
          </section>

          {regenCodes.length > 0 ? (
            <RecoveryCodesBox codes={regenCodes} onSaved={acknowledgeCodes} />
          ) : null}

          <section
            aria-label="Tắt xác thực hai bước"
            className="space-y-4 rounded-xl border border-red-600/40 bg-white p-5"
          >
            <h2 className="text-base font-bold text-slate-900">Tắt xác thực hai bước</h2>
            <p className="text-sm text-slate-600">
              Đăng nhập sẽ chỉ còn cần mật khẩu. Cần nhập lại mật khẩu và mã xác thực hiện tại.
              Tắt 2FA sẽ buộc đăng nhập lại mọi phiên khác.
            </p>
            <form action={disableAction} className="space-y-4">
              <div>
                <label htmlFor="totp-disable-password" className={labelClass}>
                  Mật khẩu admin
                </label>
                <input
                  id="totp-disable-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="totp-disable-code" className={labelClass}>
                  Mã xác thực hiện tại (6 số hoặc một mã khôi phục còn hiệu lực)
                </label>
                <input
                  id="totp-disable-code"
                  name="code"
                  type="text"
                  inputMode="text"
                  autoComplete="one-time-code"
                  required
                  maxLength={11}
                  className={inputClass}
                />
              </div>
              <StateMessage message={disableState.message} ok={disableState.ok} />
              <button
                type="submit"
                disabled={disablePending}
                data-testid="totp-disable"
                className="flex min-h-11 items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Tắt xác thực hai bước
              </button>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}
