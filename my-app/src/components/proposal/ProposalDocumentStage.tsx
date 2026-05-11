import React from "react";
import { Button, Menu, ToneBadge } from "../ui";
import {
  ArrowUDownRight,
  ArrowUUpLeft,
  ClipboardText,
  Eye,
  FilePdf,
  FileText,
  ImagesSquare,
  NewspaperClipping,
  PenLine,
  TrashSimple,
} from "@/lib/icons";

type SafeSendState = "clear" | "warn" | "danger";

type ProposalDocumentStageProps = {
  toneLabel: string;
  toneValue: "auto" | "warm" | "formal" | "natural";
  mode: "preview" | "edit";
  exporting: boolean;
  hasProposalContent: boolean;
  styleControl?: React.ReactNode;
  templatesOpen?: boolean;
  headingOpen?: boolean;
  children: React.ReactNode;
  onModeChange: (mode: "preview" | "edit") => void;
  onOpenHeading?: () => void;
  onOpenTemplates?: () => void;
  onCopyText: () => void;
  onDeleteDraft?: () => void;
  onSaveToLibrary?: () => void;
  onExportPdf: (mode: "ats" | "styled") => void;
  onExportDocx: () => void;
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
  exporting,
  hasProposalContent,
  styleControl = null,
  templatesOpen = false,
  headingOpen = false,
  children,
  onModeChange,
  onOpenHeading,
  onOpenTemplates,
  onCopyText,
  onDeleteDraft,
  onSaveToLibrary,
  onExportPdf,
  onExportDocx,
}: ProposalDocumentStageProps): JSX.Element {
  const [selectedExportTarget, setSelectedExportTarget] = React.useState<
    "pdf" | "docx" | "copy-text" | null
  >(null);

  return (
    <section
      className="dasti-proposal-skeleton-stage"
      aria-label="Proposal document stage"
    >
      <div className="forge__stage-bar dasti-proposal-skeleton-stage__bar dasti-toolbar--surface-tooltips">
        <ToneBadge tone={toneValue}>{toneLabel}</ToneBadge>
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
              <PenLine size={14} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="dasti-proposal-mode-toggle"
              data-selected={mode === "preview" ? "true" : undefined}
              onClick={() => onModeChange("preview")}
              aria-label="Preview proposal"
              data-toolbar-tooltip="Preview"
            >
              <Eye size={14} strokeWidth={1.8} aria-hidden="true" />
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
              iconLeft={<NewspaperClipping size={14} strokeWidth={1.8} />}
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
          {onOpenTemplates ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="dasti-proposal-skeleton-stage__primary-action"
              iconLeft={<ImagesSquare size={14} strokeWidth={1.8} />}
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
          {mode === "edit" ? (
            <>
              <span className="dasti-icon-cluster__divider" aria-hidden="true" />
              <button
                type="button"
                className="dasti-icon-button dasti-proposal-skeleton-stage__action-plain"
                onClick={() => runBrowserCommand("undo")}
                aria-label="Undo"
                title="Undo"
                data-toolbar-tooltip="Undo"
              >
                <ArrowUUpLeft size={14} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="dasti-icon-button dasti-proposal-skeleton-stage__action-plain"
                onClick={() => runBrowserCommand("redo")}
                aria-label="Redo"
                title="Redo"
                data-toolbar-tooltip="Redo"
              >
                <ArrowUDownRight size={14} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </>
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
                  <ClipboardText size={14} strokeWidth={1.8} aria-hidden="true" />
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
                  <TrashSimple size={14} strokeWidth={1.8} aria-hidden="true" />
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        <span className="dasti-proposal-skeleton-stage__spacer" />
        <Menu
          ariaLabel="Proposal actions"
          align="end"
          sections={[
            {
              items: [
                {
                  id: "copy-text",
                  label: "Copy text",
                  icon: <ClipboardText size={15} strokeWidth={1.8} />,
                  disabled: !hasProposalContent,
                  onSelect: () => {
                    setSelectedExportTarget("copy-text");
                    onCopyText();
                  },
                },
                {
                  id: "export-pdf",
                  label: "Download PDF",
                  icon: <FilePdf size={15} strokeWidth={1.8} />,
                  disabled: !hasProposalContent || exporting,
                  onSelect: () => {
                    setSelectedExportTarget("pdf");
                    onExportPdf("styled");
                  },
                },
                {
                  id: "export-docx",
                  label: "Download DOCX",
                  icon: <FileText size={15} strokeWidth={1.8} />,
                  disabled: !hasProposalContent || exporting,
                  onSelect: () => {
                    setSelectedExportTarget("docx");
                    onExportDocx();
                  },
                },
              ],
            },
          ]}
          trigger={
            <button
              type="button"
              className="dasti-icon-button dasti-proposal-skeleton-stage__action-plain"
              aria-label="Proposal actions"
              data-toolbar-tooltip="Actions"
            >
              <ClipboardText size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
          }
        />
      </div>

      <div className="dasti-proposal-skeleton-stage__paper">{children}</div>
    </section>
  );
}

export default ProposalDocumentStage;
