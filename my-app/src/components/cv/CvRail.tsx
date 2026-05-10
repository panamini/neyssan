import React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  ChevronDown,
  Eye,
  EyeClosed,
  GripHorizontal,
  PenLine,
  Plus,
  TrashSimple,
  Upload,
  Wand2,
} from "@/lib/icons";
import { Button, Menu } from "../ui";
import AiSuggestionCard from "../ai/AiSuggestionCard";
import type { CvSection } from "../../types/cvDocument";
import type { ActivePaperEditTarget } from
  "../../features/verbati/resume/InlineEditableText";
import {
  formatSectionDisplayTitle,
  getSectionOrganizationControlPolicy,
} from "../../lib/cv-section-organization";
import { getCanonicalSectionType } from "../../features/verbati/resumeLinking";
import type { VerbatiStylePreset } from "../../features/verbati/types";
import {
  getVerbatiFontPairOption,
  type VerbatiFontPairId,
} from "../../features/verbati/fontCatalog";
import { PROPOSAL_PALETTE_OPTIONS } from "../../lib/proposal-style-display";
import { ProposalColorPickerPopover } from "../ProposalColorPickerPopover";
import {
  WORKSHOP_RESUME_ONECOL_TEMPLATE_ID,
  WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID,
} from "../../lib/layout/resumeTemplates";

export type CvRailTab = "sections" | "ai" | "style";
export type CvToneChoice = "warm" | "formal" | "natural";

export type CvRailAiSuggestion = {
  kind?: "text";
  sectionId: string;
  sectionLabel: string;
  beforeText: string;
  afterText: string;
  state: "loading" | "ready" | "error";
  errorMessage?: string;
  interactionId?: string;
  inlineTarget?: {
    editTarget: ActivePaperEditTarget;
    selectedText: string;
    actionId: string;
  };
} | {
  kind: "list";
  sectionId: string;
  sectionLabel: string;
  beforeText: string;
  items: string[];
  state: "loading" | "ready" | "error";
  errorMessage?: string;
  interactionId?: string;
};

export type CvRailAppliedAiEdit = {
  sectionId: string;
  sectionLabel: string;
  previousText: string;
};

type CvRailProps = {
  sections: CvSection[];
  hiddenSectionIds: string[];
  activeSectionId: string | null;
  activeTab: CvRailTab;
  stylePreset: VerbatiStylePreset;
  selectedTone: CvToneChoice;
  aiSuggestion: CvRailAiSuggestion | null;
  appliedAiEdit: CvRailAppliedAiEdit | null;
  isImporting: boolean;
  onActiveTabChange: (tab: CvRailTab) => void;
  onSelectSection: (sectionId: string, options?: { openEditor?: boolean }) => void;
  onToggleHiddenSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSections: (activeSectionId: string, overSectionId: string) => void;
  onMoveSection: (sectionId: string, direction: -1 | 1) => void;
  onAskAiForSection: (sectionId: string) => void;
  onRunAskAiForSection: (args: {
    sectionId: string;
    prompt: string;
    tone: CvToneChoice;
  }) => Promise<void>;
  onAcceptAiSuggestion: () => void;
  onDiscardAiSuggestion: () => void;
  onUndoAiSuggestion: () => void;
  onAcceptListAiSuggestion: (value: string) => void;
  onDismissListAiSuggestion: (value: string) => void;
  onAddSection: (sectionKind: CvAddSectionKind) => void;
  selectedStyleSlot: 1 | 2 | 3 | null;
  selectedStyleSlotIsCustom?: boolean;
  onSelectStyleSlot: (slot: 1 | 2 | 3) => void;
  onResetStyleSlot?: () => void;
  onSelectTemplate: (template: "workshop-onecol" | "workshop-twocol" | "editorial" | "minimal" | "classic") => void;
  onSelectFontPair: (fontPairId: VerbatiFontPairId) => void;
  onSelectAccent: (accent: CvAccentChoice) => void;
  onSelectCustomAccent: (hex: string) => void;
  onNewCv: () => void;
  onImportPdf: () => void;
};

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

export type CvAccentChoice =
  | "terre"
  | "ink"
  | "cobalt"
  | "sauge"
  | "plum"
  | "ochre";

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

const FONT_PAIR_IDS: VerbatiFontPairId[] = [
  "geist-baskervville",
  "mono-signal",
  "fd-garamond-geist",
  "ledger-sans",
];

