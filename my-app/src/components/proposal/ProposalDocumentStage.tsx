import React from "react";
import { Button } from "../ui";
import {
  ArrowUDownRight,
  ArrowUUpLeft,
  Briefcase,
  ChatCircleText,
  ClipboardText,
  Eye,
  Palette,
  NewspaperClipping,
  Layout,
  PaperPlaneRight,
  PenLine,
  TrashSimple,
} from "@/lib/icons";
import { useDocumentCommandLayerPosition } from "@/hooks/use-document-command-layer-position";
import {
  getCommandLayerLabelDensity,
  getCommandLayerToolbarDensity,
} from "@/lib/document-command-layer-layout";

type SafeSendState = "clear" | "warn" | "danger";

type ProposalDocumentStageProps = {
  mode: "preview" | "edit";
  hasProposalContent: boolean;
  styleControl?: React.ReactNode;
  templatesOpen?: boolean;
  designOpen?: boolean;
  headingOpen?: boolean;
  children: React.ReactNode;
  onModeChange: (mode: "preview" | "edit") => void;
  onOpenHeading?: () => void;
  onOpenDesign?: () => void;
  onOpenTemplates?: () => void;
  onOpenDraft?: () => void;
  onOpenAsk?: () => void;
  composerMode?: "draft" | "ask" | null;
  onDeleteDraft?: () => void;
  onSaveToLibrary?: () => void;
  sourceJobLinked?: boolean;
  sourceCvSelected?: boolean;
  proposalLinked?: boolean;
  matchReviewAccepted?: boolean | null;
  hasUnresolvedImportIssues?: boolean | null;
  hasPendingAiSuggestion?: boolean | null;
  unsupportedClaimState?: SafeSendState | null;
  hasPlaceholderText?: boolean;
  recipientOrExportTargetSelected?: boolean;
  finalExportReviewed?: boolean;
  onReviewMatch?: () => void;
  onResolveImportIssues?: () => void;
  reserveToolbarBeforeContent?: boolean;
  labels?: Partial<ProposalDocumentStageLabels>;
};

export type ProposalDocumentStageLabels = {
  proposalToolbar: string;
  proposalViewMode: string;
  documentControls: string;
  switchToPreview: string;
  switchToEdit: string;
  edit: string;
  preview: string;
  editProposal: string;
  previewProposal: string;
  heading: string;
  design: string;
  templates: string;
  proposalUndoRedoActions: string;
  undo: string;
  redo: string;
  proposalLibraryActions: string;
  saveProposalToLibrary: string;
  saveToLibrary: string;
  deleteDraft: string;
  primaryWritingAction: string;
  draftProposal: string;
  draftProposalShort: string;
  jobAndCv: string;
  ask: string;
};

const DEFAULT_LABELS: ProposalDocumentStageLabels = {
  proposalToolbar: "Proposal toolbar",
  proposalViewMode: "Proposal view mode",
  documentControls: "Document controls",
  switchToPreview: "Switch to Preview",
  switchToEdit: "Switch to Edit",
  edit: "Edit",
  preview: "Preview",
  editProposal: "Edit proposal",
  previewProposal: "Preview proposal",
  heading: "Heading",
  design: "Design",
  templates: "Templates",
  proposalUndoRedoActions: "Proposal undo redo actions",
  undo: "Undo",
  redo: "Redo",
  proposalLibraryActions: "Proposal library actions",
  saveProposalToLibrary: "Save proposal to library",
  saveToLibrary: "Save to library",
  deleteDraft: "Delete draft",
  primaryWritingAction: "Primary writing action",
  draftProposal: "Draft proposal",
  draftProposalShort: "Draft",
  jobAndCv: "Job & CV",
  ask: "Ask",
};

const COMMAND_LAYER_TOOLBAR_MIN_WIDTH = 300;
const COMMAND_LAYER_TOOLBAR_NATURAL_WIDTH = 680;
const COMMAND_LAYER_TOOLBAR_HEIGHT = 44;
const COMMAND_LAYER_SAFE_MARGIN = 12;
const COMMAND_LAYER_GAP = 12;
const ASK_OFFSET_FROM_PAPER_TOP = 16;
const ASK_HANDLE_ICON_SIZE = 32;
const COMMAND_LAYER_ASK_HANDLE = {
  iconWidth: ASK_HANDLE_ICON_SIZE,
  height: ASK_HANDLE_ICON_SIZE,
};

