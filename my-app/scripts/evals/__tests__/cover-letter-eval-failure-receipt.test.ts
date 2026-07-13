import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildCoverLetterEvalFailureReceipt,
  writeCoverLetterEvalFailureReceipt,
  type CoverLetterEvalFailureAttemptMetadata,
} from "../cover-letter-eval-failure-receipt";
import type { CoverLetterEvalRunManifestEntry } from "../cover-letter-eval-run-manifest";

const completedEntry: CoverLetterEvalRunManifestEntry = {
  version: "cover_letter_eval_run_manifest_entry_v1",
  caseId: "blind-en-clean-engaging-direct",
  provider: "openai",
  requestedModel: "gpt-5.6-sol",
  returnedModel: "gpt-5.6-sol-2026-07-09",
  promptHash: "a".repeat(64),
  reasoningEffort: "low",
  writerMaxOutputTokens: 2_048,
  providerMaxRetries: 0,
  tokenUsage: { inputTokens: 3_000, outputTokens: 900, totalTokens: 3_900 },
  observedCostUpperBoundUsd: 0.042,
  sdkVersions: {
    openai: "4.104.0",
    mistral: "1.9.18",
    langchainMistral: "0.2.1",
  },
  artifactHash: "b".repeat(64),
  provenanceHash: "c".repeat(64),
};

const failedAttemptMetadata: CoverLetterEvalFailureAttemptMetadata = {
  ...completedEntry,
  version: "cover_letter_eval_failure_attempt_metadata_v1",
  caseId: "blind-fr-customer-success-direct",
  artifactHash: "d".repeat(64),
  provenanceHash: null,
};

const budget = {
  liveProviderCallsEnabled: true,
  limits: {
    maxCalls: 24,
    maxRepairs: 0,
    maxUsd: 3.56292,
    declaredMaxUsdPerCall: 0.148455,
  },
  usage: { reservedCalls: 9, reservedRepairs: 0, reservedUsd: 1.336095 },
  usdReservationBasis:
    "declared_max_usd_per_call_ceiling_not_observed_billing" as const,
};

describe("cover-letter eval failure receipt", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it("projects only bounded failure evidence and reproducibility metadata", () => {
    const receipt = buildCoverLetterEvalFailureReceipt({
      cohortId: "cover-letter-blind-review-v1",
      runId: "quality-eval-2b-3710e54f",
      sourceRef: "3710e54f869dba1d457e43b1d33403079c7e7f4f",
      plannedProviderCalls: 24,
      completedCalls: [completedEntry],
      failure: {
        caseId: "blind-fr-customer-success-direct",
        provider: "openai",
        requestedModel: "gpt-5.5",
        status: "finalization_failed",
        failureStage: "cleaned_body_selection",
        failureReason: "proposal_finalization_error",
        failureIssues: [
          "candidate_backed_evidence_missing",
          "RAW_ISSUE SENTINEL",
        ],
        finalizationDiagnostics: {
          acceptanceMode: "legacy_thin",
          errorClass: "proposal_finalization_error",
          failureStage: "cleaned_body_selection",
          selectedBodyCandidate: null,
          substantiveBodyPassed: false,
          removedBridgeSentenceCount: 1,
          removedLastGroundedSentence: true,
        },
        artifactHash: "d".repeat(64),
        provenanceHash: null,
        attemptMetadata: failedAttemptMetadata,
        error: "RAW_ERROR_SENTINEL",
        letter: "RAW_LETTER_SENTINEL",
        providerOutput: "RAW_PROVIDER_SENTINEL",
        stack: "RAW_STACK_SENTINEL",
      },
      budget,
    });

    expect(receipt).toMatchObject({
      version: "cover_letter_eval_failure_receipt_v1",
      cohortId: "cover-letter-blind-review-v1",
      plannedProviderCalls: 24,
      providerMaxRetries: 0,
      maxRepairs: 0,
      completedCalls: [completedEntry],
      failure: {
        caseId: "blind-fr-customer-success-direct",
        provider: "openai",
        requestedModel: "gpt-5.5",
        status: "finalization_failed",
        failureStage: "cleaned_body_selection",
        failureReason: "proposal_finalization_error",
        failureIssues: ["candidate_backed_evidence_missing", "redacted"],
        finalizationDiagnostics: {
          acceptanceMode: "legacy_thin",
          errorClass: "proposal_finalization_error",
          failureStage: "cleaned_body_selection",
          selectedBodyCandidate: null,
          substantiveBodyPassed: false,
          removedBridgeSentenceCount: 1,
          removedLastGroundedSentence: true,
        },
        artifactHash: "d".repeat(64),
        provenanceHash: null,
        attemptMetadata: expect.objectContaining({
          promptHash: "a".repeat(64),
          tokenUsage: completedEntry.tokenUsage,
          sdkVersions: completedEntry.sdkVersions,
        }),
      },
      budget,
    });
    expect(Object.keys(receipt.failure)).toEqual([
      "caseId",
      "provider",
      "requestedModel",
      "status",
      "failureStage",
      "failureReason",
      "failureIssues",
      "finalizationDiagnostics",
      "artifactHash",
      "provenanceHash",
      "attemptMetadata",
    ]);
    expect(JSON.stringify(receipt)).not.toMatch(
      /RAW_(?:ERROR|ISSUE|LETTER|PROVIDER|STACK)(?:_| )SENTINEL/u,
    );
  });

  it("writes only under the private reveal directory", async () => {
    const outputDirectory = await mkdtemp(
      path.join(tmpdir(), "cover-letter-failure-receipt-"),
    );
    temporaryDirectories.push(outputDirectory);
    const receipt = buildCoverLetterEvalFailureReceipt({
      cohortId: "cover-letter-blind-review-v1",
      runId: "quality-eval-2b-3710e54f",
      sourceRef: "3710e54f869dba1d457e43b1d33403079c7e7f4f",
      plannedProviderCalls: 24,
      completedCalls: [completedEntry],
      failure: {
        caseId: "blind-fr-customer-success-direct",
        provider: "openai",
        requestedModel: "gpt-5.5",
        status: "finalization_failed",
        failureStage: "cleaned_body_selection",
        failureReason: "proposal_finalization_error",
        failureIssues: [],
        finalizationDiagnostics: null,
        artifactHash: "d".repeat(64),
        provenanceHash: null,
        attemptMetadata: null,
      },
      budget,
    });

    const receiptPath = await writeCoverLetterEvalFailureReceipt({
      outputDirectory,
      receipt,
    });

    expect(receiptPath).toBe(
      path.join(
        outputDirectory,
        "private-reveal",
        "cover-letter-eval-failure-receipt.json",
      ),
    );
    expect(JSON.parse(await readFile(receiptPath, "utf8"))).toEqual(receipt);
    expect((await stat(receiptPath)).mode & 0o777).toBe(0o600);
  });
});
