// Test thuần — kiểm hợp lệ biểu mẫu khu vực giao hàng (Ngày 12 C1/C2).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateZoneForm } from "./zone-validation";

describe("validateZoneForm (Ngày 12 C1/C2)", () => {
  it("hợp lệ: tên 2–80 ký tự, phí 0–1.000.000, thứ tự 0–9999", () => {
    const { errors, values } = validateZoneForm({
      name: "Khu vực trung tâm",
      fee: "25000",
      sortOrder: "1",
      isActive: "on",
    });
    assert.deepEqual(errors, {});
    assert.deepEqual(values, {
      name: "Khu vực trung tâm",
      fee: 25000,
      sortOrder: 1,
      isActive: true,
    });
  });
  it("tên 1 ký tự / phí âm / phí > 1.000.000 / phí thập phân / thứ tự sai → lỗi từng trường", () => {
    const { errors, values } = validateZoneForm({
      name: "A",
      fee: "-1",
      sortOrder: "abc",
      isActive: "false",
    });
    assert.equal(typeof errors.name, "string");
    assert.equal(typeof errors.fee, "string");
    assert.equal(typeof errors.sortOrder, "string");
    assert.equal(values, null);
    const over = validateZoneForm({
      name: "Khu vực xa",
      fee: "1000001",
      sortOrder: "0",
      isActive: "on",
    });
    assert.equal(typeof over.errors.fee, "string");
    const decimal = validateZoneForm({
      name: "Khu vực xa",
      fee: "25000.5",
      sortOrder: "0",
      isActive: "on",
    });
    assert.equal(typeof decimal.errors.fee, "string");
  });
  it("phí 0 và tắt khu vực vẫn hợp lệ", () => {
    const { errors, values } = validateZoneForm({
      name: "Miễn phí",
      fee: "0",
      sortOrder: "0",
      isActive: "false",
    });
    assert.deepEqual(errors, {});
    assert.equal(values?.fee, 0);
    assert.equal(values?.isActive, false);
  });
});
