/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, no-useless-escape -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import {
  ENGLISH_SIGNOFFS,
  FRENCH_SIGNOFFS,
} from "../../convex/lib/proposals/proposalRenderer";

export type ProposalClosingLanguage = "en" | "fr" | "es";
export type ProposalClosingDocumentType =
  | "cover_letter"
  | "application_message"
  | "freelance_proposal";

export type ProposalClosingBlock = {
  signOff: string | null;
  signatureName: string | null;
};

export type ProposalClosingSource =
  | "settings"
  | "document"
  | "legacy"
  | "language_default"
  | "custom";

export type ProposalClosingRef = {
  enabled: boolean;
  signOff: string;
  signatureName: string;
  source: ProposalClosingSource;
  closingNeedsUserChoice?: boolean;
  handwrittenSignatureEnabled?: boolean;
};

export type ClosingOptionGroup = {
  id: "recommended" | "concise" | "formal" | "classic" | "custom";
  label: string;
  options: string[];
};

export const FRENCH_COVER_LETTER_DEFAULT_SIGNOFF =
  "Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.";

export const CLOSING_PRESETS = {
  en: {
    cover_letter: {
      recommended: "Sincerely,",
      options: ["Sincerely,", "Respectfully,", "Kind regards,", "Best regards,"],
    },
    application_message: {
      recommended: "Sincerely,",
      options: ["Sincerely,", "Best regards,", "Kind regards,"],
    },
    freelance_proposal: {
      recommended: "Best regards,",
      options: ["Best regards,", "Kind regards,", "Sincerely,"],
    },
  },
  fr: {
    cover_letter: {
      recommended: FRENCH_COVER_LETTER_DEFAULT_SIGNOFF,
      options: [
        FRENCH_COVER_LETTER_DEFAULT_SIGNOFF,
        "Veuillez agréer, Madame, Monsieur, mes salutations distinguées.",
        "Je vous prie de recevoir, Madame, Monsieur, mes sincères salutations.",
        "Bien cordialement,",
        "Cordialement,",
      ],
    },
    application_message: {
      recommended: "Cordialement,",
      options: ["Cordialement,", "Bien cordialement,", "Sincères salutations,"],
    },
    freelance_proposal: {
      recommended: "Bien cordialement,",
      options: ["Bien cordialement,", "Cordialement,", "Sincères salutations,"],
    },
  },
  es: {
    cover_letter: {
      recommended: "Atentamente,",
      options: [
        "Atentamente,",
        "Le saluda atentamente,",
        "Saludos cordiales,",
        "Cordialmente,",
      ],
    },
    application_message: {
      recommended: "Un cordial saludo,",
      options: ["Un cordial saludo,", "Saludos cordiales,", "Atentamente,"],
    },
    freelance_proposal: {
      recommended: "Cordialmente,",
      options: ["Cordialmente,", "Saludos cordiales,", "Atentamente,"],
    },
  },
} as const;

const PROPOSAL_CLOSING_SOURCE_VALUES = new Set<ProposalClosingSource>([
  "settings",
  "document",
  "legacy",
  "language_default",
  "custom",
]);

export type ExtractedProposalClosingBlock = {
  block: ProposalClosingBlock;
  startIndex: number;
};

