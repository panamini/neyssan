type CoverLetterScoreValue = 0 | 1 | 2 | 3 | 4 | 5;

export type CoverLetterScore = {
  score: {
    relevance: CoverLetterScoreValue;
    credibility: CoverLetterScoreValue;
    persuasion: CoverLetterScoreValue;
    structure: CoverLetterScoreValue;
    substance: CoverLetterScoreValue;
    tone: CoverLetterScoreValue;
    grounding: CoverLetterScoreValue;
  };
  globalScore: CoverLetterScoreValue;
  strengths: string[];
  mainWeakness: string;
  smallestUsefulRevision: string;
  rankMatchesText: boolean;
  gating: {
    minimumBarMet: boolean;
    premiumReady: boolean;
    hardFailReasons: string[];
  };
};

export const COVER_LETTER_RUBRIC_GUIDE = {
  macroCriteria: [
    "quality",
    "persuasion",
    "groundedness",
    "stability",
    "control",
  ],
  operatingCriteria: [
    "relevance",
    "credibility",
    "persuasion",
    "structure",
    "substance",
    "tone",
    "grounding",
  ],
  evidenceRankingReference: [
    "quantified achievements",
    "high-scope responsibilities",
    "concrete operational proof",
    "workflow or context evidence relevant to the role",
    "only then secondary tools or qualifications",
  ],
  demoteWhenStrongerEvidenceExists: [
    "language basics",
    "Word / Excel / Windows",
    "generic readiness",
    "generic flexibility",
    "future certifications",
    "weak checklist matching",
    "company-attraction or admiration language",
  ],
} as const;

export const COVER_LETTER_EVALUATOR_PROMPT = [
  "You are evaluating one employment cover letter.",
  "Score these dimensions from 0 to 5: relevance, credibility, persuasion, structure, substance, tone, grounding.",
  "Macro criteria to keep in mind: quality, persuasion, groundedness, stability, control.",
  "Definitions:",
  "- structure = positioning -> proof -> employer-facing value -> close",
  "- substance = useful concrete material, not raw length",
  "- grounding = claims stay tied to actual evidence and avoid invented experience or inflated fit claims",
  "- rankMatchesText = true only if the letter clearly prioritizes strongest evidence first and does not let weak qualifications, checklist language, or attraction language dominate",
  "Evidence ranking reference:",
  "1. quantified achievements",
  "2. high-scope responsibilities",
  "3. concrete operational proof",
  "4. workflow or context evidence relevant to the role",
  "5. only then secondary tools or qualifications",
  "Demote this material when stronger evidence exists: language basics; Word / Excel / Windows; generic readiness; generic flexibility; future certifications; weak checklist matching; company-attraction or admiration language.",
  "Return JSON only with exactly these top-level fields: score, globalScore, strengths, mainWeakness, smallestUsefulRevision, rankMatchesText.",
  "Return this score object exactly: relevance, credibility, persuasion, structure, substance, tone, grounding.",
  "Do not include markdown, commentary, or extra keys.",
].join("\n");

export const scoreCoverLetter = (
  input: Omit<CoverLetterScore, "gating">,
): CoverLetterScore => {
  const minimumBarMet =
    input.score.relevance >= 3 &&
    input.score.credibility >= 4 &&
    input.score.grounding >= 4;

  const hardFailReasons: string[] = [];
  if (input.score.tone <= 2) {
    hardFailReasons.push("tone_too_low");
  }
  if (input.score.substance <= 2) {
    hardFailReasons.push("substance_too_low");
  }
  if (!input.rankMatchesText) {
    hardFailReasons.push("rank_does_not_match_text");
  }

  const premiumReady =
    input.globalScore >= 4 &&
    input.score.persuasion >= 4 &&
    input.score.structure >= 4 &&
    input.score.substance >= 4 &&
    input.rankMatchesText === true &&
    minimumBarMet;

  return {
    ...input,
    gating: {
      minimumBarMet,
      premiumReady,
      hardFailReasons,
    },
  };
};
