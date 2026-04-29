"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import clsx from "clsx";

type LegacyToastVariant =
  | "info"
  | "success"
  | "error"
  | "warning"
  | "neutral"
  | "destructive";

export type ToastTone = "neutral" | "success" | "danger";
export type ToastAction = { label: string; onClick: () => void };

interface ToastOptions {
  variant?: LegacyToastVariant;
  tone?: ToastTone;
  duration?: number;
  durationMs?: number;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: ToastAction;
}

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: ToastAction;
}

interface ToastItem extends Required<Pick<ToastInput, "title" | "tone">> {
  id: string;
  description?: string;
  durationMs: number;
  action?: ToastAction;
  icon?: React.ReactNode;
  state: "open" | "closing";
}

interface ToastContextValue {
  showToast: (message: string, opts?: ToastOptions) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const TOAST_EXIT_MS = 160;

let externalShow: ((input: ToastInput) => string) | null = null;
let externalDismiss: ((id: string) => void) | null = null;

export const toast = {
  show(input: ToastInput): string {
    return externalShow?.(input) ?? "";
  },
  dismiss(id: string) {
    externalDismiss?.(id);
  },
};

function useUniqueId(prefix = "toast") {
  const ref = useRef(0);
  return useCallback(() => {
    ref.current += 1;
    return `${prefix}-${ref.current}`;
  }, [prefix]);
}

function toneFromVariant(variant?: LegacyToastVariant, tone?: ToastTone): ToastTone {
  if (tone) return tone;
  if (variant === "success") return "success";
  if (variant === "error" || variant === "destructive") return "danger";
  return "neutral";
}

function iconForTone(tone: ToastTone) {
  if (tone === "success") return "✓";
  if (tone === "danger") return "!";
  return "·";
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const getId = useUniqueId("toast");

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, state: "closing" as const } : item,
      ),
    );
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, TOAST_EXIT_MS);
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = getId();
      const item: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        tone: input.tone ?? "neutral",
        durationMs: input.durationMs ?? (input.action ? 6000 : 4000),
        action: input.action,
        state: "open",
      };
      setToasts((prev) => [...prev, item]);
      return id;
    },
    [getId],
  );

  const showToast = useCallback(
    (message: string, opts: ToastOptions = {}) => {
      return show({
        title: opts.title ?? message,
        description: opts.description,
        tone: toneFromVariant(opts.variant, opts.tone),
        durationMs: opts.durationMs ?? opts.duration,
        action: opts.action,
      });
    },
    [show],
  );

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  useEffect(() => {
    externalShow = show;
    externalDismiss = dismissToast;
    return () => {
      externalShow = null;
      externalDismiss = null;
    };
  }, [dismissToast, show]);

  const value = useMemo(
    () => ({ showToast, removeToast: dismissToast, clearToasts }),
    [clearToasts, dismissToast, showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
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
    <div className="ds-toast-region">
      {toasts.map((item) => (
        <Toast key={item.id} item={item} onClose={() => onRemove(item.id)} />
      ))}
    </div>
  );
}

function Toast({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const startedAtRef = useRef(0);
  const remainingRef = useRef(item.durationMs);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (item.durationMs <= 0) return;
    clearTimer();
    startedAtRef.current = Date.now();
    timerRef.current = window.setTimeout(() => {
      onClose();
    }, remainingRef.current);
  }, [clearTimer, item.durationMs, onClose]);

  const pauseTimer = useCallback(() => {
    if (!timerRef.current) return;
    const elapsed = Date.now() - startedAtRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [clearTimer, startTimer]);

  return (
    <div
      role={item.tone === "danger" ? "alert" : "status"}
      aria-live={item.tone === "danger" ? "assertive" : "polite"}
      className={clsx("ds-toast", `ds-toast--${item.tone}`)}
      data-state={item.state}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
      onFocus={pauseTimer}
      onBlur={startTimer}
    >
      <div aria-hidden="true" className="ds-toast__icon">
        {item.icon ?? iconForTone(item.tone)}
      </div>
      <div className="ds-toast__body">
        <div className="ds-toast__head">
          <div className="ds-toast__title">{item.title}</div>
          <button
            aria-label="Dismiss toast."
            type="button"
            onClick={onClose}
            className="ds-toast__close"
          >
            ×
          </button>
        </div>
        {item.description ? (
          <div className="ds-toast__desc">{item.description}</div>
        ) : null}
        {item.action ? (
          <button
            type="button"
            className="ds-toast__action"
            onClick={() => {
              item.action?.onClick();
              onClose();
            }}
          >
            {item.action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
