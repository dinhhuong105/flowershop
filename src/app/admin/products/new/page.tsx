import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { getSettings } from "@/lib/settings-cache";
import { listAdminCategories } from "@/lib/admin/products";
import { createProductAction } from "@/app/actions/admin";
import ProductForm from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thêm sản phẩm",
  robots: { index: false, follow: false },
};

export default async function AdminNewProductPage() {
  await requireAdmin();
  const [categories, settings] = await Promise.all([
    listAdminCategories(),
    getSettings(),
  ]);
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Thêm sản phẩm</h1>
      <div className="mt-6">
        <ProductForm
          mode="create"
          categories={categories}
          action={createProductAction}
          onSuccess="list"
          siteName={settings.siteName}
          initial={{
            name: "",
            slug: "",
            sku: "",
            categoryId: "",
            price: "",
            salePrice: "",
            description: "",
            tags: "",
            sortOrder: "0",
            isActive: true,
            inStock: true,
            isFastDelivery: false,
            images: [],
            seoTitle: "",
            seoDescription: "",
          }}
        />
      </div>
    </div>
  );
}
