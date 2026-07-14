import { buildStableHash } from "../../src/modules/application-harness/fingerprints";
import {
  getDeterministicCopyLanguage,
  resolveProposalOutputLanguage,
} from "../../convex/lib/proposals/proposalOutput";
import type { CoverLetterFinalArtifactShadowPack } from "./cover-letter-final-artifact-attribution-shadow";

const QUALITY_EVAL_2E_COHORT_ID =
  "quality-eval-2e-final-artifact-attribution-shadow-v1";
const QUALITY_EVAL_2D_CASE_ID = "blind-en-clean-engaging-direct";
const QUALITY_EVAL_2E_PAIR_LABELS = [
  "PAIR-001",
  "PAIR-002",
  "PAIR-003",
  "PAIR-004",
  "PAIR-005",
] as const;

const HARD_ISSUE_ORDER = [
  "unreadable_export",
  "wrong_language",
  "truncated_or_fragmented",
  "visible_structure_loss_signature",
  "unsupported_specificity",
] as const;

const REVIEW_ISSUE_ORDER = [
  "abrupt_opening",
  "cv_inventory",
  "employer_context_missing",
  "generic_closing",
  "length_out_of_range",
  "choppy_or_generic_tone",
] as const;

export type CoverLetterFinalSendabilityVerdict =
  | "HARD_BLOCKED"
  | "REVIEW_REQUIRED"
  | "PREMIUM_READY";

export type CoverLetterFinalSendabilityHardIssue =
  (typeof HARD_ISSUE_ORDER)[number];

export type CoverLetterFinalSendabilityReviewIssue =
  (typeof REVIEW_ISSUE_ORDER)[number];

type ReviewerSafeJob = Readonly<{
  title: string;
  description: string;
}>;

type ReviewerSafeProfileEvidence =
  CoverLetterFinalArtifactShadowPack["entries"][number]["profileEvidence"];

export type CoverLetterFinalSendabilityResult = Readonly<{
  version: "cover_letter_final_sendability_result_v1";
  inputScope: "final_visible_artifact_only";
  verdict: CoverLetterFinalSendabilityVerdict;
  hardIssues: readonly CoverLetterFinalSendabilityHardIssue[];
  reviewIssues: readonly CoverLetterFinalSendabilityReviewIssue[];
  stats: Readonly<{
    wordCount: number;
    paragraphCount: number;
    bodyWordCount: number;
    bodyParagraphCount: number;
    substantiveBodyParagraphCount: number;
    hasGenericConclusion: boolean;
    hasStandaloneEmployerBridge: boolean;
  }>;
  contentHash: string;
}>;

type ShadowVariantResult = Readonly<{
  label: "A" | "B";
  result: CoverLetterFinalSendabilityResult;
}>;

export type CoverLetterFinalSendabilityShadow = Readonly<{
  version: "cover_letter_final_sendability_shadow_v1";
  inputScope: "final_visible_artifact_only";
  sourcePackHash: string;
  sourceRunId: string;
  sourceCaseId: string;
  providerCalls: 0;
  modelRepairs: 0;
  entries: readonly Readonly<{
    pairLabel: string;
    variantA: ShadowVariantResult;
    variantB: ShadowVariantResult;
  }>[];
  summary: Readonly<{
    totalVariants: number;
    hardBlocked: number;
    reviewRequired: number;
    premiumReady: number;
  }>;
  shadowHash: string;
}>;

const ENGLISH_BOUNDARY_PATTERN =
  /(?:^|\n)\s*(?:dear\s+(?:hiring\s+manager|recruiting\s+team)|(?:sincerely|best\s+regards|kind\s+regards),?)/iu;
const FRENCH_BOUNDARY_PATTERN =
  /(?:^|\n)\s*(?:bonjour|madame|monsieur|(?:bien\s+)?cordialement),?/iu;
