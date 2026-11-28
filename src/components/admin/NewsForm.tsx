// Biểu mẫu tạo/sửa bài tin tức quản trị (Ngày 18).
// Theo mẫu PageForm (Ngày 13 B3): kiểm tra ở MÁY CHỦ (Server
// Action): lỗi từng trường, giữ nguyên giá trị đã nhập
// (useActionState + defaultValue). Slug tự sinh từ tiêu đề khi chưa
// sửa tay. Nội dung Markdown có bộ đếm ký tự + xem trước trực tiếp
// (renderMarkdown — đã thoát HTML nên an toàn). Ảnh đại diện tải lên
// qua đúng route /api/admin/upload của sản phẩm (Blob ở production,
// đĩa ở local; ≤ 2 MB, chỉ jpeg/png/webp, kiểm magic bytes, KHÔNG
// nhận SVG) rồi ghi URL trả về vào ô ảnh — không có route upload
// riêng cho tin tức.
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
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { slugifyName } from "@/lib/admin/product-validation";
import { renderMarkdown } from "@/lib/markdown";
import { MAX_UPLOAD_BYTES } from "@/lib/admin/upload-rules";
import {
  MAX_NEWS_AUTHOR_LENGTH,
  MAX_NEWS_CONTENT_LENGTH,
  MAX_NEWS_EXCERPT_LENGTH,
  MAX_NEWS_SEO_DESCRIPTION_LENGTH,
  MAX_NEWS_SEO_TITLE_LENGTH,
  MAX_NEWS_TITLE_LENGTH,
} from "@/lib/admin/news-validation";
import {
  initialAdminNewsState,
  type AdminNewsState,
} from "@/lib/admin/news-form-state";

export type NewsFormInitial = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  author: string;
  seoTitle: string;
  seoDescription: string;
  // Ngày-giờ đăng đã hẹn, dạng "YYYY-MM-DDTHH:mm" theo giờ VN
  // (rỗng = không hẹn) — Ngày 19 A1.
  publishedAt: string;
  isPublished: boolean;
};

const inputClass =
  "mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900";
const labelClass = "block text-sm font-semibold text-slate-900";

