import React, { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import SectionComponent from "./cv-editor/Section";
import SelectedBlockInspector from "./SelectedBlockInspector";
import { ensureRemirrorDoc } from "./remirror-editor/utils/conversion";
import type { CvSection, CvBlock } from "../schemas/cvDocument.schema";
import type { RemirrorJSON } from "remirror";
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
import DebugPanel from "../components/dev/debug-panel";
import { isV1SectionsEnabled } from "../lib/flags";

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
 * - Renders the new block-based SectionComponent for each section
 * - Wires a couple of simple buttons to test atomic actions (update title / add block)
 */
export function ProfileReviewCard({ cvId, profile }: Props) {
  const {
    currentCv,
    loadCv,
    isLoading,
    isDirty,
    addBlock,
    reorderSections,
    addSection,
    closeInspector,
  } = useCvLibrary();

  useEffect(() => {
    if (!cvId) return;
    void loadCv(cvId).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[ProfileReviewCard] loadCv failed for id", cvId, err);
    });
  }, [cvId, loadCv]);

  const sections: CvSection[] = (currentCv?.sections ?? []) as CvSection[];
  const sensors = useSensors(useSensor(PointerSensor));
  const DEBUG_CV_EDITOR = typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true;
  // TEMPORARILY DISABLE DnD GLOBALLY to stabilize inspector flow. Re-enable after DnD refactor.
  const DISABLE_DND_FOR_DEBUG = true;

  // Local debug UI state
  const [cvIdInput, setCvIdInput] = useState<string>(cvId ?? "");
  const [selectedSectionId, setSelectedSectionId] = useState<string | undefined>(
    () => (sections.length > 0 ? String(sections[0].id ?? "") : undefined)
  );
  // Selected type when adding a new section (desktop dropdown). Empty string => no selection.
  const [selectedNewSectionType, setSelectedNewSectionType] = useState<string>("");
  // Mobile bottom-sheet open state
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState<boolean>(false);

  // Simple in-component toast notifications for debugging (no external deps)
  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  function pushToast(message: string) {
    const id = uuidv4();
    setToasts((s) => [...s, { id, message }]);
    // auto-dismiss
    setTimeout(() => setToasts((s) => s.filter((t) => t.id !== id)), 3500);
  }

  // When a new CV is loaded, default the selected section to the first one
  React.useEffect(() => {
    if (currentCv?.sections && currentCv.sections.length > 0) {
      setSelectedSectionId(String(currentCv.sections[0].id ?? ""));
    } else {
      setSelectedSectionId(undefined);
    }
  }, [currentCv]);

  function handleAddBlock(section: CvSection) {
    const id = section.id;
    if (!id) return;
    const newBlock: CvBlock = {
      id: uuidv4(),
      type: "text",
      content: ensureRemirrorDoc(undefined as any) as RemirrorJSON,
    };
    addBlock(id, newBlock);
  }

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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={`Drag ${section.title}`}
              className="p-1 rounded hover:bg-neutral-100"
              {...attributes}
              {...listeners}
            >
              {/* simple drag handle · use three bars */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M3 9h18M3 15h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-sm text-neutral-600">{section.type}</span>
          </div>
          <div className="space-x-2">
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-neutral-100 hover:bg-neutral-200"
              onClick={() => handleAddBlock(section)}
            >
              Add Block
            </button>
          </div>
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

  function handleLoadClick() {
    if (!cvIdInput) {
      pushToast("No cvId provided");
      return;
    }
    pushToast(`Loading CV ${cvIdInput}...`);
    // eslint-disable-next-line no-console
    console.log("[ProfileReviewCard] loadCv called with", cvIdInput);
    void loadCv(cvIdInput)
      .then(() => {
        pushToast(`Loaded CV ${cvIdInput}`);
        // eslint-disable-next-line no-console
        console.log("[ProfileReviewCard] loadCv succeeded for", cvIdInput);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[ProfileReviewCard] loadCv failed for id", cvIdInput, err);
        pushToast(`Load failed: ${String(err)}`);
      });
  }

  function handleAddSection(type?: string) {
    try {
      let newSection: CvSection;
      if (type) {
        // Generate a full template and pick the matching section to ensure schema-compliance.
        try {
          const tmpl = isV1SectionsEnabled() ? generateCvTemplateV1() : generateCvTemplate();
          const matched = tmpl.sections.find((s) => s.type === (type as any));
          if (matched) {
                // Clone and give it a unique id for this document.
                newSection = { ...matched, id: uuidv4() } as CvSection;
              } else {
                // Fallback to a minimal text section if type not found.
                newSection = {
                  id: uuidv4(),
                  title: String(type),
                  type: "text",
                  blocks: [],
                  structuredContent: null,
                  collapsed: false,
                } as CvSection;
              }
        } catch (err) {
          // If template generation fails, fallback gracefully.
          // eslint-disable-next-line no-console
          console.error("[ProfileReviewCard] generateCvTemplate failed", err);
          newSection = {
            id: uuidv4(),
            title: String(type ?? "New Section"),
            type: "text",
            blocks: [],
            structuredContent: null,
            collapsed: false,
          } as CvSection;
        }
      } else {
        // Legacy behavior: add an empty text section.
        newSection = {
          id: uuidv4(),
          title: "New Section",
          type: "text",
          blocks: [],
          structuredContent: undefined,
          collapsed: false,
        } as CvSection;
      }

      // eslint-disable-next-line no-console
      console.log("[ProfileReviewCard] addSection called", newSection);
      addSection(newSection);
      pushToast("Section added");
      setSelectedSectionId(newSection.id);
      // Clear the "new section type" selection after insertion (desktop UX).
      setSelectedNewSectionType("");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[ProfileReviewCard] addSection failed", err);
      pushToast("Failed to add section");
    }
  }

  function handleAddBlockToSelected() {
    const targetSectionId = selectedSectionId ?? sections[0]?.id;
    if (!targetSectionId) {
      pushToast("No section selected to add block");
      return;
    }
    const newBlock: CvBlock = {
      id: uuidv4(),
      type: "text",
      content: ensureRemirrorDoc(undefined as any) as RemirrorJSON,
    };
    // eslint-disable-next-line no-console
    console.log("[ProfileReviewCard] addBlock called for section", targetSectionId, newBlock);
    addBlock(String(targetSectionId), newBlock);
    pushToast("Block added");
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
            className="px-3 py-2 text-sm bg-white border rounded shadow-md border-neutral-200"
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Debug controls: quick load and create actions */}
      {/* Debug panel (embedded here so it's colocated with Add Section toolbar) */}
      <DebugPanel />
      <div className="p-3 mb-4 border rounded-md bg-neutral-50 dark:bg-neutral-900">
        <div className="flex items-center gap-2">
          <input
            aria-label="CV id"
            className="px-2 py-1 border rounded"
            value={cvIdInput}
            onChange={(e) => setCvIdInput(e.target.value)}
            placeholder="Enter cvId and click Load"
          />
          <button
            type="button"
            className="px-3 py-1 rounded bg-neutral-100 hover:bg-neutral-200"
            onClick={handleLoadClick}
          >
            Load CV
          </button>

          <div className="flex items-center gap-2 ml-4">
            <select
              aria-label="Select section"
              className="px-2 py-1 border rounded"
              value={selectedSectionId ?? ""}
              onChange={(e) => setSelectedSectionId(e.target.value || undefined)}
            >
              <option value="">— select section —</option>
              {sections.map((s) => (
                <option key={String(s.id)} value={String(s.id ?? "")}>
                  {s.title || s.type}
                </option>
              ))}
            </select>

            <select
              aria-label="Add section type"
              className="px-2 py-1 border rounded"
              value={selectedNewSectionType}
              onChange={(e) => setSelectedNewSectionType(e.target.value)}
            >
              {isV1SectionsEnabled() ? (
                <>
                  <option value="">— add section —</option>
                  <option value="profile">Profile</option>
                  <option value="summary">Summary</option>
                  <option value="skills">Skills</option>
                  <option value="languages">Languages</option>
                </>
              ) : (
                <>
                  <option value="">— add section —</option>
                  <option value="summary">Summary</option>
                  <option value="experience">Experience</option>
                  <option value="education">Education</option>
                  <option value="skills">Skills</option>
                  <option value="projects">Projects</option>
                  <option value="certifications">Certifications</option>
                  <option value="contact">Contact</option>
                </>
              )}
            </select>

            <button
              type="button"
              className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200"
              onClick={() => handleAddSection(selectedNewSectionType || undefined)}
            >
              Add Section
            </button>

            {/* Mobile-only: open bottom sheet for selecting section type */}
            <button
              type="button"
              className="block px-2 py-1 ml-2 rounded bg-neutral-100 hover:bg-neutral-200 sm:hidden"
              onClick={() => setIsBottomSheetOpen(true)}
              aria-label="Add section (mobile)"
            >
              Add
            </button>

            <button
              type="button"
              className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200"
              onClick={handleAddBlockToSelected}
            >
              Add Block
            </button>
          </div>
        </div>
      </div>

      {/* Add Section Bottom Sheet (mobile) */}
      <AddSectionBottomSheet
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        onSelect={(type) => handleAddSection(type)}
      />

      {/* Live debug: show current CV JSON for quick inspection */}
      <div className="p-3 mb-4 overflow-auto text-xs border rounded bg-white/80 dark:bg-black/60 max-h-48">
        <div className="flex items-center justify-between mb-2">
          <strong className="text-sm">Current CV (debug)</strong>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-neutral-100 hover:bg-neutral-200"
              onClick={() => {
                // eslint-disable-next-line no-console
                console.log("[ProfileReviewCard] currentCv", currentCv);
                pushToast("Logged currentCv to console");
              }}
            >
              Log JSON
            </button>
            <button
              type="button"
              className="px-2 py-1 text-xs rounded bg-neutral-100 hover:bg-neutral-200"
              onClick={() => {
                if (!currentCv) {
                  pushToast("No current CV to copy");
                  return;
                }
                try {
                  window.navigator.clipboard.writeText(JSON.stringify(currentCv, null, 2));
                  pushToast("CV JSON copied to clipboard");
                } catch {
                  pushToast("Copy failed");
                }
              }}
            >
              Copy JSON
            </button>
          </div>
        </div>
        <pre className="text-xs break-words whitespace-pre-wrap text-neutral-700 dark:text-neutral-200">{currentCv ? JSON.stringify(currentCv, null, 2) : "No currentCv loaded"}</pre>
      </div>

      {isLoading && (
        <div className="p-3 border rounded-md border-neutral-200 bg-background text-foreground">
          Loading...
        </div>
      )}

      {!isLoading && !currentCv && (
        <div className="p-4 border rounded-md border-neutral-200 bg-background text-foreground">
          <p className="mb-2">No CV loaded.</p>
          <p className="text-sm text-neutral-500">
            Provide a <code>cvId</code> prop to load a CV, or open the library to select one.
          </p>
        </div>
      )}

      {!isLoading && currentCv && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{currentCv.title}</h2>
            <div className="text-sm">
              {isDirty ? (
                <span className="text-yellow-600">Saving...</span>
              ) : (
                <span className="text-green-600">Saved</span>
              )}
            </div>
          </div>

          <div>
            {sections.length === 0 ? (
              <div className="p-3 border rounded-md border-neutral-200 bg-background text-foreground">
                This CV has no sections yet.
              </div>
            ) : DISABLE_DND_FOR_DEBUG ? (
              <>
                {/* Debug: render without DnD to avoid mount/unmount churn and isolate click issues */}
                {DEBUG_CV_EDITOR && console.debug("[ProfileReviewCard] DnD disabled in debug mode")}
                {sections.map((section, idx) => (
                  <div key={String(section.id ?? "")} className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-neutral-600">{section.type}</span>
                      </div>
                      <div className="space-x-2">
                        <button
                          type="button"
                          className="px-2 py-1 text-xs rounded bg-neutral-100 hover:bg-neutral-200"
                          onClick={() => handleAddBlock(section)}
                        >
                          Add Block
                        </button>
                      </div>
                    </div>
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