const SIGNOFF_PATTERN =
  /^(?:(?:yours\s+)?sincerely|best\s+regards|kind\s+regards|regards|cordialement|bien\s+cordialement),?/iu;
const SALUTATION_PATTERN =
  /^(?:dear\b|bonjour\b|madame\b|monsieur\b|to\s+the\s+hiring\s+team\b)/iu;
const TERMINAL_PUNCTUATION_PATTERN = /[.!?…:;"')\]]$/u;
const DANGLING_END_PATTERN =
  /\b(?:and|or|with|because|to|for|that|which|et|ou|avec|car|pour|que)\s*[.!?…]?$/iu;
const GENERIC_CLOSING_PATTERN =
  /\b(?:glad|happy|welcome\s+the\s+opportunity)\s+to\s+discuss\s+(?:the\s+)?(?:position|role|opportunity)(?:\s+further)?\b|\bwelcome\s+the\s+opportunity\s+to\s+discuss\s+my\s+interest\b/iu;
const ACHIEVEMENT_OPENING_PATTERN =
  /^(?:i\s+)?(?:achieved|built|created|delivered|developed|grew|implemented|improved|increased|led|managed|reduced)\b/iu;
const EMPLOYER_BRIDGE_OPENING_PATTERN = /^(?:for|that|this|with)\b/iu;
const EMPLOYER_BRIDGE_TARGET_PATTERN =
  /\b(?:account\s+health|clients?|company|customers?|employer|expansion|onboarding|retention|role|team)\b/iu;
const NUMERIC_SPECIFICITY_PATTERN =
  /(?<![\p{L}\p{N}])\d+(?:[.,]\d+)?(?:%|\+)?(?![\p{L}\p{N}])/gu;

const JOB_STOP_WORDS = new Set([
  "about",
  "and",
  "build",
  "building",
  "customer",
  "customers",
  "for",
  "from",
  "lead",
  "manager",
  "new",
  "own",
  "role",
  "that",
  "the",
  "through",
  "with",
]);

function compactWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function containsUnreadableCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (
      codePoint === 0xfffd ||
      (codePoint >= 0x00 && codePoint <= 0x08) ||
      codePoint === 0x0b ||
      codePoint === 0x0c ||
      (codePoint >= 0x0e && codePoint <= 0x1f)
    ) {
      return true;
    }
  }
  return false;
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n\s*\n/gu)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function extractCandidateName(
  profileEvidence: ReviewerSafeProfileEvidence,
): string | null {
  if (
    profileEvidence &&
    typeof profileEvidence === "object" &&
    "name" in profileEvidence &&
    typeof profileEvidence.name === "string"
  ) {
    return compactWhitespace(profileEvidence.name);
  }
  return null;
}

function extractBodyParagraphs(args: {
  content: string;
  candidateName: string | null;
}): string[] {
  return splitParagraphs(args.content).filter((paragraph) => {
    const compact = compactWhitespace(paragraph);
    if (SALUTATION_PATTERN.test(compact) || SIGNOFF_PATTERN.test(compact)) {
      return false;
    }
    return !args.candidateName || compact !== args.candidateName;
  });
}

function countWords(value: string): number {
  const compact = compactWhitespace(value);
  return compact ? compact.split(" ").length : 0;
}

function collectEvidenceText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(collectEvidenceText).join(" ");
  if (value && typeof value === "object") {
    return Object.values(value).map(collectEvidenceText).join(" ");
  }
  return "";
}

function extractNumericSpecificity(value: string): string[] {
  return [...value.matchAll(NUMERIC_SPECIFICITY_PATTERN)].map((match) =>
    match[0]!.replace(",", ".").toLowerCase(),
  );
}

function hasUnsupportedSpecificity(args: {
  content: string;
  job: ReviewerSafeJob;
  profileEvidence: ReviewerSafeProfileEvidence;
}): boolean {
  const allowed = new Set(
    extractNumericSpecificity(
      `${args.job.title} ${args.job.description} ${collectEvidenceText(args.profileEvidence)}`,
    ),
  );
  return extractNumericSpecificity(args.content).some(
    (specificity) => !allowed.has(specificity),
  );
}

