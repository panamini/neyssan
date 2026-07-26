import { execFileSync } from "node:child_process";
import { open, readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { buildStableHash } from "../../src/modules/application-harness/fingerprints";
import {
  PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
  buildPremiumCoverLetterOpenAIRequestForExactModel,
} from "../../convex/lib/proposals/premiumCoverLetter";
import {
  benchmarkCoverLetterCaseForHumanReview,
  buildCoverLetterBenchmarkOfflineCostPreflight,
  type CoverLetterBenchmarkFailureRecord,
  type CoverLetterHumanReviewRecord,
} from "./benchmark-cover-letter-writers";
import {
  buildCoverLetterBlindReviewArtifacts,
  completedCoverLetterBlindReviewSchema,
  renderCoverLetterBlindReviewMarkdown,
  type CompletedCoverLetterBlindReview,
  type CoverLetterBlindReviewPack,
  type CoverLetterBlindReviewRevealMap,
} from "./cover-letter-blind-review";
import {
  QUALITY_EVAL3C_DEVELOPMENT_CASE_ID,
  QUALITY_EVAL3C_INITIAL_VARIANTS,
  getCoverLetterEval3cDevelopmentCase,
  type CoverLetterEval3cVariant,
} from "./cover-letter-eval3c-adaptive";
import {
  buildCoverLetterEvalArtifactHash,
  type CoverLetterEvalArtifact,
} from "./cover-letter-eval-artifact";
import {
  buildCoverLetterEvalCellDiagnostic,
  type CoverLetterEvalCellDiagnostic,
} from "./cover-letter-eval-cell-diagnostic";
import { createCoverLetterEvalBudget } from "./cover-letter-eval-budget";
import { buildCoverLetterEvalFailureAttemptMetadata } from "./cover-letter-eval-failure-receipt";
import {
  buildCoverLetterEvalRunManifestEntry,
  resolveCoverLetterEvalInstalledSdkVersions,
  type CoverLetterEvalTokenUsage,
} from "./cover-letter-eval-run-manifest";
import {
  assertCoverLetterEvalPrivateArtifactTargetsAvailable,
  writeCoverLetterEvalPrivateArtifacts,
  writeCoverLetterEvalPrivateEvidenceFile,
} from "./cover-letter-eval3a-held-out";
import {
  evaluateCoverLetterFinalSendability,
  type CoverLetterFinalSendabilityResult,
} from "./cover-letter-final-sendability-shadow";
import type { CoverLetterBenchmarkCase } from "./cases/cover-letter/cases";

export const QUALITY_EVAL3C_V2_COHORT_ID =
  "quality-eval-3c-development-blind-v2";
export const QUALITY_EVAL3C_V2_LIVE_MAX_USD = 0.3;
export const QUALITY_EVAL3C_V2_FOLLOW_UP_MAX_USD = 0.15;
export const QUALITY_EVAL3C_V2_INITIAL_VARIANTS =
  QUALITY_EVAL3C_INITIAL_VARIANTS;

export const QUALITY_EVAL3C_V2_ACCEPTABILITY_POLICY = {
  version: "cover_letter_eval3c_acceptability_policy_v2",
  smallRevision: {
    maximumSentenceLevelChanges: 2,
    allowed:
      "sentence_addition_replacement_or_merge_plus_minor_style_corrections",
    forbidden: [
      "new_candidate_facts",
      "new_employer_facts",
      "new_proof_paragraph",
      "whole_argument_reordering",
      "simultaneous_opening_body_close_replacement",
    ],
  },
  primaryReviewersPerReviewableLetter: 2,
  adjudicatorPolicy:
    "one_distinct_third_reviewer_only_for_material_secondary_disagreement",
  coreUnanimityFields: [
    "factualGrounding",
    "credibility",
    "relevanceToOffer",
    "commercialAcceptability",
  ],
  materialSecondaryFields: ["persuasion", "structure", "substance"],
} as const;

const PROTOCOL = "quality_eval3c_blind_adaptive_v2" as const;
const APPROVAL_VERSION = "quality_eval3c_approval_phrase_v2" as const;
const FOLLOW_UP_APPROVAL_VERSION =
  "quality_eval3c_follow_up_approval_phrase_v2" as const;
const RUN_ID_RE = /^quality-eval-3c-v2-[a-z0-9-]+$/u;
const IDENTITY_TOKEN_RE =
  /(?:\bgpt\b|\bluna\b|\bsol\b|\breasoning\b|\beffort\b|\bnone\b|\blow\b|\bmedium\b)/iu;
const LEDGER_FILE_NAME = "eval3c-v2-run-ledger.json";
const FOLLOW_UP_LEDGER_FILE_NAME = "eval3c-v2-follow-up-ledger.json";
const SECONDARY_FIELDS = [
  "evidencePrioritization",
  "persuasion",
  "structure",
  "substance",
  "tone",
  "economy",
] as const;
const ALLOWED_FINALIZATION_ERRORS = new Set([
  "proposal_finalization_error",
  "error",
  "unknown_error",
]);
const ALLOWED_FAILURE_STAGES = new Set([
  "cleaned_body_selection",
  "substantive_body_assertion",
  "finalization",
  "validation",
]);
const ALLOWED_FAILURE_ISSUES = new Set([
  "adjacent_direct_fit",
  "candidate_backed_evidence_missing",
  "candidate_name_mismatch",
  "factual_inventory",
  "generic_tone",
  "greeting_leakage",
  "non_repairable_validation",
  "weak_employer_argument",
]);

type WriterModel = "gpt-5.6-luna" | "gpt-5.6-sol";
type CellOutcome = "human_review_pending" | "safety_veto" | "editorial_veto";
type FailureMatrixEntry = Readonly<{
  blindLabel: string;
  outcome: "safety_veto" | "editorial_veto";
  textIncluded: false;
}>;

export type CoverLetterEval3cV2Plan = Readonly<{
  version: "cover_letter_eval3c_plan_v2";
  status: "READY_FOR_APPROVAL";
  sourceRef: string;
  runId: string;
  cohortId: typeof QUALITY_EVAL3C_V2_COHORT_ID;
  outputBindingHash: string;
  developmentCaseId: typeof QUALITY_EVAL3C_DEVELOPMENT_CASE_ID;
  initialVariants: typeof QUALITY_EVAL3C_V2_INITIAL_VARIANTS;
  plannedProviderCalls: 2;
  providerMaxRetries: 0;
  maxRepairs: 0;
  llmEvaluator: "none";
  adaptivePolicy: Readonly<{
    version: "cover_letter_eval3c_adaptive_policy_v2";
    allowedLunaEfforts: readonly ["none", "low", "medium"];
    allowedSolEfforts: readonly ["low", "medium"];
    nextPhaseRule: "one_new_development_rung_after_blind_human_review";
    heldOutAccess: "forbidden_until_two_finalists_are_frozen";
    futurePhasesExecutableByThisPlan: false;
  }>;
  acceptabilityPolicyHash: string;
  budget: Readonly<{
    maxUsd: typeof QUALITY_EVAL3C_V2_LIVE_MAX_USD;
    declaredMaxUsdPerCall: number;
    minimumSafeReservationUsd: number;
    reservationBasis: "conservative_offline_transport_ceiling";
  }>;
  approvalPhraseVersion: typeof APPROVAL_VERSION;
  approvalPhrase: string;
  planHash: string;
}>;

export type CoverLetterEval3cV2BlindReviewPack = Omit<
  CoverLetterBlindReviewPack,
  "entries"
> &
  Readonly<{
    evaluationProtocol: typeof PROTOCOL;
    planHash: string;
    acceptabilityPolicy: typeof QUALITY_EVAL3C_V2_ACCEPTABILITY_POLICY;
    acceptabilityPolicyHash: string;
    entries: readonly (CoverLetterBlindReviewPack["entries"][number] &
      Readonly<{
        reviewPolicyVersion: typeof QUALITY_EVAL3C_V2_ACCEPTABILITY_POLICY.version;
        acceptabilityPolicyHash: string;
      }>)[];
    failureMatrix: readonly FailureMatrixEntry[];
  }>;

export type CoverLetterEval3cV2RevealMap = Omit<
  CoverLetterBlindReviewRevealMap,
  "entries"
> &
  Readonly<{
    evaluationProtocol: typeof PROTOCOL;
    planHash: string;
    entries: readonly Readonly<{
      blindLabel: string;
      variantId: string;
      caseId: string;
      writerProvider: "openai";
      writerModel: WriterModel;
      reasoningEffort: "none" | "low" | "medium";
      artifactHash: string | null;
      provenanceHash: string | null;
      outcome: CellOutcome;
    }>[];
  }>;

type CoverLetterEval3cV2ExecutionCommitmentEntry = Readonly<{
  blindLabel: string;
  variantId: string;
  caseId: string;
  writerProvider: "openai";
  writerModel: WriterModel;
  reasoningEffort: "none" | "low" | "medium";
  outcome: CellOutcome;
  artifactHash: string | null;
  provenanceHash: string | null;
}>;

export type CoverLetterEval3cV2ExecutionCommitment = Readonly<{
  version: "cover_letter_eval3c_execution_commitment_v2";
  planHash: string;
  packHash: string;
  revealMapHash: string;
  entries: readonly CoverLetterEval3cV2ExecutionCommitmentEntry[];
  commitmentHash: string;
}>;

export type CoverLetterEval3cV2ReviewSubmission = Readonly<{
  reviewerId: string;
  slot: "primary_1" | "primary_2" | "adjudicator";
  review: unknown;
}>;

export type CoverLetterEval3cV2BlindDecisionEntry = Readonly<{
  blindLabel: string;
  outcome: "reviewed" | "safety_veto" | "editorial_veto";
  acceptability: "acceptable" | "near_acceptable" | "not_acceptable";
  primaryReviewerCount: 0 | 2;
  adjudicated: boolean;
  secondaryFailureCount: number;
  reviewEvidenceHash: string | null;
}>;

export type CoverLetterEval3cV2BlindDecision = Readonly<{
  version: "cover_letter_eval3c_blind_decision_v2";
  status: "COMPLETE" | "ADJUDICATION_REQUIRED";
  cohortId: typeof QUALITY_EVAL3C_V2_COHORT_ID;
  runId: string;
  sourceRef: string;
  planHash: string;
  packHash: string;
  acceptabilityPolicyHash: string;
  reviewSetHash: string;
  entries: readonly CoverLetterEval3cV2BlindDecisionEntry[];
  adjudicationRequiredLabels: readonly string[];
  preferredNearLabel: string | null;
  decisionHash: string;
}>;

export type CoverLetterEval3cV2AdaptiveAction =
  | Readonly<{ action: "freeze_both"; reason: "both_acceptable" }>
  | Readonly<{
      action: "follow_up";
      blindLabel: string;
      writerModel: WriterModel;
      reasoningEffort: "none" | "medium";
      reason:
        | "luna_acceptable_lower_effort_check"
        | "sol_acceptable_luna_near"
        | "single_near_acceptable"
        | "blind_near_tiebreak";
    }>
  | Readonly<{
      action: "stop";
      reason:
        | "sol_acceptable_luna_not_acceptable"
        | "prompt_or_synthesis_diagnosis";
    }>;

export type CoverLetterEval3cV2FollowUpPlan = Readonly<{
  version: "cover_letter_eval3c_follow_up_plan_v2";
  status: "READY_FOR_APPROVAL";
  sourceRef: string;
  runId: string;
  cohortId: typeof QUALITY_EVAL3C_V2_COHORT_ID;
  outputBindingHash: string;
  developmentCaseId: typeof QUALITY_EVAL3C_DEVELOPMENT_CASE_ID;
  initialPlanHash: string;
  executionCommitmentHash: string;
  initialRunId: string;
  packHash: string;
  reviewSetHash: string;
  blindDecisionHash: string;
  revealMapHash: string;
  selectedVariant: Readonly<{
    variantId: string;
    blindLabel: string;
    writerModel: WriterModel;
    reasoningEffort: "none" | "medium";
  }>;
  plannedProviderCalls: 1;
  providerMaxRetries: 0;
  maxRepairs: 0;
  llmEvaluator: "none";
  heldOutAccess: "forbidden";
  budget: Readonly<{
    maxUsd: typeof QUALITY_EVAL3C_V2_FOLLOW_UP_MAX_USD;
    declaredMaxUsdPerCall: number;
    minimumSafeReservationUsd: number;
    reservationBasis: "conservative_offline_transport_ceiling";
  }>;
  approvalPhraseVersion: typeof FOLLOW_UP_APPROVAL_VERSION;
  approvalPhrase: string;
  planHash: string;
}>;

type Generator = (args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: WriterModel;
  reasoningEffort: "none" | "low" | "medium";
  apiKey: string;
  budget: ReturnType<typeof createCoverLetterEvalBudget>;
}) => Promise<unknown>;

