// Unit test S10 + S3 — header bảo mật và thoát JSON-LD.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCsp,
  buildSecurityHeaders,
  escapeJsonForScript,
} from "./security-headers";

describe("buildCsp (Ngày 17 S10)", () => {
  it("đủ chỉ thị tối thiểu, nonce theo request", () => {
    const csp = buildCsp("abc123");
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes("script-src 'self' 'nonce-abc123'"));
    assert.ok(!csp.includes("'unsafe-inline'") || csp.includes("style-src"));
    assert.ok(csp.includes("object-src 'none'"));
    assert.ok(csp.includes("base-uri 'self'"));
    assert.ok(csp.includes("frame-ancestors 'none'"));
    assert.ok(csp.includes("form-action 'self'"));
    assert.ok(csp.includes("public.blob.vercel-storage.com"));
  });
  it("script-src KHÔNG có 'unsafe-inline' (nonce thay thế)", () => {
    const scriptSrc = buildCsp("n").split(";").find((d) => d.trim().startsWith("script-src"))!;
    assert.ok(!scriptSrc.includes("unsafe-inline"));
  });
  it("nonce khác nhau → CSP khác nhau", () => {
    assert.notEqual(buildCsp("aaa"), buildCsp("bbb"));
  });
});

describe("buildSecurityHeaders", () => {
  it("có nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options", () => {
    const h = buildSecurityHeaders({ nonce: "n", isProduction: false });
    assert.equal(h["X-Content-Type-Options"], "nosniff");
    assert.equal(h["Referrer-Policy"], "strict-origin-when-cross-origin");
    assert.ok(h["Permissions-Policy"]!.includes("camera=()"));
    assert.ok(h["Permissions-Policy"]!.includes("microphone=()"));
    assert.ok(h["Permissions-Policy"]!.includes("geolocation=()"));
    assert.equal(h["X-Frame-Options"], "DENY");
  });
  it("HSTS ≥ 1 năm chỉ ở production", () => {
    assert.equal(
      buildSecurityHeaders({ nonce: "n", isProduction: true })["Strict-Transport-Security"],
      "max-age=31536000; includeSubDomains",
    );
    assert.equal(
      buildSecurityHeaders({ nonce: "n", isProduction: false })["Strict-Transport-Security"],
      undefined,
    );
  });
});

describe("escapeJsonForScript (Ngày 17 S3, JSON-LD)", () => {
  it('thoát "</script>" để không thoát khỏi thẻ script', () => {
    const json = JSON.stringify({ name: '</script><script>alert(1)</script>' });
    const out = escapeJsonForScript(json);
    assert.ok(!out.includes("</script>"));
    assert.ok(!out.includes("<script>"));
    assert.ok(out.includes("\\u003c/script\\u003e"));
    // JSON vẫn parse đúng về giá trị gốc.
    assert.equal(JSON.parse(out).name, '</script><script>alert(1)</script>');
  });
  it("thoát <, > và &", () => {
    assert.equal(escapeJsonForScript('{"a":"<b>&"}'), '{"a":"\\u003cb\\u003e\\u0026"}');
    assert.equal(JSON.parse(escapeJsonForScript('{"a":"<b>&"}')).a, "<b>&");
  });
  it("chuỗi không có ký tự đặc biệt giữ nguyên", () => {
    assert.equal(escapeJsonForScript('{"a":"Hoa Tuoi"}'), '{"a":"Hoa Tuoi"}');
  });
});
