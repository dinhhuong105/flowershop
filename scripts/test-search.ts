// Kiểm tra danh sách kết quả tìm kiếm (mục 5.2 đặc tả Ngày 6) trên
// DB thật. Chạy: set -a; . ./.env; set +a; npx tsx scripts/test-search.ts
// In tên sản phẩm theo đúng thứ tự trả về + tổng số, để đối chiếu với
// bảng kỳ vọng D6-4a..D6-4i và D6-8.
import { searchProducts, searchSuggestions } from "../src/lib/search";
import { db } from "../src/lib/db";

const QUERIES: Array<[string, string]> = [
  ["D6-4a", "hong"],
  ["D6-4b", "HỒNG ĐỎ"],
  ["D6-4c", "ht-005"],
  ["D6-4d", "khai truong"],
  ["D6-4e", "lan ho diep"],
  ["D6-4f", "tuoi"],
  ["D6-4g", "hoa"],
  ["D6-4h", "qua tang"],
  ["D6-4i", "xyz"],
];

async function main(): Promise<void> {
  for (const [id, q] of QUERIES) {
    const page1 = await searchProducts(q, { page: 1 });
    console.log(`\n${id} q=${JSON.stringify(q)} total=${page1.total} pages=${page1.totalPages}`);
    page1.products.forEach((p, i) => console.log(`  ${i + 1}. ${p.name}`));
    if (page1.totalPages > 1) {
      const page2 = await searchProducts(q, { page: 2 });
      console.log(`  --- trang 2 (${page2.products.length}) ---`);
      page2.products.forEach((p, i) => console.log(`  ${i + 1}. ${p.name}`));
    }
  }
  const sugg = await searchSuggestions("hong");
  console.log("\nD6-8 suggest q=hong:");
  sugg.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}`));
  console.log(`\nproducts count=${await db.product.count()}`);
  await db.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
