// Truy vấn + ghi tin tức cho trang quản trị (Ngày 18) và mặt
// shop (/tin-tuc, /tin-tuc/[slug]). Theo mẫu trang tĩnh
// (pages.ts): chỉ bài isPublished mới trả về cho shop; nháp hoặc
// không tồn tại → null (trang chi tiết trả 404). Tạo/sửa/xóa/xuất
// bản đều ghi settings_audit (khóa "article:<slug>" theo bản Ngày
// 18 của Claude, Message 68 — ai + lúc nào) trong cùng transaction
// với thay đổi. Dòng nhật ký cũ khóa "news:<slug>" (Ngày 18) vẫn
// hiện đúng khu vực "Tin tức" (xem activityAreaOf).

import { cache } from "react";
import { db } from "../db";
import { PAGE_SIZE } from "@/config/catalog";
import { isReservedSlug } from "@/lib/reserved-slugs";
import type { NewsFormValues } from "./news-validation";

export type AdminNewsRow = {
  id: number;
  title: string;
  slug: string;
  author: string;
  isPublished: boolean;
  // Ngày đăng hiển thị = publishedAt ?? createdAt (đặc tả Ngày 18).
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminNewsDetail = AdminNewsRow & {
  excerpt: string;
  content: string;
  coverImage: string;
  seoTitle: string;
  seoDescription: string;
};

export type PublishedNewsArticle = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  author: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  seoTitle: string;
  seoDescription: string;
};

// Ngày đăng hiển thị của một bài: publishedAt ?? createdAt.
export function newsDisplayDate(article: {
  publishedAt: Date | null;
  createdAt: Date;
}): Date {
  return article.publishedAt ?? article.createdAt;
}

// Điều kiện "đã tới giờ hiện ra shop" (Ngày 19 A1 — hẹn giờ xuất
// bản): bài đã bật xuất bản NHƯNG publishedAt còn trong tương lai
// thì chưa hiện (danh sách, chi tiết, tìm kiếm, sitemap). Bài
// chưa hẹn giờ (publishedAt null) hiện ngay khi đã xuất bản.
// `now` truyền vào để test được; mặc định giờ hiện tại.
export function publishedVisibleWhere(now: Date = new Date()) {
  return {
    OR: [{ publishedAt: null }, { publishedAt: { lte: now } }],
  };
}

// Nhãn trạng thái trong danh sách admin (bản Ngày 18 của Claude:
// Nháp / Đã xuất bản / Hẹn giờ). Bài đã bật xuất bản nhưng
// publishedAt còn trong tương lai → "Hẹn giờ" (chưa hiện ra shop).
// `now` truyền vào để test được; mặc định giờ hiện tại.
export function newsStatusLabel(
  article: { isPublished: boolean; publishedAt: Date | null },
  now: Date = new Date(),
): "Nháp" | "Đã xuất bản" | "Hẹn giờ" {
  if (!article.isPublished) return "Nháp";
  if (article.publishedAt !== null && article.publishedAt > now) return "Hẹn giờ";
  return "Đã xuất bản";
}

export type NewsListFilters = {
  status?: "all" | "published" | "draft" | "scheduled";
  q?: string;
};

