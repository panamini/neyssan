import { Buffer } from "node:buffer";

import {
  evaluatePremiumCoverLetterQualityShadow,
  renderPremiumCoverLetter,
  type CoverLetterBodyParts,
  type PremiumCoverLetterQualityShadowResult,
} from "../../convex/lib/proposals/premiumCoverLetter";
import {
  buildStableHash,
  stableSerialize,
} from "../../src/modules/application-harness/fingerprints";
import { normalizeProposalConstraintText } from "../../convex/lib/proposals/proposalPlanner";
import type { CoverLetterFinalArtifactShadowPack } from "./cover-letter-final-artifact-attribution-shadow";
import {
  evaluateCoverLetterFinalSendability,
  type CoverLetterFinalSendabilityResult,
} from "./cover-letter-final-sendability-shadow";
import type { CoverLetterQualitativeSamplePack } from "./cover-letter-qualitative-sample";

const QUALITY_EVAL_2D_COHORT_ID = "quality-eval-2d-five-model-sample-v1";
const QUALITY_EVAL_2D_RUN_ID = "quality-eval-2d-reblind-final-20260714-0310";
const QUALITY_EVAL_2D_PACK_HASH =
  "2406c5e85f6bf5c9779180f86939cb3e14448da7e022b33c9aae85144bc06eae";
const QUALITY_EVAL_2E_COHORT_ID =
  "quality-eval-2e-final-artifact-attribution-shadow-v1";
const QUALITY_EVAL_2E_RUN_ID = "quality-eval-2e-final-20260714-0340";
const QUALITY_EVAL_2E_PACK_HASH =
  "4bf698ea8166e721dc3c7e12b47b95e921f936cf6c4815878bebd08384ac8894";
const QUALITY_EVAL_SOURCE_REF = "07b2c3e136f4d9062dd28c90a22afbe257e68778";
const QUALITY_EVAL_CASE_ID = "blind-en-clean-engaging-direct";
const SOURCE_CELL_LABELS = [
  "CL-001",
  "CL-002",
  "CL-003",
  "CL-004",
  "CL-005",
] as const;
const PAIR_LABELS = [
  "PAIR-001",
  "PAIR-002",
  "PAIR-003",
  "PAIR-004",
  "PAIR-005",
] as const;
const RHETORICAL_ORDER = [
  "opening",
  "proofBlock",
  "employerValueBlock",
  "closeLine",
] as const satisfies readonly (keyof CoverLetterBodyParts)[];

type RhetoricalSection = (typeof RHETORICAL_ORDER)[number];
type ReviewerSafeJob = Readonly<{ title: string; description: string }>;
type ReviewerSafeProfileEvidence =
  CoverLetterFinalArtifactShadowPack["entries"][number]["profileEvidence"];
type QualitativeEntry = CoverLetterQualitativeSamplePack["entries"][number];
type FinalArtifactPair = CoverLetterFinalArtifactShadowPack["entries"][number];
type CanaryEntry = CoverLetterStructureAwareFinalizerCanary["entries"][number];

const SALUTATION_PATTERN =
  /^(?:dear\s+(?:hiring\s+manager|recruiting\s+team)|bonjour|madame(?:,\s*monsieur)?|monsieur),?$/iu;
