import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ORDER_CODE_RE,
  ORDER_TABS,
  isValidOrderTransition,
  nextOrderStatuses,
  normalizePhone,
  orderDayBadge,
  slotStartMinutes,
  validateCancelReason,
  validateInternalNote,
} from "./orders";
import { orderStatusLabel } from "../order-labels";

describe("bảng chuyển trạng thái đơn (đặc tả §2.1)", () => {
  it("NEW → CONFIRMED / CANCELLED; không nhảy cóc, không đi lùi", () => {
    assert.deepEqual(nextOrderStatuses("NEW"), ["CONFIRMED", "CANCELLED"]);
    assert.equal(isValidOrderTransition("NEW", "DELIVERING"), false);
    assert.equal(isValidOrderTransition("NEW", "COMPLETED"), false);
    assert.equal(isValidOrderTransition("NEW", "NEW"), false);
  });
  it("CONFIRMED → DELIVERING / CANCELLED", () => {
    assert.deepEqual(nextOrderStatuses("CONFIRMED"), ["DELIVERING", "CANCELLED"]);
    assert.equal(isValidOrderTransition("CONFIRMED", "COMPLETED"), false);
    assert.equal(isValidOrderTransition("CONFIRMED", "NEW"), false);
  });
  it("DELIVERING → COMPLETED / CANCELLED", () => {
    assert.deepEqual(nextOrderStatuses("DELIVERING"), ["COMPLETED", "CANCELLED"]);
    assert.equal(isValidOrderTransition("DELIVERING", "CONFIRMED"), false);
  });
  it("COMPLETED và CANCELLED là trạng thái cuối", () => {
    assert.deepEqual(nextOrderStatuses("COMPLETED"), []);
    assert.deepEqual(nextOrderStatuses("CANCELLED"), []);
    assert.equal(isValidOrderTransition("COMPLETED", "DELIVERING"), false);
    assert.equal(isValidOrderTransition("CANCELLED", "NEW"), false);
  });
  it("PREPARING (có trong enum từ Ngày 5) không có bước chuyển nào trong luồng Ngày 8", () => {
    assert.deepEqual(nextOrderStatuses("PREPARING"), []);
    assert.equal(isValidOrderTransition("PREPARING", "DELIVERING"), false);
    assert.equal(isValidOrderTransition("CONFIRMED", "PREPARING"), false);
  });
});

describe("ORDER_CODE_RE", () => {
  it("10 ký tự Crockford → khớp; sai → không", () => {
    assert.equal(ORDER_CODE_RE.test("QAFNN907ZY"), true);
    assert.equal(ORDER_CODE_RE.test("qafnn907zy"), false);
    assert.equal(ORDER_CODE_RE.test("QAFNN907Z"), false);
    assert.equal(ORDER_CODE_RE.test("QAFNN907ZYX"), false);
    assert.equal(ORDER_CODE_RE.test("QAFNN907ZI"), false); // I không có trong Crockford
    assert.equal(ORDER_CODE_RE.test("QAFNN907ZL"), false); // L không có trong Crockford
  });
});

describe("validateCancelReason", () => {
  it("2 ký tự → lỗi; 3 ký tự → ok; 200 → ok; 201 → lỗi", () => {
    assert.equal(validateCancelReason("ab"), "Lý do hủy phải từ 3 đến 200 ký tự.");
    assert.equal(validateCancelReason("  "), "Lý do hủy phải từ 3 đến 200 ký tự.");
    assert.equal(validateCancelReason("abc"), null);
    assert.equal(validateCancelReason("x".repeat(200)), null);
    assert.equal(validateCancelReason("x".repeat(201)), "Lý do hủy phải từ 3 đến 200 ký tự.");
  });
});

describe("validateInternalNote", () => {
  it("rỗng → ok; 500 ký tự → ok; 501 → lỗi", () => {
    assert.equal(validateInternalNote(""), null);
    assert.equal(validateInternalNote("x".repeat(500)), null);
    assert.equal(validateInternalNote("x".repeat(501)), "Ghi chú nội bộ tối đa 500 ký tự.");
  });
});

describe("normalizePhone", () => {
  it("bỏ khoảng trắng/dấu chấm/dấu gạch ngang", () => {
    assert.equal(normalizePhone("0900 000.000"), "0900000000");
    assert.equal(normalizePhone("0900-000-000"), "0900000000");
  });
  it("+84 ↔ 0", () => {
    assert.equal(normalizePhone("+84 900 000 000"), "0900000000");
    assert.equal(normalizePhone("+84900000000"), "0900000000");
    assert.equal(normalizePhone("84900000000"), "0900000000");
  });
  it("số đã chuẩn giữ nguyên", () => {
    assert.equal(normalizePhone("0900000000"), "0900000000");
  });
});

