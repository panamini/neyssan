import React from "react";

export function AddBlockButton({ onAdd, label }: { onAdd: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="px-2 py-1 text-white bg-[var(--primary)] rounded hover:bg-[var(--primary)]/90 focus:outline-none focus:ring-2 focus:ring-blue-400"
      aria-label={label ?? "Add"}
    >
      {label ?? "+"}
    </button>
  );
}