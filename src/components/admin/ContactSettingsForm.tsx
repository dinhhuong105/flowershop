// Biểu mẫu Liên hệ (Ngày 11 B3): hotline, Zalo, email, địa chỉ,
// giờ mở cửa, mạng xã hội. Kiểm tra ở máy chủ (Server Action):
// lỗi từng trường, giữ nguyên giá trị đã nhập (useActionState +
// defaultValue). Trường nào để trống thì mặt shop ẩn dòng đó
// (không hiện "Đang cập nhật."). Lưu xong hiện thông báo thành
// công và tải lại dữ liệu trang.
"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  saveContactSettingsAction,
} from "@/app/admin/settings/actions";
import {
  initialSettingsFormState,
  type SettingsFormState,
} from "@/lib/admin/settings-form-state";

const inputClass =
  "mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900";
const labelClass = "block text-sm font-semibold text-slate-900";

export default function ContactSettingsForm({
  initial,
}: {
  initial: {
    hotline: string;
    zalo: string;
    email: string;
    address: string;
    openHours: string;
    facebook: string;
    instagram: string;
    tiktok: string;
  };
}) {
  const router = useRouter();
  const [state, dispatch] = useActionState<SettingsFormState, FormData>(
    saveContactSettingsAction,
    initialSettingsFormState,
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

  function textField(
    field: keyof SettingsFormState["errors"],
    id: string,
    label: string,
    value: string,
    opts?: { type?: string; placeholder?: string; hint?: string; required?: boolean },
  ) {
    return (
      <div>
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        <input
          id={id}
          name={field}
          type={opts?.type ?? "text"}
          required={opts?.required}
          defaultValue={value}
          placeholder={opts?.placeholder}
          aria-invalid={err(field) ? true : undefined}
          aria-describedby={err(field) ? `${field}-error` : undefined}
          className={inputClass}
        />
        {fieldError(field)}
        {opts?.hint ? <p className="mt-1 text-sm text-slate-500">{opts.hint}</p> : null}
      </div>
    );
  }

  return (
    <form action={dispatch} className="space-y-5">
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
        aria-label="Thông tin liên hệ"
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      >
        {textField("hotline", "cs-hotline", "Hotline", initial.hotline, {
          type: "tel",
          placeholder: "vd 0901234567",
          hint: "Số điện thoại Việt Nam. Hiện ở đầu trang, chân trang, nút gọi nổi và trang Liên hệ; để trống thì ẩn.",
        })}
        {textField("zalo", "cs-zalo", "Zalo", initial.zalo, {
          type: "tel",
          placeholder: "vd 0901234567",
          hint: "Số điện thoại Zalo. Hiện ở chân trang, nút Zalo nổi và trang Liên hệ; để trống thì ẩn.",
        })}
        {textField("email", "cs-email", "Email", initial.email, {
          type: "email",
          placeholder: "vd lienhe@shophoa.vn",
          hint: "Hiện ở trang Liên hệ; để trống thì ẩn.",
        })}
        {textField("address", "cs-address", "Địa chỉ", initial.address, {
          placeholder: "vd 123 Đường Hoa, Quận 1, TP. Hồ Chí Minh",
          hint: "Hiện ở chân trang và trang Liên hệ; để trống thì ẩn.",
        })}
        {textField("openHours", "cs-openHours", "Giờ mở cửa", initial.openHours, {
          hint: "Hiện ở chân trang và trang Liên hệ; để trống thì ẩn.",
        })}
        {textField("facebook", "cs-facebook", "Facebook", initial.facebook, {
          type: "url",
          placeholder: "https://www.facebook.com/shophoa",
          hint: "Đường dẫn đầy đủ bắt đầu bằng https://. Hiện biểu tượng ở chân trang; để trống thì ẩn.",
        })}
        {textField("instagram", "cs-instagram", "Instagram", initial.instagram, {
          type: "url",
          placeholder: "https://www.instagram.com/shophoa",
          hint: "Đường dẫn đầy đủ bắt đầu bằng https://. Hiện biểu tượng ở chân trang; để trống thì ẩn.",
        })}
        {textField("tiktok", "cs-tiktok", "TikTok", initial.tiktok, {
          type: "url",
          placeholder: "https://www.tiktok.com/@shophoa",
          hint: "Đường dẫn đầy đủ bắt đầu bằng https://. Hiện biểu tượng ở chân trang; để trống thì ẩn.",
        })}
      </section>

      <button
        type="submit"
        className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        Lưu thông tin liên hệ
      </button>
    </form>
  );
}
