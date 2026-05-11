import React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeClosed, GripHorizontal, Plus, TrashSimple, Wand2 } from "@/lib/icons";
import { Menu } from "../ui";
import type { CvSection } from "../../types/cvDocument";
import {
  formatSectionDisplayTitle,
  getSectionOrganizationControlPolicy,
} from "../../lib/cv-section-organization";
import { getCanonicalSectionType } from "../../features/verbati/resumeLinking";

export type CvAddSectionKind =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "achievements"
  | "certifications"
  | "publications"
  | "awards"
  | "volunteer"
  | "references"
  | "languages"
  | "hobbies"
  | "additional_information"
  | "custom";

type CvSectionsOrganizerToneChoice = "warm" | "formal" | "natural";

export type CvSectionsOrganizerProps = {
  sections: CvSection[];
  hiddenSectionIds: string[];
  activeSectionId: string | null;
  selectedTone: CvSectionsOrganizerToneChoice;
  onSelectSection: (sectionId: string, options?: { openEditor?: boolean }) => void;
  onToggleHiddenSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSections: (activeSectionId: string, overSectionId: string) => void;
  onMoveSection: (sectionId: string, direction: -1 | 1) => void;
  onAskAiForSection: (sectionId: string) => void;
  onRunAskAiForSection: (args: {
    sectionId: string;
    prompt: string;
    tone: CvSectionsOrganizerToneChoice;
  }) => Promise<void>;
  onAddSection: (sectionKind: CvAddSectionKind) => void;
};

const ADD_SECTION_ITEMS: Array<{ id: CvAddSectionKind; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "experience", label: "Experience" },
  { id: "education", label: "Education" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "achievements", label: "Achievements" },
  { id: "certifications", label: "Certifications" },
  { id: "languages", label: "Languages" },
  { id: "hobbies", label: "Hobbies" },
];

const SINGLETON_ADD_SECTION_KINDS = new Set<CvAddSectionKind>([
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "achievements",
  "certifications",
  "languages",
  "hobbies",
]);

const ADD_SECTION_KIND_BY_CANONICAL_TYPE: Partial<
  Record<NonNullable<ReturnType<typeof getCanonicalSectionType>>, CvAddSectionKind>
> = {
  summary: "summary",
  experience: "experience",
  education: "education",
  skills: "skills",
  projects: "projects",
  achievements: "achievements",
  certifications: "certifications",
  languages: "languages",
  hobbies: "hobbies",
};

function getSectionId(section: CvSection, index: number): string {
  return String(section.id ?? `${section.type}-${index}`);
}

function getItemCount(section: CvSection): number {
  if (Array.isArray(section.structuredContent)) {
    return section.structuredContent.length;
  }
  return Array.isArray(section.blocks) ? section.blocks.length : 0;
}

function isHobbiesSection(section: CvSection): boolean {
  return (
    String(section.type) === "hobbies" ||
    section.title.trim().toLowerCase() === "hobbies"
  );
}

function getRailAiMode(section: CvSection): "none" | "rail" | "editor" {
  if (section.type === "profile" || section.type === "contact") return "none";
  if (
    section.type === "summary" ||
    section.type === "skills" ||
    section.type === "languages" ||
    isHobbiesSection(section) ||
    section.type === "text"
  ) {
    return "rail";
  }
  return "editor";
}

function usesStructuredSuggestions(section: CvSection): boolean {
  return (
    section.type === "skills" ||
    section.type === "languages" ||
    isHobbiesSection(section)
  );
}

type SortableSectionRowProps = {
  sectionId: string;
  label: string;
  hidden: boolean;
  active: boolean;
  itemCount: number;
  showDragHandle: boolean;
  showMoveControls: boolean;
  dropIndicator?: "before" | "after" | null;
  onSelectSection: (sectionId: string, options?: { openEditor?: boolean }) => void;
  onMoveSection: (sectionId: string, direction: -1 | 1) => void;
  children: React.ReactNode;
};

