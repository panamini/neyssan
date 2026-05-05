import type { ProposalHeaderVisibility } from "./proposal-header";
import type { ProposalApplicantHeaderData } from "./proposal-personalization";

export type ProposalHeadingMetadata = {
  applicantName?: string;
  applicantRole?: string;
  contactLine?: string;
  letterDate?: string;
  recipientDetails?: string;
  headerShowSender?: boolean;
  headerShowDate?: boolean;
  headerShowSubject?: boolean;
  headerShowRecipient?: boolean;
  headerShowRecipientDetails?: boolean;
};

export type ProposalHeadingTextKey =
  | "applicantName"
  | "applicantRole"
  | "contactLine"
  | "letterDate"
  | "recipientDetails";

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function resolveProposalHeadingText(
  metadata: ProposalHeadingMetadata | null | undefined,
  key: ProposalHeadingTextKey,
): string | null {
  if (!metadata || !hasOwn(metadata, key)) {
    return null;
  }

  const value = metadata[key];
  return typeof value === "string" ? value.trim() : null;
}

export function buildProposalApplicantHeaderFromMetadata(
  metadata: ProposalHeadingMetadata | null | undefined,
): ProposalApplicantHeaderData | null {
  const name = resolveProposalHeadingText(metadata, "applicantName");
  const role = resolveProposalHeadingText(metadata, "applicantRole");

  if (name === null && role === null) {
    return null;
  }

  return {
    name,
    role,
    email: null,
    phone: null,
    linkedin: null,
    website: null,
    location: null,
    tag: null,
  };
}

export function buildProposalHeadingMetadataPatch(args: {
  applicantName: string;
  applicantRole: string;
  contactLine: string;
  letterDate: string;
  recipientDetails: string;
  headerVisibility: ProposalHeaderVisibility;
}): ProposalHeadingMetadata {
  return {
    applicantName: args.applicantName.trim(),
    applicantRole: args.applicantRole.trim(),
    contactLine: args.contactLine.trim(),
    letterDate: args.letterDate.trim(),
    recipientDetails: args.recipientDetails.trim(),
    headerShowSender: args.headerVisibility.showSender,
    headerShowDate: args.headerVisibility.showDate,
    headerShowSubject: args.headerVisibility.showSubject,
    headerShowRecipient: args.headerVisibility.showRecipient,
    headerShowRecipientDetails: args.headerVisibility.showRecipientDetails,
  };
}
