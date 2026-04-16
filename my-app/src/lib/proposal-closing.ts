import {
  ENGLISH_SIGNOFFS,
  FRENCH_SIGNOFFS,
} from "../../convex/lib/proposals/proposalRenderer";

export type ProposalClosingBlock = {
  signOff: string | null;
  signatureName: string | null;
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
