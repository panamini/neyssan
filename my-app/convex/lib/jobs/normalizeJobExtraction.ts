import type {
  JobExtractionConfidence,
  NormalizedJobExtraction,
} from "./jobExtractionSchema";

export const GENERIC_REQUIREMENTS = [
  "communication",
  "teamwork",
  "motivation",
  "adaptability",
  "problem solving",
  "detail oriented",
  "fast paced",
  "self starter",
  "multitasking",
  "dynamic environment",
] as const;

export type JobExtractionNormalizationStats = {
  originalRequirementCount: number;
  normalizedRequirementCount: number;
  removedGenericRequirementCount: number;
};

const GENERIC_REQUIREMENT_KEYS = new Set(
  GENERIC_REQUIREMENTS.map((value) => normalizeGenericKey(value)),
);

function compactWhitespace(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function trimTrailingPunctuation(value: string): string {
  return compactWhitespace(value).replace(/[.;:,!?]+$/g, "");
}

function normalizeGenericKey(value: string): string {
  return trimTrailingPunctuation(value)
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/[^a-z0-9+#.\s]/g, "")
    .replace(/\benvironment\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalPhrase(value: string): string {
  const cleaned = trimTrailingPunctuation(value);
  if (!cleaned) {
    return "";
  }

  const lower = cleaned.toLowerCase();
  if (/^[a-z0-9+#./ -]+$/i.test(cleaned)) {
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function canonicalTitle(value: string): string {
  const cleaned = trimTrailingPunctuation(value);
  if (!cleaned) {
    return "";
  }
  if (/^[a-z0-9+#./ -]+$/i.test(cleaned)) {
    return cleaned.toLowerCase().replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function canonicalKeyword(value: string): string {
  return trimTrailingPunctuation(value).toLowerCase();
}

function dedupeStrings(values: string[], transform: (value: string) => string): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of values) {
    const value = transform(rawValue);
    if (!value) {
      continue;
    }

    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(value);
  }

  return deduped;
}

export function normalizeRawJobTextForHash(value: string): string {
  return compactWhitespace(value);
}

export function isGenericRequirement(value: string): boolean {
  const key = normalizeGenericKey(value);
  if (!key) {
    return true;
  }

  if (GENERIC_REQUIREMENT_KEYS.has(key)) {
    return true;
  }

  for (const generic of GENERIC_REQUIREMENT_KEYS) {
    if (key === generic || key.startsWith(`${generic} `) || key.endsWith(` ${generic}`)) {
      return true;
    }
  }

  return false;
}

export function normalizeJobExtractionWithStats(
  input: NormalizedJobExtraction,
): {
  output: NormalizedJobExtraction;
  stats: JobExtractionNormalizationStats;
} {
  const requirements: NormalizedJobExtraction["requirements"] = [];
  const seenRequirements = new Set<string>();
  let removedGenericRequirementCount = 0;

  for (const requirement of input.requirements ?? []) {
    const value = canonicalPhrase(requirement.value);
    if (!value) {
      continue;
    }

    if (isGenericRequirement(value)) {
      removedGenericRequirementCount += 1;
      continue;
    }

    const key = `${requirement.type}:${value.toLowerCase()}:${requirement.required ? "1" : "0"}`;
    if (seenRequirements.has(key)) {
      continue;
    }

    seenRequirements.add(key);
    requirements.push({
      value,
      type: requirement.type,
      required: Boolean(requirement.required),
    });
  }

  const output: NormalizedJobExtraction = {
    summary_short: trimTrailingPunctuation(input.summary_short),
    role_title_normalized: canonicalTitle(input.role_title_normalized),
    requirements,
    keywords_canonical: dedupeStrings(input.keywords_canonical ?? [], canonicalKeyword),
    licenses_or_certifications: dedupeStrings(
      input.licenses_or_certifications ?? [],
      canonicalPhrase,
    ),
    schedule_constraints: dedupeStrings(input.schedule_constraints ?? [], canonicalPhrase),
    environment: {
      customer_facing: input.environment.customer_facing,
      retail: input.environment.retail,
      physical_standing: input.environment.physical_standing,
      onsite: input.environment.onsite,
    },
    confidence: input.confidence,
  };

  return {
    output,
    stats: {
      originalRequirementCount: input.requirements?.length ?? 0,
      normalizedRequirementCount: requirements.length,
      removedGenericRequirementCount,
    },
  };
}

export function normalizeJobExtraction(
  input: NormalizedJobExtraction,
): NormalizedJobExtraction {
  return normalizeJobExtractionWithStats(input).output;
}

function confidenceRank(confidence: JobExtractionConfidence): number {
  if (confidence === "high") {
    return 2;
  }
  if (confidence === "medium") {
    return 1;
  }
  return 0;
}

function confidenceFromRank(rank: number): JobExtractionConfidence {
  if (rank >= 2) {
    return "high";
  }
  if (rank >= 1) {
    return "medium";
  }
  return "low";
}

export function assessHeuristicSignalQuality(args: {
  output: NormalizedJobExtraction;
  stats: JobExtractionNormalizationStats;
}): JobExtractionConfidence {
  const requirementCount = args.output.requirements.length;
  const requiredCount = args.output.requirements.filter((item) => item.required).length;
  const hasHardSignals =
    args.output.licenses_or_certifications.length > 0 ||
    args.output.schedule_constraints.length > 0 ||
    Object.values(args.output.environment).some((value) => value !== null);

  if (requirementCount === 0) {
    return "low";
  }

  if (requirementCount < 2 && !hasHardSignals) {
    return "low";
  }

  if (requirementCount <= 3 && !hasHardSignals && requiredCount === 0) {
    return "low";
  }

  if (requirementCount >= 3 && hasHardSignals && requiredCount > 0) {
    return "high";
  }

  if (
    requirementCount <= 3 ||
    args.stats.removedGenericRequirementCount > 0
  ) {
    return "medium";
  }

  return "high";
}

export function calibrateJobExtractionConfidence(args: {
  output: NormalizedJobExtraction;
  stats: JobExtractionNormalizationStats;
}): JobExtractionConfidence {
  const modelRank = confidenceRank(args.output.confidence);
  const signalRank = confidenceRank(assessHeuristicSignalQuality(args));
  return confidenceFromRank(Math.min(modelRank, signalRank));
}
