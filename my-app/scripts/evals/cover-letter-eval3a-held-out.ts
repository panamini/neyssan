import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  chmod,
  link,
  lstat,
  mkdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { platform } from "node:os";
import * as path from "node:path";

import { buildStableHash } from "../../src/modules/application-harness/fingerprints";
import {
  benchmarkCoverLetterCaseForHumanReview,
  buildCoverLetterBenchmarkOfflineCostPreflight,
  buildCoverLetterHumanReviewPlan,
  type CoverLetterHumanReviewRecord,
  type CoverLetterHumanReviewResult,
} from "./benchmark-cover-letter-writers";
import {
  buildCoverLetterBlindReviewArtifacts,
  renderCoverLetterBlindReviewMarkdown,
  type CoverLetterBlindReviewPack,
  type CoverLetterBlindReviewRevealMap,
} from "./cover-letter-blind-review";
import { createCoverLetterEvalBudget } from "./cover-letter-eval-budget";
import {
  coverLetterBlindReviewCases,
  type CoverLetterBenchmarkCase,
} from "./cases/cover-letter/cases";
import type { CoverLetterEvalPricedWriterModel } from "./cover-letter-eval-run-manifest";

export const QUALITY_EVAL3A_COHORT_ID = "quality-eval-3a-narrative-held-out-v1";
export const QUALITY_EVAL3A_DEVELOPMENT_CASE_IDS = [
  "blind-en-clean-engaging-direct",
] as const;
export const QUALITY_EVAL3A_HELD_OUT_CASE_IDS = [
  "blind-en-checklist-challenging",
  "blind-fr-customer-success-direct",
  "blind-fr-implementation-adjacent",
  "blind-ar-customer-success-direct",
  "blind-ar-implementation-adjacent",
] as const;
export const QUALITY_EVAL3A_WRITER_MODELS = [
  "gpt-5.5",
  "gpt-5.6-sol",
] as const satisfies readonly CoverLetterEvalPricedWriterModel[];
export const QUALITY_EVAL3A_LIVE_MAX_USD = 2;
const QUALITY_EVAL3A_APPROVAL_PHRASE_VERSION =
  "quality_eval3a_approval_phrase_v2";
const QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC = {
  runMode: "finalization_failure_diagnostic_v1",
  caseId: "blind-fr-customer-success-direct",
  writerModel: "gpt-5.5",
  maxCalls: 1,
  maxUsd: 0.15,
  declaredMaxUsdPerCall: 0.135595,
  approvalPhraseVersion:
    "quality_eval3a_finalization_diagnostic_approval_phrase_v1",
} as const;

type CoverLetterEval3aWriterModel =
  (typeof QUALITY_EVAL3A_WRITER_MODELS)[number];

type CoverLetterEval3aFinalizationDiagnosticSource = NonNullable<
  CoverLetterHumanReviewResult["artifact"]
>["diagnostics"]["finalization"];

type CoverLetterEval3aFailureDiagnostic = Readonly<{
  version: "cover_letter_eval3a_failure_diagnostic_v1";
  status: CoverLetterHumanReviewResult["status"];
  artifactHash: string | null;
  finalization: Readonly<
    Pick<
      CoverLetterEval3aFinalizationDiagnosticSource,
      | "acceptanceMode"
      | "errorClass"
      | "failureStage"
      | "selectedBodyCandidate"
      | "substantiveBodyPassed"
      | "removedBridgeSentenceCount"
      | "removedLastGroundedSentence"
    >
  > | null;
}>;

function projectCoverLetterEval3aFailureDiagnostic(
  record: CoverLetterHumanReviewResult,
): CoverLetterEval3aFailureDiagnostic {
  const finalization = record.artifact?.diagnostics.finalization;
  return {
    version: "cover_letter_eval3a_failure_diagnostic_v1",
    status: record.status,
    artifactHash: record.artifact?.artifactHash ?? null,
    finalization: finalization
      ? {
          acceptanceMode: finalization.acceptanceMode,
          errorClass: finalization.errorClass,
          failureStage: finalization.failureStage,
          selectedBodyCandidate: finalization.selectedBodyCandidate,
          substantiveBodyPassed: finalization.substantiveBodyPassed,
          removedBridgeSentenceCount: finalization.removedBridgeSentenceCount,
          removedLastGroundedSentence: finalization.removedLastGroundedSentence,
        }
      : null,
  };
}

export type CoverLetterEval3aPlan = Readonly<{
  version: "cover_letter_eval3a_plan_v2";
  status: "READY_FOR_APPROVAL";
  cohortId: typeof QUALITY_EVAL3A_COHORT_ID;
  developmentCaseIds: typeof QUALITY_EVAL3A_DEVELOPMENT_CASE_IDS;
  heldOutCaseIds: typeof QUALITY_EVAL3A_HELD_OUT_CASE_IDS;
  writerModels: Readonly<{
    control: "gpt-5.5";
    candidate: "gpt-5.6-sol";
  }>;
  plannedProviderCalls: 10;
  providerMaxRetries: 0;
  maxRepairs: 0;
  llmEvaluator: "none";
  budget: Readonly<{
    maxUsd: typeof QUALITY_EVAL3A_LIVE_MAX_USD;
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
    version: "cover_letter_eval3a_human_verdict_v1";
    positiveRequires: readonly [
      "zero_candidate_safety_veto_failures",
      "candidate_primary_pass_total_strictly_exceeds_control",
      "candidate_commercial_acceptability_passes_not_below_control",
    ];
    tieOrIncompleteOutcome: "NOT_POSITIVE";
    productionActivation: "OUT_OF_SCOPE";
  }>;
  approvalPhraseVersion: typeof QUALITY_EVAL3A_APPROVAL_PHRASE_VERSION;
  approvalPhrase: string;
  planHash: string;
}>;