type Cell = Readonly<{
  key: string;
  variant: CoverLetterEval3cVariant;
  caseId: string;
  outcome: CellOutcome;
  artifactHash: string | null;
  provenanceHash: string | null;
  record: CoverLetterHumanReviewRecord | CoverLetterBenchmarkFailureRecord;
  failureReceipt: Readonly<Record<string, unknown>> | null;
  sendability: CoverLetterFinalSendabilityResult | null;
  diagnostic: CoverLetterEvalCellDiagnostic;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function assertNeutralRunId(runId: string): void {
  if (!RUN_ID_RE.test(runId) || IDENTITY_TOKEN_RE.test(runId)) {
    throw new Error(
      "QUALITY-EVAL-3C v2 requires a reviewer-neutral runId without model or reasoning identity tokens.",
    );
  }
}

function currentHead(): string {
  const value = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (!/^[a-f0-9]{40}$/u.test(value)) {
    throw new Error("QUALITY-EVAL-3C v2 could not resolve an exact Git HEAD.");
  }
  return value;
}

function currentStatus(): string {
  return execFileSync(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
}

function developmentCase(): CoverLetterBenchmarkCase {
  const source = getCoverLetterEval3cDevelopmentCase();
  return {
    ...source,
    reviewMetadata: {
      ...source.reviewMetadata!,
      cohortId: QUALITY_EVAL3C_V2_COHORT_ID,
    },
  };
}

async function policyHash(): Promise<string> {
  return buildStableHash({
    namespace: PROTOCOL,
    type: "acceptability-policy",
    version: 2,
    value: QUALITY_EVAL3C_V2_ACCEPTABILITY_POLICY,
  });
}

async function buildOutputBindingHash(
  outputDirectory: string,
): Promise<string> {
  if (!outputDirectory.trim()) {
    throw new Error("QUALITY-EVAL-3C v2 requires a private output target.");
  }
  return buildStableHash({
    namespace: PROTOCOL,
    type: "private-output-binding",
    version: 2,
    value: { resolvedOutputDirectory: resolvePath(outputDirectory) },
  });
}

async function acquireExecutionClaim(args: {
  outputDirectory: string;
  phase: "initial" | "follow-up";
  planHash: string;
  outputBindingHash: string;
}): Promise<void> {
  const body = {
    version: "cover_letter_eval3c_execution_claim_v2",
    phase: args.phase,
    planHash: args.planHash,
    outputBindingHash: args.outputBindingHash,
  } as const;
  const content = `${JSON.stringify(
    {
      ...body,
      claimHash: await buildStableHash({
        namespace: PROTOCOL,
        type: "execution-claim",
        version: 2,
        value: body,
      }),
    },
    null,
    2,
  )}\n`;
  const claimPath = resolvePath(
    args.outputDirectory,
    "private-evidence",
    `eval3c-v2-${args.phase}.claim.json`,
  );
  let claim: Awaited<ReturnType<typeof open>>;
  try {
    claim = await open(claimPath, "wx", 0o600);
  } catch {
    throw new Error(
      `QUALITY-EVAL-3C v2 ${args.phase} execution claim is already reserved.`,
    );
  }
  try {
    await claim.writeFile(content, { encoding: "utf8" });
    await claim.sync();
  } finally {
    await claim.close();
  }
}

function projectCommitmentEntries(
  revealMap: CoverLetterEval3cV2RevealMap,
): readonly CoverLetterEval3cV2ExecutionCommitmentEntry[] {
  return revealMap.entries
    .map((entry) => ({
      blindLabel: entry.blindLabel,
      variantId: entry.variantId,
      caseId: entry.caseId,
      writerProvider: entry.writerProvider,
      writerModel: entry.writerModel,
      reasoningEffort: entry.reasoningEffort,
      outcome: entry.outcome,
      artifactHash: entry.artifactHash,
      provenanceHash: entry.provenanceHash,
    }))
    .sort((left, right) => left.blindLabel.localeCompare(right.blindLabel));
}

async function buildExecutionCommitment(args: {
  plan: Readonly<{ planHash: string }>;
  pack: CoverLetterEval3cV2BlindReviewPack;
  revealMap: CoverLetterEval3cV2RevealMap;
}): Promise<CoverLetterEval3cV2ExecutionCommitment> {
  const body = {
    version: "cover_letter_eval3c_execution_commitment_v2",
    planHash: args.plan.planHash,
    packHash: args.pack.packHash,
    revealMapHash: args.revealMap.revealMapHash,
    entries: projectCommitmentEntries(args.revealMap),
  } as const;
  return {
    ...body,
    commitmentHash: await buildStableHash({
      namespace: PROTOCOL,
      type: "execution-commitment",
      version: 2,
      value: body,
    }),
  };
}

async function assertExecutionCommitmentBase(args: {
  plan: CoverLetterEval3cV2Plan | CoverLetterEval3cV2FollowUpPlan;
  pack: CoverLetterEval3cV2BlindReviewPack;
  commitment: CoverLetterEval3cV2ExecutionCommitment;
}): Promise<void> {
  const { commitmentHash, ...body } = args.commitment;
  const packLabels = [
    ...args.pack.entries.map((entry) => entry.blindLabel),
    ...args.pack.failureMatrix.map((entry) => entry.blindLabel),
  ].sort();
  const commitmentLabels = args.commitment.entries
    .map((entry) => entry.blindLabel)
    .sort();
  const expectedVariants =
    args.plan.version === "cover_letter_eval3c_follow_up_plan_v2"
      ? [args.plan.selectedVariant]
      : args.plan.initialVariants;
  const committedVariants = new Set(
    args.commitment.entries.map(
      (entry) =>
        `${entry.variantId}:${entry.writerModel}:${entry.reasoningEffort}:${entry.caseId}`,
    ),
  );
  const expectedVariantKeys = new Set(
    expectedVariants.map(
      (variant) =>
        `${variant.variantId}:${variant.writerModel}:${variant.reasoningEffort}:${args.plan.developmentCaseId}`,
    ),
  );
  if (
    args.commitment.version !== "cover_letter_eval3c_execution_commitment_v2" ||
    (await buildStableHash({
      namespace: PROTOCOL,
      type: "execution-commitment",
      version: 2,
      value: body,
    })) !== commitmentHash ||
    args.commitment.planHash !== args.plan.planHash ||
    args.commitment.packHash !== args.pack.packHash ||
    !isHash(args.commitment.revealMapHash) ||
    commitmentLabels.length !== packLabels.length ||
    commitmentLabels.join("\n") !== packLabels.join("\n") ||
    committedVariants.size !== expectedVariantKeys.size ||
    [...committedVariants].some((value) => !expectedVariantKeys.has(value))
  ) {
    throw new Error("QUALITY-EVAL-3C v2 execution commitment is invalid.");
  }
}

async function assertRevealMatchesCommitment(args: {
  plan: CoverLetterEval3cV2Plan | CoverLetterEval3cV2FollowUpPlan;
  pack: CoverLetterEval3cV2BlindReviewPack;
  revealMap: CoverLetterEval3cV2RevealMap;
  commitment: CoverLetterEval3cV2ExecutionCommitment;
}): Promise<void> {
  await assertExecutionCommitmentBase(args);
  if (
    args.commitment.revealMapHash !== args.revealMap.revealMapHash ||
    JSON.stringify(args.commitment.entries) !==
      JSON.stringify(projectCommitmentEntries(args.revealMap))
  ) {
    throw new Error(
      "QUALITY-EVAL-3C v2 reveal does not match the execution commitment.",
    );
  }
}

function initialApproval(args: {
  planHash: string;
  sourceRef: string;
  runId: string;
  outputBindingHash: string;
}): string {
  assertNeutralRunId(args.runId);
  if (
    !isHash(args.planHash) ||
    !isHash(args.outputBindingHash) ||
    !/^[a-f0-9]{40}$/u.test(args.sourceRef)
  ) {
    throw new Error("QUALITY-EVAL-3C v2 approval identity is invalid.");
  }
  return `J’approuve EVAL3C v2 : runId ${args.runId}, sourceRef ${args.sourceRef}, outputBindingHash ${args.outputBindingHash}, planHash ${args.planHash}, 2 appels provider maximum, budget USD ${QUALITY_EVAL3C_V2_LIVE_MAX_USD.toFixed(2)}, cellules gpt-5.6-luna@low et gpt-5.6-sol@low, retries 0, repairs 0, aucun évaluateur LLM, development uniquement, aucun held-out.`;
}

async function buildCanonicalInitialPlan(args: {
  sourceRef: string;
  runId: string;
  outputBindingHash: string;
}): Promise<CoverLetterEval3cV2Plan> {
  assertNeutralRunId(args.runId);
  if (
    !/^[a-f0-9]{40}$/u.test(args.sourceRef) ||
    !isHash(args.outputBindingHash)
  ) {
    throw new Error(
      "QUALITY-EVAL-3C v2 requires an exact sourceRef and output binding.",
    );
  }
  const preflight = await buildCoverLetterBenchmarkOfflineCostPreflight({
    cases: [developmentCase()],
    writerModels: QUALITY_EVAL3C_V2_INITIAL_VARIANTS.map(
      (variant) => variant.writerModel,
    ),
    reasoningEffort: "low",
    targetReservationUsd: QUALITY_EVAL3C_V2_LIVE_MAX_USD,
  });
  if (
    preflight.plannedProviderCalls !== 2 ||
    preflight.providerMaxRetries !== 0 ||
    preflight.maxRepairs !== 0 ||
    !preflight.targetReservationProven ||
    preflight.minimumSafeReservationUsd > QUALITY_EVAL3C_V2_LIVE_MAX_USD
  ) {
    throw new Error("QUALITY-EVAL-3C v2 budget preflight is not exact.");
  }
  const body: Omit<CoverLetterEval3cV2Plan, "approvalPhrase" | "planHash"> = {
    version: "cover_letter_eval3c_plan_v2",
    status: "READY_FOR_APPROVAL",
    sourceRef: args.sourceRef,
    runId: args.runId,
    cohortId: QUALITY_EVAL3C_V2_COHORT_ID,
    outputBindingHash: args.outputBindingHash,
    developmentCaseId: QUALITY_EVAL3C_DEVELOPMENT_CASE_ID,
    initialVariants: QUALITY_EVAL3C_V2_INITIAL_VARIANTS,
    plannedProviderCalls: 2,
    providerMaxRetries: 0,
    maxRepairs: 0,
    llmEvaluator: "none",
    adaptivePolicy: {
      version: "cover_letter_eval3c_adaptive_policy_v2",
      allowedLunaEfforts: ["none", "low", "medium"],
      allowedSolEfforts: ["low", "medium"],
      nextPhaseRule: "one_new_development_rung_after_blind_human_review",
      heldOutAccess: "forbidden_until_two_finalists_are_frozen",
      futurePhasesExecutableByThisPlan: false,
    },
    acceptabilityPolicyHash: await policyHash(),
    budget: {
      maxUsd: QUALITY_EVAL3C_V2_LIVE_MAX_USD,
      declaredMaxUsdPerCall: preflight.declaredMaxUsdPerCall,
      minimumSafeReservationUsd: preflight.minimumSafeReservationUsd,
      reservationBasis: "conservative_offline_transport_ceiling",
    },
    approvalPhraseVersion: APPROVAL_VERSION,
  };
  const planHash = await buildStableHash({
    namespace: PROTOCOL,
    type: "initial-plan",
    version: 2,
    value: body,
  });
  return {
    ...body,
    planHash,
    approvalPhrase: initialApproval({ ...args, planHash }),
  };
}

export async function buildCoverLetterEval3cV2Plan(args: {
  sourceRef: string;
  runId: string;
  outputDirectory: string;
}): Promise<CoverLetterEval3cV2Plan> {
  return buildCanonicalInitialPlan({
    sourceRef: args.sourceRef,
    runId: args.runId,
    outputBindingHash: await buildOutputBindingHash(args.outputDirectory),
  });
}

async function assertCanonicalInitialPlan(
  plan: CoverLetterEval3cV2Plan,
): Promise<void> {
  const canonical = await buildCanonicalInitialPlan({
    sourceRef: plan.sourceRef,
    runId: plan.runId,
    outputBindingHash: plan.outputBindingHash,
  });
  if (
    plan.planHash !== canonical.planHash ||
    JSON.stringify(plan) !== JSON.stringify(canonical)
  ) {
    throw new Error("QUALITY-EVAL-3C v2 initial plan is not canonical.");
  }
}

async function assertCanonicalFollowUpPlan(
  plan: CoverLetterEval3cV2FollowUpPlan,
): Promise<void> {
  const { approvalPhrase, planHash, ...body } = plan;
  const expectedPlanHash = await buildStableHash({
    namespace: PROTOCOL,
    type: "follow-up-plan",
    version: 2,
    value: body,
  });
  if (
    planHash !== expectedPlanHash ||
    approvalPhrase !== followUpApproval({ body, planHash })
  ) {
    throw new Error("QUALITY-EVAL-3C v2 follow-up plan is not canonical.");
  }
}

async function assertArtifact(
  artifact: CoverLetterEvalArtifact,
): Promise<string> {
  if (!isHash(artifact.artifactHash)) {
    throw new Error("QUALITY-EVAL-3C v2 artifact hash is invalid.");
  }
  const { artifactHash, ...body } = artifact;
  if ((await buildCoverLetterEvalArtifactHash(body)) !== artifactHash) {
    throw new Error("QUALITY-EVAL-3C v2 artifact hash mismatch.");
  }
  return artifactHash;
}

function assertArtifactIdentity(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  variant: CoverLetterEval3cVariant;
  record: Readonly<{
    caseId: string;
    writerModel: string;
    outputLanguage: CoverLetterEvalArtifact["frozenConfig"]["outputLanguage"];
  }>;
  artifact: CoverLetterEvalArtifact;
}): void {
  const expectedOutputLanguage =
    args.benchmarkCase.reviewMetadata?.requestedOutputLanguage;
  if (
    args.record.caseId !== args.benchmarkCase.id ||
    args.record.writerModel !== args.variant.writerModel ||
    args.record.outputLanguage !== expectedOutputLanguage ||
    args.artifact.caseId !== args.benchmarkCase.id ||
    args.artifact.frozenConfig.outputLanguage !== expectedOutputLanguage ||
    args.artifact.frozenConfig.preset !== args.benchmarkCase.preset ||
    args.artifact.frozenConfig.hasCandidateContext !==
      (args.benchmarkCase.personalizationContext !== null) ||
    args.artifact.frozenConfig.provider !== "openai" ||
    args.artifact.frozenConfig.model !== args.variant.writerModel ||
    args.artifact.frozenConfig.reasoningEffort !==
      args.variant.reasoningEffort ||
    args.artifact.frozenConfig.providerMaxRetries !== 0 ||
    args.artifact.frozenConfig.writerMaxOutputTokens !== 2_048
  ) {
    throw new Error("QUALITY-EVAL-3C v2 artifact identity is invalid.");
  }
}

function normalizeAttemptTokenUsage(
  value: unknown,
): CoverLetterEvalTokenUsage | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("QUALITY-EVAL-3C v2 attempt token usage is invalid.");
  }
  const keys = Object.keys(value).sort();
  if (
    JSON.stringify(keys) !==
    JSON.stringify(["inputTokens", "outputTokens", "totalTokens"])
  ) {
    throw new Error("QUALITY-EVAL-3C v2 attempt token usage is invalid.");
  }
  const usage = value as Record<string, unknown>;
  const inputTokens = usage.inputTokens;
  const outputTokens = usage.outputTokens;
  const totalTokens = usage.totalTokens;
  if (
    !Number.isSafeInteger(inputTokens) ||
    !Number.isSafeInteger(outputTokens) ||
    !Number.isSafeInteger(totalTokens) ||
    (inputTokens as number) < 0 ||
    (outputTokens as number) < 0 ||
    totalTokens !== (inputTokens as number) + (outputTokens as number)
  ) {
    throw new Error("QUALITY-EVAL-3C v2 attempt token usage is invalid.");
  }
  return {
    inputTokens: inputTokens as number,
    outputTokens: outputTokens as number,
    totalTokens: totalTokens as number,
  };
}

