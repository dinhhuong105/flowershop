// Báo đơn mới trong admin (Ngày 17 N1–N2): hỏi máy chủ mỗi 60 giây
// khi tab đang hiển thị (tạm dừng khi tab ẩn, hỏi lại ngay khi quay
// lại), chuông + tiêu đề tab + toast khi số đơn tăng.
//
// - Chuông: số = đơn cần xử lý hiện tại; bấm vào (hoặc mở danh sách
//   đơn) là đã xem → xóa số mới, trả tiêu đề về gốc.
// - Tiêu đề tab khi có đơn mới chưa xem: "(N) Hoa Tươi Demo — Quản trị".
// - Toast dùng chung toast admin sẵn có (sự kiện `admin:toast`):
//   "Có N đơn mới" + liên kết "Xem danh sách".
// - Âm báo ngắn: mặc định TẮT, bật bằng công tắc trong menu người
//   dùng, nhớ bằng localStorage (bọc try/catch). Âm chỉ phát sau khi
//   người dùng đã thao tác trên trang (pointer/keydown) để vượt
//   chính sách tự phát của trình duyệt — trước đó không tự phát âm.
// - Thông báo trình duyệt (Notification API): mặc định TẮT; chỉ hỏi
//   quyền KHI người dùng bấm công tắc bật (không tự hỏi lúc mở
//   trang). Nếu quyền đã bị từ chối thì công tắc không bật được.
// - Không có tab nào mở thì không có báo hiệu gì (xem docs/van-hanh.md).
//
// Render trong AdminShell thay cho khối chuông + tên người dùng cũ.

"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminToastDetail } from "@/lib/admin/toggle-toast";
import {
  NEW_ORDER_POLL_INTERVAL_MS,
  hasNewOrders,
  newOrderDelta,
  newOrderTitle,
  newOrderToastMessage,
  parseNewOrderCountResponse,
} from "@/lib/admin/new-orders";

const SOUND_PREF_KEY = "admin-new-order-sound";
const NOTIFICATION_PREF_KEY = "admin-new-order-notifications";
const ORDERS_LIST_HREF = "/admin/orders?tab=pending";

// Đọc/ghi tùy chọn trong localStorage — bọc try/catch (trình duyệt
// có thể chặn storage; lỗi thì coi như TẮT, không làm hỏng trang).
function readPref(key: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writePref(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Bỏ qua: tùy chọn chỉ không được nhớ, tính năng vẫn chạy.
  }
}

// Âm báo ngắn bằng WebAudio (không tải file âm thanh, không tăng
// First Load JS): một nốt 880 Hz dài ~0,35 giây. Tạo AudioContext
// lười (chỉ khi phát) và chỉ gọi sau thao tác của người dùng.
function playNewOrderBeep(audioRef: RefObject<AudioContext | null>): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = audioRef.current ?? new Ctx();
    audioRef.current = ctx;
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.type = "sine";
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch {
    // Âm báo là tùy chọn — lỗi thì bỏ qua, không chặn báo hiệu khác.
  }
}

