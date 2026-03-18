import React from "react";
import { isV1SectionsEnabled } from "../lib/flags";
import { useCvLibrary } from "../contexts/CvLibraryContext";

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
  const { isV1Active, currentCv } = useCvLibrary();

  const handlePick = (type: string) => {
    onSelect(type);
    onClose();
  };

  // Options are gated by the V1 feature flag, but document shape takes precedence at runtime.
  // If the loaded document is v1-shaped, expose v1 options even if the env flag is off.
  const v1Enabled = isV1Active || isV1SectionsEnabled();
  const sections = currentCv?.sections ?? [];
  const existingTypes = new Set(sections.map((section) => String(section.type ?? "")));
  const hasMeaningfulAchievementsSection = (() => {
    const parts: string[] = [];
    const seen = new Set<unknown>();
    const extractLooseText = (value: unknown): string => {
      parts.length = 0;
      seen.clear();
      const walk = (node: unknown) => {
        if (node == null || seen.has(node)) return;
        if (typeof node === "object") seen.add(node);
        if (typeof node === "string") {
          const trimmed = node.trim();
          if (trimmed) parts.push(trimmed);
          return;
        }
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        if (typeof node === "object") {
          const record = node as Record<string, unknown>;
          if (typeof record.text === "string") walk(record.text);
          if (typeof record.achievement === "string") walk(record.achievement);
          if (typeof record.plainText === "string") walk(record.plainText);
          if ("content" in record) walk(record.content);
          if ("items" in record) walk(record.items);
        }
      };
      walk(value);
      return parts.join(" ").trim();
    };
    return sections.some((section) => {
      if (String(section.type ?? "") !== "achievements") return false;
      const structuredText = extractLooseText((section as any).structuredContent);
      if (structuredText) return true;
      const blockText = extractLooseText((section as any).blocks);
      return Boolean(blockText);
    });
  })();
  const options: Array<{ type: string; title: string; desc: string; fullSpan?: boolean }> = (v1Enabled
    ? [
        { type: "achievements", title: "Achievements", desc: "Awards & accomplishments" },
        { type: "languages", title: "Languages", desc: "Spoken & written" },
      ]
    : [
        { type: "summary", title: "Summary", desc: "Short pitch" },
        { type: "experience", title: "Experience", desc: "Company, role, achievements" },
        { type: "achievements", title: "Achievements", desc: "Highlights & results" },
        { type: "education", title: "Education", desc: "Degrees, institutions" },
        { type: "skills", title: "Skills", desc: "Lists, competencies" },
        { type: "languages", title: "Languages", desc: "Spoken & written" },
        { type: "projects", title: "Projects", desc: "Portfolio entries" },
        { type: "certifications", title: "Certifications", desc: "Certificates & courses" },
        { type: "contact", title: "Contact", desc: "Email, phone, links", fullSpan: true },
      ]).filter((option) => {
        if (option.type === "achievements") {
          return !hasMeaningfulAchievementsSection;
        }
        return !existingTypes.has(option.type);
      });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:hidden"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-[4px]"
        style={{ background: 'hsla(30,12%,11%,.32)' }}
        onClick={onClose}
        aria-hidden
      />
      {/* Sheet */}
      <div className="relative w-full p-4 [box-shadow:var(--shc)] rounded-t-xl [background:var(--sfr)] text-[var(--foreground)]">
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

        {options.length > 0 ? (
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
        ) : (
          <div className="px-3 py-4 text-sm border rounded text-[var(--foreground)]/70">
            All optional sections are already added.
          </div>
        )}
      </div>
    </div>
  );
}

export default AddSectionBottomSheet;
