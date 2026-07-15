import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PremiumCoverLetterAttemptResult } from "../../../convex/lib/proposals/premiumCoverLetter";
import { buildStableHash } from "../../../src/modules/application-harness/fingerprints";
import { benchmarkCoverLetterCaseForHumanReview } from "../benchmark-cover-letter-writers";
import type { CoverLetterBenchmarkCase } from "../cases/cover-letter/cases";
import {
  QUALITY_EVAL3A_DEVELOPMENT_CASE_IDS,
  QUALITY_EVAL3A_HELD_OUT_CASE_IDS,
  QUALITY_EVAL3A_WRITER_MODELS,
  buildCoverLetterEval3aPlan,
} from "../cover-letter-eval3a-held-out";
import {
  QUALITY_EVAL3B_DEVELOPMENT_CASE_IDS,
  QUALITY_EVAL3B_HELD_OUT_CASE_IDS,
  QUALITY_EVAL3B_WRITER_MODELS,
  buildCoverLetterEval3bPlan,
  evaluateCoverLetterEval3bVerdict,
  getCoverLetterEval3bHeldOutCases,
  parseCoverLetterEval3bCliOptions,
  projectCoverLetterEval3bCliResult,
  runCoverLetterEval3bHeldOut,
  type CoverLetterEval3bBlindReviewPack,
  type CoverLetterEval3bBlindReviewRevealMap,
  type CoverLetterEval3bCellOutcome,
} from "../cover-letter-eval3b-held-out";
import type { CompletedCoverLetterBlindReview } from "../cover-letter-blind-review";

const SOURCE_REF = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const RUN_ID = "quality-eval-3b-outcome-complete-test-run";
const RAW_SENTINEL = "RAW_PROVIDER_ENVELOPE_SENTINEL_MUST_NOT_SERIALIZE";
const temporaryDirectories: string[] = [];

const syntheticBodyParts = {
  opening:
    "I improved weekly QA reporting and issue handoffs for support escalations.",
  proofBlock:
    "I kept field notes and follow-up records clear across shifts so teams could act on the same context.",
  employerValueBlock:
    "That operating discipline would support a customer-success team that values reliable follow-through.",
  closeLine: "I would welcome the opportunity to discuss the role further.",
};
const syntheticContent = [
  "Dear Hiring Manager,",
  "",
  syntheticBodyParts.opening,
  "",
  syntheticBodyParts.proofBlock,
  "",
  syntheticBodyParts.employerValueBlock,
  "",
  syntheticBodyParts.closeLine,
  "",
  "Sincerely,",
  "Casey Reed",
].join("\n");
const validSyntheticPayload = {
  content: syntheticContent,
  sections: [{ type: "text" as const, content: syntheticContent }],
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
  bodyParts: syntheticBodyParts,
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
        text: syntheticBodyParts.opening,
        claimIds: ["claim_opening"],
        factIds: ["fact_cv_support_reporting"],
        demandIds: [],
        candidateFactIds: ["fact_cv_support_reporting"],
        verifiedCandidateFactIds: ["fact_cv_support_reporting"],
      },
      proofBlock: {
        section: "proofBlock" as const,
        text: syntheticBodyParts.proofBlock,
        claimIds: ["claim_proof"],
        factIds: [],
        demandIds: [],
        candidateFactIds: [],
        verifiedCandidateFactIds: [],
      },
      employerValueBlock: {
        section: "employerValueBlock" as const,
        text: syntheticBodyParts.employerValueBlock,
        claimIds: ["claim_employer_value"],
        factIds: [],
        demandIds: ["demand_core"],
        candidateFactIds: [],
        verifiedCandidateFactIds: [],
      },
      closeLine: {
        section: "closeLine" as const,
        text: syntheticBodyParts.closeLine,
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
    path.join("/tmp", "quality-eval3b-test-"),
  );
  temporaryDirectories.push(outputDirectory);
  return outputDirectory;
}

