// Test CÓ DB thật cho logic tạo đơn (Ngày 17, Phần O) — chạy riêng,
// KHÔNG nằm trong `npm test`:
//   npm run test:db
// Chỉ chạy khi DATABASE_URL trỏ localhost; ngược lại báo lỗi rõ và
// dừng (không bao giờ chạy lên DB production).
//
// Bao 5 lỗi đơn Ngày 10 (§1 đặc tả Ngày 17) + S8:
//  (a) số tiền tính lại từ DB (giá sale, phí khu vực, phụ phí);
//  (b) thứ tự — xem thêm describe "nhảy thứ tự" trong
//      src/lib/admin/orders.db.test.ts (danh sách admin);
//  (c) lý do hủy/hoàn tiền ghi đúng vào nhật ký order_events;
//  (d) mã đơn sai/không tồn tại/trùng lặp;
//  (e) phí giao theo khu vực của đơn.
// Dữ liệu tự tạo (giỏ + đơn + sản phẩm tạm) rồi tự xóa.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

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

import { db } from "./db";
import {
  createOrder,
  generateOrderCode,
  DuplicateOrderError,
  InvalidCartError,
  UnavailableProductsError,
  type CreateOrderInput,
} from "./order";
import { getDisplayPrice } from "./pricing";
import { getAdminOrder, transitionOrder } from "./admin/orders";

// Mã/giỏ/sản phẩm tạm tạo trong file — dọn trong after().
const createdOrderCodes: string[] = [];
const createdCartIds: string[] = [];
const createdProductIds: number[] = [];
let tempZoneId: number | null = null;

async function makeCart(lines: Array<{ productId: number; quantity: number }>) {
  const cart = await db.cart.create({
    data: {
      token: randomBytes(32).toString("hex"),
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      items: { create: lines },
    },
    select: { id: true },
  });
  createdCartIds.push(cart.id);
  return cart.id;
}