const FONT_PAIR_OPTIONS = FONT_PAIR_IDS.map((id) => getVerbatiFontPairOption(id));

const ACCENT_OPTIONS: Array<{
  id: CvAccentChoice;
  label: string;
  palette: VerbatiStylePreset["palette"];
  accentHex: string;
}> = PROPOSAL_PALETTE_OPTIONS.map((option) => ({
  id: option.id as CvAccentChoice,
  label: option.label,
  palette: option.id,
  accentHex: option.color,
}));

const CV_CUSTOM_ACCENT_STARTER_HEX = "#8A8176";

function normalizeCvAccentHex(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return /^#[0-9a-fA-F]{6}$/.test(normalized)
    ? normalized.toLowerCase()
    : null;
}

function getSectionId(section: CvSection, index: number): string {
  return String(section.id ?? `${section.type}-${index}`);
}

function getItemCount(section: CvSection): number {
  if (Array.isArray(section.structuredContent)) {
    return section.structuredContent.length;
  }
  return Array.isArray(section.blocks) ? section.blocks.length : 0;
}

function getActiveSection(
  sections: CvSection[],
  activeSectionId: string | null,
): CvSection | null {
  if (!activeSectionId) return sections[0] ?? null;
  return (
    sections.find((section, index) => getSectionId(section, index) === activeSectionId) ??
    sections[0] ??
    null
  );
}

function isHobbiesSection(section: CvSection): boolean {
  return (
    String(section.type) === "hobbies" ||
    section.title.trim().toLowerCase() === "hobbies"
  );
}

function getRailAiMode(
  section: CvSection,
): "none" | "rail" | "editor" {
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
  onSelectSection: (sectionId: string, options?: { openEditor?: boolean }) => void;
  onMoveSection: (sectionId: string, direction: -1 | 1) => void;
  children: React.ReactNode;
};

type CvAddSectionMenuProps = {
  sections: CvSection[];
  onAddSection: (sectionKind: CvAddSectionKind) => void;
};

