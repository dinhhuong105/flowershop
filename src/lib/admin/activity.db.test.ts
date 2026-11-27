// Test CÓ DB thật (Ngày 15 C2) — nhật ký hoạt động: lọc theo khu
// vực/từ khóa/khoảng ngày, phân trang 20/trang, không rò STK/token.
// Chỉ chạy khi DATABASE_URL trỏ localhost. Dữ liệu tự tạo (khóa
// chứa "n15") rồi tự xóa.

import { describe, it, before, after } from "node:test";
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
import { displayActivityValue, listActivity } from "./activity";

const MARK = "n15";
const DAY_20 = new Date("2026-11-20T02:00:00Z"); // 09:00 giờ VN 20/11
const DAY_26 = new Date("2026-11-26T02:00:00Z"); // 09:00 giờ VN 26/11

async function clean() {
  await db.settingsAudit.deleteMany({
    where: { OR: [{ key: { contains: MARK } }, { updatedBy: `admin-${MARK}` }] },
  });
}

describe("nhật ký hoạt động (Ngày 15 C1/C2)", () => {
  before(async () => {
    await clean();
    // 31 dòng (theo ví dụ đặc tả C2): 20 dòng ngày 20/11 + 11 dòng
    // ngày 26/11 (7 dòng chung + 4 dòng đặc biệt đủ các khu vực);
    // 1 dòng STK thô + 1 dòng token để kiểm không rò rỉ.
    const rows: Array<{
      key: string;
      oldValue: string | null;
      newValue: string;
      updatedBy: string;
      createdAt: Date;
    }> = [];
    for (let i = 0; i < 20; i++) {
      rows.push({
        key: `general.${MARK}-${i}`,
        oldValue: `cũ ${i}`,
        newValue: `mới ${i}`,
        updatedBy: `admin-${MARK}`,
        createdAt: DAY_20,
      });
    }
    for (let i = 0; i < 7; i++) {
      rows.push({
        key: `general.${MARK}-b${i}`,
        oldValue: `cũ b${i}`,
        newValue: `mới b${i}`,
        updatedBy: `admin-${MARK}`,
        createdAt: DAY_26,
      });
    }
    rows.push(
      {
        key: `contact.${MARK}-hotline`,
        oldValue: "0900000000",
        newValue: "0886706338",
        updatedBy: `admin-${MARK}`,
        createdAt: DAY_26,
      },
      {
        key: `bank.${MARK}-stk`,
        oldValue: "123456789012",
        newValue: "****9012",
        updatedBy: `admin-${MARK}`,
        createdAt: DAY_26,
      },
      {
        key: `bank.notify`,
        oldValue: null,
        newValue: "sent",
        updatedBy: `admin-${MARK}`,
        createdAt: DAY_26,
      },
      {
        key: `page:${MARK}-trang`,
        oldValue: "draft",
        newValue: "published",
        updatedBy: `admin-${MARK}`,
        createdAt: DAY_26,
      },
    );
    // Tổng: 20 + 7 + 4 = 31 dòng (trang 1: 20, trang 2: 11).
    await db.settingsAudit.createMany({ data: rows });
  });

  after(clean);

  it("phân trang: 31 dòng → 2 trang, trang 1 có 20, trang 2 có 11", async () => {
    const p1 = await listActivity({ q: MARK, page: 1 });
    assert.equal(p1.total, 31);
    assert.equal(p1.totalPages, 2);
    assert.equal(p1.rows.length, 20);
    const p2 = await listActivity({ q: MARK, page: 2 });
    assert.equal(p2.rows.length, 11);
  });

  it("mới nhất trước (ngày 26/11 lên đầu)", async () => {
    const list = await listActivity({ q: MARK, page: 1 });
    const first = list.rows[0].createdAt.getTime();
    const last = list.rows[list.rows.length - 1].createdAt.getTime();
    assert.ok(first >= last, "dòng đầu phải mới hơn hoặc bằng dòng cuối");
    assert.equal(first, DAY_26.getTime());
  });

  it("lọc theo khu vực: contact chỉ ra dòng liên hệ; page chỉ ra dòng trang tĩnh", async () => {
    const contact = await listActivity({ area: "contact", q: MARK });
    assert.equal(contact.total, 1);
    assert.equal(contact.rows[0].key, `contact.${MARK}-hotline`);
    const page = await listActivity({ area: "page", q: MARK });
    assert.equal(page.total, 1);
    assert.equal(page.rows[0].key, `page:${MARK}-trang`);
    const bank = await listActivity({ area: "bank", q: MARK });
    assert.equal(bank.total, 2); // bank.n15-stk + bank.notify
  });

  it("tìm theo khóa hoặc người thay đổi", async () => {
    const byKey = await listActivity({ q: `${MARK}-hotline` });
    assert.equal(byKey.total, 1);
    const byPerson = await listActivity({ q: `admin-${MARK}`, page: 1 });
    assert.equal(byPerson.total, 31);
  });

  it("lọc theo khoảng ngày (giờ VN): chỉ ngày 26/11 → 11 dòng", async () => {
    const list = await listActivity({
      q: MARK,
      from: "2026-11-26",
      to: "2026-11-26",
      page: 1,
    });
    assert.equal(list.total, 11);
    const older = await listActivity({ q: MARK, from: "2026-11-20", to: "2026-11-20" });
    assert.equal(older.total, 20);
  });

  it("không rò STK/token khi hiển thị: giá trị thô được che trước khi ra trang", async () => {
    const list = await listActivity({ area: "bank", q: MARK, page: 1 });
    const stkRow = list.rows.find((r) => r.key === `bank.${MARK}-stk`);
    assert.ok(stkRow, "phải có dòng STK");
    const shownOld = displayActivityValue(stkRow.oldValue, stkRow.key);
    const shownNew = displayActivityValue(stkRow.newValue, stkRow.key);
    assert.ok(!shownOld.includes("123456789012"), "không được lộ STK đầy đủ");
    assert.equal(shownOld, "****9012");
    assert.equal(shownNew, "****9012");
  });
});
