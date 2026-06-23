/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import React from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DraggableAttributes,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeClosed,
  GripHorizontal,
  TrashSimple,
} from "@/lib/icons";
import type { CvSection } from "../../types/cvDocument";
import {
  formatSectionDisplayTitle,
  getSectionOrganizationControlPolicy,
  isSectionHideLocked,
  isSectionRemovableInOrganization,
  isSectionReorderLocked,
} from "../../lib/cv-section-organization";

type SortableListeners = ReturnType<typeof useSortable>["listeners"];

type OrganizeSectionsListProps = {
  sections: CvSection[];
  hiddenSectionIds: string[];
  onHiddenSectionIdsChange: (hiddenSectionIds: string[]) => void;
  onReorderSections: (sections: CvSection[]) => void;
  onDeleteSection: (sectionId: string) => void;
  onExitOrganizeMode: () => void;
};

function useDesktopDragEnabled() {
  const [isDesktopDragEnabled, setIsDesktopDragEnabled] = React.useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return true;
    }

    return window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches;
  });

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(
      "(min-width: 1024px) and (pointer: fine)",
    );
    const updateMatch = () => setIsDesktopDragEnabled(mediaQuery.matches);

    updateMatch();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateMatch);
      return () => mediaQuery.removeEventListener("change", updateMatch);
    }

    mediaQuery.addListener(updateMatch);
    return () => mediaQuery.removeListener(updateMatch);
  }, []);

  return isDesktopDragEnabled;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMatch = () => setPrefersReducedMotion(mediaQuery.matches);

    updateMatch();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateMatch);
      return () => mediaQuery.removeEventListener("change", updateMatch);
    }

    mediaQuery.addListener(updateMatch);
    return () => mediaQuery.removeListener(updateMatch);
  }, []);

  return prefersReducedMotion;
}

function moveSection(
  sections: CvSection[],
  activeSectionId: string,
  direction: -1 | 1,
) {
  const currentIndex = sections.findIndex(
    (section) => String(section.id ?? "") === activeSectionId,
  );
  if (currentIndex === -1) {
    return sections;
  }

  let targetIndex = currentIndex + direction;
  while (targetIndex >= 0 && targetIndex < sections.length) {
    if (!isSectionReorderLocked(sections[targetIndex]!)) {
      return arrayMove(sections, currentIndex, targetIndex);
    }
    targetIndex += direction;
  }

  return sections;
}

function getRowState(
  sections: CvSection[],
  section: CvSection,
  hiddenSectionIds: Set<string>,
) {
  const sectionId = String(section.id ?? "");
  const currentIndex = sections.findIndex(
    (candidate) => String(candidate.id ?? "") === sectionId,
  );
  const isHidden = hiddenSectionIds.has(sectionId);
  const reorderLocked = isSectionReorderLocked(section);
  const hideLocked = isSectionHideLocked(section);
  const removable = isSectionRemovableInOrganization(section);
  const controlPolicy = getSectionOrganizationControlPolicy(section);
  const moveUpSections = moveSection(sections, sectionId, -1);
  const moveDownSections = moveSection(sections, sectionId, 1);

  return {
    currentIndex,
    isHidden,
    reorderLocked,
    hideLocked,
    removable,
    controlPolicy,
    canMoveUp:
      controlPolicy.showMoveControls &&
      !reorderLocked &&
      moveUpSections !== sections &&
      moveUpSections[currentIndex] !== section,
    canMoveDown:
      controlPolicy.showMoveControls &&
      !reorderLocked &&
      moveDownSections !== sections &&
      moveDownSections[currentIndex] !== section,
  };
}

function buildSectionMetadata(rowState: ReturnType<typeof getRowState>) {
  const metadata: Array<{ label: string }> = [];

  if (rowState.hideLocked) {
    metadata.push({ label: "Always shown" });
  }

  return metadata;
}

function setSectionHiddenState(
  hiddenSectionIds: string[],
  sectionId: string,
  nextHidden: boolean,
) {
  if (nextHidden) {
    return hiddenSectionIds.includes(sectionId)
      ? hiddenSectionIds
      : [...hiddenSectionIds, sectionId];
  }

  return hiddenSectionIds.filter((candidateId) => candidateId !== sectionId);
}

