import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildJobExtractionRequestBody,
  DEFAULT_JOB_EXTRACTION_MODEL,
  extractJobStructuredWithMetadata,
  hashNormalizedJobText,
  isCompleteJsonObjectText,
  prepareJobTextForPrompt,
  PROMPT_VERSION,
  resolveJobExtractionModel,
} from "../llmExtractJob";
import {
  classifyJobExtractionPayload,
  type NormalizedJobExtraction,
} from "../jobExtractionSchema";

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

  it("builds a constrained Mistral JSON schema request with deterministic controls", () => {
    const body = buildJobExtractionRequestBody("Raw job text", DEFAULT_JOB_EXTRACTION_MODEL);
    const responseFormat = body.response_format as any;
    const schema = responseFormat.json_schema?.schema;
    const requirementSchema = schema.properties.requirements.items;
    const environmentSchema = schema.properties.environment;

    expect(body.model).toBe("ministral-3b-2512");
    expect(body.temperature).toBe(0.1);
    expect(body.max_tokens).toBe(1400);
    expect(responseFormat.type).toBe("json_schema");
    expect(responseFormat.json_schema.name).toBe("normalized_job_extraction");
    expect(responseFormat.json_schema.strict).toBe(true);
    expect(schema.required).toEqual([
      "summary_short",
      "role_title_normalized",
      "requirements",
      "keywords_canonical",
      "licenses_or_certifications",
      "schedule_constraints",
      "environment",
      "confidence",
    ]);
    expect(requirementSchema.required).toEqual(["value", "type", "required"]);
    expect(requirementSchema.properties.type.enum).toEqual([
      "skill",
      "experience",
      "tool",
      "education",
      "certification",
      "language",
      "constraint",
    ]);
    expect(environmentSchema.required).toEqual([
      "customer_facing",
      "retail",
      "physical_standing",
      "onsite",
    ]);
    expect(body.messages[0].content).toContain("Return ONLY valid JSON");
    expect(body.messages[0].content).toContain("Preserve the original language");
    expect(body.messages[0].content).toContain("Do not translate");
    expect(body.messages[1].content).toContain("Schema:");
    expect(PROMPT_VERSION).toBe("p9_v2");
    expect(PROMPT_VERSION).not.toBe("p9_v1");
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

  it("keeps app-level validation authoritative and falls back for schema-invalid model output", async () => {
    const schemaInvalidOutput = {
      summary_short: "Retail security role",
      role_title_normalized: "Security Guard",
      requirements: [
        { value: "guard card", type: "licenses_or_certifications" },
        { value: "weekend shifts", type: "schedule_constraints" },
      ],
      keywords_canonical: ["retail security"],
      licenses_or_certifications: ["guard card"],
      schedule_constraints: ["weekend shifts"],
      environment: {
        customer_facing: true,
      },
      confidence: "high",
    };

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(schemaInvalidOutput) } }],
      }),
    })) as unknown as typeof fetch;

    const result = await extractJobStructuredWithMetadata("Guard card required", {
      fallback: heuristicFallback,
    });

    expect(result.validationStatus).toBe("schema_invalid");
    expect(result.fallbackUsed).toBe(true);
    expect(result.llmNormalizedOutput).toBeNull();
    expect(result.normalizedOutput.summary_short).toBe("Heuristic fallback");
  });

  it("captures the four JSON-mode probe failure shapes as schema-invalid fixtures", () => {
    const outputs = [
      {
        summary_short: "Retail store night shift security guard",
        role_title_normalized: "security_guard_retail_night_shift",
        requirements: [
          { value: "guard card required", type: "constraint" },
          { value: "writing incident reports", type: "responsibility" },
        ],
        keywords_canonical: ["security_guard"],
        licenses_or_certifications: ["guard_card"],
        schedule_constraints: ["weekend_availability"],
        environment: { customer_facing: true },
        confidence: "high",
      },
      {
        summary_short: "Retail security guard with loss prevention focus",
        role_title_normalized: "Retail Security Guard",
        requirements: [
          { value: "guard card required", type: "license" },
          { value: "weekend and holiday availability", type: "schedule_constraints" },
        ],
        keywords_canonical: ["retail security"],
        licenses_or_certifications: ["guard card"],
        schedule_constraints: ["weekend availability"],
        environment: { customer_facing: true, onsite: true },
        confidence: "high",
      },
      {
        summary_short: "Agent sécurité magasin",
        role_title_normalized: "agent sécurité magasin",
        requirements: [
          { value: "carte professionnelle valide", type: "licenses_or_certifications" },
          { value: "disponibilité le week-end", type: "schedule_constraints" },
        ],
        keywords_canonical: ["agent sécurité"],
        licenses_or_certifications: ["carte professionnelle"],
        schedule_constraints: ["disponibilité week-end"],
        environment: { customer_facing: true },
        confidence: "high",
      },
      {
        summary_short: "Retail security associate",
        role_title_normalized: "Retail Security Associate",
        requirements: [
          { value: "guard card", type: "licenses_or_certifications" },
          { value: "weekend/holiday shifts", type: "schedule_constraints" },
        ],
        keywords_canonical: ["retail security"],
        licenses_or_certifications: ["guard card"],
        schedule_constraints: ["weekend shifts", "holiday shifts"],
        environment: { customer_facing: true },
        confidence: "high",
      },
    ];

    expect(outputs.map((output) => classifyJobExtractionPayload(output).validationStatus)).toEqual([
      "schema_invalid",
      "schema_invalid",
      "schema_invalid",
      "schema_invalid",
    ]);
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

  it("defaults job extraction to the Ministral 3 3B Instruct API slug", () => {
    expect(resolveJobExtractionModel()).toBe("ministral-3b-2512");
    expect(DEFAULT_JOB_EXTRACTION_MODEL).toBe("ministral-3b-2512");
    expect(PROMPT_VERSION).toBe("p9_v2");
  });

  it("uses JOB_EXTRACTION_MISTRAL_MODEL when configured", () => {
    vi.stubEnv("JOB_EXTRACTION_MISTRAL_MODEL", "ministral-3b-2512");

    expect(resolveJobExtractionModel({ mistralModel: "mistral-small-latest" })).toBe(
      "ministral-3b-2512",
    );
  });

  it("gives JOB_EXTRACTION_MISTRAL_MODEL precedence over MISTRAL_MODEL", () => {
    vi.stubEnv("JOB_EXTRACTION_MISTRAL_MODEL", "ministral-3b-2512");
    vi.stubEnv("MISTRAL_MODEL", "mistral-small-latest");

    expect(resolveJobExtractionModel()).toBe("ministral-3b-2512");
  });

  it("keeps the configured fallback order after job-specific env", () => {
    vi.stubEnv("MISTRAL_MODEL", "mistral-small-latest");

    expect(resolveJobExtractionModel({ mistralModel: "ministral-3b-2512" })).toBe(
      "mistral-small-latest",
    );
  });

  it("uses config fallback values before the built-in default", () => {
    expect(resolveJobExtractionModel({ mistralModel: "ministral-3b-2512" })).toBe(
      "ministral-3b-2512",
    );
    expect(resolveJobExtractionModel({ mistralModel: "mistral-small-latest" })).toBe(
      "mistral-small-latest",
    );
    expect(
      resolveJobExtractionModel({ mistralModel: null, model: "mistral-large-latest" }),
    ).toBe("mistral-large-latest");
  });
});
