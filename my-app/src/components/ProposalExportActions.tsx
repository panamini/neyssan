import { FilePdf } from "@/lib/icons";
import { Menu } from "@/components/ui/menu";

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
  return (
    <div className="dasti-import-dropdown dasti-resume-export-control dasti-proposal-export-actions">
      <div className="dasti-resume-export-control__cluster">
        <Menu
          ariaLabel="Export proposal formats"
          align="end"
          sections={[
            {
              items: [
                {
                  id: "pdf-ats",
                  label: "Export ATS PDF",
                  disabled,
                  onSelect: () => onExportPdf("ats"),
                },
                {
                  id: "pdf-styled",
                  label: "Export Styled PDF",
                  disabled,
                  onSelect: () => onExportPdf("styled"),
                },
                {
                  id: "docx",
                  label: "Export DOCX",
                  disabled,
                  onSelect: onExportDocx,
                },
              ],
            },
          ]}
          trigger={
            <button
              type="button"
              className="dasti-icon-button"
              aria-label={menuLabel}
              data-toolbar-tooltip={menuLabel}
              data-no-pan="true"
              disabled={disabled}
            >
              <FilePdf size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
          }
        />
      </div>
    </div>
  );
}

export default ProposalExportActions;
