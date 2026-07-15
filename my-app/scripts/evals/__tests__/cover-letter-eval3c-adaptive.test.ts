import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PremiumCoverLetterAttemptResult } from "../../../convex/lib/proposals/premiumCoverLetter";
import { benchmarkCoverLetterCaseForHumanReview } from "../benchmark-cover-letter-writers";
import type { CoverLetterBenchmarkCase } from "../cases/cover-letter/cases";
import { QUALITY_EVAL3A_HELD_OUT_CASE_IDS } from "../cover-letter-eval3a-held-out";
import {
  QUALITY_EVAL3C_INITIAL_VARIANTS,
  buildCoverLetterEval3cPlan,
  parseCoverLetterEval3cCliOptions,
  runCoverLetterEval3cInitialScreen,
  type CoverLetterEval3cBlindReviewPack,
  type CoverLetterEval3cBlindReviewRevealMap,
} from "../cover-letter-eval3c-adaptive";

const SOURCE_REF = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const RUN_ID = "quality-eval-3c-adaptive-test-run";
const RAW_SENTINEL = "RAW_PROVIDER_SENTINEL_MUST_NOT_SERIALIZE";
const temporaryDirectories: string[] = [];

const bodyParts = {
  opening:
    "I improved weekly QA reporting and issue handoffs for support escalations.",
  proofBlock:
    "I kept field notes and follow-up records clear across shifts so teams could act on the same context.",
  employerValueBlock:
    "That operating discipline would support a customer-success team that values reliable follow-through.",
  closeLine: "I would welcome the opportunity to discuss the role further.",
};
const content = [
  "Dear Hiring Manager,",
  "",
  bodyParts.opening,
  "",
  bodyParts.proofBlock,
  "",
  bodyParts.employerValueBlock,
  "",
  bodyParts.closeLine,
  "",
  "Sincerely,",
  "Casey Reed",
].join("\n");
const validSyntheticPayload = {
  content,
  sections: [{ type: "text" as const, content }],
  prompt: "synthetic offline prompt",
  brief: {
    language: "English" as const,
    preset: "signature" as const,
    contextClass: "cv_direct" as const,
    targetRole: "Customer Success Specialist",
    topEvidence: [],
    supportEvidence: [],
    requiredMoves: [],
    forbiddenMoves: [],
  },
  contextClass: "cv_direct" as const,
  bodyParts,
  mode: "direct" as const,
  evidenceUsed: ["fact_cv_support_reporting"],
  omittedWeakEvidence: [],
  qualityShadow: { passed: false, score: 4, issues: ["generic_tone"] },
  finalProvenance: {
    version: "premium_cover_letter_final_provenance_v1" as const,
    status: "validated_final_text" as const,
    origin: "provider_reported" as const,
    contextClass: "cv_direct" as const,
    candidateFactIds: ["fact_cv_support_reporting"],
    verifiedCandidateFactIds: ["fact_cv_support_reporting"],
    candidateFacts: [
      {
        id: "fact_cv_support_reporting",
        section: "opening" as const,
        text: "Completed weekly QA reports, field notes, and issue handoffs for support escalations.",
        source: "cv" as const,
        metrics: [],
        entities: [],
      },
    ],
    sections: {
      opening: {
        section: "opening" as const,
        text: bodyParts.opening,
        claimIds: ["claim_opening"],
        factIds: ["fact_cv_support_reporting"],
        demandIds: [],
        candidateFactIds: ["fact_cv_support_reporting"],
        verifiedCandidateFactIds: ["fact_cv_support_reporting"],
      },
      proofBlock: {
        section: "proofBlock" as const,
        text: bodyParts.proofBlock,
        claimIds: ["claim_proof"],
        factIds: [],
        demandIds: [],
        candidateFactIds: [],
        verifiedCandidateFactIds: [],
      },
      employerValueBlock: {
        section: "employerValueBlock" as const,
        text: bodyParts.employerValueBlock,
        claimIds: ["claim_employer_value"],
        factIds: [],
        demandIds: ["demand_core"],
        candidateFactIds: [],
        verifiedCandidateFactIds: [],
      },
      closeLine: {
        section: "closeLine" as const,
        text: bodyParts.closeLine,
        claimIds: ["claim_close"],
        factIds: [],
        demandIds: [],
        candidateFactIds: [],
        verifiedCandidateFactIds: [],
      },
    },
  },
} as unknown as PremiumCoverLetterAttemptResult;
const failedSyntheticPayload = {
  content: RAW_SENTINEL,
  sections: [{ type: "text", content: RAW_SENTINEL }],
} as unknown as PremiumCoverLetterAttemptResult;

