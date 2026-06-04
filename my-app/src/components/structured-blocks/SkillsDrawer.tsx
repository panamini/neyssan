import React from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripHorizontal,
  Plus,
  TrashSimple,
  Wand2,
} from "@/lib/icons";
import type { ISkillItem, Level, SkillCategory } from "../../types/cvDocument";
import { IslandPanel, Menu, type MenuSection } from "@/components/ui";

type SkillsDrawerApplyPayload = {
  items: ISkillItem[];
  categories: SkillCategory[];
};

interface SkillsDrawerProps {
  open: boolean;
  sectionId?: string;
  items: ISkillItem[];
  categories?: SkillCategory[];
  aiSuggestions?: string[];
  aiSuggestionsLoading?: boolean;
  aiSuggestionsRequested?: boolean;
  canSuggestSkills?: boolean;
  onRequestAiSuggestions?: () => void;
  onAcceptAiSuggestion?: (
    name: string,
    targetCategoryId?: string | null,
  ) => void;
  onDismissAiSuggestion?: (name: string) => void;
  onClose: () => void;
  onApply?: (
    next: SkillsDrawerApplyPayload | ISkillItem[],
    categories?: SkillCategory[],
  ) => void;
}

type SkillGroup = {
  id: string;
  label: string;
  categoryId?: string;
  persisted: boolean;
  items: ISkillItem[];
};

type DropIndicator = "before" | "after" | null;
type JustDroppedTarget =
  | { kind: "skill"; id: string }
  | { kind: "category"; id: string }
  | null;

const OTHER_SKILLS_ID = "__other_skills__";
const SKILL_DND_PREFIX = "skill:";
const CATEGORY_DND_PREFIX = "category:";
const GROUP_DND_PREFIX = "group:";
const LEVELS: Level[] = [
  "Beginner",
  "Elementary",
  "Intermediate",
  "Advanced",
  "Fluent",
];

