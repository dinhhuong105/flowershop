// Quản lý đơn hàng phía quản trị (Ngày 8 §2). Mọi hàm ghi ở đây đều
// được gọi SAU requireAdmin() từ Server Action/trang quản trị.
// Bất biến D7-12: không hàm nào sửa order_items.price, tổng tiền hay
// phí ship của đơn — chỉ đổi status/paymentStatus/paidAt/internalNote
// và ghi nhật ký order_events.

import { Prisma, type OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { deliveryConfig } from "@/config/delivery";
import { EXPRESS_SLOT_LABEL, sameDaySlotLabel } from "@/lib/delivery-rules";
import { orderStatusLabel } from "@/lib/order-labels";
import { sendTelegramForOrder } from "@/lib/telegram";

// Bảng chuyển trạng thái (đặc tả §2.1). PREPARING có trong enum (từ
// Ngày 5) nhưng là TRẠNG THÁI DỰ TRỮ, hiện không dùng trong luồng
// (sửa 12 mục verdict Ngày 9, mục 6): không có bước chuyển nào vào/ra
// (schema hiện có thắng đặc tả; xem "Khác đặc tả" báo cáo Ngày 8),
// không có tab riêng, không tính vào "Cần xử lý" (tabCondition dưới
// đây) cũng không tính vào dashboard (src/lib/admin/dashboard.ts) —
// đơn ở trạng thái này chỉ thấy trong tab "Tất cả". Muốn dùng thì
// phải thêm vào pending ở cả file này lẫn dashboard.ts, đồng thời
// thêm tab + bước chuyển. COMPLETED và CANCELLED là trạng thái cuối.
export const ORDER_NEXT: Record<OrderStatus, OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["DELIVERING", "CANCELLED"],
  PREPARING: [],
  DELIVERING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function nextOrderStatuses(status: OrderStatus): OrderStatus[] {
  return ORDER_NEXT[status];
}

export function isValidOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_NEXT[from].includes(to);
}

// Mã đơn: 10 ký tự Crockford base32 (như trang /order/[code]).
export const ORDER_CODE_RE = /^[0-9A-HJKMNP-TV-Z]{10}$/;

// Lý do hủy: bắt buộc, 3–200 ký tự (sau khi cắt khoảng trắng).
export const MIN_CANCEL_REASON_LENGTH = 3;
export const MAX_CANCEL_REASON_LENGTH = 200;
export function validateCancelReason(reason: string): string | null {
  const t = reason.trim();
  if (t.length < MIN_CANCEL_REASON_LENGTH || t.length > MAX_CANCEL_REASON_LENGTH) {
    return "Lý do hủy phải từ 3 đến 200 ký tự.";
  }
  return null;
}

// Ghi chú nội bộ: tùy chọn, ≤ 500 ký tự, văn bản thuần (React thoát
// khi hiển thị).
export const MAX_INTERNAL_NOTE_LENGTH = 500;
export function validateInternalNote(note: string): string | null {
  if (note.trim().length > MAX_INTERNAL_NOTE_LENGTH) {
    return "Ghi chú nội bộ tối đa 500 ký tự.";
  }
  return null;
}

// Chuẩn hóa SĐT để so khớp (đặc tả §2.2): bỏ khoảng trắng/dấu chấm/
// dấu gạch ngang, +84 ↔ 0. "0900 000.000" và "+84 900 000 000" đều
// → "0900000000".
export function normalizePhone(raw: string): string {
  let d = raw.replace(/[\s.\-]/g, "");
  if (d.startsWith("+84")) d = `0${d.slice(3)}`;
  else if (/^84\d{9}$/.test(d)) d = `0${d.slice(2)}`;
  return d;
}