function normalizeOpenAIReturnedModel(
  value: unknown,
  requestedModel: WriterModel,
): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("QUALITY-EVAL-3C v2 returned model is invalid.");
  }
  const suffix = value.startsWith(`${requestedModel}-`)
    ? value.slice(requestedModel.length + 1)
    : null;
  if (
    value !== requestedModel &&
    (suffix === null || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(suffix))
  ) {
    throw new Error("QUALITY-EVAL-3C v2 returned model is invalid.");
  }
  return value;
}

async function assertSuccessManifest(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  variant: CoverLetterEval3cVariant;
  record: CoverLetterHumanReviewRecord;
}): Promise<void> {
  const manifest = args.record.runManifest;
  const prompt = args.record.generation.prompt;
  if (!manifest || typeof prompt !== "string" || !prompt) {
    throw new Error("QUALITY-EVAL-3C v2 success manifest is missing.");
  }
  const expectedManifest = await buildCoverLetterEvalRunManifestEntry({
    caseId: args.benchmarkCase.id,
    provider: "openai",
    requestedModel: args.variant.writerModel,
    returnedModel: normalizeOpenAIReturnedModel(
      manifest.returnedModel,
      args.variant.writerModel,
    ),
    prompt,
    transport: {
      serializedRequest: JSON.stringify(
        buildPremiumCoverLetterOpenAIRequestForExactModel({
          prompt,
          writerModel: args.variant.writerModel,
          schema: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
          maxOutputTokens: 2_048,
          reasoningEffort: args.variant.reasoningEffort,
        }),
      ),
      systemPrompt: null,
      schemaTarget: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
      schemaEnforcementMode: "openai_responses_json_schema_strict",
      promptContract: "provider_native_v1",
    },
    reasoningEffort: args.variant.reasoningEffort,
    writerMaxOutputTokens: 2_048,
    providerMaxRetries: 0,
    tokenUsage: normalizeAttemptTokenUsage(manifest.tokenUsage),
    sdkVersions: await resolveCoverLetterEvalInstalledSdkVersions(),
    artifactHash: args.record.artifact.artifactHash,
    provenanceHash: args.record.artifact.provenanceHash,
  });
  if (!isDeepStrictEqual(manifest, expectedManifest)) {
    throw new Error("QUALITY-EVAL-3C v2 success manifest is invalid.");
  }
}

async function validateSuccess(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  variant: CoverLetterEval3cVariant;
  record: CoverLetterHumanReviewRecord;
}): Promise<{ artifactHash: string; provenanceHash: string | null }> {
  if (
    args.record.caseId !== args.benchmarkCase.id ||
    args.record.writerModel !== args.variant.writerModel ||
    args.record.artifact.decision !== "accepted" ||
    !args.record.artifact.finalContent ||
    args.record.letter !== args.record.artifact.finalContent ||
    args.record.diagnostics.provider !== "openai" ||
    args.record.diagnostics.validationResult !== "premium_validation_passed" ||
    args.record.outputLanguage !==
      args.benchmarkCase.reviewMetadata?.requestedOutputLanguage
  ) {
    throw new Error("QUALITY-EVAL-3C v2 review artifact is invalid.");
  }
  assertArtifactIdentity({ ...args, artifact: args.record.artifact });
  await assertSuccessManifest(args);
  const artifactHash = await assertArtifact(args.record.artifact);
  const provenanceHash = args.record.artifact.provenanceHash;
  if (provenanceHash !== null && !isHash(provenanceHash)) {
    throw new Error("QUALITY-EVAL-3C v2 provenance hash is invalid.");
  }
  return { artifactHash, provenanceHash };
}

async function assertFailureRecord(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  variant: CoverLetterEval3cVariant;
  record: CoverLetterBenchmarkFailureRecord;
}): Promise<{ artifactHash: string | null; provenanceHash: string | null }> {
  const artifact = args.record.artifact;
  const finalization = artifact?.diagnostics.finalization;
  const errorClass =
    finalization?.errorClass ?? args.record.diagnostics.failureReason;
  const failureStage =
    finalization?.failureStage ?? args.record.diagnostics.failureStage;
  const prompt = args.record.generation?.prompt;
  const attempt = args.record.attemptMetadata;
  if (
    args.record.caseId !== args.benchmarkCase.id ||
    args.record.writerModel !== args.variant.writerModel ||
    args.record.diagnostics.provider !== "openai" ||
    args.record.diagnostics.validationResult !==
      "premium_finalization_failed" ||
    !errorClass ||
    !ALLOWED_FINALIZATION_ERRORS.has(errorClass) ||
    (failureStage !== null &&
      failureStage !== undefined &&
      !ALLOWED_FAILURE_STAGES.has(failureStage)) ||
    !Array.isArray(args.record.diagnostics.failureIssues) ||
    args.record.diagnostics.failureIssues.some(
      (issue) =>
        typeof issue !== "string" || !ALLOWED_FAILURE_ISSUES.has(issue),
    ) ||
    !artifact ||
    artifact.decision !== "rejected" ||
    artifact.finalContent !== null ||
    artifact.sections.length !== 0
  ) {
    throw new Error("QUALITY-EVAL-3C v2 failure artifact is invalid.");
  }
  const artifactHash = await assertArtifact(artifact);
  const provenanceHash = artifact.provenanceHash;
  assertArtifactIdentity({ ...args, artifact });
  if (provenanceHash !== null && !isHash(provenanceHash)) {
    throw new Error("QUALITY-EVAL-3C v2 failure provenance is invalid.");
  }
  if (typeof prompt !== "string" || !prompt.trim() || !attempt) {
    throw new Error("QUALITY-EVAL-3C v2 failure attempt metadata is missing.");
  }
  const expectedAttempt = await buildCoverLetterEvalFailureAttemptMetadata({
    caseId: args.benchmarkCase.id,
    provider: "openai",
    requestedModel: args.variant.writerModel,
    returnedModel: normalizeOpenAIReturnedModel(
      attempt.returnedModel,
      args.variant.writerModel,
    ),
    prompt,
    reasoningEffort: args.variant.reasoningEffort,
    writerMaxOutputTokens: 2_048,
    providerMaxRetries: 0,
    tokenUsage: normalizeAttemptTokenUsage(attempt.tokenUsage),
    sdkVersions: await resolveCoverLetterEvalInstalledSdkVersions(),
    artifactHash,
    provenanceHash,
  });
  if (!isDeepStrictEqual(attempt, expectedAttempt)) {
    throw new Error("QUALITY-EVAL-3C v2 failure attempt metadata is invalid.");
  }
  return { artifactHash, provenanceHash };
}

async function validateFailure(args: {
  planHash: string;
  sourceRef: string;
  runId: string;
  benchmarkCase: CoverLetterBenchmarkCase;
  variant: CoverLetterEval3cVariant;
  record: CoverLetterBenchmarkFailureRecord;
}): Promise<Readonly<Record<string, unknown>>> {
  const { artifactHash } = await assertFailureRecord(args);
  const finalization = args.record.artifact?.diagnostics.finalization;
  const errorClass =
    finalization?.errorClass ?? args.record.diagnostics.failureReason;
  const failureStage =
    finalization?.failureStage ?? args.record.diagnostics.failureStage;
  return {
    version: "cover_letter_eval3c_failure_receipt_v2",
    cohortId: QUALITY_EVAL3C_V2_COHORT_ID,
    planHash: args.planHash,
    sourceRef: args.sourceRef,
    runId: args.runId,
    variantId: args.variant.variantId,
    caseId: args.benchmarkCase.id,
    writerModel: args.variant.writerModel,
    reasoningEffort: args.variant.reasoningEffort,
    status: "finalization_failed",
    safetyVeto: "automatic",
    artifactHash,
    diagnostics: {
      errorClass,
      failureStage: failureStage ?? null,
      failureIssues: [...new Set(args.record.diagnostics.failureIssues)].sort(),
    },
  };
}

