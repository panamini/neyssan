import React from "react";

type ProposalExportActionsProps = {
  disabled?: boolean;
  onExportPdf: (mode: "ats" | "styled") => void;
  onExportDocx: () => void;
};

export function ProposalExportActions({
  disabled = false,
  onExportPdf,
  onExportDocx,
}: ProposalExportActionsProps): JSX.Element {
  return (
    <span className="dasti-icon-cluster dasti-icon-cluster--tight">
      <button
        type="button"
        className="dasti-button dasti-button--secondary dasti-button--pill dasti-button--sm"
        aria-label="Export ATS PDF"
        data-toolbar-tooltip="Export ATS PDF"
        onClick={() => {
          onExportPdf("ats");
        }}
        disabled={disabled}
      >
        Export ATS PDF
      </button>
      <button
        type="button"
        className="dasti-button dasti-button--secondary dasti-button--pill dasti-button--sm"
        aria-label="Export Styled PDF"
        data-toolbar-tooltip="Export Styled PDF"
        onClick={() => {
          onExportPdf("styled");
        }}
        disabled={disabled}
      >
        Export Styled PDF
      </button>
      <button
        type="button"
        className="dasti-button dasti-button--secondary dasti-button--pill dasti-button--sm"
        aria-label="Export DOCX"
        data-toolbar-tooltip="Export DOCX"
        onClick={onExportDocx}
        disabled={disabled}
      >
        Export DOCX
      </button>
    </span>
  );
}

export default ProposalExportActions;
