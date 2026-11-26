// Tải logo/favicon lên (Ngày 11 B3): POST multipart (purpose =
// logo|favicon + file). Chỉ quản trị. Logo tối đa 1 MB, favicon
// tối đa 256 KB; nhận JPEG/PNG/WebP (magic bytes) + SVG tĩnh
// (isSafeSvgText — SVG chứa mã bị từ chối vì phục vụ cùng origin
// với shop). Lưu qua storage.saveImage nên trả URL TUYỆT ĐỐI
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
  const purpose = purposeRaw === "favicon" ? "favicon" : purposeRaw === "logo" ? "logo" : null;
  if (!purpose) {
    return NextResponse.json(
      { ok: false, error: "Thiếu loại ảnh (logo hoặc favicon)." },
      { status: 400 },
    );
  }
  const maxBytes = purpose === "logo" ? MAX_LOGO_BYTES : MAX_FAVICON_BYTES;
  const maxLabel = purpose === "logo" ? "1 MB" : "256 KB";

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
  // Không khớp magic bytes JPEG/PNG/WebP — thử SVG tĩnh.
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
