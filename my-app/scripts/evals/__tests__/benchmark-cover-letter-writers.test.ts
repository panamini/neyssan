import { describe, expect, it, vi } from "vitest";

import type { CoverLetterScore } from "../../../convex/lib/proposals/coverLetterEvaluation";
import { evaluatePremiumCoverLetterEligibility } from "../../../convex/lib/proposals/premiumCoverLetter";
import {
  aggregateCoverLetterBenchmarkRecords,
  benchmarkCoverLetterCase,
  type CoverLetterBenchmarkRecord,
} from "../benchmark-cover-letter-writers";
import { coverLetterBenchmarkCases } from "../cases/cover-letter/cases";

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

describe("benchmark-cover-letter-writers", () => {
  it("benchmarks one case with a per-run writer model and returns a typed success record", async () => {
    const benchmarkCase = coverLetterBenchmarkCases[0]!;
    const generateLetter = vi.fn().mockResolvedValue({
      content:
        "Dear Hiring Manager,\n\nI reduced overnight response times by 22% by tightening shift handoffs and escalation workflows.\n\nSincerely,\nDaniel Ruiz",
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
        opening: "Opening.",
        proofBlock: "Proof.",
        employerValueBlock: "Employer value.",
        closeLine: "Close.",
      },
      mode: "direct",
      evidenceUsed: [
        "Reduced overnight response times by 22% by tightening shift handoffs and escalation workflows.",
      ],
      omittedWeakEvidence: [],
    });
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
      letter:
        "Dear Hiring Manager,\n\nI reduced overnight response times by 22% by tightening shift handoffs and escalation workflows.\n\nSincerely,\nDaniel Ruiz",
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
    });
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
        evaluation: successfulEvaluation,
      },
      {
        status: "ok",
        caseId: "adjacent-warehouse",
        preset: "engaging",
        writerModel: "gpt-5.4",
        outputLanguage: "English",
        expectedContextClass: "cv_adjacent",
        generation: {} as any,
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
      },
      {
        status: "generation_failed",
        caseId: "ops-admin",
        preset: "expert",
        writerModel: "gpt-5-mini",
        outputLanguage: "English",
        expectedContextClass: "cv_direct",
        error: "Premium generation returned null.",
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
        hardFailReasons: [{ reason: "rankMatchesText=false", count: 1 }],
      },
      {
        writerModel: "gpt-5-mini",
        totalRuns: 1,
        completedRuns: 0,
        averageGlobalScore: null,
        premiumReadyCount: 0,
        rankMatchesTextPassCount: 0,
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
    const generateLetter = vi.fn().mockImplementation(async ({ onFailure }) => {
      onFailure?.({
        stage: "validation",
        reason: "non_repairable_validation",
        contextClass: "cv_adjacent",
        issues: ["adjacent_direct_fit"],
      });
      return null;
    });

    const record = await benchmarkCoverLetterCase({
      benchmarkCase,
      writerModel: "gpt-5-mini",
      evaluatorModel: "gpt-5-mini",
      apiKey: "sk-openai",
      generateLetter,
    });

    expect(record).toMatchObject({
      status: "generation_failed",
      writerModel: "gpt-5-mini",
      error:
        "Premium cover-letter generation failed at validation: non_repairable_validation, adjacent_direct_fit.",
      debug: {
        stage: "validation",
        reason: "non_repairable_validation",
        contextClass: "cv_adjacent",
        issues: ["adjacent_direct_fit"],
      },
    });
  });
});
