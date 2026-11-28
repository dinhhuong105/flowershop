// Biểu mẫu tạo/sửa sản phẩm quản trị (Ngày 7 §3, §5).
// Kiểm tra ở MÁY CHỦ (Server Action): lỗi từng trường, giữ nguyên
// giá trị đã nhập (useActionState + defaultValue). Slug tự sinh từ
// tên khi chưa sửa tay; đổi slug ở chế độ sửa thì cảnh báo link cũ
// sẽ báo 404. Ảnh quản lý ở đây: tải lên (fetch tới
// /api/admin/upload), Lên/Xuống đổi thứ tự, Gỡ khỏi sản phẩm (file
// trên đĩa giữ lại) — ảnh chỉ lưu vào DB khi bấm "Lưu sản phẩm".
//
// QUY TẮC ĐỨNG (25/11, theo Henry): mọi màn thêm/sửa trong hệ
// thống đều mở dạng POPUP, không mở trang riêng — form này được
// dùng cả trong popup (intercepting route @modal, onSuccess="back")
// lẫn trang trực tiếp (onSuccess="list"). Khi thêm màn thêm/sửa
// mới (Danh mục, Bài viết, ...), làm popup tương tự, đừng tạo
// trang form riêng.
//
// Sau khi lưu thành công (state.ok) thì KHÔNG redirect ở action
// nữa — form tự điều hướng theo onSuccess: "back" quay lại trang
// trước (giữ nguyên bộ lọc trên URL, dùng trong popup), "list" về
// /admin/products (dùng ở trang trực tiếp). Lỗi validation vẫn
// hiện trong form như cũ.

"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { slugifyName } from "@/lib/admin/product-validation";
import { MAX_IMAGES_PER_PRODUCT } from "@/lib/admin/upload-rules";
import { FilterSelectField, StyledCheckbox } from "@/components/admin/filter-controls";
import SeoFieldsSection from "@/components/admin/SeoFieldsSection";
import {
  initialAdminProductState,
  type AdminProductState,
} from "@/lib/admin/product-form-state";