function idsAreExact(actual: readonly string[], expected: readonly string[]) {
  return (
    actual.length === expected.length &&
    new Set(actual).size === expected.length &&
    expected.every((caseId, index) => actual[index] === caseId)
  );
}

export function getCoverLetterEval3aHeldOutCases(): CoverLetterBenchmarkCase[] {
  const caseById = new Map(
    coverLetterBlindReviewCases.map((benchmarkCase) => [
      benchmarkCase.id,
      benchmarkCase,
    ]),
  );
  const cases = QUALITY_EVAL3A_HELD_OUT_CASE_IDS.map((caseId) => {
    const benchmarkCase = caseById.get(caseId);
    if (!benchmarkCase?.reviewMetadata) {
      throw new Error(`QUALITY-EVAL-3A held-out case is missing: ${caseId}.`);
    }
    return {
      ...benchmarkCase,
      reviewMetadata: {
        ...benchmarkCase.reviewMetadata,
        cohortId: QUALITY_EVAL3A_COHORT_ID,
      },
    };
  });
  const overlapsDevelopment = cases.some((benchmarkCase) =>
    QUALITY_EVAL3A_DEVELOPMENT_CASE_IDS.includes(
      benchmarkCase.id as (typeof QUALITY_EVAL3A_DEVELOPMENT_CASE_IDS)[number],
    ),
  );
  if (
    overlapsDevelopment ||
    !idsAreExact(
      cases.map((benchmarkCase) => benchmarkCase.id),
      QUALITY_EVAL3A_HELD_OUT_CASE_IDS,
    )
  ) {
    throw new Error(
      "QUALITY-EVAL-3A held-out cases overlap or drift from the CL3 development cohort.",
    );
  }
  return cases;
}

function buildApprovalPhrase(args: {
  plannedProviderCalls: number;
  planHash: string;
}): string {
  if (!/^[a-f0-9]{64}$/u.test(args.planHash)) {
    throw new Error("QUALITY-EVAL-3A approval requires an exact planHash.");
  }
  return `J’approuve EVAL3A v2 : planHash ${args.planHash}, ${args.plannedProviderCalls} appels provider maximum, budget USD ${QUALITY_EVAL3A_LIVE_MAX_USD.toFixed(2)}, modèles gpt-5.5 et gpt-5.6-sol, retries 0, repairs 0, aucun évaluateur LLM.`;
}

async function hashPlanBody(
  body: Omit<CoverLetterEval3aPlan, "approvalPhrase" | "planHash">,
): Promise<string> {
  return buildStableHash({
    namespace: "cover-letter-eval3a-held-out",
    type: "plan",
    version: 1,
    body,
  });
}

export async function buildCoverLetterEval3aPlan(): Promise<CoverLetterEval3aPlan> {
  const cases = getCoverLetterEval3aHeldOutCases();
  const preflight = await buildCoverLetterBenchmarkOfflineCostPreflight({
    cases,
    writerModels: QUALITY_EVAL3A_WRITER_MODELS,
    targetReservationUsd: QUALITY_EVAL3A_LIVE_MAX_USD,
  });
  if (
    preflight.plannedProviderCalls !== 10 ||
    preflight.providerMaxRetries !== 0 ||
    preflight.maxRepairs !== 0 ||
    !preflight.targetReservationProven ||
    preflight.minimumSafeReservationUsd > QUALITY_EVAL3A_LIVE_MAX_USD
  ) {
    throw new Error(
      "QUALITY-EVAL-3A conservative offline preflight exceeds the exact call or USD contract.",
    );
  }
  const body: Omit<CoverLetterEval3aPlan, "approvalPhrase" | "planHash"> = {
    version: "cover_letter_eval3a_plan_v2",
    status: "READY_FOR_APPROVAL",
    cohortId: QUALITY_EVAL3A_COHORT_ID,
    developmentCaseIds: QUALITY_EVAL3A_DEVELOPMENT_CASE_IDS,
    heldOutCaseIds: QUALITY_EVAL3A_HELD_OUT_CASE_IDS,
    writerModels: {
      control: "gpt-5.5",
      candidate: "gpt-5.6-sol",
    },
    plannedProviderCalls: 10,
    providerMaxRetries: 0,
    maxRepairs: 0,
    llmEvaluator: "none",
    budget: {
      maxUsd: QUALITY_EVAL3A_LIVE_MAX_USD,
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
      version: "cover_letter_eval3a_human_verdict_v1",
      positiveRequires: [
        "zero_candidate_safety_veto_failures",
        "candidate_primary_pass_total_strictly_exceeds_control",
        "candidate_commercial_acceptability_passes_not_below_control",
      ],
      tieOrIncompleteOutcome: "NOT_POSITIVE",
      productionActivation: "OUT_OF_SCOPE",
    },
    approvalPhraseVersion: QUALITY_EVAL3A_APPROVAL_PHRASE_VERSION,
  };
  const planHash = await hashPlanBody(body);
  return {
    ...body,
    approvalPhrase: buildApprovalPhrase({
      plannedProviderCalls: preflight.plannedProviderCalls,
      planHash,
    }),
    planHash,
  };
}

