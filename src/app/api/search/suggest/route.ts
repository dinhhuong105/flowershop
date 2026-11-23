import { NextResponse } from "next/server";
import { searchSuggestions } from "@/lib/search";

// Gợi ý tìm kiếm (mục 2.5 đặc tả Ngày 6): cùng quy tắc tìm và xếp
// hạng ở 2.1, tối đa 5 phần tử. q ngắn hơn 2 ký tự hoặc rỗng → [].
// Cache-Control: no-store. Lỗi trả JSON { error } với mã 400/500,
// không lộ chi tiết nội bộ.
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const suggestions = await searchSuggestions(q);
    return NextResponse.json(suggestions, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Không thể tải gợi ý tìm kiếm." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