function tomorrow(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// Mỗi ca dùng một số điện thoại riêng: createOrder giới hạn 5 đơn
// /60 phút cho một số (kẻo ca trước làm ca sau bị RateLimitError).
let phoneSeq = 100;
function nextPhones(): { senderPhone: string; receiverPhone: string } {
  phoneSeq += 1;
  return {
    senderPhone: `0902000${String(phoneSeq).padStart(3, "0")}`,
    receiverPhone: `0903000${String(phoneSeq).padStart(3, "0")}`,
  };
}

function baseInput(
  cartId: string,
  overrides: Partial<CreateOrderInput> = {},
): CreateOrderInput {
  const phones = nextPhones();
  return {
    cartId,
    senderName: "Người Đặt DB",
    senderPhone: phones.senderPhone,
    senderEmail: null,
    receiverName: "Người Nhận DB",
    receiverPhone: phones.receiverPhone,
    address: "1 đường DB Test",
    zoneId: 1,
    deliveryMethod: "SCHEDULED",
    deliveryDate: tomorrow(),
    deliverySlot: "08:00 – 10:00",
    cardMessage: null,
    note: null,
    paymentMethod: "COD",
    ...overrides,
  };
}

before(async () => {
  // 51 sản phẩm tạm cho ca giới hạn 50 dòng (giỏ có ràng buộc duy
  // nhất [cartId, productId] nên cần đủ 51 sản phẩm khác nhau).
  const category = await db.category.findFirst({
    where: { id: 1 },
    select: { id: true },
  });
  assert.ok(category, "cần danh mục id 1 (chạy seed gốc trước)");
  for (let i = 0; i < 51; i++) {
    const p = await db.product.create({
      data: {
        categoryId: category.id,
        name: `SP Test Dòng ${i}`,
        slug: `dbord-test-dong-${i}`,
        price: 100000,
        salePrice: null,
        images: [],
        tags: [],
        sku: `DBORD-${i}`,
        isActive: true,
        inStock: true,
      },
      select: { id: true },
    });
    createdProductIds.push(p.id);
  }
  const zone = await db.shippingZone.create({
    data: { name: "Khu vực test đã tắt", fee: 9999, isActive: false, sortOrder: 99 },
    select: { id: true },
  });
  tempZoneId = zone.id;
});

after(async () => {
  if (createdOrderCodes.length > 0) {
    await db.order.deleteMany({ where: { code: { in: createdOrderCodes } } });
  }
  if (createdCartIds.length > 0) {
    await db.cartItem.deleteMany({ where: { cartId: { in: createdCartIds } } });
    await db.cart.deleteMany({ where: { id: { in: createdCartIds } } });
  }
  if (tempZoneId !== null) {
    await db.shippingZone.delete({ where: { id: tempZoneId } });
  }
  if (createdProductIds.length > 0) {
    await db.product.deleteMany({ where: { id: { in: createdProductIds } } });
  }
  await db.$disconnect();
});

describe("createOrder tính lại số tiền từ DB (Ngày 17, lỗi (a) + (e))", () => {
  it("tạm tính = giá sale × SL, phí = phí khu vực, tổng = tạm tính + phí", async () => {
    const p1 = await db.product.findUniqueOrThrow({ where: { id: 1 } });
    const p2 = await db.product.findUniqueOrThrow({ where: { id: 2 } });
    const zone = await db.shippingZone.findUniqueOrThrow({ where: { id: 1 } });
    const cartId = await makeCart([
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ]);
    const created = await createOrder(baseInput(cartId, { zoneId: 1 }));
    createdOrderCodes.push(created.code);
    const order = await db.order.findUniqueOrThrow({
      where: { code: created.code },
      include: { items: { orderBy: { id: "asc" } } },
    });
    const expectedSubtotal =
      getDisplayPrice(p1).current * 2 + getDisplayPrice(p2).current * 1;
    assert.equal(order.subtotal, expectedSubtotal);
    assert.equal(order.shippingFee, zone.fee);
    assert.equal(order.deliverySurcharge, 0);
    assert.equal(order.total, expectedSubtotal + zone.fee);
    assert.equal(order.area, zone.name);
    // Bản chụp dòng đơn dùng đúng giá đã chốt (giá sale khi có).
    assert.equal(order.items[0].price, getDisplayPrice(p1).current);
    assert.equal(order.items[0].quantity, 2);
    assert.equal(order.items[1].price, getDisplayPrice(p2).current);
    assert.equal(created.total, order.total);
  });

  it("cùng giỏ, khu vực khác nhau → phí + tổng khác nhau theo phí khu vực", async () => {
    const zone1 = await db.shippingZone.findUniqueOrThrow({ where: { id: 1 } });
    const zone4 = await db.shippingZone.findUniqueOrThrow({ where: { id: 4 } });
    assert.notEqual(zone1.fee, zone4.fee, "cần 2 khu vực phí khác nhau để kiểm");
    const cartA = await makeCart([{ productId: 1, quantity: 1 }]);
    const cartB = await makeCart([{ productId: 1, quantity: 1 }]);
    const a = await createOrder(baseInput(cartA, { zoneId: 1 }));
    const b = await createOrder(baseInput(cartB, { zoneId: 4 }));
    createdOrderCodes.push(a.code, b.code);
    const orderA = await db.order.findUniqueOrThrow({ where: { code: a.code } });
    const orderB = await db.order.findUniqueOrThrow({ where: { code: b.code } });
    assert.equal(orderA.subtotal, orderB.subtotal, "cùng giỏ → cùng tạm tính");
    assert.equal(orderA.shippingFee, zone1.fee);
    assert.equal(orderB.shippingFee, zone4.fee);
    assert.equal(orderA.area, zone1.name);
    assert.equal(orderB.area, zone4.name);
    assert.equal(orderB.total - orderA.total, zone4.fee - zone1.fee);
  });

  it("khu vực đã tắt → không tạo đơn, giỏ giữ ACTIVE", async () => {
    assert.ok(tempZoneId !== null);
    const cartId = await makeCart([{ productId: 1, quantity: 1 }]);
    await assert.rejects(
      createOrder(baseInput(cartId, { zoneId: tempZoneId! })),
      /không khả dụng/,
    );
    const cart = await db.cart.findUniqueOrThrow({ where: { id: cartId } });
    assert.equal(cart.status, "ACTIVE");
    assert.equal(await db.order.count({ where: { cartId } }), 0);
  });

  it("sản phẩm đã ẩn → không tạo đơn, giỏ giữ ACTIVE", async () => {
    const cartId = await makeCart([{ productId: 2, quantity: 1 }]);
    await db.product.update({ where: { id: 2 }, data: { isActive: false } });
    try {
      await assert.rejects(
        createOrder(baseInput(cartId)),
        (e: unknown) => e instanceof UnavailableProductsError,
      );
      const cart = await db.cart.findUniqueOrThrow({ where: { id: cartId } });
      assert.equal(cart.status, "ACTIVE");
      assert.equal(await db.order.count({ where: { cartId } }), 0);
    } finally {
      await db.product.update({ where: { id: 2 }, data: { isActive: true } });
    }
  });
});

describe("createOrder chống trùng + mã đơn (Ngày 17, lỗi (d) + S8)", () => {
  it("đặt trùng cùng giỏ → DuplicateOrderError mang đúng mã đơn đầu, chỉ 1 đơn", async () => {
    const cartId = await makeCart([{ productId: 1, quantity: 1 }]);
    const first = await createOrder(baseInput(cartId));
    createdOrderCodes.push(first.code);
    await assert.rejects(
      createOrder(baseInput(cartId)),
      (e: unknown) => e instanceof DuplicateOrderError && e.code === first.code,
    );
    assert.equal(await db.order.count({ where: { cartId } }), 1);
  });

  it("hai yêu cầu song song cùng giỏ → chỉ 1 đơn, một bên DuplicateOrderError", async () => {
    const cartId = await makeCart([{ productId: 1, quantity: 1 }]);
    const [r1, r2] = await Promise.allSettled([
      createOrder(baseInput(cartId)),
      createOrder(baseInput(cartId)),
    ]);
    const fulfilled = [r1, r2].filter((r) => r.status === "fulfilled");
    const rejected = [r1, r2].filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    if (fulfilled[0].status === "fulfilled") createdOrderCodes.push(fulfilled[0].value.code);
    assert.ok(
      rejected[0].status === "rejected" && rejected[0].reason instanceof DuplicateOrderError,
    );
    assert.equal(await db.order.count({ where: { cartId } }), 1);
  });

  it("generateOrderCode: 10 ký tự Crockford, 500 mã không trùng, không chứa I/L/O/U", async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const code = generateOrderCode();
      assert.match(code, /^[0-9A-HJKMNP-TV-Z]{10}$/);
      codes.add(code);
    }
    assert.equal(codes.size, 500);
  });

  it("mã sai định dạng / không tồn tại → getAdminOrder null (404 thống nhất)", async () => {
    assert.equal(await getAdminOrder("ABC"), null);
    assert.equal(await getAdminOrder("QAFNN907ZIX"), null); // 10 ký tự nhưng chứa I
    assert.equal(await getAdminOrder("KHONGTONTAI"), null); // chứa O → sai định dạng
    const fresh = generateOrderCode();
    assert.equal(await db.order.count({ where: { code: fresh } }), 0);
    assert.equal(await getAdminOrder(fresh), null);
  });
});

