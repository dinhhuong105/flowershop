import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SEARCH_QUERY_LENGTH,
  MAX_SEARCH_WORDS,
  searchProducts,
  tokenizeSearchQuery,
} from "./search";

describe("tokenizeSearchQuery (mục 2.1)", () => {
  it("chữ thường, bỏ dấu không cần ở tầng tách từ", () => {
    assert.deepEqual(tokenizeSearchQuery("HỒNG ĐỎ"), ["HỒNG", "ĐỎ"]);
  });
  it("cắt khoảng trắng đầu/cuối, gộp khoảng trắng thừa", () => {
    assert.deepEqual(tokenizeSearchQuery("  khai   truong  "), ["khai", "truong"]);
  });
  it("bỏ ký tự điều khiển và ký tự độ rộng bằng không", () => {
    assert.deepEqual(tokenizeSearchQuery("ho\u200Bng\x01\x02"), ["hong"]);
    assert.deepEqual(tokenizeSearchQuery("la\uFEFFn"), ["lan"]);
  });
  it("tối đa 80 ký tự đầu", () => {
    const words = tokenizeSearchQuery("a".repeat(100));
    assert.equal(words.join("").length, MAX_SEARCH_QUERY_LENGTH);
    assert.equal(words.length, 1);
  });
  it("tối đa 6 từ đầu", () => {
    assert.deepEqual(tokenizeSearchQuery("a b c d e f g h"), ["a", "b", "c", "d", "e", "f"]);
    assert.equal(MAX_SEARCH_WORDS, 6);
  });
  it("rỗng hoặc chỉ khoảng trắng → []", () => {
    assert.deepEqual(tokenizeSearchQuery(""), []);
    assert.deepEqual(tokenizeSearchQuery("   "), []);
  });
  it("giữ nguyên dấu gạch nối trong một từ (SKU ht-005)", () => {
    assert.deepEqual(tokenizeSearchQuery("ht-005"), ["ht-005"]);
  });
  it("chuẩn hoá NFD về NFC (K-8): o + U+0302 + U+0300 → ồ", () => {
    // "h" + "o" + dấu mũ tổ hợp + dấu huyền tổ hợp + "ng" (NFD) phải
    // thành "hồng" như khi gõ trực tiếp (NFC) — tìm ra 6 sản phẩm.
    assert.deepEqual(tokenizeSearchQuery("ho\u0302\u0300ng"), ["hồng"]);
    assert.deepEqual(tokenizeSearchQuery("HO\u0302\u0300NG"), ["HỒNG"]);
  });
});

describe("searchProducts: q rỗng không truy vấn DB (mục 2.3)", () => {
  it("q rỗng → tổng 0, không sản phẩm", async () => {
    const res = await searchProducts("");
    assert.deepEqual(res, { products: [], total: 0, totalPages: 0, words: [] });
  });
  it("q chỉ khoảng trắng → tổng 0", async () => {
    const res = await searchProducts("   ");
    assert.deepEqual(res, { products: [], total: 0, totalPages: 0, words: [] });
  });
});
