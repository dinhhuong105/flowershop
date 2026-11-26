// Test CÓ DB thật — Cài đặt shop (Ngày 11 B2/B4). Chạy riêng, KHÔNG
// nằm trong `npm test`:
//   npm run test:db
// Chỉ chạy khi DATABASE_URL trỏ localhost; ngược lại file báo lỗi
// rõ và dừng (không bao giờ chạy lên DB production).
// Các ca kiểm: đọc mặc định khi bảng trống, lưu/đọc lại, chỉ ghi
// khóa đã đổi + ghi nhật ký, seed không ghi đè dữ liệu đã nhập.
// Quyền quản trị (chưa đăng nhập → từ chối) kiểm bằng CDP + smoke
// (C5: /admin/settings/general chưa đăng nhập → 307 /login) vì
// requireAdmin() cần request scope của Next.js, không gọi được
// trực tiếp trong test node.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

process.loadEnvFile(".env");

const dbHost = (() => {
  try {
    return new URL((process.env.DATABASE_URL ?? "").trim()).hostname;
  } catch {
    return "";
  }
})();
if (dbHost !== "localhost" && dbHost !== "127.0.0.1" && dbHost !== "::1") {
  throw new Error(
    `[test:db] Từ chối chạy: DATABASE_URL không phải localhost (host: ${dbHost || "(trống)"}).`,
  );
}

import { db } from "./db";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  readSettingsFromDb,
  saveSettingsToDb,
  seedDefaultSettings,
} from "./settings";

async function cleanupSettings() {
  await db.settingsAudit.deleteMany({});
  await db.siteSetting.deleteMany({});
}

describe("settings (DB)", () => {
  before(async () => {
    await cleanupSettings();
  });

  after(async () => {
    // Trả DB về trạng thái seed: 12 khóa mặc định.
    await cleanupSettings();
    await seedDefaultSettings();
  });

  it("bảng trống → đọc được mặc định (shop không đổi)", async () => {
    const partial = await readSettingsFromDb();
    assert.deepEqual(partial, {});
    assert.deepEqual(mergeSettings(partial), DEFAULT_SETTINGS);
  });

  it("lưu nhóm general → đọc lại đúng; chỉ ghi khóa đã đổi + ghi nhật ký", async () => {
    const saved = await saveSettingsToDb(
      "general",
      { siteName: "Tên Shop Test", slogan: "", logo: "", favicon: "" },
      "admin-test",
    );
    // siteName đổi so với mặc định; slogan "" cũng đổi (mặc định là
    // dòng mô tả của shop, không phải "") — lưu "" nghĩa là xóa
    // slogan. Logo/favicon mặc định đã là "" nên không ghi.
    assert.deepEqual(saved, ["general.siteName", "general.slogan"]);
    const partial = await readSettingsFromDb();
    assert.equal(partial.siteName, "Tên Shop Test");
    const audit = await db.settingsAudit.findMany({
      where: { key: "general.siteName" },
      orderBy: { id: "asc" },
    });
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.oldValue, null);
    assert.equal(audit[0]?.newValue, "Tên Shop Test");
    assert.equal(audit[0]?.updatedBy, "admin-test");

    // Lưu lại cùng giá trị → không ghi gì thêm, không thêm nhật ký.
    const savedAgain = await saveSettingsToDb(
      "general",
      { siteName: "Tên Shop Test", slogan: "", logo: "", favicon: "" },
      "admin-test",
    );
    assert.deepEqual(savedAgain, []);
    assert.equal(
      await db.settingsAudit.count({ where: { key: "general.siteName" } }),
      1,
    );
  });

  it("lưu nhóm contact → đọc lại đúng, chuỗi rỗng vẫn tính là đã đặt", async () => {
    await saveSettingsToDb(
      "contact",
      {
        hotline: "0901234567",
        zalo: "",
        email: "",
        address: "",
        openHours: "",
        facebook: "",
        instagram: "",
        tiktok: "",
      },
      "admin-test",
    );
    const merged = mergeSettings(await readSettingsFromDb());
    assert.equal(merged.hotline, "0901234567");
    // openHours rỗng trong DB ghi đè mặc định → footer ẩn dòng giờ.
    assert.equal(merged.openHours, "");
  });

  it("seed không ghi đè dữ liệu đã nhập", async () => {
    // Bảng đã có dữ liệu (siteName test ở trên) → seed trả 0.
    assert.equal(await seedDefaultSettings(), 0);
    const partial = await readSettingsFromDb();
    assert.equal(partial.siteName, "Tên Shop Test");
    // Xóa hết rồi seed → tạo đủ 12 khóa mặc định.
    await cleanupSettings();
    assert.equal(await seedDefaultSettings(), 12);
    assert.deepEqual(mergeSettings(await readSettingsFromDb()), DEFAULT_SETTINGS);
    // Seed lần nữa → 0 (đã có dữ liệu).
    assert.equal(await seedDefaultSettings(), 0);
  });
});
