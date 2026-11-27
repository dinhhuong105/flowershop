// Kiểm tra dữ liệu biểu mẫu tin tức quản trị (Ngày 18).
// Theo mẫu trang tĩnh (page-validation.ts): kiểm ở MÁY CHỦ, lỗi
// từng trường, giữ nguyên giá trị đã nhập. Kiểm tra duy nhất (slug)
// nằm ở src/lib/admin/news.ts. Tái dùng slugifyName + hằng của
// danh mục/sản phẩm/trang tĩnh.

import { isReservedSlug } from "@/lib/reserved-slugs";
import {
  MAX_PAGE_SEO_DESCRIPTION_LENGTH,
  MAX_PAGE_SEO_TITLE_LENGTH,
  MAX_PAGE_SLUG_LENGTH,
  MAX_PAGE_TITLE_LENGTH,
  MIN_PAGE_SLUG_LENGTH,
} from "./page-validation";
import { PRODUCT_SLUG_RE, slugifyName } from "./product-validation";

// Giới hạn theo đặc tả Ngày 18 (§9 "Ngưỡng deploy" + mẫu trang
// tĩnh): slug 2–60, tiêu đề 2–120, tóm tắt ≤ 200, nội dung ≤ 20.000,
// tác giả ≤ 100, ảnh đại diện ≤ 500 ký tự (URL do máy chủ sinh khi
// tải lên, hoặc dán URL), seoTitle ≤ 120, seoDescription ≤ 160.
export const MAX_NEWS_TITLE_LENGTH = MAX_PAGE_TITLE_LENGTH;
export const MIN_NEWS_SLUG_LENGTH = MIN_PAGE_SLUG_LENGTH;
export const MAX_NEWS_SLUG_LENGTH = MAX_PAGE_SLUG_LENGTH;
export const MAX_NEWS_EXCERPT_LENGTH = 200;
export const MAX_NEWS_CONTENT_LENGTH = 20000;
export const MAX_NEWS_AUTHOR_LENGTH = 100;
export const MAX_NEWS_COVER_IMAGE_LENGTH = 500;
export const MAX_NEWS_SEO_TITLE_LENGTH = MAX_PAGE_SEO_TITLE_LENGTH;
export const MAX_NEWS_SEO_DESCRIPTION_LENGTH = MAX_PAGE_SEO_DESCRIPTION_LENGTH;

// Dữ liệu thô từ FormData (mọi trường đều là chuỗi, trừ checkbox).
export type NewsFormInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  author: string;
  seoTitle: string;
  seoDescription: string;
  isPublished: boolean;
};

export type NewsFormValues = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  author: string;
  seoTitle: string;
  seoDescription: string;
  isPublished: boolean;
};

export type NewsFormErrors = Partial<
  Record<
    | "title"
    | "slug"
    | "excerpt"
    | "content"
    | "coverImage"
    | "author"
    | "seoTitle"
    | "seoDescription",
    string
  >
>;

// Ảnh đại diện: rỗng = không có ảnh; nếu có phải là đường dẫn nội bộ
// ("/..."), hoặc URL http(s) (ảnh Blob trả về URL tuyệt đối). Từ chối
// scheme lạ (javascript:, data:) và đường dẫn tương đối theo giao thức
// ("//...") — cùng quy tắc URL liên kết an toàn của markdown.ts.
export function isAllowedCoverImage(value: string): boolean {
  if (value === "") return true;
  if (/[\s"<>]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  if (/^https?:\/\//i.test(value)) return true;
  return false;
}

export function validateNewsForm(input: NewsFormInput): {
  errors: NewsFormErrors;
  values: NewsFormValues | null;
} {
  const errors: NewsFormErrors = {};

  const title = input.title.trim();
  if (title.length < 2 || title.length > MAX_NEWS_TITLE_LENGTH) {
    errors.title = "Tiêu đề phải từ 2 đến 120 ký tự.";
  }

  // Slug trống → tự sinh từ tiêu đề; slug nhập tay phải đúng mẫu,
  // 2–60 ký tự, và không được trùng đường dẫn cố định của hệ thống.
  const slug = input.slug.trim() === "" ? slugifyName(title) : input.slug.trim();
  if (slug.length < MIN_NEWS_SLUG_LENGTH || slug.length > MAX_NEWS_SLUG_LENGTH) {
    errors.slug = "Đường dẫn phải từ 2 đến 60 ký tự.";
  } else if (!PRODUCT_SLUG_RE.test(slug)) {
    errors.slug =
      "Đường dẫn chỉ gồm chữ thường, số và dấu gạch nối, không bắt đầu/kết thúc bằng dấu gạch nối.";
  } else if (isReservedSlug(slug)) {
    errors.slug = "Đường dẫn này đã được hệ thống dùng, vui lòng chọn đường dẫn khác.";
  }

  const excerpt = input.excerpt.trim();
  if (excerpt.length > MAX_NEWS_EXCERPT_LENGTH) {
    errors.excerpt = "Tóm tắt tối đa 200 ký tự.";
  }

  const content = input.content;
  if (content.length > MAX_NEWS_CONTENT_LENGTH) {
    errors.content = "Nội dung tối đa 20.000 ký tự.";
  }

  const coverImage = input.coverImage.trim();
  if (coverImage.length > MAX_NEWS_COVER_IMAGE_LENGTH) {
    errors.coverImage = "Đường dẫn ảnh đại diện tối đa 500 ký tự.";
  } else if (!isAllowedCoverImage(coverImage)) {
    errors.coverImage = "Ảnh đại diện phải là đường dẫn nội bộ hoặc URL http(s).";
  }

  const author = input.author.trim();
  if (author.length > MAX_NEWS_AUTHOR_LENGTH) {
    errors.author = "Tác giả tối đa 100 ký tự.";
  }

  const seoTitle = input.seoTitle.trim();
  if (seoTitle.length > MAX_NEWS_SEO_TITLE_LENGTH) {
    errors.seoTitle = "Tiêu đề SEO tối đa 120 ký tự.";
  }

  const seoDescription = input.seoDescription.trim();
  if (seoDescription.length > MAX_NEWS_SEO_DESCRIPTION_LENGTH) {
    errors.seoDescription = "Mô tả SEO tối đa 160 ký tự.";
  }

  if (Object.keys(errors).length > 0) return { errors, values: null };
  return {
    errors,
    values: {
      title,
      slug,
      excerpt,
      content,
      coverImage,
      author,
      seoTitle,
      seoDescription,
      isPublished: input.isPublished,
    },
  };
}
