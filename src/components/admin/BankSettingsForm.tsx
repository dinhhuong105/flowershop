// Biểu mẫu Ngân hàng & QR (Ngày 12 B2/B3): ngân hàng nhận chuyển
// khoản + mẫu nội dung + bật/tắt chuyển khoản. Kiểm tra ở máy chủ
// (Server Action): lỗi từng trường, giữ nguyên giá trị đã nhập.
// STK hiện dạng che (chỉ 4 số cuối) khi mở lại trang; nút Hiện/Ẩn
// cho xem số đầy đủ (không cần nhập lại mật khẩu — ngoài phạm vi
// đặc tả). Lưu bank bắt buộc nhập lại mật khẩu admin. Xem trước QR
// dựng ngay từ dữ liệu đang nhập (BankQrPreview).
// LƯU Ý (26/11, lỗi phát hiện khi kiểm CDP): form KHÔNG dùng native
// submit (action={dispatch}) — React reset form sau mỗi lần
// useActionState hoàn tất, làm <select> ngân hàng và checkbox bật/tắt
// mất về giá trị lúc mở trang (text input thì giữ được). Gửi bằng
// dispatch(new FormData(form)) trực tiếp thì không bị reset, mọi giá
// trị đã nhập giữ nguyên cả khi sai mật khẩu lẫn khi lưu xong.
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveBankSettingsAction } from "@/app/admin/settings/actions";
import {
  initialSettingsFormState,
  type SettingsFormState,
} from "@/lib/admin/settings-form-state";
import { BANK_NAMES, bankNameForBin } from "@/lib/bank";
import { maskAccountNumber } from "@/lib/settings";
import BankQrPreview from "@/components/admin/BankQrPreview";

const inputClass =
  "mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900";
const labelClass = "block text-sm font-semibold text-slate-900";

