import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-ink">Không tìm thấy trang</h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
        Trang bạn tìm không còn ở đây hoặc chưa được tạo. Bạn có thể quay lại
        trang chủ để xem hoa tươi và giỏ quà.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