async function collectCell(args: {
  planHash: string;
  sourceRef: string;
  runId: string;
  benchmarkCase: CoverLetterBenchmarkCase;
  variant: CoverLetterEval3cVariant;
  rawResult: unknown;
}): Promise<Cell> {
  if (!isRecord(args.rawResult) || typeof args.rawResult.status !== "string") {
    throw new Error("QUALITY-EVAL-3C v2 received an untyped result.");
  }
  const key = `${args.benchmarkCase.id}::${args.variant.writerModel}`;
  if (args.rawResult.status === "human_review_pending") {
    const record = args.rawResult as unknown as CoverLetterHumanReviewRecord;
    const hashes = await validateSuccess({
      benchmarkCase: args.benchmarkCase,
      variant: args.variant,
      record,
    });
    const sendability = await evaluateCoverLetterFinalSendability({
      content: record.artifact.finalContent!,
      outputLanguage: record.outputLanguage,
      job: {
        title: args.benchmarkCase.jobTitle,
        description: args.benchmarkCase.jobDescription,
      },
      profileEvidence: args.benchmarkCase.personalizationContext,
    });
    const outcome =
      sendability.verdict === "HARD_BLOCKED"
        ? "editorial_veto"
        : "human_review_pending";
    return {
      key,
      variant: args.variant,
      caseId: args.benchmarkCase.id,
      outcome,
      artifactHash: hashes.artifactHash,
      provenanceHash: hashes.provenanceHash,
      record,
      failureReceipt: null,
      sendability,
      diagnostic: buildCoverLetterEvalCellDiagnostic({
        expectedContextClass: args.benchmarkCase.expectedContextClass,
        outcome,
        sendability,
        failureReceipt: null,
      }),
    };
  }
  if (args.rawResult.status === "finalization_failed") {
    const record =
      args.rawResult as unknown as CoverLetterBenchmarkFailureRecord;
    const failureReceipt = await validateFailure({ ...args, record });
    return {
      key,
      variant: args.variant,
      caseId: args.benchmarkCase.id,
      outcome: "safety_veto",
      artifactHash: (failureReceipt.artifactHash as string | null) ?? null,
      provenanceHash: record.artifact?.provenanceHash ?? null,
      record,
      failureReceipt,
      sendability: null,
      diagnostic: buildCoverLetterEvalCellDiagnostic({
        expectedContextClass: args.benchmarkCase.expectedContextClass,
        outcome: "safety_veto",
        sendability: null,
        failureReceipt,
      }),
    };
  }
  throw new Error("QUALITY-EVAL-3C v2 refused an unauthorized result status.");
}

async function buildBlindArtifacts(args: {
  plan: Readonly<{
    sourceRef: string;
    runId: string;
    planHash: string;
    acceptabilityPolicyHash?: string;
  }>;
  benchmarkCase: CoverLetterBenchmarkCase;
  cells: readonly Cell[];
}): Promise<{
  pack: CoverLetterEval3cV2BlindReviewPack;
  revealMap: CoverLetterEval3cV2RevealMap;
  markdown: string;
}> {
  assertNeutralRunId(args.plan.runId);
  const expectedPolicyHash = await policyHash();
  if (
    args.plan.acceptabilityPolicyHash !== undefined &&
    args.plan.acceptabilityPolicyHash !== expectedPolicyHash
  ) {
    throw new Error("QUALITY-EVAL-3C v2 policy hash mismatch.");
  }
  const successful = args.cells.filter(
    (cell): cell is Cell & { record: CoverLetterHumanReviewRecord } =>
      cell.outcome === "human_review_pending",
  );
  const source = await buildCoverLetterBlindReviewArtifacts({
    cohortId: QUALITY_EVAL3C_V2_COHORT_ID,
    runId: args.plan.runId,
    sourceRef: args.plan.sourceRef,
    cases: successful.length > 0 ? [args.benchmarkCase] : [],
    records: successful.map((cell) => cell.record),
  });
  const ordered = await Promise.all(
    args.cells.map(async (cell) => ({
      cell,
      sortKey: await buildStableHash({
        namespace: PROTOCOL,
        type: "blind-order",
        version: 2,
        finalizedLetter:
          cell.outcome === "human_review_pending" && "letter" in cell.record
            ? cell.record.letter
            : null,
        outcome: cell.outcome,
      }),
    })),
  );
  ordered.sort(
    (left, right) =>
      left.sortKey.localeCompare(right.sortKey) ||
      (left.cell.artifactHash ?? "").localeCompare(
        right.cell.artifactHash ?? "",
      ),
  );
  const labelByKey = new Map(
    ordered.map(({ cell }, index) => [
      cell.key,
      `CL-${String(index + 1).padStart(3, "0")}`,
    ]),
  );
  const sourceRevealByKey = new Map(
    source.revealMap.entries.map((entry) => [
      `${entry.caseId}::${entry.writerModel}`,
      entry,
    ]),
  );
  const sourceEntryByLabel = new Map(
    source.pack.entries.map((entry) => [entry.blindLabel, entry]),
  );
  const entries = ordered.flatMap(({ cell }) => {
    if (cell.outcome !== "human_review_pending") return [];
    const reveal = sourceRevealByKey.get(cell.key);
    const entry = reveal
      ? sourceEntryByLabel.get(reveal.blindLabel)
      : undefined;
    if (!entry) {
      throw new Error("QUALITY-EVAL-3C v2 blind mapping is incomplete.");
    }
    return [
      {
        ...entry,
        blindLabel: labelByKey.get(cell.key)!,
        reviewPolicyVersion: QUALITY_EVAL3C_V2_ACCEPTABILITY_POLICY.version,
        acceptabilityPolicyHash: expectedPolicyHash,
      },
    ];
  });
  const failureMatrix = ordered.flatMap(({ cell }) =>
    cell.outcome === "human_review_pending"
      ? []
      : [
          {
            blindLabel: labelByKey.get(cell.key)!,
            outcome: cell.outcome,
            textIncluded: false as const,
          },
        ],
  );
  const { packHash: _ignoredPackHash, ...sourceBody } = source.pack;
  const packBody = {
    ...sourceBody,
    evaluationProtocol: PROTOCOL,
    planHash: args.plan.planHash,
    acceptabilityPolicy: QUALITY_EVAL3C_V2_ACCEPTABILITY_POLICY,
    acceptabilityPolicyHash: expectedPolicyHash,
    instructions: [
      ...sourceBody.instructions,
      "Review each development letter independently before any private reveal.",
      "Commercial acceptability allows at most two sentence-level additions, replacements, or merges plus minor style corrections; no new facts, proof paragraph, whole-argument reorder, or simultaneous opening/body/close replacement is allowed.",
      "Use two distinct primary reviewers. A third distinct adjudicator is allowed only for disagreement on persuasion, structure, or substance.",
      "Failure-matrix labels are automatic non-reviewable vetoes and contain no generated text.",
      ...failureMatrix.map(
        (entry) =>
          `Failure matrix: ${entry.blindLabel} is an ${entry.outcome}; generated text intentionally absent.`,
      ),
    ],
    rubric: {
      ...sourceBody.rubric,
      commercialAcceptability:
        "A recruiter could send the letter after at most two sentence-level changes plus minor style corrections, without new facts, a new proof paragraph, whole-argument reordering, or replacing opening, body, and close together.",
    },
    entries,
    failureMatrix,
  } as const;
  const packHash = await buildStableHash({
    namespace: "cover-letter-blind-review",
    type: "pack",
    version: 1,
    value: packBody,
  });
  const pack = { ...packBody, packHash } as CoverLetterEval3cV2BlindReviewPack;
  const revealBody = {
    version: "cover_letter_blind_review_reveal_v1" as const,
    cohortId: QUALITY_EVAL3C_V2_COHORT_ID,
    runId: args.plan.runId,
    sourceRef: args.plan.sourceRef,
    packHash,
    evaluationProtocol: PROTOCOL,
    planHash: args.plan.planHash,
    entries: ordered.map(({ cell }) => ({
      blindLabel: labelByKey.get(cell.key)!,
      variantId: cell.variant.variantId,
      caseId: cell.caseId,
      writerProvider: "openai" as const,
      writerModel: cell.variant.writerModel as WriterModel,
      reasoningEffort: cell.variant.reasoningEffort as
        | "none"
        | "low"
        | "medium",
      artifactHash: cell.outcome === "safety_veto" ? null : cell.artifactHash,
      provenanceHash:
        cell.outcome === "safety_veto" ? null : cell.provenanceHash,
      outcome: cell.outcome,
    })),
  };
  const revealMap = {
    ...revealBody,
    revealMapHash: await buildStableHash({
      namespace: "cover-letter-blind-review",
      type: "reveal-map",
      version: 1,
      value: revealBody,
    }),
  } as CoverLetterEval3cV2RevealMap;
  const reviewerProjection = JSON.stringify(pack);
  if (
    /\bgpt(?:[-_. ]|$)/iu.test(reviewerProjection) ||
    /\bluna\b/iu.test(reviewerProjection) ||
    /\bsol\b/iu.test(reviewerProjection) ||
    reviewerProjection.includes("reasoningEffort") ||
    reviewerProjection.includes("variantId") ||
    reviewerProjection.includes("luna-low") ||
    reviewerProjection.includes("sol-low")
  ) {
    throw new Error("QUALITY-EVAL-3C v2 reviewer pack leaked identity.");
  }
  return {
    pack,
    revealMap,
    markdown: renderCoverLetterBlindReviewMarkdown(pack),
  };
}

export type CoverLetterEval3cV2RunArgs = Readonly<{
  approvalPhrase: string;
  explicitLiveProviderOptIn: boolean;
  maxCalls: number;
  maxRepairs: number;
  maxUsd: number;
  declaredMaxUsdPerCall: number;
  outputDirectory: string;
  runId: string;
  sourceRef: string;
  apiKey: string;
  generateRecord?: Generator;
  executionIdentity?: Readonly<{
    currentHeadSourceRef: string;
    currentWorktreeStatus: string;
  }>;
}>;

export async function runCoverLetterEval3cV2InitialScreen(
  args: CoverLetterEval3cV2RunArgs,
): Promise<
  Readonly<Record<string, unknown>> & {
    paths: Awaited<ReturnType<typeof writeCoverLetterEvalPrivateArtifacts>>;
    executionCommitment: CoverLetterEval3cV2ExecutionCommitment;
  }
