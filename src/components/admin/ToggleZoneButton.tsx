// Nút Bật/Tắt khu vực giao hàng trong danh sách quản trị (Ngày 12
// C2 — theo mẫu ToggleActiveButton của sản phẩm). Bấm một cái là
// bật/tắt luôn, KHÔNG có hộp xác nhận — an toàn vì đảo ngược được
// chỉ bằng một lần bấm nữa, và trạng thái "Đang bật"/"Đã tắt" trên
// dòng khu vực đổi ngay sau khi xong. Sau khi xong hiện toast
// "Đã tắt khu vực · Hoàn tác" (5 giây) — bấm Hoàn tác gọi lại đúng
// action đảo ngược rồi hiện toast xác nhận. Toast dùng cơ chế có sẵn
// (sự kiện `admin:toast`, xem Toast.tsx).

"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AdminIconButton, {
  EyeIcon,
  EyeOffIcon,
} from "@/components/admin/AdminIconButton";
import {
  toggleZoneAction,
  type ToggleZoneState,
} from "@/app/actions/admin";
import {
  toggleZoneToastMessage,
  undoToggleZoneFormData,
  type AdminToastDetail,
} from "@/lib/admin/toggle-toast";

export default function ToggleZoneButton({
  zoneId,
  isActive,
}: {
  zoneId: number;
  isActive: boolean;
}) {
  const router = useRouter();
  const [state, dispatch] = useActionState<ToggleZoneState, FormData>(toggleZoneAction, {
    ok: false,
    error: null,
  });
  const submittedWasActive = useRef<boolean | null>(null);
  const lastToasted = useRef<ToggleZoneState | null>(null);

  useEffect(() => {
    if (!state.ok || state === lastToasted.current) return;
    lastToasted.current = state;
    router.refresh();
    const wasActive = submittedWasActive.current ?? isActive;
    submittedWasActive.current = null;
    const undo = async () => {
      const result = await toggleZoneAction(
        { ok: false, error: null },
        undoToggleZoneFormData(zoneId, wasActive),
      );
      if (result.ok) {
        router.refresh();
        window.dispatchEvent(
          new CustomEvent<AdminToastDetail>("admin:toast", {
            detail: {
              message: toggleZoneToastMessage(!wasActive),
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
          message: toggleZoneToastMessage(wasActive),
          actionLabel: "Hoàn tác",
          durationMs: 5000,
          onAction: undo,
        },
      }),
    );
  }, [state, isActive, zoneId, router]);

  const label = isActive ? "Tắt khu vực" : "Bật lại khu vực";
  return (
    <div>
      <form
        action={dispatch}
        onSubmit={() => {
          submittedWasActive.current = isActive;
        }}
      >
        <input type="hidden" name="zoneId" value={zoneId} />
        <input type="hidden" name="isActive" value={String(!isActive)} />
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
