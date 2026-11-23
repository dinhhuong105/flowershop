import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildTelegramMessage,
  MAX_TELEGRAM_MESSAGE_LENGTH,
  type OrderWithItems,
} from "./telegram";

// Đơn mẫu cho test thuần (không chạm DB): chỉ các trường mà
// buildTelegramMessage dùng tới.
function sampleOrder(overrides: Partial<OrderWithItems> = {}): OrderWithItems {
  return {
    id: 1,
    code: "TESTCODE01",
    cartId: null,
    senderName: "Nguyễn Văn An",
    senderPhone: "0901234567",
    senderEmail: null,
    receiverName: "Trần Thị Bình",
    receiverPhone: "0912345678",
    address: "12 đường Hoa Hồng",
    area: "Khu vực trung tâm",
    deliveryDate: new Date("2026-11-23T00:00:00Z"),
    deliverySlot: "10:00 – 12:00",
    cardMessage: null,
    note: null,
    subtotal: 1602000,
    shippingFee: 25000,
    deliverySurcharge: 0,
    deliveryMethod: "SCHEDULED",
    total: 1627000,
    paymentMethod: "COD",
    paymentStatus: "UNPAID",
    status: "NEW",
    notifiedAt: null,
    createdAt: new Date("2026-11-23T02:00:00Z"),
    updatedAt: new Date("2026-11-23T02:00:00Z"),
    items: [
      {
        id: 1,
        orderId: 1,
        productId: 1,
        name: "Bó Hồng Đỏ Tình Yêu",
        price: 801000,
        quantity: 2,
        image: null,
      },
    ],
    ...overrides,
  } as OrderWithItems;
}

describe("buildTelegramMessage: thoát HTML (H-4b)", () => {
  it("tên, địa chỉ, lời nhắn chứa <b>, &, </a> được thoát đúng", () => {
    const msg = buildTelegramMessage(
      sampleOrder({
        senderName: "An <b>Bình</b>",
        address: "12 đường </a> & hoa",
        cardMessage: "Chúc <b>mừng</b> & vui vẻ",
      }),
    );
    assert.ok(msg.includes("An &lt;b&gt;Bình&lt;/b&gt;"));
    assert.ok(msg.includes("12 đường &lt;/a&gt; &amp; hoa"));
    assert.ok(msg.includes("Chúc &lt;b&gt;mừng&lt;/b&gt; &amp; vui vẻ"));
    assert.ok(!msg.includes("An <b>Bình"));
    assert.ok(!msg.includes("đường </a>"));
    // Thẻ <b> do chính mẫu tin tạo ra vẫn còn (tiêu đề + tổng cộng).
    assert.ok(msg.includes("<b>Đơn hàng mới TESTCODE01</b>"));
    assert.ok(msg.includes("<b>Tổng cộng:"));
  });
});

describe("buildTelegramMessage: cắt ở 4000 ký tự (H-4c)", () => {
  it("giỏ nhiều dòng: ≤ 4000 ký tự, vẫn giữ tổng + thông tin giao", () => {
    const items = Array.from({ length: 80 }, (_, i) => ({
      id: i + 1,
      orderId: 1,
      productId: 1,
      name: `Bó hoa chúc mừng khai trương hồng phát sang trọng ${i + 1}`,
      price: 100000,
      quantity: 1,
      image: null,
    }));
    const msg = buildTelegramMessage(
      sampleOrder({ items: items as never, subtotal: 8000000, total: 8025000 }),
    );
    assert.ok(
      msg.length <= MAX_TELEGRAM_MESSAGE_LENGTH,
      `dài ${msg.length} ký tự`,
    );
    assert.ok(msg.includes("<b>Tổng cộng:"));
    assert.ok(msg.includes("Giao hàng:"));
    assert.ok(msg.includes("Người đặt:"));
    assert.ok(msg.includes("… và còn"));
    // Dòng đầu tiên vẫn còn (chỉ rút gọn từ cuối).
    assert.ok(msg.includes("sang trọng 1 × 1 —"));
  });

  it("đơn ngắn: không đổi, không bị cắt", () => {
    const msg = buildTelegramMessage(sampleOrder());
    assert.ok(msg.length < MAX_TELEGRAM_MESSAGE_LENGTH);
    assert.ok(msg.includes("Bó Hồng Đỏ Tình Yêu × 2"));
    assert.ok(msg.includes("Tạm tính:"));
    assert.ok(!msg.includes("… và còn"));
  });
});
