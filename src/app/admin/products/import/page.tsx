import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { isTotpLoginRequired } from "@/lib/admin/totp-store";
import { listAdminCategories } from "@/lib/admin/products";
import {
  getImportBatch,
  listImportBatches,
} from "@/lib/admin/import-batches";
import ImportWizard from "@/components/admin/ImportWizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nhập sản phẩm",
  robots: { index: false, follow: false },
};

// Nhập sản phẩm (Ngày 20 C4): trình hướng dẫn 6 bước. Chỉ admin
// (requireAdmin); tạo lô + hoàn tác cần mã TOTP khi 2FA bật (xem
// actions.ts). KHÔNG bật bộ nhập trên production nếu chưa PASS
// toàn bộ C7 — xem báo cáo Ngày 20.
export default async function AdminImportPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const batchId = Number(params.batch ?? "");
  const batch =
    Number.isSafeInteger(batchId) && batchId > 0
      ? await getImportBatch(batchId)
      : null;
  const [batches, categories, totpEnabled] = await Promise.all([
    listImportBatches(10),
    listAdminCategories(),
    isTotpLoginRequired(),
  ]);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-slate-900">Nhập sản phẩm</h1>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Nhập từ tệp CSV/JSON hoặc feed qua URL. Hàng nhập luôn chờ duyệt và
        ẩn khỏi shop cho tới khi duyệt — không bao giờ ghi đè sản phẩm hệ thống.
      </p>
      <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
        Không nhập dữ liệu hoặc ảnh của website khác khi chưa có thỏa thuận bằng văn bản.
      </p>
      <div className="mt-6">
        <ImportWizard
          initialBatch={batch}
          batches={batches}
          categories={categories}
          totpEnabled={totpEnabled}
        />
      </div>
    </div>
  );
}
