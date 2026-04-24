import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isUiSafeVisibleJobExtraction,
  selectVisibleJobExtraction,
  type VisibleJobExtractionShadowRow,
} from "../visibleJobExtraction";
import type { NormalizedJobExtraction } from "../jobExtractionSchema";

afterEach(() => {
  vi.unstubAllEnvs();
});

const baseOutput: NormalizedJobExtraction = {
  summary_short: "Coordonne les opérations terrain et les plannings d'équipe.",
  role_title_normalized: "Coordinateur Operations",
  requirements: [
    { value: "Coordination opérationnelle", type: "skill", required: true },
    { value: "Gestion de planning", type: "tool", required: true },
  ],
  keywords_canonical: ["coordination", "planning"],
  licenses_or_certifications: [],
  schedule_constraints: [],
  environment: {
    customer_facing: null,
    retail: null,
    physical_standing: null,
    onsite: null,
  },
  confidence: "medium",
};

function row(
  overrides: Partial<VisibleJobExtractionShadowRow> = {},
): VisibleJobExtractionShadowRow {
  return {
    llm_normalized_output: baseOutput,
    validation_status: "valid",
    fallback_used: false,
    model: "mistral-small-latest",
    prompt_version: "p9_v1",
    created_at: 100,
    ...overrides,
  };
}

function select(
  overrides: Partial<Parameters<typeof selectVisibleJobExtraction>[0]> = {},
) {
  return selectVisibleJobExtraction({
    flagEnabled: true,
    shadowRows: [row()],
    heuristic: {
      summary: "Heuristic summary",
      requirements: ["Heuristic requirement"],
      keywords: ["heuristic"],
    },
    rawLanguageDetected: "fr",
    model: "mistral-small-latest",
    promptVersion: "p9_v1",
    ...overrides,
  });
}

describe("selectVisibleJobExtraction", () => {
  it("returns current-policy valid non-fallback LLM output when the flag is on", () => {
    expect(select()).toEqual({
      source: "llm",
      summary: baseOutput.summary_short,
      requirements: ["Coordination opérationnelle", "Gestion de planning"],
      keywords: ["coordination", "planning"],
    });
  });

  it("selects the newest current-policy valid non-fallback row", () => {
    const newest = {
      ...baseOutput,
      summary_short: "Résumé LLM le plus récent.",
    };

    expect(
      select({
        shadowRows: [
          row({ created_at: 100 }),
          row({ created_at: 200, llm_normalized_output: newest }),
        ],
      }).summary,
    ).toBe("Résumé LLM le plus récent.");
  });

  it("falls back for old model rows", () => {
    expect(select({ shadowRows: [row({ model: "old-model" })] })).toMatchObject({
      source: "heuristic",
      summary: "Heuristic summary",
    });
  });

  it("falls back for old prompt-version rows", () => {
    expect(
      select({ shadowRows: [row({ prompt_version: "old_prompt" })] }),
    ).toMatchObject({
      source: "heuristic",
      summary: "Heuristic summary",
    });
  });

  it("falls back for invalid rows", () => {
    expect(
      select({ shadowRows: [row({ validation_status: "schema_invalid" })] }),
    ).toMatchObject({
      source: "heuristic",
    });
  });

  it("falls back for fallback-used rows", () => {
    expect(select({ shadowRows: [row({ fallback_used: true })] })).toMatchObject({
      source: "heuristic",
    });
  });

  it("falls back for schema-invalid normalized output", () => {
    expect(
      select({ shadowRows: [row({ llm_normalized_output: { summary_short: "ok" } })] }),
    ).toMatchObject({
      source: "heuristic",
    });
  });

  it("falls back when no shadow row exists", () => {
    expect(select({ shadowRows: [] })).toMatchObject({
      source: "heuristic",
      requirements: ["Heuristic requirement"],
      keywords: ["heuristic"],
    });
  });

  it("falls back when the LLM row is UI-unsafe", () => {
    expect(
      select({
        shadowRows: [
          row({
            llm_normalized_output: {
              ...baseOutput,
              summary_short: "Apply now at https://example.com/jobs",
            },
          }),
        ],
      }),
    ).toMatchObject({
      source: "heuristic",
    });
  });

  it("returns empty when heuristic display data is unavailable", () => {
    expect(
      select({
        flagEnabled: false,
        shadowRows: [],
        heuristic: { summary: "", requirements: [], keywords: [] },
      }),
    ).toEqual({
      source: "empty",
      summary: null,
      requirements: [],
      keywords: [],
    });
  });

  it("keeps a French fixture in French", () => {
    const result = select();

    expect(result.source).toBe("llm");
    expect(result.summary).toContain("Coordonne");
    expect(result.requirements.join(" ")).toContain("opérationnelle");
  });

  it("rejects obvious English translation for a French job", () => {
    expect(
      select({
        shadowRows: [
          row({
            llm_normalized_output: {
              ...baseOutput,
              summary_short: "The role will be responsible for team planning.",
            },
          }),
        ],
      }),
    ).toMatchObject({
      source: "heuristic",
    });
  });
});

describe("isUiSafeVisibleJobExtraction", () => {
  it("rejects empty requirements when heuristic requirements exist", () => {
    expect(
      isUiSafeVisibleJobExtraction({
        output: { ...baseOutput, requirements: [] },
        heuristicRequirements: ["Heuristic requirement"],
      }),
    ).toBe(false);
  });
});
