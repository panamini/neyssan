import type { MatchRead, MatchReadTier } from "./matchRead";
import {
  NormalizedJobExtractionSchema,
  type JobRequirementType,
  type NormalizedJobExtraction,
} from "./jobExtractionSchema";
import { PROMPT_VERSION, resolveJobExtractionModel } from "./llmExtractJob";
import { isGenericRequirement } from "./normalizeJobExtraction";

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
  | "hard_gate_missing"
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
        hardGateMissing: StructuredOutcome[];
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

export type JobMatchReviewVerdict =
  | "strong_lead"
  | "possible_lead"
  | "probably_skip"
  | "not_enough_signal";

export type JobMatchReviewSuggestedNextStep =
  | "apply"
  | "apply_if_requirement_true"
  | "improve_profile_first"
  | "skip"
  | "review_manually";

export type JobMatchReviewRequirementSeverity =
  | "minor"
  | "important"
  | "blocking"
  | "unclear";

export type JobMatchReview = {
  verdict: JobMatchReviewVerdict;
  score: number;
  confidence: number;
  one_liner: string;
  why_this_may_interest_you: string[];
  watch_out: string[];
  suggested_next_step: JobMatchReviewSuggestedNextStep;
  missing_or_unclear_requirements: {
    requirement: string;
    severity: JobMatchReviewRequirementSeverity;
    reason: string;
  }[];
  evidence: {
    job_signal: string;
    profile_signal: string;
    explanation: string;
  }[];
};

type JobMatchReviewRequirement = JobMatchReview["missing_or_unclear_requirements"][number];

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
const STANDALONE_GENERIC_REQUIREMENT_FRAGMENTS = new Set([
  "ability",
  "lift",
  "more",
  "preferred",
  "valid",
]);

const METADATA_TEXT_RE =
  /\b(equal opportunity|eeo|privacy|cookie|cookies|terms of use|all rights reserved|apply now|share this job|save job|posted \d+|people clicked apply|source platform|kith treats|kith brand|brand story|company culture|our culture|company mission|mission statement|join our team|great place to work|why join|who we are|about the job|about the role|compensation|benefits package|employee discount|perks?|status:|location:)\b/i;
const LOCATION_OR_COMP_RE =
  /\b(location|compensation|salary|\$|remote|onsite|on-site|hybrid|miami|new york|paris|district)\b/i;
const SCHEDULE_RE = /\b(weekend|holiday|shift|schedule|availability|overnight|evening)\b/i;
const PHYSICAL_RE = /\b(stand|standing|lift|lifting|walk|bending|twisting|climbing|physical|25lbs|pounds)\b/i;
const WORK_AUTH_RE = /\b(work authorization|visa|authorized to work|sponsorship)\b/i;
const SOFT_PROCESS_REQUIREMENT_RE =
  /\b(attention to detail|detail[- ]oriented|follow(?:ing)? (?:style )?guides?|style guides?|accurately|accuracy|organized|self[- ]starter|fast[- ]paced|team player|positive attitude|reliable|dependable|work independently|multitask|multi-task|prioriti[sz]e|problem[- ]solving|adaptable|flexible|excellent communication|strong communication skills?)\b/i;
