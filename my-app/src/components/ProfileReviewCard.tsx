import React, { useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  Check,
  ChevronDown,
  FileText,
  GripHorizontal,
  Pencil,
  X,
} from "@/lib/icons";
import { useNavigate } from "react-router-dom";
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
import { isV1SectionsEnabled } from "../lib/flags";
import StructuredUploadButton from "./StructuredUploadButton";
import CvRenameDialog from "./CvRenameDialog";
import type { CvDocument } from "../types/cvDocument";
import { deriveCvTitleFromSections } from "../lib/normalize-cv";

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
  const navigate = useNavigate();
  const {
    currentCv,
    currentCvId,
    loadCv,
    isLoading,
    reorderSections,
    addSection,
    createNewCv,
    importCv,
    closeInspector,
    renameCv,
    isV1Active,
  } = useCvLibrary();

  // Use document-driven runtime detector primarily; fall back to env flag
  const v1Enabled = isV1Active || isV1SectionsEnabled();
  const requestedCvIdRef = useRef<string | null>(null);
  const addSectionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!cvId) {
      requestedCvIdRef.current = null;
      return;
    }

    const targetId = String(cvId);
    if (currentCvId === targetId) {
      requestedCvIdRef.current = targetId;
      return;
    }
    if (requestedCvIdRef.current === targetId) return;

    requestedCvIdRef.current = targetId;
    try {
      const immediate = loadCv(targetId);
      if (!immediate) {
        // Background refresh will update state when ready
      }
    } catch (err) {
      requestedCvIdRef.current = null;
      // eslint-disable-next-line no-console
      console.error("[ProfileReviewCard] loadCv failed for id", cvId, err);
    }
  }, [currentCvId, cvId, loadCv]);

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
      const structuredText = extractLooseText(
        (section as any).structuredContent,
      );
      if (structuredText) return true;
      const blockText = extractLooseText((section as any).blocks);
      return Boolean(blockText);
    });
  }, [sections]);
  const sectionCatalog = useMemo(() => {
    return v1Enabled
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
  }, [v1Enabled, hasMeaningfulAchievementsSection]);
  const addableSectionOptions = useMemo(() => {
    const existingTypes = new Set(
      sections.map((section) => String(section.type ?? "")),
    );
    return sectionCatalog.filter((option) => !existingTypes.has(option.value));
  }, [sectionCatalog, sections]);
  const removableAddedSectionTypes = useMemo(() => {
    const existingTypes = new Set(
      sections.map((section) => String(section.type ?? "")),
    );
    return sectionCatalog
      .map((option) => option.value)
      .filter((value) => existingTypes.has(value));
  }, [sectionCatalog, sections]);

  React.useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window as any).__CV_EDITOR_DEBUG__ === true
    ) {
      try {
        // eslint-disable-next-line no-console
        console.debug(
          "[ProfileReviewCard] sections snapshot",
          sections.map((section) => ({
            type: section.type,
            blocks: section.blocks?.length ?? 0,
            items: Array.isArray((section as any)?.structuredContent)
              ? (section as any).structuredContent.length
              : null,
          })),
        );
      } catch {
        /* noop */
      }
    }
  }, [sections]);
  const sensors = useSensors(useSensor(PointerSensor));
  const DEBUG_CV_EDITOR =
    typeof window !== "undefined" &&
    (window as any).__CV_EDITOR_DEBUG__ === true;
  // TEMPORARILY DISABLE DnD GLOBALLY to stabilize inspector flow. Re-enable after DnD refactor.
  const DISABLE_DND_FOR_DEBUG = true;

  const [recentlyAddedSectionType, setRecentlyAddedSectionType] =
    useState<string>("");
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState<boolean>(false);
  const [isAddSectionMenuOpen, setIsAddSectionMenuOpen] =
    useState<boolean>(false);

  // Simple in-component toast notifications for debugging (no external deps)
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  function pushToast(message: string) {
    const id = uuidv4();
    setToasts((s) => [...s, { id, message }]);
    // auto-dismiss
    setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), 3500);
  }

  async function importSectionsIntoFreshCv(updated: CvSection[]) {
    if (!Array.isArray(updated) || updated.length === 0) {
      pushToast("No importable sections were found");
      return;
    }

    const now = new Date().toISOString();
    const importedDoc: CvDocument = {
      id: uuidv4(),
      title: deriveCvTitleFromSections(updated as any, "Imported CV"),
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
      sections: updated as any,
    };

    try {
      await importCv(importedDoc);
    } catch {
      pushToast("Failed to import CV");
    }
  }

  React.useEffect(() => {
    if (!recentlyAddedSectionType) return;
    const timeoutId = window.setTimeout(() => {
      setRecentlyAddedSectionType("");
    }, 1100);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [recentlyAddedSectionType]);

  React.useEffect(() => {
    if (!currentCv) {
      setIsRenameDialogOpen(false);
    }
  }, [currentCv]);

  React.useEffect(() => {
    if (!isAddSectionMenuOpen) return undefined;

    const handleDocumentClick = (event: MouseEvent) => {
      if (addSectionMenuRef.current?.contains(event.target as Node)) return;
      setIsAddSectionMenuOpen(false);
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [isAddSectionMenuOpen]);

  /**
   * Replace an updated section into the current document via context.
   * Uses reorderSections to persist changes.
   */
  function updateSectionInDoc(updated: CvSection) {
    try {
      const updatedList = sections.map((s) =>
        String(s.id) === String(updated.id) ? (updated as CvSection) : s,
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
  function SortableSection({
    section,
    index,
  }: {
    section: CvSection;
    index: number;
  }) {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({
        id: section.id,
      } as any);
    const style: React.CSSProperties = {
      transform: transform
        ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
        : undefined,
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
      const typedSingletons = new Set([
        "profile",
        "summary",
        "experience",
        "education",
        "skills",
        "languages",
        "achievements",
      ]);
      const existingTypes = new Set(
        (currentCv?.sections ?? sections).map((s) => String((s as any).type)),
      );
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
        const typedV1Set = new Set([
          "profile",
          "summary",
          "experience",
          "achievements",
          "education",
          "skills",
          "languages",
        ]);
        const optionalV1SectionSet = new Set(["achievements", "languages"]);
        const forceV1ForType = typedV1Set.has(String(type));
        const tmpl = forceV1ForType
          ? generateCvTemplateV1()
          : v1Enabled
            ? generateCvTemplateV1()
            : generateCvTemplate();

        // Dev log to aid QA: which template we picked and why
        if (process.env.NODE_ENV !== "production") {
          try {
            // eslint-disable-next-line no-console
            console.debug(
              "[ProfileReviewCard] handleAddSection templateChoice",
              {
                requestedType: type,
                forceV1ForType,
                v1Enabled,
                chosenTemplate: forceV1ForType
                  ? "generateCvTemplateV1"
                  : v1Enabled
                    ? "generateCvTemplateV1"
                    : "generateCvTemplate",
              },
            );
          } catch {}
        }

        let matched = tmpl.sections.find((s) => s.type === (type as any));
        if (
          !matched &&
          forceV1ForType &&
          optionalV1SectionSet.has(String(type))
        ) {
          const optionalTemplate = generateCvTemplate();
          matched = optionalTemplate.sections.find(
            (s) => s.type === (type as any),
          );
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
      const preferredOrderIndex = new Map<string, number>(
        preferredSectionOrder.map((sectionType, index): [string, number] => [
          sectionType,
          index,
        ]),
      );

      const existingSections = (currentCv?.sections ?? sections) as CvSection[];
      if (existingSections.length > 0) {
        const nextSections = [...existingSections, newSection];
        const orderedSections = nextSections
          .map((section, index) => ({ section, index }))
          .sort((a, b) => {
            const aType = String(a.section.type ?? "");
            const bType = String(b.section.type ?? "");
            const aRank =
              preferredOrderIndex.get(aType) ?? Number.MAX_SAFE_INTEGER;
            const bRank =
              preferredOrderIndex.get(bType) ?? Number.MAX_SAFE_INTEGER;
            if (aRank !== bRank) return aRank - bRank;
            return a.index - b.index;
          })
          .map(({ section }) => section);

        reorderSections(orderedSections as any);
      } else {
        addSection(newSection);
      }
      pushToast("Section added");
      setRecentlyAddedSectionType(type);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[ProfileReviewCard] addSection failed", err);
      pushToast("Failed to add section");
    }
  }

  function handleClearAddedSections() {
    const removableTypes = new Set(removableAddedSectionTypes);
    if (removableTypes.size === 0) {
      pushToast("No added sections to remove");
      return;
    }

    const nextSections = sections.filter(
      (section) => !removableTypes.has(String(section.type ?? "")),
    );

    if (nextSections.length === sections.length) {
      pushToast("No added sections to remove");
      return;
    }

    if (nextSections.length === 0) {
      pushToast("Core sections must remain in the CV");
      return;
    }

    reorderSections(nextSections as any);
    pushToast("Added sections removed");
  }

  return (
    <div>
      {/* Always mount the inspector; it renders null when no selection to avoid mount/unmount churn */}
      <SelectedBlockInspector onClose={closeInspector} />

      {/* Toast container (debug) */}
      <div
        aria-live="polite"
        className="fixed z-50 flex flex-col gap-2 top-4 right-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="px-3 py-2 text-ts [background:var(--sfr)] border [border-radius:var(--radius-control)] [box-shadow:var(--sha)] [border-color:var(--color-border)]"
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Toolbar is rendered below the title only when a CV is loaded — see the !isLoading && currentCv block */}

      {isLoading && (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}
        >
          {/* Title row shimmer */}
          <div
            className="shimmer-line"
            style={{
              height: 24,
              width: "55%",
              borderRadius: "var(--radius-inline)",
            }}
          />
          {/* Toolbar shimmer */}
          <div
            className="shimmer-line"
            style={{
              height: 36,
              width: "100%",
              borderRadius: "var(--radius-inline)",
            }}
          />
          {/* Section cards shimmer */}
          {[0.9, 0.75, 0.85].map((w, i) => (
            <div
              key={i}
              style={{
                borderRadius: "var(--radius-card)",
                border: "1px solid var(--color-border)",
                overflow: "hidden",
              }}
            >
              <div
                className="shimmer-line"
                style={{ height: 48, width: "100%", borderRadius: 0 }}
              />
              <div
                style={{
                  padding: "var(--s4)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s3)",
                }}
              >
                <div
                  className="shimmer-line"
                  style={{ height: 12, width: `${Math.round(w * 100)}%` }}
                />
                <div
                  className="shimmer-line"
                  style={{
                    height: 12,
                    width: `${Math.round((w - 0.2) * 100)}%`,
                  }}
                />
                <div
                  className="shimmer-line"
                  style={{
                    height: 12,
                    width: `${Math.round((w - 0.1) * 100)}%`,
                  }}
                />
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
            borderRadius: "var(--radius-surface)",
            border: "1px solid var(--color-border)",
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
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--color-border)",
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
            <p
              style={{
                fontSize: "var(--ts)",
                color: "var(--tg2)",
                lineHeight: "var(--ls)",
                margin: 0,
              }}
            >
              Select a resume from the sidebar, or create a new one to get
              started.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              gap: "var(--s2)",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <StructuredUploadButton
              contextKey="cvforge-empty-state"
              onApplyToSections={(updated) => {
                void importSectionsIntoFreshCv(updated);
              }}
              renderAs="dropdown"
            />
            <button
              type="button"
              onClick={() => {
                void createNewCv(undefined, { forceV1: true });
              }}
              className="dasti-button dasti-button--primary dasti-button--pill"
            >
              Create new CV
            </button>
            <button
              type="button"
              onClick={() => void navigate("/cvs")}
              className="dasti-button dasti-button--secondary dasti-button--pill"
            >
              Open library
            </button>
          </div>
        </div>
      )}

      {!isLoading && currentCv && (
        <div>
          <div
            className="mb-4 dasti-cluster"
            style={
              {
                "--cluster-gap": "var(--space-2)",
                alignItems: "center",
              } as React.CSSProperties
            }
          >
            {addableSectionOptions.length > 0 ? (
              <div
                ref={addSectionMenuRef}
                className="dasti-import-dropdown"
                style={{ flex: "0 0 auto" }}
              >
                <button
                  type="button"
                  aria-label="Add section"
                  className="dasti-select dasti-select--sm dasti-add-section-trigger"
                  onClick={() => setIsAddSectionMenuOpen((current) => !current)}
                >
                  <span
                    className="dasti-add-section-trigger__spacer"
                    aria-hidden
                  />
                  <span className="dasti-add-section-trigger__label">
                    Add section
                  </span>
                  <span className="dasti-add-section-trigger__icon">
                    {isAddSectionMenuOpen ? (
                      <X className="h-4 w-4 [color:var(--ti)]" aria-hidden />
                    ) : recentlyAddedSectionType ? (
                      <Check
                        className="h-4 w-4 [color:var(--color-accent)]"
                        aria-hidden
                      />
                    ) : (
                      <ChevronDown
                        className="h-4 w-4 [color:var(--tg2)]"
                        aria-hidden
                      />
                    )}
                  </span>
                </button>
                {isAddSectionMenuOpen ? (
                  <div className="dasti-import-dropdown__menu dasti-add-section-menu">
                    {addableSectionOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="dasti-menu-option dasti-menu-option--section"
                        onClick={() => {
                          handleAddSection(option.value);
                          setIsAddSectionMenuOpen(false);
                        }}
                      >
                        <div className="dasti-menu-option__row">
                          <div className="dasti-menu-option__copy">
                            <div className="dasti-menu-option__title">
                              {option.label}
                            </div>
                            {option.value === "achievements" ||
                            option.value === "languages" ? null : (
                              <div className="dasti-menu-option__description">
                                Add {option.label.toLowerCase()} to this resume.
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : removableAddedSectionTypes.length > 0 ? (
              <button
                type="button"
                className="dasti-add-section-state dasti-add-section-state--resettable"
                onClick={handleClearAddedSections}
                aria-label="Delete added sections"
                title="Delete added sections"
              >
                <span className="dasti-add-section-state__copy">
                  <span className="dasti-add-section-state__label dasti-add-section-state__label--default">
                    All sections added
                  </span>
                  <span className="dasti-add-section-state__label dasti-add-section-state__label--hover">
                    Delete added sections
                  </span>
                </span>
                <span className="dasti-add-section-state__icon">
                  <span className="dasti-add-section-state__icon-layer dasti-add-section-state__icon-layer--base">
                    <Check size={14} strokeWidth={2.1} aria-hidden />
                  </span>
                  <span className="dasti-add-section-state__icon-layer dasti-add-section-state__icon-layer--hover">
                    <X size={13} strokeWidth={2.1} aria-hidden />
                  </span>
                </span>
              </button>
            ) : (
              <span className="text-xs [color:var(--tg2)]">
                All sections added.
              </span>
            )}

            {/* Import dropdown */}
            <StructuredUploadButton
              contextKey={currentCv?.id ?? ""}
              sections={
                sections as unknown as import("../types/cvDocument").CvSection[]
              }
              onApplyToSections={(updated) => {
                try {
                  reorderSections(updated as any);
                } catch {
                  /* noop */
                }
              }}
              onResult={(payload) => {
                if (
                  typeof window !== "undefined" &&
                  (window as any).__CV_EDITOR_DEBUG__ === true
                ) {
                  try {
                    console.debug(
                      "[ProfileReviewCard] structured payload",
                      payload,
                    );
                  } catch {
                    /* noop */
                  }
                }
              }}
              renderAs="dropdown"
            />

            <button
              type="button"
              className="dasti-icon-button"
              onClick={() => setIsRenameDialogOpen(true)}
              aria-label="Rename resume"
              title="Rename resume"
            >
              <Pencil size={14} strokeWidth={1.8} aria-hidden />
            </button>
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
                  borderRadius: "var(--radius-card)",
                  border: "1px solid var(--color-border)",
                  background: "var(--sfr)",
                  boxShadow: "var(--sha)",
                  textAlign: "center",
                  color: "var(--tg2)",
                }}
              >
                <FileText size={24} strokeWidth={1.3} />
                <span style={{ fontSize: "var(--ts)", fontWeight: 500 }}>
                  No sections yet — add one below
                </span>
              </div>
            ) : DISABLE_DND_FOR_DEBUG ? (
              <>
                {/* Debug: render without DnD to avoid mount/unmount churn and isolate click issues */}
                {DEBUG_CV_EDITOR &&
                  console.debug(
                    "[ProfileReviewCard] DnD disabled in debug mode",
                  )}
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={sections.map((s) => String(s.id ?? ""))}
                  strategy={verticalListSortingStrategy}
                >
                  {sections.map((section, idx) => (
                    <SortableSection
                      key={String(section.id ?? "")}
                      section={section}
                      index={idx}
                    />
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
