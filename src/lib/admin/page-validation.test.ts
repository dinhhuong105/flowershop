// Test thuần — kiểm tra biểu mẫu trang tĩnh (Ngày 13 B1).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validatePageForm, type PageFormInput } from "./page-validation";

function input(overrides: Partial<PageFormInput> = {}): PageFormInput {
  return {
    title: "Giới thiệu",
    slug: "",
    content: "Nội dung trang.",
    seoTitle: "",
    seoDescription: "",
    sortOrder: "0",
    isPublished: false,
    showInFooter: false,
    legacyPath: "",
    confirmReplace: false,
    ...overrides,
  };
}

describe("validatePageForm", () => {
  it("hợp lệ: slug trống → tự sinh từ tiêu đề", () => {
    const { errors, values } = validatePageForm(input());
    assert.deepEqual(errors, {});
    assert.equal(values?.slug, "gioi-thieu");
    assert.equal(values?.title, "Giới thiệu");
  });
  it("tiêu đề 1 ký tự hoặc > 120 ký tự → lỗi", () => {
    assert.ok(validatePageForm(input({ title: "A" })).errors.title);
    assert.ok(validatePageForm(input({ title: "A".repeat(121) })).errors.title);
  });
  it("slug < 2 hoặc > 60 ký tự → lỗi; slug sai mẫu → lỗi", () => {
    assert.ok(validatePageForm(input({ slug: "a" })).errors.slug);
    assert.ok(validatePageForm(input({ slug: "a".repeat(61) })).errors.slug);
    assert.ok(validatePageForm(input({ slug: "Slug_Có_Dấu" })).errors.slug);
    assert.ok(validatePageForm(input({ slug: "-bat-dau-gach" })).errors.slug);
  });
  it("slug trùng đường dẫn cố định → lỗi (faq, policy, trang...)", () => {
    for (const slug of [
      "faq",
      "about",
      "contact",
      "policy",
      "trang",
      "cart",
      "checkout",
      "search",
      "admin",
    ]) {
      assert.ok(
        validatePageForm(input({ slug })).errors.slug,
        `slug ${slug} phải bị từ chối`,
      );
    }
  });
  it("nội dung > 20.000 ký tự → lỗi; seoTitle > 120 / seoDescription > 160 → lỗi", () => {
    assert.ok(validatePageForm(input({ content: "x".repeat(20001) })).errors.content);
    assert.ok(validatePageForm(input({ seoTitle: "x".repeat(121) })).errors.seoTitle);
    assert.ok(
      validatePageForm(input({ seoDescription: "x".repeat(161) })).errors.seoDescription,
    );
  });
  it("thứ tự không phải số nguyên hoặc ngoài 0–9999 → lỗi", () => {
    assert.ok(validatePageForm(input({ sortOrder: "1.5" })).errors.sortOrder);
    assert.ok(validatePageForm(input({ sortOrder: "10000" })).errors.sortOrder);
    assert.equal(validatePageForm(input({ sortOrder: "" })).values?.sortOrder, 0);
  });
  it("giữ nguyên cờ xuất bản + chân trang", () => {
    const { values } = validatePageForm(input({ isPublished: true, showInFooter: true }));
    assert.equal(values?.isPublished, true);
    assert.equal(values?.showInFooter, true);
  });
  it("legacyPath: rỗng → null; bốn đường dẫn cũ → nhận; khác → lỗi (Ngày 14 C1)", () => {
    assert.equal(validatePageForm(input()).values?.legacyPath, null);
    // /about không cần xác nhận; ba đường còn lại cần tick "Tôi hiểu" (Ngày 15 B2).
    assert.equal(validatePageForm(input({ legacyPath: "/about" })).values?.legacyPath, "/about");
    for (const p of ["/policy", "/faq", "/contact"]) {
      assert.equal(
        validatePageForm(input({ legacyPath: p, confirmReplace: true })).values?.legacyPath,
        p,
      );
    }
    assert.ok(validatePageForm(input({ legacyPath: "/gioi-thieu" })).errors.legacyPath);
    assert.ok(validatePageForm(input({ legacyPath: "about" })).errors.legacyPath);
  });
  it("thay /contact, /faq, /policy không tick 'Tôi hiểu' → lỗi confirmReplace; tick → nhận (Ngày 15 B2)", () => {
    for (const p of ["/contact", "/faq", "/policy"]) {
      assert.ok(
        validatePageForm(input({ legacyPath: p })).errors.confirmReplace,
        `thay ${p} phải bắt tick xác nhận`,
      );
      assert.equal(
        validatePageForm(input({ legacyPath: p, confirmReplace: true })).errors.confirmReplace,
        undefined,
      );
      assert.equal(
        validatePageForm(input({ legacyPath: p, confirmReplace: true })).values?.legacyPath,
        p,
      );
    }
  });
  it("thay /about không cần tick 'Tôi hiểu' (Ngày 15 B2)", () => {
    assert.equal(validatePageForm(input({ legacyPath: "/about" })).errors.confirmReplace, undefined);
    assert.equal(validatePageForm(input({ legacyPath: "/about" })).values?.legacyPath, "/about");
  });
});
