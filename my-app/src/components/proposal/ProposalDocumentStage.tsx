import React from "react";
import { Button, ToneBadge } from "../ui";
import {
  ArrowUDownRight,
  ArrowUUpLeft,
  ClipboardText,
  Eye,
  Palette,
  NewspaperClipping,
  Layout,
  PenLine,
  TrashSimple,
} from "@/lib/icons";

type SafeSendState = "clear" | "warn" | "danger";

type ProposalDocumentStageProps = {
  toneLabel: string;
  toneValue: "auto" | "warm" | "formal" | "natural";
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

function runBrowserCommand(command: "undo" | "redo") {
  if (typeof document === "undefined" || !document.execCommand) return;
  document.execCommand(command);
}

export function ProposalDocumentStage({
  toneLabel,
  toneValue,
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
  onDeleteDraft,
  onSaveToLibrary,
}: ProposalDocumentStageProps): JSX.Element {
  const stageIconSize = 18;

  return (
    <section
      className="dasti-proposal-skeleton-stage"
      aria-label="Proposal document stage"
    >
      <div className="forge__stage-bar dasti-proposal-skeleton-stage__bar dasti-toolbar--surface-tooltips">
        <div
          className="dasti-icon-cluster dasti-icon-cluster--tight dasti-proposal-skeleton-stage__actions"
          role="group"
          aria-label="Proposal document actions"
        >
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
              <PenLine size={stageIconSize} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="dasti-proposal-mode-toggle"
              data-selected={mode === "preview" ? "true" : undefined}
              onClick={() => onModeChange("preview")}
              aria-label="Preview proposal"
              data-toolbar-tooltip="Preview"
            >
              <Eye size={stageIconSize} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
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
              iconLeft={<NewspaperClipping size={stageIconSize} strokeWidth={1.8} />}
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
          {onDeleteDraft || onSaveToLibrary ? (
            <>
              <span className="dasti-icon-cluster__divider" aria-hidden="true" />
              {onSaveToLibrary ? (
                <button
                  type="button"
                  className="dasti-icon-button dasti-proposal-skeleton-stage__action-plain"
                  onClick={onSaveToLibrary}
                  disabled={!hasProposalContent}
                  aria-label="Save proposal to library"
                  title="Save proposal to library"
                  data-toolbar-tooltip="Save to library"
                >
                  <ClipboardText size={stageIconSize} strokeWidth={1.8} aria-hidden="true" />
                </button>
              ) : null}
              {onDeleteDraft ? (
                <button
                  type="button"
                  className="dasti-icon-button dasti-proposal-skeleton-stage__action-plain"
                  onClick={onDeleteDraft}
                  disabled={!hasProposalContent}
                  aria-label="Delete draft"
                  title="Delete draft"
                  data-toolbar-tooltip="Delete draft"
                >
                  <TrashSimple size={stageIconSize} strokeWidth={1.8} aria-hidden="true" />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        <span className="dasti-proposal-skeleton-stage__spacer" />
        <ToneBadge tone={toneValue}>{toneLabel}</ToneBadge>
        {mode === "edit" ? (
          <div
            className="dasti-icon-cluster dasti-icon-cluster--tight dasti-proposal-skeleton-stage__right-actions"
            role="group"
            aria-label="Proposal undo redo actions"
          >
            <span className="dasti-icon-cluster__divider" aria-hidden="true" />
            <button
              type="button"
              className="dasti-icon-button dasti-proposal-skeleton-stage__action-plain"
              onClick={() => runBrowserCommand("undo")}
              aria-label="Undo"
              title="Undo"
              data-toolbar-tooltip="Undo"
            >
              <ArrowUUpLeft size={stageIconSize} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="dasti-icon-button dasti-proposal-skeleton-stage__action-plain"
              onClick={() => runBrowserCommand("redo")}
              aria-label="Redo"
              title="Redo"
              data-toolbar-tooltip="Redo"
            >
              <ArrowUDownRight size={stageIconSize} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="dasti-proposal-skeleton-stage__paper">{children}</div>
    </section>
  );
}

export default ProposalDocumentStage;
