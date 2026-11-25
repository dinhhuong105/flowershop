import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { vnDayBounds } from "./admin/dashboard";
import { formatVnDateTime } from "./vn-datetime";

// Múi giờ dashboard (mục 4 verdict Ngày 10): Vercel chạy UTC nên
// vùng rủi ro là 00:00–07:00 giờ VN, khi ngày UTC còn lùi một ngày
// so với ngày VN. Kiểm live lúc 11:47 VN (04:47 UTC) và 23:xx đều
// không chạm vào vùng này (ngày VN = ngày UTC), nên chứng minh bằng
// unit test với thời điểm cố định thay vì chờ nửa đêm.
// 2026-11-24T18:00:00Z = 01:00 giờ VN ngày 25/11 (trong vùng rủi ro).
// 2026-11-24T16:59:59Z = 23:59 giờ VN ngày 24/11 (ngay trước ranh giới).
// 2026-11-24T17:00:00Z = 00:00 giờ VN ngày 25/11 (đúng ranh giới).

describe("ranh giới ngày theo giờ VN — vnDayBounds", () => {
  it("01:00 VN 25/11 → ngày 25/11, ranh giới 17:00Z 24/11 → 17:00Z 25/11", () => {
    const b = vnDayBounds(new Date("2026-11-24T18:00:00Z"));
    assert.equal(b.day, "2026-11-25");
    assert.equal(b.start.toISOString(), "2026-11-24T17:00:00.000Z");
    assert.equal(b.end.toISOString(), "2026-11-25T17:00:00.000Z");
  });
  it("23:59 VN 24/11 → ngày 24/11, ranh giới 17:00Z 23/11 → 17:00Z 24/11", () => {
    const b = vnDayBounds(new Date("2026-11-24T16:59:59Z"));
    assert.equal(b.day, "2026-11-24");
    assert.equal(b.start.toISOString(), "2026-11-23T17:00:00.000Z");
    assert.equal(b.end.toISOString(), "2026-11-24T17:00:00.000Z");
  });
  it("00:00 VN 25/11 → ngày 25/11, ranh giới 17:00Z 24/11 → 17:00Z 25/11", () => {
    const b = vnDayBounds(new Date("2026-11-24T17:00:00Z"));
    assert.equal(b.day, "2026-11-25");
    assert.equal(b.start.toISOString(), "2026-11-24T17:00:00.000Z");
    assert.equal(b.end.toISOString(), "2026-11-25T17:00:00.000Z");
  });
});

describe("nhãn giờ cập nhật dashboard — formatVnDateTime", () => {
  it("01:00 VN 25/11 → '01:00, 25/11/2026' (không được ra 24/11)", () => {
    assert.equal(
      formatVnDateTime(new Date("2026-11-24T18:00:00Z")),
      "01:00, 25/11/2026",
    );
  });
  it("23:59 VN 24/11 → '23:59, 24/11/2026'", () => {
    assert.equal(
      formatVnDateTime(new Date("2026-11-24T16:59:59Z")),
      "23:59, 24/11/2026",
    );
  });
  it("00:00 VN 25/11 → '00:00, 25/11/2026' (không được ra 24:00)", () => {
    assert.equal(
      formatVnDateTime(new Date("2026-11-24T17:00:00Z")),
      "00:00, 25/11/2026",
    );
  });
});
