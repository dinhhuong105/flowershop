// Truy vấn + ghi danh mục cho trang quản trị (25/11 — trang quản
// lý Danh mục). Danh sách kèm số sản phẩm mỗi danh mục (để khóa
// xóa khi còn sản phẩm). Xóa chỉ cho phép khi danh mục trống;
// không có xóa cưỡng bức (xóa danh mục còn sản phẩm sẽ làm sản
// phẩm mồ côi — Product.categoryId bắt buộc).

import { db } from "../db";
import type { CategoryFormValues } from "./category-validation";
import {
  changedFieldAudits,
  lifecycleAuditRow,
  writeCatalogAudits,
} from "./catalog-audit";
import { isProductSource, type ProductSource } from "./product-source";

export type AdminCategoryRow = {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
  productCount: number;
  // Nguồn dữ liệu (Ngày 17 P1) — chuỗi thô, xem products.ts.
  source: string;
};

export type AdminCategoryDetail = {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
  productCount: number;
  seoTitle: string;
  seoDescription: string;
};

export async function listAdminCategoriesWithCounts(
  opts: { source?: ProductSource | null } = {},
): Promise<AdminCategoryRow[]> {
  const rows = await db.category.findMany({
    where:
      opts.source !== undefined && opts.source !== null && isProductSource(opts.source)
        ? { source: opts.source }
        : undefined,
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      source: true,
      _count: { select: { products: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    sortOrder: r.sortOrder,
    source: r.source,
    productCount: r._count.products,
  }));
}

export async function getAdminCategory(id: number): Promise<AdminCategoryDetail | null> {
  const row = await db.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      seoTitle: true,
      seoDescription: true,
      _count: { select: { products: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sortOrder,
    productCount: row._count.products,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
  };
}

// Lỗi trùng lặp slug — trả về trường lỗi để biểu mẫu hiện đúng
// chỗ, không ném lỗi 500.
export type CategorySaveConflict = { field: "slug"; message: string };

// Slug danh mục không được trùng slug bất kỳ trang tĩnh nào
// (Ngày 15 B1 — chiều ngược lại: trang tĩnh đã chặn chiều kia từ
// Ngày 14, xem findSlugClash trong pages.ts). Nháp hay đã xuất bản
// đều chặn — vì dữ liệu cũ trùng thì route gốc ưu tiên trang tĩnh
// (xem README "Trang tĩnh và danh mục — quy tắc ưu tiên slug").
// Ngày 19 A1: chặn cả slug đã dùng cho bài tin tức (chiều ngược —
// trước đây chỉ tin tức chặn danh mục, danh mục không chặn tin tức).
async function findPageSlugClash(slug: string): Promise<CategorySaveConflict | null> {
  const pageClash = await db.page.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (pageClash) {
    return { field: "slug", message: "Đường dẫn này đã dùng cho một trang tĩnh." };
  }
  const newsClash = await db.newsArticle.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (newsClash) {
    return { field: "slug", message: "Đường dẫn này đã dùng cho một bài tin tức." };
  }
  return null;
}

export async function createAdminCategory(
  values: CategoryFormValues,
): Promise<{ id: number } | { conflict: CategorySaveConflict }> {
  const slugClash = await db.category.findFirst({
    where: { slug: values.slug },
    select: { id: true },
  });
  if (slugClash) {
    return {
      conflict: {
        field: "slug",
        message: "Đường dẫn này đã dùng cho một danh mục khác.",
      },
    };
  }
  const pageClash = await findPageSlugClash(values.slug);
  if (pageClash) return { conflict: pageClash };
  // Nguồn "manual" (P1) + nhật ký vòng đời "created" (P5), cùng
  // transaction với tạo danh mục.
  const created = await db.$transaction(async (tx) => {
    const row = await tx.category.create({
      data: {
        name: values.name,
        slug: values.slug,
        sortOrder: values.sortOrder,
        seoTitle: values.seoTitle,
        seoDescription: values.seoDescription,
        source: "manual",
      },
      select: { id: true },
    });
    await writeCatalogAudits(tx, [
      lifecycleAuditRow(`category:${row.id}`, null, "created"),
    ]);
    return row;
  });
  return { id: created.id };
}

export async function updateAdminCategory(
  id: number,
  values: CategoryFormValues,
): Promise<{ id: number } | { conflict: CategorySaveConflict } | null> {
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) return null;
  const slugClash = await db.category.findFirst({
    where: { slug: values.slug, id: { not: id } },
    select: { id: true },
  });
  if (slugClash) {
    return {
      conflict: {
        field: "slug",
        message: "Đường dẫn này đã dùng cho một danh mục khác.",
      },
    };
  }
  const pageClash = await findPageSlugClash(values.slug);
  if (pageClash) return { conflict: pageClash };
  const prefix = `category:${id}`;
  const fieldRows = changedFieldAudits(prefix, [
    { field: "name", oldValue: existing.name, newValue: values.name },
    { field: "slug", oldValue: existing.slug, newValue: values.slug },
    { field: "sortOrder", oldValue: existing.sortOrder, newValue: values.sortOrder },
    { field: "seoTitle", oldValue: existing.seoTitle, newValue: values.seoTitle },
    { field: "seoDescription", oldValue: existing.seoDescription, newValue: values.seoDescription },
  ]);
  const auditRows =
    fieldRows.length > 0
      ? fieldRows
      : [lifecycleAuditRow(prefix, existing.name, "updated")];
  await db.$transaction(async (tx) => {
    await tx.category.update({
      where: { id },
      data: {
        name: values.name,
        slug: values.slug,
        sortOrder: values.sortOrder,
        seoTitle: values.seoTitle,
        seoDescription: values.seoDescription,
      },
    });
    await writeCatalogAudits(tx, auditRows);
  });
  return { id };
}

export type DeleteCategoryResult =
  | { ok: true }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "has-products"; productCount: number };

// Xóa danh mục — chỉ khi không còn sản phẩm nào. Kiểm số sản phẩm
// ngay trong action (không tin con số từ giao diện): nếu vừa có
// sản phẩm mới thì từ chối, tránh xóa nhầm. Ghi nhật ký vòng đời
// "deleted" (P5) trong cùng transaction với xóa.
export async function deleteAdminCategory(id: number): Promise<DeleteCategoryResult> {
  const existing = await db.category.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { products: true } } },
  });
  if (!existing) return { ok: false, reason: "not-found" };
  if (existing._count.products > 0) {
    return {
      ok: false,
      reason: "has-products",
      productCount: existing._count.products,
    };
  }
  await db.$transaction(async (tx) => {
    await tx.category.delete({ where: { id } });
    await writeCatalogAudits(tx, [
      lifecycleAuditRow(`category:${id}`, existing.name, "deleted"),
    ]);
  });
  return { ok: true };
}
