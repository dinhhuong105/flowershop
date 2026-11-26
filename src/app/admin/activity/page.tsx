import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import {
  ACTIVITY_AREAS,
  ACTIVITY_AREA_LABELS,
  activityAreaOf,
  displayActivityValue,
  isActivityArea,
  listActivity,
} from "@/lib/admin/activity";
import { formatVnActivityTime } from "@/lib/vn-datetime";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nhật ký hoạt động",
  robots: { index: false, follow: false },
};

// Nhật ký hoạt động quản trị (Ngày 15 C1): chỉ xem — không sửa,
// không xóa. Đọc bảng settings_audit: ai + lúc nào + khóa + giá trị
// cũ → mới (STK/token đã che khi ghi, che lại khi hiển thị nếu còn
// sót dãy số dài; giá trị dài cắt ngắn). Lọc theo khu vực, tìm theo
// khóa hoặc người thay đổi, khoảng ngày (giờ VN), 20/trang.

type BaseParams = {
  area: string;
  q: string;
  from: string;
  to: string;
};

function pageHref(base: BaseParams, page: number): string {
  const parts: string[] = [];
  if (base.area !== "") parts.push(`area=${encodeURIComponent(base.area)}`);
  if (base.q !== "") parts.push(`q=${encodeURIComponent(base.q)}`);
  if (base.from !== "") parts.push(`from=${encodeURIComponent(base.from)}`);
  if (base.to !== "") parts.push(`to=${encodeURIComponent(base.to)}`);
  if (page > 1) parts.push(`page=${page}`);
  return parts.length > 0 ? `/admin/activity?${parts.join("&")}` : "/admin/activity";
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    area?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const areaParam = params.area ?? "";
  const area = isActivityArea(areaParam) ? areaParam : "";
  const q = (params.q ?? "").trim();
  const from = (params.from ?? "").trim();
  const to = (params.to ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const list = await listActivity({
    area: area === "" ? "" : area,
    q,
    from,
    to,
    page,
  });
  const base: BaseParams = { area, q, from, to };
  const hasFilter = area !== "" || q !== "" || from !== "" || to !== "";

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900">Nhật ký hoạt động</h1>
      <p className="mt-2 text-sm text-slate-500">
        Chỉ xem — nhật ký không sửa, không xóa. Số tài khoản và mã bí mật không bao giờ hiện đầy
        đủ; giá trị dài được cắt ngắn.
      </p>

      <form method="get" action="/admin/activity" className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm font-semibold text-slate-900">
            Khu vực
            <select
              name="area"
              defaultValue={area}
              data-testid="activity-area-filter"
              className="mt-1 block min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
            >
              <option value="">Tất cả khu vực</option>
              {ACTIVITY_AREAS.map((a) => (
                <option key={a} value={a}>
                  {ACTIVITY_AREA_LABELS[a]}
                </option>
              ))}
            </select>
          </label>
          <label className="block grow text-sm font-semibold text-slate-900">
            Tìm theo khóa hoặc người thay đổi
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="vd bank.accountNumber hoặc admin"
              data-testid="activity-search"
              className="mt-1 block min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm font-semibold text-slate-900">
            Từ ngày
            <input
              name="from"
              type="date"
              defaultValue={from}
              data-testid="activity-from"
              className="mt-1 block min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-900">
            Đến ngày
            <input
              name="to"
              type="date"
              defaultValue={to}
              data-testid="activity-to"
              className="mt-1 block min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900"
            />
          </label>
          <button
            type="submit"
            className="flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Lọc
          </button>
          {hasFilter ? (
            <Link
              href="/admin/activity"
              className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
            >
              Xóa lọc
            </Link>
          ) : null}
        </div>
      </form>

      <p role="status" className="mt-4 text-sm text-slate-500">
        Tìm thấy {list.total} dòng
        {list.totalPages > 1 ? ` — trang ${list.page} / ${list.totalPages}` : ""}
      </p>

      {list.rows.length === 0 ? (
        <p data-testid="activity-empty" className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Không có dòng nhật ký nào khớp bộ lọc.
        </p>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th scope="col" className="w-[17%] px-4 py-3 font-semibold">Thời gian</th>
                  <th scope="col" className="w-[10%] px-4 py-3 font-semibold">Người</th>
                  <th scope="col" className="w-[11%] px-4 py-3 font-semibold">Khu vực</th>
                  <th scope="col" className="w-[22%] px-4 py-3 font-semibold">Khóa</th>
                  <th scope="col" className="w-[40%] px-4 py-3 font-semibold">Thay đổi</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((row) => (
                  <tr
                    key={row.id}
                    data-testid="activity-row"
                    className="border-b border-slate-100 align-top last:border-0"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-slate-900">
                      {formatVnActivityTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 break-words text-slate-900">{row.updatedBy ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-900">
                      {ACTIVITY_AREA_LABELS[activityAreaOf(row.key)]}
                    </td>
                    <td className="px-4 py-3 break-words font-mono text-[13px] text-slate-900">
                      {row.key}
                    </td>
                    <td className="px-4 py-3 break-words text-slate-900">
                      <span className="text-slate-500">{displayActivityValue(row.oldValue)}</span>
                      {" → "}
                      <span className="font-medium">{displayActivityValue(row.newValue)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-6 space-y-4 md:hidden">
            {list.rows.map((row) => (
              <li
                key={row.id}
                data-testid="activity-row"
                className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
              >
                <p className="font-semibold text-slate-900">
                  {formatVnActivityTime(row.createdAt)}
                  {" · "}
                  {ACTIVITY_AREA_LABELS[activityAreaOf(row.key)]}
                </p>
                <p className="mt-1 break-words font-mono text-[13px] text-slate-900">{row.key}</p>
                <p className="mt-1 break-words text-slate-900">
                  <span className="text-slate-500">{displayActivityValue(row.oldValue)}</span>
                  {" → "}
                  <span className="font-medium">{displayActivityValue(row.newValue)}</span>
                </p>
                <p className="mt-1 text-slate-500">Người: {row.updatedBy ?? "—"}</p>
              </li>
            ))}
          </ul>

          {list.totalPages > 1 ? (
            <nav aria-label="Phân trang nhật ký" className="mt-6 flex items-center justify-center gap-3">
              {list.page > 1 ? (
                <Link
                  href={pageHref(base, list.page - 1)}
                  className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
                >
                  ← Trước
                </Link>
              ) : null}
              <span className="text-sm text-slate-500">
                Trang {list.page} / {list.totalPages}
              </span>
              {list.page < list.totalPages ? (
                <Link
                  href={pageHref(base, list.page + 1)}
                  className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100"
                >
                  Sau →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
