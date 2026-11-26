// Biểu mẫu Cài đặt chung (Ngày 11 B3): tên website, slogan, logo,
// favicon. Kiểm tra ở máy chủ (Server Action): lỗi từng trường,
// giữ nguyên giá trị đã nhập (useActionState + defaultValue).
// Lưu xong hiện thông báo thành công và tải lại dữ liệu trang.
"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  saveGeneralSettingsAction,
} from "@/app/admin/settings/actions";
import {
  initialSettingsFormState,
  type SettingsFormState,
} from "@/lib/admin/settings-form-state";
import SettingsImageField from "@/components/admin/SettingsImageField";

const inputClass =
  "mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900";
const labelClass = "block text-sm font-semibold text-slate-900";

export default function GeneralSettingsForm({
  initial,
}: {
  initial: { siteName: string; slogan: string; logo: string; favicon: string };
}) {
  const router = useRouter();
  const [state, dispatch] = useActionState<SettingsFormState, FormData>(
    saveGeneralSettingsAction,
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
        aria-label="Thông tin chung"
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      >
        <div>
          <label htmlFor="gs-siteName" className={labelClass}>
            Tên website
          </label>
          <input
            id="gs-siteName"
            name="siteName"
            type="text"
            required
            defaultValue={initial.siteName}
            aria-invalid={err("siteName") ? true : undefined}
            aria-describedby={err("siteName") ? "siteName-error" : undefined}
            className={inputClass}
          />
          {fieldError("siteName")}
          <p className="mt-1 text-sm text-slate-500">
            Hiện ở tiêu đề trang, đầu trang (header) và chân trang (footer).
          </p>
        </div>

        <div>
          <label htmlFor="gs-slogan" className={labelClass}>
            Slogan
          </label>
          <input
            id="gs-slogan"
            name="slogan"
            type="text"
            defaultValue={initial.slogan}
            aria-invalid={err("slogan") ? true : undefined}
            aria-describedby={err("slogan") ? "slogan-error" : undefined}
            className={inputClass}
          />
          {fieldError("slogan")}
          <p className="mt-1 text-sm text-slate-500">
            Dòng mô tả dưới tên shop ở chân trang (footer).
          </p>
        </div>

        <SettingsImageField
          label="Logo"
          name="logo"
          purpose="logo"
          initialUrl={initial.logo}
          hint="Ảnh JPEG, PNG, WebP hoặc SVG tĩnh, tối đa 1 MB. Hiện thay cho biểu tượng hoa ở đầu trang; để trống thì dùng biểu tượng mặc định."
          previewClass="h-16 w-16"
        />
        {fieldError("logo")}

        <SettingsImageField
          label="Favicon"
          name="favicon"
          purpose="favicon"
          initialUrl={initial.favicon}
          hint="Ảnh JPEG, PNG, WebP hoặc SVG tĩnh, tối đa 256 KB. Hiện ở tab trình duyệt; để trống thì trình duyệt không hiện favicon riêng."
          previewClass="h-8 w-8"
        />
        {fieldError("favicon")}
      </section>

      <button
        type="submit"
        className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
      >
        Lưu cài đặt chung
      </button>
    </form>
  );
}
