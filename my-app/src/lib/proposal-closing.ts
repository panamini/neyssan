import {
  ENGLISH_SIGNOFFS,
  FRENCH_SIGNOFFS,
} from "../../convex/lib/proposals/proposalRenderer";

export type ProposalClosingBlock = {
  signOff: string | null;
  signatureName: string | null;
};

export type ProposalClosingSource = "settings" | "document" | "legacy";

export type ProposalClosingRef = {
  enabled: boolean;
  signOff: string;
  signatureName: string;
  source: ProposalClosingSource;
  handwrittenSignatureEnabled?: boolean;
};

const PROPOSAL_CLOSING_SOURCE_VALUES = new Set<ProposalClosingSource>([
  "settings",
  "document",
  "legacy",
]);

export type ExtractedProposalClosingBlock = {
  block: ProposalClosingBlock;
  startIndex: number;
};

const SIGNATURE_NAME_PATTERN = /^[\p{L}][\p{L}\s.'’\-]{1,56}$/u;
const CANONICAL_SIGNOFFS = new Set(
  [...Object.values(ENGLISH_SIGNOFFS), ...Object.values(FRENCH_SIGNOFFS)].map(
    normalizeProposalClosingForMatch,
  ),
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

function isFrenchLocale(value: unknown): boolean {
  return typeof value === "string" && /^fr(?:-|$)/i.test(value.trim());
}

function normalizeVoicePresetForSignOff(value: unknown): keyof typeof ENGLISH_SIGNOFFS {
  return typeof value === "string" && value in ENGLISH_SIGNOFFS
    ? (value as keyof typeof ENGLISH_SIGNOFFS)
    : "signature";
}

export function resolveDefaultProposalSignOff(args: {
  locale?: string | null;
  voicePreset?: string | null;
}): string {
  const voicePreset = normalizeVoicePresetForSignOff(args.voicePreset);
  return isFrenchLocale(args.locale)
    ? FRENCH_SIGNOFFS[voicePreset]
    : ENGLISH_SIGNOFFS[voicePreset];
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

  if (sanitized) {
    return {
      ...sanitized,
      signOff:
        sanitized.signOff ||
        legacy?.signOff ||
        resolveDefaultProposalSignOff({
          locale: args.locale,
          voicePreset: args.voicePreset,
        }),
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
    return {
      ...legacy,
      signOff:
        legacy.signOff ||
        resolveDefaultProposalSignOff({
          locale: args.locale,
          voicePreset: args.voicePreset,
        }),
      signatureName: legacy.signatureName || applicantSignatureName,
    };
  }

  if (!defaultEnabled) {
    return null;
  }

  return {
    enabled: true,
    signOff: resolveDefaultProposalSignOff({
      locale: args.locale,
      voicePreset: args.voicePreset,
    }),
    signatureName: applicantSignatureName,
    source: "settings",
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