> {
  const plan = await buildCoverLetterEval3cV2Plan(args);
  const identity = args.executionIdentity ?? {
    currentHeadSourceRef: currentHead(),
    currentWorktreeStatus: currentStatus(),
  };
  if (args.executionIdentity && !args.generateRecord) {
    throw new Error(
      "QUALITY-EVAL-3C v2 test identity requires an injected generator.",
    );
  }
  if (
    identity.currentHeadSourceRef !== args.sourceRef ||
    identity.currentWorktreeStatus.trim() ||
    args.approvalPhrase !== plan.approvalPhrase ||
    !args.explicitLiveProviderOptIn ||
    process.env.COVER_LETTER_EVAL_LIVE !== "1" ||
    args.maxCalls !== 2 ||
    args.maxRepairs !== 0 ||
    args.maxUsd !== plan.budget.maxUsd ||
    args.declaredMaxUsdPerCall !== plan.budget.declaredMaxUsdPerCall
  ) {
    throw new Error("QUALITY-EVAL-3C v2 exact live gate was not satisfied.");
  }
  if (!args.apiKey.trim()) {
    throw new Error("QUALITY-EVAL-3C v2 requires an API key after approval.");
  }
  await assertCoverLetterEvalPrivateArtifactTargetsAvailable({
    outputDirectory: args.outputDirectory,
    ledgerFileName: LEDGER_FILE_NAME,
  });
  await acquireExecutionClaim({
    outputDirectory: args.outputDirectory,
    phase: "initial",
    planHash: plan.planHash,
    outputBindingHash: plan.outputBindingHash,
  });
  const budget = createCoverLetterEvalBudget({
    explicitLiveProviderOptIn: true,
    maxCalls: 2,
    maxRepairs: 0,
    maxUsd: plan.budget.maxUsd,
    declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
  });
  const benchmarkCase = developmentCase();
  const generate =
    args.generateRecord ?? benchmarkCoverLetterCaseForHumanReview;
  const cells: Cell[] = [];
  try {
    for (const variant of QUALITY_EVAL3C_V2_INITIAL_VARIANTS) {
      cells.push(
        await collectCell({
          planHash: plan.planHash,
          sourceRef: plan.sourceRef,
          runId: plan.runId,
          benchmarkCase,
          variant,
          rawResult: await generate({
            benchmarkCase,
            writerModel: variant.writerModel,
            reasoningEffort: variant.reasoningEffort,
            apiKey: args.apiKey,
            budget,
          }),
        }),
      );
    }
    if (
      cells.length !== 2 ||
      new Set(cells.map((cell) => cell.key)).size !== 2
    ) {
      throw new Error("QUALITY-EVAL-3C v2 cell matrix is incomplete.");
    }
    const artifacts = await buildBlindArtifacts({ plan, benchmarkCase, cells });
    const executionCommitment = await buildExecutionCommitment({
      plan,
      pack: artifacts.pack,
      revealMap: artifacts.revealMap,
    });
    const snapshot = budget.snapshot();
    if (
      snapshot.usage.reservedCalls !== 2 ||
      snapshot.usage.reservedRepairs !== 0 ||
      snapshot.usage.reservedUsd > plan.budget.maxUsd
    ) {
      throw new Error("QUALITY-EVAL-3C v2 budget accounting is not exact.");
    }
    const reviewableCellCount = cells.filter(
      (cell) => cell.outcome === "human_review_pending",
    ).length;
    const ledger = {
      version: "cover_letter_eval3c_run_ledger_v2",
      status:
        reviewableCellCount > 0
          ? "HUMAN_REVIEW_PENDING"
          : "OUTCOME_COMPLETE_NO_REVIEWABLE_ARTIFACTS",
      evaluationProtocol: PROTOCOL,
      cohortId: plan.cohortId,
      planHash: plan.planHash,
      sourceRef: plan.sourceRef,
      runId: plan.runId,
      executionCommitment,
      budget: snapshot,
      completedCells: cells.map((cell) => ({
        variantId: cell.variant.variantId,
        writerModel: cell.variant.writerModel,
        reasoningEffort: cell.variant.reasoningEffort,
        outcome: cell.outcome,
        artifactHash: cell.artifactHash,
        sendability: cell.sendability,
        diagnostic: cell.diagnostic,
      })),
      failureReceipts: cells.flatMap((cell) =>
        cell.failureReceipt ? [cell.failureReceipt] : [],
      ),
      llmEvaluator: "none",
      providerMaxRetries: 0,
      maxRepairs: 0,
      heldOutAccess: "forbidden",
    } as const;
    const paths = await writeCoverLetterEvalPrivateArtifacts({
      outputDirectory: args.outputDirectory,
      expectedCohortId: QUALITY_EVAL3C_V2_COHORT_ID,
      pack: artifacts.pack,
      revealMap: artifacts.revealMap,
      ledger,
      packMarkdown: artifacts.markdown,
      ledgerFileName: LEDGER_FILE_NAME,
    });
    return {
      status: ledger.status,
      plan,
      budget: snapshot,
      completedCellCount: 2,
      reviewableCellCount,
      safetyVetoCount: cells.filter((cell) => cell.outcome === "safety_veto")
        .length,
      editorialVetoCount: cells.filter(
        (cell) => cell.outcome === "editorial_veto",
      ).length,
      executionCommitment,
      paths,
    };
  } catch (error) {
    try {
      await writeCoverLetterEvalPrivateEvidenceFile({
        outputDirectory: args.outputDirectory,
        fileName: LEDGER_FILE_NAME,
        content: `${JSON.stringify(
          {
            version: "cover_letter_eval3c_failure_ledger_v2",
            status: "FAILED_CLOSED",
            planHash: plan.planHash,
            completedCellCount: cells.length,
            completedCells: cells.map((cell) => ({
              variantId: cell.variant.variantId,
              outcome: cell.outcome,
              artifactHash: cell.artifactHash,
              failureReceipt: cell.failureReceipt,
              sendability: cell.sendability,
              diagnostic: cell.diagnostic,
            })),
            budget: budget.snapshot(),
          },
          null,
          2,
        )}\n`,
      });
    } catch {
      // Preserve the original classified failure without raw provider data.
    }
    throw error;
  }
}

async function packCoverage(args: {
  plan: CoverLetterEval3cV2Plan | CoverLetterEval3cV2FollowUpPlan;
  pack: CoverLetterEval3cV2BlindReviewPack;
}): Promise<{ reviewable: string[]; failures: string[]; all: string[] }> {
  const isFollowUp =
    args.plan.version === "cover_letter_eval3c_follow_up_plan_v2";
  if (isFollowUp) await assertCanonicalFollowUpPlan(args.plan);
  else await assertCanonicalInitialPlan(args.plan);
  const { packHash, ...body } = args.pack;
  if (
    (await buildStableHash({
      namespace: "cover-letter-blind-review",
      type: "pack",
      version: 1,
      value: body,
    })) !== packHash
  ) {
    throw new Error("QUALITY-EVAL-3C v2 pack hash mismatch.");
  }
  if (
    args.pack.cohortId !== QUALITY_EVAL3C_V2_COHORT_ID ||
    args.pack.evaluationProtocol !== PROTOCOL ||
    args.pack.planHash !== args.plan.planHash ||
    args.pack.runId !== args.plan.runId ||
    args.pack.sourceRef !== args.plan.sourceRef ||
    (!isFollowUp &&
      args.pack.acceptabilityPolicyHash !==
        args.plan.acceptabilityPolicyHash) ||
    args.pack.acceptabilityPolicyHash !== (await policyHash()) ||
    JSON.stringify(args.pack.acceptabilityPolicy) !==
      JSON.stringify(QUALITY_EVAL3C_V2_ACCEPTABILITY_POLICY)
  ) {
    throw new Error("QUALITY-EVAL-3C v2 pack does not match its plan.");
  }
  assertNeutralRunId(args.pack.runId);
  const reviewable = args.pack.entries.map((entry) => entry.blindLabel);
  const failures = args.pack.failureMatrix.map((entry) => entry.blindLabel);
  const all = [...reviewable, ...failures];
  if (
    all.length !== (isFollowUp ? 1 : args.plan.initialVariants.length) ||
    new Set(all).size !== all.length ||
    args.pack.failureMatrix.some(
      (entry) =>
        !["safety_veto", "editorial_veto"].includes(entry.outcome) ||
        entry.textIncluded !== false,
    ) ||
    args.pack.entries.some(
      (entry) =>
        entry.reviewPolicyVersion !==
          QUALITY_EVAL3C_V2_ACCEPTABILITY_POLICY.version ||
        entry.acceptabilityPolicyHash !== args.pack.acceptabilityPolicyHash,
    )
  ) {
    throw new Error(
      "QUALITY-EVAL-3C v2 pack has incomplete or duplicate plan-derived coverage.",
    );
  }
  return {
    reviewable: [...reviewable].sort(),
    failures: [...failures].sort(),
    all: [...all].sort(),
  };
}

function assertLanguages(args: {
  review: CompletedCoverLetterBlindReview;
  entry: CoverLetterEval3cV2BlindReviewPack["entries"][number];
}): void {
  const missing = args.entry.requiredReviewerLanguages.filter(
    (language) => !args.review.reviewerLanguages.includes(language),
  );
  if (missing.length > 0) {
    throw new Error(
      `QUALITY-EVAL-3C v2 ${args.review.blindLabel} is missing required reviewer languages.`,
    );
  }
}

function classify(
  primary: readonly [
    CompletedCoverLetterBlindReview,
    CompletedCoverLetterBlindReview,
  ],
): CoverLetterEval3cV2BlindDecisionEntry["acceptability"] {
  if (
    primary.some(
      (review) =>
        review.factualGrounding === "fail" ||
        review.credibility === "fail" ||
        review.relevanceToOffer === "fail",
    )
  ) {
    return "not_acceptable";
  }
  const commercialPasses = primary.filter(
    (review) => review.commercialAcceptability === "pass",
  ).length;
  return commercialPasses === 2
    ? "acceptable"
    : commercialPasses === 1
      ? "near_acceptable"
      : "not_acceptable";
}

function materialDisagreement(
  primary: readonly [
    CompletedCoverLetterBlindReview,
    CompletedCoverLetterBlindReview,
  ],
): boolean {
  return QUALITY_EVAL3C_V2_ACCEPTABILITY_POLICY.materialSecondaryFields.some(
    (field) => primary[0][field] !== primary[1][field],
  );
}

function secondaryFailures(args: {
  primary: readonly [
    CompletedCoverLetterBlindReview,
    CompletedCoverLetterBlindReview,
  ];
  adjudicator: CompletedCoverLetterBlindReview | null;
}): number {
  return SECONDARY_FIELDS.filter((field) => {
    const verdicts = [
      args.primary[0][field],
      args.primary[1][field],
      ...(args.adjudicator ? [args.adjudicator[field]] : []),
    ];
    return verdicts.length === 3
      ? verdicts.filter((verdict) => verdict === "fail").length >= 2
      : verdicts.some((verdict) => verdict === "fail");
  }).length;
}

async function decisionHash(
  body: Omit<CoverLetterEval3cV2BlindDecision, "decisionHash">,
): Promise<string> {
  return buildStableHash({
    namespace: PROTOCOL,
    type: "blind-decision",
    version: 2,
    value: body,
  });
}

