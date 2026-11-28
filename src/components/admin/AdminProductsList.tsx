// Danh sách sản phẩm quản trị, có chọn nhiều + thao tác hàng loạt
// (Ngày 17 P3): tick checkbox từng dòng (hoặc "chọn tất cả trên
// trang") rồi Ẩn/Hiện nhiều sản phẩm cùng lúc. CHỈ ẩn/hiện — không
// có xóa hàng loạt (xem bulk-products.ts). Mỗi lần bấm đều mở hộp
// xác nhận <dialog> ghi rõ số sản phẩm + hành động; máy chủ kiểm
// lại id + giới hạn 50 và ghi nhật ký từng sản phẩm (P5).
// Cột "Nguồn" (P1) hiện ở cả bảng (≥768 px) lẫn thẻ (<768 px).

"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatVND } from "@/lib/format";
import { productSourceLabel } from "@/lib/admin/product-source";
import type { AdminProductRow } from "@/lib/admin/products";
import {
  bulkToggleProductsAction,
  type BulkToggleProductsState,
} from "@/app/actions/admin";
import {
  approveImportedAction,
  rejectImportedAction,
  type ImportActionState,
} from "@/app/admin/products/import/actions";
import ToggleActiveButton from "@/components/admin/ToggleActiveButton";
import AdminIconButton, { PencilIcon } from "@/components/admin/AdminIconButton";

const checkboxClass = "h-5 w-5 accent-blue-600";