const PAPER_ANCHOR_SELECTOR = [
  ".dasti-proposal-sheet__preview-page:not(.dasti-proposal-sheet__preview-page--stacked)",
  ".dasti-proposal-document__page",
  ".dasti-document-stage__canvas[data-document-page='true']",
  ".dasti-proposal-sheet__preview-page",
].join(",");
const COMMAND_LAYER_CANVAS_SELECTOR = ".dasti-proposal-skeleton-forge";

function runBrowserCommand(command: "undo" | "redo") {
  if (typeof document === "undefined" || !document.execCommand) return;
  document.execCommand(command);
}

export function ProposalDocumentStage({
  mode,
  hasProposalContent,
  styleControl = null,
  templatesOpen = false,
  designOpen = false,
  headingOpen = false,
  children,
  onModeChange,
  onOpenHeading,
  onOpenDesign,
  onOpenTemplates,
  onOpenDraft,
  onOpenAsk,
  composerMode = null,
  onDeleteDraft,
  onSaveToLibrary,
  reserveToolbarBeforeContent = false,
  labels,
}: ProposalDocumentStageProps): JSX.Element {
  const stageIconSize = 18;
  const stageRef = React.useRef<HTMLElement | null>(null);
  const paperRef = React.useRef<HTMLDivElement | null>(null);
  const {
    style: toolbarAnchorStyle,
    toolbarMode,
    draftLabelMode,
    modeControlMode,
    askMode,
    commandLayerSticky,
  } = useDocumentCommandLayerPosition({
    stageRef,
    paperRef,
    paperAnchorSelector: PAPER_ANCHOR_SELECTOR,
    toolbarTopAnchorSelector: ".dasti-proposal-template-job-empty",
    commandCanvasSelector: COMMAND_LAYER_CANVAS_SELECTOR,
    cssVarPrefix: "proposal",
    toolbarSelector: "[data-testid='proposal-toolbar']",
    toolbarNaturalWidth: COMMAND_LAYER_TOOLBAR_NATURAL_WIDTH,
    toolbarMinWidth: COMMAND_LAYER_TOOLBAR_MIN_WIDTH,
    toolbarHeight: COMMAND_LAYER_TOOLBAR_HEIGHT,
    askHandle: COMMAND_LAYER_ASK_HANDLE,
    safeMargin: COMMAND_LAYER_SAFE_MARGIN,
    gap: COMMAND_LAYER_GAP,
    askOffsetFromPaperTop: ASK_OFFSET_FROM_PAPER_TOP,
    refreshKey: mode,
  });
  const uiLabels = { ...DEFAULT_LABELS, ...labels };
  const isUltraCompactToolbar = modeControlMode === "toggle";
  const nextMode = mode === "edit" ? "preview" : "edit";
  const modeToggleLabel =
    mode === "edit" ? uiLabels.switchToPreview : uiLabels.switchToEdit;
  const sourceContextLabel = hasProposalContent
    ? uiLabels.jobAndCv
    : uiLabels.draftProposal;
  const sourceContextShortLabel = hasProposalContent
    ? uiLabels.jobAndCv
    : uiLabels.draftProposalShort;

  return (
    <section
      ref={stageRef}
      className="dasti-proposal-skeleton-stage"
      data-testid="proposal-canvas"
      data-toolbar-mode={toolbarMode}
      data-draft-label-mode={draftLabelMode}
      data-mode-control-mode={modeControlMode}
      data-ask-mode={askMode}
      data-command-layer-sticky={commandLayerSticky ? "true" : undefined}
      data-toolbar-density={getCommandLayerToolbarDensity(toolbarMode)}
      data-ask-placement={askMode === "edgeTab" ? "edge-tab" : "outside"}
      data-ask-density="icon"
      data-draft-density={getCommandLayerLabelDensity(draftLabelMode)}
      data-toolbar-before-content={
        reserveToolbarBeforeContent ? "true" : undefined
      }
      aria-label="Proposal document stage"
    >
      <div
        className="forge__stage-bar dasti-proposal-skeleton-stage__bar dasti-toolbar--surface-tooltips"
        data-sticky={commandLayerSticky ? "true" : undefined}
        data-testid="proposal-toolbar"
        style={toolbarAnchorStyle}
      >
        <div
          className="dasti-proposal-skeleton-stage__toolbar-main"
          role="group"
          aria-label={uiLabels.proposalToolbar}
        >
          <div
            className="dasti-icon-cluster dasti-icon-cluster--tight dasti-proposal-skeleton-stage__actions dasti-proposal-skeleton-stage__actions--document"
            role="group"
            aria-label={uiLabels.documentControls}
          >
            {isUltraCompactToolbar ? (
              <button
                type="button"
                className="dasti-icon-button dasti-proposal-mode-toggle dasti-proposal-mode-toggle--single"
                onClick={() => onModeChange(nextMode)}
                aria-label={modeToggleLabel}
                data-toolbar-tooltip={modeToggleLabel}
              >
                {mode === "edit" ? (
                  <PenLine
                    size={stageIconSize}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                ) : (
                  <Eye
                    size={stageIconSize}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                )}
              </button>
            ) : (
              <div
                className="style-segmented dasti-proposal-skeleton-stage__mode"
                role="group"
                aria-label={uiLabels.proposalViewMode}
              >
                <button
                  type="button"
                  className="dasti-proposal-mode-toggle"
                  data-selected={mode === "edit" ? "true" : undefined}
                  onClick={() => onModeChange("edit")}
                  aria-label={uiLabels.editProposal}
                  data-toolbar-tooltip={uiLabels.edit}
                >
                  <PenLine
                    size={stageIconSize}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  className="dasti-proposal-mode-toggle"
                  data-selected={mode === "preview" ? "true" : undefined}
                  onClick={() => onModeChange("preview")}
                  aria-label={uiLabels.previewProposal}
                  data-toolbar-tooltip={uiLabels.preview}
                >
                  <Eye
                    size={stageIconSize}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </button>
              </div>
            )}
            {styleControl ? (
              <div className="dasti-proposal-skeleton-stage__style-control">
                {styleControl}
              </div>
            ) : null}
            {onOpenHeading ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="dasti-proposal-skeleton-stage__primary-action"
                iconLeft={
                  <NewspaperClipping size={stageIconSize} strokeWidth={1.8} />
                }
                aria-expanded={headingOpen}
                aria-label={uiLabels.heading}
                data-toolbar-tooltip={uiLabels.heading}
                data-stage-tooltip-mode="compact"
                onClick={onOpenHeading}
              >
                <span className="dasti-proposal-skeleton-stage__action-label">
                  {uiLabels.heading}
                </span>
              </Button>
            ) : null}
            {onOpenDesign ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="dasti-proposal-skeleton-stage__primary-action"
                iconLeft={<Palette size={stageIconSize} strokeWidth={1.8} />}
                aria-expanded={designOpen}
                aria-label={uiLabels.design}
                data-toolbar-tooltip={uiLabels.design}
                data-stage-tooltip-mode="compact"
                onClick={onOpenDesign}
              >
                <span className="dasti-proposal-skeleton-stage__action-label">
                  {uiLabels.design}
                </span>
              </Button>
            ) : null}
            {onOpenTemplates ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="dasti-proposal-skeleton-stage__primary-action"
                iconLeft={<Layout size={stageIconSize} strokeWidth={1.8} />}
                aria-expanded={templatesOpen}
                aria-label={uiLabels.templates}
                data-toolbar-tooltip={uiLabels.templates}
                data-stage-tooltip-mode="compact"
                onClick={onOpenTemplates}
              >
                <span className="dasti-proposal-skeleton-stage__action-label">
                  {uiLabels.templates}
                </span>
              </Button>
            ) : null}
          </div>
          {mode === "edit" ? (
            <div
              className="dasti-icon-cluster dasti-icon-cluster--tight dasti-proposal-skeleton-stage__right-actions dasti-proposal-skeleton-stage__right-actions--history"
              role="group"
              aria-label={uiLabels.proposalUndoRedoActions}
            >
              <button
                type="button"
                className="dasti-icon-button dasti-proposal-skeleton-stage__action-plain"
                onClick={() => runBrowserCommand("undo")}
                aria-label={uiLabels.undo}
                data-toolbar-tooltip={uiLabels.undo}
              >
                <ArrowUUpLeft
                  size={stageIconSize}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                className="dasti-icon-button dasti-proposal-skeleton-stage__action-plain"
                onClick={() => runBrowserCommand("redo")}
                aria-label={uiLabels.redo}
                data-toolbar-tooltip={uiLabels.redo}
              >
                <ArrowUDownRight
                  size={stageIconSize}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </button>
            </div>
          ) : null}
          {onDeleteDraft || onSaveToLibrary ? (
            <div
              className="dasti-icon-cluster dasti-icon-cluster--tight dasti-proposal-skeleton-stage__right-actions dasti-proposal-skeleton-stage__right-actions--library"
              role="group"
              aria-label={uiLabels.proposalLibraryActions}
            >
              {onSaveToLibrary ? (
                <button
                  type="button"
                  className="dasti-icon-button dasti-proposal-skeleton-stage__action-plain"
                  onClick={onSaveToLibrary}
                  disabled={!hasProposalContent}
                  aria-label={uiLabels.saveProposalToLibrary}
                  data-toolbar-tooltip={uiLabels.saveToLibrary}
                >
                  <ClipboardText
                    size={stageIconSize}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </button>
              ) : null}
              {onDeleteDraft ? (
                <button
                  type="button"
                  className="dasti-icon-button dasti-proposal-skeleton-stage__action-plain"
                  onClick={onDeleteDraft}
                  disabled={!hasProposalContent}
                  aria-label={uiLabels.deleteDraft}
                  data-toolbar-tooltip={uiLabels.deleteDraft}
                >
                  <TrashSimple
                    size={stageIconSize}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </button>
              ) : null}
            </div>
          ) : null}
          {onOpenDraft ? (
            <div
              className="dasti-icon-cluster dasti-icon-cluster--tight dasti-proposal-skeleton-stage__actions dasti-proposal-skeleton-stage__actions--writing"
              role="group"
              aria-label={uiLabels.primaryWritingAction}
            >
              <Button
                type="button"
                size="sm"
                variant={hasProposalContent ? "secondary" : "primary"}
                className="dasti-proposal-skeleton-stage__primary-action dasti-proposal-skeleton-stage__primary-action--draft"
                iconLeft={
                  hasProposalContent ? (
                    <Briefcase size={stageIconSize} strokeWidth={1.8} />
                  ) : (
                    <PaperPlaneRight size={stageIconSize} strokeWidth={1.8} />
                  )
                }
                aria-expanded={composerMode === "draft"}
                aria-label={sourceContextLabel}
                data-testid="proposal-draft-button"
                data-source-context={hasProposalContent ? "true" : undefined}
                data-toolbar-tooltip={sourceContextLabel}
                data-stage-tooltip-mode="compact"
                onClick={onOpenDraft}
              >
                {hasProposalContent ? null : (
                  <>
                    <span className="dasti-proposal-skeleton-stage__action-label dasti-proposal-skeleton-stage__action-label--full">
                      {sourceContextLabel}
                    </span>
                    <span className="dasti-proposal-skeleton-stage__action-label dasti-proposal-skeleton-stage__action-label--short">
                      {sourceContextShortLabel}
                    </span>
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {onOpenAsk ? (
        <div
          className="dasti-proposal-skeleton-stage__ask-handle-layer dasti-toolbar--surface-tooltips"
          data-sticky={commandLayerSticky ? "true" : undefined}
          style={toolbarAnchorStyle}
        >
          <button
            type="button"
            className="dasti-icon-button dasti-proposal-skeleton-stage__ask-handle"
            aria-expanded={composerMode === "ask"}
            aria-label={uiLabels.ask}
            title={uiLabels.ask}
            data-testid="proposal-ask-handle"
            data-toolbar-tooltip={uiLabels.ask}
            data-stage-tooltip-mode="compact"
            onClick={onOpenAsk}
          >
            <ChatCircleText size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div
        ref={paperRef}
        className="dasti-proposal-skeleton-stage__paper"
        data-testid="proposal-paper"
      >
        {children}
      </div>
    </section>
  );
}

export default ProposalDocumentStage;
