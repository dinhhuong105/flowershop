// Tải logo/favicon/ảnh OG lên (Ngày 11 B3, Ngày 13 C1 thêm "og"):
// POST multipart (purpose = logo|favicon|og + file). Chỉ quản trị.
// Logo tối đa 1 MB, favicon tối đa 256 KB, ảnh OG tối đa 1 MB;
// nhận JPEG/PNG/WebP (magic bytes) + SVG tĩnh cho logo/favicon
// (isSafeSvgText — SVG chứa mã bị từ chối vì phục vụ cùng origin
// với shop). Ảnh OG KHÔNG nhận SVG (đặc tả C1: chỉ jpg/png/webp).
// Lưu qua storage.saveImage nên trả URL TUYỆT ĐỐI
// (Blob trên Vercel, /uploads/... gắn domain shop ở local).
// Lỗi ghi (vd chưa có BLOB_READ_WRITE_TOKEN trên Vercel) trả 500
// với thông báo rõ ràng, không crash máy chủ.
import { NextResponse } from "next/server";
import { AdminNotConfiguredError, requireAdmin } from "@/lib/admin/auth";
import {
  MAX_FAVICON_BYTES,
  MAX_LOGO_BYTES,
  checkUploadContentLength,
  detectImageType,
  isSafeSvgText,
} from "@/lib/admin/upload-rules";
import { StorageWriteError, saveImage } from "@/lib/storage";

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

  // Từ chối sớm file > 1,5 MB (lớn hơn giới hạn logo 1 MB một chút
  // để báo lỗi đúng giới hạn từng loại ở dưới).
  const lengthCheck = checkUploadContentLength(
    request.headers.get("content-length"),
    1.5 * 1024 * 1024,
    "1,5 MB",
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

  const purposeRaw = form.get("purpose");
  const purpose =
    purposeRaw === "favicon"
      ? "favicon"
      : purposeRaw === "logo"
        ? "logo"
        : purposeRaw === "og"
          ? "og"
          : null;
  if (!purpose) {
    return NextResponse.json(
      { ok: false, error: "Thiếu loại ảnh (logo, favicon hoặc ảnh OG)." },
      { status: 400 },
    );
  }
  const maxBytes = purpose === "favicon" ? MAX_FAVICON_BYTES : MAX_LOGO_BYTES;
  const maxLabel = purpose === "favicon" ? "256 KB" : "1 MB";

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Chưa chọn file ảnh." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "File rỗng." }, { status: 400 });
  }
  if (file.size > maxBytes) {
    return NextResponse.json(
      { ok: false, error: `File quá lớn (tối đa ${maxLabel}).` },
      { status: 400 },
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const type = detectImageType(buf);
  if (type) {
    try {
      const url = await saveImage(buf, type);
      return NextResponse.json({ ok: true, url });
    } catch (error) {
      if (error instanceof StorageWriteError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json(
        { ok: false, error: "Không lưu được ảnh, vui lòng thử lại." },
        { status: 500 },
      );
    }
  }
  // Không khớp magic bytes JPEG/PNG/WebP — thử SVG tĩnh (trừ ảnh
  // OG: đặc tả C1 chỉ nhận jpg/png/webp).
  if (purpose === "og") {
    return NextResponse.json(
      { ok: false, error: "Ảnh OG chỉ nhận JPEG, PNG hoặc WebP." },
      { status: 400 },
    );
  }
  if (isSafeSvgText(buf.toString("utf8"))) {
    try {
      const url = await saveImage(buf, "svg");
      return NextResponse.json({ ok: true, url });
    } catch (error) {
      if (error instanceof StorageWriteError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      return NextResponse.json(
        { ok: false, error: "Không lưu được ảnh, vui lòng thử lại." },
        { status: 500 },
      );
    }
  }
  return NextResponse.json(
    { ok: false, error: "Chỉ nhận ảnh JPEG, PNG, WebP hoặc SVG tĩnh." },
    { status: 400 },
  );
}
