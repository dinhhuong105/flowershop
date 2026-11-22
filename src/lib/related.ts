import { getDisplayPrice } from "./pricing";

// Quy tắc chọn sản phẩm liên quan (mục 5.3 đặc tả Ngày 4). Hàm thuần,
// có test. Trả tối đa 4 sản phẩm, loại chính nó và sản phẩm không
// isActive: cùng danh mục trước, rồi lấy bù từ danh mục khác khi chưa
// đủ 4. Trong mỗi nhóm sắp theo: số tag trùng giảm dần, chênh lệch giá
// hiện tại tăng dần, sortOrder tăng dần, id tăng dần.

export type RelatedInput = {
  id: number;
  categoryId: number;
  tags: string[];
  price: number;
  salePrice: number | null;
  sortOrder: number;
};

export type RelatedCandidate = RelatedInput & { isActive: boolean };

function currentPrice(p: RelatedInput): number {
  return getDisplayPrice(p).current;
}

function compareRelated<T extends RelatedInput>(
  a: T & { isActive: boolean },
  b: T & { isActive: boolean },
  current: RelatedInput,
): number {
  const sharedA = a.tags.filter((t) => current.tags.includes(t)).length;
  const sharedB = b.tags.filter((t) => current.tags.includes(t)).length;
  if (sharedA !== sharedB) return sharedB - sharedA;
  const diffA = Math.abs(currentPrice(a) - currentPrice(current));
  const diffB = Math.abs(currentPrice(b) - currentPrice(current));
  if (diffA !== diffB) return diffA - diffB;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.id - b.id;
}

export function rankRelated<T extends RelatedInput>(
  current: RelatedInput,
  candidates: Array<T & { isActive: boolean }>,
): T[] {
  const pool = candidates.filter((c) => c.id !== current.id && c.isActive);
  const same = pool
    .filter((c) => c.categoryId === current.categoryId)
    .sort((a, b) => compareRelated(a, b, current));
  const other = pool
    .filter((c) => c.categoryId !== current.categoryId)
    .sort((a, b) => compareRelated(a, b, current));
  return [...same, ...other].slice(0, 4);
}
