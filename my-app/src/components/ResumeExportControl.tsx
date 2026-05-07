import { DotsThree, FilePdf } from "@/lib/icons";
import { Menu } from "@/components/ui/menu";

import type { ResumeExportFormat } from "../lib/cv-export";

export type ResumeExportRequest =
  | {
      format: "pdf";
      mode: "ats" | "styled";
    }
  | {
      format: Exclude<ResumeExportFormat, "pdf">;
    };

type ResumeExportControlProps = {
  exportingFormat: string | null;
  menuLabel?: string;
  onExport: (request: ResumeExportRequest) => void;
  statusDescription: string;
  statusLabel: string;
  statusTone?: "standard" | "trusted";
  styledPdfDisabled?: boolean;
  styledPdfDisabledReason?: string;
};

const EXPORT_MENU_ITEMS: ReadonlyArray<{
  key: string;
  label: string;
  description?: string;
  request: ResumeExportRequest;
}> = [
  {
    key: "pdf-ats",
    label: "Export ATS PDF",
    request: { format: "pdf", mode: "ats" },
  },
  {
    key: "docx",
    label: "Export DOCX",
    description:
      "DOCX exports as a one-column linear document; styled PDF preserves visual layout.",
    request: { format: "docx" },
  },
  {
    key: "markdown",
    label: "Export Markdown",
    request: { format: "markdown" },
  },
  { key: "json", label: "Export JSON", request: { format: "json" } },
];

export function ResumeExportControl({
  exportingFormat,
  menuLabel = "More export formats",
  onExport,
  statusDescription,
  statusLabel,
  statusTone = "standard",
  styledPdfDisabled = false,
  styledPdfDisabledReason = "Styled PDF is unavailable for the current resume layout.",
}: ResumeExportControlProps): JSX.Element {
  return (
    <div className="dasti-import-dropdown dasti-resume-export-control">
      <div className="dasti-resume-export-control__cluster">
        <button
          type="button"
          className="dasti-button dasti-button--secondary dasti-button--pill dasti-button--sm dasti-resume-export-control__primary"
          aria-label="Export Styled PDF"
          data-toolbar-tooltip={
            styledPdfDisabled ? styledPdfDisabledReason : "Export Styled PDF"
          }
          title={styledPdfDisabled ? styledPdfDisabledReason : undefined}
          onClick={() => {
            if (exportingFormat || styledPdfDisabled) {
              return;
            }
            void onExport({
              format: "pdf",
              mode: "styled",
            });
          }}
          disabled={exportingFormat !== null || styledPdfDisabled}
        >
          <FilePdf size={14} strokeWidth={1.6} aria-hidden="true" />
          <span className="dasti-resume-export-control__primary-label">
            Export Styled PDF
          </span>
        </button>
        <div className="dasti-resume-export-control__menu-cell">
          <Menu
            ariaLabel="Export resume formats"
            align="end"
            sections={[
              {
                items: EXPORT_MENU_ITEMS.map((item) => ({
                  id: item.key,
                  label: item.label,
                  description: item.description ?? statusDescription,
                  disabled: exportingFormat !== null,
                  onSelect: () => void onExport(item.request),
                })),
              },
            ]}
            trigger={
              <button
                type="button"
                className="dasti-icon-button"
                aria-label={menuLabel}
                data-toolbar-tooltip={menuLabel}
                data-no-pan="true"
                disabled={exportingFormat !== null}
              >
                <DotsThree size={16} strokeWidth={1.7} aria-hidden="true" />
              </button>
            }
          />
        </div>
        <span
          className={
            statusTone === "trusted"
              ? "dasti-pill dasti-pill--success"
              : "dasti-pill"
          }
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

export default ResumeExportControl;