export default function NewOrderPoller({
  initialPendingCount,
  initialLatestCode,
}: {
  initialPendingCount: number;
  initialLatestCode: string | null;
}) {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(initialPendingCount);
  const [newCount, setNewCount] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [notificationOn, setNotificationOn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationSupported, setNotificationSupported] = useState(true);
  const [notificationBlocked, setNotificationBlocked] = useState(false);

  // Số đơn + mã đơn mới nhất ở lần hỏi trước (khởi đầu = số máy chủ
  // trả lúc render trang, để lần hỏi đầu tiên không báo "đơn mới"
  // cho những đơn đã có từ trước).
  const prevCountRef = useRef(initialPendingCount);
  const prevCodeRef = useRef<string | null>(initialLatestCode);
  const intervalRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const userInteractedRef = useRef(false);
  const soundOnRef = useRef(false);
  const notificationOnRef = useRef(false);
  const originalTitleRef = useRef<string>("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Tải tùy chọn đã lưu SAU khi mount (tránh lệch hydration: server
  // render mặc định TẮT, client đọc localStorage rồi mới bật lại).
  useEffect(() => {
    setNotificationSupported("Notification" in window);
    if ("Notification" in window) {
      setNotificationBlocked(Notification.permission === "denied");
      // Chỉ bật lại khi quyền vẫn còn được cấp (quyền bị thu hồi
      // trong cài đặt trình duyệt thì công tắc phải về TẮT).
      const saved = readPref(NOTIFICATION_PREF_KEY);
      const on = saved && Notification.permission === "granted";
      setNotificationOn(on);
      notificationOnRef.current = on;
    }
    const sound = readPref(SOUND_PREF_KEY);
    setSoundOn(sound);
    soundOnRef.current = sound;
  }, []);

  // Ghi nhớ "người dùng đã thao tác" — âm báo chỉ phát sau đó.
  useEffect(() => {
    const mark = () => {
      userInteractedRef.current = true;
    };
    window.addEventListener("pointerdown", mark);
    window.addEventListener("keydown", mark);
    return () => {
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
    };
  }, []);

  // Tiêu đề tab theo số đơn mới chưa xem (N2). Khi không có đơn mới
  // thì KHÔNG đụng vào tiêu đề (Next.js quản lý theo từng trang);
  // chỉ khi có đơn mới mới đổi thành "(N) Hoa Tươi Demo — Quản trị",
  // và khi đã xem hết thì trả về tiêu đề của trang hiện tại.
  const newCountRef = useRef(0);
  useEffect(() => {
    newCountRef.current = newCount;
    if (newCount > 0) {
      if (originalTitleRef.current === "") {
        originalTitleRef.current = document.title;
      }
      document.title = newOrderTitle(newCount);
    } else if (
      originalTitleRef.current !== "" &&
      document.title.startsWith("(")
    ) {
      document.title = originalTitleRef.current;
    }
  }, [newCount]);

  // Theo dõi tiêu đề gốc của từng trang (khi không có đơn mới) để
  // trả về đúng tiêu đề sau khi đã xem đơn mới.
  useEffect(() => {
    if (newCountRef.current === 0) {
      originalTitleRef.current = document.title;
    }
  }, [pathname]);

  // Mở danh sách đơn = đã xem → xóa số mới, trả tiêu đề về gốc.
  useEffect(() => {
    if (pathname === "/admin/orders" || pathname.startsWith("/admin/orders/")) {
      setNewCount(0);
    }
  }, [pathname]);

  // Hỏi máy chủ một lần: chỉ báo hiệu khi số đơn TĂNG.
  const pollOnce = useCallback(async () => {
    let data: unknown;
    try {
      const res = await fetch("/api/admin/orders/new-count", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!res.ok) return;
      data = await res.json().catch(() => null);
    } catch {
      return;
    }
    const parsed = parseNewOrderCountResponse(data);
    if (!parsed) return;
    const previous = prevCountRef.current;
    prevCountRef.current = parsed.pendingCount;
    prevCodeRef.current = parsed.latestCode;
    setPendingCount(parsed.pendingCount);
    if (!hasNewOrders(previous, parsed.pendingCount)) return;
    const delta = newOrderDelta(previous, parsed.pendingCount);
    setNewCount((current) => current + delta);
    // Toast chung của admin (góc dưới-phải) + liên kết tới danh sách.
    const detail: AdminToastDetail = {
      message: newOrderToastMessage(delta),
      linkHref: ORDERS_LIST_HREF,
      linkLabel: "Xem danh sách",
      durationMs: 10000,
    };
    window.dispatchEvent(new CustomEvent("admin:toast", { detail }));
    // Âm báo: chỉ khi bật + đã có thao tác của người dùng.
    if (soundOnRef.current && userInteractedRef.current) {
      playNewOrderBeep(audioRef);
    }
    // Thông báo trình duyệt: chỉ khi bật + quyền đã được cấp.
    if (
      notificationOnRef.current &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(newOrderToastMessage(delta), {
          body: "Mở danh sách để xem đơn mới.",
          tag: "new-order",
        });
      } catch {
        // Bỏ qua: toast + chuông vẫn báo hiệu.
      }
    }
  }, []);

  // Vòng hỏi định kỳ (N1): 60 giây/lần, chỉ khi tab đang hiển thị.
  // Tab ẩn → dừng hẳn (không gọi route); quay lại → hỏi ngay một
  // lần rồi chạy lại vòng 60 giây.
  useEffect(() => {
    const start = () => {
      if (intervalRef.current !== null) return;
      intervalRef.current = window.setInterval(
        () => void pollOnce(),
        NEW_ORDER_POLL_INTERVAL_MS,
      );
    };
    const stop = () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        void pollOnce();
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [pollOnce]);

  // Đóng menu khi bấm ra ngoài hoặc Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    soundOnRef.current = next;
    writePref(SOUND_PREF_KEY, next);
  };

  // Chỉ hỏi quyền thông báo KHI người dùng bấm công tắc bật — không
  // tự hỏi lúc mở trang hay lúc có đơn mới.
  const toggleNotifications = async () => {
    if (notificationOn) {
      setNotificationOn(false);
      notificationOnRef.current = false;
      writePref(NOTIFICATION_PREF_KEY, false);
      return;
    }
    if (!("Notification" in window)) return;
    let permission = Notification.permission;
    if (permission === "default") {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = "denied";
      }
    }
    if (permission === "granted") {
      setNotificationBlocked(false);
      setNotificationOn(true);
      notificationOnRef.current = true;
      writePref(NOTIFICATION_PREF_KEY, true);
    } else {
      // Bị từ chối (hoặc đóng hộp hỏi): giữ TẮT, không hỏi lại.
      setNotificationBlocked(permission === "denied");
      setNotificationOn(false);
      notificationOnRef.current = false;
      writePref(NOTIFICATION_PREF_KEY, false);
    }
  };

  const switchClass = (on: boolean, disabled: boolean) =>
    `relative h-6 w-11 shrink-0 rounded-full transition-colors ${
      on ? "bg-blue-600" : "bg-slate-300"
    } ${disabled ? "cursor-not-allowed opacity-50" : ""}`;

  return (
    <div className="ml-auto flex min-w-0 shrink-0 items-center gap-3">
      {/* Chuông báo: số = đơn cần xử lý; bấm vào là đã xem đơn mới. */}
      <Link
        href={ORDERS_LIST_HREF}
        onClick={() => setNewCount(0)}
        aria-label={
          pendingCount > 0
            ? `Có ${pendingCount} đơn cần xử lý — xem danh sách`
            : "Không có đơn nào cần xử lý — xem danh sách"
        }
        className="relative flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {pendingCount > 0 ? (
          <span
            data-testid="admin-bell-count"
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
          >
            {pendingCount}
          </span>
        ) : null}
      </Link>

      {/* Menu người dùng: tên + avatar là nút mở menu (công tắc âm
          báo và thông báo trình duyệt nằm trong này). */}
      <div ref={menuRef} className="relative min-w-0 shrink-0">
        <button
          type="button"
          data-testid="admin-user-menu-button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Đóng menu người dùng" : "Mở menu người dùng"}
          onClick={() => setMenuOpen((value) => !value)}
          className="flex min-h-11 items-center gap-2 rounded-lg px-1 transition-colors hover:bg-slate-100"
        >
          <span className="hidden min-w-0 text-right sm:block">
            <span className="block truncate text-sm font-bold text-slate-900">Quản trị viên</span>
            <span className="block text-xs text-slate-500">admin</span>
          </span>
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white"
          >
            Q
          </span>
        </button>
        {menuOpen ? (
          <div
            role="menu"
            data-testid="admin-user-menu"
            aria-label="Tùy chọn thông báo đơn mới"
            className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          >
            <p className="px-1 pb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Thông báo đơn mới
            </p>
            <div className="flex items-start justify-between gap-3 rounded-lg px-1 py-2">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900">Âm báo đơn mới</span>
                <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                  Mặc định tắt. Chỉ phát sau khi bạn đã thao tác trên trang.
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={soundOn}
                aria-label="Âm báo đơn mới"
                data-testid="new-order-sound-toggle"
                onClick={toggleSound}
                className={switchClass(soundOn, false)}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    soundOn ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg px-1 py-2">
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900">
                  Thông báo trình duyệt
                </span>
                <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                  {!notificationSupported
                    ? "Trình duyệt này không hỗ trợ thông báo."
                    : notificationBlocked
                      ? "Quyền đã bị chặn trong trình duyệt — bật lại trong cài đặt trang."
                      : "Chỉ hỏi quyền khi bạn bật công tắc này."}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={notificationOn}
                aria-label="Thông báo trình duyệt"
                data-testid="new-order-notification-toggle"
                disabled={!notificationSupported || notificationBlocked}
                onClick={() => void toggleNotifications()}
                className={switchClass(
                  notificationOn,
                  !notificationSupported || notificationBlocked,
                )}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    notificationOn ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
            <p className="border-t border-slate-100 px-1 pt-2 text-xs leading-snug text-slate-500">
              Không có tab admin nào mở thì không có báo hiệu gì — xem
              hướng dẫn trong tài liệu vận hành.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
