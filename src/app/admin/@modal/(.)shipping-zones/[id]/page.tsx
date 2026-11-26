import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminZone } from "@/lib/admin/zones";
import { updateZoneAction } from "@/app/actions/admin";
import ZoneForm from "@/components/admin/ZoneForm";
import ProductModal from "@/components/admin/ProductModal";

export const dynamic = "force-dynamic";

// Popup sửa khu vực (intercepting route, Ngày 12 C2): chỉ render
// khi điều hướng tới từ trong admin — danh sách ở dưới vẫn hiện, URL
// đổi thành /admin/shipping-zones/[id]. Vào trực tiếp URL thì trang
// /admin/shipping-zones/[id] đầy đủ hiện thay (không phải popup này).
export default async function AdminEditZoneModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const zoneId = Number(id);
  if (!Number.isInteger(zoneId) || zoneId <= 0) notFound();
  const zone = await getAdminZone(zoneId);
  if (!zone) notFound();
  return (
    <ProductModal title={`Sửa khu vực ${zone.name}`}>
      <ZoneForm
        mode="edit"
        action={updateZoneAction.bind(null, zone.id)}
        onSuccess="back"
        initial={{
          name: zone.name,
          fee: String(zone.fee),
          sortOrder: String(zone.sortOrder),
          isActive: zone.isActive,
        }}
      />
    </ProductModal>
  );
}
