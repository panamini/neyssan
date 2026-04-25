import { z } from "zod";

import {
  calibrateJobExtractionConfidence,
  isGenericRequirement,
  normalizeJobExtractionWithStats,
} from "./normalizeJobExtraction";

export type JobRequirementType =
  | "skill"
  | "experience"
  | "tool"
  | "education"
  | "certification"
  | "language"
  | "constraint";

export type JobExtractionConfidence = "high" | "medium" | "low";

export type NormalizedJobExtraction = {
  summary_short: string;
  role_title_normalized: string;
  requirements: {
    value: string;
    type: JobRequirementType;
    required: boolean;
  }[];
  keywords_canonical: string[];
  licenses_or_certifications: string[];
  schedule_constraints: string[];
  environment: {
    customer_facing: boolean | null;
    retail: boolean | null;
    physical_standing: boolean | null;
    onsite: boolean | null;
  };
  confidence: JobExtractionConfidence;
};

export type JobExtractionValidationStatus =
  | "valid"
  | "invalid_json"
  | "schema_invalid"
  | "empty_signal"
  | "low_confidence";

export type JobExtractionClassification = {
  validationStatus: JobExtractionValidationStatus;
  normalizedOutput?: NormalizedJobExtraction;
  parsedObject?: unknown;
  modelConfidence?: JobExtractionConfidence | null;
  finalConfidence?: JobExtractionConfidence | null;
};

const RequirementTypeSchema = z.union([
  z.literal("skill"),
  z.literal("experience"),
  z.literal("tool"),
  z.literal("education"),
  z.literal("certification"),
  z.literal("language"),
  z.literal("constraint"),
]);

export const NormalizedJobExtractionSchema: z.ZodType<NormalizedJobExtraction> = z
  .object({
    summary_short: z.string(),
    role_title_normalized: z.string(),
    requirements: z.array(
      z
        .object({
          value: z.string(),
          type: RequirementTypeSchema,
          required: z.boolean(),
        })
        .strict(),
    ),
    keywords_canonical: z.array(z.string()),
    licenses_or_certifications: z.array(z.string()),
    schedule_constraints: z.array(z.string()),
    environment: z
      .object({
        customer_facing: z.union([z.boolean(), z.null()]),
        retail: z.union([z.boolean(), z.null()]),
        physical_standing: z.union([z.boolean(), z.null()]),
        onsite: z.union([z.boolean(), z.null()]),
      })
      .strict(),
    confidence: z.union([z.literal("high"), z.literal("medium"), z.literal("low")]),
  })
  .strict();

function compactWhitespace(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function extractJsonObjectStrict(rawValue: string):
  | { ok: true; value: unknown; jsonText: string }
  | { ok: false; reason: "invalid_json" } {
  const raw = String(rawValue ?? "").trim();
  if (!raw) {
    return { ok: false, reason: "invalid_json" };
  }

  if (!raw.startsWith("{") || !raw.endsWith("}")) {
    return { ok: false, reason: "invalid_json" };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(raw),
      jsonText: raw,
    };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}

function hasAnyEnvironmentSignal(output: NormalizedJobExtraction): boolean {
  return Object.values(output.environment).some((value) => value !== null);
}

function isEmptySignal(output: NormalizedJobExtraction): boolean {
  if (output.requirements.length === 0) {
    return true;
  }

  if (output.requirements.every((item) => isGenericRequirement(item.value))) {
    return true;
  }

  return (
    output.requirements.length < 2 &&
    output.licenses_or_certifications.length === 0 &&
    output.schedule_constraints.length === 0 &&
    !hasAnyEnvironmentSignal(output)
  );
}

function parsePayload(payload: unknown):
  | { ok: true; value: unknown }
  | { ok: false; status: "invalid_json" } {
  if (typeof payload === "string") {
    const parsed = extractJsonObjectStrict(payload);
    if (!parsed.ok) {
      return { ok: false, status: "invalid_json" };
    }
    return { ok: true, value: parsed.value };
  }

  return { ok: true, value: payload };
}

export function classifyJobExtractionPayload(
  payload: unknown,
): JobExtractionClassification {
  const parsed = parsePayload(payload);
  if (!parsed.ok) {
    return { validationStatus: parsed.status };
  }

  const schemaResult = NormalizedJobExtractionSchema.safeParse(parsed.value);
  if (!schemaResult.success) {
    return {
      validationStatus: "schema_invalid",
      parsedObject: parsed.value,
    };
  }

  const normalized = normalizeJobExtractionWithStats(schemaResult.data);
  const modelConfidence = schemaResult.data.confidence;
  const calibratedConfidence = calibrateJobExtractionConfidence(normalized);
  const normalizedOutput: NormalizedJobExtraction = {
    ...normalized.output,
    summary_short: compactWhitespace(normalized.output.summary_short),
    role_title_normalized: compactWhitespace(normalized.output.role_title_normalized),
    confidence: calibratedConfidence,
  };

  if (isEmptySignal(normalizedOutput)) {
    return {
      validationStatus: "empty_signal",
      normalizedOutput,
      parsedObject: parsed.value,
      modelConfidence,
      finalConfidence: calibratedConfidence,
    };
  }

  if (normalizedOutput.confidence === "low") {
    return {
      validationStatus: "low_confidence",
      normalizedOutput,
      parsedObject: parsed.value,
      modelConfidence,
      finalConfidence: calibratedConfidence,
    };
  }

  return {
    validationStatus: "valid",
    normalizedOutput,
    parsedObject: parsed.value,
    modelConfidence,
    finalConfidence: calibratedConfidence,
  };
}

export function isUiSafeExtraction(
  extraction: Pick<JobExtractionClassification, "validationStatus" | "finalConfidence"> & {
    normalizedOutput?: Pick<NormalizedJobExtraction, "confidence">;
  },
): boolean {
  const confidence =
    extraction.finalConfidence ?? extraction.normalizedOutput?.confidence ?? null;
  return extraction.validationStatus === "valid" && confidence !== "low";
}

export const NORMALIZED_JOB_EXTRACTION_SCHEMA_PROMPT = `{
  "summary_short": "string",
  "role_title_normalized": "string",
  "requirements": [
    {
      "value": "string",
      "type": "skill | experience | tool | education | certification | language | constraint",
      "required": true
    }
  ],
  "keywords_canonical": ["string"],
  "licenses_or_certifications": ["string"],
  "schedule_constraints": ["string"],
  "environment": {
    "customer_facing": true,
    "retail": null,
    "physical_standing": null,
    "onsite": null
  },
  "confidence": "high | medium | low"
}`;
