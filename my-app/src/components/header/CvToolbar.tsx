import React from "react";
import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { isV1SectionsEnabled } from "../../lib/flags";

export interface CvToolbarProps {
  className?: string;
}

/**
 * CvToolbar
 * - Minimal, tokenized toolbar for CV Forge workspace actions.
 * - Primary action: create a new CV (v1 when flag is enabled).
 * - Accessible and responsive, uses shadcn-style Button primitive and design tokens.
 */
export function CvToolbar({ className = "" }: CvToolbarProps): JSX.Element {
  const { createNewCv } = useCvLibrary();
  const v1 = isV1SectionsEnabled();

  function handleNew() {
    try {
      createNewCv();
    } catch {
      /* noop */
    }
  }

  return (
    <div
      className={`w-full rounded-md border border-[var(--accent)]/30 bg-[var(--background)]/60 backdrop-blur p-3 flex items-center justify-between ${className}`}
      role="toolbar"
      aria-label="CV actions"
    >
      <div className="flex items-center gap-2">
        <Button
          onClick={handleNew}
          size="sm"
          className="inline-flex items-center gap-2 bg-[var(--primary)] text-[var(--foreground)] hover:opacity-90"
          ariaLabel={v1 ? "Create new CV (v1 sections)" : "Create new CV"}
          title={v1 ? "Create new CV (v1 sections)" : "Create new CV"}
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{v1 ? "New CV (v1)" : "New CV"}</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      <div className="text-xs opacity-70">
        {v1 ? "v1 sections: Profile, Summary, Skills, Languages" : "legacy template"}
      </div>
    </div>
  );
}

export default CvToolbar;