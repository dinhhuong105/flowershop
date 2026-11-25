// Popup thêm/sửa sản phẩm (25/11 — QUY TẮC ĐỨNG: mọi màn thêm/sửa
// trong hệ thống đều mở dạng popup, không mở trang riêng).
// Dùng <dialog> gốc (giống hộp xác nhận Hủy đơn): Esc đóng, bấm
// nền mờ đóng, tiêu điểm tự vào popup khi mở, đóng thì trả tiêu
// điểm về nút đã bấm (hành vi gốc của dialog) rồi router.back()
// quay lại danh sách — back() giữ nguyên URL lọc hiện tại.
// Chỉ render khi điều hướng tới từ trong admin (intercepting
// route @modal); vào trực tiếp URL /admin/products/new (hoặc
// /[id]) thì hiện trang form đầy đủ, không phải popup này.
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export default function ProductModal({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    // showModal trên dialog đã mở sẽ ném lỗi — kiểm tra open để
    // an toàn (StrictMode gọi effect 2 lần ở dev).
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, []);

  function close() {
    // Đóng dialog trước (trả tiêu điểm về nút đã bấm), sự kiện
    // close sẽ gọi router.back() để về lại danh sách.
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      onClose={() => router.back()}
      onClick={(event) => {
        // Bấm ra ngoài nền mờ (target chính là <dialog>) thì đóng.
        if (event.target === dialogRef.current) close();
      }}
      className="m-auto w-[calc(100vw-2rem)] max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-[0_24px_64px_rgba(15,30,51,0.35)] backdrop:bg-black/40"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={close}
          aria-label="Đóng"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-slate-900 transition-colors hover:bg-slate-100"
        >
          ✕
        </button>
      </div>
      <div className="mt-4 max-h-[calc(90dvh-9rem)] overflow-y-auto pr-1">{children}</div>
    </dialog>
  );
}
