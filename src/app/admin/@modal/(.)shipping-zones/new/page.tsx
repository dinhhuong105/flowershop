import { requireAdmin } from "@/lib/admin/auth";
import { createZoneAction } from "@/app/actions/admin";
import ZoneForm from "@/components/admin/ZoneForm";
import ProductModal from "@/components/admin/ProductModal";

export const dynamic = "force-dynamic";

// Popup thêm khu vực (intercepting route, Ngày 12 C2): chỉ render
// khi điều hướng tới từ trong admin — danh sách ở dưới vẫn hiện, URL
// đổi thành /admin/shipping-zones/new. Vào trực tiếp URL thì trang
// /admin/shipping-zones/new đầy đủ hiện thay (không phải popup này).
// Tái dùng ProductModal (dialog gốc, đã căn giữa) vì nó nhận mọi
// nội dung con, không riêng gì sản phẩm.
export default async function AdminNewZoneModal() {
  await requireAdmin();
  return (
    <ProductModal title="Thêm khu vực">
      <ZoneForm
        mode="create"
        action={createZoneAction}
        onSuccess="back"
        initial={{ name: "", fee: "", sortOrder: "0", isActive: true }}
      />
    </ProductModal>
  );
}
