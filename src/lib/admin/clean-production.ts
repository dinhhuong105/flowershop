// Hàm chọn bản ghi dọn production (Ngày 11 A2) — PHẦN THUẦN, không
// import DB nên test được trực tiếp. Tiêu chí khớp khai báo rõ trong
// đặc tả, script scripts/clean-production.ts chỉ gọi hàm này rồi xóa
// đúng danh sách đã chọn.
//
// Đơn khớp khi: tên người đặt bắt đầu "[TEST]" HOẶC mã đơn nằm trong
// danh sách --orders truyền vào. Sản phẩm khớp khi SKU nằm trong
// danh sách --skus truyền vào. Từ chối chạy (refused) khi: số đơn
// khớp > 20, hoặc có đơn khớp ở trạng thái COMPLETED mà đã thanh
// toán PAID (có thể là đơn thật) mà không có --allow-paid.

export type CleanupOrderInput = {
  code: string;
  senderName: string;
  status: string;
  paymentStatus: string;
};

export type CleanupProductInput = {
  id: number;
  sku: string | null;
};

export type CleanupSelection = {
  orders: CleanupOrderInput[];
  products: CleanupProductInput[];
  refused: string[];
};

export const MAX_CLEANUP_ORDERS = 20;

export function selectProductionCleanup(
  input: { orders: CleanupOrderInput[]; products: CleanupProductInput[] },
  criteria: { orderCodes: string[]; productSkus: string[]; allowPaid: boolean },
): CleanupSelection {
  const codeSet = new Set(criteria.orderCodes);
  const skuSet = new Set(criteria.productSkus);
  const orders = input.orders.filter(
    (o) => o.senderName.startsWith("[TEST]") || codeSet.has(o.code),
  );
  const products = input.products.filter((p) => p.sku !== null && skuSet.has(p.sku));
  const refused: string[] = [];
  if (orders.length > MAX_CLEANUP_ORDERS) {
    refused.push(
      `Có ${orders.length} đơn khớp, vượt ngưỡng ${MAX_CLEANUP_ORDERS} đơn — kiểm tra lại danh sách trước khi xóa.`,
    );
  }
  const paid = orders.filter((o) => o.status === "COMPLETED" && o.paymentStatus === "PAID");
  if (paid.length > 0 && !criteria.allowPaid) {
    refused.push(
      `Có ${paid.length} đơn đã hoàn tất và đã thanh toán (${paid.map((o) => o.code).join(", ")}) — có thể là đơn thật, cần --allow-paid mới xóa.`,
    );
  }
  return { orders, products, refused };
}
