// Biểu mẫu tạo/sửa khu vực giao hàng quản trị (Ngày 12 C2 — theo
// mẫu CategoryForm). Kiểm tra ở MÁY CHỦ (Server Action): lỗi từng
// trường, giữ nguyên giá trị đã nhập (useActionState + defaultValue).
// Đổi tên khu vực không đổi tên khu vực đã lưu trên đơn cũ (đơn lưu
// tên khu vực tại lúc đặt — xem zones.ts).
//
// QUY TẮC ĐỨNG (25/11, theo Henry): mọi màn thêm/sửa trong hệ
// thống đều mở dạng POPUP — form này được dùng cả trong popup
// (intercepting route @modal, onSuccess="back") lẫn trang trực tiếp
// (onSuccess="list").

"use client";

import { useEffect, useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  initialAdminZoneState,
  type AdminZoneState,
} from "@/lib/admin/zone-form-state";

export type ZoneFormInitial = {
  name: string;
  fee: string;
  sortOrder: string;
  isActive: boolean;
};

const inputClass =
  "mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900";
const labelClass = "block text-sm font-semibold text-slate-900";

export default function ZoneForm({
  mode,
  initial,
  action,
  onSuccess = "list",
}: {
  mode: "create" | "edit";
  initial: ZoneFormInitial;
  action: (prevState: AdminZoneState, formData: FormData) => Promise<AdminZoneState>;
  // Sau khi lưu thành công: "back" quay lại trang trước (popup),
  // "list" về /admin/shipping-zones (trang trực tiếp). Mặc định "list".
  onSuccess?: "back" | "list";
}) {
  const router = useRouter();
  const [state, dispatch] = useActionState(action, initialAdminZoneState);
  useEffect(() => {
    if (state.ok) {
      if (onSuccess === "back") router.back();
      else router.push("/admin/shipping-zones");
    }
  }, [state.ok, onSuccess, router]);
  const saved = state.values;

  const err = (field: keyof AdminZoneState["fieldErrors"]) =>
    state.fieldErrors[field] ?? null;

  function fieldError(field: keyof AdminZoneState["fieldErrors"]) {
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
      {state.formError ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
          {state.formError}
        </p>
      ) : null}

      <section aria-label="Thông tin khu vực" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <label htmlFor="zf-name" className={labelClass}>
            Tên khu vực
          </label>
          <input
            id="zf-name"
            name="name"
            type="text"
            required
            defaultValue={saved?.name ?? initial.name}
            aria-invalid={err("name") ? true : undefined}
            aria-describedby={err("name") ? "name-error" : undefined}
            className={inputClass}
          />
          {fieldError("name")}
          <p className="mt-1 text-sm text-slate-500">
            Tên khu vực lưu trên đơn khi đặt hàng; đổi tên không đổi tên khu vực đã lưu trên
            đơn cũ.
          </p>
        </div>

        <div>
          <label htmlFor="zf-fee" className={labelClass}>
            Phí giao hàng (₫)
          </label>
          <input
            id="zf-fee"
            name="fee"
            type="number"
            min="0"
            max="1000000"
            step="1"
            defaultValue={saved?.fee ?? initial.fee}
            aria-invalid={err("fee") ? true : undefined}
            aria-describedby={err("fee") ? "fee-error" : undefined}
            className={inputClass}
          />
          {fieldError("fee")}
          <p className="mt-1 text-sm text-slate-500">
            Số nguyên từ 0 đến 1.000.000 ₫. Đổi phí thì đơn mới dùng phí mới ngay, đơn cũ giữ
            nguyên tổng tiền.
          </p>
        </div>

        <div>
          <label htmlFor="zf-sort" className={labelClass}>
            Thứ tự sắp xếp
          </label>
          <input
            id="zf-sort"
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

        <div className="flex items-center gap-3">
          <input
            id="zf-isActive"
            name="isActive"
            type="checkbox"
            defaultChecked={saved ? saved.isActive === "on" : initial.isActive}
            className="h-5 w-5 shrink-0 accent-blue-600"
          />
          <label htmlFor="zf-isActive" className="text-sm font-semibold text-slate-900">
            Đang bật (hiện ở trang thanh toán)
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          {mode === "create" ? "Lưu khu vực" : "Lưu thay đổi"}
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
            href="/admin/shipping-zones"
            className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
          >
            Hủy
          </Link>
        )}
      </div>
    </form>
  );
}
