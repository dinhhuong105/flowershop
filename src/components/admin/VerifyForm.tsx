// Form nhập mã xác minh hai bước (Ngày 19 Phần C): mã TOTP 6 số
// hoặc mã khôi phục (định dạng XXXXX-XXXXX), cùng một ô nhập.
// Có JS: gửi JSON tới /api/admin/totp-verify, đúng thì vào /admin,
// sai thì hiện lỗi chung ngay trong form (không nói sai ở đâu).
// Không JS: form gửi thường tới cùng route, route redirect 303.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyForm({
  serverError,
  keyUnavailable,
}: {
  serverError: string | null;
  // A2: khóa mã hóa không dùng được → chỉ mã khôi phục mới vào được.
  keyUnavailable?: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(serverError);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/totp-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (res.ok && data && typeof data === "object" && (data as { ok?: unknown }).ok === true) {
        router.push("/admin");
        router.refresh();
      } else {
        const message =
          data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Mã xác thực không đúng.";
        setError(message);
      }
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action="/api/admin/totp-verify" method="post" onSubmit={onSubmit} className="mt-6 space-y-4">
      {keyUnavailable ? (
        <p
          role="alert"
          data-testid="totp-key-unavailable-banner"
          className="rounded-[3px] border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger"
        >
          2FA đã bật nhưng khóa mã hóa không dùng được — chỉ đăng nhập được bằng mã khôi phục
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-[3px] border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger"
        >
          {error}
        </p>
      ) : null}
      <div>
        <label htmlFor="verify-code" className="block text-sm font-semibold text-ink">
          Mã xác thực
        </label>
        <input
          id="verify-code"
          name="code"
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          required
          maxLength={11}
          placeholder="123456 hoặc XXXXX-XXXXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-1 block w-full min-h-11 rounded-[3px] border border-line bg-white px-3 text-base tracking-widest text-ink"
        />
        <p className="mt-1 text-sm text-ink-soft">
          Mã 6 số đổi mỗi 30 giây. Mã khôi phục dùng được một lần rồi hết hiệu lực.
        </p>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-11 w-full items-center justify-center rounded-[3px] bg-gold-300 px-6 text-sm font-bold uppercase tracking-wide text-green-900 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Đang xác minh…" : "Xác minh"}
      </button>
    </form>
  );
}