function hasWrongLanguage(content: string, outputLanguage: string): boolean {
  const deterministicLanguage = getDeterministicCopyLanguage(outputLanguage);
  if (deterministicLanguage === "en") {
    return (
      FRENCH_BOUNDARY_PATTERN.test(content) ||
      resolveProposalOutputLanguage(content) === "French"
    );
  }
  if (deterministicLanguage === "fr") {
    return ENGLISH_BOUNDARY_PATTERN.test(content);
  }
  return ENGLISH_BOUNDARY_PATTERN.test(content);
}

function hasTruncatedOrFragmentedBody(
  bodyParagraphs: readonly string[],
): boolean {
  return bodyParagraphs.some((paragraph) => {
    const compact = compactWhitespace(paragraph);
    return (
      !TERMINAL_PUNCTUATION_PATTERN.test(compact) ||
      DANGLING_END_PATTERN.test(compact)
    );
  });
}

function normalizeSearchToken(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

function extractJobKeywords(job: ReviewerSafeJob): string[] {
  return (
    [job.title, job.description]
      .join(" ")
      .match(/[\p{L}]{4,}/gu)
      ?.map(normalizeSearchToken)
      .filter((token) => !JOB_STOP_WORDS.has(token)) ?? []
  );
}

function hasEmployerContext(content: string, job: ReviewerSafeJob): boolean {
  const normalizedContent = normalizeSearchToken(content);
  const normalizedTitle = normalizeSearchToken(job.title);
  if (normalizedTitle && normalizedContent.includes(normalizedTitle)) {
    return true;
  }
  const matches = new Set(
    extractJobKeywords(job).filter((keyword) =>
      normalizedContent.includes(keyword),
    ),
  );
  return matches.size >= 2;
}

function hasCvInventory(bodyParagraphs: readonly string[]): boolean {
  return (
    bodyParagraphs
      .slice(0, 3)
      .filter((paragraph) =>
        ACHIEVEMENT_OPENING_PATTERN.test(compactWhitespace(paragraph)),
      ).length >= 2
  );
}

function hasStandaloneEmployerBridge(
  bodyParagraphs: readonly string[],
): boolean {
  return bodyParagraphs.some((paragraph) => {
    const compact = compactWhitespace(paragraph);
    return (
      EMPLOYER_BRIDGE_OPENING_PATTERN.test(compact) &&
      EMPLOYER_BRIDGE_TARGET_PATTERN.test(compact)
    );
  });
}

function hasChoppyOrGenericTone(bodyParagraphs: readonly string[]): boolean {
  if (bodyParagraphs.length === 0) return true;
  const shortParagraphs = bodyParagraphs.filter(
    (paragraph) => countWords(paragraph) < 9,
  ).length;
  return shortParagraphs / bodyParagraphs.length >= 0.5;
}

function addIssue<T extends string>(issues: T[], issue: T): void {
  if (!issues.includes(issue)) issues.push(issue);
}

async function hashFinalVisibleContent(content: string): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-final-sendability-shadow",
    type: "final-visible-content",
    version: 1,
    content,
  });
}

