import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdminPages } from "@/lib/admin/pages";
import AdminIconButton, { PencilIcon } from "@/components/admin/AdminIconButton";
import DeletePageButton from "@/components/admin/DeletePageButton";
import TogglePageButton from "@/components/admin/TogglePageButton";
import { formatVnDateTime } from "@/lib/vn-datetime";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trang tĩnh",
  robots: { index: false, follow: false },
};

// Danh sách trang tĩnh quản trị (Ngày 13 B3 — theo mẫu Danh mục):
// từ 768 px là bảng, dưới 768 px là thẻ. Bật/tắt xuất bản không
// cần xác nhận, kèm toast Hoàn tác; xóa có hộp xác nhận.

export default async function AdminPagesPage() {
  await requireAdmin();
  const pages = await listAdminPages();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Trang tĩnh</h1>
        <Link
          href="/admin/pages/new"
          className="ml-auto flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          + Thêm trang
        </Link>
      </div>
      <p role="status" className="mt-2 text-sm text-slate-500">
        Tìm thấy {pages.length} trang
      </p>

      {pages.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Chưa có trang nào.
        </p>
      ) : (
        <>
          {/* Bảng từ 768 px (Ngày 14 B3): không tràn ngang — cột "Chân
              trang" gộp vào ô Trạng thái dạng nhãn nhỏ; tiêu đề/slug
              được xuống dòng. Kiểm scrollWidth == clientWidth ở
              1280/1024/768 px với 10 dòng, slug 60 ký tự, tiêu đề
              120 ký tự. */}
          <div className="mt-6 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th scope="col" className="w-[28%] px-4 py-3 font-semibold">Tiêu đề</th>
                  <th scope="col" className="w-[26%] px-4 py-3 font-semibold">Đường dẫn (slug)</th>
                  <th scope="col" className="w-[16%] px-4 py-3 font-semibold">Trạng thái</th>
                  <th scope="col" className="w-[14%] px-4 py-3 font-semibold">Cập nhật</th>
                  <th scope="col" className="w-[16%] px-4 py-3 font-semibold">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.id} data-testid="admin-page-row" data-page-id={p.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/70">
                    <td className="break-words px-4 py-3">
                      <Link href={`/admin/pages/${p.id}`} className="inline-flex min-h-11 items-center font-bold text-slate-900 hover:text-blue-600 hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="break-all px-4 py-3">
                      <Link href={`/${p.slug}`} className="text-slate-500 hover:text-blue-600 hover:underline">
                        /{p.slug}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {p.isPublished ? "Đã xuất bản" : "Nháp"}
                      {p.showInFooter ? (
                        <span className="ml-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                          Chân trang
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{formatVnDateTime(p.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AdminIconButton
                          href={`/admin/pages/${p.id}`}
                          label="Sửa trang"
                          icon={PencilIcon}
                          tooltipAlign="right"
                          className="border border-blue-600 bg-white text-blue-600 hover:bg-slate-100"
                        />
                        <TogglePageButton pageId={p.id} isPublished={p.isPublished} />
                        <DeletePageButton pageId={p.id} title={p.title} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Thẻ dưới 768 px */}
          <ul className="mt-6 space-y-4 md:hidden">
            {pages.map((p) => (
              <li key={p.id} data-testid="admin-page-row" data-page-id={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <Link href={`/admin/pages/${p.id}`} className="inline-flex min-h-11 items-center font-bold text-slate-900 hover:text-blue-600 hover:underline">
                  {p.title}
                </Link>
                <p className="mt-1 text-sm text-slate-500">
                  /{p.slug} · {p.isPublished ? "Đã xuất bản" : "Nháp"} ·{" "}
                  {p.showInFooter ? "Chân trang" : "Không ở chân trang"} ·{" "}
                  {formatVnDateTime(p.updatedAt)}
                </p>
                <div className="mt-3 flex gap-2">
                  <AdminIconButton
                    href={`/admin/pages/${p.id}`}
                    label="Sửa trang"
                    icon={PencilIcon}
                    className="border border-blue-600 bg-white text-blue-600 hover:bg-slate-100"
                  />
                  <TogglePageButton pageId={p.id} isPublished={p.isPublished} />
                  <DeletePageButton pageId={p.id} title={p.title} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