export default function NewsForm({
  mode,
  initial,
  action,
  originalSlug,
  originalPublished,
  onSuccess = "list",
}: {
  mode: "create" | "edit";
  initial: NewsFormInitial;
  action: (prevState: AdminNewsState, formData: FormData) => Promise<AdminNewsState>;
  originalSlug?: string;
  originalPublished?: boolean;
  // Sau khi lưu thành công: "back" quay lại trang trước (popup),
  // "list" về /admin/news (trang trực tiếp). Mặc định "list".
  onSuccess?: "back" | "list";
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [state, dispatch] = useActionState(action, initialAdminNewsState);
  useEffect(() => {
    if (state.ok) {
      if (onSuccess === "back") router.back();
      else router.push("/admin/news");
    }
  }, [state.ok, onSuccess, router]);
  const saved = state.values;
  const slugRef = useRef<HTMLInputElement | null>(null);
  const slugTouchedRef = useRef(false);
  const [slugValue, setSlugValue] = useState(saved?.slug ?? initial.slug);
  const [contentValue, setContentValue] = useState(saved?.content ?? initial.content);
  const [showPreview, setShowPreview] = useState(false);
  // Ảnh đại diện: ô URL có kiểm soát để nút tải lên ghi URL trả về
  // vào đúng ô sẽ gửi đi; xóa ô là gỡ ảnh.
  const [coverImageValue, setCoverImageValue] = useState(
    saved?.coverImage ?? initial.coverImage,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const err = (field: keyof AdminNewsState["fieldErrors"]) =>
    state.fieldErrors[field] ?? null;

  function fieldError(field: keyof AdminNewsState["fieldErrors"]) {
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

  // Tải ảnh đại diện lên qua đúng route của sản phẩm
  // (/api/admin/upload): máy chủ kiểm magic bytes/kích thước/
  // điểm ảnh rồi lưu (Blob ở production, đĩa ở local); URL trả về
  // ghi vào ô ảnh. Không có route upload riêng cho tin tức.
  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("File quá lớn (tối đa 2 MB/ảnh).");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: form });
      const data: unknown = await res.json().catch(() => null);
      if (
        res.ok &&
        data &&
        typeof data === "object" &&
        (data as { ok?: unknown }).ok === true &&
        typeof (data as { url?: unknown }).url === "string"
      ) {
        setCoverImageValue((data as { url: string }).url);
      } else {
        const message =
          data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Không tải được ảnh, vui lòng thử lại.";
        setUploadError(message);
      }
    } catch {
      setUploadError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setUploading(false);
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

      <section aria-label="Thông tin bài tin tức" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <label htmlFor="nf-title" className={labelClass}>
            Tiêu đề
          </label>
          <input
            id="nf-title"
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
          <p className="mt-1 text-sm text-slate-500">
            {(saved?.title ?? initial.title).length} / {MAX_NEWS_TITLE_LENGTH} ký tự.
          </p>
        </div>

        <div>
          <label htmlFor="nf-slug" className={labelClass}>
            Đường dẫn (slug)
          </label>
          <input
            id="nf-slug"
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
            Bài hiện ở địa chỉ /tin-tuc/{slugValue || "…"}.
          </p>
          {slugChanged ? (
            <p role="status" className="mt-1 text-sm font-medium text-danger">
              Đổi đường dẫn sẽ làm link cũ của bài {originalPublished ? "đã xuất bản" : ""} báo 404.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="nf-excerpt" className={labelClass}>
            Tóm tắt (không bắt buộc)
          </label>
          <textarea
            id="nf-excerpt"
            name="excerpt"
            rows={2}
            defaultValue={saved?.excerpt ?? initial.excerpt}
            aria-invalid={err("excerpt") ? true : undefined}
            aria-describedby={err("excerpt") ? "excerpt-error" : undefined}
            className={`${inputClass} py-2`}
          />
          {fieldError("excerpt")}
          <p className="mt-1 text-sm text-slate-500">
            {(saved?.excerpt ?? initial.excerpt).length} / {MAX_NEWS_EXCERPT_LENGTH} ký tự.
            Hiện ở danh sách tin và kết quả tìm kiếm.
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="nf-content" className={labelClass}>
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
          <div
            className={
              showPreview
                ? "mt-1 grid items-start gap-3 xl:grid-cols-2"
                : "mt-1"
            }
          >
            <textarea
              id="nf-content"
              name="content"
              rows={12}
              value={contentValue}
              onChange={(e) => setContentValue(e.target.value)}
              aria-invalid={err("content") ? true : undefined}
              aria-describedby={err("content") ? "content-error" : undefined}
              className={`${inputClass} py-2`}
            />
            {showPreview ? (
              <div
                aria-label="Xem trước nội dung"
                className="max-w-none rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-900 [&_a]:font-bold [&_a]:text-green-800 [&_a]:underline [&_h2]:text-lg [&_h2]:font-bold [&_h3]:text-base [&_h3]:font-bold [&_h4]:text-sm [&_h4]:font-bold [&_ol]:mt-2 [&_ol_li]:list-decimal [&_ol_li]:ml-5 [&_p]:mt-2 [&_ul]:mt-2 [&_ul_li]:list-disc [&_ul_li]:ml-5"
                dangerouslySetInnerHTML={{
                  __html:
                    renderMarkdown(contentValue) ||
                    '<p class="text-slate-500">Chưa có nội dung.</p>',
                }}
              />
            ) : null}
          </div>
          {fieldError("content")}
          <p className="mt-1 text-sm text-slate-500">
            {contentValue.length.toLocaleString("vi-VN")} /{" "}
            {MAX_NEWS_CONTENT_LENGTH.toLocaleString("vi-VN")} ký tự. Hỗ trợ tiêu đề (#, ##,
            ###), <strong>đậm</strong>, <em>nghiêng</em>, danh sách, liên kết. Không cho
            HTML thô, không ảnh.
          </p>
        </div>

        <div>
          <label htmlFor="nf-coverImage" className={labelClass}>
            Ảnh đại diện (không bắt buộc)
          </label>
          <input
            id="nf-coverImage"
            name="coverImage"
            type="text"
            value={coverImageValue}
            onChange={(e) => setCoverImageValue(e.target.value)}
            placeholder="Tải ảnh lên hoặc dán URL ảnh"
            aria-invalid={err("coverImage") ? true : undefined}
            aria-describedby={err("coverImage") ? "coverImage-error" : undefined}
            className={inputClass}
          />
          {fieldError("coverImage")}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label
              htmlFor="nf-upload"
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 ${uploading ? "pointer-events-none opacity-50" : ""}`}
            >
              {uploading ? "Đang tải lên…" : "Tải ảnh lên"}
            </label>
            <input
              id="nf-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void handleUpload(e)}
              disabled={uploading}
              className="sr-only"
            />
            {coverImageValue !== "" ? (
              <button
                type="button"
                onClick={() => setCoverImageValue("")}
                className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
              >
                Gỡ ảnh
              </button>
            ) : null}
            <span className="text-sm text-slate-500">JPEG, PNG hoặc WebP, tối đa 2 MB.</span>
          </div>
          {uploadError ? (
            <p role="alert" className="mt-1 text-sm font-medium text-danger">
              {uploadError}
            </p>
          ) : null}
          {coverImageValue !== "" ? (
            <div className="relative mt-3 aspect-[16/9] w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              <Image
                src={coverImageValue}
                alt="Xem trước ảnh đại diện"
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          ) : null}
        </div>

        <div>
          <label htmlFor="nf-author" className={labelClass}>
            Tác giả (không bắt buộc)
          </label>
          <input
            id="nf-author"
            name="author"
            type="text"
            defaultValue={saved?.author ?? initial.author}
            aria-invalid={err("author") ? true : undefined}
            aria-describedby={err("author") ? "author-error" : undefined}
            className={inputClass}
          />
          {fieldError("author")}
          <p className="mt-1 text-sm text-slate-500">
            {(saved?.author ?? initial.author).length} / {MAX_NEWS_AUTHOR_LENGTH} ký tự.
            Để trống thì bài không hiện tác giả.
          </p>
        </div>

        <div>
          <label htmlFor="nf-seoTitle" className={labelClass}>
            Tiêu đề SEO (không bắt buộc)
          </label>
          <input
            id="nf-seoTitle"
            name="seoTitle"
            type="text"
            defaultValue={saved?.seoTitle ?? initial.seoTitle}
            aria-invalid={err("seoTitle") ? true : undefined}
            aria-describedby={err("seoTitle") ? "seoTitle-error" : undefined}
            className={inputClass}
          />
          {fieldError("seoTitle")}
          <p className="mt-1 text-sm text-slate-500">
            {(saved?.seoTitle ?? initial.seoTitle).length} / {MAX_NEWS_SEO_TITLE_LENGTH} ký tự.
            Để trống thì dùng tiêu đề bài.
          </p>
        </div>

        <div>
          <label htmlFor="nf-seoDescription" className={labelClass}>
            Mô tả SEO (không bắt buộc)
          </label>
          <textarea
            id="nf-seoDescription"
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
            {MAX_NEWS_SEO_DESCRIPTION_LENGTH} ký tự. Để trống thì dùng tóm tắt của bài.
          </p>
        </div>

        <div>
          <label htmlFor="nf-publishedAt" className={labelClass}>
            Ngày giờ đăng (không bắt buộc)
          </label>
          <input
            id="nf-publishedAt"
            name="publishedAt"
            type="datetime-local"
            defaultValue={saved?.publishedAt ?? initial.publishedAt}
            aria-invalid={err("publishedAt") ? true : undefined}
            aria-describedby={err("publishedAt") ? "publishedAt-error" : undefined}
            className={inputClass}
          />
          {fieldError("publishedAt")}
          <p className="mt-1 text-sm text-slate-500">
            Giờ Việt Nam. Để trống thì đăng ngay khi xuất bản; hẹn giờ
            tương lai thì bài chỉ hiện ra shop khi tới giờ đó.
          </p>
        </div>

        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-900">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={saved?.isPublished ?? initial.isPublished}
              className="h-5 w-5 accent-blue-600"
            />
            Đã xuất bản (hiện ra shop)
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          {mode === "create" ? "Lưu bài" : "Lưu thay đổi"}
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
            href="/admin/news"
            className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
          >
            Hủy
          </Link>
        )}
      </div>
    </form>
  );
}
