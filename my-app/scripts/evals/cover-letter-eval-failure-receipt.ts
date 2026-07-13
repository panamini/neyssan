import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { buildStableHash } from "../../src/modules/application-harness/fingerprints";
import type { CoverLetterEvalBudgetSnapshot } from "./cover-letter-eval-budget";
import {
  calculateCoverLetterEvalObservedCostUpperBound,
  type CoverLetterEvalPricedWriterModel,
  type CoverLetterEvalSdkVersions,
  type CoverLetterEvalTokenUsage,
  type CoverLetterEvalRunManifestEntry,
} from "./cover-letter-eval-run-manifest";

export type CoverLetterEvalFailureAttemptMetadata = Readonly<{
  version: "cover_letter_eval_failure_attempt_metadata_v1";
  caseId: string;
  provider: "openai" | "mistral";
  requestedModel: CoverLetterEvalPricedWriterModel;
  returnedModel: string | null;
  promptHash: string | null;
  reasoningEffort: string | null;
  writerMaxOutputTokens: number;
  providerMaxRetries: number;
  tokenUsage: CoverLetterEvalTokenUsage | null;
  observedCostUpperBoundUsd: number | null;
  sdkVersions: CoverLetterEvalSdkVersions;
  artifactHash: string | null;
  provenanceHash: string | null;
}>;

export async function buildCoverLetterEvalFailureAttemptMetadata(args: {
  caseId: string;
  provider: "openai" | "mistral";
  requestedModel: CoverLetterEvalPricedWriterModel;
  returnedModel: string | null;
  prompt: string | null;
  reasoningEffort: string | null;
  writerMaxOutputTokens: number;
  providerMaxRetries: number;
  tokenUsage: CoverLetterEvalTokenUsage | null;
  sdkVersions: CoverLetterEvalSdkVersions;
  artifactHash: string | null;
  provenanceHash: string | null;
}): Promise<CoverLetterEvalFailureAttemptMetadata> {
  return {
    version: "cover_letter_eval_failure_attempt_metadata_v1",
    caseId: args.caseId,
    provider: args.provider,
    requestedModel: args.requestedModel,
    returnedModel: args.returnedModel,
    promptHash:
      args.prompt === null
        ? null
        : await buildStableHash({
            namespace: "cover-letter-eval-writer-prompt",
            type: "production-writer-prompt",
            version: 1,
            prompt: args.prompt,
          }),
    reasoningEffort: args.reasoningEffort,
    writerMaxOutputTokens: args.writerMaxOutputTokens,
    providerMaxRetries: args.providerMaxRetries,
    tokenUsage: args.tokenUsage,
    observedCostUpperBoundUsd: calculateCoverLetterEvalObservedCostUpperBound({
      writerModel: args.requestedModel,
      tokenUsage: args.tokenUsage,
    }),
    sdkVersions: args.sdkVersions,
    artifactHash: args.artifactHash,
    provenanceHash: args.provenanceHash,
  };
}

const DIAGNOSTIC_TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

type CoverLetterEvalFailureStatus =
  | "generation_failed"
  | "finalization_failed"
  | "evaluation_failed";

type CoverLetterEvalFinalizationDiagnostics = Readonly<{
  acceptanceMode: string;
  errorClass: string;
  failureStage: string | null;
  selectedBodyCandidate: string | null;
  substantiveBodyPassed: boolean | null;
  removedBridgeSentenceCount: number;
  removedLastGroundedSentence: boolean;
}>;

type CoverLetterEvalFailureReceiptInput = Readonly<{
  caseId: string;
  provider: "openai" | "mistral";
  requestedModel: CoverLetterEvalPricedWriterModel;
  status: CoverLetterEvalFailureStatus;
  failureStage: string | null;
  failureReason: string | null;
  failureIssues: readonly string[];
  finalizationDiagnostics: CoverLetterEvalFinalizationDiagnostics | null;
  artifactHash: string | null;
  provenanceHash: string | null;
  attemptMetadata: CoverLetterEvalFailureAttemptMetadata | null;
}> &
  Readonly<Record<string, unknown>>;

