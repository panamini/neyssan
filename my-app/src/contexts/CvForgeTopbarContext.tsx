import React from "react";
import type { AtsAuditResult } from "../lib/ats-audit/types";
import type { DocumentPageSizePreference } from "../lib/document-page-size";

export type CvForgeTopbarRegistration = {
  mode: "edit" | "preview";
  hasCurrentCv: boolean;
  documentTitle?: string;
  titlePlaceholder?: string;
  onTitleCommit?: (nextTitle: string) => void;
  resumeOptions?: CvForgeTopbarResumeOption[];
  onPickResume?: (cvId: string) => void;
  onNewCv?: () => void;
  onImportCv?: () => void;
  onDuplicateCv?: () => void;
  onDeleteCv?: () => void;
  hasTrustedExport: boolean;
  atsAudit: AtsAuditResult | null;
  importIssueCount: number;
  importReviewBannerVisible: boolean;
  exporting: boolean;
  pageCount: number | null;
  onOpenAtsAudit: () => void;
  onOpenImportReview: () => void;
  onExportPdf: () => void;
  onExportDocx: () => void;
  onPageSizePreferenceChange?: (preference: DocumentPageSizePreference) => void;
  pageSizePreference?: DocumentPageSizePreference;
};

export type CvForgeTopbarResumeOption = {
  id: string;
  title: string;
  description: string | null;
  selected: boolean;
};

type CvForgeTopbarContextValue = {
  registration: CvForgeTopbarRegistration | null;
  setRegistration: (registration: CvForgeTopbarRegistration | null) => void;
};

const CvForgeTopbarContext =
  React.createContext<CvForgeTopbarContextValue | null>(null);

export function CvForgeTopbarProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [registration, setRegistration] =
    React.useState<CvForgeTopbarRegistration | null>(null);
  const value = React.useMemo(
    () => ({ registration, setRegistration }),
    [registration],
  );

  return (
    <CvForgeTopbarContext.Provider value={value}>
      {children}
    </CvForgeTopbarContext.Provider>
  );
}

export function useCvForgeTopbarRegistration(): CvForgeTopbarRegistration | null {
  return React.useContext(CvForgeTopbarContext)?.registration ?? null;
}

export function useRegisterCvForgeTopbar(
  registration: CvForgeTopbarRegistration | null,
): void {
  const setRegistration =
    React.useContext(CvForgeTopbarContext)?.setRegistration;

  React.useEffect(() => {
    if (!setRegistration) return;
    setRegistration(registration);
    return () => setRegistration(null);
  }, [registration, setRegistration]);
}
