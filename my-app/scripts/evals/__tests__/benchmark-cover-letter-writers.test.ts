import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { CoverLetterScore } from "../../../convex/lib/proposals/coverLetterEvaluation";
import { finalizePremiumCoverLetterPayloadForPersistence } from "../../../convex/generateProposalMutation";
import {
  PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
  PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
  evaluatePremiumCoverLetterEligibility,
  type PremiumCoverLetterAttemptResult,
} from "../../../convex/lib/proposals/premiumCoverLetter";
import { PROPOSAL_OUTPUT_LANGUAGES } from "../../../convex/lib/proposals/proposalOutput";
import { buildStableHash } from "../../../src/modules/application-harness/fingerprints";
import {
  aggregateCoverLetterBenchmarkRecords,
  assertQualityEval2BBudgetContract,
  assertQualityEval2DSampleBudgetContract,
  assertQualityEval2DSharedPromptContract,
  benchmarkCoverLetterCase,
  benchmarkCoverLetterCaseForHumanReview,
  buildCoverLetterBenchmarkOfflineCostPreflight,
  buildCoverLetterHumanReviewPlan,
  calculateCoverLetterBenchmarkMinimumProviderCalls,
  coverLetterBenchmarkRequiresOpenAIKey,
  createCoverLetterEvalLiveBudget,
  generatePremiumCoverLetterBenchmarkLetter,
  QUALITY_EVAL_2B_WRITER_MODELS,
  QUALITY_EVAL_2D_SHARED_PROMPT_MAX_CHARACTERS,
  parseCoverLetterBenchmarkCliOptions,
  replayRecordedCoverLetterFixture,
  replayRecordedCoverLetterFixtures,
  resolveCoverLetterBenchmarkAttemptSignal,
  resolveCoverLetterBenchmarkProductionInputs,
  resolveCoverLetterBenchmarkProviderSignal,
  resolveDefaultCoverLetterBenchmarkWriterModels,
  runCoverLetterHumanReviewCohort,
  type CoverLetterBenchmarkRecord,
} from "../benchmark-cover-letter-writers";
import { CoverLetterEvalBudgetError } from "../cover-letter-eval-budget";
import {
  QUALITY_EVAL_2D_CASE_ID,
  QUALITY_EVAL_2D_WRITER_MODELS,
} from "../cover-letter-qualitative-sample";
import {
  COVER_LETTER_BLIND_REVIEW_COHORT_ID,
  coverLetterBenchmarkCases,
  coverLetterBlindReviewCases,
} from "../cases/cover-letter/cases";
import {
  RECORDED_COVER_LETTER_REPLAY_FIXTURES,
  recordedCoverLetterReplayFixtureSchema,
} from "../fixtures/cover-letter/recorded-writer-responses";
import * as coverLetterEvalRunManifest from "../cover-letter-eval-run-manifest";

const successfulEvaluation: CoverLetterScore = {
  score: {
    relevance: 4,
    credibility: 5,
    persuasion: 4,
    structure: 4,
    substance: 4,
    tone: 4,
    grounding: 5,
  },
  globalScore: 4,
  strengths: ["Leads with concrete proof."],
  mainWeakness: "The employer-facing value line could be sharper.",
  smallestUsefulRevision:
    "Tighten the employer-facing value sentence so it lands earlier.",
  rankMatchesText: true,
  gating: {
    minimumBarMet: true,
    premiumReady: true,
    hardFailReasons: [],
  },
};

