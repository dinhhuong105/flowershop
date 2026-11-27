// Unit test S2 — hết hạn không hoạt động (idle) 30 phút cho admin.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ADMIN_SESSION_IDLE_MS, isSessionIdle } from "./auth";

describe("isSessionIdle (Ngày 17 S2)", () => {
  const now = new Date("2026-11-27T10:00:00Z");
  it("ngưỡng đúng 30 phút", () => {
    assert.equal(ADMIN_SESSION_IDLE_MS, 30 * 60 * 1000);
  });
  it("29 phút không hoạt động → chưa idle", () => {
    assert.equal(isSessionIdle(new Date(now.getTime() - 29 * 60 * 1000), now), false);
  });
  it("đúng 30 phút → chưa idle (chỉ > 30 phút mới hủy)", () => {
    assert.equal(isSessionIdle(new Date(now.getTime() - 30 * 60 * 1000), now), false);
  });
  it("31 phút không hoạt động → idle", () => {
    assert.equal(isSessionIdle(new Date(now.getTime() - 31 * 60 * 1000), now), true);
  });
  it("2 giờ không hoạt động → idle", () => {
    assert.equal(isSessionIdle(new Date(now.getTime() - 2 * 60 * 60 * 1000), now), true);
  });
});
