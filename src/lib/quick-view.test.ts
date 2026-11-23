import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { truncateAtWord } from "./quick-view";

describe("truncateAtWord (mục 3.2)", () => {
  it("ngắn hơn giới hạn → giữ nguyên", () => {
    assert.equal(truncateAtWord("Bó hồng đỏ tươi thắm.", 300), "Bó hồng đỏ tươi thắm.");
  });
  it("dài hơn giới hạn → cắt ở ranh giới từ, ≤ 300 ký tự", () => {
    const long = `Bó hoa ${"rất đẹp ".repeat(60)}`;
    const cut = truncateAtWord(long, 300);
    assert.ok(cut.length <= 300, `dài ${cut.length}`);
    assert.ok(!cut.endsWith(" "));
    assert.ok(long.startsWith(cut));
  });
  it("không có khoảng trắng trong 300 ký tự đầu → cắt cứng ở 300", () => {
    assert.equal(truncateAtWord("a".repeat(500), 300), "a".repeat(300));
  });
});
