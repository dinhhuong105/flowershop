// Biểu mẫu tạo/sửa trang tĩnh quản trị (Ngày 13 B3).
// Kiểm tra ở MÁY CHỦ (Server Action): lỗi từng trường, giữ nguyên
// giá trị đã nhập (useActionState + defaultValue). Slug tự sinh từ
// tiêu đề khi chưa sửa tay; đổi slug ở trang đã xuất bản thì cảnh
// báo link cũ sẽ báo 404. Nội dung Markdown có bộ đếm ký tự + xem
// trước trực tiếp (renderMarkdown — đã thoát HTML nên an toàn).
//
// LƯU Ý (lỗi Ngày 12): form KHÔNG dùng native submit
// (action={dispatch}) — React reset form sau mỗi lần useActionState
// hoàn tất, làm mất checkbox. Gửi trực tiếp qua
// dispatch(new FormData(form)) thì không bị reset.
//
// QUY TẮC ĐỨNG (25/11): mọi màn thêm/sửa đều mở dạng POPUP — form
// này dùng cả trong popup (intercepting route @modal,
// onSuccess="back") lẫn trang trực tiếp (onSuccess="list").
"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { slugifyName } from "@/lib/admin/product-validation";
import { renderMarkdown } from "@/lib/markdown";
import {
  LEGACY_PATHS,
  LEGACY_PATH_LABELS,
  LEGACY_POLICY_WARNING,
} from "@/lib/legacy-paths";
import {
  MAX_PAGE_CONTENT_LENGTH,
  MAX_PAGE_SEO_DESCRIPTION_LENGTH,
  MAX_PAGE_SEO_TITLE_LENGTH,
} from "@/lib/admin/page-validation";
import {
  initialAdminPageState,
  type AdminPageState,
} from "@/lib/admin/page-form-state";

export type PageFormInitial = {
  title: string;
  slug: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  sortOrder: string;
  isPublished: boolean;
  showInFooter: boolean;
  // Đường dẫn cũ thay thế ("" = không thay trang nào) — Ngày 14 C1.
  legacyPath: string;
};

const inputClass =
  "mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900";
const labelClass = "block text-sm font-semibold text-slate-900";

