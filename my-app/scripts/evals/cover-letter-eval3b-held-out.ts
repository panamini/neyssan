import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { buildStableHash } from "../../src/modules/application-harness/fingerprints";
import {
  buildCoverLetterEvalArtifactHash,
  type CoverLetterEvalArtifact,
} from "./cover-letter-eval-artifact";
import {
  buildCoverLetterBlindReviewArtifacts,
  completedCoverLetterBlindReviewSchema,
  renderCoverLetterBlindReviewMarkdown,
  type CompletedCoverLetterBlindReview,
  type CoverLetterBlindReviewPack,
  type CoverLetterBlindReviewRevealMap,
} from "./cover-letter-blind-review";
import {
  benchmarkCoverLetterCaseForHumanReview,
  buildCoverLetterBenchmarkOfflineCostPreflight,
  buildCoverLetterHumanReviewPlan,
  type CoverLetterBenchmarkFailureRecord,
  type CoverLetterHumanReviewRecord,
} from "./benchmark-cover-letter-writers";
import type { CoverLetterBenchmarkCase } from "./cases/cover-letter/cases";
import { createCoverLetterEvalBudget } from "./cover-letter-eval-budget";
import {
  QUALITY_EVAL3A_COHORT_ID,
  QUALITY_EVAL3A_DEVELOPMENT_CASE_IDS,
  QUALITY_EVAL3A_HELD_OUT_CASE_IDS,
  QUALITY_EVAL3A_WRITER_MODELS,
  getCoverLetterEval3aHeldOutCases,
} from "./cover-letter-eval3a-held-out";
import {
  assertCoverLetterEvalPrivateArtifactTargetsAvailable,
  writeCoverLetterEvalPrivateArtifacts,
  writeCoverLetterEvalPrivateEvidenceFile,
} from "./cover-letter-eval3a-held-out";

export const QUALITY_EVAL3B_COHORT_ID = "quality-eval-3b-outcome-complete-v1";
export const QUALITY_EVAL3B_REUSED_SOURCE_COHORT_ID = QUALITY_EVAL3A_COHORT_ID;
export const QUALITY_EVAL3B_DEVELOPMENT_CASE_IDS =
  QUALITY_EVAL3A_DEVELOPMENT_CASE_IDS;
export const QUALITY_EVAL3B_HELD_OUT_CASE_IDS =
  QUALITY_EVAL3A_HELD_OUT_CASE_IDS;
export const QUALITY_EVAL3B_WRITER_MODELS = QUALITY_EVAL3A_WRITER_MODELS;
export const QUALITY_EVAL3B_LIVE_MAX_USD = 2;

const QUALITY_EVAL3B_APPROVAL_PHRASE_VERSION =
  "quality_eval3b_approval_phrase_v1";
const QUALITY_EVAL3B_RUN_ID_PATTERN =
  /^quality-eval-3b-outcome-complete-[a-z0-9-]+$/u;
const QUALITY_EVAL3B_LEDGER_FILE_NAME = "eval3b-run-ledger.json";
const QUALITY_EVAL3B_PROTOCOL = "quality_eval3b_outcome_complete_v1" as const;
const QUALITY_EVAL3B_ALLOWED_FINALIZATION_ERRORS = new Set([
  "proposal_finalization_error",
  "error",
  "unknown_error",
]);
const QUALITY_EVAL3B_ALLOWED_FAILURE_STAGES = new Set([
  "cleaned_body_selection",
  "substantive_body_assertion",
  "finalization",
  "validation",
]);
const QUALITY_EVAL3B_ALLOWED_FAILURE_ISSUES = new Set([
  "adjacent_direct_fit",
  "candidate_backed_evidence_missing",
  "candidate_name_mismatch",
  "factual_inventory",
  "generic_tone",
  "greeting_leakage",
  "non_repairable_validation",
  "weak_employer_argument",
]);
const DIAGNOSTIC_TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

type CoverLetterEval3bWriterModel =
  (typeof QUALITY_EVAL3B_WRITER_MODELS)[number];

export type CoverLetterEval3bPlan = Readonly<{
  version: "cover_letter_eval3b_plan_v1";
  status: "READY_FOR_APPROVAL";
  sourceRef: string;
  runId: string;
  cohortId: typeof QUALITY_EVAL3B_COHORT_ID;
  reusedSourceCohortId: typeof QUALITY_EVAL3B_REUSED_SOURCE_COHORT_ID;
  developmentCaseIds: typeof QUALITY_EVAL3B_DEVELOPMENT_CASE_IDS;
  heldOutCaseIds: typeof QUALITY_EVAL3B_HELD_OUT_CASE_IDS;
  writerModels: Readonly<{
    control: "gpt-5.5";
    candidate: "gpt-5.6-sol";
  }>;
  plannedProviderCalls: 10;
  providerMaxRetries: 0;
  maxRepairs: 0;
  llmEvaluator: "none";
  cohortReuseGate: Readonly<{
    status: "PASS";
    basis: "no_raw_output_tuning_rejection_metadata_only";
    productionWriterOrFinalizerChanged: false;
  }>;
  budget: Readonly<{
    maxUsd: typeof QUALITY_EVAL3B_LIVE_MAX_USD;
    declaredMaxUsdPerCall: number;
    minimumSafeReservationUsd: number;
    reservationBasis: "conservative_offline_transport_ceiling";
  }>;
  blindHumanReview: Readonly<{
    mode: "blind_human_review_only";
    revealTiming: "after_all_reviews_complete";
    requiredReviewerLanguages: readonly ["Arabic", "English", "French"];
    primaryNarrativeCriteria: readonly [
      "persuasion",
      "tone",
      "economy",
      "commercialAcceptability",
    ];
    safetyVetoCriteria: readonly [
      "factualGrounding",
      "credibility",
      "structure",
    ];
  }>;
  verdictContract: Readonly<{
    version: "cover_letter_eval3b_human_verdict_v1";
    positiveRequires: readonly [
      "zero_candidate_safety_veto_failures",
      "at_least_four_valid_pairs",
      "all_required_languages_covered",
      "candidate_primary_pass_total_strictly_exceeds_control",
      "candidate_commercial_acceptability_passes_not_below_control",
      "zero_candidate_cl1_cl2_veto_failures",
    ];
    controlFailureHandling: "never_automatic_candidate_narrative_win";
    tieOrIncompleteOutcome: "NOT_POSITIVE";
    productionActivation: "OUT_OF_SCOPE";
  }>;
  approvalPhraseVersion: typeof QUALITY_EVAL3B_APPROVAL_PHRASE_VERSION;
  approvalPhrase: string;
  planHash: string;
}>;

export type CoverLetterEval3bFailureReceipt = Readonly<{
  version: "cover_letter_eval3b_failure_receipt_v1";
  cohortId: typeof QUALITY_EVAL3B_COHORT_ID;
  planHash: string;
  sourceRef: string;
  runId: string;
  caseId: string;
  writerModel: CoverLetterEval3bWriterModel;
  status: "finalization_failed";
  safetyVeto: "automatic";
  artifactHash: string | null;
  diagnostics: Readonly<{
    errorClass: string;
    failureStage: string | null;
    failureIssues: readonly string[];
  }>;
}>;

export type CoverLetterEval3bCellOutcome = Readonly<{
  caseId: string;
  writerModel: CoverLetterEval3bWriterModel;
  outcome: "human_review_pending" | "safety_veto";
}>;

export type CoverLetterEval3bBlindReviewPack = Omit<
  CoverLetterBlindReviewPack,
  "packHash"
> & {
  evaluationProtocol: typeof QUALITY_EVAL3B_PROTOCOL;
  failureMatrix: readonly Readonly<{
    blindLabel: string;
    outcome: "safety_veto";
    textIncluded: false;
  }>[];
  packHash: string;
};

type CoverLetterEval3bRevealEntry =
  CoverLetterBlindReviewRevealMap["entries"][number] & {
    outcome: CoverLetterEval3bCellOutcome["outcome"];
  };