const SIGNATURE_NAME_PATTERN = /^[\p{L}][\p{L}\s.'’\-]{1,56}$/u;
const CANONICAL_SIGNOFFS = new Set(
  [
    ...Object.values(ENGLISH_SIGNOFFS),
    ...Object.values(FRENCH_SIGNOFFS),
    ...Object.values(CLOSING_PRESETS).flatMap((byType) =>
      Object.values(byType).flatMap((preset) => [
        preset.recommended,
        ...preset.options,
      ]),
    ),
    "Kind regards,",
    "Best regards,",
    "Warm regards,",
    "Bien cordialement,",
    "Avec mes salutations,",
    "Atentamente,",
    "Cordialmente,",
    "Saludos cordiales,",
  ].map(normalizeProposalClosingForMatch),
);

export function stripInlineProposalMarkdown(value: string): string {
  return value
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim();
}

export function isLikelyProposalSignatureName(value: string): boolean {
  const normalized = stripInlineProposalMarkdown(value);
  if (!normalized) {
    return false;
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount < 1 || wordCount > 5) {
    return false;
  }

  return SIGNATURE_NAME_PATTERN.test(normalized);
}

export function formatProposalSignatureName(value: string): string {
  return stripInlineProposalMarkdown(value).toLowerCase();
}

function normalizeProposalClosingForMatch(value: string): string {
  return stripInlineProposalMarkdown(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[,.!?;:…]+$/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function splitProposalClosingLines(value: string): string[] {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseProposalClosingBlock(
  value: string | null | undefined,
): ProposalClosingBlock | null {
  if (!value) {
    return null;
  }

  const lines = splitProposalClosingLines(value);
  if (lines.length === 0 || lines.length > 2) {
    return null;
  }

  const [candidateSignOff, candidateSignatureName] = lines;
  if (!candidateSignOff) {
    return null;
  }

  if (!CANONICAL_SIGNOFFS.has(normalizeProposalClosingForMatch(candidateSignOff))) {
    return null;
  }

  if (lines.length === 1) {
    return {
      signOff: candidateSignOff,
      signatureName: null,
    };
  }

  if (!candidateSignatureName || !isLikelyProposalSignatureName(candidateSignatureName)) {
    return null;
  }

  return {
    signOff: candidateSignOff,
    signatureName: candidateSignatureName,
  };
}

export function extractProposalClosingBlockFromParagraphs(
  paragraphs: string[],
): ExtractedProposalClosingBlock | null {
  const tailParagraph = paragraphs.at(-1) ?? null;
  const compactClosingBlock = parseProposalClosingBlock(tailParagraph);
  if (compactClosingBlock) {
    return {
      block: compactClosingBlock,
      startIndex: paragraphs.length - 1,
    };
  }

  if (paragraphs.length < 2) {
    return null;
  }

  const candidateSignOffParagraph = paragraphs.at(-2) ?? null;
  const candidateSignatureParagraph = paragraphs.at(-1) ?? "";
  const signOffOnlyBlock = parseProposalClosingBlock(candidateSignOffParagraph);
  if (
    !signOffOnlyBlock ||
    signOffOnlyBlock.signatureName ||
    !isLikelyProposalSignatureName(candidateSignatureParagraph)
  ) {
    return null;
  }

  return {
    block: {
      signOff: signOffOnlyBlock.signOff,
      signatureName: stripInlineProposalMarkdown(candidateSignatureParagraph),
    },
    startIndex: paragraphs.length - 2,
  };
}

function cleanProposalClosingText(value: unknown): string {
  return typeof value === "string" ? stripInlineProposalMarkdown(value) : "";
}

function normalizeProposalClosingSource(
  value: unknown,
): ProposalClosingSource | null {
  return typeof value === "string" &&
    PROPOSAL_CLOSING_SOURCE_VALUES.has(value as ProposalClosingSource)
    ? (value as ProposalClosingSource)
    : null;
}

function normalizeProposalClosingLanguage(
  value: unknown,
): ProposalClosingLanguage | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().split("-")[0]?.trim();
  if (normalized === "en" || normalized === "english") return "en";
  if (normalized === "fr" || normalized === "french") return "fr";
  if (normalized === "es" || normalized === "spanish") return "es";
  return null;
}

function inferProposalClosingLanguageFromContent(
  content: string | null | undefined,
): ProposalClosingLanguage | null {
  const normalized = normalizeProposalClosingForMatch(content ?? "");
  if (!normalized) return null;
  if (
    /\b(?:madame,?\s+monsieur|cordialement|bien cordialement|salutations distinguées)\b/i.test(
      normalized,
    )
  ) {
    return "fr";
  }
  if (
    /\b(?:estimado|estimada|atentamente|cordialmente|saludos cordiales)\b/i.test(
      normalized,
    )
  ) {
    return "es";
  }
  if (/\b(?:dear hiring manager|sincerely|kind regards|best regards)\b/i.test(normalized)) {
    return "en";
  }
  return null;
}

function normalizeProposalClosingDocumentType(
  value: string | null | undefined,
): ProposalClosingDocumentType {
  if (
    value === "application_message" ||
    value === "freelance_proposal" ||
    value === "cover_letter"
  ) {
    return value;
  }
  return "cover_letter";
}

export function resolveDefaultProposalSignOff(args: {
  locale?: string | null;
  content?: string | null;
  proposalType?: string | null;
  voicePreset?: string | null;
}): { signOff: string; closingNeedsUserChoice: boolean } {
  const localeWasProvided =
    typeof args.locale === "string" && args.locale.trim().length > 0;
  const language = localeWasProvided
    ? normalizeProposalClosingLanguage(args.locale)
    : inferProposalClosingLanguageFromContent(args.content) ?? "en";
  if (!language) {
    return { signOff: "", closingNeedsUserChoice: true };
  }
  const proposalType = normalizeProposalClosingDocumentType(args.proposalType);
  return {
    signOff: CLOSING_PRESETS[language][proposalType].recommended,
    closingNeedsUserChoice: false,
  };
}

export function resolveProposalClosingOptionGroups(args: {
  locale?: string | null;
  content?: string | null;
  proposalType?: string | null;
}): ClosingOptionGroup[] {
  const localeWasProvided =
    typeof args.locale === "string" && args.locale.trim().length > 0;
  const language = localeWasProvided
    ? normalizeProposalClosingLanguage(args.locale)
    : inferProposalClosingLanguageFromContent(args.content) ?? "en";
  if (!language) {
    return [
      {
        id: "custom",
        label: "Custom",
        options: [],
      },
    ];
  }

  const proposalType = normalizeProposalClosingDocumentType(args.proposalType);
  if (language === "fr" && proposalType === "cover_letter") {
    return [
      {
        id: "recommended",
        label: "Recommended",
        options: [CLOSING_PRESETS.fr.cover_letter.recommended],
      },
      {
        id: "concise",
        label: "Concise",
        options: ["Cordialement,", "Bien cordialement,"],
      },
      {
        id: "classic",
        label: "Classic",
        options: [
          "Veuillez agréer, Madame, Monsieur, mes salutations distinguées.",
          "Je vous prie de recevoir, Madame, Monsieur, mes sincères salutations.",
        ],
      },
      {
        id: "custom",
        label: "Custom",
        options: [],
      },
    ];
  }

  const preset = CLOSING_PRESETS[language][proposalType];
  const secondaryOptions = preset.options.filter(
    (option) => option !== preset.recommended,
  );
  return [
    {
      id: "recommended",
      label: "Recommended",
      options: [preset.recommended],
    },
    ...(secondaryOptions.length > 0
      ? [
          {
            id: proposalType === "cover_letter" ? "formal" : "concise",
            label: proposalType === "cover_letter" ? "Formal" : "Concise",
            options: secondaryOptions,
          } satisfies ClosingOptionGroup,
        ]
      : []),
    {
      id: "custom",
      label: "Custom",
      options: [],
    },
  ];
}

export function sanitizeProposalClosingRef(
  value: unknown,
): ProposalClosingRef | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Partial<ProposalClosingRef>;
  const signOff = cleanProposalClosingText(record.signOff);
  const signatureName = cleanProposalClosingText(record.signatureName);
  const source = normalizeProposalClosingSource(record.source) ?? "document";

  return {
    enabled: record.enabled !== false,
    signOff,
    signatureName,
    source,
    closingNeedsUserChoice: record.closingNeedsUserChoice === true,
    handwrittenSignatureEnabled: record.handwrittenSignatureEnabled === true,
  };
}

export function getLegacyProposalClosingRefFromContent(
  content: string | null | undefined,
): ProposalClosingRef | null {
  if (!content) {
    return null;
  }

  const paragraphs = content
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const extracted = extractProposalClosingBlockFromParagraphs(paragraphs);
  if (!extracted?.block.signOff && !extracted?.block.signatureName) {
    return null;
  }

  return {
    enabled: true,
    signOff: extracted?.block.signOff ?? "",
    signatureName: extracted?.block.signatureName ?? "",
    source: "legacy",
    handwrittenSignatureEnabled: false,
  };
}

export function resolveProposalClosingRef(args: {
  closing?: unknown;
  content?: string | null;
  proposalType?: string | null;
  applicantName?: string | null;
  locale?: string | null;
  voicePreset?: string | null;
  defaultEnabled?: boolean;
}): ProposalClosingRef | null {
  const sanitized = sanitizeProposalClosingRef(args.closing);
  const legacy = getLegacyProposalClosingRefFromContent(args.content);
  const applicantSignatureName = cleanProposalClosingText(args.applicantName);
  const defaultEnabled =
    typeof args.defaultEnabled === "boolean"
      ? args.defaultEnabled
      : args.proposalType === "cover_letter" || !args.proposalType;
  const languageDefault = resolveDefaultProposalSignOff({
    locale: args.locale,
    content: args.content,
    proposalType: args.proposalType,
    voicePreset: args.voicePreset,
  });

  if (sanitized) {
    const resolvedSignOff =
      sanitized.signOff || legacy?.signOff || languageDefault.signOff;
    return {
      ...sanitized,
      signOff: resolvedSignOff,
      closingNeedsUserChoice:
        sanitized.closingNeedsUserChoice ||
        (!resolvedSignOff && languageDefault.closingNeedsUserChoice),
      signatureName:
        sanitized.source === "document"
          ? sanitized.signatureName ||
            applicantSignatureName ||
            legacy?.signatureName ||
            ""
          : applicantSignatureName ||
            sanitized.signatureName ||
            legacy?.signatureName ||
            "",
    };
  }

  if (legacy) {
    const resolvedSignOff = legacy.signOff || languageDefault.signOff;
    return {
      ...legacy,
      signOff: resolvedSignOff,
      closingNeedsUserChoice: !resolvedSignOff && languageDefault.closingNeedsUserChoice,
      signatureName: legacy.signatureName || applicantSignatureName,
    };
  }

  if (!defaultEnabled) {
    return null;
  }

  return {
    enabled: true,
    signOff: languageDefault.signOff,
    signatureName: applicantSignatureName,
    source: "language_default",
    closingNeedsUserChoice: languageDefault.closingNeedsUserChoice,
    handwrittenSignatureEnabled: false,
  };
}

export function removeProposalSignatureNameFromClosing(
  content: string | null | undefined,
): string {
  if (!content) {
    return "";
  }

  const normalizedContent = content.replace(/\r\n/g, "\n").trimEnd();
  if (!normalizedContent) {
    return content;
  }

  const paragraphs = normalizedContent
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const closingBlock = extractProposalClosingBlockFromParagraphs(paragraphs);
  if (!closingBlock?.block.signOff || !closingBlock.block.signatureName) {
    return content;
  }

  return [
    ...paragraphs.slice(0, closingBlock.startIndex),
    closingBlock.block.signOff,
  ].join("\n\n");
}

export function ensureProposalSignatureName(
  content: string,
  signatureName: string | null | undefined,
): string {
  const normalizedContent = content.replace(/\r\n/g, "\n").trimEnd();
  if (!normalizedContent) {
    return content;
  }

  const paragraphs = normalizedContent
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const closingBlock = extractProposalClosingBlockFromParagraphs(paragraphs);
  if (!closingBlock || !closingBlock.block.signOff) {
    return content;
  }

  const normalizedSignatureName = formatProposalSignatureName(
    closingBlock.block.signatureName ?? signatureName ?? "",
  );
  if (!normalizedSignatureName || !isLikelyProposalSignatureName(normalizedSignatureName)) {
    return content;
  }

  return [
    ...paragraphs.slice(0, closingBlock.startIndex),
    closingBlock.block.signOff,
    normalizedSignatureName,
  ].join("\n\n");
}
