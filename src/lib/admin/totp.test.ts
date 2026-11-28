// Test thuần TOTP (Ngày 19 Phần C) — RFC 6238, cửa sổ ±1 bước,
// chống dùng lại, mã hóa AES-256-GCM. Không cần DB/server.
// Chạy: npx tsx --test src/lib/admin/totp.test.ts
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  base32Decode,
  base32Encode,
  buildOtpAuthUrl,
  generateTotpSecret,
  normalizeTotpCodeInput,
  totpCodeAt,
  totpCodeAtStep,
  totpStepAt,
  verifyTotpCode,
} from "./totp";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  getTotpEncryptionKey,
  isTotpAvailable,
} from "./totp-crypto";

// Vector kiểm thử RFC 6238 Appendix B (SHA1, secret ASCII
// "12345678901234567890", 20 byte): giá trị 8 chữ số trong RFC,
// test 6 chữ số = 8 chữ số mod 1.000.000 (cùng thuật toán, chỉ cắt
// ngắn hơn — đúng cách app Authenticator hiển thị 6 số). Đã đối
// chiếu độc lập bằng Python (hmac/hashlib) ngày 28/11.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const RFC_VECTORS: Array<[number, string]> = [
  [59, "287082"], // 94287082
  [1111111109, "081804"], // 07081804
  [1111111111, "050471"], // 14050471
  [1234567890, "005924"], // 89005924
  [2000000000, "279037"], // 69279037
  [20000000000, "353130"], // 65353130
];

describe("RFC 6238 — vector kiểm thử (SHA1, 6 chữ số, bước 30 s)", () => {
  for (const [seconds, expected] of RFC_VECTORS) {
    it(`T=${seconds} → ${expected}`, () => {
      assert.equal(totpCodeAt(RFC_SECRET, new Date(seconds * 1000)), expected);
    });
  }

  it("base32 khứ hồi (khóa 20 byte → 32 ký tự → đúng lại 20 byte)", () => {
    const raw = randomBytes(20);
    const encoded = base32Encode(raw);
    assert.equal(encoded.length, 32);
    assert.deepEqual(base32Decode(encoded), raw);
    assert.equal(base32Decode("gezdgnbvgy3tqojqgezdgnbvgy3tqojq")?.toString("ascii"), "12345678901234567890");
  });

  it("secret sai định dạng → null (không ném)", () => {
    assert.equal(totpCodeAt("!!!khong-phai-base32!!!", new Date()), null);
    assert.equal(totpCodeAt("", new Date()), null);
    assert.equal(base32Decode("***"), null);
  });

  it("sinh bí mật mới: 32 ký tự base32, mỗi lần khác nhau", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    assert.equal(a.length, 32);
    assert.match(a, /^[A-Z2-7]{32}$/);
    assert.notEqual(a, b);
    assert.equal(base32Decode(a)?.length, 20);
  });
});

describe("cửa sổ chấp nhận ±1 bước + chống dùng lại", () => {
  const now = new Date(1_700_000_000_000);
  const step = totpStepAt(now);
  const codeNow = totpCodeAtStep(RFC_SECRET, step)!;
  const codePrev = totpCodeAtStep(RFC_SECRET, step - 1)!;
  const codeNext = totpCodeAtStep(RFC_SECRET, step + 1)!;
  const codeOld = totpCodeAtStep(RFC_SECRET, step - 2)!;
  const codeFuture = totpCodeAtStep(RFC_SECRET, step + 2)!;

  it("mã hiện tại, bước trước, bước sau đều đúng", () => {
    assert.deepEqual(verifyTotpCode(RFC_SECRET, codeNow, now), { ok: true, step });
    assert.deepEqual(verifyTotpCode(RFC_SECRET, codePrev, now), { ok: true, step: step - 1 });
    assert.deepEqual(verifyTotpCode(RFC_SECRET, codeNext, now), { ok: true, step: step + 1 });
  });

  it("mã quá cũ (bước -2) / quá mới (bước +2) bị từ chối", () => {
    assert.deepEqual(verifyTotpCode(RFC_SECRET, codeOld, now), { ok: false });
    assert.deepEqual(verifyTotpCode(RFC_SECRET, codeFuture, now), { ok: false });
  });

  it("mã sai / sai định dạng bị từ chối", () => {
    assert.deepEqual(verifyTotpCode(RFC_SECRET, "000000", now), { ok: false });
    assert.deepEqual(verifyTotpCode(RFC_SECRET, "12345", now), { ok: false });
    assert.deepEqual(verifyTotpCode(RFC_SECRET, "1234567", now), { ok: false });
    assert.deepEqual(verifyTotpCode(RFC_SECRET, "abcdef", now), { ok: false });
    assert.deepEqual(verifyTotpCode(RFC_SECRET, "", now), { ok: false });
  });

  it("mã đã dùng (step <= lastUsedStep) bị từ chối dù còn trong cửa sổ", () => {
    // Dùng mã bước hiện tại lần 1 → ok.
    const first = verifyTotpCode(RFC_SECRET, codeNow, now, null);
    assert.deepEqual(first, { ok: true, step });
    // Dùng lại đúng mã đó → từ chối (đã dùng bước này rồi).
    assert.deepEqual(verifyTotpCode(RFC_SECRET, codeNow, now, step), { ok: false });
    // Mã bước trước (cũ hơn bước đã dùng) cũng bị từ chối.
    assert.deepEqual(verifyTotpCode(RFC_SECRET, codePrev, now, step), { ok: false });
    // Nhưng mã bước sau (chưa dùng) vẫn đúng.
    assert.deepEqual(verifyTotpCode(RFC_SECRET, codeNext, now, step), { ok: true, step: step + 1 });
  });

  it("chuẩn hóa mã nhập: bỏ khoảng trắng, phải đúng 6 số", () => {
    assert.equal(normalizeTotpCodeInput(" 123456 "), "123456");
    assert.equal(normalizeTotpCodeInput("123 456"), "123456");
    assert.equal(normalizeTotpCodeInput("12345a"), null);
    assert.equal(normalizeTotpCodeInput("1234567"), null);
  });
});