function getCoverLetterEval3aFinalizationDiagnosticCase(): CoverLetterBenchmarkCase {
  const benchmarkCase = getCoverLetterEval3aHeldOutCases().find(
    (candidate) =>
      candidate.id === QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.caseId,
  );
  if (!benchmarkCase) {
    throw new Error(
      "QUALITY-EVAL-3A finalization diagnostic case is missing from the held-out cohort.",
    );
  }
  return benchmarkCase;
}

export async function buildCoverLetterEval3aFinalizationDiagnosticPlan() {
  const benchmarkCase = getCoverLetterEval3aFinalizationDiagnosticCase();
  const preflight = await buildCoverLetterBenchmarkOfflineCostPreflight({
    cases: [benchmarkCase],
    writerModels: [QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.writerModel],
    targetReservationUsd: QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.maxUsd,
  });
  if (
    preflight.plannedProviderCalls !==
      QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.maxCalls ||
    preflight.providerMaxRetries !== 0 ||
    preflight.maxRepairs !== 0 ||
    !preflight.targetReservationProven ||
    preflight.declaredMaxUsdPerCall !==
      QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.declaredMaxUsdPerCall ||
    preflight.minimumSafeReservationUsd !==
      QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.declaredMaxUsdPerCall ||
    preflight.worstCase.caseId !==
      QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.caseId ||
    preflight.worstCase.writerModel !==
      QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.writerModel
  ) {
    throw new Error(
      "QUALITY-EVAL-3A finalization diagnostic preflight drifted from the exact one-cell budget contract.",
    );
  }
  const body = {
    version: "cover_letter_eval3a_finalization_diagnostic_plan_v1",
    status: "READY_FOR_APPROVAL",
    runMode: QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.runMode,
    caseId: QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.caseId,
    writerModel: QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.writerModel,
    plannedProviderCalls: QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.maxCalls,
    providerMaxRetries: 0,
    maxRepairs: 0,
    llmEvaluator: "none",
    budget: {
      maxUsd: QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.maxUsd,
      declaredMaxUsdPerCall:
        QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.declaredMaxUsdPerCall,
      minimumSafeReservationUsd:
        QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.declaredMaxUsdPerCall,
      reservationBasis: "conservative_offline_transport_ceiling",
    },
    outputs: {
      failureLedgerVersion: "cover_letter_eval3a_failure_ledger_v2",
      reviewerPack: false,
      revealMap: false,
    },
    approvalPhraseVersion:
      QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.approvalPhraseVersion,
  } as const;
  return {
    ...body,
    planHash: await buildStableHash({
      namespace: "cover-letter-eval3a-finalization-diagnostic",
      type: "plan",
      version: 1,
      body,
    }),
  };
}

export type CoverLetterEval3aFinalizationDiagnosticPlan = Awaited<
  ReturnType<typeof buildCoverLetterEval3aFinalizationDiagnosticPlan>
>;

export function buildCoverLetterEval3aFinalizationDiagnosticApprovalPhrase(args: {
  sourceRef: string;
  planHash: string;
  runId: string;
}): string {
  if (
    !/^[a-f0-9]{40}$/u.test(args.sourceRef) ||
    !/^[a-f0-9]{64}$/u.test(args.planHash) ||
    !/^quality-eval-3a-finalization-diagnostic-[a-z0-9-]+$/u.test(args.runId)
  ) {
    throw new Error(
      "QUALITY-EVAL-3A finalization diagnostic approval requires exact sourceRef and planHash values.",
    );
  }
  return `J’approuve EVAL3A diagnostic finalization v1 : runId ${args.runId}, sourceRef ${args.sourceRef}, planHash ${args.planHash}, cellule blind-fr-customer-success-direct / gpt-5.5, 1 appel provider maximum, budget USD 0.15, plafond conservateur USD 0.135595, retries 0, repairs 0, aucun évaluateur LLM, aucun pack reviewer/reveal.`;
}

export function assertCoverLetterEval3aLiveGate(args: {
  plan: CoverLetterEval3aPlan;
  approvalPhrase: string;
  sourceRef: string;
  currentHeadSourceRef: string;
  explicitLiveProviderOptIn: boolean;
  environmentLiveProviderOptIn: boolean;
  maxCalls: number;
  maxRepairs: number;
  maxUsd: number;
  declaredMaxUsdPerCall: number;
}): void {
  if (args.plan.status !== "READY_FOR_APPROVAL") {
    throw new Error("QUALITY-EVAL-3A plan is not READY_FOR_APPROVAL.");
  }
  if (args.approvalPhrase !== args.plan.approvalPhrase) {
    throw new Error(
      "QUALITY-EVAL-3A requires the exact versioned approval phrase.",
    );
  }
  if (args.sourceRef !== args.currentHeadSourceRef) {
    throw new Error(
      "QUALITY-EVAL-3A requires sourceRef to match the current Git HEAD.",
    );
  }
  if (!args.explicitLiveProviderOptIn) {
    throw new Error("QUALITY-EVAL-3A requires explicit live provider opt-in.");
  }
  if (!args.environmentLiveProviderOptIn) {
    throw new Error("QUALITY-EVAL-3A requires COVER_LETTER_EVAL_LIVE=1.");
  }
  if (args.maxCalls !== args.plan.plannedProviderCalls) {
    throw new Error(
      `QUALITY-EVAL-3A requires maxCalls=${args.plan.plannedProviderCalls}.`,
    );
  }
  if (args.maxRepairs !== 0) {
    throw new Error("QUALITY-EVAL-3A requires maxRepairs=0.");
  }
  if (args.maxUsd !== args.plan.budget.maxUsd) {
    throw new Error(
      `QUALITY-EVAL-3A requires maxUsd=${args.plan.budget.maxUsd}.`,
    );
  }
  if (args.declaredMaxUsdPerCall !== args.plan.budget.declaredMaxUsdPerCall) {
    throw new Error(
      `QUALITY-EVAL-3A requires declaredMaxUsdPerCall=${args.plan.budget.declaredMaxUsdPerCall}.`,
    );
  }
}

