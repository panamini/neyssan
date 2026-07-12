import { describe, expect, it } from "vitest";

import type { CoverLetterScore } from "../../../convex/lib/proposals/coverLetterEvaluation";
import {
  classifyWeaknessTheme,
  parseStabilityCoverLetterCliOptions,
  summarizeCaseStability,
} from "../stability-cover-letter-mini";

function makeScore(overrides?: Partial<CoverLetterScore>): CoverLetterScore {
  return {
    score: {
      relevance: 4,
      credibility: 4,
      persuasion: 3,
      structure: 4,
      substance: 3,
      tone: 4,
      grounding: 4,
    },
    globalScore: 4,
    strengths: ["Uses relevant evidence."],
    mainWeakness: "Lacks scale, context, and quantified impact.",
    smallestUsefulRevision: "Add context without inventing new facts.",
    rankMatchesText: true,
    gating: {
      minimumBarMet: true,
      premiumReady: false,
      hardFailReasons: [],
    },
    ...overrides,
  };
}

describe("stability-cover-letter-mini", () => {
  it("defaults to offline-disabled live execution and requires explicit budget inputs", () => {
    expect(parseStabilityCoverLetterCliOptions([], "0")).toMatchObject({
      live: false,
      maxCalls: null,
      maxRepairs: null,
      maxUsd: null,
      declaredMaxUsdPerCall: null,
    });
    expect(
      parseStabilityCoverLetterCliOptions(
        [
          "--live",
          "--max-calls=6",
          "--max-repairs=0",
          "--max-usd=0.6",
          "--max-usd-per-call=0.1",
        ],
        "0",
      ),
    ).toMatchObject({
      live: true,
      maxCalls: 6,
      maxRepairs: 0,
      maxUsd: 0.6,
      declaredMaxUsdPerCall: 0.1,
    });
  });

  it("classifies recurring weakness themes conservatively", () => {
    expect(
      classifyWeaknessTheme(
        "Lacks scale, context, timeframe, and quantified impact.",
      ),
    ).toBe("thin_proof_texture");
    expect(
      classifyWeaknessTheme(
        "Reads like a summary of responsibilities rather than a persuasive case.",
      ),
    ).toBe("generic_value_move");
    expect(
      classifyWeaknessTheme(
        "Leans on analogy rather than direct experience in implementation work.",
      ),
    ).toBe("generic_value_move");
    expect(classifyWeaknessTheme("Feels repetitive across paragraphs.")).toBe(
      "repetition",
    );
  });

  it("summarizes repeated case results with averages, ranges, and weakness themes", () => {
    const summaries = summarizeCaseStability([
      {
        caseId: "ops-admin",
        runIndex: 1,
        record: {
          status: "ok",
          caseId: "ops-admin",
          preset: "expert",
          writerModel: "gpt-5-mini",
          outputLanguage: "English",
          expectedContextClass: "cv_direct",
          generation: {} as any,
          evaluation: makeScore(),
        },
      },
      {
        caseId: "ops-admin",
        runIndex: 2,
        record: {
          status: "ok",
          caseId: "ops-admin",
          preset: "expert",
          writerModel: "gpt-5-mini",
          outputLanguage: "English",
          expectedContextClass: "cv_direct",
          generation: {} as any,
          evaluation: makeScore({
            score: {
              relevance: 4,
              credibility: 4,
              persuasion: 4,
              structure: 4,
              substance: 4,
              tone: 4,
              grounding: 4,
            },
            mainWeakness:
              "Reads like a generic value summary instead of a persuasive case.",
            gating: {
              minimumBarMet: true,
              premiumReady: true,
              hardFailReasons: [],
            },
          }),
        },
      },
      {
        caseId: "ops-admin",
        runIndex: 3,
        record: {
          status: "generation_failed",
          caseId: "ops-admin",
          preset: "expert",
          writerModel: "gpt-5-mini",
          outputLanguage: "English",
          expectedContextClass: "cv_direct",
          error: "generation failed",
        },
      },
    ]);

    expect(summaries).toEqual([
      {
        caseId: "ops-admin",
        totalRuns: 3,
        completedRuns: 2,
        premiumReadyCount: 1,
        rankMatchesTextCount: 2,
        averageGlobalScore: 4,
        globalScoreRange: [4, 4],
        averagePersuasion: 3.5,
        persuasionRange: [3, 4],
        averageSubstance: 3.5,
        substanceRange: [3, 4],
        weaknessThemes: [
          { theme: "generic_value_move", count: 1 },
          { theme: "thin_proof_texture", count: 1 },
        ],
        mainWeaknesses: [
          "Lacks scale, context, and quantified impact.",
          "Reads like a generic value summary instead of a persuasive case.",
        ],
      },
    ]);
  });
});
