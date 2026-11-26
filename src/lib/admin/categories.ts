// Truy vấn + ghi danh mục cho trang quản trị (25/11 — trang quản
// lý Danh mục). Danh sách kèm số sản phẩm mỗi danh mục (để khóa
// xóa khi còn sản phẩm). Xóa chỉ cho phép khi danh mục trống;
// không có xóa cưỡng bức (xóa danh mục còn sản phẩm sẽ làm sản
// phẩm mồ côi — Product.categoryId bắt buộc).

import { db } from "../db";
import type { CategoryFormValues } from "./category-validation";

export type AdminCategoryRow = {
  id: number;
  name: string;
  slug: string;
  sortOrder: number;
  productCount: number;
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

export async function listAdminCategoriesWithCounts(): Promise<AdminCategoryRow[]> {
  const rows = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      _count: { select: { products: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    sortOrder: r.sortOrder,
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
  const created = await db.category.create({
    data: {
      name: values.name,
      slug: values.slug,
      sortOrder: values.sortOrder,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
    },
    select: { id: true },
  });
  return { id: created.id };
}

export async function updateAdminCategory(
  id: number,
  values: CategoryFormValues,
): Promise<{ id: number } | { conflict: CategorySaveConflict } | null> {
  const existing = await db.category.findUnique({
    where: { id },
    select: { id: true },
  });
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
  await db.category.update({
    where: { id },
    data: {
      name: values.name,
      slug: values.slug,
      sortOrder: values.sortOrder,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
    },
  });
  return { id };
}

export type DeleteCategoryResult =
  | { ok: true }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "has-products"; productCount: number };

// Xóa danh mục — chỉ khi không còn sản phẩm nào. Kiểm số sản phẩm
// ngay trong action (không tin con số từ giao diện): nếu vừa có
// sản phẩm mới thì từ chối, tránh xóa nhầm.
export async function deleteAdminCategory(id: number): Promise<DeleteCategoryResult> {
  const existing = await db.category.findUnique({
    where: { id },
    select: { id: true, _count: { select: { products: true } } },
  });
  if (!existing) return { ok: false, reason: "not-found" };
  if (existing._count.products > 0) {
    return {
      ok: false,
      reason: "has-products",
      productCount: existing._count.products,
    };
  }
  await db.category.delete({ where: { id } });
  return { ok: true };
}