// Số phút từ 00:00 của giờ bắt đầu giao theo nhãn khung giờ (Ngày 9
// D9-5): giao nhanh 2 giờ → 0 (gấp nhất, xếp đầu); khung hẹn → giờ
// bắt đầu; "Trước 18:00" → 18:00; nhãn lạ → cuối ngày (1439, xếp cuối).
const SAME_DAY_START_MINUTES = (() => {
  const [h, m] = deliveryConfig.sameDayDeliverBy.split(":").map(Number);
  return h * 60 + m;
})();

export function slotStartMinutes(label: string): number {
  if (label === EXPRESS_SLOT_LABEL) return 0;
  const slot = deliveryConfig.slots.find((s) => s.label === label);
  if (slot) {
    const [h, m] = slot.start.split(":").map(Number);
    return h * 60 + m;
  }
  if (label === sameDaySlotLabel()) return SAME_DAY_START_MINUTES;
  return 24 * 60 - 1;
}

// Biểu thức CASE cho SQL, dùng cùng bảng slotStartMinutes (không xếp
// theo chuỗi nhãn nữa — chuỗi xếp sai khi có nhãn chữ).
function slotStartCaseSql(): Prisma.Sql {
  const whens: Prisma.Sql[] = [
    Prisma.sql`WHEN ${EXPRESS_SLOT_LABEL} THEN 0`,
    ...deliveryConfig.slots.map((s) => {
      const [h, m] = s.start.split(":").map(Number);
      return Prisma.sql`WHEN ${s.label} THEN ${h * 60 + m}`;
    }),
    Prisma.sql`WHEN ${sameDaySlotLabel()} THEN ${SAME_DAY_START_MINUTES}`,
  ];
  return Prisma.sql`CASE o."deliverySlot" ${Prisma.join(whens, " ")} ELSE 1439 END`;
}

// Huy hiệu ngày giao (chỉ cho đơn chưa xong): "Hôm nay" khi ngày giao
// bằng ngày hiện tại theo Asia/Ho_Chi_Minh, "Quá hạn" khi ngày giao đã
// qua. Tính bằng Intl với timeZone cố định nên giống hệt ở TZ=UTC và
// TZ=Asia/Ho_Chi_Minh (test với đồng hồ giả 23:30 UTC).
export function orderDayBadge(
  deliveryDate: Date,
  now: Date,
): "today" | "overdue" | null {
  const vnDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: deliveryConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const deliveryDay = deliveryDate.toISOString().slice(0, 10);
  if (deliveryDay === vnDay) return "today";
  if (deliveryDay < vnDay) return "overdue";
  return null;
}

export const ADMIN_ORDERS_PAGE_SIZE = 20;

export type OrderTab =
  | "pending"
  | "NEW"
  | "CONFIRMED"
  | "DELIVERING"
  | "COMPLETED"
  | "CANCELLED"
  | "all";

// Nhãn tab thống nhất với huy hiệu trạng thái (Ngày 9 D9-5): NEW là
// "Đã tiếp nhận" (không phải "Mới"), COMPLETED là "Đã giao" (không
// phải "Hoàn tất") — xem src/lib/order-labels.ts.
export const ORDER_TABS: Array<{ id: OrderTab; label: string }> = [
  { id: "pending", label: "Cần xử lý" },
  { id: "NEW", label: "Đã tiếp nhận" },
  { id: "CONFIRMED", label: "Đã xác nhận" },
  { id: "DELIVERING", label: "Đang giao" },
  { id: "COMPLETED", label: "Đã giao" },
  { id: "CANCELLED", label: "Đã hủy" },
  { id: "all", label: "Tất cả" },
];

export type AdminOrderRow = {
  code: string;
  senderName: string;
  receiverName: string;
  receiverPhone: string;
  area: string;
  deliveryDate: Date;
  deliverySlot: string;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  status: OrderStatus;
  createdAt: Date;
};

export type AdminOrderList = {
  orders: AdminOrderRow[];
  total: number;
  totalPages: number;
  page: number;
  counts: Record<OrderTab, number>;
};

