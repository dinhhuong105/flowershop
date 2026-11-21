import { getHomeData } from "@/lib/queries";
import Hero from "@/components/home/Hero";
import CategoryGrid from "@/components/home/CategoryGrid";
import FeaturedProducts from "@/components/home/FeaturedProducts";
import OccasionChips from "@/components/home/OccasionChips";
import WhyUs from "@/components/home/WhyUs";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { categories, featured } = await getHomeData();
  return (
    <>
      <Hero />
      <CategoryGrid categories={categories} />
      <FeaturedProducts products={featured} />
      <OccasionChips />
      <WhyUs />
    </>
  );
}
