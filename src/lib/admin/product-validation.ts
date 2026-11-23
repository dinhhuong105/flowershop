// Kiểm tra dữ liệu biểu mẫu sản phẩm quản trị (Ngày 7 §3) — kiểm
// ở MÁY CHỦ, lỗi từng trường, giữ nguyên giá trị đã nhập. File này
// chỉ chứa quy tắc thuần (không truy vấn DB); kiểm tra duy nhất/trùng
// (slug, SKU, danh mục tồn tại) nằm ở src/lib/admin/products.ts.

// Bỏ dấu tiếng Việt để sinh slug: NFD rồi bỏ dấu tổ hợp, đ→d.
export function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const PRODUCT_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const PRODUCT_SKU_RE = /^[A-Z0-9-]{2,20}$/;
export const MAX_PRODUCT_NAME_LENGTH = 120;
export const MAX_PRODUCT_SLUG_LENGTH = 80;
export const MAX_PRODUCT_DESCRIPTION_LENGTH = 2000;
export const MAX_PRODUCT_TAGS = 10;
export const MAX_PRODUCT_TAG_LENGTH = 30;
export const MIN_PRODUCT_PRICE = 1000;
export const MAX_PRODUCT_PRICE = 100000000;
export const MIN_PRODUCT_SORT_ORDER = 0;
export const MAX_PRODUCT_SORT_ORDER = 9999;

// Dữ liệu thô từ FormData (mọi trường đều là chuỗi).
export type ProductFormInput = {
  name: string;
  slug: string;
  sku: string;
  categoryId: string;
  price: string;
  salePrice: string;
  description: string;
  tags: string;
  sortOrder: string;
  isActive: boolean;
  inStock: boolean;
  isFastDelivery: boolean;
  images: string[];
};

export type ProductFormValues = {
  name: string;
  slug: string;
  sku: string | null;
  categoryId: number;
  price: number;
  salePrice: number | null;
  description: string;
  tags: string[];
  sortOrder: number;
  isActive: boolean;
  inStock: boolean;
  isFastDelivery: boolean;
  images: string[];
};

export type ProductFormErrors = Partial<
  Record<
    | "name"
    | "slug"
    | "sku"
    | "categoryId"
    | "price"
    | "salePrice"
    | "description"
    | "tags"
    | "sortOrder"
    | "images",
    string
  >
>;

