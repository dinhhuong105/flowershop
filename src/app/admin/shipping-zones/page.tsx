import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdminZonesWithCounts } from "@/lib/admin/zones";
import { formatVND } from "@/lib/format";
import AdminIconButton, { PencilIcon } from "@/components/admin/AdminIconButton";
import DeleteZoneButton from "@/components/admin/DeleteZoneButton";
import ToggleZoneButton from "@/components/admin/ToggleZoneButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Khu vực & phí giao hàng",
  robots: { index: false, follow: false },
};

// Danh sách khu vực giao hàng quản trị (Ngày 12 C2 — theo mẫu trang
// Danh mục): từ 768 px là bảng, dưới 768 px là thẻ. Khu vực đã có
// đơn thì nút xóa bị khóa (xóa chỉ cho phép khi chưa có đơn).
// Bật/tắt không cần xác nhận, kèm toast Hoàn tác.

export default async function AdminShippingZonesPage() {
  await requireAdmin();
  const zones = await listAdminZonesWithCounts();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Khu vực &amp; phí giao hàng</h1>
        <Link
          href="/admin/shipping-zones/new"
          className="ml-auto flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          + Thêm khu vực
        </Link>
      </div>
      <p role="status" className="mt-2 text-sm text-slate-500">
        Tìm thấy {zones.length} khu vực
      </p>

      {zones.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Chưa có khu vực nào. Khi không còn khu vực nào đang bật, mặt shop sẽ chặn đặt hàng.
        </p>
      ) : (
        <>
          {/* Bảng từ 768 px */}
          <div className="mt-6 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th scope="col" className="px-4 py-3 font-semibold">Tên khu vực</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Phí giao hàng</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Số đơn</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Thứ tự</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id} data-testid="admin-zone-row" className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <Link href={`/admin/shipping-zones/${z.id}`} className="inline-flex min-h-11 items-center font-bold text-slate-900 hover:text-blue-600 hover:underline">
                        {z.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{formatVND(z.fee)}</td>
                    <td className="px-4 py-3">{z.orderCount}</td>
                    <td className="px-4 py-3">{z.sortOrder}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          z.isActive
                            ? "rounded-full bg-green-800/10 px-2 py-0.5 text-xs font-bold text-green-800"
                            : "rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-500"
                        }
                      >
                        {z.isActive ? "Đang bật" : "Đã tắt"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AdminIconButton
                          href={`/admin/shipping-zones/${z.id}`}
                          label="Sửa khu vực"
                          icon={PencilIcon}
                          tooltipAlign="right"
                          className="border border-blue-600 bg-white text-blue-600 hover:bg-slate-100"
                        />
                        <ToggleZoneButton zoneId={z.id} isActive={z.isActive} />
                        <DeleteZoneButton zoneId={z.id} name={z.name} orderCount={z.orderCount} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Thẻ dưới 768 px */}
          <ul className="mt-6 space-y-4 md:hidden">
            {zones.map((z) => (
              <li key={z.id} data-testid="admin-zone-row" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <Link href={`/admin/shipping-zones/${z.id}`} className="inline-flex min-h-11 items-center font-bold text-slate-900 hover:text-blue-600 hover:underline">
                  {z.name}
                </Link>
                <p className="mt-1 text-sm text-slate-500">
                  {formatVND(z.fee)} · {z.orderCount} đơn · Thứ tự {z.sortOrder} ·{" "}
                  {z.isActive ? "Đang bật" : "Đã tắt"}
                </p>
                <div className="mt-3 flex gap-2">
                  <AdminIconButton
                    href={`/admin/shipping-zones/${z.id}`}
                    label="Sửa khu vực"
                    icon={PencilIcon}
                    className="border border-blue-600 bg-white text-blue-600 hover:bg-slate-100"
                  />
                  <ToggleZoneButton zoneId={z.id} isActive={z.isActive} />
                  <DeleteZoneButton zoneId={z.id} name={z.name} orderCount={z.orderCount} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
