"use client";

// Nút "In" trên phiếu giao hàng: gọi window.print() của trình duyệt.
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print flex min-h-11 items-center justify-center rounded-[3px] bg-green-800 px-5 text-sm font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
    >
      In
    </button>
  );
}
