import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cleanString,
  isValidPhone,
  normalizePhone,
  validateCheckoutForm,
} from "./checkout-validation";

describe("normalizePhone / isValidPhone (D5-7)", () => {
  const valid: Array<[string, string]> = [
    ["0901234567", "0901234567"],
    ["+84901234567", "0901234567"],
    ["84 901 234 567", "0901234567"],
    ["090.123.4567", "0901234567"],
    ["02873001234", "02873001234"],
  ];
  for (const [input, expected] of valid) {
    it(`"${input}" → "${expected}"`, () => {
      assert.equal(normalizePhone(input), expected);
      assert.equal(isValidPhone(input), true);
    });
  }
  const invalid = ["12345", "abc", "090123456", "0001234567", ""];
  for (const input of invalid) {
    it(`"${input || "(rỗng)"}" bị từ chối`, () => {
      assert.equal(isValidPhone(input), false);
    });
  }
});

describe("cleanString", () => {
  it("bỏ ký tự điều khiển, gộp khoảng trắng", () => {
    assert.equal(cleanString("  Nguyễn   Văn\tAn\x01 "), "Nguyễn Văn An");
  });
});

const BASE: Record<string, string> = {
  senderName: "Nguyễn Văn An",
  senderPhone: "0901234567",
  senderEmail: "",
  sameAsSender: "on",
  receiverName: "",
  receiverPhone: "",
  address: "123 Đường Lê Lợi, Quận 1",
  zoneId: "2",
  deliveryMethod: "SCHEDULED",
  deliveryDate: "2026-11-23",
  deliverySlot: "10-12",
  cardMessage: "Chúc mừng sinh nhật!",
  note: "",
  paymentMethod: "COD",
};

describe("validateCheckoutForm", () => {
  it("đầu vào đầy đủ hợp lệ → không lỗi", () => {
    const { fieldErrors } = validateCheckoutForm(BASE);
    assert.deepEqual(fieldErrors, {});
  });
  it("để trống → lỗi đúng trường", () => {
    const { fieldErrors } = validateCheckoutForm({});
    for (const key of ["senderName", "senderPhone", "address", "zoneId", "deliveryMethod", "paymentMethod"] as const) {
      assert.ok(fieldErrors[key], `thiếu lỗi ở ${key}`);
    }
  });
  it("bỏ chọn 'Giống người đặt' thì kiểm tra riêng người nhận", () => {
    const { fieldErrors } = validateCheckoutForm({ ...BASE, sameAsSender: "" });
    assert.ok(fieldErrors.receiverName);
    assert.ok(fieldErrors.receiverPhone);
  });
  it("email sai định dạng → lỗi", () => {
    const { fieldErrors } = validateCheckoutForm({ ...BASE, senderEmail: "khong-phai-email" });
    assert.ok(fieldErrors.senderEmail);
  });
  it("lời nhắn quá 200 ký tự → lỗi", () => {
    const { fieldErrors } = validateCheckoutForm({ ...BASE, cardMessage: "x".repeat(201) });
    assert.ok(fieldErrors.cardMessage);
  });
  it("ghi chú quá 300 ký tự → lỗi", () => {
    const { fieldErrors } = validateCheckoutForm({ ...BASE, note: "x".repeat(301) });
    assert.ok(fieldErrors.note);
  });
  it("SCHEDULED thiếu ngày/khung giờ → lỗi", () => {
    const { fieldErrors } = validateCheckoutForm({ ...BASE, deliveryDate: "", deliverySlot: "" });
    assert.ok(fieldErrors.deliveryDate);
    assert.ok(fieldErrors.deliverySlot);
  });
  it("EXPRESS_2H không cần ngày/khung giờ", () => {
    const { fieldErrors } = validateCheckoutForm({
      ...BASE,
      deliveryMethod: "EXPRESS_2H",
      deliveryDate: "",
      deliverySlot: "",
    });
    assert.equal(fieldErrors.deliveryDate, undefined);
    assert.equal(fieldErrors.deliverySlot, undefined);
  });
});
