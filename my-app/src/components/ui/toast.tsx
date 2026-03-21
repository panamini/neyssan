"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

interface ToastOptions {
  variant?: "info" | "success" | "error" | "warning";
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

function ToastContainer({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed z-50 flex flex-col items-end gap-2 bottom-4 right-4">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onClose={() => onRemove(t.id)} />
      ))}
    </div>
  );
}

function variantClasses(variant?: ToastOptions["variant"]) {
  switch (variant) {
    case "success":
      return "bg-accent text-background border-[color:var(--bo)]";
    case "error":
      return "bg-accent text-background border-[color:var(--bo)]";
    case "warning":
      return "bg-accent text-background border-[color:var(--bo)]";
    default:
      return "bg-surface text-foreground border-[color:var(--bo)]";
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
      className={`max-w-md w-full flex items-start gap-3 p-3 border rounded-md shadow ${variantClasses(
        toast.variant
      )}`}
    >
      {toast.icon ? (
        <div
          aria-hidden="true"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full [background:var(--sf2)] [color:var(--ti)]"
        >
          {toast.icon}
        </div>
      ) : null}
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold">{toast.title}</div>
          <button aria-label="Dismiss toast" onClick={onClose} className="p-1 rounded focus:outline-none focus:[box-shadow:0_0_0_3px_var(--fr)]">
            <span className="text-sm">×</span>
          </button>
        </div>
        {toast.description && <div className="mt-1 text-sm text-muted">{toast.description}</div>}
      </div>
    </div>
  );
}
