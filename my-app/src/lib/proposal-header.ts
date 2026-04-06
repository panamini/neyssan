export type ProposalHeaderVisibility = {
  showDate: boolean;
  showSubject: boolean;
  showRecipient: boolean;
  showRecipientDetails: boolean;
};

export const DEFAULT_PROPOSAL_HEADER_VISIBILITY: ProposalHeaderVisibility = {
  showDate: true,
  showSubject: true,
  showRecipient: true,
  showRecipientDetails: false,
};

export function resolveProposalHeaderVisibility(
  value?: Partial<ProposalHeaderVisibility> | null,
): ProposalHeaderVisibility {
  return {
    showDate:
      typeof value?.showDate === "boolean"
        ? value.showDate
        : DEFAULT_PROPOSAL_HEADER_VISIBILITY.showDate,
    showSubject:
      typeof value?.showSubject === "boolean"
        ? value.showSubject
        : DEFAULT_PROPOSAL_HEADER_VISIBILITY.showSubject,
    showRecipient:
      typeof value?.showRecipient === "boolean"
        ? value.showRecipient
        : DEFAULT_PROPOSAL_HEADER_VISIBILITY.showRecipient,
    showRecipientDetails:
      typeof value?.showRecipientDetails === "boolean"
        ? value.showRecipientDetails
        : DEFAULT_PROPOSAL_HEADER_VISIBILITY.showRecipientDetails,
  };
}

export function hasProposalHeaderVisibilityOverride(
  value: ProposalHeaderVisibility,
): boolean {
  return (
    value.showDate !== DEFAULT_PROPOSAL_HEADER_VISIBILITY.showDate ||
    value.showSubject !== DEFAULT_PROPOSAL_HEADER_VISIBILITY.showSubject ||
    value.showRecipient !== DEFAULT_PROPOSAL_HEADER_VISIBILITY.showRecipient ||
    value.showRecipientDetails !==
      DEFAULT_PROPOSAL_HEADER_VISIBILITY.showRecipientDetails
  );
}

export function buildProposalHeaderVisibilityFromContent(
  recipientDetails?: string | null,
): ProposalHeaderVisibility {
  const { secondaryLines } = resolveProposalRecipientLines(recipientDetails);
  return {
    ...DEFAULT_PROPOSAL_HEADER_VISIBILITY,
    showRecipientDetails: secondaryLines.length > 0,
  };
}

export function resolveProposalRecipientLines(
  recipientDetails?: string | null,
): {
  primary: string;
  secondaryLines: string[];
} {
  const lines = String(recipientDetails ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    primary: lines[0] ?? "",
    secondaryLines: lines.slice(1),
  };
}
