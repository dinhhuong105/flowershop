// Test CÓ DB thật — Ẩn/Hiện sản phẩm, vòng đi-về (Đợt 4 — 25/11).
// Chạy riêng, KHÔNG nằm trong `npm test`:
//   npm run test:db
// Chỉ chạy khi DATABASE_URL trỏ localhost; ngược lại file báo lỗi
// rõ và dừng (không bao giờ chạy lên DB production).
// Dùng đúng SP 21 (TEST-001, "Bó Hoa Đồng Tiền Thử Nghiệm") rồi
// trả lại trạng thái ban đầu trong finally, không để DB bẩn.

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

process.loadEnvFile(".env");

const dbHost = (() => {
  try {
    return new URL((process.env.DATABASE_URL ?? "").trim()).hostname;
  } catch {
    return "";
  }
})();
if (dbHost !== "localhost" && dbHost !== "127.0.0.1" && dbHost !== "::1") {
  throw new Error(
    `[test:db] Từ chối chạy: DATABASE_URL không phải localhost (host: ${dbHost || "(trống)"}).`,
  );
}

import { db } from "../db";
import { setProductActive } from "./products";

const TEST_PRODUCT_ID = 21;

async function readActive(id: number): Promise<boolean | null> {
  const row = await db.product.findUnique({
    where: { id },
    select: { isActive: true },
  });
  return row ? row.isActive : null;
}

describe("admin toggle product active (DB)", () => {
  let initialActive: boolean | null = null;

  before(async () => {
    initialActive = await readActive(TEST_PRODUCT_ID);
    assert.notEqual(
      initialActive,
      null,
      "SP 21 (TEST-001) phải tồn tại — chạy scripts/recreate-test-data.ts trước",
    );
  });

  it("Ẩn rồi Hiện lại: vòng đi-về trả đúng trạng thái ban đầu", async () => {
    try {
      const hid = await setProductActive(TEST_PRODUCT_ID, false);
      assert.equal(hid, true, "phải đổi được SP 21");
      assert.equal(await readActive(TEST_PRODUCT_ID), false, "sau Ẩn phải là false");

      const shown = await setProductActive(TEST_PRODUCT_ID, true);
      assert.equal(shown, true, "phải đổi lại được SP 21");
      assert.equal(await readActive(TEST_PRODUCT_ID), true, "sau Hiện lại phải là true");
    } finally {
      if (initialActive !== null) {
        await setProductActive(TEST_PRODUCT_ID, initialActive);
      }
    }
    assert.equal(
      await readActive(TEST_PRODUCT_ID),
      initialActive,
      "cuối test phải trả lại trạng thái ban đầu",
    );
  });

  it("đổi sản phẩm không tồn tại thì báo không đổi được", async () => {
    const changed = await setProductActive(999999, false);
    assert.equal(changed, false);
  });
});
