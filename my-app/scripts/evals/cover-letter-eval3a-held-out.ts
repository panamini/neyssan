import { randomUUID } from "node:crypto";
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
export const QUALITY_EVAL3A_APPROVAL_PHRASE_VERSION =
  "quality_eval3a_approval_phrase_v1";

type CoverLetterEval3aWriterModel =
  (typeof QUALITY_EVAL3A_WRITER_MODELS)[number];

type CoverLetterEval3aFailureRecord = Exclude<
  CoverLetterHumanReviewResult,
  CoverLetterHumanReviewRecord
>;

type CoverLetterEval3aFinalizationDiagnosticSource = NonNullable<
  CoverLetterEval3aFailureRecord["artifact"]
>["diagnostics"]["finalization"];

type CoverLetterEval3aFailureDiagnostic = Readonly<{
  version: "cover_letter_eval3a_failure_diagnostic_v1";
  status: CoverLetterEval3aFailureRecord["status"];
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
  record: CoverLetterEval3aFailureRecord,
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
  version: "cover_letter_eval3a_plan_v1";
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

function buildApprovalPhrase(plannedProviderCalls: number): string {
  return `J’approuve EVAL3A v1 : ${plannedProviderCalls} appels provider maximum, budget USD ${QUALITY_EVAL3A_LIVE_MAX_USD.toFixed(2)}, modèles gpt-5.5 et gpt-5.6-sol, retries 0, repairs 0, aucun évaluateur LLM.`;
}

async function hashPlanBody(
  body: Omit<CoverLetterEval3aPlan, "planHash">,
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
  const body: Omit<CoverLetterEval3aPlan, "planHash"> = {
    version: "cover_letter_eval3a_plan_v1",
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
    approvalPhrase: buildApprovalPhrase(preflight.plannedProviderCalls),
  };
  return { ...body, planHash: await hashPlanBody(body) };
}

export function assertCoverLetterEval3aLiveGate(args: {
  plan: CoverLetterEval3aPlan;
  approvalPhrase: string;
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
  const segments = absolutePath
    .slice(root.length)
    .split(path.sep)
    .filter(Boolean);
  let canonicalPath = root;
  for (let index = 0; index < segments.length; index += 1) {
    const candidate = path.join(canonicalPath, segments[index]!);
    let candidateStats;
    try {
      candidateStats = await lstat(candidate);
    } catch (error) {
      if (!isMissingPathError(error)) throw error;
      return path.join(canonicalPath, ...segments.slice(index));
    }
    if (candidateStats.isSymbolicLink()) {
      const trustedSystemAlias =
        platform() === "darwin" &&
        canonicalPath === root &&
        (segments[index] === "tmp" || segments[index] === "var");
      if (trustedSystemAlias) {
        const resolvedCandidate = await realpath(candidate);
        if ((await lstat(resolvedCandidate)).isDirectory()) {
          canonicalPath = resolvedCandidate;
          continue;
        }
      }
    }
    if (!candidateStats.isDirectory()) {
      throw new Error(
        `QUALITY-EVAL-3A refuses a non-directory or symlink output path: ${candidate}.`,
      );
    }
    canonicalPath = await realpath(candidate);
  }
  return canonicalPath;
}

async function ensurePrivateDirectory(directory: string): Promise<string> {
  const safeDirectory = await resolveNonSymlinkOutputTree(directory);
  await mkdir(safeDirectory, { recursive: true, mode: 0o700 });
  const directoryStats = await lstat(safeDirectory);
  if (!directoryStats.isDirectory()) {
    throw new Error(
      `QUALITY-EVAL-3A refuses a non-directory or symlink output path: ${safeDirectory}.`,
    );
  }
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
  const directory = await ensurePrivateDirectory(args.directory);
  const filePath = path.join(directory, args.fileName);
  const temporaryPath = path.join(
    directory,
    `.${args.fileName}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, args.content, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    await chmod(temporaryPath, 0o600);
    try {
      await link(temporaryPath, filePath);
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        throw new Error(
          `QUALITY-EVAL-3A refuses to overwrite private evidence: ${filePath}.`,
        );
      }
      throw error;
    }
  } finally {
    await rm(temporaryPath, { force: true });
  }
  await chmod(filePath, 0o600);
  return filePath;
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

export async function runCoverLetterEval3aHeldOut(args: {
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
  generateRecord?: (args: {
    benchmarkCase: CoverLetterBenchmarkCase;
    writerModel: CoverLetterEval3aWriterModel;
    apiKey: string;
    budget: ReturnType<typeof createCoverLetterEvalBudget>;
  }) => Promise<CoverLetterHumanReviewResult>;
}): Promise<
  Readonly<{
    status: "HUMAN_REVIEW_PENDING";
    plan: CoverLetterEval3aPlan;
    records: readonly CoverLetterHumanReviewRecord[];
    budget: ReturnType<
      ReturnType<typeof createCoverLetterEvalBudget>["snapshot"]
    >;
    paths: Awaited<ReturnType<typeof writeCoverLetterEval3aPrivateArtifacts>>;
  }>
> {
  const plan = await buildCoverLetterEval3aPlan();
  assertCoverLetterEval3aLiveGate({
    plan,
    approvalPhrase: args.approvalPhrase,
    explicitLiveProviderOptIn: args.explicitLiveProviderOptIn,
    environmentLiveProviderOptIn: process.env.COVER_LETTER_EVAL_LIVE === "1",
    maxCalls: args.maxCalls,
    maxRepairs: args.maxRepairs,
    maxUsd: args.maxUsd,
    declaredMaxUsdPerCall: args.declaredMaxUsdPerCall,
  });
  if (!args.runId.trim() || !/^[a-f0-9]{40}$/u.test(args.sourceRef)) {
    throw new Error(
      "QUALITY-EVAL-3A requires a non-empty runId and exact 40-character sourceRef.",
    );
  }
  await preparePrivateOutputDirectories(args.outputDirectory);
  if (!args.apiKey.trim()) {
    throw new Error("QUALITY-EVAL-3A requires OPENAI_API_KEY after approval.");
  }
  const budget = createCoverLetterEvalBudget({
    explicitLiveProviderOptIn: true,
    maxCalls: args.maxCalls,
    maxRepairs: args.maxRepairs,
    maxUsd: args.maxUsd,
    declaredMaxUsdPerCall: args.declaredMaxUsdPerCall,
  });
  const cases = getCoverLetterEval3aHeldOutCases();
  const executionPlan = buildCoverLetterHumanReviewPlan({
    cases,
    writerModels: QUALITY_EVAL3A_WRITER_MODELS,
  });
  const records: CoverLetterHumanReviewRecord[] = [];
  let failureDiagnostic: CoverLetterEval3aFailureDiagnostic | null = null;
  try {
    for (const item of executionPlan) {
      const writerModel = item.writerModel as CoverLetterEval3aWriterModel;
      const record = args.generateRecord
        ? await args.generateRecord({
            benchmarkCase: item.benchmarkCase,
            writerModel,
            apiKey: args.apiKey,
            budget,
          })
        : await benchmarkCoverLetterCaseForHumanReview({
            benchmarkCase: item.benchmarkCase,
            writerModel,
            apiKey: args.apiKey,
            budget,
          });
      if (record.status !== "human_review_pending") {
        failureDiagnostic = projectCoverLetterEval3aFailureDiagnostic(record);
        throw new Error(
          `QUALITY-EVAL-3A failed closed at ${record.caseId}/${record.writerModel}: ${record.error ?? record.status}.`,
        );
      }
      records.push(record);
    }
    const snapshot = budget.snapshot();
    if (
      snapshot.usage.reservedCalls !== plan.plannedProviderCalls ||
      snapshot.usage.reservedRepairs !== 0
    ) {
      throw new Error(
        "QUALITY-EVAL-3A completed without the exact provider-call accounting.",
      );
    }
    const artifacts = await buildCoverLetterBlindReviewArtifacts({
      cohortId: QUALITY_EVAL3A_COHORT_ID,
      runId: args.runId,
      sourceRef: args.sourceRef,
      cases,
      records,
    });
    const ledger = {
      version: "cover_letter_eval3a_run_ledger_v1",
      status: "HUMAN_REVIEW_PENDING",
      planHash: plan.planHash,
      approvalPhraseVersion: plan.approvalPhraseVersion,
      runId: args.runId,
      sourceRef: args.sourceRef,
      budget: snapshot,
      completedRecords: records.map((record) => ({
        caseId: record.caseId,
        artifactHash: record.artifact.artifactHash,
        provenanceHash: record.artifact.provenanceHash,
        runManifest: record.runManifest ?? null,
      })),
      llmEvaluator: "none",
    } as const;
    const paths = await writeCoverLetterEval3aPrivateArtifacts({
      outputDirectory: args.outputDirectory,
      pack: artifacts.pack,
      revealMap: artifacts.revealMap,
      ledger,
    });
    return {
      status: "HUMAN_REVIEW_PENDING",
      plan,
      records,
      budget: snapshot,
      paths,
    };
  } catch (error) {
    try {
      await writeFailureLedger({
        outputDirectory: args.outputDirectory,
        ledger: {
          version: "cover_letter_eval3a_failure_ledger_v2",
          status: "FAILED_CLOSED",
          planHash: plan.planHash,
          runId: args.runId,
          sourceRef: args.sourceRef,
          budget: budget.snapshot(),
          completedRecordCount: records.length,
          failureDiagnostic,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    } catch (ledgerError) {
      if (error instanceof Error) {
        Object.defineProperty(error, "cause", {
          configurable: true,
          value: ledgerError,
        });
      } else {
        throw new Error(
          "QUALITY-EVAL-3A failed and its private failure ledger could not be written.",
          { cause: new AggregateError([error, ledgerError]) },
        );
      }
    }
    throw error;
  }
}
