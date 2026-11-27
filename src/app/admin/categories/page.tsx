import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdminCategoriesWithCounts } from "@/lib/admin/categories";
import { isProductSource, productSourceLabel } from "@/lib/admin/product-source";
import AdminIconButton, { PencilIcon } from "@/components/admin/AdminIconButton";
import DeleteCategoryButton from "@/components/admin/DeleteCategoryButton";
import CategoriesFilterBar from "@/components/admin/CategoriesFilterBar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Danh mục",
  robots: { index: false, follow: false },
};

// Danh sách danh mục quản trị (25/11 — trang quản lý Danh mục):
// dữ liệu danh mục đã có từ Ngày 1 (seed) nhưng trước giờ chỉ
// lọc/chọn trong các trang khác, chưa có trang quản lý riêng.
// Từ 768 px là bảng, dưới 768 px là thẻ. Danh mục còn sản phẩm
// thì nút xóa bị khóa (xóa chỉ cho phép khi trống).

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const sourceRaw = params.source ?? "";
  const source = isProductSource(sourceRaw) ? sourceRaw : "";
  const categories = await listAdminCategoriesWithCounts({
    source: source === "" ? null : source,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Danh mục</h1>
        <Link
          href="/admin/categories/new"
          className="ml-auto flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          + Thêm danh mục
        </Link>
      </div>
      <p role="status" className="mt-2 text-sm text-slate-500">
        Tìm thấy {categories.length} danh mục
      </p>

      <Suspense>
        <CategoriesFilterBar source={source} />
      </Suspense>

      {categories.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Chưa có danh mục nào.
        </p>
      ) : (
        <>
          {/* Bảng từ 768 px */}
          <div className="mt-6 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th scope="col" className="px-4 py-3 font-semibold">Tên</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Đường dẫn (slug)</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Số sản phẩm</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Nguồn</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Thứ tự</th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} data-testid="admin-category-row" className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <Link href={`/admin/categories/${c.id}`} className="inline-flex min-h-11 items-center font-bold text-slate-900 hover:text-blue-600 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/${c.slug}`} className="text-slate-500 hover:text-blue-600 hover:underline">
                        /{c.slug}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{c.productCount}</td>
                    <td className="px-4 py-3">{productSourceLabel(c.source)}</td>
                    <td className="px-4 py-3">{c.sortOrder}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AdminIconButton
                          href={`/admin/categories/${c.id}`}
                          label="Sửa danh mục"
                          icon={PencilIcon}
                          tooltipAlign="right"
                          className="border border-blue-600 bg-white text-blue-600 hover:bg-slate-100"
                        />
                        <DeleteCategoryButton
                          categoryId={c.id}
                          name={c.name}
                          productCount={c.productCount}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Thẻ dưới 768 px */}
          <ul className="mt-6 space-y-4 md:hidden">
            {categories.map((c) => (
              <li key={c.id} data-testid="admin-category-row" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <Link href={`/admin/categories/${c.id}`} className="inline-flex min-h-11 items-center font-bold text-slate-900 hover:text-blue-600 hover:underline">
                  {c.name}
                </Link>
                <p className="mt-1 text-sm text-slate-500">
                  /{c.slug} · {c.productCount} sản phẩm · Nguồn: {productSourceLabel(c.source)} · Thứ tự {c.sortOrder}
                </p>
                <div className="mt-3 flex gap-2">
                  <AdminIconButton
                    href={`/admin/categories/${c.id}`}
                    label="Sửa danh mục"
                    icon={PencilIcon}
                    className="border border-blue-600 bg-white text-blue-600 hover:bg-slate-100"
                  />
                  <DeleteCategoryButton
                    categoryId={c.id}
                    name={c.name}
                    productCount={c.productCount}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
