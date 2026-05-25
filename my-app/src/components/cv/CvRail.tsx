import React from "react";
import { ChevronDown } from "@/lib/icons";
import { Button } from "../ui";
import AiSuggestionCard from "../ai/AiSuggestionCard";
import type { InlineAiActionId } from "../FloatingAiToolbar";
import type { CvSection } from "../../types/cvDocument";
import type { ActivePaperEditTarget } from "../../features/verbati/resume/InlineEditableText";
import { formatSectionDisplayTitle } from "../../lib/cv-section-organization";
import type { CvAddSectionKind } from "./CvSectionsOrganizer";

export type CvRailTab = "ai";
export type CvToneChoice = "warm" | "formal" | "natural";

export type CvRailAiSuggestion =
  | {
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
    }
  | {
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
  activeSectionId: string | null;
  activeTab: CvRailTab;
  hideTabs?: boolean;
  selectedTone: CvToneChoice;
  aiSuggestion: CvRailAiSuggestion | null;
  appliedAiEdit: CvRailAppliedAiEdit | null;
  askSelectionContext?: {
    selectedText: string;
    editTarget: ActivePaperEditTarget;
  } | null;
  isImporting: boolean;
  onActiveTabChange: (tab: CvRailTab) => void;
  onSelectSection: (
    sectionId: string,
    options?: { openEditor?: boolean },
  ) => void;
  onRunAskAiForSection: (args: {
    sectionId: string;
    prompt: string;
    tone: CvToneChoice;
  }) => Promise<void>;
  onRunAskAiForSelection?: (args: {
    prompt: string;
    actionId: InlineAiActionId;
  }) => Promise<void>;
  onAcceptAiSuggestion: () => void;
  onDiscardAiSuggestion: () => void;
  onUndoAiSuggestion: () => void;
  onAcceptListAiSuggestion: (value: string) => void;
  onDismissListAiSuggestion: (value: string) => void;
};

export type { CvAddSectionKind };

function getSectionId(section: CvSection, index: number): string {
  return String(section.id ?? `${section.type}-${index}`);
}

