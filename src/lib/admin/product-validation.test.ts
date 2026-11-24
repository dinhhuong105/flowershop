import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseTags,
  slugifyName,
  validateProductForm,
  type ProductFormInput,
} from "./product-validation";

function baseInput(overrides: Partial<ProductFormInput> = {}): ProductFormInput {
  return {
    name: "Bó Hoa Đồng Tiền Thử Nghiệm",
    slug: "",
    sku: "",
    categoryId: "1",
    price: "750000",
    salePrice: "",
    description: "Mô tả thử nghiệm",
    tags: "sinh-nhat, khai-truong",
    sortOrder: "0",
    isActive: true,
    inStock: true,
    isFastDelivery: false,
    images: [],
    ...overrides,
  };
}

describe("slugifyName", () => {
  it("Bó Hoa Đồng Tiền Thử Nghiệm → bo-hoa-dong-tien-thu-nghiem", () => {
    assert.equal(slugifyName("Bó Hoa Đồng Tiền Thử Nghiệm"), "bo-hoa-dong-tien-thu-nghiem");
  });
  it("bỏ dấu, đ→d, gộp dấu gạch nối", () => {
    assert.equal(slugifyName("  Hoa   Hồng!! Đỏ  "), "hoa-hong-do");
    assert.equal(slugifyName("Đẹp & Lạ"), "dep-la");
  });
});

describe("parseTags", () => {
  it("cách nhau dấu phẩy → dạng slug, bỏ trùng, bỏ rỗng", () => {
    assert.deepEqual(parseTags("Sinh Nhật, khai-truong, sinh nhật , ,"), [
      "sinh-nhat",
      "khai-truong",
    ]);
  });
  it("rỗng → []", () => {
    assert.deepEqual(parseTags(""), []);
  });
});

