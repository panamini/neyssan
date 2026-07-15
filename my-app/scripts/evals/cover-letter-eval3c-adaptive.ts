import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import type { OpenAIProposalReasoningEffort } from "../../config/llmConfig";
import { buildStableHash } from "../../src/modules/application-harness/fingerprints";
import {
  benchmarkCoverLetterCaseForHumanReview,
  buildCoverLetterBenchmarkOfflineCostPreflight,
  type CoverLetterBenchmarkFailureRecord,
  type CoverLetterHumanReviewRecord,
} from "./benchmark-cover-letter-writers";
import {
  buildCoverLetterBlindReviewArtifacts,
  renderCoverLetterBlindReviewMarkdown,
  type CoverLetterBlindReviewPack,
  type CoverLetterBlindReviewRevealMap,
} from "./cover-letter-blind-review";
import {
  buildCoverLetterEvalArtifactHash,
  type CoverLetterEvalArtifact,
} from "./cover-letter-eval-artifact";
import { createCoverLetterEvalBudget } from "./cover-letter-eval-budget";
import {
  assertCoverLetterEvalPrivateArtifactTargetsAvailable,
  writeCoverLetterEvalPrivateArtifacts,
  writeCoverLetterEvalPrivateEvidenceFile,
} from "./cover-letter-eval3a-held-out";
import {
  coverLetterBlindReviewCases,
  type CoverLetterBenchmarkCase,
} from "./cases/cover-letter/cases";

export const QUALITY_EVAL3C_COHORT_ID =
  "quality-eval-3c-luna-sol-adaptive-v1";
export const QUALITY_EVAL3C_DEVELOPMENT_CASE_ID =
  "blind-en-clean-engaging-direct";
export const QUALITY_EVAL3C_INITIAL_VARIANTS = [
  {
    variantId: "luna-low",
    writerModel: "gpt-5.6-luna",
    reasoningEffort: "low",
  },
  {
    variantId: "sol-low",
    writerModel: "gpt-5.6-sol",
    reasoningEffort: "low",
  },
] as const satisfies readonly CoverLetterEval3cVariant[];
export const QUALITY_EVAL3C_LIVE_MAX_USD = 0.3;

const QUALITY_EVAL3C_PROTOCOL =
  "quality_eval3c_luna_sol_adaptive_v1" as const;
const QUALITY_EVAL3C_APPROVAL_PHRASE_VERSION =
  "quality_eval3c_approval_phrase_v1" as const;
const QUALITY_EVAL3C_RUN_ID_PATTERN =
  /^quality-eval-3c-adaptive-[a-z0-9-]+$/u;
