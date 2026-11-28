// Trình hướng dẫn nhập sản phẩm 6 bước (Ngày 20 C4, căn chỉnh B1
// bản sau Retry) — client. Bước 1 nguồn → 2 ánh xạ → 3 xem trước →
// 4 xác nhận quyền → 5 chạy theo khối → 6 kết quả. Dữ liệu lô lưu
// ở DB (import_rows + mappingJson) nên tải lại trang vẫn tiếp tục
// được từ bước đang dở (bước suy ra từ trạng thái lô: PREVIEW +
// chưa lưu ánh xạ → 2; đã lưu ánh xạ + chưa xác nhận quyền → 3;
// đang chạy → 5; xong/hoàn tác/lỗi → 6).
// Mọi giá trị hiển thị đều là text (React escape mặc định) —
// không chèn HTML trực tiếp với dữ liệu nhập.

"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { formatVND } from "@/lib/format";
import type {
  ImportBatchView,
  ImportPreview,
} from "@/lib/admin/import-batches";
import type { FieldMapping } from "@/lib/import/parse";
import { buildErrorsCsv } from "@/lib/import/parse";

const FIELD_LABELS: Array<{ field: keyof FieldMapping; label: string; required: boolean }> = [
  { field: "externalId", label: "Mã ngoài (externalId)", required: true },
  { field: "sku", label: "SKU", required: false },
  { field: "name", label: "Tên sản phẩm", required: true },
  { field: "description", label: "Mô tả", required: false },
  { field: "price", label: "Giá (VND)", required: true },
  { field: "salePrice", label: "Giá khuyến mãi", required: false },
  { field: "categoryName", label: "Danh mục", required: false },
  { field: "imageUrls", label: "Ảnh (URL, phân tách |)", required: false },
  { field: "stock", label: "Tồn kho", required: false },
];
import {
  cancelImportAction,
  confirmRightsAction,
  getImportBatchForPage,
  getImportPreviewForPage,
  runImportChunkAction,
  saveMappingAction,
  startImportAction,
  undoImportBatchAction,
  type ImportActionState,
  type ImportStartState,
} from "@/app/admin/products/import/actions";

const BATCH_STATUS_LABELS: Record<ImportBatchView["status"], string> = {
  PREVIEW: "Chờ xử lý",
  RUNNING: "Đang chạy",
  DONE: "Xong",
  FAILED: "Lỗi",
  ROLLED_BACK: "Đã hoàn tác",
};

function initialStep(batch: ImportBatchView | null): number {
  if (!batch) return 1;
  if (batch.status === "RUNNING") return 5;
  if (batch.status === "DONE" || batch.status === "ROLLED_BACK" || batch.status === "FAILED") return 6;
  if (!batch.payload.mappingSaved) return 2;
  if (!batch.rightsConfirmed) return 3;
  return 5;
}

function sourceColumns(batch: ImportBatchView): string[] {
  const keys = new Set<string>();
  for (const row of batch.payload.rows.slice(0, 20)) {
    for (const k of Object.keys(row.raw)) keys.add(k);
  }
  return [...keys];
}

function distinctValuesForColumn(
  batch: ImportBatchView,
  column: string | null,
): string[] {
  if (!column) return [];
  const values = new Set<string>();
  for (const row of batch.payload.rows) {
    const v = row.raw[column];
    if (typeof v === "string" && v.trim() !== "") values.add(v.trim());
    else if (typeof v === "number") values.add(String(v));
  }
  return [...values].sort();
}

