import { randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CART_COOKIE, CART_TTL_DAYS, MAX_QTY } from "@/config/cart";
import { siteConfig } from "@/config/site";
import { getDisplayPrice } from "./pricing";

// Giỏ hàng lưu DB (mục 4 đặc tả Ngày 4). Cookie chỉ chứa token, không
// chứa id giỏ hay giá. Giá luôn tính lại từ bảng sản phẩm.

export type CartLine = {
  itemId: number;
  productId: number;
  name: string;
  slug: string;
  categorySlug: string;
  categoryName: string;
  image: string;
  price: number; // giá hiện tại (salePrice hợp lệ thì lấy salePrice)
  originalPrice: number | null;
  quantity: number;
  lineTotal: number;
  sku: string | null;
  unavailable: boolean; // isActive = false hoặc inStock = false
};

export type CartData = {
  items: CartLine[];
  count: number; // tổng số lượng các dòng khả dụng
  subtotal: number; // tổng tiền các dòng khả dụng
};

function expiryDate(): Date {
  return new Date(Date.now() + CART_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function isSecureCookie(): boolean {
  return siteConfig.url.startsWith("https://");
}

async function readToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE)?.value ?? null;
}

// Tìm giỏ hợp lệ theo cookie: token khớp, ACTIVE, chưa hết hạn.
async function findValidCart(token: string | null) {
  if (!token) return null;
  const cart = await db.cart.findUnique({ where: { token } });
  if (!cart) return null;
  if (cart.status !== "ACTIVE") return null;
  if (cart.expiresAt.getTime() <= Date.now()) return null;
  return cart;
}

// Tạo giỏ mới (chỉ khi thêm món đầu tiên) và ghi cookie. Trả về id giỏ.
async function createCart(): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const cart = await db.cart.create({
    data: { token, status: "ACTIVE", expiresAt: expiryDate() },
    select: { id: true },
  });
  const store = await cookies();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: CART_TTL_DAYS * 24 * 60 * 60,
    secure: isSecureCookie(),
  });
  return cart.id;
}

// Lấy id giỏ hợp lệ, tạo mới nếu chưa có (dùng khi thêm món).
export async function ensureCartId(): Promise<string> {
  const token = await readToken();
  const cart = await findValidCart(token);
  if (cart) return cart.id;
  return createCart();
}

// Id giỏ hợp lệ hiện tại, null nếu không có (không tạo mới).
// G-6: bọc bằng React cache() — layout (getCartCount) và trang (getCart)
// gọi trong cùng một lần tải trang thì chỉ truy vấn DB một lần. Khóa
// theo cookie token của request (như bài học của getCategoryPage);
// cookie không đổi trong một request nên cache theo request là đủ.
// Lưu ý: ensureCartId KHÔNG dùng hàm này mà gọi findValidCart trực
// tiếp, để không cache nhầm null trước khi tạo giỏ mới.
export const getValidCartId = cache(async (): Promise<string | null> => {
  const token = await readToken();
  const cart = await findValidCart(token);
  return cart ? cart.id : null;
});

// Làm mới hạn giỏ mỗi lần ghi.
async function touchCart(cartId: string): Promise<void> {
  await db.cart.update({
    where: { id: cartId },
    data: { expiresAt: expiryDate() },
  });
}

// Thêm món: MỘT câu SQL nguyên tử (chịu được nhiều yêu cầu song song).
// Số lượng kẹp tối đa MAX_QTY ngay trong SQL.
export async function addItem(
  cartId: string,
  productId: number,
  qty: number,
): Promise<void> {
  await db.$executeRaw(
    Prisma.sql`INSERT INTO "cart_items" ("cartId","productId","quantity","updatedAt")
      VALUES (${cartId},${productId},${qty},now())
      ON CONFLICT ("cartId","productId")
      DO UPDATE SET "quantity" = LEAST("cart_items"."quantity" + EXCLUDED."quantity", ${MAX_QTY}),
                    "updatedAt" = now()`,
  );
  await touchCart(cartId);
}

export async function updateItemQuantity(
  cartId: string,
  itemId: number,
  qty: number,
): Promise<boolean> {
  const result = await db.cartItem.updateMany({
    where: { id: itemId, cartId },
    data: { quantity: qty },
  });
  if (result.count > 0) await touchCart(cartId);
  return result.count > 0;
}

export async function removeItem(cartId: string, itemId: number): Promise<boolean> {
  const result = await db.cartItem.deleteMany({
    where: { id: itemId, cartId },
  });
  if (result.count > 0) await touchCart(cartId);
  return result.count > 0;
}

// Đọc giỏ kèm dữ liệu sản phẩm hiện tại; giá tính lại bằng getDisplayPrice.
// Dòng isActive = false hoặc inStock = false → unavailable, không tính
// vào tạm tính và count.
//
// G-6: một câu SQL JOIN duy nhất thay cho findMany của Prisma (trước đây
// Prisma tách thành 3 truy vấn: cart_items, products, categories). Nhờ
// vậy một lần tải /gio-hang (2 dòng) chỉ còn 4 truy vấn: danh mục menu,
// cartId (đã cache), câu này, và SUM của getCartCount.
type CartRow = {
  itemId: number;
  quantity: number;
  productId: number;
  name: string;
  slug: string;
  price: number;
  salePrice: number | null;
  images: string[];
  isActive: boolean;
  inStock: boolean;
  sku: string | null;
  categorySlug: string;
  categoryName: string;
};

export async function getCart(): Promise<CartData> {
  const empty: CartData = { items: [], count: 0, subtotal: 0 };
  const cartId = await getValidCartId();
  if (!cartId) return empty;
  const rows = await db.$queryRaw<CartRow[]>(Prisma.sql`
    SELECT ci.id AS "itemId", ci.quantity,
      p.id AS "productId", p.name, p.slug, p.price, p."salePrice", p.images,
      p."isActive", p."inStock", p.sku,
      c.slug AS "categorySlug", c.name AS "categoryName"
    FROM "cart_items" ci
    JOIN "products" p ON p.id = ci."productId"
    JOIN "categories" c ON c.id = p."categoryId"
    WHERE ci."cartId" = ${cartId}
    ORDER BY ci.id ASC`);
  const items: CartLine[] = rows.map((r) => {
    const price = getDisplayPrice(r);
    const unavailable = !r.isActive || !r.inStock;
    return {
      itemId: r.itemId,
      productId: r.productId,
      name: r.name,
      slug: r.slug,
      categorySlug: r.categorySlug,
      categoryName: r.categoryName,
      image: r.images[0] ?? "/images/placeholder.svg",
      price: price.current,
      originalPrice: price.original,
      quantity: r.quantity,
      lineTotal: unavailable ? 0 : price.current * r.quantity,
      sku: r.sku,
      unavailable,
    };
  });
  const available = items.filter((i) => !i.unavailable);
  return {
    items,
    count: available.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: available.reduce((sum, i) => sum + i.lineTotal, 0),
  };
}

// Một truy vấn đếm nhẹ cho header (không nạp sản phẩm); 0 khi không có giỏ.
// Chỉ đếm dòng khả dụng (isActive và inStock) như getCart().
export async function getCartCount(): Promise<number> {
  const cartId = await getValidCartId();
  if (!cartId) return 0;
  const result = await db.cartItem.aggregate({
    _sum: { quantity: true },
    where: {
      cartId,
      product: { isActive: true, inStock: true },
    },
  });
  return result._sum.quantity ?? 0;
}