describe("orderDayBadge (ngày theo Asia/Ho_Chi_Minh)", () => {
  // Đồng hồ giả: 23:30 UTC ngày 24/11 = 06:30 ngày 25/11 giờ VN.
  const now = new Date("2026-11-24T23:30:00Z");
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
  it("giao 25/11 → Hôm nay (dù ở UTC vẫn là 24/11)", () => {
    assert.equal(orderDayBadge(day("2026-11-25"), now), "today");
  });
  it("giao 24/11 → Quá hạn", () => {
    assert.equal(orderDayBadge(day("2026-11-24"), now), "overdue");
  });
  it("giao 26/11 → không huy hiệu", () => {
    assert.equal(orderDayBadge(day("2026-11-26"), now), null);
  });
  it("nửa đêm UTC đúng ngày giao VN → Hôm nay", () => {
    // 16:30 UTC 24/11 = 23:30 24/11 giờ VN → vẫn là ngày 24/11.
    assert.equal(
      orderDayBadge(day("2026-11-24"), new Date("2026-11-24T16:30:00Z")),
      "today",
    );
    // 17:00 UTC 24/11 = 00:00 25/11 giờ VN → sang ngày 25/11.
    assert.equal(
      orderDayBadge(day("2026-11-24"), new Date("2026-11-24T17:00:00Z")),
      "overdue",
    );
  });
});

// Ngày 9 D9-5: nhãn trạng thái thống nhất giữa tab quản trị, huy hiệu
// và trang công khai — một nguồn duy nhất (src/lib/order-labels.ts).
describe("nhãn trạng thái thống nhất (Ngày 9 D9-5)", () => {
  it("tab trạng thái dùng đúng nhãn của huy hiệu", () => {
    const tabById = new Map(ORDER_TABS.map((t) => [t.id, t.label]));
    assert.equal(tabById.get("NEW"), orderStatusLabel("NEW"));
    assert.equal(tabById.get("CONFIRMED"), orderStatusLabel("CONFIRMED"));
    assert.equal(tabById.get("DELIVERING"), orderStatusLabel("DELIVERING"));
    assert.equal(tabById.get("COMPLETED"), orderStatusLabel("COMPLETED"));
    assert.equal(tabById.get("CANCELLED"), orderStatusLabel("CANCELLED"));
  });
  it("NEW = 'Đã tiếp nhận', COMPLETED = 'Đã giao'", () => {
    assert.equal(orderStatusLabel("NEW"), "Đã tiếp nhận");
    assert.equal(orderStatusLabel("COMPLETED"), "Đã giao");
  });
});

// Ngày 9 D9-5: "Cần xử lý" xếp theo giờ bắt đầu giao dạng số, không
// theo chuỗi nhãn.
describe("slotStartMinutes (Ngày 9 D9-5)", () => {
  it("giao nhanh 2 giờ → 0 (gấp nhất); khung hẹn → giờ bắt đầu", () => {
    assert.equal(slotStartMinutes("Trong 2 giờ kể từ khi shop xác nhận"), 0);
    assert.equal(slotStartMinutes("08:00 – 10:00"), 480);
    assert.equal(slotStartMinutes("10:00 – 12:00"), 600);
    assert.equal(slotStartMinutes("13:00 – 15:00"), 780);
    assert.equal(slotStartMinutes("15:00 – 17:00"), 900);
    assert.equal(slotStartMinutes("17:00 – 19:00"), 1020);
  });
  it("'Trước 18:00' → 1080; nhãn lạ → cuối ngày (1439)", () => {
    assert.equal(slotStartMinutes("Trước 18:00"), 1080);
    assert.equal(slotStartMinutes("Khung giờ lạ"), 1439);
    assert.equal(slotStartMinutes(""), 1439);
  });
  it("thứ tự số đúng: giao nhanh < 08:00 < 17:00 < Trước 18:00 < lạ", () => {
    const order = [
      "Trong 2 giờ kể từ khi shop xác nhận",
      "08:00 – 10:00",
      "17:00 – 19:00",
      "Trước 18:00",
      "Khung giờ lạ",
    ].map(slotStartMinutes);
    assert.deepEqual(order, [0, 480, 1020, 1080, 1439]);
  });
});
