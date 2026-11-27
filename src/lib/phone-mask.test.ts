// Che SĐT công khai (Ngày 17 S7) — hàm thuần, không cần DB.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { maskPhone } from "./phone-mask";

describe("maskPhone (Ngày 17 S7)", () => {
  it("di động 10 số: giữ 3 đầu + 3 cuối", () => {
    assert.equal(maskPhone("0901234567"), "090****567");
  });

  it("cố định 11 số: giữ 3 đầu + 3 cuối", () => {
    assert.equal(maskPhone("02812345678"), "028****678");
  });

  it("số đã chuẩn hóa +84 giữ nguyên dạng đầu vào", () => {
    assert.equal(maskPhone("0900000011"), "090****011");
  });

  it("chuỗi ngắn (< 7 ký tự) vẫn che giữa", () => {
    assert.equal(maskPhone("12345"), "1****5");
  });

  it("chuỗi rỗng hoặc 1 ký tự không lộ gì", () => {
    assert.equal(maskPhone(""), "****");
    assert.equal(maskPhone("0"), "****");
  });

  it("khoảng trắng hai đầu được cắt trước khi che", () => {
    assert.equal(maskPhone("  0901234567 "), "090****567");
  });
});