async function buildSyntheticResult(args: {
  benchmarkCase: CoverLetterBenchmarkCase;
  writerModel: "gpt-5.5" | "gpt-5.6-sol";
  failure: boolean;
  withoutArtifact?: boolean;
}): Promise<unknown> {
  const result = await benchmarkCoverLetterCaseForHumanReview({
    benchmarkCase: args.benchmarkCase,
    writerModel: args.writerModel,
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
    ...(args.withoutArtifact ? { artifact: undefined } : {}),
  };
}

function passReview(
  overrides: Partial<CompletedCoverLetterBlindReview> = {},
): CompletedCoverLetterBlindReview {
  return {
    blindLabel: "CL-000",
    packHash: "a".repeat(64),
    reviewerLanguages: ["Arabic", "English", "French"],
    reviewerLanguageCompetence: "native_or_professional_for_all",
    relevanceToOffer: "pass",
    factualGrounding: "pass",
    evidencePrioritization: "pass",
    credibility: "pass",
    persuasion: "pass",
    structure: "pass",
    substance: "pass",
    tone: "pass",
    economy: "pass",
    commercialAcceptability: "pass",
    strengths: ["specific evidence"],
    mainWeakness: "none",
    smallestUsefulRevision: "none",
    reviewerNotes: "synthetic review",
    ...overrides,
  };
}

function completeCellOutcomes(
  overrides: Partial<
    Record<string, CoverLetterEval3bCellOutcome["outcome"]>
  > = {},
): CoverLetterEval3bCellOutcome[] {
  return getCoverLetterEval3bHeldOutCases().flatMap((benchmarkCase) =>
    QUALITY_EVAL3B_WRITER_MODELS.map((writerModel) => ({
      caseId: benchmarkCase.id,
      writerModel,
      outcome:
        overrides[`${benchmarkCase.id}::${writerModel}`] ??
        ("human_review_pending" as const),
    })),
  );
}

async function buildVerdictFixture(args: {
  cellOutcomes: readonly CoverLetterEval3bCellOutcome[];
  controlReview?: Partial<CompletedCoverLetterBlindReview>;
  candidateReview?: Partial<CompletedCoverLetterBlindReview>;
}): Promise<{
  pack: CoverLetterEval3bBlindReviewPack;
  revealMap: CoverLetterEval3bBlindReviewRevealMap;
  reviews: CompletedCoverLetterBlindReview[];
}> {
  const benchmarkCaseById = new Map(
    getCoverLetterEval3bHeldOutCases().map((benchmarkCase) => [
      benchmarkCase.id,
      benchmarkCase,
    ]),
  );
  const labeledCells = args.cellOutcomes.map((outcome, index) => ({
    ...outcome,
    blindLabel: `CL-${String(index + 1).padStart(3, "0")}`,
  }));
  const packBody = {
    version: "cover_letter_blind_review_pack_v1" as const,
    rubricVersion: "cover_letter_editorial_rubric_v1" as const,
    cohortId: "quality-eval-3b-outcome-complete-v1",
    runId: RUN_ID,
    sourceRef: SOURCE_REF,
    instructions: [],
    rubric: {},
    entries: labeledCells
      .filter((cell) => cell.outcome === "human_review_pending")
      .map((cell) => ({
        blindLabel: cell.blindLabel,
        requiredReviewerLanguages: [
          ...(benchmarkCaseById.get(cell.caseId)?.reviewMetadata
            ?.requiredReviewerLanguages ?? []),
        ],
      })),
    evaluationProtocol: "quality_eval3b_outcome_complete_v1" as const,
    failureMatrix: labeledCells
      .filter((cell) => cell.outcome === "safety_veto")
      .map((cell) => ({
        blindLabel: cell.blindLabel,
        outcome: "safety_veto" as const,
        textIncluded: false as const,
      })),
  } as unknown as Omit<CoverLetterEval3bBlindReviewPack, "packHash">;
  const packHash = await buildStableHash({
    namespace: "cover-letter-blind-review",
    type: "pack",
    version: 1,
    value: packBody,
  });
  const pack = { ...packBody, packHash };
  const revealBody = {
    version: "cover_letter_blind_review_reveal_v1" as const,
    evaluationProtocol: "quality_eval3b_outcome_complete_v1" as const,
    cohortId: pack.cohortId,
    runId: pack.runId,
    sourceRef: pack.sourceRef,
    packHash,
    entries: labeledCells.map((cell) => ({
      blindLabel: cell.blindLabel,
      caseId: cell.caseId,
      writerProvider: "openai" as const,
      writerModel: cell.writerModel,
      artifactHash:
        cell.outcome === "human_review_pending" ? "b".repeat(64) : null,
      provenanceHash: null,
      outcome: cell.outcome,
    })),
  } as unknown as Omit<CoverLetterEval3bBlindReviewRevealMap, "revealMapHash">;
  const revealMapHash = await buildStableHash({
    namespace: "cover-letter-blind-review",
    type: "reveal-map",
    version: 1,
    value: revealBody,
  });
  const revealMap = { ...revealBody, revealMapHash };
  const reviews = labeledCells
    .filter((cell) => cell.outcome === "human_review_pending")
    .map((cell) =>
      passReview({
        blindLabel: cell.blindLabel,
        packHash,
        ...(cell.writerModel === "gpt-5.5"
          ? args.controlReview
          : args.candidateReview),
      }),
    );
  return { pack, revealMap, reviews };
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

describe("QUALITY-EVAL-3B held-out protocol", () => {
  it("passes the scientific cohort-reuse gate and preserves EVAL3A matrix parity", async () => {
    const [eval3aPlan, eval3bPlan] = await Promise.all([
      buildCoverLetterEval3aPlan({
        sourceRef: SOURCE_REF,
        runId: "quality-eval-3a-held-out-test-run",
      }),
      buildCoverLetterEval3bPlan({ sourceRef: SOURCE_REF, runId: RUN_ID }),
    ]);

    expect(QUALITY_EVAL3B_DEVELOPMENT_CASE_IDS).toEqual(
      QUALITY_EVAL3A_DEVELOPMENT_CASE_IDS,
    );
    expect(QUALITY_EVAL3B_HELD_OUT_CASE_IDS).toEqual(
      QUALITY_EVAL3A_HELD_OUT_CASE_IDS,
    );
    expect(QUALITY_EVAL3B_WRITER_MODELS).toEqual(QUALITY_EVAL3A_WRITER_MODELS);
    expect(eval3bPlan.cohortReuseGate).toEqual({
      status: "PASS",
      basis: "no_raw_output_tuning_rejection_metadata_only",
      productionWriterOrFinalizerChanged: false,
    });
    expect(eval3bPlan.plannedProviderCalls).toBe(
      eval3aPlan.plannedProviderCalls,
    );
    expect(eval3bPlan.providerMaxRetries).toBe(0);
    expect(eval3bPlan.maxRepairs).toBe(0);
    expect(eval3bPlan.llmEvaluator).toBe("none");
    expect(eval3bPlan.budget.minimumSafeReservationUsd).toBeLessThanOrEqual(2);
  });

  it("continues after one finalization_failed cell, records only a sanitized safety veto, and completes all ten calls", async () => {
    const outputDirectory = await createOutputDirectory();
    const calls: string[] = [];
    const failureCaseId = QUALITY_EVAL3B_HELD_OUT_CASE_IDS[0]!;
    const plan = await buildCoverLetterEval3bPlan({
      sourceRef: SOURCE_REF,
      runId: RUN_ID,
    });
    const result = await runCoverLetterEval3bHeldOut({
      approvalPhrase: plan.approvalPhrase,
      explicitLiveProviderOptIn: true,
      maxCalls: 10,
      maxRepairs: 0,
      maxUsd: plan.budget.maxUsd,
      declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
      outputDirectory,
      runId: RUN_ID,
      sourceRef: SOURCE_REF,
      apiKey: "offline-test-key",
      generateRecord: async ({ benchmarkCase, writerModel, budget }) =>
        budget.beginWriterAttempt().runProviderCall(async () => {
          calls.push(`${benchmarkCase.id}::${writerModel}`);
          return buildSyntheticResult({
            benchmarkCase,
            writerModel,
            failure:
              benchmarkCase.id === failureCaseId && writerModel === "gpt-5.5",
          });
        }),
    });

    expect(calls).toHaveLength(10);
    expect(new Set(calls).size).toBe(10);
    expect(result.completedCellCount).toBe(10);
    expect(result.reviewableCellCount).toBe(9);
    expect(result.safetyVetoCount).toBe(1);
    expect(result.failureReceipts[0]).toMatchObject({
      caseId: failureCaseId,
      writerModel: "gpt-5.5",
      status: "finalization_failed",
      safetyVeto: "automatic",
      planHash: result.plan.planHash,
      sourceRef: SOURCE_REF,
      runId: RUN_ID,
    });
    expect(result.failureReceipts[0]?.diagnostics.failureIssues).toEqual([
      "redacted",
    ]);
    expect(JSON.stringify(result.failureReceipts)).not.toContain(RAW_SENTINEL);

    const [packJson, packMarkdown, revealJson, ledgerJson] = await Promise.all(
      [
        result.paths.packJsonPath,
        result.paths.packMarkdownPath,
        result.paths.revealMapJsonPath,
        result.paths.ledgerJsonPath,
      ].map((filePath) => readFile(filePath, "utf8")),
    );
    expect(packJson).not.toContain(RAW_SENTINEL);
    expect(packMarkdown).not.toContain(RAW_SENTINEL);
    expect(revealJson).not.toContain(RAW_SENTINEL);
    expect(ledgerJson).not.toContain(RAW_SENTINEL);
    expect(packJson).not.toContain("gpt-5.5");
    expect(packJson).not.toContain("gpt-5.6-sol");
    expect(packMarkdown).not.toContain("gpt-5.5");
    expect(packMarkdown).not.toContain("gpt-5.6-sol");
    const pack = JSON.parse(packJson) as CoverLetterEval3bBlindReviewPack;
    const revealMap = JSON.parse(
      revealJson,
    ) as CoverLetterEval3bBlindReviewRevealMap;
    expect(pack.entries).toHaveLength(9);
    expect(pack.failureMatrix).toHaveLength(1);
    expect(pack.failureMatrix[0]).toEqual({
      blindLabel: expect.stringMatching(/^CL-\d{3}$/u),
      outcome: "safety_veto",
      textIncluded: false,
    });
    const verdict = await evaluateCoverLetterEval3bVerdict({
      cases: getCoverLetterEval3bHeldOutCases(),
      cellOutcomes: revealMap.entries.map((entry) => ({
        caseId: entry.caseId,
        writerModel: entry.writerModel as "gpt-5.5" | "gpt-5.6-sol",
        outcome: entry.outcome,
      })),
      pack,
      revealMap,
      reviews: pack.entries.map((entry) =>
        passReview({ blindLabel: entry.blindLabel, packHash: pack.packHash }),
      ),
    });
    expect(verdict.status).toBe("NOT_POSITIVE");
    expect(verdict.validPairCount).toBe(4);
    expect(verdict.controlSafetyVetoCount).toBe(1);
    expect(
      projectCoverLetterEval3bCliResult({
        result,
        runId: RUN_ID,
        sourceRef: SOURCE_REF,
      }),
    ).toMatchObject({
      completedCellCount: 10,
      reviewableCellCount: 9,
      safetyVetoCount: 1,
    });
  });

  it("fails closed on an unauthorized status without invoking the next cell", async () => {
    const outputDirectory = await createOutputDirectory();
    const calls: string[] = [];
    const plan = await buildCoverLetterEval3bPlan({
      sourceRef: SOURCE_REF,
      runId: RUN_ID,
    });
    await expect(
      runCoverLetterEval3bHeldOut({
        approvalPhrase: plan.approvalPhrase,
        explicitLiveProviderOptIn: true,
        maxCalls: 10,
        maxRepairs: 0,
        maxUsd: plan.budget.maxUsd,
        declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
        outputDirectory,
        runId: RUN_ID,
        sourceRef: SOURCE_REF,
        apiKey: "offline-test-key",
        generateRecord: async ({ benchmarkCase, writerModel, budget }) =>
          budget.beginWriterAttempt().runProviderCall(async () => {
            calls.push(`${benchmarkCase.id}::${writerModel}`);
            return { status: "generation_failed", raw: RAW_SENTINEL };
          }),
      }),
    ).rejects.toThrow(/stopped fail-closed/u);
    expect(calls).toHaveLength(1);
    const ledger = await readFile(
      path.join(outputDirectory, "private-evidence", "eval3b-run-ledger.json"),
      "utf8",
    );
    expect(ledger).not.toContain(RAW_SENTINEL);
    expect(ledger).toContain("FAILED_CLOSED");
  });

  it("preserves completed cells in the failure ledger when a later cell is unauthorized", async () => {
    const outputDirectory = await createOutputDirectory();
    const plan = await buildCoverLetterEval3bPlan({
      sourceRef: SOURCE_REF,
      runId: `${RUN_ID}-partial-ledger`,
    });
    let callCount = 0;
    await expect(
      runCoverLetterEval3bHeldOut({
        approvalPhrase: plan.approvalPhrase,
        explicitLiveProviderOptIn: true,
        maxCalls: 10,
        maxRepairs: 0,
        maxUsd: plan.budget.maxUsd,
        declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
        outputDirectory,
        runId: `${RUN_ID}-partial-ledger`,
        sourceRef: SOURCE_REF,
        apiKey: "offline-test-key",
        generateRecord: async ({ benchmarkCase, writerModel, budget }) =>
          budget.beginWriterAttempt().runProviderCall(async () => {
            callCount += 1;
            if (callCount === 2) {
              return { status: "generation_failed", raw: RAW_SENTINEL };
            }
            return buildSyntheticResult({
              benchmarkCase,
              writerModel,
              failure: false,
            });
          }),
      }),
    ).rejects.toThrow(/stopped fail-closed/u);
    expect(callCount).toBe(2);
    const ledger = JSON.parse(
      await readFile(
        path.join(
          outputDirectory,
          "private-evidence",
          "eval3b-run-ledger.json",
        ),
        "utf8",
      ),
    ) as {
      completedCellCount: number;
      completedCells: readonly Readonly<{
        caseId: string;
        writerModel: string;
        outcome: string;
        artifactHash: string | null;
      }>[];
      error: string;
    };
    expect(ledger.completedCellCount).toBe(1);
    expect(ledger.completedCells).toEqual([
      {
        caseId: QUALITY_EVAL3B_HELD_OUT_CASE_IDS[0],
        writerModel: "gpt-5.5",
        outcome: "human_review_pending",
        artifactHash: expect.any(String),
      },
    ]);
    expect(ledger.error).toBe(
      "QUALITY-EVAL-3B failed closed before outcome completion.",
    );
  });

  it("accepts a typed finalization failure without inventing an artifact hash", async () => {
    const outputDirectory = await createOutputDirectory();
    const failureCaseId = QUALITY_EVAL3B_HELD_OUT_CASE_IDS[0]!;
    const plan = await buildCoverLetterEval3bPlan({
      sourceRef: SOURCE_REF,
      runId: `${RUN_ID}-no-artifact`,
    });
    const result = await runCoverLetterEval3bHeldOut({
      approvalPhrase: plan.approvalPhrase,
      explicitLiveProviderOptIn: true,
      maxCalls: 10,
      maxRepairs: 0,
      maxUsd: plan.budget.maxUsd,
      declaredMaxUsdPerCall: plan.budget.declaredMaxUsdPerCall,
      outputDirectory,
      runId: `${RUN_ID}-no-artifact`,
      sourceRef: SOURCE_REF,
      apiKey: "offline-test-key",
      generateRecord: async ({ benchmarkCase, writerModel, budget }) =>
        budget.beginWriterAttempt().runProviderCall(() =>
          buildSyntheticResult({
            benchmarkCase,
            writerModel,
            failure:
              benchmarkCase.id === failureCaseId && writerModel === "gpt-5.5",
            withoutArtifact:
              benchmarkCase.id === failureCaseId && writerModel === "gpt-5.5",
          }),
        ),
    });

    expect(result.reviewableCellCount).toBe(9);
    expect(result.failureReceipts[0]?.artifactHash).toBeNull();
    const revealMap = JSON.parse(
      await readFile(result.paths.revealMapJsonPath, "utf8"),
    ) as CoverLetterEval3bBlindReviewRevealMap;
    expect(
      revealMap.entries.find(
        (entry) =>
          entry.caseId === failureCaseId && entry.writerModel === "gpt-5.5",
      )?.artifactHash,
    ).toBeNull();
  });

  it("keeps the CLI and private-review boundary safe", async () => {
    expect(
      parseCoverLetterEval3bCliOptions([
        `--run-id=${RUN_ID}`,
        `--source-ref=${SOURCE_REF}`,
        "--plan-only",
      ]),
    ).toMatchObject({ planOnly: true, live: false });
    const approvalPhrase = "J’approuve EVAL3B v1 : first-character-preserved";
    expect(
      parseCoverLetterEval3bCliOptions([
        `--run-id=${RUN_ID}`,
        `--source-ref=${SOURCE_REF}`,
        "--output-dir=/tmp/private-eval3b",
        `--approval-phrase=${approvalPhrase}`,
        "--live",
      ]),
    ).toMatchObject({ live: true, approvalPhrase });
    expect(() =>
      parseCoverLetterEval3bCliOptions([
        `--run-id=${RUN_ID}`,
        `--source-ref=${SOURCE_REF}`,
        "--live",
      ]),
    ).toThrow(/requires output and approval/u);
  });
});

describe("QUALITY-EVAL-3B verdict gates", () => {
  it("can be positive only with five valid pairs, three languages, and strict candidate advantage", async () => {
    const cellOutcomes = completeCellOutcomes();
    const fixture = await buildVerdictFixture({
      cellOutcomes,
      controlReview: { persuasion: "fail", tone: "fail", economy: "fail" },
    });
    const verdict = await evaluateCoverLetterEval3bVerdict({
      cases: getCoverLetterEval3bHeldOutCases(),
      cellOutcomes,
      ...fixture,
    });
    expect(verdict.status).toBe("POSITIVE");
    expect(verdict.validPairCount).toBe(5);
    expect(verdict.missingLanguages).toEqual([]);
  });

  it("rejects caller-supplied control/candidate reveal swaps", async () => {
    const cellOutcomes = completeCellOutcomes();
    const fixture = await buildVerdictFixture({ cellOutcomes });
    const swappedPairs = fixture.reviews.map((review, index) => ({
      review,
      reveal:
        fixture.revealMap.entries[
          (index + 1) % fixture.revealMap.entries.length
        ],
    }));
    await expect(
      evaluateCoverLetterEval3bVerdict({
        cases: getCoverLetterEval3bHeldOutCases(),
        cellOutcomes,
        pack: fixture.pack,
        revealMap: fixture.revealMap,
        reviews: swappedPairs as unknown as CompletedCoverLetterBlindReview[],
      }),
    ).rejects.toThrow(/review is not bound/u);
  });

  it("requires every review to cover the languages required by its bound pack entry", async () => {
    const cellOutcomes = completeCellOutcomes();
    const fixture = await buildVerdictFixture({ cellOutcomes });
    const multilingualEntry = fixture.pack.entries.find(
      (entry) =>
        entry.requiredReviewerLanguages.includes("Arabic") &&
        entry.requiredReviewerLanguages.includes("English"),
    );
    expect(multilingualEntry).toBeDefined();
    const englishOnlyReviews = fixture.reviews.map((review) =>
      review.blindLabel === multilingualEntry!.blindLabel
        ? { ...review, reviewerLanguages: ["English"] }
        : review,
    );

    await expect(
      evaluateCoverLetterEval3bVerdict({
        cases: getCoverLetterEval3bHeldOutCases(),
        cellOutcomes,
        pack: fixture.pack,
        revealMap: fixture.revealMap,
        reviews: englishOnlyReviews,
      }),
    ).rejects.toThrow(/missing required reviewer languages: Arabic/u);

    const verdict = await evaluateCoverLetterEval3bVerdict({
      cases: getCoverLetterEval3bHeldOutCases(),
      cellOutcomes,
      ...fixture,
    });
    expect(verdict.validPairCount).toBe(5);
  });

  it("rejects tampered pack/reveal hashes and protocol identity", async () => {
    const cellOutcomes = completeCellOutcomes();
    const fixture = await buildVerdictFixture({ cellOutcomes });
    await expect(
      evaluateCoverLetterEval3bVerdict({
        cases: getCoverLetterEval3bHeldOutCases(),
        cellOutcomes,
        ...fixture,
        pack: { ...fixture.pack, packHash: "0".repeat(64) },
      }),
    ).rejects.toThrow(/pack hash/u);
    const tamperedRevealBody = {
      ...fixture.revealMap,
      evaluationProtocol: "tampered_protocol" as never,
    };
    const { revealMapHash: _revealMapHash, ...tamperedRevealBodyWithoutHash } =
      tamperedRevealBody;
    const tamperedRevealMap = {
      ...tamperedRevealBodyWithoutHash,
      revealMapHash: await buildStableHash({
        namespace: "cover-letter-blind-review",
        type: "reveal-map",
        version: 1,
        value: tamperedRevealBodyWithoutHash,
      }),
    } as CoverLetterEval3bBlindReviewRevealMap;
    await expect(
      evaluateCoverLetterEval3bVerdict({
        cases: getCoverLetterEval3bHeldOutCases(),
        cellOutcomes,
        ...fixture,
        revealMap: tamperedRevealMap,
      }),
    ).rejects.toThrow(/identity or protocol/u);
  });

  it("rejects a bad review pack hash, duplicate review, or veto review", async () => {
    const firstCase = getCoverLetterEval3bHeldOutCases()[0]!;
    const failureKey = `${firstCase.id}::gpt-5.5`;
    const cellOutcomes = completeCellOutcomes({ [failureKey]: "safety_veto" });
    const fixture = await buildVerdictFixture({ cellOutcomes });
    await expect(
      evaluateCoverLetterEval3bVerdict({
        cases: getCoverLetterEval3bHeldOutCases(),
        cellOutcomes,
        ...fixture,
        reviews: [
          { ...fixture.reviews[0]!, packHash: "0".repeat(64) },
          ...fixture.reviews.slice(1),
        ],
      }),
    ).rejects.toThrow(/review is not bound/u);
    await expect(
      evaluateCoverLetterEval3bVerdict({
        cases: getCoverLetterEval3bHeldOutCases(),
        cellOutcomes,
        ...fixture,
        reviews: [...fixture.reviews, fixture.reviews[0]!],
      }),
    ).rejects.toThrow(/review is not bound/u);
    const failureLabel = fixture.revealMap.entries.find(
      (entry) => entry.outcome === "safety_veto",
    )?.blindLabel;
    await expect(
      evaluateCoverLetterEval3bVerdict({
        cases: getCoverLetterEval3bHeldOutCases(),
        cellOutcomes,
        ...fixture,
        reviews: [
          ...fixture.reviews,
          passReview({
            blindLabel: failureLabel!,
            packHash: fixture.pack.packHash,
          }),
        ],
      }),
    ).rejects.toThrow(/review is not bound/u);
  });

  it("keeps incomplete human-review coverage non-positive", async () => {
    const cellOutcomes = completeCellOutcomes();
    const fixture = await buildVerdictFixture({ cellOutcomes });
    await expect(
      evaluateCoverLetterEval3bVerdict({
        cases: getCoverLetterEval3bHeldOutCases(),
        cellOutcomes,
        ...fixture,
        reviews: fixture.reviews.slice(1),
      }),
    ).rejects.toThrow(/review coverage/u);
  });

  it("keeps a candidate safety veto, missing language, or fewer than four pairs non-positive", async () => {
    const firstCase = getCoverLetterEval3bHeldOutCases()[0]!;
    const vetoKey = `${firstCase.id}::gpt-5.6-sol`;
    const secondCase = getCoverLetterEval3bHeldOutCases()[1]!;
    const secondVetoKey = `${secondCase.id}::gpt-5.6-sol`;
    const cellOutcomes = completeCellOutcomes({
      [vetoKey]: "safety_veto",
      [secondVetoKey]: "safety_veto",
    });
    const fixture = await buildVerdictFixture({ cellOutcomes });
    const verdict = await evaluateCoverLetterEval3bVerdict({
      cases: getCoverLetterEval3bHeldOutCases(),
      cellOutcomes,
      ...fixture,
    });
    expect(verdict.status).toBe("NOT_POSITIVE");
    expect(verdict.reasonCodes).toContain("candidate_safety_veto");
    expect(verdict.reasonCodes).toContain("missing_required_language");
    expect(verdict.reasonCodes).toContain("fewer_than_four_valid_pairs");
  });

  it("does not turn a control failure into an automatic candidate win", async () => {
    const firstCase = getCoverLetterEval3bHeldOutCases()[0]!;
    const controlKey = `${firstCase.id}::gpt-5.5`;
    const cellOutcomes = completeCellOutcomes({ [controlKey]: "safety_veto" });
    const fixture = await buildVerdictFixture({ cellOutcomes });
    const verdict = await evaluateCoverLetterEval3bVerdict({
      cases: getCoverLetterEval3bHeldOutCases(),
      cellOutcomes,
      ...fixture,
    });
    expect(verdict.status).toBe("NOT_POSITIVE");
    expect(verdict.controlSafetyVetoCount).toBe(1);
    expect(verdict.reasonCodes).toContain("primary_pass_not_strictly_higher");
  });

  it("counts a candidate CL1/CL2 veto even when the paired control failed", async () => {
    const firstCase = getCoverLetterEval3bHeldOutCases()[0]!;
    const controlKey = `${firstCase.id}::gpt-5.5`;
    const cellOutcomes = completeCellOutcomes({ [controlKey]: "safety_veto" });
    const fixture = await buildVerdictFixture({ cellOutcomes });
    const candidateLabel = fixture.revealMap.entries.find(
      (entry) =>
        entry.caseId === firstCase.id && entry.writerModel === "gpt-5.6-sol",
    )?.blindLabel;
    const reviews = fixture.reviews.map((review) =>
      review.blindLabel === candidateLabel
        ? { ...review, factualGrounding: "fail" as const }
        : review,
    );
    const verdict = await evaluateCoverLetterEval3bVerdict({
      cases: getCoverLetterEval3bHeldOutCases(),
      cellOutcomes,
      ...fixture,
      reviews,
    });
    expect(verdict.status).toBe("NOT_POSITIVE");
    expect(verdict.candidateCl1Cl2VetoCount).toBe(1);
    expect(verdict.reasonCodes).toContain("candidate_cl1_cl2_veto");
  });
});
