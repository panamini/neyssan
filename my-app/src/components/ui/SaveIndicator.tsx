import React from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type SaveIndicatorTone = "neutral" | "success" | "warning" | "error";

interface SaveIndicatorProps {
  status?: SaveStatus | null;
  className?: string;
  label?: string | null;
  tone?: SaveIndicatorTone;
}

export function SaveIndicator({
  status = "idle",
  className,
  label = null,
  tone = "neutral",
}: SaveIndicatorProps) {
  const [showSavedState, setShowSavedState] = React.useState(status === "saved");

  React.useEffect(() => {
    if (status !== "saved") {
      setShowSavedState(false);
      return undefined;
    }

    setShowSavedState(true);
    const timeoutId = window.setTimeout(() => {
      setShowSavedState(false);
    }, 1400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [status]);

  const effectiveStatus =
    status === "saved" && !showSavedState ? "idle" : status;
  const message =
    effectiveStatus === "saving"
      ? "Saving…"
      : effectiveStatus === "saved"
        ? "Saved"
        : effectiveStatus === "error"
          ? "Save failed"
          : label;

  const effectiveTone: SaveIndicatorTone =
    effectiveStatus === "saved"
      ? "success"
      : effectiveStatus === "error"
        ? "error"
        : effectiveStatus === "saving"
          ? "neutral"
          : tone;
  const pillClassName =
    effectiveTone === "success"
      ? "dasti-pill dasti-pill--success"
      : effectiveTone === "warning"
        ? "dasti-pill dasti-pill--warning"
        : effectiveTone === "error"
          ? "dasti-pill dasti-pill--danger"
          : "dasti-pill";

  if (!message) return null;

  return (
    <div className={className} aria-live="polite" role="status">
      <span className={pillClassName}>{message}</span>
    </div>
  );
}
