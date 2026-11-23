import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidAdminPasswordHash } from "./config-format";
import { hashAdminPassword, verifyAdminPassword } from "./password";

// Lưu ý: KHÔNG dùng hash thật của Henry trong test (repo là public).
// Hash mẫu dưới đây là chuỗi hex giả, chỉ đúng ĐỊNH DẠNG.

describe("isValidAdminPasswordHash", () => {
  it("đúng định dạng scrypt$<32 hex>$<128 hex>", () => {
    assert.equal(
      isValidAdminPasswordHash(`scrypt$${"ab".repeat(16)}$${"cd".repeat(64)}`),
      true,
    );
  });
  it("sai định dạng → false", () => {
    assert.equal(isValidAdminPasswordHash(""), false);
    assert.equal(isValidAdminPasswordHash(undefined), false);
    assert.equal(isValidAdminPasswordHash("scrypt$abc$def"), false);
    assert.equal(isValidAdminPasswordHash(`scrypt$${"ab".repeat(15)}$${"cd".repeat(64)}`), false);
    assert.equal(isValidAdminPasswordHash(`scrypt$${"ab".repeat(16)}$${"cd".repeat(63)}`), false);
    assert.equal(isValidAdminPasswordHash(`sha256$${"ab".repeat(16)}$${"cd".repeat(64)}`), false);
  });
});

describe("hashAdminPassword / verifyAdminPassword (scrypt N=32768)", () => {
  it("băm rồi xác minh đúng mật khẩu (cần maxmem 64 MB — xem K-phát hiện)", async () => {
    const hash = await hashAdminPassword("Mat-Khau-Thu-123");
    assert.match(hash, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    assert.equal(await verifyAdminPassword("Mat-Khau-Thu-123", hash), true);
  });
  it("sai mật khẩu → false", async () => {
    const hash = await hashAdminPassword("Mat-Khau-Thu-123");
    assert.equal(await verifyAdminPassword("mat-khau-thu-123", hash), false);
    assert.equal(await verifyAdminPassword("", hash), false);
  });
  it("hash sai định dạng → false, không throw", async () => {
    assert.equal(await verifyAdminPassword("x", "khong-phai-hash"), false);
  });
  it("hai lần băm cùng mật khẩu cho salt khác nhau", async () => {
    const a = await hashAdminPassword("giong-nhau");
    const b = await hashAdminPassword("giong-nhau");
    assert.notEqual(a, b);
    assert.equal(await verifyAdminPassword("giong-nhau", a), true);
    assert.equal(await verifyAdminPassword("giong-nhau", b), true);
  });
});