const QUALITY_EVAL3C_LEDGER_FILE_NAME = "eval3c-run-ledger.json";
const QUALITY_EVAL3C_ALLOWED_FINALIZATION_ERRORS = new Set([
  "proposal_finalization_error",
  "error",
  "unknown_error",
]);
const QUALITY_EVAL3C_ALLOWED_FAILURE_STAGES = new Set([
  "cleaned_body_selection",
  "substantive_body_assertion",
  "finalization",
  "validation",
]);
const QUALITY_EVAL3C_ALLOWED_FAILURE_ISSUES = new Set([
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

type CoverLetterEval3cWriterModel = "gpt-5.6-luna" | "gpt-5.6-sol";

export type CoverLetterEval3cVariant = Readonly<{
  variantId: string;
  writerModel: CoverLetterEval3cWriterModel;
  reasoningEffort: Extract<OpenAIProposalReasoningEffort, "none" | "low" | "medium">;
}>;

export type CoverLetterEval3cPlan = Readonly<{
  version: "cover_letter_eval3c_plan_v1";
  status: "READY_FOR_APPROVAL";
  sourceRef: string;
  runId: string;
  cohortId: typeof QUALITY_EVAL3C_COHORT_ID;
  developmentCaseId: typeof QUALITY_EVAL3C_DEVELOPMENT_CASE_ID;
  initialVariants: typeof QUALITY_EVAL3C_INITIAL_VARIANTS;
  plannedProviderCalls: 2;
  providerMaxRetries: 0;
  maxRepairs: 0;
  llmEvaluator: "none";
  adaptivePolicy: Readonly<{
    version: "cover_letter_eval3c_adaptive_policy_v1";
    allowedLunaEfforts: readonly ["none", "low", "medium"];
    allowedSolEfforts: readonly ["low", "medium"];
    nextPhaseRule:
      "one_new_development_rung_after_blind_human_review";
    satisfactoryLunaLowNext: "luna_none";
    unsatisfactoryLunaLowNext: "luna_medium";
    satisfactorySolLowNext: "stop_sol_at_low";
    unsatisfactorySolLowNext: "sol_medium";
    heldOutAccess: "forbidden_until_two_finalists_are_frozen";
    heldOutExecution: "single_blind_final_only";
    futurePhasesExecutableByThisPlan: false;
  }>;
  budget: Readonly<{
    maxUsd: typeof QUALITY_EVAL3C_LIVE_MAX_USD;
    declaredMaxUsdPerCall: number;
    minimumSafeReservationUsd: number;
    reservationBasis: "conservative_offline_transport_ceiling";
  }>;
  approvalPhraseVersion: typeof QUALITY_EVAL3C_APPROVAL_PHRASE_VERSION;
  approvalPhrase: string;
  planHash: string;
}>;

export type CoverLetterEval3cFailureReceipt = Readonly<{
  version: "cover_letter_eval3c_failure_receipt_v1";
  cohortId: typeof QUALITY_EVAL3C_COHORT_ID;
  planHash: string;
  sourceRef: string;
  runId: string;
  variantId: string;
  caseId: string;
  writerModel: CoverLetterEval3cWriterModel;
  reasoningEffort: "low";
  status: "finalization_failed";
  safetyVeto: "automatic";
  artifactHash: string | null;
  diagnostics: Readonly<{
    errorClass: string;
    failureStage: string | null;
    failureIssues: readonly string[];
  }>;
}>;

type CoverLetterEval3cCellOutcome = "human_review_pending" | "safety_veto";

type CoverLetterEval3cCell = Readonly<{
  key: string;
  variant: (typeof QUALITY_EVAL3C_INITIAL_VARIANTS)[number];
  caseId: string;
  writerProvider: "openai";
  outcome: CoverLetterEval3cCellOutcome;
  artifactHash: string | null;
  provenanceHash: string | null;
  record: CoverLetterHumanReviewRecord | CoverLetterBenchmarkFailureRecord;
  failureReceipt: CoverLetterEval3cFailureReceipt | null;
}>;

type CoverLetterEval3cFailureMatrixEntry = Readonly<{
  blindLabel: string;
  outcome: "safety_veto";
  textIncluded: false;
}>;

export type CoverLetterEval3cBlindReviewPack = CoverLetterBlindReviewPack &
  Readonly<{
    evaluationProtocol: typeof QUALITY_EVAL3C_PROTOCOL;
    failureMatrix: readonly CoverLetterEval3cFailureMatrixEntry[];
  }>;

export type CoverLetterEval3cBlindReviewRevealMap =
  Omit<CoverLetterBlindReviewRevealMap, "entries"> &
    Readonly<{
      evaluationProtocol: typeof QUALITY_EVAL3C_PROTOCOL;
      entries: readonly Readonly<{
        blindLabel: string;
        variantId: string;
        caseId: string;
        writerProvider: "openai";
        writerModel: CoverLetterEval3cWriterModel;
        reasoningEffort: "low";
        artifactHash: string | null;
        provenanceHash: string | null;
        outcome: CoverLetterEval3cCellOutcome;
      }>[];
    }>;

type CoverLetterEval3cGenerateRecord = (args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: CoverLetterEval3cWriterModel;
  reasoningEffort: "low";
  apiKey: string;
  budget: ReturnType<typeof createCoverLetterEvalBudget>;
}) => Promise<unknown>;

export type CoverLetterEval3cRunArgs = Readonly<{
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
  generateRecord?: CoverLetterEval3cGenerateRecord;
}>;

type CoverLetterEval3cRunStatus =
  | "HUMAN_REVIEW_PENDING"
  | "OUTCOME_COMPLETE_NO_REVIEWABLE_ARTIFACTS";

export type CoverLetterEval3cRunResult = Readonly<{
  status: CoverLetterEval3cRunStatus;
  plan: CoverLetterEval3cPlan;
  budget: ReturnType<
    ReturnType<typeof createCoverLetterEvalBudget>["snapshot"]
  >;
  completedCellCount: 2;
  reviewableCellCount: number;
  safetyVetoCount: number;
  failureReceipts: readonly CoverLetterEval3cFailureReceipt[];
  paths: Awaited<ReturnType<typeof writeCoverLetterEvalPrivateArtifacts>>;
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

export function getCoverLetterEval3cDevelopmentCase(): CoverLetterBenchmarkCase {
  const source = coverLetterBlindReviewCases.find(
    (benchmarkCase) =>
      benchmarkCase.id === QUALITY_EVAL3C_DEVELOPMENT_CASE_ID,
  );
  if (!source?.reviewMetadata) {
    throw new Error("QUALITY-EVAL-3C development case is missing.");
  }
  return {
    ...source,
    reviewMetadata: {
      ...source.reviewMetadata,
      cohortId: QUALITY_EVAL3C_COHORT_ID,
    },
  };
}

function buildApprovalPhrase(args: {
  planHash: string;
  sourceRef: string;
  runId: string;
}): string {
  if (
    !isHash(args.planHash) ||
    !/^[a-f0-9]{40}$/u.test(args.sourceRef) ||
    !QUALITY_EVAL3C_RUN_ID_PATTERN.test(args.runId)
  ) {
    throw new Error("QUALITY-EVAL-3C approval requires exact plan identity.");
  }
  return `J’approuve EVAL3C v1 : runId ${args.runId}, sourceRef ${args.sourceRef}, planHash ${args.planHash}, 2 appels provider maximum, budget USD ${QUALITY_EVAL3C_LIVE_MAX_USD.toFixed(2)}, cellules gpt-5.6-luna@low et gpt-5.6-sol@low, retries 0, repairs 0, aucun évaluateur LLM, development uniquement, aucun held-out.`;
}

export async function buildCoverLetterEval3cPlan(args: {
  sourceRef: string;
  runId: string;
}): Promise<CoverLetterEval3cPlan> {
  if (
    !/^[a-f0-9]{40}$/u.test(args.sourceRef) ||
    !QUALITY_EVAL3C_RUN_ID_PATTERN.test(args.runId)
  ) {
    throw new Error("QUALITY-EVAL-3C plan requires exact sourceRef and runId.");
  }
  const benchmarkCase = getCoverLetterEval3cDevelopmentCase();
  const preflight = await buildCoverLetterBenchmarkOfflineCostPreflight({
    cases: [benchmarkCase],
    writerModels: QUALITY_EVAL3C_INITIAL_VARIANTS.map(
      (variant) => variant.writerModel,
    ),
    reasoningEffort: "low",
    targetReservationUsd: QUALITY_EVAL3C_LIVE_MAX_USD,
  });
  if (
    preflight.plannedProviderCalls !== 2 ||
    preflight.providerMaxRetries !== 0 ||
    preflight.maxRepairs !== 0 ||
    !preflight.targetReservationProven ||
    preflight.minimumSafeReservationUsd > QUALITY_EVAL3C_LIVE_MAX_USD
  ) {
    throw new Error("QUALITY-EVAL-3C offline budget contract is not exact.");
  }
  const body: Omit<CoverLetterEval3cPlan, "approvalPhrase" | "planHash"> = {
    version: "cover_letter_eval3c_plan_v1",
    status: "READY_FOR_APPROVAL",
    sourceRef: args.sourceRef,
    runId: args.runId,
    cohortId: QUALITY_EVAL3C_COHORT_ID,
    developmentCaseId: QUALITY_EVAL3C_DEVELOPMENT_CASE_ID,
    initialVariants: QUALITY_EVAL3C_INITIAL_VARIANTS,
    plannedProviderCalls: 2,
    providerMaxRetries: 0,
    maxRepairs: 0,
    llmEvaluator: "none",
    adaptivePolicy: {
      version: "cover_letter_eval3c_adaptive_policy_v1",
      allowedLunaEfforts: ["none", "low", "medium"],
      allowedSolEfforts: ["low", "medium"],
      nextPhaseRule: "one_new_development_rung_after_blind_human_review",
      satisfactoryLunaLowNext: "luna_none",
      unsatisfactoryLunaLowNext: "luna_medium",
      satisfactorySolLowNext: "stop_sol_at_low",
      unsatisfactorySolLowNext: "sol_medium",
      heldOutAccess: "forbidden_until_two_finalists_are_frozen",
      heldOutExecution: "single_blind_final_only",
      futurePhasesExecutableByThisPlan: false,
    },
    budget: {
      maxUsd: QUALITY_EVAL3C_LIVE_MAX_USD,
      declaredMaxUsdPerCall: preflight.declaredMaxUsdPerCall,
      minimumSafeReservationUsd: preflight.minimumSafeReservationUsd,
      reservationBasis: "conservative_offline_transport_ceiling",
    },
    approvalPhraseVersion: QUALITY_EVAL3C_APPROVAL_PHRASE_VERSION,
  };
  const planHash = await buildStableHash({
    namespace: QUALITY_EVAL3C_PROTOCOL,
    type: "plan",
    version: 1,
    body,
  });
  return {
    ...body,
    planHash,
    approvalPhrase: buildApprovalPhrase({
      planHash,
      sourceRef: args.sourceRef,
      runId: args.runId,
    }),
  };
}

export function assertCoverLetterEval3cLiveGate(args: {
  plan: CoverLetterEval3cPlan;
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
    args.maxCalls !== 2 ||
    args.maxRepairs !== 0 ||
    args.maxUsd !== args.plan.budget.maxUsd ||
    args.declaredMaxUsdPerCall !== args.plan.budget.declaredMaxUsdPerCall
  ) {
    throw new Error("QUALITY-EVAL-3C exact live gate was not satisfied.");
  }
}

function resolveCurrentGitHeadSourceRef(): string {
  const sourceRef = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (!/^[a-f0-9]{40}$/u.test(sourceRef)) {
    throw new Error("QUALITY-EVAL-3C could not resolve an exact Git HEAD.");
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
    !QUALITY_EVAL3C_RUN_ID_PATTERN.test(args.runId) ||
    !/^[a-f0-9]{40}$/u.test(args.sourceRef)
  ) {
    throw new Error("QUALITY-EVAL-3C requires a safe runId and sourceRef.");
  }
}

async function assertArtifactHash(
  artifact: CoverLetterEvalArtifact,
): Promise<string> {
  if (!isHash(artifact.artifactHash)) {
    throw new Error("QUALITY-EVAL-3C received an invalid artifact hash.");
  }
  const { artifactHash: _artifactHash, ...projection } = artifact;
  const expectedHash = await buildCoverLetterEvalArtifactHash(projection);
  if (expectedHash !== artifact.artifactHash) {
    throw new Error("QUALITY-EVAL-3C received an artifact hash mismatch.");
  }
  return artifact.artifactHash;
}

async function assertHumanReviewRecord(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  variant: (typeof QUALITY_EVAL3C_INITIAL_VARIANTS)[number];
  record: CoverLetterHumanReviewRecord;
}): Promise<{ artifactHash: string; provenanceHash: string | null }> {
  const manifest = args.record.runManifest;
  if (
    args.record.caseId !== args.benchmarkCase.id ||
    args.record.writerModel !== args.variant.writerModel ||
    args.record.artifact.decision !== "accepted" ||
    typeof args.record.artifact.finalContent !== "string" ||
    args.record.artifact.finalContent.length === 0 ||
    args.record.letter !== args.record.artifact.finalContent ||
    args.record.diagnostics.provider !== "openai" ||
    args.record.diagnostics.validationResult !== "premium_validation_passed" ||
    args.record.outputLanguage !==
      args.benchmarkCase.reviewMetadata?.requestedOutputLanguage ||
    args.record.artifact.frozenConfig.reasoningEffort !==
      args.variant.reasoningEffort ||
    !manifest ||
    manifest.caseId !== args.benchmarkCase.id ||
    manifest.requestedModel !== args.variant.writerModel ||
    manifest.reasoningEffort !== args.variant.reasoningEffort ||
    manifest.provider !== "openai" ||
    manifest.providerMaxRetries !== 0 ||
    manifest.artifactHash !== args.record.artifact.artifactHash ||
    !isHash(manifest.promptHash) ||
    !isHash(manifest.transport.requestProjectionHash) ||
    !isHash(manifest.transport.schemaTargetHash)
  ) {
    throw new Error("QUALITY-EVAL-3C received an invalid review artifact.");
  }
  const artifactHash = await assertArtifactHash(args.record.artifact);
  if (
    args.record.artifact.provenanceHash !== null &&
    !isHash(args.record.artifact.provenanceHash)
  ) {
    throw new Error("QUALITY-EVAL-3C received an invalid provenance hash.");
  }
  return {
    artifactHash,
    provenanceHash: args.record.artifact.provenanceHash,
  };
}

async function buildFailureReceipt(args: {
  plan: CoverLetterEval3cPlan;
  benchmarkCase: CoverLetterBenchmarkCase;
  variant: (typeof QUALITY_EVAL3C_INITIAL_VARIANTS)[number];
  record: CoverLetterBenchmarkFailureRecord;
}): Promise<CoverLetterEval3cFailureReceipt> {
  const finalization = args.record.artifact?.diagnostics.finalization;
  const errorClass =
    finalization?.errorClass ?? args.record.diagnostics.failureReason;
  const failureStage =
    finalization?.failureStage ?? args.record.diagnostics.failureStage;
  if (
    args.record.caseId !== args.benchmarkCase.id ||
    args.record.writerModel !== args.variant.writerModel ||
    args.record.diagnostics.provider !== "openai" ||
    args.record.diagnostics.validationResult !== "premium_finalization_failed" ||
    !errorClass ||
    !QUALITY_EVAL3C_ALLOWED_FINALIZATION_ERRORS.has(errorClass) ||
    !Array.isArray(args.record.diagnostics.failureIssues)
  ) {
    throw new Error(
      "QUALITY-EVAL-3C could not safely classify the finalization failure.",
    );
  }
  if (
    args.record.artifact &&
    (args.record.artifact.decision !== "rejected" ||
      args.record.artifact.finalContent !== null ||
      args.record.artifact.sections.length !== 0)
  ) {
    throw new Error(
      "QUALITY-EVAL-3C received a non-empty finalization failure artifact.",
    );
  }
  if (
    args.record.attemptMetadata &&
    (args.record.attemptMetadata.requestedModel !== args.variant.writerModel ||
      args.record.attemptMetadata.reasoningEffort !==
        args.variant.reasoningEffort ||
      args.record.attemptMetadata.providerMaxRetries !== 0)
  ) {
    throw new Error("QUALITY-EVAL-3C received invalid failure metadata.");
  }
  const artifactHash = args.record.artifact
    ? await assertArtifactHash(args.record.artifact)
    : null;
  if (
    args.record.artifact?.provenanceHash !== undefined &&
    args.record.artifact.provenanceHash !== null &&
    !isHash(args.record.artifact.provenanceHash)
  ) {
    throw new Error("QUALITY-EVAL-3C received an invalid provenance hash.");
  }
  return {
    version: "cover_letter_eval3c_failure_receipt_v1",
    cohortId: QUALITY_EVAL3C_COHORT_ID,
    planHash: args.plan.planHash,
    sourceRef: args.plan.sourceRef,
    runId: args.plan.runId,
    variantId: args.variant.variantId,
    caseId: args.benchmarkCase.id,
    writerModel: args.variant.writerModel,
    reasoningEffort: args.variant.reasoningEffort,
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
              QUALITY_EVAL3C_ALLOWED_FAILURE_STAGES,
            ),
      failureIssues: [
        ...new Set(
          args.record.diagnostics.failureIssues.map((issue) =>
            sanitizeAllowlistedDiagnosticToken(
              issue,
              QUALITY_EVAL3C_ALLOWED_FAILURE_ISSUES,
            ),
          ),
        ),
      ].sort(),
    },
  };
}

