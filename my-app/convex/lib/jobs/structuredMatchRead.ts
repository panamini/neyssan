import type { MatchRead, MatchReadTier } from "./matchRead";
import {
  NormalizedJobExtractionSchema,
  type JobRequirementType,
  type NormalizedJobExtraction,
} from "./jobExtractionSchema";
import { PROMPT_VERSION, resolveJobExtractionModel } from "./llmExtractJob";

export type RequirementCategory =
  | "title"
  | "role_alignment"
  | "license"
  | "certification"
  | "experience"
  | "skill"
  | "education"
  | "language"
  | "technology"
  | "tool"
  | "environment"
  | "communication"
  | "physical"
  | "availability";

export type EntityProvenance = {
  source: "heuristic" | "llm_shadow" | "manual" | "cv_document" | "profile_field";
  section?: string;
  sourceText: string;
  span?: { start: number; end: number };
};

export type JobRequirementEntity = {
  id: string;
  category: RequirementCategory;
  value: string;
  importance: "required" | "preferred" | "supporting";
  provenance: EntityProvenance;
  confidence: number;
  minYears?: number;
  maxYears?: number;
};

export type ProfileEvidenceEntity = {
  id: string;
  category: RequirementCategory;
  value: string;
  sourceSection: string;
  evidenceText: string;
  provenance: EntityProvenance;
  confidence: number;
  years?: number;
  dateRange?: { start?: string; end?: string };
};

export type ConstraintCategory =
  | "location"
  | "work_authorization"
  | "schedule"
  | "work_arrangement"
  | "compensation"
  | "availability"
  | "physical";

export type JobConstraintEntity = {
  id: string;
  category: ConstraintCategory;
  value: string;
  required: boolean;
  scoreDriving: boolean;
  provenance: EntityProvenance;
  confidence: number;
};

export type ProfileConstraintEntity = {
  id: string;
  category: ConstraintCategory;
  value: string;
  evidenceText: string;
  provenance: EntityProvenance;
  confidence: number;
};

export type StructuredOutcomeStatus =
  | "matched"
  | "partial"
  | "missing"
  | "unknown";

export type StructuredOutcome = {
  requirement: JobRequirementEntity;
  evidence?: ProfileEvidenceEntity;
  outcome: StructuredOutcomeStatus;
  reason: string;
};

export type StructuredMatchReadDebug = {
  old: Pick<MatchRead, "score" | "tier" | "matched" | "missing" | "method" | "fallback">;
  structured:
    | {
        status: "available";
        structuredScore: number;
        structuredTier: MatchReadTier;
        matched: StructuredOutcome[];
        partial: StructuredOutcome[];
        missing: StructuredOutcome[];
        unknown: StructuredOutcome[];
        jobRequirements: JobRequirementEntity[];
        jobConstraints: JobConstraintEntity[];
        profileEvidence: ProfileEvidenceEntity[];
        profileConstraints: ProfileConstraintEntity[];
      }
    | {
        status: "unavailable";
        reason: string;
      };
};

export type StructuredMatchReadShadowRow = {
  llm_normalized_output: unknown;
  validation_status?: string | null;
  fallback_used?: boolean | null;
  model?: string | null;
  prompt_version?: string | null;
  created_at?: number | null;
  _creationTime?: number | null;
};

type StructuredJobEntities = {
  requirements: JobRequirementEntity[];
  constraints: JobConstraintEntity[];
};

type EligibleStructuredExtraction = {
  normalizedOutput: NormalizedJobExtraction;
  row: StructuredMatchReadShadowRow;
};

const METADATA_VALUES = new Set([
  "location",
  "status",
  "compensation",
  "salary",
  "benefits",
  "company",
  "source",
  "platform",
  "apply",
  "application",
  "posted",
  "miami",
  "design",
  "district",
  "store",
  "part-time",
  "full-time",
]);

const METADATA_TEXT_RE =
  /\b(equal opportunity|eeo|privacy|cookie|cookies|terms of use|all rights reserved|apply now|share this job|save job|posted \d+|people clicked apply|kith treats|who we are|about the job|about the role|compensation|status:|location:)\b/i;
const LOCATION_OR_COMP_RE =
  /\b(location|compensation|salary|\$|remote|onsite|on-site|hybrid|miami|new york|paris|district)\b/i;
