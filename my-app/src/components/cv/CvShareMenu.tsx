import React from "react";
import { ClipboardText, FilePdf, ShareFat } from "@/lib/icons";
import { Button, Menu, Pill, Sheet } from "../ui";
import { buildDocumentPageSizeMenuSection } from "../DocumentPageSizeMenu";
import type { DocumentPageSizePreference } from "../../lib/document-page-size";

type SafeSendRowState = "clear" | "warn" | "danger";

type SafeSendRow = {
  title: string;
  meta: string;
  state: SafeSendRowState;
  label: string;
  action?: React.ReactNode;
};

type CvShareMenuProps = {
  mode: "edit" | "preview";
  hasCurrentCv: boolean;
  importIssueCount: number;
  exporting: boolean;
  triggerClassName?: string;
  showTriggerLabel?: boolean;
  onOpenImportReview: () => void;
  onExportPdf: () => void;
  onExportDocx: () => void;
  onPageSizePreferenceChange?: (preference: DocumentPageSizePreference) => void;
  pageSizePreference?: DocumentPageSizePreference;
};

export function CvShareMenu({
  mode,
  hasCurrentCv,
  importIssueCount,
  exporting,
  triggerClassName = "dasti-icon-button dasti-cv-stage-bar__plain-action dasti-cv-stage-bar__share",
  showTriggerLabel = false,
  onOpenImportReview,
  onExportPdf,
  onExportDocx,
  onPageSizePreferenceChange,
  pageSizePreference = "auto",
}: CvShareMenuProps): JSX.Element {
  const [safeSendOpen, setSafeSendOpen] = React.useState(false);
  const safeSendRows: SafeSendRow[] = [
    {
      title: "Source job linked",
      meta: "Optional for standalone CV export.",
      state: "clear",
      label: "Clear",
    },
    {
      title: "Match review accepted",
      meta: "No source job is required for CV-only export.",
      state: "clear",
      label: "Clear",
    },
    {
      title: "CV variant selected",
      meta: hasCurrentCv ? "Current CV is open." : "Open or create a CV.",
      state: hasCurrentCv ? "clear" : "warn",
      label: hasCurrentCv ? "Clear" : "Missing",
    },
    {
      title: "Proposal linked",
      meta: "Not required for CV-only export.",
      state: "clear",
      label: "Clear",
    },
    {
      title: "Unresolved import issues",
      meta:
        importIssueCount > 0
          ? `${importIssueCount} import ${importIssueCount === 1 ? "block needs" : "blocks need"} review.`
          : "No import uncertainty detected.",
      state: importIssueCount > 0 ? "warn" : "clear",
      label: importIssueCount > 0 ? "Resolve" : "Clear",
      action:
        importIssueCount > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onOpenImportReview}
          >
            Resolve
          </Button>
        ) : undefined,
    },
    {
      title: "Unresolved AI suggestion",
      meta: "Detection pending until section AI suggestions are attached.",
      state: "warn",
      label: "Detection pending",
    },
    {
      title: "Unsupported claim",
      meta: "Detection pending.",
      state: "warn",
      label: "Detection pending",
    },
    {
      title: "No placeholder text",
      meta: "No placeholder detector is active in this slice.",
      state: "warn",
      label: "Detection pending",
    },
    {
      title: "Recipient or export target",
      meta: "Pick PDF, DOCX, or handoff target.",
      state: "warn",
      label: "Not started",
    },
    {
      title: "Final export reviewed",
      meta: "Open Page preview before generating the sendable PDF.",
      state: mode === "preview" ? "clear" : "warn",
      label: mode === "preview" ? "Clear" : "Pending",
    },
  ];
  const blocked = safeSendRows.some((row) => row.state !== "clear");

  return (
    <>
      <Menu
        ariaLabel="Share CV"
        align="end"
        sections={[
          ...(onPageSizePreferenceChange
            ? [
                buildDocumentPageSizeMenuSection({
                  disabled: exporting,
                  onChange: onPageSizePreferenceChange,
                  value: pageSizePreference,
                }),
              ]
            : []),
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
              { id: "email", label: "Send by email", disabled: true },
              { id: "copy-link", label: "Copy link", disabled: true },
              {
                id: "preview-link",
                label: "Public preview link",
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
                disabled: !hasCurrentCv || exporting,
                onSelect: onExportPdf,
              },
              {
                id: "export-docx",
                label: "Export DOCX",
                icon: <FilePdf size={15} strokeWidth={1.8} />,
                disabled: !hasCurrentCv || exporting,
                onSelect: onExportDocx,
              },
            ],
          },
        ]}
        trigger={
          <button
            type="button"
            className={triggerClassName}
            aria-label="Share"
            data-toolbar-tooltip="Share"
            data-share-tooltip-mode={showTriggerLabel ? "compact" : "always"}
          >
            <ShareFat size={15} strokeWidth={1.8} aria-hidden="true" />
            {showTriggerLabel ? (
              <span className="app-topbar__share-label">Share</span>
            ) : null}
          </button>
        }
      />
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
            <Button type="button" variant="secondary" size="md" disabled>
              Review match
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={blocked}
            >
              Continue to send
            </Button>
          </>
        }
      >
        <div className="dasti-proposal-safe-send">
          <div className="dasti-proposal-safe-send__status">
            <Pill tone={blocked ? "danger" : "success"}>
              {blocked ? "Blocked" : "Clear"}
            </Pill>
            <strong>
              {blocked
                ? "CV package cannot be sent yet."
                : "CV package can be sent."}
            </strong>
            <small>
              {blocked
                ? "Review pending checks before export or handoff."
                : "All checks are clear for this CV."}
            </small>
          </div>
          <div className="dasti-proposal-safe-send__list">
            {safeSendRows.map((row) => (
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
                {row.action ?? (
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
                )}
              </div>
            ))}
          </div>
        </div>
      </Sheet>
    </>
  );
}

export default CvShareMenu;
