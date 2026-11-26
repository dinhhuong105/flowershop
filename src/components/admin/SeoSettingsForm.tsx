// Biểu mẫu Cài đặt SEO (Ngày 13 C2): mẫu tiêu đề, mô tả mặc định,
// ảnh OG mặc định, từ khóa, cho phép lập chỉ mục. Kiểm tra ở máy
// chủ (Server Action): lỗi từng trường, giữ nguyên giá trị đã nhập.
// Gửi trực tiếp qua dispatch(new FormData(form)) (không native
// submit) theo bài học Ngày 12 — React reset form sau action sẽ
// làm mất trạng thái checkbox allowIndexing. Tắt lập chỉ mục
// (allowIndexing đang BẬT mà bỏ chọn) phải xác nhận trong hộp thoại
// vì ảnh hưởng toàn site (noindex + robots Disallow).
"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSeoSettingsAction } from "@/app/admin/settings/actions";
import {
  initialSettingsFormState,
  type SettingsFormState,
} from "@/lib/admin/settings-form-state";
import SettingsImageField from "@/components/admin/SettingsImageField";

const inputClass =
  "mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900";
const labelClass = "block text-sm font-semibold text-slate-900";

// Tiêu đề trang mẫu để xem trước kết quả tìm kiếm + thẻ OG.
const SAMPLE_PAGE_TITLE = "Bó Hồng Đỏ Tình Yêu";

