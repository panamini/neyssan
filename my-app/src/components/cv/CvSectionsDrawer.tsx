import React from "react";
import { X } from "@/lib/icons";
import CvSectionsOrganizer, {
  type CvSectionsOrganizerProps,
} from "./CvSectionsOrganizer";

type CvSectionsDrawerProps = CvSectionsOrganizerProps & {
  open: boolean;
  onClose: () => void;
};

export function CvSectionsDrawer({
  open,
  onClose,
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
        <button
          type="button"
          className="forge-template-panel__close"
          aria-label="Close Sections panel"
          title="Close Sections panel"
          onClick={onClose}
        >
          <X size={15} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
      <div className="forge-template-panel__content dasti-cv-sections-drawer">
        <CvSectionsOrganizer {...organizerProps} />
      </div>
    </aside>
  );
}

export default CvSectionsDrawer;
