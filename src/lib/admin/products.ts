import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ProductFormValues } from "./product-validation";

// Truy vấn và ghi sản phẩm phía quản trị (Ngày 7 §3). Danh sách gồm
// cả sản phẩm đã ẩn; tìm theo tên/SKU dùng vi_unaccent; 20/trang.

export const ADMIN_PAGE_SIZE = 20;

export type AdminProductRow = {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  categoryId: number;
  categoryName: string;
  price: number;
  salePrice: number | null;
  image: string | null;
  isActive: boolean;
  inStock: boolean;
  sortOrder: number;
};

export type AdminProductList = {
  products: AdminProductRow[];
  total: number;
  totalPages: number;
  page: number;
};

export type ListAdminProductsOpts = {
  q?: string;
  categoryId?: number | null;
  status?: "all" | "active" | "hidden";
  page?: number;
};

export async function listAdminProducts(
  opts: ListAdminProductsOpts = {},
): Promise<AdminProductList> {
  const page = opts.page !== undefined && opts.page >= 1 ? opts.page : 1;
  const q = (opts.q ?? "").trim();
  const conditions: Prisma.Sql[] = [];
  if (q !== "") {
    // Tìm không dấu trong tên + SKU (bao gồm sản phẩm đã ẩn).
    conditions.push(
      Prisma.sql`strpos(vi_unaccent(p."name" || ' ' || coalesce(p."sku", '')), vi_unaccent(${q})) > 0`,
    );
  }
  if (opts.categoryId !== undefined && opts.categoryId !== null) {
    conditions.push(Prisma.sql`p."categoryId" = ${opts.categoryId}`);
  }
  if (opts.status === "active") {
    conditions.push(Prisma.sql`p."isActive" = true`);
  } else if (opts.status === "hidden") {
    conditions.push(Prisma.sql`p."isActive" = false`);
  }
  const where =
    conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      : Prisma.sql``;
  const rows = await db.$queryRaw<
    Array<{
      id: number;
      name: string;
      slug: string;
      sku: string | null;
      categoryId: number;
      categoryName: string;
      price: number;
      salePrice: number | null;
      images: string[];
      isActive: boolean;
      inStock: boolean;
      sortOrder: number;
      total: bigint;
    }>
  >(Prisma.sql`
    SELECT p."id", p."name", p."slug", p."sku", p."categoryId",
      c."name" AS "categoryName", p."price", p."salePrice", p."images",
      p."isActive", p."inStock", p."sortOrder", COUNT(*) OVER() AS "total"
    FROM "products" AS p
    JOIN "categories" AS c ON c."id" = p."categoryId"
    ${where}
    ORDER BY p."sortOrder" ASC, p."id" ASC
    LIMIT ${ADMIN_PAGE_SIZE} OFFSET ${(page - 1) * ADMIN_PAGE_SIZE}
  `);
  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  return {
    products: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      sku: r.sku,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      price: r.price,
      salePrice: r.salePrice,
      image: r.images[0] ?? null,
      isActive: r.isActive,
      inStock: r.inStock,
      sortOrder: r.sortOrder,
    })),
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / ADMIN_PAGE_SIZE),
    page,
  };
}

export type AdminProductDetail = {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  categoryId: number;
  categorySlug: string;
  price: number;
  salePrice: number | null;
  description: string;
  tags: string[];
  images: string[];
  sortOrder: number;
  isActive: boolean;
  inStock: boolean;
  isFastDelivery: boolean;
  seoTitle: string;
  seoDescription: string;
};

export async function getAdminProduct(id: number): Promise<AdminProductDetail | null> {
  const p = await db.product.findUnique({
    where: { id },
    include: { category: { select: { slug: true } } },
  });
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    categoryId: p.categoryId,
    categorySlug: p.category.slug,
    price: p.price,
    salePrice: p.salePrice,
    description: p.description,
    tags: p.tags,
    images: p.images,
    sortOrder: p.sortOrder,
    isActive: p.isActive,
    inStock: p.inStock,
    isFastDelivery: p.isFastDelivery,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
  };
}

