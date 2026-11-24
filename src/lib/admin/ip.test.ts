import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clientIpFromHeaders, trustedProxyHops } from "./ip";

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("trustedProxyHops", () => {
  it("mặc định 1 khi không đặt env", () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    assert.equal(trustedProxyHops(), 1);
  });
  it("đọc số nguyên hợp lệ từ env", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    assert.equal(trustedProxyHops(), 2);
    delete process.env.TRUSTED_PROXY_HOPS;
  });
  it("0, âm, không phải số → về 1", () => {
    for (const v of ["0", "-1", "abc", "1.5", ""]) {
      process.env.TRUSTED_PROXY_HOPS = v;
      assert.equal(trustedProxyHops(), 1, v);
    }
    delete process.env.TRUSTED_PROXY_HOPS;
  });
});

describe("clientIpFromHeaders (K-1)", () => {
  it('"9.9.9.9, 2.2.2.2" với hops=1 → 2.2.2.2 (phần tử cuối)', () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    assert.equal(
      clientIpFromHeaders(headers({ "x-forwarded-for": "9.9.9.9, 2.2.2.2" })),
      "2.2.2.2",
    );
  });
  it("phần tử đầu do client đặt KHÔNG được tin (kẻ tấn công đổi header mỗi lần)", () => {
    delete process.env.TRUSTED_PROXY_HOPS;
    // Client tự đặt "1.2.3.4" ở đầu, proxy đáng tin thêm "5.6.7.8" ở cuối.
    assert.equal(
      clientIpFromHeaders(headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })),
      "5.6.7.8",
    );
  });
  it("hops=2 lấy phần tử thứ hai từ cuối", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    assert.equal(
      clientIpFromHeaders(
        headers({ "x-forwarded-for": "9.9.9.9, 2.2.2.2, 3.3.3.3" }),
      ),
      "2.2.2.2",
    );
    delete process.env.TRUSTED_PROXY_HOPS;
  });
  it("một IP duy nhất → chính nó", () => {
    assert.equal(
      clientIpFromHeaders(headers({ "x-forwarded-for": "203.0.113.7" })),
      "203.0.113.7",
    );
  });
  it("thiếu X-Forwarded-For → X-Real-IP", () => {
    assert.equal(
      clientIpFromHeaders(headers({ "x-real-ip": "198.51.100.9" })),
      "198.51.100.9",
    );
  });
  it("thiếu cả hai header → unknown", () => {
    assert.equal(clientIpFromHeaders(headers({})), "unknown");
  });
  it("hops lớn hơn số phần tử → rơi về X-Real-IP", () => {
    process.env.TRUSTED_PROXY_HOPS = "5";
    assert.equal(
      clientIpFromHeaders(
        headers({ "x-forwarded-for": "9.9.9.9, 2.2.2.2", "x-real-ip": "198.51.100.9" }),
      ),
      "198.51.100.9",
    );
    delete process.env.TRUSTED_PROXY_HOPS;
  });
});
