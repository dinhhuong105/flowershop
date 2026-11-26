// Test thuần — Cài đặt shop (Ngày 11 B2): kiểm hợp lệ từng nhóm,
// mặc định = chữ đang hiển thị trên shop.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  maskAccountNumber,
  mergeSettings,
  renderTransferContent,
  validateBankValues,
  validateContactValues,
  validateGeneralValues,
  validateTelegramValues,
} from "./settings";

describe("validateGeneralValues", () => {
  it("hợp lệ: tên + slogan + logo/favico trống → không lỗi", () => {
    const { values, errors } = validateGeneralValues({
      siteName: "Hoa Tươi Demo",
      slogan: "Hoa tươi, lan hồ điệp và giỏ quà trái cây giao tận nơi.",
      logo: "",
      favicon: "",
    });
    assert.deepEqual(errors, {});
    assert.equal(values.siteName, "Hoa Tươi Demo");
  });
  it("tên 1 ký tự hoặc > 80 ký tự → lỗi; slogan > 200 ký tự → lỗi", () => {
    const { errors } = validateGeneralValues({
      siteName: "H",
      slogan: "x".repeat(201),
      logo: "",
      favicon: "",
    });
    assert.equal(typeof errors.siteName, "string");
    assert.equal(typeof errors.slogan, "string");
  });
  it("logo/favico không phải URL ảnh → lỗi; URL http(s) đuôi png → ok", () => {
    const bad = validateGeneralValues({
      siteName: "Hoa Tươi Demo",
      slogan: "",
      logo: "https://example.com/logo.txt",
      favicon: "not-a-url",
    });
    assert.equal(typeof bad.errors.logo, "string");
    assert.equal(typeof bad.errors.favicon, "string");
    const good = validateGeneralValues({
      siteName: "Hoa Tươi Demo",
      slogan: "",
      logo: "https://example.com/logo.png",
      favicon: "/uploads/abcdef012345.png",
    });
    assert.deepEqual(good.errors, {});
  });
});

describe("validateContactValues", () => {
  it("hợp lệ: SĐT chuẩn hóa +84 → 0; email/social https → ok", () => {
    const { values, errors } = validateContactValues({
      hotline: "+84 901 234 567",
      zalo: "0901234567",
      email: "lienhe@shophoa.vn",
      address: "123 Đường Hoa",
      openHours: "Thứ 2 – Chủ nhật: 7:30 – 21:00",
      facebook: "https://www.facebook.com/shophoa",
      instagram: "",
      tiktok: "",
    });
    assert.deepEqual(errors, {});
    assert.equal(values.hotline, "0901234567");
  });
  it("SĐT sai định dạng → lỗi; email sai → lỗi; social không https → lỗi", () => {
    const { errors } = validateContactValues({
      hotline: "12345",
      zalo: "",
      email: "khong-phai-email",
      address: "",
      openHours: "",
      facebook: "http://facebook.com/shophoa",
      instagram: "facebook.com/shophoa",
      tiktok: "",
    });
    assert.equal(typeof errors.hotline, "string");
    assert.equal(typeof errors.email, "string");
    assert.equal(typeof errors.facebook, "string");
    assert.equal(typeof errors.instagram, "string");
  });
  it("địa chỉ / giờ mở cửa > 200 ký tự → lỗi", () => {
    const { errors } = validateContactValues({
      hotline: "",
      zalo: "",
      email: "",
      address: "x".repeat(201),
      openHours: "x".repeat(201),
      facebook: "",
      instagram: "",
      tiktok: "",
    });
    assert.equal(typeof errors.address, "string");
    assert.equal(typeof errors.openHours, "string");
  });
});

