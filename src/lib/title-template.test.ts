// Test thuần mẫu tiêu đề SEO (Ngày 14 B1).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyTitleTemplate,
  resolveTitleTemplateForNext,
  validateTitleTemplate,
} from "./title-template";

describe("validateTitleTemplate", () => {
  it("hợp lệ: có %s đúng một lần, {siteName} tối đa một lần", () => {
    assert.equal(validateTitleTemplate("%s | {siteName}"), null);
    assert.equal(validateTitleTemplate("%s | Hoa Tươi Demo"), null);
    assert.equal(validateTitleTemplate("{siteName} — %s"), null);
    assert.equal(validateTitleTemplate("%s"), null);
  });

  it("rỗng, thiếu %s, thừa %s, quá 80 ký tự → lỗi (giữ đúng thông báo cũ)", () => {
    assert.equal(validateTitleTemplate(""), "Nhập mẫu tiêu đề.");
    assert.equal(
      validateTitleTemplate("Hoa Tươi Demo"),
      "Mẫu tiêu đề phải chứa đúng một lần %s.",
    );
    assert.equal(
      validateTitleTemplate("%s | %s"),
      "Mẫu tiêu đề phải chứa đúng một lần %s.",
    );
    assert.equal(
      validateTitleTemplate(`%s | ${"x".repeat(80)}`),
      "Mẫu tiêu đề tối đa 80 ký tự.",
    );
  });

  it("{siteName} hai lần, {...} khác, ngoặc không đóng → lỗi", () => {
    assert.equal(
      validateTitleTemplate("%s | {siteName} {siteName}"),
      "Mẫu tiêu đề chỉ được chứa một lần {siteName}.",
    );
    assert.equal(
      validateTitleTemplate("%s | {shop}"),
      "Mẫu tiêu đề chỉ được dùng {siteName}, không dùng dấu ngoặc khác.",
    );
    assert.equal(
      validateTitleTemplate("%s | {siteName"),
      "Mẫu tiêu đề chỉ được dùng {siteName}, không dùng dấu ngoặc khác.",
    );
  });
});

describe("applyTitleTemplate", () => {
  it("thay %s bằng tên trang, {siteName} bằng tên shop", () => {
    assert.equal(
      applyTitleTemplate("%s | {siteName}", "Bó Hồng Đỏ Tình Yêu", "Hoa Tươi Demo"),
      "Bó Hồng Đỏ Tình Yêu | Hoa Tươi Demo",
    );
    assert.equal(
      applyTitleTemplate("{siteName} — %s", "Giới thiệu", "Hoa Tươi Demo"),
      "Hoa Tươi Demo — Giới thiệu",
    );
  });

  it("tên shop chứa %s hoặc {siteName} vẫn chèn nguyên văn (thay một lượt)", () => {
    assert.equal(
      applyTitleTemplate("%s | {siteName}", "Bó Hồng", "Hoa %s Tươi"),
      "Bó Hồng | Hoa %s Tươi",
    );
    assert.equal(
      applyTitleTemplate("%s | {siteName}", "X", "A {siteName} B"),
      "X | A {siteName} B",
    );
    // Tên trang chứa {siteName} cũng không được thay tiếp.
    assert.equal(
      applyTitleTemplate("%s | {siteName}", "{siteName}", "Hoa Tươi Demo"),
      "{siteName} | Hoa Tươi Demo",
    );
  });

  it("chỉ thay lần đầu: %s thứ hai giữ nguyên", () => {
    assert.equal(applyTitleTemplate("%s và %s", "X", "Y"), "X và %s");
  });
});

describe("resolveTitleTemplateForNext", () => {
  it("chỉ thay {siteName}, giữ nguyên %s cho Next", () => {
    assert.equal(
      resolveTitleTemplateForNext("%s | {siteName}", "Hoa Tươi Demo"),
      "%s | Hoa Tươi Demo",
    );
  });

  it("tên shop chứa %s: mẫu đưa cho Next vẫn chỉ còn đúng một %s", () => {
    const out = resolveTitleTemplateForNext("%s | {siteName}", "Hoa %s Tươi");
    assert.equal(out.split("%s").length - 1, 1);
    // Tên shop vẫn đọc được (chỉ chèn ký tự zero-width sau "%").
    assert.ok(out.includes("Hoa %"));
    assert.ok(out.includes("Tươi"));
  });
});
