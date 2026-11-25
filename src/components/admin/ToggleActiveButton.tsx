// Nút Ẩn/Hiện sản phẩm trong danh sách quản trị (Ngày 7 §3).
// Đổi 25/11 (theo góp ý của Henry): bấm một cái là ẩn/hiện luôn,
// KHÔNG còn hộp xác nhận — an toàn vì đảo ngược được chỉ bằng một
// lần bấm nữa, và trạng thái "Đang bán"/"Đã ẩn" trên dòng sản phẩm
// đổi ngay sau khi xong. Hộp xác nhận Hủy đơn ở chi tiết đơn vẫn
// giữ nguyên (hủy cần lý do bắt buộc).

"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminIconButton, {
  EyeIcon,
  EyeOffIcon,
} from "@/components/admin/AdminIconButton";
import {
  toggleProductAction,
  type ToggleProductState,
} from "@/app/actions/admin";

export default function ToggleActiveButton({
  productId,
  isActive,
}: {
  productId: number;
  isActive: boolean;
}) {
  const router = useRouter();
  const [state, dispatch] = useActionState<ToggleProductState, FormData>(
    toggleProductAction,
    { ok: false, error: null },
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  const label = isActive ? "Ẩn sản phẩm" : "Hiện lại";
  return (
    <div>
      <form action={dispatch}>
        <input type="hidden" name="productId" value={productId} />
        <input type="hidden" name="isActive" value={String(!isActive)} />
        {/* Nút kích hoạt dạng icon (25/11): tooltip = đúng nhãn cũ. */}
        <AdminIconButton
          type="submit"
          label={label}
          icon={isActive ? EyeOffIcon : EyeIcon}
          className="border border-slate-200 bg-white text-slate-900 hover:border-blue-600 hover:text-blue-600"
        />
      </form>
      {state.error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-danger">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
