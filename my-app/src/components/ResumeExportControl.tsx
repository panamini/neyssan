import React from "react";

import { DotsThree, FilePdf } from "@/lib/icons";

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
};

const SECONDARY_EXPORT_MENU_ITEMS: ReadonlyArray<{
  format: Exclude<ResumeExportFormat, "pdf">;
  label: string;
}> = [
  { format: "docx", label: "Export DOCX" },
  { format: "markdown", label: "Export Markdown" },
  { format: "json", label: "Export JSON" },
];

export function ResumeExportControl({
  exportingFormat,
  menuLabel = "More export formats",
  onExport,
  statusDescription,
  statusLabel,
  statusTone = "standard",
}: ResumeExportControlProps): JSX.Element {
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && !menuRef.current?.contains(target)) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  return (
    <div
      ref={menuRef}
      className="dasti-import-dropdown dasti-resume-export-control"
      data-open={isMenuOpen ? "true" : "false"}
    >
      <div className="dasti-resume-export-control__cluster">
        <button
          type="button"
          className="dasti-button dasti-button--secondary dasti-button--pill dasti-button--sm dasti-resume-export-control__primary"
          aria-label="Export ATS PDF"
          data-toolbar-tooltip="Export ATS PDF"
          onClick={() => {
            if (exportingFormat) {
              return;
            }
            void onExport({
              format: "pdf",
              mode: "ats",
            });
          }}
          disabled={exportingFormat !== null}
        >
          <FilePdf size={14} strokeWidth={1.6} aria-hidden="true" />
          Export ATS PDF
        </button>
        <button
          type="button"
          className="dasti-button dasti-button--secondary dasti-button--pill dasti-button--sm dasti-resume-export-control__primary"
          aria-label="Export Styled PDF"
          data-toolbar-tooltip="Export Styled PDF"
          onClick={() => {
            if (exportingFormat) {
              return;
            }
            void onExport({
              format: "pdf",
              mode: "styled",
            });
          }}
          disabled={exportingFormat !== null}
        >
          <FilePdf size={14} strokeWidth={1.6} aria-hidden="true" />
          Export Styled PDF
        </button>
        <button
          type="button"
          className="dasti-icon-button"
          aria-label={menuLabel}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          data-toolbar-tooltip={menuLabel}
          data-no-pan="true"
          onClick={() => {
            if (exportingFormat) {
              return;
            }
            setIsMenuOpen((current) => !current);
          }}
          disabled={exportingFormat !== null}
        >
          <DotsThree size={16} strokeWidth={1.7} aria-hidden="true" />
        </button>
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
      {isMenuOpen ? (
        <div
          className="dasti-import-dropdown__menu dasti-import-dropdown__menu--compact dasti-toolbar-drawer-surface dasti-cv-style-presets__menu"
          role="menu"
          aria-label="Export resume formats"
        >
          {SECONDARY_EXPORT_MENU_ITEMS.map((item) => (
            <button
              key={item.format}
              type="button"
              role="menuitem"
              className="dasti-cv-style-presets__option"
              onClick={() => {
                setIsMenuOpen(false);
                void onExport({
                  format: item.format,
                });
              }}
              disabled={exportingFormat !== null}
            >
              <span className="dasti-cv-style-presets__option-copy">
                <span className="dasti-cv-style-presets__option-title">
                  {item.label}
                </span>
                <span className="dasti-cv-style-presets__option-description">
                  {statusDescription}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ResumeExportControl;
