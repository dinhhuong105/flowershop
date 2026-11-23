// Hỗ trợ "Xem nhanh" (mục 3.2 đặc tả Ngày 6).

// Mô tả tối đa 300 ký tự, cắt ở ranh giới từ (không thêm dấu "...",
// để độ dài luôn ≤ 300).
export function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
}
