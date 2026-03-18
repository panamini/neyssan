import React from "react";
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
  const v1 = isV1SectionsEnabled();

  return (
    <div
      className={`w-full rounded-md border border-[color:var(--bo)] [background:var(--sfr)] p-3 flex items-center justify-between ${className}`}
      role="toolbar"
      aria-label="CV actions"
    >
      <div className="text-sm text-muted-foreground">
        Use the sidebar + to create a new CV.
      </div>

      <div className="text-xs opacity-70">
        {v1 ? "v1 sections: Profile, Summary, Skills, Languages" : "legacy template"}
      </div>
    </div>
  );
}

export default CvToolbar;
