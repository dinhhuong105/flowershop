// Test thuần — cờ Secure của cookie phiên admin (Ngày 20 B3b).
// isCookieSecure() quyết định cờ Secure cho cả cookie phiên đầy đủ
// (admin_session) lẫn cookie chờ xác minh (admin_pending): production
// → Secure; ADMIN_COOKIE_SECURE ghi đè rõ ràng (chỉ để thử qua HTTP).
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isCookieSecure } from "./auth";

const savedNodeEnv = process.env.NODE_ENV;
const savedFlag = process.env.ADMIN_COOKIE_SECURE;

// process.env.NODE_ENV là read-only theo kiểu @types/node nên
// gán qua Record cast (chỉ trong test này).
function setEnv(key: string, value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
}

beforeEach(() => {
  setEnv("ADMIN_COOKIE_SECURE", undefined);
});
afterEach(() => {
  setEnv("NODE_ENV", savedNodeEnv);
  setEnv("ADMIN_COOKIE_SECURE", savedFlag);
});

describe("isCookieSecure (Ngày 20 B3b)", () => {
  it("production, không cờ → Secure", () => {
    setEnv("NODE_ENV", "production");
    assert.equal(isCookieSecure(), true);
  });
  it("development/test, không cờ → không Secure", () => {
    setEnv("NODE_ENV", "development");
    assert.equal(isCookieSecure(), false);
    setEnv("NODE_ENV", "test");
    assert.equal(isCookieSecure(), false);
  });
  it("ADMIN_COOKIE_SECURE=true → Secure kể cả development", () => {
    setEnv("NODE_ENV", "development");
    setEnv("ADMIN_COOKIE_SECURE", "true");
    assert.equal(isCookieSecure(), true);
  });
  it("ADMIN_COOKIE_SECURE=false → không Secure kể cả production", () => {
    setEnv("NODE_ENV", "production");
    setEnv("ADMIN_COOKIE_SECURE", "false");
    assert.equal(isCookieSecure(), false);
  });
  it("cờ có khoảng trắng/hoa → vẫn nhận (trim + lowercase)", () => {
    setEnv("NODE_ENV", "development");
    setEnv("ADMIN_COOKIE_SECURE", " True ");
    assert.equal(isCookieSecure(), true);
    setEnv("ADMIN_COOKIE_SECURE", " FALSE ");
    assert.equal(isCookieSecure(), false);
  });
  it("cờ lạ → rơi về mặc định theo NODE_ENV", () => {
    setEnv("NODE_ENV", "production");
    setEnv("ADMIN_COOKIE_SECURE", "yes");
    assert.equal(isCookieSecure(), true);
    setEnv("NODE_ENV", "development");
    assert.equal(isCookieSecure(), false);
  });
});
