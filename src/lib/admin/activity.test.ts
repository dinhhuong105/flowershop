// Test thuần — nhật ký hoạt động (Ngày 15 C1/C2): khu vực theo
// khóa, che giá trị nhạy cảm, cắt ngắn, định dạng giờ VN.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_VALUE_MAX,
  activityAreaOf,
  displayActivityValue,
  formatActivityChange,
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
  it("không biết khóa (mặc định): số điện thoại 10 số vẫn bị che (quét dãy số)", () => {
    assert.equal(maskSensitiveForDisplay("0886706338"), "****6338");
  });
  it("Ngày 16 #2: contact.hotline và contact.zalo KHÔNG che (thông tin công khai)", () => {
    assert.equal(maskSensitiveForDisplay("0886706338", "contact.hotline"), "0886706338");
    assert.equal(maskSensitiveForDisplay("0900123456", "contact.hotline"), "0900123456");
    assert.equal(maskSensitiveForDisplay("0900123456", "contact.zalo"), "0900123456");
  });
  it("Ngày 16 #2: số tài khoản vẫn che (quét dãy số)", () => {
    assert.equal(maskSensitiveForDisplay("123456789012", "bank.accountNumber"), "****9012");
    assert.equal(maskSensitiveForDisplay("1234 5678 9012", "bank.accountNumber"), "****9012");
  });
  it("Ngày 16 #2: khóa chứa token/password/secret → che toàn bộ", () => {
    assert.equal(maskSensitiveForDisplay("123456789:AAEabc123", "telegram.botToken"), "********");
    assert.equal(maskSensitiveForDisplay("mat-khau-bi-mat", "admin.password"), "********");
    assert.equal(maskSensitiveForDisplay("abc123XYZ", "api.clientSecret"), "********");
  });
  it("Ngày 16 #2: khóa lạ vẫn quét dãy số (phòng thủ)", () => {
    assert.equal(maskSensitiveForDisplay("123456789012", "khong-biet"), "****9012");
  });
});

describe("formatActivityChange", () => {
  it("vòng đời trang: created/deleted/updated → nhãn Việt", () => {
    assert.equal(formatActivityChange(null, "created"), "Đã tạo");
    assert.equal(formatActivityChange("Giới thiệu", "deleted"), "Đã xóa");
    assert.equal(formatActivityChange("Tiêu đề cũ", "updated"), "Cập nhật");
  });
  it("xuất bản/nháp: draft ↔ published → nhãn Việt có mũi tên", () => {
    assert.equal(formatActivityChange("draft", "published"), "Nháp → Đã xuất bản");
    assert.equal(formatActivityChange("published", "draft"), "Đã xuất bản → Nháp");
  });
  it("giá trị khác → null (hiển thị cặp thô như cũ)", () => {
    assert.equal(formatActivityChange("0886706338", "0900123456"), null);
    assert.equal(formatActivityChange(null, "sent"), null);
    assert.equal(formatActivityChange("", "Hoa Tươi Demo"), null);
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
  it("fixup sau verdict Ngày 16: giá trị rỗng → (trống) — thêm/xóa/sửa/cả 2 phía rỗng", () => {
    // Thêm: cũ rỗng → "(trống)", mới hiện đầy đủ.
    assert.equal(displayActivityValue("", "contact.hotline"), "(trống)");
    assert.equal(displayActivityValue("0900123456", "contact.hotline"), "0900123456");
    // Xóa: cũ hiện đầy đủ, mới rỗng → "(trống)".
    assert.equal(displayActivityValue("0900123456", "contact.hotline"), "0900123456");
    assert.equal(displayActivityValue(""), "(trống)");
    // Sửa: cả 2 phía đều có giá trị → hiện như cũ.
    assert.equal(displayActivityValue("Hoa Tươi", "general.siteName"), "Hoa Tươi");
    assert.equal(displayActivityValue("Hoa Tươi Demo", "general.siteName"), "Hoa Tươi Demo");
    // Cả 2 phía rỗng (null hoặc "").
    assert.equal(displayActivityValue(null), "(trống)");
    assert.equal(displayActivityValue(null, "contact.hotline"), "(trống)");
  });
  it("fixup 3: cặp cũ → mới của STK — phía rỗng hiện (trống), không phải ****", () => {
    // Cách trang nhật ký ghép cặp: cũ → mới (mỗi phía qua displayActivityValue).
    const pair = (oldV: string | null, newV: string | null) =>
      `${displayActivityValue(oldV, "bank.accountNumber")} → ${displayActivityValue(newV, "bank.accountNumber")}`;
    // Cũ rỗng (nhật ký lưu "" sau khi mask sửa) → "(trống) → ****1098".
    assert.equal(pair("", "****1098"), "(trống) → ****1098");
    // Mới rỗng → "****9012 → (trống)".
    assert.equal(pair("****9012", ""), "****9012 → (trống)");
    // Cả 2 phía rỗng → "(trống) → (trống)".
    assert.equal(pair("", ""), "(trống) → (trống)");
    // Cả 2 phía có giá trị → giữ nguyên như cũ.
    assert.equal(pair("****9012", "****1098"), "****9012 → ****1098");
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
