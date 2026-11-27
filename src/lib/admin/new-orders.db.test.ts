// Test CÓ DB thật (Ngày 17 N3/N5) — theo dõi đơn mới:
//   - hàm đếm đơn cần xử lý / quá hạn + mã đơn mới nhất,
//   - bộ lọc overdue=1 của listAdminOrders khớp số trên thẻ tổng quan,
//   - route GET /api/admin/orders/new-count qua HTTP trên server
//     standalone (cần `npm run build` trước; nếu chưa build thì khối
//     HTTP tự bỏ qua — phần DB vẫn chạy).
// Chỉ chạy khi DATABASE_URL trỏ localhost. Dữ liệu tự tạo (mã
// NOVERDUE*) rồi tự xóa.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";

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
import { getAdminDashboardStats } from "./dashboard";
import { listAdminOrders } from "./orders";
import type { OrderStatus } from "@prisma/client";
import {
  getNewOrderCount,
  getOverduePendingCount,
} from "./new-orders";

// Ngày VN hiện tại / hôm qua / ngày mai (dạng YYYY-MM-DD → date UTC).
function vnDay(offsetDays: number): Date {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000));
  return new Date(`${day}T00:00:00Z`);
}

const CODE_OVERDUE_NEW = "NOVERDUE01"; // NEW, giao hôm qua → quá hạn
const CODE_OVERDUE_DELIVERING = "NOVERDUE02"; // DELIVERING, giao hôm qua → quá hạn
const CODE_TODAY_NEW = "NOVERDUE03"; // NEW, giao hôm nay → chưa quá hạn
const CODE_OVERDUE_COMPLETED = "NOVERDUE04"; // COMPLETED, giao hôm qua → không tính
const CODE_OVERDUE_CANCELLED = "NOVERDUE05"; // CANCELLED, giao hôm qua → không tính
const CODE_TOMORROW_CONFIRMED = "NOVERDUE06"; // CONFIRMED, giao ngày mai → chưa quá hạn
const TEST_CODES = [
  CODE_OVERDUE_NEW,
  CODE_OVERDUE_DELIVERING,
  CODE_TODAY_NEW,
  CODE_OVERDUE_COMPLETED,
  CODE_OVERDUE_CANCELLED,
  CODE_TOMORROW_CONFIRMED,
];

// Số đơn quá hạn trước khi file này tạo đơn test (để assert theo
// delta — xem ghi chú trong before()).
let baselineOverdue = 0;

async function createTestOrder(
  code: string,
  status: OrderStatus,
  deliveryDate: Date,
) {
  const product = await db.product.findFirst({
    where: { id: 1 },
    select: { id: true, name: true, salePrice: true, price: true },
  });
  assert.ok(product, "cần sản phẩm id 1 (chạy seed gốc trước)");
  const unitPrice = product.salePrice ?? product.price;
  return db.order.create({
    data: {
      code,
      senderName: "DB Test",
      senderPhone: "0900000011",
      senderEmail: null,
      receiverName: "Người Nhận DB",
      receiverPhone: "0900000012",
      address: "1 đường DB Test",
      area: "Khu vực trung tâm",
      deliveryDate,
      deliverySlot: "08:00 – 10:00",
      deliveryMethod: "SCHEDULED",
      deliverySurcharge: 0,
      subtotal: unitPrice,
      shippingFee: 25000,
      total: unitPrice + 25000,
      paymentMethod: "COD",
      paymentStatus: "UNPAID",
      paidAt: null,
      status,
      items: {
        create: [
          {
            productId: product.id,
            name: product.name,
            price: unitPrice,
            quantity: 1,
            image: null,
          },
        ],
      },
    },
  });
}

