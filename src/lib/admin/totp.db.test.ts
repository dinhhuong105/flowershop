// Test DB cho TOTP (Ngày 19 Phần C): luồng bật/tắt, xác minh mã,
// mã khôi phục dùng một lần, thu hồi phiên khác, thiếu khóa → tắt.
// Chạy: npx tsx --test src/lib/admin/totp.db.test.ts
// Dọn sạch sau test: dòng 2FA, phiên đã tạo, nhật ký totp.*.
process.loadEnvFile(".env");

import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { db } from "@/lib/db";
import { totpCodeAt } from "./totp";
import { decryptTotpSecret } from "./totp-crypto";
import {
  TOTP_ROW_ID,
  confirmTotpSetup,
  disableTotp,
  getTotpStatus,
  isTotpLoginRequired,
  regenerateRecoveryCodes,
  startTotpSetup,
  verifyTotpOrRecoveryCode,
} from "./totp-store";
import { hashSessionToken, revokeOtherAdminSessions } from "./auth";

const savedKey = process.env.AUTH_ENCRYPTION_KEY;
const TEST_KEY = randomBytes(32).toString("base64");

const createdSessionIds: number[] = [];

async function cleanup() {
  await db.adminTwoFactor.deleteMany({ where: { id: TOTP_ROW_ID } });
  await db.adminPendingSession.deleteMany({});
  await db.rateLimitEvent.deleteMany({ where: { key: { startsWith: "totp:" } } });
  await db.settingsAudit.deleteMany({ where: { key: { startsWith: "totp." } } });
}

async function mintFullSession() {
  const token = randomBytes(32).toString("base64url");
  const row = await db.adminSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    },
  });
  createdSessionIds.push(row.id);
  return row.id;
}

async function cleanupSessions() {
  for (const id of createdSessionIds) {
    await db.adminSession.deleteMany({ where: { id } });
  }
  createdSessionIds.length = 0;
}

before(async () => {
  process.env.AUTH_ENCRYPTION_KEY = TEST_KEY;
  await cleanup();
});

after(async () => {
  await cleanup();
  await cleanupSessions();
  if (savedKey === undefined) delete process.env.AUTH_ENCRYPTION_KEY;
  else process.env.AUTH_ENCRYPTION_KEY = savedKey;
  await db.$disconnect();
});

describe("luồng bật 2FA (cài đặt → xác nhận → đã bật)", () => {
  it("start: lưu bí mật ĐÃ MÃ HÓA (không phải dạng rõ), chưa bật", async () => {
    const { secret } = await startTotpSetup();
    assert.equal(secret.length, 32);
    const row = await db.adminTwoFactor.findUnique({ where: { id: TOTP_ROW_ID } });
    assert.ok(row);
    assert.equal(row.enabledAt, null);
    assert.notEqual(row.encryptedSecret, secret);
    assert.equal(decryptTotpSecret(row.encryptedSecret), secret);
  });

  it("confirm sai mã → chưa bật; confirm đúng mã → bật + 10 mã khôi phục", async () => {
    const { secret } = await startTotpSetup();
    const wrong = await confirmTotpSetup("000000");
    assert.deepEqual(wrong, { ok: false });
    assert.equal((await getTotpStatus()).enabled, false);

    const code = totpCodeAt(secret)!;
    const ok = await confirmTotpSetup(code);
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.recoveryCodes.length, 10);
      assert.equal(new Set(ok.recoveryCodes).size, 10);
      for (const c of ok.recoveryCodes) assert.match(c, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    }
    const status = await getTotpStatus();
    assert.equal(status.enabled, true);
    assert.equal(status.recoveryRemaining, 10);
    assert.equal(await isTotpLoginRequired(), true);
  });
});

