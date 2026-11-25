// Nút Ẩn/Hiện sản phẩm trong danh sách quản trị (Ngày 7 §3).
// Đổi 25/11 (theo góp ý của Henry): bấm một cái là ẩn/hiện luôn,
// KHÔNG còn hộp xác nhận — an toàn vì đảo ngược được chỉ bằng một
// lần bấm nữa, và trạng thái "Đang bán"/"Đã ẩn" trên dòng sản phẩm
// đổi ngay sau khi xong. Hộp xác nhận Hủy đơn ở chi tiết đơn vẫn
// giữ nguyên (hủy cần lý do bắt buộc).
// ĐỢT 4 — 25/11 (theo nhận xét của Claude): sau khi Ẩn/Hiện xong
// hiện toast "Đã ẩn sản phẩm · Hoàn tác" (5 giây) — bấm Hoàn tác
// gọi lại đúng action đảo ngược rồi hiện toast xác nhận. Toast dùng
// cơ chế có sẵn (sự kiện `admin:toast`, xem Toast.tsx), không làm
// hệ thống toast thứ hai. submittedWasActive ghi lại trạng thái lúc
// bấm (không đọc prop trong effect — dữ liệu mới sau revalidate có
// thể đến trước khi effect chạy, làm đảo ngược thông báo).

"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AdminIconButton, {
  EyeIcon,
  EyeOffIcon,
} from "@/components/admin/AdminIconButton";
import {
  toggleProductAction,
  type ToggleProductState,
} from "@/app/actions/admin";
import {
  toggleToastMessage,
  undoToggleFormData,
  type AdminToastDetail,
} from "@/lib/admin/toggle-toast";

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
  const submittedWasActive = useRef<boolean | null>(null);
  const lastToasted = useRef<ToggleProductState | null>(null);

  useEffect(() => {
    if (!state.ok || state === lastToasted.current) return;
    lastToasted.current = state;
    router.refresh();
    const wasActive = submittedWasActive.current ?? isActive;
    submittedWasActive.current = null;
    const undo = async () => {
      const result = await toggleProductAction(
        { ok: false, error: null },
        undoToggleFormData(productId, wasActive),
      );
      if (result.ok) {
        router.refresh();
        window.dispatchEvent(
          new CustomEvent<AdminToastDetail>("admin:toast", {
            detail: {
              message: toggleToastMessage(!wasActive),
              durationMs: 5000,
            },
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent<AdminToastDetail>("admin:toast", {
            detail: {
              message: result.error ?? "Không hoàn tác được.",
              tone: "error",
              durationMs: 5000,
            },
          }),
        );
      }
    };
    window.dispatchEvent(
      new CustomEvent<AdminToastDetail>("admin:toast", {
        detail: {
          message: toggleToastMessage(wasActive),
          actionLabel: "Hoàn tác",
          durationMs: 5000,
          onAction: undo,
        },
      }),
    );
  }, [state, isActive, productId, router]);

  const label = isActive ? "Ẩn sản phẩm" : "Hiện lại";
  return (
    <div>
      <form
        action={dispatch}
        onSubmit={() => {
          submittedWasActive.current = isActive;
        }}
      >
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
