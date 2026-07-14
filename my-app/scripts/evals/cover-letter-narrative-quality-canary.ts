import type { CoverLetterBodyParts } from "../../convex/lib/proposals/premiumCoverLetter";
import { buildStableHash } from "../../src/modules/application-harness/fingerprints";
import type { CoverLetterStructureAwareFinalizerCanary } from "./cover-letter-structure-aware-finalizer-canary";

const QUALITY_CL3_QUALITATIVE_PACK_HASH =
  "2406c5e85f6bf5c9779180f86939cb3e14448da7e022b33c9aae85144bc06eae";
const QUALITY_CL3_FINAL_ARTIFACT_PACK_HASH =
  "4bf698ea8166e721dc3c7e12b47b95e921f936cf6c4815878bebd08384ac8894";
const QUALITY_CL3_SOURCE_REF = "07b2c3e136f4d9062dd28c90a22afbe257e68778";
const QUALITY_CL3_DEVELOPMENT_CASE_ID =
  "blind-en-clean-engaging-direct" as const;

export const QUALITY_CL3_SOURCE_CANARY_HASH =
  "d6cdf2fb9c5aca9cc5fa391b3e602e0f753f4461aa79b009882ff1af3c99bef2";

const NARRATIVE_ISSUE_ORDER = [
  "proof_led_opening",
  "cross_section_evidence_repetition",
  "formulaic_employer_transition",
  "redundant_close",
] as const;

export type CoverLetterNarrativeQualityIssue =
  (typeof NARRATIVE_ISSUE_ORDER)[number];

export type CoverLetterNarrativeQualityResult = Readonly<{
  version: "cover_letter_narrative_quality_result_v1";
  inputScope: "trusted_four_section_body_parts_only";
  issues: readonly CoverLetterNarrativeQualityIssue[];
  diagnostics: Readonly<{
    repeatedEvidenceMarkerCount: number;
    closeSharedContentTokenCount: number;
  }>;
}>;

export type CoverLetterNarrativeQualityCanary = Readonly<{
  version: "cover_letter_narrative_quality_canary_v1";
  inputScope: "exact_quality_cl2_final_visible_candidates_only";
  sourceCanaryHash: typeof QUALITY_CL3_SOURCE_CANARY_HASH;
  sourceQualitativePackHash: typeof QUALITY_CL3_QUALITATIVE_PACK_HASH;
  sourceFinalArtifactPackHash: typeof QUALITY_CL3_FINAL_ARTIFACT_PACK_HASH;
  sourceRef: typeof QUALITY_CL3_SOURCE_REF;
  caseId: typeof QUALITY_CL3_DEVELOPMENT_CASE_ID;
  providerCalls: 0;
  retries: 0;
  repairs: 0;
  entries: readonly Readonly<{
    pairLabel: string;
    sourceCellLabel: string;
    candidateContentHash: string;
    trustedStructuredSectionTextPreserved: true;
    cl1HardBlocked: false;
    narrativeQuality: CoverLetterNarrativeQualityResult;
  }>[];
  summary: Readonly<{
    totalCandidates: 5;
    trustedStructuredSectionTextPreservedCandidates: 5;
    hardBlockedCandidates: 0;
    candidatesWithNarrativeIssues: number;
    issueCounts: Readonly<Record<CoverLetterNarrativeQualityIssue, number>>;
    nextStep: "RUN_HELD_OUT_HUMAN_REVIEW_BEFORE_PRODUCTION";
  }>;
  canaryHash: string;
}>;

const PROOF_LED_OPENING_PATTERN =
  /^(?:i\s+)?(?:achieved|built|created|delivered|developed|grew|implemented|improved|increased|led|managed|reduced)\b/iu;
const FORMULAIC_EMPLOYER_TRANSITION_PATTERN =
  /^(?:(?:this|that)\s+(?:background|combination|discipline|experience|reporting|work|approach)\b|for\s+(?:a|the|your)\s+(?:company|employer|organization|role|team)\b)/iu;
const NUMERIC_EVIDENCE_PATTERN =
  /(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?(?:%|\+)?(?![\p{L}\p{N}])/gu;
const SALUTATION_PATTERN =
  /^(?:dear\s+(?:hiring\s+manager|recruiting\s+team)|bonjour|madame|monsieur),?/iu;
const SIGNOFF_PATTERN =
  /^(?:(?:yours\s+)?sincerely|best\s+regards|kind\s+regards|regards|cordialement|bien\s+cordialement),?/iu;

const CONTENT_STOP_WORDS = new Set([
  "about",
  "again",
  "also",
  "and",
  "bring",
  "company",
  "could",
  "from",
  "have",
  "help",
  "into",
  "next",
  "role",
  "that",
  "the",
  "their",
  "this",
  "through",
  "team",
  "want",
  "will",
  "with",
  "would",
  "your",
]);

function compactWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function normalizeEvidenceMarker(value: string): string {
  return value.replace(",", ".").toLowerCase();
}

function extractEvidenceMarkers(value: string): Set<string> {
  return new Set(
    [...value.matchAll(NUMERIC_EVIDENCE_PATTERN)].map((match) =>
      normalizeEvidenceMarker(match[0]!),
    ),
  );
}

function countRepeatedEvidenceMarkers(bodyParts: CoverLetterBodyParts): number {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const section of [
    bodyParts.opening,
    bodyParts.proofBlock,
    bodyParts.employerValueBlock,
    bodyParts.closeLine,
  ]) {
    for (const marker of extractEvidenceMarkers(section)) {
      if (seen.has(marker)) repeated.add(marker);
      seen.add(marker);
    }
  }
  return repeated.size;
}

