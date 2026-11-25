import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { createCategoryAction } from "@/app/actions/admin";
import CategoryForm from "@/components/admin/CategoryForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thêm danh mục",
  robots: { index: false, follow: false },
};

// Trang thêm danh mục đầy đủ (25/11): chỉ hiện khi vào trực tiếp
// URL /admin/categories/new — bấm từ danh sách thì popup
// (intercepting route @modal) hiện thay.
export default async function AdminNewCategoryPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Thêm danh mục</h1>
      <div className="mt-6">
        <CategoryForm
          mode="create"
          action={createCategoryAction}
          onSuccess="list"
          initial={{ name: "", slug: "", sortOrder: "0" }}
        />
      </div>
    </div>
  );
}
