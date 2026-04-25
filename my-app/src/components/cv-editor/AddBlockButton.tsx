import React from "react";

export function AddBlockButton({ onAdd, label }: { onAdd: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="px-2 py-1 [background:var(--ac)] [color:var(--color-on-accent)] rounded hover:brightness-110 focus:outline-none focus:[box-shadow:0_0_0_3px_var(--fr)]"
      aria-label={label ?? "Add"}
    >
      {label ?? "+"}
    </button>
  );
}