function SortableSectionRow({
  sectionId,
  label,
  hidden,
  active,
  itemCount,
  showDragHandle,
  showMoveControls,
  onSelectSection,
  onMoveSection,
  children,
}: SortableSectionRowProps): JSX.Element {
  const sortable = useSortable({
    id: sectionId,
    disabled: !showDragHandle,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      className="dasti-cv-org-row"
      data-active={active ? "true" : undefined}
      data-hidden={hidden ? "true" : undefined}
      style={style}
    >
      {showDragHandle ? (
        <button
          type="button"
          className="dasti-cv-org-handle"
          aria-label={`Reorder ${label}`}
          title="Drag to reorder"
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
            return;
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

function CvAddSectionMenu({
  sections,
  onAddSection,
}: CvAddSectionMenuProps): JSX.Element {
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

function FontPairMenu({
  value,
  onSelectFontPair,
}: {
  value: VerbatiFontPairId;
  onSelectFontPair: (fontPairId: VerbatiFontPairId) => void;
}): JSX.Element {
  const activeOption = getVerbatiFontPairOption(value);

  return (
    <Menu
      ariaLabel="Font pair"
      menuClassName="dasti-cv-font-menu"
      matchTriggerWidth
      sections={[
        {
          label: "Font pair",
          items: FONT_PAIR_OPTIONS.map((option) => ({
            id: option.id,
            role: "menuitemradio",
            selected: option.id === activeOption.id,
            label: (
              <span
                className="dasti-cv-font-menu__sample"
                style={
                  {
                    "--cv-font-pair-heading": option.headingFamily,
                    "--cv-font-pair-body": option.bodyFamily,
                  } as React.CSSProperties
                }
              >
                <span className="dasti-cv-font-menu__sample-title">
                  {option.headingLabel}
                </span>
                <span className="dasti-cv-font-menu__sample-body">
                  {option.bodyLabel}
                </span>
              </span>
            ),
            ariaLabel: option.name,
            onSelect: () => onSelectFontPair(option.id),
          })),
        },
      ]}
      trigger={
        <button type="button" className="dasti-cv-font-menu-trigger">
          <span
            className="dasti-cv-font-menu-trigger__label"
            style={
              {
                "--cv-font-pair-heading": activeOption.headingFamily,
                "--cv-font-pair-body": activeOption.bodyFamily,
              } as React.CSSProperties
            }
          >
            <span>{activeOption.headingLabel}</span>
            <small>{activeOption.bodyLabel}</small>
          </span>
          <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
      }
    />
  );
}

export function CvRail({
  sections,
  hiddenSectionIds,
  activeSectionId,
  activeTab,
  stylePreset,
  selectedTone,
  aiSuggestion,
  appliedAiEdit,
  isImporting,
  onActiveTabChange,
  onSelectSection,
  onToggleHiddenSection,
  onDeleteSection,
  onReorderSections,
  onMoveSection,
  onAskAiForSection,
  onRunAskAiForSection,
  onAcceptAiSuggestion,
  onDiscardAiSuggestion,
  onUndoAiSuggestion,
  onAcceptListAiSuggestion,
  onDismissListAiSuggestion,
  onAddSection,
  selectedStyleSlot,
  selectedStyleSlotIsCustom = false,
  onSelectStyleSlot,
  onResetStyleSlot,
  onSelectTemplate,
  onSelectFontPair,
  onSelectAccent,
  onSelectCustomAccent,
  onNewCv,
  onImportPdf,
}: CvRailProps): JSX.Element {
  const activeSection = getActiveSection(sections, activeSectionId);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [streamExpanded, setStreamExpanded] = React.useState(false);
  const [isCustomColorPickerOpen, setIsCustomColorPickerOpen] =
    React.useState(false);
  const customColorAnchorRef = React.useRef<HTMLButtonElement | null>(null);
  const customColorSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const activeSectionLabel = activeSection
    ? formatSectionDisplayTitle(activeSection, { fallback: "Section" })
    : "";
  const activeAiMode = activeSection ? getRailAiMode(activeSection) : "none";
  const activeUsesStructuredSuggestions =
    activeSection ? usesStructuredSuggestions(activeSection) : false;
  const scopedAiSuggestion =
    aiSuggestion && aiSuggestion.sectionId === activeSectionId ? aiSuggestion : null;
  const scopedAppliedAiEdit =
    appliedAiEdit && appliedAiEdit.sectionId === activeSectionId
      ? appliedAiEdit
      : null;
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
  const activeAccent = ACCENT_OPTIONS.find((option) => {
    if (option.palette === stylePreset.palette) return !stylePreset.accentHex;
    return (
      stylePreset.palette === "custom" &&
      normalizeCvAccentHex(stylePreset.accentHex) ===
      normalizeCvAccentHex(option.accentHex)
    );
  });
  const customAccentHex =
    stylePreset.palette === "custom"
      ? normalizeCvAccentHex(stylePreset.accentHex)
      : null;
  const fixedAccentHexMatch = ACCENT_OPTIONS.some(
    (option) =>
      stylePreset.palette === "custom" &&
      customAccentHex === normalizeCvAccentHex(option.accentHex),
  );
  const isCustomAccentSelected =
    Boolean(customAccentHex) && !fixedAccentHexMatch;
  const customAccentColor =
    isCustomAccentSelected && customAccentHex
      ? customAccentHex
      : CV_CUSTOM_ACCENT_STARTER_HEX;
  const isAiRunning = aiSuggestion?.state === "loading";
  const streamState = "active";
  const streamCount = "2 of 3";
  const streamStages = [
    {
      label: "Parsing imported résumé",
      state: "done",
    },
    {
      label: "Structuring sections",
      state: "active",
    },
    {
      label: "Final pass",
      state: "pending",
    },
  ] as const;

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId || activeId === overId) return;
    onReorderSections(activeId, overId);
  }

  return (
    <aside className="dasti-cv-rail" aria-label="CV forge rail">
      <div className="dasti-cv-rail-tabs" role="tablist" aria-label="CV forge tools">
        {(["sections", "ai", "style"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            data-active={activeTab === tab ? "true" : undefined}
            onClick={() => onActiveTabChange(tab)}
          >
            {tab === "sections" ? "Sections" : tab === "ai" ? "Ask" : "Style"}
          </button>
        ))}
      </div>

      {isImporting ? (
        <>
          <button
            type="button"
            className="dasti-cv-ai-stream"
            data-state={streamState}
            data-expanded={streamExpanded ? "true" : undefined}
            aria-expanded={streamExpanded}
            aria-live="polite"
            onClick={() => setStreamExpanded((expanded) => !expanded)}
          >
            <span className="dasti-cv-ai-stream__dot" />
            <span className="dasti-cv-ai-stream__label">Structuring sections</span>
            <span className="dasti-cv-ai-stream__count">{streamCount}</span>
            <ChevronDown
              className="dasti-cv-ai-stream__caret"
              size={14}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </button>
          {streamExpanded ? (
            <div className="dasti-cv-ai-stage-list">
              {streamStages.map((stage) => (
                <div
                  key={stage.label}
                  className="dasti-cv-ai-stage"
                  data-state={stage.state}
                >
                  <span className="dasti-cv-ai-stage__dot" />
                  <span>{stage.label}</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {activeTab === "sections" ? (
        <div className="dasti-cv-rail-pane" data-rail-pane="sections">
          <div className="dasti-cv-rail-pane__head">
            <span className="dasti-cv-rail-label">Organize</span>
            <span className="dasti-cv-rail-pane__hint">
              <span>Drag to reorder</span>
              <span aria-hidden="true">·</span>
              <Wand2 size={13} strokeWidth={1.8} aria-hidden="true" />
              <span>Improve with Ask</span>
            </span>
          </div>
          {sections.length === 0 ? (
            <div className="dasti-cv-rail-empty">No sections yet.</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
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
          <div className="dasti-cv-rail-hint">
            Open a section row to edit its items.
          </div>
        </div>
      ) : null}

      {activeTab === "ai" ? (
        <div className="dasti-cv-rail-pane" data-rail-pane="ai">
          <div className="dasti-cv-rail-label">
            {activeSection && activeAiMode !== "none"
              ? activeSectionLabel
              : "Ask"}
          </div>
          <div className="dasti-cv-rail-hint">
            {activeSection
              ? activeAiMode === "rail"
                ? "Editing the section selected in the paper or rail."
                : activeAiMode === "editor"
                  ? "Edit the entry."
                  : "Profile fields use direct field editing."
              : "Pick a section in the paper or rail to start."}
          </div>
          {activeAiMode === "editor" ? (
            <>
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={!activeSection}
                onClick={() => {
                  if (!activeSectionId) return;
                  onSelectSection(activeSectionId, { openEditor: true });
                }}
              >
                {activeSection ? `Open ${activeSectionLabel} editor` : "Open editor"}
              </Button>
            </>
          ) : activeUsesStructuredSuggestions ? (
            <>
              <div className="dasti-cv-rail-hint">
                Skills, languages, and hobbies use editable chips in the section editor.
              </div>
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={!activeSection || activeAiMode !== "rail" || isAiRunning}
                onClick={() => {
                  if (!activeSectionId || activeAiMode !== "rail") return;
                  onSelectSection(activeSectionId, { openEditor: true });
                  void onRunAskAiForSection({
                    sectionId: activeSectionId,
                    prompt: "",
                    tone: selectedTone,
                  });
                }}
              >
                {isAiRunning ? (
                  <>
                    Generating suggestions<span className="ds-btn__period">.</span>
                  </>
                ) : scopedAiSuggestion ? (
                  `Refresh in ${activeSectionLabel} editor`
                ) : (
                  `Open ${activeSectionLabel} editor`
                )}
              </Button>
            </>
          ) : (
            <>
              <textarea
                className="ds-field ds-field--textarea dasti-cv-ai-prompt"
                placeholder="Tighten the second bullet, drop the buzzwords."
                disabled={!activeSection || activeAiMode !== "rail" || isAiRunning}
                value={aiPrompt}
                onChange={(event) => {
                  setAiPrompt(event.currentTarget.value);
                }}
              />
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={!activeSection || activeAiMode !== "rail" || isAiRunning}
                onClick={() => {
                  if (!activeSectionId || activeAiMode !== "rail") return;
                  const prompt =
                    aiPrompt.trim() || `Improve the ${activeSectionLabel} section.`;
                  void onRunAskAiForSection({
                    sectionId: activeSectionId,
                    prompt,
                    tone: selectedTone,
                  });
                }}
              >
                {isAiRunning ? (
                  <>
                    Asking AI<span className="ds-btn__period">.</span>
                  </>
                ) : activeSection ? (
                  activeAiMode === "rail"
                    ? `Ask ${activeSectionLabel}`
                    : "Ask section"
                ) : (
                  "Ask section"
                )}
              </Button>
            </>
          )}
          {scopedAiSuggestion?.kind === "list" && activeUsesStructuredSuggestions ? (
            <div className="dasti-cv-rail-hint">
              Suggestions appear in the section editor as chips you can add or
              dismiss.
            </div>
          ) : scopedAiSuggestion?.kind === "list" ? (
            <div
              className="dasti-cv-ai-list-card"
              role="region"
              aria-label={`Suggested items for ${scopedAiSuggestion.sectionLabel}`}
              data-state={scopedAiSuggestion.state}
            >
              <div className="dasti-cv-ai-list-card__title">
                {`Suggested items for ${scopedAiSuggestion.sectionLabel}`}
              </div>
              {scopedAiSuggestion.state === "loading" ? (
                <p className="dasti-cv-ai-list-card__copy">
                  Generating suggestions<span className="ds-btn__period">.</span>
                </p>
              ) : scopedAiSuggestion.state === "error" ? (
                <p className="dasti-cv-ai-list-card__error">
                  {scopedAiSuggestion.errorMessage ?? "AI suggestions are unavailable."}
                </p>
              ) : scopedAiSuggestion.items.length > 0 ? (
                <div className="dasti-cv-ai-list-card__items">
                  {scopedAiSuggestion.items.map((item) => (
                    <span className="dasti-cv-ai-list-chip" key={item}>
                      <span>{item}</span>
                      <button
                        type="button"
                        aria-label={`Add suggested item ${item}`}
                        onClick={() => onAcceptListAiSuggestion(item)}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        aria-label={`Dismiss suggested item ${item}`}
                        onClick={() => onDismissListAiSuggestion(item)}
                      >
                        Dismiss
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="dasti-cv-ai-list-card__copy">
                  No new suggestions for this section.
                </p>
              )}
            </div>
          ) : scopedAiSuggestion ? (
            <AiSuggestionCard
              compact
              actionLabel="Ask"
              title={`Suggested edit for ${scopedAiSuggestion.sectionLabel}`}
              beforeText={scopedAiSuggestion.beforeText}
              afterText={scopedAiSuggestion.afterText}
              state={scopedAiSuggestion.state}
              errorMessage={scopedAiSuggestion.errorMessage}
              onAccept={onAcceptAiSuggestion}
              onDiscard={onDiscardAiSuggestion}
              onRetry={() => {
                if (!activeSectionId) return;
                void onRunAskAiForSection({
                  sectionId: activeSectionId,
                  prompt:
                    aiPrompt.trim() ||
                    `Improve the ${activeSectionLabel} section.`,
                  tone: selectedTone,
                });
              }}
            />
          ) : scopedAppliedAiEdit ? (
            <div
              role="status"
              aria-label={`Applied. Undo ${scopedAppliedAiEdit.sectionLabel}`}
              className="dasti-ai-applied-status"
            >
              <span>Applied.</span>
              <button
                type="button"
                className="dasti-ai-applied-status__undo"
                onClick={onUndoAiSuggestion}
              >
                Undo
              </button>
            </div>
          ) : null}
          {activeAiMode !== "editor" ? (
            <div className="dasti-cv-rail-hint">
              CVs are edited section-by-section. To rewrite multiple sections, run them one at a time.
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "style" ? (
        <div className="dasti-cv-rail-pane" data-rail-pane="style">
          <div className="dasti-cv-style-note">
            Default settings{" "}
            <a className="dasti-cv-rail-link" href="/settings?tab=docstyle">
              → Document style
            </a>
            .
          </div>
          <div className="dasti-cv-rail-label">Style</div>
          <div className="dasti-cv-style-pills" aria-label="CV style presets">
            {([1, 2, 3] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                data-selected={selectedStyleSlot === slot ? "true" : undefined}
                aria-pressed={selectedStyleSlot === slot}
                onClick={() => onSelectStyleSlot(slot)}
              >
                {`Style ${slot}${selectedStyleSlot === slot && selectedStyleSlotIsCustom ? " · Custom" : ""}`}
              </button>
            ))}
          </div>
          {selectedStyleSlot && selectedStyleSlotIsCustom && onResetStyleSlot ? (
            <button
              type="button"
              className="dasti-cv-rail-secondary-action"
              onClick={onResetStyleSlot}
            >
              Reset Style {selectedStyleSlot}
            </button>
          ) : null}
          <div className="dasti-cv-rail-label">Template</div>
          <div className="dasti-cv-style-pills">
            <button
              type="button"
              data-selected={
                stylePreset.layout === "workshop" &&
                (stylePreset.resumeTemplateId ?? WORKSHOP_RESUME_ONECOL_TEMPLATE_ID) ===
                  WORKSHOP_RESUME_ONECOL_TEMPLATE_ID
                  ? "true"
                  : undefined
              }
              aria-pressed={
                stylePreset.layout === "workshop" &&
                (stylePreset.resumeTemplateId ?? WORKSHOP_RESUME_ONECOL_TEMPLATE_ID) ===
                  WORKSHOP_RESUME_ONECOL_TEMPLATE_ID
              }
              onClick={() => onSelectTemplate("workshop-onecol")}
            >
              Minimal
            </button>
            <button
              type="button"
              data-selected={
                stylePreset.layout === "workshop" &&
                stylePreset.resumeTemplateId === WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID
                  ? "true"
                  : undefined
              }
              aria-pressed={
                stylePreset.layout === "workshop" &&
                stylePreset.resumeTemplateId === WORKSHOP_RESUME_TWOCOL_TEMPLATE_ID
              }
              onClick={() => onSelectTemplate("workshop-twocol")}
            >
              French
            </button>
          </div>
          <div className="dasti-cv-rail-label">Font pair</div>
          <FontPairMenu
            value={stylePreset.typography as VerbatiFontPairId}
            onSelectFontPair={onSelectFontPair}
          />
          <div className="dasti-cv-rail-label">Accent</div>
          <div
            ref={customColorSurfaceRef}
            className="dasti-cv-style-swatches"
            aria-label="Accent colors"
          >
            {ACCENT_OPTIONS.map((swatch) => (
              <button
                key={swatch.id}
                type="button"
                className={`dasti-cv-style-swatch dasti-cv-style-swatch--${swatch.id}`}
                style={
                  {
                    "--cv-accent-swatch": swatch.accentHex,
                  } as React.CSSProperties
                }
                aria-label={`Use ${swatch.label} accent`}
                aria-pressed={activeAccent?.id === swatch.id}
                data-selected={activeAccent?.id === swatch.id ? "true" : undefined}
                onClick={() => {
                  setIsCustomColorPickerOpen(false);
                  onSelectAccent(swatch.id);
                }}
              >
                {activeAccent?.id === swatch.id ? <Check size={12} strokeWidth={1.9} /> : null}
              </button>
            ))}
              <button
                ref={customColorAnchorRef}
                type="button"
                className={[
                  "dasti-cv-style-swatch",
                  "dasti-cv-style-swatch--custom",
                ]
                  .filter(Boolean)
                  .join(" ")}
              style={
                {
                  "--cv-accent-swatch": customAccentColor,
                } as React.CSSProperties
              }
              aria-label="Open custom color picker"
              aria-pressed={isCustomAccentSelected}
              data-selected={isCustomAccentSelected ? "true" : undefined}
              title={
                isCustomAccentSelected
                  ? `Custom accent ${customAccentColor}`
                  : "Open custom color picker"
              }
                onClick={() => setIsCustomColorPickerOpen(true)}
              >
                {isCustomAccentSelected ? <Check size={12} strokeWidth={1.9} aria-hidden="true" /> : null}
              </button>
            </div>
          <ProposalColorPickerPopover
            currentHex={customAccentColor}
            anchorRef={customColorAnchorRef}
            surfaceAnchorRef={customColorSurfaceRef}
            horizontalAlign="center"
            isOpen={isCustomColorPickerOpen}
            onClose={() => setIsCustomColorPickerOpen(false)}
            onHexChange={onSelectCustomAccent}
          />
        </div>
      ) : null}

      <div className="dasti-cv-rail-footer">
        <span className="dasti-cv-rail-footer__label">Create</span>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onNewCv}
          disabled={isImporting}
          iconLeft={<PenLine size={14} strokeWidth={1.8} />}
        >
          New CV
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onImportPdf}
          disabled={isImporting}
          iconLeft={<Upload size={14} strokeWidth={1.8} />}
        >
          {isImporting ? "Importing PDF" : "Import PDF"}
        </Button>
      </div>
    </aside>
  );
}

export default CvRail;
