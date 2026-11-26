// Nút Bật/Tắt xuất bản trang tĩnh (Ngày 13 B3 — theo mẫu
// ToggleZoneButton). Bấm một cái là đổi luôn, KHÔNG có hộp xác
// nhận — an toàn vì đảo ngược được chỉ bằng một lần bấm nữa, và
// trạng thái "Đã xuất bản"/"Nháp" trên dòng đổi ngay sau khi xong.
// Sau khi xong hiện toast kèm "Hoàn tác" (5 giây).
"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AdminIconButton, {
  EyeIcon,
  EyeOffIcon,
} from "@/components/admin/AdminIconButton";
import {
  togglePageAction,
  type TogglePageState,
} from "@/app/actions/admin";
import {
  togglePageToastMessage,
  undoTogglePageFormData,
  type AdminToastDetail,
} from "@/lib/admin/toggle-toast";

export default function TogglePageButton({
  pageId,
  isPublished,
}: {
  pageId: number;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [state, dispatch] = useActionState<TogglePageState, FormData>(togglePageAction, {
    ok: false,
    error: null,
  });
  const submittedWasPublished = useRef<boolean | null>(null);
  const lastToasted = useRef<TogglePageState | null>(null);

  useEffect(() => {
    if (!state.ok || state === lastToasted.current) return;
    lastToasted.current = state;
    router.refresh();
    const wasPublished = submittedWasPublished.current ?? isPublished;
    submittedWasPublished.current = null;
    const undo = async () => {
      const result = await togglePageAction(
        { ok: false, error: null },
        undoTogglePageFormData(pageId, wasPublished),
      );
      if (result.ok) {
        router.refresh();
        window.dispatchEvent(
          new CustomEvent<AdminToastDetail>("admin:toast", {
            detail: {
              message: togglePageToastMessage(!wasPublished),
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
          message: togglePageToastMessage(wasPublished),
          actionLabel: "Hoàn tác",
          durationMs: 5000,
          onAction: undo,
        },
      }),
    );
  }, [state, isPublished, pageId, router]);

  const label = isPublished ? "Chuyển trang về nháp" : "Xuất bản trang";
  return (
    <div>
      <form
        action={dispatch}
        onSubmit={() => {
          submittedWasPublished.current = isPublished;
        }}
      >
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="isPublished" value={String(!isPublished)} />
        <AdminIconButton
          type="submit"
          label={label}
          icon={isPublished ? EyeOffIcon : EyeIcon}
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
