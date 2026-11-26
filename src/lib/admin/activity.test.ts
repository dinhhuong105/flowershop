// Test thuần — nhật ký hoạt động (Ngày 15 C1/C2): khu vực theo
// khóa, che giá trị nhạy cảm, cắt ngắn, định dạng giờ VN.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_VALUE_MAX,
  activityAreaOf,
  displayActivityValue,
  maskSensitiveForDisplay,
  truncateActivityValue,
} from "./activity";
import { formatVnActivityTime } from "../vn-datetime";

describe("activityAreaOf", () => {
  it("suy khu vực từ tiền tố khóa; page:<slug> → Trang tĩnh", () => {
    assert.equal(activityAreaOf("general.siteName"), "general");
    assert.equal(activityAreaOf("contact.hotline"), "contact");
    assert.equal(activityAreaOf("bank.accountNumber"), "bank");
    assert.equal(activityAreaOf("bank.notify"), "bank");
    assert.equal(activityAreaOf("telegram.chatId"), "telegram");
    assert.equal(activityAreaOf("seo.defaultDescription"), "seo");
    assert.equal(activityAreaOf("page:gioi-thieu"), "page");
  });
  it("khóa lạ → gom vào Chung (không mất dòng)", () => {
    assert.equal(activityAreaOf("khong-biet"), "general");
  });
});

describe("maskSensitiveForDisplay", () => {
  it("null → —; STK 12 số → chỉ giữ 4 số cuối", () => {
    assert.equal(maskSensitiveForDisplay(null), "—");
    assert.equal(maskSensitiveForDisplay("123456789012"), "****9012");
  });
  it("STK có khoảng trắng/gạch nối xen giữa vẫn che hết", () => {
    assert.equal(maskSensitiveForDisplay("1234 5678 9012"), "****9012");
    assert.equal(maskSensitiveForDisplay("1234-5678-9012"), "****9012");
  });
  it("giá trị đã che (**** + 4 số cuối) giữ nguyên; dãy ngắn giữ nguyên", () => {
    assert.equal(maskSensitiveForDisplay("****9012"), "****9012");
    assert.equal(maskSensitiveForDisplay("2026"), "2026");
    assert.equal(maskSensitiveForDisplay("DH 12345"), "DH 12345");
  });
  it("mã token dạng số:đầu-mã → phần số bị che", () => {
    const masked = maskSensitiveForDisplay("123456789:AAEabc123");
    assert.ok(!masked.includes("123456789"), "không được lộ dãy số đầu token");
    assert.ok(masked.includes("****6789"));
  });
  it("số điện thoại 10 số cũng bị che (dãy số dài)", () => {
    assert.equal(maskSensitiveForDisplay("0886706338"), "****6338");
  });
});

describe("truncateActivityValue", () => {
  it("null → —; ≤ 60 ký tự giữ nguyên; dài hơn cắt + …", () => {
    assert.equal(truncateActivityValue(null), "—");
    const short = "x".repeat(ACTIVITY_VALUE_MAX);
    assert.equal(truncateActivityValue(short), short);
    const long = "y".repeat(ACTIVITY_VALUE_MAX + 10);
    const cut = truncateActivityValue(long);
    assert.equal(cut.length, ACTIVITY_VALUE_MAX);
    assert.ok(cut.endsWith("…"));
  });
});

describe("displayActivityValue", () => {
  it("che trước rồi cắt: STK dài vẫn chỉ còn **** + 4 số cuối", () => {
    assert.equal(displayActivityValue("123456789012"), "****9012");
  });
});

describe("formatVnActivityTime", () => {
  it("dạng dd/MM/yyyy HH:mm theo giờ VN (UTC+7)", () => {
    // 14:05 UTC = 21:05 giờ VN cùng ngày.
    assert.equal(
      formatVnActivityTime(new Date("2026-11-26T14:05:00Z")),
      "26/11/2026 21:05",
    );
    // 00:30 UTC = 07:30 giờ VN cùng ngày (không lùi ngày).
    assert.equal(
      formatVnActivityTime(new Date("2026-11-26T00:30:00Z")),
      "26/11/2026 07:30",
    );
    // 16:30 UTC ngày 25 = 23:30 giờ VN ngày 25.
    assert.equal(
      formatVnActivityTime(new Date("2026-11-25T16:30:00Z")),
      "25/11/2026 23:30",
    );
  });
});