describe("createOrder kiểm số lượng + số dòng (Ngày 17 S8)", () => {
  it("số lượng 0 / âm / quá lớn trong giỏ → InvalidCartError, không tạo đơn", async () => {
    for (const qty of [0, -1, 99]) {
      const cartId = await makeCart([{ productId: 1, quantity: qty }]);
      await assert.rejects(createOrder(baseInput(cartId)), InvalidCartError);
      assert.equal(await db.order.count({ where: { cartId } }), 0);
      const cart = await db.cart.findUniqueOrThrow({ where: { id: cartId } });
      assert.equal(cart.status, "ACTIVE");
    }
  });

  it("giỏ 50 dòng → tạo được; giỏ 51 dòng → InvalidCartError", async () => {
    assert.ok(createdProductIds.length >= 51);
    const cart50 = await makeCart(
      createdProductIds.slice(0, 50).map((productId) => ({ productId, quantity: 1 })),
    );
    const ok = await createOrder(baseInput(cart50));
    createdOrderCodes.push(ok.code);
    const order50 = await db.order.findUniqueOrThrow({ where: { code: ok.code } });
    assert.equal(order50.subtotal, 50 * 100000);
    const cart51 = await makeCart(
      createdProductIds.slice(0, 51).map((productId) => ({ productId, quantity: 1 })),
    );
    await assert.rejects(createOrder(baseInput(cart51)), InvalidCartError);
    assert.equal(await db.order.count({ where: { cartId: cart51 } }), 0);
  });
});

describe("lý do hủy + chuyển trạng thái (Ngày 17, lỗi (c) + S8)", () => {
  it("hủy đơn: lý do ghi đúng nguyên văn vào nhật ký, mọi thay đổi đều có sự kiện", async () => {
    const cartId = await makeCart([{ productId: 1, quantity: 1 }]);
    const created = await createOrder(baseInput(cartId));
    createdOrderCodes.push(created.code);
    const reason = "Khách đổi ý — hoàn tiền chuyển khoản";
    const result = await transitionOrder(created.code, "CANCELLED", "NEW", { reason });
    assert.equal(result.ok, true);
    const detail = await getAdminOrder(created.code);
    assert.ok(detail);
    assert.equal(detail.status, "CANCELLED");
    const cancelEvent = detail.events.find(
      (e) => e.type === "STATUS_CHANGE" && e.toStatus === "CANCELLED",
    );
    assert.ok(cancelEvent, "phải có sự kiện hủy trong nhật ký");
    assert.equal(cancelEvent.note, reason);
    assert.equal(cancelEvent.fromStatus, "NEW");
  });

  it("chuyển trạng thái không hợp lệ (NEW → DELIVERING) bị từ chối ở server", async () => {
    const cartId = await makeCart([{ productId: 1, quantity: 1 }]);
    const created = await createOrder(baseInput(cartId));
    createdOrderCodes.push(created.code);
    const result = await transitionOrder(created.code, "DELIVERING", "NEW");
    assert.equal(result.ok, false);
    const detail = await getAdminOrder(created.code);
    assert.equal(detail?.status, "NEW");
    assert.equal(detail?.events.length, 0, "chuyển sai không được ghi nhật ký");
  });

  it("hủy không lý do / lý do quá ngắn bị từ chối, đơn giữ nguyên", async () => {
    const cartId = await makeCart([{ productId: 1, quantity: 1 }]);
    const created = await createOrder(baseInput(cartId));
    createdOrderCodes.push(created.code);
    for (const reason of ["", "ok"]) {
      const result = await transitionOrder(created.code, "CANCELLED", "NEW", { reason });
      assert.equal(result.ok, false);
    }
    const detail = await getAdminOrder(created.code);
    assert.equal(detail?.status, "NEW");
  });
});