function stemContentToken(value: string): string {
  if (value.endsWith("ement") && value.length > 8) return value.slice(0, -5);
  if (value.endsWith("ing") && value.length > 7) return value.slice(0, -3);
  if (value.endsWith("s") && value.length > 5) return value.slice(0, -1);
  return value;
}

function extractContentTokens(value: string): Set<string> {
  const normalized = value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return new Set(
    (normalized.match(/[\p{L}]{4,}/gu) ?? [])
      .filter((token) => !CONTENT_STOP_WORDS.has(token))
      .map(stemContentToken),
  );
}

function countCloseSharedContentTokens(
  bodyParts: CoverLetterBodyParts,
): number {
  const priorTokens = extractContentTokens(
    [
      bodyParts.opening,
      bodyParts.proofBlock,
      bodyParts.employerValueBlock,
    ].join(" "),
  );
  return [...extractContentTokens(bodyParts.closeLine)].filter((token) =>
    priorTokens.has(token),
  ).length;
}

function hasRedundantClose(args: {
  bodyParts: CoverLetterBodyParts;
  sharedContentTokenCount: number;
}): boolean {
  const closeTokenCount = extractContentTokens(args.bodyParts.closeLine).size;
  const closeEvidenceRepeats = [
    ...extractEvidenceMarkers(args.bodyParts.closeLine),
  ].some((marker) =>
    extractEvidenceMarkers(
      [
        args.bodyParts.opening,
        args.bodyParts.proofBlock,
        args.bodyParts.employerValueBlock,
      ].join(" "),
    ).has(marker),
  );
  return (
    closeEvidenceRepeats ||
    (args.sharedContentTokenCount >= 3 &&
      closeTokenCount > 0 &&
      args.sharedContentTokenCount / closeTokenCount >= 0.5)
  );
}

export function evaluateCoverLetterNarrativeQuality(
  bodyParts: CoverLetterBodyParts,
): CoverLetterNarrativeQualityResult {
  const repeatedEvidenceMarkerCount = countRepeatedEvidenceMarkers(bodyParts);
  const closeSharedContentTokenCount = countCloseSharedContentTokens(bodyParts);
  const issues: CoverLetterNarrativeQualityIssue[] = [];

  if (PROOF_LED_OPENING_PATTERN.test(compactWhitespace(bodyParts.opening))) {
    issues.push("proof_led_opening");
  }
  if (repeatedEvidenceMarkerCount > 0) {
    issues.push("cross_section_evidence_repetition");
  }
  if (
    FORMULAIC_EMPLOYER_TRANSITION_PATTERN.test(
      compactWhitespace(bodyParts.employerValueBlock),
    )
  ) {
    issues.push("formulaic_employer_transition");
  }
  if (
    hasRedundantClose({
      bodyParts,
      sharedContentTokenCount: closeSharedContentTokenCount,
    })
  ) {
    issues.push("redundant_close");
  }

  return {
    version: "cover_letter_narrative_quality_result_v1",
    inputScope: "trusted_four_section_body_parts_only",
    issues,
    diagnostics: {
      repeatedEvidenceMarkerCount,
      closeSharedContentTokenCount,
    },
  };
}

function extractFinalVisibleBodyParts(content: string): CoverLetterBodyParts {
  const paragraphs = content
    .split(/\n\s*\n/gu)
    .map(compactWhitespace)
    .filter(Boolean);
  if (paragraphs[0] && SALUTATION_PATTERN.test(paragraphs[0])) {
    paragraphs.shift();
  }
  if (paragraphs.at(-1) && SIGNOFF_PATTERN.test(paragraphs.at(-1)!)) {
    paragraphs.pop();
  }
  if (paragraphs.length !== 4) {
    throw new Error(
      "QUALITY-CL-3 requires exactly four CL2 final-visible body sections.",
    );
  }
  return {
    opening: paragraphs[0]!,
    proofBlock: paragraphs[1]!,
    employerValueBlock: paragraphs[2]!,
    closeLine: paragraphs[3]!,
  };
}

