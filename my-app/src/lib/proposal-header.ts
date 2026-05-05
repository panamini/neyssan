export type ProposalHeaderVisibility = {
  showSender: boolean;
  showDate: boolean;
  showSubject: boolean;
  showRecipient: boolean;
  showRecipientDetails: boolean;
};

export const DEFAULT_PROPOSAL_HEADER_VISIBILITY: ProposalHeaderVisibility = {
  showSender: true,
  showDate: true,
  showSubject: true,
  showRecipient: true,
  showRecipientDetails: false,
};

export type ProposalRecipientFields = {
  name: string;
  role: string;
  company: string;
  address: string;
  email: string;
  city: string;
};

const GENERIC_RECIPIENT_LABELS = new Set([
  "hiring manager",
  "hiring team",
  "recruitment team",
  "talent acquisition",
  "talent team",
  "people team",
  "recruiter",
]);

function normalizeHeaderValue(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function looksLikeEmail(value: string): boolean {
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value);
}

function looksLikeAddress(value: string): boolean {
  return (
    /\d/.test(value) ||
    /\b(?:street|st\.|road|rd\.|avenue|ave\.|boulevard|blvd\.|lane|ln\.|drive|dr\.|place|plaza|suite|floor|zip|postal)\b/i.test(
      value,
    )
  );
}

function looksLikeCity(value: string): boolean {
  return (
    !looksLikeEmail(value) &&
    !looksLikeAddress(value) &&
    /^(?:[A-Z][A-Za-z.'’-]+(?:[\s-][A-Z][A-Za-z.'’-]+)*)(?:,\s*[A-Z][A-Za-z.'’-]+(?:[\s-][A-Z][A-Za-z.'’-]+)*)?$/.test(
      value,
    )
  );
}

function looksLikeOrganization(value: string): boolean {
  return /\b(?:inc|llc|ltd|corp|co\.|company|studio|group|labs|systems|partners|agency|technologies|solutions|gmbh|sas|sa)\b/i.test(
    value,
  );
}

