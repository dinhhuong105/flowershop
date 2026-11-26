// Truy vấn + ghi trang tĩnh cho trang quản trị (Ngày 13 B1–B3)
// và mặt shop (B4). Chỉ trang isPublished mới trả về cho shop;
// nháp hoặc không tồn tại → null (trang shop trả 404).
// Tạo/sửa/xóa/xuất bản đều ghi settings_audit (khóa "page:<slug>",
// ai + lúc nào) trong cùng transaction với thay đổi.

import { db } from "../db";
import { isReservedSlug } from "@/lib/reserved-slugs";
import type { PageFormValues } from "./page-validation";

export type AdminPageRow = {
  id: number;
  title: string;
  slug: string;
  isPublished: boolean;
  showInFooter: boolean;
  sortOrder: number;
  updatedAt: Date;
  // Đường dẫn cũ thay thế (Ngày 14 C1), null = không thay trang nào.
  legacyPath: string | null;
};

export type AdminPageDetail = AdminPageRow & {
  content: string;
  seoTitle: string;
  seoDescription: string;
};

export type PublishedPage = {
  slug: string;
  title: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  updatedAt: Date;
};

export async function listAdminPages(): Promise<AdminPageRow[]> {
  return db.page.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      isPublished: true,
      showInFooter: true,
      sortOrder: true,
      updatedAt: true,
      legacyPath: true,
    },
  });
}

export async function getAdminPage(id: number): Promise<AdminPageDetail | null> {
  return db.page.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      isPublished: true,
      seoTitle: true,
      seoDescription: true,
      sortOrder: true,
      showInFooter: true,
      updatedAt: true,
      legacyPath: true,
    },
  });
}

// Trang đã xuất bản cho mặt shop (B4): nháp/không tồn tại → null.
export async function getPublishedPageBySlug(slug: string): Promise<PublishedPage | null> {
  return db.page.findFirst({
    where: { slug, isPublished: true },
    select: {
      slug: true,
      title: true,
      content: true,
      seoTitle: true,
      seoDescription: true,
      updatedAt: true,
    },
  });
}

// Trang đã xuất bản thay thế một đường dẫn cũ (Ngày 14 C1/C2):
// nháp/không tồn tại/không thay đường dẫn này → null.
export async function getPublishedPageByLegacyPath(
  legacyPath: string,
): Promise<PublishedPage | null> {
  return db.page.findFirst({
    where: { legacyPath, isPublished: true },
    select: {
      slug: true,
      title: true,
      content: true,
      seoTitle: true,
      seoDescription: true,
      updatedAt: true,
    },
  });
}

// Map đường dẫn cũ → slug trang mới đã xuất bản (Ngày 14 C3):
// dùng cho Footer, sitemap và liên kết nội bộ. Chỉ trang đã xuất
// bản mới được thay thế đường dẫn cũ.
export async function getLegacyReplacements(): Promise<Map<string, string>> {
  const rows = await db.page.findMany({
    where: { isPublished: true, legacyPath: { not: null } },
    select: { slug: true, legacyPath: true },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.legacyPath !== null) map.set(row.legacyPath, row.slug);
  }
  return map;
}