export type CoverLetterEvalFailureReceipt = Readonly<{
  version: "cover_letter_eval_failure_receipt_v1";
  cohortId: string;
  runId: string;
  sourceRef: string;
  plannedProviderCalls: number;
  providerMaxRetries: 0;
  maxRepairs: 0;
  completedCalls: readonly CoverLetterEvalRunManifestEntry[];
  failure: Readonly<{
    caseId: string;
    provider: "openai" | "mistral";
    requestedModel: CoverLetterEvalPricedWriterModel;
    status: CoverLetterEvalFailureStatus;
    failureStage: string | null;
    failureReason: string | null;
    failureIssues: readonly string[];
    finalizationDiagnostics: CoverLetterEvalFinalizationDiagnostics | null;
    artifactHash: string | null;
    provenanceHash: string | null;
    attemptMetadata: CoverLetterEvalFailureAttemptMetadata | null;
  }>;
  budget: CoverLetterEvalBudgetSnapshot;
}>;

function normalizeDiagnosticToken(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  return DIAGNOSTIC_TOKEN_RE.test(normalized) ? normalized : "redacted";
}

function projectFinalizationDiagnostics(
  value: CoverLetterEvalFinalizationDiagnostics | null,
): CoverLetterEvalFinalizationDiagnostics | null {
  if (value === null) return null;
  return {
    acceptanceMode: normalizeDiagnosticToken(value.acceptanceMode)!,
    errorClass: normalizeDiagnosticToken(value.errorClass)!,
    failureStage: normalizeDiagnosticToken(value.failureStage),
    selectedBodyCandidate: normalizeDiagnosticToken(
      value.selectedBodyCandidate,
    ),
    substantiveBodyPassed: value.substantiveBodyPassed,
    removedBridgeSentenceCount: value.removedBridgeSentenceCount,
    removedLastGroundedSentence: value.removedLastGroundedSentence,
  };
}

export function buildCoverLetterEvalFailureReceipt(args: {
  cohortId: string;
  runId: string;
  sourceRef: string;
  plannedProviderCalls: number;
  completedCalls: readonly CoverLetterEvalRunManifestEntry[];
  failure: CoverLetterEvalFailureReceiptInput;
  budget: CoverLetterEvalBudgetSnapshot;
}): CoverLetterEvalFailureReceipt {
  if (!args.cohortId.trim() || !args.runId.trim() || !args.sourceRef.trim()) {
    throw new Error("cohortId, runId, and sourceRef must be non-empty.");
  }
  if (
    !Number.isInteger(args.plannedProviderCalls) ||
    args.plannedProviderCalls <= 0
  ) {
    throw new Error("plannedProviderCalls must be a positive integer.");
  }

  return {
    version: "cover_letter_eval_failure_receipt_v1",
    cohortId: args.cohortId,
    runId: args.runId,
    sourceRef: args.sourceRef,
    plannedProviderCalls: args.plannedProviderCalls,
    providerMaxRetries: 0,
    maxRepairs: 0,
    completedCalls: [...args.completedCalls],
    failure: {
      caseId: args.failure.caseId,
      provider: args.failure.provider,
      requestedModel: args.failure.requestedModel,
      status: args.failure.status,
      failureStage: normalizeDiagnosticToken(args.failure.failureStage),
      failureReason: normalizeDiagnosticToken(args.failure.failureReason),
      failureIssues: [
        ...new Set(
          args.failure.failureIssues.map((issue) =>
            normalizeDiagnosticToken(issue),
          ),
        ),
      ]
        .filter((issue): issue is string => issue !== null)
        .sort(),
      finalizationDiagnostics: projectFinalizationDiagnostics(
        args.failure.finalizationDiagnostics,
      ),
      artifactHash: args.failure.artifactHash,
      provenanceHash: args.failure.provenanceHash,
      attemptMetadata: args.failure.attemptMetadata,
    },
    budget: args.budget,
  };
}

export async function writeCoverLetterEvalFailureReceipt(args: {
  outputDirectory: string;
  receipt: CoverLetterEvalFailureReceipt;
}): Promise<string> {
  const privateDirectory = path.join(
    path.resolve(args.outputDirectory),
    "private-reveal",
  );
  await mkdir(privateDirectory, { recursive: true, mode: 0o700 });
  const receiptPath = path.join(
    privateDirectory,
    "cover-letter-eval-failure-receipt.json",
  );
  await writeFile(receiptPath, `${JSON.stringify(args.receipt, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  return receiptPath;
}