export default function ImportWizard({
  initialBatch,
  batches,
  categories,
  totpEnabled,
}: {
  initialBatch: ImportBatchView | null;
  batches: ImportBatchView[];
  categories: Array<{ id: number; name: string }>;
  totpEnabled: boolean;
}) {
  const [batch, setBatch] = useState<ImportBatchView | null>(initialBatch);
  const [step, setStep] = useState<number>(() => initialStep(initialBatch));
  // Bảng "Các lô nhập gần đây" dùng prop `batches` (lấy lúc tải
  // trang) nên sau khi chạy xong vẫn hiện lô cũ là "Chờ xử lý
  // 0/0/0/0" trong khi bước 6 đã nói "Xong, tạo 25" — hợp nhất
  // state `batch` mới nhất vào danh sách hiển thị (thay dòng cùng
  // id, hoặc chèn lên đầu nếu lô mới tạo sau khi tải trang).
  const displayBatches: ImportBatchView[] = batch
    ? batches.some((b) => b.id === batch.id)
      ? batches.map((b) => (b.id === batch.id ? batch : b))
      : [batch, ...batches]
    : batches;
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [runState, setRunState] = useState<{
    processed: number;
    total: number;
    error: string | null;
    running: boolean;
  } | null>(null);
  const stopRef = useRef(false);
  const [undoMessage, setUndoMessage] = useState<string | null>(null);

  // Bước 1.
  const [startState, startDispatch] = useActionState<ImportStartState, FormData>(
    startImportAction,
    { ok: false, batchId: null, error: null },
  );
  const [kind, setKind] = useState<"file" | "feed">("file");

  // Chỉ xử lý kết quả tạo lô MỘT LẦN cho mỗi batchId. Trước đây effect
  // này phụ thuộc cả `batches`: sau khi Lưu ánh xạ, `revalidatePath`
  // làm mới prop `batches` → effect chạy lại → setStep(2) kéo wizard
  // từ bước 3 về bước 2 (lỗi bắt được bằng probe C8: POST lưu trả 200
  // nhưng giao diện kẹt ở bước 2).
  const handledStartBatch = useRef<number | null>(null);
  useEffect(() => {
    if (!startState.ok || startState.batchId === null) return;
    if (handledStartBatch.current === startState.batchId) return;
    handledStartBatch.current = startState.batchId;
    const found = batches.find((b) => b.id === startState.batchId);
    if (found) {
      setBatch(found);
      setStep(2);
    } else {
      // Lô mới chưa có trong danh sách prop — tải lại trang ở bước 2.
      window.location.href = `/admin/products/import?batch=${startState.batchId}`;
    }
  }, [startState, batches]);

  // Bước 2.
  const columns = useMemo(() => (batch ? sourceColumns(batch) : []), [batch]);
  const [mapping, setMapping] = useState<FieldMapping>(() => batch?.payload.mapping ?? {});
  const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>(
    () => {
      const out: Record<string, string> = {};
      if (batch) {
        for (const [k, v] of Object.entries(batch.payload.categoryMapping)) {
          out[k] = v === "skip" ? "skip" : String(v);
        }
      }
      return out;
    },
  );
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>(
    () => (batch?.payload.defaultCategoryId ? String(batch.payload.defaultCategoryId) : ""),
  );
  // Tùy chọn giá (B3): hệ số nhân 0,1–10 (2 chữ số thập phân) +
  // làm tròn; đồng bộ theo lô như ánh xạ.
  const [multiplier, setMultiplier] = useState<string>(
    () => String(batch?.payload.priceOptions.multiplier ?? 1),
  );
  const [rounding, setRounding] = useState<string>(
    () => batch?.payload.priceOptions.rounding ?? "none",
  );
  // Đồng bộ form ánh xạ theo lô đang chọn. useState khởi tạo chỉ
  // chạy 1 lần lúc mount (khi batch còn null ở bước 1) nên sau khi
  // tạo lô ở bước 1, form bước 2 hiện toàn "— Không dùng —" dù
  // payload.mapping đã tự khớp sẵn (lỗi bắt được bằng ảnh probe C8).
  // Chỉ đồng bộ khi đổi SANG LÔ KHÁC (theo id) để không ghi đè
  // chỉnh sửa của người dùng khi batch object đổi identity.
  const syncedMappingBatch = useRef<number | null>(null);
  useEffect(() => {
    if (!batch || syncedMappingBatch.current === batch.id) return;
    syncedMappingBatch.current = batch.id;
    setMapping(batch.payload.mapping ?? {});
    const cm: Record<string, string> = {};
    for (const [k, v] of Object.entries(batch.payload.categoryMapping)) {
      cm[k] = v === "skip" ? "skip" : String(v);
    }
    setCategoryMapping(cm);
    setDefaultCategoryId(
      batch.payload.defaultCategoryId ? String(batch.payload.defaultCategoryId) : "",
    );
    setMultiplier(String(batch.payload.priceOptions.multiplier ?? 1));
    setRounding(batch.payload.priceOptions.rounding ?? "none");
  }, [batch]);
  const [mappingState, mappingDispatch] = useActionState<ImportActionState, FormData>(
    saveMappingAction,
    { ok: false, error: null, message: null },
  );
  const categoryColumn = mapping.categoryName ?? null;
  const distinctValues = useMemo(
    () => (batch ? distinctValuesForColumn(batch, categoryColumn) : []),
    [batch, categoryColumn],
  );

  useEffect(() => {
    if (mappingState.ok) setStep(3);
  }, [mappingState]);

  function submitMapping() {
    if (!batch) return;
    const fd = new FormData();
    fd.set("batchId", String(batch.id));
    fd.set("mapping", JSON.stringify(mapping));
    const cm: Record<string, number | "skip"> = {};
    for (const v of distinctValues) {
      const sel = categoryMapping[v];
      if (sel === undefined || sel === "") continue;
      cm[v] = sel === "skip" ? "skip" : Number(sel);
    }
    fd.set("categoryMapping", JSON.stringify(cm));
    fd.set("defaultCategoryId", defaultCategoryId);
    fd.set(
      "priceOptions",
      JSON.stringify({ multiplier: Number(multiplier), rounding }),
    );
    mappingDispatch(fd);
  }

  /** Tải danh sách lỗi/kết quả dạng CSV (đã vô hiệu công thức, B6). */
  function downloadErrorsCsv(
    filename: string,
    items: Array<{ line: number; reason: string }>,
  ) {
    const blob = new Blob(["﻿" + buildErrorsCsv(items)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Bước 3: xem trước (tính lại từ DB mỗi lần vào bước).
  useEffect(() => {
    if (step !== 3 || !batch) return;
    let alive = true;
    setPreviewLoading(true);
    setPreview(null);
    setPreviewError(null);
    getImportPreviewForPage(batch.id)
      .then((p) => {
        if (alive) setPreview(p);
      })
      .catch(() => {
        if (alive) setPreviewError("Không tính được xem trước — thử tải lại trang.");
      })
      .finally(() => {
        if (alive) setPreviewLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [step, batch]);

  // Bước 4.
  const [confirmState, confirmDispatch] = useActionState<ImportActionState, FormData>(
    confirmRightsAction,
    { ok: false, error: null, message: null },
  );
  useEffect(() => {
    if (confirmState.ok) setStep(5);
  }, [confirmState]);

  // Bước 5: chạy theo khối.
  async function runLoop() {
    if (!batch) return;
    stopRef.current = false;
    setRunState({
      processed: batch.payload.processed,
      total: batch.rowsTotal,
      error: null,
      running: true,
    });
    let current = batch.payload.processed;
    for (;;) {
      if (stopRef.current) {
        setRunState((s) => (s ? { ...s, running: false, error: "Đã yêu cầu dừng — lô sẽ dừng sau khối hiện tại." } : s));
        break;
      }
      if (current >= batch.rowsTotal) break;
      const res = await runImportChunkAction(batch.id);
      if (!res.ok) {
        setRunState((s) => (s ? { ...s, running: false, error: res.error } : s));
        break;
      }
      current = res.processed;
      setRunState({ processed: res.processed, total: res.total, error: null, running: !res.done });
      setBatch((b) =>
        b
          ? {
              ...b,
              created: res.created,
              updated: res.updated,
              skipped: res.skipped,
              failed: res.errors,
              status: res.done ? "DONE" : "RUNNING",
              payload: { ...b.payload, processed: res.processed },
            }
          : b,
      );
      if (res.done) {
        // Tải lại lô từ server để bước 6 hiện đúng dữ liệu mới nhất
        // (danh sách lỗi lúc chạy, ghi chú) — state cục bộ chỉ cập
        // nhật bộ đếm + processed, không có runErrors.
        const fresh = await getImportBatchForPage(batch.id);
        if (fresh) setBatch(fresh);
        setStep(6);
        break;
      }
    }
  }

  async function cancelRun() {
    if (!batch) return;
    stopRef.current = true;
    await cancelImportAction(batch.id);
  }

  // Bước 6: hoàn tác.
  const [undoState, undoDispatch] = useActionState<ImportActionState, FormData>(
    undoImportBatchAction,
    { ok: false, error: null, message: null },
  );
  useEffect(() => {
    if (undoState.ok && undoState.message) setUndoMessage(undoState.message);
  }, [undoState]);

  const steps = ["Nguồn", "Ánh xạ", "Xem trước", "Xác nhận", "Chạy", "Kết quả"];

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2" aria-label="Các bước nhập">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              step === i + 1
                ? "bg-blue-600 text-white"
                : step > i + 1
                  ? "bg-green-100 text-green-800"
                  : "bg-slate-100 text-slate-600"
            }`}
            aria-current={step === i + 1 ? "step" : undefined}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <form action={startDispatch} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Bước 1 — Nguồn dữ liệu</h2>
          {startState.error && (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
              {startState.error}
            </p>
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Loại nguồn</legend>
            <label className="mr-6 inline-flex items-center gap-2 text-sm">
              <input type="radio" name="kind" value="file" checked={kind === "file"} onChange={() => setKind("file")} />
              Tệp CSV/JSON (tối đa 5 MB)
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="radio" name="kind" value="feed" checked={kind === "feed"} onChange={() => setKind("feed")} />
              Feed qua URL (http/https)
            </label>
          </fieldset>
          {kind === "file" ? (
            <div>
              <label htmlFor="imp-file" className="block text-sm font-semibold">Tệp CSV hoặc JSON</label>
              <input id="imp-file" name="file" type="file" accept=".csv,.json,text/csv,application/json" className="mt-1 block w-full text-sm" required />
              <p className="mt-1 text-sm text-slate-500">Tối đa 2.000 dòng. CSV: UTF-8, dấu phân tách , ; hoặc tab. JSON: mảng gốc hoặc khóa items/products/data.</p>
            </div>
          ) : (
            <div>
              <label htmlFor="imp-feedUrl" className="block text-sm font-semibold">Địa chỉ feed</label>
              <input id="imp-feedUrl" name="feedUrl" type="url" placeholder="https://..." className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
              <p className="mt-1 text-sm text-slate-500">Chỉ http/https cổng 80/443, tối đa 5 MB. Địa chỉ nội bộ (localhost, IP riêng, 169.254.169.254…) bị chặn.</p>
            </div>
          )}
          <div>
            <label htmlFor="imp-sourceName" className="block text-sm font-semibold">Tên nguồn (bắt buộc, 3–80 ký tự)</label>
            <input id="imp-sourceName" name="sourceName" type="text" minLength={3} maxLength={80} placeholder="Ví dụ: NhaCungCapA-2026-11" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
            <p className="mt-1 text-sm text-slate-500">Tên nguồn + mã ngoài là khóa để lần nhập sau cập nhật đúng sản phẩm. Đặt tên riêng cho từng nhà cung cấp.</p>
          </div>
          {totpEnabled && (
            <div>
              <label htmlFor="imp-totpCode" className="block text-sm font-semibold">Mã xác thực 2FA (đang bật)</label>
              <input id="imp-totpCode" name="totpCode" type="text" inputMode="numeric" autoComplete="one-time-code" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
            </div>
          )}
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
            Đọc dữ liệu →
          </button>
        </form>
      )}

      {step === 2 && batch && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Bước 2 — Ánh xạ cột</h2>
          <p className="text-sm text-slate-600">
            Lô “{batch.sourceName}” — {batch.rowsTotal + batch.payload.errors.length} dòng đã đọc
            {batch.payload.errors.length > 0 ? `, ${batch.payload.errors.length} lỗi đọc (xem ở bước xem trước)` : ""}.
            Chỉnh cột nguồn cho từng trường; cột đã tự khớp theo tên thường gặp.
          </p>
          {mappingState.error && (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
              {mappingState.error}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELD_LABELS.map(({ field, label, required }) => (
              <div key={field}>
                <label htmlFor={`map-${field}`} className="block text-sm font-semibold">
                  {label} {required && <span className="text-danger">*</span>}
                </label>
                <select
                  id={`map-${field}`}
                  value={mapping[field] ?? ""}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, [field]: e.target.value === "" ? null : e.target.value }))
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">— Không dùng —</option>
                  {columns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-sm font-semibold">Ánh xạ giá trị danh mục</h3>
            <p className="text-sm text-slate-500">Mỗi giá trị danh mục trong nguồn phải chọn một danh mục có sẵn, hoặc “Bỏ qua các dòng này”. Không tự tạo danh mục mới.</p>
            {distinctValues.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Nguồn không có cột danh mục — chọn danh mục mặc định bên dưới.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {distinctValues.map((v) => (
                  <div key={v} className="flex flex-wrap items-center gap-2">
                    <span className="min-w-40 rounded bg-slate-100 px-2 py-1 text-sm font-medium">{v}</span>
                    <span aria-hidden="true">→</span>
                    <select
                      aria-label={`Danh mục cho ${v}`}
                      value={categoryMapping[v] ?? ""}
                      onChange={(e) => setCategoryMapping((m) => ({ ...m, [v]: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">— Chưa chọn —</option>
                      <option value="skip">Bỏ qua các dòng này</option>
                      {categories.map((c) => (
                        <option key={c.id} value={String(c.id)}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="map-defaultCategory" className="block text-sm font-semibold">
              Danh mục mặc định {!categoryColumn && <span className="text-danger">*</span>}
            </label>
            <select
              id="map-defaultCategory"
              value={defaultCategoryId}
              onChange={(e) => setDefaultCategoryId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Không dùng —</option>
              {categories.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
            <p className="mt-1 text-sm text-slate-500">Bắt buộc khi nguồn không có cột danh mục; còn không thì dùng cho các dòng để trống danh mục.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Tùy chọn giá</h3>
            <p className="text-sm text-slate-500">Hệ số nhân áp lên giá và giá khuyến mãi trước khi làm tròn; giá sau chuyển đổi phải là số nguyên VND từ 1 đến 1.000.000.000 ₫, giá khuyến mãi nhỏ hơn giá gốc.</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="map-multiplier" className="block text-sm font-semibold">Hệ số nhân (0,1–10)</label>
                <input
                  id="map-multiplier"
                  type="number"
                  min={0.1}
                  max={10}
                  step={0.01}
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="map-rounding" className="block text-sm font-semibold">Làm tròn</label>
                <select
                  id="map-rounding"
                  value={rounding}
                  onChange={(e) => setRounding(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="none">Không làm tròn</option>
                  <option value="1000">1.000 ₫</option>
                  <option value="10000">10.000 ₫</option>
                </select>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={submitMapping}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            Lưu ánh xạ → xem trước
          </button>
        </div>
      )}

      {step === 3 && batch && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Bước 3 — Xem trước (chưa ghi gì vào DB)</h2>
          {previewLoading && <p className="text-sm text-slate-500">Đang tính xem trước…</p>}
          {previewError && (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
              {previewError}
            </p>
          )}
          {preview && (
            <>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-xs text-slate-500">Tổng dòng</dt><dd className="text-lg font-bold">{preview.total}</dd></div>
                <div className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-xs text-slate-500">Hợp lệ</dt><dd className="text-lg font-bold">{preview.valid}</dd></div>
                <div className="rounded-lg bg-green-50 px-3 py-2"><dt className="text-xs text-green-700">Tạo mới</dt><dd className="text-lg font-bold text-green-800">{preview.toCreate}</dd></div>
                <div className="rounded-lg bg-blue-50 px-3 py-2"><dt className="text-xs text-blue-700">Cập nhật (đã tồn tại)</dt><dd className="text-lg font-bold text-blue-800">{preview.toUpdate}</dd></div>
                <div className="rounded-lg bg-amber-50 px-3 py-2"><dt className="text-xs text-amber-700">Bỏ qua</dt><dd className="text-lg font-bold text-amber-800">{preview.toSkip}</dd></div>
                <div className="rounded-lg bg-red-50 px-3 py-2"><dt className="text-xs text-red-700">Lỗi</dt><dd className="text-lg font-bold text-red-800">{preview.errorTotal}</dd></div>
              </dl>
              {Object.keys(preview.skipReasons).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold">Lý do bỏ qua</h3>
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {Object.entries(preview.skipReasons).map(([reason, n]) => (
                      <li key={reason}>{reason} — {n} dòng</li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.errors.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold">Lỗi (tối đa 50 dòng)</h3>
                  <ul className="mt-1 max-h-60 space-y-1 overflow-auto rounded-lg bg-red-50 p-3 text-sm">
                    {preview.errors.map((e, i) => (
                      <li key={i}>Dòng {e.line}: {e.reason}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => downloadErrorsCsv(`loi-xem-truoc-lo-${batch.id}.csv`, preview.errors)}
                    className="mt-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50"
                  >
                    Tải CSV lỗi
                  </button>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold">20 dòng đầu</h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-2 py-2">Dòng</th>
                        <th className="px-2 py-2">Tên</th>
                        <th className="px-2 py-2">Giá</th>
                        <th className="px-2 py-2">Danh mục</th>
                        <th className="px-2 py-2">Kết quả</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r) => (
                        <tr key={r.line} className="border-b">
                          <td className="px-2 py-2">{r.line}</td>
                          <td className="px-2 py-2">{r.name}</td>
                          <td className="px-2 py-2">{formatVND(r.price)}</td>
                          <td className="px-2 py-2">{r.categoryName ?? "—"}</td>
                          <td className="px-2 py-2">
                            {r.disposition === "create" && `Tạo mới${r.slug ? ` (${r.slug})` : ""}`}
                            {r.disposition === "update" && (r.priceOnly ? "Cập nhật (chỉ giá)" : "Cập nhật")}
                            {r.disposition === "skip" && `Bỏ qua: ${r.reason ?? ""}`}
                            {r.disposition === "error" && `Lỗi: ${r.reason ?? ""}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
              >
                Tiếp tục xác nhận →
              </button>
            </>
          )}
        </div>
      )}

      {step === 4 && batch && (
        <form action={confirmDispatch} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Bước 4 — Xác nhận quyền sử dụng</h2>
          {confirmState.error && (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
              {confirmState.error}
            </p>
          )}
          <input type="hidden" name="batchId" value={batch.id} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="rightsConfirmed" className="mt-0.5 h-5 w-5 accent-blue-600" required />
            <span>Tôi xác nhận shop có quyền sử dụng dữ liệu và hình ảnh của nguồn này (ví dụ có thỏa thuận bằng văn bản hoặc đây là dữ liệu của chính shop).</span>
          </label>
          <div>
            <label htmlFor="imp-retype" className="block text-sm font-semibold">Gõ lại tên nguồn để xác nhận: {batch.sourceName}</label>
            <input id="imp-retype" name="retypeSourceName" type="text" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
          </div>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
            Xác nhận → chạy nhập
          </button>
        </form>
      )}

      {step === 5 && batch && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Bước 5 — Chạy nhập</h2>
          <p className="text-sm text-slate-600">
            Lô “{batch.sourceName}” — chạy theo khối ~10 dòng/lần gọi. Tải lại trang vẫn tiếp tục được
            (đã nhập {batch.payload.processed}/{batch.rowsTotal} dòng).
          </p>
          {runState?.error && (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
              {runState.error}
            </p>
          )}
          <div>
            <div className="flex justify-between text-sm">
              <span>Đã xử lý {runState?.processed ?? batch.payload.processed}/{batch.rowsTotal} dòng</span>
              <span>Tạo {batch.created} · Cập nhật {batch.updated} · Bỏ qua {batch.skipped} · Lỗi {batch.failed}</span>
            </div>
            <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${batch.rowsTotal === 0 ? 0 : Math.round(((runState?.processed ?? batch.payload.processed) / batch.rowsTotal) * 100)}%` }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={runLoop}
              disabled={runState?.running === true}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {batch.payload.processed > 0 ? "Tiếp tục chạy" : "Bắt đầu chạy"}
            </button>
            <button
              type="button"
              onClick={cancelRun}
              disabled={runState?.running !== true}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-40"
            >
              Hủy giữa chừng
            </button>
          </div>
        </div>
      )}

      {step === 6 && batch && (
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Bước 6 — Kết quả</h2>
          {undoMessage && (
            <p role="status" className="rounded-lg border border-green-800/40 bg-green-800/5 px-4 py-3 text-sm font-medium text-green-800">
              {undoMessage}
            </p>
          )}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-green-50 px-3 py-2"><dt className="text-xs text-green-700">Tạo mới</dt><dd className="text-lg font-bold text-green-800">{batch.created}</dd></div>
            <div className="rounded-lg bg-blue-50 px-3 py-2"><dt className="text-xs text-blue-700">Cập nhật</dt><dd className="text-lg font-bold text-blue-800">{batch.updated}</dd></div>
            <div className="rounded-lg bg-amber-50 px-3 py-2"><dt className="text-xs text-amber-700">Bỏ qua</dt><dd className="text-lg font-bold text-amber-800">{batch.skipped}</dd></div>
            <div className="rounded-lg bg-red-50 px-3 py-2"><dt className="text-xs text-red-700">Lỗi</dt><dd className="text-lg font-bold text-red-800">{batch.failed}</dd></div>
          </dl>
          <p className="text-sm text-slate-600">
            Trạng thái: {BATCH_STATUS_LABELS[batch.status]}
            {batch.payload.errors.length > 0 ? ` · Lỗi đọc dữ liệu ban đầu: ${batch.payload.errors.length} dòng` : ""}
            {batch.notes ? ` · ${batch.notes}` : ""}
          </p>
          {batch.payload.runErrors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold">Lỗi lúc chạy (tối đa 50 dòng)</h3>
              <ul className="mt-1 max-h-60 space-y-1 overflow-auto rounded-lg bg-red-50 p-3 text-sm">
                {batch.payload.runErrors.slice(0, 50).map((e, i) => (
                  <li key={i}>Dòng {e.line}: {e.reason}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => downloadErrorsCsv(`loi-chay-lo-${batch.id}.csv`, batch.payload.runErrors)}
                className="mt-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50"
              >
                Tải CSV lỗi
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/products?source=review"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              Xem hàng chờ duyệt
            </Link>
            {batch.status === "DONE" && (
              <form action={undoDispatch} className="inline-flex flex-wrap items-center gap-2">
                <input type="hidden" name="batchId" value={batch.id} />
                {totpEnabled && (
                  <input
                    name="totpCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Mã 2FA"
                    aria-label="Mã xác thực 2FA để hoàn tác"
                    className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                )}
                <button
                  type="submit"
                  className="rounded-lg border border-danger px-4 py-2 text-sm font-bold text-danger hover:bg-danger/5"
                  onClick={(e) => {
                    if (!window.confirm("Hoàn tác lô này? Mọi sản phẩm của lô còn chờ duyệt (chưa có đơn) sẽ bị xóa. Bản ghi lô vẫn còn để đối chiếu.")) {
                      e.preventDefault();
                    }
                  }}
                >
                  Hoàn tác lô
                </button>
              </form>
            )}
            {undoState.error && (
              <p role="alert" className="w-full rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
                {undoState.error}
              </p>
            )}
          </div>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Các lô nhập gần đây</h2>
        {displayBatches.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Chưa có lô nhập nào.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-2">Tên nguồn</th>
                  <th className="px-2 py-2">Loại</th>
                  <th className="px-2 py-2">Trạng thái</th>
                  <th className="px-2 py-2">Tạo/Cập nhật/Bỏ qua/Lỗi</th>
                  <th className="px-2 py-2">Ngày tạo</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {displayBatches.map((b) => (
                  <tr key={b.id} className="border-b">
                    <td className="px-2 py-2 font-medium">{b.sourceName}</td>
                    <td className="px-2 py-2">{b.kind === "file" ? `Tệp (${b.fileName ?? ""})` : "Feed"}</td>
                    <td className="px-2 py-2">{BATCH_STATUS_LABELS[b.status]}</td>
                    <td className="px-2 py-2">{b.created}/{b.updated}/{b.skipped}/{b.failed}</td>
                    <td className="px-2 py-2">{b.createdAt.toLocaleString("vi-VN")}</td>
                    <td className="px-2 py-2">
                      <Link href={`/admin/products/import?batch=${b.id}`} className="font-medium text-blue-700 hover:underline">
                        Mở
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