export default function PageForm({
  mode,
  initial,
  action,
  originalSlug,
  originalPublished,
  onSuccess = "list",
}: {
  mode: "create" | "edit";
  initial: PageFormInitial;
  action: (prevState: AdminPageState, formData: FormData) => Promise<AdminPageState>;
  originalSlug?: string;
  originalPublished?: boolean;
  // Sau khi lưu thành công: "back" quay lại trang trước (popup),
  // "list" về /admin/pages (trang trực tiếp). Mặc định "list".
  onSuccess?: "back" | "list";
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, dispatch] = useActionState(action, initialAdminPageState);
  useEffect(() => {
    if (state.ok) {
      if (onSuccess === "back") router.back();
      else router.push("/admin/pages");
    }
  }, [state.ok, onSuccess, router]);
  const saved = state.values;
  const slugRef = useRef<HTMLInputElement | null>(null);
  const slugTouchedRef = useRef(false);
  const [slugValue, setSlugValue] = useState(saved?.slug ?? initial.slug);
  const [contentValue, setContentValue] = useState(saved?.content ?? initial.content);
  const [showPreview, setShowPreview] = useState(false);
  // Ô "Thay thế trang cũ" (Ngày 14 C1): cần giá trị hiện tại để
  // hiện cảnh báo /policy và gợi ý khi trang còn là nháp.
  const [legacyPathValue, setLegacyPathValue] = useState(
    saved?.legacyPath ?? initial.legacyPath,
  );
  const [isPublishedValue, setIsPublishedValue] = useState(
    saved?.isPublished ?? initial.isPublished,
  );

  const err = (field: keyof AdminPageState["fieldErrors"]) =>
    state.fieldErrors[field] ?? null;

  function fieldError(field: keyof AdminPageState["fieldErrors"]) {
    const message = err(field);
    if (!message) return null;
    return (
      <p id={`${field}-error`} role="alert" className="mt-1 text-sm font-medium text-danger">
        {message}
      </p>
    );
  }

  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!slugTouchedRef.current && slugRef.current) {
      const generated = slugifyName(event.target.value);
      slugRef.current.value = generated;
      setSlugValue(generated);
    }
  }

  // Gửi trực tiếp qua dispatch (không native submit): tránh React
  // reset form sau action, làm mất checkbox đã chọn (lỗi Ngày 12).
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = formRef.current;
    if (!form) return;
    if (!form.reportValidity()) return;
    dispatch(new FormData(form));
  }

  const slugChanged =
    mode === "edit" && originalSlug !== undefined && slugValue !== originalSlug;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {state.formError ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
          {state.formError}
        </p>
      ) : null}

      <section aria-label="Thông tin trang" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <label htmlFor="pf-title" className={labelClass}>
            Tiêu đề
          </label>
          <input
            id="pf-title"
            name="title"
            type="text"
            required
            defaultValue={saved?.title ?? initial.title}
            onChange={handleNameChange}
            aria-invalid={err("title") ? true : undefined}
            aria-describedby={err("title") ? "title-error" : undefined}
            className={inputClass}
          />
          {fieldError("title")}
        </div>

        <div>
          <label htmlFor="pf-slug" className={labelClass}>
            Đường dẫn (slug)
          </label>
          <input
            id="pf-slug"
            name="slug"
            type="text"
            ref={slugRef}
            defaultValue={saved?.slug ?? initial.slug}
            onChange={(e) => {
              slugTouchedRef.current = true;
              setSlugValue(e.target.value);
            }}
            aria-invalid={err("slug") ? true : undefined}
            aria-describedby={err("slug") ? "slug-error" : undefined}
            className={inputClass}
          />
          {fieldError("slug")}
          <p className="mt-1 text-sm text-slate-500">
            Trang hiện ở địa chỉ /{slugValue || "…"}.
          </p>
          {slugChanged ? (
            <p role="status" className="mt-1 text-sm font-medium text-danger">
              Đổi đường dẫn sẽ làm link cũ của trang {originalPublished ? "đã xuất bản" : ""} báo 404.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="pf-legacyPath" className={labelClass}>
            Thay thế trang cũ
          </label>
          <select
            id="pf-legacyPath"
            name="legacyPath"
            value={legacyPathValue}
            onChange={(e) => setLegacyPathValue(e.target.value)}
            aria-invalid={err("legacyPath") ? true : undefined}
            aria-describedby={err("legacyPath") ? "legacyPath-error" : undefined}
            className={inputClass}
          >
            <option value="">Không thay trang cũ nào</option>
            {LEGACY_PATHS.map((path) => (
              <option key={path} value={path}>
                {LEGACY_PATH_LABELS[path]}
              </option>
            ))}
          </select>
          {fieldError("legacyPath")}
          <p className="mt-1 text-sm text-slate-500">
            Khi trang này được xuất bản, đường dẫn cũ sẽ chuyển vĩnh viễn sang trang mới.
          </p>
          {legacyPathValue === "/policy" ? (
            <p role="status" className="mt-1 text-sm font-medium text-yellow-800">
              {LEGACY_POLICY_WARNING}
            </p>
          ) : null}
          {legacyPathValue !== "" && !isPublishedValue ? (
            <p className="mt-1 text-sm text-slate-500">
              Trang cũ vẫn hiện cho đến khi trang này được xuất bản.
            </p>
          ) : null}
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="pf-content" className={labelClass}>
              Nội dung (Markdown)
            </label>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
            >
              {showPreview ? "Ẩn xem trước" : "Xem trước"}
            </button>
          </div>
          <textarea
            id="pf-content"
            name="content"
            rows={12}
            value={contentValue}
            onChange={(e) => setContentValue(e.target.value)}
            aria-invalid={err("content") ? true : undefined}
            aria-describedby={err("content") ? "content-error" : undefined}
            className={`${inputClass} py-2`}
          />
          {fieldError("content")}
          <p className="mt-1 text-sm text-slate-500">
            {contentValue.length.toLocaleString("vi-VN")} /{" "}
            {MAX_PAGE_CONTENT_LENGTH.toLocaleString("vi-VN")} ký tự. Hỗ trợ tiêu đề (#, ##,
            ###), <strong>đậm</strong>, <em>nghiêng</em>, danh sách, liên kết. Không cho
            HTML thô, không ảnh.
          </p>
          {showPreview ? (
            <div
              aria-label="Xem trước nội dung"
              className="mt-3 max-w-none rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-900 [&_a]:font-bold [&_a]:text-green-800 [&_a]:underline [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_h4]:text-sm [&_h4]:font-bold [&_ol]:mt-2 [&_ol_li]:list-decimal [&_ol_li]:ml-5 [&_p]:mt-2 [&_ul]:mt-2 [&_ul_li]:list-disc [&_ul_li]:ml-5"
              dangerouslySetInnerHTML={{
                __html:
                  renderMarkdown(contentValue) ||
                  '<p class="text-slate-500">Chưa có nội dung.</p>',
              }}
            />
          ) : null}
        </div>

        <div>
          <label htmlFor="pf-seoTitle" className={labelClass}>
            Tiêu đề SEO (không bắt buộc)
          </label>
          <input
            id="pf-seoTitle"
            name="seoTitle"
            type="text"
            defaultValue={saved?.seoTitle ?? initial.seoTitle}
            aria-invalid={err("seoTitle") ? true : undefined}
            aria-describedby={err("seoTitle") ? "seoTitle-error" : undefined}
            className={inputClass}
          />
          {fieldError("seoTitle")}
          <p className="mt-1 text-sm text-slate-500">
            {(saved?.seoTitle ?? initial.seoTitle).length} / {MAX_PAGE_SEO_TITLE_LENGTH} ký tự.
            Để trống thì dùng tiêu đề trang.
          </p>
        </div>

        <div>
          <label htmlFor="pf-seoDescription" className={labelClass}>
            Mô tả SEO (không bắt buộc)
          </label>
          <textarea
            id="pf-seoDescription"
            name="seoDescription"
            rows={3}
            defaultValue={saved?.seoDescription ?? initial.seoDescription}
            aria-invalid={err("seoDescription") ? true : undefined}
            aria-describedby={err("seoDescription") ? "seoDescription-error" : undefined}
            className={`${inputClass} py-2`}
          />
          {fieldError("seoDescription")}
          <p className="mt-1 text-sm text-slate-500">
            {(saved?.seoDescription ?? initial.seoDescription).length} /{" "}
            {MAX_PAGE_SEO_DESCRIPTION_LENGTH} ký tự. Để trống thì dùng mô tả mặc định của shop.
          </p>
        </div>

        <div>
          <label htmlFor="pf-sort" className={labelClass}>
            Thứ tự sắp xếp
          </label>
          <input
            id="pf-sort"
            name="sortOrder"
            type="number"
            min="0"
            max="9999"
            step="1"
            defaultValue={saved?.sortOrder ?? initial.sortOrder}
            aria-invalid={err("sortOrder") ? true : undefined}
            aria-describedby={err("sortOrder") ? "sortOrder-error" : undefined}
            className={inputClass}
          />
          {fieldError("sortOrder")}
        </div>

        <div className="flex flex-wrap gap-6">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-900">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={saved?.isPublished ?? initial.isPublished}
              onChange={(e) => setIsPublishedValue(e.target.checked)}
              className="h-5 w-5 accent-blue-600"
            />
            Đã xuất bản (hiện ra shop)
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-900">
            <input
              type="checkbox"
              name="showInFooter"
              defaultChecked={saved?.showInFooter ?? initial.showInFooter}
              className="h-5 w-5 accent-blue-600"
            />
            Hiện ở chân trang
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          {mode === "create" ? "Lưu trang" : "Lưu thay đổi"}
        </button>
        {onSuccess === "back" ? (
          <button
            type="button"
            onClick={() => router.back()}
            className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
          >
            Hủy
          </button>
        ) : (
          <Link
            href="/admin/pages"
            className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
          >
            Hủy
          </Link>
        )}
      </div>
    </form>
  );
}