describe("xác minh mã + mã khôi phục", () => {
  let secret = "";
  let recoveryCodes: string[] = [];

  before(async () => {
    const started = await startTotpSetup();
    secret = started.secret;
    const confirmed = await confirmTotpSetup(totpCodeAt(secret)!);
    assert.equal(confirmed.ok, true);
    if (confirmed.ok) recoveryCodes = confirmed.recoveryCodes;
  });

  it("mã đúng → ok; dùng lại đúng mã đó → từ chối (chống dùng lại)", async () => {
    // Mã của bước SAU bước đã dùng khi confirm (tránh trùng lastUsedStep).
    const future = new Date(Date.now() + 35_000);
    const code = totpCodeAt(secret, future)!;
    const first = await verifyTotpOrRecoveryCode(code, future);
    assert.deepEqual(first, { ok: true, usedRecovery: false });
    const replay = await verifyTotpOrRecoveryCode(code, future);
    assert.deepEqual(replay, { ok: false });
  });

  it("mã khôi phục dùng được đúng một lần", async () => {
    const code = recoveryCodes[0];
    const first = await verifyTotpOrRecoveryCode(code);
    assert.deepEqual(first, { ok: true, usedRecovery: true });
    const second = await verifyTotpOrRecoveryCode(code);
    assert.deepEqual(second, { ok: false });
    // Mã khôi phục khác vẫn còn hiệu lực.
    assert.equal((await getTotpStatus()).recoveryRemaining, 9);
    const third = await verifyTotpOrRecoveryCode(recoveryCodes[1]);
    assert.deepEqual(third, { ok: true, usedRecovery: true });
    assert.equal((await getTotpStatus()).recoveryRemaining, 8);
  });

  it("mã sai (TOTP và mã khôi phục sai định dạng) → từ chối", async () => {
    assert.deepEqual(await verifyTotpOrRecoveryCode("000000"), { ok: false });
    assert.deepEqual(await verifyTotpOrRecoveryCode("AAAAA-AAAAA"), { ok: false });
    assert.deepEqual(await verifyTotpOrRecoveryCode("không phải mã"), { ok: false });
  });

  it("tạo lại mã khôi phục: mã cũ hết hiệu lực, mã mới dùng được", async () => {
    const oldCode = recoveryCodes[2];
    const fresh = await regenerateRecoveryCodes();
    assert.equal(fresh.length, 10);
    assert.equal((await getTotpStatus()).recoveryRemaining, 10);
    assert.deepEqual(await verifyTotpOrRecoveryCode(oldCode), { ok: false });
    assert.deepEqual(await verifyTotpOrRecoveryCode(fresh[0]), {
      ok: true,
      usedRecovery: true,
    });
  });
});

describe("thiếu khóa → tính năng tắt; tắt 2FA", () => {
  it("xóa khóa env → isTotpLoginRequired false dù đã bật", async () => {
    assert.equal(await isTotpLoginRequired(), true);
    delete process.env.AUTH_ENCRYPTION_KEY;
    assert.equal(await isTotpLoginRequired(), false);
    assert.deepEqual(await verifyTotpOrRecoveryCode("123456"), { ok: false });
    process.env.AUTH_ENCRYPTION_KEY = TEST_KEY;
    assert.equal(await isTotpLoginRequired(), true);
  });

  it("disableTotp: xóa dòng, hết hiệu lực, nhật ký có dòng tắt", async () => {
    await disableTotp();
    assert.equal((await getTotpStatus()).enabled, false);
    assert.equal(await isTotpLoginRequired(), false);
    const audit = await db.settingsAudit.findFirst({
      where: { key: "totp.disabled" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(audit);
    assert.ok(!(audit.newValue ?? "").includes("scrypt"));
  });
});

describe("quyết định phiên khi bật/tắt 2FA: thu hồi phiên khác", () => {
  it("revokeOtherAdminSessions giữ đúng 1 phiên, xóa các phiên còn lại", async () => {
    // Đếm TƯƠNG ĐỐI (không tuyệt đối): file test khác chạy song
    // song cũng mint phiên admin, nên tổng số phiên toàn cục thay
    // đổi — chỉ khẳng định đúng 3 phiên mình tạo và đúng 2 bị xóa.
    const before = await db.adminSession.count();
    const keep = await mintFullSession();
    await mintFullSession();
    await mintFullSession();
    assert.equal(await db.adminSession.count(), before + 3);
    const removed = await revokeOtherAdminSessions(keep);
    assert.equal(removed, 2);
    assert.equal(await db.adminSession.count(), before + 1);
    assert.ok(await db.adminSession.findUnique({ where: { id: keep } }));
  });
});
