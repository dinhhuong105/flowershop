import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildVietQrPayload, crc16CcittFalse, parseVietQrPayload } from "./vietqr";

describe("crc16CcittFalse (D5-22)", () => {
  it('CRC16 của "123456789" = 29B1', () => {
    assert.equal(crc16CcittFalse("123456789"), "29B1");
  });
});

describe("buildVietQrPayload (D5-22)", () => {
  const input = { bin: "970415", account: "1122334455", amount: 2387000, content: "DH ABC123DEFG" };
  it("dựng payload và phân tích ngược ra đúng BIN, tài khoản, số tiền, nội dung", () => {
    const payload = buildVietQrPayload(input);
    const parsed = parseVietQrPayload(payload);
    assert.ok(parsed);
    assert.equal(parsed.bin, "970415");
    assert.equal(parsed.account, "1122334455");
    assert.equal(parsed.amount, 2387000);
    assert.equal(parsed.content, "DH ABC123DEFG");
  });
  it("CRC trong payload khớp tính lại trên phần trước CRC", () => {
    const payload = buildVietQrPayload(input);
    const parsed = parseVietQrPayload(payload);
    assert.ok(parsed);
    assert.equal(parsed.crc, crc16CcittFalse(payload.slice(0, -4)));
    assert.match(payload, /6304[0-9A-F]{4}$/);
  });
  it("payload mẫu công khai của VietQR (vietnam-qr-pay): phân tích + CRC đều đúng", () => {
    // Ví dụ trong tài liệu công khai (vietnam-qr-pay): BIN 970416, tài
    // khoản 257678859, số tiền 1000, nội dung "Chuyen tien". CRC tính
    // lại khớp BBB8 nên chuỗi mẫu này được xác nhận nguyên vẹn.
    const sample =
      "00020101021238530010A0000007270123000697041601092576788590208QRIBFTTA5303704540410005802VN62150811Chuyen tien6304BBB8";
    const parsed = parseVietQrPayload(sample);
    assert.ok(parsed);
    assert.equal(parsed.bin, "970416");
    assert.equal(parsed.account, "257678859");
    assert.equal(parsed.amount, 1000);
    assert.equal(parsed.content, "Chuyen tien");
    assert.equal(parsed.crc, "BBB8");
    assert.equal(parsed.crc, crc16CcittFalse(sample.slice(0, -4)));
  });
  it("payload tĩnh mẫu của vietqr_gen: phân tích + CRC đều đúng", () => {
    // Techcombank BIN 970407, tài khoản 9602091996, không số tiền,
    // không nội dung — chuỗi mẫu này cũng được xác nhận bằng CRC 34A0.
    const sample =
      "00020101021138540010A00000072701240006970407011096020919960208QRIBFTTA53037045802VN630434A0";
    const parsed = parseVietQrPayload(sample);
    assert.ok(parsed);
    assert.equal(parsed.bin, "970407");
    assert.equal(parsed.account, "9602091996");
    assert.equal(parsed.amount, null);
    assert.equal(parsed.content, null);
    assert.equal(parsed.crc, "34A0");
    assert.equal(parsed.crc, crc16CcittFalse(sample.slice(0, -4)));
  });
  it("từ chối BIN không đủ 6 số", () => {
    assert.throws(() => buildVietQrPayload({ ...input, bin: "97041" }), /BIN/);
    assert.throws(() => buildVietQrPayload({ ...input, bin: "97041A" }), /BIN/);
  });
  it("từ chối số tài khoản sai định dạng", () => {
    assert.throws(() => buildVietQrPayload({ ...input, account: "123" }), /tài khoản/);
    assert.throws(() => buildVietQrPayload({ ...input, account: "11223A4455" }), /tài khoản/);
  });
  it("từ chối số tiền âm/0/không nguyên", () => {
    assert.throws(() => buildVietQrPayload({ ...input, amount: 0 }), /Số tiền/);
    assert.throws(() => buildVietQrPayload({ ...input, amount: -5 }), /Số tiền/);
    assert.throws(() => buildVietQrPayload({ ...input, amount: 1.5 }), /Số tiền/);
  });
  it("từ chối nội dung có ký tự không phải ASCII", () => {
    assert.throws(() => buildVietQrPayload({ ...input, content: "DH Áo dài" }), /ASCII/);
  });
  it("từ chối nội dung rỗng hoặc quá 25 ký tự", () => {
    assert.throws(() => buildVietQrPayload({ ...input, content: "" }), /25 ký tự/);
    assert.throws(() => buildVietQrPayload({ ...input, content: "x".repeat(26) }), /25 ký tự/);
  });
  it("nội dung đúng 25 ký tự thì được", () => {
    assert.doesNotThrow(() => buildVietQrPayload({ ...input, content: "x".repeat(25) }));
  });
});