export async function evaluateCoverLetterEval3cV2BlindReviews(args: {
  plan: CoverLetterEval3cV2Plan | CoverLetterEval3cV2FollowUpPlan;
  pack: CoverLetterEval3cV2BlindReviewPack;
  executionCommitment: CoverLetterEval3cV2ExecutionCommitment;
  submissions: readonly CoverLetterEval3cV2ReviewSubmission[];
  followUpRevealMap?: CoverLetterEval3cV2RevealMap;
  followUpContext?: Readonly<{
    initialPlan: CoverLetterEval3cV2Plan;
    pack: CoverLetterEval3cV2BlindReviewPack;
    executionCommitment: CoverLetterEval3cV2ExecutionCommitment;
    submissions: readonly CoverLetterEval3cV2ReviewSubmission[];
    blindDecision: CoverLetterEval3cV2BlindDecision;
    revealMap: CoverLetterEval3cV2RevealMap;
  }>;
}): Promise<CoverLetterEval3cV2BlindDecision> {
  if (args.plan.version === "cover_letter_eval3c_follow_up_plan_v2") {
    if (!args.followUpContext) {
      throw new Error(
        "QUALITY-EVAL-3C v2 follow-up review requires its initial bound context.",
      );
    }
    const expectedPlan = await buildCoverLetterEval3cV2FollowUpPlanForBinding({
      ...args.followUpContext,
      runId: args.plan.runId,
      outputBindingHash: args.plan.outputBindingHash,
    });
    if (!isDeepStrictEqual(args.plan, expectedPlan)) {
      throw new Error(
        "QUALITY-EVAL-3C v2 follow-up review plan is not canonical.",
      );
    }
    if (!args.followUpRevealMap) {
      throw new Error(
        "QUALITY-EVAL-3C v2 follow-up review requires its reveal map.",
      );
    }
    await assertReveal({
      plan: args.plan,
      pack: args.pack,
      revealMap: args.followUpRevealMap,
    });
    await assertRevealMatchesCommitment({
      plan: args.plan,
      pack: args.pack,
      revealMap: args.followUpRevealMap,
      commitment: args.executionCommitment,
    });
  } else if (args.followUpContext || args.followUpRevealMap) {
    throw new Error(
      "QUALITY-EVAL-3C v2 initial review refuses follow-up context.",
    );
  }
  const coverage = await packCoverage(args);
  await assertExecutionCommitmentBase({
    plan: args.plan,
    pack: args.pack,
    commitment: args.executionCommitment,
  });
  const failures = new Set(coverage.failures);
  const reviewable = new Set(coverage.reviewable);
  const parsed = args.submissions.map((submission) => {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u.test(submission.reviewerId) ||
      !["primary_1", "primary_2", "adjudicator"].includes(submission.slot)
    ) {
      throw new Error(
        "QUALITY-EVAL-3C v2 reviewer identity or slot is invalid.",
      );
    }
    const review = completedCoverLetterBlindReviewSchema.parse(
      submission.review,
    );
    if (review.packHash !== args.pack.packHash) {
      throw new Error(
        "QUALITY-EVAL-3C v2 review belongs to a different pack hash.",
      );
    }
    if (failures.has(review.blindLabel)) {
      throw new Error("QUALITY-EVAL-3C v2 failure labels require no reviews.");
    }
    if (!reviewable.has(review.blindLabel)) {
      throw new Error("QUALITY-EVAL-3C v2 review label is unknown.");
    }
    return { ...submission, review };
  });
  const entryByLabel = new Map(
    args.pack.entries.map((entry) => [entry.blindLabel, entry]),
  );
  const entries: CoverLetterEval3cV2BlindDecisionEntry[] = [];
  const adjudicationRequired: string[] = [];
  for (const blindLabel of coverage.reviewable) {
    const supplied = parsed.filter(
      (submission) => submission.review.blindLabel === blindLabel,
    );
    const primary1 = supplied.filter(
      (submission) => submission.slot === "primary_1",
    );
    const primary2 = supplied.filter(
      (submission) => submission.slot === "primary_2",
    );
    const adjudicators = supplied.filter(
      (submission) => submission.slot === "adjudicator",
    );
    if (primary1.length !== 1 || primary2.length !== 1) {
      throw new Error(
        `QUALITY-EVAL-3C v2 ${blindLabel} requires exactly two primary review slots.`,
      );
    }
    const primarySubmissions = [primary1[0]!, primary2[0]!] as const;
    if (
      new Set(primarySubmissions.map((submission) => submission.reviewerId))
        .size !== 2
    ) {
      throw new Error("QUALITY-EVAL-3C v2 requires distinct reviewer IDs.");
    }
    if (adjudicators.length > 1) {
      throw new Error("QUALITY-EVAL-3C v2 accepts one adjudicator at most.");
    }
    const primary = [
      primarySubmissions[0].review,
      primarySubmissions[1].review,
    ] as const;
    const needsAdjudication = materialDisagreement(primary);
    if (adjudicators.length === 1 && !needsAdjudication) {
      throw new Error("QUALITY-EVAL-3C v2 adjudicator was not required.");
    }
    if (
      adjudicators.length === 1 &&
      new Set(supplied.map((submission) => submission.reviewerId)).size !== 3
    ) {
      throw new Error("QUALITY-EVAL-3C v2 adjudicator must be distinct.");
    }
    if (needsAdjudication && adjudicators.length === 0) {
      adjudicationRequired.push(blindLabel);
    }
    const packEntry = entryByLabel.get(blindLabel)!;
    supplied.forEach((submission) =>
      assertLanguages({ review: submission.review, entry: packEntry }),
    );
    const canonicalEvidence = supplied
      .map((submission) => {
        const {
          blindLabel: _blindLabel,
          packHash: _packHash,
          ...review
        } = submission.review;
        return {
          reviewerId: submission.reviewerId,
          slot: submission.slot,
          review,
        };
      })
      .sort((left, right) => left.slot.localeCompare(right.slot));
    entries.push({
      blindLabel,
      outcome: "reviewed",
      acceptability: classify(primary),
      primaryReviewerCount: 2,
      adjudicated: adjudicators.length === 1,
      secondaryFailureCount: secondaryFailures({
        primary,
        adjudicator: adjudicators[0]?.review ?? null,
      }),
      reviewEvidenceHash: await buildStableHash({
        namespace: PROTOCOL,
        type: "blind-review-evidence",
        version: 2,
        finalizedLetter: packEntry.finalizedLetter,
        submissions: canonicalEvidence,
      }),
    });
  }
  for (const failure of args.pack.failureMatrix) {
    entries.push({
      blindLabel: failure.blindLabel,
      outcome: failure.outcome,
      acceptability: "not_acceptable",
      primaryReviewerCount: 0,
      adjudicated: false,
      secondaryFailureCount: SECONDARY_FIELDS.length,
      reviewEvidenceHash: null,
    });
  }
  entries.sort((left, right) =>
    left.blindLabel.localeCompare(right.blindLabel),
  );
  if (
    entries.length !== coverage.all.length ||
    new Set(entries.map((entry) => entry.blindLabel)).size !==
      coverage.all.length
  ) {
    throw new Error("QUALITY-EVAL-3C v2 decision coverage is incomplete.");
  }
  const reviewSetHash = await buildStableHash({
    namespace: PROTOCOL,
    type: "review-set",
    version: 2,
    planHash: args.plan.planHash,
    packHash: args.pack.packHash,
    executionCommitmentHash: args.executionCommitment.commitmentHash,
    revealMapHash: args.executionCommitment.revealMapHash,
    entries: entries.map((entry) => ({
      blindLabel: entry.blindLabel,
      reviewEvidenceHash: entry.reviewEvidenceHash,
    })),
  });
  const preferredNearLabel =
    entries
      .filter((entry) => entry.acceptability === "near_acceptable")
      .sort(
        (left, right) =>
          left.secondaryFailureCount - right.secondaryFailureCount ||
          left.blindLabel.localeCompare(right.blindLabel),
      )[0]?.blindLabel ?? null;
  const body: Omit<CoverLetterEval3cV2BlindDecision, "decisionHash"> = {
    version: "cover_letter_eval3c_blind_decision_v2",
    status:
      adjudicationRequired.length > 0 ? "ADJUDICATION_REQUIRED" : "COMPLETE",
    cohortId: QUALITY_EVAL3C_V2_COHORT_ID,
    runId: args.pack.runId,
    sourceRef: args.pack.sourceRef,
    planHash: args.plan.planHash,
    packHash: args.pack.packHash,
    acceptabilityPolicyHash: args.pack.acceptabilityPolicyHash,
    reviewSetHash,
    entries,
    adjudicationRequiredLabels: [...adjudicationRequired].sort(),
    preferredNearLabel,
  };
  return { ...body, decisionHash: await decisionHash(body) };
}

async function assertReveal(args: {
  plan: CoverLetterEval3cV2Plan | CoverLetterEval3cV2FollowUpPlan;
  pack: CoverLetterEval3cV2BlindReviewPack;
  revealMap: CoverLetterEval3cV2RevealMap;
}): Promise<void> {
  const coverage = await packCoverage(args);
  const { revealMapHash, ...body } = args.revealMap;
  if (
    (await buildStableHash({
      namespace: "cover-letter-blind-review",
      type: "reveal-map",
      version: 1,
      value: body,
    })) !== revealMapHash
  ) {
    throw new Error("QUALITY-EVAL-3C v2 reveal-map hash mismatch.");
  }
  if (
    args.revealMap.cohortId !== args.pack.cohortId ||
    args.revealMap.runId !== args.pack.runId ||
    args.revealMap.sourceRef !== args.pack.sourceRef ||
    args.revealMap.packHash !== args.pack.packHash ||
    args.revealMap.planHash !== args.plan.planHash ||
    args.revealMap.evaluationProtocol !== PROTOCOL
  ) {
    throw new Error("QUALITY-EVAL-3C v2 reveal map does not match the pack.");
  }
  const labels = args.revealMap.entries.map((entry) => entry.blindLabel);
  if (
    labels.length !== coverage.all.length ||
    new Set(labels).size !== labels.length ||
    [...labels].sort().join("\n") !== coverage.all.join("\n")
  ) {
    throw new Error("QUALITY-EVAL-3C v2 reveal coverage is incomplete.");
  }
  const expectedVariants = new Set(
    (args.plan.version === "cover_letter_eval3c_follow_up_plan_v2"
      ? [args.plan.selectedVariant]
      : args.plan.initialVariants
    ).map(
      (variant) =>
        `${variant.variantId}:${variant.writerModel}:${variant.reasoningEffort}`,
    ),
  );
  const actualVariants = new Set(
    args.revealMap.entries.map(
      (entry) =>
        `${entry.variantId}:${entry.writerModel}:${entry.reasoningEffort}`,
    ),
  );
  if (
    actualVariants.size !== expectedVariants.size ||
    [...actualVariants].some((value) => !expectedVariants.has(value))
  ) {
    throw new Error("QUALITY-EVAL-3C v2 reveal cell matrix is not exact.");
  }
  if (
    args.revealMap.entries.some(
      (entry) =>
        entry.caseId !== args.plan.developmentCaseId ||
        entry.writerProvider !== "openai" ||
        (entry.artifactHash !== null && !isHash(entry.artifactHash)) ||
        (entry.provenanceHash !== null && !isHash(entry.provenanceHash)) ||
        ((entry.outcome === "human_review_pending" ||
          entry.outcome === "editorial_veto") &&
          !isHash(entry.artifactHash)) ||
        (entry.outcome === "safety_veto" &&
          (entry.artifactHash !== null || entry.provenanceHash !== null)),
    )
  ) {
    throw new Error("QUALITY-EVAL-3C v2 reveal entry contract is invalid.");
  }
  const revealByLabel = new Map(
    args.revealMap.entries.map((entry) => [entry.blindLabel, entry]),
  );
  if (
    args.pack.entries.some(
      (entry) =>
        revealByLabel.get(entry.blindLabel)?.outcome !== "human_review_pending",
    ) ||
    args.pack.failureMatrix.some(
      (entry) => revealByLabel.get(entry.blindLabel)?.outcome !== entry.outcome,
    )
  ) {
    throw new Error("QUALITY-EVAL-3C v2 reveal outcomes are inconsistent.");
  }
}