export type ProductFormInitial = {
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  price: string;
  salePrice: string;
  description: string;
  tags: string;
  sortOrder: string;
  isActive: boolean;
  inStock: boolean;
  isFastDelivery: boolean;
  images: string[];
  seoTitle: string;
  seoDescription: string;
  /** Nguồn dữ liệu (B6, bản sau Retry) — chỉ có khi SP nhập từ
   *  ngoài; form hiện khối chỉ đọc, không cho sửa. */
  source?: {
    sourceName: string | null;
    sourceExternalId: string | null;
    sourceUrl: string | null;
    importBatchId: number | null;
    importedAt: string | null;
  } | null;
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const inputClass =
  "mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900";
const labelClass = "block text-sm font-semibold text-slate-900";

export default function ProductForm({
  mode,
  categories,
  initial,
  action,
  originalSlug,
  productId,
  siteName = "Hoa Tươi Demo",
  urlPath = "",
  onSuccess = "list",
}: {
  mode: "create" | "edit";
  categories: Array<{ id: number; name: string }>;
  initial: ProductFormInitial;
  action: (
    prevState: AdminProductState,
    formData: FormData,
  ) => Promise<AdminProductState>;
  originalSlug?: string;
  productId?: number;
  /** Tên shop cho xem trước SEO; trang gọi truyền tên thật từ Cài đặt. */
  siteName?: string;
  /** Đường dẫn trang để xem trước (rỗng khi tạo mới). */
  urlPath?: string;
  // Sau khi lưu thành công: "back" quay lại trang trước (popup —
  // giữ nguyên bộ lọc trên URL), "list" về /admin/products (trang
  // trực tiếp). Mặc định "list" để giữ đúng hành vi cũ.
  onSuccess?: "back" | "list";
}) {
  const router = useRouter();
  const [state, dispatch] = useActionState(action, initialAdminProductState);
  // Lưu xong: action đã revalidate nên dữ liệu danh sách mới.
  // "back" chỉ quay lại URL trước đó (có sẵn bộ lọc); "list" về
  // lại danh sách không lọc như redirect cũ.
  useEffect(() => {
    if (state.ok) {
      if (onSuccess === "back") router.back();
      else router.push("/admin/products");
    }
  }, [state.ok, onSuccess, router]);
  const saved = state.values;
  const slugRef = useRef<HTMLInputElement | null>(null);
  const slugTouchedRef = useRef(false);
  const [slugValue, setSlugValue] = useState(saved?.slug ?? initial.slug);
  // Tên hiện tại để xem trước SEO (theo dõi khi gõ — xem SeoFieldsSection).
  const [nameValue, setNameValue] = useState(saved?.name ?? initial.name);
  const [images, setImages] = useState<string[]>(initial.images);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const err = (field: keyof AdminProductState["fieldErrors"]) =>
    state.fieldErrors[field] ?? null;

  function fieldError(field: keyof AdminProductState["fieldErrors"]) {
    const message = err(field);
    if (!message) return null;
    return (
      <p id={`${field}-error`} role="alert" className="mt-1 text-sm font-medium text-danger">
        {message}
      </p>
    );
  }

  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    setNameValue(event.target.value);
    if (!slugTouchedRef.current && slugRef.current) {
      const generated = slugifyName(event.target.value);
      slugRef.current.value = generated;
      setSlugValue(generated);
    }
  }

  function moveImage(index: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      return next;
    });
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadError(null);
    if (images.length >= MAX_IMAGES_PER_PRODUCT) {
      setUploadError("Tối đa 6 ảnh cho một sản phẩm.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("File quá lớn (tối đa 2 MB/ảnh).");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      if (productId !== undefined) form.append("productId", String(productId));
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
        const url = (data as { url: string }).url;
        setImages((prev) => (prev.includes(url) ? prev : [...prev, url]));
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

  const slugChanged = mode === "edit" && originalSlug !== undefined && slugValue !== originalSlug;

  return (
    <form action={dispatch} className="space-y-5">
      {state.formError ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
          {state.formError}
        </p>
      ) : null}

      {initial.source?.sourceName ? (
        <section aria-label="Nguồn dữ liệu" className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-sm font-bold text-slate-900">Nguồn dữ liệu</h2>
          <dl className="grid gap-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Tên nguồn</dt>
              <dd className="font-medium text-slate-900">{initial.source.sourceName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Mã ngoài</dt>
              <dd className="font-medium text-slate-900">{initial.source.sourceExternalId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Lô nhập</dt>
              <dd className="font-medium text-slate-900">
                {initial.source.importBatchId !== null ? (
                  <Link href={`/admin/products/import?batch=${initial.source.importBatchId}`} className="text-blue-700 hover:underline">
                    Lô #{initial.source.importBatchId}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Ngày nhập</dt>
              <dd className="font-medium text-slate-900">
                {initial.source.importedAt
                  ? new Date(initial.source.importedAt).toLocaleString("vi-VN")
                  : "—"}
              </dd>
            </div>
            {initial.source.sourceUrl && /^https?:\/\//i.test(initial.source.sourceUrl) ? (
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Địa chỉ nguồn</dt>
                <dd className="break-all font-medium">
                  <a href={initial.source.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                    {initial.source.sourceUrl}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="text-xs text-slate-500">Thông tin nguồn chỉ đọc, không sửa được ở đây.</p>
        </section>
      ) : null}

      <section aria-label="Thông tin sản phẩm" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <label htmlFor="pf-name" className={labelClass}>
            Tên sản phẩm
          </label>
          <input
            id="pf-name"
            name="name"
            type="text"
            required
            defaultValue={saved?.name ?? initial.name}
            onChange={handleNameChange}
            aria-invalid={err("name") ? true : undefined}
            aria-describedby={err("name") ? "name-error" : undefined}
            className={inputClass}
          />
          {fieldError("name")}
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
          {slugChanged ? (
            <p role="status" className="mt-1 text-sm font-medium text-danger">
              Đổi đường dẫn sẽ làm link cũ báo 404.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-sku" className={labelClass}>
              SKU (tùy chọn)
            </label>
            <input
              id="pf-sku"
              name="sku"
              type="text"
              defaultValue={saved?.sku ?? initial.sku}
              aria-invalid={err("sku") ? true : undefined}
              aria-describedby={err("sku") ? "sku-error" : undefined}
              className={inputClass}
            />
            {fieldError("sku")}
          </div>
          <FilterSelectField
            id="pf-category"
            label="Danh mục"
            name="categoryId"
            options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
            defaultValue={saved?.categoryId ?? initial.categoryId}
          />
          {fieldError("categoryId")}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="pf-price" className={labelClass}>
              Giá (VND)
            </label>
            <input
              id="pf-price"
              name="price"
              type="number"
              min="1000"
              max="100000000"
              step="1"
              required
              defaultValue={saved?.price ?? initial.price}
              aria-invalid={err("price") ? true : undefined}
              aria-describedby={err("price") ? "price-error" : undefined}
              className={inputClass}
            />
            {fieldError("price")}
          </div>
          <div>
            <label htmlFor="pf-sale" className={labelClass}>
              Giá khuyến mãi (VND, tùy chọn)
            </label>
            <input
              id="pf-sale"
              name="salePrice"
              type="number"
              min="1"
              step="1"
              defaultValue={saved?.salePrice ?? initial.salePrice}
              aria-invalid={err("salePrice") ? true : undefined}
              aria-describedby={err("salePrice") ? "salePrice-error" : undefined}
              className={inputClass}
            />
            {fieldError("salePrice")}
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
        </div>

        <div>
          <label htmlFor="pf-desc" className={labelClass}>
            Mô tả
          </label>
          <textarea
            id="pf-desc"
            name="description"
            rows={4}
            defaultValue={saved?.description ?? initial.description}
            aria-invalid={err("description") ? true : undefined}
            aria-describedby={err("description") ? "description-error" : undefined}
            className={`${inputClass} py-2`}
          />
          <p className="mt-1 text-xs text-slate-500">Tối đa 2.000 ký tự, văn bản thuần.</p>
          {fieldError("description")}
        </div>

        <div>
          <label htmlFor="pf-tags" className={labelClass}>
            Thẻ tag (cách nhau dấu phẩy, tối đa 10)
          </label>
          <input
            id="pf-tags"
            name="tags"
            type="text"
            defaultValue={saved?.tags ?? initial.tags}
            aria-invalid={err("tags") ? true : undefined}
            aria-describedby={err("tags") ? "tags-error" : undefined}
            className={inputClass}
            placeholder="sinh-nhat, khai-truong"
          />
          {fieldError("tags")}
        </div>

        <fieldset className="flex flex-wrap gap-x-6 gap-y-3">
          <legend className="sr-only">Trạng thái sản phẩm</legend>
          <StyledCheckbox name="isActive" defaultChecked={saved?.isActive ?? initial.isActive}>
            Đang bán (hiện trên shop)
          </StyledCheckbox>
          <StyledCheckbox name="inStock" defaultChecked={saved?.inStock ?? initial.inStock}>
            Còn hàng
          </StyledCheckbox>
          <StyledCheckbox
            name="isFastDelivery"
            defaultChecked={saved?.isFastDelivery ?? initial.isFastDelivery}
          >
            Giao nhanh
          </StyledCheckbox>
        </fieldset>
      </section>

      <section aria-label="Ảnh sản phẩm" className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900">Ảnh sản phẩm</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ảnh đầu tiên là ảnh chính. Chỉ nhận JPEG, PNG, WebP, tối đa 2 MB/ảnh, tối đa 6 ảnh.
        </p>
        {images.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Chưa có ảnh nào.</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {images.map((url, index) => (
              <li key={url} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                <div className="relative aspect-square w-full overflow-hidden rounded bg-slate-100">
                  <Image src={url} alt={`Ảnh ${index + 1}`} width={300} height={300} unoptimized className="h-full w-full object-cover" />
                  {index === 0 ? (
                    <span className="absolute left-2 top-2 rounded bg-blue-600 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                      Ảnh chính
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 break-all text-xs text-slate-500">{url}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveImage(index, -1)}
                    aria-label={`Đưa ảnh ${index + 1} lên trước`}
                    className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-900 disabled:opacity-40"
                  >
                    ↑ Lên
                  </button>
                  <button
                    type="button"
                    disabled={index === images.length - 1}
                    onClick={() => moveImage(index, 1)}
                    aria-label={`Đưa ảnh ${index + 1} xuống sau`}
                    className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-900 disabled:opacity-40"
                  >
                    ↓ Xuống
                  </button>
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={`Gỡ ảnh ${index + 1} khỏi sản phẩm`}
                    className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-danger/40 bg-white text-sm font-bold text-danger"
                  >
                    Gỡ
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {images.map((url) => (
          <input key={url} type="hidden" name="images" value={url} />
        ))}
        <div className="mt-4">
          <label
            htmlFor="pf-upload"
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-blue-600 bg-white px-5 text-sm font-bold text-blue-600 transition-colors hover:bg-slate-100"
          >
            {uploading ? "Đang tải lên…" : "Tải ảnh lên"}
          </label>
          <input
            id="pf-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading || images.length >= MAX_IMAGES_PER_PRODUCT}
            onChange={handleUpload}
            className="sr-only"
          />
          <p className="mt-2 text-xs text-slate-500">
            File trên đĩa vẫn giữ lại khi gỡ khỏi sản phẩm; file không còn dùng sẽ được dọn sau 24 giờ.
          </p>
          {uploadError ? (
            <p role="alert" className="mt-2 text-sm font-medium text-danger">
              {uploadError}
            </p>
          ) : null}
          {fieldError("images")}
        </div>
      </section>

      {/* SEO riêng (Ngày 14 D1): phần gập, không bắt buộc. */}
      <SeoFieldsSection
        siteName={siteName}
        fallbackTitle={nameValue}
        fallbackDescription={saved?.description ?? initial.description}
        fallbackDescriptionNote="Để trống thì dùng mô tả sản phẩm (cắt 155 ký tự)."
        urlPath={urlPath}
        initialTitle={saved?.seoTitle ?? initial.seoTitle}
        initialDescription={saved?.seoDescription ?? initial.seoDescription}
        titleError={err("seoTitle")}
        descriptionError={err("seoDescription")}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          {mode === "create" ? "Lưu sản phẩm" : "Lưu thay đổi"}
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
            href="/admin/products"
            className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
          >
            Hủy
          </Link>
        )}
      </div>
    </form>
  );
}
