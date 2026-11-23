import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  availableSlotsForDate,
  availableSlotsToday,
  isExpressAvailable,
  isSameDayAvailable,
  isValidDeliveryDate,
  resolveDelivery,
  vnNow,
} from "./delivery-rules";

// Giờ VN = UTC+7: VN hh:mm ngày 22/11/2026 = UTC (hh-7):mm cùng ngày.
function vnDate(hour: number, minute: number, day = 22): Date {
  return new Date(Date.UTC(2026, 10, day, hour - 7, minute, 0));
}

describe("vnNow", () => {
  it("đọc đúng ngày/giờ VN bất kể TZ máy chủ", () => {
    // 02:00 UTC = 09:00 VN.
    assert.deepEqual(vnNow(new Date(Date.UTC(2026, 10, 22, 2, 0))), {
      date: "2026-11-22",
      minutes: 540,
    });
  });
});

describe("bảng biên mục 6.2 (D5-4)", () => {
  // [giờ VN, EXPRESS_2H, SAME_DAY]
  const cases: Array<[number, number, boolean, boolean]> = [
    [7, 29, false, false],
    [7, 30, true, true],
    [16, 0, true, true],
    [16, 1, true, false],
    [19, 0, true, false],
    [19, 1, false, false],
    [21, 0, false, false],
    [23, 30, false, false],
  ];
  for (const [h, m, express, sameDay] of cases) {
    it(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} → EXPRESS ${express ? "✓" : "✗"}, SAME_DAY ${sameDay ? "✓" : "✗"}`, () => {
      const now = vnDate(h, m);
      assert.equal(isExpressAvailable(now), express);
      assert.equal(isSameDayAvailable(now), sameDay);
    });
  }
});

describe("khung giờ còn chọn hôm nay (D5-5, sửa H-1)", () => {
  const cases: Array<[number, number, string[]]> = [
    [8, 0, ["10-12", "13-15", "15-17", "17-19"]],
    [9, 0, ["13-15", "15-17", "17-19"]],
    [11, 0, ["13-15", "15-17", "17-19"]],
    [11, 1, ["15-17", "17-19"]],
    [15, 0, ["17-19"]],
    [15, 1, []],
  ];
  for (const [h, m, expected] of cases) {
    it(`lúc ${h}:${String(m).padStart(2, "0")} → ${expected.join(", ") || "(hết)"}`, () => {
      assert.deepEqual(availableSlotsToday(vnDate(h, m)), expected);
    });
  }
});

describe("ngày giao hợp lệ (D5-5)", () => {
  const now = vnDate(9, 0); // 22/11/2026 09:00 VN
  it("hôm qua → sai", () => assert.equal(isValidDeliveryDate("2026-11-21", now), false));
  it("hôm nay → đúng", () => assert.equal(isValidDeliveryDate("2026-11-22", now), true));
  it("+30 ngày → đúng", () => assert.equal(isValidDeliveryDate("2026-12-22", now), true));
  it("+31 ngày → sai", () => assert.equal(isValidDeliveryDate("2026-12-23", now), false));
  it("chuỗi rác → sai", () => assert.equal(isValidDeliveryDate("abc", now), false));
  it("ngày không có thật (2026-02-30) → sai", () =>
    assert.equal(isValidDeliveryDate("2026-02-30", now), false));
  it("ngày khác hôm nay thì đủ 5 khung", () =>
    assert.deepEqual(availableSlotsForDate("2026-11-23", now), [
      "08-10",
      "10-12",
      "13-15",
      "15-17",
      "17-19",
    ]));
  it("ngày không hợp lệ thì không có khung nào", () =>
    assert.deepEqual(availableSlotsForDate("2026-11-21", now), []));
});

describe("addDays", () => {
  it("cộng ngày qua tháng", () => assert.equal(addDays("2026-11-22", 30), "2026-12-22"));
  it("trừ ngày", () => assert.equal(addDays("2026-11-22", -1), "2026-11-21"));
});

describe("resolveDelivery", () => {
  it("EXPRESS_2H lúc 09:00 → hôm nay, 'Trong 2 giờ kể từ khi shop xác nhận' (H-1)", () =>
    assert.deepEqual(resolveDelivery("EXPRESS_2H", null, null, vnDate(9, 0)), {
      deliveryDate: "2026-11-22",
      deliverySlot: "Trong 2 giờ kể từ khi shop xác nhận",
    }));
  it("SAME_DAY lúc 09:00 → hôm nay, 'Trước 18:00' từ sameDayDeliverBy (H-1)", () =>
    assert.deepEqual(resolveDelivery("SAME_DAY", null, null, vnDate(9, 0)), {
      deliveryDate: "2026-11-22",
      deliverySlot: "Trước 18:00",
    }));
  it("SAME_DAY lúc 17:00 → null (hết giờ)", () =>
    assert.equal(resolveDelivery("SAME_DAY", null, null, vnDate(17, 0)), null));
  it("SCHEDULED ngày mai, khung 10:00 – 12:00 → đúng", () =>
    assert.deepEqual(resolveDelivery("SCHEDULED", "2026-11-23", "10-12", vnDate(9, 0)), {
      deliveryDate: "2026-11-23",
      deliverySlot: "10:00 – 12:00",
    }));
  it("SCHEDULED hôm nay, khung đã qua → null", () =>
    assert.equal(resolveDelivery("SCHEDULED", "2026-11-22", "08-10", vnDate(9, 0)), null));
  it("SCHEDULED thiếu ngày/khung → null", () => {
    assert.equal(resolveDelivery("SCHEDULED", null, "10-12", vnDate(9, 0)), null);
    assert.equal(resolveDelivery("SCHEDULED", "2026-11-23", null, vnDate(9, 0)), null);
  });
});
