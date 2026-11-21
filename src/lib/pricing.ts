// Tính giá hiển thị của một sản phẩm. Hàm thuần, không phụ thuộc DB.
export function getDisplayPrice(p: { price: number; salePrice: number | null }): {
  current: number;
  original: number | null;
  discountPercent: number | null;
} {
  if (p.salePrice !== null && p.salePrice > 0 && p.salePrice < p.price) {
    return {
      current: p.salePrice,
      original: p.price,
      discountPercent: Math.round((1 - p.salePrice / p.price) * 100),
    };
  }
  return { current: p.price, original: null, discountPercent: null };
}