export type ListAdminOrdersOpts = {
  tab?: OrderTab;
  q?: string;
  payment?: "all" | "UNPAID" | "PAID";
  date?: string; // YYYY-MM-DD
  page?: number;
};

// Điều kiện lọc chung (trừ tab trạng thái) — dùng chung cho danh sách
// và cho số đếm từng tab, để số đếm khớp đúng danh sách đã lọc.
function buildOrderFilters(opts: ListAdminOrdersOpts): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  const q = (opts.q ?? "").normalize("NFC").trim();
  if (q !== "") {
    const phone = normalizePhone(q);
    const nameCond = Prisma.sql`strpos(vi_unaccent(o."senderName" || ' ' || o."receiverName"), vi_unaccent(${q})) > 0`;
    const codeCond = Prisma.sql`strpos(o."code", ${q.toUpperCase()}) > 0`;
    // SĐT: chuẩn hóa cả hai phía trong SQL (bỏ khoảng trắng/dấu
    // chấm/dấu gạch ngang, +84 → 0) rồi so khớp chuỗi con.
    const phoneNorm = (col: string): Prisma.Sql =>
      Prisma.sql`CASE WHEN starts_with(regexp_replace(${Prisma.raw(col)}, '[ .\\-]', '', 'g'), '+84') THEN '0' || substr(regexp_replace(${Prisma.raw(col)}, '[ .\\-]', '', 'g'), 4) ELSE regexp_replace(${Prisma.raw(col)}, '[ .\\-]', '', 'g') END`;
    const phoneCond =
      phone !== ""
        ? Prisma.sql`(strpos(${phoneNorm(`o."senderPhone"`)}, ${phone}) > 0 OR strpos(${phoneNorm(`o."receiverPhone"`)}, ${phone}) > 0)`
        : Prisma.sql`false`;
    conditions.push(Prisma.sql`(${codeCond} OR ${nameCond} OR ${phoneCond})`);
  }
  if (opts.payment === "UNPAID" || opts.payment === "PAID") {
    // Ép kiểu rõ ràng: tham số Prisma.sql là text, cột là enum
    // PaymentStatus — không ép thì Postgres báo 42883 (lỗi phát hiện
    // khi kiểm thử Ngày 8: lọc payment=PAID trả 500).
    conditions.push(Prisma.sql`o."paymentStatus" = ${opts.payment}::"PaymentStatus"`);
  }
  if (opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
    conditions.push(Prisma.sql`o."deliveryDate" = ${opts.date}::date`);
  }
  return conditions;
}

function tabCondition(tab: OrderTab): Prisma.Sql | null {
  switch (tab) {
    case "pending":
      return Prisma.sql`o."status" IN ('NEW', 'CONFIRMED', 'DELIVERING')`;
    case "all":
      return null;
    default:
      // Ép kiểu như lọc payment (xem trên): tham số text so với cột
      // enum OrderStatus — không ép thì Postgres báo 42883.
      return Prisma.sql`o."status" = ${tab}::"OrderStatus"`;
  }
}

