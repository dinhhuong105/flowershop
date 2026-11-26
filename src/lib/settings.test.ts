// Test thuần — Cài đặt shop (Ngày 11 B2): kiểm hợp lệ từng nhóm,
// mặc định = chữ đang hiển thị trên shop.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  validateContactValues,
  validateGeneralValues,
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
