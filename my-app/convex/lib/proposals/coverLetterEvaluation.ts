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
    "source-backed quantified achievements when present",
    "source-backed high-scope responsibilities when present",
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
  "- persuasion = the truthful hiring case made from available evidence; do not cap persuasion at 3 solely because absent metrics, incidents, credentials, or outcomes would make the case stronger",
  "- Persuasion can be 4 when the letter builds a credible employer-facing case from source-backed operating discipline, concrete responsibilities, and relevant work surfaces, even without metrics, incidents, or outcomes",
  "- For adjacent/source-backed operational letters, assign persuasion=4 when the letter leads with the best concrete proof, explains why that proof matters to the employer's work surface, and avoids overclaiming; do not downgrade to persuasion=3 merely because no incident anecdote, metric, or outcome is available",
  "- For adjacent/source-backed operational letters, assign structure=4 when the order is proof -> supporting operational detail -> employer-facing work surface -> close, even if the letter is concise",
  "- substance can be 4 for specific operational proof, named work contexts, and clear handoff/reporting details even when no quantified achievement is present",
  "- grounding = claims stay tied to actual evidence and avoid invented experience or inflated fit claims",
  "- rankMatchesText = true only if the letter clearly prioritizes the strongest available evidence first and does not let weak qualifications, checklist language, or attraction language dominate",
  "- Evaluate rankMatchesText by comparing evidence that is actually present in the letter. Do not set rankMatchesText=false because a stronger metric, anecdote, certification, incident example, or scope detail is missing from the letter.",
  "- Set rankMatchesText=false only when the letter visibly leads with weaker present material while stronger present material is buried later, or when weak checklist/attraction language dominates over present proof",
  "- Do not require quantified achievements, credentials, incident volumes, response times, or scope details when the letter does not contain source-backed evidence for them; absence of metrics is not a ranking failure by itself",
  "- A modest adjacent letter can still have rankMatchesText=true when it leads with concrete operational proof before duration, job titles, employer admiration, or checklist language",
  "- smallestUsefulRevision must not ask the writer to invent metrics, credentials, or impact; suggest reordering or sharpening existing evidence unless the letter already contains a source-backed metric to use",
  "Evidence ranking reference:",
  "1. source-backed quantified achievements when present",
  "2. source-backed high-scope responsibilities when present",
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