async function createOutputDirectory(): Promise<string> {
  const outputDirectory = await mkdtemp(
    path.join("/tmp", "quality-eval3c-test-"),
  );
  temporaryDirectories.push(outputDirectory);
  return outputDirectory;
}

async function buildSyntheticResult(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: "gpt-5.6-luna" | "gpt-5.6-sol";
  reasoningEffort: "low";
  failure: boolean;
}): Promise<unknown> {
  const result = await benchmarkCoverLetterCaseForHumanReview({
    benchmarkCase: args.benchmarkCase,
    writerModel: args.writerModel,
    reasoningEffort: args.reasoningEffort,
    apiKey: "offline-test-key",
    generateLetter: async () =>
      args.failure ? failedSyntheticPayload : validSyntheticPayload,
  });
  if (!args.failure) return result;
  const failureResult = result as Record<string, unknown>;
  const diagnostics = failureResult.diagnostics as Record<string, unknown>;
  return {
    ...failureResult,
    diagnostics: { ...diagnostics, failureIssues: [RAW_SENTINEL] },
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

beforeEach(() => {
  vi.stubEnv("COVER_LETTER_EVAL_LIVE", "1");
});

describe("QUALITY-EVAL-3C adaptive Luna/Sol screen", () => {
  it("builds the exact two-call development plan and keeps held-out sealed", async () => {
    const plan = await buildCoverLetterEval3cPlan({
      sourceRef: SOURCE_REF,
      runId: RUN_ID,
    });

    expect(plan.initialVariants).toEqual(QUALITY_EVAL3C_INITIAL_VARIANTS);
    expect(plan.initialVariants).toEqual([
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
    ]);
    expect(plan.plannedProviderCalls).toBe(2);
    expect(plan.providerMaxRetries).toBe(0);
    expect(plan.maxRepairs).toBe(0);
    expect(plan.llmEvaluator).toBe("none");
    expect(plan.budget.minimumSafeReservationUsd).toBeLessThanOrEqual(0.3);
    expect(plan.adaptivePolicy).toMatchObject({
      allowedLunaEfforts: ["none", "low", "medium"],
      allowedSolEfforts: ["low", "medium"],
      heldOutAccess: "forbidden_until_two_finalists_are_frozen",
      futurePhasesExecutableByThisPlan: false,
    });
    const serialized = JSON.stringify(plan);
    expect(serialized).not.toContain("gpt-5.5");
    for (const heldOutCaseId of QUALITY_EVAL3A_HELD_OUT_CASE_IDS) {
      expect(serialized).not.toContain(heldOutCaseId);
    }
    expect(plan.approvalPhrase).toContain(plan.planHash);
    expect(plan.approvalPhrase).toContain("2 appels provider maximum");
  });

  it("requires one exact execution mode and the live approval fields", () => {
    expect(
      parseCoverLetterEval3cCliOptions([
        `--run-id=${RUN_ID}`,
        `--source-ref=${SOURCE_REF}`,
        "--plan-only",
      ]),
    ).toMatchObject({ planOnly: true, live: false });
    expect(() =>
      parseCoverLetterEval3cCliOptions([
        `--run-id=${RUN_ID}`,
        `--source-ref=${SOURCE_REF}`,
        "--live",
      ]),
    ).toThrow(/requires output and approval fields/u);
  });

  it("rejects a stale approval before invoking an injected writer", async () => {
    const outputDirectory = await createOutputDirectory();
    const calls: string[] = [];
    const plan = await buildCoverLetterEval3cPlan({
      sourceRef: SOURCE_REF,
      runId: RUN_ID,
    });
    await expect(
      runCoverLetterEval3cInitialScreen({
        approvalPhrase: `${plan.approvalPhrase} stale`,
        explicitLiveProviderOptIn: true,
        maxCalls: 2,
        maxRepairs: 0,
        maxUsd: plan.budget.maxUsd,
        declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
        outputDirectory,
        runId: RUN_ID,
        sourceRef: SOURCE_REF,
        apiKey: "offline-test-key",
        generateRecord: async ({ writerModel }) => {
          calls.push(writerModel);
          return { status: "human_review_pending" };
        },
      }),
    ).rejects.toThrow(/exact live gate/u);
    expect(calls).toEqual([]);
  });

  it("completes both cells, continues a sanitized veto, and keeps the pack blind", async () => {
    const outputDirectory = await createOutputDirectory();
    const calls: string[] = [];
    const plan = await buildCoverLetterEval3cPlan({
      sourceRef: SOURCE_REF,
      runId: RUN_ID,
    });
    const result = await runCoverLetterEval3cInitialScreen({
      approvalPhrase: plan.approvalPhrase,
      explicitLiveProviderOptIn: true,
      maxCalls: 2,
      maxRepairs: 0,
      maxUsd: plan.budget.maxUsd,
      declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
      outputDirectory,
      runId: RUN_ID,
      sourceRef: SOURCE_REF,
      apiKey: "offline-test-key",
      generateRecord: async ({
        benchmarkCase,
        writerModel,
        reasoningEffort,
        budget,
      }) =>
        budget.beginWriterAttempt().runProviderCall(async () => {
          calls.push(`${writerModel}@${reasoningEffort}`);
          return buildSyntheticResult({
            benchmarkCase,
            writerModel,
            reasoningEffort,
            failure: writerModel === "gpt-5.6-luna",
          });
        }),
    });

    expect(calls).toEqual(["gpt-5.6-luna@low", "gpt-5.6-sol@low"]);
    expect(result).toMatchObject({
      status: "HUMAN_REVIEW_PENDING",
      completedCellCount: 2,
      reviewableCellCount: 1,
      safetyVetoCount: 1,
    });
    expect(result.failureReceipts[0]).toMatchObject({
      variantId: "luna-low",
      writerModel: "gpt-5.6-luna",
      reasoningEffort: "low",
      status: "finalization_failed",
      safetyVeto: "automatic",
      diagnostics: { failureIssues: ["redacted"] },
    });
    expect(JSON.stringify(result.failureReceipts)).not.toContain(RAW_SENTINEL);

    const [packJson, packMarkdown, revealJson, ledgerJson] = await Promise.all(
      [
        result.paths.packJsonPath,
        result.paths.packMarkdownPath,
        result.paths.revealMapJsonPath,
        result.paths.ledgerJsonPath,
      ].map((filePath) => readFile(filePath, "utf8")),
    );
    for (const reviewerArtifact of [packJson, packMarkdown]) {
      expect(reviewerArtifact).not.toContain(RAW_SENTINEL);
      expect(reviewerArtifact).not.toContain("gpt-5.6-luna");
      expect(reviewerArtifact).not.toContain("gpt-5.6-sol");
      expect(reviewerArtifact).not.toContain("reasoningEffort");
      expect(reviewerArtifact).not.toContain("variantId");
    }
    expect(revealJson).not.toContain(RAW_SENTINEL);
    expect(ledgerJson).not.toContain(RAW_SENTINEL);
    const pack = JSON.parse(packJson) as CoverLetterEval3cBlindReviewPack;
    const reveal = JSON.parse(
      revealJson,
    ) as CoverLetterEval3cBlindReviewRevealMap;
    expect(pack.entries).toHaveLength(1);
    expect(pack.failureMatrix).toHaveLength(1);
    expect(reveal.entries).toHaveLength(2);
    expect(
      reveal.entries.map((entry) => ({
        writerModel: entry.writerModel,
        reasoningEffort: entry.reasoningEffort,
        outcome: entry.outcome,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          writerModel: "gpt-5.6-luna",
          reasoningEffort: "low",
          outcome: "safety_veto",
        },
        {
          writerModel: "gpt-5.6-sol",
          reasoningEffort: "low",
          outcome: "human_review_pending",
        },
      ]),
    );
  });
});
