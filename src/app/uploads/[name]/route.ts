import { UPLOAD_NAME_RE, contentTypeForImage, readUpload } from "@/lib/admin/uploads";

// Phục vụ ảnh sản phẩm đã tải lên (Ngày 7 §4). Route CÔNG KHAI
// (ảnh sản phẩm phải xem được ở thẻ, chi tiết, Xem nhanh, giỏ...)
// nên KHÔNG gọi requireAdmin(). Tên file phải đúng mẫu do máy chủ
// sinh — tên lạ, path traversal, file không tồn tại → 404.

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const { name } = await params;
  if (!UPLOAD_NAME_RE.test(name)) {
    return new Response("Không tìm thấy.", { status: 404 });
  }
  const buf = await readUpload(name);
  if (!buf) {
    return new Response("Không tìm thấy.", { status: 404 });
  }
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": contentTypeForImage(name),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
