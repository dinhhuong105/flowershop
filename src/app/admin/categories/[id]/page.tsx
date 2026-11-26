import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getSettings } from "@/lib/settings-cache";
import { getAdminCategory } from "@/lib/admin/categories";
import { updateCategoryAction } from "@/app/actions/admin";
import CategoryForm from "@/components/admin/CategoryForm";
import { CATEGORY_DESCRIPTIONS } from "@/lib/category-descriptions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sửa danh mục",
  robots: { index: false, follow: false },
};

// Trang sửa danh mục đầy đủ (25/11): chỉ hiện khi vào trực tiếp
// URL /admin/categories/[id] — bấm từ danh sách thì popup
// (intercepting route @modal) hiện thay.
export default async function AdminEditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) notFound();
  const [category, settings] = await Promise.all([
    getAdminCategory(categoryId),
    getSettings(),
  ]);
  if (!category) notFound();
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Sửa danh mục: {category.name}</h1>
      <div className="mt-6">
        <CategoryForm
          mode="edit"
          action={updateCategoryAction.bind(null, category.id)}
          onSuccess="list"
          originalSlug={category.slug}
          siteName={settings.siteName}
          urlPath={`/${category.slug}`}
          fallbackDescription={CATEGORY_DESCRIPTIONS[category.slug] ?? ""}
          initial={{
            name: category.name,
            slug: category.slug,
            sortOrder: String(category.sortOrder),
            seoTitle: category.seoTitle,
            seoDescription: category.seoDescription,
          }}
        />
      </div>
    </div>
  );
}
