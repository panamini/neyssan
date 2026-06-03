import React from "react";
import type { DocumentPageSizePreference } from "../lib/document-page-size";

export type ProposalForgeTopbarDocumentState =
  | "draft"
  | "saving"
  | "saved"
  | "generating"
  | "exporting"
  | "error";

export type ProposalForgeTopbarRegistration = {
  documentTitle: string | null;
  titlePlaceholder: string;
  onTitleCommit: (nextTitle: string) => void;
  documentState: ProposalForgeTopbarDocumentState;
  lengthLabel: "Concise" | "Standard" | "Detailed" | null;
  hasProposalContent: boolean;
  hasJobContext?: boolean;
  exporting: boolean;
  savedShareAvailable?: boolean;
  onNewProposal: () => void;
  onDuplicateProposal: () => void;
  onDeleteProposal: () => void;
  onCopyText: () => void;
  onExportPdf: (mode: "ats" | "styled") => void;
  onExportDocx: () => void;
  onPageSizePreferenceChange?: (preference: DocumentPageSizePreference) => void;
  pageSizePreference?: DocumentPageSizePreference;
  onShareSavedProposal?: () => void;
};

type ProposalForgeTopbarContextValue = {
  registration: ProposalForgeTopbarRegistration | null;
  setRegistration: (
    registration: ProposalForgeTopbarRegistration | null,
  ) => void;
};

const ProposalForgeTopbarContext =
  React.createContext<ProposalForgeTopbarContextValue | null>(null);

export function ProposalForgeTopbarProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [registration, setRegistration] =
    React.useState<ProposalForgeTopbarRegistration | null>(null);
  const value = React.useMemo(
    () => ({ registration, setRegistration }),
    [registration],
  );

  return (
    <ProposalForgeTopbarContext.Provider value={value}>
      {children}
    </ProposalForgeTopbarContext.Provider>
  );
}

export function useProposalForgeTopbarRegistration(): ProposalForgeTopbarRegistration | null {
  return React.useContext(ProposalForgeTopbarContext)?.registration ?? null;
}

export function useRegisterProposalForgeTopbar(
  registration: ProposalForgeTopbarRegistration | null,
): void {
  const setRegistration =
    React.useContext(ProposalForgeTopbarContext)?.setRegistration;

  React.useEffect(() => {
    if (!setRegistration) return;
    setRegistration(registration);
  }, [registration, setRegistration]);

  React.useEffect(() => {
    if (!setRegistration) return;
    return () => setRegistration(null);
  }, [setRegistration]);
}
