import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getAdminZone } from "@/lib/admin/zones";
import { updateZoneAction } from "@/app/actions/admin";
import ZoneForm from "@/components/admin/ZoneForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sửa khu vực",
  robots: { index: false, follow: false },
};

// Trang sửa khu vực đầy đủ (Ngày 12 C2): chỉ hiện khi vào trực
// tiếp URL /admin/shipping-zones/[id] — bấm từ danh sách thì popup
// (intercepting route @modal) hiện thay.
export default async function AdminEditZonePage({
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
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Sửa khu vực: {zone.name}</h1>
      <div className="mt-6">
        <ZoneForm
          mode="edit"
          action={updateZoneAction.bind(null, zone.id)}
          onSuccess="list"
          initial={{
            name: zone.name,
            fee: String(zone.fee),
            sortOrder: String(zone.sortOrder),
            isActive: zone.isActive,
          }}
        />
      </div>
    </div>
  );
}
