"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { BUY_NOW_REDIRECT, MAX_CART_LINES } from "@/config/cart";
import { isValidQuantity } from "@/lib/cart-rules";
import {
  addItem,
  countCartLines,
  ensureCartId,
  getCartCount,
  getValidCartId,
  hasCartLine,
  removeItem as removeCartItem,
  updateItemQuantity,
} from "@/lib/cart";

// Server Actions giỏ hàng (mục 4.3 đặc tả Ngày 4).
//
// LƯU Ý KHÁC ĐẶC TẢ: đặc tả viết chữ ký addToCart(productId, qty); ở đây
// action nhận FormData — form cần hoạt động khi tắt JavaScript (4.3), và
// chỉ FormData mới mang đúng số lượng người dùng gõ vào ô số lượng khi
// không có JS. Hàm lõi addItem/updateItemQuantity trong src/lib/cart.ts
// vẫn giữ chữ ký có kiểu (cartId, productId/id, qty).
// Mọi action kiểm tra đầu vào bằng isValidQuantity và trả
// { ok: true, count } | { ok: false, error } (tiếng Việt, không lộ chi
// tiết kỹ thuật). buyNow redirect nên không trả giá trị.

export type CartActionResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

// Đọc một trường số nguyên từ FormData: "1.5", "abc", "" → null.
function parseIntField(formData: FormData, name: string): number | null {
  const raw = formData.get(name);
  if (typeof raw !== "string") return null;
  if (!/^-?\d+$/.test(raw.trim())) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

export async function addToCart(formData: FormData): Promise<CartActionResult> {
  const productId = parseIntField(formData, "productId");
  const qty = parseIntField(formData, "quantity");
  if (productId === null) return { ok: false, error: "Không tìm thấy sản phẩm." };
  if (qty === null || !isValidQuantity(qty)) {
    return { ok: false, error: "Số lượng phải là số nguyên từ 1 đến 20." };
  }
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { isActive: true, inStock: true },
  });
  if (!product || !product.isActive || !product.inStock) {
    return { ok: false, error: "Sản phẩm hiện không còn bán." };
  }
  const cartId = await ensureCartId();
  // Ngày 17 S8: giỏ tối đa 50 dòng — chỉ chặn THÊM dòng mới, tăng
  // số lượng dòng đã có vẫn cho. createOrder chặn lại lần nữa trong
  // giao dịch (phòng hai yêu cầu song song cùng thêm dòng mới).
  if (!(await hasCartLine(cartId, productId)) && (await countCartLines(cartId)) >= MAX_CART_LINES) {
    return { ok: false, error: "Giỏ hàng tối đa 50 dòng sản phẩm." };
  }
  await addItem(cartId, productId, qty);
  revalidatePath("/", "layout");
  return { ok: true, count: await getCartCount() };
}

export async function updateQuantity(formData: FormData): Promise<CartActionResult> {
  const itemId = parseIntField(formData, "itemId");
  const qty = parseIntField(formData, "quantity");
  if (itemId === null) return { ok: false, error: "Không tìm thấy dòng giỏ hàng." };
  if (qty === null || !isValidQuantity(qty)) {
    return { ok: false, error: "Số lượng phải là số nguyên từ 1 đến 20." };
  }
  const cartId = await getValidCartId();
  if (!cartId) return { ok: false, error: "Giỏ hàng đã hết hạn." };
  const changed = await updateItemQuantity(cartId, itemId, qty);
  if (!changed) return { ok: false, error: "Không tìm thấy dòng giỏ hàng." };
  revalidatePath("/", "layout");
  return { ok: true, count: await getCartCount() };
}

export async function removeItem(formData: FormData): Promise<CartActionResult> {
  const itemId = parseIntField(formData, "itemId");
  if (itemId === null) return { ok: false, error: "Không tìm thấy dòng giỏ hàng." };
  const cartId = await getValidCartId();
  if (!cartId) return { ok: false, error: "Giỏ hàng đã hết hạn." };
  const changed = await removeCartItem(cartId, itemId);
  if (!changed) return { ok: false, error: "Không tìm thấy dòng giỏ hàng." };
  revalidatePath("/", "layout");
  return { ok: true, count: await getCartCount() };
}

export async function buyNow(formData: FormData): Promise<never> {
  const productId = parseIntField(formData, "productId");
  const qty = parseIntField(formData, "quantity");
  if (productId === null || qty === null || !isValidQuantity(qty)) {
    redirect("/cart");
  }
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { isActive: true, inStock: true },
  });
  if (!product || !product.isActive || !product.inStock) {
    redirect("/cart");
  }
  const cartId = await ensureCartId();
  // Ngày 17 S8: như addToCart — giỏ đầy thì về trang giỏ (cùng hành
  // vi lỗi chung của buyNow: redirect về /cart).
  if (!(await hasCartLine(cartId, productId)) && (await countCartLines(cartId)) >= MAX_CART_LINES) {
    redirect("/cart");
  }
  await addItem(cartId, productId, qty);
  revalidatePath("/", "layout");
  redirect(BUY_NOW_REDIRECT);
}
