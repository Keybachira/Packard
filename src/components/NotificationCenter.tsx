import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppStore";
import { IconBell, IconCheck, IconTrash, IconX } from "./icons";

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return "agora";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function NotificationCenter() {
  const { notifications, hasUnreadNotifications, markNotificationsRead, clearNotifications } =
    useApp();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen((o) => {
      if (!o) markNotificationsRead();
      return !o;
    });
  };

  return (
    <div className="notif-center" ref={rootRef}>
      <button
        className="icon-btn"
        style={{ display: "flex" }}
        title="Notificações"
        onClick={toggle}
      >
        <IconBell size={18} />
        {hasUnreadNotifications && <span className="dot-badge" />}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            <span>Notificações</span>
            {notifications.length > 0 && (
              <button className="notif-clear" onClick={clearNotifications}>
                <IconTrash size={13} />
                Limpar
              </button>
            )}
          </div>

          <div className="notif-panel-body">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <IconBell size={22} className="notif-empty-icon" />
                <span>Tudo tranquilo por aqui.</span>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`notif-row notif-${n.variant}`}>
                  <span className="notif-row-icon">
                    {n.variant === "success" ? (
                      <IconCheck size={13} strokeWidth={2.4} />
                    ) : n.variant === "error" ? (
                      <IconX size={13} strokeWidth={2.4} />
                    ) : (
                      <span className="toast-dot" />
                    )}
                  </span>
                  <span className="notif-row-msg">{n.message}</span>
                  <span className="notif-row-time">{timeAgo(n.time)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
