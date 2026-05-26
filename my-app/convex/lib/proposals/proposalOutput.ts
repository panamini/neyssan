export type ProposalOutputFormat =
  | "cover_letter"
  | "application_message"
  | "freelance_proposal";

export const PROPOSAL_DOCUMENT_LANGUAGE_CODES = [
  "en",
  "fr",
  "es",
  "de",
  "it",
  "pt",
  "pl",
  "nl",
  "el",
  "hu",
  "lt",
  "et",
  "ru",
  "ar",
] as const;

export type ProposalDocumentLanguageCode =
  (typeof PROPOSAL_DOCUMENT_LANGUAGE_CODES)[number];

export type ProposalOutputLanguage =
  | "English"
  | "French"
  | "Spanish"
  | "German"
  | "Italian"
  | "Portuguese"
  | "Polish"
  | "Dutch"
  | "Greek"
  | "Hungarian"
  | "Lithuanian"
  | "Estonian"
  | "Russian"
  | "Arabic";

const PROPOSAL_LANGUAGE_LABELS: Record<
  ProposalDocumentLanguageCode,
  ProposalOutputLanguage
> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  pl: "Polish",
  nl: "Dutch",
  el: "Greek",
  hu: "Hungarian",
  lt: "Lithuanian",
  et: "Estonian",
  ru: "Russian",
  ar: "Arabic",
};

const TITLE_PLACEHOLDER_PATTERN = /^(?:no title found|untitled)$/i;
const REGENERATED_TITLE_PATTERN = /^(.*?)(?:\s+—\s+Regenerated(?:\s+(\d+))?)$/;
const FRENCH_DIACRITICS_GLOBAL_PATTERN = /[éèêëàâäôöûüçœæÿ]/gi;
const FRENCH_LANGUAGE_MARKERS = [
  "bonjour",
  "nous recherchons",
  "nous recrutons",
  "candidature",
  "poste",
  "offre",
  "emploi",
  "mission",
  "profil",
  "expérience",
  "compétences",
  "entreprise",
  "équipe",
  "rejoindre",
  "contrat",
  "développeur",
  "ingénieur",
];
const ENGLISH_LANGUAGE_MARKERS = [
  "we are looking",
  "we're looking",
  "job",
  "role",
  "position",
  "company",
  "team",
  "requirements",
  "experience",
  "skills",
  "apply",
  "remote",
];

function isProposalDocumentLanguageCode(
  value: string | null | undefined,
): value is ProposalDocumentLanguageCode {
  return PROPOSAL_DOCUMENT_LANGUAGE_CODES.includes(
    value as ProposalDocumentLanguageCode,
  );
}

export function resolveProposalOutputLanguageFromCode(
  value: string | null | undefined,
): ProposalOutputLanguage | null {
  const normalized = value?.toLowerCase().split("-")[0]?.trim();
  return isProposalDocumentLanguageCode(normalized)
    ? PROPOSAL_LANGUAGE_LABELS[normalized]
    : null;
}

export function resolveProposalPlannerOutputLanguageFromCode(
  value: string | null | undefined,
): ProposalDocumentLanguageCode | null {
  const normalized = value?.toLowerCase().split("-")[0]?.trim();
  return isProposalDocumentLanguageCode(normalized) ? normalized : null;
}