export async function listAdminOrders(
  opts: ListAdminOrdersOpts = {},
): Promise<AdminOrderList> {
  const page = opts.page !== undefined && opts.page >= 1 ? opts.page : 1;
  const tab: OrderTab =
    opts.tab && ORDER_TABS.some((t) => t.id === opts.tab) ? opts.tab : "pending";
  const filters = buildOrderFilters(opts);
  const where =
    filters.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
      : Prisma.sql``;
  const tabWhere = tabCondition(tab);
  const listWhere =
    filters.length > 0 || tabWhere
      ? Prisma.sql`WHERE ${Prisma.join(
          [...filters, ...(tabWhere ? [tabWhere] : [])],
          " AND ",
        )}`
      : Prisma.sql``;
  // "Cần xử lý": ngày giao rồi giờ bắt đầu giao dạng số (CASE theo
  // nhãn khung giờ — xem slotStartMinutes); các tab còn lại: mới nhất
  // trước.
  const orderBy =
    tab === "pending"
      ? Prisma.sql`ORDER BY o."deliveryDate" ASC, ${slotStartCaseSql()} ASC, o."createdAt" DESC`
      : Prisma.sql`ORDER BY o."createdAt" DESC`;
  const rows = await db.$queryRaw<
    Array<{
      code: string;
      senderName: string;
      receiverName: string;
      receiverPhone: string;
      area: string;
      deliveryDate: Date;
      deliverySlot: string;
      total: number;
      paymentMethod: string;
      paymentStatus: string;
      status: OrderStatus;
      createdAt: Date;
    }>
  >(Prisma.sql`
    SELECT o."code", o."senderName", o."receiverName", o."receiverPhone",
      o."area", o."deliveryDate", o."deliverySlot", o."total",
      o."paymentMethod", o."paymentStatus", o."status", o."createdAt"
    FROM "orders" AS o
    ${listWhere}
    ${orderBy}
    LIMIT ${ADMIN_ORDERS_PAGE_SIZE} OFFSET ${(page - 1) * ADMIN_ORDERS_PAGE_SIZE}
  `);

  // Số đếm từng tab (cùng bộ lọc q/thanh toán/ngày, chỉ khác trạng thái).
  const countRows = await db.$queryRaw<
    Array<{ status: OrderStatus; n: bigint }>
  >(Prisma.sql`
    SELECT o."status", COUNT(*) AS "n"
    FROM "orders" AS o
    ${where}
    GROUP BY o."status"
  `);
  const byStatus = new Map<OrderStatus, number>(
    countRows.map((r) => [r.status, Number(r.n)]),
  );
  const counts: Record<OrderTab, number> = {
    pending:
      (byStatus.get("NEW") ?? 0) +
      (byStatus.get("CONFIRMED") ?? 0) +
      (byStatus.get("DELIVERING") ?? 0),
    NEW: byStatus.get("NEW") ?? 0,
    CONFIRMED: byStatus.get("CONFIRMED") ?? 0,
    DELIVERING: byStatus.get("DELIVERING") ?? 0,
    COMPLETED: byStatus.get("COMPLETED") ?? 0,
    CANCELLED: byStatus.get("CANCELLED") ?? 0,
    all: [...byStatus.values()].reduce((a, b) => a + b, 0),
  };

  // Tổng của tab đang xem lấy từ số đếm tab (Ngày 9 D9-3: trước sửa,
  // tổng lấy từ COUNT(*) OVER() của trang hiện tại nên trang vượt
  // quá (page=99) trả 0 dòng → tổng thành 0 dù vẫn có đơn).
  const total = counts[tab];

  return {
    orders: rows.map((r) => ({
      code: r.code,
      senderName: r.senderName,
      receiverName: r.receiverName,
      receiverPhone: r.receiverPhone,
      area: r.area,
      deliveryDate: r.deliveryDate,
      deliverySlot: r.deliverySlot,
      total: r.total,
      paymentMethod: r.paymentMethod,
      paymentStatus: r.paymentStatus,
      status: r.status,
      createdAt: r.createdAt,
    })),
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / ADMIN_ORDERS_PAGE_SIZE),
    page,
    counts,
  };
}

export type AdminOrderDetail = {
  code: string;
  senderName: string;
  senderPhone: string;
  senderEmail: string | null;
  receiverName: string;
  receiverPhone: string;
  address: string;
  area: string;
  deliveryDate: Date;
  deliverySlot: string;
  cardMessage: string | null;
  note: string | null;
  internalNote: string | null;
  subtotal: number;
  shippingFee: number;
  deliverySurcharge: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  paidAt: Date | null;
  status: OrderStatus;
  notifiedAt: Date | null;
  createdAt: Date;
  items: Array<{ name: string; price: number; quantity: number; image: string | null }>;
  events: Array<{
    type: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus | null;
    note: string | null;
    createdAt: Date;
  }>;
};

