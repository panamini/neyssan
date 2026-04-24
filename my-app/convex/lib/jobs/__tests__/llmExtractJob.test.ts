import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildJobExtractionRequestBody,
  extractJobStructuredWithMetadata,
  hashNormalizedJobText,
  isCompleteJsonObjectText,
  prepareJobTextForPrompt,
  PROMPT_VERSION,
  resolveJobExtractionModel,
} from "../llmExtractJob";
import type { NormalizedJobExtraction } from "../jobExtractionSchema";

const validExtraction: NormalizedJobExtraction = {
  summary_short: "Customer-facing security role",
  role_title_normalized: "Security Guard",
  requirements: [
    { value: "Guard card", type: "certification", required: true },
    { value: "Retail loss prevention", type: "experience", required: true },
    { value: "Surveillance cameras", type: "tool", required: false },
  ],
  keywords_canonical: ["security", "loss prevention"],
  licenses_or_certifications: ["Guard card"],
  schedule_constraints: ["Weekend availability"],
  environment: {
    customer_facing: true,
    retail: true,
    physical_standing: true,
    onsite: true,
  },
  confidence: "high",
};

function heuristicFallback(): NormalizedJobExtraction {
  return {
    summary_short: "Heuristic fallback",
    role_title_normalized: "Security Guard",
    requirements: [
      { value: "Security Guard", type: "experience", required: true },
      { value: "Guard card required", type: "certification", required: true },
    ],
    keywords_canonical: ["security"],
    licenses_or_certifications: ["Guard card"],
    schedule_constraints: [],
    environment: {
      customer_facing: null,
      retail: null,
      physical_standing: null,
      onsite: null,
    },
    confidence: "medium",
  };
}

describe("llmExtractJob", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("MISTRAL_API_KEY", "sk-test");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("builds a constrained Mistral JSON request with deterministic controls", () => {
    const body = buildJobExtractionRequestBody("Raw job text", "mistral-small-latest");

    expect(body.model).toBe("mistral-small-latest");
    expect(body.temperature).toBe(0.1);
    expect(body.max_tokens).toBe(1400);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toContain("Return ONLY valid JSON");
    expect(body.messages[0].content).toContain("Preserve the original language");
    expect(body.messages[0].content).toContain("Do not translate");
    expect(body.messages[1].content).toContain("Schema:");
    expect(PROMPT_VERSION).toBe("p9_v1");
  });

  it("keeps requirement-heavy sections when prompt text is too long", () => {
    const longText = [
      "Company marketing ".repeat(2000),
      "Requirements: Guard card required. Retail loss prevention experience.",
      "What you'll do: monitor surveillance cameras and de-escalate visitor issues.",
      "About the role: customer-facing support in a retail store.",
      "Your responsibilities include standing onsite during weekend shifts.",
      "Schedule: weekend availability and night shift.",
      "Benefits ".repeat(2000),
    ].join("\n");

    const prepared = prepareJobTextForPrompt(longText);

    expect(prepared.length).toBeLessThanOrEqual(12000);
    expect(prepared).toContain("Guard card required");
    expect(prepared).toContain("monitor surveillance cameras");
    expect(prepared).toContain("customer-facing support");
    expect(prepared).toContain("standing onsite");
    expect(prepared).toContain("weekend availability");
  });

  it("hashes normalized text so whitespace variants share cache keys", async () => {
    await expect(hashNormalizedJobText(" Guard   card\nrequired ")).resolves.toBe(
      await hashNormalizedJobText("Guard card required"),
    );
  });

  it("returns valid metadata, normalized output, and latency for a successful call", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(validExtraction) } }],
      }),
    })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const result = await extractJobStructuredWithMetadata("Guard card required", {
      fallback: heuristicFallback,
    });

    expect(result.validationStatus).toBe("valid");
    expect(result.fallbackUsed).toBe(false);
    expect(result.llmNormalizedOutput).toEqual(result.normalizedOutput);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.modelConfidence).toBe("high");
    expect(result.finalConfidence).toBe("high");
    expect(result.normalizedOutput.role_title_normalized).toBe("Security Guard");
  });

  it("explicitly detects partial JSON that does not end with an object close", async () => {
    expect(isCompleteJsonObjectText(JSON.stringify(validExtraction))).toBe(true);
    expect(isCompleteJsonObjectText(`${JSON.stringify(validExtraction)}\n`)).toBe(true);
    expect(isCompleteJsonObjectText('{"summary_short":"partial"')).toBe(false);

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"summary_short":"partial"' } }],
      }),
    })) as unknown as typeof fetch;

    const result = await extractJobStructuredWithMetadata("Guard card required", {
      fallback: heuristicFallback,
    });

    expect(result.validationStatus).toBe("invalid_json");
    expect(result.fallbackUsed).toBe(true);
    expect(result.llmNormalizedOutput).toBeNull();
    expect(result.normalizedOutput.summary_short).toBe("Heuristic fallback");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.modelConfidence).toBeNull();
    expect(result.finalConfidence).toBe("medium");
  });

  it("classifies network failures as invalid_json fallback and records latency", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const result = await extractJobStructuredWithMetadata("Guard card required", {
      fallback: heuristicFallback,
    });

    expect(result.validationStatus).toBe("invalid_json");
    expect(result.fallbackUsed).toBe(true);
    expect(result.llmNormalizedOutput).toBeNull();
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("preserves non-English model output without translation", async () => {
    const frenchExtraction: NormalizedJobExtraction = {
      summary_short: "Assurer la sécurité des clients en magasin",
      role_title_normalized: "Agent de sécurité",
      requirements: [
        { value: "Carte professionnelle", type: "certification", required: true },
        { value: "Expérience en sécurité magasin", type: "experience", required: true },
      ],
      keywords_canonical: ["sécurité", "magasin"],
      licenses_or_certifications: ["Carte professionnelle"],
      schedule_constraints: ["Disponibilité le week-end"],
      environment: {
        customer_facing: true,
        retail: true,
        physical_standing: true,
        onsite: true,
      },
      confidence: "high",
    };

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(frenchExtraction) } }],
      }),
    })) as unknown as typeof fetch;

    const result = await extractJobStructuredWithMetadata(
      "Nous recherchons un agent de sécurité avec carte professionnelle.",
      { fallback: heuristicFallback },
    );

    expect(result.validationStatus).toBe("valid");
    expect(result.normalizedOutput.summary_short).toContain("sécurité");
    expect(result.normalizedOutput.requirements.map((item) => item.value)).toEqual(
      expect.arrayContaining(["Carte professionnelle", "Expérience en sécurité magasin"]),
    );
    expect(result.normalizedOutput.keywords_canonical).toEqual(["sécurité", "magasin"]);
    expect(result.normalizedOutput.summary_short).not.toMatch(/\bsecurity\b/i);
  });

  it("uses ministral-3b-2512 only when already configured", () => {
    expect(resolveJobExtractionModel({ mistralModel: "ministral-3b-2512" })).toBe(
      "ministral-3b-2512",
    );
    expect(resolveJobExtractionModel({ mistralModel: "mistral-small-latest" })).toBe(
      "mistral-small-latest",
    );
  });
});
