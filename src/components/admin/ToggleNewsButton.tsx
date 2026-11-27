// Nút Bật/Tắt xuất bản bài tin tức (Ngày 18 — theo mẫu
// TogglePageButton). Bấm một cái là đổi luôn, KHÔNG có hộp xác
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
  toggleNewsAction,
  type ToggleNewsState,
} from "@/app/actions/admin";
import {
  toggleNewsToastMessage,
  undoToggleNewsFormData,
  type AdminToastDetail,
} from "@/lib/admin/toggle-toast";

export default function ToggleNewsButton({
  newsId,
  isPublished,
}: {
  newsId: number;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [state, dispatch] = useActionState<ToggleNewsState, FormData>(toggleNewsAction, {
    ok: false,
    error: null,
  });
  const submittedWasPublished = useRef<boolean | null>(null);
  const lastToasted = useRef<ToggleNewsState | null>(null);
  const lastErrorToasted = useRef<ToggleNewsState | null>(null);

  // Đổi xong: hiện toast kèm Hoàn tác — bấm Hoàn tác thì gọi lại
  // action với đúng trạng thái trước khi bấm (lỗi thì toast lỗi).
  useEffect(() => {
    if (!state.ok || state === lastToasted.current) return;
    lastToasted.current = state;
    router.refresh();
    const wasPublished = submittedWasPublished.current ?? isPublished;
    submittedWasPublished.current = null;
    const undo = async () => {
      const result = await toggleNewsAction(
        { ok: false, error: null },
        undoToggleNewsFormData(newsId, wasPublished),
      );
      if (result.ok) {
        router.refresh();
        window.dispatchEvent(
          new CustomEvent<AdminToastDetail>("admin:toast", {
            detail: {
              message: toggleNewsToastMessage(!wasPublished),
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
          message: toggleNewsToastMessage(wasPublished),
          actionLabel: "Hoàn tác",
          durationMs: 5000,
          onAction: undo,
        },
      }),
    );
  }, [state, isPublished, newsId, router]);

  // Lỗi bật/tắt xuất bản (Ngày 16 #1): hiện bằng toast lỗi ở góc
  // dưới-phải thay vì nhét vào ô thao tác. Chỉ toast một lần cho
  // mỗi lần bấm lỗi.
  useEffect(() => {
    if (!state.error || state === lastErrorToasted.current) return;
    lastErrorToasted.current = state;
    window.dispatchEvent(
      new CustomEvent<AdminToastDetail>("admin:toast", {
        detail: {
          message: state.error,
          tone: "error",
          durationMs: 5000,
        },
      }),
    );
  }, [state]);

  const label = isPublished ? "Chuyển bài về nháp" : "Xuất bản bài";
  return (
    <div>
      <form
        action={dispatch}
        onSubmit={() => {
          submittedWasPublished.current = isPublished;
        }}
      >
        <input type="hidden" name="newsId" value={newsId} />
        <input type="hidden" name="isPublished" value={String(!isPublished)} />
        <AdminIconButton
          type="submit"
          label={label}
          icon={isPublished ? EyeOffIcon : EyeIcon}
          className="border border-slate-200 bg-white text-slate-900 hover:border-blue-600 hover:text-blue-600"
        />
      </form>
    </div>
  );
}
