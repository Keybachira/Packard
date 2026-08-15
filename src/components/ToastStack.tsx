import { useApp } from "../context/AppStore";
import { IconCheck, IconX } from "./icons";

const VARIANT_META: Record<
  "info" | "success" | "error",
  { icon: React.ReactNode; className: string }
> = {
  success: { icon: <IconCheck size={14} strokeWidth={2.4} />, className: "toast-success" },
  error: { icon: <IconX size={14} strokeWidth={2.4} />, className: "toast-error" },
  info: { icon: <span className="toast-dot" />, className: "toast-info" },
};

export default function ToastStack() {
  const { toasts, dismissToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => {
        const meta = VARIANT_META[t.variant];
        return (
          <div
            key={t.id}
            className={`toast-card ${meta.className}`}
            onClick={() => dismissToast(t.id)}
          >
            <span className="toast-icon">{meta.icon}</span>
            <span className="toast-msg">{t.message}</span>
            <span className="toast-progress" />
          </div>
        );
      })}
    </div>
  );
}
