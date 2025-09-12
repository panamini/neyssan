import React from "react";
import { isV1SectionsEnabled } from "../lib/flags";

interface AddSectionBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
}

/**
 * Mobile-friendly bottom sheet for selecting a section type to add.
 * - Simple, accessible, and styleable via Tailwind.
 * - Designed to be mounted by the ProfileReviewCard and invoked on small screens.
 */
export function AddSectionBottomSheet({ isOpen, onClose, onSelect }: AddSectionBottomSheetProps) {
  if (!isOpen) return null;

  const handlePick = (type: string) => {
    onSelect(type);
    onClose();
  };

  // Options are gated by the V1 feature flag.
  // V1: only first-wave typed sections (Profile, Summary, Skills, Languages).
  // Non-V1 (legacy): expose the previous full set.
  const v1Enabled = isV1SectionsEnabled();
  const options: Array<{ type: string; title: string; desc: string; fullSpan?: boolean }> = v1Enabled
    ? [
        { type: "profile", title: "Profile", desc: "Personal info" },
        { type: "summary", title: "Summary", desc: "Short pitch" },
        { type: "experience", title: "Experience", desc: "Company, role, dates" },
        { type: "education", title: "Education", desc: "Degrees, institutions" },
        { type: "skills", title: "Skills", desc: "Lists, competencies" },
        { type: "languages", title: "Languages", desc: "Spoken & written" },
      ]
    : [
        { type: "summary", title: "Summary", desc: "Short pitch" },
        { type: "experience", title: "Experience", desc: "Company, role, achievements" },
        { type: "education", title: "Education", desc: "Degrees, institutions" },
        { type: "skills", title: "Skills", desc: "Lists, competencies" },
        { type: "projects", title: "Projects", desc: "Portfolio entries" },
        { type: "certifications", title: "Certifications", desc: "Certificates & courses" },
        { type: "contact", title: "Contact", desc: "Email, phone, links", fullSpan: true },
      ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:hidden"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      {/* Sheet */}
      <div className="relative w-full p-4 shadow-lg rounded-t-xl bg-[var(--background)] text-[var(--foreground)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Add Section</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-2 rounded hover:bg-[var(--accent)]/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {options.map((opt) => (
            <button
              key={opt.type}
              className={`p-3 text-left border rounded hover:bg-[var(--accent)]/5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 ${
                opt.fullSpan ? "col-span-2" : ""
              }`}
              onClick={() => handlePick(opt.type)}
            >
              <div className="font-medium">{opt.title}</div>
              <div className="text-xs opacity-70">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AddSectionBottomSheet;