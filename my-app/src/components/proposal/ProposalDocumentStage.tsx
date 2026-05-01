import React from "react";
import { Button, Menu, Pill, Sheet, ToneBadge } from "../ui";
import {
  ClipboardText,
  FilePdf,
  FileText,
  Link,
  PaperPlaneRight,
  RotateCcw,
  ShareFat,
} from "@/lib/icons";

type SafeSendState = "clear" | "warn" | "danger";

type SafeSendRow = {
  id: string;
  title: string;
  meta: string;
  state: SafeSendState;
  label: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
};

type ProposalDocumentStageProps = {
  statusLabel: string;
  toneLabel: string;
  toneValue: "auto" | "warm" | "formal" | "natural";
  mode: "preview" | "edit";
  exporting: boolean;
  hasProposalContent: boolean;
  children: React.ReactNode;
  onModeChange: (mode: "preview" | "edit") => void;
  onCopyText: () => void;
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
}: {
  id: string;
  title: string;
  clear: boolean;
  clearMeta: string;
  blockedMeta: string;
  clearLabel?: string;
  blockedLabel?: string;
}): SafeSendRow {
  return {
    id,
    title,
    meta: clear ? clearMeta : blockedMeta,
    state: clear ? "clear" : "warn",
    label: clear ? clearLabel : blockedLabel,
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
        };

  const matchReviewRow: SafeSendRow =
    matchReviewAccepted === null
      ? detectionPendingRow(
          "match-review",
          "Match review not accepted",
          "Match-review acceptance is not connected on this proposal surface yet.",
        )
      : {
          id: "match-review",
          title: "Match review not accepted",
          meta: matchReviewAccepted
            ? "Match review has been accepted for this draft."
            : "Review watch-outs before sending.",
          state: matchReviewAccepted ? "clear" : "warn",
          label: matchReviewAccepted ? "Accepted" : "Review",
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
  toneLabel,
  toneValue,
  mode,
  exporting,
  hasProposalContent,
  children,
  onModeChange,
  onCopyText,
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
  const blockerCount = safeSendRows.filter((row) => row.state !== "clear").length;
  const canContinueToSend = blockerCount === 0;

  return (
    <section
      className="dasti-proposal-skeleton-stage"
      aria-label="Proposal document stage"
    >
      <div className="forge__stage-bar dasti-proposal-skeleton-stage__bar">
        <Pill tone="accent" className="dasti-proposal-skeleton-stage__status">
          {statusLabel}
        </Pill>
        <ToneBadge tone={toneValue}>{toneLabel}</ToneBadge>
        <span className="dasti-proposal-skeleton-stage__spacer" />
        <div
          className="style-segmented dasti-proposal-skeleton-stage__mode"
          role="group"
          aria-label="Proposal view mode"
        >
          <button
            type="button"
            data-selected={mode === "edit" ? "true" : undefined}
            onClick={() => onModeChange("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            data-selected={mode === "preview" ? "true" : undefined}
            onClick={() => onModeChange("preview")}
          >
            Page preview
          </button>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          iconLeft={<RotateCcw size={14} strokeWidth={1.8} />}
          onClick={() => runBrowserCommand("undo")}
        >
          Undo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          iconLeft={<RotateCcw size={14} strokeWidth={1.8} />}
          onClick={() => runBrowserCommand("redo")}
        >
          Redo
        </Button>
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
              className="ds-btn ds-btn--sm ds-btn--secondary"
            >
              <span aria-hidden="true">
                <ShareFat size={15} strokeWidth={1.8} />
              </span>
              Share ▾
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
              variant="secondary"
              size="md"
              onClick={() => {
                setSafeSendOpen(false);
                onReviewMatch?.();
              }}
            >
              Review match
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={!canContinueToSend}
            >
              Continue to send
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
                : `${blockerCount} checks still need attention before handoff.`}
            </small>
          </div>
          <div className="dasti-proposal-safe-send__list">
            {safeSendRows.map((row) => (
              <div
                key={row.id}
                className="dasti-proposal-safe-send__row"
                data-state={row.state}
              >
                <span className="dasti-proposal-safe-send__mark">
                  {row.state === "clear"
                    ? "✓"
                    : row.state === "danger"
                      ? "×"
                      : "!"}
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
            ))}
          </div>
        </div>
      </Sheet>
    </section>
  );
}

export default ProposalDocumentStage;
