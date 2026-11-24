import { NextResponse } from "next/server";
import { AdminNotConfiguredError, requireAdmin } from "@/lib/admin/auth";
import {
  MAX_IMAGES_PER_PRODUCT,
  MAX_UPLOAD_BYTES,
  checkUploadContentLength,
  detectImageType,
  saveUpload,
} from "@/lib/admin/uploads";
import { db } from "@/lib/db";

// Tải ảnh lên (Ngày 7 §4): POST multipart (productId tùy chọn —
// form tạo mới chưa có sản phẩm — và file). Route chỉ lưu file và
// trả URL; biểu mẫu sản phẩm mới là nơi lưu danh sách ảnh vào DB
// (xem "Khác đặc tả" báo cáo Ngày 7).
//
// Thứ tự kiểm tra: requireAdmin → Origin → Content-Length → file
// (magic bytes, kích thước) → sản phẩm (nếu có productId).

export const dynamic = "force-dynamic";

// redirect() trong requireAdmin() ném lỗi có digest NEXT_REDIRECT —
// bắt để trả 401 thay vì redirect (route handler không nên redirect).
function isRedirectError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (error as { digest: string }).digest.startsWith("NEXT_NOT_FOUND"))
  );
}

export async function POST(request: Request): Promise<Response> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminNotConfiguredError) {
      return NextResponse.json(
        { ok: false, error: "Chưa cấu hình quản trị." },
        { status: 503 },
      );
    }
    if (isRedirectError(error)) {
      return NextResponse.json({ ok: false, error: "Chưa đăng nhập." }, { status: 401 });
    }
    throw error;
  }

  // Origin phải trùng Host (chống CSRF) — thiếu hoặc lạ → 403.
  // LƯU Ý: KHÔNG dùng new URL(request.url).host — máy chủ standalone
  // dựng request.url từ địa chỉ listen (0.0.0.0:3000) nên không bao
  // giờ trùng Origin; header Host mới là host trình duyệt thật dùng.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin) {
    return NextResponse.json({ ok: false, error: "Thiếu Origin." }, { status: 403 });
  }
  if (!host) {
    return NextResponse.json({ ok: false, error: "Thiếu Host." }, { status: 403 });
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ ok: false, error: "Origin không hợp lệ." }, { status: 403 });
  }
  if (originHost !== host) {
    return NextResponse.json({ ok: false, error: "Origin không hợp lệ." }, { status: 403 });
  }

  // K-2 (Ngày 8): thiếu hoặc không phải số → 411 (không đọc body
  // chunked vào RAM); > 5,5 MB → 413. Kiểm trước khi đọc body.
  const lengthCheck = checkUploadContentLength(
    request.headers.get("content-length"),
  );
  if (lengthCheck) {
    return NextResponse.json(
      { ok: false, error: lengthCheck.error },
      { status: lengthCheck.status },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Không đọc được dữ liệu tải lên." },
      { status: 400 },
    );
  }

  const productIdRaw = form.get("productId");
  const productId =
    typeof productIdRaw === "string" && productIdRaw !== ""
      ? Number(productIdRaw)
      : null;
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Chưa chọn file ảnh." }, { status: 400 });
  }

  // productId (nếu có) phải là sản phẩm tồn tại; kiểm số ảnh hiện có.
  if (productId !== null) {
    if (!Number.isInteger(productId) || productId <= 0) {
      return NextResponse.json({ ok: false, error: "Sản phẩm không hợp lệ." }, { status: 400 });
    }
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { images: true },
    });
    if (!product) {
      return NextResponse.json({ ok: false, error: "Không tìm thấy sản phẩm." }, { status: 404 });
    }
    if (product.images.length >= MAX_IMAGES_PER_PRODUCT) {
      return NextResponse.json({ ok: false, error: "Sản phẩm đã đủ 6 ảnh." }, { status: 400 });
    }
  }

  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "File rỗng." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: "File quá lớn (tối đa 5 MB/ảnh)." },
      { status: 400 },
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const type = detectImageType(buf);
  if (!type) {
    return NextResponse.json(
      { ok: false, error: "Chỉ nhận ảnh JPEG, PNG hoặc WebP." },
      { status: 400 },
    );
  }
  let url: string;
  try {
    url = await saveUpload(buf, type);
  } catch {
    // UPLOAD_DIR không ghi được (sai quyền/volume chưa gắn...):
    // lỗi rõ ràng, không crash máy chủ (D7-22).
    return NextResponse.json(
      { ok: false, error: "Không lưu được ảnh — kiểm tra thư mục UPLOAD_DIR." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, url });
}