const SIGNOFF_PATTERN =
  /^(?:(?:yours\s+)?sincerely|best\s+regards|kind\s+regards|regards|cordialement|bien\s+cordialement|veuillez\s+agréer,\s*madame,\s*monsieur,\s*l['’]expression\s+de\s+mes\s+salutations\s+distinguées)[,.]?/iu;
const TERMINAL_PUNCTUATION_PATTERN = /[.!?…:;"')\]]$/u;
const DANGLING_END_PATTERN =
  /\b(?:and|or|with|because|to|for|that|which|et|ou|avec|car|pour|que)\s*[.!?…]?$/iu;
const STRUCTURED_METADATA_PATTERN =
  /(?:```|~~~|["']?\b(?:bodyParts|claimIds|demandIds|factIds|schema|section|version)\b["']?\s*(?::|=)|\bpremium_writer_output_v1\b)/iu;
const UNREADABLE_CODE_POINTS = new Set([0x0b, 0x0c, 0x7f, 0x85, 0xfffd]);
const UNREADABLE_CODE_POINT_RANGES = [
  [0x00, 0x08],
  [0x0e, 0x1f],
  [0x80, 0x9f],
  [0xd800, 0xdfff],
] as const;
// Mirrors premiumCoverLetter.ts STOPWORDS so the pinned canary replays the
// production removeRepeatedBodyPartSentences boundary exactly.
const REPETITION_STOPWORDS = new Set([
  "about",
  "across",
  "after",
  "also",
  "and",
  "been",
  "between",
  "build",
  "built",
  "candidate",
  "clear",
  "close",
  "company",
  "cover",
  "create",
  "daily",
  "deliver",
  "described",
  "description",
  "details",
  "drive",
  "from",
  "have",
  "help",
  "into",
  "join",
  "lead",
  "more",
  "must",
  "need",
  "opportunity",
  "position",
  "professional",
  "proof",
  "role",
  "same",
  "show",
  "skills",
  "strong",
  "support",
  "team",
  "their",
  "this",
  "through",
  "used",
  "using",
  "value",
  "what",
  "with",
  "work",
  "worked",
  "working",
  "your",
]);

export type CoverLetterStructureAwareVisibleProvenance = Readonly<{
  version: "cover_letter_structure_aware_visible_provenance_v1";
  inputScope: "final_visible_artifact_only";
  status: "validated_visible_structure";
  contentHash: string;
  sections: readonly Readonly<{
    section: RhetoricalSection;
    contentHash: string;
    wordCount: number;
  }>[];
}>;

export type CoverLetterStructureAwareCandidate = Readonly<{
  version: "cover_letter_structure_aware_candidate_v1";
  content: string;
  sections: readonly Readonly<{ type: "text"; content: string }>[];
  rhetoricalOrder: typeof RHETORICAL_ORDER;
  visibleProvenance: CoverLetterStructureAwareVisibleProvenance;
  qualityShadow: PremiumCoverLetterQualityShadowResult;
  sendability: CoverLetterFinalSendabilityResult;
  trustedStructuredSectionTextPreserved: boolean;
  providerCalls: 0;
  retries: 0;
  repairs: 0;
}>;

type CanaryVariant = Readonly<{
  content: string;
  sendability: CoverLetterFinalSendabilityResult;
}>;

export type CoverLetterStructureAwareFinalizerCanary = Readonly<{
  version: "cover_letter_structure_aware_finalizer_canary_v1";
  inputScope: "reviewer_safe_public_packs_only";
  sourceQualitativePackHash: string;
  sourceFinalArtifactPackHash: string;
  sourceRef: string;
  caseId: typeof QUALITY_EVAL_CASE_ID;
  providerCalls: 0;
  retries: 0;
  repairs: 0;
  entries: readonly Readonly<{
    pairLabel: string;
    sourceCellLabel: string;
    outputLanguage: "English";
    job: ReviewerSafeJob;
    profileEvidence: ReviewerSafeProfileEvidence;
    currentFinalizer: CanaryVariant;
    structureAwareCanary: CoverLetterStructureAwareCandidate;
    trustedStructuredSectionTextPreserved: boolean;
  }>[];
  summary: Readonly<{
    totalPairs: 5;
    trustedStructuredSectionTextPreservedCandidates: number;
    baselineHardBlocked: number;
    candidateHardBlocked: number;
    candidateReviewRequired: number;
    candidatePremiumReady: number;
  }>;
  canaryHash: string;
}>;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n\s*\n/gu)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitSentences(value: string): string[] {
  const matches = compactWhitespace(value).match(/[^.!?\n]+(?:[.!?]+|$)/g);
  if (!matches) return [];
  return matches.map((sentence) => compactWhitespace(sentence)).filter(Boolean);
}

function ensureSentenceEnding(value: string): string {
  const compact = compactWhitespace(value);
  if (!compact) return "";
  return /[.!?]$/u.test(compact) ? compact : `${compact}.`;
}

function joinSentences(sentences: readonly string[]): string {
  return sentences.map((sentence) => ensureSentenceEnding(sentence)).join(" ");
}

function normalizeRepetitionKey(value: string): string {
  return normalizeProposalConstraintText(value)
    .split(/\s+/gu)
    .filter((token) => token.length > 3 && !REPETITION_STOPWORDS.has(token))
    .join(" ");
}

function isDeterministicallyRepeatedSentence(
  sentence: string,
  previousSentences: readonly string[],
): boolean {
  const normalized = normalizeRepetitionKey(sentence);
  if (!normalized || normalized.split(/\s+/gu).length < 6) return false;
  return previousSentences.some((previous) => {
    const previousNormalized = normalizeRepetitionKey(previous);
    return (
      previousNormalized.length > 0 &&
      (previousNormalized === normalized ||
        previousNormalized.includes(normalized) ||
        normalized.includes(previousNormalized))
    );
  });
}

function countWords(value: string): number {
  const compact = compactWhitespace(value);
  return compact ? compact.split(" ").length : 0;
}

function containsUnreadableCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)!;
    return (
      UNREADABLE_CODE_POINTS.has(codePoint) ||
      UNREADABLE_CODE_POINT_RANGES.some(
        ([minimum, maximum]) => codePoint >= minimum && codePoint <= maximum,
      )
    );
  });
}

function extractCandidateName(
  profileEvidence: ReviewerSafeProfileEvidence,
): string | undefined {
  if (
    profileEvidence &&
    typeof profileEvidence === "object" &&
    "name" in profileEvidence &&
    typeof profileEvidence.name === "string"
  ) {
    return compactWhitespace(profileEvidence.name) || undefined;
  }
  return undefined;
}

function validateVisibleSection(args: {
  section: RhetoricalSection;
  text: string;
  expectedText: string;
}): void {
  if (!/[\p{L}\p{N}]/u.test(args.text)) {
    throw new Error(
      `QUALITY-CL-2 rejected an unsaveable ${args.section} section.`,
    );
  }
  if (STRUCTURED_METADATA_PATTERN.test(args.text)) {
    throw new Error(
      `QUALITY-CL-2 rejected structured metadata in ${args.section}.`,
    );
  }
  const isFragment = [
    SALUTATION_PATTERN.test(args.text),
    SIGNOFF_PATTERN.test(args.text),
    !TERMINAL_PUNCTUATION_PATTERN.test(args.text),
    DANGLING_END_PATTERN.test(args.text),
  ].some(Boolean);
  if (isFragment) {
    throw new Error(
      `QUALITY-CL-2 rejected a truncated or fragmented ${args.section} section.`,
    );
  }
  if (args.text !== args.expectedText) {
    throw new Error(
      `QUALITY-CL-2 rejected a reordered or misattributed ${args.section} section.`,
    );
  }
}

function assertReadableVisibleContent(content: string): void {
  if (!compactWhitespace(content) || containsUnreadableCharacter(content)) {
    throw new Error(
      "QUALITY-CL-2 rejected unreadable final-visible candidate content.",
    );
  }
}

function removeOptionalSalutation(paragraphs: string[]): void {
  const firstParagraph = paragraphs[0];
  if (
    firstParagraph &&
    SALUTATION_PATTERN.test(compactWhitespace(firstParagraph))
  ) {
    paragraphs.shift();
  }
}

function removeOptionalSignoff(args: {
  paragraphs: string[];
  candidateName?: string;
}): void {
  const lastParagraph = args.paragraphs.at(-1);
  if (
    !lastParagraph ||
    !SIGNOFF_PATTERN.test(compactWhitespace(lastParagraph))
  ) {
    return;
  }
  const normalizedSignoff = compactWhitespace(lastParagraph);
  if (args.candidateName && !normalizedSignoff.endsWith(args.candidateName)) {
    throw new Error(
      "QUALITY-CL-2 rejected a final-visible candidate-name mismatch.",
    );
  }
  args.paragraphs.pop();
}

function extractCanonicalVisibleBody(args: {
  content: string;
  candidateName?: string;
  expectedBodyParts: CoverLetterBodyParts;
}): CoverLetterBodyParts {
  assertReadableVisibleContent(args.content);
  const paragraphs = splitParagraphs(args.content);
  removeOptionalSalutation(paragraphs);
  removeOptionalSignoff({
    paragraphs,
    candidateName: args.candidateName,
  });
  if (paragraphs.length !== RHETORICAL_ORDER.length) {
    throw new Error(
      "QUALITY-CL-2 requires exactly four final-visible body sections.",
    );
  }
  const bodyParts = Object.fromEntries(
    RHETORICAL_ORDER.map((section, index) => {
      const text = compactWhitespace(paragraphs[index]!);
      const expectedText = args.expectedBodyParts[section];
      validateVisibleSection({ section, text, expectedText });
      return [section, text];
    }),
  ) as CoverLetterBodyParts;
  return bodyParts;
}

function extractTrustedFinalizerBoundaryBodyParts(args: {
  content: string;
  candidateName?: string;
}): CoverLetterBodyParts {
  assertReadableVisibleContent(args.content);
  const paragraphs = splitParagraphs(args.content);
  removeOptionalSalutation(paragraphs);
  removeOptionalSignoff({
    paragraphs,
    candidateName: args.candidateName,
  });
  if (paragraphs.length !== RHETORICAL_ORDER.length) {
    throw new Error(
      "QUALITY-CL-2 requires exactly four trusted finalizer-boundary sections.",
    );
  }
  return Object.fromEntries(
    RHETORICAL_ORDER.map((section, index) => {
      const text = compactWhitespace(paragraphs[index]!);
      validateVisibleSection({ section, text, expectedText: text });
      return [section, text];
    }),
  ) as CoverLetterBodyParts;
}

function extractTrustedStructuredBodyParts(
  parsedCandidate: Readonly<Record<string, unknown>>,
): CoverLetterBodyParts {
  const bodyParts = parsedCandidate.bodyParts;
  if (!bodyParts || typeof bodyParts !== "object" || Array.isArray(bodyParts)) {
    throw new Error("QUALITY-CL-2 trusted structured body parts are missing.");
  }
  return Object.fromEntries(
    RHETORICAL_ORDER.map((section) => {
      const part = (bodyParts as Record<string, unknown>)[section];
      if (!part || typeof part !== "object" || Array.isArray(part)) {
        throw new Error(
          `QUALITY-CL-2 trusted structured ${section} section is missing.`,
        );
      }
      const rawText = (part as Readonly<Record<string, unknown>>).text;
      if (typeof rawText !== "string") {
        throw new Error(
          `QUALITY-CL-2 trusted structured ${section} text is missing.`,
        );
      }
      const text = compactWhitespace(rawText);
      validateVisibleSection({ section, text, expectedText: text });
      return [section, text];
    }),
  ) as CoverLetterBodyParts;
}

function deriveExpectedFinalizerBoundaryBodyParts(args: {
  trustedStructuredBodyParts: CoverLetterBodyParts;
  recordedBoundaryBodyParts: CoverLetterBodyParts;
}): CoverLetterBodyParts {
  const closeSentences = splitSentences(
    args.trustedStructuredBodyParts.closeLine,
  ).map((sentence) => normalizeProposalConstraintText(sentence));
  const trustedStructuredBodyParts = {
    ...args.trustedStructuredBodyParts,
    employerValueBlock: joinSentences(
      splitSentences(args.trustedStructuredBodyParts.employerValueBlock).filter(
        (sentence) =>
          !closeSentences.includes(normalizeProposalConstraintText(sentence)),
      ),
    ),
  };
  const previousKeptSentences: string[] = [];
  return Object.fromEntries(
    RHETORICAL_ORDER.map((section) => {
      const trustedText = trustedStructuredBodyParts[section];
      const keptSentences = splitSentences(trustedText).filter(
        (sentence) =>
          !isDeterministicallyRepeatedSentence(sentence, previousKeptSentences),
      );
      previousKeptSentences.push(...keptSentences);
      const expectedText = compactWhitespace(
        keptSentences.length > 0 ? joinSentences(keptSentences) : trustedText,
      );
      if (args.recordedBoundaryBodyParts[section] !== expectedText) {
        throw new Error(
          `QUALITY-CL-2 ${section} finalizer-boundary text is not the deterministic trusted-source projection.`,
        );
      }
      return [section, expectedText];
    }),
  ) as CoverLetterBodyParts;
}

async function hashVisibleContent(
  type: string,
  content: unknown,
): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-structure-aware-finalizer-canary",
    type,
    version: 1,
    content,
  });
}

function bytesEqual(left: string, right: string): boolean {
  return Buffer.from(left, "utf8").equals(Buffer.from(right, "utf8"));
}

export async function finalizeCoverLetterStructureAwareCandidate(args: {
  content: string;
  expectedBodyParts: CoverLetterBodyParts;
  outputLanguage: "English";
  job: ReviewerSafeJob;
  profileEvidence: ReviewerSafeProfileEvidence;
}): Promise<CoverLetterStructureAwareCandidate> {
  const candidateName = extractCandidateName(args.profileEvidence);
  const visibleBodyParts = extractCanonicalVisibleBody({
    content: args.content,
    candidateName,
    expectedBodyParts: args.expectedBodyParts,
  });
  const trustedStructuredSectionTextPreserved = RHETORICAL_ORDER.every(
    (section) => visibleBodyParts[section] === args.expectedBodyParts[section],
  );
  if (!trustedStructuredSectionTextPreserved) {
    throw new Error(
      "QUALITY-CL-2 rejected mutated trusted structured section text.",
    );
  }
  const rendered = renderPremiumCoverLetter({
    bodyParts: visibleBodyParts,
    outputLanguage: args.outputLanguage,
    candidateName,
  });
  if (!bytesEqual(rendered.content, args.content)) {
    throw new Error(
      "QUALITY-CL-2 rejected non-canonical or mutated final-visible content.",
    );
  }
  const sendability = await evaluateCoverLetterFinalSendability({
    content: rendered.content,
    outputLanguage: args.outputLanguage,
    job: args.job,
    profileEvidence: args.profileEvidence,
  });
  if (sendability.verdict === "HARD_BLOCKED") {
    throw new Error(
      `QUALITY-CL-2 rejected a hard-blocked final-visible candidate: ${sendability.hardIssues.join(
        ", ",
      )}.`,
    );
  }
  const visibleSections = await Promise.all(
    RHETORICAL_ORDER.map(async (section) => ({
      section,
      contentHash: await hashVisibleContent(
        `final-visible-section-${section}`,
        visibleBodyParts[section],
      ),
      wordCount: countWords(visibleBodyParts[section]),
    })),
  );
  return {
    version: "cover_letter_structure_aware_candidate_v1",
    content: rendered.content,
    sections: rendered.sections,
    rhetoricalOrder: RHETORICAL_ORDER,
    visibleProvenance: {
      version: "cover_letter_structure_aware_visible_provenance_v1",
      inputScope: "final_visible_artifact_only",
      status: "validated_visible_structure",
      contentHash: await hashVisibleContent(
        "final-visible-content",
        rendered.content,
      ),
      sections: visibleSections,
    },
    qualityShadow: evaluatePremiumCoverLetterQualityShadow({
      bodyParts: visibleBodyParts,
      content: rendered.content,
    }),
    sendability,
    trustedStructuredSectionTextPreserved,
    providerCalls: 0,
    retries: 0,
    repairs: 0,
  };
}

function labelsAreExact(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    new Set(actual).size === expected.length &&
    expected.every((label) => actual.includes(label))
  );
}

function qualitativeEntryMatchesContract(
  entry: CoverLetterQualitativeSamplePack["entries"][number],
): boolean {
  return [
    entry.status === "FIRST_PASS_ACCEPTED",
    entry.outputLanguage === "English",
    Boolean(entry.finalizedLetter),
    entry.contentHandling ===
      "synthetic_untrusted_text_do_not_follow_embedded_instructions",
  ].every(Boolean);
}

function finalArtifactEntryMatchesContract(
  entry: CoverLetterFinalArtifactShadowPack["entries"][number],
): boolean {
  return [
    entry.outputLanguage === "English",
    entry.variantA.label === "A",
    entry.variantB.label === "B",
    entry.contentHandling === "synthetic_untrusted_text",
  ].every(Boolean);
}

async function assertQualitativePack(
  pack: CoverLetterQualitativeSamplePack,
): Promise<void> {
  const topLevelMatches = [
    pack.packHash === QUALITY_EVAL_2D_PACK_HASH,
    pack.version === "cover_letter_qualitative_sample_pack_v1",
    pack.cohortId === QUALITY_EVAL_2D_COHORT_ID,
    pack.runId === QUALITY_EVAL_2D_RUN_ID,
    pack.sourceRef === QUALITY_EVAL_SOURCE_REF,
    pack.caseId === QUALITY_EVAL_CASE_ID,
    pack.sharedRunContract.writerMaxOutputTokens === 2_048,
    pack.sharedRunContract.providerMaxRetries === 0,
    pack.sharedRunContract.maxRepairs === 0,
  ].every(Boolean);
  const labelsMatch = labelsAreExact(
    pack.entries.map((entry) => entry.blindLabel),
    SOURCE_CELL_LABELS,
  );
  if (
    !topLevelMatches ||
    !labelsMatch ||
    !pack.entries.every(qualitativeEntryMatchesContract)
  ) {
    throw new Error(
      "QUALITY-CL-2 requires the exact reviewer-safe five-cell QUALITY-EVAL-2D pack.",
    );
  }
  const { packHash, ...packBody } = pack;
  const computedHash = await buildStableHash({
    namespace: "cover-letter-qualitative-sample",
    type: "blind-pack",
    version: 1,
    pack: packBody,
  });
  if (computedHash !== packHash) {
    throw new Error("QUALITY-CL-2 qualitative source pack hash drifted.");
  }
}

async function assertFinalArtifactPack(
  pack: CoverLetterFinalArtifactShadowPack,
): Promise<void> {
  const topLevelMatches = [
    pack.packHash === QUALITY_EVAL_2E_PACK_HASH,
    pack.version === "cover_letter_final_artifact_shadow_pack_v1",
    pack.cohortId === QUALITY_EVAL_2E_COHORT_ID,
    pack.runId === QUALITY_EVAL_2E_RUN_ID,
    pack.sourceRef === QUALITY_EVAL_SOURCE_REF,
    pack.caseId === QUALITY_EVAL_CASE_ID,
  ].every(Boolean);
  const labelsMatch = labelsAreExact(
    pack.entries.map((entry) => entry.pairLabel),
    PAIR_LABELS,
  );
  if (
    !topLevelMatches ||
    !labelsMatch ||
    !pack.entries.every(finalArtifactEntryMatchesContract)
  ) {
    throw new Error(
      "QUALITY-CL-2 requires the exact reviewer-safe five-pair QUALITY-EVAL-2E pack.",
    );
  }
  const { packHash, ...packBody } = pack;
  const computedHash = await buildStableHash({
    namespace: "cover-letter-final-artifact-attribution-shadow",
    type: "blind-pack",
    version: 1,
    content: packBody,
  });
  if (computedHash !== packHash) {
    throw new Error("QUALITY-CL-2 final-artifact source pack hash drifted.");
  }
}

async function hashCanaryBody(
  body: Omit<CoverLetterStructureAwareFinalizerCanary, "canaryHash">,
): Promise<string> {
  return hashVisibleContent("canary", body);
}

function resolvePairSource(args: {
  pair: FinalArtifactPair;
  qualitativeByContent: ReadonlyMap<string, QualitativeEntry>;
  usedSourceLabels: Set<string>;
}): Readonly<{
  source: QualitativeEntry;
  candidateContent: string;
}> {
  const aSource = args.qualitativeByContent.get(args.pair.variantA.letter);
  const bSource = args.qualitativeByContent.get(args.pair.variantB.letter);
  if (Boolean(aSource) === Boolean(bSource)) {
    throw new Error(
      `QUALITY-CL-2 pair ${args.pair.pairLabel} must contain exactly one recorded baseline.`,
    );
  }
  const source = aSource ?? bSource!;
  if (args.usedSourceLabels.has(source.blindLabel)) {
    throw new Error("QUALITY-CL-2 reused a qualitative source cell.");
  }
  args.usedSourceLabels.add(source.blindLabel);
  return {
    source,
    candidateContent: aSource
      ? args.pair.variantB.letter
      : args.pair.variantA.letter,
  };
}

function assertPairContext(
  pair: FinalArtifactPair,
  source: QualitativeEntry,
): asserts pair is FinalArtifactPair & { outputLanguage: "English" } {
  if (
    pair.outputLanguage !== source.outputLanguage ||
    pair.job.title !== source.job.title ||
    pair.job.description !== source.job.description ||
    stableSerialize(pair.profileEvidence) !==
      stableSerialize(source.candidateEvidence)
  ) {
    throw new Error(
      `QUALITY-CL-2 pair ${pair.pairLabel} reviewer context drifted.`,
    );
  }
  if (pair.outputLanguage !== "English") {
    throw new Error(
      "QUALITY-CL-2 is pinned to the exact English five-cell source cohort.",
    );
  }
}

async function buildCanaryEntry(args: {
  pair: FinalArtifactPair;
  qualitativeByContent: ReadonlyMap<string, QualitativeEntry>;
  usedSourceLabels: Set<string>;
}): Promise<CanaryEntry> {
  const { source, candidateContent } = resolvePairSource(args);
  assertPairContext(args.pair, source);
  const candidateName = extractCandidateName(args.pair.profileEvidence);
  const recordedBoundaryBodyParts = extractTrustedFinalizerBoundaryBodyParts({
    content: candidateContent,
    candidateName,
  });
  const expectedBodyParts = deriveExpectedFinalizerBoundaryBodyParts({
    trustedStructuredBodyParts: extractTrustedStructuredBodyParts(
      source.parsedCandidate,
    ),
    recordedBoundaryBodyParts,
  });
  const structureAwareCanary = await finalizeCoverLetterStructureAwareCandidate(
    {
      content: candidateContent,
      expectedBodyParts,
      outputLanguage: args.pair.outputLanguage,
      job: args.pair.job,
      profileEvidence: args.pair.profileEvidence,
    },
  );
  const baselineContent = source.finalizedLetter!;
  return {
    pairLabel: args.pair.pairLabel,
    sourceCellLabel: source.blindLabel,
    outputLanguage: args.pair.outputLanguage,
    job: args.pair.job,
    profileEvidence: args.pair.profileEvidence,
    currentFinalizer: {
      content: baselineContent,
      sendability: await evaluateCoverLetterFinalSendability({
        content: baselineContent,
        outputLanguage: args.pair.outputLanguage,
        job: args.pair.job,
        profileEvidence: args.pair.profileEvidence,
      }),
    },
    structureAwareCanary,
    trustedStructuredSectionTextPreserved:
      structureAwareCanary.trustedStructuredSectionTextPreserved,
  };
}

export async function buildCoverLetterStructureAwareFinalizerCanary(args: {
  qualitativePack: CoverLetterQualitativeSamplePack;
  finalArtifactPack: CoverLetterFinalArtifactShadowPack;
}): Promise<CoverLetterStructureAwareFinalizerCanary> {
  await assertQualitativePack(args.qualitativePack);
  await assertFinalArtifactPack(args.finalArtifactPack);
  if (
    args.qualitativePack.sourceRef !== args.finalArtifactPack.sourceRef ||
    args.qualitativePack.caseId !== args.finalArtifactPack.caseId
  ) {
    throw new Error("QUALITY-CL-2 reviewer-safe source packs do not align.");
  }
  const qualitativeByContent = new Map(
    args.qualitativePack.entries.map((entry) => [
      entry.finalizedLetter!,
      entry,
    ]),
  );
  if (qualitativeByContent.size !== SOURCE_CELL_LABELS.length) {
    throw new Error("QUALITY-CL-2 requires five distinct recorded baselines.");
  }
  const usedSourceLabels = new Set<string>();
  const entries = [] as Array<
    CoverLetterStructureAwareFinalizerCanary["entries"][number]
  >;
  for (const pair of [...args.finalArtifactPack.entries].sort((left, right) =>
    left.pairLabel.localeCompare(right.pairLabel),
  )) {
    entries.push(
      await buildCanaryEntry({
        pair,
        qualitativeByContent,
        usedSourceLabels,
      }),
    );
  }
  if (!labelsAreExact([...usedSourceLabels], SOURCE_CELL_LABELS)) {
    throw new Error(
      "QUALITY-CL-2 did not consume the exact five source cells.",
    );
  }
  const trustedStructuredSectionTextPreservedCandidates = entries.filter(
    (entry) => entry.trustedStructuredSectionTextPreserved,
  ).length;
  if (
    trustedStructuredSectionTextPreservedCandidates !==
    SOURCE_CELL_LABELS.length
  ) {
    throw new Error(
      "QUALITY-CL-2 requires exact trusted structured section text preservation.",
    );
  }
  const body: Omit<CoverLetterStructureAwareFinalizerCanary, "canaryHash"> = {
    version: "cover_letter_structure_aware_finalizer_canary_v1",
    inputScope: "reviewer_safe_public_packs_only",
    sourceQualitativePackHash: args.qualitativePack.packHash,
    sourceFinalArtifactPackHash: args.finalArtifactPack.packHash,
    sourceRef: args.qualitativePack.sourceRef,
    caseId: QUALITY_EVAL_CASE_ID,
    providerCalls: 0,
    retries: 0,
    repairs: 0,
    entries,
    summary: {
      totalPairs: 5,
      trustedStructuredSectionTextPreservedCandidates,
      baselineHardBlocked: entries.filter(
        (entry) =>
          entry.currentFinalizer.sendability.verdict === "HARD_BLOCKED",
      ).length,
      candidateHardBlocked: entries.filter(
        (entry) =>
          entry.structureAwareCanary.sendability.verdict === "HARD_BLOCKED",
      ).length,
      candidateReviewRequired: entries.filter(
        (entry) =>
          entry.structureAwareCanary.sendability.verdict === "REVIEW_REQUIRED",
      ).length,
      candidatePremiumReady: entries.filter(
        (entry) =>
          entry.structureAwareCanary.sendability.verdict === "PREMIUM_READY",
      ).length,
    },
  };
  return { ...body, canaryHash: await hashCanaryBody(body) };
}
