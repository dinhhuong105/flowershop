import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdminCategories, listAdminProducts } from "@/lib/admin/products";
import { isProductSource } from "@/lib/admin/product-source";
import { Suspense } from "react";
import ProductsFilterBar from "@/components/admin/ProductsFilterBar";
import AdminProductsList from "@/components/admin/AdminProductsList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sản phẩm",
  robots: { index: false, follow: false },
};

// Danh sách sản phẩm quản trị (Ngày 7 §3): gồm cả sản phẩm đã ẩn;
// tìm theo tên/SKU (không dấu), lọc danh mục/trạng thái/nguồn,
// 20/trang. Từ 768 px là bảng, dưới 768 px là thẻ.
// Cột "Nguồn" (Ngày 17 P1) + thao tác hàng loạt ẩn/hiện (P3) nằm
// trong AdminProductsList.

function pageHref(
  base: { q: string; category: string; status: string; source: string },
  page: number,
): string {
  const parts: string[] = [];
  if (base.q !== "") parts.push(`q=${encodeURIComponent(base.q)}`);
  if (base.category !== "") parts.push(`category=${encodeURIComponent(base.category)}`);
  if (base.status !== "all") parts.push(`status=${encodeURIComponent(base.status)}`);
  if (base.source !== "") parts.push(`source=${encodeURIComponent(base.source)}`);
  if (page > 1) parts.push(`page=${page}`);
  return parts.length > 0 ? `/admin/products?${parts.join("&")}` : "/admin/products";
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string; source?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const categoryRaw = params.category ?? "";
  const categoryId = /^\d+$/.test(categoryRaw) ? Number(categoryRaw) : null;
  const status =
    params.status === "active" || params.status === "hidden" ? params.status : "all";
  const sourceRaw = params.source ?? "";
  const source = isProductSource(sourceRaw) ? sourceRaw : "";
  const page = Math.max(1, Number(params.page) || 1);
  const [list, categories] = await Promise.all([
    listAdminProducts({ q, categoryId, status, source: source === "" ? null : source, page }),
    listAdminCategories(),
  ]);
  const base = { q, category: categoryRaw, status, source };

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

      {/* Thanh lọc tự động (25/11, theo góp ý của Henry: chọn
          là lọc ngay, không còn nút "Lọc"). */}
      <Suspense>
        <ProductsFilterBar q={q} category={categoryRaw} status={status} source={source} categories={categories} />
      </Suspense>

      {list.products.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Không tìm thấy sản phẩm nào.
        </p>
      ) : (
        <>
          <AdminProductsList products={list.products} />

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
