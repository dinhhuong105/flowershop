import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminCategory } from "@/lib/admin/categories";
import { updateCategoryAction } from "@/app/actions/admin";
import CategoryForm from "@/components/admin/CategoryForm";
import ProductModal from "@/components/admin/ProductModal";

export const dynamic = "force-dynamic";

// Popup sửa danh mục (intercepting route, 25/11): chỉ render khi
// điều hướng tới từ trong admin — danh sách ở dưới vẫn hiện, URL
// đổi thành /admin/categories/[id]. Vào trực tiếp URL thì trang
// /admin/categories/[id] đầy đủ hiện thay (không phải popup này).
export default async function AdminEditCategoryModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) notFound();
  const category = await getAdminCategory(categoryId);
  if (!category) notFound();
  return (
    <ProductModal title={`Sửa danh mục ${category.name}`}>
      <CategoryForm
        mode="edit"
        action={updateCategoryAction.bind(null, category.id)}
        onSuccess="back"
        originalSlug={category.slug}
        initial={{
          name: category.name,
          slug: category.slug,
          sortOrder: String(category.sortOrder),
        }}
      />
    </ProductModal>
  );
}
