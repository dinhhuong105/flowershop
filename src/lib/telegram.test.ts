import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  bankNotifyAuditValue,
  buildTelegramMessage,
  sendBankChangeNotification,
  sendTelegramForOrder,
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

  // Ngày 9 D9-5: ghi chú của khách + dấu > cũng phải thoát (trước
  // đây chỉ có test cho tên/địa chỉ/lời nhắn trên thiệp).
  it("ghi chú chứa <, >, & được thoát đúng", () => {
    const msg = buildTelegramMessage(
      sampleOrder({
        senderName: "An > Bình",
        receiverName: "Lan < Chi",
        note: "Giao <sáng> & gọi trước nhé",
      }),
    );
    assert.ok(msg.includes("An &gt; Bình"));
    assert.ok(msg.includes("Lan &lt; Chi"));
    assert.ok(msg.includes("Ghi chú: Giao &lt;sáng&gt; &amp; gọi trước nhé"));
    assert.ok(!msg.includes("An > Bình"));
    assert.ok(!msg.includes("Giao <sáng>"));
  });
});

// Ngày 9 D9-5: gửi thật tới mock Telegram (chế độ ok) phải trả 200
// và nội dung đã thoát — nếu không, tên có < hoặc & làm Telegram trả
// 400 và nút gửi lại thất bại vĩnh viễn với đơn đó.
describe("sendTelegramForOrder với mock Telegram (Ngày 9 D9-5)", () => {
  it("đơn có tên/ghi chú chứa <, >, & → mock trả 200, tin nhắn đã thoát", async () => {
    const port = 18081;
    const logPath = "/tmp/mock-telegram-d95-test.jsonl";
    rmSync(logPath, { force: true });
    const mockPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../scripts/mock-telegram.mjs",
    );
    const child = spawn(process.execPath, [mockPath], {
      env: {
        ...process.env,
        MOCK_TELEGRAM_PORT: String(port),
        MOCK_TELEGRAM_MODE: "ok",
        MOCK_TELEGRAM_LOG: logPath,
      },
      stdio: "ignore",
    });
    try {
      // Chờ mock lắng nghe (tối đa ~5 giây).
      const base = `http://127.0.0.1:${port}`;
      let up = false;
      for (let i = 0; i < 50 && !up; i++) {
        try {
          const res = await fetch(base, { signal: AbortSignal.timeout(500) });
          up = res.ok;
        } catch {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      assert.ok(up, "mock Telegram không khởi động được");
      const prevToken = process.env.TELEGRAM_BOT_TOKEN;
      const prevChatId = process.env.TELEGRAM_CHAT_ID;
      const prevBase = process.env.TELEGRAM_API_BASE;
      process.env.TELEGRAM_BOT_TOKEN = "test-token";
      process.env.TELEGRAM_CHAT_ID = "123456";
      process.env.TELEGRAM_API_BASE = base;
      try {
        const sent = await sendTelegramForOrder(
          sampleOrder({
            senderName: "An <b> & Bình",
            receiverName: "Lan > Chi",
            note: "Ghi chú <test> & xong",
          }),
        );
        assert.equal(sent, true);
      } finally {
        if (prevToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = prevToken;
        if (prevChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
        else process.env.TELEGRAM_CHAT_ID = prevChatId;
        if (prevBase === undefined) delete process.env.TELEGRAM_API_BASE;
        else process.env.TELEGRAM_API_BASE = prevBase;
      }
      const logged = JSON.parse(readFileSync(logPath, "utf-8").trim().split("\n").pop()!);
      const text = (logged.body as { text: string }).text;
      assert.ok(text.includes("An &lt;b&gt; &amp; Bình"));
      assert.ok(text.includes("Lan &gt; Chi"));
      assert.ok(text.includes("Ghi chú: Ghi chú &lt;test&gt; &amp; xong"));
      assert.equal((logged.body as { parse_mode?: string }).parse_mode, "HTML");
    } finally {
      child.kill();
    }
  });
});

describe("bankNotifyAuditValue: giá trị ghi nhật ký bank.notify (Ngày 16 fixup 2)", () => {
  it("gửi được → sent", () => {
    assert.equal(bankNotifyAuditValue({ ok: true }), "sent");
  });

  it("chưa cấu hình (skipped) → 'skipped: chưa cấu hình', không phải failed", () => {
    assert.equal(
      bankNotifyAuditValue({
        ok: false,
        error: "Chưa cấu hình token bot hoặc chat id Telegram.",
        skipped: true,
      }),
      "skipped: chưa cấu hình",
    );
  });

  it("đã cấu hình nhưng gửi lỗi → 'failed: <lỗi>' như cũ", () => {
    assert.equal(
      bankNotifyAuditValue({ ok: false, error: "Telegram trả lỗi: HTTP 500" }),
      "failed: Telegram trả lỗi: HTTP 500",
    );
  });

  it("gửi lỗi mà không có error → 'failed: unknown' như cũ", () => {
    assert.equal(bankNotifyAuditValue({ ok: false }), "failed: unknown");
  });
});

describe("sendBankChangeNotification khi chưa cấu hình Telegram (Ngày 16 fixup 2)", () => {
  it("không token/chat id → ok false + skipped true, không gọi fetch", async () => {
    const prevToken = process.env.TELEGRAM_BOT_TOKEN;
    const prevChatId = process.env.TELEGRAM_CHAT_ID;
    const prevBase = process.env.TELEGRAM_API_BASE;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_API_BASE;
    try {
      // DB local có telegram.chatId = "" nên getTelegramChatId rơi
      // về env (đã xóa) → "" → sendTelegramMessage short-circuit.
      const result = await sendBankChangeNotification();
      assert.equal(result.ok, false);
      assert.equal(result.skipped, true);
      assert.equal(
        result.error,
        "Chưa cấu hình token bot hoặc chat id Telegram.",
      );
      assert.equal(bankNotifyAuditValue(result), "skipped: chưa cấu hình");
    } finally {
      if (prevToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = prevToken;
      if (prevChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
      else process.env.TELEGRAM_CHAT_ID = prevChatId;
      if (prevBase === undefined) delete process.env.TELEGRAM_API_BASE;
      else process.env.TELEGRAM_API_BASE = prevBase;
    }
  });

  it("đã cấu hình + mock trả 200 → ok, giá trị nhật ký vẫn 'sent' như cũ", async () => {
    const port = 18085;
    const logPath = "/tmp/mock-telegram-fixup2-ok-test.jsonl";
    rmSync(logPath, { force: true });
    const mockPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../scripts/mock-telegram.mjs",
    );
    const child = spawn(process.execPath, [mockPath], {
      env: {
        ...process.env,
        MOCK_TELEGRAM_PORT: String(port),
        MOCK_TELEGRAM_MODE: "ok",
        MOCK_TELEGRAM_LOG: logPath,
      },
      stdio: "ignore",
    });
    try {
      const base = `http://127.0.0.1:${port}`;
      let up = false;
      for (let i = 0; i < 50 && !up; i++) {
        try {
          const res = await fetch(base, { signal: AbortSignal.timeout(500) });
          up = res.ok;
        } catch {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      assert.ok(up, "mock Telegram không khởi động được");
      const prevToken = process.env.TELEGRAM_BOT_TOKEN;
      const prevChatId = process.env.TELEGRAM_CHAT_ID;
      const prevBase = process.env.TELEGRAM_API_BASE;
      process.env.TELEGRAM_BOT_TOKEN = "test-token-fixup2";
      process.env.TELEGRAM_CHAT_ID = "123456";
      process.env.TELEGRAM_API_BASE = base;
      try {
        const result = await sendBankChangeNotification();
        assert.equal(result.ok, true);
        assert.equal(result.skipped, undefined);
        assert.equal(bankNotifyAuditValue(result), "sent");
      } finally {
        if (prevToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = prevToken;
        if (prevChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
        else process.env.TELEGRAM_CHAT_ID = prevChatId;
        if (prevBase === undefined) delete process.env.TELEGRAM_API_BASE;
        else process.env.TELEGRAM_API_BASE = prevBase;
      }
    } finally {
      child.kill();
    }
  });

  it("đã cấu hình + mock trả 500 → ok false, không skipped, giá trị nhật ký 'failed: …'", async () => {
    const port = 18086;
    const logPath = "/tmp/mock-telegram-fixup2-err-test.jsonl";
    rmSync(logPath, { force: true });
    const mockPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../scripts/mock-telegram.mjs",
    );
    const child = spawn(process.execPath, [mockPath], {
      env: {
        ...process.env,
        MOCK_TELEGRAM_PORT: String(port),
        MOCK_TELEGRAM_MODE: "error500",
        MOCK_TELEGRAM_LOG: logPath,
      },
      stdio: "ignore",
    });
    try {
      const base = `http://127.0.0.1:${port}`;
      let up = false;
      for (let i = 0; i < 50 && !up; i++) {
        try {
          const res = await fetch(base, { signal: AbortSignal.timeout(500) });
          up = res.ok;
        } catch {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      assert.ok(up, "mock Telegram không khởi động được");
      const prevToken = process.env.TELEGRAM_BOT_TOKEN;
      const prevChatId = process.env.TELEGRAM_CHAT_ID;
      const prevBase = process.env.TELEGRAM_API_BASE;
      process.env.TELEGRAM_BOT_TOKEN = "test-token-fixup2";
      process.env.TELEGRAM_CHAT_ID = "123456";
      process.env.TELEGRAM_API_BASE = base;
      try {
        const result = await sendBankChangeNotification();
        assert.equal(result.ok, false);
        assert.equal(result.skipped, undefined);
        assert.ok(bankNotifyAuditValue(result).startsWith("failed: "));
      } finally {
        if (prevToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = prevToken;
        if (prevChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
        else process.env.TELEGRAM_CHAT_ID = prevChatId;
        if (prevBase === undefined) delete process.env.TELEGRAM_API_BASE;
        else process.env.TELEGRAM_API_BASE = prevBase;
      }
    } finally {
      child.kill();
    }
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

describe("sendBankChangeNotification với mock Telegram (Ngày 12 B3)", () => {
  it("mock trả 200 → ok, tin nhắn chỉ báo giờ đổi, không kèm số tài khoản", async () => {
    const port = 18082;
    const logPath = "/tmp/mock-telegram-b3-test.jsonl";
    rmSync(logPath, { force: true });
    const mockPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../scripts/mock-telegram.mjs",
    );
    const child = spawn(process.execPath, [mockPath], {
      env: {
        ...process.env,
        MOCK_TELEGRAM_PORT: String(port),
        MOCK_TELEGRAM_MODE: "ok",
        MOCK_TELEGRAM_LOG: logPath,
      },
      stdio: "ignore",
    });
    try {
      const base = `http://127.0.0.1:${port}`;
      let up = false;
      for (let i = 0; i < 50 && !up; i++) {
        try {
          const res = await fetch(base, { signal: AbortSignal.timeout(500) });
          up = res.ok;
        } catch {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      assert.ok(up, "mock Telegram không khởi động được");
      const prevToken = process.env.TELEGRAM_BOT_TOKEN;
      const prevChatId = process.env.TELEGRAM_CHAT_ID;
      const prevBase = process.env.TELEGRAM_API_BASE;
      process.env.TELEGRAM_BOT_TOKEN = "test-token-b3";
      process.env.TELEGRAM_CHAT_ID = "123456";
      process.env.TELEGRAM_API_BASE = base;
      try {
        const result = await sendBankChangeNotification();
        assert.equal(result.ok, true);
      } finally {
        if (prevToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = prevToken;
        if (prevChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
        else process.env.TELEGRAM_CHAT_ID = prevChatId;
        if (prevBase === undefined) delete process.env.TELEGRAM_API_BASE;
        else process.env.TELEGRAM_API_BASE = prevBase;
      }
      const logged = JSON.parse(readFileSync(logPath, "utf-8").trim().split("\n").pop()!);
      const text = (logged.body as { text: string }).text;
      assert.ok(text.startsWith("Thông tin ngân hàng vừa được thay đổi lúc "));
      // Không kèm số tài khoản, BIN hay tên chủ TK nào.
      assert.equal(text.includes("1234567890"), false);
      assert.equal(text.includes("970415"), false);
    } finally {
      child.kill();
    }
  });

  it("mock trả 500 → ok false, có error, không throw", async () => {
    const port = 18083;
    const logPath = "/tmp/mock-telegram-b3-err-test.jsonl";
    rmSync(logPath, { force: true });
    const mockPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../scripts/mock-telegram.mjs",
    );
    const child = spawn(process.execPath, [mockPath], {
      env: {
        ...process.env,
        MOCK_TELEGRAM_PORT: String(port),
        MOCK_TELEGRAM_MODE: "error500",
        MOCK_TELEGRAM_LOG: logPath,
      },
      stdio: "ignore",
    });
    try {
      const base = `http://127.0.0.1:${port}`;
      let up = false;
      for (let i = 0; i < 50 && !up; i++) {
        try {
          const res = await fetch(base, { signal: AbortSignal.timeout(500) });
          up = res.ok;
        } catch {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      assert.ok(up, "mock Telegram không khởi động được");
      const prevToken = process.env.TELEGRAM_BOT_TOKEN;
      const prevChatId = process.env.TELEGRAM_CHAT_ID;
      const prevBase = process.env.TELEGRAM_API_BASE;
      process.env.TELEGRAM_BOT_TOKEN = "test-token-b3";
      process.env.TELEGRAM_CHAT_ID = "123456";
      process.env.TELEGRAM_API_BASE = base;
      try {
        const result = await sendBankChangeNotification();
        assert.equal(result.ok, false);
        assert.equal(typeof result.error, "string");
      } finally {
        if (prevToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = prevToken;
        if (prevChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
        else process.env.TELEGRAM_CHAT_ID = prevChatId;
        if (prevBase === undefined) delete process.env.TELEGRAM_API_BASE;
        else process.env.TELEGRAM_API_BASE = prevBase;
      }
    } finally {
      child.kill();
    }
  });

  it("có N đơn chưa thu → tin nhắn thêm câu N đơn bị ảnh hưởng (Ngày 14 B5)", async () => {
    const port = 18084;
    const logPath = "/tmp/mock-telegram-b5-test.jsonl";
    rmSync(logPath, { force: true });
    const mockPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../scripts/mock-telegram.mjs",
    );
    const child = spawn(process.execPath, [mockPath], {
      env: {
        ...process.env,
        MOCK_TELEGRAM_PORT: String(port),
        MOCK_TELEGRAM_MODE: "ok",
        MOCK_TELEGRAM_LOG: logPath,
      },
      stdio: "ignore",
    });
    try {
      const base = `http://127.0.0.1:${port}`;
      let up = false;
      for (let i = 0; i < 50 && !up; i++) {
        try {
          const res = await fetch(base, { signal: AbortSignal.timeout(500) });
          up = res.ok;
        } catch {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      assert.ok(up, "mock Telegram không khởi động được");
      const prevToken = process.env.TELEGRAM_BOT_TOKEN;
      const prevChatId = process.env.TELEGRAM_CHAT_ID;
      const prevBase = process.env.TELEGRAM_API_BASE;
      process.env.TELEGRAM_BOT_TOKEN = "test-token";
      process.env.TELEGRAM_CHAT_ID = "123456";
      process.env.TELEGRAM_API_BASE = base;
      try {
        const result = await sendBankChangeNotification(3);
        assert.equal(result.ok, true);
      } finally {
        if (prevToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = prevToken;
        if (prevChatId === undefined) delete process.env.TELEGRAM_CHAT_ID;
        else process.env.TELEGRAM_CHAT_ID = prevChatId;
        if (prevBase === undefined) delete process.env.TELEGRAM_API_BASE;
        else process.env.TELEGRAM_API_BASE = prevBase;
      }
      const logged = JSON.parse(readFileSync(logPath, "utf-8").trim().split("\n").pop()!);
      const text = (logged.body as { text: string }).text;
      assert.ok(text.includes("3 đơn chưa thu bị ảnh hưởng"));
      assert.equal(text.includes("1234567890"), false);
    } finally {
      child.kill();
    }
  });
});
