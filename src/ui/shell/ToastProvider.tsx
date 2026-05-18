"use client";

import { X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./toast.module.css";

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastVariant = "info" | "warning";

type ToastContextValue = {
  showToast: (message: string, options?: { variant?: ToastVariant }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const toastDurationMs = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextToastIdRef = useRef(1);
  const toastTimersRef = useRef(new Map<number, number>());

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimersRef.current.get(id);

    if (timer) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: { variant?: ToastVariant }) => {
      const id = nextToastIdRef.current;
      nextToastIdRef.current += 1;

      setToasts((current) => [
        ...current.slice(-2),
        { id, message, variant: options?.variant ?? "info" },
      ]);
      toastTimersRef.current.set(
        id,
        window.setTimeout(() => dismissToast(id), toastDurationMs),
      );
    },
    [dismissToast],
  );

  useEffect(() => {
    const toastTimers = toastTimersRef.current;

    return () => {
      toastTimers.forEach((timer) => window.clearTimeout(timer));
      toastTimers.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.toastRegion} aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            className={`${styles.toast} ${
              toast.variant === "warning" ? styles.warningToast : styles.infoToast
            }`}
            key={toast.id}
            onClick={() => dismissToast(toast.id)}
            role="status"
          >
            <span>{toast.message}</span>
            <button
              aria-label="Dismiss notification"
              onClick={(event) => {
                event.stopPropagation();
                dismissToast(toast.id);
              }}
              type="button"
            >
              <X aria-hidden="true" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);

  if (!value) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return value;
}