export function parseProposalRecipientDetails(
  recipientDetails?: string | null,
): ProposalRecipientFields {
  const lines = String(recipientDetails ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const fields: ProposalRecipientFields = {
    name: lines[0] ?? "",
    role: lines[1] ?? "",
    company: lines[2] ?? "",
    address: "",
    email: "",
    city: "",
  };

  const remaining = lines.slice(3);
  if (fields.name && !fields.role && !fields.company && looksLikeOrganization(fields.name)) {
    fields.company = fields.name;
    fields.name = "";
  }
  remaining.forEach((line) => {
    if (!fields.email && looksLikeEmail(line)) {
      fields.email = line;
      return;
    }
    if (!fields.address && looksLikeAddress(line)) {
      fields.address = line;
      return;
    }
    if (!fields.city && looksLikeCity(line)) {
      fields.city = line;
      return;
    }
    if (!fields.address) {
      fields.address = line;
      return;
    }
    if (!fields.city) {
      fields.city = line;
    }
  });

  return fields;
}

export function buildProposalRecipientDetails(
  fields: Partial<ProposalRecipientFields> | null | undefined,
): string {
  return [
    normalizeHeaderValue(fields?.name),
    normalizeHeaderValue(fields?.role),
    normalizeHeaderValue(fields?.company),
    normalizeHeaderValue(fields?.address),
    normalizeHeaderValue(fields?.email),
    normalizeHeaderValue(fields?.city),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildProposalRecipientPrefill(args: {
  company?: string | null;
  role?: string | null;
  address?: string | null;
  email?: string | null;
  city?: string | null;
}): string {
  return buildProposalRecipientDetails({
    name: "",
    role: args.role ?? "",
    company: args.company ?? "",
    address: args.address ?? "",
    email: args.email ?? "",
    city: args.city ?? "",
  });
}

export function buildProposalLetterDateLine(args: {
  location?: string | null;
  date?: Date;
}): string {
  const formattedDate = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(args.date ?? new Date());
  const location = normalizeHeaderValue(args.location);

  return location ? `${location}, ${formattedDate}` : formattedDate;
}

export function buildProposalSalutation(
  recipientDetails?: string | null,
): string {
  const fields = parseProposalRecipientDetails(recipientDetails);
  const normalizedName = normalizeHeaderValue(fields.name);
  const normalizedRole = normalizeHeaderValue(fields.role);

  if (
    normalizedName &&
    !GENERIC_RECIPIENT_LABELS.has(normalizedName.toLowerCase()) &&
    !looksLikeOrganization(normalizedName)
  ) {
    return `Dear ${normalizedName},`;
  }

  if (normalizedRole) {
    return `Dear ${normalizedRole},`;
  }

  return "Dear Hiring Manager,";
}

const SALUTATION_PATTERN =
  /^(dear\b|hello\b|hi\b|greetings\b|madame\b|monsieur\b|madame,\s*monsieur\b|bonjour\b)/i;

export function readProposalSalutation(content?: string | null): string {
  const lines = String(content ?? "").replace(/\r\n/g, "\n").split("\n");
  const firstNonEmptyIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstNonEmptyIndex < 0) {
    return "";
  }

  const candidate = lines[firstNonEmptyIndex].trim();
  return SALUTATION_PATTERN.test(candidate) ? candidate : "";
}

export function replaceProposalSalutation(args: {
  content?: string | null;
  salutation?: string | null;
  previousSalutation?: string | null;
}): string {
  const nextSalutation = normalizeHeaderValue(args.salutation);
  const previousSalutation = normalizeHeaderValue(args.previousSalutation);
  const lines = String(args.content ?? "").replace(/\r\n/g, "\n").split("\n");
  const firstNonEmptyIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstNonEmptyIndex < 0) {
    return nextSalutation;
  }

  const currentFirstLine = lines[firstNonEmptyIndex].trim();
  if (
    SALUTATION_PATTERN.test(currentFirstLine) ||
    (previousSalutation && currentFirstLine === previousSalutation)
  ) {
    if (!nextSalutation) {
      lines.splice(firstNonEmptyIndex, 1);
      while (
        firstNonEmptyIndex < lines.length &&
        lines[firstNonEmptyIndex]?.trim() === ""
      ) {
        lines.splice(firstNonEmptyIndex, 1);
      }
      return lines.join("\n");
    }

    lines[firstNonEmptyIndex] = nextSalutation;
    return lines.join("\n");
  }

  if (!nextSalutation) {
    return lines.join("\n");
  }

  const prefix = lines.join("\n").trimStart();
  return `${nextSalutation}\n\n${prefix}`;
}

export function resolveProposalHeaderVisibility(
  value?: Partial<ProposalHeaderVisibility> | null,
): ProposalHeaderVisibility {
  return {
    showSender:
      typeof value?.showSender === "boolean"
        ? value.showSender
        : DEFAULT_PROPOSAL_HEADER_VISIBILITY.showSender,
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
    value.showSender !== DEFAULT_PROPOSAL_HEADER_VISIBILITY.showSender ||
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
  const recipientFields = parseProposalRecipientDetails(recipientDetails);
  return {
    ...DEFAULT_PROPOSAL_HEADER_VISIBILITY,
    showRecipientDetails: Boolean(
      recipientFields.address || recipientFields.email || recipientFields.city,
    ),
  };
}

export function resolveProposalRecipientLines(
  recipientDetails?: string | null,
): {
  primary: string;
  secondaryLines: string[];
} {
  const fields = parseProposalRecipientDetails(recipientDetails);
  const primary =
    normalizeHeaderValue(fields.name) ||
    normalizeHeaderValue(fields.company) ||
    normalizeHeaderValue(fields.role);
  const secondaryLines = [
    fields.name && fields.name !== primary ? fields.name : "",
    fields.role && fields.role !== primary ? fields.role : "",
    fields.company && fields.company !== primary ? fields.company : "",
    fields.address,
    fields.email,
    fields.city,
  ].filter(Boolean);

  return {
    primary,
    secondaryLines,
  };
}
