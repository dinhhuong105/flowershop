import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { truncateAtWord } from "@/lib/quick-view";

// Dữ liệu "Xem nhanh" (mục 3.2 đặc tả Ngày 6).
// GET /api/quick-view?c=<slug-danh-mục>&p=<slug-sản-phẩm>
// 404 khi không có, sai danh mục, hoặc isActive = false.
// Cache-Control: no-store.

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const categorySlug = searchParams.get("c") ?? "";
  const productSlug = searchParams.get("p") ?? "";
  if (categorySlug === "" || productSlug === "") {
    return NextResponse.json(
      { error: "Không tìm thấy sản phẩm." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  const product = await db.product.findFirst({
    where: { slug: productSlug, isActive: true, category: { slug: categorySlug } },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      salePrice: true,
      images: true,
      description: true,
      sku: true,
      inStock: true,
      isFastDelivery: true,
      category: { select: { slug: true, name: true } },
    },
  });
  if (!product) {
    return NextResponse.json(
      { error: "Không tìm thấy sản phẩm." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      id: product.id,
      name: product.name,
      slug: product.slug,
      categorySlug: product.category.slug,
      categoryName: product.category.name,
      price: product.price,
      salePrice: product.salePrice,
      images: product.images,
      description: truncateAtWord(product.description, 300),
      sku: product.sku,
      inStock: product.inStock,
      isFastDelivery: product.isFastDelivery,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