export async function getAdminOrder(code: string): Promise<AdminOrderDetail | null> {
  if (!ORDER_CODE_RE.test(code)) return null;
  const o = await db.order.findUnique({
    where: { code },
    include: {
      items: { orderBy: { id: "asc" } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!o) return null;
  return {
    code: o.code,
    senderName: o.senderName,
    senderPhone: o.senderPhone,
    senderEmail: o.senderEmail,
    receiverName: o.receiverName,
    receiverPhone: o.receiverPhone,
    address: o.address,
    area: o.area,
    deliveryDate: o.deliveryDate,
    deliverySlot: o.deliverySlot,
    cardMessage: o.cardMessage,
    note: o.note,
    internalNote: o.internalNote,
    subtotal: o.subtotal,
    shippingFee: o.shippingFee,
    deliverySurcharge: o.deliverySurcharge,
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    paidAt: o.paidAt,
    status: o.status,
    notifiedAt: o.notifiedAt,
    createdAt: o.createdAt,
    items: o.items.map((i) => ({
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      image: i.image,
    })),
    events: o.events.map((e) => ({
      type: e.type,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: e.note,
      createdAt: e.createdAt,
    })),
  };
}

export type OrderMutationResult = { ok: true } | { ok: false; error: string };

const CONCURRENT_ERROR = "Đơn vừa được cập nhật ở nơi khác, vui lòng tải lại.";

// Chuyển trạng thái có điều kiện (chống bấm đúp/hai tab): chỉ đổi khi
// trạng thái trong DB vẫn bằng trạng thái đang hiển thị; count = 0 →
// lỗi "vừa được cập nhật". Mọi thay đổi ghi nhật ký order_events
// trong cùng giao dịch. COD được đánh dấu PAID ngay khi chuyển sang
// COMPLETED (tiền thu khi giao xong — xem "Khác đặc tả" báo cáo
// Ngày 8); chuyển khoản thì Henry xác nhận tiền về rồi đánh dấu tay.
export async function transitionOrder(
  code: string,
  to: OrderStatus,
  expectedStatus: OrderStatus,
  opts: { reason?: string } = {},
): Promise<OrderMutationResult> {
  if (!ORDER_CODE_RE.test(code)) return { ok: false, error: "Không tìm thấy đơn hàng." };
  if (!isValidOrderTransition(expectedStatus, to)) {
    return {
      ok: false,
      error: `Không thể chuyển đơn từ ${orderStatusLabel(expectedStatus)} sang ${orderStatusLabel(to)}.`,
    };
  }
  if (to === "CANCELLED") {
    const reasonError = validateCancelReason(opts.reason ?? "");
    if (reasonError) return { ok: false, error: reasonError };
  }
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { code },
      select: { id: true, paymentMethod: true, paymentStatus: true },
    });
    if (!order) return { ok: false, error: "Không tìm thấy đơn hàng." };
    const changed = await tx.order.updateMany({
      where: { code, status: expectedStatus },
      data: { status: to },
    });
    if (changed.count === 0) return { ok: false, error: CONCURRENT_ERROR };
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "STATUS_CHANGE",
        fromStatus: expectedStatus,
        toStatus: to,
        note: to === "CANCELLED" ? opts.reason!.trim() : null,
      },
    });
    // COD thu tiền khi giao xong → đánh dấu PAID cùng giao dịch.
    if (to === "COMPLETED" && order.paymentMethod === "COD" && order.paymentStatus === "UNPAID") {
      await tx.order.updateMany({
        where: { code, paymentStatus: "UNPAID" },
        data: { paymentStatus: "PAID", paidAt: new Date() },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "PAYMENT",
          fromStatus: null,
          toStatus: null,
          note: "Thu tiền khi giao hàng (COD).",
        },
      });
    }
    return { ok: true } as OrderMutationResult;
  });
}

