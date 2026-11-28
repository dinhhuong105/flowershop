import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { listAdminNews, newsDisplayDate, newsStatusLabel } from "@/lib/admin/news";
import AdminIconButton, { PencilIcon } from "@/components/admin/AdminIconButton";
import DeleteNewsButton from "@/components/admin/DeleteNewsButton";
import NewsFilterBar from "@/components/admin/NewsFilterBar";
import ToggleNewsButton from "@/components/admin/ToggleNewsButton";
import { formatVnDateTime } from "@/lib/vn-datetime";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tin tức",
  robots: { index: false, follow: false },
};

// Danh sách tin tức quản trị (Ngày 18 — theo mẫu Trang tĩnh):
// từ 768 px là bảng, dưới 768 px là thẻ. Lọc theo trạng thái +
// tìm theo tiêu đề/slug. Bật/tắt xuất bản không cần xác nhận, kèm
// toast Hoàn tác; xóa có hộp xác nhận. Ngày đăng hiển thị =
// publishedAt ?? createdAt.

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const status =
    params.status === "published" ||
    params.status === "draft" ||
    params.status === "scheduled"
      ? params.status
      : "all";
  const q = (params.q ?? "").trim();
  const articles = await listAdminNews({ status, q });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Tin tức</h1>
        <Link
          href="/admin/news/new"
          className="ml-auto flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          + Thêm bài
        </Link>
      </div>

      <Suspense>
        <NewsFilterBar status={status} q={q} />
      </Suspense>

      <p role="status" className="mt-4 text-sm text-slate-500">
        Tìm thấy {articles.length} bài
      </p>

      {articles.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Chưa có bài tin tức nào.
        </p>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th scope="col" className="w-[26%] px-4 py-3 font-semibold">Tiêu đề</th>
                  <th scope="col" className="w-[22%] px-4 py-3 font-semibold">Đường dẫn (slug)</th>
                  <th scope="col" className="w-[14%] px-4 py-3 font-semibold">Tác giả</th>
                  <th scope="col" className="w-[12%] px-4 py-3 font-semibold">Trạng thái</th>
                  <th scope="col" className="w-[12%] px-4 py-3 font-semibold">Ngày đăng</th>
                  <th scope="col" className="w-[14%] px-4 py-3 font-semibold">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.id} data-testid="admin-news-row" data-news-id={a.id} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/70">
                    <td className="break-words px-4 py-3">
                      <Link href={`/admin/news/${a.id}`} className="inline-flex min-h-11 items-center font-bold text-slate-900 hover:text-blue-600 hover:underline">
                        {a.title}
                      </Link>
                    </td>
                    <td className="break-all px-4 py-3">
                      <Link href={`/tin-tuc/${a.slug}`} className="text-slate-500 hover:text-blue-600 hover:underline">
                        /tin-tuc/{a.slug}
                      </Link>
                    </td>
                    <td className="break-words px-4 py-3">{a.author === "" ? "—" : a.author}</td>
                    <td className="px-4 py-3">
                      {newsStatusLabel(a)}
                    </td>
                    <td className="px-4 py-3">{formatVnDateTime(newsDisplayDate(a))}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <AdminIconButton
                          href={`/admin/news/${a.id}`}
                          label="Sửa bài"
                          icon={PencilIcon}
                          tooltipAlign="right"
                          className="border border-blue-600 bg-white text-blue-600 hover:bg-slate-100"
                        />
                        <ToggleNewsButton newsId={a.id} isPublished={a.isPublished} />
                        <DeleteNewsButton newsId={a.id} title={a.title} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Thẻ dưới 768 px */}
          <ul className="mt-6 space-y-4 md:hidden">
            {articles.map((a) => (
              <li key={a.id} data-testid="admin-news-row" data-news-id={a.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <Link href={`/admin/news/${a.id}`} className="inline-flex min-h-11 items-center font-bold text-slate-900 hover:text-blue-600 hover:underline">
                  {a.title}
                </Link>
                <p className="mt-1 text-sm text-slate-500">
                  /tin-tuc/{a.slug} · {newsStatusLabel(a)} ·{" "}
                  {a.author === "" ? "Không có tác giả" : a.author} ·{" "}
                  {formatVnDateTime(newsDisplayDate(a))}
                </p>
                <div className="mt-3 flex gap-2">
                  <AdminIconButton
                    href={`/admin/news/${a.id}`}
                    label="Sửa bài"
                    icon={PencilIcon}
                    className="border border-blue-600 bg-white text-blue-600 hover:bg-slate-100"
                  />
                  <ToggleNewsButton newsId={a.id} isPublished={a.isPublished} />
                  <DeleteNewsButton newsId={a.id} title={a.title} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
