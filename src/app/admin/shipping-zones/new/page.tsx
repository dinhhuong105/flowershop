import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { createZoneAction } from "@/app/actions/admin";
import ZoneForm from "@/components/admin/ZoneForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thêm khu vực",
  robots: { index: false, follow: false },
};

// Trang thêm khu vực đầy đủ (Ngày 12 C2): chỉ hiện khi vào trực
// tiếp URL /admin/shipping-zones/new — bấm từ danh sách thì popup
// (intercepting route @modal) hiện thay.
export default async function AdminNewZonePage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Thêm khu vực</h1>
      <div className="mt-6">
        <ZoneForm
          mode="create"
          action={createZoneAction}
          onSuccess="list"
          initial={{ name: "", fee: "", sortOrder: "0", isActive: true }}
        />
      </div>
    </div>
  );
}