export async function selectCoverLetterEval3cV2AdaptiveAction(args: {
  plan: CoverLetterEval3cV2Plan;
  pack: CoverLetterEval3cV2BlindReviewPack;
  executionCommitment: CoverLetterEval3cV2ExecutionCommitment;
  submissions: readonly CoverLetterEval3cV2ReviewSubmission[];
  blindDecision: CoverLetterEval3cV2BlindDecision;
  revealMap: CoverLetterEval3cV2RevealMap;
}): Promise<CoverLetterEval3cV2AdaptiveAction> {
  const recomputed = await evaluateCoverLetterEval3cV2BlindReviews(args);
  const { decisionHash: suppliedHash, ...suppliedBody } = args.blindDecision;
  if (
    (await decisionHash(suppliedBody)) !== suppliedHash ||
    recomputed.decisionHash !== suppliedHash ||
    recomputed.reviewSetHash !== args.blindDecision.reviewSetHash ||
    recomputed.status !== "COMPLETE"
  ) {
    throw new Error(
      "QUALITY-EVAL-3C v2 requires the canonical complete blind decision.",
    );
  }
  await assertReveal(args);
  await assertRevealMatchesCommitment({
    plan: args.plan,
    pack: args.pack,
    revealMap: args.revealMap,
    commitment: args.executionCommitment,
  });
  const decisionByLabel = new Map(
    recomputed.entries.map((entry) => [entry.blindLabel, entry]),
  );
  const revealByModel = new Map(
    args.revealMap.entries.map((entry) => [entry.writerModel, entry]),
  );
  const lunaReveal = revealByModel.get("gpt-5.6-luna")!;
  const solReveal = revealByModel.get("gpt-5.6-sol")!;
  const luna = decisionByLabel.get(lunaReveal.blindLabel)!;
  const sol = decisionByLabel.get(solReveal.blindLabel)!;
  if (
    luna.acceptability === "acceptable" &&
    sol.acceptability === "acceptable"
  ) {
    return { action: "freeze_both", reason: "both_acceptable" };
  }
  if (luna.acceptability === "acceptable") {
    return {
      action: "follow_up",
      blindLabel: luna.blindLabel,
      writerModel: "gpt-5.6-luna",
      reasoningEffort: "none",
      reason: "luna_acceptable_lower_effort_check",
    };
  }
  if (sol.acceptability === "acceptable") {
    return luna.acceptability === "near_acceptable"
      ? {
          action: "follow_up",
          blindLabel: luna.blindLabel,
          writerModel: "gpt-5.6-luna",
          reasoningEffort: "medium",
          reason: "sol_acceptable_luna_near",
        }
      : {
          action: "stop",
          reason: "sol_acceptable_luna_not_acceptable",
        };
  }
  const near = recomputed.entries.filter(
    (entry) => entry.acceptability === "near_acceptable",
  );
  if (near.length === 1) {
    const reveal = args.revealMap.entries.find(
      (entry) => entry.blindLabel === near[0]!.blindLabel,
    )!;
    return {
      action: "follow_up",
      blindLabel: reveal.blindLabel,
      writerModel: reveal.writerModel,
      reasoningEffort: "medium",
      reason: "single_near_acceptable",
    };
  }
  if (near.length === 2) {
    const reveal = args.revealMap.entries.find(
      (entry) => entry.blindLabel === recomputed.preferredNearLabel,
    );
    if (!reveal) {
      throw new Error("QUALITY-EVAL-3C v2 blind tie-break is incomplete.");
    }
    return {
      action: "follow_up",
      blindLabel: reveal.blindLabel,
      writerModel: reveal.writerModel,
      reasoningEffort: "medium",
      reason: "blind_near_tiebreak",
    };
  }
  return { action: "stop", reason: "prompt_or_synthesis_diagnosis" };
}

function followUpApproval(args: {
  planHash: string;
  body: Omit<CoverLetterEval3cV2FollowUpPlan, "approvalPhrase" | "planHash">;
}): string {
  return `J’approuve EVAL3C v2 follow-up : runId ${args.body.runId}, sourceRef ${args.body.sourceRef}, outputBindingHash ${args.body.outputBindingHash}, initialPlanHash ${args.body.initialPlanHash}, executionCommitmentHash ${args.body.executionCommitmentHash}, packHash ${args.body.packHash}, reviewSetHash ${args.body.reviewSetHash}, blindDecisionHash ${args.body.blindDecisionHash}, revealMapHash ${args.body.revealMapHash}, planHash ${args.planHash}, 1 appel provider maximum, budget USD ${QUALITY_EVAL3C_V2_FOLLOW_UP_MAX_USD.toFixed(2)}, cellule ${args.body.selectedVariant.writerModel}@${args.body.selectedVariant.reasoningEffort}, retries 0, repairs 0, aucun évaluateur LLM, development uniquement, aucun held-out.`;
}

async function buildCoverLetterEval3cV2FollowUpPlanForBinding(args: {
  initialPlan: CoverLetterEval3cV2Plan;
  pack: CoverLetterEval3cV2BlindReviewPack;
  executionCommitment: CoverLetterEval3cV2ExecutionCommitment;
  submissions: readonly CoverLetterEval3cV2ReviewSubmission[];
  blindDecision: CoverLetterEval3cV2BlindDecision;
  revealMap: CoverLetterEval3cV2RevealMap;
  runId: string;
  outputBindingHash: string;
}): Promise<CoverLetterEval3cV2FollowUpPlan> {
  assertNeutralRunId(args.runId);
  const selection = await selectCoverLetterEval3cV2AdaptiveAction({
    plan: args.initialPlan,
    ...args,
  });
  if (selection.action !== "follow_up") {
    throw new Error("QUALITY-EVAL-3C v2 has no authorized follow-up cell.");
  }
  const preflight = await buildCoverLetterBenchmarkOfflineCostPreflight({
    cases: [developmentCase()],
    writerModels: [selection.writerModel],
    reasoningEffort: selection.reasoningEffort,
    targetReservationUsd: QUALITY_EVAL3C_V2_FOLLOW_UP_MAX_USD,
  });
  if (
    preflight.plannedProviderCalls !== 1 ||
    preflight.providerMaxRetries !== 0 ||
    preflight.maxRepairs !== 0 ||
    !preflight.targetReservationProven ||
    preflight.minimumSafeReservationUsd > QUALITY_EVAL3C_V2_FOLLOW_UP_MAX_USD
  ) {
    throw new Error("QUALITY-EVAL-3C v2 follow-up budget is not exact.");
  }
  const body: Omit<
    CoverLetterEval3cV2FollowUpPlan,
    "approvalPhrase" | "planHash"
  > = {
    version: "cover_letter_eval3c_follow_up_plan_v2",
    status: "READY_FOR_APPROVAL",
    sourceRef: args.initialPlan.sourceRef,
    runId: args.runId,
    cohortId: QUALITY_EVAL3C_V2_COHORT_ID,
    outputBindingHash: args.outputBindingHash,
    developmentCaseId: QUALITY_EVAL3C_DEVELOPMENT_CASE_ID,
    initialPlanHash: args.initialPlan.planHash,
    executionCommitmentHash: args.executionCommitment.commitmentHash,
    initialRunId: args.initialPlan.runId,
    packHash: args.pack.packHash,
    reviewSetHash: args.blindDecision.reviewSetHash,
    blindDecisionHash: args.blindDecision.decisionHash,
    revealMapHash: args.revealMap.revealMapHash,
    selectedVariant: {
      variantId: `${selection.writerModel === "gpt-5.6-luna" ? "luna" : "sol"}-${selection.reasoningEffort}`,
      blindLabel: selection.blindLabel,
      writerModel: selection.writerModel,
      reasoningEffort: selection.reasoningEffort,
    },
    plannedProviderCalls: 1,
    providerMaxRetries: 0,
    maxRepairs: 0,
    llmEvaluator: "none",
    heldOutAccess: "forbidden",
    budget: {
      maxUsd: QUALITY_EVAL3C_V2_FOLLOW_UP_MAX_USD,
      declaredMaxUsdPerCall: preflight.declaredMaxUsdPerCall,
      minimumSafeReservationUsd: preflight.minimumSafeReservationUsd,
      reservationBasis: "conservative_offline_transport_ceiling",
    },
    approvalPhraseVersion: FOLLOW_UP_APPROVAL_VERSION,
  };
  const planHash = await buildStableHash({
    namespace: PROTOCOL,
    type: "follow-up-plan",
    version: 2,
    value: body,
  });
  return {
    ...body,
    planHash,
    approvalPhrase: followUpApproval({ body, planHash }),
  };
}

export async function buildCoverLetterEval3cV2FollowUpPlan(args: {
  initialPlan: CoverLetterEval3cV2Plan;
  pack: CoverLetterEval3cV2BlindReviewPack;
  executionCommitment: CoverLetterEval3cV2ExecutionCommitment;
  submissions: readonly CoverLetterEval3cV2ReviewSubmission[];
  blindDecision: CoverLetterEval3cV2BlindDecision;
  revealMap: CoverLetterEval3cV2RevealMap;
  runId: string;
  outputDirectory: string;
}): Promise<CoverLetterEval3cV2FollowUpPlan> {
  return buildCoverLetterEval3cV2FollowUpPlanForBinding({
    ...args,
    outputBindingHash: await buildOutputBindingHash(args.outputDirectory),
  });
}

export type CoverLetterEval3cV2FollowUpRunArgs = Readonly<{
  plan: CoverLetterEval3cV2FollowUpPlan;
  initialPlan: CoverLetterEval3cV2Plan;
  pack: CoverLetterEval3cV2BlindReviewPack;
  executionCommitment: CoverLetterEval3cV2ExecutionCommitment;
  submissions: readonly CoverLetterEval3cV2ReviewSubmission[];
  blindDecision: CoverLetterEval3cV2BlindDecision;
  revealMap: CoverLetterEval3cV2RevealMap;
  approvalPhrase: string;
  explicitLiveProviderOptIn: boolean;
  maxCalls: number;
  maxRepairs: number;
  maxUsd: number;
  declaredMaxUsdPerCall: number;
  outputDirectory: string;
  apiKey: string;
  generateRecord?: Generator;
  executionIdentity?: Readonly<{
    currentHeadSourceRef: string;
    currentWorktreeStatus: string;
  }>;
}>;

export async function runCoverLetterEval3cV2FollowUpCell(
  args: CoverLetterEval3cV2FollowUpRunArgs,
): Promise<
  Readonly<Record<string, unknown>> & {
    paths: Awaited<ReturnType<typeof writeCoverLetterEvalPrivateArtifacts>>;
    executionCommitment: CoverLetterEval3cV2ExecutionCommitment;
  }