export async function listAdminCategories(): Promise<Array<{ id: number; name: string }>> {
  return db.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });
}

// Lỗi trùng lặp (slug trong danh mục / SKU toàn hệ thống) — trả về
// trường lỗi để biểu mẫu hiện đúng chỗ, không ném lỗi 500.
export type ProductSaveConflict =
  | { field: "slug"; message: string }
  | { field: "sku"; message: string }
  | { field: "categoryId"; message: string };

export async function createAdminProduct(
  values: ProductFormValues,
): Promise<{ id: number } | { conflict: ProductSaveConflict }> {
  const category = await db.category.findUnique({ where: { id: values.categoryId } });
  if (!category) {
    return { conflict: { field: "categoryId", message: "Danh mục không tồn tại." } };
  }
  const slugClash = await db.product.findFirst({
    where: { categoryId: values.categoryId, slug: values.slug },
    select: { id: true },
  });
  if (slugClash) {
    return {
      conflict: {
        field: "slug",
        message: "Đường dẫn này đã dùng cho một sản phẩm khác trong cùng danh mục.",
      },
    };
  }
  if (values.sku !== null) {
    const skuClash = await db.product.findFirst({
      where: { sku: values.sku },
      select: { id: true },
    });
    if (skuClash) {
      return { conflict: { field: "sku", message: "SKU này đã dùng cho một sản phẩm khác." } };
    }
  }
  const created = await db.product.create({
    data: {
      name: values.name,
      slug: values.slug,
      sku: values.sku,
      categoryId: values.categoryId,
      price: values.price,
      salePrice: values.salePrice,
      description: values.description,
      tags: values.tags,
      images: values.images,
      sortOrder: values.sortOrder,
      isActive: values.isActive,
      inStock: values.inStock,
      isFastDelivery: values.isFastDelivery,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
    },
    select: { id: true },
  });
  return { id: created.id };
}

export async function updateAdminProduct(
  id: number,
  values: ProductFormValues,
): Promise<{ id: number } | { conflict: ProductSaveConflict } | null> {
  const existing = await db.product.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return null;
  const category = await db.category.findUnique({ where: { id: values.categoryId } });
  if (!category) {
    return { conflict: { field: "categoryId", message: "Danh mục không tồn tại." } };
  }
  const slugClash = await db.product.findFirst({
    where: { categoryId: values.categoryId, slug: values.slug, id: { not: id } },
    select: { id: true },
  });
  if (slugClash) {
    return {
      conflict: {
        field: "slug",
        message: "Đường dẫn này đã dùng cho một sản phẩm khác trong cùng danh mục.",
      },
    };
  }
  if (values.sku !== null) {
    const skuClash = await db.product.findFirst({
      where: { sku: values.sku, id: { not: id } },
      select: { id: true },
    });
    if (skuClash) {
      return { conflict: { field: "sku", message: "SKU này đã dùng cho một sản phẩm khác." } };
    }
  }
  await db.product.update({
    where: { id },
    data: {
      name: values.name,
      slug: values.slug,
      sku: values.sku,
      categoryId: values.categoryId,
      price: values.price,
      salePrice: values.salePrice,
      description: values.description,
      tags: values.tags,
      images: values.images,
      sortOrder: values.sortOrder,
      isActive: values.isActive,
      inStock: values.inStock,
      isFastDelivery: values.isFastDelivery,
      seoTitle: values.seoTitle,
      seoDescription: values.seoDescription,
    },
  });
  return { id };
}

// Ẩn/hiện sản phẩm (đổi isActive). Không có xóa cứng.
export async function setProductActive(id: number, isActive: boolean): Promise<boolean> {
  const result = await db.product.updateMany({
    where: { id },
    data: { isActive },
  });
  return result.count > 0;
}
