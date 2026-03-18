import { describe, expect, it, vi } from "vitest";

import {
  buildCoverLetterEvaluationInput,
  evaluateCoverLetterTextWithOpenAI,
  extractOpenAIJsonPayload,
  resolveCoverLetterEvalModel,
} from "../evaluate-cover-letter";

describe("evaluate-cover-letter script helpers", () => {
  it("builds an evaluator input around the rubric prompt and letter body", () => {
    const prompt = buildCoverLetterEvaluationInput(
      "Dear Hiring Manager,\n\nI led a design system migration.\n\nSincerely,\nAlex",
    );

    expect(prompt).toContain("You are evaluating one employment cover letter.");
    expect(prompt).toContain("<cover_letter>");
    expect(prompt).toContain("I led a design system migration.");
    expect(prompt).toContain("</cover_letter>");
  });

  it("returns a typed CoverLetterScore with gating from an OpenAI JSON response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            content: [
              {
                json: {
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
                  strengths: [
                    "Leads with relevant evidence.",
                    "Keeps value tied to role context.",
                  ],
                  mainWeakness: "The close could be tighter.",
                  smallestUsefulRevision:
                    "Trim the final sentence so the proof stays dominant.",
                  rankMatchesText: true,
                },
              },
            ],
          },
        ],
      }),
    });

    const result = await evaluateCoverLetterTextWithOpenAI({
      letter:
        "Dear Hiring Manager,\n\nI led a design system migration used across four squads.\n\nSincerely,\nAlex",
      apiKey: "sk-openai",
      fetchImpl: fetchImpl as any,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
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
      strengths: [
        "Leads with relevant evidence.",
        "Keeps value tied to role context.",
      ],
      mainWeakness: "The close could be tighter.",
      smallestUsefulRevision:
        "Trim the final sentence so the proof stays dominant.",
      rankMatchesText: true,
      gating: {
        minimumBarMet: true,
        premiumReady: true,
        hardFailReasons: [],
      },
    });

    const request = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual(
      expect.objectContaining({
        model: "gpt-5-mini",
        reasoning: { effort: "minimal" },
      }),
    );
    expect(JSON.parse(String(request.body))).not.toHaveProperty("temperature");
  });

  it("parses output_text JSON when the response does not provide a json field", () => {
    const payload = extractOpenAIJsonPayload({
      output_text: JSON.stringify({
        score: {
          relevance: 3,
          credibility: 4,
          persuasion: 3,
          structure: 3,
          substance: 3,
          tone: 3,
          grounding: 4,
        },
        globalScore: 3,
        strengths: ["Uses some grounded evidence."],
        mainWeakness: "Secondary qualifications lead too early.",
        smallestUsefulRevision:
          "Move the strongest concrete proof into the opening paragraph.",
        rankMatchesText: false,
      }),
    });

    expect(payload).toEqual({
      score: {
        relevance: 3,
        credibility: 4,
        persuasion: 3,
        structure: 3,
        substance: 3,
        tone: 3,
        grounding: 4,
      },
      globalScore: 3,
      strengths: ["Uses some grounded evidence."],
      mainWeakness: "Secondary qualifications lead too early.",
      smallestUsefulRevision:
        "Move the strongest concrete proof into the opening paragraph.",
      rankMatchesText: false,
    });
  });

  it("uses CLI model first, then COVER_LETTER_EVAL_MODEL, then the default", () => {
    delete process.env.COVER_LETTER_EVAL_MODEL;
    expect(resolveCoverLetterEvalModel()).toBe("gpt-5-mini");

    process.env.COVER_LETTER_EVAL_MODEL = "gpt-4o-mini";
    try {
      expect(resolveCoverLetterEvalModel()).toBe("gpt-4o-mini");
      expect(resolveCoverLetterEvalModel("gpt-5-mini")).toBe("gpt-5-mini");
    } finally {
      delete process.env.COVER_LETTER_EVAL_MODEL;
    }
  });
});
