import React, { useEffect, useState } from "react";
import type { ToastState } from "./types";

export function EliteToast({ toast }: { toast: ToastState | null }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("core::ready");

  useEffect(() => {
    if (!toast) return;
    setMessage(toast.message);
    setVisible(true);
    const timeoutId = window.setTimeout(() => setVisible(false), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  return (
    <div className="tw-toast" data-visible={visible ? "true" : "false"} role="status" aria-live="polite">
      {message}
    </div>
  );
}
