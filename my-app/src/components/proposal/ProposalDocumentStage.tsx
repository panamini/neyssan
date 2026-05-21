import React from "react";
import { Button } from "../ui";
import {
  ArrowUDownRight,
  ArrowUUpLeft,
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
  const isUltraCompactToolbar = modeControlMode === "toggle";
  const nextMode = mode === "edit" ? "preview" : "edit";
  const modeToggleLabel =
    mode === "edit" ? "Switch to Preview" : "Switch to Edit";
  const askTooltip = "Ask";

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
      data-toolbar-density={
        toolbarMode === "wide" || toolbarMode === "medium"
          ? undefined
          : toolbarMode === "ultraCompact"
            ? "ultra"
            : "compact"
      }
      data-ask-placement={askMode === "edgeTab" ? "edge-tab" : "outside"}
      data-ask-density="icon"
      data-draft-density={
        draftLabelMode === "iconOnly" ? "icon" : draftLabelMode
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
          aria-label="Proposal toolbar"
        >
          <div
            className="dasti-icon-cluster dasti-icon-cluster--tight dasti-proposal-skeleton-stage__actions dasti-proposal-skeleton-stage__actions--document"
            role="group"
            aria-label="Document controls"
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
                aria-label="Proposal view mode"
              >
                <button
                  type="button"
                  className="dasti-proposal-mode-toggle"
                  data-selected={mode === "edit" ? "true" : undefined}
                  onClick={() => onModeChange("edit")}
                  aria-label="Edit proposal"
                  data-toolbar-tooltip="Edit"
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
                  aria-label="Preview proposal"
                  data-toolbar-tooltip="Preview"
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
                aria-label="Heading"
                data-toolbar-tooltip="Heading"
                data-stage-tooltip-mode="compact"
                onClick={onOpenHeading}
              >
                <span className="dasti-proposal-skeleton-stage__action-label">
                  Heading
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
                aria-label="Design"
                data-toolbar-tooltip="Design"
                data-stage-tooltip-mode="compact"
                onClick={onOpenDesign}
              >
                <span className="dasti-proposal-skeleton-stage__action-label">
                  Design
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
                aria-label="Templates"
                data-toolbar-tooltip="Templates"
                data-stage-tooltip-mode="compact"
                onClick={onOpenTemplates}
              >
                <span className="dasti-proposal-skeleton-stage__action-label">
                  Templates
                </span>
              </Button>
            ) : null}
          </div>
          {mode === "edit" ? (
            <div
              className="dasti-icon-cluster dasti-icon-cluster--tight dasti-proposal-skeleton-stage__right-actions dasti-proposal-skeleton-stage__right-actions--history"
              role="group"
              aria-label="Proposal undo redo actions"
            >
              <button
                type="button"
                className="dasti-icon-button dasti-proposal-skeleton-stage__action-plain"
                onClick={() => runBrowserCommand("undo")}
                aria-label="Undo"
                data-toolbar-tooltip="Undo"
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
                aria-label="Redo"
                data-toolbar-tooltip="Redo"
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
              aria-label="Proposal library actions"
            >
              {onSaveToLibrary ? (
                <button
                  type="button"
                  className="dasti-icon-button dasti-proposal-skeleton-stage__action-plain"
                  onClick={onSaveToLibrary}
                  disabled={!hasProposalContent}
                  aria-label="Save proposal to library"
                  data-toolbar-tooltip="Save to library"
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
                  aria-label="Delete draft"
                  data-toolbar-tooltip="Delete draft"
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
              aria-label="Primary writing action"
            >
              <Button
                type="button"
                size="sm"
                variant="primary"
                className="dasti-proposal-skeleton-stage__primary-action dasti-proposal-skeleton-stage__primary-action--draft"
                iconLeft={
                  <PaperPlaneRight size={stageIconSize} strokeWidth={1.8} />
                }
                aria-expanded={composerMode === "draft"}
                aria-label="Draft proposal"
                data-testid="proposal-draft-button"
                data-toolbar-tooltip="Draft proposal"
                data-stage-tooltip-mode="compact"
                onClick={onOpenDraft}
              >
                <span className="dasti-proposal-skeleton-stage__action-label dasti-proposal-skeleton-stage__action-label--full">
                  Draft proposal
                </span>
                <span className="dasti-proposal-skeleton-stage__action-label dasti-proposal-skeleton-stage__action-label--short">
                  Draft
                </span>
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
            aria-label="Ask"
            title="Ask"
            data-testid="proposal-ask-handle"
            data-toolbar-tooltip={askTooltip}
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