export default function BankSettingsForm({
  initial,
}: {
  initial: {
    bankCode: string;
    accountNumber: string;
    accountName: string;
    transferNoteTemplate: string;
    bankEnabled: boolean;
  };
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, dispatch] = useActionState<SettingsFormState, FormData>(
    saveBankSettingsAction,
    initialSettingsFormState,
  );
  // Trạng thái đang nhập (để xem trước QR trực tiếp + che STK).
  const [bankCode, setBankCode] = useState(initial.bankCode);
  const [accountNumber, setAccountNumber] = useState(initial.accountNumber);
  const [accountName, setAccountName] = useState(initial.accountName);
  const [transferNoteTemplate, setTransferNoteTemplate] = useState(initial.transferNoteTemplate);
  const [bankEnabled, setBankEnabled] = useState(initial.bankEnabled);
  const [showAccount, setShowAccount] = useState(false);

  useEffect(() => {
    if (state.ok) {
      // Máy chủ chuẩn hóa tên chủ TK thành in hoa khi lưu — đồng bộ
      // lại ô nhập để xem trước QR khớp dữ liệu đã lưu.
      setAccountName((v) => v.toUpperCase());
      router.refresh();
    }
  }, [state.ok, router]);

  const err = (field: keyof SettingsFormState["errors"]) => state.errors[field] ?? null;

  function fieldError(field: keyof SettingsFormState["errors"]) {
    const message = err(field);
    if (!message) return null;
    return (
      <p id={`${field}-error`} role="alert" className="mt-1 text-sm font-medium text-danger">
        {message}
      </p>
    );
  }

  const maskedAccount = accountNumber === "" ? "" : maskAccountNumber(accountNumber);

  // Gửi trực tiếp qua dispatch (không native submit): tránh React
  // reset form sau action, làm mất <select>/<checkbox> đã chọn.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form) return;
    if (!form.reportValidity()) return;
    dispatch(new FormData(form));
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={
            state.ok
              ? "rounded-lg border border-green-800/40 bg-green-800/5 px-4 py-3 text-sm font-medium text-green-800"
              : "rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger"
          }
        >
          {state.message}
        </p>
      ) : null}

      <section
        aria-label="Thông tin ngân hàng"
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      >
        <div>
          <label htmlFor="bk-bankCode" className={labelClass}>
            Ngân hàng
          </label>
          <select
            id="bk-bankCode"
            name="bankCode"
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            aria-invalid={err("bankCode") ? true : undefined}
            aria-describedby={err("bankCode") ? "bankCode-error" : undefined}
            className={inputClass}
          >
            <option value="">— Chọn ngân hàng —</option>
            {Object.entries(BANK_NAMES).map(([bin, name]) => (
              <option key={bin} value={bin}>
                {name}
              </option>
            ))}
          </select>
          {fieldError("bankCode")}
          <p className="mt-1 text-sm text-slate-500">
            Danh sách 14 ngân hàng đã kiểm chứng (VietQR/NAPAS). Tên hiển thị trên QR lấy theo
            mã ngân hàng.
          </p>
        </div>

        <div>
          <label htmlFor="bk-accountNumber" className={labelClass}>
            Số tài khoản
          </label>
          {/* Số thật gửi kèm ở input ẩn; ô hiện chỉ để xem/sửa (khi
              đang che thì chỉ đọc, không gõ được số đã che). */}
          <input type="hidden" name="accountNumber" value={accountNumber} />
          <div className="flex gap-2">
            <input
              id="bk-accountNumber"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={showAccount ? accountNumber : maskedAccount}
              readOnly={!showAccount}
              onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ""))}
              aria-invalid={err("accountNumber") ? true : undefined}
              aria-describedby={err("accountNumber") ? "accountNumber-error" : undefined}
              placeholder="Ví dụ: 1234567890"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              onClick={() => setShowAccount((v) => !v)}
              aria-label={showAccount ? "Ẩn số tài khoản" : "Hiện số tài khoản"}
              className="mt-1 flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition-opacity hover:opacity-80"
            >
              {showAccount ? "Ẩn" : "Hiện"}
            </button>
          </div>
          {fieldError("accountNumber")}
          <p className="mt-1 text-sm text-slate-500">
            Chỉ gồm chữ số, từ 6 đến 19 ký tự. Mở lại trang này, số tài khoản chỉ hiện 4 số
            cuối.
          </p>
        </div>

        <div>
          <label htmlFor="bk-accountName" className={labelClass}>
            Tên chủ tài khoản
          </label>
          <input
            id="bk-accountName"
            name="accountName"
            type="text"
            autoComplete="off"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            aria-invalid={err("accountName") ? true : undefined}
            aria-describedby={err("accountName") ? "accountName-error" : undefined}
            placeholder="Ví dụ: NGUYEN VAN A"
            className={inputClass}
          />
          {fieldError("accountName")}
          <p className="mt-1 text-sm text-slate-500">
            Viết hoa không dấu, chỉ chữ/số/khoảng trắng, từ 2 đến 50 ký tự (tự chuyển thành
            in hoa khi lưu).
          </p>
        </div>

        <div>
          <label htmlFor="bk-transferNoteTemplate" className={labelClass}>
            Mẫu nội dung chuyển khoản
          </label>
          <input
            id="bk-transferNoteTemplate"
            name="transferNoteTemplate"
            type="text"
            autoComplete="off"
            value={transferNoteTemplate}
            onChange={(e) => setTransferNoteTemplate(e.target.value)}
            aria-invalid={err("transferNoteTemplate") ? true : undefined}
            aria-describedby={err("transferNoteTemplate") ? "transferNoteTemplate-error" : undefined}
            placeholder="DH {ORDER_CODE}"
            className={inputClass}
          />
          {fieldError("transferNoteTemplate")}
          <p className="mt-1 text-sm text-slate-500">
            Phải chứa đúng một lần {"{ORDER_CODE}"} (mã đơn, 10 ký tự); chỉ chữ/số/khoảng
            trắng không dấu, tối đa 50 ký tự; nội dung cuối cùng tối đa 25 ký tự (giới hạn
            VietQR). Mặc định: DH {"{ORDER_CODE}"}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="bk-bankEnabled"
            name="bankEnabled"
            type="checkbox"
            checked={bankEnabled}
            onChange={(e) => setBankEnabled(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-blue-600"
          />
          <label htmlFor="bk-bankEnabled" className="text-sm font-semibold text-slate-900">
            Bật thanh toán chuyển khoản
          </label>
        </div>
        <p className="-mt-2 text-sm text-slate-500">
          Tắt thì mặt shop chỉ còn thanh toán khi nhận hàng (COD), không hiện số tài khoản demo.
        </p>
      </section>

      <BankQrPreview
        bankCode={bankCode}
        accountNumber={accountNumber}
        accountName={accountName}
        transferNoteTemplate={transferNoteTemplate}
      />

      <section
        aria-label="Xác nhận bằng mật khẩu"
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      >
        <div>
          <label htmlFor="bk-confirmPassword" className={labelClass}>
            Nhập lại mật khẩu admin để lưu
          </label>
          <input
            id="bk-confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="current-password"
            required
            placeholder="Mật khẩu đăng nhập quản trị"
            className={inputClass}
          />
          <p className="mt-1 text-sm text-slate-500">
            Thông tin ngân hàng là dữ liệu nhạy cảm nên mỗi lần lưu đều cần nhập lại mật khẩu.
            Thử sai quá 5 lần trong 15 phút sẽ bị khóa tạm cả đăng nhập.
          </p>
        </div>
      </section>

      <button
        type="submit"
        className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        Lưu thông tin ngân hàng
      </button>
      <p className="text-sm text-slate-500">
        {bankCode && bankNameForBin(bankCode)
          ? `Ngân hàng đang chọn: ${bankNameForBin(bankCode)} (${bankCode}).`
          : null}{" "}
        Sau khi lưu, mỗi lần đổi thông tin ngân hàng, shop sẽ gửi 1 tin Telegram báo cho chủ
        shop (không kèm số tài khoản).
      </p>
    </form>
  );
}