function SortableSectionRow({
  sectionId,
  label,
  hidden,
  active,
  itemCount,
  showDragHandle,
  showMoveControls,
  dropIndicator = null,
  onSelectSection,
  onMoveSection,
  children,
}: SortableSectionRowProps): JSX.Element {
  const sortable = useSortable({
    id: sectionId,
    disabled: !showDragHandle,
    transition: {
      duration: 260,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
    },
  });
  const rowTransition = sortable.transition
    ? `${sortable.transition}, border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-normal) var(--motion-ease-emphasized), opacity var(--motion-duration-fast) var(--motion-ease-standard)`
    : "transform var(--motion-duration-medium) var(--motion-ease-emphasized), border-color var(--motion-duration-fast) var(--motion-ease-standard), box-shadow var(--motion-duration-normal) var(--motion-ease-emphasized), opacity var(--motion-duration-fast) var(--motion-ease-standard)";
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: rowTransition,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      className="dasti-cv-org-row"
      data-active={active ? "true" : undefined}
      data-hidden={hidden ? "true" : undefined}
      data-dragging={sortable.isDragging ? "true" : undefined}
      data-drop-indicator={dropIndicator ?? undefined}
      style={style}
    >
      {showDragHandle ? (
        <button
          type="button"
          className="dasti-cv-org-handle"
          aria-label={`Reorder ${label}`}
          title="Drag to reorder"
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripHorizontal size={16} strokeWidth={1.8} />
        </button>
      ) : (
        <span className="dasti-cv-org-handle-spacer" aria-hidden="true" />
      )}
      <button
        type="button"
        className={`dasti-cv-org-row__main ${
          showDragHandle ? "dasti-cv-org-row__main--draggable" : ""
        }`.trim()}
        {...(showDragHandle ? sortable.attributes : {})}
        {...(showDragHandle ? sortable.listeners : {})}
        onClick={() => onSelectSection(sectionId, { openEditor: true })}
        onKeyDown={(event) => {
          if (!showMoveControls) return;
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onMoveSection(sectionId, -1);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            onMoveSection(sectionId, 1);
          }
        }}
      >
        <span className="dasti-cv-org-row__title">{label}</span>
        <span className="dasti-cv-org-row__count">
          {hidden ? "hidden" : itemCount > 1 ? `${itemCount} items` : ""}
        </span>
      </button>
      <span className="dasti-cv-org-row__actions">{children}</span>
    </div>
  );
}

function CvAddSectionMenu({
  sections,
  onAddSection,
}: {
  sections: CvSection[];
  onAddSection: (sectionKind: CvAddSectionKind) => void;
}): JSX.Element {
  const presentKinds = new Set(
    sections
      .map((section) => {
        const canonicalType = getCanonicalSectionType(section);
        return canonicalType ? ADD_SECTION_KIND_BY_CANONICAL_TYPE[canonicalType] : null;
      })
      .filter((kind): kind is CvAddSectionKind => Boolean(kind)),
  );
  const addableItems = ADD_SECTION_ITEMS.filter(
    (item) => !SINGLETON_ADD_SECTION_KINDS.has(item.id) || !presentKinds.has(item.id),
  );
  return (
    <Menu
      ariaLabel="Add a section"
      side="top"
      menuClassName="dasti-cv-add-section-menu"
      matchTriggerWidth
      sections={[
        {
          label: "Add a section",
          items: addableItems.map((item) => ({
            id: item.id,
            label: item.label,
            onSelect: () => onAddSection(item.id),
          })),
        },
        {
          items: [
            {
              id: "custom",
              label: "Custom section",
              icon: <Plus size={14} strokeWidth={1.8} />,
              onSelect: () => onAddSection("custom"),
            },
          ],
        },
      ]}
      trigger={
        <button type="button" className="dasti-cv-org-add">
          <Plus size={15} strokeWidth={1.8} aria-hidden="true" />
          Add section
        </button>
      }
    />
  );
}

