// Unit test kiểm tra biểu mẫu tin tức (Ngày 18) — thuần, không cần DB.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedCoverImage,
  validateNewsForm,
  type NewsFormInput,
} from "./news-validation";

function input(over: Partial<NewsFormInput> = {}): NewsFormInput {
  return {
    title: "Cách giữ hoa tươi lâu",
    slug: "",
    excerpt: "Vài mẹo nhỏ để hoa tươi cả tuần.",
    content: "# Mẹo\n\n- Thay nước mỗi ngày.",
    coverImage: "",
    author: "Hoa Tươi",
    seoTitle: "",
    seoDescription: "",
    isPublished: false,
    ...over,
  };
}

describe("validateNewsForm", () => {
  it("hợp lệ: slug tự sinh từ tiêu đề, các trường không bắt buộc được rỗng", () => {
    const { errors, values } = validateNewsForm(
      input({ excerpt: "", author: "", coverImage: "" }),
    );
    assert.deepEqual(errors, {});
    assert.equal(values?.slug, "cach-giu-hoa-tuoi-lau");
    assert.equal(values?.excerpt, "");
    assert.equal(values?.author, "");
  });

  it("tiêu đề bắt buộc: rỗng hoặc 1 ký tự → lỗi; 121 ký tự → lỗi", () => {
    assert.ok(validateNewsForm(input({ title: "" })).errors.title);
    assert.ok(validateNewsForm(input({ title: "A" })).errors.title);
    assert.ok(validateNewsForm(input({ title: "a".repeat(121) })).errors.title);
    assert.equal(validateNewsForm(input({ title: "ab" })).errors.title, undefined);
  });

  it("slug nhập tay sai mẫu / trùng đường dẫn cố định → lỗi", () => {
    assert.ok(validateNewsForm(input({ slug: "Tin Tuc" })).errors.slug);
    assert.ok(validateNewsForm(input({ slug: "-tin-tuc" })).errors.slug);
    assert.ok(validateNewsForm(input({ slug: "tin-tuc" })).errors.slug);
    assert.ok(validateNewsForm(input({ slug: "cart" })).errors.slug);
    assert.equal(validateNewsForm(input({ slug: "tin-hay" })).errors.slug, undefined);
  });

  it("tóm tắt > 200 ký tự → lỗi; đúng 200 → qua", () => {
    assert.ok(validateNewsForm(input({ excerpt: "x".repeat(201) })).errors.excerpt);
    assert.equal(
      validateNewsForm(input({ excerpt: "x".repeat(200) })).errors.excerpt,
      undefined,
    );
  });

  it("nội dung > 20.000 ký tự → lỗi", () => {
    assert.ok(validateNewsForm(input({ content: "x".repeat(20001) })).errors.content);
  });

  it("tác giả > 100 ký tự → lỗi; ảnh đại diện sai scheme → lỗi", () => {
    assert.ok(validateNewsForm(input({ author: "x".repeat(101) })).errors.author);
    assert.ok(
      validateNewsForm(input({ coverImage: "javascript:alert(1)" })).errors.coverImage,
    );
    assert.ok(
      validateNewsForm(input({ coverImage: "data:image/png;base64,xxx" })).errors
        .coverImage,
    );
    assert.ok(validateNewsForm(input({ coverImage: "//evil.example/a.png" })).errors.coverImage);
  });

  it("seoTitle ≤ 120, seoDescription ≤ 160", () => {
    assert.ok(validateNewsForm(input({ seoTitle: "x".repeat(121) })).errors.seoTitle);
    assert.ok(
      validateNewsForm(input({ seoDescription: "x".repeat(161) })).errors
        .seoDescription,
    );
  });
});

describe("isAllowedCoverImage", () => {
  it("rỗng, đường dẫn nội bộ, http(s) → cho phép; scheme lạ → từ chối", () => {
    assert.equal(isAllowedCoverImage(""), true);
    assert.equal(isAllowedCoverImage("/uploads/abc123.png"), true);
    assert.equal(isAllowedCoverImage("https://example.com/a.webp"), true);
    assert.equal(isAllowedCoverImage("http://example.com/a.jpg"), true);
    assert.equal(isAllowedCoverImage("javascript:alert(1)"), false);
    assert.equal(isAllowedCoverImage("data:image/png;base64,xxx"), false);
    assert.equal(isAllowedCoverImage("//evil.example/a.png"), false);
    assert.equal(isAllowedCoverImage("/up loads/a.png"), false);
  });
});
