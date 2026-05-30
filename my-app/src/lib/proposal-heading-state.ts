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

type ProposalContactFieldKey = Exclude<
  keyof ProposalStructuredContactFields,
  "other"
>;

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

function normalizeProposalContactLabel(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

function parseLabeledProposalContactPart(
  value: string,
): { field: ProposalContactFieldKey; value: string } | null {
  const match = value.match(/^\s*([a-z][a-z0-9 ./_-]{0,28})\s*:\s*(.+)$/i);
  if (!match) {
    return null;
  }

  const rawLabel = match[1].trim();
  const label = normalizeProposalContactLabel(rawLabel);
  const contactValue = match[2].trim();
  if (!contactValue) {
    return null;
  }

  switch (label) {
    case "email":
    case "mail":
      return { field: "email", value: contactValue };
    case "phone":
    case "mobile":
    case "tel":
    case "telephone":
      return { field: "phone", value: contactValue };
    case "city":
    case "location":
      return { field: "location", value: contactValue };
    case "linkedin":
    case "linkedinprofile":
    case "profile":
    case "social":
    case "socials":
      return { field: "linkedin", value: contactValue };
    case "upwork":
      return { field: "linkedin", value: `${rawLabel}: ${contactValue}` };
    case "website":
    case "web":
    case "site":
    case "portfolio":
    case "homepage":
    case "url":
      return { field: "website", value: contactValue };
    default:
      return null;
  }
}

function splitProposalContactParts(value: string | null | undefined): string[] {
  return String(value ?? "")
    .split(/\s*(?:·|•|\|)\s*/g)
    .flatMap((part) => {
      const trimmed = part.trim();
      if (!trimmed) {
        return [];
      }
      if (parseLabeledProposalContactPart(trimmed)) {
        return [trimmed];
      }
      return trimmed
        .split(/\s*,\s*/g)
        .map((commaPart) => commaPart.trim())
        .filter(Boolean);
    });
}

export function normalizeProposalContactLine(
  value: string | null | undefined,
): string {
  return splitProposalContactParts(value).join(" · ");
}

function splitProposalContactLine(value: string | null | undefined): string[] {
  return splitProposalContactParts(value);
}

function joinProposalContactParts(
  parts: Array<string | null | undefined>,
): string {
  return parts
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" · ");
}

function isPhoneContactPart(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 6 && /^[+()0-9][+()0-9.\-\s]*$/.test(value);
}

function isLinkedinContactPart(value: string): boolean {
  return (
    /\blinkedin\.com\b/i.test(value) ||
    /\bupwork\b/i.test(value) ||
    /^linkedin$/i.test(value.trim()) ||
    /^@[a-z0-9._-]+$/i.test(value)
  );
}

function isWebsiteContactPart(value: string): boolean {
  return (
    /\bhttps?:\/\//i.test(value) ||
    /\bwww\./i.test(value) ||
    /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+\S*$/i.test(value)
  );
}

function hasProfileContactHint(value: string): boolean {
  return /\b(?:linkedin|upwork|profile|social)\b/i.test(value);
}

function hasWebsiteContactHint(value: string): boolean {
  return /\b(?:website|portfolio|homepage|github|behance|dribbble)\b/i.test(
    value,
  );
}

function isContactPlaceholderPart(value: string): boolean {
  return /^(?:letter|sender)$/i.test(value.trim());
}

function formatProposalContactPartForStorage(
  field: ProposalContactFieldKey,
  value: string | null | undefined,
): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  const labeledPart = parseLabeledProposalContactPart(trimmed);
  if (labeledPart?.field === field) {
    return trimmed;
  }

  if (
    field === "linkedin" &&
    (trimmed.includes(",") || !isLinkedinContactPart(trimmed))
  ) {
    return `Profile: ${trimmed}`;
  }
  if (
    field === "website" &&
    (trimmed.includes(",") || !isWebsiteContactPart(trimmed))
  ) {
    return `Website: ${trimmed}`;
  }

  return trimmed;
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
  const unclassified: string[] = [];

  for (const part of splitProposalContactLine(value)) {
    if (isContactPlaceholderPart(part)) {
      continue;
    }
    const labeledPart = parseLabeledProposalContactPart(part);
    if (labeledPart) {
      if (!result[labeledPart.field]) {
        result[labeledPart.field] = labeledPart.value;
      } else {
        other.push(labeledPart.value);
      }
    } else if (!result.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part)) {
      result.email = part;
    } else if (!result.phone && isPhoneContactPart(part)) {
      result.phone = part;
    } else if (!result.linkedin && isLinkedinContactPart(part)) {
      result.linkedin = part;
    } else if (!result.website && isWebsiteContactPart(part)) {
      result.website = part;
    } else {
      unclassified.push(part);
    }
  }

  for (const part of unclassified) {
    if (!result.location) {
      result.location = part;
    } else if (!result.linkedin && hasProfileContactHint(part)) {
      result.linkedin = part;
    } else if (!result.website && hasWebsiteContactHint(part)) {
      result.website = part;
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
  return joinProposalContactParts(
    [
      formatProposalContactPartForStorage("email", parts.email),
      formatProposalContactPartForStorage("phone", parts.phone),
      formatProposalContactPartForStorage("location", parts.location),
      formatProposalContactPartForStorage("linkedin", parts.linkedin),
      formatProposalContactPartForStorage("website", parts.website),
      parts.other,
    ],
  );
}

export function buildProposalApplicantContactLine(
  header: ProposalContactFields | null | undefined,
): string {
  return joinProposalContactParts(
    [
      formatProposalContactPartForStorage("email", header?.email),
      formatProposalContactPartForStorage("phone", header?.phone),
      formatProposalContactPartForStorage("location", header?.location),
      formatProposalContactPartForStorage("linkedin", header?.linkedin),
      formatProposalContactPartForStorage("website", header?.website),
    ],
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
