// Biểu mẫu tạo/sửa danh mục quản trị (25/11 — trang quản lý Danh mục).
// Kiểm tra ở MÁY CHỦ (Server Action): lỗi từng trường, giữ nguyên
// giá trị đã nhập (useActionState + defaultValue). Slug tự sinh từ
// tên khi chưa sửa tay; đổi slug ở chế độ sửa thì cảnh báo link cũ
// sẽ báo 404 (trang danh mục ngoài shop dùng slug trong URL).
//
// QUY TẮC ĐỨNG (25/11, theo Henry): mọi màn thêm/sửa trong hệ
// thống đều mở dạng POPUP, không mở trang riêng — form này được
// dùng cả trong popup (intercepting route @modal, onSuccess="back")
// lẫn trang trực tiếp (onSuccess="list"). Sau khi lưu thành công
// (state.ok) thì form tự điều hướng theo onSuccess: "back" quay lại
// trang trước (giữ nguyên bộ lọc trên URL, dùng trong popup), "list"
// về /admin/categories (dùng ở trang trực tiếp).

"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { slugifyName } from "@/lib/admin/product-validation";
import {
  initialAdminCategoryState,
  type AdminCategoryState,
} from "@/lib/admin/category-form-state";

export type CategoryFormInitial = {
  name: string;
  slug: string;
  sortOrder: string;
};

const inputClass =
  "mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900";
const labelClass = "block text-sm font-semibold text-slate-900";

export default function CategoryForm({
  mode,
  initial,
  action,
  originalSlug,
  onSuccess = "list",
}: {
  mode: "create" | "edit";
  initial: CategoryFormInitial;
  action: (
    prevState: AdminCategoryState,
    formData: FormData,
  ) => Promise<AdminCategoryState>;
  originalSlug?: string;
  // Sau khi lưu thành công: "back" quay lại trang trước (popup),
  // "list" về /admin/categories (trang trực tiếp). Mặc định "list".
  onSuccess?: "back" | "list";
}) {
  const router = useRouter();
  const [state, dispatch] = useActionState(action, initialAdminCategoryState);
  useEffect(() => {
    if (state.ok) {
      if (onSuccess === "back") router.back();
      else router.push("/admin/categories");
    }
  }, [state.ok, onSuccess, router]);
  const saved = state.values;
  const slugRef = useRef<HTMLInputElement | null>(null);
  const slugTouchedRef = useRef(false);
  const [slugValue, setSlugValue] = useState(saved?.slug ?? initial.slug);

  const err = (field: keyof AdminCategoryState["fieldErrors"]) =>
    state.fieldErrors[field] ?? null;

  function fieldError(field: keyof AdminCategoryState["fieldErrors"]) {
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

  const slugChanged = mode === "edit" && originalSlug !== undefined && slugValue !== originalSlug;

  return (
    <form action={dispatch} className="space-y-5">
      {state.formError ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
          {state.formError}
        </p>
      ) : null}

      <section aria-label="Thông tin danh mục" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <label htmlFor="cf-name" className={labelClass}>
            Tên danh mục
          </label>
          <input
            id="cf-name"
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
          <label htmlFor="cf-slug" className={labelClass}>
            Đường dẫn (slug)
          </label>
          <input
            id="cf-slug"
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
              Đổi đường dẫn sẽ làm link cũ của trang danh mục báo 404.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="cf-sort" className={labelClass}>
            Thứ tự sắp xếp
          </label>
          <input
            id="cf-sort"
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
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          {mode === "create" ? "Lưu danh mục" : "Lưu thay đổi"}
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
            href="/admin/categories"
            className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
          >
            Hủy
          </Link>
        )}
      </div>
    </form>
  );
}