export type CoverLetterEval3bBlindReviewRevealMap = Omit<
  CoverLetterBlindReviewRevealMap,
  "entries"
> & {
  evaluationProtocol: typeof QUALITY_EVAL3B_PROTOCOL;
  entries: readonly CoverLetterEval3bRevealEntry[];
};

type CoverLetterEval3bGenerateRecord = (args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: CoverLetterEval3bWriterModel;
  apiKey: string;
  budget: ReturnType<typeof createCoverLetterEvalBudget>;
}) => Promise<unknown>;

export type CoverLetterEval3bRunArgs = Readonly<{
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
  generateRecord?: CoverLetterEval3bGenerateRecord;
}>;

type CoverLetterEval3bRunStatus =
  | "HUMAN_REVIEW_PENDING"
  | "OUTCOME_COMPLETE_NO_REVIEWABLE_ARTIFACTS";

export type CoverLetterEval3bRunResult = Readonly<{
  status: CoverLetterEval3bRunStatus;
  plan: CoverLetterEval3bPlan;
  budget: ReturnType<
    ReturnType<typeof createCoverLetterEvalBudget>["snapshot"]
  >;
  completedCellCount: 10;
  reviewableCellCount: number;
  safetyVetoCount: number;
  failureReceipts: readonly CoverLetterEval3bFailureReceipt[];
  paths: Awaited<ReturnType<typeof writeCoverLetterEvalPrivateArtifacts>>;
}>;

export type CoverLetterEval3bCliSafeResult = Readonly<{
  status: CoverLetterEval3bRunStatus;
  planHash: string;
  runId: string;
  sourceRef: string;
  budget: Readonly<{
    maxCalls: number;
    maxRepairs: number;
    maxUsd: number;
    declaredMaxUsdPerCall: number;
    reservedCalls: number;
    reservedRepairs: number;
    reservedUsd: number;
  }>;
  completedCellCount: number;
  reviewableCellCount: number;
  safetyVetoCount: number;
  privatePaths: Readonly<Record<string, string>>;
}>;