export function assertCoverLetterEval3aFinalizationDiagnosticLiveGate(args: {
  plan: CoverLetterEval3aFinalizationDiagnosticPlan;
  approvalPhrase: string;
  sourceRef: string;
  currentHeadSourceRef: string;
  runId: string;
  explicitLiveProviderOptIn: boolean;
  environmentLiveProviderOptIn: boolean;
  maxCalls: number;
  maxRepairs: number;
  maxUsd: number;
  declaredMaxUsdPerCall: number;
}): void {
  if (!args.explicitLiveProviderOptIn || !args.environmentLiveProviderOptIn) {
    throw new Error(
      "QUALITY-EVAL-3A finalization diagnostic requires both explicit and environment live opt-in.",
    );
  }
  if (
    args.plan.status !== "READY_FOR_APPROVAL" ||
    args.sourceRef !== args.currentHeadSourceRef ||
    args.approvalPhrase !==
      buildCoverLetterEval3aFinalizationDiagnosticApprovalPhrase({
        sourceRef: args.sourceRef,
        planHash: args.plan.planHash,
        runId: args.runId,
      }) ||
    args.maxCalls !== args.plan.plannedProviderCalls ||
    args.maxRepairs !== args.plan.maxRepairs ||
    args.maxUsd !== args.plan.budget.maxUsd ||
    args.declaredMaxUsdPerCall !== args.plan.budget.declaredMaxUsdPerCall
  ) {
    throw new Error(
      "QUALITY-EVAL-3A finalization diagnostic requires the exact one-cell approval and budget contract.",
    );
  }
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EEXIST"
  );
}

async function resolveNonSymlinkOutputTree(
  requestedPath: string,
): Promise<string> {
  const absolutePath = path.resolve(requestedPath);
  const root = path.parse(absolutePath).root;
  const remainingSegments = absolutePath
    .slice(root.length)
    .split(path.sep)
    .filter(Boolean);
  let canonicalPath = root;
  while (remainingSegments.length > 0) {
    const segment = remainingSegments.shift()!;
    const candidate = path.join(canonicalPath, segment);
    try {
      canonicalPath = await resolveExistingPrivateDirectorySegment({
        candidate,
        canonicalParent: canonicalPath,
        segment,
      });
    } catch (error) {
      if (!isMissingPathError(error)) throw error;
      return path.join(canonicalPath, segment, ...remainingSegments);
    }
  }
  return canonicalPath;
}

async function resolveExistingPrivateDirectorySegment(args: {
  candidate: string;
  canonicalParent: string;
  segment: string;
}): Promise<string> {
  const candidateStats = await lstat(args.candidate);
  if (!candidateStats.isSymbolicLink()) {
    assertPrivateDirectoryEntry(candidateStats, args.candidate);
    return realpath(args.candidate);
  }
  const trustedSystemAlias =
    platform() === "darwin" &&
    args.canonicalParent === path.parse(args.canonicalParent).root &&
    (args.segment === "tmp" || args.segment === "var");
  if (!trustedSystemAlias) {
    throw new Error(
      `QUALITY-EVAL-3A refuses a non-directory or symlink output path: ${args.candidate}.`,
    );
  }
  const resolvedCandidate = await realpath(args.candidate);
  assertPrivateDirectoryEntry(
    await lstat(resolvedCandidate),
    resolvedCandidate,
  );
  return resolvedCandidate;
}

function assertPrivateDirectoryEntry(
  entry: Awaited<ReturnType<typeof lstat>>,
  entryPath: string,
): void {
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error(
      `QUALITY-EVAL-3A refuses a non-directory or symlink output path: ${entryPath}.`,
    );
  }
}

async function ensurePrivateDirectory(directory: string): Promise<string> {
  const safeDirectory = await resolveNonSymlinkOutputTree(directory);
  await mkdir(safeDirectory, { recursive: true, mode: 0o700 });
  assertPrivateDirectoryEntry(await lstat(safeDirectory), safeDirectory);
  await chmod(safeDirectory, 0o700);
  return safeDirectory;
}

async function preparePrivateOutputDirectories(
  outputDirectory: string,
): Promise<
  Readonly<{
    root: string;
    review: string;
    reveal: string;
    evidence: string;
  }>
> {
  if (!outputDirectory.trim()) {
    throw new Error(
      "QUALITY-EVAL-3A requires an explicit private output directory.",
    );
  }
  const root = await ensurePrivateDirectory(outputDirectory);
  return {
    root,
    review: await ensurePrivateDirectory(path.join(root, "private-review")),
    reveal: await ensurePrivateDirectory(path.join(root, "private-reveal")),
    evidence: await ensurePrivateDirectory(path.join(root, "private-evidence")),
  };
}

async function writePrivateFileAtomic(args: {
  directory: string;
  fileName: string;
  content: string;
}): Promise<string> {
  const target = await preparePrivateFileTarget(args.directory, args.fileName);
  try {
    await writePrivateTemporaryFile(target.temporaryPath, args.content);
    await publishPrivateFile(target);
  } finally {
    await rm(target.temporaryPath, { force: true });
  }
  await chmod(target.filePath, 0o600);
  return target.filePath;
}

