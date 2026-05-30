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

function looksLikeLetterheadOrganization(value: string): boolean {
  return /\b(?:inc|llc|ltd|corp|co\.|company|studio|group|labs|systems|partners|agency|technologies|solutions|gmbh|sas|sa|school|university|cinema|tools|works|atelier|collective)\b/i.test(
    value,
  );
}

function extractShortLetterheadPlace(value: string | null | undefined): string {
  const normalized = normalizeHeaderValue(value).replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }

  if (
    !/\d/.test(normalized) &&
    !/\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|place|pl\.?|plaza|suite|floor|zip|postal|united states|usa)\b/i.test(
      normalized,
    )
  ) {
    return normalized;
  }

  const withoutStreet = normalized
    .replace(
      /^\d+\s+.*?\b(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?|place|pl\.?|plaza|way)\s+/i,
      "",
    )
    .replace(/\b(?:[A-Z]{2}\s*)?\d{4,6}\b.*$/i, "")
    .replace(/\b(?:united states|usa|united kingdom|france|germany|spain|italy|canada)\b.*$/i, "")
    .trim();

  if (
    /^[\p{L}.'’-]+(?:\s+[\p{L}.'’-]+){0,2}$/u.test(withoutStreet)
  ) {
    return withoutStreet;
  }

  return "";
}

export function resolveProposalLetterheadShortTitle(args: {
  recipientFields: ProposalRecipientFields;
  candidateLocation?: string | null;
  showRecipient: boolean;
}): string {
  if (args.showRecipient) {
    const company = normalizeHeaderValue(args.recipientFields.company);
    if (company) {
      return company;
    }

    const name = normalizeHeaderValue(args.recipientFields.name);
    if (name && looksLikeLetterheadOrganization(name)) {
      return name;
    }

    const city =
      extractShortLetterheadPlace(args.recipientFields.city) ||
      extractShortLetterheadPlace(args.recipientFields.address);
    if (city) {
      return city;
    }
  }

  return extractShortLetterheadPlace(args.candidateLocation);
}

