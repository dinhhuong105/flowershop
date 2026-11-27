// Test thuần câu cảnh báo Ngân hàng & QR (Ngày 14 B5).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bankChangeWarningText,
  bankSaveSuccessMessage,
} from "./bank-warning";

describe("bankChangeWarningText", () => {
  it("ghi đúng N đơn", () => {
    assert.equal(
      bankChangeWarningText(3),
      "3 đơn chuyển khoản chưa thu sẽ hiển thị QR mới",
    );
    assert.equal(
      bankChangeWarningText(1),
      "1 đơn chuyển khoản chưa thu sẽ hiển thị QR mới",
    );
  });
  it("chỉ tắt thanh toán chuyển khoản → câu khác: QR biến mất (Ngày 15 B4)", () => {
    assert.equal(
      bankChangeWarningText(3, true),
      "3 đơn chuyển khoản chưa thu sẽ không còn hiển thị mã QR",
    );
    assert.equal(
      bankChangeWarningText(1, true),
      "1 đơn chuyển khoản chưa thu sẽ không còn hiển thị mã QR",
    );
    // Đổi STK (không phải chỉ tắt) → vẫn câu cũ.
    assert.equal(
      bankChangeWarningText(3, false),
      "3 đơn chuyển khoản chưa thu sẽ hiển thị QR mới",
    );
  });
});

describe("bankSaveSuccessMessage", () => {
  it("N > 0 thì ghi lại N; N = 0 thì giữ nguyên câu cũ", () => {
    assert.equal(
      bankSaveSuccessMessage(3, false),
      "Đã lưu thông tin ngân hàng. 3 đơn chuyển khoản chưa thu sẽ hiển thị QR mới.",
    );
    assert.equal(bankSaveSuccessMessage(0, false), "Đã lưu thông tin ngân hàng.");
  });
  it("Telegram lỗi thì thêm câu lưu ý (giữ đúng câu cũ khi N = 0)", () => {
    assert.equal(
      bankSaveSuccessMessage(0, true),
      "Đã lưu thông tin ngân hàng. Lưu ý: không gửi được thông báo Telegram, đã ghi vào nhật ký.",
    );
    assert.equal(
      bankSaveSuccessMessage(2, true),
      "Đã lưu thông tin ngân hàng. 2 đơn chuyển khoản chưa thu sẽ hiển thị QR mới. Lưu ý: không gửi được thông báo Telegram, đã ghi vào nhật ký.",
    );
  });
  it("chỉ tắt thanh toán chuyển khoản → câu QR biến mất trong thông báo sau khi lưu (Ngày 15 B4)", () => {
    assert.equal(
      bankSaveSuccessMessage(2, false, true),
      "Đã lưu thông tin ngân hàng. 2 đơn chuyển khoản chưa thu sẽ không còn hiển thị mã QR.",
    );
  });
  it("Telegram: ok / skipped / failed — chỉ failed thật mới thêm câu lưu ý (fixup 3)", () => {
    // ok: gửi được → không câu lưu ý.
    assert.equal(bankSaveSuccessMessage(0, false), "Đã lưu thông tin ngân hàng.");
    // skipped: chưa cấu hình, không có tin nào được gửi → không câu lưu ý.
    assert.equal(
      bankSaveSuccessMessage(0, true, false, true),
      "Đã lưu thông tin ngân hàng.",
    );
    assert.equal(
      bankSaveSuccessMessage(2, true, false, true),
      "Đã lưu thông tin ngân hàng. 2 đơn chuyển khoản chưa thu sẽ hiển thị QR mới.",
    );
    // failed thật (có cấu hình mà gửi lỗi) → vẫn câu lưu ý.
    assert.equal(
      bankSaveSuccessMessage(0, true, false, false),
      "Đã lưu thông tin ngân hàng. Lưu ý: không gửi được thông báo Telegram, đã ghi vào nhật ký.",
    );
  });
});