async function preparePrivateFileTarget(
  requestedDirectory: string,
  fileName: string,
): Promise<{ temporaryPath: string; filePath: string }> {
  const directory = await ensurePrivateDirectory(requestedDirectory);
  return {
    temporaryPath: path.join(directory, `.${fileName}.${randomUUID()}.tmp`),
    filePath: path.join(directory, fileName),
  };
}

async function writePrivateTemporaryFile(
  temporaryPath: string,
  content: string,
): Promise<void> {
  await writeFile(temporaryPath, content, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await chmod(temporaryPath, 0o600);
}

async function publishPrivateFile(args: {
  temporaryPath: string;
  filePath: string;
}): Promise<void> {
  try {
    await link(args.temporaryPath, args.filePath);
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      throw new Error(
        `QUALITY-EVAL-3A refuses to overwrite private evidence: ${args.filePath}.`,
      );
    }
    throw error;
  }
}

function assertReviewerPackHasNoProviderIdentity(
  pack: CoverLetterBlindReviewPack,
): void {
  const serialized = JSON.stringify(pack);
  if (
    /"writer(?:Model|Provider)"/u.test(serialized) ||
    QUALITY_EVAL3A_WRITER_MODELS.some((model) => serialized.includes(model))
  ) {
    throw new Error(
      "QUALITY-EVAL-3A reviewer-safe pack leaked provider identity.",
    );
  }
}

export async function writeCoverLetterEval3aPrivateArtifacts(args: {
  outputDirectory: string;
  pack: CoverLetterBlindReviewPack;
  revealMap: CoverLetterBlindReviewRevealMap;
  ledger: unknown;
}): Promise<
  Readonly<{
    packJsonPath: string;
    packMarkdownPath: string;
    revealMapJsonPath: string;
    ledgerJsonPath: string;
  }>
> {
  if (
    args.pack.cohortId !== QUALITY_EVAL3A_COHORT_ID ||
    args.revealMap.cohortId !== QUALITY_EVAL3A_COHORT_ID ||
    args.revealMap.packHash !== args.pack.packHash
  ) {
    throw new Error(
      "QUALITY-EVAL-3A private artifacts do not share the exact cohort and pack hash.",
    );
  }
  assertReviewerPackHasNoProviderIdentity(args.pack);
  const directories = await preparePrivateOutputDirectories(
    args.outputDirectory,
  );
  return {
    packJsonPath: await writePrivateFileAtomic({
      directory: directories.review,
      fileName: "blind-review-pack.json",
      content: `${JSON.stringify(args.pack, null, 2)}\n`,
    }),
    packMarkdownPath: await writePrivateFileAtomic({
      directory: directories.review,
      fileName: "blind-review-pack.md",
      content: renderCoverLetterBlindReviewMarkdown(args.pack),
    }),
    revealMapJsonPath: await writePrivateFileAtomic({
      directory: directories.reveal,
      fileName: "blind-review-reveal-map.json",
      content: `${JSON.stringify(args.revealMap, null, 2)}\n`,
    }),
    ledgerJsonPath: await writePrivateFileAtomic({
      directory: directories.evidence,
      fileName: "eval3a-run-ledger.json",
      content: `${JSON.stringify(args.ledger, null, 2)}\n`,
    }),
  };
}

async function writeFailureLedger(args: {
  outputDirectory: string;
  ledger: unknown;
}): Promise<string> {
  const directories = await preparePrivateOutputDirectories(
    args.outputDirectory,
  );
  return writePrivateFileAtomic({
    directory: directories.evidence,
    fileName: "eval3a-run-failure.json",
    content: `${JSON.stringify(args.ledger, null, 2)}\n`,
  });
}

type CoverLetterEval3aGenerateRecord = (args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: CoverLetterEval3aWriterModel;
  apiKey: string;
  budget: ReturnType<typeof createCoverLetterEvalBudget>;
}) => Promise<CoverLetterHumanReviewResult>;

type CoverLetterEval3aRunArgs = {
  mode?: string;
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
  generateRecord?: CoverLetterEval3aGenerateRecord;
};

type CoverLetterEval3aHeldOutRunResult = Readonly<{
  status: "HUMAN_REVIEW_PENDING";
  plan: CoverLetterEval3aPlan;
  records: readonly CoverLetterHumanReviewRecord[];
  budget: ReturnType<
    ReturnType<typeof createCoverLetterEvalBudget>["snapshot"]
  >;
  paths: Awaited<ReturnType<typeof writeCoverLetterEval3aPrivateArtifacts>>;
}>;

export type CoverLetterEval3aFinalizationDiagnosticRunResult = Readonly<{
  status:
    | "DIAGNOSTIC_REPRODUCED"
    | "DIAGNOSTIC_NOT_REPRODUCED"
    | "DIAGNOSTIC_INCONCLUSIVE";
  plan: CoverLetterEval3aFinalizationDiagnosticPlan;
  recordStatus: CoverLetterHumanReviewResult["status"];
  budget: ReturnType<
    ReturnType<typeof createCoverLetterEvalBudget>["snapshot"]
  >;
  ledgerPath: string;
}>;

function resolveCurrentGitHeadSourceRef(): string {
  const sourceRef = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (!/^[a-f0-9]{40}$/u.test(sourceRef)) {
    throw new Error(
      "QUALITY-EVAL-3A finalization diagnostic could not resolve an exact Git HEAD.",
    );
  }
  return sourceRef;
}