export function parseProposalRecipientDetails(
  recipientDetails?: string | null,
): ProposalRecipientFields {
  const splitLines = String(recipientDetails ?? "")
    .split("\n")
    .map((line) => line.trim());
  let lastNonEmptyLineIndex = splitLines.length - 1;
  while (
    lastNonEmptyLineIndex >= 0 &&
    !splitLines[lastNonEmptyLineIndex]?.trim()
  ) {
    lastNonEmptyLineIndex -= 1;
  }
  const rawLines = splitLines.slice(0, lastNonEmptyLineIndex + 1);
  const compactLines = rawLines.filter(Boolean);
  const labeledFields: Partial<ProposalRecipientFields> = {};
  const unlabeledLines: string[] = [];

  compactLines.forEach((line) => {
    const match = line.match(
      /^(recipient|name|contact|role|title|company|organization|address|email|city|location)\s*:\s*(.+)$/i,
    );
    if (!match) {
      unlabeledLines.push(line);
      return;
    }

    const label = match[1].toLowerCase();
    const value = match[2].trim();
    if (!value) return;
    if (label === "recipient" || label === "name" || label === "contact") {
      labeledFields.name = value;
      return;
    }
    if (label === "role" || label === "title") {
      labeledFields.role = value;
      return;
    }
    if (label === "company" || label === "organization") {
      labeledFields.company = value;
      return;
    }
    if (label === "address") {
      labeledFields.address = value;
      return;
    }
    if (label === "email") {
      labeledFields.email = value;
      return;
    }
    if (label === "city" || label === "location") {
      labeledFields.city = value;
      return;
    }
  });

  if (Object.keys(labeledFields).length > 0) {
    const fields: ProposalRecipientFields = {
      name: labeledFields.name ?? "",
      role: labeledFields.role ?? "",
      company: labeledFields.company ?? "",
      address: labeledFields.address ?? "",
      email: labeledFields.email ?? "",
      city: labeledFields.city ?? "",
    };
    const remaining = unlabeledLines.filter(
      (line) =>
        line !== fields.name && line !== fields.role && line !== fields.company,
    );
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

  const fields: ProposalRecipientFields = {
    name: rawLines[0] ?? "",
    role: rawLines[1] ?? "",
    company: rawLines[2] ?? "",
    address: "",
    email: "",
    city: "",
  };

  if (
    rawLines.length === compactLines.length &&
    compactLines.length === 2 &&
    GENERIC_RECIPIENT_LABELS.has(compactLines[0].toLowerCase()) &&
    (looksLikeOrganization(compactLines[1]) || looksLikeCity(compactLines[1]))
  ) {
    fields.name = compactLines[0];
    fields.role = "";
    fields.company = compactLines[1];
  }

  fields.address = "";
  fields.email = "";
  fields.city = "";

  const remaining = rawLines.slice(3).filter(Boolean);
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
  const lines = [
    normalizeHeaderValue(fields?.name),
    normalizeHeaderValue(fields?.role),
    normalizeHeaderValue(fields?.company),
    normalizeHeaderValue(fields?.email),
    normalizeHeaderValue(fields?.address),
    normalizeHeaderValue(fields?.city),
  ];

  while (lines.length > 0 && !lines[lines.length - 1]) {
    lines.pop();
  }

  return lines.join("\n");
}

function normalizeProposalRecipientLineKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeProposalRecipientComparableLine(line: string): string {
  const match = line.match(
    /^(recipient|name|contact|role|title|company|organization|address|email|city|location)\s*:\s*(.+)$/i,
  );
  return normalizeProposalRecipientLineKey(match?.[2] ?? line);
}

function collectProposalRecipientExtraLines(
  recipientDetails: string | null | undefined,
  knownFieldValues: Array<string | null | undefined>,
): string[] {
  const knownFieldKeys = new Set(
    knownFieldValues
      .map((value) => normalizeProposalRecipientLineKey(value ?? ""))
      .filter(Boolean),
  );

  return String(recipientDetails ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return false;
      }
      return !knownFieldKeys.has(normalizeProposalRecipientComparableLine(line));
    });
}

export function getProposalRecipientExtraLines(
  recipientDetails?: string | null,
  fields: Partial<ProposalRecipientFields> = parseProposalRecipientDetails(
    recipientDetails,
  ),
): string[] {
  return collectProposalRecipientExtraLines(recipientDetails, [
    fields.name,
    fields.role,
    fields.company,
    fields.email,
    fields.address,
    fields.city,
  ]);
}

export function buildProposalRecipientDetailsPreservingExtraLines(args: {
  currentDetails?: string | null;
  fields: Partial<ProposalRecipientFields>;
}): string {
  const currentFields = parseProposalRecipientDetails(args.currentDetails);
  const extraLines = collectProposalRecipientExtraLines(args.currentDetails, [
    currentFields.name,
    currentFields.role,
    currentFields.company,
    currentFields.email,
    currentFields.address,
    currentFields.city,
    args.fields.name,
    args.fields.role,
    args.fields.company,
    args.fields.email,
    args.fields.address,
    args.fields.city,
  ]);
  const baseDetails = buildProposalRecipientDetails(args.fields);
  const mergedLines = [
    ...(baseDetails ? baseDetails.split("\n") : []),
    ...extraLines,
  ];

  while (mergedLines.length > 0 && !mergedLines[mergedLines.length - 1]) {
    mergedLines.pop();
  }

  return mergedLines.join("\n");
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
      recipientFields.address ||
        recipientFields.email ||
        recipientFields.city ||
        getProposalRecipientExtraLines(recipientDetails, recipientFields).length > 0,
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
    fields.email,
    fields.address,
    fields.city,
    ...getProposalRecipientExtraLines(recipientDetails, fields),
  ].filter(Boolean);

  return {
    primary,
    secondaryLines,
  };
}