function createStableId(prefix: string): string {
  const cryptoId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${cryptoId}`;
}

function createCategory(): SkillCategory {
  return {
    id: createStableId("skill-cat"),
    label: "New category",
    source: "user",
  };
}

function createSkill(name: string, categoryId?: string | null): ISkillItem {
  return {
    id: createStableId("sk"),
    name,
    level: "Intermediate",
    ...(categoryId ? { categoryId } : {}),
  };
}

function idOf(item: ISkillItem): string {
  return String(item.id ?? item.name);
}

function cleanLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeItems(
  items: ISkillItem[],
  categories: SkillCategory[],
): ISkillItem[] {
  const validCategoryIds = new Set(categories.map((category) => category.id));
  return items.map((item) => {
    if (!item.categoryId || validCategoryIds.has(item.categoryId)) {
      return item;
    }
    const next = { ...item };
    delete next.categoryId;
    return next;
  });
}

function buildGroups(
  items: ISkillItem[],
  categories: SkillCategory[],
): SkillGroup[] {
  const normalizedItems = normalizeItems(items, categories);
  return [
    ...categories.map((category) => ({
      id: category.id,
      label: category.label,
      categoryId: category.id,
      persisted: true,
      items: normalizedItems.filter((item) => item.categoryId === category.id),
    })),
    {
      id: OTHER_SKILLS_ID,
      label: "Other Skills",
      persisted: false,
      items: normalizedItems.filter((item) => !item.categoryId),
    },
  ];
}

function orderItemsByGroups(groups: SkillGroup[]): ISkillItem[] {
  return groups.flatMap((group) =>
    group.items.map((item) => {
      if (group.categoryId) {
        return { ...item, categoryId: group.categoryId };
      }
      const next = { ...item };
      delete next.categoryId;
      return next;
    }),
  );
}

function categoryDndId(categoryId: string): string {
  return `${CATEGORY_DND_PREFIX}${categoryId}`;
}

function groupDndId(groupId: string): string {
  return `${GROUP_DND_PREFIX}${groupId}`;
}

function skillDndId(skillId: string): string {
  return `${SKILL_DND_PREFIX}${skillId}`;
}

function stripDndId(id: string, prefix: string): string {
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

function findGroupForSkill(
  groups: SkillGroup[],
  skillId: string,
): SkillGroup | null {
  return (
    groups.find((group) =>
      group.items.some((item) => idOf(item) === skillId),
    ) ?? null
  );
}

function findSkillByDndId(
  groups: SkillGroup[],
  activeId: string,
): ISkillItem | null {
  if (!activeId.startsWith(SKILL_DND_PREFIX)) return null;
  const skillId = stripDndId(activeId, SKILL_DND_PREFIX);
  const group = findGroupForSkill(groups, skillId);
  return group?.items.find((item) => idOf(item) === skillId) ?? null;
}

function findCategoryByDndId(
  categories: SkillCategory[],
  activeId: string,
): SkillCategory | null {
  if (!activeId.startsWith(CATEGORY_DND_PREFIX)) return null;
  const categoryId = stripDndId(activeId, CATEGORY_DND_PREFIX);
  return categories.find((category) => category.id === categoryId) ?? null;
}

function findGroupForDrop(
  groups: SkillGroup[],
  overId: string,
): SkillGroup | null {
  const strippedSkillId = stripDndId(overId, SKILL_DND_PREFIX);
  const skillGroup = findGroupForSkill(groups, strippedSkillId);
  if (skillGroup) return skillGroup;
  const explicitGroupId = stripDndId(overId, GROUP_DND_PREFIX);
  const explicitGroup = groups.find((group) => group.id === explicitGroupId);
  if (explicitGroup) return explicitGroup;
  const groupId = stripDndId(overId, CATEGORY_DND_PREFIX);
  return groups.find((group) => group.id === groupId) ?? null;
}

function findCategoryIdForDrop(groups: SkillGroup[], overId: string): string | null {
  if (overId.startsWith(CATEGORY_DND_PREFIX)) {
    const categoryId = stripDndId(overId, CATEGORY_DND_PREFIX);
    return categoryId === OTHER_SKILLS_ID ? null : categoryId;
  }
  const group = findGroupForDrop(groups, overId);
  return group?.categoryId ?? null;
}

function moveSkill(
  groups: SkillGroup[],
  activeId: string,
  overId: string,
): SkillGroup[] {
  const skillId = stripDndId(activeId, SKILL_DND_PREFIX);
  const activeGroup = findGroupForSkill(groups, skillId);
  const overGroup = findGroupForDrop(groups, overId);
  if (!activeGroup || !overGroup) return groups;
  const activeItem = activeGroup.items.find((item) => idOf(item) === skillId);
  if (!activeItem) return groups;

  const nextGroups = groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => idOf(item) !== skillId),
  }));
  const targetIndex = nextGroups.findIndex(
    (group) => group.id === overGroup.id,
  );
  if (targetIndex < 0) return groups;
  const overSkillId = stripDndId(overId, SKILL_DND_PREFIX);
  const overSkillIndex = nextGroups[targetIndex]!.items.findIndex(
    (item) => idOf(item) === overSkillId,
  );
  const flatSkillIds = groups.flatMap((group) => group.items.map(idOf));
  const activeFlatIndex = flatSkillIds.indexOf(skillId);
  const overFlatIndex = flatSkillIds.indexOf(overSkillId);
  const insertIndex =
    overSkillIndex >= 0
      ? activeFlatIndex !== -1 &&
        overFlatIndex !== -1 &&
        activeFlatIndex < overFlatIndex
        ? overSkillIndex + 1
        : overSkillIndex
      : nextGroups[targetIndex]!.items.length;
  nextGroups[targetIndex]!.items.splice(insertIndex, 0, {
    ...activeItem,
    ...(overGroup.categoryId ? { categoryId: overGroup.categoryId } : {}),
  });
  if (!overGroup.categoryId) {
    delete nextGroups[targetIndex]!.items[insertIndex]!.categoryId;
  }
  return nextGroups;
}

function DragPreview({
  activeId,
  groups,
  categories,
}: {
  activeId: string | null;
  groups: SkillGroup[];
  categories: SkillCategory[];
}) {
  if (!activeId) return null;

  const skill = findSkillByDndId(groups, activeId);
  if (skill) {
    const name = skill.name || "Untitled";
    return (
      <div className="dasti-skills-drawer__drag-overlay dasti-skills-drawer__skill-row flex items-center justify-between gap-2 px-3 py-2 text-sm">
        <span className="shrink-0 px-1 text-muted" aria-hidden="true">
          <GripHorizontal size={14} strokeWidth={1.8} />
        </span>
        <span className="dasti-skills-drawer__skill-name min-w-0 w-auto flex-grow overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm">
          {name}
        </span>
        <div className="dasti-skills-drawer__actions-right" aria-hidden="true">
          <span className="dasti-skills-drawer__action-spacer" />
          <span className="dasti-skills-drawer__action-cell">
            <ChevronDown size={13} strokeWidth={1.8} />
          </span>
          <span className="dasti-skills-drawer__action-cell">
            <TrashSimple size={14} strokeWidth={1.8} />
          </span>
        </div>
      </div>
    );
  }

  const category = findCategoryByDndId(categories, activeId);
  if (!category) return null;

  return (
    <div className="dasti-skills-drawer__drag-overlay dasti-skills-drawer__drag-overlay--category flex items-center gap-2 px-3 py-2 text-sm font-medium">
      <span className="shrink-0 px-1 text-muted" aria-hidden="true">
        <GripHorizontal size={14} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1 truncate text-left">
        {category.label}
      </span>
      <div className="dasti-skills-drawer__actions-right" aria-hidden="true">
        <span className="dasti-skills-drawer__category-move-pair">
          <span className="dasti-skills-drawer__action-cell">
            <ArrowUp size={14} strokeWidth={1.8} />
          </span>
          <span className="dasti-skills-drawer__action-cell">
            <ArrowDown size={14} strokeWidth={1.8} />
          </span>
        </span>
        <span className="dasti-skills-drawer__action-cell">
          <TrashSimple size={14} strokeWidth={1.8} />
        </span>
      </div>
    </div>
  );
}

function SortableSkillRow({
  item,
  categories,
  currentCategoryId,
  suppressSortableTransform,
  dropIndicator,
  justDropped,
  onLevelChange,
  onCategoryChange,
  onDelete,
}: {
  item: ISkillItem;
  categories: SkillCategory[];
  currentCategoryId?: string;
  suppressSortableTransform: boolean;
  dropIndicator: DropIndicator;
  justDropped: boolean;
  onLevelChange: (skillId: string, level: Level) => void;
  onCategoryChange: (skillId: string, categoryId?: string) => void;
  onDelete: (skillId: string) => void;
}) {
  const skillId = idOf(item);
  const sortable = useSortable({
    id: skillDndId(skillId),
    transition: {
      duration: 320,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  });
  const name = item.name || "Untitled";
  const rowTransform =
    suppressSortableTransform || sortable.isDragging
      ? null
      : sortable.transform;
  const rowTransition = sortable.transition
    ? `${sortable.transition}, opacity var(--motion-duration-fast) var(--motion-ease-standard), margin-block-start var(--motion-duration-fast) var(--motion-ease-standard), margin-block-end var(--motion-duration-fast) var(--motion-ease-standard)`
    : "transform var(--motion-duration-medium) var(--motion-ease-emphasized), opacity var(--motion-duration-fast) var(--motion-ease-standard), margin-block-start var(--motion-duration-fast) var(--motion-ease-standard), margin-block-end var(--motion-duration-fast) var(--motion-ease-standard)";
  const moveMenuSections: MenuSection[] = [
    {
      items: [
        {
          id: "other-skills",
          label: "Other Skills",
          role: "menuitemradio",
          selected: !currentCategoryId,
          onSelect: () => onCategoryChange(skillId, undefined),
        },
        ...categories.map((category) => ({
          id: category.id,
          label: category.label,
          role: "menuitemradio" as const,
          selected: currentCategoryId === category.id,
          onSelect: () => onCategoryChange(skillId, category.id),
        })),
      ],
    },
  ];

  return (
    <div
      ref={sortable.setNodeRef}
      className={[
        "dasti-skills-drawer__skill-row group flex items-center justify-between gap-2 px-3 py-2",
      ]
        .filter(Boolean)
        .join(" ")}
      data-dragging={sortable.isDragging ? "true" : undefined}
      data-drop-indicator={dropIndicator ?? undefined}
      data-just-dropped={justDropped ? "true" : undefined}
      style={{
        transform: CSS.Transform.toString(rowTransform),
        transition: rowTransition,
      }}
    >
      <button
        type="button"
        aria-label={`Drag ${name}`}
        className="shrink-0 px-1 text-muted"
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripHorizontal size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <span
        className="dasti-skills-drawer__skill-name min-w-0 w-auto flex-grow overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm"
        title={name}
      >
        {name}
      </span>
      <span className="select-level relative shrink-0">
        <select
          aria-label={`Level for ${name}`}
          className="[inline-size:calc(var(--s8)+var(--s6)+var(--s3))] appearance-none rounded border bg-background py-1 pl-2 pr-6 text-left text-xs [border-color:var(--color-border)]"
          value={item.level ?? "Intermediate"}
          onChange={(event) =>
            onLevelChange(skillId, event.target.value as Level)
          }
        >
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <ChevronDown
          size={13}
          strokeWidth={1.8}
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted"
        />
      </span>
      <div className="dasti-skills-drawer__actions-right">
        <span
          className="dasti-skills-drawer__action-spacer"
          aria-hidden="true"
        />
        <Menu
          ariaLabel={`Move ${name}`}
          align="end"
          side="bottom"
          menuClassName="dasti-skills-drawer__move-menu"
          sections={moveMenuSections}
          trigger={
            <button
              type="button"
              aria-label={`Move ${name}`}
              title={`Move ${name}`}
              className="dasti-skills-drawer__action-cell"
            >
              <ChevronDown size={13} strokeWidth={1.8} aria-hidden="true" />
            </button>
          }
        />
        <button
          type="button"
          aria-label={`Delete ${name}`}
          className="dasti-skills-drawer__action-cell"
          onClick={() => onDelete(skillId)}
        >
          <TrashSimple size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

type DroppableSkillGroupProps = {
  group: SkillGroup;
  index: number;
  totalCategories: number;
  isNewCategory: boolean;
  isOver: boolean;
  dropIndicator: DropIndicator;
  justDropped: boolean;
  suppressSortableTransform: boolean;
  onRename: (categoryId: string, label: string) => void;
  onMove: (categoryId: string, direction: -1 | 1) => void;
  onDelete: (categoryId: string) => void;
  children: React.ReactNode;
};

const DroppableSkillGroup = React.forwardRef<
  HTMLInputElement,
  DroppableSkillGroupProps
>(function DroppableSkillGroup(
  {
    group,
    index,
    totalCategories,
    isNewCategory,
    isOver,
    dropIndicator,
    justDropped,
    suppressSortableTransform,
    onRename,
    onMove,
    onDelete,
    children,
  },
  ref,
) {
  const sortable = useSortable({
    id: categoryDndId(group.id),
    disabled: !group.categoryId,
    transition: {
      duration: 320,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  });
  const sectionTransform =
    suppressSortableTransform || sortable.isDragging
      ? null
      : sortable.transform;
  const sectionTransition = sortable.transition
    ? `${sortable.transition}, opacity var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), margin-block-start var(--motion-duration-fast) var(--motion-ease-standard), margin-block-end var(--motion-duration-fast) var(--motion-ease-standard)`
    : "transform var(--motion-duration-medium) var(--motion-ease-emphasized), opacity var(--motion-duration-fast) var(--motion-ease-standard), border-color var(--motion-duration-fast) var(--motion-ease-standard), margin-block-start var(--motion-duration-fast) var(--motion-ease-standard), margin-block-end var(--motion-duration-fast) var(--motion-ease-standard)";

  return (
    <section
      ref={group.categoryId ? sortable.setNodeRef : undefined}
      id={group.id}
      className="rounded border [border-color:var(--color-border)]"
      data-skill-category-id={group.categoryId ?? OTHER_SKILLS_ID}
      data-dragging={sortable.isDragging ? "true" : undefined}
      data-over={isOver ? "true" : undefined}
      data-drop-indicator={dropIndicator ?? undefined}
      data-just-dropped={justDropped ? "true" : undefined}
      style={{
        transform: CSS.Transform.toString(sectionTransform),
        transition: sectionTransition,
      }}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2 [border-color:var(--color-border)]">
        {group.categoryId ? (
          <button
            type="button"
            aria-label={`Drag ${group.label}`}
            title="Drag to reorder category"
            className="shrink-0 px-1 text-muted"
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripHorizontal size={14} strokeWidth={1.8} aria-hidden="true" />
          </button>
        ) : null}
        {group.categoryId ? (
          <input
            ref={isNewCategory ? ref : undefined}
            aria-label={`Rename ${group.label}`}
            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-sm font-medium hover:[border-color:var(--color-border)] focus:[border-color:var(--color-border)] focus:bg-background focus:outline-none"
            defaultValue={group.label}
            onBlur={(event) => onRename(group.categoryId!, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        ) : (
          <h4 className="min-w-0 flex-1 truncate text-sm font-medium">
            {group.label}
          </h4>
        )}
        <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs text-muted [border-color:var(--color-border)]">
          {group.items.length} skill{group.items.length === 1 ? "" : "s"}
        </span>
        {group.categoryId ? (
          <div className="dasti-skills-drawer__actions-right">
            <span className="dasti-skills-drawer__category-move-pair">
              <button
                type="button"
                aria-label="Up"
                title="Move category up"
                disabled={index === 0}
                onClick={() => onMove(group.categoryId!, -1)}
                className="dasti-skills-drawer__action-cell"
              >
                <ArrowUp size={14} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Down"
                title="Move category down"
                disabled={index === totalCategories - 1}
                onClick={() => onMove(group.categoryId!, 1)}
                className="dasti-skills-drawer__action-cell"
              >
                <ArrowDown size={14} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </span>
            <button
              type="button"
              aria-label="Delete"
              title="Delete category"
              onClick={() => onDelete(group.categoryId!)}
              className="dasti-skills-drawer__action-cell"
            >
              <TrashSimple size={14} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
});

function SkillGroupDropZone({
  group,
  isOver,
  showDropSlot,
  children,
}: {
  group: SkillGroup;
  isOver: boolean;
  showDropSlot: boolean;
  children: React.ReactNode;
}) {
  const droppable = useDroppable({
    id: groupDndId(group.id),
  });

  return (
    <div
      ref={droppable.setNodeRef}
      className="min-h-10 divide-y divide-[color:var(--color-border)]"
      data-skill-drop-group-id={group.id}
      data-over={isOver || droppable.isOver ? "true" : undefined}
      data-drop-slot={showDropSlot ? "true" : undefined}
    >
      {children}
    </div>
  );
}

export function SkillsDrawer({
  open,
  items,
  categories = [],
  aiSuggestions = [],
  aiSuggestionsLoading = false,
  aiSuggestionsRequested = false,
  canSuggestSkills = true,
  onRequestAiSuggestions,
  onAcceptAiSuggestion,
  onDismissAiSuggestion,
  onClose,
  onApply,
}: SkillsDrawerProps): JSX.Element | null {
  const [draftItems, setDraftItems] = React.useState<ISkillItem[]>(items);
  const [draftCategories, setDraftCategories] =
    React.useState<SkillCategory[]>(categories);
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);
  const [overDragId, setOverDragId] = React.useState<string | null>(null);
  const [justDroppedTarget, setJustDroppedTarget] =
    React.useState<JustDroppedTarget>(null);
  const newCategoryInputRef = React.useRef<HTMLInputElement | null>(null);
  const lastAddedCategoryIdRef = React.useRef<string | null>(null);
  const justDroppedTimeoutRef = React.useRef<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  React.useEffect(() => {
    if (!open) return;
    setDraftItems(normalizeItems(items, categories));
    setDraftCategories(categories);
  }, [categories, items, open]);

  React.useEffect(() => {
    const newCategoryId = lastAddedCategoryIdRef.current;
    if (!newCategoryId) return;
    const input = newCategoryInputRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    input.select();
    lastAddedCategoryIdRef.current = null;
  }, [draftCategories]);

  React.useEffect(() => {
    return () => {
      if (justDroppedTimeoutRef.current !== null) {
        window.clearTimeout(justDroppedTimeoutRef.current);
      }
    };
  }, []);

  if (!open) return null;

  const groups = buildGroups(draftItems, draftCategories);
  const sortableCategoryIds = draftCategories.map((category) =>
    categoryDndId(category.id),
  );
  const sortableSkillIds = groups.flatMap((group) =>
    group.items.map((item) => skillDndId(idOf(item))),
  );
  const dragOverlay = (
    <DragOverlay dropAnimation={null}>
      <DragPreview
        activeId={activeDragId}
        groups={groups}
        categories={draftCategories}
      />
    </DragOverlay>
  );

  function publish(nextItems: ISkillItem[], nextCategories: SkillCategory[]) {
    const normalizedNextItems = normalizeItems(nextItems, nextCategories);
    setDraftItems(normalizedNextItems);
    setDraftCategories(nextCategories);
    onApply?.(
      { items: normalizedNextItems, categories: nextCategories },
      nextCategories,
    );
  }

  function markJustDropped(target: NonNullable<JustDroppedTarget>) {
    if (justDroppedTimeoutRef.current !== null) {
      window.clearTimeout(justDroppedTimeoutRef.current);
    }
    setJustDroppedTarget(target);
    justDroppedTimeoutRef.current = window.setTimeout(() => {
      setJustDroppedTarget(null);
      justDroppedTimeoutRef.current = null;
    }, 820);
  }

  function updateSkill(skillId: string, patch: Partial<ISkillItem>) {
    publish(
      draftItems.map((item) =>
        idOf(item) === skillId ? { ...item, ...patch } : item,
      ),
      draftCategories,
    );
  }

  function handleCategoryChange(skillId: string, categoryId?: string) {
    publish(
      draftItems.map((item) => {
        if (idOf(item) !== skillId) return item;
        if (categoryId) return { ...item, categoryId };
        const next = { ...item };
        delete next.categoryId;
        return next;
      }),
      draftCategories,
    );
  }

  function handleAddCategory() {
    const category = createCategory();
    const newCategoryId = category.id;
    lastAddedCategoryIdRef.current = newCategoryId;
    publish(draftItems, [...draftCategories, category]);
    window.requestAnimationFrame(() => {
      document.getElementById(newCategoryId)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  function handleRenameCategory(categoryId: string, label: string) {
    const nextLabel = cleanLabel(label);
    const existing = draftCategories.find(
      (category) => category.id === categoryId,
    );
    if (!existing || !nextLabel) return;
    publish(
      draftItems,
      draftCategories.map((category) =>
        category.id === categoryId
          ? { ...category, label: nextLabel }
          : category,
      ),
    );
  }

  function handleMoveCategory(categoryId: string, direction: -1 | 1) {
    const index = draftCategories.findIndex(
      (category) => category.id === categoryId,
    );
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= draftCategories.length)
      return;
    publish(draftItems, arrayMove(draftCategories, index, nextIndex));
  }

  function handleDeleteCategory(categoryId: string) {
    const affectedCount = draftItems.filter(
      (item) => item.categoryId === categoryId,
    ).length;
    if (
      affectedCount > 0 &&
      typeof window !== "undefined" &&
      !window.confirm(`Move ${affectedCount} skills to Other Skills?`)
    ) {
      return;
    }
    publish(
      draftItems.map((item) => {
        if (item.categoryId !== categoryId) return item;
        const next = { ...item };
        delete next.categoryId;
        return next;
      }),
      draftCategories.filter((category) => category.id !== categoryId),
    );
  }

  function handleDeleteSkill(skillId: string) {
    publish(
      draftItems.filter((item) => idOf(item) !== skillId),
      draftCategories,
    );
  }

  function handleAcceptSuggestion(
    name: string,
    targetCategoryId?: string | null,
  ) {
    const cleanName = name.trim();
    if (!cleanName) return;
    const alreadyExists = draftItems.some(
      (item) =>
        item.name.trim().toLocaleLowerCase() === cleanName.toLocaleLowerCase(),
    );
    if (!alreadyExists) {
      publish(
        [...draftItems, createSkill(cleanName, targetCategoryId)],
        draftCategories,
      );
    }
    onAcceptAiSuggestion?.(cleanName, targetCategoryId ?? null);
  }

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    setActiveDragId(activeId);
    setOverDragId(activeId);
  }

  function handleDragOver(event: DragOverEvent) {
    setOverDragId(event.over?.id ? String(event.over.id) : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    setOverDragId(null);
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;

    if (activeId.startsWith(CATEGORY_DND_PREFIX)) {
      const activeCategoryId = stripDndId(activeId, CATEGORY_DND_PREFIX);
      const overCategoryId = findCategoryIdForDrop(groups, overId);
      if (!overCategoryId || activeCategoryId === overCategoryId) return;
      const activeIndex = draftCategories.findIndex(
        (category) => category.id === activeCategoryId,
      );
      const overIndex = draftCategories.findIndex(
        (category) => category.id === overCategoryId,
      );
      if (activeIndex >= 0 && overIndex >= 0) {
        publish(draftItems, arrayMove(draftCategories, activeIndex, overIndex));
        markJustDropped({ kind: "category", id: activeCategoryId });
      }
      return;
    }

    if (activeId.startsWith(SKILL_DND_PREFIX)) {
      const activeSkillId = stripDndId(activeId, SKILL_DND_PREFIX);
      const nextGroups = moveSkill(groups, activeId, overId);
      publish(orderItemsByGroups(nextGroups), draftCategories);
      markJustDropped({ kind: "skill", id: activeSkillId });
    }
  }

  return (
    <IslandPanel
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title="Manage skills & categories"
      ariaLabel="Manage skills & categories"
      className="dasti-cv-section-sheet-panel dasti-skills-drawer"
      bodyClassName="dasti-skills-drawer__body"
      showCloseButton={false}
      saveAction={{
        label: "Done",
        onClick: onClose,
      }}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleAddCategory}
            className="inline-flex items-center gap-2 px-2 py-1 text-sm border rounded [border-color:var(--color-border)]"
          >
            <Plus size={14} strokeWidth={1.8} aria-hidden="true" />
            Add category
          </button>
          {canSuggestSkills ? (
            <button
              type="button"
              onClick={onRequestAiSuggestions}
              disabled={aiSuggestionsLoading || !onRequestAiSuggestions}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded [border-color:var(--color-border)] disabled:opacity-50"
            >
              <Wand2 size={14} strokeWidth={1.8} aria-hidden="true" />
              {aiSuggestionsRequested
                ? "Refresh suggestions"
                : "Suggest skills"}
            </button>
          ) : null}
        </div>

        <section
          role="region"
          aria-label="AI skill suggestions"
          className="rounded border p-3 [border-color:var(--color-border)]"
          data-state={
            aiSuggestionsLoading
              ? "loading"
              : aiSuggestionsRequested
                ? "ready"
                : "idle"
          }
        >
          <div className="mb-2 text-sm font-medium">AI suggestions</div>
          {aiSuggestionsLoading ? (
            <p className="text-sm text-muted">Generating suggestions.</p>
          ) : aiSuggestions.length > 0 ? (
            <div className="space-y-2">
              {aiSuggestions.map((suggestion) => (
                <div
                  key={suggestion}
                  className="flex items-center gap-2 rounded border px-2 py-2 [border-color:var(--color-border)]"
                >
                  <span
                    className="min-w-0 flex-1 truncate text-sm"
                    title={suggestion}
                  >
                    {suggestion}
                  </span>
                  <span className="relative shrink-0 [max-inline-size:calc(var(--s8)+var(--s7)+var(--s6))]">
                    <select
                      aria-label={`Add ${suggestion} to category`}
                      className="w-full appearance-none rounded border bg-background py-1 pl-2 pr-6 text-left text-xs [border-color:var(--color-border)]"
                      defaultValue=""
                      onChange={(event) => {
                        const targetCategoryId =
                          event.target.value === OTHER_SKILLS_ID
                            ? null
                            : event.target.value;
                        handleAcceptSuggestion(suggestion, targetCategoryId);
                        event.currentTarget.value = "";
                      }}
                    >
                      <option value="" disabled>
                        Add to...
                      </option>
                      <option value={OTHER_SKILLS_ID}>Other Skills</option>
                      {draftCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={13}
                      strokeWidth={1.8}
                      aria-hidden="true"
                      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted"
                    />
                  </span>
                  <button
                    type="button"
                    aria-label={`Dismiss ${suggestion}`}
                    className="shrink-0 px-2 py-1 text-xs border rounded [border-color:var(--color-border)]"
                    onClick={() => onDismissAiSuggestion?.(suggestion)}
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">
              {aiSuggestionsRequested
                ? "No new suggestions for this section."
                : "Use Suggest skills to generate additions for this CV."}
            </p>
          )}
        </section>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveDragId(null);
            setOverDragId(null);
          }}
        >
          <div className="space-y-4">
            <SortableContext
              items={sortableCategoryIds}
              strategy={verticalListSortingStrategy}
            >
              <SortableContext
                items={sortableSkillIds}
                strategy={verticalListSortingStrategy}
              >
                {groups.map((group) => {
                  const groupCategoryIndex = group.categoryId
                    ? draftCategories.findIndex(
                        (category) => category.id === group.categoryId,
                      )
                    : -1;
                  const activeCategoryIndex =
                    activeDragId?.startsWith(CATEGORY_DND_PREFIX)
                      ? sortableCategoryIds.indexOf(activeDragId)
                      : -1;
                  const overCategoryId = categoryDndId(group.id);
                  const resolvedOverCategoryId =
                    activeDragId?.startsWith(CATEGORY_DND_PREFIX) && overDragId
                      ? findCategoryIdForDrop(groups, overDragId)
                      : null;
                  const categoryDropIndicator: DropIndicator =
                    Boolean(group.categoryId) &&
                    activeCategoryIndex !== -1 &&
                    (overDragId === overCategoryId ||
                      resolvedOverCategoryId === group.categoryId) &&
                    activeDragId !== overCategoryId
                      ? activeCategoryIndex < groupCategoryIndex
                        ? "after"
                        : "before"
                      : null;
                  const groupIsOver =
                    overDragId === categoryDndId(group.id) ||
                    overDragId === groupDndId(group.id) ||
                    group.items.some(
                      (item) => overDragId === skillDndId(idOf(item)),
                    );
                  const showGroupDropSlot =
                    Boolean(activeDragId?.startsWith(SKILL_DND_PREFIX)) &&
                    (overDragId === groupDndId(group.id) ||
                      (group.items.length === 0 && groupIsOver));
                  return (
                    <DroppableSkillGroup
                      key={group.id}
                      group={group}
                      index={Math.max(0, groupCategoryIndex)}
                      totalCategories={draftCategories.length}
                      isNewCategory={
                        lastAddedCategoryIdRef.current === group.categoryId
                      }
                      isOver={groupIsOver}
                      dropIndicator={categoryDropIndicator}
                      justDropped={
                        justDroppedTarget?.kind === "category" &&
                        justDroppedTarget.id === group.id
                      }
                      suppressSortableTransform={activeDragId !== null}
                      onRename={handleRenameCategory}
                      onMove={handleMoveCategory}
                      onDelete={handleDeleteCategory}
                      ref={
                        lastAddedCategoryIdRef.current === group.categoryId
                          ? newCategoryInputRef
                        : undefined
                      }
                    >
                      <SkillGroupDropZone
                        group={group}
                        isOver={groupIsOver}
                        showDropSlot={showGroupDropSlot}
                      >
                        {group.items.length === 0 ? (
                          <p className="px-3 py-3 text-sm text-muted">
                            No skills in this group.
                          </p>
                        ) : (
                          group.items.map((item) => (
                            <SortableSkillRow
                              key={idOf(item)}
                              item={item}
                              categories={draftCategories}
                              currentCategoryId={group.categoryId}
                              suppressSortableTransform={activeDragId !== null}
                              justDropped={
                                justDroppedTarget?.kind === "skill" &&
                                justDroppedTarget.id === idOf(item)
                              }
                              dropIndicator={((): DropIndicator => {
                                const skillOverId = skillDndId(idOf(item));
                                if (
                                  !activeDragId?.startsWith(SKILL_DND_PREFIX) ||
                                  overDragId !== skillOverId ||
                                  activeDragId === skillOverId
                                ) {
                                  return null;
                                }
                                const activeSkillIndex =
                                  sortableSkillIds.indexOf(activeDragId);
                                const overSkillIndex =
                                  sortableSkillIds.indexOf(skillOverId);
                                if (
                                  activeSkillIndex === -1 ||
                                  overSkillIndex === -1
                                ) {
                                  return "before";
                                }
                                return activeSkillIndex < overSkillIndex
                                  ? "after"
                                  : "before";
                              })()}
                              onLevelChange={(skillId, level) =>
                                updateSkill(skillId, { level })
                              }
                              onCategoryChange={handleCategoryChange}
                              onDelete={handleDeleteSkill}
                            />
                          ))
                        )}
                      </SkillGroupDropZone>
                    </DroppableSkillGroup>
                  );
                })}
              </SortableContext>
            </SortableContext>
          </div>
          {typeof document !== "undefined"
            ? createPortal(dragOverlay, document.body)
            : dragOverlay}
        </DndContext>
      </div>
    </IslandPanel>
  );
}

export default SkillsDrawer;