function classifyCoverLetterEval3aFinalizationDiagnostic(
  status: CoverLetterHumanReviewResult["status"],
) {
  if (status === "finalization_failed") {
    return {
      status: "DIAGNOSTIC_REPRODUCED",
      verdict: "REPRODUCED_FINALIZATION_FAILURE",
      message:
        "QUALITY-EVAL-3A finalization diagnostic reproduced the fixed-cell finalization failure.",
    } as const;
  }
  if (status === "human_review_pending") {
    return {
      status: "DIAGNOSTIC_NOT_REPRODUCED",
      verdict: "NOT_REPRODUCED_FINALIZATION_SUCCEEDED",
      message:
        "QUALITY-EVAL-3A finalization diagnostic did not reproduce the fixed-cell finalization failure.",
    } as const;
  }
  return {
    status: "DIAGNOSTIC_INCONCLUSIVE",
    verdict: "INCONCLUSIVE_NON_FINALIZATION_STATUS",
    message:
      "QUALITY-EVAL-3A finalization diagnostic ended with a non-finalization failure status.",
  } as const;
}

function buildCoverLetterEval3aFinalizationDiagnosticLedger(args: {
  plan: CoverLetterEval3aFinalizationDiagnosticPlan;
  runId: string;
  sourceRef: string;
  budget: ReturnType<
    ReturnType<typeof createCoverLetterEvalBudget>["snapshot"]
  >;
  failureDiagnostic: CoverLetterEval3aFailureDiagnostic | null;
  diagnosticVerdict:
    | "REPRODUCED_FINALIZATION_FAILURE"
    | "NOT_REPRODUCED_FINALIZATION_SUCCEEDED"
    | "INCONCLUSIVE_NON_FINALIZATION_STATUS"
    | "EXECUTION_FAILED_BEFORE_CLASSIFICATION";
  recordStatus: CoverLetterHumanReviewResult["status"] | null;
  error: string;
}) {
  return {
    version: "cover_letter_eval3a_failure_ledger_v2",
    status: "FAILED_CLOSED",
    runMode: QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.runMode,
    planHash: args.plan.planHash,
    approvalPhraseVersion: args.plan.approvalPhraseVersion,
    runId: args.runId,
    sourceRef: args.sourceRef,
    target: {
      caseId: QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.caseId,
      writerModel: QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.writerModel,
    },
    budget: args.budget,
    completedRecordCount: 0,
    failureDiagnostic: args.failureDiagnostic,
    diagnosticVerdict: args.diagnosticVerdict,
    recordStatus: args.recordStatus,
    llmEvaluator: "none",
    reviewerPackWritten: false,
    revealMapWritten: false,
    error: args.error,
  } as const;
}

function assertExactCoverLetterEval3aFinalizationDiagnosticBudget(
  snapshot: ReturnType<
    ReturnType<typeof createCoverLetterEvalBudget>["snapshot"]
  >,
): void {
  if (
    snapshot.usage.reservedCalls !==
      QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.maxCalls ||
    snapshot.usage.reservedRepairs !== 0 ||
    snapshot.usage.reservedUsd !==
      QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.declaredMaxUsdPerCall
  ) {
    throw new Error(
      "QUALITY-EVAL-3A finalization diagnostic stopped on inexact provider-call accounting.",
    );
  }
}

async function writeCoverLetterEval3aFinalizationDiagnosticExecutionFailure(args: {
  outputDirectory: string;
  plan: CoverLetterEval3aFinalizationDiagnosticPlan;
  runId: string;
  sourceRef: string;
  budget: ReturnType<typeof createCoverLetterEvalBudget>;
  failureDiagnostic: CoverLetterEval3aFailureDiagnostic | null;
  error: unknown;
}): Promise<void> {
  try {
    await writeFailureLedger({
      outputDirectory: args.outputDirectory,
      ledger: buildCoverLetterEval3aFinalizationDiagnosticLedger({
        plan: args.plan,
        runId: args.runId,
        sourceRef: args.sourceRef,
        budget: args.budget.snapshot(),
        failureDiagnostic: args.failureDiagnostic,
        diagnosticVerdict: "EXECUTION_FAILED_BEFORE_CLASSIFICATION",
        recordStatus: null,
        error:
          "QUALITY-EVAL-3A finalization diagnostic failed before safe capture completed.",
      }),
    });
  } catch (ledgerError) {
    if (args.error instanceof Error) {
      Object.defineProperty(args.error, "cause", {
        configurable: true,
        value: ledgerError,
      });
      return;
    }
    throw new Error(
      "QUALITY-EVAL-3A finalization diagnostic failed and its private failure ledger could not be written.",
      { cause: new AggregateError([args.error, ledgerError]) },
    );
  }
}

