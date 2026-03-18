import { describe, expect, it } from "vitest";

import {
  COVER_LETTER_EVALUATOR_PROMPT,
  COVER_LETTER_RUBRIC_GUIDE,
  scoreCoverLetter,
} from "../coverLetterEvaluation";

describe("cover letter evaluation rubric", () => {
  it("marks strong letters as minimum-bar compliant and premium-ready", () => {
    const result = scoreCoverLetter({
      score: {
        relevance: 4,
        credibility: 4,
        persuasion: 4,
        structure: 4,
        substance: 4,
        tone: 4,
        grounding: 5,
      },
      globalScore: 4,
      strengths: ["Leads with strong proof.", "Keeps employer value concrete."],
      mainWeakness: "Could tighten the close slightly.",
      smallestUsefulRevision:
        "Trim the closing sentence so the proof stays dominant.",
      rankMatchesText: true,
    });

    expect(result.gating).toEqual({
      minimumBarMet: true,
      premiumReady: true,
      hardFailReasons: [],
    });
  });

  it("fails the minimum bar when relevance, credibility, or grounding miss threshold", () => {
    const result = scoreCoverLetter({
      score: {
        relevance: 2,
        credibility: 3,
        persuasion: 4,
        structure: 4,
        substance: 4,
        tone: 4,
        grounding: 3,
      },
      globalScore: 4,
      strengths: ["Maintains a clean structure."],
      mainWeakness: "Evidence is too weak for the target role.",
      smallestUsefulRevision:
        "Replace the opening with a stronger supported proof point.",
      rankMatchesText: true,
    });

    expect(result.gating.minimumBarMet).toBe(false);
    expect(result.gating.premiumReady).toBe(false);
  });

  it("collects hard fail reasons for tone, substance, and ranking mismatch", () => {
    const result = scoreCoverLetter({
      score: {
        relevance: 4,
        credibility: 4,
        persuasion: 2,
        structure: 3,
        substance: 2,
        tone: 2,
        grounding: 4,
      },
      globalScore: 2,
      strengths: ["Includes some relevant experience."],
      mainWeakness: "Weak qualifications dominate the body.",
      smallestUsefulRevision:
        "Lead with the strongest quantified evidence instead of checklist language.",
      rankMatchesText: false,
    });

    expect(result.gating.hardFailReasons).toEqual([
      "tone_too_low",
      "substance_too_low",
      "rank_does_not_match_text",
    ]);
  });

  it("documents the rubric guide and evaluator prompt in English", () => {
    expect(COVER_LETTER_RUBRIC_GUIDE.macroCriteria).toEqual([
      "quality",
      "persuasion",
      "groundedness",
      "stability",
      "control",
    ]);
    expect(COVER_LETTER_RUBRIC_GUIDE.operatingCriteria).toEqual([
      "relevance",
      "credibility",
      "persuasion",
      "structure",
      "substance",
      "tone",
      "grounding",
    ]);
    expect(COVER_LETTER_RUBRIC_GUIDE.evidenceRankingReference).toEqual([
      "quantified achievements",
      "high-scope responsibilities",
      "concrete operational proof",
      "workflow or context evidence relevant to the role",
      "only then secondary tools or qualifications",
    ]);
    expect(COVER_LETTER_EVALUATOR_PROMPT).toContain(
      "structure = positioning -> proof -> employer-facing value -> close",
    );
    expect(COVER_LETTER_EVALUATOR_PROMPT).toContain(
      "substance = useful concrete material, not raw length",
    );
    expect(COVER_LETTER_EVALUATOR_PROMPT).toContain(
      "rankMatchesText = true only if the letter clearly prioritizes strongest evidence first",
    );
    expect(COVER_LETTER_EVALUATOR_PROMPT).toContain(
      "Return JSON only with exactly these top-level fields: score, globalScore, strengths, mainWeakness, smallestUsefulRevision, rankMatchesText.",
    );
  });
});