describe("otpauth:// URL cho mã QR", () => {
  it("đúng dạng otpauth://totp/<issuer>:<admin>?secret=…&issuer=…", () => {
    const url = buildOtpAuthUrl({ issuer: "Hoa Tươi", account: "admin", secret: RFC_SECRET });
    assert.ok(url.startsWith("otpauth://totp/"));
    assert.ok(url.includes(`secret=${RFC_SECRET}`));
    assert.ok(url.includes("issuer="));
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("secret"), RFC_SECRET);
    assert.equal(parsed.searchParams.get("issuer"), "Hoa Tươi");
  });
});

describe("mã hóa bí mật AES-256-GCM (khóa từ env)", () => {
  const savedKey = process.env.AUTH_ENCRYPTION_KEY;
  const restoreKey = () => {
    if (savedKey === undefined) delete process.env.AUTH_ENCRYPTION_KEY;
    else process.env.AUTH_ENCRYPTION_KEY = savedKey;
  };

  it("khứ hồi mã hóa–giải mã, hai lần mã hóa khác nhau (IV ngẫu nhiên)", () => {
    process.env.AUTH_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const enc1 = encryptTotpSecret(RFC_SECRET);
    const enc2 = encryptTotpSecret(RFC_SECRET);
    assert.notEqual(enc1, enc2);
    assert.equal(decryptTotpSecret(enc1), RFC_SECRET);
    assert.equal(decryptTotpSecret(enc2), RFC_SECRET);
    assert.notEqual(enc1, RFC_SECRET);
    restoreKey();
  });

  it("sửa 1 bit bản mã → giải mã thất bại (GCM xác thực tag)", () => {
    process.env.AUTH_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    const enc = encryptTotpSecret(RFC_SECRET);
    const raw = Buffer.from(enc, "base64");
    // Đổi 1 bit ở byte giữa bản mã (phần ciphertext).
    raw[raw.length - 1] ^= 0x01;
    assert.throws(() => decryptTotpSecret(raw.toString("base64")));
    // Đổi 1 bit ở tag cũng thất bại.
    const raw2 = Buffer.from(enc, "base64");
    raw2[15] ^= 0x01;
    assert.throws(() => decryptTotpSecret(raw2.toString("base64")));
    // Khóa khác cũng giải mã thất bại.
    process.env.AUTH_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    assert.throws(() => decryptTotpSecret(enc));
    restoreKey();
  });

  it("thiếu khóa → tính năng tắt, mã hóa ném lỗi (không lưu bí mật rõ)", () => {
    delete process.env.AUTH_ENCRYPTION_KEY;
    assert.equal(getTotpEncryptionKey(), null);
    assert.equal(isTotpAvailable(), false);
    assert.throws(() => encryptTotpSecret(RFC_SECRET));
    assert.throws(() => decryptTotpSecret("AAAA"));
    restoreKey();
  });

  it("khóa sai độ dài (16 byte) → không dùng được", () => {
    process.env.AUTH_ENCRYPTION_KEY = randomBytes(16).toString("base64");
    assert.equal(getTotpEncryptionKey(), null);
    assert.equal(isTotpAvailable(), false);
    restoreKey();
  });
});
