import React from "react";
import { Button, Menu, Pill, Sheet, ToneBadge } from "../ui";
import {
  ClipboardText,
  FilePdf,
  Link,
  RotateCcw,
  ShareFat,
} from "@/lib/icons";

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
};

const SAFE_SEND_ROWS = [
  {
    title: "Source job linked",
    meta: "Proposal has a source role.",
    state: "clear",
    label: "Clear",
  },
  {
    title: "Match review accepted",
    meta: "Review watch-outs before sending.",
    state: "warn",
    label: "Review",
  },
  {
    title: "CV variant selected",
    meta: "A source CV should be attached.",
    state: "clear",
    label: "Clear",
  },
  {
    title: "Proposal linked",
    meta: "Draft is available in the proposal forge.",
    state: "clear",
    label: "Clear",
  },
  {
    title: "No unresolved import issues",
    meta: "Resolve CV import uncertainty before export.",
    state: "warn",
    label: "Review",
  },
  {
    title: "No unresolved AI suggestion",
    meta: "Accept or dismiss pending AI rewrites.",
    state: "warn",
    label: "Pending",
  },
  {
    title: "Unsupported claim",
    meta: "Claims need source support before handoff.",
    state: "danger",
    label: "Blocked",
  },
  {
    title: "No placeholder text",
    meta: "No [company], lorem, or empty variables detected.",
    state: "clear",
    label: "Clear",
  },
  {
    title: "Recipient or export target",
    meta: "Pick PDF, copy, public preview, or email handoff.",
    state: "warn",
    label: "Not started",
  },
  {
    title: "Final export reviewed",
    meta: "Open Page preview before generating the sendable PDF.",
    state: "warn",
    label: "Pending",
  },
] as const;

function runBrowserCommand(command: "undo" | "redo") {
  if (typeof document === "undefined" || !document.execCommand) return;
  document.execCommand(command);
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
}: ProposalDocumentStageProps): JSX.Element {
  const [safeSendOpen, setSafeSendOpen] = React.useState(false);

  return (
    <section
      className="dasti-proposal-skeleton-stage"
      aria-label="Proposal document stage"
    >
      <div className="dasti-proposal-skeleton-stage__bar">
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
                  label: "Safe-send checklist",
                  icon: <ClipboardText size={15} strokeWidth={1.8} />,
                  onSelect: () => setSafeSendOpen(true),
                },
              ],
            },
            {
              label: "Send",
              items: [
                {
                  id: "copy-link",
                  label: "Copy link",
                  icon: <Link size={15} strokeWidth={1.8} />,
                  disabled: true,
                },
                {
                  id: "public-preview",
                  label: "Public preview link",
                  icon: <ShareFat size={15} strokeWidth={1.8} />,
                  disabled: true,
                },
              ],
            },
            {
              items: [
                {
                  id: "export-pdf",
                  label: "Export PDF",
                  icon: <FilePdf size={15} strokeWidth={1.8} />,
                  disabled: !hasProposalContent || exporting,
                  onSelect: () => onExportPdf("styled"),
                },
                {
                  id: "export-docx",
                  label: "Export DOCX",
                  icon: <FilePdf size={15} strokeWidth={1.8} />,
                  disabled: !hasProposalContent || exporting,
                  onSelect: onExportDocx,
                },
                {
                  id: "copy-text",
                  label: "Copy as text",
                  icon: <ClipboardText size={15} strokeWidth={1.8} />,
                  disabled: !hasProposalContent,
                  onSelect: onCopyText,
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
              Share
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
            <Button type="button" variant="secondary" size="md">
              Review match
            </Button>
            <Button type="button" variant="primary" size="md" disabled>
              Continue to send
            </Button>
          </>
        }
      >
        <div className="dasti-proposal-safe-send">
          <div className="dasti-proposal-safe-send__status">
            <Pill tone="danger">Blocked</Pill>
            <strong>Package cannot be sent yet.</strong>
            <small>
              Blockers remain until review, import, AI suggestions, and claim
              checks are clear.
            </small>
          </div>
          <div className="dasti-proposal-safe-send__list">
            {SAFE_SEND_ROWS.map((row) => (
              <div
                key={row.title}
                className="dasti-proposal-safe-send__row"
                data-state={row.state}
              >
                <span className="dasti-proposal-safe-send__mark">
                  {row.state === "clear"
                    ? "OK"
                    : row.state === "danger"
                      ? "x"
                      : "!"}
                </span>
                <span className="dasti-proposal-safe-send__copy">
                  <strong>{row.title}</strong>
                  <small>{row.meta}</small>
                </span>
                <Pill
                  tone={
                    row.state === "clear"
                      ? "success"
                      : row.state === "danger"
                        ? "danger"
                        : "warning"
                  }
                >
                  {row.label}
                </Pill>
              </div>
            ))}
          </div>
        </div>
      </Sheet>
    </section>
  );
}

export default ProposalDocumentStage;
