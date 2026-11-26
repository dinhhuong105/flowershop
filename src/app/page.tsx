import type { Metadata } from "next";
import { getHomeData } from "@/lib/queries";
import { heroSlides } from "@/config/home";
import HeroSlider from "@/components/ui/HeroSlider";
import UspStrip from "@/components/layout/UspStrip";
import OccasionChips from "@/components/home/OccasionChips";
import CategorySection from "@/components/home/CategorySection";

export const dynamic = "force-dynamic";

// Canonical tự tham chiếu cho trang chủ (Ngày 14 F2: script
// go-live-check yêu cầu trang chủ có <link rel="canonical"> dùng
// đúng domain; trước đây trang chủ không có canonical trong khi
// trang sản phẩm/danh mục đã có). Chỉ ảnh hưởng "/", không đổi
// tiêu đề/mô tả (kế thừa từ layout).
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const { categories } = await getHomeData();
  // Mỗi danh mục có sản phẩm là một khối; danh mục không có sản phẩm
  // thì không hiện khối (mục 5.1 phụ lục). Hiện có 4 danh mục đều có
  // sản phẩm → 4 khối, số SP mỗi khối 4, 3, 2, 3.
  const sections = categories.filter((c) => c.products.length > 0);
  return (
    <>
      <HeroSlider slides={heroSlides} />
      <UspStrip />
      <OccasionChips />
      {sections.map((c) => (
        <CategorySection key={c.slug} category={c} products={c.products} />
      ))}
    </>
  );
}