const emptyManualReview = {
  humanTone: "unreviewed",
  noMetaProse: "unreviewed",
  persuasiveEmployerFacingArgument: "unreviewed",
  notFactualInventory: "unreviewed",
  specificity: "unreviewed",
  grounding: "unreviewed",
  economy: "unreviewed",
  commerciallyAcceptable: "unreviewed",
  reviewerNotes: "",
} as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("benchmark-cover-letter-writers", () => {
  it("selects exactly two explicit review cohorts for English, French, and Arabic", () => {
    expect(coverLetterBlindReviewCases).toHaveLength(6);
    expect(
      coverLetterBlindReviewCases.map(
        (benchmarkCase) => benchmarkCase.reviewMetadata?.cohortId,
      ),
    ).toEqual(Array(6).fill(COVER_LETTER_BLIND_REVIEW_COHORT_ID));

    for (const language of ["English", "French", "Arabic"] as const) {
      const cases = coverLetterBlindReviewCases.filter(
        (benchmarkCase) =>
          benchmarkCase.reviewMetadata?.requestedOutputLanguage === language,
      );
      expect(cases).toHaveLength(2);
      expect(
        cases.map((item) => item.reviewMetadata?.reviewCohort).sort(),
      ).toEqual(["challenging", "strong"]);
      for (const benchmarkCase of cases) {
        expect(benchmarkCase.reviewMetadata).toMatchObject({
          sourceDataClass: "authored_synthetic",
        });
        expect(
          benchmarkCase.reviewMetadata?.requiredReviewerLanguages,
        ).toContain(language);
        expect(
          benchmarkCase.reviewMetadata?.requiredReviewerLanguages,
        ).toContain(benchmarkCase.reviewMetadata?.jobSourceLanguage);
        if (benchmarkCase.reviewMetadata?.candidateEvidenceSourceLanguage) {
          expect(
            benchmarkCase.reviewMetadata.requiredReviewerLanguages,
          ).toContain(
            benchmarkCase.reviewMetadata.candidateEvidenceSourceLanguage,
          );
        }
        expect(
          evaluatePremiumCoverLetterEligibility({
            personalizationContext: benchmarkCase.personalizationContext,
            voicePreset: benchmarkCase.preset,
            jobTitle: benchmarkCase.jobTitle,
            jobDescription: benchmarkCase.jobDescription,
          }),
        ).toEqual({
          eligible: true,
          contextClass: benchmarkCase.expectedContextClass,
        });
      }
    }
  });

  it("uses explicit review output language instead of inferring it from source text", () => {
    const arabicOutputCase = coverLetterBlindReviewCases.find(
      (item) =>
        item.reviewMetadata?.requestedOutputLanguage === "Arabic" &&
        item.reviewMetadata.reviewCohort === "strong",
    )!;

    expect(arabicOutputCase.reviewMetadata?.jobSourceLanguage).toBe("English");
    expect(
      resolveCoverLetterBenchmarkProductionInputs({
        benchmarkCase: arabicOutputCase,
      }).outputLanguage,
    ).toBe("Arabic");
  });

  it("defaults live benchmark runs to the production writer only unless extra writers are requested", () => {
    expect(resolveDefaultCoverLetterBenchmarkWriterModels()).toEqual([
      "gpt-5.5",
    ]);
  });

  it("accepts only the exact QUALITY-EVAL-2B human-review writer set", () => {
    const options = parseCoverLetterBenchmarkCliOptions(
      [
        "--human-review-only",
        `--writers=${QUALITY_EVAL_2B_WRITER_MODELS.join(",")}`,
      ],
      "0",
    );

    expect(options.writerModels).toEqual(QUALITY_EVAL_2B_WRITER_MODELS);
    expect(
      parseCoverLetterBenchmarkCliOptions(["--human-review-only"], "0")
        .writerModels,
    ).toEqual(QUALITY_EVAL_2B_WRITER_MODELS);

    for (const invalidWriter of ["gpt-5.6", "gpt-5.6-luna", "unknown-writer"]) {
      expect(() =>
        parseCoverLetterBenchmarkCliOptions(
          ["--human-review-only", `--writers=${invalidWriter}`],
          "0",
        ),
      ).toThrow(/unsupported premium writer model|exact writer set/iu);
    }

    expect(() =>
      parseCoverLetterBenchmarkCliOptions(["--writers=gpt-5.5,gpt-5.5"], "0"),
    ).toThrow(/duplicate premium writer model/iu);
    expect(() =>
      parseCoverLetterBenchmarkCliOptions(
        ["--human-review-only", "--writers=gpt-5.5,gpt-5.6-sol"],
        "0",
      ),
    ).toThrow(/exact writer set/iu);
  });

  it("accepts only the exact QUALITY-EVAL-2D qualitative sample contract", () => {
    const options = parseCoverLetterBenchmarkCliOptions(
      [
        "--qualitative-sample",
        `--writers=${QUALITY_EVAL_2D_WRITER_MODELS.join(",")}`,
      ],
      "0",
    );

    expect(options.evaluationMode).toBe("qualitative_sample");
    expect(options.caseIds).toEqual([QUALITY_EVAL_2D_CASE_ID]);
    expect(options.writerModels).toEqual(QUALITY_EVAL_2D_WRITER_MODELS);
    expect(
      parseCoverLetterBenchmarkCliOptions(["--qualitative-sample"], "0")
        .writerModels,
    ).toEqual(QUALITY_EVAL_2D_WRITER_MODELS);

    for (const invalidWriter of [
      "gpt-5.6",
      "gpt-5.6-luna-pro",
      "unknown-writer",
    ]) {
      expect(() =>
        parseCoverLetterBenchmarkCliOptions(
          ["--qualitative-sample", `--writers=${invalidWriter}`],
          "0",
        ),
      ).toThrow(/unsupported premium writer model|exact writer set/iu);
    }
    expect(() =>
      parseCoverLetterBenchmarkCliOptions(
        [
          "--qualitative-sample",
          "--writers=gpt-5.5,gpt-5.6-sol,gpt-5.6-terra,gpt-5.6-luna,gpt-5.6-luna",
        ],
        "0",
      ),
    ).toThrow(/duplicate premium writer model/iu);
    expect(() =>
      parseCoverLetterBenchmarkCliOptions(
        ["--qualitative-sample", "--cases=blind-fr-strong-direct"],
        "0",
      ),
    ).toThrow(/fixed synthetic case/iu);
  });

  it("freezes the cases-outer four-writer plan at 24 calls with no repair allowance", () => {
    const plan = buildCoverLetterHumanReviewPlan({
      cases: coverLetterBlindReviewCases,
      writerModels: QUALITY_EVAL_2B_WRITER_MODELS,
    });

    expect(plan).toHaveLength(24);
    expect(plan.slice(0, 4).map((item) => item.writerModel)).toEqual(
      QUALITY_EVAL_2B_WRITER_MODELS,
    );
    expect(plan.slice(0, 4).map((item) => item.benchmarkCase.id)).toEqual(
      Array(4).fill(coverLetterBlindReviewCases[0]!.id),
    );
    expect(
      calculateCoverLetterBenchmarkMinimumProviderCalls({
        caseCount: coverLetterBlindReviewCases.length,
        writerCount: QUALITY_EVAL_2B_WRITER_MODELS.length,
        evaluationMode: "human_review_only",
      }),
    ).toBe(24);
  });

  it("fails closed inside the first English case without a duplicate provider preflight", async () => {
    const plan = buildCoverLetterHumanReviewPlan({
      cases: coverLetterBlindReviewCases,
      writerModels: QUALITY_EVAL_2B_WRITER_MODELS,
    });
    const generateRecord = vi
      .fn()
      .mockResolvedValueOnce({ status: "human_review_pending" })
      .mockResolvedValueOnce({
        status: "generation_failed",
        caseId: plan[1]!.benchmarkCase.id,
        writerModel: plan[1]!.writerModel,
        error: "model compatibility failed",
      });
    const onFailure = vi.fn();

    await expect(
      runCoverLetterHumanReviewCohort({ plan, generateRecord, onFailure }),
    ).rejects.toThrow(/model compatibility failed/iu);
    expect(generateRecord).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledWith({
      completedRecords: [{ status: "human_review_pending" }],
      failure: {
        status: "generation_failed",
        caseId: plan[1]!.benchmarkCase.id,
        writerModel: plan[1]!.writerModel,
        error: "model compatibility failed",
      },
    });
  });

  it("preserves the primary cohort failure when failure-receipt handling also fails", async () => {
    const plan = buildCoverLetterHumanReviewPlan({
      cases: coverLetterBlindReviewCases,
      writerModels: QUALITY_EVAL_2B_WRITER_MODELS,
    });
    const failedItem = plan[0]!;
    const generateRecord = vi.fn().mockResolvedValue({
      status: "generation_failed",
      caseId: failedItem.benchmarkCase.id,
      writerModel: failedItem.writerModel,
      error: "model compatibility failed",
    });
    const onFailure = vi
      .fn()
      .mockRejectedValue(new Error("receipt write failed"));

    await expect(
      runCoverLetterHumanReviewCohort({ plan, generateRecord, onFailure }),
    ).rejects.toThrow(
      `Human-review cohort generation failed at ${failedItem.benchmarkCase.id}/${failedItem.writerModel}: model compatibility failed. Failure-receipt handling also failed.`,
    );
    expect(generateRecord).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it("captures rejected writer attempts before rethrowing the original error", async () => {
    const plan = buildCoverLetterHumanReviewPlan({
      cases: coverLetterBlindReviewCases,
      writerModels: QUALITY_EVAL_2B_WRITER_MODELS,
    });
    const budgetError = new CoverLetterEvalBudgetError({
      code: "repair_limit_exceeded",
      message: "Repair 1 would exceed maxRepairs=0.",
    });
    const generateRecord = vi.fn().mockRejectedValue(budgetError);
    const onRejection = vi.fn();

    await expect(
      runCoverLetterHumanReviewCohort({
        plan,
        generateRecord,
        onRejection,
      }),
    ).rejects.toBe(budgetError);
    expect(generateRecord).toHaveBeenCalledOnce();
    expect(onRejection).toHaveBeenCalledOnce();
    expect(onRejection).toHaveBeenCalledWith({
      completedRecords: [],
      item: plan[0],
      error: budgetError,
    });
  });

  it("keeps the rejected writer error primary when rejection receipt handling fails", async () => {
    const plan = buildCoverLetterHumanReviewPlan({
      cases: coverLetterBlindReviewCases,
      writerModels: QUALITY_EVAL_2B_WRITER_MODELS,
    });
    const budgetError = new CoverLetterEvalBudgetError({
      code: "repair_limit_exceeded",
      message: "Repair 1 would exceed maxRepairs=0.",
    });
    const receiptError = new Error("receipt write failed");

    await expect(
      runCoverLetterHumanReviewCohort({
        plan,
        generateRecord: vi.fn().mockRejectedValue(budgetError),
        onRejection: vi.fn().mockRejectedValue(receiptError),
      }),
    ).rejects.toBe(budgetError);
    expect(budgetError).toMatchObject({
      code: "repair_limit_exceeded",
      message: "Repair 1 would exceed maxRepairs=0.",
      cause: receiptError,
    });
  });

  it("uses actual deterministic prompts for a conservative offline 24-call cost preflight", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("provider calls are forbidden during offline preflight");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const preflight = await buildCoverLetterBenchmarkOfflineCostPreflight({
      cases: coverLetterBlindReviewCases,
      writerModels: QUALITY_EVAL_2B_WRITER_MODELS,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(preflight).toMatchObject({
      version: "cover_letter_eval_cost_preflight_v1",
      plannedProviderCalls: 24,
      providerMaxRetries: 0,
      maxRepairs: 0,
      writerMaxOutputTokens: 2048,
      declaredMaxUsdPerCall: 0.145565,
      minimumSafeReservationUsd: 3.49356,
      targetReservationUsd: 2.5,
      targetReservationProven: false,
    });
    expect(preflight.entries).toHaveLength(24);
    expect(preflight.worstCase).toMatchObject({
      caseId: "blind-fr-implementation-adjacent",
      writerModel: "gpt-5.6-sol",
      serializedInputByteUpperBound: 16_825,
    });

    const insufficient = parseCoverLetterBenchmarkCliOptions(
      [
        "--live",
        "--human-review-only",
        "--max-calls=24",
        "--max-repairs=0",
        "--max-usd=2.5",
        "--max-usd-per-call=0.145565",
      ],
      "0",
    );
    expect(() =>
      assertQualityEval2BBudgetContract({
        options: insufficient,
        preflight,
      }),
    ).toThrow(/minimum safe reservation of 3\.49356 USD/iu);

    const safe = {
      ...insufficient,
      maxUsd: 3.49356,
    };
    expect(() =>
      assertQualityEval2BBudgetContract({ options: safe, preflight }),
    ).not.toThrow();
  });

  it("preflights the actual five-model qualitative sample below its USD 0.75 cap", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("provider calls are forbidden during offline preflight");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const sampleCase = coverLetterBlindReviewCases.filter(
      (benchmarkCase) => benchmarkCase.id === QUALITY_EVAL_2D_CASE_ID,
    );
    const preflight = await buildCoverLetterBenchmarkOfflineCostPreflight({
      cases: sampleCase,
      writerModels: QUALITY_EVAL_2D_WRITER_MODELS,
      targetReservationUsd: 0.75,
    });
    const options = parseCoverLetterBenchmarkCliOptions(
      [
        "--qualitative-sample",
        "--max-calls=5",
        "--max-repairs=0",
        "--max-usd=0.75",
        `--max-usd-per-call=${preflight.declaredMaxUsdPerCall}`,
      ],
      "1",
    );

    expect(preflight).toMatchObject({
      plannedProviderCalls: 5,
      providerMaxRetries: 0,
      maxRepairs: 0,
      writerMaxOutputTokens: 2_048,
      targetReservationUsd: 0.75,
      targetReservationProven: true,
    });
    expect(preflight.minimumSafeReservationUsd).toBeLessThanOrEqual(0.75);
    expect(preflight.entries.map((entry) => entry.writerModel)).toEqual(
      QUALITY_EVAL_2D_WRITER_MODELS,
    );
    expect(
      preflight.entries.find(
        (entry) => entry.writerModel === "mistral-medium-latest",
      )?.serializedInputByteUpperBound,
    ).toBe(12_761);
    expect(() =>
      assertQualityEval2DSampleBudgetContract({ options, preflight }),
    ).not.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("freezes one shared effective user prompt under the 12k-character evaluation ceiling", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("provider calls are forbidden during prompt preflight");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const benchmarkCase = coverLetterBlindReviewCases.find(
      (candidate) => candidate.id === QUALITY_EVAL_2D_CASE_ID,
    )!;

    const contract = await assertQualityEval2DSharedPromptContract({
      benchmarkCase,
    });
    expect(contract.promptCharacterLength).toBe(11_701);
    expect(contract.maxPromptCharacters).toBe(12_000);
    expect(contract.promptCharacterLength).toBeLessThanOrEqual(
      QUALITY_EVAL_2D_SHARED_PROMPT_MAX_CHARACTERS,
    );
    expect(contract.promptHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(contract.schemaHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("passes exact canonical prompt bytes through both evaluation writer paths", async () => {
    const benchmarkCase = coverLetterBlindReviewCases.find(
      (candidate) => candidate.id === QUALITY_EVAL_2D_CASE_ID,
    )!;
    const canonicalPrompt = "canonical provider-neutral evaluation prompt";
    const observedPrompts: string[] = [];
    const observedCallbacks: string[] = [];

    for (const writerModel of ["gpt-5.5", "mistral-medium-latest"] as const) {
      const captureComplete = Symbol(writerModel);
      try {
        await generatePremiumCoverLetterBenchmarkLetter({
          benchmarkCase,
          writerModel,
          apiKey: "offline",
          mistralApiKey: "offline",
          writerPromptOverride: canonicalPrompt,
          onWriterPrompt: (prompt) => observedCallbacks.push(prompt),
          writerOverride: async ({ prompt }) => {
            observedPrompts.push(prompt);
            throw captureComplete;
          },
        });
      } catch (error) {
        expect(error).toBe(captureComplete);
      }
    }

    expect(observedPrompts).toEqual([canonicalPrompt, canonicalPrompt]);
    expect(observedCallbacks).toEqual([canonicalPrompt, canonicalPrompt]);
  });

  it("resolves the production writer after dotenv can update the environment", () => {
    vi.stubEnv("COVER_LETTER_PREMIUM_WRITER_MODEL", "");
    vi.stubEnv("OPENAI_PROPOSAL_MODEL", "gpt-5.4");

    expect(resolveDefaultCoverLetterBenchmarkWriterModels()).toEqual([
      "gpt-5.4",
    ]);
  });

  it("detects reasoning-effort changes made after module initialization", async () => {
    vi.stubEnv("PROPOSAL_GENERATION_QUALITY_MODE", "baseline");
    vi.stubEnv("cover_letter_premium_prompt_v2", "");
    vi.stubEnv("COVER_LETTER_PREMIUM_PROMPT_V2", "");
    vi.stubEnv("ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2", "");
    vi.stubEnv("ENABLE_COVER_LETTER_QUALITY_REPAIR_V1", "");
    vi.stubEnv("OPENAI_PROPOSAL_REASONING_EFFORT", "high");

    await expect(
      replayRecordedCoverLetterFixture(
        RECORDED_COVER_LETTER_REPLAY_FIXTURES[0]!,
      ),
    ).rejects.toThrow(/configuration drift: openAIWriterReasoningEffort/iu);
  });

  it("normalizes invalid late reasoning effort before freezing replay config", async () => {
    vi.stubEnv("PROPOSAL_GENERATION_QUALITY_MODE", "baseline");
    vi.stubEnv("cover_letter_premium_prompt_v2", "");
    vi.stubEnv("COVER_LETTER_PREMIUM_PROMPT_V2", "");
    vi.stubEnv("ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2", "");
    vi.stubEnv("ENABLE_COVER_LETTER_QUALITY_REPAIR_V1", "");
    vi.stubEnv("OPENAI_PROPOSAL_REASONING_EFFORT", "not-supported");

    await expect(
      replayRecordedCoverLetterFixture(
        RECORDED_COVER_LETTER_REPLAY_FIXTURES[0]!,
      ),
    ).resolves.toMatchObject({
      artifact: {
        frozenConfig: { reasoningEffort: "low" },
      },
    });
  });

  it("mirrors the provider-specific production cancellation contract", () => {
    const configuredSignal = new AbortController().signal;
    const callbackSignal = new AbortController().signal;

    expect(
      resolveCoverLetterBenchmarkAttemptSignal("openai", configuredSignal),
    ).toBeUndefined();
    expect(
      resolveCoverLetterBenchmarkProviderSignal({
        provider: "openai",
        configuredSignal,
        callbackSignal,
      }),
    ).toBe(configuredSignal);

    expect(
      resolveCoverLetterBenchmarkAttemptSignal("mistral", configuredSignal),
    ).toBe(configuredSignal);
    expect(
      resolveCoverLetterBenchmarkProviderSignal({
        provider: "mistral",
        configuredSignal,
        callbackSignal,
      }),
    ).toBe(callbackSignal);
  });

  it("uses the current production context-presence rule for name-only no-CV finalization", async () => {
    const benchmarkCase = coverLetterBenchmarkCases.find(
      (item) => item.id === "no-cv-entry-office",
    )!;
    const bodyParts = {
      opening:
        "Ce poste demande de la rigueur, une communication claire et un suivi régulier.",
      proofBlock:
        "La mission repose sur l’organisation des tâches quotidiennes et la gestion des échanges.",
      employerValueBlock:
        "J’aborderais ce travail avec méthode, attention aux détails et communication claire.",
      closeLine:
        "Je serais ravie d’échanger sur la manière dont j’aborderais ce type de mission.",
    };
    const content = [
      "Madame, Monsieur,",
      "",
      bodyParts.opening,
      "",
      bodyParts.proofBlock,
      "",
      bodyParts.employerValueBlock,
      "",
      bodyParts.closeLine,
      "",
      "Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
    ].join("\n");
    const generation = {
      content,
      sections: [{ type: "text" as const, content }],
      prompt: "recorded synthetic prompt",
      brief: {
        language: "French" as const,
        preset: benchmarkCase.preset,
        contextClass: "no_cv" as const,
        targetRole: benchmarkCase.jobTitle,
        topEvidence: [],
        supportEvidence: [],
        requiredMoves: [],
        forbiddenMoves: [],
      },
      contextClass: "no_cv" as const,
      bodyParts,
      mode: "direct" as const,
      evidenceUsed: [],
      omittedWeakEvidence: [],
      qualityShadow: { passed: true, score: 100, issues: [] },
    } satisfies PremiumCoverLetterAttemptResult;
    const productionInputs = {
      ...resolveCoverLetterBenchmarkProductionInputs({ benchmarkCase }),
      outputLanguage: "French" as const,
    };

    expect(productionInputs.hasCandidateContext).toBe(true);
    expect(
      finalizePremiumCoverLetterPayloadForPersistence({
        payload: generation,
        format: "cover_letter",
        outputLanguage: "French",
        candidateName: benchmarkCase.personalizationContext.name,
        voicePreset: benchmarkCase.preset,
        hasCandidateContext: false,
      }).content,
    ).toContain(bodyParts.proofBlock);
    expect(() =>
      finalizePremiumCoverLetterPayloadForPersistence({
        payload: generation,
        format: "cover_letter",
        outputLanguage: "French",
        candidateName: benchmarkCase.personalizationContext.name,
        voicePreset: benchmarkCase.preset,
        hasCandidateContext: productionInputs.hasCandidateContext,
      }),
    ).toThrow(
      /candidate-backed evidence|Cleanup removed all substantive body/iu,
    );

    const evaluateLetter = vi.fn().mockResolvedValue(successfulEvaluation);
    const record = await benchmarkCoverLetterCase({
      benchmarkCase,
      writerModel: "gpt-5.5",
      evaluatorModel: "gpt-5-mini",
      apiKey: "unused-in-replay",
      productionInputs,
      generateLetter: vi.fn().mockImplementation(async (args) => {
        args.onProviderResponseMetadata?.({
          returnedModel: "gpt-5.5-2026-06-30",
          tokenUsage: {
            inputTokens: 3_000,
            outputTokens: 900,
            totalTokens: 3_900,
          },
        });
        return generation;
      }),
      evaluateLetter,
    });

    expect(evaluateLetter).not.toHaveBeenCalled();
    expect(record).toMatchObject({
      status: "finalization_failed",
      artifact: {
        decision: "rejected",
        frozenConfig: { hasCandidateContext: true },
      },
      attemptMetadata: {
        version: "cover_letter_eval_failure_attempt_metadata_v1",
        caseId: benchmarkCase.id,
        provider: "openai",
        requestedModel: "gpt-5.5",
        returnedModel: "gpt-5.5-2026-06-30",
        promptHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        tokenUsage: {
          inputTokens: 3_000,
          outputTokens: 900,
          totalTokens: 3_900,
        },
        artifactHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      },
    });
  });

  it("fails closed before default live callbacks when no budget is supplied", async () => {
    const benchmarkCase = coverLetterBenchmarkCases[0]!;
    await expect(
      benchmarkCoverLetterCase({
        benchmarkCase,
        writerModel: "gpt-5.5",
        evaluatorModel: "gpt-5-mini",
        apiKey: "must-not-be-used",
      }),
    ).rejects.toThrow(/explicit evaluation budget/iu);
  });

  it("propagates budget-limit errors instead of reporting a normal failed record", async () => {
    const benchmarkCase = coverLetterBenchmarkCases[0]!;
    const budgetError = new CoverLetterEvalBudgetError({
      code: "call_limit_exceeded",
      message: "Cover-letter evaluation call limit exceeded.",
    });

    await expect(
      benchmarkCoverLetterCase({
        benchmarkCase,
        writerModel: "gpt-5.5",
        evaluatorModel: "gpt-5-mini",
        apiKey: "must-not-be-used",
        generateLetter: vi.fn().mockRejectedValue(budgetError),
        evaluateLetter: vi.fn(),
      }),
    ).rejects.toBe(budgetError);
  });

  it("evaluates the production-finalized artifact instead of the pre-finalized generation", async () => {
    const benchmarkCase = coverLetterBenchmarkCases.find(
      (item) => item.id === "clean-engaging-direct",
    )!;
    const recordedGeneration = {
      content: [
        "Dear Hiring Manager,",
        "",
        "I improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
        "",
        "I also managed more than 40 enterprise accounts and led quarterly business reviews.",
        "",
        "That combination would support a customer success team focused on account health, onboarding, and retention.",
        "",
        "I would be glad to discuss the position further.",
        "",
        "Sincerely,",
      ].join("\n"),
      sections: [] as Array<{ type: "text"; content: string }>,
      prompt: "recorded prompt",
      brief: {
        language: "English",
        preset: benchmarkCase.preset,
        contextClass: benchmarkCase.expectedContextClass,
        targetRole: benchmarkCase.jobTitle,
        topEvidence: [
          "Improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
        ],
        supportEvidence: [
          "Managed a portfolio of 40+ enterprise accounts with quarterly business reviews.",
        ],
        requiredMoves: [],
        forbiddenMoves: [],
      },
      contextClass: benchmarkCase.expectedContextClass,
      bodyParts: {
        opening:
          "I improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
        proofBlock:
          "I also managed more than 40 enterprise accounts and led quarterly business reviews.",
        employerValueBlock:
          "That combination would support a customer success team focused on account health, onboarding, and retention.",
        closeLine: "I can bring that same discipline to the team.",
      },
      mode: "direct",
      evidenceUsed: [
        "Improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
      ],
      omittedWeakEvidence: [],
      qualityShadow: {
        passed: true,
        score: 100,
        issues: [],
      },
    } satisfies PremiumCoverLetterAttemptResult;
    const expectedProductionArtifact =
      finalizePremiumCoverLetterPayloadForPersistence({
        payload: recordedGeneration,
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: benchmarkCase.personalizationContext.name,
        voicePreset: benchmarkCase.preset,
        hasCandidateContext: true,
      });
    expect(expectedProductionArtifact.content).not.toBe(
      recordedGeneration.content,
    );

    const evaluateLetter = vi.fn().mockResolvedValue(successfulEvaluation);
    const record = await benchmarkCoverLetterCase({
      benchmarkCase,
      writerModel: "gpt-5.5",
      evaluatorModel: "gpt-5-mini",
      apiKey: "unused-in-replay",
      generateLetter: vi.fn().mockResolvedValue(recordedGeneration),
      evaluateLetter,
    });

    expect(evaluateLetter).toHaveBeenCalledWith({
      letter: expectedProductionArtifact.content,
      apiKey: "unused-in-replay",
      model: "gpt-5-mini",
    });
    expect(record).toMatchObject({
      status: "ok",
      letter: expectedProductionArtifact.content,
      generation: {
        content: expectedProductionArtifact.content,
        sections: expectedProductionArtifact.sections,
        qualityShadow: expectedProductionArtifact.qualityShadow,
      },
    });
  });

  it("finalizes a human-review-only record without invoking an evaluator", async () => {
    const benchmarkCase = coverLetterBlindReviewCases.find(
      (item) => item.id === "blind-en-clean-engaging-direct",
    )!;
    const generation = {
      content: [
        "Dear Hiring Manager,",
        "",
        "I improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
        "",
        "I managed more than 40 enterprise accounts and led quarterly business reviews.",
        "",
        "That experience is relevant to customer success work focused on onboarding and retention.",
        "",
        "I would welcome the opportunity to discuss the role.",
        "",
        "Sincerely,",
        "Priya Sharma",
      ].join("\n"),
      sections: [],
      prompt: "synthetic prompt",
      brief: {
        language: "English" as const,
        preset: benchmarkCase.preset,
        contextClass: benchmarkCase.expectedContextClass,
        targetRole: benchmarkCase.jobTitle,
        topEvidence: [
          "Improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
        ],
        supportEvidence: [
          "Managed a portfolio of 40+ enterprise accounts with quarterly business reviews.",
        ],
        requiredMoves: [],
        forbiddenMoves: [],
      },
      contextClass: benchmarkCase.expectedContextClass,
      bodyParts: {
        opening:
          "I improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
        proofBlock:
          "I managed more than 40 enterprise accounts and led quarterly business reviews.",
        employerValueBlock:
          "That experience is relevant to customer success work focused on onboarding and retention.",
        closeLine: "I would welcome the opportunity to discuss the role.",
      },
      mode: "direct" as const,
      evidenceUsed: [
        "Improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
      ],
      omittedWeakEvidence: [],
      qualityShadow: { passed: true, score: 100, issues: [] },
    } satisfies PremiumCoverLetterAttemptResult;
    const evaluateLetter = vi.fn().mockResolvedValue(successfulEvaluation);

    const record = await benchmarkCoverLetterCaseForHumanReview({
      benchmarkCase,
      writerModel: "gpt-5.6-luna",
      apiKey: "unused-in-synthetic-test",
      reasoningEffort: "none",
      generateLetter: vi.fn().mockResolvedValue(generation),
      evaluateLetter,
    });

    expect(evaluateLetter).not.toHaveBeenCalled();
    expect(record).toMatchObject({
      status: "human_review_pending",
      outputLanguage: "English",
      manualReview: emptyManualReview,
      letter: expect.stringContaining("90-day retention by 18%"),
      artifact: {
        decision: "accepted",
        frozenConfig: { reasoningEffort: "none" },
      },
      runManifest: {
        requestedModel: "gpt-5.6-luna",
        reasoningEffort: "none",
        providerMaxRetries: 0,
        transport: {
          requestProjectionHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        },
      },
    });
    expect(record).not.toHaveProperty("evaluation");
  });

  it("benchmarks one case with a per-run writer model and returns a typed success record", async () => {
    const benchmarkCase = coverLetterBenchmarkCases[0]!;
    const generated = {
      content: [
        "Dear Hiring Manager,",
        "",
        "I reduced overnight response times by 22% by tightening shift handoffs and escalation workflows.",
        "",
        "I coordinated daily incident reporting, patrol coverage, and access control across a 320-room hotel.",
        "",
        "That combination would support hotel security operations that depend on clear escalation and dependable patrol coverage.",
        "",
        "I would bring the same reporting discipline and response focus to the team.",
        "",
        "Sincerely,",
        "Daniel Ruiz",
      ].join("\n"),
      sections: [],
      prompt: "prompt",
      brief: {
        language: "English",
        preset: benchmarkCase.preset,
        contextClass: benchmarkCase.expectedContextClass,
        targetRole: benchmarkCase.jobTitle,
        topEvidence: [
          "Reduced overnight response times by 22% by tightening shift handoffs and escalation workflows.",
        ],
        supportEvidence: [],
        requiredMoves: [],
        forbiddenMoves: [],
      },
      contextClass: benchmarkCase.expectedContextClass,
      bodyParts: {
        opening:
          "I reduced overnight response times by 22% by tightening shift handoffs and escalation workflows.",
        proofBlock:
          "I coordinated daily incident reporting, patrol coverage, and access control across a 320-room hotel.",
        employerValueBlock:
          "That combination would support hotel security operations that depend on clear escalation and dependable patrol coverage.",
        closeLine:
          "I would bring the same reporting discipline and response focus to the team.",
      },
      mode: "direct",
      evidenceUsed: [
        "Reduced overnight response times by 22% by tightening shift handoffs and escalation workflows.",
      ],
      omittedWeakEvidence: [],
      qualityShadow: {
        passed: false,
        score: 4,
        issues: ["weak_employer_argument"],
      },
    } satisfies PremiumCoverLetterAttemptResult;
    const expectedProductionArtifact =
      finalizePremiumCoverLetterPayloadForPersistence({
        payload: generated,
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: benchmarkCase.personalizationContext.name,
        voicePreset: benchmarkCase.preset,
        hasCandidateContext: true,
      });
    const generateLetter = vi.fn().mockResolvedValue(generated);
    const evaluateLetter = vi.fn().mockResolvedValue(successfulEvaluation);

    const record = await benchmarkCoverLetterCase({
      benchmarkCase,
      writerModel: "gpt-5-mini",
      evaluatorModel: "gpt-5-mini",
      apiKey: "sk-openai",
      generateLetter,
      evaluateLetter,
    });

    expect(generateLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        benchmarkCase,
        writerModel: "gpt-5-mini",
        apiKey: "sk-openai",
      }),
    );
    expect(evaluateLetter).toHaveBeenCalledWith({
      letter: expectedProductionArtifact.content,
      apiKey: "sk-openai",
      model: "gpt-5-mini",
    });
    expect(record).toMatchObject({
      status: "ok",
      caseId: benchmarkCase.id,
      writerModel: "gpt-5-mini",
      expectedContextClass: "cv_direct",
      evaluation: {
        globalScore: 4,
        gating: {
          premiumReady: true,
        },
      },
      diagnostics: {
        provider: "openai",
        validationResult: "premium_validation_passed",
        telemetry: {
          attemptedPath: "premium path saved",
          premium_path_saved: true,
          premium_validation_passed: true,
          premium_quality_shadow_passed:
            expectedProductionArtifact.qualityShadow?.passed,
        },
        qualityShadow: expectedProductionArtifact.qualityShadow,
      },
      manualReview: emptyManualReview,
      letter: expectedProductionArtifact.content,
    });
  });

  it("benchmarks a Mistral writer model with a separate Mistral generation key", async () => {
    const benchmarkCase = coverLetterBenchmarkCases.find(
      (item) => item.id === "security-securitas-adt-copwatch",
    )!;
    const generated = {
      content: [
        "Dear Hiring Manager,",
        "",
        "At ADT Security, I completed reports by recording information, observations, occurrences, and surveillance activities.",
        "",
        "I maintained environments by monitoring grounds and equipment controls, and at Copwatch I monitored selected areas through a CCTV app on smart devices.",
        "",
        "This reporting and monitoring background offers relevant preparation for structured patrols, access control, and clear escalation.",
        "",
        "I would bring the same careful reporting and site awareness to the officer team.",
        "",
        "Sincerely,",
        "Robert Cooper",
      ].join("\n"),
      sections: [],
      prompt: "prompt",
      brief: {
        language: "English",
        preset: benchmarkCase.preset,
        contextClass: benchmarkCase.expectedContextClass,
        targetRole: benchmarkCase.jobTitle,
        topEvidence: [
          "Completed reports by recording observations and surveillance activities.",
        ],
        supportEvidence: [],
        requiredMoves: [],
        forbiddenMoves: [],
      },
      contextClass: benchmarkCase.expectedContextClass,
      bodyParts: {
        opening:
          "At ADT Security, I completed reports by recording information, observations, occurrences, and surveillance activities.",
        proofBlock:
          "I maintained environments by monitoring grounds and equipment controls, and at Copwatch I monitored selected areas through a CCTV app on smart devices.",
        employerValueBlock:
          "This reporting and monitoring background offers relevant preparation for structured patrols, access control, and clear escalation.",
        closeLine:
          "I would bring the same careful reporting and site awareness to the officer team.",
      },
      mode: "transfer",
      evidenceUsed: [
        "Completed reports by recording observations and surveillance activities.",
      ],
      omittedWeakEvidence: [],
      qualityShadow: {
        passed: true,
        score: 6,
        issues: [],
      },
    } satisfies PremiumCoverLetterAttemptResult;
    const expectedProductionArtifact =
      finalizePremiumCoverLetterPayloadForPersistence({
        payload: generated,
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: benchmarkCase.personalizationContext.name,
        voicePreset: benchmarkCase.preset,
        hasCandidateContext: true,
      });
    const generateLetter = vi.fn().mockResolvedValue(generated);
    const evaluateLetter = vi.fn().mockResolvedValue(successfulEvaluation);

    const record = await benchmarkCoverLetterCase({
      benchmarkCase,
      writerModel: "mistral-medium-latest",
      evaluatorModel: "gpt-5-mini",
      apiKey: "sk-openai",
      mistralApiKey: "sk-mistral",
      generateLetter,
      evaluateLetter,
    });

    expect(generateLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        writerModel: "mistral-medium-latest",
        apiKey: "sk-openai",
        mistralApiKey: "sk-mistral",
      }),
    );
    expect(evaluateLetter).toHaveBeenCalledWith({
      letter: expectedProductionArtifact.content,
      apiKey: "sk-openai",
      model: "gpt-5-mini",
    });
    expect(record).toMatchObject({
      status: "ok",
      writerModel: "mistral-medium-latest",
      diagnostics: {
        provider: "mistral",
        telemetry: {
          premium_path_saved: true,
          premium_validation_passed: true,
          premium_quality_shadow_passed:
            expectedProductionArtifact.qualityShadow?.passed,
        },
      },
      evaluation: {
        gating: {
          premiumReady: true,
        },
      },
    });
  });

  it("keeps recorded fixtures synthetic, strict, and free of raw provider envelopes", () => {
    const knownCaseIds = new Set(
      coverLetterBenchmarkCases.map((item) => item.id),
    );
    const serializedFixtures = JSON.stringify(
      RECORDED_COVER_LETTER_REPLAY_FIXTURES,
    );

    for (const fixture of RECORDED_COVER_LETTER_REPLAY_FIXTURES) {
      expect(recordedCoverLetterReplayFixtureSchema.parse(fixture)).toEqual(
        fixture,
      );
      expect(fixture.fixtureDataClass).toBe("synthetic");
      expect(fixture.fixtureProvenance).toBe("authored_synthetic_case_v1");
      expect(knownCaseIds.has(fixture.sourceCaseId)).toBe(true);
    }
    expect(
      RECORDED_COVER_LETTER_REPLAY_FIXTURES.map((fixture) => ({
        artifact: fixture.expectedArtifactHash,
        provenance: fixture.expectedProvenanceHash,
        prompts: fixture.responses.map(
          (response) => response.expectedWriterPromptHash,
        ),
      })),
    ).toEqual([
      {
        artifact:
          "eb98705be57c3d687afa215fb5c127260e9ff7933fa8d32d1f98f4223b71dfb3",
        provenance:
          "fcc559d0ab92833c8f0ea5fc02d8125e58e7a10c4159d47a54a8169e16935acf",
        prompts: [
          "73ce8012970b6609221203185c6c1212e872e3f6b2fbdfb88a31b65edb7fff9b",
        ],
      },
      {
        artifact:
          "aa028cf973184a88360cb9d5324d2cf683f74e175b0dc8bb533a7ee73d8b650b",
        provenance:
          "86fdbf7ab4de64baaa06a5593089c85fb09150467c9af7d14d52782bcc2f15f2",
        prompts: [
          "78521322b6b9bbbd55d1e468f6bfc18f935ba390074c9499df863058b02272f1",
        ],
      },
    ]);
    expect(serializedFixtures).not.toMatch(
      /"(?:prompt|rawCv|rawJob|headers|authorization|apiKey|requestId|sessionId|rawResponse)"\s*:/i,
    );
    expect(serializedFixtures).not.toMatch(/Bearer\s+|\bsk-[A-Za-z0-9_-]+/i);
    expect(serializedFixtures).not.toMatch(/ADT Security|Copwatch|Securitas/i);

    expect(() =>
      recordedCoverLetterReplayFixtureSchema.parse({
        ...RECORDED_COVER_LETTER_REPLAY_FIXTURES[0],
        rawResponse: { providerEnvelope: true },
      }),
    ).toThrow();

    const fixture = RECORDED_COVER_LETTER_REPLAY_FIXTURES[0]!;
    const {
      expectedWriterPromptHash: _missingPromptHash,
      ...responseWithoutPromptHash
    } = fixture.responses[0] as (typeof fixture.responses)[number] & {
      expectedWriterPromptHash?: string;
    };
    expect(() =>
      recordedCoverLetterReplayFixtureSchema.parse({
        ...fixture,
        responses: [responseWithoutPromptHash],
      }),
    ).toThrow();
  });

  it("keeps the replay fixture contract open to all 14 configured languages", () => {
    const fixture = RECORDED_COVER_LETTER_REPLAY_FIXTURES[0]!;
    expect(PROPOSAL_OUTPUT_LANGUAGES).toHaveLength(14);
    for (const outputLanguage of PROPOSAL_OUTPUT_LANGUAGES) {
      expect(() =>
        recordedCoverLetterReplayFixtureSchema.parse({
          ...fixture,
          frozenConfig: {
            ...fixture.frozenConfig,
            outputLanguage,
          },
        }),
      ).not.toThrow();
    }
  });

  it("replays OpenAI and Mistral fixtures through final production preparation without provider calls", async () => {
    vi.stubEnv("PROPOSAL_GENERATION_QUALITY_MODE", "baseline");
    vi.stubEnv("cover_letter_premium_prompt_v2", "");
    vi.stubEnv("COVER_LETTER_PREMIUM_PROMPT_V2", "");
    vi.stubEnv("ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2", "");
    vi.stubEnv("ENABLE_COVER_LETTER_QUALITY_REPAIR_V1", "");
    vi.stubEnv("OPENAI_API_KEY", "must-not-be-used");
    vi.stubEnv("MISTRAL_API_KEY", "must-not-be-used");
    const fetchSpy = vi.fn(() => {
      throw new Error("network access is forbidden during replay");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const first = await replayRecordedCoverLetterFixtures();
    const second = await replayRecordedCoverLetterFixtures();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(first.map((result) => result.writerCallCount)).toEqual([1, 1]);
    for (const result of first) {
      const fixture = RECORDED_COVER_LETTER_REPLAY_FIXTURES.find(
        (item) => item.id === result.fixtureId,
      )!;
      expect(result.artifact).toMatchObject({
        decision: "accepted",
        finalContent: expect.any(String),
        artifactHash: fixture.expectedArtifactHash,
        provenanceHash: fixture.expectedProvenanceHash,
      });
      expect(result.artifact.sections).toEqual([
        { type: "text", content: result.artifact.finalContent },
      ]);
      expect(result.sendability).toMatchObject({
        version: "cover_letter_final_sendability_result_v1",
        inputScope: "final_visible_artifact_only",
        contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      });
      expect(result.diagnostic).toMatchObject({
        version: "cover_letter_eval_cell_diagnostic_v1",
        evidenceAvailability: "candidate_evidence_present",
        pipelineOutcome: expect.stringMatching(
          /^(?:human_review_pending|editorial_veto)$/u,
        ),
      });
    }

    const mistral = first.find(
      (result) => result.writerProvider === "mistral",
    )!;
    expect(mistral.artifact.provenance.origin).toBe("provider_reported");
    expect(mistral.artifact.provenance.status).toBe("validated_final_text");
    expect(mistral.artifact.provenance.sections.opening.claimIds).toEqual([
      "claim_opening_001",
    ]);
    expect(mistral.artifact.provenance.sections.opening.factIds).toEqual([
      "fact_experience_001_highlight_003",
    ]);
    expect(
      mistral.artifact.provenance.sections.employerValueBlock.demandIds,
    ).toEqual(["demand_core_001"]);
  });

  it("fingerprints both the writer and model-assisted repair schemas", async () => {
    vi.stubEnv("PROPOSAL_GENERATION_QUALITY_MODE", "baseline");
    vi.stubEnv("cover_letter_premium_prompt_v2", "");
    vi.stubEnv("COVER_LETTER_PREMIUM_PROMPT_V2", "");
    vi.stubEnv("ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2", "");
    vi.stubEnv("ENABLE_COVER_LETTER_QUALITY_REPAIR_V1", "");
    vi.stubEnv("OPENAI_PROPOSAL_REASONING_EFFORT", "low");

    const expectedSchemaHash = await buildStableHash({
      namespace: "cover-letter-eval-config",
      type: "writer-schema",
      version: 2,
      value: {
        writerOutput: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
        bodyPartsRepair: PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
      },
    });
    const [result] = await replayRecordedCoverLetterFixtures();

    expect(result?.artifact.frozenConfig.writerSchemaHash).toBe(
      expectedSchemaHash,
    );
    expect(result?.artifact.configVersions.writerSchema).toBe(
      "premium_writer_output_v1:premium_cover_letter_body_parts",
    );
  });

  it("replays recorded body-parts responses for model-assisted repair", async () => {
    vi.stubEnv("PROPOSAL_GENERATION_QUALITY_MODE", "baseline");
    vi.stubEnv("cover_letter_premium_prompt_v2", "");
    vi.stubEnv("COVER_LETTER_PREMIUM_PROMPT_V2", "");
    vi.stubEnv("ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2", "");
    vi.stubEnv("ENABLE_COVER_LETTER_QUALITY_REPAIR_V1", "");
    vi.stubEnv("OPENAI_PROPOSAL_REASONING_EFFORT", "low");
    vi.stubEnv("OPENAI_API_KEY", "must-not-be-used");
    vi.stubEnv("MISTRAL_API_KEY", "must-not-be-used");
    const fetchSpy = vi.fn(() => {
      throw new Error("network access is forbidden during replay");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const fixture = RECORDED_COVER_LETTER_REPLAY_FIXTURES[1]!;
    const firstResponse = fixture.responses[0]!;
    if (firstResponse.schemaId !== "premium_writer_output_v1") {
      throw new Error("The repair replay fixture requires a writer response.");
    }
    const parsed = recordedCoverLetterReplayFixtureSchema.parse({
      ...fixture,
      id: "mistral-adjacent-repair-v1",
      expectedArtifactHash:
        "6a6eced63f197951c5070e170e6b363ded46e461bcfc817e6f70f9c7a83631a5",
      expectedProvenanceHash:
        "274f47c0674bae8cfc979d422dff7aa7a3edd4f6a8576de5cac18c454d1e7a4f",
      responses: [
        {
          ...firstResponse,
          payload: {
            ...firstResponse.payload,
            bodyParts: {
              ...firstResponse.payload.bodyParts,
              opening: {
                ...firstResponse.payload.bodyParts.opening,
                text: "I have experience as an Implementation Analyst in cross-functional delivery environments.",
              },
            },
          },
        },
        {
          schemaId: "premium_cover_letter_body_parts",
          expectedWriterPromptHash:
            "31d645b840b92f3458c1e3e0231b2b10e62a96297473b5a1ba1e1bf158366619",
          payload: {
            opening: firstResponse.payload.bodyParts.opening.text,
            proofBlock: firstResponse.payload.bodyParts.proofBlock.text,
            employerValueBlock:
              firstResponse.payload.bodyParts.employerValueBlock.text,
            closeLine: firstResponse.payload.bodyParts.closeLine.text,
          },
        },
      ],
    });

    const result = await replayRecordedCoverLetterFixture(parsed);
    expect(result.writerCallCount).toBe(2);
    expect(result.artifact.decision).toBe("accepted");
    expect(result.artifact.artifactHash).toBe(parsed.expectedArtifactHash);
    expect(result.artifact.provenanceHash).toBe(parsed.expectedProvenanceHash);
    expect(result.artifact.provenance.origin).toBe("provider_reported");
    expect(result.artifact.provenance.status).toBe(
      "validated_after_structured_repair",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects recorded responses when the production writer prompt drifts", async () => {
    const fixture = RECORDED_COVER_LETTER_REPLAY_FIXTURES[0]!;
    await expect(
      replayRecordedCoverLetterFixture({
        ...fixture,
        responses: fixture.responses.map((response) => ({
          ...response,
          expectedWriterPromptHash: "0".repeat(64),
        })),
      } as any),
    ).rejects.toThrow(/writer prompt drift/u);
  });

  it("detects production output-language drift before replaying a response", async () => {
    const fixture = RECORDED_COVER_LETTER_REPLAY_FIXTURES[0]!;
    await expect(
      replayRecordedCoverLetterFixture({
        ...fixture,
        frozenConfig: {
          ...fixture.frozenConfig,
          outputLanguage: "French",
        },
      }),
    ).rejects.toThrow(/configuration drift: outputLanguage/u);
  });

  it("detects a recorded writer-or-repair schema version drift", async () => {
    const fixture = RECORDED_COVER_LETTER_REPLAY_FIXTURES[0]!;
    await expect(
      replayRecordedCoverLetterFixture({
        ...fixture,
        frozenConfig: {
          ...fixture.frozenConfig,
          writerSchemaVersion: "premium_writer_output_v1",
        },
      } as any),
    ).rejects.toThrow(/configuration drift: writerSchemaVersion/u);
  });

  it("defaults the CLI to replay and refuses unbudgeted live execution", () => {
    const replay = parseCoverLetterBenchmarkCliOptions([], "0");
    expect(replay.live).toBe(false);
    expect(() => createCoverLetterEvalLiveBudget(replay)).toThrow(/requires/u);

    const unbudgetedLive = parseCoverLetterBenchmarkCliOptions(["--live"], "0");
    expect(unbudgetedLive.live).toBe(true);
    expect(() => createCoverLetterEvalLiveBudget(unbudgetedLive)).toThrow(
      /explicit budgets/u,
    );

    const budgetedLive = parseCoverLetterBenchmarkCliOptions(
      [
        "--live",
        "--max-calls=2",
        "--max-repairs=0",
        "--max-usd=0.2",
        "--max-usd-per-call=0.1",
      ],
      "0",
    );
    expect(
      createCoverLetterEvalLiveBudget(budgetedLive).snapshot(),
    ).toMatchObject({
      liveProviderCallsEnabled: true,
      limits: {
        maxCalls: 2,
        maxRepairs: 0,
        maxUsd: 0.2,
        declaredMaxUsdPerCall: 0.1,
      },
    });

    const humanReviewOnly = parseCoverLetterBenchmarkCliOptions(
      [
        "--live",
        "--human-review-only",
        "--output-dir=/tmp/cover-letter-review",
        "--run-id=quality-eval-2a",
        "--source-ref=bbd96b5c",
        "--max-calls=24",
        "--max-repairs=0",
        "--max-usd=3.56292",
        "--max-usd-per-call=0.148455",
      ],
      "0",
    );
    expect(humanReviewOnly).toMatchObject({
      live: true,
      evaluationMode: "human_review_only",
      outputDirectory: "/tmp/cover-letter-review",
      runId: "quality-eval-2a",
      sourceRef: "bbd96b5c",
      writerModels: QUALITY_EVAL_2B_WRITER_MODELS,
    });
    expect(() =>
      parseCoverLetterBenchmarkCliOptions(
        [
          "--human-review-only",
          "--run-id=invalid run id",
          "--source-ref=bbd96b5c",
        ],
        "0",
      ),
    ).toThrow(/safe arm diagnostic bundle validation failed/iu);
    expect(() =>
      parseCoverLetterBenchmarkCliOptions(
        [
          "--human-review-only",
          "--run-id=quality-eval-2a",
          "--source-ref=not-a-source-ref",
        ],
        "0",
      ),
    ).toThrow(/safe arm diagnostic bundle validation failed/iu);
    expect(() =>
      parseCoverLetterBenchmarkCliOptions(
        ["--human-review-only", "--cases=blind-en-customer-success-direct"],
        "0",
      ),
    ).toThrow(/does not support --cases/iu);
    expect(() =>
      parseCoverLetterBenchmarkCliOptions(
        ["--cases=blind-en-customer-success-direct", "--human-review-only"],
        "0",
      ),
    ).toThrow(/does not support --cases/iu);
    expect(
      calculateCoverLetterBenchmarkMinimumProviderCalls({
        caseCount: 6,
        writerCount: 1,
        evaluationMode: humanReviewOnly.evaluationMode,
      }),
    ).toBe(6);
    expect(
      calculateCoverLetterBenchmarkMinimumProviderCalls({
        caseCount: 6,
        writerCount: 1,
        evaluationMode: "llm",
      }),
    ).toBe(12);
    expect(
      coverLetterBenchmarkRequiresOpenAIKey({
        evaluationMode: "human_review_only",
        writerModels: ["mistral-medium-latest"],
      }),
    ).toBe(false);
    expect(
      coverLetterBenchmarkRequiresOpenAIKey({
        evaluationMode: "human_review_only",
        writerModels: ["gpt-5.5"],
      }),
    ).toBe(true);
    expect(
      coverLetterBenchmarkRequiresOpenAIKey({
        evaluationMode: "llm",
        writerModels: ["mistral-medium-latest"],
      }),
    ).toBe(true);
  });

  it("loads dotenv before choosing replay or live execution", () => {
    const workdir = mkdtempSync(
      path.join(tmpdir(), "cover-letter-benchmark-env-"),
    );
    try {
      writeFileSync(
        path.join(workdir, ".env.local"),
        [
          "COVER_LETTER_EVAL_LIVE=1",
          "COVER_LETTER_PREMIUM_WRITER_MODEL=gpt-5.4",
          "COVER_LETTER_EVAL_MODEL=gpt-5.4",
        ].join("\n"),
      );
      const result = spawnSync(
        path.resolve(process.cwd(), "node_modules/.bin/tsx"),
        [
          path.resolve(
            process.cwd(),
            "scripts/evals/benchmark-cover-letter-writers.ts",
          ),
          "--cases=security-hyatt",
          "--max-calls=2",
          "--max-repairs=0",
          "--max-usd=0.2",
          "--max-usd-per-call=0.1",
        ],
        {
          cwd: workdir,
          encoding: "utf8",
          env: {
            ...process.env,
            COVER_LETTER_EVAL_LIVE: "",
            COVER_LETTER_PREMIUM_WRITER_MODEL: "",
            COVER_LETTER_EVAL_MODEL: "",
            OPENAI_API_KEY: "",
            MISTRAL_API_KEY: "",
          },
        },
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "OPENAI_API_KEY is not configured in the current environment.",
      );
      expect(result.stdout).not.toContain("cover-letter replay contract: PASS");
    } finally {
      rmSync(workdir, { recursive: true, force: true });
    }
  });

  it("aggregates per-writer scores, premium-ready counts, rank pass counts, and hard-fail reasons", () => {
    const records: CoverLetterBenchmarkRecord[] = [
      {
        status: "ok",
        caseId: "security-hyatt",
        preset: "signature",
        writerModel: "gpt-5.4",
        outputLanguage: "English",
        expectedContextClass: "cv_direct",
        generation: {} as any,
        artifact: {} as any,
        evaluation: successfulEvaluation,
        diagnostics: {
          provider: "openai",
          contextClass: "cv_direct",
          expectedContextClass: "cv_direct",
          validationResult: "premium_validation_passed",
          telemetry: {
            attemptedPath: "premium path saved",
            premium_path_saved: true,
            premium_validation_passed: true,
            premium_quality_shadow_passed: true,
          },
          qualityShadow: { passed: true, score: 6, issues: [] },
          failureStage: null,
          failureReason: null,
          failureIssues: [],
        },
        manualReview: emptyManualReview,
        letter: "letter 1",
      },
      {
        status: "ok",
        caseId: "adjacent-warehouse",
        preset: "engaging",
        writerModel: "gpt-5.4",
        outputLanguage: "English",
        expectedContextClass: "cv_adjacent",
        generation: {} as any,
        artifact: {} as any,
        evaluation: {
          ...successfulEvaluation,
          globalScore: 3,
          rankMatchesText: false,
          gating: {
            minimumBarMet: true,
            premiumReady: false,
            hardFailReasons: ["rankMatchesText=false"],
          },
        },
        diagnostics: {
          provider: "openai",
          contextClass: "cv_adjacent",
          expectedContextClass: "cv_adjacent",
          validationResult: "premium_validation_passed",
          telemetry: {
            attemptedPath: "premium path saved",
            premium_path_saved: true,
            premium_validation_passed: true,
            premium_quality_shadow_passed: false,
          },
          qualityShadow: {
            passed: false,
            score: 3,
            issues: ["factual_inventory"],
          },
          failureStage: null,
          failureReason: null,
          failureIssues: [],
        },
        manualReview: emptyManualReview,
        letter: "letter 2",
      },
      {
        status: "generation_failed",
        caseId: "ops-admin",
        preset: "expert",
        writerModel: "gpt-5-mini",
        outputLanguage: "English",
        expectedContextClass: "cv_direct",
        error: "Premium generation returned null.",
        diagnostics: {
          provider: "openai",
          contextClass: null,
          expectedContextClass: "cv_direct",
          validationResult: "premium_generation_failed",
          telemetry: {
            attemptedPath: "premium generation failed",
            premium_path_saved: false,
            premium_validation_passed: false,
            premium_quality_shadow_passed: null,
          },
          qualityShadow: null,
          failureStage: null,
          failureReason: null,
          failureIssues: [],
        },
        manualReview: emptyManualReview,
      },
    ];

    const aggregate = aggregateCoverLetterBenchmarkRecords(records, [
      "gpt-5.4",
      "gpt-5-mini",
    ]);

    expect(aggregate).toEqual([
      {
        writerModel: "gpt-5.4",
        totalRuns: 2,
        completedRuns: 2,
        averageGlobalScore: 3.5,
        premiumReadyCount: 1,
        rankMatchesTextPassCount: 1,
        qualityShadowPassCount: 1,
        hardFailReasons: [{ reason: "rankMatchesText=false", count: 1 }],
      },
      {
        writerModel: "gpt-5-mini",
        totalRuns: 1,
        completedRuns: 0,
        averageGlobalScore: null,
        premiumReadyCount: 0,
        rankMatchesTextPassCount: 0,
        qualityShadowPassCount: 0,
        hardFailReasons: [],
      },
    ]);
  });

  it("keeps benchmark fixtures aligned with the production premium cover-letter input contract", () => {
    for (const benchmarkCase of coverLetterBenchmarkCases) {
      const eligibility = evaluatePremiumCoverLetterEligibility({
        personalizationContext: benchmarkCase.personalizationContext,
        voicePreset: benchmarkCase.preset,
        jobTitle: benchmarkCase.jobTitle,
        jobDescription: benchmarkCase.jobDescription,
      });

      expect(eligibility).toEqual({
        eligible: true,
        contextClass: benchmarkCase.expectedContextClass,
      });
    }
  });

  it("surfaces premium null-generation reasons instead of only reporting an opaque null", async () => {
    const benchmarkCase = coverLetterBenchmarkCases.find(
      (item) => item.id === "strong-adjacent-honest-transfer",
    )!;
    const generateLetter = vi
      .fn()
      .mockImplementation(
        async ({ onFailure, onProviderResponseMetadata, onWriterPrompt }) => {
          onWriterPrompt?.("captured production writer prompt");
          onProviderResponseMetadata?.({
            returnedModel: "gpt-5.5-2026-06-30",
            tokenUsage: {
              inputTokens: 3_000,
              outputTokens: 900,
              totalTokens: 3_900,
            },
          });
          onFailure?.({
            stage: "validation",
            reason: "non_repairable_validation",
            contextClass: "cv_adjacent",
            issues: ["adjacent_direct_fit"],
          });
          return null;
        },
      );

    const record = await benchmarkCoverLetterCase({
      benchmarkCase,
      writerModel: "gpt-5.5",
      evaluatorModel: "gpt-5-mini",
      apiKey: "sk-openai",
      generateLetter,
      evaluateLetter: vi.fn(),
    });

    expect(record).toMatchObject({
      status: "generation_failed",
      writerModel: "gpt-5.5",
      error:
        "Premium cover-letter generation failed at validation: non_repairable_validation, adjacent_direct_fit.",
      debug: {
        stage: "validation",
        reason: "non_repairable_validation",
        contextClass: "cv_adjacent",
        issues: ["adjacent_direct_fit"],
      },
      diagnostics: {
        provider: "openai",
        validationResult: "premium_generation_failed",
        telemetry: {
          attemptedPath: "premium generation failed",
          premium_path_saved: false,
          premium_validation_passed: false,
          premium_quality_shadow_passed: null,
        },
        failureStage: "validation",
        failureReason: "non_repairable_validation",
        failureIssues: ["adjacent_direct_fit"],
      },
      attemptMetadata: {
        version: "cover_letter_eval_failure_attempt_metadata_v1",
        caseId: benchmarkCase.id,
        provider: "openai",
        requestedModel: "gpt-5.5",
        returnedModel: "gpt-5.5-2026-06-30",
        promptHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        tokenUsage: {
          inputTokens: 3_000,
          outputTokens: 900,
          totalTokens: 3_900,
        },
        artifactHash: null,
        provenanceHash: null,
      },
      manualReview: emptyManualReview,
    });
  });

  it("preserves a generation failure when failure metadata SDK discovery fails", async () => {
    vi.spyOn(
      coverLetterEvalRunManifest,
      "resolveCoverLetterEvalInstalledSdkVersions",
    ).mockRejectedValue(new Error("SDK lookup unavailable"));
    const benchmarkCase = coverLetterBenchmarkCases.find(
      (item) => item.id === "strong-adjacent-honest-transfer",
    )!;
    const generateLetter = vi
      .fn()
      .mockImplementation(
        async ({ onFailure, onProviderResponseMetadata, onWriterPrompt }) => {
          onWriterPrompt?.("captured production writer prompt");
          onProviderResponseMetadata?.({
            returnedModel: "gpt-5.5-2026-06-30",
            tokenUsage: null,
          });
          onFailure?.({
            stage: "validation",
            reason: "non_repairable_validation",
            contextClass: "cv_adjacent",
            issues: ["adjacent_direct_fit"],
          });
          return null;
        },
      );

    await expect(
      benchmarkCoverLetterCase({
        benchmarkCase,
        writerModel: "gpt-5.5",
        evaluatorModel: "gpt-5-mini",
        apiKey: "sk-openai",
        generateLetter,
        evaluateLetter: vi.fn(),
      }),
    ).resolves.toMatchObject({
      status: "generation_failed",
      error:
        "Premium cover-letter generation failed at validation: non_repairable_validation, adjacent_direct_fit.",
      diagnostics: {
        failureStage: "validation",
        failureReason: "non_repairable_validation",
        failureIssues: ["adjacent_direct_fit"],
      },
    });
  });
});