const SCHEDULE_RE = /\b(weekend|holiday|shift|schedule|availability|overnight|evening)\b/i;
const PHYSICAL_RE = /\b(stand|standing|lift|lifting|walk|bending|twisting|climbing|physical|25lbs|pounds)\b/i;
const WORK_AUTH_RE = /\b(work authorization|visa|authorized to work|sponsorship)\b/i;
const ENGLISH_TRANSLATION_RE =
  /\b(the role|this role|you will|you'll|will be responsible|requirements include|we are looking for|candidate will|must have|nice to have)\b/i;
const TOKEN_STOP_WORDS = new Set([
  "and",
  "are",
  "for",
  "has",
  "have",
  "into",
  "job",
  "role",
  "the",
  "this",
  "with",
  "years",
]);

function compactWhitespace(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function lowerCompact(value: unknown): string {
  return compactWhitespace(value).toLowerCase();
}

function dedupeByValue<T extends { value: string; category?: string }>(values: T[]): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const key = `${value.category ?? ""}:${lowerCompact(value.value)}`;
    if (!value.value || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}

function tokenize(value: string): string[] {
  return (lowerCompact(value).match(/[a-z0-9+#./-]{3,}/g) ?? []).filter(
    (token) => !TOKEN_STOP_WORDS.has(token),
  );
}

function isMetadataValue(value: string): boolean {
  const normalized = lowerCompact(value);
  return (
    !normalized ||
    METADATA_VALUES.has(normalized) ||
    METADATA_TEXT_RE.test(normalized) ||
    /^[-\d\s$.,/hr]+$/.test(normalized)
  );
}

function violatesKnownLanguageSignal(args: {
  rawLanguageDetected?: string | null;
  values: string[];
}): boolean {
  const language = lowerCompact(args.rawLanguageDetected);
  if (!language.startsWith("fr")) {
    return false;
  }
  return ENGLISH_TRANSLATION_RE.test(args.values.join(" "));
}

function confidenceForExtraction(output: NormalizedJobExtraction): number {
  if (output.confidence === "high") return 0.92;
  if (output.confidence === "medium") return 0.76;
  return 0.55;
}

function categoryFromRequirementType(
  type: JobRequirementType,
  value: string,
): RequirementCategory {
  const text = lowerCompact(value);
  if (/\blicen[cs]e|guard card|permit\b/.test(text)) return "license";
  if (type === "certification") return "certification";
  if (type === "education") return "education";
  if (type === "experience") return "experience";
  if (type === "language") return "language";
  if (type === "tool") return "tool";
  if (/\bcommunicat|customer|client|guest|visitor|crowd\b/.test(text)) {
    return "communication";
  }
  return "skill";
}

function constraintCategoryForValue(value: string): ConstraintCategory | null {
  if (PHYSICAL_RE.test(value)) return "physical";
  if (SCHEDULE_RE.test(value)) return "schedule";
  if (WORK_AUTH_RE.test(value)) return "work_authorization";
  if (LOCATION_OR_COMP_RE.test(value)) {
    return /\b(compensation|salary|\$)\b/i.test(value) ? "compensation" : "location";
  }
  return null;
}

function parseYearRange(value: string): { minYears?: number; maxYears?: number } {
  const range = value.match(/\b(\d+)\s*[-–—]\s*(\d+)\s+years?\b/i);
  if (range) {
    return { minYears: Number(range[1]), maxYears: Number(range[2]) };
  }
  const plus = value.match(/\b(\d+)\s*\+\s+years?\b/i);
  if (plus) {
    return { minYears: Number(plus[1]) };
  }
  return {};
}

function createJobRequirement(args: {
  id: string;
  category: RequirementCategory;
  value: string;
  importance: JobRequirementEntity["importance"];
  confidence: number;
  section: string;
}): JobRequirementEntity {
  return {
    id: args.id,
    category: args.category,
    value: compactWhitespace(args.value),
    importance: args.importance,
    provenance: {
      source: "llm_shadow",
      section: args.section,
      sourceText: compactWhitespace(args.value),
    },
    confidence: args.confidence,
    ...parseYearRange(args.value),
  };
}

function createJobConstraint(args: {
  id: string;
  category: ConstraintCategory;
  value: string;
  required?: boolean;
  confidence: number;
  section: string;
}): JobConstraintEntity {
  return {
    id: args.id,
    category: args.category,
    value: compactWhitespace(args.value),
    required: args.required ?? true,
    scoreDriving: false,
    provenance: {
      source: "llm_shadow",
      section: args.section,
      sourceText: compactWhitespace(args.value),
    },
    confidence: args.confidence,
  };
}

export function isStructuredMatchReadShadowEnabled(
  rawValue: string | undefined =
    process.env.STRUCTURED_MATCH_READ_SHADOW ??
    process.env.ENABLE_STRUCTURED_MATCH_READ_SHADOW,
): boolean {
  const normalized = lowerCompact(rawValue);
  return normalized === "1" || normalized === "true" || normalized === "on";
}

export function selectEligibleStructuredJobExtraction(args: {
  shadowRows?: StructuredMatchReadShadowRow[];
  model?: string;
  promptVersion?: string;
  rawLanguageDetected?: string | null;
}): EligibleStructuredExtraction | null {
  const model = args.model ?? resolveJobExtractionModel();
  const promptVersion = args.promptVersion ?? PROMPT_VERSION;
  const candidates = (args.shadowRows ?? [])
    .filter((row) => row.model === model)
    .filter((row) => row.prompt_version === promptVersion)
    .filter((row) => row.validation_status === "valid")
    .filter((row) => row.fallback_used === false)
    .map((row) => {
      const parsed = NormalizedJobExtractionSchema.safeParse(row.llm_normalized_output);
      return parsed.success ? { row, normalizedOutput: parsed.data } : null;
    })
    .filter((entry): entry is EligibleStructuredExtraction => entry !== null)
    .filter((entry) => {
      const values = [
        entry.normalizedOutput.summary_short,
        entry.normalizedOutput.role_title_normalized,
        ...entry.normalizedOutput.requirements.map((item) => item.value),
        ...entry.normalizedOutput.keywords_canonical,
      ];
      return !violatesKnownLanguageSignal({
        rawLanguageDetected: args.rawLanguageDetected,
        values,
      });
    })
    .sort((left, right) => {
      const leftCreated = left.row.created_at ?? left.row._creationTime ?? 0;
      const rightCreated = right.row.created_at ?? right.row._creationTime ?? 0;
      return rightCreated - leftCreated;
    });

  return candidates[0] ?? null;
}

function buildStructuredJobEntities(output: NormalizedJobExtraction): StructuredJobEntities {
  const requirements: JobRequirementEntity[] = [];
  const constraints: JobConstraintEntity[] = [];
  const confidence = confidenceForExtraction(output);

  if (!isMetadataValue(output.role_title_normalized)) {
    requirements.push(
      createJobRequirement({
        id: "job-title-0",
        category: "title",
        value: output.role_title_normalized,
        importance: "supporting",
        confidence,
        section: "role_title_normalized",
      }),
    );
  }

  output.requirements.forEach((requirement, index) => {
    const value = compactWhitespace(requirement.value);
    if (isMetadataValue(value)) {
      return;
    }

    const constraintCategory =
      requirement.type === "constraint" ? constraintCategoryForValue(value) ?? "availability" : constraintCategoryForValue(value);
    if (constraintCategory) {
      constraints.push(
        createJobConstraint({
          id: `job-requirement-constraint-${index}`,
          category: constraintCategory,
          value,
          required: requirement.required,
          confidence,
          section: "requirements",
        }),
      );
      return;
    }

    requirements.push(
      createJobRequirement({
        id: `job-requirement-${index}`,
        category: categoryFromRequirementType(requirement.type, value),
        value,
        importance: requirement.required ? "required" : "preferred",
        confidence,
        section: "requirements",
      }),
    );
  });

  output.licenses_or_certifications.forEach((value, index) => {
    if (isMetadataValue(value)) return;
    requirements.push(
      createJobRequirement({
        id: `job-license-certification-${index}`,
        category: /\blicen[cs]e|guard card|permit\b/i.test(value)
          ? "license"
          : "certification",
        value,
        importance: "required",
        confidence,
        section: "licenses_or_certifications",
      }),
    );
  });

  output.schedule_constraints.forEach((value, index) => {
    if (isMetadataValue(value)) return;
    constraints.push(
      createJobConstraint({
        id: `job-schedule-${index}`,
        category: "schedule",
        value,
        confidence,
        section: "schedule_constraints",
      }),
    );
  });

  if (output.environment.physical_standing === true) {
    constraints.push(
      createJobConstraint({
        id: "job-environment-physical-standing",
        category: "physical",
        value: "physical standing",
        confidence,
        section: "environment.physical_standing",
      }),
    );
  }
  if (output.environment.onsite === true) {
    constraints.push(
      createJobConstraint({
        id: "job-environment-onsite",
        category: "work_arrangement",
        value: "onsite",
        confidence,
        section: "environment.onsite",
      }),
    );
  }

  return {
    requirements: dedupeByValue(requirements),
    constraints: dedupeByValue(constraints),
  };
}

function getAuthoritativeNormalized(profile: unknown): Record<string, unknown> {
  const candidate = profile as Record<string, any>;
  return (
    candidate?.cvDocument?.metadata?.authoritativeResume?.normalized ??
    candidate?.cvDocument?.authoritativeResume?.normalized ??
    {}
  );
}

function collectText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return compactWhitespace(value);
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  if (Array.isArray(value)) {
    return compactWhitespace(value.map(collectText).filter(Boolean).join(" "));
  }
  const objectValue = value as Record<string, unknown>;
  if (typeof objectValue.text === "string") return compactWhitespace(objectValue.text);
  if (typeof objectValue.plainText === "string") return compactWhitespace(objectValue.plainText);
  return compactWhitespace(Object.values(objectValue).map(collectText).filter(Boolean).join(" "));
}

function toStringList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map((value) => {
    if (typeof value === "string") return compactWhitespace(value);
    if (value && typeof value === "object") {
      const candidate = value as Record<string, unknown>;
      return compactWhitespace(
        candidate.name ??
          candidate.language ??
          candidate.title ??
          candidate.text ??
          candidate.certificationName ??
          "",
      );
    }
    return "";
  }).filter(Boolean);
}

function pushEvidence(
  evidence: ProfileEvidenceEntity[],
  args: {
    category: RequirementCategory;
    value: unknown;
    sourceSection: string;
    source: EntityProvenance["source"];
    confidence: number;
    sourceText?: unknown;
    dateRange?: { start?: string; end?: string };
  },
) {
  const value = compactWhitespace(args.value);
  const evidenceText = compactWhitespace(args.sourceText ?? value);
  if (!value || !evidenceText || isMetadataValue(value)) {
    return;
  }

  evidence.push({
    id: `profile-evidence-${evidence.length}`,
    category: args.category,
    value,
    sourceSection: args.sourceSection,
    evidenceText,
    provenance: {
      source: args.source,
      section: args.sourceSection,
      sourceText: evidenceText,
    },
    confidence: args.confidence,
    ...(args.dateRange ? { dateRange: args.dateRange } : {}),
  });
}

function splitCoursework(value: unknown): string[] {
  const text = collectText(value);
  const curriculum = text.match(/course curriculum:\s*(.+)$/i)?.[1] ?? text;
  return curriculum
    .split(/[,;•\n]/g)
    .map(compactWhitespace)
    .filter((item) => item.length >= 3);
}

function pushExperienceEvidence(
  evidence: ProfileEvidenceEntity[],
  entry: Record<string, unknown>,
  source: EntityProvenance["source"],
) {
  const title = entry.title ?? entry.position;
  const company = entry.company;
  const description = collectText(
    entry.description ??
      entry.summary ??
      entry.responsibilities ??
      entry.responsibilityBullets,
  );
  const dateRange = {
    start: compactWhitespace(entry.startDate),
    end: compactWhitespace(entry.endDate),
  };

  pushEvidence(evidence, {
    category: "title",
    value: title,
    sourceSection: "experience_title",
    source,
    confidence: 0.95,
    sourceText: [title, company].filter(Boolean).join(" - "),
    dateRange,
  });
  pushEvidence(evidence, {
    category: "experience",
    value: company,
    sourceSection: "experience_company",
    source,
    confidence: 0.75,
    sourceText: [title, company].filter(Boolean).join(" - "),
    dateRange,
  });
  pushEvidence(evidence, {
    category: "skill",
    value: description,
    sourceSection: "experience_description",
    source,
    confidence: 0.9,
    sourceText: description,
    dateRange,
  });
}

export function buildStructuredProfileEvidence(profile: unknown): ProfileEvidenceEntity[] {
  const evidence: ProfileEvidenceEntity[] = [];
  const profileRecord = (profile ?? {}) as Record<string, unknown>;
  const normalized = getAuthoritativeNormalized(profileRecord);

  const desiredPosition = compactWhitespace(
    profileRecord.desiredPosition ??
      (profileRecord.profile as Record<string, unknown> | undefined)?.desiredPosition ??
      (normalized.profile as Record<string, unknown> | undefined)?.desiredPosition ??
      (normalized.contact as Record<string, unknown> | undefined)?.desiredPosition,
  );
  pushEvidence(evidence, {
    category: "role_alignment",
    value: desiredPosition,
    sourceSection: "desired_position",
    source: desiredPosition === profileRecord.desiredPosition ? "profile_field" : "cv_document",
    confidence: 0.45,
  });

  pushEvidence(evidence, {
    category: "role_alignment",
    value: profileRecord.headline ?? (normalized.basics as Record<string, unknown> | undefined)?.headline,
    sourceSection: "headline",
    source: "profile_field",
    confidence: 0.45,
  });
  pushEvidence(evidence, {
    category: "role_alignment",
    value: profileRecord.summary ?? normalized.summaryFirstSentence ?? normalized.summary,
    sourceSection: "summary",
    source: profileRecord.summary ? "profile_field" : "cv_document",
    confidence: 0.55,
  });

  for (const skill of [
    ...toStringList(profileRecord.skills),
    ...toStringList(normalized.skills),
  ]) {
    pushEvidence(evidence, {
      category: /\bcommunicat|customer|client|guest|visitor|crowd\b/i.test(skill)
        ? "communication"
        : "skill",
      value: skill,
      sourceSection: "skills",
      source: "profile_field",
      confidence: 0.86,
    });
  }

  for (const entry of [
    ...(Array.isArray(profileRecord.experience) ? profileRecord.experience : []),
    ...(Array.isArray(normalized.experience) ? normalized.experience : []),
  ]) {
    if (entry && typeof entry === "object") {
      pushExperienceEvidence(
        evidence,
        entry as Record<string, unknown>,
        (profileRecord.experience as unknown[])?.includes(entry) ? "profile_field" : "cv_document",
      );
    }
  }

  for (const entry of [
    ...(Array.isArray(profileRecord.education) ? profileRecord.education : []),
    ...(Array.isArray(normalized.education) ? normalized.education : []),
  ]) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    pushEvidence(evidence, {
      category: "education",
      value: item.degree ?? item.studyType,
      sourceSection: "education",
      source: "cv_document",
      confidence: 0.86,
      sourceText: collectText(item),
    });
    pushEvidence(evidence, {
      category: "education",
      value: item.fieldOfStudy ?? item.area,
      sourceSection: "education_field",
      source: "cv_document",
      confidence: 0.82,
      sourceText: collectText(item),
    });
    for (const course of splitCoursework(item.description ?? item.achievements)) {
      pushEvidence(evidence, {
        category: "skill",
        value: course,
        sourceSection: "education",
        source: "cv_document",
        confidence: 0.82,
        sourceText: collectText(item),
      });
    }
  }

  for (const certification of [
    ...toStringList(profileRecord.certifications),
    ...toStringList(profileRecord.certificates),
    ...toStringList(profileRecord.licenses),
    ...toStringList(normalized.certifications),
    ...toStringList(normalized.certificates),
    ...toStringList(normalized.licenses),
  ]) {
    pushEvidence(evidence, {
      category: /\blicen[cs]e|guard card|permit\b/i.test(certification)
        ? "license"
        : "certification",
      value: certification,
      sourceSection: "certifications",
      source: "cv_document",
      confidence: 0.92,
    });
  }

  for (const language of [
    ...toStringList(profileRecord.languages),
    ...toStringList(normalized.languages),
  ]) {
    pushEvidence(evidence, {
      category: "language",
      value: language,
      sourceSection: "languages",
      source: "cv_document",
      confidence: 0.8,
    });
  }

  for (const [section, values] of [
    ["projects", profileRecord.projects ?? normalized.projects],
    ["achievements", profileRecord.achievements ?? normalized.achievements],
    ["awards", profileRecord.awards ?? normalized.awards],
    ["publications", profileRecord.publications ?? normalized.publications],
    ["volunteer", profileRecord.volunteer ?? normalized.volunteer ?? normalized.volunteering],
  ] as const) {
    for (const value of toStringList(values)) {
      pushEvidence(evidence, {
        category: section === "publications" ? "communication" : "skill",
        value,
        sourceSection: section,
        source: "cv_document",
        confidence: 0.78,
      });
    }
  }

  const contact = normalized.contact as Record<string, unknown> | undefined;
  for (const value of [
    profileRecord.portfolio,
    profileRecord.website,
    contact?.portfolio,
    contact?.website,
  ]) {
    pushEvidence(evidence, {
      category: "tool",
      value,
      sourceSection: "portfolio",
      source: "cv_document",
      confidence: 0.72,
    });
  }

  pushEvidence(evidence, {
    category: "skill",
    value: profileRecord.raw_text ?? normalized.rawText ?? normalized.raw,
    sourceSection: "raw_text",
    source: "profile_field",
    confidence: 0.2,
  });

  return dedupeByValue(evidence);
}

function buildProfileConstraints(profile: unknown): ProfileConstraintEntity[] {
  const constraints: ProfileConstraintEntity[] = [];
  const profileRecord = (profile ?? {}) as Record<string, unknown>;
  const normalized = getAuthoritativeNormalized(profileRecord);
  const contact = normalized.contact as Record<string, unknown> | undefined;
  const location = compactWhitespace(
    profileRecord.location ??
      (profileRecord.contact as Record<string, unknown> | undefined)?.address ??
      contact?.location,
  );
  if (location) {
    constraints.push({
      id: "profile-constraint-location-0",
      category: "location",
      value: location,
      evidenceText: location,
      provenance: {
        source: profileRecord.location ? "profile_field" : "cv_document",
        section: "location",
        sourceText: location,
      },
      confidence: 0.78,
    });
  }
  return constraints;
}

function requirementWeight(requirement: JobRequirementEntity): number {
  if (requirement.importance === "required") return 1;
  if (requirement.importance === "preferred") return 0.5;
  return 0;
}

function resolveStructuredTier(score: number): MatchReadTier {
  if (score >= 75) return "strong";
  if (score >= 40) return "partial";
  return "weak";
}

function hasCertificationBridge(requirement: JobRequirementEntity, evidence: ProfileEvidenceEntity): boolean {
  if (
    !["license", "certification"].includes(requirement.category) ||
    !["license", "certification", "education"].includes(evidence.category)
  ) {
    return false;
  }
  const requirementTokens = new Set(tokenize(requirement.value));
  const evidenceTokens = new Set(tokenize(evidence.value));
  return (
    (requirementTokens.has("security") && evidenceTokens.has("security")) ||
    (requirementTokens.has("guard") && evidenceTokens.has("guard"))
  );
}

function synonymScore(requirement: JobRequirementEntity, evidence: ProfileEvidenceEntity): number {
  const requirementText = lowerCompact(requirement.value);
  const evidenceText = lowerCompact(`${evidence.value} ${evidence.evidenceText}`);
  if (/\bde[- ]?escalation\b/.test(requirementText) && /\bcrisis intervention\b/.test(evidenceText)) {
    return 0.55;
  }
  if (/\breport(?:ing| writing)?\b/.test(requirementText) && /\breport/.test(evidenceText)) {
    return 0.8;
  }
  if (/\bmonitor(?:ing)?|surveillance\b/.test(requirementText) && /\bmonitor|surveillance|cctv\b/.test(evidenceText)) {
    return 0.8;
  }
  if (/\binvestigation|investigat/.test(requirementText) && /\binvestigat|interviewing/.test(evidenceText)) {
    return 0.75;
  }
  return 0;
}

function categoryCompatible(requirement: JobRequirementEntity, evidence: ProfileEvidenceEntity): boolean {
  if (requirement.category === evidence.category) return true;
  if (requirement.category === "license" && evidence.category === "certification") return true;
  if (requirement.category === "certification" && evidence.category === "education") return true;
  if (requirement.category === "experience" && evidence.category === "title") return true;
  if (requirement.category === "communication" && evidence.category === "skill") return true;
  if (requirement.category === "skill" && evidence.category === "education") return true;
  return false;
}

function evidenceScore(requirement: JobRequirementEntity, evidence: ProfileEvidenceEntity): number {
  if (!categoryCompatible(requirement, evidence) && !hasCertificationBridge(requirement, evidence)) {
    return 0;
  }

  if (hasCertificationBridge(requirement, evidence)) {
    return 0.9;
  }

  const requirementTokens = tokenize(requirement.value);
  const evidenceTokens = new Set(tokenize(`${evidence.value} ${evidence.evidenceText}`));
  if (requirementTokens.length === 0) return 0;
  const overlap = requirementTokens.filter((token) => evidenceTokens.has(token)).length / requirementTokens.length;
  return Math.max(overlap, synonymScore(requirement, evidence));
}

function classifyOutcome(
  requirement: JobRequirementEntity,
  evidence: ProfileEvidenceEntity[],
): StructuredOutcome {
  const best = evidence
    .map((candidate) => ({ candidate, score: evidenceScore(requirement, candidate) }))
    .sort((left, right) => right.score - left.score)[0];

  if (best && best.score >= 0.75) {
    return {
      requirement,
      evidence: best.candidate,
      outcome: "matched",
      reason: `Concrete ${best.candidate.sourceSection} evidence matched ${requirement.category} requirement.`,
    };
  }

  if (best && best.score >= 0.4) {
    return {
      requirement,
      evidence: best.candidate,
      outcome: "partial",
      reason: `Concrete ${best.candidate.sourceSection} evidence partially supports ${requirement.category} requirement.`,
    };
  }

  return {
    requirement,
    evidence: undefined,
    outcome: "unknown",
    reason: "No concrete profile evidence was strong enough to classify a match or a real gap.",
  };
}

function scoreOutcomes(outcomes: StructuredOutcome[]): number {
  const scored = outcomes.filter((outcome) => requirementWeight(outcome.requirement) > 0);
  if (scored.length === 0) {
    return 0;
  }

  // Pass 3A shadow scoring is intentionally simple: required=1, preferred=0.5,
  // matched=full, partial=half, unknown=low neutral credit, missing=zero.
  // Supporting requirements are reported for diagnostics but do not affect score.
  let possible = 0;
  let earned = 0;
  for (const outcome of scored) {
    const weight = requirementWeight(outcome.requirement);
    possible += weight;
    if (outcome.outcome === "matched") earned += weight;
    if (outcome.outcome === "partial") earned += weight * 0.5;
    if (outcome.outcome === "unknown") earned += weight * 0.25;
  }

  return possible > 0 ? Math.round((earned / possible) * 100) : 0;
}

function oldDebugShape(
  old: MatchRead,
): StructuredMatchReadDebug["old"] {
  return {
    score: old.score,
    tier: old.tier,
    matched: old.matched,
    missing: old.missing,
    method: old.method,
    fallback: old.fallback,
  };
}

export function buildStructuredMatchReadDebug(args: {
  old: MatchRead;
  job: {
    id: string;
    rawLanguageDetected?: string | null;
  };
  profile: unknown;
  shadowRows?: StructuredMatchReadShadowRow[];
  model?: string;
  promptVersion?: string;
}): StructuredMatchReadDebug {
  const old = oldDebugShape(args.old);
  const eligible = selectEligibleStructuredJobExtraction({
    shadowRows: args.shadowRows,
    model: args.model,
    promptVersion: args.promptVersion,
    rawLanguageDetected: args.job.rawLanguageDetected,
  });

  if (!eligible) {
    return {
      old,
      structured: {
        status: "unavailable",
        reason: "no_valid_llm_extraction",
      },
    };
  }

  const jobEntities = buildStructuredJobEntities(eligible.normalizedOutput);
  if (jobEntities.requirements.length === 0) {
    return {
      old,
      structured: {
        status: "unavailable",
        reason: "no_score_safe_requirements",
      },
    };
  }

  const profileEvidence = buildStructuredProfileEvidence(args.profile);
  const profileConstraints = buildProfileConstraints(args.profile);
  const outcomes = jobEntities.requirements.map((requirement) =>
    classifyOutcome(requirement, profileEvidence),
  );
  const structuredScore = scoreOutcomes(outcomes);

  return {
    old,
    structured: {
      status: "available",
      structuredScore,
      structuredTier: resolveStructuredTier(structuredScore),
      matched: outcomes.filter((outcome) => outcome.outcome === "matched"),
      partial: outcomes.filter((outcome) => outcome.outcome === "partial"),
      missing: outcomes.filter((outcome) => outcome.outcome === "missing"),
      unknown: outcomes.filter((outcome) => outcome.outcome === "unknown"),
      jobRequirements: jobEntities.requirements,
      jobConstraints: jobEntities.constraints,
      profileEvidence,
      profileConstraints,
    },
  };
}