function SectionCard(props: {
  section: CvSection;
  sections: CvSection[];
  hiddenSectionIds: Set<string>;
  desktopDragEnabled: boolean;
  activeDragSectionId: string | null;
  isDragging?: boolean;
  isDropTarget?: boolean;
  dragHandleAttributes?: DraggableAttributes;
  dragHandleListeners?: SortableListeners;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onHide: () => void;
  onShow: () => void;
  onDelete: () => void;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const {
    section,
    sections,
    hiddenSectionIds,
    desktopDragEnabled,
    activeDragSectionId,
    isDragging = false,
    isDropTarget = false,
    dragHandleAttributes,
    dragHandleListeners,
    onMoveUp,
    onMoveDown,
    onHide,
    onShow,
    onDelete,
    isActive,
    onActivate,
    onDeactivate,
  } = props;
  const sectionId = String(section.id ?? "");
  const rowState = getRowState(sections, section, hiddenSectionIds);
  const sectionTitle = formatSectionDisplayTitle(section, {
    fallback: "Untitled section",
  });
  const metadata = buildSectionMetadata(rowState);
  const isActiveDragSection = activeDragSectionId === sectionId;
  const deleteLabel = `Delete ${sectionTitle} section`;
  const hideShowLabel = rowState.isHidden
    ? `Show ${sectionTitle} section`
    : `Hide ${sectionTitle} section`;
  const showDragHandle =
    !rowState.isHidden &&
    desktopDragEnabled &&
    rowState.controlPolicy.showDragHandle &&
    !rowState.reorderLocked;
  const showMoveControls =
    !rowState.isHidden && rowState.controlPolicy.showMoveControls;
  const showVisibilityToggle = rowState.controlPolicy.showVisibilityToggle;
  const showHiddenDeleteControl =
    rowState.isHidden &&
    rowState.controlPolicy.showDeleteControl &&
    rowState.removable;
  const hasActionControls =
    showVisibilityToggle || showHiddenDeleteControl || showMoveControls;

  return (
    <article
      className="section-container-header cv-organize-section-row"
      data-testid={`organize-section-row-${sectionId}`}
      data-section-id={sectionId}
      data-section-active={isActive ? "true" : "false"}
      data-section-hidden={rowState.isHidden ? "true" : "false"}
      data-section-has-actions={hasActionControls ? "true" : "false"}
      data-section-drop-target={isDropTarget ? "true" : "false"}
      data-section-dragging={isDragging || isActiveDragSection ? "true" : "false"}
      aria-label={`Organize ${sectionTitle} section`}
      tabIndex={0}
      onFocusCapture={onActivate}
      onBlurCapture={(event) => {
        const nextFocusedElement = event.relatedTarget;
        if (
          nextFocusedElement instanceof Node &&
          event.currentTarget.contains(nextFocusedElement)
        ) {
          return;
        }

        onDeactivate();
      }}
    >
      <div
        className="cv-organize-section-row__handle"
        data-testid={`organize-section-handle-slot-${sectionId}`}
      >
        {showDragHandle ? (
          <button
            type="button"
            className="dasti-icon-button"
            aria-label={`Drag ${sectionTitle} section`}
            title={`Drag ${sectionTitle} section`}
            data-testid={`organize-section-drag-handle-${sectionId}`}
            {...dragHandleAttributes}
            {...dragHandleListeners}
          >
            <GripHorizontal size={16} strokeWidth={1.9} aria-hidden="true" />
          </button>
        ) : (
          <span
            className="cv-organize-section-row__handle-spacer"
            aria-hidden="true"
          />
        )}
      </div>
      <div
        className="cv-organize-section-row__primary"
        data-testid={`organize-section-primary-${sectionId}`}
      >
        <h3
          className="cv-section-heading cv-organize-section-row__title"
          data-testid={`organize-section-title-${sectionId}`}
        >
          {sectionTitle}
        </h3>
      </div>
      <div
        className="cv-organize-section-row__meta"
        data-testid={`organize-section-meta-${sectionId}`}
      >
        {metadata.map((item) => (
          <span key={item.label} className="dasti-pill">
            {item.label}
          </span>
        ))}
      </div>
      <div
        className="cv-organize-section-row__rail"
        data-testid={`organize-section-actions-${sectionId}`}
      >
        {showHiddenDeleteControl ? (
          <button
            type="button"
            className="dasti-icon-button cv-organize-section-row__action--delete"
            aria-label={deleteLabel}
            title={deleteLabel}
            onClick={onDelete}
          >
            <TrashSimple size={16} strokeWidth={1.7} aria-hidden="true" />
          </button>
        ) : null}
        {showMoveControls ? (
          <button
            type="button"
            className="dasti-icon-button"
            aria-label={`Move ${sectionTitle} section up`}
            title={`Move ${sectionTitle} section up`}
            onClick={onMoveUp}
            disabled={!rowState.canMoveUp}
          >
            <ArrowUp size={16} strokeWidth={1.7} aria-hidden="true" />
          </button>
        ) : null}
        {showMoveControls ? (
          <button
            type="button"
            className="dasti-icon-button"
            aria-label={`Move ${sectionTitle} section down`}
            title={`Move ${sectionTitle} section down`}
            onClick={onMoveDown}
            disabled={!rowState.canMoveDown}
          >
            <ArrowDown size={16} strokeWidth={1.7} aria-hidden="true" />
          </button>
        ) : null}
        {showVisibilityToggle ? (
          <button
            type="button"
            className="dasti-icon-button"
            aria-label={hideShowLabel}
            title={hideShowLabel}
            data-visibility-state={rowState.isHidden ? "hidden" : "shown"}
            onClick={rowState.isHidden ? onShow : onHide}
            disabled={!rowState.isHidden && rowState.hideLocked}
          >
            {rowState.isHidden ? (
              <EyeClosed size={16} strokeWidth={1.7} aria-hidden="true" />
            ) : (
              <Eye size={16} strokeWidth={1.7} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function SortableSectionCard(props: {
  section: CvSection;
  sections: CvSection[];
  hiddenSectionIds: Set<string>;
  desktopDragEnabled: boolean;
  activeDragSectionId: string | null;
  prefersReducedMotion: boolean;
  isDropTarget: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onHide: () => void;
  onShow: () => void;
  onDelete: () => void;
  isActive: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const {
    section,
    sections,
    hiddenSectionIds,
    desktopDragEnabled,
    activeDragSectionId,
    prefersReducedMotion,
    isDropTarget,
    onMoveUp,
    onMoveDown,
    onHide,
    onShow,
    onDelete,
    isActive,
    onActivate,
    onDeactivate,
  } = props;
  const sectionId = String(section.id ?? "");
  const isHidden = hiddenSectionIds.has(sectionId);
  const sortable = useSortable({
    id: sectionId,
    disabled: !desktopDragEnabled || isHidden || isSectionReorderLocked(section),
  });

  const transform = sortable.transform
    ? {
        ...sortable.transform,
        x: 0,
        scaleX: 1,
        scaleY: 1,
      }
    : null;

  return (
    <div
      ref={sortable.setNodeRef}
      className="section-container cv-organize-section-item"
      data-testid={`organize-section-item-${sectionId}`}
      data-section-dragging={
        sortable.isDragging || activeDragSectionId === sectionId ? "true" : "false"
      }
      data-section-drop-target={isDropTarget || sortable.isOver ? "true" : "false"}
      style={{
        width: "100%",
        position: "relative",
        zIndex:
          sortable.isDragging || activeDragSectionId === sectionId ? 6 : undefined,
        transform: CSS.Transform.toString(transform),
        transition: prefersReducedMotion ? "none" : sortable.transition,
      }}
    >
      <SectionCard
        section={section}
        sections={sections}
        hiddenSectionIds={hiddenSectionIds}
        desktopDragEnabled={desktopDragEnabled}
        activeDragSectionId={activeDragSectionId}
        isDragging={sortable.isDragging}
        isDropTarget={isDropTarget || sortable.isOver}
        dragHandleAttributes={sortable.attributes}
        dragHandleListeners={sortable.listeners}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onHide={onHide}
        onShow={onShow}
        onDelete={onDelete}
        isActive={isActive}
        onActivate={onActivate}
        onDeactivate={onDeactivate}
      />
    </div>
  );
}

export function OrganizeSectionsList({
  sections,
  hiddenSectionIds,
  onHiddenSectionIdsChange,
  onReorderSections,
  onDeleteSection,
  onExitOrganizeMode,
}: OrganizeSectionsListProps): JSX.Element {
  const desktopDragEnabled = useDesktopDragEnabled();
  const prefersReducedMotion = usePrefersReducedMotion();
  const hiddenSectionIdSet = React.useMemo(
    () => new Set(hiddenSectionIds),
    [hiddenSectionIds],
  );
  const [activeDragSectionId, setActiveDragSectionId] = React.useState<
    string | null
  >(null);
  const [activeSectionId, setActiveSectionId] = React.useState<string | null>(null);
  const [dropTargetSectionId, setDropTargetSectionId] = React.useState<
    string | null
  >(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleMoveUp = React.useCallback(
    (sectionId: string) => {
      onReorderSections(moveSection(sections, sectionId, -1));
    },
    [onReorderSections, sections],
  );

  const handleMoveDown = React.useCallback(
    (sectionId: string) => {
      onReorderSections(moveSection(sections, sectionId, 1));
    },
    [onReorderSections, sections],
  );

  const handleHide = React.useCallback(
    (sectionId: string) => {
      onHiddenSectionIdsChange(
        setSectionHiddenState(hiddenSectionIds, sectionId, true),
      );
    },
    [hiddenSectionIds, onHiddenSectionIdsChange],
  );

  const handleShow = React.useCallback(
    (sectionId: string) => {
      onHiddenSectionIdsChange(
        setSectionHiddenState(hiddenSectionIds, sectionId, false),
      );
    },
    [hiddenSectionIds, onHiddenSectionIdsChange],
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      setActiveDragSectionId(null);
      setDropTargetSectionId(null);

      const activeId = String(event.active?.id ?? "");
      const overId = String(event.over?.id ?? "");
      if (!activeId || !overId || activeId === overId) {
        return;
      }

      const oldIndex = sections.findIndex(
        (section) => String(section.id ?? "") === activeId,
      );
      const rawNewIndex = sections.findIndex(
        (section) => String(section.id ?? "") === overId,
      );
      if (oldIndex === -1 || rawNewIndex === -1) {
        return;
      }

      const firstMovableIndex = sections.findIndex(
        (section) => !isSectionReorderLocked(section),
      );
      const newIndex =
        firstMovableIndex === -1
          ? rawNewIndex
          : Math.max(rawNewIndex, firstMovableIndex);

      if (newIndex === oldIndex) {
        return;
      }

      onReorderSections(arrayMove(sections, oldIndex, newIndex));
    },
    [onReorderSections, sections],
  );

  return (
    <section
      aria-label="Organize top-level sections"
      className="cv-organize-sections-region"
      data-testid="organize-sections-region"
      data-active-section-id={activeSectionId ?? ""}
      data-organize-drag-active={activeDragSectionId ? "true" : "false"}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setActiveSectionId(null);
          onExitOrganizeMode();
          return;
        }

        if (!event.altKey || !activeSectionId) {
          return;
        }

        const activeSection = sections.find(
          (section) => String(section.id ?? "") === activeSectionId,
        );
        if (!activeSection) {
          return;
        }

        const activeRowState = getRowState(
          sections,
          activeSection,
          hiddenSectionIdSet,
        );

        if (event.key === "ArrowUp") {
          event.preventDefault();
          if (!activeRowState.isHidden && activeRowState.canMoveUp) {
            handleMoveUp(activeSectionId);
          }
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          if (!activeRowState.isHidden && activeRowState.canMoveDown) {
            handleMoveDown(activeSectionId);
          }
          return;
        }

        if (event.key.toLowerCase() === "h") {
          event.preventDefault();
          if (activeRowState.isHidden) {
            handleShow(activeSectionId);
          } else if (!activeRowState.hideLocked) {
            handleHide(activeSectionId);
          }
        }
      }}
    >
      <DndContext
        sensors={desktopDragEnabled ? sensors : undefined}
        collisionDetection={closestCenter}
        onDragStart={(event) => {
          setActiveDragSectionId(String(event.active.id ?? ""));
        }}
        onDragOver={(event) => {
          setDropTargetSectionId(String(event.over?.id ?? "") || null);
        }}
        onDragCancel={() => {
          setActiveDragSectionId(null);
          setDropTargetSectionId(null);
        }}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map((section) => String(section.id ?? ""))}
          strategy={verticalListSortingStrategy}
        >
          <div className="cv-organize-sections__list">
            {sections.map((section) => {
              const sectionId = String(section.id ?? "");
              return (
                <SortableSectionCard
                  key={sectionId}
                  section={section}
                  sections={sections}
                  hiddenSectionIds={hiddenSectionIdSet}
                  desktopDragEnabled={desktopDragEnabled}
                  activeDragSectionId={activeDragSectionId}
                  prefersReducedMotion={prefersReducedMotion}
                  isDropTarget={dropTargetSectionId === sectionId}
                  onMoveUp={() => handleMoveUp(sectionId)}
                  onMoveDown={() => handleMoveDown(sectionId)}
                  onHide={() => handleHide(sectionId)}
                  onShow={() => handleShow(sectionId)}
                  onDelete={() => onDeleteSection(sectionId)}
                  isActive={activeSectionId === sectionId}
                  onActivate={() => setActiveSectionId(sectionId)}
                  onDeactivate={() =>
                    setActiveSectionId((currentActiveSectionId) =>
                      currentActiveSectionId === sectionId
                        ? null
                        : currentActiveSectionId,
                    )
                  }
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

export default OrganizeSectionsList;