export default function SeoSettingsForm({
  initial,
  siteUrl,
}: {
  initial: {
    titleTemplate: string;
    defaultDescription: string;
    defaultOgImage: string;
    metaKeywords: string;
    allowIndexing: boolean;
  };
  /** Domain shop (để xem trước đường dẫn) — máy chủ truyền vào. */
  siteUrl: string;
}) {
  const router = useRouter();
  const [state, dispatch] = useActionState<SettingsFormState, FormData>(
    saveSeoSettingsAction,
    initialSettingsFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const [titleTemplate, setTitleTemplate] = useState(initial.titleTemplate);
  const [defaultDescription, setDefaultDescription] = useState(initial.defaultDescription);
  const [defaultOgImage, setDefaultOgImage] = useState(initial.defaultOgImage);
  const [metaKeywords, setMetaKeywords] = useState(initial.metaKeywords);
  const [allowIndexing, setAllowIndexing] = useState(initial.allowIndexing);

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

  // Tiêu đề xem trước: thay %s bằng tên trang mẫu (mẫu lỗi thì hiện nguyên mẫu).
  const previewTitle = titleTemplate.includes("%s")
    ? titleTemplate.replace("%s", SAMPLE_PAGE_TITLE)
    : titleTemplate;
  const previewDescription =
    defaultDescription === ""
      ? "Chưa nhập mô tả mặc định — trang sẽ dùng slogan của shop."
      : defaultDescription;
  // Đang TẮT lập chỉ mục mà lưu → xác nhận trước.
  const turningOffIndexing = initial.allowIndexing && !allowIndexing;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form) return;
    if (!form.reportValidity()) return;
    if (turningOffIndexing) {
      confirmRef.current?.showModal();
      return;
    }
    dispatch(new FormData(form));
  }

  function confirmTurnOff() {
    confirmRef.current?.close();
    const form = formRef.current;
    if (!form) return;
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
        aria-label="Tiêu đề và mô tả"
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      >
        <div>
          <label htmlFor="seo-titleTemplate" className={labelClass}>
            Mẫu tiêu đề
          </label>
          <input
            id="seo-titleTemplate"
            name="titleTemplate"
            type="text"
            required
            value={titleTemplate}
            onChange={(e) => setTitleTemplate(e.target.value)}
            aria-invalid={err("titleTemplate") ? true : undefined}
            aria-describedby={err("titleTemplate") ? "titleTemplate-error" : undefined}
            className={inputClass}
          />
          {fieldError("titleTemplate")}
          <p className="mt-1 text-sm text-slate-500">
            {titleTemplate.length}/80 ký tự. %s là tên trang/sản phẩm — mẫu phải chứa đúng
            một lần %s. Ví dụ: &ldquo;%s | Hoa Tươi Demo&rdquo;.
          </p>
        </div>

        <div>
          <label htmlFor="seo-defaultDescription" className={labelClass}>
            Mô tả mặc định
          </label>
          <textarea
            id="seo-defaultDescription"
            name="defaultDescription"
            rows={3}
            value={defaultDescription}
            onChange={(e) => setDefaultDescription(e.target.value)}
            aria-invalid={err("defaultDescription") ? true : undefined}
            aria-describedby={err("defaultDescription") ? "defaultDescription-error" : undefined}
            className={inputClass}
          />
          {fieldError("defaultDescription")}
          <p className="mt-1 text-sm text-slate-500">
            {defaultDescription.length}/160 ký tự.
            {defaultDescription !== "" && defaultDescription.length < 50
              ? " Mô tả ngắn hơn 50 ký tự — cân nhắc viết dài hơn để kết quả tìm kiếm rõ nghĩa."
              : ""}
          </p>
        </div>

        <SettingsImageField
          label="Ảnh OG mặc định"
          name="defaultOgImage"
          purpose="og"
          initialUrl={initial.defaultOgImage}
          accept="image/jpeg,image/png,image/webp"
          onUrlChange={setDefaultOgImage}
          hint="Ảnh JPEG, PNG hoặc WebP, tối đa 1 MB. Kích thước gợi ý 1200×630 px (không bắt buộc). Hiện khi chia sẻ link shop lên mạng xã hội; để trống thì không có ảnh."
          previewClass="h-20 w-32 object-cover"
        />
        {fieldError("defaultOgImage")}

        <div>
          <label htmlFor="seo-metaKeywords" className={labelClass}>
            Từ khóa (meta keywords)
          </label>
          <input
            id="seo-metaKeywords"
            name="metaKeywords"
            type="text"
            value={metaKeywords}
            onChange={(e) => setMetaKeywords(e.target.value)}
            aria-invalid={err("metaKeywords") ? true : undefined}
            aria-describedby={err("metaKeywords") ? "metaKeywords-error" : undefined}
            className={inputClass}
          />
          {fieldError("metaKeywords")}
          <p className="mt-1 text-sm text-slate-500">
            {metaKeywords.length}/200 ký tự. Các công cụ tìm kiếm lớn không dùng từ khóa
            này để xếp hạng — chỉ điền nếu cần.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <input
            id="seo-allowIndexing"
            name="allowIndexing"
            type="checkbox"
            checked={allowIndexing}
            onChange={(e) => setAllowIndexing(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-blue-600"
          />
          <div>
            <label htmlFor="seo-allowIndexing" className={labelClass}>
              Cho phép công cụ tìm kiếm lập chỉ mục
            </label>
            <p className="mt-1 text-sm text-slate-500">
              Tắt thì toàn site gắn thẻ noindex và robots.txt chặn tất cả (Disallow /) —
              shop sẽ không xuất hiện trên Google.
            </p>
          </div>
        </div>
      </section>

      {/* Xem trước kết quả tìm kiếm + thẻ OG */}
      <section
        aria-label="Xem trước"
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 className="text-lg font-bold text-slate-900">Xem trước</h2>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{siteUrl}</p>
          <p className="mt-1 text-lg leading-snug text-blue-800 hover:underline">
            {previewTitle}
          </p>
          <p className="mt-1 text-sm text-slate-600">{previewDescription}</p>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          {defaultOgImage !== "" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={defaultOgImage}
              alt="Ảnh OG xem trước"
              className="aspect-[1200/630] w-full object-cover"
            />
          ) : (
            <p className="flex aspect-[1200/630] w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
              Chưa có ảnh OG
            </p>
          )}
          <div className="bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {siteUrl.replace(/^https?:\/\//, "")}
            </p>
            <p className="mt-1 font-semibold text-slate-900">{previewTitle}</p>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{previewDescription}</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Lưu cài đặt SEO
        </button>
      </div>

      {/* Hộp xác nhận tắt lập chỉ mục */}
      <dialog
        ref={confirmRef}
        aria-label="Xác nhận tắt lập chỉ mục"
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-[0_24px_64px_rgba(15,30,51,0.35)] backdrop:bg-black/40"
      >
        <p className="text-base font-bold text-slate-900">Tắt lập chỉ mục toàn site?</p>
        <p className="mt-2 text-sm text-slate-500">
          Toàn site sẽ gắn thẻ noindex và robots.txt chặn tất cả (Disallow /). Shop sẽ
          không còn xuất hiện trên công cụ tìm kiếm cho đến khi bạn bật lại.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={confirmTurnOff}
            className="flex min-h-11 items-center justify-center rounded-lg bg-danger px-6 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Tắt lập chỉ mục
          </button>
          <button
            type="button"
            onClick={() => confirmRef.current?.close()}
            className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
          >
            Hủy
          </button>
        </div>
      </dialog>
    </form>
  );
}