type Eval3bCell = Readonly<{
  key: string;
  caseId: string;
  writerModel: CoverLetterEval3bWriterModel;
  writerProvider: "openai" | "mistral";
  outcome: CoverLetterEval3bCellOutcome["outcome"];
  artifactHash: string | null;
  provenanceHash: string | null;
  record: CoverLetterHumanReviewRecord | CoverLetterBenchmarkFailureRecord;
  failureReceipt: CoverLetterEval3bFailureReceipt | null;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function cellKey(caseId: string, writerModel: string): string {
  return `${caseId}::${writerModel}`;
}

function sanitizeDiagnosticToken(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  return DIAGNOSTIC_TOKEN_RE.test(normalized) ? normalized : "redacted";
}

function sanitizeAllowlistedDiagnosticToken(
  value: unknown,
  allowlist: ReadonlySet<string>,
): string {
  const normalized = sanitizeDiagnosticToken(value);
  return allowlist.has(normalized) ? normalized : "redacted";
}

function assertSafeProvider(
  value: unknown,
): asserts value is "openai" | "mistral" {
  if (value !== "openai" && value !== "mistral") {
    throw new Error("QUALITY-EVAL-3B received an invalid provider identity.");
  }
}

function assertExpectedWriterProvider(
  writerModel: string,
  provider: "openai" | "mistral",
): void {
  if (
    provider !== "openai" ||
    !QUALITY_EVAL3B_WRITER_MODELS.includes(
      writerModel as CoverLetterEval3bWriterModel,
    )
  ) {
    throw new Error("QUALITY-EVAL-3B received an unexpected writer provider.");
  }
}

async function assertArtifactHash(
  artifact: CoverLetterEvalArtifact,
): Promise<string> {
  if (!isHash(artifact.artifactHash)) {
    throw new Error("QUALITY-EVAL-3B received an invalid artifact hash.");
  }
  const { artifactHash: _artifactHash, ...projection } = artifact;
  const expectedHash = await buildCoverLetterEvalArtifactHash(projection);
  if (expectedHash !== artifact.artifactHash) {
    throw new Error("QUALITY-EVAL-3B received an artifact hash mismatch.");
  }
  return artifact.artifactHash;
}

function assertRunManifest(args: {
  record: CoverLetterHumanReviewRecord;
  item: { benchmarkCase: CoverLetterBenchmarkCase; writerModel: string };
}): void {
  const manifest = args.record.runManifest;
  if (!manifest) {
    throw new Error("QUALITY-EVAL-3B requires a run manifest.");
  }
  if (
    manifest.caseId !== args.item.benchmarkCase.id ||
    manifest.requestedModel !== args.item.writerModel ||
    manifest.provider !== "openai" ||
    manifest.providerMaxRetries !== 0 ||
    manifest.artifactHash !== args.record.artifact.artifactHash ||
    !isHash(manifest.promptHash) ||
    !isHash(manifest.transport.requestProjectionHash) ||
    !isHash(manifest.transport.schemaTargetHash) ||
    (manifest.transport.systemPromptHash !== null &&
      !isHash(manifest.transport.systemPromptHash))
  ) {
    throw new Error("QUALITY-EVAL-3B received an invalid run manifest.");
  }
}

async function assertHumanReviewRecord(args: {
  item: {
    benchmarkCase: CoverLetterBenchmarkCase;
    writerModel: CoverLetterEval3bWriterModel;
  };
  record: CoverLetterHumanReviewRecord;
}): Promise<{ artifactHash: string; provenanceHash: string | null }> {
  const metadata = args.item.benchmarkCase.reviewMetadata;
  if (
    args.record.caseId !== args.item.benchmarkCase.id ||
    args.record.writerModel !== args.item.writerModel ||
    args.record.artifact.decision !== "accepted" ||
    typeof args.record.artifact.finalContent !== "string" ||
    args.record.artifact.finalContent.length === 0 ||
    args.record.letter !== args.record.artifact.finalContent ||
    args.record.diagnostics.validationResult !== "premium_validation_passed" ||
    args.record.outputLanguage !== metadata?.requestedOutputLanguage
  ) {
    throw new Error(
      "QUALITY-EVAL-3B received an invalid human-review artifact.",
    );
  }
  const artifactHash = await assertArtifactHash(args.record.artifact);
  assertSafeProvider(args.record.diagnostics.provider);
  assertExpectedWriterProvider(
    args.item.writerModel,
    args.record.diagnostics.provider,
  );
  if (
    args.record.artifact.provenanceHash !== null &&
    !isHash(args.record.artifact.provenanceHash)
  ) {
    throw new Error("QUALITY-EVAL-3B received an invalid provenance hash.");
  }
  assertRunManifest(args);
  return {
    artifactHash,
    provenanceHash: args.record.artifact.provenanceHash,
  };
}

async function buildFinalizationFailureReceipt(args: {
  plan: CoverLetterEval3bPlan;
  item: {
    benchmarkCase: CoverLetterBenchmarkCase;
    writerModel: CoverLetterEval3bWriterModel;
  };
  record: CoverLetterBenchmarkFailureRecord;
}): Promise<CoverLetterEval3bFailureReceipt> {
  const finalization = args.record.artifact?.diagnostics.finalization;
  const errorClass =
    finalization?.errorClass ?? args.record.diagnostics.failureReason;
  const failureStage =
    finalization?.failureStage ?? args.record.diagnostics.failureStage;
  if (
    args.record.caseId !== args.item.benchmarkCase.id ||
    args.record.writerModel !== args.item.writerModel ||
    args.record.diagnostics.validationResult !==
      "premium_finalization_failed" ||
    !errorClass ||
    !QUALITY_EVAL3B_ALLOWED_FINALIZATION_ERRORS.has(errorClass) ||
    !Array.isArray(args.record.diagnostics.failureIssues)
  ) {
    throw new Error(
      "QUALITY-EVAL-3B could not safely classify the finalization failure.",
    );
  }
  if (
    args.record.artifact &&
    (args.record.artifact.decision !== "rejected" ||
      args.record.artifact.finalContent !== null ||
      args.record.artifact.sections.length !== 0)
  ) {
    throw new Error(
      "QUALITY-EVAL-3B received a non-empty artifact for a finalization failure.",
    );
  }
  const artifactHash = args.record.artifact
    ? await assertArtifactHash(args.record.artifact)
    : null;
  assertSafeProvider(args.record.diagnostics.provider);
  assertExpectedWriterProvider(
    args.item.writerModel,
    args.record.diagnostics.provider,
  );
  if (
    args.record.artifact?.provenanceHash !== undefined &&
    args.record.artifact.provenanceHash !== null &&
    !isHash(args.record.artifact.provenanceHash)
  ) {
    throw new Error("QUALITY-EVAL-3B received an invalid provenance hash.");
  }
  return {
    version: "cover_letter_eval3b_failure_receipt_v1",
    cohortId: QUALITY_EVAL3B_COHORT_ID,
    planHash: args.plan.planHash,
    sourceRef: args.plan.sourceRef,
    runId: args.plan.runId,
    caseId: args.item.benchmarkCase.id,
    writerModel: args.item.writerModel,
    status: "finalization_failed",
    safetyVeto: "automatic",
    artifactHash,
    diagnostics: {
      errorClass: sanitizeDiagnosticToken(errorClass),
      failureStage:
        failureStage === null || failureStage === undefined
          ? null
          : sanitizeAllowlistedDiagnosticToken(
              failureStage,
              QUALITY_EVAL3B_ALLOWED_FAILURE_STAGES,
            ),
      failureIssues: [
        ...new Set(
          args.record.diagnostics.failureIssues.map((issue) =>
            sanitizeAllowlistedDiagnosticToken(
              issue,
              QUALITY_EVAL3B_ALLOWED_FAILURE_ISSUES,
            ),
          ),
        ),
      ].sort(),
    },
  };
}

export function getCoverLetterEval3bHeldOutCases(): CoverLetterBenchmarkCase[] {
  const sourceCases = getCoverLetterEval3aHeldOutCases();
  if (
    sourceCases.length !== QUALITY_EVAL3B_HELD_OUT_CASE_IDS.length ||
    sourceCases.some(
      (benchmarkCase, index) =>
        benchmarkCase.id !== QUALITY_EVAL3B_HELD_OUT_CASE_IDS[index],
    )
  ) {
    throw new Error(
      "QUALITY-EVAL-3B reused held-out cases drifted from EVAL3A.",
    );
  }
  return sourceCases.map((benchmarkCase) => ({
    ...benchmarkCase,
    reviewMetadata: {
      ...benchmarkCase.reviewMetadata!,
      cohortId: QUALITY_EVAL3B_COHORT_ID,
    },
  }));
}

function buildCoverLetterEval3bApprovalPhrase(args: {
  planHash: string;
  sourceRef: string;
  runId: string;
}): string {
  if (
    !isHash(args.planHash) ||
    !/^[a-f0-9]{40}$/u.test(args.sourceRef) ||
    !QUALITY_EVAL3B_RUN_ID_PATTERN.test(args.runId)
  ) {
    throw new Error("QUALITY-EVAL-3B approval requires exact plan identity.");
  }
  return `J’approuve EVAL3B v1 : runId ${args.runId}, sourceRef ${args.sourceRef}, planHash ${args.planHash}, 10 appels provider maximum, budget USD ${QUALITY_EVAL3B_LIVE_MAX_USD.toFixed(2)}, modèles gpt-5.5 et gpt-5.6-sol, retries 0, repairs 0, aucun évaluateur LLM, continuation uniquement pour finalization_failed comme safety veto sanitizé.`;
}

export async function buildCoverLetterEval3bPlan(args: {
  sourceRef: string;
  runId: string;
}): Promise<CoverLetterEval3bPlan> {
  if (
    !/^[a-f0-9]{40}$/u.test(args.sourceRef) ||
    !QUALITY_EVAL3B_RUN_ID_PATTERN.test(args.runId)
  ) {
    throw new Error("QUALITY-EVAL-3B plan requires exact sourceRef and runId.");
  }
  const cases = getCoverLetterEval3bHeldOutCases();
  const preflight = await buildCoverLetterBenchmarkOfflineCostPreflight({
    cases,
    writerModels: QUALITY_EVAL3B_WRITER_MODELS,
    targetReservationUsd: QUALITY_EVAL3B_LIVE_MAX_USD,
  });
  if (
    preflight.plannedProviderCalls !== 10 ||
    preflight.providerMaxRetries !== 0 ||
    preflight.maxRepairs !== 0 ||
    !preflight.targetReservationProven ||
    preflight.minimumSafeReservationUsd > QUALITY_EVAL3B_LIVE_MAX_USD
  ) {
    throw new Error("QUALITY-EVAL-3B offline budget contract is not exact.");
  }
  const body: Omit<CoverLetterEval3bPlan, "approvalPhrase" | "planHash"> = {
    version: "cover_letter_eval3b_plan_v1",
    status: "READY_FOR_APPROVAL",
    sourceRef: args.sourceRef,
    runId: args.runId,
    cohortId: QUALITY_EVAL3B_COHORT_ID,
    reusedSourceCohortId: QUALITY_EVAL3B_REUSED_SOURCE_COHORT_ID,
    developmentCaseIds: QUALITY_EVAL3B_DEVELOPMENT_CASE_IDS,
    heldOutCaseIds: QUALITY_EVAL3B_HELD_OUT_CASE_IDS,
    writerModels: { control: "gpt-5.5", candidate: "gpt-5.6-sol" },
    plannedProviderCalls: 10,
    providerMaxRetries: 0,
    maxRepairs: 0,
    llmEvaluator: "none",
    cohortReuseGate: {
      status: "PASS",
      basis: "no_raw_output_tuning_rejection_metadata_only",
      productionWriterOrFinalizerChanged: false,
    },
    budget: {
      maxUsd: QUALITY_EVAL3B_LIVE_MAX_USD,
      declaredMaxUsdPerCall: preflight.declaredMaxUsdPerCall,
      minimumSafeReservationUsd: preflight.minimumSafeReservationUsd,
      reservationBasis: "conservative_offline_transport_ceiling",
    },
    blindHumanReview: {
      mode: "blind_human_review_only",
      revealTiming: "after_all_reviews_complete",
      requiredReviewerLanguages: ["Arabic", "English", "French"],
      primaryNarrativeCriteria: [
        "persuasion",
        "tone",
        "economy",
        "commercialAcceptability",
      ],
      safetyVetoCriteria: ["factualGrounding", "credibility", "structure"],
    },
    verdictContract: {
      version: "cover_letter_eval3b_human_verdict_v1",
      positiveRequires: [
        "zero_candidate_safety_veto_failures",
        "at_least_four_valid_pairs",
        "all_required_languages_covered",
        "candidate_primary_pass_total_strictly_exceeds_control",
        "candidate_commercial_acceptability_passes_not_below_control",
        "zero_candidate_cl1_cl2_veto_failures",
      ],
      controlFailureHandling: "never_automatic_candidate_narrative_win",
      tieOrIncompleteOutcome: "NOT_POSITIVE",
      productionActivation: "OUT_OF_SCOPE",
    },
    approvalPhraseVersion: QUALITY_EVAL3B_APPROVAL_PHRASE_VERSION,
  };
  const planHash = await buildStableHash({
    namespace: "cover-letter-eval3b-outcome-complete",
    type: "plan",
    version: 1,
    body,
  });
  return {
    ...body,
    approvalPhrase: buildCoverLetterEval3bApprovalPhrase({
      planHash,
      sourceRef: args.sourceRef,
      runId: args.runId,
    }),
    planHash,
  };
}

export function assertCoverLetterEval3bLiveGate(args: {
  plan: CoverLetterEval3bPlan;
  approvalPhrase: string;
  sourceRef: string;
  runId: string;
  currentHeadSourceRef: string;
  explicitLiveProviderOptIn: boolean;
  environmentLiveProviderOptIn: boolean;
  maxCalls: number;
  maxRepairs: number;
  maxUsd: number;
  declaredMaxUsdPerCall: number;
}): void {
  if (
    args.plan.status !== "READY_FOR_APPROVAL" ||
    args.plan.sourceRef !== args.sourceRef ||
    args.sourceRef !== args.currentHeadSourceRef ||
    args.plan.runId !== args.runId ||
    args.approvalPhrase !== args.plan.approvalPhrase ||
    !args.explicitLiveProviderOptIn ||
    !args.environmentLiveProviderOptIn ||
    args.maxCalls !== args.plan.plannedProviderCalls ||
    args.maxRepairs !== 0 ||
    args.maxUsd !== args.plan.budget.maxUsd ||
    args.declaredMaxUsdPerCall !== args.plan.budget.declaredMaxUsdPerCall
  ) {
    throw new Error("QUALITY-EVAL-3B exact live gate was not satisfied.");
  }
}

export function assertCoverLetterEval3bWorktreeClean(
  porcelainStatus: string,
): void {
  if (porcelainStatus.trim()) {
    throw new Error(
      "QUALITY-EVAL-3B requires a clean Git worktree before live provider calls.",
    );
  }
}

export function assertCoverLetterEval3bDefaultProviderWorktreeClean(args: {
  generateRecord: unknown;
  resolvePorcelainStatus: () => string;
}): void {
  if (args.generateRecord === undefined) {
    assertCoverLetterEval3bWorktreeClean(args.resolvePorcelainStatus());
  }
}

function resolveCurrentGitHeadSourceRef(): string {
  const sourceRef = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (!/^[a-f0-9]{40}$/u.test(sourceRef)) {
    throw new Error("QUALITY-EVAL-3B could not resolve an exact Git HEAD.");
  }
  return sourceRef;
}

function resolveCurrentGitWorktreeStatus(): string {
  return execFileSync(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
}

function assertRunIdentity(args: { runId: string; sourceRef: string }): void {
  if (
    !QUALITY_EVAL3B_RUN_ID_PATTERN.test(args.runId) ||
    !/^[a-f0-9]{40}$/u.test(args.sourceRef)
  ) {
    throw new Error("QUALITY-EVAL-3B requires a safe runId and sourceRef.");
  }
}

function assertApiKey(apiKey: string): void {
  if (!apiKey.trim()) {
    throw new Error("QUALITY-EVAL-3B requires OPENAI_API_KEY after approval.");
  }
}

async function buildBlindReviewArtifacts(args: {
  plan: CoverLetterEval3bPlan;
  cases: readonly CoverLetterBenchmarkCase[];
  cells: readonly Eval3bCell[];
}): Promise<{
  pack: CoverLetterEval3bBlindReviewPack;
  revealMap: CoverLetterEval3bBlindReviewRevealMap;
  markdown: string;
}> {
  const successfulCells = args.cells.filter(
    (cell): cell is Eval3bCell & { record: CoverLetterHumanReviewRecord } =>
      cell.outcome === "human_review_pending",
  );
  const successfulCaseIds = new Set(successfulCells.map((cell) => cell.caseId));
  const successfulCases = args.cases.filter((benchmarkCase) =>
    successfulCaseIds.has(benchmarkCase.id),
  );
  const sourceArtifacts = await buildCoverLetterBlindReviewArtifacts({
    cohortId: QUALITY_EVAL3B_COHORT_ID,
    runId: args.plan.runId,
    sourceRef: args.plan.sourceRef,
    cases: successfulCases,
    records: successfulCells.map((cell) => cell.record),
  });
  const sourceRevealByLabel = new Map(
    sourceArtifacts.revealMap.entries.map((entry) => [entry.blindLabel, entry]),
  );
  const sourcePackEntryByLabel = new Map(
    sourceArtifacts.pack.entries.map((entry) => [entry.blindLabel, entry]),
  );
  const orderedCells = await Promise.all(
    args.cells.map(async (cell) => ({
      cell,
      sortKey: await buildStableHash({
        namespace: QUALITY_EVAL3B_PROTOCOL,
        type: "blind-order",
        version: 1,
        caseId: cell.caseId,
        writerModel: cell.writerModel,
        artifactHash: cell.artifactHash,
        outcome: cell.outcome,
      }),
    })),
  );
  orderedCells.sort((left, right) => left.sortKey.localeCompare(right.sortKey));
  const labelByCellKey = new Map(
    orderedCells.map(({ cell }, index) => [
      cell.key,
      `CL-${String(index + 1).padStart(3, "0")}`,
    ]),
  );
  const remappedEntries = successfulCells.map((cell) => {
    const sourceReveal = [...sourceRevealByLabel.values()].find(
      (entry) => cellKey(entry.caseId, entry.writerModel) === cell.key,
    );
    if (!sourceReveal) {
      throw new Error("QUALITY-EVAL-3B success reveal mapping is incomplete.");
    }
    const sourceEntry = sourcePackEntryByLabel.get(sourceReveal.blindLabel);
    if (!sourceEntry) {
      throw new Error("QUALITY-EVAL-3B success pack mapping is incomplete.");
    }
    return {
      ...sourceEntry,
      blindLabel: labelByCellKey.get(cell.key)!,
    };
  });
  const failureMatrix = orderedCells
    .filter(({ cell }) => cell.outcome === "safety_veto")
    .map(({ cell }) => ({
      blindLabel: labelByCellKey.get(cell.key)!,
      outcome: "safety_veto" as const,
      textIncluded: false as const,
    }));
  const { packHash: _sourcePackHash, ...sourcePackBody } = sourceArtifacts.pack;
  const packBody = {
    ...sourcePackBody,
    evaluationProtocol: QUALITY_EVAL3B_PROTOCOL,
    instructions: [
      ...sourcePackBody.instructions,
      "Failure-matrix cells are automatic safety vetoes and contain no generated text; identify them only by blind label until reveal.",
      ...failureMatrix.map(
        (entry) =>
          `Failure matrix: ${entry.blindLabel} is a safety_veto; generated text intentionally absent.`,
      ),
    ],
    entries: remappedEntries,
    failureMatrix,
  } as Omit<CoverLetterEval3bBlindReviewPack, "packHash">;
  const packHash = await buildStableHash({
    namespace: "cover-letter-blind-review",
    type: "pack",
    version: 1,
    value: packBody,
  });
  const pack: CoverLetterEval3bBlindReviewPack = { ...packBody, packHash };
  const revealBody = {
    version: "cover_letter_blind_review_reveal_v1" as const,
    evaluationProtocol: QUALITY_EVAL3B_PROTOCOL,
    cohortId: args.plan.cohortId,
    runId: args.plan.runId,
    sourceRef: args.plan.sourceRef,
    packHash,
    entries: orderedCells.map(({ cell }) => ({
      blindLabel: labelByCellKey.get(cell.key)!,
      caseId: cell.caseId,
      writerProvider: cell.writerProvider,
      writerModel: cell.writerModel,
      artifactHash: cell.artifactHash,
      provenanceHash: cell.provenanceHash,
      outcome: cell.outcome,
    })),
  } satisfies Omit<CoverLetterEval3bBlindReviewRevealMap, "revealMapHash">;
  const revealMap: CoverLetterEval3bBlindReviewRevealMap = {
    ...revealBody,
    revealMapHash: await buildStableHash({
      namespace: "cover-letter-blind-review",
      type: "reveal-map",
      version: 1,
      value: revealBody,
    }),
  };
  const markdown = renderCoverLetterBlindReviewMarkdown(
    pack as CoverLetterBlindReviewPack,
  );
  return { pack, revealMap, markdown };
}

function buildFailureLedger(args: {
  plan: CoverLetterEval3bPlan;
  budget: ReturnType<typeof createCoverLetterEvalBudget>;
  completedCells: readonly Eval3bCell[];
}): Readonly<Record<string, unknown>> {
  return {
    version: "cover_letter_eval3b_failure_ledger_v1",
    status: "FAILED_CLOSED",
    cohortId: args.plan.cohortId,
    planHash: args.plan.planHash,
    sourceRef: args.plan.sourceRef,
    runId: args.plan.runId,
    completedCellCount: args.completedCells.length,
    completedCells: args.completedCells.map((cell) => ({
      caseId: cell.caseId,
      writerModel: cell.writerModel,
      outcome: cell.outcome,
      artifactHash: cell.artifactHash,
    })),
    budget: args.budget.snapshot(),
    providerMaxRetries: 0,
    maxRepairs: 0,
    llmEvaluator: "none",
    error: "QUALITY-EVAL-3B failed closed before outcome completion.",
  };
}

async function writeFailureLedger(args: {
  outputDirectory: string;
  plan: CoverLetterEval3bPlan;
  budget: ReturnType<typeof createCoverLetterEvalBudget>;
  completedCells: readonly Eval3bCell[];
  originalError: unknown;
}): Promise<void> {
  try {
    await writeCoverLetterEvalPrivateEvidenceFile({
      outputDirectory: args.outputDirectory,
      fileName: QUALITY_EVAL3B_LEDGER_FILE_NAME,
      content: `${JSON.stringify(
        buildFailureLedger({
          plan: args.plan,
          budget: args.budget,
          completedCells: args.completedCells,
        }),
        null,
        2,
      )}\n`,
    });
  } catch (ledgerError) {
    if (args.originalError instanceof Error) {
      Object.defineProperty(args.originalError, "cause", {
        configurable: true,
        value: ledgerError,
      });
      return;
    }
    throw new Error(
      "QUALITY-EVAL-3B failed and its sanitized failure ledger could not be written.",
      { cause: new AggregateError([args.originalError, ledgerError]) },
    );
  }
}

async function collectCells(args: {
  plan: CoverLetterEval3bPlan;
  cases: readonly CoverLetterBenchmarkCase[];
  budget: ReturnType<typeof createCoverLetterEvalBudget>;
  apiKey: string;
  generateRecord: CoverLetterEval3bGenerateRecord;
  cells: Eval3bCell[];
}): Promise<void> {
  const executionPlan = buildCoverLetterHumanReviewPlan({
    cases: args.cases,
    writerModels: QUALITY_EVAL3B_WRITER_MODELS,
  });
  for (const item of executionPlan) {
    const rawResult = await args.generateRecord({
      benchmarkCase: item.benchmarkCase,
      writerModel: item.writerModel as CoverLetterEval3bWriterModel,
      apiKey: args.apiKey,
      budget: args.budget,
    });
    if (!isRecord(rawResult) || typeof rawResult.status !== "string") {
      throw new Error("QUALITY-EVAL-3B received an untyped result status.");
    }
    const writerModel = item.writerModel as CoverLetterEval3bWriterModel;
    if (rawResult.status === "human_review_pending") {
      const record = rawResult as unknown as CoverLetterHumanReviewRecord;
      const { artifactHash, provenanceHash } = await assertHumanReviewRecord({
        item: { benchmarkCase: item.benchmarkCase, writerModel },
        record,
      });
      assertSafeProvider(record.diagnostics.provider);
      args.cells.push({
        key: cellKey(item.benchmarkCase.id, writerModel),
        caseId: item.benchmarkCase.id,
        writerModel,
        writerProvider: record.diagnostics.provider,
        outcome: "human_review_pending",
        artifactHash,
        provenanceHash,
        record,
        failureReceipt: null,
      });
      continue;
    }
    if (rawResult.status === "finalization_failed") {
      const record = rawResult as unknown as CoverLetterBenchmarkFailureRecord;
      const failureReceipt = await buildFinalizationFailureReceipt({
        plan: args.plan,
        item: { benchmarkCase: item.benchmarkCase, writerModel },
        record,
      });
      assertSafeProvider(record.diagnostics.provider);
      args.cells.push({
        key: cellKey(item.benchmarkCase.id, writerModel),
        caseId: item.benchmarkCase.id,
        writerModel,
        writerProvider: record.diagnostics.provider,
        outcome: "safety_veto",
        artifactHash: failureReceipt.artifactHash,
        provenanceHash: record.artifact?.provenanceHash ?? null,
        record,
        failureReceipt,
      });
      continue;
    }
    throw new Error(
      "QUALITY-EVAL-3B stopped fail-closed on a non-authorized result status.",
    );
  }
  const expectedKeys = new Set(
    executionPlan.map((item) =>
      cellKey(item.benchmarkCase.id, item.writerModel),
    ),
  );
  const actualKeys = new Set(args.cells.map((cell) => cell.key));
  if (
    args.cells.length !== 10 ||
    actualKeys.size !== expectedKeys.size ||
    [...expectedKeys].some((key) => !actualKeys.has(key))
  ) {
    throw new Error("QUALITY-EVAL-3B did not complete its exact cell matrix.");
  }
}

export async function runCoverLetterEval3bHeldOut(
  args: CoverLetterEval3bRunArgs,
): Promise<CoverLetterEval3bRunResult> {
  const plan = await buildCoverLetterEval3bPlan({
    sourceRef: args.sourceRef,
    runId: args.runId,
  });
  assertCoverLetterEval3bLiveGate({
    plan,
    approvalPhrase: args.approvalPhrase,
    sourceRef: args.sourceRef,
    runId: args.runId,
    currentHeadSourceRef: resolveCurrentGitHeadSourceRef(),
    explicitLiveProviderOptIn: args.explicitLiveProviderOptIn,
    environmentLiveProviderOptIn: process.env.COVER_LETTER_EVAL_LIVE === "1",
    maxCalls: args.maxCalls,
    maxRepairs: args.maxRepairs,
    maxUsd: args.maxUsd,
    declaredMaxUsdPerCall: args.declaredMaxUsdPerCall,
  });
  assertRunIdentity(args);
  assertCoverLetterEval3bDefaultProviderWorktreeClean({
    generateRecord: args.generateRecord,
    resolvePorcelainStatus: resolveCurrentGitWorktreeStatus,
  });
  await assertCoverLetterEvalPrivateArtifactTargetsAvailable({
    outputDirectory: args.outputDirectory,
    ledgerFileName: QUALITY_EVAL3B_LEDGER_FILE_NAME,
  });
  assertApiKey(args.apiKey);
  const budget = createCoverLetterEvalBudget({
    explicitLiveProviderOptIn: true,
    maxCalls: args.maxCalls,
    maxRepairs: args.maxRepairs,
    maxUsd: args.maxUsd,
    declaredMaxUsdPerCall: args.declaredMaxUsdPerCall,
  });
  const cases = getCoverLetterEval3bHeldOutCases();
  const generateRecord =
    args.generateRecord ?? benchmarkCoverLetterCaseForHumanReview;
  let cells: Eval3bCell[] = [];
  try {
    await collectCells({
      plan,
      cases,
      budget,
      apiKey: args.apiKey,
      generateRecord,
      cells,
    });
    const artifacts = await buildBlindReviewArtifacts({ plan, cases, cells });
    const failureReceipts = cells.flatMap((cell) =>
      cell.failureReceipt ? [cell.failureReceipt] : [],
    );
    const snapshot = budget.snapshot();
    if (
      snapshot.usage.reservedCalls !== 10 ||
      snapshot.usage.reservedRepairs !== 0 ||
      snapshot.usage.reservedUsd > plan.budget.maxUsd
    ) {
      throw new Error("QUALITY-EVAL-3B budget accounting is not exact.");
    }
    const status: CoverLetterEval3bRunStatus = cells.some(
      (cell) => cell.outcome === "human_review_pending",
    )
      ? "HUMAN_REVIEW_PENDING"
      : "OUTCOME_COMPLETE_NO_REVIEWABLE_ARTIFACTS";
    const ledger = {
      version: "cover_letter_eval3b_run_ledger_v1",
      status,
      evaluationProtocol: QUALITY_EVAL3B_PROTOCOL,
      cohortId: plan.cohortId,
      planHash: plan.planHash,
      sourceRef: plan.sourceRef,
      runId: plan.runId,
      budget: snapshot,
      completedCells: cells.map((cell) => ({
        caseId: cell.caseId,
        writerModel: cell.writerModel,
        outcome: cell.outcome,
        artifactHash: cell.artifactHash,
      })),
      reviewableCellCount: cells.filter(
        (cell) => cell.outcome === "human_review_pending",
      ).length,
      safetyVetoCount: failureReceipts.length,
      failureReceipts,
      llmEvaluator: "none",
      providerMaxRetries: 0,
      maxRepairs: 0,
    } as const;
    const paths = await writeCoverLetterEvalPrivateArtifacts({
      outputDirectory: args.outputDirectory,
      expectedCohortId: QUALITY_EVAL3B_COHORT_ID,
      pack: artifacts.pack,
      revealMap: artifacts.revealMap,
      ledger,
      packMarkdown: artifacts.markdown,
      ledgerFileName: QUALITY_EVAL3B_LEDGER_FILE_NAME,
    });
    return {
      status,
      plan,
      budget: snapshot,
      completedCellCount: 10,
      reviewableCellCount: cells.filter(
        (cell) => cell.outcome === "human_review_pending",
      ).length,
      safetyVetoCount: failureReceipts.length,
      failureReceipts,
      paths,
    };
  } catch (error) {
    await writeFailureLedger({
      outputDirectory: args.outputDirectory,
      plan,
      budget,
      completedCells: cells,
      originalError: error,
    });
    throw error;
  }
}

export function projectCoverLetterEval3bCliResult(args: {
  result: CoverLetterEval3bRunResult;
  runId: string;
  sourceRef: string;
}): CoverLetterEval3bCliSafeResult {
  const snapshot = args.result.budget;
  return {
    status: args.result.status,
    planHash: args.result.plan.planHash,
    runId: args.runId,
    sourceRef: args.sourceRef,
    budget: {
      maxCalls: snapshot.limits.maxCalls,
      maxRepairs: snapshot.limits.maxRepairs,
      maxUsd: snapshot.limits.maxUsd,
      declaredMaxUsdPerCall: snapshot.limits.declaredMaxUsdPerCall,
      reservedCalls: snapshot.usage.reservedCalls,
      reservedRepairs: snapshot.usage.reservedRepairs,
      reservedUsd: snapshot.usage.reservedUsd,
    },
    completedCellCount: args.result.completedCellCount,
    reviewableCellCount: args.result.reviewableCellCount,
    safetyVetoCount: args.result.safetyVetoCount,
    privatePaths: { ...args.result.paths },
  };
}

export type CoverLetterEval3bVerdict = Readonly<{
  status: "POSITIVE" | "NOT_POSITIVE";
  productionActivation: "OUT_OF_SCOPE";
  validPairCount: number;
  candidatePrimaryPassTotal: number;
  controlPrimaryPassTotal: number;
  candidateCommercialAcceptabilityPassTotal: number;
  controlCommercialAcceptabilityPassTotal: number;
  candidateSafetyVetoCount: number;
  controlSafetyVetoCount: number;
  candidateCl1Cl2VetoCount: number;
  missingLanguages: readonly string[];
  reasonCodes: readonly string[];
}>;

type CoverLetterEval3bReviewPair = Readonly<{
  review: CompletedCoverLetterBlindReview;
  reveal: CoverLetterEval3bBlindReviewRevealMap["entries"][number];
}>;

async function assertCoverLetterEval3bPackHash(
  pack: CoverLetterEval3bBlindReviewPack,
): Promise<void> {
  const { packHash: _packHash, ...packBody } = pack;
  const expectedPackHash = await buildStableHash({
    namespace: "cover-letter-blind-review",
    type: "pack",
    version: 1,
    value: packBody,
  });
  if (expectedPackHash !== pack.packHash) {
    throw new Error("QUALITY-EVAL-3B reviewer pack hash mismatch.");
  }
}

async function assertCoverLetterEval3bRevealMapHash(
  revealMap: CoverLetterEval3bBlindReviewRevealMap,
): Promise<void> {
  const { revealMapHash: _revealMapHash, ...revealMapBody } = revealMap;
  const expectedRevealMapHash = await buildStableHash({
    namespace: "cover-letter-blind-review",
    type: "reveal-map",
    version: 1,
    value: revealMapBody,
  });
  if (expectedRevealMapHash !== revealMap.revealMapHash) {
    throw new Error("QUALITY-EVAL-3B reveal-map hash mismatch.");
  }
}

function assertUniqueBlindLabels(
  labels: readonly string[],
  source: string,
): Set<string> {
  const uniqueLabels = new Set<string>();
  for (const label of labels) {
    if (!label.trim() || uniqueLabels.has(label)) {
      throw new Error(`QUALITY-EVAL-3B ${source} has duplicate blind labels.`);
    }
    uniqueLabels.add(label);
  }
  return uniqueLabels;
}

function assertReviewerPackRemainsBlind(
  pack: CoverLetterEval3bBlindReviewPack,
): void {
  const serialized = JSON.stringify(pack);
  if (
    /"writer(?:Model|Provider)"/u.test(serialized) ||
    serialized.includes("gpt-5.5") ||
    serialized.includes("gpt-5.6-sol")
  ) {
    throw new Error(
      "QUALITY-EVAL-3B reviewer pack leaked provider identity before reveal.",
    );
  }
}

async function validateCoverLetterEval3bVerdictInputs(args: {
  cases: readonly CoverLetterBenchmarkCase[];
  cellOutcomes: readonly CoverLetterEval3bCellOutcome[];
  pack: CoverLetterEval3bBlindReviewPack;
  revealMap: CoverLetterEval3bBlindReviewRevealMap;
  reviews: readonly CompletedCoverLetterBlindReview[];
}): Promise<Readonly<{ reviews: readonly CoverLetterEval3bReviewPair[] }>> {
  await assertCoverLetterEval3bPackHash(args.pack);
  await assertCoverLetterEval3bRevealMapHash(args.revealMap);
  assertReviewerPackRemainsBlind(args.pack);
  if (
    args.pack.evaluationProtocol !== QUALITY_EVAL3B_PROTOCOL ||
    args.revealMap.evaluationProtocol !== QUALITY_EVAL3B_PROTOCOL ||
    args.pack.cohortId !== QUALITY_EVAL3B_COHORT_ID ||
    args.revealMap.cohortId !== args.pack.cohortId ||
    args.revealMap.runId !== args.pack.runId ||
    args.revealMap.sourceRef !== args.pack.sourceRef ||
    args.revealMap.packHash !== args.pack.packHash
  ) {
    throw new Error(
      "QUALITY-EVAL-3B pack/reveal identity or protocol is inconsistent.",
    );
  }

  const packEntryLabels = assertUniqueBlindLabels(
    args.pack.entries.map((entry) => entry.blindLabel),
    "review pack",
  );
  const packEntryByLabel = new Map(
    args.pack.entries.map((entry) => [entry.blindLabel, entry]),
  );
  const failureMatrixLabels = assertUniqueBlindLabels(
    args.pack.failureMatrix.map((entry) => entry.blindLabel),
    "failure matrix",
  );
  if (
    [...packEntryLabels].some((label) => failureMatrixLabels.has(label)) ||
    args.pack.failureMatrix.some(
      (entry) =>
        entry.outcome !== "safety_veto" || entry.textIncluded !== false,
    )
  ) {
    throw new Error("QUALITY-EVAL-3B pack/reveal label union is invalid.");
  }

  const expectedKeys = new Set(
    buildCoverLetterHumanReviewPlan({
      cases: args.cases,
      writerModels: QUALITY_EVAL3B_WRITER_MODELS,
    }).map((item) => cellKey(item.benchmarkCase.id, item.writerModel)),
  );
  const outcomeByKey = new Map<string, CoverLetterEval3bCellOutcome>();
  for (const outcome of args.cellOutcomes) {
    const key = cellKey(outcome.caseId, outcome.writerModel);
    if (
      !expectedKeys.has(key) ||
      outcomeByKey.has(key) ||
      (outcome.outcome !== "human_review_pending" &&
        outcome.outcome !== "safety_veto")
    ) {
      throw new Error("QUALITY-EVAL-3B cell outcome matrix is invalid.");
    }
    outcomeByKey.set(key, outcome);
  }
  if (outcomeByKey.size !== expectedKeys.size) {
    throw new Error("QUALITY-EVAL-3B cell outcome matrix is incomplete.");
  }

  const revealLabels = assertUniqueBlindLabels(
    args.revealMap.entries.map((entry) => entry.blindLabel),
    "reveal map",
  );
  const expectedUnionLabels = new Set([
    ...packEntryLabels,
    ...failureMatrixLabels,
  ]);
  if (
    revealLabels.size !== expectedUnionLabels.size ||
    [...expectedUnionLabels].some((label) => !revealLabels.has(label))
  ) {
    throw new Error(
      "QUALITY-EVAL-3B pack entries and failure matrix do not cover reveal entries exactly.",
    );
  }

  const revealByLabel = new Map(
    args.revealMap.entries.map((entry) => [entry.blindLabel, entry]),
  );
  const revealKeys = new Set<string>();
  for (const entry of args.revealMap.entries) {
    const key = cellKey(entry.caseId, entry.writerModel);
    if (revealKeys.has(key)) {
      throw new Error(
        "QUALITY-EVAL-3B reveal map does not cover the cell outcome matrix exactly.",
      );
    }
    revealKeys.add(key);
    const outcome = outcomeByKey.get(key);
    const isReviewable = packEntryLabels.has(entry.blindLabel);
    const isFailure = failureMatrixLabels.has(entry.blindLabel);
    if (
      !outcome ||
      isReviewable !== (entry.outcome === "human_review_pending") ||
      isFailure !== (entry.outcome === "safety_veto") ||
      outcome.outcome !== entry.outcome
    ) {
      throw new Error("QUALITY-EVAL-3B reveal entry is not authenticated.");
    }
    assertExpectedWriterProvider(entry.writerModel, entry.writerProvider);
    if (
      entry.outcome === "human_review_pending" &&
      !isHash(entry.artifactHash)
    ) {
      throw new Error(
        "QUALITY-EVAL-3B reviewable reveal entry lacks an artifact hash.",
      );
    }
  }
  if (
    revealKeys.size !== outcomeByKey.size ||
    [...outcomeByKey.keys()].some((key) => !revealKeys.has(key))
  ) {
    throw new Error(
      "QUALITY-EVAL-3B reveal map does not cover the cell outcome matrix exactly.",
    );
  }

  const reviewByLabel = new Map<string, CompletedCoverLetterBlindReview>();
  for (const review of args.reviews) {
    const packEntry = packEntryByLabel.get(review.blindLabel);
    if (
      !completedCoverLetterBlindReviewSchema.safeParse(review).success ||
      review.packHash !== args.pack.packHash ||
      !packEntry ||
      reviewByLabel.has(review.blindLabel)
    ) {
      throw new Error("QUALITY-EVAL-3B review is not bound to the blind pack.");
    }
    const missingReviewerLanguages = packEntry.requiredReviewerLanguages.filter(
      (language) => !review.reviewerLanguages.includes(language),
    );
    if (missingReviewerLanguages.length > 0) {
      throw new Error(
        `QUALITY-EVAL-3B blind review ${review.blindLabel} is missing required reviewer languages: ${missingReviewerLanguages.join(", ")}.`,
      );
    }
    reviewByLabel.set(review.blindLabel, review);
  }
  if (reviewByLabel.size !== packEntryLabels.size) {
    throw new Error(
      "QUALITY-EVAL-3B review coverage does not exactly match reviewable entries.",
    );
  }

  return {
    reviews: [...packEntryLabels].map((blindLabel) => ({
      review: reviewByLabel.get(blindLabel)!,
      reveal: revealByLabel.get(blindLabel)!,
    })),
  };
}

function makeVerdict(
  args: Partial<CoverLetterEval3bVerdict>,
): CoverLetterEval3bVerdict {
  return {
    status: "NOT_POSITIVE",
    productionActivation: "OUT_OF_SCOPE",
    validPairCount: 0,
    candidatePrimaryPassTotal: 0,
    controlPrimaryPassTotal: 0,
    candidateCommercialAcceptabilityPassTotal: 0,
    controlCommercialAcceptabilityPassTotal: 0,
    candidateSafetyVetoCount: 0,
    controlSafetyVetoCount: 0,
    candidateCl1Cl2VetoCount: 0,
    missingLanguages: ["Arabic", "English", "French"],
    reasonCodes: ["incomplete_or_not_positive"],
    ...args,
  };
}

function isPrimaryPass(review: CompletedCoverLetterBlindReview): boolean {
  return [
    review.persuasion,
    review.tone,
    review.economy,
    review.commercialAcceptability,
  ].every((value) => value === "pass");
}

function scoreCoverLetterEval3bVerdict(args: {
  cases: readonly CoverLetterBenchmarkCase[];
  cellOutcomes: readonly CoverLetterEval3bCellOutcome[];
  reviews: readonly CoverLetterEval3bReviewPair[];
}): CoverLetterEval3bVerdict {
  const expectedKeys = new Set(
    buildCoverLetterHumanReviewPlan({
      cases: args.cases,
      writerModels: QUALITY_EVAL3B_WRITER_MODELS,
    }).map((item) => cellKey(item.benchmarkCase.id, item.writerModel)),
  );
  const outcomeByKey = new Map<string, CoverLetterEval3bCellOutcome>();
  for (const outcome of args.cellOutcomes) {
    const key = cellKey(outcome.caseId, outcome.writerModel);
    if (!expectedKeys.has(key) || outcomeByKey.has(key)) {
      return makeVerdict({ reasonCodes: ["incomplete_cell_matrix"] });
    }
    outcomeByKey.set(key, outcome);
  }
  if (outcomeByKey.size !== expectedKeys.size) {
    return makeVerdict({ reasonCodes: ["incomplete_cell_matrix"] });
  }
  const reviewByKey = new Map<string, CompletedCoverLetterBlindReview>();
  const expectedReviewKeys = new Set(
    [...outcomeByKey]
      .filter(([, outcome]) => outcome.outcome === "human_review_pending")
      .map(([key]) => key),
  );
  for (const entry of args.reviews) {
    const key = cellKey(entry.reveal.caseId, entry.reveal.writerModel);
    if (
      !expectedReviewKeys.has(key) ||
      entry.reveal.outcome !== "human_review_pending" ||
      reviewByKey.has(key)
    ) {
      return makeVerdict({ reasonCodes: ["incomplete_reviews"] });
    }
    reviewByKey.set(key, entry.review);
  }
  if (reviewByKey.size !== expectedReviewKeys.size) {
    return makeVerdict({ reasonCodes: ["incomplete_reviews"] });
  }
  const caseById = new Map(
    args.cases.map((benchmarkCase) => [benchmarkCase.id, benchmarkCase]),
  );
  const candidateSafetyVetoCount = [...outcomeByKey.values()].filter(
    (outcome) =>
      outcome.writerModel === "gpt-5.6-sol" &&
      outcome.outcome === "safety_veto",
  ).length;
  const controlSafetyVetoCount = [...outcomeByKey.values()].filter(
    (outcome) =>
      outcome.writerModel === "gpt-5.5" && outcome.outcome === "safety_veto",
  ).length;
  const validPairReviews: Array<{
    caseId: string;
    control: CompletedCoverLetterBlindReview;
    candidate: CompletedCoverLetterBlindReview;
  }> = [];
  for (const benchmarkCase of args.cases) {
    const controlKey = cellKey(benchmarkCase.id, "gpt-5.5");
    const candidateKey = cellKey(benchmarkCase.id, "gpt-5.6-sol");
    if (
      outcomeByKey.get(controlKey)?.outcome === "human_review_pending" &&
      outcomeByKey.get(candidateKey)?.outcome === "human_review_pending" &&
      reviewByKey.has(controlKey) &&
      reviewByKey.has(candidateKey)
    ) {
      validPairReviews.push({
        caseId: benchmarkCase.id,
        control: reviewByKey.get(controlKey)!,
        candidate: reviewByKey.get(candidateKey)!,
      });
    }
  }
  const coveredLanguages = new Set<string>(
    validPairReviews.flatMap(({ caseId }) => {
      const requestedLanguage =
        caseById.get(caseId)?.reviewMetadata?.requestedOutputLanguage;
      return requestedLanguage ? [requestedLanguage] : [];
    }),
  );
  const missingLanguages = ["Arabic", "English", "French"].filter(
    (language) => !coveredLanguages.has(language),
  );
  const candidateCl1Cl2VetoCount = args.cases.filter((benchmarkCase) => {
    const candidate = reviewByKey.get(cellKey(benchmarkCase.id, "gpt-5.6-sol"));
    return (
      candidate !== undefined &&
      [
        candidate.factualGrounding,
        candidate.credibility,
        candidate.structure,
      ].some((value) => value !== "pass")
    );
  }).length;
  const candidatePrimaryPassTotal = validPairReviews.filter(({ candidate }) =>
    isPrimaryPass(candidate),
  ).length;
  const controlPrimaryPassTotal = validPairReviews.filter(({ control }) =>
    isPrimaryPass(control),
  ).length;
  const candidateCommercialAcceptabilityPassTotal = validPairReviews.filter(
    ({ candidate }) => candidate.commercialAcceptability === "pass",
  ).length;
  const controlCommercialAcceptabilityPassTotal = validPairReviews.filter(
    ({ control }) => control.commercialAcceptability === "pass",
  ).length;
  const reasonCodes = [
    ...(candidateSafetyVetoCount > 0 ? ["candidate_safety_veto"] : []),
    ...(candidateCl1Cl2VetoCount > 0 ? ["candidate_cl1_cl2_veto"] : []),
    ...(validPairReviews.length < 4 ? ["fewer_than_four_valid_pairs"] : []),
    ...(missingLanguages.length > 0 ? ["missing_required_language"] : []),
    ...(candidatePrimaryPassTotal <= controlPrimaryPassTotal
      ? ["primary_pass_not_strictly_higher"]
      : []),
    ...(candidateCommercialAcceptabilityPassTotal <
    controlCommercialAcceptabilityPassTotal
      ? ["commercial_acceptability_below_control"]
      : []),
  ];
  const positive = reasonCodes.length === 0;
  return makeVerdict({
    status: positive ? "POSITIVE" : "NOT_POSITIVE",
    validPairCount: validPairReviews.length,
    candidatePrimaryPassTotal,
    controlPrimaryPassTotal,
    candidateCommercialAcceptabilityPassTotal,
    controlCommercialAcceptabilityPassTotal,
    candidateSafetyVetoCount,
    controlSafetyVetoCount,
    candidateCl1Cl2VetoCount,
    missingLanguages,
    reasonCodes: positive ? ["all_positive_gates_passed"] : reasonCodes,
  });
}

export async function evaluateCoverLetterEval3bVerdict(args: {
  cases: readonly CoverLetterBenchmarkCase[];
  cellOutcomes: readonly CoverLetterEval3bCellOutcome[];
  pack: CoverLetterEval3bBlindReviewPack;
  revealMap: CoverLetterEval3bBlindReviewRevealMap;
  reviews: readonly CompletedCoverLetterBlindReview[];
}): Promise<CoverLetterEval3bVerdict> {
  const validated = await validateCoverLetterEval3bVerdictInputs(args);
  return scoreCoverLetterEval3bVerdict({
    cases: args.cases,
    cellOutcomes: args.cellOutcomes,
    reviews: validated.reviews,
  });
}

export type CoverLetterEval3bCliOptions = Readonly<{
  help: boolean;
  planOnly: boolean;
  live: boolean;
  runId: string | undefined;
  sourceRef: string | undefined;
  outputDirectory: string | undefined;
  approvalPhrase: string | undefined;
}>;

type MutableCoverLetterEval3bCliOptions = {
  -readonly [Key in keyof CoverLetterEval3bCliOptions]: CoverLetterEval3bCliOptions[Key];
};

const COVER_LETTER_EVAL3B_CLI_USAGE = `Usage:
  npx tsx scripts/evals/cover-letter-eval3b-held-out.ts --run-id=<id> --source-ref=<sha> --plan-only
  COVER_LETTER_EVAL_LIVE=1 OPENAI_API_KEY=[REDACTED:API key param] npx tsx scripts/evals/cover-letter-eval3b-held-out.ts --run-id=<id> --source-ref=<sha> --output-dir=<path> --approval-phrase='<exact phrase>' --live`;

function parseCliOptions(argv: readonly string[]): CoverLetterEval3bCliOptions {
  const options: MutableCoverLetterEval3bCliOptions = {
    help: argv.length === 0,
    planOnly: false,
    live: false,
    runId: undefined,
    sourceRef: undefined,
    outputDirectory: undefined,
    approvalPhrase: undefined,
  };
  for (const argument of argv) {
    if (argument === "--help") options.help = true;
    else if (argument === "--plan-only") options.planOnly = true;
    else if (argument === "--live") options.live = true;
    else if (argument.startsWith("--run-id="))
      options.runId = argument.slice("--run-id=".length);
    else if (argument.startsWith("--source-ref="))
      options.sourceRef = argument.slice("--source-ref=".length);
    else if (argument.startsWith("--output-dir="))
      options.outputDirectory = argument.slice("--output-dir=".length);
    else if (argument.startsWith("--approval-phrase="))
      options.approvalPhrase = argument.slice("--approval-phrase=".length);
    else
      throw new Error("QUALITY-EVAL-3B CLI refuses an unsupported argument.");
  }
  if (options.help) return options;
  if (!options.runId || !options.sourceRef) {
    throw new Error("QUALITY-EVAL-3B CLI requires --run-id and --source-ref.");
  }
  if (options.planOnly === options.live) {
    throw new Error("QUALITY-EVAL-3B CLI requires exactly one execution mode.");
  }
  if (options.live && (!options.outputDirectory || !options.approvalPhrase)) {
    throw new Error(
      "QUALITY-EVAL-3B live CLI requires output and approval fields.",
    );
  }
  return options;
}

function projectSafeCliFailureMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("QUALITY-EVAL-3B ")) {
    return error.message;
  }
  return "QUALITY-EVAL-3B failed closed on an unclassified error.";
}