// Trang hiện ở chân trang (B4): đã xuất bản + showInFooter, theo
// thứ tự sortOrder.
export async function listFooterPages(): Promise<Array<{ slug: string; title: string }>> {
  return db.page.findMany({
    where: { isPublished: true, showInFooter: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { slug: true, title: true },
  });
}

// Seed ba trang mẫu (Ngày 13 B4): CHỈ khi bảng pages trống.
// Tất cả ở trạng thái NHÁP (chưa xuất bản) — nội dung chỉ là khung
// gạch đầu dòng ghi "chủ shop cần điền", không phải chính sách thật.
export async function seedDefaultPages(): Promise<number> {
  const count = await db.page.count();
  if (count > 0) return 0;
  const seeds: Array<{
    slug: string;
    title: string;
    content: string;
    sortOrder: number;
  }> = [
    {
      slug: "gioi-thieu",
      title: "Giới thiệu",
      content: [
        "- Chủ shop cần điền: giới thiệu về cửa hàng (tên, địa chỉ, năm bắt đầu, điểm khác biệt).",
        "- Chủ shop cần điền: các sản phẩm và dịch vụ chính.",
        "- Chủ shop cần điền: cách liên hệ với shop.",
      ].join("\n"),
      sortOrder: 1,
    },
    {
      slug: "chinh-sach-giao-hang-thanh-toan",
      title: "Chính sách giao hàng & thanh toán",
      content: [
        "- Chủ shop cần điền: khu vực giao hàng và phí giao.",
        "- Chủ shop cần điền: thời gian giao hàng (giao nhanh, giao trong ngày, hẹn giờ).",
        "- Chủ shop cần điền: phương thức thanh toán (COD, chuyển khoản).",
      ].join("\n"),
      sortOrder: 2,
    },
    {
      slug: "chinh-sach-doi-tra",
      title: "Chính sách đổi trả",
      content: [
        "- Chủ shop cần điền: điều kiện đổi trả (hoa héo, giao sai, thời hạn).",
        "- Chủ shop cần điền: cách thức đổi trả và hoàn tiền.",
      ].join("\n"),
      sortOrder: 3,
    },
  ];
  await db.page.createMany({
    data: seeds.map((s) => ({ ...s, isPublished: false, showInFooter: false })),
  });
  return seeds.length;
}
export type PageSaveConflict = {
  field: "slug" | "legacyPath";
  message: string;
};

// Slug không được trùng trang khác, không trùng slug danh mục
// (B1), không trùng đường dẫn cố định (phòng thủ thêm — form đã
// kiểm trước).
async function findSlugClash(
  slug: string,
  excludeId?: number,
): Promise<PageSaveConflict | null> {
  if (isReservedSlug(slug)) {
    return {
      field: "slug",
      message: "Đường dẫn này đã được hệ thống dùng, vui lòng chọn đường dẫn khác.",
    };
  }
  const pageClash = await db.page.findFirst({
    where: { slug, ...(excludeId !== undefined ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (pageClash) {
    return { field: "slug", message: "Đường dẫn này đã dùng cho một trang khác." };
  }
  const categoryClash = await db.category.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (categoryClash) {
    return { field: "slug", message: "Đường dẫn này đã dùng cho một danh mục." };
  }
  return null;
}

// Một đường dẫn cũ chỉ được một trang thay thế (Ngày 14 C1).
// DB có unique index làm chốt chặn; kiểm trước để báo lỗi thân thiện.
async function findLegacyPathClash(
  legacyPath: string | null,
  excludeId?: number,
): Promise<PageSaveConflict | null> {
  if (legacyPath === null) return null;
  const clash = await db.page.findFirst({
    where: {
      legacyPath,
      ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, slug: true },
  });
  if (clash) {
    return {
      field: "legacyPath",
      message: `Đường dẫn cũ này đã được trang /${clash.slug} thay thế.`,
    };
  }
  return null;
}

export async function createAdminPage(
  values: PageFormValues,
): Promise<{ id: number } | { conflict: PageSaveConflict }> {
  const clash = await findSlugClash(values.slug);
  if (clash) return { conflict: clash };
  const legacyClash = await findLegacyPathClash(values.legacyPath);
  if (legacyClash) return { conflict: legacyClash };
  const created = await db.$transaction(async (tx) => {
    const page = await tx.page.create({
      data: {
        slug: values.slug,
        title: values.title,
        content: values.content,
        isPublished: values.isPublished,
        seoTitle: values.seoTitle,
        seoDescription: values.seoDescription,
        sortOrder: values.sortOrder,
        showInFooter: values.showInFooter,
        legacyPath: values.legacyPath,
      },
      select: { id: true, slug: true },
    });
    await tx.settingsAudit.create({
      data: { key: `page:${page.slug}`, oldValue: null, newValue: "created", updatedBy: "admin" },
    });
    return page;
  });
  return { id: created.id };
}

export async function updateAdminPage(
  id: number,
  values: PageFormValues,
): Promise<{ id: number } | { conflict: PageSaveConflict } | null> {
  const existing = await db.page.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true, legacyPath: true },
  });
  if (!existing) return null;
  const clash = await findSlugClash(values.slug, id);
  if (clash) return { conflict: clash };
  const legacyClash = await findLegacyPathClash(values.legacyPath, id);
  if (legacyClash) return { conflict: legacyClash };
  const legacyChanged = existing.legacyPath !== values.legacyPath;
  await db.$transaction(async (tx) => {
    await tx.page.update({
      where: { id },
      data: {
        slug: values.slug,
        title: values.title,
        content: values.content,
        isPublished: values.isPublished,
        seoTitle: values.seoTitle,
        seoDescription: values.seoDescription,
        sortOrder: values.sortOrder,
        showInFooter: values.showInFooter,
        legacyPath: values.legacyPath,
      },
    });
    await tx.settingsAudit.create({
      data: {
        key: `page:${values.slug}`,
        oldValue: existing.title,
        newValue: "updated",
        updatedBy: "admin",
      },
    });
    // Ghi rõ thay đổi legacyPath (cùng transaction) để nhật ký
    // hoạt động thấy được ai thay/gỡ trang cũ nào.
    if (legacyChanged) {
      await tx.settingsAudit.create({
        data: {
          key: `page:${values.slug}`,
          oldValue: existing.legacyPath ?? "(không thay trang cũ)",
          newValue:
            values.legacyPath === null
              ? "(đã gỡ thay thế)"
              : `thay thế ${values.legacyPath}`,
          updatedBy: "admin",
        },
      });
    }
  });
  return { id };
}

// Bật/tắt xuất bản không cần xác nhận (B3): đảo trạng thái, ghi
// nhật ký. Trả false khi trang không tồn tại.
export async function setAdminPagePublished(id: number, isPublished: boolean): Promise<boolean> {
  const existing = await db.page.findUnique({
    where: { id },
    select: { id: true, slug: true, isPublished: true },
  });
  if (!existing) return false;
  if (existing.isPublished === isPublished) return true;
  await db.$transaction(async (tx) => {
    await tx.page.update({ where: { id }, data: { isPublished } });
    await tx.settingsAudit.create({
      data: {
        key: `page:${existing.slug}`,
        oldValue: existing.isPublished ? "published" : "draft",
        newValue: isPublished ? "published" : "draft",
        updatedBy: "admin",
      },
    });
  });
  return true;
}

export type DeletePageResult = { ok: true } | { ok: false; reason: "not-found" };

export async function deleteAdminPage(id: number): Promise<DeletePageResult> {
  const existing = await db.page.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true },
  });
  if (!existing) return { ok: false, reason: "not-found" };
  await db.$transaction(async (tx) => {
    await tx.page.delete({ where: { id } });
    await tx.settingsAudit.create({
      data: {
        key: `page:${existing.slug}`,
        oldValue: existing.title,
        newValue: "deleted",
        updatedBy: "admin",
      },
    });
  });
  return { ok: true };
}
