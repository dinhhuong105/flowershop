// Phần SEO gập dùng chung cho form sản phẩm/danh mục (Ngày 14 D1):
// hai ô (tiêu đề ≤ 120, mô tả ≤ 160), bộ đếm ký tự, xem trước kiểu
// kết quả tìm kiếm. Không đổi bố cục các trường cũ — phần này nằm
// riêng cuối form, mặc định đóng (tự mở khi đã có giá trị/lỗi).
// Giá trị giữ nguyên sau lỗi (state nội bộ, không reset khi action
// trả về — bài học Ngày 12).
"use client";

import { useState } from "react";
import {
  MAX_SEO_DESCRIPTION_LENGTH,
  MAX_SEO_TITLE_LENGTH,
} from "@/lib/admin/product-validation";

const inputClass =
  "mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900";
const labelClass = "block text-sm font-semibold text-slate-900";

export default function SeoFieldsSection({
  siteName,
  fallbackTitle,
  fallbackDescription,
  fallbackDescriptionNote,
  urlPath,
  initialTitle,
  initialDescription,
  titleError,
  descriptionError,
}: {
  /** Tên shop để xem trước tiêu đề đầy đủ ("Tiêu đề | Tên shop"). */
  siteName: string;
  /** Tên sản phẩm/danh mục — dùng khi seoTitle trống. */
  fallbackTitle: string;
  /** Mô tả hiện nay — dùng khi seoDescription trống. */
  fallbackDescription: string;
  /** Ghi chú cho dòng "Để trống thì dùng …" của ô mô tả. */
  fallbackDescriptionNote: string;
  /** Đường dẫn trang để xem trước (vd "/hoa-tuoi/bo-hong-do-tinh-yeu"). */
  urlPath: string;
  initialTitle: string;
  initialDescription: string;
  titleError: string | null;
  descriptionError: string | null;
}) {
  const [open, setOpen] = useState(
    initialTitle !== "" ||
      initialDescription !== "" ||
      titleError !== null ||
      descriptionError !== null,
  );
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);

  const previewTitle = `${title !== "" ? title : fallbackTitle} | ${siteName}`;
  const previewDescription =
    description !== "" ? description : fallbackDescription;

  return (
    <section
      aria-label="SEO (không bắt buộc)"
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm font-bold text-slate-900"
      >
        SEO (không bắt buộc)
        <span aria-hidden="true" className="shrink-0 text-xs">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="seo-title" className={labelClass}>
              Tiêu đề SEO
            </label>
            <input
              id="seo-title"
              name="seoTitle"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={titleError ? true : undefined}
              aria-describedby={titleError ? "seoTitle-error" : undefined}
              className={inputClass}
            />
            {titleError ? (
              <p id="seoTitle-error" role="alert" className="mt-1 text-sm font-medium text-danger">
                {titleError}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-slate-500">
              {title.length} / {MAX_SEO_TITLE_LENGTH} ký tự. Để trống thì
              dùng tên hiện tại.
            </p>
          </div>

          <div>
            <label htmlFor="seo-description" className={labelClass}>
              Mô tả SEO
            </label>
            <textarea
              id="seo-description"
              name="seoDescription"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-invalid={descriptionError ? true : undefined}
              aria-describedby={descriptionError ? "seoDescription-error" : undefined}
              className={`${inputClass} py-2`}
            />
            {descriptionError ? (
              <p id="seoDescription-error" role="alert" className="mt-1 text-sm font-medium text-danger">
                {descriptionError}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-slate-500">
              {description.length} / {MAX_SEO_DESCRIPTION_LENGTH} ký tự.{" "}
              {fallbackDescriptionNote}
            </p>
          </div>

          <div aria-label="Xem trước kết quả tìm kiếm" className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Xem trước kết quả tìm kiếm
            </p>
            <p className="mt-1 truncate text-base font-medium text-blue-700">
              {previewTitle}
            </p>
            {urlPath !== "" ? (
              <p className="truncate text-sm text-green-800">{urlPath}</p>
            ) : (
              <p className="text-sm text-slate-500">Đường dẫn sẽ có sau khi lưu.</p>
            )}
            <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">
              {previewDescription !== "" ? previewDescription : "Chưa có mô tả."}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
