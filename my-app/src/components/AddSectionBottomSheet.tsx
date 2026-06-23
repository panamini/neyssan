/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import React from "react";
import { isV1SectionsEnabled } from "../lib/flags";
import { ADDITIONAL_INFORMATION_SECTION_TITLE } from "../lib/cv-section-organization";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { Sheet } from "@/components/ui/sheet";

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
export function AddSectionBottomSheet({
  isOpen,
  onClose,
  onSelect,
}: AddSectionBottomSheetProps) {
  if (!isOpen) return null;

  return <AddSectionBottomSheetContent onClose={onClose} onSelect={onSelect} />;
}

function AddSectionBottomSheetContent({
  onClose,
  onSelect,
}: Pick<AddSectionBottomSheetProps, "onClose" | "onSelect">) {
  const { isV1Active, currentCv } = useCvLibrary();

  const handlePick = (type: string) => {
    onSelect(type);
    onClose();
  };

  // Options are gated by the V1 feature flag, but document shape takes precedence at runtime.
  // If the loaded document is v1-shaped, expose v1 options even if the env flag is off.
  const v1Enabled = isV1Active || isV1SectionsEnabled();
  const sections = currentCv?.sections ?? [];
  const existingTypes = new Set(
    sections.map((section) => String(section.type ?? "")),
  );
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
      const structuredText = extractLooseText(
        (section as any).structuredContent,
      );
      if (structuredText) return true;
      const blockText = extractLooseText((section as any).blocks);
      return Boolean(blockText);
    });
  })();
  const options: Array<{
    type: string;
    title: string;
    desc: string;
    fullSpan?: boolean;
  }> = (
    v1Enabled
      ? [
          {
            type: "achievements",
            title: "Achievements",
            desc: "Awards & accomplishments",
          },
          { type: "languages", title: "Languages", desc: "Spoken & written" },
        ]
      : [
          { type: "summary", title: "Summary", desc: "Short pitch" },
          {
            type: "experience",
            title: "Experience",
            desc: "Company, role, achievements",
          },
          {
            type: "achievements",
            title: "Achievements",
            desc: "Highlights & results",
          },
          {
            type: "education",
            title: "Education",
            desc: "Degrees, institutions",
          },
          { type: "skills", title: "Skills", desc: "Lists, competencies" },
          { type: "languages", title: "Languages", desc: "Spoken & written" },
          { type: "projects", title: "Projects", desc: "Portfolio entries" },
          {
            type: "certifications",
            title: "Certifications",
            desc: "Certificates & courses",
          },
          {
            type: "additional_information",
            title: ADDITIONAL_INFORMATION_SECTION_TITLE,
            desc: "Extra details and references",
            fullSpan: true,
          },
          {
            type: "affiliations",
            title: "Affiliations",
            desc: "Memberships and associations",
          },
          {
            type: "hobbies",
            title: "Hobbies",
            desc: "Interests and personal activities",
          },
          {
            type: "custom",
            title: "Add your own",
            desc: "Create a custom titled section",
            fullSpan: true,
          },
        ]
  ).filter((option) => {
    if (option.type === "achievements") {
      return !hasMeaningfulAchievementsSection;
    }
    if (option.type === "custom") {
      return true;
    }
    if (
      option.type === "additional_information" ||
      option.type === "affiliations" ||
      option.type === "hobbies"
    ) {
      const existingTextTitles = new Set(
        sections
          .filter((section) => String(section.type ?? "") === "text")
          .map((section) => String(section.title ?? "").trim().toLowerCase()),
      );
      return !existingTextTitles.has(option.title.trim().toLowerCase());
    }
    return !existingTypes.has(option.type);
  });

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      side="bottom"
      title="Add section"
      ariaLabel="Add section"
      bodyClassName="sm:hidden"
      className="sm:hidden"
    >
      {options.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {options.map((opt) => (
            <button
              key={opt.type}
              className={`p-3 text-left border rounded hover:[background:var(--sf2)] focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)] ${
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
    </Sheet>
  );
}

export default AddSectionBottomSheet;