async function assertExactCl2Source(
  sourceCanary: CoverLetterStructureAwareFinalizerCanary,
): Promise<void> {
  const { canaryHash, ...canaryBody } = sourceCanary;
  const computedCanaryHash = await buildStableHash({
    namespace: "cover-letter-structure-aware-finalizer-canary",
    type: "canary",
    version: 1,
    content: canaryBody,
  });
  const exactTopLevel = [
    sourceCanary.version === "cover_letter_structure_aware_finalizer_canary_v1",
    canaryHash === QUALITY_CL3_SOURCE_CANARY_HASH,
    computedCanaryHash === canaryHash,
    sourceCanary.sourceQualitativePackHash ===
      QUALITY_CL3_QUALITATIVE_PACK_HASH,
    sourceCanary.sourceFinalArtifactPackHash ===
      QUALITY_CL3_FINAL_ARTIFACT_PACK_HASH,
    sourceCanary.sourceRef === QUALITY_CL3_SOURCE_REF,
    sourceCanary.caseId === QUALITY_CL3_DEVELOPMENT_CASE_ID,
    sourceCanary.providerCalls === 0,
    sourceCanary.retries === 0,
    sourceCanary.repairs === 0,
    sourceCanary.entries.length === 5,
  ].every(Boolean);
  const exactCandidates = sourceCanary.entries.every(
    (entry) =>
      entry.trustedStructuredSectionTextPreserved &&
      entry.structureAwareCanary.trustedStructuredSectionTextPreserved &&
      entry.structureAwareCanary.sendability.verdict !== "HARD_BLOCKED" &&
      entry.structureAwareCanary.sendability.hardIssues.length === 0 &&
      entry.structureAwareCanary.providerCalls === 0 &&
      entry.structureAwareCanary.retries === 0 &&
      entry.structureAwareCanary.repairs === 0,
  );
  if (!exactTopLevel || !exactCandidates) {
    throw new Error(
      "QUALITY-CL-3 requires the exact frozen CL2 canary with all CL1/CL2 safety invariants preserved.",
    );
  }
}

async function hashCandidateContent(content: string): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-narrative-quality-canary",
    type: "candidate-content",
    version: 1,
    content,
  });
}

async function hashCanaryBody(
  body: Omit<CoverLetterNarrativeQualityCanary, "canaryHash">,
): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-narrative-quality-canary",
    type: "canary",
    version: 1,
    body,
  });
}

export async function buildCoverLetterNarrativeQualityCanary(args: {
  sourceCanary: CoverLetterStructureAwareFinalizerCanary;
}): Promise<CoverLetterNarrativeQualityCanary> {
  await assertExactCl2Source(args.sourceCanary);
  const entries = await Promise.all(
    args.sourceCanary.entries.map(async (entry) => ({
      pairLabel: entry.pairLabel,
      sourceCellLabel: entry.sourceCellLabel,
      candidateContentHash: await hashCandidateContent(
        entry.structureAwareCanary.content,
      ),
      trustedStructuredSectionTextPreserved: true as const,
      cl1HardBlocked: false as const,
      narrativeQuality: evaluateCoverLetterNarrativeQuality(
        extractFinalVisibleBodyParts(entry.structureAwareCanary.content),
      ),
    })),
  );
  const issueCounts = Object.fromEntries(
    NARRATIVE_ISSUE_ORDER.map((issue) => [
      issue,
      entries.filter((entry) => entry.narrativeQuality.issues.includes(issue))
        .length,
    ]),
  ) as Record<CoverLetterNarrativeQualityIssue, number>;
  const body: Omit<CoverLetterNarrativeQualityCanary, "canaryHash"> = {
    version: "cover_letter_narrative_quality_canary_v1",
    inputScope: "exact_quality_cl2_final_visible_candidates_only",
    sourceCanaryHash: QUALITY_CL3_SOURCE_CANARY_HASH,
    sourceQualitativePackHash: QUALITY_CL3_QUALITATIVE_PACK_HASH,
    sourceFinalArtifactPackHash: QUALITY_CL3_FINAL_ARTIFACT_PACK_HASH,
    sourceRef: QUALITY_CL3_SOURCE_REF,
    caseId: QUALITY_CL3_DEVELOPMENT_CASE_ID,
    providerCalls: 0,
    retries: 0,
    repairs: 0,
    entries,
    summary: {
      totalCandidates: 5,
      trustedStructuredSectionTextPreservedCandidates: 5,
      hardBlockedCandidates: 0,
      candidatesWithNarrativeIssues: entries.filter(
        (entry) => entry.narrativeQuality.issues.length > 0,
      ).length,
      issueCounts,
      nextStep: "RUN_HELD_OUT_HUMAN_REVIEW_BEFORE_PRODUCTION",
    },
  };
  return { ...body, canaryHash: await hashCanaryBody(body) };
}
