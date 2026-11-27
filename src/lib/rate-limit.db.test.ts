// Test CÓ DB thật (Ngày 17 S9) — rate-limit dùng chung:
// cửa sổ trượt, khóa khi đủ limit, tự mở khi cửa sổ trôi qua,
// reset mở khóa sớm, dọn hàng cũ. Chỉ chạy khi DATABASE_URL trỏ
// localhost. Khóa test có tiền tố "s17-test:" rồi tự xóa.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "./db";
import {
  checkRateLimit,
  pruneRateLimitEvents,
  resetRateLimit,
} from "./rate-limit";

const PREFIX = "s17-test:";

after(async () => {
  await db.rateLimitEvent.deleteMany({ where: { key: { startsWith: PREFIX } } });
  await db.$disconnect();
});

describe("checkRateLimit (DB, cửa sổ trượt)", () => {
  it("limit 3: 3 lần đầu allowed, lần 4 bị chặn, remaining giảm dần", async () => {
    const key = `${PREFIX}slide:${Date.now()}`;
    const r1 = await checkRateLimit({ key, limit: 3, windowMs: 60_000 });
    const r2 = await checkRateLimit({ key, limit: 3, windowMs: 60_000 });
    const r3 = await checkRateLimit({ key, limit: 3, windowMs: 60_000 });
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 2);
    assert.equal(r2.remaining, 1);
    assert.equal(r3.remaining, 0);
    const r4 = await checkRateLimit({ key, limit: 3, windowMs: 60_000 });
    assert.equal(r4.allowed, false);
    assert.equal(r4.remaining, 0);
    assert.ok(r4.retryAfterSeconds > 0 && r4.retryAfterSeconds <= 60);
    // Lần bị chặn KHÔNG ghi thêm sự kiện: resetAt không đổi sau lần chặn nữa.
    const r5 = await checkRateLimit({ key, limit: 3, windowMs: 60_000 });
    assert.equal(r5.allowed, false);
    assert.equal(r5.resetAt.getTime(), r4.resetAt.getTime());
    await resetRateLimit(key);
  });

  it("khóa tự mở khi cửa sổ trôi qua (sự kiện cũ ngoài window)", async () => {
    const key = `${PREFIX}expiry:${Date.now()}`;
    await db.rateLimitEvent.create({
      data: { key, createdAt: new Date(Date.now() - 61_000) },
    });
    await db.rateLimitEvent.create({
      data: { key, createdAt: new Date(Date.now() - 61_000) },
    });
    const r = await checkRateLimit({ key, limit: 2, windowMs: 60_000 });
    assert.equal(r.allowed, true);
    assert.equal(r.remaining, 1);
    await resetRateLimit(key);
  });

  it("reset mở khóa sớm: đủ limit rồi reset → lại allowed", async () => {
    const key = `${PREFIX}reset:${Date.now()}`;
    await checkRateLimit({ key, limit: 1, windowMs: 60_000 });
    assert.equal((await checkRateLimit({ key, limit: 1, windowMs: 60_000 })).allowed, false);
    const deleted = await resetRateLimit(key);
    assert.equal(deleted, 1);
    assert.equal((await checkRateLimit({ key, limit: 1, windowMs: 60_000 })).allowed, true);
    await resetRateLimit(key);
  });

  it("khóa khác nhau đếm riêng", async () => {
    const k1 = `${PREFIX}iso-a:${Date.now()}`;
    const k2 = `${PREFIX}iso-b:${Date.now()}`;
    await checkRateLimit({ key: k1, limit: 1, windowMs: 60_000 });
    assert.equal((await checkRateLimit({ key: k1, limit: 1, windowMs: 60_000 })).allowed, false);
    assert.equal((await checkRateLimit({ key: k2, limit: 1, windowMs: 60_000 })).allowed, true);
    await resetRateLimit(k1);
    await resetRateLimit(k2);
  });

  it("prune dọn hàng cũ hơn ngưỡng, giữ hàng mới", async () => {
    const key = `${PREFIX}prune:${Date.now()}`;
    await db.rateLimitEvent.create({
      data: { key, createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    await checkRateLimit({ key, limit: 5, windowMs: 60_000 });
    const deleted = await pruneRateLimitEvents(24 * 60 * 60 * 1000);
    assert.ok(deleted >= 1);
    const left = await db.rateLimitEvent.count({ where: { key } });
    assert.equal(left, 1);
    await resetRateLimit(key);
  });

  it("tham số sai → throw (khóa trống, limit < 1, window ≤ 0)", async () => {
    await assert.rejects(checkRateLimit({ key: "   ", limit: 5, windowMs: 60_000 }));
    await assert.rejects(checkRateLimit({ key: `${PREFIX}x`, limit: 0, windowMs: 60_000 }));
    await assert.rejects(checkRateLimit({ key: `${PREFIX}x`, limit: 5, windowMs: 0 }));
  });
});