export async function listAdminNews(
  filters: NewsListFilters = {},
  now: Date = new Date(),
): Promise<AdminNewsRow[]> {
  const q = (filters.q ?? "").trim();
  return db.newsArticle.findMany({
    where: {
      ...(filters.status === "published"
        ? { isPublished: true }
        : filters.status === "draft"
          ? { isPublished: false }
          : filters.status === "scheduled"
            ? { isPublished: true, publishedAt: { gt: now } }
            : {}),
      ...(q === ""
        ? {}
        : {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      author: true,
      isPublished: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getAdminNews(id: number): Promise<AdminNewsDetail | null> {
  return db.newsArticle.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImage: true,
      author: true,
      isPublished: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      seoTitle: true,
      seoDescription: true,
    },
  });
}

// Danh sách tin ĐÃ XUẤT BẢN cho mặt shop: mới nhất trước,
// publishedAt DESC + id DESC làm tiebreaker chống "nhảy thứ tự"
// (cùng quy tắc ổn định như danh sách đơn). Bài chưa xuất bản
// không bao giờ lọt vào đây.
export type PublishedNewsList = {
  rows: Array<AdminNewsRow & { excerpt: string; coverImage: string }>;
  total: number;
  totalPages: number;
  page: number;
};

export async function listPublishedNews(
  page = 1,
  pageSize: number = PAGE_SIZE,
  now: Date = new Date(),
): Promise<PublishedNewsList> {
  const current = page >= 1 ? page : 1;
  const where = { isPublished: true, ...publishedVisibleWhere(now) };
  const [rows, total] = await Promise.all([
    db.newsArticle.findMany({
      where,
      orderBy: [
        { publishedAt: { sort: "desc", nulls: "last" } },
        { id: "desc" },
      ],
      skip: (current - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        author: true,
        isPublished: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.newsArticle.count({ where }),
  ]);
  return {
    rows,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    page: current,
  };
}

// Bài đã xuất bản cho mặt shop: nháp/không tồn tại → null.
// Bài hẹn giờ tương lai cũng → null (chưa tới giờ đăng, Ngày 19 A1).
export async function getPublishedNewsBySlug(
  slug: string,
  now: Date = new Date(),
): Promise<PublishedNewsArticle | null> {
  return db.newsArticle.findFirst({
    where: { slug, isPublished: true, ...publishedVisibleWhere(now) },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      coverImage: true,
      author: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      seoTitle: true,
      seoDescription: true,
    },
  });
}

// Chi tiết đã xuất bản theo slug, dùng chung MỘT truy vấn trong
// cùng request (theo mẫu getPublishedPageBySlugCached, Ngày 15 B3):
// generateMetadata + render của route [slug] đều gọi hàm này;
// React.cache() gộp hai lần tra thành một query duy nhất.
export const getPublishedNewsBySlugCached = cache(
  async (slug: string): Promise<PublishedNewsArticle | null> =>
    getPublishedNewsBySlug(slug),
);

export type NewsSaveConflict = {
  field: "slug";
  message: string;
};

// Slug không được trùng bài khác, không trùng slug danh mục, không
// trùng slug trang tĩnh (hai chiều đều bị chặn lúc lưu — danh mục/
// trang tĩnh trùng tin tức cũng bị chặn ở tầng ghi của chúng vì
// tin tức nay nằm trong kiểm va chạm slug, xem scripts/
// check-slug-collisions.ts), không trùng đường dẫn cố định
// (phòng thủ thêm — form đã kiểm trước).
async function findSlugClash(
  slug: string,
  excludeId?: number,
): Promise<NewsSaveConflict | null> {
  if (isReservedSlug(slug)) {
    return {
      field: "slug",
      message: "Đường dẫn này đã được hệ thống dùng, vui lòng chọn đường dẫn khác.",
    };
  }
  const newsClash = await db.newsArticle.findFirst({
    where: { slug, ...(excludeId !== undefined ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (newsClash) {
    return { field: "slug", message: "Đường dẫn này đã dùng cho một bài tin tức khác." };
  }
  const categoryClash = await db.category.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (categoryClash) {
    return { field: "slug", message: "Đường dẫn này đã dùng cho một danh mục." };
  }
  const pageClash = await db.page.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (pageClash) {
    return { field: "slug", message: "Đường dẫn này đã dùng cho một trang tĩnh." };
  }
  return null;
}

// publishedAt lúc tạo/sửa QUA FORM (Ngày 19 A1): giờ hẹn nhập
// tay là chuẩn — kể cả lưu nháp (nháp hẹn giờ tương lai, bật xuất
// bản sau vẫn giữ giờ hẹn đó). Không hẹn + đang xuất bản → now;
// không hẹn + nháp → null (chưa có ngày đăng; bật xuất bản sau
// bằng nút toggle sẽ đặt now, xem publishedAtForSave). Xóa giờ hẹn
// đã có trên bài đang xuất bản → now (đăng ngay).
function publishedAtForFormSave(
  isPublished: boolean,
  scheduled: Date | null,
): Date | null {
  if (scheduled !== null) return scheduled;
  if (isPublished) return new Date();
  return null;
}

// publishedAt khi BẬT/TẮT xuất bản bằng nút toggle (không qua
// form): xuất bản lần đầu mà đang null → now; về nháp thì giữ
// nguyên publishedAt cũ (xuất bản lại giữ ngày đăng gốc); đã có
// publishedAt thì không đổi.
function publishedAtForSave(
  isPublished: boolean,
  existingPublishedAt: Date | null,
): Date | null {
  if (isPublished && existingPublishedAt === null) return new Date();
  return existingPublishedAt;
}

export async function createAdminNews(
  values: NewsFormValues,
): Promise<{ id: number } | { conflict: NewsSaveConflict }> {
  const clash = await findSlugClash(values.slug);
  if (clash) return { conflict: clash };
  const created = await db.$transaction(async (tx) => {
    const article = await tx.newsArticle.create({
      data: {
        slug: values.slug,
        title: values.title,
        excerpt: values.excerpt,
        content: values.content,
        coverImage: values.coverImage,
        author: values.author,
        isPublished: values.isPublished,
        publishedAt: publishedAtForFormSave(values.isPublished, values.publishedAt),
        seoTitle: values.seoTitle,
        seoDescription: values.seoDescription,
      },
      select: { id: true, slug: true },
    });
    await tx.settingsAudit.create({
      data: { key: `article:${article.slug}`, oldValue: null, newValue: "created", updatedBy: "admin" },
    });
    return article;
  });
  return { id: created.id };
}

export async function updateAdminNews(
  id: number,
  values: NewsFormValues,
): Promise<{ id: number } | { conflict: NewsSaveConflict } | null> {
  const existing = await db.newsArticle.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true, publishedAt: true },
  });
  if (!existing) return null;
  const clash = await findSlugClash(values.slug, id);
  if (clash) return { conflict: clash };
  await db.$transaction(async (tx) => {
    await tx.newsArticle.update({
      where: { id },
      data: {
        slug: values.slug,
        title: values.title,
        excerpt: values.excerpt,
        content: values.content,
        coverImage: values.coverImage,
        author: values.author,
        isPublished: values.isPublished,
        publishedAt: publishedAtForFormSave(values.isPublished, values.publishedAt),
        seoTitle: values.seoTitle,
        seoDescription: values.seoDescription,
      },
    });
    await tx.settingsAudit.create({
      data: {
        key: `article:${values.slug}`,
        oldValue: existing.title,
        newValue: "updated",
        updatedBy: "admin",
      },
    });
  });
  return { id };
}

// Bật/tắt xuất bản không cần xác nhận (theo mẫu trang tĩnh): đảo
// trạng thái, ghi nhật ký bằng nhãn Việt riêng của tin tức
// ("Đã xuất bản" / "Đã chuyển về nháp" — xem formatActivityChange).
// Xuất bản bài có slug trùng danh mục/trang tĩnh thì TỪ CHỐI
// (lỗi này chỉ gặp với dữ liệu cũ — tạo/sửa đã chặn trùng từ đầu).
export type SetNewsPublishedResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "slug-clash" };

export async function setAdminNewsPublished(
  id: number,
  isPublished: boolean,
): Promise<SetNewsPublishedResult> {
  const existing = await db.newsArticle.findUnique({
    where: { id },
    select: { id: true, slug: true, isPublished: true, publishedAt: true },
  });
  if (!existing) return { ok: false, reason: "not-found" };
  if (existing.isPublished === isPublished) return { ok: true };
  if (isPublished) {
    const categoryClash = await db.category.findUnique({
      where: { slug: existing.slug },
      select: { id: true },
    });
    if (categoryClash) return { ok: false, reason: "slug-clash" };
    const pageClash = await db.page.findUnique({
      where: { slug: existing.slug },
      select: { id: true },
    });
    if (pageClash) return { ok: false, reason: "slug-clash" };
  }
  await db.$transaction(async (tx) => {
    await tx.newsArticle.update({
      where: { id },
      data: {
        isPublished,
        publishedAt: publishedAtForSave(isPublished, existing.publishedAt),
      },
    });
    await tx.settingsAudit.create({
      data: {
        key: `article:${existing.slug}`,
        oldValue: existing.isPublished ? "published" : "draft",
        newValue: isPublished ? "news-published" : "news-draft",
        updatedBy: "admin",
      },
    });
  });
  return { ok: true };
}

export type DeleteNewsResult = { ok: true } | { ok: false; reason: "not-found" };

export async function deleteAdminNews(id: number): Promise<DeleteNewsResult> {
  const existing = await db.newsArticle.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true },
  });
  if (!existing) return { ok: false, reason: "not-found" };
  await db.$transaction(async (tx) => {
    await tx.newsArticle.delete({ where: { id } });
    await tx.settingsAudit.create({
      data: {
        key: `article:${existing.slug}`,
        oldValue: existing.title,
        newValue: "deleted",
        updatedBy: "admin",
      },
    });
  });
  return { ok: true };
}
