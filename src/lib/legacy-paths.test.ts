// Test thuần đường dẫn cũ (Ngày 14 C1/C3).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_PATHS,
  isLegacyPath,
  resolveLegacyLink,
} from "./legacy-paths";

describe("isLegacyPath", () => {
  it("bốn đường dẫn cũ thật → true; còn lại → false", () => {
    for (const p of LEGACY_PATHS) assert.equal(isLegacyPath(p), true);
    assert.equal(isLegacyPath("/gioi-thieu"), false);
    assert.equal(isLegacyPath("/trang/gioi-thieu"), false);
    assert.equal(isLegacyPath(""), false);
    assert.equal(isLegacyPath("/About"), false);
  });
});

describe("resolveLegacyLink", () => {
  it("có trang thay thế → sang slug gốc; không có → giữ nguyên", () => {
    const replacements = new Map([
      ["/about", "gioi-thieu"],
      ["/policy", "chinh-sach-chung"],
    ]);
    assert.equal(resolveLegacyLink("/about", replacements), "/gioi-thieu");
    assert.equal(resolveLegacyLink("/policy", replacements), "/chinh-sach-chung");
    assert.equal(resolveLegacyLink("/faq", replacements), "/faq");
    assert.equal(resolveLegacyLink("/contact", replacements), "/contact");
    assert.equal(resolveLegacyLink("/", replacements), "/");
  });
});
