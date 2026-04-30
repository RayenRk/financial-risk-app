import { useEffect, useState, useRef, useCallback } from "react";
import { X, AlertTriangle, Info, ShieldAlert } from "lucide-react";
import api from "../api/axios.ts";
import { useRefresh } from "../context/RefreshContext.tsx";
import { useNavigate } from "react-router-dom";

interface ToastAlert {
  id: number;
  type: string;
  severity: string;
  message: string;
  triggered_at: string;
}

interface Toast extends ToastAlert {
  toastId: string;
}

const severityStyle = (severity: string) => {
  switch (severity) {
    case "critical":
      return {
        border: "border-red-500/40",
        bg: "bg-red-950/80",
        icon: <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />,
        badge: "bg-red-500/20 text-red-400",
      };
    case "warning":
      return {
        border: "border-yellow-500/40",
        bg: "bg-yellow-950/80",
        icon: <ShieldAlert className="w-5 h-5 text-yellow-400 shrink-0" />,
        badge: "bg-yellow-500/20 text-yellow-400",
      };
    default:
      return {
        border: "border-blue-500/40",
        bg: "bg-blue-950/80",
        icon: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
        badge: "bg-blue-500/20 text-blue-400",
      };
  }
};

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    high_risk_detected: "High Risk Detected",
    risk_increased: "Risk Increased",
    risk_decreased: "Risk Improved",
    negative_margin: "Negative Margin",
    low_liquidity: "Low Liquidity",
    high_leverage: "High Leverage",
  };
  return map[type] ?? type;
};

export default function ToastNotifications() {
  const { refresh } = useRefresh();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const shownIds = useRef<Set<number>>(new Set());
  const navigate = useNavigate();

  const dismiss = (toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  };

  const checkForNewAlerts = useCallback(async () => {
    try {
      const res = await api.get("/alerts/unread");
      const alerts = (res.data.alerts ?? []) as ToastAlert[];

      // Only show alerts not yet shown
      const newAlerts = alerts.filter((a) => !shownIds.current.has(a.id));

      if (newAlerts.length > 0) {
        newAlerts.forEach((a) => shownIds.current.add(a.id));
        setToasts((prev) => [
          ...prev,
          ...newAlerts.map((a) => ({
            ...a,
            toastId: `toast-${a.id}`,
          })),
        ]);
        // Trigger global refresh so all pages update
        refresh();
      }
    } catch {
      // silent
    }
  }, [refresh]);

  // Poll every 60 seconds
  useEffect(() => {
    checkForNewAlerts();
    const interval = setInterval(checkForNewAlerts, 60000);
    return () => clearInterval(interval);
  }, [checkForNewAlerts]);

  // Auto-dismiss each toast after 8 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => dismiss(toast.toastId), 8000),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts.length]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full">
      {toasts.map((toast) => {
        const style = severityStyle(toast.severity);
        return (
          <div
            key={toast.toastId}
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-sm cursor-pointer ${style.border} ${style.bg}`}
            style={{ animation: "slideIn 0.3s ease-out" }}
            onClick={() => {
              dismiss(toast.toastId);
              navigate("/alerts");
            }}
          >
            <div className="mt-0.5">{style.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}
                >
                  {toast.severity.toUpperCase()}
                </span>
                <span className="text-gray-400 text-xs">
                  {typeLabel(toast.type)}
                </span>
              </div>
              <p className="text-white text-sm leading-relaxed">
                {toast.message}
              </p>
              <p className="text-gray-500 text-xs mt-1">
                {new Date(toast.triggered_at).toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismiss(toast.toastId);
              }}
              className="shrink-0 text-gray-500 hover:text-white transition-colors mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