function countMarkerHits(text: string, markers: readonly string[]): number {
  return markers.reduce((count, marker) => {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|\\b)${escaped}(\\b|$)`, "i");
    return count + (pattern.test(text) ? 1 : 0);
  }, 0);
}

function normalizeTitle(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function isUsableTitle(value: string | null | undefined): value is string {
  const normalized = normalizeTitle(value);
  return normalized !== null && !TITLE_PLACEHOLDER_PATTERN.test(normalized);
}

export function getProposalTitleFallback(format: ProposalOutputFormat): string {
  switch (format) {
    case "application_message":
      return "Untitled application message";
    case "freelance_proposal":
      return "Untitled freelance proposal";
    case "cover_letter":
    default:
      return "Untitled cover letter";
  }
}

export function resolveStoredProposalTitle(args: {
  jobTitle?: string | null;
  parsedTitle?: string | null;
  format: ProposalOutputFormat;
}): string {
  if (isUsableTitle(args.jobTitle)) {
    return normalizeTitle(args.jobTitle)!;
  }

  if (isUsableTitle(args.parsedTitle)) {
    return normalizeTitle(args.parsedTitle)!;
  }

  return getProposalTitleFallback(args.format);
}

export function resolveRegeneratedProposalTitle(args: {
  currentTitle?: string | null;
  format: ProposalOutputFormat;
}): string {
  const normalized = normalizeTitle(args.currentTitle);
  const match = normalized?.match(REGENERATED_TITLE_PATTERN);
  const incrementFrom = match ? Number.parseInt(match[2] ?? "1", 10) : 0;
  const baseCandidate = normalizeTitle(match?.[1] ?? normalized);
  const baseTitle =
    isUsableTitle(baseCandidate)
      ? baseCandidate
      : getProposalTitleFallback(args.format);

  if (incrementFrom >= 1) {
    return `${baseTitle} — Regenerated ${incrementFrom + 1}`;
  }

  return `${baseTitle} — Regenerated`;
}

export function resolveProposalOutputLanguage(
  jobDescription: string,
): ProposalOutputLanguage {
  const normalized = jobDescription.toLowerCase().trim();
  if (!normalized) return "English";

  const frenchHits = countMarkerHits(normalized, FRENCH_LANGUAGE_MARKERS);
  const englishHits = countMarkerHits(normalized, ENGLISH_LANGUAGE_MARKERS);
  const frenchDiacriticCount =
    jobDescription.match(FRENCH_DIACRITICS_GLOBAL_PATTERN)?.length ?? 0;

  if (frenchHits >= 2 && frenchHits >= englishHits) {
    return "French";
  }

  if (
    frenchHits > englishHits &&
    frenchHits >= 1 &&
    frenchDiacriticCount >= 2
  ) {
    return "French";
  }

  if (englishHits > frenchHits) {
    return "English";
  }

  if (frenchHits > 0 && englishHits === 0 && frenchDiacriticCount >= 2) {
    return "French";
  }

  return "English";
}

export function buildProposalOutputLanguageInstruction(
  language: ProposalOutputLanguage,
): string {
  if (language === "French") {
    return [
      "Write the generated text in French.",
      "Do not switch to English because the candidate background or CV is in English.",
      "If the prompt forbids greetings, sign-offs, or boundary lines, do not add them.",
      'Do not use English greetings or closings such as "Dear Hiring Manager" or "Sincerely" when boundary text is not allowed.',
      "Keep proper nouns, company names, product names, and technology names as-is when needed.",
    ].join(" ");
  }

  if (language === "Arabic") {
    return [
      "Write the generated text in Arabic.",
      "Do not switch to English, French, or another language because the candidate background, CV, UI, or job source is in another language.",
      "Use natural right-to-left Arabic prose for the generated document text.",
      "If the prompt forbids greetings, sign-offs, or boundary lines, do not add them.",
      "Keep proper nouns, company names, product names, and technology names as-is when needed.",
    ].join(" ");
  }

  if (language !== "English") {
    return [
      `Write the generated text in ${language}.`,
      "Do not switch to English, French, or another language because the candidate background, CV, UI, or job source is in another language.",
      "If the prompt forbids greetings, sign-offs, or boundary lines, do not add them.",
      "Keep proper nouns, company names, product names, and technology names as-is when needed.",
    ].join(" ");
  }

  return [
    "Write the generated text in English.",
    "Do not switch to another language because the candidate background or CV is in another language.",
    "If the prompt forbids greetings, sign-offs, or boundary lines, do not add them.",
    'Do not use French greetings or closings such as "Madame, Monsieur" or "Cordialement" when boundary text is not allowed.',
    "Keep proper nouns, company names, product names, and technology names as-is when needed.",
  ].join(" ");
}

export function getCoverLetterSalutationInstruction(
  language: ProposalOutputLanguage,
): string {
  if (language === "French") {
    return 'Start with a French salutation line such as: Madame, Monsieur,';
  }

  return 'Start with an English salutation line such as: Dear Hiring Manager,';
}

export function getCoverLetterClosingInstruction(
  language: ProposalOutputLanguage,
): string {
  if (language === "French") {
    return "End with a simple French professional closing such as Cordialement, and the candidate name on the final line.";
  }

  return "End with a simple English professional closing such as Sincerely, and the candidate name on the final line.";
}