async function buildBlindArtifacts(args: {
  plan: CoverLetterEval3cPlan;
  benchmarkCase: CoverLetterBenchmarkCase;
  cells: readonly CoverLetterEval3cCell[];
}): Promise<{
  pack: CoverLetterEval3cBlindReviewPack;
  revealMap: CoverLetterEval3cBlindReviewRevealMap;
  markdown: string;
}> {
  const successfulCells = args.cells.filter(
    (
      cell,
    ): cell is CoverLetterEval3cCell & {
      record: CoverLetterHumanReviewRecord;
    } => cell.outcome === "human_review_pending",
  );
  const source = await buildCoverLetterBlindReviewArtifacts({
    cohortId: QUALITY_EVAL3C_COHORT_ID,
    runId: args.plan.runId,
    sourceRef: args.plan.sourceRef,
    cases: successfulCells.length > 0 ? [args.benchmarkCase] : [],
    records: successfulCells.map((cell) => cell.record),
  });
  const orderedCells = await Promise.all(
    args.cells.map(async (cell) => ({
      cell,
      sortKey: await buildStableHash({
        namespace: QUALITY_EVAL3C_PROTOCOL,
        type: "blind-order",
        version: 1,
        variantId: cell.variant.variantId,
        artifactHash: cell.artifactHash,
        outcome: cell.outcome,
      }),
    })),
  );
  orderedCells.sort((left, right) => left.sortKey.localeCompare(right.sortKey));
  const labelByKey = new Map(
    orderedCells.map(({ cell }, index) => [
      cell.key,
      `CL-${String(index + 1).padStart(3, "0")}`,
    ]),
  );
  const sourceRevealByKey = new Map(
    source.revealMap.entries.map((entry) => [
      cellKey(entry.caseId, entry.writerModel),
      entry,
    ]),
  );
  const sourcePackByLabel = new Map(
    source.pack.entries.map((entry) => [entry.blindLabel, entry]),
  );
  const remappedEntries = orderedCells.flatMap(({ cell }) => {
    if (cell.outcome !== "human_review_pending") return [];
    const reveal = sourceRevealByKey.get(cell.key);
    const entry = reveal ? sourcePackByLabel.get(reveal.blindLabel) : undefined;
    if (!entry) {
      throw new Error("QUALITY-EVAL-3C review mapping is incomplete.");
    }
    return [{ ...entry, blindLabel: labelByKey.get(cell.key)! }];
  });
  const failureMatrix = orderedCells.flatMap(({ cell }) =>
    cell.outcome === "safety_veto"
      ? [
          {
            blindLabel: labelByKey.get(cell.key)!,
            outcome: "safety_veto" as const,
            textIncluded: false as const,
          },
        ]
      : [],
  );
  const { packHash: _packHash, ...sourcePackBody } = source.pack;
  const packBody = {
    ...sourcePackBody,
    evaluationProtocol: QUALITY_EVAL3C_PROTOCOL,
    instructions: [
      ...sourcePackBody.instructions,
      "Review every supplied development letter independently before consulting the private reveal map.",
      "A failure-matrix label is an automatic safety veto and intentionally contains no generated text.",
      ...failureMatrix.map(
        (entry) =>
          `Failure matrix: ${entry.blindLabel} is a safety_veto; generated text intentionally absent.`,
      ),
    ],
    entries: remappedEntries,
    failureMatrix,
  } as const;
  const packHash = await buildStableHash({
    namespace: "cover-letter-blind-review",
    type: "pack",
    version: 1,
    value: packBody,
  });
  const pack = { ...packBody, packHash } as CoverLetterEval3cBlindReviewPack;
  const revealBody = {
    version: "cover_letter_blind_review_reveal_v1" as const,
    cohortId: QUALITY_EVAL3C_COHORT_ID,
    runId: args.plan.runId,
    sourceRef: args.plan.sourceRef,
    packHash,
    evaluationProtocol: QUALITY_EVAL3C_PROTOCOL,
    entries: orderedCells.map(({ cell }) => ({
      blindLabel: labelByKey.get(cell.key)!,
      variantId: cell.variant.variantId,
      caseId: cell.caseId,
      writerProvider: cell.writerProvider,
      writerModel: cell.variant.writerModel,
      reasoningEffort: cell.variant.reasoningEffort,
      artifactHash: cell.artifactHash,
      provenanceHash: cell.provenanceHash,
      outcome: cell.outcome,
    })),
  };
  const revealMapHash = await buildStableHash({
    namespace: "cover-letter-blind-review",
    type: "reveal-map",
    version: 1,
    value: revealBody,
  });
  const revealMap = {
    ...revealBody,
    revealMapHash,
  } as CoverLetterEval3cBlindReviewRevealMap;
  const reviewerProjection = JSON.stringify(pack);
  if (
    QUALITY_EVAL3C_INITIAL_VARIANTS.some((variant) =>
      reviewerProjection.includes(variant.writerModel),
    ) ||
    reviewerProjection.includes("reasoningEffort") ||
    reviewerProjection.includes("variantId")
  ) {
    throw new Error("QUALITY-EVAL-3C reviewer pack leaked variant identity.");
  }
  return {
    pack,
    revealMap,
    markdown: renderCoverLetterBlindReviewMarkdown(pack),
  };
}