describe("validateProductForm", () => {
  it("hợp lệ: slug tự sinh từ tên, SKU về chữ hoa", () => {
    const { errors, values } = validateProductForm(
      baseInput({ sku: "ht-999", tags: "Sinh Nhật" }),
    );
    assert.deepEqual(errors, {});
    assert.equal(values?.slug, "bo-hoa-dong-tien-thu-nghiem");
    assert.equal(values?.sku, "HT-999");
    assert.deepEqual(values?.tags, ["sinh-nhat"]);
    assert.equal(values?.salePrice, null);
  });
  it("tên 2 ký tự → lỗi, không có values", () => {
    const { errors, values } = validateProductForm(baseInput({ name: "ab" }));
    assert.equal(errors.name, "Tên sản phẩm phải từ 3 đến 120 ký tự.");
    assert.equal(values, null);
  });
  it("giá 0, -1, 1.5, abc, 100000001 → lỗi", () => {
    for (const price of ["0", "-1", "1.5", "abc", "100000001"]) {
      const { errors, values } = validateProductForm(baseInput({ price }));
      assert.ok(errors.price, `giá ${price} phải lỗi`);
      assert.equal(values, null);
    }
  });
  it("salePrice bằng hoặc lớn hơn giá gốc → lỗi; nhỏ hơn → ok", () => {
    assert.ok(validateProductForm(baseInput({ salePrice: "750000" })).errors.salePrice);
    assert.ok(validateProductForm(baseInput({ salePrice: "800000" })).errors.salePrice);
    assert.ok(validateProductForm(baseInput({ salePrice: "0" })).errors.salePrice);
    assert.equal(
      validateProductForm(baseInput({ salePrice: "700000" })).values?.salePrice,
      700000,
    );
  });
  it("K-3: salePrice 1 ₫ và 999 ₫ → lỗi (phải ≥ 1.000); 1.000 → ok", () => {
    assert.equal(
      validateProductForm(baseInput({ salePrice: "1" })).errors.salePrice,
      "Giá khuyến mãi phải từ 1.000 ₫ và nhỏ hơn giá gốc.",
    );
    assert.ok(validateProductForm(baseInput({ salePrice: "999" })).errors.salePrice);
    assert.equal(
      validateProductForm(baseInput({ salePrice: "1000" })).values?.salePrice,
      1000,
    );
  });
  it("K-4: ảnh do client gửi không có trong DB → lỗi, dù action đã đọc ảnh đã có từ DB", () => {
    // existingImages là ảnh action đọc từ DB theo id sản phẩm (không
    // lấy từ FormData) — xem updateProductAction. Client gửi thêm
    // "/images/khac.svg" (không nằm trong DB) → lỗi "Ảnh không hợp lệ."
    const placeholder = "/images/placeholder.svg";
    assert.equal(
      validateProductForm(baseInput({ images: ["/images/khac.svg"] }), [placeholder])
        .errors.images,
      "Ảnh không hợp lệ.",
    );
    // Tạo mới (không có ảnh đã có) gửi ảnh lạ → lỗi.
    assert.ok(
      validateProductForm(baseInput({ images: ["/images/khac.svg"] })).errors.images,
    );
    // Ảnh đã có trong DB thì được giữ.
    assert.deepEqual(
      validateProductForm(baseInput({ images: [placeholder] }), [placeholder]).errors,
      {},
    );
  });
  it("slug hoa/khoảng trắng/'--' → lỗi", () => {
    for (const slug of ["Hoa Hong", "hoa  hong", "hoa--hong", "-hoa", "hoa-"]) {
      const { errors } = validateProductForm(baseInput({ slug }));
      assert.ok(errors.slug, `slug ${slug} phải lỗi`);
    }
  });
  it("slug dài quá 80 → lỗi", () => {
    const { errors } = validateProductForm(baseInput({ slug: "a".repeat(81) }));
    assert.ok(errors.slug);
  });
  it("SKU sai mẫu → lỗi", () => {
    const { errors } = validateProductForm(baseInput({ sku: "a" }));
    assert.ok(errors.sku);
  });
  it("11 tag → lỗi; tag dài quá 30 → lỗi", () => {
    const many = Array.from({ length: 11 }, (_, i) => `tag-${i}`).join(", ");
    assert.ok(validateProductForm(baseInput({ tags: many })).errors.tags);
    assert.ok(
      validateProductForm(baseInput({ tags: "a".repeat(31) })).errors.tags,
    );
  });
  it("danh mục không chọn → lỗi; sortOrder ngoài 0–9999 → lỗi", () => {
    assert.ok(validateProductForm(baseInput({ categoryId: "" })).errors.categoryId);
    assert.ok(validateProductForm(baseInput({ sortOrder: "10000" })).errors.sortOrder);
    assert.ok(validateProductForm(baseInput({ sortOrder: "-1" })).errors.sortOrder);
  });
  it("mô tả quá 2000 ký tự → lỗi", () => {
    assert.ok(
      validateProductForm(baseInput({ description: "x".repeat(2001) })).errors.description,
    );
  });
  it("tên chứa thẻ HTML được giữ nguyên dạng văn bản (React thoát khi hiển thị)", () => {
    const { errors, values } = validateProductForm(baseInput({ name: "<b>x</b> Hoa" }));
    assert.deepEqual(errors, {});
    assert.equal(values?.name, "<b>x</b> Hoa");
  });
  it("quá 6 ảnh hoặc URL ảnh lạ → lỗi", () => {
    const six = Array.from({ length: 6 }, () => "/uploads/0123456789ab.jpg");
    assert.equal(validateProductForm(baseInput({ images: six })).values?.images.length, 6);
    const seven = [...six, "/uploads/0123456789ab.jpg"];
    assert.ok(validateProductForm(baseInput({ images: seven })).errors.images);
    assert.ok(
      validateProductForm(baseInput({ images: ["https://example.com/x.jpg"] })).errors.images,
    );
  });
  it("sửa: ảnh đã có của sản phẩm (vd placeholder mẫu) được giữ, ảnh lạ vẫn lỗi", () => {
    // Ảnh mẫu của sản phẩm seed không khớp mẫu /uploads/... nhưng là
    // ảnh đã lưu hợp lệ — sửa giá/tên không được bắt gỡ ảnh.
    const placeholder = "/images/placeholder.svg";
    assert.ok(
      validateProductForm(baseInput({ images: [placeholder] })).errors.images,
      "tạo mới vẫn từ chối placeholder",
    );
    const { errors, values } = validateProductForm(
      baseInput({ images: [placeholder] }),
      [placeholder],
    );
    assert.deepEqual(errors, {});
    assert.deepEqual(values?.images, [placeholder]);
    assert.ok(
      validateProductForm(baseInput({ images: ["https://example.com/x.jpg"] }), [
        placeholder,
      ]).errors.images,
      "URL ngoài không nằm trong ảnh đã có vẫn bị từ chối",
    );
  });
});
