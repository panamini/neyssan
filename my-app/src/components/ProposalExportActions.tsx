import React from "react";

import { FilePdf } from "@/lib/icons";

type ProposalExportActionsProps = {
  disabled?: boolean;
  menuLabel?: string;
  onExportPdf: (mode: "ats" | "styled") => void;
  onExportDocx: () => void;
};

export function ProposalExportActions({
  disabled = false,
  menuLabel = "Export proposal",
  onExportPdf,
  onExportDocx,
}: ProposalExportActionsProps): JSX.Element {
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
      className="dasti-import-dropdown dasti-resume-export-control dasti-proposal-export-actions"
      data-open={isMenuOpen ? "true" : "false"}
    >
      <div className="dasti-resume-export-control__cluster">
        <button
          type="button"
          className="dasti-icon-button"
          aria-label={menuLabel}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          data-toolbar-tooltip={menuLabel}
          data-no-pan="true"
          onClick={() => {
            if (disabled) {
              return;
            }
            setIsMenuOpen((current) => !current);
          }}
          disabled={disabled}
        >
          <FilePdf size={16} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
      {isMenuOpen ? (
        <div
          className="dasti-import-dropdown__menu dasti-import-dropdown__menu--compact dasti-toolbar-drawer-surface dasti-cv-style-presets__menu"
          role="menu"
          aria-label="Export proposal formats"
        >
          <button
            type="button"
            role="menuitem"
            className="dasti-cv-style-presets__option"
            onClick={() => {
              setIsMenuOpen(false);
              onExportPdf("ats");
            }}
            disabled={disabled}
          >
            <span className="dasti-cv-style-presets__option-copy">
              <span className="dasti-cv-style-presets__option-title">
                Export ATS PDF
              </span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="dasti-cv-style-presets__option"
            onClick={() => {
              setIsMenuOpen(false);
              onExportPdf("styled");
            }}
            disabled={disabled}
          >
            <span className="dasti-cv-style-presets__option-copy">
              <span className="dasti-cv-style-presets__option-title">
                Export Styled PDF
              </span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="dasti-cv-style-presets__option"
            onClick={() => {
              setIsMenuOpen(false);
              onExportDocx();
            }}
            disabled={disabled}
          >
            <span className="dasti-cv-style-presets__option-copy">
              <span className="dasti-cv-style-presets__option-title">
                Export DOCX
              </span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default ProposalExportActions;