before(async () => {
  await db.order.deleteMany({ where: { code: { in: TEST_CODES } } });
  // Số mốc TRƯỚC khi tạo (các file test:db khác chạy song song cũng
  // tạo đơn, và dữ liệu recreate có 3 đơn mẫu NEW giao 24/11 — đúng
  // là quá hạn — nên chỉ assert theo DELTA, không assert số tuyệt đối).
  const beforeCount = await getNewOrderCount();
  const beforeOverdue = await getOverduePendingCount();
  baselineOverdue = beforeOverdue;
  // Tạo theo thứ tự: đơn tạo sau cùng là đơn cần xử lý mới nhất.
  await createTestOrder(CODE_OVERDUE_NEW, "NEW", vnDay(-1));
  await createTestOrder(CODE_OVERDUE_DELIVERING, "DELIVERING", vnDay(-1));
  await createTestOrder(CODE_TODAY_NEW, "NEW", vnDay(0));
  await createTestOrder(CODE_OVERDUE_COMPLETED, "COMPLETED", vnDay(-1));
  await createTestOrder(CODE_OVERDUE_CANCELLED, "CANCELLED", vnDay(-1));
  await createTestOrder(CODE_TOMORROW_CONFIRMED, "CONFIRMED", vnDay(1));
  const afterCount = await getNewOrderCount();
  const afterOverdue = await getOverduePendingCount();
  // 4 đơn cần xử lý mới (01, 02, 03, 06); 2 đơn quá hạn (01, 02).
  assert.equal(afterCount.pendingCount - beforeCount.pendingCount, 4);
  assert.equal(afterOverdue - beforeOverdue, 2);
});

after(async () => {
  await db.order.deleteMany({ where: { code: { in: TEST_CODES } } });
  await db.rateLimitEvent.deleteMany({
    where: { key: { startsWith: "new-count:" } },
  });
  await db.$disconnect();
});

