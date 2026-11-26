// Trường tải logo/favicon (Ngày 11 B3): xem trước + gỡ. Ảnh tải
// lên qua /api/admin/settings/upload rồi ghi URL TUYỆT ĐỐI vào
// input ẩn (form cài đặt lưu chuỗi URL đó). Chưa chọn ảnh thì
// hiển thị "Chưa có ảnh".
"use client";

import { useRef, useState } from "react";

export default function SettingsImageField({
  label,
  name,
  purpose,
  initialUrl,
  hint,
  previewClass,
}: {
  label: string;
  name: string;
  purpose: "logo" | "favicon";
  initialUrl: string;
  hint: string;
  previewClass: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("purpose", purpose);
      form.append("file", file);
      const res = await fetch("/api/admin/settings/upload", {
        method: "POST",
        body: form,
      });
      const data: { ok?: boolean; url?: string; error?: string } = await res.json();
      if (!res.ok || !data.ok || typeof data.url !== "string") {
        setError(data.error ?? "Không tải được ảnh, vui lòng thử lại.");
        return;
      }
      setUrl(data.url);
    } catch {
      setError("Không tải được ảnh, vui lòng thử lại.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <span className="block text-sm font-semibold text-slate-900">{label}</span>
      <input type="hidden" name={name} value={url} />
      <div className="mt-1 flex items-start gap-4">
        {url ? (
          <img
            src={url}
            alt={`Xem trước ${label.toLowerCase()}`}
            className={`${previewClass} rounded-lg border border-slate-200 bg-white object-contain`}
          />
        ) : (
          <span
            className={`${previewClass} flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 text-center text-xs font-medium text-slate-500`}
          >
            Chưa có ảnh
          </span>
        )}
        <div className="flex flex-col gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.svg"
            className="hidden"
            aria-label={`Chọn ${label.toLowerCase()}`}
            onChange={onFileChange}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {uploading ? "Đang tải…" : url ? "Đổi ảnh" : "Chọn ảnh"}
          </button>
          {url ? (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-danger transition-opacity hover:opacity-80"
            >
              Gỡ ảnh
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
      {error ? (
        <p role="alert" className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
