// Biểu mẫu Telegram (Ngày 12 D2): chat id nhận thông báo đơn +
// bật/tắt + nút Gửi thử. Token bot chỉ ở biến môi trường (Henry đặt
// trên Vercel), không bao giờ lưu vào DB hay hiện ra giao diện.
// LƯU Ý (26/11): form cài đặt gửi bằng dispatch trực tiếp (không
// native submit) — React reset form sau mỗi lần useActionState hoàn
// tất, làm checkbox bật/tắt mất về giá trị lúc mở trang (xem
// BankSettingsForm). Form Gửi thử không có ô nhập nên giữ nguyên.
"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  saveTelegramSettingsAction,
  sendTelegramTestAction,
  type TelegramTestState,
} from "@/app/admin/settings/actions";
import {
  initialSettingsFormState,
  type SettingsFormState,
} from "@/lib/admin/settings-form-state";

const inputClass =
  "mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900";
const labelClass = "block text-sm font-semibold text-slate-900";

export default function TelegramSettingsForm({
  initial,
  tokenPresent,
}: {
  initial: { telegramChatId: string; telegramEnabled: boolean };
  tokenPresent: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, dispatch] = useActionState<SettingsFormState, FormData>(
    saveTelegramSettingsAction,
    initialSettingsFormState,
  );
  const [testState, testDispatch] = useActionState<TelegramTestState, FormData>(
    sendTelegramTestAction,
    { ok: false, message: "" },
  );
  useEffect(() => {
    if (state.ok) router.refresh();
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

  // Gửi trực tiếp qua dispatch (không native submit): tránh React
  // reset form sau action, làm mất checkbox đã chọn.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form) return;
    if (!form.reportValidity()) return;
    dispatch(new FormData(form));
  }

  return (
    <div className="space-y-5">
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
          aria-label="Cài đặt Telegram"
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
        >
          <p className="text-sm text-slate-900">
            Trạng thái token bot:{" "}
            <strong>{tokenPresent ? "Đã có token" : "Chưa có token"}</strong>
            {!tokenPresent ? (
              <span className="text-slate-500">
                {" "}
                — đặt TELEGRAM_BOT_TOKEN trong biến môi trường trên Vercel (token không bao giờ
                hiện ở đây hay lưu vào cơ sở dữ liệu).
              </span>
            ) : null}
          </p>

          <div>
            <label htmlFor="tg-telegramChatId" className={labelClass}>
              Chat id nhận thông báo
            </label>
            <input
              id="tg-telegramChatId"
              name="telegramChatId"
              type="text"
              autoComplete="off"
              defaultValue={initial.telegramChatId}
              aria-invalid={err("telegramChatId") ? true : undefined}
              aria-describedby={err("telegramChatId") ? "telegramChatId-error" : undefined}
              placeholder="Ví dụ: -1001234567890 hoặc @ten-kenh"
              className={inputClass}
            />
            {fieldError("telegramChatId")}
            <p className="mt-1 text-sm text-slate-500">
              Chat id số (5–20 chữ số, có thể âm cho nhóm/kênh) hoặc @tên-kênh. Lấy chat id bằng
              cách nhắn cho bot rồi xem tin nhắn đến, hoặc dùng @userinfobot / @getmyid_bot.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="tg-telegramEnabled"
              name="telegramEnabled"
              type="checkbox"
              defaultChecked={initial.telegramEnabled}
              className="h-5 w-5 shrink-0 accent-blue-600"
            />
            <label htmlFor="tg-telegramEnabled" className="text-sm font-semibold text-slate-900">
              Bật thông báo Telegram cho đơn mới
            </label>
          </div>
          <p className="-mt-2 text-sm text-slate-500">
            Tắt thì đơn mới không gửi Telegram. Nút &ldquo;Gửi lại Telegram&rdquo; ở chi tiết đơn
            vẫn chạy khi đã cấu hình.
          </p>
        </section>

        <button
          type="submit"
          className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Lưu cài đặt Telegram
        </button>
      </form>

      <form action={testDispatch} className="space-y-3">
        {testState.message ? (
          <p
            role={testState.ok ? "status" : "alert"}
            className={
              testState.ok
                ? "rounded-lg border border-green-800/40 bg-green-800/5 px-4 py-3 text-sm font-medium text-green-800"
                : "rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger"
            }
          >
            {testState.message}
          </p>
        ) : null}
        <button
          type="submit"
          className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 transition-opacity hover:opacity-80"
        >
          Gửi thử
        </button>
        <p className="text-sm text-slate-500">
          Gửi 1 tin thử có chữ [TEST] + giờ gửi tới chat id đã lưu. Nếu chưa có token hoặc
          chưa nhập chat id, nút sẽ báo rõ lý do thay vì gửi.
        </p>
      </form>
    </div>
  );
}
