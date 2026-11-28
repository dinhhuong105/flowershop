import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ProductFormValues } from "./product-validation";
import {
  changedFieldAudits,
  lifecycleAuditRow,
  writeCatalogAudits,
} from "./catalog-audit";
import { BULK_PRODUCTS_MAX } from "./bulk-products";
import {
  isProductSource,
  type ProductSource,
} from "./product-source";

export { BULK_PRODUCTS_MAX };

// Truy vấn và ghi sản phẩm phía quản trị (Ngày 7 §3). Danh sách gồm
// cả sản phẩm đã ẩn; tìm theo tên/SKU dùng vi_unaccent; 20/trang.

export const ADMIN_PAGE_SIZE = 20;

// Khóa nhật ký của một sản phẩm (Ngày 18): dùng SKU thay cho id
// nội bộ để đọc được ngay ("product:HT-001.price" thay vì
// "product:1.price"); sản phẩm không có SKU thì dùng id. Dòng nhật
// ký CŨ vẫn giữ khóa product:<id> trong DB — lúc HIỂN THỊ,
// resolveActivityKeys (activity.ts) tra SKU theo id, sản phẩm đã
// xóa thì giữ nguyên id.
export function productAuditPrefix(product: {
  id: number;
  sku: string | null;
}): string {
  return `product:${product.sku ?? product.id}`;
}

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
  // Nguồn dữ liệu (Ngày 17 P1): seed mẫu / nhập tay / nhập file.
  // Giữ chuỗi thô (giá trị lạ trong DB hiện "Không rõ" qua
  // productSourceLabel, không tự nhận là seed).
  source: string;
  // Nhập sản phẩm (Ngày 20 C6): chờ duyệt + lô nhập để nối link.
  needsReview: boolean;
  importBatchId: number | null;
  sourceName: string | null;
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
  // Lọc theo nguồn (Ngày 17 P2): chỉ nhận đúng 3 giá trị, lạ → bỏ qua.
  // Ngày 20 C6: thêm "system" (seed + nhập tay = hàng hệ thống) và
  // lọc riêng needsReview (hàng chờ duyệt).
  source?: ProductSource | "system" | null;
  needsReview?: boolean;
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
  if (opts.source !== undefined && opts.source !== null) {
    if (opts.source === "system") {
      conditions.push(Prisma.sql`p."source" IN ('seed', 'manual')`);
    } else if (isProductSource(opts.source)) {
      conditions.push(Prisma.sql`p."source" = ${opts.source}`);
    }
  }
  if (opts.needsReview === true) {
    conditions.push(Prisma.sql`p."needsReview" = true`);
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
      source: string;
      needsReview: boolean;
      importBatchId: number | null;
      sourceName: string | null;
      total: bigint;
    }>
  >(Prisma.sql`
    SELECT p."id", p."name", p."slug", p."sku", p."categoryId",
      c."name" AS "categoryName", p."price", p."salePrice", p."images",
      p."isActive", p."inStock", p."sortOrder", p."source",
      p."needsReview", p."importBatchId", p."sourceName", COUNT(*) OVER() AS "total"
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
      source: r.source,
      needsReview: r.needsReview,
      importBatchId: r.importBatchId,
      sourceName: r.sourceName,
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
// Nguồn "manual": tạo trong admin (Ngày 17 P1). Tạo + ghi nhật ký
  // vòng đời trong cùng transaction (P5): lỗi ghi nhật ký thì sản
  // phẩm cũng không được tạo.
  const created = await db.$transaction(async (tx) => {
    const page = await tx.product.create({
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
        source: "manual",
      },
      select: { id: true, sku: true },
    });
    await writeCatalogAudits(tx, [
      lifecycleAuditRow(productAuditPrefix(page), null, "created"),
    ]);
    return page;
  });
  return { id: created.id };
}

export async function updateAdminProduct(
  id: number,
  values: ProductFormValues,
): Promise<{ id: number } | { conflict: ProductSaveConflict } | null> {
  // Đọc đủ bản ghi cũ để ghi nhật ký từng trường đã đổi (P5):
  // chỉ ghi các trường thay đổi thật (giá đổi → product:<sku>.price).
  const existing = await db.product.findUnique({ where: { id } });
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
  const oldCategory = await db.category.findUnique({
    where: { id: existing.categoryId },
    select: { name: true },
  });
  // Khóa nhật ký dùng SKU MỚI (values.sku) — nếu đổi SKU thì các
  // dòng của lần sửa này ghi dưới SKU mới; SKU cũ vẫn tra được qua
  // dòng đổi trường sku (product:<sku cũ>.sku). Không có SKU (cũ và
  // mới đều null) thì dùng id.
  const prefix = productAuditPrefix({ id, sku: values.sku ?? existing.sku });
  const fieldRows = changedFieldAudits(prefix, [
    { field: "name", oldValue: existing.name, newValue: values.name },
    { field: "slug", oldValue: existing.slug, newValue: values.slug },
    { field: "sku", oldValue: existing.sku, newValue: values.sku },
    {
      field: "categoryId",
      oldValue: oldCategory?.name ?? String(existing.categoryId),
      newValue: category.name,
    },
    { field: "price", oldValue: existing.price, newValue: values.price },
    { field: "salePrice", oldValue: existing.salePrice, newValue: values.salePrice },
    { field: "description", oldValue: existing.description, newValue: values.description },
    { field: "tags", oldValue: existing.tags, newValue: values.tags },
    { field: "images", oldValue: existing.images, newValue: values.images },
    { field: "sortOrder", oldValue: existing.sortOrder, newValue: values.sortOrder },
    {
      field: "isActive",
      oldValue: existing.isActive ? "Đang bán" : "Đã ẩn",
      newValue: values.isActive ? "Đang bán" : "Đã ẩn",
    },
    {
      field: "inStock",
      oldValue: existing.inStock ? "Còn hàng" : "Hết hàng",
      newValue: values.inStock ? "Còn hàng" : "Hết hàng",
    },
    {
      field: "isFastDelivery",
      oldValue: existing.isFastDelivery ? "Bật giao nhanh" : "Tắt giao nhanh",
      newValue: values.isFastDelivery ? "Bật giao nhanh" : "Tắt giao nhanh",
    },
    { field: "seoTitle", oldValue: existing.seoTitle, newValue: values.seoTitle },
    { field: "seoDescription", oldValue: existing.seoDescription, newValue: values.seoDescription },
  ]);
  // Sửa mà không đổi trường nào: vẫn ghi một dòng "updated" (theo
  // mẫu trang tĩnh) để lần sửa có dấu vết, thay vì im lặng.
  const auditRows =
    fieldRows.length > 0
      ? fieldRows
      : [lifecycleAuditRow(prefix, existing.name, "updated")];
  await db.$transaction(async (tx) => {
    await tx.product.update({
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
    await writeCatalogAudits(tx, auditRows);
  });
  return { id };
}

// Ẩn/hiện sản phẩm (đổi isActive). Không có xóa cứng.
// Ghi nhật ký product:<sku>.isActive ("Đang bán" ↔ "Đã ẩn") trong
// cùng transaction (P5); bấm lại cùng trạng thái thì không ghi
// dòng thừa.
export async function setProductActive(id: number, isActive: boolean): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({
      where: { id },
      select: { id: true, sku: true, name: true, isActive: true },
    });
    if (!existing) return false;
    if (existing.isActive === isActive) return true;
    await tx.product.update({ where: { id }, data: { isActive } });
    await writeCatalogAudits(
      tx,
      changedFieldAudits(productAuditPrefix(existing), [
        {
          field: "isActive",
          oldValue: existing.isActive ? "Đang bán" : "Đã ẩn",
          newValue: isActive ? "Đang bán" : "Đã ẩn",
        },
      ]),
    );
    return true;
  });
}

// Thao tác hàng loạt (Ngày 17 P3): ẩn/hiện NHIỀU sản phẩm cùng lúc.
// CHỈ cho phép ẩn/hiện — không có xóa hàng loạt (sản phẩm không có
// đường xóa cứng: đơn hàng tham chiếu tới sản phẩm; xóa sẽ làm mất
// gốc tra cứu). Tối đa 50 id/lần (BULK_PRODUCTS_MAX, xem
// bulk-products.ts); id không tồn tại được báo lại
// (missing) thay vì lỗi 500; mỗi sản phẩm đổi thật đều có một dòng
// nhật ký product:<sku>.isActive (P5). Toàn bộ trong một transaction.
export type BulkProductsResult = {
  updated: number;
  missing: number[];
};

export async function setProductsActiveBulk(
  ids: number[],
  isActive: boolean,
): Promise<BulkProductsResult> {
  const uniqueIds = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(
    0,
    BULK_PRODUCTS_MAX,
  );
  return db.$transaction(async (tx) => {
    const rows = await tx.product.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, sku: true, name: true, isActive: true },
    });
    const found = new Set(rows.map((r) => r.id));
    const missing = uniqueIds.filter((id) => !found.has(id));
    const toChange = rows.filter((r) => r.isActive !== isActive);
    if (toChange.length > 0) {
      await tx.product.updateMany({
        where: { id: { in: toChange.map((r) => r.id) } },
        data: { isActive },
      });
      const auditRows = toChange.flatMap((r) =>
        changedFieldAudits(productAuditPrefix(r), [
          {
            field: "isActive",
            oldValue: r.isActive ? "Đang bán" : "Đã ẩn",
            newValue: isActive ? "Đang bán" : "Đã ẩn",
          },
        ]),
      );
      await writeCatalogAudits(tx, auditRows);
    }
    return { updated: toChange.length, missing };
  });
}