// Đánh dấu đã thanh toán (idempotent): đơn đã PAID → thành công luôn
// (không đổi gì); đơn đã hủy → lỗi; hai lần bấm cùng lúc → chỉ một
// lần đổi (điều kiện paymentStatus UNPAID + chưa hủy).
export async function markOrderPaid(code: string): Promise<OrderMutationResult> {
  if (!ORDER_CODE_RE.test(code)) return { ok: false, error: "Không tìm thấy đơn hàng." };
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { code },
      select: { id: true, status: true, paymentStatus: true },
    });
    if (!order) return { ok: false, error: "Không tìm thấy đơn hàng." };
    if (order.status === "CANCELLED") {
      return { ok: false, error: "Đơn đã hủy, không thể đánh dấu đã thanh toán." };
    }
    if (order.paymentStatus === "PAID") return { ok: true };
    const changed = await tx.order.updateMany({
      where: { code, paymentStatus: "UNPAID", status: { not: "CANCELLED" } },
      data: { paymentStatus: "PAID", paidAt: new Date() },
    });
    if (changed.count === 0) return { ok: false, error: CONCURRENT_ERROR };
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "PAYMENT",
        fromStatus: null,
        toStatus: null,
        note: null,
      },
    });
    return { ok: true } as OrderMutationResult;
  });
}

// Lưu ghi chú nội bộ (≤ 500 ký tự, văn bản thuần). Không ghi nhật ký.
export async function saveInternalNote(
  code: string,
  note: string,
): Promise<OrderMutationResult> {
  if (!ORDER_CODE_RE.test(code)) return { ok: false, error: "Không tìm thấy đơn hàng." };
  const noteError = validateInternalNote(note);
  if (noteError) return { ok: false, error: noteError };
  const changed = await db.order.updateMany({
    where: { code },
    data: { internalNote: note.trim() === "" ? null : note.trim() },
  });
  if (changed.count === 0) return { ok: false, error: "Không tìm thấy đơn hàng." };
  return { ok: true };
}

// Gửi lại thông báo Telegram cho đơn chưa được báo (notifiedAt NULL).
// Chống gửi trùng khi bấm đúp: "nhận" đơn bằng cập nhật có điều kiện
// (notifiedAt IS NULL → đặt notifiedAt = giờ hiện tại) TRƯỚC khi gọi
// Telegram; gửi lỗi thì trả notifiedAt về NULL. Chỉ lần nhận thành
// công mới gửi; lần sau thấy notifiedAt đã có → báo đã gửi rồi.
export async function resendOrderNotification(
  code: string,
): Promise<OrderMutationResult> {
  if (!ORDER_CODE_RE.test(code)) return { ok: false, error: "Không tìm thấy đơn hàng." };
  const order = await db.order.findUnique({
    where: { code },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!order) return { ok: false, error: "Không tìm thấy đơn hàng." };
  if (order.notifiedAt !== null) {
    return { ok: false, error: "Đơn này đã được gửi thông báo rồi." };
  }
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID ?? "").trim();
  if (!token || !chatId) {
    return { ok: false, error: "Chưa cấu hình Telegram, không gửi được thông báo." };
  }
  const claimedAt = new Date();
  const claimed = await db.order.updateMany({
    where: { code, notifiedAt: null },
    data: { notifiedAt: claimedAt },
  });
  if (claimed.count === 0) {
    return { ok: false, error: "Đơn này đã được gửi thông báo rồi." };
  }
  const sent = await sendTelegramForOrder(order);
  if (!sent) {
    await db.order.updateMany({
      where: { code, notifiedAt: claimedAt },
      data: { notifiedAt: null },
    });
    return { ok: false, error: "Gửi thông báo thất bại, vui lòng thử lại." };
  }
  await db.orderEvent.create({
    data: {
      orderId: order.id,
      type: "NOTIFY",
      fromStatus: null,
      toStatus: null,
      note: null,
    },
  });
  return { ok: true };
}