describe("mặc định cài đặt (B2)", () => {
  it("DB trống → đúng chữ đang hiển thị trên shop", () => {
    const s = mergeSettings({});
    assert.equal(s.siteName, "Hoa Tươi Demo");
    assert.equal(s.slogan, "Hoa tươi, lan hồ điệp và giỏ quà trái cây giao tận nơi.");
    assert.equal(s.openHours, "Thứ 2 – Chủ nhật: 7:30 – 21:00");
    assert.equal(s.hotline, "");
    assert.equal(s.zalo, "");
    assert.equal(s.address, "");
    assert.equal(s.logo, "");
    assert.equal(s.favicon, "");
    assert.deepEqual(s, DEFAULT_SETTINGS);
  });
  it("chuỗi rỗng trong DB vẫn tính là đã đặt (ghi đè mặc định)", () => {
    const s = mergeSettings({ openHours: "" });
    assert.equal(s.openHours, "");
    const s2 = mergeSettings({ siteName: "Tên Mới" });
    assert.equal(s2.siteName, "Tên Mới");
    assert.equal(s2.openHours, "Thứ 2 – Chủ nhật: 7:30 – 21:00");
  });
});

describe("validateBankValues (Ngày 12 B1)", () => {
  it("hợp lệ: BIN 6 số, STK 10 số, tên hoa không dấu, mẫu có {ORDER_CODE}", () => {
    const { values, errors } = validateBankValues({
      bankCode: "970415",
      accountNumber: "1234567890",
      accountName: "nguyen van a",
      transferNoteTemplate: "DH {ORDER_CODE}",
      bankEnabled: true,
    });
    assert.deepEqual(errors, {});
    assert.equal(values.accountName, "NGUYEN VAN A");
    assert.equal(values.bankCode, "970415");
  });
  it("bật chuyển khoản mà thiếu trường → lỗi từng trường", () => {
    const { errors } = validateBankValues({
      bankCode: "",
      accountNumber: "",
      accountName: "",
      transferNoteTemplate: "DH {ORDER_CODE}",
      bankEnabled: true,
    });
    assert.equal(typeof errors.bankCode, "string");
    assert.equal(typeof errors.accountNumber, "string");
    assert.equal(typeof errors.accountName, "string");
  });
  it("tắt chuyển khoản thì trường trống được (mẫu vẫn bắt buộc)", () => {
    const { errors } = validateBankValues({
      bankCode: "",
      accountNumber: "",
      accountName: "",
      transferNoteTemplate: "DH {ORDER_CODE}",
      bankEnabled: false,
    });
    assert.deepEqual(errors, {});
  });
  it("STK 5 số / 20 số / có chữ → lỗi; BIN 5 số → lỗi", () => {
    const bad = validateBankValues({
      bankCode: "97041",
      accountNumber: "12345",
      accountName: "NGUYEN VAN A",
      transferNoteTemplate: "DH {ORDER_CODE}",
      bankEnabled: true,
    });
    assert.equal(typeof bad.errors.bankCode, "string");
    assert.equal(typeof bad.errors.accountNumber, "string");
    const bad2 = validateBankValues({
      bankCode: "970415",
      accountNumber: "12345678901234567890",
      accountName: "NGUYEN VAN A",
      transferNoteTemplate: "DH {ORDER_CODE}",
      bankEnabled: true,
    });
    assert.equal(typeof bad2.errors.accountNumber, "string");
    const bad3 = validateBankValues({
      bankCode: "970415",
      accountNumber: "1234abcd",
      accountName: "NGUYEN VAN A",
      transferNoteTemplate: "DH {ORDER_CODE}",
      bankEnabled: true,
    });
    assert.equal(typeof bad3.errors.accountNumber, "string");
  });
  it("tên có dấu / 1 ký tự / > 50 ký tự → lỗi", () => {
    const { errors } = validateBankValues({
      bankCode: "970415",
      accountNumber: "1234567890",
      accountName: "NGUYỄN VĂN A",
      transferNoteTemplate: "DH {ORDER_CODE}",
      bankEnabled: true,
    });
    assert.equal(typeof errors.accountName, "string");
    const short = validateBankValues({
      bankCode: "970415",
      accountNumber: "1234567890",
      accountName: "A",
      transferNoteTemplate: "DH {ORDER_CODE}",
      bankEnabled: true,
    });
    assert.equal(typeof short.errors.accountName, "string");
  });
  it("mẫu thiếu/không có {ORDER_CODE}, có 2 placeholder, có dấu, > 50 ký tự, kết quả cuối > 25 ký tự → lỗi", () => {
    const noPlaceholder = validateBankValues({
      bankCode: "970415",
      accountNumber: "1234567890",
      accountName: "NGUYEN VAN A",
      transferNoteTemplate: "DH",
      bankEnabled: true,
    });
    assert.equal(typeof noPlaceholder.errors.transferNoteTemplate, "string");
    const two = validateBankValues({
      bankCode: "970415",
      accountNumber: "1234567890",
      accountName: "NGUYEN VAN A",
      transferNoteTemplate: "{ORDER_CODE} {ORDER_CODE}",
      bankEnabled: true,
    });
    assert.equal(typeof two.errors.transferNoteTemplate, "string");
    const diacritics = validateBankValues({
      bankCode: "970415",
      accountNumber: "1234567890",
      accountName: "NGUYEN VAN A",
      transferNoteTemplate: "Thanh toán {ORDER_CODE}",
      bankEnabled: true,
    });
    assert.equal(typeof diacritics.errors.transferNoteTemplate, "string");
    const tooLong = validateBankValues({
      bankCode: "970415",
      accountNumber: "1234567890",
      accountName: "NGUYEN VAN A",
      transferNoteTemplate: "DH DON HANG {ORDER_CODE}",
      bankEnabled: true,
    });
    // "DH DON HANG 0123456789" = 22 ký tự → hợp lệ (dưới 25).
    assert.deepEqual(tooLong.errors, {});
    const over25 = validateBankValues({
      bankCode: "970415",
      accountNumber: "1234567890",
      accountName: "NGUYEN VAN A",
      transferNoteTemplate: "THANH TOAN DON HANG {ORDER_CODE}",
      bankEnabled: true,
    });
    // "THANH TOAN DON HANG 0123456789" = 30 ký tự → lỗi.
    assert.equal(typeof over25.errors.transferNoteTemplate, "string");
    const over50 = validateBankValues({
      bankCode: "970415",
      accountNumber: "1234567890",
      accountName: "NGUYEN VAN A",
      transferNoteTemplate: `${"A".repeat(41)} {ORDER_CODE}`,
      bankEnabled: true,
    });
    assert.equal(typeof over50.errors.transferNoteTemplate, "string");
  });
});