export default function AdminProductsList({ products }: { products: AdminProductRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [pendingAction, setPendingAction] = useState<"hide" | "show" | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, dispatch] = useActionState<BulkToggleProductsState, FormData>(
    bulkToggleProductsAction,
    { ok: false, error: null, updated: 0, missing: [] },
  );
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const lastHandled = useRef<BulkToggleProductsState | null>(null);

  // Duyệt hàng chờ duyệt (Ngày 20 C6): tối đa 50/lần, tùy chọn
  // đồng thời Hiện. Dùng hộp xác nhận riêng, cùng mẫu với Ẩn/Hiện.
  const [approvePending, setApprovePending] = useState(false);
  const approveDialogRef = useRef<HTMLDialogElement | null>(null);
  const [alsoShow, setAlsoShow] = useState(false);
  const [approveState, approveDispatch] = useActionState<ImportActionState, FormData>(
    approveImportedAction,
    { ok: false, error: null, message: null },
  );
  const lastApproveHandled = useRef<ImportActionState | null>(null);

  useEffect(() => {
    if (!state.ok || state === lastHandled.current) return;
    lastHandled.current = state;
    dialogRef.current?.close();
    setPendingAction(null);
    setSelected([]);
    setDoneMessage(
      state.updated > 0
        ? `Đã đổi trạng thái ${state.updated} sản phẩm.${state.error ? ` ${state.error}` : ""}`
        : (state.error ?? "Không đổi được sản phẩm nào."),
    );
    router.refresh();
  }, [state, router]);

  useEffect(() => {
    if (!approveState.ok || approveState === lastApproveHandled.current) return;
    lastApproveHandled.current = approveState;
    approveDialogRef.current?.close();
    setApprovePending(false);
    setSelected([]);
    setDoneMessage(approveState.message ?? "Đã duyệt sản phẩm.");
    router.refresh();
  }, [approveState, router]);

  const allSelected = products.length > 0 && selected.length === products.length;
  const toggleOne = (id: number, checked: boolean) => {
    setSelected((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  };
  const toggleAll = (checked: boolean) => {
    setSelected(checked ? products.map((p) => p.id) : []);
  };
  const openConfirm = (action: "hide" | "show") => {
    setPendingAction(action);
    setDoneMessage(null);
    dialogRef.current?.showModal();
  };

  const statusLabel = (p: AdminProductRow) =>
    p.isActive ? (
      <span className="font-semibold text-green-600">Đang bán</span>
    ) : (
      <span className="font-semibold text-danger">Đã ẩn</span>
    );

  return (
    <div>
      {doneMessage ? (
        <p role="status" className="mt-4 rounded-lg border border-green-800/30 bg-green-800/5 px-4 py-3 text-sm font-medium text-green-800">
          {doneMessage}
        </p>
      ) : null}
      {state.error && !state.ok ? (
        <p role="alert" className="mt-4 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
          {state.error}
        </p>
      ) : null}

      {selected.length > 0 ? (
        <div
          data-testid="bulk-product-bar"
          className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-blue-600/40 bg-blue-600/5 p-4"
        >
          <p role="status" className="text-sm font-bold text-slate-900">
            Đã chọn {selected.length} sản phẩm
          </p>
          <button
            type="button"
            onClick={() => openConfirm("hide")}
            className="flex min-h-11 items-center justify-center rounded-lg bg-slate-900 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Ẩn {selected.length} sản phẩm
          </button>
          <button
            type="button"
            onClick={() => openConfirm("show")}
            className="flex min-h-11 items-center justify-center rounded-lg bg-green-800 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Hiện {selected.length} sản phẩm
          </button>
          <button
            type="button"
            onClick={() => {
              setApprovePending(true);
              setDoneMessage(null);
              approveDialogRef.current?.showModal();
            }}
            className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Duyệt {selected.length} sản phẩm
          </button>
          <button
            type="button"
            onClick={() => setSelected([])}
            className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
          >
            Bỏ chọn
          </button>
        </div>
      ) : null}
      {approveState.error && !approveState.ok ? (
        <p role="alert" className="mt-4 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
          {approveState.error}
        </p>
      ) : null}

      {/* Hộp xác nhận duyệt hàng loạt (Ngày 20 C6). */}
      <dialog
        ref={approveDialogRef}
        aria-label="Xác nhận duyệt hàng loạt"
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-[0_24px_64px_rgba(15,30,51,0.35)] backdrop:bg-black/40"
      >
        {approvePending ? (
          <form action={approveDispatch}>
            <p className="text-base font-bold text-slate-900">
              Duyệt {selected.length} sản phẩm chờ duyệt?
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Chỉ sản phẩm đang chờ duyệt mới được duyệt (sản phẩm khác trong
              lựa chọn sẽ bị bỏ qua). Mỗi sản phẩm duyệt đều được ghi vào nhật ký.
            </p>
            {selected.map((id) => (
              <input key={id} type="hidden" name="ids" value={id} />
            ))}
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="alsoShow"
                checked={alsoShow}
                onChange={(e) => setAlsoShow(e.target.checked)}
                className="h-5 w-5 accent-blue-600"
              />
              Đồng thời Hiện (cho bán ngay)
            </label>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Duyệt sản phẩm
              </button>
              <button
                type="button"
                onClick={() => approveDialogRef.current?.close()}
                className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
              >
                Hủy
              </button>
            </div>
          </form>
        ) : null}
      </dialog>

      {/* Hộp xác nhận thao tác hàng loạt (theo mẫu DeleteCategoryButton). */}
      <dialog
        ref={dialogRef}
        aria-label="Xác nhận thao tác hàng loạt"
        className="m-auto w-[calc(100vw-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-[0_24px_64px_rgba(15,30,51,0.35)] backdrop:bg-black/40"
      >
        {pendingAction ? (
          <form action={dispatch}>
            <p className="text-base font-bold text-slate-900">
              {pendingAction === "hide"
                ? `Ẩn ${selected.length} sản phẩm?`
                : `Hiện ${selected.length} sản phẩm?`}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {pendingAction === "hide"
                ? "Các sản phẩm sẽ không còn hiện ra shop, nhưng đơn cũ và dữ liệu không mất. Có thể hiện lại bất cứ lúc nào."
                : "Các sản phẩm sẽ hiện lại ra shop ngay."}
              {" "}Mỗi sản phẩm đổi trạng thái đều được ghi vào nhật ký hoạt động.
            </p>
            {selected.map((id) => (
              <input key={id} type="hidden" name="productIds" value={id} />
            ))}
            <input
              type="hidden"
              name="isActive"
              value={pendingAction === "show" ? "true" : "false"}
            />
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-6 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                {pendingAction === "hide" ? "Ẩn sản phẩm" : "Hiện sản phẩm"}
              </button>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
              >
                Hủy
              </button>
            </div>
          </form>
        ) : null}
      </dialog>

      {/* Bảng từ 768 px */}
      <div className="mt-6 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <th scope="col" className="px-4 py-3 font-semibold">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả sản phẩm trên trang"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className={checkboxClass}
                />
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">Ảnh</th>
              <th scope="col" className="px-4 py-3 font-semibold">Tên / SKU</th>
              <th scope="col" className="px-4 py-3 font-semibold">Danh mục</th>
              <th scope="col" className="px-4 py-3 font-semibold">Nguồn</th>
              <th scope="col" className="px-4 py-3 font-semibold">Giá</th>
              <th scope="col" className="px-4 py-3 font-semibold">Trạng thái</th>
              <th scope="col" className="px-4 py-3 font-semibold">Kho</th>
              <th scope="col" className="px-4 py-3 font-semibold">
                <span className="sr-only">Thao tác</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} data-testid="admin-product-row" className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/70">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    data-testid="bulk-product-checkbox"
                    aria-label={`Chọn sản phẩm ${p.name}`}
                    checked={selected.includes(p.id)}
                    onChange={(e) => toggleOne(p.id, e.target.checked)}
                    className={checkboxClass}
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="block h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    <Image
                      src={p.image ?? "/images/placeholder.svg"}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/products/${p.id}`} className="inline-flex min-h-11 items-center font-bold text-slate-900 hover:text-blue-600 hover:underline">
                    {p.name}
                  </Link>
                  {p.sku ? <span className="block text-xs text-slate-500">SKU: {p.sku}</span> : null}
                </td>
                <td className="px-4 py-3">{p.categoryName}</td>
                <td className="px-4 py-3">
                  {p.importBatchId ? (
                    <Link
                      href={`/admin/products/import?batch=${p.importBatchId}`}
                      className="font-bold text-blue-600 hover:underline"
                    >
                      {productSourceLabel(p.source)}
                    </Link>
                  ) : (
                    productSourceLabel(p.source)
                  )}
                  {p.needsReview ? (
                    <span className="mt-1 block w-fit rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                      Chờ duyệt
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span className="font-bold text-slate-900">{formatVND(p.salePrice !== null && p.salePrice > 0 && p.salePrice < p.price ? p.salePrice : p.price)}</span>
                  {p.salePrice !== null && p.salePrice > 0 && p.salePrice < p.price ? (
                    <span className="block text-xs text-slate-500 line-through">{formatVND(p.price)}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{statusLabel(p)}</td>
                <td className="px-4 py-3">{p.inStock ? "Còn hàng" : "Hết hàng"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminIconButton
                      href={`/admin/products/${p.id}`}
                      label="Sửa sản phẩm"
                      icon={PencilIcon}
                      tooltipAlign="right"
                      className="border border-blue-600 bg-white text-blue-600 hover:bg-slate-100"
                    />
                    <ToggleActiveButton productId={p.id} isActive={p.isActive} />
                    {p.needsReview ? <ImportReviewButtons productId={p.id} /> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Thẻ dưới 768 px */}
      <ul className="mt-6 space-y-4 md:hidden">
        {products.map((p) => (
          <li key={p.id} data-testid="admin-product-row" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex gap-3">
              <input
                type="checkbox"
                data-testid="bulk-product-checkbox"
                aria-label={`Chọn sản phẩm ${p.name}`}
                checked={selected.includes(p.id)}
                onChange={(e) => toggleOne(p.id, e.target.checked)}
                className={`${checkboxClass} mt-1 shrink-0`}
              />
              <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                <Image
                  src={p.image ?? "/images/placeholder.svg"}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              </span>
              <div className="min-w-0">
                <Link href={`/admin/products/${p.id}`} className="inline-flex min-h-11 items-center font-bold text-slate-900 hover:text-blue-600 hover:underline">
                  {p.name}
                </Link>
                <p className="mt-1 text-sm text-slate-500">
                  {p.categoryName}
                  {p.sku ? ` · SKU: ${p.sku}` : ""}
                  {` · Nguồn: ${productSourceLabel(p.source)}`}
                  {p.needsReview ? " · Chờ duyệt" : ""}
                </p>
                <p className="mt-1 text-sm">
                  <span className="font-bold text-slate-900">{formatVND(p.salePrice !== null && p.salePrice > 0 && p.salePrice < p.price ? p.salePrice : p.price)}</span>
                  {" · "}
                  {statusLabel(p)}
                  {" · "}
                  {p.inStock ? "Còn hàng" : "Hết hàng"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminIconButton
                href={`/admin/products/${p.id}`}
                label="Sửa sản phẩm"
                icon={PencilIcon}
                className="border border-blue-600 bg-white text-blue-600 hover:bg-slate-100"
              />
              <ToggleActiveButton productId={p.id} isActive={p.isActive} />
              {p.needsReview ? <ImportReviewButtons productId={p.id} /> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Nút duyệt/từ chối từng sản phẩm chờ duyệt (Ngày 20 C6). Duyệt lẻ
// đồng thời Hiện để sản phẩm bán ngay; từ chối = xóa (ghi nhật ký).
function ImportReviewButtons({ productId }: { productId: number }) {
  const [approveState, approveDispatch] = useActionState<ImportActionState, FormData>(
    approveImportedAction,
    { ok: false, error: null, message: null },
  );
  const [rejectState, rejectDispatch] = useActionState<ImportActionState, FormData>(
    rejectImportedAction,
    { ok: false, error: null, message: null },
  );
  const error = approveState.error ?? rejectState.error;
  return (
    <>
      <form action={approveDispatch}>
        <input type="hidden" name="ids" value={productId} />
        <input type="hidden" name="alsoShow" value="on" />
        <button
          type="submit"
          className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Duyệt
        </button>
      </form>
      <form
        action={rejectDispatch}
        onSubmit={(e) => {
          if (
            !window.confirm(
              "Từ chối (xóa) sản phẩm này? Sản phẩm sẽ bị xóa khỏi kho và ghi vào nhật ký.",
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={productId} />
        <button
          type="submit"
          className="flex min-h-11 items-center justify-center rounded-lg border border-danger bg-white px-4 text-sm font-bold text-danger transition-colors hover:bg-danger/5"
        >
          Từ chối
        </button>
      </form>
      {error ? (
        <span role="alert" className="text-sm font-medium text-danger">
          {error}
        </span>
      ) : null}
    </>
  );
}