export function parseCoverLetterEval3bCliOptions(
  argv: readonly string[],
): CoverLetterEval3bCliOptions {
  return parseCliOptions(argv);
}

async function main(): Promise<void> {
  const options = parseCoverLetterEval3bCliOptions(process.argv.slice(2));
  if (options.help) {
    console.log(COVER_LETTER_EVAL3B_CLI_USAGE);
    return;
  }
  const sourceRef = options.sourceRef!;
  const runId = options.runId!;
  const plan = await buildCoverLetterEval3bPlan({ sourceRef, runId });
  if (options.planOnly) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  if (options.approvalPhrase !== plan.approvalPhrase) {
    throw new Error("QUALITY-EVAL-3B CLI requires the exact approval phrase.");
  }
  const result = await runCoverLetterEval3bHeldOut({
    approvalPhrase: options.approvalPhrase,
    explicitLiveProviderOptIn: true,
    maxCalls: plan.plannedProviderCalls,
    maxRepairs: plan.maxRepairs,
    maxUsd: plan.budget.maxUsd,
    declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
    outputDirectory: options.outputDirectory!,
    runId,
    sourceRef,
    apiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
  });
  console.log(
    JSON.stringify(
      projectCoverLetterEval3bCliResult({ result, runId, sourceRef }),
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  void main().catch((error: unknown) => {
    console.error("Cover-letter EVAL3B held-out runner failed closed.");
    console.error(projectSafeCliFailureMessage(error));
    process.exitCode = 1;
  });
}