> {
  const expectedPlan = await buildCoverLetterEval3cV2FollowUpPlan({
    initialPlan: args.initialPlan,
    pack: args.pack,
    executionCommitment: args.executionCommitment,
    submissions: args.submissions,
    blindDecision: args.blindDecision,
    revealMap: args.revealMap,
    runId: args.plan.runId,
    outputDirectory: args.outputDirectory,
  });
  if (
    args.plan.planHash !== expectedPlan.planHash ||
    JSON.stringify(args.plan) !== JSON.stringify(expectedPlan)
  ) {
    throw new Error("QUALITY-EVAL-3C v2 follow-up plan mismatch.");
  }
  const identity = args.executionIdentity ?? {
    currentHeadSourceRef: currentHead(),
    currentWorktreeStatus: currentStatus(),
  };
  if (args.executionIdentity && !args.generateRecord) {
    throw new Error(
      "QUALITY-EVAL-3C v2 test identity requires an injected generator.",
    );
  }
  if (
    args.approvalPhrase !== args.plan.approvalPhrase ||
    identity.currentHeadSourceRef !== args.plan.sourceRef ||
    identity.currentWorktreeStatus.trim() ||
    !args.explicitLiveProviderOptIn ||
    process.env.COVER_LETTER_EVAL_LIVE !== "1" ||
    args.maxCalls !== 1 ||
    args.maxRepairs !== 0 ||
    args.maxUsd !== args.plan.budget.maxUsd ||
    args.declaredMaxUsdPerCall !== args.plan.budget.declaredMaxUsdPerCall
  ) {
    throw new Error("QUALITY-EVAL-3C v2 exact follow-up live gate failed.");
  }
  if (!args.apiKey.trim()) {
    throw new Error("QUALITY-EVAL-3C v2 follow-up requires an API key.");
  }
  await assertCoverLetterEvalPrivateArtifactTargetsAvailable({
    outputDirectory: args.outputDirectory,
    ledgerFileName: FOLLOW_UP_LEDGER_FILE_NAME,
  });
  const budget = createCoverLetterEvalBudget({
    explicitLiveProviderOptIn: true,
    maxCalls: 1,
    maxRepairs: 0,
    maxUsd: args.plan.budget.maxUsd,
    declaredMaxUsdPerCall: args.plan.budget.declaredMaxUsdPerCall,
  });
  await acquireExecutionClaim({
    outputDirectory: args.outputDirectory,
    phase: "follow-up",
    planHash: args.plan.planHash,
    outputBindingHash: args.plan.outputBindingHash,
  });
  let completedCell: Cell | null = null;
  try {
    const benchmarkCase = developmentCase();
    const variant: CoverLetterEval3cVariant = args.plan.selectedVariant;
    const generate =
      args.generateRecord ?? benchmarkCoverLetterCaseForHumanReview;
    const cell = await collectCell({
      planHash: args.plan.planHash,
      sourceRef: args.plan.sourceRef,
      runId: args.plan.runId,
      benchmarkCase,
      variant,
      rawResult: await generate({
        benchmarkCase,
        writerModel: args.plan.selectedVariant.writerModel,
        reasoningEffort: args.plan.selectedVariant.reasoningEffort,
        apiKey: args.apiKey,
        budget,
      }),
    });
    completedCell = cell;
    const snapshot = budget.snapshot();
    if (
      snapshot.usage.reservedCalls !== 1 ||
      snapshot.usage.reservedRepairs !== 0 ||
      snapshot.usage.reservedUsd > args.plan.budget.maxUsd
    ) {
      throw new Error("QUALITY-EVAL-3C v2 follow-up budget accounting failed.");
    }
    const artifacts = await buildBlindArtifacts({
      plan: args.plan,
      benchmarkCase,
      cells: [cell],
    });
    const executionCommitment = await buildExecutionCommitment({
      plan: args.plan,
      pack: artifacts.pack,
      revealMap: artifacts.revealMap,
    });
    const ledger = {
      version: "cover_letter_eval3c_follow_up_ledger_v2",
      status:
        cell.outcome === "human_review_pending"
          ? "HUMAN_REVIEW_PENDING"
          : "OUTCOME_COMPLETE_NO_REVIEWABLE_ARTIFACTS",
      initialPlanHash: args.initialPlan.planHash,
      planHash: args.plan.planHash,
      packHash: args.pack.packHash,
      executionCommitmentHash: args.executionCommitment.commitmentHash,
      reviewSetHash: args.blindDecision.reviewSetHash,
      blindDecisionHash: args.blindDecision.decisionHash,
      revealMapHash: args.revealMap.revealMapHash,
      selectedVariant: args.plan.selectedVariant,
      executionCommitment,
      followUpPackHash: artifacts.pack.packHash,
      followUpRevealMapHash: artifacts.revealMap.revealMapHash,
      outcome: cell.outcome,
      artifactHash: cell.artifactHash,
      failureReceipts: cell.failureReceipt ? [cell.failureReceipt] : [],
      sendability: cell.sendability,
      diagnostic: cell.diagnostic,
      budget: snapshot,
      providerMaxRetries: 0,
      maxRepairs: 0,
      llmEvaluator: "none",
      heldOutAccess: "forbidden",
    } as const;
    const paths = await writeCoverLetterEvalPrivateArtifacts({
      outputDirectory: args.outputDirectory,
      expectedCohortId: QUALITY_EVAL3C_V2_COHORT_ID,
      pack: artifacts.pack,
      revealMap: artifacts.revealMap,
      ledger,
      packMarkdown: artifacts.markdown,
      ledgerFileName: FOLLOW_UP_LEDGER_FILE_NAME,
    });
    return {
      status: ledger.status,
      completedCellCount: 1,
      reviewableCellCount: cell.outcome === "human_review_pending" ? 1 : 0,
      budget: snapshot,
      executionCommitment,
      paths,
    };
  } catch (error) {
    try {
      await writeCoverLetterEvalPrivateEvidenceFile({
        outputDirectory: args.outputDirectory,
        fileName: FOLLOW_UP_LEDGER_FILE_NAME,
        content: `${JSON.stringify(
          {
            version: "cover_letter_eval3c_follow_up_failure_ledger_v2",
            status: "FAILED_CLOSED",
            initialPlanHash: args.initialPlan.planHash,
            planHash: args.plan.planHash,
            packHash: args.pack.packHash,
            executionCommitmentHash: args.executionCommitment.commitmentHash,
            reviewSetHash: args.blindDecision.reviewSetHash,
            blindDecisionHash: args.blindDecision.decisionHash,
            revealMapHash: args.revealMap.revealMapHash,
            selectedVariant: args.plan.selectedVariant,
            completedCellCount: completedCell ? 1 : 0,
            completedCells: completedCell
              ? [
                  {
                    variantId: completedCell.variant.variantId,
                    outcome: completedCell.outcome,
                    artifactHash: completedCell.artifactHash,
                    failureReceipt: completedCell.failureReceipt,
                    sendability: completedCell.sendability,
                    diagnostic: completedCell.diagnostic,
                  },
                ]
              : [],
            budget: budget.snapshot(),
            providerMaxRetries: 0,
            maxRepairs: 0,
            llmEvaluator: "none",
            heldOutAccess: "forbidden",
          },
          null,
          2,
        )}\n`,
      });
    } catch {
      // Preserve the original classified failure without raw provider data.
    }
    throw error;
  }
}

export type CoverLetterEval3cV2CliOptions = Readonly<{
  help: boolean;
  planOnly: boolean;
  live: boolean;
  followUpPlanOnly: boolean;
  followUpLive: boolean;
  runId: string | undefined;
  sourceRef: string | undefined;
  outputDirectory: string | undefined;
  approvalPhrase: string | undefined;
  followUpInput: string | undefined;
}>;

export function parseCoverLetterEval3cV2CliOptions(
  argv: readonly string[],
): CoverLetterEval3cV2CliOptions {
  const options = {
    help: argv.length === 0,
    planOnly: false,
    live: false,
    followUpPlanOnly: false,
    followUpLive: false,
    runId: undefined as string | undefined,
    sourceRef: undefined as string | undefined,
    outputDirectory: undefined as string | undefined,
    approvalPhrase: undefined as string | undefined,
    followUpInput: undefined as string | undefined,
  };
  for (const argument of argv) {
    if (argument === "--help") options.help = true;
    else if (argument === "--plan-only") options.planOnly = true;
    else if (argument === "--live") options.live = true;
    else if (argument === "--follow-up-plan-only")
      options.followUpPlanOnly = true;
    else if (argument === "--follow-up-live") options.followUpLive = true;
    else if (argument.startsWith("--run-id="))
      options.runId = argument.slice("--run-id=".length);
    else if (argument.startsWith("--source-ref="))
      options.sourceRef = argument.slice("--source-ref=".length);
    else if (argument.startsWith("--output-dir="))
      options.outputDirectory = argument.slice("--output-dir=".length);
    else if (argument.startsWith("--approval-phrase="))
      options.approvalPhrase = argument.slice("--approval-phrase=".length);
    else if (argument.startsWith("--follow-up-input="))
      options.followUpInput = argument.slice("--follow-up-input=".length);
    else
      throw new Error(
        "QUALITY-EVAL-3C v2 CLI refuses an unsupported argument.",
      );
  }
  if (options.help) return options;
  if (!options.runId || !options.outputDirectory) {
    throw new Error(
      "QUALITY-EVAL-3C v2 CLI requires --run-id and --output-dir.",
    );
  }
  const modeCount = [
    options.planOnly,
    options.live,
    options.followUpPlanOnly,
    options.followUpLive,
  ].filter(Boolean).length;
  if (modeCount !== 1) {
    throw new Error(
      "QUALITY-EVAL-3C v2 CLI requires exactly one execution mode.",
    );
  }
  if ((options.planOnly || options.live) && !options.sourceRef) {
    throw new Error("QUALITY-EVAL-3C v2 initial CLI requires --source-ref.");
  }
  if (
    (options.followUpPlanOnly || options.followUpLive) &&
    !options.followUpInput
  ) {
    throw new Error(
      "QUALITY-EVAL-3C v2 follow-up CLI requires --follow-up-input.",
    );
  }
  if ((options.live || options.followUpLive) && !options.approvalPhrase) {
    throw new Error("QUALITY-EVAL-3C v2 live CLI requires an approval phrase.");
  }
  return options;
}

const CLI_USAGE = `Usage:
  npx tsx scripts/evals/cover-letter-eval3c-v2.ts --run-id=<id> --source-ref=<sha> --output-dir=<private-path> --plan-only
  COVER_LETTER_EVAL_LIVE=1 OPENAI_API_KEY=[REDACTED] npx tsx scripts/evals/cover-letter-eval3c-v2.ts --run-id=<id> --source-ref=<sha> --output-dir=<private-path> --approval-phrase='<exact phrase>' --live
  npx tsx scripts/evals/cover-letter-eval3c-v2.ts --run-id=<id> --output-dir=<private-path> --follow-up-input=<private-json> --follow-up-plan-only
  COVER_LETTER_EVAL_LIVE=1 OPENAI_API_KEY=[REDACTED] npx tsx scripts/evals/cover-letter-eval3c-v2.ts --run-id=<id> --output-dir=<private-path> --follow-up-input=<private-json> --approval-phrase='<exact phrase>' --follow-up-live`;

function safeCliFailureMessage(error: unknown): string {
  return error instanceof Error &&
    error.message.startsWith("QUALITY-EVAL-3C v2")
    ? error.message
    : "QUALITY-EVAL-3C v2 failed closed on an unclassified error.";
}

type CoverLetterEval3cV2FollowUpCliInput = Readonly<{
  initialPlan: CoverLetterEval3cV2Plan;
  pack: CoverLetterEval3cV2BlindReviewPack;
  executionCommitment: CoverLetterEval3cV2ExecutionCommitment;
  submissions: readonly CoverLetterEval3cV2ReviewSubmission[];
  blindDecision: CoverLetterEval3cV2BlindDecision;
  revealMap: CoverLetterEval3cV2RevealMap;
}>;

async function readFollowUpCliInput(
  filePath: string,
): Promise<CoverLetterEval3cV2FollowUpCliInput> {
  try {
    const value: unknown = JSON.parse(await readFile(filePath, "utf8"));
    if (!isRecord(value)) throw new Error("invalid bundle");
    return value as CoverLetterEval3cV2FollowUpCliInput;
  } catch {
    throw new Error(
      "QUALITY-EVAL-3C v2 follow-up input is unreadable or invalid JSON.",
    );
  }
}

async function main(): Promise<void> {
  const options = parseCoverLetterEval3cV2CliOptions(process.argv.slice(2));
  if (options.help) {
    console.log(CLI_USAGE);
    return;
  }
  if (options.followUpPlanOnly || options.followUpLive) {
    const input = await readFollowUpCliInput(options.followUpInput!);
    const plan = await buildCoverLetterEval3cV2FollowUpPlan({
      ...input,
      runId: options.runId!,
      outputDirectory: options.outputDirectory!,
    });
    if (options.followUpPlanOnly) {
      console.log(JSON.stringify(plan, null, 2));
      return;
    }
    const result = await runCoverLetterEval3cV2FollowUpCell({
      plan,
      ...input,
      approvalPhrase: options.approvalPhrase!,
      explicitLiveProviderOptIn: true,
      maxCalls: plan.plannedProviderCalls,
      maxRepairs: plan.maxRepairs,
      maxUsd: plan.budget.maxUsd,
      declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
      outputDirectory: options.outputDirectory!,
      apiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
    });
    console.log(
      JSON.stringify(
        {
          status: result.status,
          planHash: plan.planHash,
          sourceRef: plan.sourceRef,
          runId: plan.runId,
          completedCellCount: result.completedCellCount,
          reviewableCellCount: result.reviewableCellCount,
          budget: result.budget,
          executionCommitment: result.executionCommitment,
          privatePaths: result.paths,
        },
        null,
        2,
      ),
    );
    return;
  }
  const plan = await buildCoverLetterEval3cV2Plan({
    runId: options.runId!,
    sourceRef: options.sourceRef!,
    outputDirectory: options.outputDirectory!,
  });
  if (options.planOnly) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  const result = await runCoverLetterEval3cV2InitialScreen({
    approvalPhrase: options.approvalPhrase!,
    explicitLiveProviderOptIn: true,
    maxCalls: plan.plannedProviderCalls,
    maxRepairs: plan.maxRepairs,
    maxUsd: plan.budget.maxUsd,
    declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
    outputDirectory: options.outputDirectory!,
    runId: plan.runId,
    sourceRef: plan.sourceRef,
    apiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  });
  console.log(
    JSON.stringify(
      {
        status: result.status,
        planHash: plan.planHash,
        sourceRef: plan.sourceRef,
        runId: plan.runId,
        completedCellCount: result.completedCellCount,
        reviewableCellCount: result.reviewableCellCount,
        safetyVetoCount: result.safetyVetoCount,
        editorialVetoCount: result.editorialVetoCount,
        budget: result.budget,
        privatePaths: result.paths,
      },
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolvePath(process.argv[1])).href
) {
  void main().catch((error: unknown) => {
    console.error("Cover-letter EVAL3C v2 runner failed closed.");
    console.error(safeCliFailureMessage(error));
    process.exitCode = 1;
  });
}
