import React from "react";
import CvSectionsOrganizer, {
  type CvSectionsOrganizerProps,
} from "./CvSectionsOrganizer";

type CvSectionsDrawerProps = CvSectionsOrganizerProps & {
  open: boolean;
  onClose: () => void;
};

export function CvSectionsDrawer({
  open,
  onClose: _onClose,
  ...organizerProps
}: CvSectionsDrawerProps): JSX.Element | null {
  if (!open) return null;

  return (
    <aside
      className="forge-template-panel dasti-cv-sections-forge-drawer"
      aria-label="CV sections"
    >
      <div className="forge-template-panel__head">
        <span className="forge-template-panel__head-title">Sections</span>
      </div>
      <div className="forge-template-panel__content forge-template-panel__content--cv-sections dasti-cv-sections-drawer">
        <CvSectionsOrganizer {...organizerProps} />
      </div>
    </aside>
  );
}

export default CvSectionsDrawer;