function getActiveSection(
  sections: CvSection[],
  activeSectionId: string | null,
): CvSection | null {
  if (!activeSectionId) return sections[0] ?? null;
  return (
    sections.find(
      (section, index) => getSectionId(section, index) === activeSectionId,
    ) ??
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

function getRailAiMode(section: CvSection): "none" | "rail" | "editor" {
  if (section.type === "profile" || section.type === "contact") return "none";
  return "rail";
}

function usesStructuredSuggestions(section: CvSection): boolean {
  return (
    section.type === "skills" ||
    section.type === "languages" ||
    isHobbiesSection(section)
  );
}

export function CvRail({
  sections,
  activeSectionId,
  activeTab: _activeTab,
  selectedTone,
  aiSuggestion,
  appliedAiEdit,
  askSelectionContext = null,
  isImporting,
  hideTabs = false,
  onActiveTabChange: _onActiveTabChange,
  onRunAskAiForSection,
  onRunAskAiForSelection,
  onAcceptAiSuggestion,
  onDiscardAiSuggestion,
  onUndoAiSuggestion,
  onAcceptListAiSuggestion,
  onDismissListAiSuggestion,
}: CvRailProps): JSX.Element {
  const activeSection = getActiveSection(sections, activeSectionId);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [streamExpanded, setStreamExpanded] = React.useState(false);
  const activeSectionLabel = activeSection
    ? formatSectionDisplayTitle(activeSection, { fallback: "Section" })
    : "";
  const activeAiMode = activeSection ? getRailAiMode(activeSection) : "none";
  const activeUsesStructuredSuggestions = activeSection
    ? usesStructuredSuggestions(activeSection)
    : false;
  const scopedAiSuggestion =
    aiSuggestion && aiSuggestion.sectionId === activeSectionId
      ? aiSuggestion
      : null;
  const scopedAppliedAiEdit =
    appliedAiEdit && appliedAiEdit.sectionId === activeSectionId
      ? appliedAiEdit
      : null;
  const isAiRunning = aiSuggestion?.state === "loading";
  const hasSelectedTextContext =
    Boolean(askSelectionContext?.selectedText.trim()) &&
    activeSectionId === askSelectionContext?.editTarget.sectionId &&
    Boolean(onRunAskAiForSelection);
  const activeAskUnavailable =
    Boolean(activeSection) &&
    !hasSelectedTextContext &&
    (activeAiMode === "none" || activeAiMode === "editor");
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

  return (
    <aside className="dasti-cv-rail" aria-label="CV forge rail">
      {hideTabs ? null : <div className="dasti-cv-rail-heading">Ask</div>}

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
            <span className="dasti-cv-ai-stream__label">
              Structuring sections
            </span>
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

      <div className="dasti-cv-rail-pane" data-rail-pane="ai">
        <div className="dasti-cv-rail-label">
          {activeSection ? activeSectionLabel : "Ask"}
        </div>
        <div className="dasti-cv-rail-hint">
          {activeSection
            ? hasSelectedTextContext
              ? "Editing the selected paper text."
              : activeAiMode === "rail"
                ? "Editing the section selected in the paper or rail."
                : "Ask is unavailable for this section."
            : "Select a section or ask for a CV edit."}
        </div>
        {hasSelectedTextContext ? (
          <>
            <textarea
              className="ds-field ds-field--textarea dasti-cv-ai-prompt"
              placeholder="Rewrite selected content, tighten bullets, or make it more formal."
              disabled={isAiRunning}
              value={aiPrompt}
              onChange={(event) => {
                setAiPrompt(event.currentTarget.value);
              }}
            />
            <div className="dasti-cv-rail-action-row">
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={isAiRunning}
                onClick={() => {
                  void onRunAskAiForSelection?.({
                    actionId: "custom",
                    prompt:
                      aiPrompt.trim() ||
                      "Rewrite the selected CV text while preserving the facts.",
                  });
                }}
              >
                {isAiRunning ? (
                  <>
                    Asking AI<span className="ds-btn__period">.</span>
                  </>
                ) : (
                  "Rewrite selected content"
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={isAiRunning}
                onClick={() => {
                  void onRunAskAiForSelection?.({
                    actionId: "shorten",
                    prompt: "Tighten the selected CV text.",
                  });
                }}
              >
                Tighten
              </Button>
            </div>
          </>
        ) : activeAskUnavailable ? (
          <div className="dasti-cv-rail-hint" role="status">
            Select text on the page or use a section wand for AI-assisted edits.
          </div>
        ) : activeUsesStructuredSuggestions ? (
          <>
            <div className="dasti-cv-rail-hint">
              Skills, languages, and hobbies use editable chips in the section
              editor.
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={
                !activeSection || activeAiMode !== "rail" || isAiRunning
              }
              onClick={() => {
                if (!activeSectionId || activeAiMode !== "rail") return;
                void onRunAskAiForSection({
                  sectionId: activeSectionId,
                  prompt:
                    aiPrompt.trim() ||
                    `Suggest improvements for the ${activeSectionLabel} section.`,
                  tone: selectedTone,
                });
              }}
            >
              {isAiRunning ? (
                <>
                  Asking AI<span className="ds-btn__period">.</span>
                </>
              ) : activeSection ? (
                `Ask ${activeSectionLabel}`
              ) : (
                "Ask section"
              )}
            </Button>
          </>
        ) : (
          <>
            <textarea
              className="ds-field ds-field--textarea dasti-cv-ai-prompt"
              placeholder="Tighten the second bullet, drop the buzzwords."
              disabled={
                !activeSection || activeAiMode !== "rail" || isAiRunning
              }
              value={aiPrompt}
              onChange={(event) => {
                setAiPrompt(event.currentTarget.value);
              }}
            />
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={
                !activeSection || activeAiMode !== "rail" || isAiRunning
              }
              onClick={() => {
                if (!activeSectionId || activeAiMode !== "rail") return;
                const prompt =
                  aiPrompt.trim() ||
                  `Improve the ${activeSectionLabel} section.`;
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
                activeAiMode === "rail" ? (
                  `Ask ${activeSectionLabel}`
                ) : (
                  "Ask section"
                )
              ) : (
                "Ask section"
              )}
            </Button>
          </>
        )}
        {scopedAiSuggestion?.kind === "list" &&
        activeUsesStructuredSuggestions ? (
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
                {scopedAiSuggestion.errorMessage ??
                  "AI suggestions are unavailable."}
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
        {activeAiMode === "rail" ? (
          <div className="dasti-cv-rail-hint">
            CVs are edited section-by-section. To rewrite multiple sections, run
            them one at a time.
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export default CvRail;
