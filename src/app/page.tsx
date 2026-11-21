import { getHomeData } from "@/lib/queries";
import { heroSlides } from "@/config/home";
import HeroSlider from "@/components/ui/HeroSlider";
import UspStrip from "@/components/layout/UspStrip";
import OccasionChips from "@/components/home/OccasionChips";
import CategorySection from "@/components/home/CategorySection";

export const dynamic = "force-dynamic";

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
