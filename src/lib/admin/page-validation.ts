// Kiểm tra dữ liệu biểu mẫu trang tĩnh quản trị (Ngày 13 B1).
// Kiểm ở MÁY CHỦ, lỗi từng trường, giữ nguyên giá trị đã nhập.
// File này chỉ chứa quy tắc thuần (không truy vấn DB); kiểm tra
// duy nhất (slug) nằm ở src/lib/admin/pages.ts. Tái dùng
// slugifyName + hằng thứ tự của danh mục/sản phẩm.

import { isReservedSlug } from "@/lib/reserved-slugs";
import { isLegacyPath, needsReplaceConfirm } from "@/lib/legacy-paths";
import {
  MAX_PRODUCT_SORT_ORDER,
  MIN_PRODUCT_SORT_ORDER,
  PRODUCT_SLUG_RE,
  slugifyName,
} from "./product-validation";

// Giới hạn theo đặc tả Ngày 13 B1: slug 2–60, tiêu đề 2–120,
// nội dung ≤ 20.000. seoTitle/seoDescription không có giới hạn
// riêng trong đặc tả — lấy theo giới hạn SEO: tiêu đề ≤ 120
// (bằng tiêu đề trang), mô tả ≤ 160 (bằng mô tả mặc định C1).
export const MAX_PAGE_TITLE_LENGTH = 120;
export const MIN_PAGE_SLUG_LENGTH = 2;
export const MAX_PAGE_SLUG_LENGTH = 60;
export const MAX_PAGE_CONTENT_LENGTH = 20000;
export const MAX_PAGE_SEO_TITLE_LENGTH = 120;
export const MAX_PAGE_SEO_DESCRIPTION_LENGTH = 160;

// Dữ liệu thô từ FormData (mọi trường đều là chuỗi, trừ checkbox).
export type PageFormInput = {
  title: string;
  slug: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  sortOrder: string;
  isPublished: boolean;
  showInFooter: boolean;
  // Đường dẫn cũ thay thế ("" = không thay trang nào) — Ngày 14 C1.
  legacyPath: string;
  // Tick "Tôi hiểu" khi thay /contact, /faq hoặc /policy — Ngày 15 B2.
  // Không lưu vào DB; chỉ để kiểm tra lúc lưu.
  confirmReplace: boolean;
};

export type PageFormValues = {
  title: string;
  slug: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  sortOrder: number;
  isPublished: boolean;
  showInFooter: boolean;
  // null = không thay trang cũ nào.
  legacyPath: string | null;
  // Tick "Tôi hiểu" khi thay /contact, /faq hoặc /policy — Ngày 15 B2.
  // Không lưu vào DB; chỉ để create/updateAdminPage kiểm tra ở máy chủ.
  confirmReplace: boolean;
};

export type PageFormErrors = Partial<
  Record<
    | "title"
    | "slug"
    | "content"
    | "seoTitle"
    | "seoDescription"
    | "sortOrder"
    | "legacyPath"
    | "confirmReplace",
    string
  >
>;

// Đọc một trường số nguyên từ chuỗi: "1.5", "abc", "" → null.
function parseIntField(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}

export function validatePageForm(input: PageFormInput): {
  errors: PageFormErrors;
  values: PageFormValues | null;
} {
  const errors: PageFormErrors = {};

  const title = input.title.trim();
  if (title.length < 2 || title.length > MAX_PAGE_TITLE_LENGTH) {
    errors.title = "Tiêu đề phải từ 2 đến 120 ký tự.";
  }

  // Slug trống → tự sinh từ tiêu đề; slug nhập tay phải đúng mẫu,
  // 2–60 ký tự, và không được trùng đường dẫn cố định của hệ thống.
  const slug = input.slug.trim() === "" ? slugifyName(title) : input.slug.trim();
  if (slug.length < MIN_PAGE_SLUG_LENGTH || slug.length > MAX_PAGE_SLUG_LENGTH) {
    errors.slug = "Đường dẫn phải từ 2 đến 60 ký tự.";
  } else if (!PRODUCT_SLUG_RE.test(slug)) {
    errors.slug =
      "Đường dẫn chỉ gồm chữ thường, số và dấu gạch nối, không bắt đầu/kết thúc bằng dấu gạch nối.";
  } else if (isReservedSlug(slug)) {
    errors.slug = "Đường dẫn này đã được hệ thống dùng, vui lòng chọn đường dẫn khác.";
  }

  const content = input.content;
  if (content.length > MAX_PAGE_CONTENT_LENGTH) {
    errors.content = "Nội dung tối đa 20.000 ký tự.";
  }

  const seoTitle = input.seoTitle.trim();
  if (seoTitle.length > MAX_PAGE_SEO_TITLE_LENGTH) {
    errors.seoTitle = "Tiêu đề SEO tối đa 120 ký tự.";
  }

  const seoDescription = input.seoDescription.trim();
  if (seoDescription.length > MAX_PAGE_SEO_DESCRIPTION_LENGTH) {
    errors.seoDescription = "Mô tả SEO tối đa 160 ký tự.";
  }

  const sortOrder = input.sortOrder.trim() === "" ? 0 : parseIntField(input.sortOrder);
  if (sortOrder === null) {
    errors.sortOrder = "Thứ tự sắp xếp phải là số nguyên.";
  } else if (sortOrder < MIN_PRODUCT_SORT_ORDER || sortOrder > MAX_PRODUCT_SORT_ORDER) {
    errors.sortOrder = "Thứ tự sắp xếp phải từ 0 đến 9999.";
  }

  // Đường dẫn cũ thay thế (Ngày 14 C1): rỗng = không thay; nếu có
  // phải là một trong bốn đường dẫn cũ của shop.
  const legacyPathRaw = input.legacyPath.trim();
  let legacyPath: string | null = null;
  if (legacyPathRaw !== "") {
    if (!isLegacyPath(legacyPathRaw)) {
      errors.legacyPath = "Đường dẫn cũ không hợp lệ.";
    } else {
      legacyPath = legacyPathRaw;
    }
  }

  // Thay một trong ba đường dẫn cũ (/contact, /faq, /policy) thì
  // bắt buộc tick "Tôi hiểu" trước khi lưu (Ngày 15 B2). /about
  // không cần xác nhận. Kiểm ở máy chủ, không chỉ giao diện —
  // create/updateAdminPage kiểm lại bằng cùng quy tắc này.
  if (legacyPath !== null && needsReplaceConfirm(legacyPath) && !input.confirmReplace) {
    errors.confirmReplace = "Tick “Tôi hiểu” để xác nhận thay trang cũ này.";
  }

  if (Object.keys(errors).length > 0) return { errors, values: null };
  return {
    errors,
    values: {
      title,
      slug,
      content,
      seoTitle,
      seoDescription,
      sortOrder: sortOrder as number,
      isPublished: input.isPublished,
      showInFooter: input.showInFooter,
      legacyPath,
      confirmReplace: input.confirmReplace,
    },
  };
}
