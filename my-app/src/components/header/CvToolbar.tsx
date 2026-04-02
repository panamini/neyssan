import React from "react";
import { Plus, Upload, ScanLine } from "@/lib/icons";

export interface CvToolbarProps {
  className?: string;
}

/**
 * CvToolbar
 * - Section strip: add-section dropdown + Add button + spacer + Upload + Scanned PDF
 * - §8 dasti visual corrections: replaces static "Use the sidebar" text.
 */
export function CvToolbar({ className = "" }: CvToolbarProps): JSX.Element {
  return (
    <div
      className={`w-full rounded-md border border-[color:var(--color-border)] [background:var(--sfr)] [box-shadow:var(--sha)] px-3 py-2 flex items-center gap-2 ${className}`}
      role="toolbar"
      aria-label="CV section actions"
    >
      {/* Add section select */}
      <select
        style={{
          height: "var(--hs)",
          padding: "0 var(--s3)",
          borderRadius: "var(--radius-control)",
          border: "1px solid var(--color-border-strong)",
          background: "var(--sfr)",
          color: "var(--ti)",
          fontSize: "var(--ts)",
          fontFamily: "inherit",
          cursor: "pointer",
          outline: "none",
          minWidth: 140,
        }}
        defaultValue=""
        aria-label="Select section to add"
      >
        <option value="" disabled>
          Add section…
        </option>
        <option value="experience">Experience</option>
        <option value="education">Education</option>
        <option value="skills">Skills</option>
        <option value="languages">Languages</option>
        <option value="achievements">Achievements</option>
        <option value="summary">Summary</option>
      </select>

      {/* Add button */}
      <button type="button" className="ctb-btn ctb-btn--primary">
        <Plus size={14} />
        Add
      </button>

      {/* Spacer + zone divider */}
      <div style={{ flex: 1 }} />
      <span
        style={{
          display: "block",
          width: 1,
          alignSelf: "stretch",
          margin: "4px 4px",
          background: "var(--color-border)",
          opacity: 0.6,
          flexShrink: 0,
        }}
        aria-hidden="true"
      />

      {/* Zone 2 — Import */}
      <button
        type="button"
        className="ctb-btn ctb-btn--ghost"
        title="Upload a CV file"
      >
        <Upload size={14} />
        Upload
      </button>

      <button
        type="button"
        className="ctb-btn ctb-btn--ghost"
        title="Import a scanned PDF"
      >
        <ScanLine size={14} />
        Scanned PDF
      </button>
    </div>
  );
}

export default CvToolbar;