// Tags nhập cách nhau dấu phẩy → dạng slug, bỏ trùng, giữ thứ tự.
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = slugifyName(part.trim());
    if (tag === "" || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

// Đọc một trường số nguyên từ chuỗi: "1.5", "abc", "" → null.
function parseIntField(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}

export function validateProductForm(
  input: ProductFormInput,
  // Ảnh đã có của sản phẩm khi SỬA (mặc định rỗng khi TẠO MỚI):
  // sản phẩm mẫu dùng /images/placeholder.svg, không khớp mẫu
  // /uploads/... — nhưng đó là ảnh đã lưu hợp lệ, phải cho sửa
  // giá/tên mà không bắt buộc gỡ ảnh. Ảnh MỚI thêm vào vẫn phải
  // khớp mẫu /uploads/... do máy chủ sinh. (Phát hiện Ngày 7 —
  // trước sửa này, sửa sản phẩm mẫu luôn lỗi "Ảnh không hợp lệ".)
  existingImages: string[] = [],
): {
  errors: ProductFormErrors;
  values: ProductFormValues | null;
} {
  const errors: ProductFormErrors = {};

  const name = input.name.trim();
  if (name.length < 3 || name.length > MAX_PRODUCT_NAME_LENGTH) {
    errors.name = "Tên sản phẩm phải từ 3 đến 120 ký tự.";
  }

  // Slug trống → tự sinh từ tên; slug nhập tay phải đúng mẫu, ≤ 80.
  const slug = input.slug.trim() === "" ? slugifyName(name) : input.slug.trim();
  if (slug === "" || slug.length > MAX_PRODUCT_SLUG_LENGTH) {
    errors.slug = "Đường dẫn phải từ 1 đến 80 ký tự.";
  } else if (!PRODUCT_SLUG_RE.test(slug)) {
    errors.slug = "Đường dẫn chỉ gồm chữ thường, số và dấu gạch nối, không bắt đầu/kết thúc bằng dấu gạch nối.";
  }

  // SKU tùy chọn; chuẩn hoá về chữ hoa rồi kiểm mẫu.
  const sku = input.sku.trim().toUpperCase();
  if (sku !== "" && !PRODUCT_SKU_RE.test(sku)) {
    errors.sku = "SKU chỉ gồm chữ hoa, số và dấu gạch nối, từ 2 đến 20 ký tự.";
  }

  const categoryId = parseIntField(input.categoryId);
  if (categoryId === null || categoryId <= 0) {
    errors.categoryId = "Vui lòng chọn danh mục.";
  }

  const price = parseIntField(input.price);
  if (price === null) {
    errors.price = "Giá phải là số nguyên (VND).";
  } else if (price < MIN_PRODUCT_PRICE || price > MAX_PRODUCT_PRICE) {
    errors.price = "Giá phải từ 1.000 đến 100.000.000 ₫.";
  }

  // salePrice rỗng → null; nếu có thì phải là số nguyên và 0 < salePrice < price.
  let salePrice: number | null = null;
  if (input.salePrice.trim() !== "") {
    const parsed = parseIntField(input.salePrice);
    if (parsed === null) {
      errors.salePrice = "Giá khuyến mãi phải là số nguyên (VND).";
    } else if (parsed <= 0 || (price !== null && parsed >= price)) {
      errors.salePrice = "Giá khuyến mãi phải lớn hơn 0 và nhỏ hơn giá gốc.";
    } else {
      salePrice = parsed;
    }
  }

  const description = input.description.trim();
  if (description.length > MAX_PRODUCT_DESCRIPTION_LENGTH) {
    errors.description = "Mô tả tối đa 2.000 ký tự.";
  }

  const tags = parseTags(input.tags);
  if (tags.length > MAX_PRODUCT_TAGS) {
    errors.tags = "Tối đa 10 thẻ tag.";
  } else if (tags.some((t) => t.length > MAX_PRODUCT_TAG_LENGTH)) {
    errors.tags = "Mỗi tag tối đa 30 ký tự.";
  }

  const sortOrder = input.sortOrder.trim() === "" ? 0 : parseIntField(input.sortOrder);
  if (sortOrder === null) {
    errors.sortOrder = "Thứ tự sắp xếp phải là số nguyên.";
  } else if (sortOrder < MIN_PRODUCT_SORT_ORDER || sortOrder > MAX_PRODUCT_SORT_ORDER) {
    errors.sortOrder = "Thứ tự sắp xếp phải từ 0 đến 9999.";
  }

  // Ảnh: mỗi URL phải đúng dạng /uploads/<12 ký tự hex>.<ext> do máy
  // chủ sinh (không nhận URL ngoài), hoặc là ảnh đã có của sản phẩm
  // đang sửa; tối đa 6 ảnh.
  const images = input.images.filter((u) => u.trim() !== "");
  const allowedExisting = new Set(existingImages);
  if (images.length > 6) {
    errors.images = "Tối đa 6 ảnh cho một sản phẩm.";
  } else if (
    images.some(
      (u) =>
        !/^\/uploads\/[a-f0-9]{12}\.(jpg|png|webp)$/.test(u) &&
        !allowedExisting.has(u),
    )
  ) {
    errors.images = "Ảnh không hợp lệ.";
  }

  if (Object.keys(errors).length > 0) return { errors, values: null };
  return {
    errors,
    values: {
      name,
      slug,
      sku: sku === "" ? null : sku,
      categoryId: categoryId as number,
      price: price as number,
      salePrice,
      description,
      tags,
      sortOrder: sortOrder as number,
      isActive: input.isActive,
      inStock: input.inStock,
      isFastDelivery: input.isFastDelivery,
      images,
    },
  };
}
