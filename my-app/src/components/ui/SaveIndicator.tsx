
interface SaveIndicatorProps {
  status?: string | null;
}

/**
 * SaveIndicator
 *
 * Small, accessible save-status indicator used inside modals/reviewers.
 * - Shows "Saving…" when status indicates a save/refine is in progress.
 * - Shows "Saved" when status is idle.
 * - Uses aria-live to announce state changes to screen readers.
 *
 * Kept intentionally minimal so it can be imported without adding additional state
 * to the parent component. Parent should pass a meaningful `status` prop.
 */
export function SaveIndicator({ status }: SaveIndicatorProps) {
  const isSaving = status === "saving" || status === "refining" || status === "enqueued" || status === "running";
  const message = isSaving ? "Saving…" : status === "idle" ? "Saved" : null;

  if (!message) return null;

  return (
    <div className="mb-2">
      <div className="text-sm text-muted" aria-live="polite" role="status">
        {message}
      </div>
    </div>
  );
}