describe("getNewOrderCount / getOverduePendingCount (DB)", () => {
  it("latestCode là mã đơn cần xử lý mới nhất thật trong DB", async () => {
    const counted = await getNewOrderCount();
    const newest = await db.order.findFirst({
      where: { status: { in: ["NEW", "CONFIRMED", "DELIVERING"] } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { code: true },
    });
    assert.equal(counted.latestCode, newest?.code ?? null);
  });

  it("thẻ tổng quan: overduePendingCount khớp danh sách overdue", async () => {
    const stats = await getAdminDashboardStats();
    const list = await listAdminOrders({ tab: "pending", overdue: true });
    // Bài học Ngày 10: số trên thẻ PHẢI bằng số trong danh sách đích.
    assert.equal(stats.overduePendingCount, list.total);
    // Delta do file này tạo: 2 đơn quá hạn mới.
    assert.equal(list.total - baselineOverdue, 2);
    const codes = list.orders.map((o) => o.code);
    assert.ok(codes.includes(CODE_OVERDUE_NEW));
    assert.ok(codes.includes(CODE_OVERDUE_DELIVERING));
    assert.equal(list.counts.pending, list.total);
  });

  it("overdue không tính đơn đã giao / đã hủy dù giao ngày cũ", async () => {
    // Tab "all" + overdue vẫn chỉ ra đơn chưa giao/chưa hủy, và
    // vẫn khớp số trên thẻ tổng quan.
    const stats = await getAdminDashboardStats();
    const list = await listAdminOrders({ tab: "all", overdue: true });
    assert.equal(list.total, stats.overduePendingCount);
    assert.ok(
      list.orders.every(
        (o) => o.status !== "COMPLETED" && o.status !== "CANCELLED",
      ),
    );
    const codes = list.orders.map((o) => o.code);
    assert.ok(!codes.includes(CODE_OVERDUE_COMPLETED));
    assert.ok(!codes.includes(CODE_OVERDUE_CANCELLED));
    assert.ok(codes.includes(CODE_OVERDUE_NEW));
    assert.ok(codes.includes(CODE_OVERDUE_DELIVERING));
  });

  it("không lọc overdue thì danh sách pending gồm cả đơn chưa quá hạn", async () => {
    const list = await listAdminOrders({ tab: "pending", q: "NOVERDUE" });
    assert.equal(list.total, 4);
  });
});

// --- Route HTTP trên server standalone (cần build trước) ---
const HAS_BUILD = existsSync(".next/standalone/server.js");
const describeHttp = HAS_BUILD ? describe : describe.skip;
if (!HAS_BUILD) {
  console.warn(
    "[new-orders.db.test] Bỏ qua khối HTTP: chưa có .next/standalone/server.js — chạy `npm run build` trước để kiểm route.",
  );
}

describeHttp("GET /api/admin/orders/new-count (HTTP, standalone)", () => {
  const PORT = 3101;
  const BASE = `http://127.0.0.1:${PORT}`;
  let server: ChildProcess | null = null;
  let sessionToken: string | null = null;

  before(async () => {
    server = spawn(
      process.execPath,
      ["--env-file=.env", ".next/standalone/server.js"],
      {
        cwd: process.cwd(),
        env: { ...process.env, PORT: String(PORT), HOSTNAME: "127.0.0.1" },
        stdio: "ignore",
      },
    );
    // Chờ trang chủ trả 200 (tối đa 30 giây).
    const deadline = Date.now() + 30_000;
    for (;;) {
      try {
        const res = await fetch(`${BASE}/`);
        if (res.ok) break;
      } catch {
        // Chưa lên — thử lại.
      }
      if (Date.now() > deadline) throw new Error("server standalone không lên");
      await new Promise((r) => setTimeout(r, 500));
    }
  });

  after(async () => {
    if (sessionToken) {
      await db.adminSession
        .deleteMany({
          where: {
            tokenHash: createHash("sha256").update(sessionToken).digest("hex"),
          },
        })
        .catch(() => undefined);
    }
    await db.rateLimitEvent
      .deleteMany({ where: { key: { startsWith: "new-count:" } } })
      .catch(() => undefined);
    if (server) {
      server.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 500));
    }
  });

  it("không đăng nhập → 401, không lộ dữ liệu khách, no-store", async () => {
    const res = await fetch(`${BASE}/api/admin/orders/new-count`);
    assert.equal(res.status, 401);
    assert.match(res.headers.get("cache-control") ?? "", /no-store/);
    const body = (await res.json()) as Record<string, unknown>;
    const text = JSON.stringify(body);
    for (const leaked of ["senderName", "receiverPhone", "0900000011", "total"]) {
      assert.ok(!text.includes(leaked), `phản hồi 401 lộ ${leaked}`);
    }
  });

  it("đăng nhập → 200 và chỉ đúng 2 trường", async () => {
    // Tạo phiên admin trực tiếp trong DB (như probe CDP Ngày 16).
    sessionToken = randomBytes(32).toString("base64url");
    await db.adminSession.create({
      data: {
        tokenHash: createHash("sha256").update(sessionToken).digest("hex"),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      },
    });
    const expected = await getNewOrderCount();
    const res = await fetch(`${BASE}/api/admin/orders/new-count`, {
      headers: { Cookie: `admin_session=${sessionToken}` },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("cache-control") ?? "", /no-store/);
    const body = (await res.json()) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body).sort(), ["latestCode", "pendingCount"]);
    assert.equal(body.pendingCount, expected.pendingCount);
    assert.equal(body.latestCode, expected.latestCode);
  });

  it("quá giới hạn → 429 kèm Retry-After", async () => {
    assert.ok(sessionToken, "cần phiên admin từ ca trước");
    let got429 = false;
    for (let i = 0; i < 35; i++) {
      const res: Response = await fetch(`${BASE}/api/admin/orders/new-count`, {
        headers: { Cookie: `admin_session=${sessionToken}` },
      });
      if (res.status === 429) {
        assert.ok(res.headers.get("retry-after"), "thiếu Retry-After");
        got429 = true;
        break;
      }
      assert.equal(res.status, 200);
    }
    assert.ok(got429, "gọi 35 lần vẫn không bị giới hạn (limit 30/phút)");
  });
});
