// Form đăng nhập quản trị: TÀI KHOẢN + MẬT KHẨU.
// Có JS: gửi JSON tới /api/admin/login, đúng thì chuyển vào
// /admin (Ngày 9: tổng quan là trang quản trị chính), sai thì
// hiện lỗi ngay trong form.
// Không JS: form gửi thường tới cùng route (action/method bên dưới),
// route redirect về /login?error=... hoặc /admin.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({
  initialUsername,
  serverError,
}: {
  initialUsername: string;
  serverError: string | null;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(serverError);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (res.ok && data && typeof data === "object" && (data as { ok?: unknown }).ok === true) {
        router.push("/admin");
        router.refresh();
      } else {
        const message =
          data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Tên đăng nhập hoặc mật khẩu không đúng.";
        setError(message);
      }
    } catch {
      setError("Không kết nối được máy chủ, vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action="/api/admin/login" method="post" onSubmit={onSubmit} className="mt-6 space-y-4">
      {error ? (
        <p role="alert" className="rounded-[3px] border border-danger/40 bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <label htmlFor="login-username" className="block text-sm font-semibold text-ink">
          Tên đăng nhập
        </label>
        <input
          id="login-username"
          name="username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 block w-full min-h-11 rounded-[3px] border border-line bg-white px-3 text-base text-ink"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="block text-sm font-semibold text-ink">
          Mật khẩu
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full min-h-11 rounded-[3px] border border-line bg-white px-3 text-base text-ink"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-11 w-full items-center justify-center rounded-[3px] bg-gold-300 px-6 text-sm font-bold uppercase tracking-wide text-green-900 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}