export async function evaluateCoverLetterFinalSendability(args: {
  content: string;
  outputLanguage: string;
  job: ReviewerSafeJob;
  profileEvidence: ReviewerSafeProfileEvidence;
}): Promise<CoverLetterFinalSendabilityResult> {
  const candidateName = extractCandidateName(args.profileEvidence);
  const paragraphs = splitParagraphs(args.content);
  const bodyParagraphs = extractBodyParagraphs({
    content: args.content,
    candidateName,
  });
  const hardIssues: CoverLetterFinalSendabilityHardIssue[] = [];
  const reviewIssues: CoverLetterFinalSendabilityReviewIssue[] = [];
  const compactContent = compactWhitespace(args.content);
  const genericClosingPresent = bodyParagraphs.some((paragraph) =>
    GENERIC_CLOSING_PATTERN.test(compactWhitespace(paragraph)),
  );
  const substantiveBodyParagraphCount = bodyParagraphs.filter(
    (paragraph) => !GENERIC_CLOSING_PATTERN.test(compactWhitespace(paragraph)),
  ).length;
  const bodyWordCount = countWords(bodyParagraphs.join(" "));
  const standaloneEmployerBridgePresent =
    hasStandaloneEmployerBridge(bodyParagraphs);

  if (!compactContent || containsUnreadableCharacter(args.content)) {
    addIssue(hardIssues, "unreadable_export");
  }
  if (compactContent && hasWrongLanguage(args.content, args.outputLanguage)) {
    addIssue(hardIssues, "wrong_language");
  }
  if (
    bodyParagraphs.length > 0 &&
    hasTruncatedOrFragmentedBody(bodyParagraphs)
  ) {
    addIssue(hardIssues, "truncated_or_fragmented");
  }
  if (
    bodyParagraphs.length <= 1 ||
    (genericClosingPresent &&
      substantiveBodyParagraphCount <= 2 &&
      bodyWordCount < 80 &&
      !standaloneEmployerBridgePresent)
  ) {
    addIssue(hardIssues, "visible_structure_loss_signature");
  }
  if (
    hasUnsupportedSpecificity({
      content: args.content,
      job: args.job,
      profileEvidence: args.profileEvidence,
    })
  ) {
    addIssue(hardIssues, "unsupported_specificity");
  }

  const firstBodyParagraph = bodyParagraphs[0];
  if (
    firstBodyParagraph &&
    ACHIEVEMENT_OPENING_PATTERN.test(compactWhitespace(firstBodyParagraph))
  ) {
    addIssue(reviewIssues, "abrupt_opening");
  }
  if (hasCvInventory(bodyParagraphs)) {
    addIssue(reviewIssues, "cv_inventory");
  }
  if (compactContent && !hasEmployerContext(args.content, args.job)) {
    addIssue(reviewIssues, "employer_context_missing");
  }
  if (genericClosingPresent) {
    addIssue(reviewIssues, "generic_closing");
  }
  if (bodyWordCount < 80 || bodyWordCount > 350) {
    addIssue(reviewIssues, "length_out_of_range");
  }
  if (hasChoppyOrGenericTone(bodyParagraphs)) {
    addIssue(reviewIssues, "choppy_or_generic_tone");
  }

  hardIssues.sort(
    (left, right) =>
      HARD_ISSUE_ORDER.indexOf(left) - HARD_ISSUE_ORDER.indexOf(right),
  );
  reviewIssues.sort(
    (left, right) =>
      REVIEW_ISSUE_ORDER.indexOf(left) - REVIEW_ISSUE_ORDER.indexOf(right),
  );
  const verdict: CoverLetterFinalSendabilityVerdict =
    hardIssues.length > 0
      ? "HARD_BLOCKED"
      : reviewIssues.length > 0
        ? "REVIEW_REQUIRED"
        : "PREMIUM_READY";

  return {
    version: "cover_letter_final_sendability_result_v1",
    inputScope: "final_visible_artifact_only",
    verdict,
    hardIssues,
    reviewIssues,
    stats: {
      wordCount: countWords(args.content),
      paragraphCount: paragraphs.length,
      bodyWordCount,
      bodyParagraphCount: bodyParagraphs.length,
      substantiveBodyParagraphCount,
      hasGenericConclusion: genericClosingPresent,
      hasStandaloneEmployerBridge: standaloneEmployerBridgePresent,
    },
    contentHash: await hashFinalVisibleContent(args.content),
  };
}