async function runCoverLetterEval3aFinalizationDiagnostic(
  args: CoverLetterEval3aRunArgs & {
    mode: typeof QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.runMode;
  },
): Promise<CoverLetterEval3aFinalizationDiagnosticRunResult> {
  const plan = await buildCoverLetterEval3aFinalizationDiagnosticPlan();
  assertCoverLetterEval3aFinalizationDiagnosticLiveGate({
    plan,
    approvalPhrase: args.approvalPhrase,
    sourceRef: args.sourceRef,
    currentHeadSourceRef: resolveCurrentGitHeadSourceRef(),
    runId: args.runId,
    explicitLiveProviderOptIn: args.explicitLiveProviderOptIn,
    environmentLiveProviderOptIn: process.env.COVER_LETTER_EVAL_LIVE === "1",
    maxCalls: args.maxCalls,
    maxRepairs: args.maxRepairs,
    maxUsd: args.maxUsd,
    declaredMaxUsdPerCall: args.declaredMaxUsdPerCall,
  });
  await preparePrivateOutputDirectories(args.outputDirectory);
  if (!args.apiKey.trim()) {
    throw new Error(
      "QUALITY-EVAL-3A finalization diagnostic requires OPENAI_API_KEY after approval.",
    );
  }
  const budget = createCoverLetterEvalBudget({
    explicitLiveProviderOptIn: true,
    maxCalls: QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.maxCalls,
    maxRepairs: 0,
    maxUsd: QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.maxUsd,
    declaredMaxUsdPerCall:
      QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.declaredMaxUsdPerCall,
  });
  const benchmarkCase = getCoverLetterEval3aFinalizationDiagnosticCase();
  const generateRecord =
    args.generateRecord ?? benchmarkCoverLetterCaseForHumanReview;
  let failureDiagnostic: CoverLetterEval3aFailureDiagnostic | null = null;
  try {
    const record = await generateRecord({
      benchmarkCase,
      writerModel: QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.writerModel,
      apiKey: args.apiKey,
      budget,
    });
    failureDiagnostic = projectCoverLetterEval3aFailureDiagnostic(record);
    const snapshot = budget.snapshot();
    assertExactCoverLetterEval3aFinalizationDiagnosticBudget(snapshot);
    const classification = classifyCoverLetterEval3aFinalizationDiagnostic(
      record.status,
    );
    const ledgerPath = await writeFailureLedger({
      outputDirectory: args.outputDirectory,
      ledger: buildCoverLetterEval3aFinalizationDiagnosticLedger({
        plan,
        runId: args.runId,
        sourceRef: args.sourceRef,
        budget: snapshot,
        failureDiagnostic,
        diagnosticVerdict: classification.verdict,
        recordStatus: record.status,
        error: classification.message,
      }),
    });
    return {
      status: classification.status,
      plan,
      recordStatus: record.status,
      budget: snapshot,
      ledgerPath,
    };
  } catch (error) {
    await writeCoverLetterEval3aFinalizationDiagnosticExecutionFailure({
      outputDirectory: args.outputDirectory,
      plan,
      runId: args.runId,
      sourceRef: args.sourceRef,
      budget,
      failureDiagnostic,
      error,
    });
    throw error;
  }
}

class CoverLetterEval3aRecordFailure extends Error {
  readonly failureDiagnostic: CoverLetterEval3aFailureDiagnostic;

  constructor(record: CoverLetterHumanReviewResult) {
    super(
      `QUALITY-EVAL-3A failed closed at ${record.caseId}/${record.writerModel} with status ${record.status}.`,
    );
    this.name = "CoverLetterEval3aRecordFailure";
    this.failureDiagnostic = projectCoverLetterEval3aFailureDiagnostic(record);
  }
}

function assertCoverLetterEval3aRunIdentity(args: {
  runId: string;
  sourceRef: string;
}): void {
  if (!args.runId.trim() || !/^[a-f0-9]{40}$/u.test(args.sourceRef)) {
    throw new Error(
      "QUALITY-EVAL-3A requires a non-empty runId and exact 40-character sourceRef.",
    );
  }
}

function assertCoverLetterEval3aApiKey(apiKey: string): void {
  if (!apiKey.trim()) {
    throw new Error("QUALITY-EVAL-3A requires OPENAI_API_KEY after approval.");
  }
}

async function collectCoverLetterEval3aHeldOutRecords(args: {
  cases: readonly CoverLetterBenchmarkCase[];
  records: CoverLetterHumanReviewRecord[];
  apiKey: string;
  budget: ReturnType<typeof createCoverLetterEvalBudget>;
  generateRecord?: CoverLetterEval3aGenerateRecord;
}): Promise<void> {
  const executionPlan = buildCoverLetterHumanReviewPlan({
    cases: args.cases,
    writerModels: QUALITY_EVAL3A_WRITER_MODELS,
  });
  const generateRecord =
    args.generateRecord ?? benchmarkCoverLetterCaseForHumanReview;
  for (const item of executionPlan) {
    const writerModel = item.writerModel as CoverLetterEval3aWriterModel;
    const record = await generateRecord({
      benchmarkCase: item.benchmarkCase,
      writerModel,
      apiKey: args.apiKey,
      budget: args.budget,
    });
    if (record.status !== "human_review_pending") {
      throw new CoverLetterEval3aRecordFailure(record);
    }
    args.records.push(record);
  }
}

function assertExactCoverLetterEval3aHeldOutBudget(args: {
  plan: CoverLetterEval3aPlan;
  snapshot: ReturnType<
    ReturnType<typeof createCoverLetterEvalBudget>["snapshot"]
  >;
}): void {
  if (
    args.snapshot.usage.reservedCalls !== args.plan.plannedProviderCalls ||
    args.snapshot.usage.reservedRepairs !== 0
  ) {
    throw new Error(
      "QUALITY-EVAL-3A completed without the exact provider-call accounting.",
    );
  }
}

