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
import { execFileSync } from "node:child_process";

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
import { isTelegramNotifyEnabled, sendOrderNotification } from "./telegram";

async function cleanupSettings() {
  await db.settingsAudit.deleteMany({});
  await db.siteSetting.deleteMany({});
}

describe("settings (DB)", () => {
  before(async () => {
    await cleanupSettings();
  });

  after(async () => {
    // Trả DB về trạng thái seed: 24 khóa mặc định (12 cũ + 5 bank +
    // 2 telegram, Ngày 12 + 5 seo, Ngày 13).
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

  it("lưu nhóm bank → đọc lại đúng; STK trong nhật ký chỉ giữ 4 số cuối; boolean lưu dạng chuỗi", async () => {
    const saved = await saveSettingsToDb(
      "bank",
      {
        bankCode: "970415",
        accountNumber: "1234567890",
        accountName: "NGUYEN VAN A",
        transferNoteTemplate: "DH {ORDER_CODE}",
        bankEnabled: true,
      },
      "admin-test",
    );
    // Mẫu "DH {ORDER_CODE}" trùng mặc định nên không ghi; 4 khóa
    // còn lại đổi (mặc định rỗng/tắt).
    assert.deepEqual(saved, [
      "bank.bankCode",
      "bank.accountNumber",
      "bank.accountName",
      "bank.enabled",
    ]);
    const merged = mergeSettings(await readSettingsFromDb());
    assert.equal(merged.bankCode, "970415");
    assert.equal(merged.accountNumber, "1234567890");
    assert.equal(merged.bankEnabled, true);
    const audit = await db.settingsAudit.findMany({
      where: { key: "bank.accountNumber" },
      orderBy: { id: "asc" },
    });
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.oldValue, null);
    assert.equal(audit[0]?.newValue, "****7890");
    // Lưu lại cùng giá trị → không ghi gì thêm, không thêm nhật ký.
    const savedAgain = await saveSettingsToDb(
      "bank",
      {
        bankCode: "970415",
        accountNumber: "1234567890",
        accountName: "NGUYEN VAN A",
        transferNoteTemplate: "DH {ORDER_CODE}",
        bankEnabled: true,
      },
      "admin-test",
    );
    assert.deepEqual(savedAgain, []);
    assert.equal(
      await db.settingsAudit.count({ where: { key: "bank.accountNumber" } }),
      1,
    );
    // Tắt chuyển khoản → đọc lại false (boolean lưu "false").
    await saveSettingsToDb("bank", { bankEnabled: false }, "admin-test");
    assert.equal(mergeSettings(await readSettingsFromDb()).bankEnabled, false);
  });

  it("lưu nhóm telegram → đọc lại đúng (chat id + bật/tắt)", async () => {
    const saved = await saveSettingsToDb(
      "telegram",
      { telegramChatId: "-1001234567890", telegramEnabled: true },
      "admin-test",
    );
    assert.deepEqual(saved, ["telegram.chatId", "telegram.enabled"]);
    const merged = mergeSettings(await readSettingsFromDb());
    assert.equal(merged.telegramChatId, "-1001234567890");
    assert.equal(merged.telegramEnabled, true);
  });

  it("seed không ghi đè dữ liệu đã nhập", async () => {
    // Bảng đã có dữ liệu (siteName test ở trên) → seed trả 0.
    assert.equal(await seedDefaultSettings(), 0);
    const partial = await readSettingsFromDb();
    assert.equal(partial.siteName, "Tên Shop Test");
    // Xóa hết rồi seed → tạo đủ 24 khóa mặc định.
    await cleanupSettings();
    assert.equal(await seedDefaultSettings(), 24);
    assert.deepEqual(mergeSettings(await readSettingsFromDb()), DEFAULT_SETTINGS);
    // Seed lần nữa → 0 (đã có dữ liệu).
    assert.equal(await seedDefaultSettings(), 0);
  });
});

// Hồi quy env (Ngày 13 A2): Ngày 12 chuyển bank/Telegram từ env
// sang cài đặt — hành vi khi chưa có dòng cài đặt phải như cũ
// (lấy từ env), có dòng cài đặt thì cài đặt thắng env.
// Chạy SAU describe trên (file chạy tuần tự): before của describe
// này dọn bảng; after của nó trả lại seed mặc định.
describe("settings env-fallback (DB, Ngày 13 A2)", () => {
  const TEST_TOKEN = "123456:TESTTOKEN";
  const TEST_CHAT_ID = "-1001234567890";

  before(async () => {
    await cleanupSettings();
    await db.order.deleteMany({ where: { code: { startsWith: "A2TEST" } } });
  });

  after(async () => {
    await db.order.deleteMany({ where: { code: { startsWith: "A2TEST" } } });
    await cleanupSettings();
    await seedDefaultSettings();
  });

  // Đọc cài đặt hiệu dụng trong tiến trình MỚI với env cho trước
  // (module settings tính DEFAULT_SETTINGS lúc import nên tiến
  // trình test hiện tại — đã import với .env trống BANK_*/TELEGRAM_*
  // — không chứng minh được nhánh env). Trả JSON đã parse.
  function readEffectiveSettings(env: NodeJS.ProcessEnv): {
    bankEnabled: boolean;
    bankCode: string;
    telegramEnabled: boolean;
  } {
    const out = execFileSync(
      "npx",
      [
        "tsx",
        "--eval",
        "process.loadEnvFile('.env'); import('./src/lib/settings.ts').then(async (m) => { const merged = m.mergeSettings(await m.readSettingsFromDb()); console.log(JSON.stringify({ bankEnabled: merged.bankEnabled, bankCode: merged.bankCode, telegramEnabled: merged.telegramEnabled })); });",
      ],
      { env, encoding: "utf8", timeout: 60000 },
    );
    return JSON.parse(out.trim().split("\n").pop() ?? "{}") as {
      bankEnabled: boolean;
      bankCode: string;
      telegramEnabled: boolean;
    };
  }

  function envWithBankAndTelegram(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      BANK_BIN: "970415",
      BANK_ACCOUNT: "1234567890",
      BANK_ACCOUNT_NAME: "NGUYEN VAN A",
      TELEGRAM_BOT_TOKEN: TEST_TOKEN,
      TELEGRAM_CHAT_ID: TEST_CHAT_ID,
    };
  }

  async function createTestOrder(code: string) {
    return db.order.create({
      data: {
        code,
        senderName: "Người gửi Test",
        senderPhone: "0901234567",
        receiverName: "Người nhận Test",
        receiverPhone: "0907654321",
        address: "123 Đường Test",
        area: "Khu vực trung tâm",
        deliveryDate: new Date("2026-11-27"),
        deliverySlot: "08:00 – 10:00",
        subtotal: 100000,
        shippingFee: 25000,
        total: 125000,
        paymentMethod: "COD",
        items: { create: [{ name: "Bó hoa test", price: 100000, quantity: 1 }] },
      },
    });
  }

  it("không có dòng cài đặt + có env → bank bật + Telegram bật (hành vi cũ)", async () => {
    const merged = readEffectiveSettings(envWithBankAndTelegram());
    assert.equal(merged.bankEnabled, true);
    assert.equal(merged.bankCode, "970415");
    assert.equal(merged.telegramEnabled, true);
    // Không env → cả hai đều tắt.
    const envEmpty: NodeJS.ProcessEnv = { ...process.env };
    delete envEmpty.BANK_BIN;
    delete envEmpty.BANK_ACCOUNT;
    delete envEmpty.BANK_ACCOUNT_NAME;
    delete envEmpty.TELEGRAM_BOT_TOKEN;
    delete envEmpty.TELEGRAM_CHAT_ID;
    const mergedEmpty = readEffectiveSettings(envEmpty);
    assert.equal(mergedEmpty.bankEnabled, false);
    assert.equal(mergedEmpty.telegramEnabled, false);
  });

  it("có dòng bank tắt → cài đặt thắng env (dù env đủ)", async () => {
    // Ghi trực tiếp (saveSettingsToDb bỏ qua vì mặc định của tiến
    // trình này đã là tắt) — đây là bước dựng trạng thái, không
    // phải phần đang kiểm.
    await db.siteSetting.upsert({
      where: { key: "bank.enabled" },
      update: { value: "false", updatedBy: "admin-test" },
      create: { key: "bank.enabled", value: "false", updatedBy: "admin-test" },
    });
    const merged = readEffectiveSettings(envWithBankAndTelegram());
    assert.equal(merged.bankEnabled, false);
    await db.siteSetting.deleteMany({ where: { key: { startsWith: "bank." } } });
  });

  it("Telegram: không có dòng + có env → đơn mới được báo (hành vi cũ)", async () => {
    const oldToken = process.env.TELEGRAM_BOT_TOKEN;
    const oldChatId = process.env.TELEGRAM_CHAT_ID;
    const oldFetch = globalThis.fetch;
    const fetchCalls: string[] = [];
    process.env.TELEGRAM_BOT_TOKEN = TEST_TOKEN;
    process.env.TELEGRAM_CHAT_ID = TEST_CHAT_ID;
    globalThis.fetch = (async (url: unknown) => {
      fetchCalls.push(String(url));
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }) as typeof fetch;
    try {
      assert.equal(await isTelegramNotifyEnabled(), true);
      const order = await createTestOrder("A2TEST0001");
      assert.equal(await sendOrderNotification(order.id), true);
      assert.equal(fetchCalls.length, 1);
      assert.ok(fetchCalls[0]?.includes(`/bot${TEST_TOKEN}/sendMessage`));
      const reloaded = await db.order.findUnique({ where: { id: order.id } });
      assert.ok(reloaded?.notifiedAt !== null);
    } finally {
      globalThis.fetch = oldFetch;
      if (oldToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = oldToken;
      if (oldChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
      else process.env.TELEGRAM_CHAT_ID = oldChatId;
    }
  });

  it("Telegram: có dòng tắt → đơn mới không báo dù env đủ; bật lại → báo", async () => {
    const oldToken = process.env.TELEGRAM_BOT_TOKEN;
    const oldChatId = process.env.TELEGRAM_CHAT_ID;
    const oldFetch = globalThis.fetch;
    const fetchCalls: string[] = [];
    process.env.TELEGRAM_BOT_TOKEN = TEST_TOKEN;
    process.env.TELEGRAM_CHAT_ID = TEST_CHAT_ID;
    globalThis.fetch = (async (url: unknown) => {
      fetchCalls.push(String(url));
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    }) as typeof fetch;
    try {
      // Ghi trực tiếp (saveSettingsToDb bỏ qua vì mặc định của tiến
      // trình này đã là tắt — .env không có TELEGRAM_*; đây là bước
      // dựng trạng thái, không phải phần đang kiểm).
      await db.siteSetting.upsert({
        where: { key: "telegram.enabled" },
        update: { value: "false", updatedBy: "admin-test" },
        create: { key: "telegram.enabled", value: "false", updatedBy: "admin-test" },
      });
      assert.equal(await isTelegramNotifyEnabled(), false);
      const orderOff = await createTestOrder("A2TEST0002");
      assert.equal(await sendOrderNotification(orderOff.id), false);
      assert.equal(fetchCalls.length, 0);
      await saveSettingsToDb(
        "telegram",
        { telegramChatId: TEST_CHAT_ID, telegramEnabled: true },
        "admin-test",
      );
      assert.equal(await isTelegramNotifyEnabled(), true);
      const orderOn = await createTestOrder("A2TEST0003");
      assert.equal(await sendOrderNotification(orderOn.id), true);
      assert.equal(fetchCalls.length, 1);
    } finally {
      globalThis.fetch = oldFetch;
      if (oldToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = oldToken;
      if (oldChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
      else process.env.TELEGRAM_CHAT_ID = oldChatId;
    }
  });
});
