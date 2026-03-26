"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import clsx from "clsx";

interface ToastOptions {
  variant?:
    | "info"
    | "success"
    | "error"
    | "warning"
    | "neutral"
    | "destructive";
  duration?: number;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  showToast: (message: string, opts?: ToastOptions) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function useUniqueId(prefix = "toast") {
  const ref = useRef(0);
  return function next() {
    ref.current += 1;
    return `${prefix}-${ref.current}`;
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const getId = useUniqueId("toast");

  function showToast(message: string, opts: ToastOptions = {}) {
    const id = getId();
    const item: ToastItem = {
      id,
      title: opts.title ?? message,
      description: opts.description,
      variant: opts.variant ?? "info",
      duration: opts.duration ?? 4000,
      icon: opts.icon,
    };
    // Only show one toast at a time (clear existing toasts first)
    setToasts(() => [item]);
    if (item.duration && item.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((p) => p.id !== id));
      }, item.duration);
    }
    return id;
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function clearToasts() {
    setToasts([]);
  }

  const value = useMemo(() => ({ showToast, removeToast, clearToasts }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback no-op implementation to keep tests and non-UI contexts stable.
    // Returning no-ops avoids throwing during unit tests where ToastProvider
    // isn't mounted, while preserving type-safety for callers.
    return {
      showToast: () => "",
      removeToast: () => {},
      clearToasts: () => {},
    };
  }
  return ctx;
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="dasti-toast-region">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onClose={() => onRemove(t.id)} />
      ))}
    </div>
  );
}

function variantClasses(variant?: ToastOptions["variant"]) {
  switch (variant) {
    case "neutral":
      return "dasti-toast dasti-toast--neutral";
    case "info":
      return "dasti-toast dasti-toast--info";
    case "success":
      return "dasti-toast dasti-toast--success";
    case "destructive":
    case "error":
      return "dasti-toast dasti-toast--danger";
    case "warning":
      return "dasti-toast dasti-toast--warning";
    default:
      return "dasti-toast dasti-toast--neutral";
  }
}

function Toast({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;
    const id = setTimeout(() => {
      onClose();
    }, toast.duration);
    return () => clearTimeout(id);
  }, [toast.duration, onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(variantClasses(toast.variant))}
    >
      {toast.icon ? (
        <div aria-hidden="true" className="dasti-toast__icon">
          {toast.icon}
        </div>
      ) : null}
      <div className="dasti-toast__body">
        <div className="dasti-toast__head">
          <div className="dasti-toast__title">{toast.title}</div>
          <button
            aria-label="Dismiss toast"
            onClick={onClose}
            className="dasti-toast__close"
          >
            <span className="dasti-toast__close-glyph">×</span>
          </button>
        </div>
        {toast.description && (
          <div className="dasti-toast__description">{toast.description}</div>
        )}
      </div>
    </div>
  );
}
