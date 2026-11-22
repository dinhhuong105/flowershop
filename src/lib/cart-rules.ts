import { MAX_QTY } from "@/config/cart";

// Quy tắc số lượng giỏ hàng (mục 4.2 đặc tả Ngày 4). Hàm thuần, có test.

// Kẹp n về số nguyên trong [1, MAX_QTY]: không phải số hữu hạn → 1;
// làm tròn xuống rồi kẹp hai đầu.
export function clampQuantity(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 1;
  const floored = Math.floor(n);
  if (floored < 1) return 1;
  if (floored > MAX_QTY) return MAX_QTY;
  return floored;
}

// Chỉ chấp nhận số nguyên trong [1, MAX_QTY]. Từ chối 0, -1, 21, 1.5,
// "abc", NaN, null và mọi kiểu không phải number.
export function isValidQuantity(x: unknown): x is number {
  return (
    typeof x === "number" &&
    Number.isInteger(x) &&
    x >= 1 &&
    x <= MAX_QTY
  );
}