async function collectCells(args: {
  plan: CoverLetterEval3cPlan;
  benchmarkCase: CoverLetterBenchmarkCase;
  budget: ReturnType<typeof createCoverLetterEvalBudget>;
  apiKey: string;
  generateRecord: CoverLetterEval3cGenerateRecord;
  cells: CoverLetterEval3cCell[];
}): Promise<void> {
  for (const variant of QUALITY_EVAL3C_INITIAL_VARIANTS) {
    const rawResult = await args.generateRecord({
      benchmarkCase: args.benchmarkCase,
      writerModel: variant.writerModel,
      reasoningEffort: variant.reasoningEffort,
      apiKey: args.apiKey,
      budget: args.budget,
    });
    if (!isRecord(rawResult) || typeof rawResult.status !== "string") {
      throw new Error("QUALITY-EVAL-3C received an untyped result status.");
    }
    if (rawResult.status === "human_review_pending") {
      const record = rawResult as unknown as CoverLetterHumanReviewRecord;
      const hashes = await assertHumanReviewRecord({
        benchmarkCase: args.benchmarkCase,
        variant,
        record,
      });
      args.cells.push({
        key: cellKey(args.benchmarkCase.id, variant.writerModel),
        variant,
        caseId: args.benchmarkCase.id,
        writerProvider: "openai",
        outcome: "human_review_pending",
        artifactHash: hashes.artifactHash,
        provenanceHash: hashes.provenanceHash,
        record,
        failureReceipt: null,
      });
      continue;
    }
    if (rawResult.status === "finalization_failed") {
      const record = rawResult as unknown as CoverLetterBenchmarkFailureRecord;
      const failureReceipt = await buildFailureReceipt({
        plan: args.plan,
        benchmarkCase: args.benchmarkCase,
        variant,
        record,
      });
      args.cells.push({
        key: cellKey(args.benchmarkCase.id, variant.writerModel),
        variant,
        caseId: args.benchmarkCase.id,
        writerProvider: "openai",
        outcome: "safety_veto",
        artifactHash: failureReceipt.artifactHash,
        provenanceHash: record.artifact?.provenanceHash ?? null,
        record,
        failureReceipt,
      });
      continue;
    }
    throw new Error(
      "QUALITY-EVAL-3C stopped fail-closed on a non-authorized result status.",
    );
  }
  if (
    args.cells.length !== 2 ||
    new Set(args.cells.map((cell) => cell.key)).size !== 2
  ) {
    throw new Error("QUALITY-EVAL-3C did not complete its exact cell matrix.");
  }
}