export function CvSectionsOrganizer({
  sections,
  hiddenSectionIds,
  activeSectionId,
  selectedTone,
  onSelectSection,
  onToggleHiddenSection,
  onDeleteSection,
  onReorderSections,
  onMoveSection,
  onAskAiForSection,
  onRunAskAiForSection,
  onAddSection,
}: CvSectionsOrganizerProps): JSX.Element {
  const [activeDragSectionId, setActiveDragSectionId] = React.useState<
    string | null
  >(null);
  const [overDragSectionId, setOverDragSectionId] = React.useState<
    string | null
  >(null);
  const sortableSectionIds = React.useMemo(
    () => sections.map((section, index) => getSectionId(section, index)),
    [sections],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveDragSectionId(String(event.active.id));
    setOverDragSectionId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    setOverDragSectionId(event.over?.id ? String(event.over.id) : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    setActiveDragSectionId(null);
    setOverDragSectionId(null);
    if (overId && activeId !== overId) {
      onReorderSections(activeId, overId);
    }
  }

  function handleDragCancel() {
    setActiveDragSectionId(null);
    setOverDragSectionId(null);
  }

  return (
    <div className="dasti-cv-sections-organizer" data-cv-sections-organizer="true">
      <div className="dasti-cv-sections-organizer__head">
        <span className="dasti-cv-sections-organizer__label">Organize</span>
        <span className="dasti-cv-sections-organizer__hint">
          <span>Drag to reorder</span>
          <span aria-hidden="true">·</span>
          <Wand2 size={13} strokeWidth={1.8} aria-hidden="true" />
          <span>Improve with Ask</span>
        </span>
      </div>
      {sections.length === 0 ? (
        <div className="dasti-cv-sections-organizer__empty">No sections yet.</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={sortableSectionIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="dasti-cv-org-list">
              {sections.map((section, index) => {
                const sectionId = getSectionId(section, index);
                const hidden = hiddenSectionIds.includes(sectionId);
                const policy = getSectionOrganizationControlPolicy(section);
                const label = formatSectionDisplayTitle(section, {
                  fallback: "Section",
                });
                const activeDragIndex = activeDragSectionId
                  ? sortableSectionIds.indexOf(activeDragSectionId)
                  : -1;
                const dropIndicator =
                  activeDragIndex !== -1 &&
                  overDragSectionId === sectionId &&
                  activeDragSectionId !== sectionId
                    ? activeDragIndex < index
                      ? "after"
                      : "before"
                    : null;
                const railAiMode = getRailAiMode(section);
                return (
                  <SortableSectionRow
                    key={sectionId}
                    sectionId={sectionId}
                    label={label}
                    hidden={hidden}
                    active={sectionId === activeSectionId}
                    itemCount={getItemCount(section)}
                    showDragHandle={policy.showDragHandle}
                    showMoveControls={policy.showMoveControls}
                    dropIndicator={dropIndicator}
                    onSelectSection={onSelectSection}
                    onMoveSection={onMoveSection}
                  >
                    {railAiMode !== "none" ? (
                      <button
                        type="button"
                        className="dasti-cv-org-row__action dasti-cv-org-row__action--wand"
                        title={
                          railAiMode === "rail"
                            ? `Ask for ${label}`
                            : `Open ${label} item editor`
                        }
                        aria-label={
                          railAiMode === "rail"
                            ? `Ask for ${label}`
                            : `Open ${label} item editor`
                        }
                        onClick={() => {
                          if (usesStructuredSuggestions(section)) {
                            onSelectSection(sectionId, { openEditor: true });
                            void onRunAskAiForSection({
                              sectionId,
                              prompt: "",
                              tone: selectedTone,
                            });
                            return;
                          }
                          if (railAiMode === "rail") {
                            onAskAiForSection(sectionId);
                            void onRunAskAiForSection({
                              sectionId,
                              prompt: "",
                              tone: selectedTone,
                            });
                            return;
                          }
                          onSelectSection(sectionId, { openEditor: true });
                        }}
                      >
                        <Wand2 size={14} strokeWidth={1.8} aria-hidden="true" />
                      </button>
                    ) : null}
                    {policy.showVisibilityToggle ? (
                      <button
                        type="button"
                        className="dasti-cv-org-row__action"
                        title={hidden ? "Show" : "Hide"}
                        aria-label={`${hidden ? "Show" : "Hide"} ${label}`}
                        onClick={() => onToggleHiddenSection(sectionId)}
                      >
                        {hidden ? (
                          <EyeClosed size={14} strokeWidth={1.8} aria-hidden="true" />
                        ) : (
                          <Eye size={14} strokeWidth={1.8} aria-hidden="true" />
                        )}
                      </button>
                    ) : null}
                    {policy.showDeleteControl ? (
                      <button
                        type="button"
                        className="dasti-cv-org-row__action"
                        data-tone="danger"
                        title="Delete"
                        aria-label={`Delete ${label}`}
                        onClick={() => onDeleteSection(sectionId)}
                      >
                        <TrashSimple size={14} strokeWidth={1.8} aria-hidden="true" />
                      </button>
                    ) : null}
                  </SortableSectionRow>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <CvAddSectionMenu sections={sections} onAddSection={onAddSection} />
      <div className="dasti-cv-sections-organizer__footer-hint">
        Open a section row to edit its items.
      </div>
    </div>
  );
}

export default CvSectionsOrganizer;
