import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdminCategories, listAdminProducts } from "@/lib/admin/products";
import { formatVND } from "@/lib/format";
import ToggleActiveButton from "@/components/admin/ToggleActiveButton";
import AdminIconButton, { PencilIcon } from "@/components/admin/AdminIconButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sản phẩm",
  robots: { index: false, follow: false },
};

// Danh sách sản phẩm quản trị (Ngày 7 §3): gồm cả sản phẩm đã ẩn;
// tìm theo tên/SKU (không dấu), lọc danh mục/trạng thái, 20/trang.
// Từ 768 px là bảng, dưới 768 px là thẻ.

function pageHref(
  base: { q: string; category: string; status: string },
  page: number,
): string {
  const parts: string[] = [];
  if (base.q !== "") parts.push(`q=${encodeURIComponent(base.q)}`);
  if (base.category !== "") parts.push(`category=${encodeURIComponent(base.category)}`);
  if (base.status !== "all") parts.push(`status=${encodeURIComponent(base.status)}`);
  if (page > 1) parts.push(`page=${page}`);
  return parts.length > 0 ? `/admin/products?${parts.join("&")}` : "/admin/products";
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const categoryRaw = params.category ?? "";
  const categoryId = /^\d+$/.test(categoryRaw) ? Number(categoryRaw) : null;
  const status =
    params.status === "active" || params.status === "hidden" ? params.status : "all";
  const page = Math.max(1, Number(params.page) || 1);
  const [list, categories] = await Promise.all([
    listAdminProducts({ q, categoryId, status, page }),
    listAdminCategories(),
  ]);
  const base = { q, category: categoryRaw, status };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Sản phẩm</h1>
        <Link
          href="/admin/products/new"
          className="ml-auto flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          + Thêm sản phẩm
        </Link>
      </div>
      <p role="status" className="mt-2 text-sm text-slate-500">
        Tìm thấy {list.total} sản phẩm
        {list.totalPages > 1 ? ` — trang ${list.page}/${list.totalPages}` : ""}
      </p>

      <form method="get" action="/admin/products" className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-48 flex-1">
          <label htmlFor="admin-q" className="block text-sm font-semibold text-slate-900">
            Tìm theo tên/SKU
          </label>
          <input
            id="admin-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Ví dụ: hong, HT-001"
            className="mt-1 block w-full min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
          />
        </div>
        <div>
          <label htmlFor="admin-category" className="block text-sm font-semibold text-slate-900">
            Danh mục
          </label>
          <select
            id="admin-category"
            name="category"
            defaultValue={categoryRaw}
            className="mt-1 block min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
          >
            <option value="">Tất cả</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="admin-status" className="block text-sm font-semibold text-slate-900">
            Trạng thái
          </label>
          <select
            id="admin-status"
            name="status"
            defaultValue={status}
            className="mt-1 block min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
          >
            <option value="all">Tất cả</option>
            <option value="active">Đang bán</option>
            <option value="hidden">Đã ẩn</option>
          </select>
        </div>
        <button
          type="submit"
          className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          Lọc
        </button>
      </form>

      {list.products.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Không tìm thấy sản phẩm nào.
        </p>
      ) : (
        <>
          {/* Bảng từ 768 px */}
          <div className="mt-6 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th scope="col" className="px-4 py-3 font-semibold">Ảnh</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Tên / SKU</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Danh mục</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Giá</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Kho</th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.products.map((p) => (
                  <tr key={p.id} data-testid="admin-product-row" className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/70">
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
                      {/* K-5 (Ngày 8): link tên cao ≥ 44 px (inline-flex + min-h-11). */}
                      <Link href={`/admin/products/${p.id}`} className="inline-flex min-h-11 items-center font-bold text-slate-900 hover:text-blue-600 hover:underline">
                        {p.name}
                      </Link>
                      {p.sku ? <span className="block text-xs text-slate-500">SKU: {p.sku}</span> : null}
                    </td>
                    <td className="px-4 py-3">{p.categoryName}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-900">{formatVND(p.salePrice !== null && p.salePrice > 0 && p.salePrice < p.price ? p.salePrice : p.price)}</span>
                      {p.salePrice !== null && p.salePrice > 0 && p.salePrice < p.price ? (
                        <span className="block text-xs text-slate-500 line-through">{formatVND(p.price)}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {p.isActive ? (
                        <span className="font-semibold text-green-600">Đang bán</span>
                      ) : (
                        <span className="font-semibold text-danger">Đã ẩn</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{p.inStock ? "Còn hàng" : "Hết hàng"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AdminIconButton
                          href={`/admin/products/${p.id}`}
                          label="Sửa sản phẩm"
                          icon={PencilIcon}
                          tooltipAlign="right"
                          className="border border-blue-600 bg-white text-blue-600 transition-colors hover:bg-slate-100"
                        />
                        <ToggleActiveButton productId={p.id} productName={p.name} isActive={p.isActive} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Thẻ dưới 768 px */}
          <ul className="mt-6 space-y-4 md:hidden">
            {list.products.map((p) => (
              <li key={p.id} data-testid="admin-product-row" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex gap-3">
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
                    {/* K-5 (Ngày 8): link tên cao ≥ 44 px. */}
                    <Link href={`/admin/products/${p.id}`} className="inline-flex min-h-11 items-center font-bold text-slate-900 hover:text-blue-600 hover:underline">
                      {p.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">
                      {p.categoryName}
                      {p.sku ? ` · SKU: ${p.sku}` : ""}
                    </p>
                    <p className="mt-1 text-sm">
                      <span className="font-bold text-slate-900">{formatVND(p.salePrice !== null && p.salePrice > 0 && p.salePrice < p.price ? p.salePrice : p.price)}</span>
                      {" · "}
                      {p.isActive ? (
                        <span className="font-semibold text-green-600">Đang bán</span>
                      ) : (
                        <span className="font-semibold text-danger">Đã ẩn</span>
                      )}
                      {" · "}
                      {p.inStock ? "Còn hàng" : "Hết hàng"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <AdminIconButton
                    href={`/admin/products/${p.id}`}
                    label="Sửa sản phẩm"
                    icon={PencilIcon}
                    className="border border-blue-600 bg-white text-blue-600 transition-colors hover:bg-slate-100"
                  />
                  <ToggleActiveButton productId={p.id} productName={p.name} isActive={p.isActive} />
                </div>
              </li>
            ))}
          </ul>

          {list.totalPages > 1 ? (
            <nav aria-label="Phân trang" className="mt-6 flex items-center justify-center gap-3">
              {list.page > 1 ? (
                <Link
                  href={pageHref(base, list.page - 1)}
                  className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 hover:bg-slate-100"
                >
                  ← Trang trước
                </Link>
              ) : null}
              <span className="text-sm text-slate-500">
                Trang {list.page}/{list.totalPages}
              </span>
              {list.page < list.totalPages ? (
                <Link
                  href={pageHref(base, list.page + 1)}
                  className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 hover:bg-slate-100"
                >
                  Trang sau →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
