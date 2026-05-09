import React from "react";
import { Button, Menu, Pill, Sheet, ToneBadge } from "../ui";
import {
  ArrowUDownRight,
  ArrowUUpLeft,
  ClipboardText,
  Eye,
  FilePdf,
  FileText,
  Link,
  PaperPlaneRight,
  PenLine,
  ShareFat,
  TrashSimple,
} from "@/lib/icons";

type SafeSendState = "clear" | "warn" | "danger";

type SafeSendRow = {
  id: string;
  title: string;
  meta: string;
  state: SafeSendState;
  label: string;
  category: "user" | "system";
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
};

type ProposalDocumentStageProps = {
  statusLabel: string;
  statusMeta?: string | null;
  statusTitle?: string | null;
  toneLabel: string;
  toneValue: "auto" | "warm" | "formal" | "natural";
  mode: "preview" | "edit";
  exporting: boolean;
  hasProposalContent: boolean;
  styleControl?: React.ReactNode;
  children: React.ReactNode;
  onModeChange: (mode: "preview" | "edit") => void;
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

function statusRow({
  id,
  title,
  clear,
  clearMeta,
  blockedMeta,
  clearLabel = "Clear",
  blockedLabel = "Missing",
  category = "user",
}: {
  id: string;
  title: string;
  clear: boolean;
  clearMeta: string;
  blockedMeta: string;
  clearLabel?: string;
  blockedLabel?: string;
  category?: SafeSendRow["category"];
}): SafeSendRow {
  return {
    id,
    title,
    meta: clear ? clearMeta : blockedMeta,
    state: clear ? "clear" : "warn",
    label: clear ? clearLabel : blockedLabel,
    category,
  };
}

function detectionPendingRow(
  id: string,
  title: string,
  meta: string,
): SafeSendRow {
  return {
    id,
    title,
    meta,
    state: "warn",
    label: "Detection pending",
    category: "system",
  };
}

function buildSafeSendRows({
  sourceJobLinked,
  sourceCvSelected,
  proposalLinked,
  matchReviewAccepted,
  hasUnresolvedImportIssues,
  hasPendingAiSuggestion,
  unsupportedClaimState,
  hasPlaceholderText,
  recipientOrExportTargetSelected,
  finalExportReviewed,
  onResolveImportIssues,
}: {
  sourceJobLinked: boolean;
  sourceCvSelected: boolean;
  proposalLinked: boolean;
  matchReviewAccepted: boolean | null;
  hasUnresolvedImportIssues: boolean | null;
  hasPendingAiSuggestion: boolean | null;
  unsupportedClaimState: SafeSendState | null;
  hasPlaceholderText: boolean;
  recipientOrExportTargetSelected: boolean;
  finalExportReviewed: boolean;
  onResolveImportIssues?: () => void;
}): SafeSendRow[] {
  const importIssueRow: SafeSendRow =
    hasUnresolvedImportIssues === null
      ? detectionPendingRow(
          "import-issues",
          "Unresolved import issues",
          "Import review detection is not connected on this proposal surface yet.",
        )
      : {
          id: "import-issues",
          title: "Unresolved import issues",
          meta: hasUnresolvedImportIssues
            ? "Resolve CV import uncertainty before export."
            : "No import-review blockers detected for the selected CV.",
          state: hasUnresolvedImportIssues ? "warn" : "clear",
          label: hasUnresolvedImportIssues ? "Resolve" : "Clear",
          category: "user",
          actionLabel: hasUnresolvedImportIssues ? "Resolve" : undefined,
          actionDisabled: !onResolveImportIssues,
          onAction: onResolveImportIssues,
        };

  const aiSuggestionRow: SafeSendRow =
    hasPendingAiSuggestion === null
      ? detectionPendingRow(
          "ai-suggestion",
          "Unresolved AI suggestion",
          "Pending AI suggestion telemetry is not connected on this proposal surface yet.",
        )
      : {
          id: "ai-suggestion",
          title: "Unresolved AI suggestion",
          meta: hasPendingAiSuggestion
            ? "Accept or dismiss pending AI rewrites before handoff."
            : "No pending AI rewrite suggestions detected.",
          state: hasPendingAiSuggestion ? "warn" : "clear",
          label: hasPendingAiSuggestion ? "Pending" : "Clear",
          category: hasPendingAiSuggestion ? "user" : "system",
        };

  const matchReviewRow: SafeSendRow =
    matchReviewAccepted === null
      ? detectionPendingRow(
          "match-review",
          "Match review accepted",
          "Match-review acceptance is not connected on this proposal surface yet.",
        )
      : {
          id: "match-review",
          title: "Match review accepted",
          meta: matchReviewAccepted
            ? "Source job has been viewed for this draft."
            : "Open the source job before sending.",
          state: matchReviewAccepted ? "clear" : "warn",
          label: matchReviewAccepted ? "Viewed" : "Unviewed",
          category: "user",
        };

  const unsupportedClaimRow: SafeSendRow =
    unsupportedClaimState === null
      ? detectionPendingRow(
          "unsupported-claim",
          "Unsupported claim",
          "Claim-source detection is not connected on this proposal surface yet.",
        )
      : {
          id: "unsupported-claim",
          title: "Unsupported claim",
          meta:
            unsupportedClaimState === "clear"
              ? "No unsupported claims detected."
              : "Claims need source support before handoff.",
          state: unsupportedClaimState,
          label:
            unsupportedClaimState === "clear"
              ? "Clear"
              : unsupportedClaimState === "danger"
                ? "Blocked"
                : "Review",
          category: unsupportedClaimState === "clear" ? "system" : "user",
        };

  return [
    statusRow({
      id: "source-job",
      title: "Source job linked",
      clear: sourceJobLinked,
      clearMeta: "Proposal has a source role.",
      blockedMeta: "Link a source role before sending.",
      clearLabel: "Linked",
    }),
    matchReviewRow,
    statusRow({
      id: "source-cv",
      title: "CV variant selected",
      clear: sourceCvSelected,
      clearMeta: "A source CV is attached to this draft.",
      blockedMeta: "Select a source CV before sending.",
      clearLabel: "Selected",
    }),
    statusRow({
      id: "proposal-linked",
      title: "Proposal linked",
      clear: proposalLinked,
      clearMeta: "Draft is available in the proposal forge.",
      blockedMeta: "Generate or open a proposal draft before sending.",
    }),
    importIssueRow,
    aiSuggestionRow,
    unsupportedClaimRow,
    statusRow({
      id: "placeholder-text",
      title: "No placeholder text",
      clear: !hasPlaceholderText,
      clearMeta: "No [company], lorem, or empty variables detected.",
      blockedMeta: "Replace placeholder text before exporting or sending.",
      blockedLabel: "Needs review",
    }),
    statusRow({
      id: "recipient-target",
      title: "Recipient or export target",
      clear: recipientOrExportTargetSelected,
      clearMeta: "A send or export target has been selected.",
      blockedMeta: "Pick PDF, copy, public preview, or email handoff.",
      clearLabel: "Selected",
      blockedLabel: "Not selected",
    }),
    statusRow({
      id: "final-export-reviewed",
      title: "Final export reviewed",
      clear: finalExportReviewed,
      clearMeta: "Page preview has been opened for this draft.",
      blockedMeta: "Open Page preview before generating the sendable PDF.",
      clearLabel: "Reviewed",
      blockedLabel: "Pending",
    }),
  ];
}

function getPillTone(state: SafeSendState) {
  if (state === "clear") return "success" as const;
  if (state === "danger") return "danger" as const;
  return "warning" as const;
}

export function ProposalDocumentStage({
  statusLabel,
  statusMeta,
  statusTitle,
  toneLabel,
  toneValue,
  mode,
  exporting,
  hasProposalContent,
  styleControl = null,
  children,
  onModeChange,
  onCopyText,
  onDeleteDraft,
  onSaveToLibrary,
  onExportPdf,
  onExportDocx,
  sourceJobLinked = false,
  sourceCvSelected = false,
  proposalLinked = true,
  matchReviewAccepted = null,
  hasUnresolvedImportIssues = null,
  hasPendingAiSuggestion = null,
  unsupportedClaimState = null,
  hasPlaceholderText = false,
  recipientOrExportTargetSelected = false,
  finalExportReviewed = false,
  onReviewMatch,
  onResolveImportIssues,
}: ProposalDocumentStageProps): JSX.Element {
  const [safeSendOpen, setSafeSendOpen] = React.useState(false);
  const [selectedExportTarget, setSelectedExportTarget] = React.useState<
    "pdf" | "docx" | "copy-text" | null
  >(null);
  const hasRecipientOrExportTarget =
    recipientOrExportTargetSelected || selectedExportTarget !== null;
  const safeSendRows = React.useMemo(
    () =>
      buildSafeSendRows({
        sourceJobLinked,
        sourceCvSelected,
        proposalLinked,
        matchReviewAccepted,
        hasUnresolvedImportIssues,
        hasPendingAiSuggestion,
        unsupportedClaimState,
        hasPlaceholderText,
        recipientOrExportTargetSelected: hasRecipientOrExportTarget,
        finalExportReviewed,
        onResolveImportIssues,
      }),
    [
      finalExportReviewed,
      hasPendingAiSuggestion,
      hasPlaceholderText,
      hasRecipientOrExportTarget,
      hasUnresolvedImportIssues,
      matchReviewAccepted,
      onResolveImportIssues,
      proposalLinked,
      unsupportedClaimState,
      sourceCvSelected,
      sourceJobLinked,
    ],
  );
  const userSafeSendRows = React.useMemo(
    () =>
      safeSendRows.filter(
        (row) => row.category === "user" && row.state !== "clear",
      ),
    [safeSendRows],
  );
  const clearedSafeSendRows = React.useMemo(
    () => safeSendRows.filter((row) => row.state === "clear"),
    [safeSendRows],
  );
  const systemSafeSendRows = React.useMemo(
    () =>
      safeSendRows.filter(
        (row) => row.category === "system" && row.state !== "clear",
      ),
    [safeSendRows],
  );
  const firstUserBlocker =
    userSafeSendRows.find((row) => row.state !== "clear") ?? null;
  const blockerCount = userSafeSendRows.filter((row) => row.state !== "clear").length;
  const canContinueToSend = blockerCount === 0;
  const fixFirstBlocker = React.useCallback(() => {
    if (!firstUserBlocker) return;
    if (firstUserBlocker.onAction) {
      firstUserBlocker.onAction();
      return;
    }
    if (firstUserBlocker.id === "source-job" || firstUserBlocker.id === "match-review") {
      onReviewMatch?.();
    }
  }, [firstUserBlocker, onReviewMatch]);

  return (
    <section
      className="dasti-proposal-skeleton-stage"
      aria-label="Proposal document stage"
    >
      <div className="forge__stage-bar dasti-proposal-skeleton-stage__bar dasti-toolbar--surface-tooltips">
        <span
          className={`ds-status ds-status--${statusLabel === "Drafting" ? "warning" : "neutral"} dasti-proposal-skeleton-stage__status${statusTitle ? " dasti-toolbar-tooltip-trigger--below" : ""}`}
          data-toolbar-tooltip={statusTitle ?? undefined}
        >
          <span className="ds-status__dot" aria-hidden="true" />
          <span className="dasti-proposal-skeleton-stage__status-label">
            {statusLabel}
          </span>
          {statusMeta ? (
            <span className="dasti-proposal-skeleton-stage__status-meta">
              {statusMeta}
            </span>
          ) : null}
        </span>
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
          ariaLabel="Share proposal"
          align="end"
          sections={[
            {
              items: [
                {
                  id: "safe-send",
                  label: "Safe-send checklist…",
                  icon: <ClipboardText size={15} strokeWidth={1.8} />,
                  description:
                    blockerCount > 0
                      ? `${blockerCount} checks need attention`
                      : "Ready to continue",
                  onSelect: () => setSafeSendOpen(true),
                },
              ],
            },
            {
              label: "Send",
              items: [
                {
                  id: "send-email",
                  label: "Send by email",
                  icon: <PaperPlaneRight size={15} strokeWidth={1.8} />,
                  description: "Unavailable in this checkpoint",
                  disabled: true,
                },
                {
                  id: "copy-link",
                  label: "Copy link",
                  icon: <Link size={15} strokeWidth={1.8} />,
                  description: "Unavailable in this checkpoint",
                  disabled: true,
                },
                {
                  id: "public-preview",
                  label: "Public preview link",
                  icon: <ShareFat size={15} strokeWidth={1.8} />,
                  description: "Unavailable in this checkpoint",
                  disabled: true,
                },
              ],
            },
            {
              label: "Export",
              items: [
                {
                  id: "export-pdf",
                  label: "Export PDF",
                  icon: <FilePdf size={15} strokeWidth={1.8} />,
                  disabled: !hasProposalContent || exporting,
                  onSelect: () => {
                    setSelectedExportTarget("pdf");
                    onExportPdf("styled");
                  },
                },
                {
                  id: "export-docx",
                  label: "Export DOCX",
                  icon: <FileText size={15} strokeWidth={1.8} />,
                  disabled: !hasProposalContent || exporting,
                  onSelect: () => {
                    setSelectedExportTarget("docx");
                    onExportDocx();
                  },
                },
                {
                  id: "copy-text",
                  label: "Copy as text",
                  icon: <ClipboardText size={15} strokeWidth={1.8} />,
                  disabled: !hasProposalContent,
                  onSelect: () => {
                    setSelectedExportTarget("copy-text");
                    onCopyText();
                  },
                },
              ],
            },
          ]}
          trigger={
            <button
              type="button"
              className="dasti-icon-button dasti-proposal-skeleton-stage__action-plain"
              aria-label="Share proposal"
              data-toolbar-tooltip="Share"
            >
              <ShareFat size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
          }
        />
      </div>

      <div className="dasti-proposal-skeleton-stage__paper">{children}</div>

      <Sheet
        open={safeSendOpen}
        onOpenChange={setSafeSendOpen}
        title="Safe-send checklist"
        description="Trust gate for export, share, and send. Each row must be cleared before the package can leave your hands."
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setSafeSendOpen(false)}
            >
              Cancel
            </Button>
            <span className="dasti-proposal-safe-send__footer-spacer" />
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={!canContinueToSend && !firstUserBlocker}
              onClick={canContinueToSend ? undefined : fixFirstBlocker}
            >
              {canContinueToSend ? "Continue to send" : "Resolve next"}
            </Button>
          </>
        }
      >
        <div className="dasti-proposal-safe-send">
          <div
            className="dasti-proposal-safe-send__status"
            aria-live="polite"
          >
            <Pill tone={canContinueToSend ? "success" : "danger"}>
              {canContinueToSend ? "Ready" : "Blocked"}
            </Pill>
            <strong>
              {canContinueToSend
                ? "Package is ready to continue."
                : "Package cannot be sent yet."}
            </strong>
            <small>
              {canContinueToSend
                ? "All safe-send rows are clear."
                : `${blockerCount} user action${blockerCount === 1 ? "" : "s"} required before handoff.`}
            </small>
          </div>
          <div className="dasti-proposal-safe-send__group">
            <div className="dasti-proposal-safe-send__group-title">
              User action required
            </div>
            <div className="dasti-proposal-safe-send__list">
              {userSafeSendRows.length > 0 ? (
                userSafeSendRows.map((row) => <SafeSendChecklistRow key={row.id} row={row} />)
              ) : (
                <p className="dasti-proposal-safe-send__empty">
                  No user actions required.
                </p>
              )}
            </div>
          </div>
          {clearedSafeSendRows.length > 0 ? (
            <div className="dasti-proposal-safe-send__group dasti-proposal-safe-send__group--cleared">
              <div className="dasti-proposal-safe-send__group-title">
                Cleared
              </div>
              <div className="dasti-proposal-safe-send__list">
                {clearedSafeSendRows.map((row) => (
                  <SafeSendChecklistRow key={row.id} row={row} />
                ))}
              </div>
            </div>
          ) : null}
          <div className="dasti-proposal-safe-send__group dasti-proposal-safe-send__group--system">
            <div className="dasti-proposal-safe-send__group-title">
              System checks
            </div>
            <div className="dasti-proposal-safe-send__list">
              {systemSafeSendRows.map((row) => (
                <SafeSendChecklistRow key={row.id} row={row} />
              ))}
            </div>
          </div>
        </div>
      </Sheet>
    </section>
  );
}

function SafeSendChecklistRow({ row }: { row: SafeSendRow }) {
  return (
    <div
      className="dasti-proposal-safe-send__row"
      data-state={row.state}
    >
      <span className="dasti-proposal-safe-send__mark">
        {row.state === "clear" ? "✓" : row.state === "danger" ? "×" : "!"}
      </span>
      <span className="dasti-proposal-safe-send__copy">
        <strong>{row.title}</strong>
        <small>{row.meta}</small>
      </span>
      {row.actionLabel ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={row.actionDisabled}
          onClick={row.onAction}
        >
          {row.actionLabel}
        </Button>
      ) : (
        <Pill tone={getPillTone(row.state)}>{row.label}</Pill>
      )}
    </div>
  );
}

export default ProposalDocumentStage;