function buildFailureLedger(args: {
  plan: CoverLetterEval3cPlan;
  budget: ReturnType<typeof createCoverLetterEvalBudget>;
  cells: readonly CoverLetterEval3cCell[];
}): Readonly<Record<string, unknown>> {
  return {
    version: "cover_letter_eval3c_failure_ledger_v1",
    status: "FAILED_CLOSED",
    cohortId: args.plan.cohortId,
    planHash: args.plan.planHash,
    sourceRef: args.plan.sourceRef,
    runId: args.plan.runId,
    completedCellCount: args.cells.length,
    completedCells: args.cells.map((cell) => ({
      variantId: cell.variant.variantId,
      caseId: cell.caseId,
      writerModel: cell.variant.writerModel,
      reasoningEffort: cell.variant.reasoningEffort,
      outcome: cell.outcome,
      artifactHash: cell.artifactHash,
    })),
    budget: args.budget.snapshot(),
    providerMaxRetries: 0,
    maxRepairs: 0,
    llmEvaluator: "none",
    error: "QUALITY-EVAL-3C failed closed before outcome completion.",
  };
}

export async function runCoverLetterEval3cInitialScreen(
  args: CoverLetterEval3cRunArgs,
): Promise<CoverLetterEval3cRunResult> {
  const plan = await buildCoverLetterEval3cPlan({
    sourceRef: args.sourceRef,
    runId: args.runId,
  });
  assertCoverLetterEval3cLiveGate({
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
  if (!args.generateRecord && resolveCurrentGitWorktreeStatus().trim()) {
    throw new Error(
      "QUALITY-EVAL-3C requires a clean Git worktree before provider calls.",
    );
  }
  await assertCoverLetterEvalPrivateArtifactTargetsAvailable({
    outputDirectory: args.outputDirectory,
    ledgerFileName: QUALITY_EVAL3C_LEDGER_FILE_NAME,
  });
  if (!args.apiKey.trim()) {
    throw new Error("QUALITY-EVAL-3C requires OPENAI_API_KEY after approval.");
  }
  const budget = createCoverLetterEvalBudget({
    explicitLiveProviderOptIn: true,
    maxCalls: args.maxCalls,
    maxRepairs: args.maxRepairs,
    maxUsd: args.maxUsd,
    declaredMaxUsdPerCall: args.declaredMaxUsdPerCall,
  });
  const benchmarkCase = getCoverLetterEval3cDevelopmentCase();
  const generateRecord =
    args.generateRecord ?? benchmarkCoverLetterCaseForHumanReview;
  let cells: CoverLetterEval3cCell[] = [];
  try {
    await collectCells({
      plan,
      benchmarkCase,
      budget,
      apiKey: args.apiKey,
      generateRecord,
      cells,
    });
    const artifacts = await buildBlindArtifacts({
      plan,
      benchmarkCase,
      cells,
    });
    const failureReceipts = cells.flatMap((cell) =>
      cell.failureReceipt ? [cell.failureReceipt] : [],
    );
    const snapshot = budget.snapshot();
    if (
      snapshot.usage.reservedCalls !== 2 ||
      snapshot.usage.reservedRepairs !== 0 ||
      snapshot.usage.reservedUsd > plan.budget.maxUsd
    ) {
      throw new Error("QUALITY-EVAL-3C budget accounting is not exact.");
    }
    const reviewableCellCount = cells.filter(
      (cell) => cell.outcome === "human_review_pending",
    ).length;
    const status: CoverLetterEval3cRunStatus =
      reviewableCellCount > 0
        ? "HUMAN_REVIEW_PENDING"
        : "OUTCOME_COMPLETE_NO_REVIEWABLE_ARTIFACTS";
    const ledger = {
      version: "cover_letter_eval3c_run_ledger_v1",
      status,
      evaluationProtocol: QUALITY_EVAL3C_PROTOCOL,
      cohortId: plan.cohortId,
      planHash: plan.planHash,
      sourceRef: plan.sourceRef,
      runId: plan.runId,
      budget: snapshot,
      completedCells: cells.map((cell) => ({
        variantId: cell.variant.variantId,
        caseId: cell.caseId,
        writerModel: cell.variant.writerModel,
        reasoningEffort: cell.variant.reasoningEffort,
        outcome: cell.outcome,
        artifactHash: cell.artifactHash,
      })),
      reviewableCellCount,
      safetyVetoCount: failureReceipts.length,
      failureReceipts,
      llmEvaluator: "none",
      providerMaxRetries: 0,
      maxRepairs: 0,
      heldOutAccess: plan.adaptivePolicy.heldOutAccess,
    } as const;
    const paths = await writeCoverLetterEvalPrivateArtifacts({
      outputDirectory: args.outputDirectory,
      expectedCohortId: QUALITY_EVAL3C_COHORT_ID,
      pack: artifacts.pack,
      revealMap: artifacts.revealMap,
      ledger,
      packMarkdown: artifacts.markdown,
      ledgerFileName: QUALITY_EVAL3C_LEDGER_FILE_NAME,
    });
    return {
      status,
      plan,
      budget: snapshot,
      completedCellCount: 2,
      reviewableCellCount,
      safetyVetoCount: failureReceipts.length,
      failureReceipts,
      paths,
    };
  } catch (error) {
    try {
      await writeCoverLetterEvalPrivateEvidenceFile({
        outputDirectory: args.outputDirectory,
        fileName: QUALITY_EVAL3C_LEDGER_FILE_NAME,
        content: `${JSON.stringify(
          buildFailureLedger({ plan, budget, cells }),
          null,
          2,
        )}\n`,
      });
    } catch {
      // Preserve the original classified failure; no raw provider data is added.
    }
    throw error;
  }
}

export type CoverLetterEval3cCliOptions = Readonly<{
  help: boolean;
  planOnly: boolean;
  live: boolean;
  runId: string | undefined;
  sourceRef: string | undefined;
  outputDirectory: string | undefined;
  approvalPhrase: string | undefined;
}>;

export function parseCoverLetterEval3cCliOptions(
  argv: readonly string[],
): CoverLetterEval3cCliOptions {
  const options = {
    help: argv.length === 0,
    planOnly: false,
    live: false,
    runId: undefined as string | undefined,
    sourceRef: undefined as string | undefined,
    outputDirectory: undefined as string | undefined,
    approvalPhrase: undefined as string | undefined,
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
      throw new Error("QUALITY-EVAL-3C CLI refuses an unsupported argument.");
  }
  if (options.help) return options;
  if (!options.runId || !options.sourceRef) {
    throw new Error("QUALITY-EVAL-3C CLI requires --run-id and --source-ref.");
  }
  if (options.planOnly === options.live) {
    throw new Error("QUALITY-EVAL-3C CLI requires exactly one execution mode.");
  }
  if (options.live && (!options.outputDirectory || !options.approvalPhrase)) {
    throw new Error(
      "QUALITY-EVAL-3C live CLI requires output and approval fields.",
    );
  }
  return options;
}

const CLI_USAGE = `Usage:
  npx tsx scripts/evals/cover-letter-eval3c-adaptive.ts --run-id=<id> --source-ref=<sha> --plan-only
  COVER_LETTER_EVAL_LIVE=1 OPENAI_API_KEY=[REDACTED] npx tsx scripts/evals/cover-letter-eval3c-adaptive.ts --run-id=<id> --source-ref=<sha> --output-dir=<path> --approval-phrase='<exact phrase>' --live`;

function safeCliFailureMessage(error: unknown): string {
  return error instanceof Error && error.message.startsWith("QUALITY-EVAL-3C ")
    ? error.message
    : "QUALITY-EVAL-3C failed closed on an unclassified error.";
}

async function main(): Promise<void> {
  const options = parseCoverLetterEval3cCliOptions(process.argv.slice(2));
  if (options.help) {
    console.log(CLI_USAGE);
    return;
  }
  const runId = options.runId!;
  const sourceRef = options.sourceRef!;
  const plan = await buildCoverLetterEval3cPlan({ runId, sourceRef });
  if (options.planOnly) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  const result = await runCoverLetterEval3cInitialScreen({
    approvalPhrase: options.approvalPhrase!,
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
      {
        status: result.status,
        planHash: result.plan.planHash,
        sourceRef,
        runId,
        completedCellCount: result.completedCellCount,
        reviewableCellCount: result.reviewableCellCount,
        safetyVetoCount: result.safetyVetoCount,
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
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  void main().catch((error: unknown) => {
    console.error("Cover-letter EVAL3C adaptive runner failed closed.");
    console.error(safeCliFailureMessage(error));
    process.exitCode = 1;
  });
}
