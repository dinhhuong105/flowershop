import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  UPLOAD_NAME_RE,
  checkUploadContentLength,
  detectImageType,
  uploadFileName,
} from "./uploads";

describe("detectImageType (magic bytes)", () => {
  it("JPEG FF D8 FF → jpg", () => {
    assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "jpg");
  });
  it("PNG 8 byte đầu → png", () => {
    assert.equal(
      detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "png",
    );
  });
  it("RIFF....WEBP → webp", () => {
    const buf = Buffer.alloc(12);
    buf.write("RIFF", 0, "ascii");
    buf.write("WEBP", 8, "ascii");
    assert.equal(detectImageType(buf), "webp");
  });
  it("GIF, SVG, file chữ, file rỗng → null", () => {
    assert.equal(detectImageType(Buffer.from("GIF89a", "ascii")), null);
    assert.equal(detectImageType(Buffer.from("<svg", "ascii")), null);
    assert.equal(detectImageType(Buffer.from("hello world", "ascii")), null);
    assert.equal(detectImageType(Buffer.alloc(0)), null);
  });
  it("PNG giả đuôi .jpg (magic bytes PNG) → png theo magic bytes", () => {
    assert.equal(
      detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "png",
    );
  });
});

describe("checkUploadContentLength (K-2)", () => {
  it("thiếu header → 411 (không đọc body chunked vào RAM)", () => {
    assert.deepEqual(checkUploadContentLength(null), {
      status: 411,
      error: "Thiếu Content-Length.",
    });
    assert.deepEqual(checkUploadContentLength(""), {
      status: 411,
      error: "Thiếu Content-Length.",
    });
  });
  it("không phải số hoặc âm → 411", () => {
    assert.equal(checkUploadContentLength("abc")?.status, 411);
    assert.equal(checkUploadContentLength("-5")?.status, 411);
  });
  it("> 5,5 MB → 413", () => {
    assert.deepEqual(checkUploadContentLength(String(6 * 1024 * 1024)), {
      status: 413,
      error: "File quá lớn (tối đa 5 MB/ảnh).",
    });
  });
  it("trong giới hạn → null (qua kiểm tra)", () => {
    assert.equal(checkUploadContentLength("0"), null);
    assert.equal(checkUploadContentLength("1024"), null);
    assert.equal(checkUploadContentLength(String(5 * 1024 * 1024)), null);
  });
});

describe("uploadFileName / UPLOAD_NAME_RE", () => {
  it("tên = 12 ký tự đầu sha256 + đuôi theo magic bytes", () => {
    const name = uploadFileName(Buffer.from("noi-dung-anh"), "jpg");
    assert.match(name, UPLOAD_NAME_RE);
    assert.ok(name.endsWith(".jpg"));
  });
  it("cùng nội dung → cùng tên (dùng lại file)", () => {
    assert.equal(
      uploadFileName(Buffer.from("abc"), "png"),
      uploadFileName(Buffer.from("abc"), "png"),
    );
  });
  it("tên lạ (path traversal, sai mẫu) không khớp regex", () => {
    assert.equal(UPLOAD_NAME_RE.test("../../x.png"), false);
    assert.equal(UPLOAD_NAME_RE.test("0123456789ab.jpeg"), false);
    assert.equal(UPLOAD_NAME_RE.test("0123456789ab.gif"), false);
    assert.equal(UPLOAD_NAME_RE.test("0123456789ab.jpg"), true);
  });
});
