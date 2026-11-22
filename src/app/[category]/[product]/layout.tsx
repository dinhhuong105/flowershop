import { notFound } from "next/navigation";
import { getProduct } from "@/lib/product";

// Layout trang chi tiết (Ngày 4).
//
// VÌ SAO CÓ FILE NÀY: Next 15.5.29 + `loading.tsx` trong cây route làm
// `notFound()` chỉ render giao diện 404 với HTTP 200 (đã đo: chỉ cần
// MỘT loading.tsx — gốc, [category] hay [product] — là mọi notFound()
// trong cây đó đều trả 200; gỡ hết thì trả 404). Để vừa giữ skeleton
// `loading.tsx` của trang chi tiết (mục 5.1) vừa trả 404 thật (D4-8),
// việc kiểm tra sản phẩm đặt ở layout này — layout nằm NGOÀI
// Suspense boundary của loading.tsx nên notFound() ở đây thoát ra
// ngoài và Next đặt status 404. Trang page.tsx vẫn giữ notFound() của
// nó làm dự phòng. getProduct() dùng React cache() nên layout và page
// chung một truy vấn DB trong cùng request.
// (Đã gỡ src/app/loading.tsx và src/app/[category]/loading.tsx vì
// chúng bọc cả cây route và làm hỏng 404 của mọi trang động; ghi rõ ở
// báo cáo Ngày 4.)
export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ category: string; product: string }>;
}) {
  const { category, product } = await params;
  const p = await getProduct(category, product);
  if (!p) notFound();
  return <>{children}</>;
}
