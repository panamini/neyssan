import React, { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChevronDown, FileText, GripHorizontal, Plus } from "lucide-react";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import SectionComponent from "./cv-editor/Section";
import SelectedBlockInspector from "./SelectedBlockInspector";
import type { CvSection } from "../schemas/cvDocument.schema";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { generateCvTemplate, generateCvTemplateV1 } from "../lib/cv-template";
import AddSectionBottomSheet from "./AddSectionBottomSheet";
import { isV1SectionsEnabled } from "../lib/flags";
import StructuredUploadButton from "./StructuredUploadButton";
import CvRenameDialog from "./CvRenameDialog";

/**
 * Props for ProfileReviewCard
 */
interface Props {
  cvId?: string;
  profile?: unknown;
}

/**
 * ProfileReviewCard
 *
 * - Uses the modern CvLibraryContext (currentCv, loadCv, isLoading, isDirty)
 * - Calls loadCv(cvId) on mount / when cvId changes
 * - Renders the mounted typed-editor section workflow for each section
 * - Exposes typed section creation controls for the mounted /cv user workflow
 */
export function ProfileReviewCard({ cvId, profile }: Props) {
  const {
    currentCv,
    loadCv,
    isLoading,
    isDirty,
    reorderSections,
    addSection,
    closeInspector,
    renameCv,
    isV1Active,
  } = useCvLibrary();

  // Use document-driven runtime detector primarily; fall back to env flag
  const v1Enabled = isV1Active || isV1SectionsEnabled();

  useEffect(() => {
    if (!cvId) return;
    try {
      const immediate = loadCv(cvId);
      if (!immediate) {
        // Background refresh will update state when ready
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[ProfileReviewCard] loadCv failed for id", cvId, err);
    }
  }, [cvId, loadCv]);

  const sections: CvSection[] = (currentCv?.sections ?? []) as CvSection[];
  const hasMeaningfulAchievementsSection = useMemo(() => {
    function extractLooseText(value: unknown): string {
      const parts: string[] = [];
      const seen = new Set<unknown>();
      function walk(node: unknown) {
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
      }
      walk(value);
      return parts.join(" ").trim();
    }

    return sections.some((section) => {
      if (String(section.type ?? "") !== "achievements") return false;
      const structuredText = extractLooseText((section as any).structuredContent);
      if (structuredText) return true;
      const blockText = extractLooseText((section as any).blocks);
      return Boolean(blockText);
    });
  }, [sections]);
  const addableSectionOptions = useMemo(() => {
    const existingTypes = new Set(sections.map((section) => String(section.type ?? "")));
    const options = v1Enabled
      ? [
          { value: "achievements", label: "Achievements" },
          { value: "languages", label: "Languages" },
        ]
      : [
          { value: "summary", label: "Summary" },
          { value: "experience", label: "Experience" },
          { value: "achievements", label: "Achievements" },
          { value: "education", label: "Education" },
          { value: "skills", label: "Skills" },
          { value: "languages", label: "Languages" },
          { value: "projects", label: "Projects" },
          { value: "certifications", label: "Certifications" },
          { value: "contact", label: "Contact" },
        ];
    return options.filter((option) => !existingTypes.has(option.value));
  }, [sections, v1Enabled, hasMeaningfulAchievementsSection]);

  React.useEffect(() => {
    if (typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true) {
      try {
        // eslint-disable-next-line no-console
        console.debug(
          "[ProfileReviewCard] sections snapshot",
          sections.map((section) => ({ type: section.type, blocks: section.blocks?.length ?? 0, items: Array.isArray((section as any)?.structuredContent) ? (section as any).structuredContent.length : null }))
        );
      } catch {
        /* noop */
      }
    }
  }, [sections]);
  const sensors = useSensors(useSensor(PointerSensor));
  const DEBUG_CV_EDITOR = typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true;
  // TEMPORARILY DISABLE DnD GLOBALLY to stabilize inspector flow. Re-enable after DnD refactor.
  const DISABLE_DND_FOR_DEBUG = true;

  // Local debug UI state
  // Selected type when adding a new section (desktop dropdown). Empty string => no selection.
  const [selectedNewSectionType, setSelectedNewSectionType] = useState<string>("");
  // Mobile bottom-sheet open state
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState<boolean>(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState<boolean>(false);

  // Simple in-component toast notifications for debugging (no external deps)
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  function pushToast(message: string) {
    const id = uuidv4();
    setToasts((s) => [...s, { id, message }]);
    // auto-dismiss
    setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), 3500);
  }

  React.useEffect(() => {
    if (!selectedNewSectionType) return;
    const stillAvailable = addableSectionOptions.some((option) => option.value === selectedNewSectionType);
    if (!stillAvailable) {
      setSelectedNewSectionType("");
    }
  }, [addableSectionOptions, selectedNewSectionType]);

  React.useEffect(() => {
    if (!currentCv) {
      setIsRenameDialogOpen(false);
    }
  }, [currentCv]);

  /**
   * Replace an updated section into the current document via context.
   * Uses reorderSections to persist changes.
   */
  function updateSectionInDoc(updated: CvSection) {
    try {
      const updatedList = sections.map((s) =>
        String(s.id) === String(updated.id) ? (updated as CvSection) : s
      );
      reorderSections(updatedList as any);
    } catch {
      /* noop */
    }
  }

  /**
   * Sortable wrapper for individual sections.
   * Uses useSortable to provide drag handle props and style transforms.
   */
  function SortableSection({ section, index }: { section: CvSection; index: number }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
      id: section.id,
    } as any);
    const style: React.CSSProperties = {
      transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      transition,
    };
    return (
      <div ref={setNodeRef} style={style} className="mb-6">
        <div className="flex items-center mb-2">
          <button
            type="button"
            aria-label={`Drag ${section.title}`}
            className="p-1 rounded hover:[background:var(--sf2)]"
            {...attributes}
            {...listeners}
          >
            <GripHorizontal size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
 
        <SectionComponent
          section={section}
          index={index}
          onChange={(_i, updated) => {
            try {
              updateSectionInDoc(updated as any);
            } catch {
              /* noop */
            }
          }}
        />
      </div>
    );
  }

  /**
   * Handle drag end for sections — compute new order and delegate to context.
   */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!active || !over) return;
    if (active.id === over.id) return;

    const ids = sections.map((s) => s.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const newIds = arrayMove(ids, oldIndex, newIndex);
    const newOrderSections = newIds
      .map((id) => sections.find((s) => s.id === id))
      .filter(Boolean) as CvSection[];

    reorderSections(newOrderSections);
  }

  function handleAddSection(type?: string) {
    try {
      if (!type) {
        pushToast("Choose a section type to add");
        return;
      }

      // Prevent duplicates for typed singleton sections
      const typedSingletons = new Set(["profile", "summary", "experience", "education", "skills", "languages", "achievements"]);
      const existingTypes = new Set((currentCv?.sections ?? sections).map((s) => String((s as any).type)));
      if (typedSingletons.has(type) && existingTypes.has(type)) {
        pushToast(`Section "${type}" already exists`);
        return;
      }

      let newSection: CvSection;
      // Generate a full template and pick the matching section to ensure schema-compliance.
      try {
        // If the user explicitly requested a typed v1 section, force the v1 template
        // regardless of env flag. This ensures Add Section always creates a v1-shaped
        // section when the user picks a v1 type from the UI.
        const typedV1Set = new Set(["profile", "summary", "experience", "achievements", "education", "skills", "languages"]);
        const optionalV1SectionSet = new Set(["achievements", "languages"]);
        const forceV1ForType = typedV1Set.has(String(type));
        const tmpl = forceV1ForType
          ? generateCvTemplateV1()
          : (v1Enabled ? generateCvTemplateV1() : generateCvTemplate());

        // Dev log to aid QA: which template we picked and why
        if (process.env.NODE_ENV !== "production") {
          try {
            // eslint-disable-next-line no-console
            console.debug("[ProfileReviewCard] handleAddSection templateChoice", {
              requestedType: type,
              forceV1ForType,
              v1Enabled,
              chosenTemplate: forceV1ForType ? "generateCvTemplateV1" : (v1Enabled ? "generateCvTemplateV1" : "generateCvTemplate"),
            });
          } catch {}
        }

        let matched = tmpl.sections.find((s) => s.type === (type as any));
        if (!matched && forceV1ForType && optionalV1SectionSet.has(String(type))) {
          const optionalTemplate = generateCvTemplate();
          matched = optionalTemplate.sections.find((s) => s.type === (type as any));
        }
        if (!matched) {
          pushToast(`Section type "${type}" is not available`);
          return;
        }

        // Clone and give it a unique id for this document.
        newSection = { ...matched, id: uuidv4() } as CvSection;
      } catch (err) {
        // If template generation fails, fail safely instead of creating a legacy text section.
        // eslint-disable-next-line no-console
        console.error("[ProfileReviewCard] generateCvTemplate failed", err);
        pushToast("Failed to create section");
        return;
      }

      const preferredSectionOrder = [
        "profile",
        "summary",
        "experience",
        "achievements",
        "education",
        "skills",
        "languages",
      ] as const;
      const preferredOrderIndex = new Map(
        preferredSectionOrder.map((sectionType, index) => [sectionType, index] as const)
      );

      const existingSections = (currentCv?.sections ?? sections) as CvSection[];
      if (existingSections.length > 0) {
        const nextSections = [...existingSections, newSection];
        const orderedSections = nextSections
          .map((section, index) => ({ section, index }))
          .sort((a, b) => {
            const aType = String(a.section.type ?? "");
            const bType = String(b.section.type ?? "");
            const aRank = preferredOrderIndex.get(aType) ?? Number.MAX_SAFE_INTEGER;
            const bRank = preferredOrderIndex.get(bType) ?? Number.MAX_SAFE_INTEGER;
            if (aRank !== bRank) return aRank - bRank;
            return a.index - b.index;
          })
          .map(({ section }) => section);

        reorderSections(orderedSections as any);
      } else {
        addSection(newSection);
      }
      pushToast("Section added");
      // Clear the "new section type" selection after insertion (desktop UX).
      setSelectedNewSectionType("");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[ProfileReviewCard] addSection failed", err);
      pushToast("Failed to add section");
    }
  }

  return (
    <div>
      {/* Always mount the inspector; it renders null when no selection to avoid mount/unmount churn */}
      <SelectedBlockInspector onClose={closeInspector} />

      {/* Toast container (debug) */}
      <div aria-live="polite" className="fixed z-50 flex flex-col gap-2 top-4 right-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="px-3 py-2 text-ts [background:var(--sfr)] border rounded-rs [box-shadow:var(--sha)] border-bo"
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Toolbar is rendered below the title only when a CV is loaded — see the !isLoading && currentCv block */}

      {/* Add Section Bottom Sheet (mobile) */}
      <AddSectionBottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        onSelect={(type) => handleAddSection(type)}
      />

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}>
          {/* Title row shimmer */}
          <div className="shimmer-line" style={{ height: 24, width: "55%", borderRadius: "var(--rs)" }} />
          {/* Toolbar shimmer */}
          <div className="shimmer-line" style={{ height: 36, width: "100%", borderRadius: "var(--rs)" }} />
          {/* Section cards shimmer */}
          {[0.9, 0.75, 0.85].map((w, i) => (
            <div key={i} style={{ borderRadius: "var(--rm)", border: "1px solid var(--bo)", overflow: "hidden" }}>
              <div className="shimmer-line" style={{ height: 48, width: "100%", borderRadius: 0 }} />
              <div style={{ padding: "var(--s4)", display: "flex", flexDirection: "column", gap: "var(--s3)" }}>
                <div className="shimmer-line" style={{ height: 12, width: `${Math.round(w * 100)}%` }} />
                <div className="shimmer-line" style={{ height: 12, width: `${Math.round((w - 0.2) * 100)}%` }} />
                <div className="shimmer-line" style={{ height: 12, width: `${Math.round((w - 0.1) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !currentCv && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--s4)",
            padding: "var(--s9) var(--s5)",
            borderRadius: "var(--rm)",
            border: "1px solid var(--bo)",
            background: "var(--sfr)",
            boxShadow: "var(--sha)",
            textAlign: "center",
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "var(--rm)",
              border: "1px solid var(--bo)",
              background: "var(--sf2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--am)",
            }}
          >
            <FileText size={22} strokeWidth={1.4} />
          </div>
          {/* Heading */}
          <div>
            <h2
              style={{
                fontFamily: '"Fraunces", serif',
                fontSize: "var(--tm)",
                fontWeight: 600,
                letterSpacing: "-.01em",
                color: "var(--ti)",
                margin: "0 0 var(--s2)",
              }}
            >
              Your resume space is ready
            </h2>
            <p style={{ fontSize: "var(--ts)", color: "var(--tg2)", lineHeight: "var(--ls)", margin: 0 }}>
              Select a resume from the sidebar, or create a new one to get started.
            </p>
          </div>
        </div>
      )}

      {!isLoading && currentCv && (
        <div>
          {/* ── CV title ────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <button
              type="button"
              className="text-left text-lg font-semibold text-foreground [transition:color_.12s_var(--ez)] hover:text-foreground/80 focus:outline-none focus:[box-shadow:0_0_0_3px_var(--fr)] rounded-sm"
              onClick={() => setIsRenameDialogOpen(true)}
              title="Rename CV"
              aria-label="Rename CV"
            >
              {currentCv.title}
            </button>
            <span className="sr-only" aria-live="polite" role="status">
              {isDirty ? "Saving" : "Saved"}
            </span>
          </div>

          {/* ── Unified toolbar: Add section + Import ───────── */}
          <div
            className="mb-4"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "var(--s2)",
              padding: "var(--s2) var(--s3)",
              borderRadius: "var(--rs)",
              border: "1px solid var(--bo)",
              background: "var(--sfr)",
              boxShadow: "var(--sha)",
            }}
          >
            {addableSectionOptions.length > 0 ? (
              <>
                <div className="relative" style={{ flex: "0 0 auto" }}>
                  <select
                    aria-label="Add section type"
                    className="appearance-none border [border-color:var(--bm)] [border-radius:var(--rs)] [background:var(--sfr)] [color:var(--ti)] text-ts focus:[border-color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)] outline-none pl-3 pr-8 cursor-pointer min-w-[140px]"
                    style={{ height: "var(--hs)", fontFamily: "inherit" }}
                    value={selectedNewSectionType}
                    onChange={(e) => setSelectedNewSectionType(e.target.value)}
                  >
                    <option value="">Add section</option>
                    {addableSectionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 [color:var(--tg2)]"
                    aria-hidden
                  />
                </div>

                <button
                  type="button"
                  className="dasti-icon-button disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => handleAddSection(selectedNewSectionType || undefined)}
                  disabled={!selectedNewSectionType}
                  aria-label="Add selected section"
                  title="Add section"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>

                {/* Mobile bottom sheet trigger */}
                <button
                  type="button"
                  className="block px-2 border font-medium [transition:all_.12s_var(--ez)] text-ts rounded-[var(--rs)] [background:var(--sfr)] [border-color:var(--bm)] [color:var(--ti)] [box-shadow:var(--sha)] hover:[background:var(--sf2)] sm:hidden"
                  style={{ height: "var(--hs)", fontFamily: "inherit" }}
                  onClick={() => setIsBottomSheetOpen(true)}
                  aria-label="Add section (mobile)"
                >
                  Add
                </button>
              </>
            ) : (
              <span className="text-xs [color:var(--tg2)]">All sections added.</span>
            )}

            {/* Divider */}
            <div style={{ width: 1, height: "var(--hs)", background: "var(--bo)", flexShrink: 0 }} />

            {/* Import dropdown */}
            <StructuredUploadButton
              contextKey={currentCv?.id ?? ""}
              sections={sections as unknown as import("../types/cvDocument").CvSection[]}
              onApplyToSections={(updated) => {
                try { reorderSections(updated as any); } catch { /* noop */ }
              }}
              onResult={(payload) => {
                if (typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true) {
                  try { console.debug("[ProfileReviewCard] structured payload", payload); } catch { /* noop */ }
                }
              }}
              renderAs="dropdown"
            />
          </div>

          <CvRenameDialog
            open={isRenameDialogOpen}
            currentTitle={currentCv.title}
            onClose={() => setIsRenameDialogOpen(false)}
            onSave={(nextTitle) => {
              try {
                renameCv(currentCv.id, nextTitle);
                setIsRenameDialogOpen(false);
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[ProfileReviewCard] renameCv failed", err);
              }
            }}
          />

          <div>
            {sections.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "var(--s3)",
                  padding: "var(--s7) var(--s5)",
                  borderRadius: "var(--rm)",
                  border: "1px solid var(--bo)",
                  background: "var(--sfr)",
                  boxShadow: "var(--sha)",
                  textAlign: "center",
                  color: "var(--tg2)",
                }}
              >
                <FileText size={24} strokeWidth={1.3} />
                <span style={{ fontSize: "var(--ts)", fontWeight: 500 }}>No sections yet — add one below</span>
              </div>
            ) : DISABLE_DND_FOR_DEBUG ? (
              <>
                {/* Debug: render without DnD to avoid mount/unmount churn and isolate click issues */}
                {DEBUG_CV_EDITOR && console.debug("[ProfileReviewCard] DnD disabled in debug mode")}
                {sections.map((section, idx) => (
                  <div key={String(section.id ?? "")} className="mb-6">
                    <SectionComponent
                      section={section}
                      index={idx}
                      onChange={(_i, updated) => {
                        try {
                          updateSectionInDoc(updated as any);
                        } catch {
                          /* noop */
                        }
                      }}
                    />
                  </div>
                ))}
              </>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={sections.map((s) => String(s.id ?? ""))} strategy={verticalListSortingStrategy}>
                  {sections.map((section, idx) => (
                    <SortableSection key={String(section.id ?? "")} section={section} index={idx} />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfileReviewCard;