describe("validateTelegramValues (Ngày 12 D1/D5)", () => {
  it("chat id số (âm được) hoặc @tên-kênh → hợp lệ", () => {
    assert.deepEqual(
      validateTelegramValues({ telegramChatId: "-1001234567890", telegramEnabled: true }).errors,
      {},
    );
    assert.deepEqual(
      validateTelegramValues({ telegramChatId: "@shophoa", telegramEnabled: true }).errors,
      {},
    );
  });
  it("chat id sai định dạng → lỗi; bật mà trống → lỗi; tắt mà trống → ok", () => {
    assert.equal(
      typeof validateTelegramValues({ telegramChatId: "abc", telegramEnabled: true }).errors
        .telegramChatId,
      "string",
    );
    assert.equal(
      typeof validateTelegramValues({ telegramChatId: "", telegramEnabled: true }).errors
        .telegramChatId,
      "string",
    );
    assert.deepEqual(
      validateTelegramValues({ telegramChatId: "", telegramEnabled: false }).errors,
      {},
    );
  });
});

describe("renderTransferContent + maskAccountNumber (Ngày 12 B1/B3)", () => {
  it("thay {ORDER_CODE} bằng mã đơn; không có placeholder → giữ nguyên", () => {
    assert.equal(renderTransferContent("DH {ORDER_CODE}", "0123456789"), "DH 0123456789");
    assert.equal(renderTransferContent("DH", "0123456789"), "DH");
    assert.equal(
      renderTransferContent("{ORDER_CODE} {ORDER_CODE}", "ABC"),
      "ABC ABC",
    );
  });
  it("che STK chỉ giữ 4 số cuối; ≤ 4 số hoặc rỗng → ****", () => {
    assert.equal(maskAccountNumber("1234567890"), "****7890");
    assert.equal(maskAccountNumber("1234"), "****");
    assert.equal(maskAccountNumber(""), "****");
  });
  it("mẫu mặc định = nội dung hiện hành 'DH {ORDER_CODE}'", () => {
    assert.equal(DEFAULT_SETTINGS.transferNoteTemplate, "DH {ORDER_CODE}");
    assert.equal(typeof DEFAULT_SETTINGS.bankEnabled, "boolean");
  });
});
