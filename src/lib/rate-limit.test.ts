// Unit test S9 — hàm rate-limit dùng chung (phần thuần, không cần DB).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRateLimitKey,
  rateLimitWindowStart,
} from "./rate-limit";

describe("normalizeRateLimitKey", () => {
  it("giữ chữ/số và : - _ . /", () => {
    assert.equal(normalizeRateLimitKey("login:ip:abc-123_def.4/5"), "login:ip:abc-123_def.4/5");
  });
  it("cắt khoảng trắng, thay ký tự lạ (kể cả NUL) bằng _", () => {
    assert.equal(normalizeRateLimitKey("  order:ip:a b\0c@d  "), "order:ip:a_b_c_d");
  });
  it("cắt tối đa 200 ký tự", () => {
    assert.equal(normalizeRateLimitKey("x".repeat(250)).length, 200);
  });
  it("không chứa IP thô khi tầng gọi đã băm (khóa mẫu)", () => {
    const key = normalizeRateLimitKey("login:ip:9f86d081884c7d659a2feaa0c55ad015");
    assert.ok(!key.includes("127.0.0.1"));
  });
});

describe("rateLimitWindowStart (cửa sổ trượt)", () => {
  it("now - windowMs", () => {
    const now = new Date("2026-11-27T10:00:00Z");
    assert.equal(
      rateLimitWindowStart(now, 15 * 60 * 1000).toISOString(),
      "2026-11-27T09:45:00.000Z",
    );
  });
  it("cửa sổ 0 giây → chính now", () => {
    const now = new Date("2026-11-27T10:00:00Z");
    assert.equal(rateLimitWindowStart(now, 0).getTime(), now.getTime());
  });
});