const ENGLISH_TRANSLATION_RE =
  /\b(the role|this role|you will|you'll|will be responsible|requirements include|we are looking for|candidate will|must have|nice to have)\b/i;
const FRENCH_SOURCE_SIGNAL_RE =
  /\b(poste|charge|support client|gestion|demandes|demande|suivi|candidat|candidature|francais|courant|avec|entrant|entrantes|traitement)\b/i;
const FRENCH_TO_ENGLISH_TRANSLATION_RE =
  /\b(customer support|support specialist|ticket management|incoming requests|fluent french|french fluency|customer-facing|tracking requests)\b/i;
const PARTIAL_SCORE_THRESHOLD = 35;
const DIRECTIONAL_ROLE_ALIGNMENT_SCORE_FLOOR = 24;
const DIRECTIONAL_NARRATIVE_ALIGNMENT_SCORE_FLOOR = 16;
const ROLE_FAMILY_MULTIPLE_SIGNAL_SCORE_FLOOR = 55;
const HIGH_UNKNOWN_COVERAGE_THRESHOLD = 0.4;
const MIN_MATCHED_SCORABLE_FOR_CONFIDENT_TIER = 2;
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
const MATCH_REVIEW_EMAIL_RE =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const MATCH_REVIEW_PHONE_RE =
  /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g;
const MATCH_REVIEW_UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const MATCH_REVIEW_DEBUG_PHRASE_RE = /\bmaps to profile evidence:?/gi;
const MATCH_REVIEW_NOISE_PHRASE_RE =
  /\bNo concrete profile evidence was strong enough[^.]*\.?/gi;
const MAX_ONE_LINER_CHARS = 120;
const MAX_REVIEW_REASON_CHARS = 80;
const MAX_REVIEW_CAUTION_CHARS = 100;

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
  return (lowerCompact(value).match(/[a-z0-9+#./-]{3,}/g) ?? [])
    .map((token) => token.replace(/^[./-]+|[./-]+$/g, ""))
    .filter((token) => token.length >= 3 && !TOKEN_STOP_WORDS.has(token));
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

function isStandaloneGenericRequirementFragment(value: string): boolean {
  const normalized = lowerCompact(value)
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (STANDALONE_GENERIC_REQUIREMENT_FRAGMENTS.has(normalized)) {
    return true;
  }

  const tokens = tokenize(value);
  return (
    tokens.length === 1 &&
    STANDALONE_GENERIC_REQUIREMENT_FRAGMENTS.has(tokens[0] ?? "")
  );
}

function isNonScorableRequirementValue(value: string): boolean {
  return (
    isMetadataValue(value) ||
    isGenericRequirement(value) ||
    isStandaloneGenericRequirementFragment(value)
  );
}

function requirementImportanceForValue(
  requirement: { required: boolean },
  value: string,
): JobRequirementEntity["importance"] {
  if (SOFT_PROCESS_REQUIREMENT_RE.test(value)) {
    return "supporting";
  }
  return requirement.required ? "required" : "preferred";
}

function violatesKnownLanguageSignal(args: {
  rawLanguageDetected?: string | null;
  values: string[];
}): boolean {
  const language = lowerCompact(args.rawLanguageDetected);
  if (!language.startsWith("fr")) {
    return false;
  }
  const combined = args.values.join(" ");
  if (ENGLISH_TRANSLATION_RE.test(combined)) {
    return true;
  }
  return (
    FRENCH_TO_ENGLISH_TRANSLATION_RE.test(combined) &&
    !FRENCH_SOURCE_SIGNAL_RE.test(combined)
  );
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
    if (isNonScorableRequirementValue(value)) {
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
        importance: requirementImportanceForValue(requirement, value),
        confidence,
        section: "requirements",
      }),
    );
  });

  output.licenses_or_certifications.forEach((value, index) => {
    if (isNonScorableRequirementValue(value)) return;
    const normalizedCredential = lowerCompact(value);
    const isAlreadyRepresented = requirements.some((requirement) => {
      if (!["license", "certification"].includes(requirement.category)) {
        return false;
      }
      const normalizedRequirement = lowerCompact(requirement.value);
      return (
        normalizedRequirement === normalizedCredential ||
        normalizedRequirement.includes(normalizedCredential) ||
        normalizedCredential.includes(normalizedRequirement)
      );
    });
    if (isAlreadyRepresented) return;
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
    if (isNonScorableRequirementValue(value)) return;
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

function toRichTextList(...values: unknown[]): string[] {
  const result: string[] = [];

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === "string" || typeof value === "number") {
      const text = compactWhitespace(value);
      if (text) result.push(text);
      return;
    }
    if (value && typeof value === "object") {
      const text = collectText(value);
      if (text) result.push(text);
    }
  };

  values.forEach(visit);
  return result;
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

function inferSupportEvidenceCategory(
  sourceSection: string,
  value: string,
): RequirementCategory {
  const text = lowerCompact(value);
  if (sourceSection === "publications") return "communication";
  if (sourceSection === "additional_information" && hasCredentialSignal(text)) {
    return /\blicen[cs]e|guard card|permit\b/i.test(text)
      ? "license"
      : "certification";
  }
  if (/\bcommunicat|customer|client|guest|visitor|crowd|stakeholder|presentation|writing|report\b/i.test(text)) {
    return "communication";
  }
  return "skill";
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
  pushEvidence(evidence, {
    category: "skill",
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
    ["projects", [profileRecord.projects, normalized.projects]],
    ["achievements", [profileRecord.achievements, normalized.achievements]],
    ["awards", [profileRecord.awards, normalized.awards]],
    ["publications", [profileRecord.publications, normalized.publications]],
    ["volunteer", [profileRecord.volunteer, normalized.volunteer, normalized.volunteering]],
    [
      "affiliations",
      [
        profileRecord.affiliations,
        profileRecord.professionalAffiliations,
        profileRecord.memberships,
        profileRecord.associations,
        normalized.affiliations,
        normalized.professionalAffiliations,
        normalized.memberships,
        normalized.associations,
      ],
    ],
    [
      "additional_information",
      [
        profileRecord.additional_information,
        profileRecord.additionalInformation,
        profileRecord.additionalInfo,
        normalized.additional_information,
        normalized.additionalInformation,
        normalized.additionalInfo,
      ],
    ],
  ] as const) {
    for (const value of toRichTextList(values)) {
      pushEvidence(evidence, {
        category: inferSupportEvidenceCategory(section, value),
        value,
        sourceSection: section,
        source: "cv_document",
        confidence:
          section === "projects"
            ? 0.86
            : section === "achievements"
              ? 0.82
              : section === "affiliations" || section === "additional_information"
                ? 0.65
                : 0.78,
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

function resolveStructuredTier(score: number, outcomes: StructuredOutcome[]): MatchReadTier {
  const requiredOutcomes = outcomes.filter(
    (outcome) =>
      outcome.requirement.importance === "required" &&
      requirementWeight(outcome.requirement) > 0,
  );
  const matchedRequiredCount = requiredOutcomes.filter(
    (outcome) => outcome.outcome === "matched",
  ).length;
  const matchedScorableCount = outcomes.filter(
    (outcome) =>
      outcome.outcome === "matched" &&
      requirementWeight(outcome.requirement) > 0,
  ).length;
  const matchedRequiredCoverage =
    requiredOutcomes.length > 0 ? matchedRequiredCount / requiredOutcomes.length : 0;

  if (
    score >= 90 &&
    matchedRequiredCoverage >= 0.67 &&
    matchedScorableCount >= 2
  ) {
    return "strong";
  }
  if (score >= 35) return "partial";
  return "weak";
}

function isCredentialRequirement(requirement: JobRequirementEntity): boolean {
  return ["license", "certification"].includes(requirement.category);
}

function isRegulatedCredentialRequirement(requirement: JobRequirementEntity): boolean {
  if (requirement.importance !== "required") {
    return false;
  }
  if (!["license", "certification"].includes(requirement.category)) {
    return false;
  }
  return /\b(medical assistant|nurs(?:e|ing)|rn|lpn|cna|emt|paramedic|phlebotom|pharmacy technician|radiolog|clinical|hipaa)\b/i.test(
    requirement.value,
  );
}

function hasCredentialSignal(value: string): boolean {
  return /\b(certif(?:ied|icate|ication)?|licen[cs](?:e|ed)?|permit|guard card|program|training|course|credential|qualification|cpo|cpop|socp)\b/i.test(
    value,
  );
}

function isStructuredCredentialEvidence(evidence: ProfileEvidenceEntity): boolean {
  if (evidence.sourceSection === "raw_text") {
    return false;
  }

  const text = `${evidence.value} ${evidence.evidenceText}`;
  return (
    ["license", "certification"].includes(evidence.category) ||
    evidence.sourceSection === "certifications" ||
    (evidence.category === "education" && hasCredentialSignal(text))
  );
}

function credentialRoleTokens(requirement: JobRequirementEntity): string[] {
  const credentialWords = new Set([
    "active",
    "applicable",
    "card",
    "certificate",
    "certification",
    "certified",
    "credential",
    "current",
    "license",
    "licensed",
    "licence",
    "licenced",
    "permit",
    "preferred",
    "program",
    "required",
    "training",
    "valid",
  ]);
  return tokenize(requirement.value).filter((token) => !credentialWords.has(token));
}

function credentialEvidenceScore(args: {
  requirement: JobRequirementEntity;
  evidence: ProfileEvidenceEntity;
  hasStructuredCredentialEvidence: boolean;
}): number | null {
  const { requirement, evidence, hasStructuredCredentialEvidence } = args;
  if (!isCredentialRequirement(requirement)) {
    return null;
  }

  const evidenceText = lowerCompact(`${evidence.value} ${evidence.evidenceText}`);
  const isRawText = evidence.sourceSection === "raw_text";
  const isStructuredCredential = isStructuredCredentialEvidence(evidence);

  if (isRawText && hasStructuredCredentialEvidence) {
    return 0;
  }
  if (!isRawText && !isStructuredCredential) {
    return 0;
  }
  if (!hasCredentialSignal(evidenceText)) {
    return 0;
  }

  const requirementText = lowerCompact(requirement.value);
  const requirementRoleTokens = credentialRoleTokens(requirement);
  const evidenceTokens = new Set(tokenize(evidenceText));
  const roleCoverage =
    requirementRoleTokens.length > 0
      ? requirementRoleTokens.filter((token) => evidenceTokens.has(token)).length /
        requirementRoleTokens.length
      : 0;
  const hasNearExactCredential = evidenceText.includes(requirementText);

  if (hasNearExactCredential) {
    return isStructuredCredential ? 0.95 : 0.7;
  }

  if (isStructuredCredential && roleCoverage >= 1) {
    return 0.9;
  }

  const isRelatedSecurityCredential =
    (requirementRoleTokens.includes("security") || requirementRoleTokens.includes("guard")) &&
    /\b(guard|protection|law enforcement|criminal justice|cpop|socp)\b/i.test(evidenceText);
  if (isStructuredCredential && roleCoverage >= 0.5 && isRelatedSecurityCredential) {
    return 0.65;
  }

  if (
    isRawText &&
    !hasStructuredCredentialEvidence &&
    roleCoverage >= 1
  ) {
    return 0.65;
  }

  return 0;
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
  if (
    /\b(computer|tablet|device|basic computer)\b/.test(requirementText) &&
    /\b(computer|tablet|smart devices?|cctv|app|equipment controls?|report(?:s|ing)?|recording information)\b/.test(evidenceText)
  ) {
    return 0.8;
  }
  if (
    /\bcommunicat|communication skills?\b/.test(requirementText) &&
    /\b(report writing|reports?|writing|interviewing|present(?:ing|ation)?|stakeholder|witness(?:es)?|signatures?|crisis intervention|de[- ]?escalation)\b/.test(evidenceText)
  ) {
    return 0.78;
  }
  if (
    /\b(high school|diploma|equivalent|ged)\b/.test(requirementText) &&
    /\b(bachelor|degree|college|university|criminal justice|high school|diploma|ged)\b/.test(evidenceText)
  ) {
    return 0.85;
  }
  if (
    /\bcustomer service|customer-facing|guest|visitor\b/.test(requirementText) &&
    /\b(customer service|customer-facing|client service|guest service|visitor support|front desk|hospitality|retail|sales|support|call center|cashier)\b/.test(evidenceText)
  ) {
    return 0.55;
  }
  return 0;
}

function categoryCompatible(requirement: JobRequirementEntity, evidence: ProfileEvidenceEntity): boolean {
  if (requirement.category === evidence.category) return true;
  if (requirement.category === "license" && evidence.category === "certification") return true;
  if (requirement.category === "certification" && evidence.category === "education") return true;
  if (
    requirement.category === "experience" &&
    (evidence.category === "title" || evidence.sourceSection === "experience_description")
  ) {
    return true;
  }
  if (
    requirement.category === "communication" &&
    (evidence.category === "skill" ||
      evidence.sourceSection === "experience_description" ||
      evidence.sourceSection === "education" ||
      evidence.sourceSection === "raw_text")
  ) {
    return true;
  }
  if (
    requirement.category === "education" &&
    (evidence.category === "education" ||
      evidence.sourceSection === "summary" ||
      evidence.sourceSection === "education" ||
      evidence.sourceSection === "raw_text")
  ) {
    return true;
  }
  if (
    requirement.category === "skill" &&
    (evidence.category === "education" ||
      evidence.sourceSection === "experience_description" ||
      evidence.sourceSection === "raw_text")
  ) {
    return true;
  }
  if (
    requirement.category === "tool" &&
    (["skill", "experience", "education", "communication", "tool"].includes(evidence.category) ||
      [
        "skills",
        "projects",
        "experience_description",
        "education",
        "achievements",
        "additional_information",
      ].includes(evidence.sourceSection))
  ) {
    return true;
  }
  return false;
}

function sourceSectionScoreCap(evidence: ProfileEvidenceEntity): number {
  switch (evidence.sourceSection) {
    case "experience_title":
    case "experience_description":
      return 0.95;
    case "experience_company":
      return 0.75;
    case "certifications":
      return 0.95;
    case "skills":
      return 0.86;
    case "education":
    case "education_field":
    case "achievements":
      return 0.82;
    case "projects":
      return 0.86;
    case "languages":
    case "awards":
    case "publications":
    case "volunteer":
      return 0.78;
    case "affiliations":
    case "additional_information":
      return 0.65;
    case "summary":
      return 0.55;
    case "desired_position":
    case "headline":
      return 0.45;
    case "raw_text":
      return 0.65;
    default:
      return Math.max(0, Math.min(1, evidence.confidence));
  }
}

function capEvidenceScore(score: number, evidence: ProfileEvidenceEntity): number {
  return Math.min(score, sourceSectionScoreCap(evidence));
}

function evidenceScore(
  requirement: JobRequirementEntity,
  evidence: ProfileEvidenceEntity,
  args: { hasStructuredCredentialEvidence: boolean },
): number {
  const credentialScore = credentialEvidenceScore({
    requirement,
    evidence,
    hasStructuredCredentialEvidence: args.hasStructuredCredentialEvidence,
  });
  if (credentialScore !== null) {
    return capEvidenceScore(credentialScore, evidence);
  }

  if (!categoryCompatible(requirement, evidence)) {
    return 0;
  }

  const requirementTokens = tokenize(requirement.value);
  const evidenceTokens = new Set(tokenize(`${evidence.value} ${evidence.evidenceText}`));
  if (requirementTokens.length === 0) return 0;
  const overlap = requirementTokens.filter((token) => evidenceTokens.has(token)).length / requirementTokens.length;
  return capEvidenceScore(
    Math.max(overlap, synonymScore(requirement, evidence)),
    evidence,
  );
}

function classifyOutcome(
  requirement: JobRequirementEntity,
  evidence: ProfileEvidenceEntity[],
): StructuredOutcome {
  const hasStructuredCredentialEvidence = evidence.some(isStructuredCredentialEvidence);
  const best = evidence
    .map((candidate) => ({
      candidate,
      score: evidenceScore(requirement, candidate, { hasStructuredCredentialEvidence }),
    }))
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

  if (isRegulatedCredentialRequirement(requirement)) {
    return {
      requirement,
      evidence: undefined,
      outcome: "hard_gate_missing",
      reason:
        "Required regulated credential has no matching license, certification, or equivalent credential evidence.",
    };
  }

  return {
    requirement,
    evidence: undefined,
    outcome: "unknown",
    reason: "No concrete profile evidence was strong enough to classify a match or a real gap.",
  };
}

function directionalFitFloor(outcomes: StructuredOutcome[]): number {
  const positiveSupporting = outcomes.filter(
    (outcome) =>
      outcome.requirement.importance === "supporting" &&
      (outcome.outcome === "matched" || outcome.outcome === "partial") &&
      outcome.evidence,
  );

  const hasConcreteRoleAlignment = positiveSupporting.some(
    (outcome) =>
      outcome.requirement.category === "title" &&
      ["experience_title", "desired_position"].includes(
        outcome.evidence?.sourceSection ?? "",
      ),
  );
  if (hasConcreteRoleAlignment) {
    return DIRECTIONAL_ROLE_ALIGNMENT_SCORE_FLOOR;
  }

  const hasNarrativeRoleAlignment = positiveSupporting.some(
    (outcome) =>
      outcome.requirement.category === "title" &&
      ["headline", "summary"].includes(outcome.evidence?.sourceSection ?? ""),
  );
  if (hasNarrativeRoleAlignment) {
    return DIRECTIONAL_NARRATIVE_ALIGNMENT_SCORE_FLOOR;
  }

  return 0;
}

function roleFamilyEvidenceScoreFloor(outcomes: StructuredOutcome[]): number {
  const hasHardGateMissing = outcomes.some(
    (outcome) => outcome.outcome === "hard_gate_missing",
  );
  if (hasHardGateMissing) {
    return 0;
  }

  const hasRoleFamilyOverlap = outcomes.some(
    (outcome) =>
      outcome.requirement.category === "title" &&
      (outcome.outcome === "matched" || outcome.outcome === "partial") &&
      outcome.evidence &&
      ["experience_title", "desired_position", "headline", "summary"].includes(
        outcome.evidence.sourceSection,
      ),
  );
  if (!hasRoleFamilyOverlap) {
    return 0;
  }

  const positiveScorableEvidenceCount = outcomes.filter(
    (outcome) =>
      requirementWeight(outcome.requirement) > 0 &&
      outcome.requirement.category !== "title" &&
      (outcome.outcome === "matched" || outcome.outcome === "partial") &&
      outcome.evidence,
  ).length;

  if (positiveScorableEvidenceCount >= 2) {
    return ROLE_FAMILY_MULTIPLE_SIGNAL_SCORE_FLOOR;
  }
  return 0;
}

function scoreOutcomes(outcomes: StructuredOutcome[]): number {
  const scored = outcomes.filter((outcome) => requirementWeight(outcome.requirement) > 0);
  const fitFloor = Math.max(
    directionalFitFloor(outcomes),
    roleFamilyEvidenceScoreFloor(outcomes),
  );
  if (scored.length === 0) {
    return fitFloor;
  }

  // Pass 3A shadow scoring is intentionally simple: required=1, preferred=0.5,
  // matched=full, partial=half, unknown/missing=zero.
  // Supporting requirements are reported for diagnostics but do not affect score.
  let possible = 0;
  let earned = 0;
  for (const outcome of scored) {
    const weight = requirementWeight(outcome.requirement);
    possible += weight;
    if (outcome.outcome === "matched") earned += weight;
    if (outcome.outcome === "partial") earned += weight * 0.5;
  }

  const rawScore = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  const hasHardGateMissing = scored.some(
    (outcome) => outcome.outcome === "hard_gate_missing",
  );
  const matchedScorableCount = scored.filter(
    (outcome) => outcome.outcome === "matched",
  ).length;
  const unknownScorableCount = scored.filter(
    (outcome) => outcome.outcome === "unknown",
  ).length;
  const hasMatchedCredentialEvidence = scored.some(
    (outcome) =>
      outcome.outcome === "matched" &&
      ["license", "certification"].includes(outcome.requirement.category),
  );
  const unknownCoverage = unknownScorableCount / scored.length;
  let cappedScore = rawScore;

  if (hasHardGateMissing) {
    cappedScore = Math.min(cappedScore, PARTIAL_SCORE_THRESHOLD - 1);
  }

  if (
    unknownCoverage >= HIGH_UNKNOWN_COVERAGE_THRESHOLD &&
    matchedScorableCount < MIN_MATCHED_SCORABLE_FOR_CONFIDENT_TIER &&
    !hasMatchedCredentialEvidence
  ) {
    cappedScore = Math.min(cappedScore, PARTIAL_SCORE_THRESHOLD - 1);
  }

  if (
    scored.length < MIN_MATCHED_SCORABLE_FOR_CONFIDENT_TIER ||
    matchedScorableCount < MIN_MATCHED_SCORABLE_FOR_CONFIDENT_TIER
  ) {
    cappedScore = Math.min(cappedScore, 70);
  }
  if (unknownCoverage >= HIGH_UNKNOWN_COVERAGE_THRESHOLD) {
    cappedScore = Math.min(cappedScore, 70);
  }

  return Math.max(cappedScore, fitFloor);
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

function dedupeOutcomeValues(outcomes: StructuredOutcome[]): string[] {
  const values: string[] = [];
  const seen = new Set<string>();

  for (const outcome of outcomes) {
    const value = compactWhitespace(outcome.requirement.value);
    const key = lowerCompact(value);
    if (!value || seen.has(key)) {
      continue;
    }
    seen.add(key);
    values.push(value);
  }

  return values;
}

export function buildVisibleMatchReadFromStructuredDebug(args: {
  pendingMatchRead: MatchRead;
  debug: StructuredMatchReadDebug;
  now?: number;
}): MatchRead {
  if (args.debug.structured.status !== "available") {
    return args.pendingMatchRead;
  }

  const structured = args.debug.structured;
  const matched = dedupeOutcomeValues([
    ...structured.matched,
    ...structured.partial,
  ]);
  const missing = dedupeOutcomeValues([
    ...structured.missing,
    ...structured.hardGateMissing,
    ...structured.unknown.filter(
      (outcome) => outcome.requirement.importance !== "supporting",
    ),
  ]);
  const positiveCount = structured.matched.length + structured.partial.length;
  const blockingCount = structured.missing.length + structured.hardGateMissing.length;
  const confidence: MatchRead["confidence"] =
    positiveCount >= 3 && blockingCount === 0
      ? "high"
      : positiveCount > 0
        ? "medium"
        : "low";

  return {
    ...args.pendingMatchRead,
    tier: structured.structuredTier,
    score: structured.structuredScore,
    scoreVisible: true,
    confidence,
    matched,
    missing,
    computedAt: args.now ?? Date.now(),
    method: "llm",
    fallback: "none",
  };
}

type AvailableStructuredMatchDebug = Extract<
  StructuredMatchReadDebug["structured"],
  { status: "available" }
>;

function clampReviewScore(value: number | null | undefined): number {
  return Math.max(0, Math.min(100, Math.round(Number(value ?? 0) || 0)));
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function uniqueByRequirementValue(outcomes: StructuredOutcome[]): StructuredOutcome[] {
  const result: StructuredOutcome[] = [];
  const seen = new Set<string>();
  for (const outcome of outcomes) {
    const key = lowerCompact(outcome.requirement.value);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(outcome);
  }
  return result;
}

function hasProfileEvidenceForReview(
  structured: AvailableStructuredMatchDebug,
): boolean {
  return structured.profileEvidence.length > 0;
}

function verdictForTier(tier: MatchReadTier): JobMatchReviewVerdict {
  switch (tier) {
    case "strong":
      return "strong_lead";
    case "partial":
      return "possible_lead";
    case "weak":
      return "probably_skip";
    case "unknown":
      return "not_enough_signal";
  }
}

function oneLinerForTier(tier: MatchReadTier): string {
  switch (tier) {
    case "strong":
      return "Strong match. Clear overlap.";
    case "partial":
      return "Partial match. A few checks left.";
    case "weak":
      return "Weak match. Limited overlap.";
    case "unknown":
      return "Not enough signal.";
  }
}

function reviewTierForStructured(
  structured: AvailableStructuredMatchDebug,
): MatchReadTier {
  if (!hasProfileEvidenceForReview(structured)) {
    return "unknown";
  }

  const hasAnyScorableRequirement = [
    ...structured.matched,
    ...structured.partial,
    ...structured.missing,
    ...structured.hardGateMissing,
    ...structured.unknown,
  ].some((outcome) => requirementWeight(outcome.requirement) > 0);
  if (!hasAnyScorableRequirement) {
    return "unknown";
  }

  return structured.structuredTier;
}

function stripSensitiveVisibleText(value: string): string {
  return compactWhitespace(value)
    .replace(MATCH_REVIEW_EMAIL_RE, "")
    .replace(MATCH_REVIEW_PHONE_RE, "")
    .replace(MATCH_REVIEW_UUID_RE, "")
    .replace(MATCH_REVIEW_NOISE_PHRASE_RE, "Not enough signal.")
    .replace(MATCH_REVIEW_DEBUG_PHRASE_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateVisibleText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const slice = value.slice(0, maxLength).trimEnd();
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace <= maxLength * 0.6) {
    return slice;
  }
  return slice.slice(0, lastSpace).trimEnd();
}

function sanitizeVisibleMatchReviewText(
  value: string,
  maxLength: number,
): string {
  return truncateVisibleText(stripSensitiveVisibleText(value), maxLength);
}

function capitalizeFirst(value: string): string {
  if (!value) {
    return value;
  }
  return value[0].toUpperCase() + value.slice(1);
}

function summarizeRequirementForUser(value: string): string {
  const cleaned = stripSensitiveVisibleText(value)
    .replace(/\b(preferred|required|optional|desired|nice to have)\b/gi, "")
    .replace(/\b(profile|resume|evidence)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  return capitalizeFirst(truncateVisibleText(cleaned, 48));
}

function evidenceSuffixForRequirement(outcome: StructuredOutcome): string {
  if (
    outcome.requirement.category === "license" ||
    outcome.requirement.category === "certification" ||
    outcome.requirement.category === "education" ||
    outcome.requirement.category === "language"
  ) {
    return outcome.outcome === "partial" ? "mostly matches." : "is covered.";
  }

  return outcome.outcome === "partial" ? "mostly overlaps." : "overlaps.";
}

function formatVisibleEvidenceForUser(outcome: StructuredOutcome): string {
  const label = summarizeRequirementForUser(outcome.requirement.value);
  if (!label) {
    return "";
  }

  return sanitizeVisibleMatchReviewText(
    `${label} ${evidenceSuffixForRequirement(outcome)}`,
    MAX_REVIEW_REASON_CHARS,
  );
}

function formatRequirementCautionForUser(
  item: JobMatchReviewRequirement,
): string {
  const label = summarizeRequirementForUser(item.requirement);
  if (!label) {
    return "";
  }

  const isCredentialLike = /\b(license|credential|certif|permit|guard card)\b/i.test(
    label,
  );
  const summary = isCredentialLike
    ? `${label} unclear.`
    : item.severity === "blocking"
      ? `${label} may block.`
      : `${label} evidence is light.`;

  return sanitizeVisibleMatchReviewText(summary, MAX_REVIEW_CAUTION_CHARS);
}

function severityForUnresolvedOutcome(
  outcome: StructuredOutcome,
): JobMatchReviewRequirementSeverity {
  if (outcome.outcome === "hard_gate_missing") {
    return "blocking";
  }
  if (
    outcome.requirement.importance === "required" &&
    isCredentialRequirement(outcome.requirement)
  ) {
    return "important";
  }
  if (outcome.requirement.importance === "required") {
    return "unclear";
  }
  if (isCredentialRequirement(outcome.requirement)) {
    return "unclear";
  }
  return "minor";
}

function reasonForUnresolvedOutcome(outcome: StructuredOutcome): string {
  if (outcome.outcome === "hard_gate_missing") {
    return formatRequirementCautionForUser({
      requirement: outcome.requirement.value,
      severity: "blocking",
      reason: outcome.reason,
    });
  }
  if (isCredentialRequirement(outcome.requirement)) {
    return formatRequirementCautionForUser({
      requirement: outcome.requirement.value,
      severity:
        outcome.requirement.importance === "required" ? "important" : "unclear",
      reason: outcome.reason,
    });
  }
  return formatRequirementCautionForUser({
    requirement: outcome.requirement.value,
    severity: outcome.requirement.importance === "required" ? "unclear" : "minor",
    reason: outcome.reason,
  });
}

function buildMissingOrUnclearRequirements(
  structured: AvailableStructuredMatchDebug,
): JobMatchReview["missing_or_unclear_requirements"] {
  return uniqueByRequirementValue([
    ...structured.hardGateMissing,
    ...structured.missing,
    ...structured.unknown.filter(
      (outcome) => outcome.requirement.importance !== "supporting",
    ),
  ]).map((outcome) => ({
    requirement: outcome.requirement.value,
    severity: severityForUnresolvedOutcome(outcome),
    reason: reasonForUnresolvedOutcome(outcome),
  }));
}

function buildReviewEvidence(
  structured: AvailableStructuredMatchDebug,
): JobMatchReview["evidence"] {
  return uniqueByRequirementValue([...structured.matched, ...structured.partial])
    .filter((outcome) => outcome.evidence)
    .map((outcome) => ({
      job_signal: outcome.requirement.value,
      profile_signal: sanitizeVisibleMatchReviewText(
        outcome.evidence?.evidenceText ?? "",
        MAX_REVIEW_REASON_CHARS,
      ),
      explanation: sanitizeVisibleMatchReviewText(
        outcome.reason,
        MAX_REVIEW_REASON_CHARS,
      ),
    }));
}

function buildWhyThisMayInterestYou(
  evidence: StructuredOutcome[],
): string[] {
  return evidence
    .map((outcome) => formatVisibleEvidenceForUser(outcome))
    .filter(Boolean)
    .slice(0, 3);
}

function buildWatchOut(
  missingOrUnclear: JobMatchReview["missing_or_unclear_requirements"],
): string[] {
  const priority: Record<JobMatchReviewRequirementSeverity, number> = {
    blocking: 0,
    important: 1,
    unclear: 2,
    minor: 3,
  };
  return [...missingOrUnclear]
    .sort((left, right) => priority[left.severity] - priority[right.severity])
    .map((item) => formatRequirementCautionForUser(item))
    .slice(0, 2);
}

function confidenceForJobMatchReview(args: {
  tier: MatchReadTier;
  structured: AvailableStructuredMatchDebug;
  missingOrUnclear: JobMatchReview["missing_or_unclear_requirements"];
}): number {
  const evidenceCount = args.structured.matched.length + args.structured.partial.length;
  const unresolvedCount =
    args.structured.missing.length +
    args.structured.hardGateMissing.length +
    args.structured.unknown.length;
  const total = evidenceCount + unresolvedCount;
  const evidenceRatio = total > 0 ? evidenceCount / total : 0;
  const hasBlocking = args.missingOrUnclear.some(
    (item) => item.severity === "blocking",
  );
  const base =
    args.tier === "strong"
      ? 0.82
      : args.tier === "partial"
        ? 0.65
        : args.tier === "weak"
          ? 0.5
          : 0.25;

  return Number(
    clampConfidence(
      base + evidenceRatio * 0.12 - (hasBlocking ? 0.14 : 0),
    ).toFixed(2),
  );
}

function suggestedNextStepForReview(args: {
  tier: MatchReadTier;
  missingOrUnclear: JobMatchReview["missing_or_unclear_requirements"];
}): JobMatchReviewSuggestedNextStep {
  if (args.tier === "unknown") return "review_manually";

  const hasBlocking = args.missingOrUnclear.some(
    (item) => item.severity === "blocking",
  );
  if (hasBlocking) {
    return "improve_profile_first";
  }

  const hasCredentialOrImportantUncertainty = args.missingOrUnclear.some(
    (item) =>
      item.severity === "important" ||
      (item.severity === "unclear" &&
        /\b(licen[cs]e|guard card|permit|certif|credential)\b/i.test(
          item.requirement,
        )),
  );
  if (hasCredentialOrImportantUncertainty) {
    return "apply_if_requirement_true";
  }

  if (args.tier === "strong") return "apply";
  if (args.tier === "partial") return "apply";
  return "review_manually";
}

function unavailableJobMatchReview(): JobMatchReview {
  return {
    verdict: "not_enough_signal",
    score: 0,
    confidence: 0,
    one_liner: oneLinerForTier("unknown"),
    why_this_may_interest_you: [],
    watch_out: [],
    suggested_next_step: "review_manually",
    missing_or_unclear_requirements: [],
    evidence: [],
  };
}

export function buildJobMatchReviewFromStructuredDebug(
  debug: StructuredMatchReadDebug,
): JobMatchReview {
  if (debug.structured.status !== "available") {
    return unavailableJobMatchReview();
  }

  const structured = debug.structured;
  const score = clampReviewScore(structured.structuredScore);
  const tier = reviewTierForStructured(structured);
  if (tier === "unknown") {
    return unavailableJobMatchReview();
  }
  const verdict = verdictForTier(tier);
  const missingOrUnclear = buildMissingOrUnclearRequirements(structured);
  const evidence = buildReviewEvidence(structured);
  const watchOut = buildWatchOut(missingOrUnclear);

  return {
    verdict,
    score,
    confidence: confidenceForJobMatchReview({
      tier,
      structured,
      missingOrUnclear,
    }),
    one_liner: sanitizeVisibleMatchReviewText(
      oneLinerForTier(tier),
      MAX_ONE_LINER_CHARS,
    ),
    why_this_may_interest_you: buildWhyThisMayInterestYou([
      ...structured.matched,
      ...structured.partial,
    ]),
    watch_out: watchOut,
    suggested_next_step: suggestedNextStepForReview({
      tier,
      missingOrUnclear,
    }),
    missing_or_unclear_requirements: missingOrUnclear,
    evidence,
  };
}

export function buildStructuredPendingMatchRead(args: {
  jobId: string;
  profileId?: string | null;
  now?: number;
}): MatchRead {
  return {
    tier: "unknown",
    score: null,
    scoreVisible: false,
    confidence: "low",
    matched: [],
    missing: [],
    basedOn: {
      profileId: String(args.profileId ?? ""),
      profileLabel: "Your profile",
      jobId: args.jobId,
    },
    computedAt: args.now ?? Date.now(),
    method: "llm",
    fallback: "structured_pending",
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
      structuredTier: resolveStructuredTier(structuredScore, outcomes),
      matched: outcomes.filter((outcome) => outcome.outcome === "matched"),
      partial: outcomes.filter((outcome) => outcome.outcome === "partial"),
      missing: outcomes.filter((outcome) => outcome.outcome === "missing"),
      hardGateMissing: outcomes.filter(
        (outcome) => outcome.outcome === "hard_gate_missing",
      ),
      unknown: outcomes.filter((outcome) => outcome.outcome === "unknown"),
      jobRequirements: jobEntities.requirements,
      jobConstraints: jobEntities.constraints,
      profileEvidence,
      profileConstraints,
    },
  };
}