function assertExactSourcePack(
  sourcePack: CoverLetterFinalArtifactShadowPack,
): void {
  if (
    sourcePack.version !== "cover_letter_final_artifact_shadow_pack_v1" ||
    sourcePack.cohortId !== QUALITY_EVAL_2E_COHORT_ID ||
    sourcePack.caseId !== QUALITY_EVAL_2D_CASE_ID ||
    !/^[a-f0-9]{64}$/u.test(sourcePack.packHash) ||
    sourcePack.entries.length !== 5 ||
    JSON.stringify(
      sourcePack.entries.map((entry) => entry.pairLabel).sort(),
    ) !== JSON.stringify(QUALITY_EVAL_2E_PAIR_LABELS)
  ) {
    throw new Error(
      "QUALITY-CL-1 requires one exact five-pair QUALITY-EVAL-2E public pack.",
    );
  }
  if (
    sourcePack.entries.some(
      (entry) =>
        entry.variantA.label !== "A" ||
        entry.variantB.label !== "B" ||
        entry.contentHandling !== "synthetic_untrusted_text",
    )
  ) {
    throw new Error(
      "QUALITY-CL-1 received an incompatible public blind-pack entry.",
    );
  }
}

async function assertSourcePackHash(
  sourcePack: CoverLetterFinalArtifactShadowPack,
): Promise<void> {
  const { packHash, ...packBody } = sourcePack;
  const computedHash = await buildStableHash({
    namespace: "cover-letter-final-artifact-attribution-shadow",
    type: "blind-pack",
    version: 1,
    content: packBody,
  });
  if (computedHash !== packHash) {
    throw new Error("QUALITY-CL-1 source public pack hash drifted.");
  }
}

async function hashShadowBody(
  body: Omit<CoverLetterFinalSendabilityShadow, "shadowHash">,
): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-final-sendability-shadow",
    type: "shadow",
    version: 1,
    body,
  });
}

export async function buildCoverLetterFinalSendabilityShadow(args: {
  sourcePack: CoverLetterFinalArtifactShadowPack;
}): Promise<CoverLetterFinalSendabilityShadow> {
  assertExactSourcePack(args.sourcePack);
  await assertSourcePackHash(args.sourcePack);
  const entries = await Promise.all(
    args.sourcePack.entries.map(async (entry) => ({
      pairLabel: entry.pairLabel,
      variantA: {
        label: "A" as const,
        result: await evaluateCoverLetterFinalSendability({
          content: entry.variantA.letter,
          outputLanguage: entry.outputLanguage,
          job: entry.job,
          profileEvidence: entry.profileEvidence,
        }),
      },
      variantB: {
        label: "B" as const,
        result: await evaluateCoverLetterFinalSendability({
          content: entry.variantB.letter,
          outputLanguage: entry.outputLanguage,
          job: entry.job,
          profileEvidence: entry.profileEvidence,
        }),
      },
    })),
  );
  const results = entries.flatMap((entry) => [
    entry.variantA.result,
    entry.variantB.result,
  ]);
  const summary = {
    totalVariants: results.length,
    hardBlocked: results.filter((result) => result.verdict === "HARD_BLOCKED")
      .length,
    reviewRequired: results.filter(
      (result) => result.verdict === "REVIEW_REQUIRED",
    ).length,
    premiumReady: results.filter((result) => result.verdict === "PREMIUM_READY")
      .length,
  };
  const body: Omit<CoverLetterFinalSendabilityShadow, "shadowHash"> = {
    version: "cover_letter_final_sendability_shadow_v1",
    inputScope: "final_visible_artifact_only",
    sourcePackHash: args.sourcePack.packHash,
    sourceRunId: args.sourcePack.runId,
    sourceCaseId: args.sourcePack.caseId,
    providerCalls: 0,
    modelRepairs: 0,
    entries,
    summary,
  };
  return {
    ...body,
    shadowHash: await hashShadowBody(body),
  };
}
