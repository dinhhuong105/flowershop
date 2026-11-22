import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rankRelated, type RelatedCandidate, type RelatedInput } from "./related";

// Bộ dữ liệu mẫu 20 sản phẩm (đúng seed Ngày 1): id theo thứ tự seed,
// categoryId 1 = hoa-tuoi, 2 = gio-trai-cay, 3 = hop-trai-cay,
// 4 = lan-ho-diep; price/salePrice/tags/sortOrder đúng bảng Ngày 1.
const all: RelatedCandidate[] = [
  { id: 1, categoryId: 1, tags: ["tinh-yeu", "sinh-nhat"], price: 890000, salePrice: 801000, sortOrder: 1, isActive: true },
  { id: 2, categoryId: 1, tags: ["tinh-yeu", "sinh-nhat"], price: 750000, salePrice: null, sortOrder: 2, isActive: true },
  { id: 3, categoryId: 1, tags: ["chuc-mung", "sinh-nhat"], price: 650000, salePrice: 585000, sortOrder: 3, isActive: true },
  { id: 4, categoryId: 1, tags: ["chuc-mung"], price: 980000, salePrice: null, sortOrder: 4, isActive: true },
  { id: 5, categoryId: 1, tags: ["sinh-nhat", "chuc-mung"], price: 1650000, salePrice: 1485000, sortOrder: 5, isActive: true },
  { id: 6, categoryId: 1, tags: ["sinh-nhat"], price: 1450000, salePrice: null, sortOrder: 6, isActive: true },
  { id: 7, categoryId: 1, tags: ["khai-truong"], price: 1750000, salePrice: 1575000, sortOrder: 7, isActive: true },
  { id: 8, categoryId: 1, tags: ["khai-truong"], price: 2450000, salePrice: 2205000, sortOrder: 8, isActive: true },
  { id: 9, categoryId: 1, tags: ["khai-truong"], price: 2850000, salePrice: null, sortOrder: 9, isActive: true },
  { id: 10, categoryId: 1, tags: ["chuc-mung", "khai-truong"], price: 2250000, salePrice: 2025000, sortOrder: 10, isActive: true },
  { id: 11, categoryId: 1, tags: ["chia-buon"], price: 1850000, salePrice: null, sortOrder: 11, isActive: true },
  { id: 12, categoryId: 1, tags: ["chia-buon"], price: 2350000, salePrice: 2115000, sortOrder: 12, isActive: true },
  { id: 13, categoryId: 2, tags: ["tham-benh", "chuc-mung"], price: 790000, salePrice: null, sortOrder: 1, isActive: true },
  { id: 14, categoryId: 2, tags: ["qua-tang", "tham-benh"], price: 1890000, salePrice: 1701000, sortOrder: 2, isActive: true },
  { id: 15, categoryId: 2, tags: ["qua-tang", "chuc-mung"], price: 1290000, salePrice: null, sortOrder: 3, isActive: true },
  { id: 16, categoryId: 3, tags: ["qua-tang"], price: 590000, salePrice: 531000, sortOrder: 1, isActive: true },
  { id: 17, categoryId: 3, tags: ["qua-tang"], price: 1190000, salePrice: null, sortOrder: 2, isActive: true },
  { id: 18, categoryId: 4, tags: ["chuc-mung", "khai-truong", "qua-tang"], price: 1950000, salePrice: 1755000, sortOrder: 1, isActive: true },
  { id: 19, categoryId: 4, tags: ["khai-truong", "chuc-mung"], price: 3250000, salePrice: null, sortOrder: 2, isActive: true },
  { id: 20, categoryId: 4, tags: ["sinh-nhat", "qua-tang"], price: 2650000, salePrice: 2385000, sortOrder: 3, isActive: true },
];

const names: Record<number, string> = {
  1: "Bó Hồng Đỏ Tình Yêu",
  2: "Bó Hồng Phấn Dịu Dàng",
  3: "Bó Hướng Dương Rạng Rỡ",
  4: "Bó Cẩm Tú Cầu Xanh Mát",
  5: "Giỏ Hoa Hồng Cam Rực Rỡ",
  6: "Giỏ Hoa Mix Pastel",
  7: "Lẵng Hoa Khai Trương Hồng Phát",
  8: "Kệ Hoa Khai Trương Vàng Rực",
  9: "Kệ Hoa Khai Trương Xanh Dương",
  10: "Kệ Hoa Chúc Mừng Sắc Hồng",
  11: "Vòng Hoa Chia Buồn Trang Nhã",
  12: "Kệ Hoa Chia Buồn Hoa Trắng",
  13: "Giỏ Trái Cây Tươi Lành",
  14: "Giỏ Trái Cây Nhập Khẩu Cao Cấp",
  15: "Giỏ Trái Cây Phú Quý",
  16: "Hộp Trái Cây Mix Tươi Ngon",
  17: "Hộp Trái Cây Nhập Khẩu Sang Trọng",
  18: "Chậu Lan Hồ Điệp Trắng 3 Cành",
  19: "Chậu Lan Hồ Điệp Vàng 5 Cành",
  20: "Chậu Lan Hồ Điệp Tím Hồng",
};

function asCurrent(id: number): RelatedInput {
  const c = all.find((p) => p.id === id);
  if (!c) throw new Error(`không có sản phẩm ${id}`);
  return {
    id: c.id,
    categoryId: c.categoryId,
    tags: c.tags,
    price: c.price,
    salePrice: c.salePrice,
    sortOrder: c.sortOrder,
  };
}

describe("rankRelated", () => {
  it("Bó Hồng Đỏ Tình Yêu (D4-9): 4 thẻ đúng thứ tự", () => {
    const got = rankRelated(asCurrent(1), all).map((p) => names[p.id]);
    assert.deepEqual(got, [
      "Bó Hồng Phấn Dịu Dàng",
      "Bó Hướng Dương Rạng Rỡ",
      "Giỏ Hoa Mix Pastel",
      "Giỏ Hoa Hồng Cam Rực Rỡ",
    ]);
  });

  it("Chậu Lan Hồ Điệp Vàng 5 Cành (D4-10): 2 cùng danh mục + 2 lấy bù", () => {
    const got = rankRelated(asCurrent(19), all).map((p) => names[p.id]);
    assert.deepEqual(got, [
      "Chậu Lan Hồ Điệp Trắng 3 Cành",
      "Chậu Lan Hồ Điệp Tím Hồng",
      "Kệ Hoa Chúc Mừng Sắc Hồng",
      "Kệ Hoa Khai Trương Xanh Dương",
    ]);
  });

  it("loại chính nó và sản phẩm không isActive, tối đa 4", () => {
    const pool = all.map((p) => (p.id === 2 ? { ...p, isActive: false } : p));
    const got = rankRelated(asCurrent(1), pool).map((p) => p.id);
    assert.equal(got.length, 4);
    assert.ok(!got.includes(1));
    assert.ok(!got.includes(2));
    assert.equal(got[0], 3);
  });
});