async function completeCoverLetterEval3aHeldOutRun(args: {
  runArgs: CoverLetterEval3aRunArgs;
  plan: CoverLetterEval3aPlan;
  cases: readonly CoverLetterBenchmarkCase[];
  records: readonly CoverLetterHumanReviewRecord[];
  budget: ReturnType<typeof createCoverLetterEvalBudget>;
}): Promise<CoverLetterEval3aHeldOutRunResult> {
  const snapshot = args.budget.snapshot();
  assertExactCoverLetterEval3aHeldOutBudget({
    plan: args.plan,
    snapshot,
  });
  const artifacts = await buildCoverLetterBlindReviewArtifacts({
    cohortId: QUALITY_EVAL3A_COHORT_ID,
    runId: args.runArgs.runId,
    sourceRef: args.runArgs.sourceRef,
    cases: args.cases,
    records: args.records,
  });
  const ledger = {
    version: "cover_letter_eval3a_run_ledger_v1",
    status: "HUMAN_REVIEW_PENDING",
    planHash: args.plan.planHash,
    approvalPhraseVersion: args.plan.approvalPhraseVersion,
    runId: args.runArgs.runId,
    sourceRef: args.runArgs.sourceRef,
    budget: snapshot,
    completedRecords: args.records.map((record) => ({
      caseId: record.caseId,
      artifactHash: record.artifact.artifactHash,
      provenanceHash: record.artifact.provenanceHash,
      runManifest: record.runManifest ?? null,
    })),
    llmEvaluator: "none",
  } as const;
  const paths = await writeCoverLetterEval3aPrivateArtifacts({
    outputDirectory: args.runArgs.outputDirectory,
    pack: artifacts.pack,
    revealMap: artifacts.revealMap,
    ledger,
  });
  return {
    status: "HUMAN_REVIEW_PENDING",
    plan: args.plan,
    records: args.records,
    budget: snapshot,
    paths,
  };
}

async function writeCoverLetterEval3aHeldOutExecutionFailure(args: {
  runArgs: CoverLetterEval3aRunArgs;
  plan: CoverLetterEval3aPlan;
  budget: ReturnType<typeof createCoverLetterEvalBudget>;
  completedRecordCount: number;
  error: unknown;
}): Promise<void> {
  const failureDiagnostic =
    args.error instanceof CoverLetterEval3aRecordFailure
      ? args.error.failureDiagnostic
      : null;
  try {
    await writeFailureLedger({
      outputDirectory: args.runArgs.outputDirectory,
      ledger: {
        version: "cover_letter_eval3a_failure_ledger_v2",
        status: "FAILED_CLOSED",
        planHash: args.plan.planHash,
        runId: args.runArgs.runId,
        sourceRef: args.runArgs.sourceRef,
        budget: args.budget.snapshot(),
        completedRecordCount: args.completedRecordCount,
        failureDiagnostic,
        error:
          args.error instanceof CoverLetterEval3aRecordFailure
            ? args.error.message
            : "QUALITY-EVAL-3A failed before a sanitized record diagnostic was available.",
      },
    });
  } catch (ledgerError) {
    if (args.error instanceof Error) {
      Object.defineProperty(args.error, "cause", {
        configurable: true,
        value: ledgerError,
      });
      return;
    }
    throw new Error(
      "QUALITY-EVAL-3A failed and its private failure ledger could not be written.",
      { cause: new AggregateError([args.error, ledgerError]) },
    );
  }
}

async function runCoverLetterEval3aFullHeldOut(
  args: CoverLetterEval3aRunArgs,
): Promise<CoverLetterEval3aHeldOutRunResult> {
  const plan = await buildCoverLetterEval3aPlan();
  assertCoverLetterEval3aLiveGate({
    plan,
    approvalPhrase: args.approvalPhrase,
    sourceRef: args.sourceRef,
    currentHeadSourceRef: resolveCurrentGitHeadSourceRef(),
    explicitLiveProviderOptIn: args.explicitLiveProviderOptIn,
    environmentLiveProviderOptIn: process.env.COVER_LETTER_EVAL_LIVE === "1",
    maxCalls: args.maxCalls,
    maxRepairs: args.maxRepairs,
    maxUsd: args.maxUsd,
    declaredMaxUsdPerCall: args.declaredMaxUsdPerCall,
  });
  assertCoverLetterEval3aRunIdentity(args);
  await preparePrivateOutputDirectories(args.outputDirectory);
  assertCoverLetterEval3aApiKey(args.apiKey);
  const budget = createCoverLetterEvalBudget({
    explicitLiveProviderOptIn: true,
    maxCalls: args.maxCalls,
    maxRepairs: args.maxRepairs,
    maxUsd: args.maxUsd,
    declaredMaxUsdPerCall: args.declaredMaxUsdPerCall,
  });
  const cases = getCoverLetterEval3aHeldOutCases();
  const records: CoverLetterHumanReviewRecord[] = [];
  try {
    await collectCoverLetterEval3aHeldOutRecords({
      cases,
      records,
      apiKey: args.apiKey,
      budget,
      generateRecord: args.generateRecord,
    });
    return await completeCoverLetterEval3aHeldOutRun({
      runArgs: args,
      plan,
      cases,
      records,
      budget,
    });
  } catch (error) {
    await writeCoverLetterEval3aHeldOutExecutionFailure({
      runArgs: args,
      plan,
      budget,
      completedRecordCount: records.length,
      error,
    });
    throw error;
  }
}

export async function runCoverLetterEval3aHeldOut(
  args: CoverLetterEval3aRunArgs,
): Promise<
  | CoverLetterEval3aHeldOutRunResult
  | CoverLetterEval3aFinalizationDiagnosticRunResult
> {
  if (
    args.mode !== undefined &&
    args.mode !== QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.runMode
  ) {
    throw new Error("QUALITY-EVAL-3A refuses an unsupported run mode.");
  }
  if (args.mode === QUALITY_EVAL3A_FINALIZATION_DIAGNOSTIC.runMode) {
    return runCoverLetterEval3aFinalizationDiagnostic({
      ...args,
      mode: args.mode,
    });
  }
  return runCoverLetterEval3aFullHeldOut(args);
}
