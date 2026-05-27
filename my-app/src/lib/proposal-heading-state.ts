import type { ProposalHeaderVisibility } from "./proposal-header";
import type { ProposalApplicantHeaderData } from "./proposal-personalization";

export type ProposalHeadingMetadata = {
  applicantName?: string;
  applicantRole?: string;
  applicantCompany?: string;
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
  | "applicantCompany"
  | "contactLine"
  | "letterDate"
  | "recipientDetails";

type ProposalContactFields = {
  email?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  website?: string | null;
  location?: string | null;
};

export type ProposalStructuredContactFields = {
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  other: string;
};

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
  const company = resolveProposalHeadingText(metadata, "applicantCompany");

  if (name === null && role === null && company === null) {
    return null;
  }

  return {
    name,
    role,
    company,
    email: null,
    phone: null,
    linkedin: null,
    website: null,
    location: null,
    tag: null,
  };
}

export function normalizeProposalContactLine(
  value: string | null | undefined,
): string {
  return String(value ?? "")
    .split(/\s*(?:,|·|•|\|)\s*/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
}

function splitProposalContactLine(value: string | null | undefined): string[] {
  return normalizeProposalContactLine(value)
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function isPhoneContactPart(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 6 && /^[+()0-9][+()0-9.\-\s]*$/.test(value);
}

function isLinkedinContactPart(value: string): boolean {
  return /\blinkedin\.com\b/i.test(value) || /^@[a-z0-9._-]+$/i.test(value);
}

function isWebsiteContactPart(value: string): boolean {
  return (
    /\bhttps?:\/\//i.test(value) ||
    /\bwww\./i.test(value) ||
    /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+\S*$/i.test(value)
  );
}

function isContactPlaceholderPart(value: string): boolean {
  return /^(?:letter|sender)$/i.test(value.trim());
}

export function parseProposalContactLine(
  value: string | null | undefined,
): ProposalStructuredContactFields {
  const result: ProposalStructuredContactFields = {
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    website: "",
    other: "",
  };
  const other: string[] = [];

  for (const part of splitProposalContactLine(value)) {
    if (isContactPlaceholderPart(part)) {
      continue;
    }
    if (!result.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part)) {
      result.email = part;
    } else if (!result.phone && isPhoneContactPart(part)) {
      result.phone = part;
    } else if (!result.linkedin && isLinkedinContactPart(part)) {
      result.linkedin = part;
    } else if (!result.website && isWebsiteContactPart(part)) {
      result.website = part;
    } else if (!result.location) {
      result.location = part;
    } else {
      other.push(part);
    }
  }

  result.other = other.join(" · ");
  return result;
}

export function buildProposalContactLineFromParts(
  parts: Partial<ProposalStructuredContactFields>,
): string {
  return normalizeProposalContactLine(
    [
      parts.email,
      parts.phone,
      parts.location,
      parts.linkedin,
      parts.website,
      parts.other,
    ]
      .map((value) => value?.trim() ?? "")
      .filter(Boolean)
      .join(" · "),
  );
}

export function buildProposalApplicantContactLine(
  header: ProposalContactFields | null | undefined,
): string {
  return normalizeProposalContactLine(
    [
      header?.email?.trim() ?? "",
      header?.phone?.trim() ?? "",
      header?.location?.trim() ?? "",
      header?.linkedin?.trim() ?? "",
      header?.website?.trim() ?? "",
    ]
      .filter((value) => value.length > 0)
      .join(" · "),
  );
}

export function mergeProposalContactDefaults<T extends ProposalContactFields>(
  source: T,
  defaults: ProposalContactFields | null | undefined,
): T {
  return {
    ...source,
    email: source.email || defaults?.email || source.email,
    phone: source.phone || defaults?.phone || source.phone,
    linkedin: source.linkedin || defaults?.linkedin || source.linkedin,
    website: source.website || defaults?.website || source.website,
    location: source.location || defaults?.location || source.location,
  };
}

export function resolveAutoHeadingField(args: {
  current: string | null | undefined;
  previousAuto: string | null | undefined;
  nextAuto: string | null | undefined;
  isInvalidCurrent?: (value: string) => boolean;
}): string {
  const current = String(args.current ?? "");
  const trimmedCurrent = current.trim();
  const previousAuto = String(args.previousAuto ?? "").trim();
  const nextAuto = String(args.nextAuto ?? "").trim();

  if (args.isInvalidCurrent?.(trimmedCurrent)) {
    return nextAuto;
  }
  if (!trimmedCurrent || trimmedCurrent === previousAuto) {
    return nextAuto;
  }
  return current;
}

export function buildProposalHeadingMetadataPatch(args: {
  applicantName: string;
  applicantRole: string;
  applicantCompany?: string;
  contactLine: string;
  letterDate: string;
  recipientDetails: string;
  headerVisibility: ProposalHeaderVisibility;
}): ProposalHeadingMetadata {
  return {
    applicantName: args.applicantName.trim(),
    applicantRole: args.applicantRole.trim(),
    applicantCompany: args.applicantCompany?.trim() ?? "",
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
