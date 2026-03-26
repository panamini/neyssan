import { useEffect } from "react";

export function useCloseOnEscape({
  open,
  onClose,
  disabled = false,
}: {
  open: boolean;
  onClose: () => void;
  disabled?: boolean;
}) {
  useEffect(() => {
    if (!open || disabled) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [disabled, onClose, open]);
}
