import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

import {
  type CanonicalUserProfile,
  ensureCanonicalProfileForClerk,
  getPrimaryProfileForClerk,
  listProfilesForClerk,
  resolveCanonicalProfileKeywordsForWrite,
} from "./lib/userProfiles";
import { buildScoringProfileFieldsFromCvDocument } from "./profiles";
import {
  buildCanonicalJobDraftFromSource,
  buildNormalizedJobExtractionFromHeuristic,
  flattenExtractionValues,
  type CanonicalJobExtraction,
  resolveReparsedCompany,
  resolveReparsedLocation,
  resolveCanonicalJobReviewState,
  resolveReviewItemsAfterApprove,
  resolveReviewItemsAfterFieldUpdate,
} from "./lib/jobs/canonicalJobs";
import {
  buildMatchReadProfile,
  computeMatchRead,
  resolveMatchReadSourceProfile,
  resolveResumeProfileById,
  resolveStoredResumeSelection,
  type MatchRead,
  type MatchReadResumeProfile,
  type MatchReadTier,
} from "./lib/jobs/matchRead";
import { buildJobsMetricArgs } from "./lib/jobs/telemetry";
import {
  extractJobStructuredWithMetadata,
  hashNormalizedJobText,
  isJobLlmExtractionShadowEnabled,
  PROMPT_VERSION,
  resolveJobExtractionModel,
} from "./lib/jobs/llmExtractJob";
import {
  isJobLlmVisibleExtractionEnabled,
  selectVisibleJobExtraction,
  type VisibleJobExtractionSelection,
} from "./lib/jobs/visibleJobExtraction";
import {
  buildJobMatchReviewFromStructuredDebug,
  buildVisibleMatchReadFromStructuredDebug,
  buildStructuredPendingMatchRead,
  buildStructuredMatchReadDebug,
  isStructuredMatchReadShadowEnabled,
  type JobMatchReview,
  type StructuredMatchReadDebug,
} from "./lib/jobs/structuredMatchRead";
import {
  STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS,
  STRUCTURED_MATCH_REVIEW_LABELS,
  STRUCTURED_MATCH_REVIEW_SCORER_VERSION,
  type StructuredMatchReviewExtractionVerdict,
  type StructuredMatchReviewLabel,
} from "./lib/jobs/structuredMatchReview";
import { buildLiveMatchReviewRecord } from "./lib/jobs/liveMatchReviewExport";

const COHORT_MIN_TOTAL_DECISIONS = 500;
const FEATURE_COHORT_NEXT_STEPS = false;
const jobExtractionShadowValidationStatus = v.union(
  v.literal("valid"),
  v.literal("invalid_json"),
  v.literal("schema_invalid"),
  v.literal("empty_signal"),
  v.literal("low_confidence"),
);
// PRD gate: switch cohort language only after >=500 job_decision_made events.
// Local safety rail: also require >=10 decisions inside the current match tier.
const COHORT_MIN_TIER_DECISIONS = 10;
const NEXT_STEP_FALLBACK_ACTION_ORDER = [
  "cover_letter",
  "resume",
  "save_for_later",
] as const;
const STRUCTURED_MATCH_READ_INTERNAL_VIEWERS_ENV =
  "STRUCTURED_MATCH_READ_INTERNAL_VIEWERS";
const STRUCTURED_MATCH_READ_INTERNAL_EMAILS_ENV =
  "STRUCTURED_MATCH_READ_INTERNAL_EMAILS";
const STRUCTURED_MATCH_READ_INTERNAL_UI_ENV =
  "STRUCTURED_MATCH_READ_INTERNAL_UI";
const STRUCTURED_MATCH_READ_ADVISORY_BETA_ENV =
  "STRUCTURED_MATCH_READ_ADVISORY_BETA";
const STRUCTURED_MATCH_READ_ADVISORY_BETA_ALL_ENV =
  "STRUCTURED_MATCH_READ_ADVISORY_BETA_ALL";
const STRUCTURED_MATCH_READ_BETA_VIEWERS_ENV =
  "STRUCTURED_MATCH_READ_BETA_VIEWERS";
const STRUCTURED_MATCH_REVIEW_APP_GIT_COMMIT_SHA_ENV_KEYS = [
  "STRUCTURED_MATCH_REVIEW_APP_GIT_COMMIT_SHA",
  "APP_GIT_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_SHA",
  "GIT_COMMIT_SHA",
  "VITE_GIT_COMMIT_SHA",
] as const;
const STRUCTURED_DEBUG_METADATA_VALUES = new Set([
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
const STRUCTURED_DEBUG_METADATA_RE =
  /\b(equal opportunity|apply now|compensation|salary|benefits|posted|source platform|status:|location:|privacy|cookie)\b/i;

type StructuredShadowSummary = {
  flagEnabled: boolean;
  internalViewer: boolean;
  uiEnabled: boolean;
  advisoryBetaEnabled: boolean;
  advisoryBetaViewer: boolean;
  status: "available" | "unavailable";
  reason: string | null;
  oldScore: number | null;
  oldTier: MatchReadTier;
  structuredScore: number | null;
  structuredTier: MatchReadTier | null;
  matchedCount: number;
  partialCount: number;
  missingCount: number;
  unknownCount: number;
  hardGateMissingCount: number;
  metadataLeakCount: number;
  languagePreserved: boolean;
  provenanceComplete: boolean;
  jobRequirementCount: number;
  jobConstraintCount: number;
  profileEvidenceCount: number;
  profileConstraintCount: number;
};

type StructuredInternalIdentity = {
  subject?: string | null;
  email?: string | null;
  tokenIdentifier?: string | null;
};

const structuredMatchTierValidator = v.union(
  v.literal("strong"),
  v.literal("partial"),
  v.literal("weak"),
  v.literal("unknown"),
);

const structuredShadowSummaryValidator = v.object({
  flagEnabled: v.boolean(),
  internalViewer: v.boolean(),
  uiEnabled: v.boolean(),
  advisoryBetaEnabled: v.boolean(),
  advisoryBetaViewer: v.boolean(),
  status: v.union(v.literal("available"), v.literal("unavailable")),
  reason: v.union(v.string(), v.null()),
  oldScore: v.union(v.number(), v.null()),
  oldTier: structuredMatchTierValidator,
  structuredScore: v.union(v.number(), v.null()),
  structuredTier: v.union(structuredMatchTierValidator, v.null()),
  matchedCount: v.number(),
  partialCount: v.number(),
  missingCount: v.number(),
  unknownCount: v.number(),
  hardGateMissingCount: v.number(),
  metadataLeakCount: v.number(),
  languagePreserved: v.boolean(),
  provenanceComplete: v.boolean(),
  jobRequirementCount: v.number(),
  jobConstraintCount: v.number(),
  profileEvidenceCount: v.number(),
  profileConstraintCount: v.number(),
});

const jobMatchReviewValidator = v.object({
  verdict: v.union(
    v.literal("strong_lead"),
    v.literal("possible_lead"),
    v.literal("probably_skip"),
    v.literal("not_enough_signal"),
  ),
  score: v.number(),
  confidence: v.number(),
  one_liner: v.string(),
  why_this_may_interest_you: v.array(v.string()),
  watch_out: v.array(v.string()),
  suggested_next_step: v.union(
    v.literal("apply"),
    v.literal("apply_if_requirement_true"),
    v.literal("improve_profile_first"),
    v.literal("skip"),
    v.literal("review_manually"),
  ),
  missing_or_unclear_requirements: v.array(
    v.object({
      requirement: v.string(),
      severity: v.union(
        v.literal("minor"),
        v.literal("important"),
        v.literal("blocking"),
        v.literal("unclear"),
      ),
      reason: v.string(),
    }),
  ),
  evidence: v.array(
    v.object({
      job_signal: v.string(),
      profile_signal: v.string(),
      explanation: v.string(),
    }),
  ),
});

const structuredMatchReviewLabelValidator = v.union(
  v.literal("good"),
  v.literal("acceptable but conservative"),
  v.literal("false weak"),
  v.literal("false strong"),
  v.literal("overmatched"),
  v.literal("undermatched"),
  v.literal("evidence missing"),
  v.literal("language issue"),
  v.literal("metadata leak"),
  v.literal("hard-gate issue"),
);

const structuredMatchReviewExtractionVerdictValidator = v.union(
  v.literal("good"),
  v.literal("too_vague"),
  v.literal("wrong_focus"),
  v.literal("noisy"),
  v.literal("incomplete"),
  v.literal("metadata_leak"),
  v.literal("wrong_language"),
);

const liveMatchReviewHumanLabelValidator = v.union(
  v.literal("makes_sense"),
  v.literal("too_harsh"),
  v.literal("too_generous"),
  v.literal("wrong_reason"),
  v.literal("credential_wrong"),
  v.literal("unsafe_or_leaky"),
  v.literal("not_enough_signal_correct"),
  v.literal("not_enough_signal_wrong"),
);

const liveMatchReviewFailureTypeValidator = v.union(
  v.literal("false_zero"),
  v.literal("dangerous_overmatch"),
  v.literal("credential_hallucination"),
  v.literal("preferred_as_blocker"),
  v.literal("generic_fragment_leak"),
  v.literal("raw_evidence_leak"),
  v.literal("verdict_reason_contradiction"),
  v.literal("bad_next_step"),
  v.literal("no_signal_misclassified"),
  v.literal("too_harsh"),
  v.literal("too_generous"),
  v.literal("unclear_copy"),
);

const liveMatchReviewRecordValidator = v.object({
  jobId: v.string(),
  jobTitle: v.string(),
  company: v.union(v.string(), v.null()),
  profileLabel: v.union(v.string(), v.null()),
  tier: v.union(
    v.literal("strong"),
    v.literal("partial"),
    v.literal("weak"),
    v.literal("unknown"),
  ),
  verdict: v.union(
    v.literal("strong_lead"),
    v.literal("possible_lead"),
    v.literal("probably_skip"),
    v.literal("not_enough_signal"),
  ),
  score: v.union(v.number(), v.null()),
  one_liner: v.union(v.string(), v.null()),
  why_this_may_interest_you: v.array(v.string()),
  watch_out: v.array(v.string()),
  suggested_next_step: v.union(v.string(), v.null()),
  visible_requirements_summary: v.array(v.string()),
  hard_gate_status: v.union(
    v.literal("present"),
    v.literal("none"),
    v.literal("unknown"),
  ),
  human_label: v.union(liveMatchReviewHumanLabelValidator, v.null()),
  failure_types: v.array(liveMatchReviewFailureTypeValidator),
  reviewer_notes: v.string(),
});

function normalizeDebugToken(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function parseStructuredInternalAllowlist(rawValue: string | undefined): Set<string> {
  return new Set(
    String(rawValue ?? "")
      .split(/[,\n]/g)
      .map(normalizeDebugToken)
      .filter(Boolean),
  );
}

function isStructuredMatchReadInternalViewer(
  identity: StructuredInternalIdentity | null,
  rawAllowlist:
    | string
    | undefined = process.env[STRUCTURED_MATCH_READ_INTERNAL_VIEWERS_ENV] ??
    process.env[STRUCTURED_MATCH_READ_INTERNAL_EMAILS_ENV],
): boolean {
  if (!identity) {
    return false;
  }

  const allowlist = parseStructuredInternalAllowlist(rawAllowlist);
  if (allowlist.size === 0) {
    return false;
  }

  return [
    identity.subject,
    identity.email,
    identity.tokenIdentifier,
  ].some((value) => allowlist.has(normalizeDebugToken(value)));
}

function isStructuredMatchReadInternalUiEnabled(
  rawValue: string | undefined = process.env[STRUCTURED_MATCH_READ_INTERNAL_UI_ENV],
): boolean {
  const normalized = normalizeDebugToken(rawValue);
  return normalized === "1" || normalized === "true" || normalized === "on";
}

function isStructuredMatchReadAdvisoryBetaEnabled(
  rawValue: string | undefined = process.env[STRUCTURED_MATCH_READ_ADVISORY_BETA_ENV],
): boolean {
  const normalized = normalizeDebugToken(rawValue);
  return normalized === "1" || normalized === "true" || normalized === "on";
}

function isStructuredMatchReadAdvisoryBetaAllEnabled(
  rawValue: string | undefined = process.env[STRUCTURED_MATCH_READ_ADVISORY_BETA_ALL_ENV],
): boolean {
  const normalized = normalizeDebugToken(rawValue);
  return normalized === "1" || normalized === "true" || normalized === "on";
}

function isStructuredMatchReadAdvisoryBetaLocalDev(): boolean {
  const nodeEnv = normalizeDebugToken(process.env.NODE_ENV);
  if (nodeEnv === "development") {
    return true;
  }

  const deployment = normalizeDebugToken(process.env.CONVEX_DEPLOYMENT);
  if (deployment.startsWith("dev:") || deployment.startsWith("local:")) {
    return true;
  }

  return (
    nodeEnv !== "production" &&
    isStructuredMatchReadAdvisoryBetaAllEnabled()
  );
}

function isStructuredMatchReadBetaViewer(
  identity: StructuredInternalIdentity | null,
  rawAllowlist: string | undefined = process.env[STRUCTURED_MATCH_READ_BETA_VIEWERS_ENV],
): boolean {
  if (!identity) {
    return false;
  }

  if (isStructuredMatchReadAdvisoryBetaLocalDev()) {
    return true;
  }

  const allowlist = parseStructuredInternalAllowlist(rawAllowlist);
  if (allowlist.size === 0) {
    return false;
  }

  return [
    identity.subject,
    identity.email,
    identity.tokenIdentifier,
  ].some((value) => allowlist.has(normalizeDebugToken(value)));
}

function isStructuredMatchReviewLabel(
  value: unknown,
): value is StructuredMatchReviewLabel {
  return STRUCTURED_MATCH_REVIEW_LABELS.includes(
    value as StructuredMatchReviewLabel,
  );
}

function isStructuredMatchReviewExtractionVerdict(
  value: unknown,
): value is StructuredMatchReviewExtractionVerdict {
  return STRUCTURED_MATCH_REVIEW_EXTRACTION_VERDICTS.includes(
    value as StructuredMatchReviewExtractionVerdict,
  );
}

function resolveStructuredMatchReviewAppGitCommitSha(): string | null {
  for (const key of STRUCTURED_MATCH_REVIEW_APP_GIT_COMMIT_SHA_ENV_KEYS) {
    let value = "";
    try {
      value = String(process.env[key] ?? "").trim();
    } catch {
      // Local Convex rejects env names >=40 chars. Keep the long production key
      // supported where available, but allow local collection to use fallbacks.
      value = "";
    }
    if (value) {
      return value;
    }
  }

  return null;
}

function buildUnavailableStructuredShadow(
  old: MatchRead,
  reason: "shadow_disabled" | "internal_viewer_required",
): StructuredMatchReadDebug {
  return {
    old: {
      score: old.score,
      tier: old.tier,
      matched: old.matched,
      missing: old.missing,
      method: old.method,
      fallback: old.fallback,
    },
    structured: {
      status: "unavailable",
      reason,
    },
  };
}

function countStructuredMetadataLeaks(
  structured: Extract<StructuredMatchReadDebug["structured"], { status: "available" }>,
): number {
  return structured.jobRequirements.filter((requirement) => {
    const value = normalizeDebugToken(requirement.value);
    return (
      STRUCTURED_DEBUG_METADATA_VALUES.has(value) ||
      STRUCTURED_DEBUG_METADATA_RE.test(value)
    );
  }).length;
}

function hasCompleteStructuredProvenance(
  structured: Extract<StructuredMatchReadDebug["structured"], { status: "available" }>,
): boolean {
  const entities = [
    ...structured.jobRequirements,
    ...structured.jobConstraints,
    ...structured.profileEvidence,
    ...structured.profileConstraints,
  ];
  const entitiesHaveProvenance = entities.every(
    (entity) =>
      Boolean(entity.provenance.source) &&
      normalizeDebugToken(entity.provenance.sourceText).length > 0,
  );
  const outcomesHaveEvidence = [
    ...structured.matched,
    ...structured.partial,
  ].every(
    (outcome) =>
      normalizeDebugToken(outcome.requirement.provenance.sourceText).length > 0 &&
      normalizeDebugToken(outcome.evidence?.evidenceText).length > 0 &&
      normalizeDebugToken(outcome.evidence?.provenance.sourceText).length > 0,
  );

  return entitiesHaveProvenance && outcomesHaveEvidence;
}

function hasStructuredLanguagePreserved(args: {
  rawLanguageDetected?: string | null;
  structured: Extract<StructuredMatchReadDebug["structured"], { status: "available" }>;
}): boolean {
  const language = normalizeDebugToken(args.rawLanguageDetected);
  if (!language.startsWith("fr")) {
    return true;
  }

  const values = [
    ...args.structured.jobRequirements.map((requirement) => requirement.value),
    ...args.structured.profileEvidence.map((evidence) => evidence.evidenceText),
  ]
    .map(normalizeDebugToken)
    .join("\n");
  return /\b(francais|français|support client|gestion des demandes)\b/i.test(values);
}

function buildStructuredShadowSummary(args: {
  debug: StructuredMatchReadDebug;
  flagEnabled: boolean;
  internalViewer: boolean;
  uiEnabled: boolean;
  advisoryBetaEnabled: boolean;
  advisoryBetaViewer: boolean;
  rawLanguageDetected?: string | null;
}): StructuredShadowSummary {
  const { debug } = args;
  if (debug.structured.status !== "available") {
    return {
      flagEnabled: args.flagEnabled,
      internalViewer: args.internalViewer,
      uiEnabled: args.uiEnabled,
      advisoryBetaEnabled: args.advisoryBetaEnabled,
      advisoryBetaViewer: args.advisoryBetaViewer,
      status: "unavailable",
      reason: debug.structured.reason,
      oldScore: debug.old.score,
      oldTier: debug.old.tier,
      structuredScore: null,
      structuredTier: null,
      matchedCount: 0,
      partialCount: 0,
      missingCount: 0,
      unknownCount: 0,
      hardGateMissingCount: 0,
      metadataLeakCount: 0,
      languagePreserved: false,
      provenanceComplete: false,
      jobRequirementCount: 0,
      jobConstraintCount: 0,
      profileEvidenceCount: 0,
      profileConstraintCount: 0,
    };
  }

  return {
    flagEnabled: args.flagEnabled,
    internalViewer: args.internalViewer,
    uiEnabled: args.uiEnabled,
    advisoryBetaEnabled: args.advisoryBetaEnabled,
    advisoryBetaViewer: args.advisoryBetaViewer,
    status: "available",
    reason: null,
    oldScore: debug.old.score,
    oldTier: debug.old.tier,
    structuredScore: debug.structured.structuredScore,
    structuredTier: debug.structured.structuredTier,
    matchedCount: debug.structured.matched.length,
    partialCount: debug.structured.partial.length,
    missingCount: debug.structured.missing.length,
    unknownCount: debug.structured.unknown.length,
    hardGateMissingCount: debug.structured.hardGateMissing.length,
    metadataLeakCount: countStructuredMetadataLeaks(debug.structured),
    languagePreserved: hasStructuredLanguagePreserved({
      rawLanguageDetected: args.rawLanguageDetected,
      structured: debug.structured,
    }),
    provenanceComplete: hasCompleteStructuredProvenance(debug.structured),
    jobRequirementCount: debug.structured.jobRequirements.length,
    jobConstraintCount: debug.structured.jobConstraints.length,
    profileEvidenceCount: debug.structured.profileEvidence.length,
    profileConstraintCount: debug.structured.profileConstraints.length,
  };
}

function buildSampleJobDraft(now: number) {
  const rawDescription = [
    "TwoWeeks sample role: Content Operations Coordinator.",
    "Own the weekly publishing calendar for proposal and resume assets across the workspace.",
    "Coordinate with design, writing, and operations partners to keep deliverables on track.",
    "Required: strong project coordination, clear written communication, and comfort working in Notion and Google Workspace.",
    "Experience with content operations, editorial planning, or workflow management is preferred.",
    "This sample is pre-parsed so first-time users can review a complete job brief immediately.",
  ].join(" ");

  return {
    createdAt: now,
    updatedAt: now,
    importedAt: now,
    lastOpenedAt: now,
    sourceUrl: "https://twoweeks.app/sample-job",
    sourceDomain: "twoweeks.app",
    sourceType: "sample",
    applicationUrl: "",
    dedupeKey: "sample:content-operations-coordinator",
    parseVersion: "sample-v1",
    parseStatus: "parsed" as const,
    reviewState: "ready" as const,
    title: "Content Operations Coordinator",
    company: "TwoWeeks Studio",
    location: "Remote",
    rawDescription,
    rawLanguageDetected: "en",
    summary:
      "Own the publishing calendar and coordinate cross-functional document delivery across the workspace.",
    summaryExtraction: {
      value:
        "Own the publishing calendar and coordinate cross-functional document delivery across the workspace.",
      confidence: 0.96,
      sourceSpan: { start: 41, end: 123 },
    },
    responsibilities: [
      "Own the weekly publishing calendar for proposal and resume assets across the workspace",
      "Coordinate with design, writing, and operations partners to keep deliverables on track",
      "Keep document production moving across cross-functional stakeholders",
    ],
    responsibilitiesExtraction: [
      {
        value:
          "Own the weekly publishing calendar for proposal and resume assets across the workspace",
        confidence: 0.94,
        sourceSpan: { start: 41, end: 123 },
      },
      {
        value:
          "Coordinate with design, writing, and operations partners to keep deliverables on track",
        confidence: 0.93,
        sourceSpan: { start: 125, end: 211 },
      },
      {
        value:
          "Keep document production moving across cross-functional stakeholders",
        confidence: 0.9,
        sourceSpan: null,
      },
    ],
    keywords: [
      "content operations",
      "editorial planning",
      "project coordination",
      "notion",
      "google workspace",
    ],
    keywordsExtraction: [
      {
        value: "content operations",
        confidence: 0.94,
        sourceSpan: { start: 286, end: 304 },
      },
      {
        value: "editorial planning",
        confidence: 0.9,
        sourceSpan: { start: 308, end: 326 },
      },
      {
        value: "project coordination",
        confidence: 0.95,
        sourceSpan: { start: 223, end: 243 },
      },
      {
        value: "notion",
        confidence: 0.9,
        sourceSpan: { start: 301, end: 307 },
      },
      {
        value: "google workspace",
        confidence: 0.9,
        sourceSpan: { start: 312, end: 328 },
      },
    ],
    mustHaves: [
      "Strong project coordination",
      "Clear written communication",
      "Comfort working in Notion and Google Workspace",
    ],
    mustHavesExtraction: [
      {
        value: "Strong project coordination",
        confidence: 0.95,
        sourceSpan: { start: 223, end: 250 },
      },
      {
        value: "Clear written communication",
        confidence: 0.95,
        sourceSpan: { start: 252, end: 279 },
      },
      {
        value: "Comfort working in Notion and Google Workspace",
        confidence: 0.95,
        sourceSpan: { start: 285, end: 330 },
      },
    ],
    toneCues: ["clear", "structured", "collaborative"],
    toneCuesExtraction: [
      {
        value: "clear",
        confidence: 0.88,
        sourceSpan: { start: 252, end: 257 },
      },
      {
        value: "structured",
        confidence: 0.86,
        sourceSpan: null,
      },
      {
        value: "collaborative",
        confidence: 0.86,
        sourceSpan: { start: 125, end: 136 },
      },
    ],
    contacts: [],
    isSample: true,
    isFavorite: false,
    status: "active",
    archivedAt: null,
    reviewItems: [],
  };
}

async function listJobsForProfileId(ctx: any, profileId: string) {
  return ctx.db
    .query("jobs")
    .withIndex("by_user_updated", (q: any) => q.eq("userId", profileId))
    .order("desc")
    .collect();
}

async function archiveActiveSampleJobsForProfile(ctx: any, profileId: string) {
  const jobs = await listJobsForProfileId(ctx, profileId);
  const activeSampleJobs = jobs.filter(
    (job: any) =>
      Boolean(job.isSample) &&
      (job.archivedAt === null || job.archivedAt === undefined),
  );

  if (activeSampleJobs.length === 0) {
    return;
  }

  const now = Date.now();
  await Promise.all(
    activeSampleJobs.map((job: any) =>
      ctx.db.patch(job._id, {
        archivedAt: now,
        updatedAt: now,
      }),
    ),
  );
}

async function scheduleFirstRunPathMetric(
  ctx: any,
  path: "import" | "sample" | "bounce",
) {
  await ctx.scheduler.runAfter(
    0,
    internal.metrics.recordMetric,
    buildJobsMetricArgs({
      event: "first_run_path",
      path,
    }),
  );
}

export const getJobForShadowExtraction = internalQuery({
  args: {
    jobId: v.id("jobs"),
  },
  returns: v.union(
    v.null(),
    v.object({
      jobId: v.id("jobs"),
      title: v.string(),
      rawDescription: v.string(),
      sourceUrl: v.string(),
      sourceDomain: v.string(),
      sourceType: v.string(),
      applicationUrl: v.string(),
      company: v.string(),
      location: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }

    return {
      jobId: args.jobId,
      title: job.title,
      rawDescription: job.rawDescription,
      sourceUrl: job.sourceUrl,
      sourceDomain: job.sourceDomain,
      sourceType: job.sourceType,
      applicationUrl: job.applicationUrl,
      company: job.company,
      location: job.location,
    };
  },
});

export const getValidJobExtractionShadowByHash = internalQuery({
  args: {
    jobTextHash: v.string(),
    model: v.string(),
    promptVersion: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      llm_raw_output: v.any(),
      llm_normalized_output: v.any(),
      validation_status: jobExtractionShadowValidationStatus,
      fallback_used: v.boolean(),
      model: v.string(),
      prompt_version: v.string(),
      model_confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low"), v.null()),
      final_confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low"), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("job_extraction_shadow")
      .withIndex("by_cache_identity", (q) =>
        q
          .eq("job_text_hash", args.jobTextHash)
          .eq("model", args.model)
          .eq("prompt_version", args.promptVersion)
          .eq("validation_status", "valid"),
      )
      .collect();
    const row =
      rows
        .filter((candidate) => candidate.fallback_used === false)
        .sort((a, b) => {
          const createdAtDiff = b.created_at - a.created_at;
          if (createdAtDiff !== 0) {
            return createdAtDiff;
          }
          return b._creationTime - a._creationTime;
        })[0] ?? null;
    if (!row) {
      return null;
    }

    return {
      llm_raw_output: row.llm_raw_output,
      llm_normalized_output: row.llm_normalized_output,
      validation_status: row.validation_status,
      fallback_used: row.fallback_used,
      model: row.model,
      prompt_version: row.prompt_version,
      model_confidence: row.model_confidence ?? null,
      final_confidence: row.final_confidence ?? null,
    };
  },
});

export const storeJobExtractionShadow = internalMutation({
  args: {
    jobId: v.id("jobs"),
    jobTextHash: v.string(),
    llmRawOutput: v.any(),
    llmNormalizedOutput: v.any(),
    validationStatus: jobExtractionShadowValidationStatus,
    fallbackUsed: v.boolean(),
    model: v.string(),
    promptVersion: v.string(),
    latencyMs: v.number(),
    modelConfidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low"), v.null()),
    finalConfidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low"), v.null()),
    createdAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("job_extraction_shadow", {
      job_id: args.jobId,
      job_text_hash: args.jobTextHash,
      llm_raw_output: args.llmRawOutput,
      llm_normalized_output: args.llmNormalizedOutput,
      validation_status: args.validationStatus,
      fallback_used: args.fallbackUsed,
      model: args.model,
      prompt_version: args.promptVersion,
      latency_ms: args.latencyMs,
      model_confidence: args.modelConfidence,
      final_confidence: args.finalConfidence,
      created_at: args.createdAt,
    });

    return null;
  },
});

export const runShadowJobExtraction = internalAction({
  args: {
    jobId: v.id("jobs"),
    force: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.force && !isJobLlmExtractionShadowEnabled()) {
      return null;
    }

    const job = await ctx.runQuery(
      (internal as any).jobsPublic.getJobForShadowExtraction,
      { jobId: args.jobId },
    );
    if (!job || !String(job.rawDescription ?? "").trim()) {
      return null;
    }

    const jobTextHash = await hashNormalizedJobText(job.rawDescription);
    const model = resolveJobExtractionModel();
    const cached = await ctx.runQuery(
      (internal as any).jobsPublic.getValidJobExtractionShadowByHash,
      { jobTextHash, model, promptVersion: PROMPT_VERSION },
    );

    if (cached) {
      await ctx.runMutation((internal as any).jobsPublic.storeJobExtractionShadow, {
        jobId: args.jobId,
        jobTextHash,
        llmRawOutput: cached.llm_raw_output,
        llmNormalizedOutput: cached.llm_normalized_output,
        validationStatus: "valid",
        fallbackUsed: cached.fallback_used,
        model: cached.model,
        promptVersion: cached.prompt_version || PROMPT_VERSION,
        latencyMs: 0,
        modelConfidence: cached.model_confidence ?? null,
        finalConfidence: cached.final_confidence ?? null,
        createdAt: Date.now(),
      });
      return null;
    }

    const result = await extractJobStructuredWithMetadata(job.rawDescription, {
      model,
      fallback: () =>
        buildNormalizedJobExtractionFromHeuristic({
          title: job.title,
          rawDescription: job.rawDescription,
          sourceUrl: job.sourceUrl,
          sourceDomain: job.sourceDomain,
          sourceType: job.sourceType,
          applicationUrl: job.applicationUrl,
          company: job.company,
          location: job.location,
        }),
    });

    await ctx.runMutation((internal as any).jobsPublic.storeJobExtractionShadow, {
      jobId: args.jobId,
      jobTextHash,
      llmRawOutput: result.rawOutput,
      llmNormalizedOutput: result.llmNormalizedOutput,
      validationStatus: result.validationStatus,
      fallbackUsed: result.fallbackUsed,
      model: result.model,
      promptVersion: result.promptVersion,
      latencyMs: result.latencyMs,
      modelConfidence: result.modelConfidence,
      finalConfidence: result.finalConfidence,
      createdAt: Date.now(),
    });

    return null;
  },
});

function hasUsableProfileScoringData(profile: any): boolean {
  return (
    (Array.isArray(profile?.skills) && profile.skills.length > 0) ||
    (Array.isArray(profile?.keywords) && profile.keywords.length > 0) ||
    (typeof profile?.summary === "string" && profile.summary.trim().length > 0) ||
    (Array.isArray(profile?.experience) && profile.experience.length > 0) ||
    (typeof profile?.raw_text === "string" && profile.raw_text.trim().length > 0)
  );
}

async function backfillResumeProfileScoringFromCvDocument(
  ctx: any,
  resumeProfile: any,
) {
  if (hasUsableProfileScoringData(resumeProfile)) {
    return;
  }

  const scoringFields = buildScoringProfileFieldsFromCvDocument(
    resumeProfile?.cvDocument,
  );
  if (
    !scoringFields.summary &&
    scoringFields.skills.length === 0 &&
    scoringFields.experience.length === 0 &&
    !scoringFields.raw_text
  ) {
    return;
  }

  await ctx.db.patch(resumeProfile._id, {
    ...(scoringFields.summary ? { summary: scoringFields.summary } : {}),
    ...(scoringFields.skills.length > 0 ? { skills: scoringFields.skills } : {}),
    ...(scoringFields.experience.length > 0
      ? { experience: scoringFields.experience }
      : {}),
    ...(scoringFields.raw_text ? { raw_text: scoringFields.raw_text } : {}),
    keywords: resolveCanonicalProfileKeywordsForWrite({
      summary: scoringFields.summary,
      skills: scoringFields.skills,
      experience: scoringFields.experience,
      rawText: scoringFields.raw_text,
    }),
    updatedAt: Date.now(),
    version: (resumeProfile.version ?? 1) + 1,
  });
}

function normalizeDecisionOutcome(
  value: string | undefined,
): "cover_letter" | "resume" | null {
  if (value === "cover_letter" || value === "resume") {
    return value;
  }
  return null;
}

function buildNextStepHeadline(
  tier: MatchReadTier,
  outcome: "cover_letter" | "resume",
): string {
  const tierLabel = tier === "unknown" ? "unknown" : tier;

  if (outcome === "resume") {
    return `Most users with a ${tierLabel} match opened the resume with this job.`;
  }
  return `Most users with a ${tierLabel} match generated a cover letter first.`;
}

async function resolveNextStepBlock(ctx: any, tier: MatchReadTier) {
  if (!FEATURE_COHORT_NEXT_STEPS) {
    return {
      headline: "Common next steps",
      usesCohortData: false,
      actions: [...NEXT_STEP_FALLBACK_ACTION_ORDER],
    };
  }

  const metrics = await ctx.db
    .query("metrics")
    .withIndex("by_name_time", (q: any) =>
      q.eq("name", "jobs-v2:job_decision_made"),
    )
    .collect();

  const normalizedOutcomes = metrics
    .map((metric: any) => ({
      tier: String(metric?.labels?.tier ?? ""),
      outcome: normalizeDecisionOutcome(String(metric?.labels?.outcome ?? "")),
    }))
    .filter((entry) => entry.outcome !== null);

  const hasEnoughTotalData =
    normalizedOutcomes.length >= COHORT_MIN_TOTAL_DECISIONS;
  const tierMetrics = normalizedOutcomes.filter((entry) => entry.tier === tier);
  const hasEnoughTierData = tierMetrics.length >= COHORT_MIN_TIER_DECISIONS;
  const actionOrder = [...NEXT_STEP_FALLBACK_ACTION_ORDER];

  if (!hasEnoughTotalData || !hasEnoughTierData) {
    return {
      headline: "Common next steps",
      usesCohortData: false,
      actions: actionOrder,
    };
  }

  const counts = new Map<string, number>();
  for (const entry of tierMetrics) {
    counts.set(entry.outcome!, (counts.get(entry.outcome!) ?? 0) + 1);
  }

  const orderedActions = [...actionOrder].sort((left, right) => {
    const countDiff = (counts.get(right) ?? 0) - (counts.get(left) ?? 0);
    if (countDiff !== 0) {
      return countDiff;
    }
    return actionOrder.indexOf(left) - actionOrder.indexOf(right);
  });
  const headlineAction =
    orderedActions.find(
      (action): action is "cover_letter" | "resume" =>
        action === "cover_letter" || action === "resume",
    ) ?? "cover_letter";

  return {
    headline: buildNextStepHeadline(tier, headlineAction),
    usesCohortData: true,
    actions: orderedActions,
  };
}

function getLegacyFieldConfidence(
  job: any,
  fieldKey: string,
  fallbackConfidence: number,
) {
  const reviewItem = (job.reviewItems ?? []).find(
    (item: any) => item.fieldKey === fieldKey,
  );

  if (typeof reviewItem?.confidence === "number") {
    return reviewItem.confidence;
  }

  return fallbackConfidence;
}

function buildExtractionProjection(args: {
  job: any;
  fieldKey: string;
  extractionKey: string;
  fallbackValues: string[];
  fallbackConfidence: number;
}): CanonicalJobExtraction[] {
  const structuredValues = args.job[args.extractionKey];
  if (Array.isArray(structuredValues) && structuredValues.length > 0) {
    return structuredValues.map((item: any) => ({
      value: String(item?.value ?? "").trim(),
      confidence: Number(item?.confidence ?? args.fallbackConfidence),
      sourceSpan:
        item?.sourceSpan &&
        typeof item.sourceSpan.start === "number" &&
        typeof item.sourceSpan.end === "number"
          ? {
              start: item.sourceSpan.start,
              end: item.sourceSpan.end,
            }
          : null,
    }));
  }

  const confidence = getLegacyFieldConfidence(
    args.job,
    args.fieldKey,
    args.fallbackConfidence,
  );

  return args.fallbackValues.map((value) => ({
    value,
    confidence,
    sourceSpan: null,
  }));
}

function projectReviewItemsWithVisibleExtraction(args: {
  reviewItems: any[];
  visibleExtraction: VisibleJobExtractionSelection;
}) {
  if (args.visibleExtraction.source !== "llm") {
    return args.reviewItems;
  }

  const allowedReviewItems = args.reviewItems.filter(
    (item) => String(item.fieldKey ?? "") !== "responsibilities",
  );

  const buildLlmReviewItem = (args: {
    id: string;
    fieldKey: string;
    label: string;
    suggestedValue: string | string[];
  }) => {
    const existing = allowedReviewItems.find(
      (item) => String(item.fieldKey ?? "") === args.fieldKey,
    );
    const approvedValueMatches =
      existing?.reviewStatus === "approved" &&
      JSON.stringify(existing.approvedValue) === JSON.stringify(args.suggestedValue);
    return {
      ...(existing ?? {}),
      id: existing?.id ?? args.id,
      fieldKey: args.fieldKey,
      label: existing?.label ?? args.label,
      reviewStatus: approvedValueMatches ? "approved" : "pending",
      suggestedValue: args.suggestedValue,
      approvedValue: approvedValueMatches ? existing.approvedValue : undefined,
      sourceText: Array.isArray(args.suggestedValue)
        ? args.suggestedValue.join("\n")
        : args.suggestedValue,
      confidence: Math.max(Number(existing?.confidence ?? 0), 0.9),
      updatedAt:
        typeof existing?.updatedAt === "number" ? existing.updatedAt : 0,
    };
  };

  const llmBackedItems = [
    ...(args.visibleExtraction.summary
      ? [
          buildLlmReviewItem({
            id: "llm_visible_summary",
            fieldKey: "summary",
            label: "Summary",
            suggestedValue: args.visibleExtraction.summary,
          }),
        ]
      : []),
    ...(args.visibleExtraction.requirements.length > 0
      ? [
          buildLlmReviewItem({
            id: "llm_visible_must_haves",
            fieldKey: "mustHaves",
            label: "Requirements",
            suggestedValue: args.visibleExtraction.requirements,
          }),
        ]
      : []),
    ...(args.visibleExtraction.keywords.length > 0
      ? [
          buildLlmReviewItem({
            id: "llm_visible_keywords",
            fieldKey: "keywords",
            label: "Keywords",
            suggestedValue: args.visibleExtraction.keywords,
          }),
        ]
      : []),
  ];

  return llmBackedItems.flatMap((item) => {
    const fieldKey = String(item.fieldKey ?? "");
    const nextSuggestedValue =
      fieldKey === "keywords"
        ? args.visibleExtraction.keywords
        : fieldKey === "mustHaves" || fieldKey === "requirements"
          ? args.visibleExtraction.requirements
          : fieldKey === "summary" && args.visibleExtraction.summary
            ? args.visibleExtraction.summary
            : undefined;

    if (nextSuggestedValue === undefined) {
      return [item];
    }

    return [{
      ...item,
      suggestedValue: nextSuggestedValue,
      sourceText: Array.isArray(nextSuggestedValue)
        ? nextSuggestedValue.join("\n")
        : String(nextSuggestedValue),
      confidence: Math.max(Number(item.confidence ?? 0), 0.9),
    }];
  });
}

async function resolveVisibleExtractionForJob(ctx: any, job: any) {
  const shadowRows = await ctx.db
    .query("job_extraction_shadow")
    .withIndex("by_job_id", (q: any) => q.eq("job_id", job._id))
    .collect();
  const visibleFallbackMustHaves =
    Array.isArray(job.mustHavesExtraction) && job.mustHavesExtraction.length > 0
      ? flattenExtractionValues(job.mustHavesExtraction)
      : (job.mustHaves ?? []);
  const visibleFallbackKeywords =
    Array.isArray(job.keywordsExtraction) && job.keywordsExtraction.length > 0
      ? flattenExtractionValues(job.keywordsExtraction)
      : (job.keywords ?? []);

  return selectVisibleJobExtraction({
    flagEnabled: isJobLlmVisibleExtractionEnabled(),
    shadowRows,
    heuristic: {
      summary:
        typeof job.summaryExtraction?.value === "string"
          ? job.summaryExtraction.value
          : job.summary,
      requirements: visibleFallbackMustHaves,
      keywords: visibleFallbackKeywords,
    },
    rawLanguageDetected: job.rawLanguageDetected,
  });
}

function buildJobProjection(
  job: any,
  matchRead: MatchRead | null = null,
  storedResume: {
    resumeId?: string;
    resumeName?: string;
    source: "job" | "default" | null;
  } = {
    resumeId: undefined,
    resumeName: undefined,
    source: null,
  },
  nextStepBlock: {
    headline: string;
    usesCohortData: boolean;
    actions: readonly ("cover_letter" | "resume" | "save_for_later")[];
  } | null = null,
  linkedProposalCount = 0,
  linkedProposals: Array<{
    id: string;
    title: string;
    status: string;
    updatedAt: number;
  }> = [],
  visibleExtraction?: VisibleJobExtractionSelection,
  structuredShadowSummary: StructuredShadowSummary | null = null,
  matchReview: JobMatchReview | null = null,
) {
  const responsibilitiesExtraction = buildExtractionProjection({
    job,
    fieldKey: "responsibilities",
    extractionKey: "responsibilitiesExtraction",
    fallbackValues: job.responsibilities ?? [],
    fallbackConfidence: 0.52,
  });
  const keywordsExtraction = buildExtractionProjection({
    job,
    fieldKey: "keywords",
    extractionKey: "keywordsExtraction",
    fallbackValues: job.keywords ?? [],
    fallbackConfidence: 0.42,
  });
  const mustHavesExtraction = buildExtractionProjection({
    job,
    fieldKey: "mustHaves",
    extractionKey: "mustHavesExtraction",
    fallbackValues: job.mustHaves ?? [],
    fallbackConfidence: 0.48,
  });
  const toneCuesExtraction = buildExtractionProjection({
    job,
    fieldKey: "toneCues",
    extractionKey: "toneCuesExtraction",
    fallbackValues: job.toneCues ?? [],
    fallbackConfidence: 0.46,
  });
  const summaryExtraction =
    job.summaryExtraction && typeof job.summaryExtraction.value === "string"
      ? {
          value: job.summaryExtraction.value,
          confidence: Number(job.summaryExtraction.confidence ?? 0.35),
          sourceSpan:
            job.summaryExtraction.sourceSpan &&
            typeof job.summaryExtraction.sourceSpan.start === "number" &&
            typeof job.summaryExtraction.sourceSpan.end === "number"
              ? {
                  start: job.summaryExtraction.sourceSpan.start,
                  end: job.summaryExtraction.sourceSpan.end,
                }
              : null,
        }
      : {
          value: String(job.summary ?? ""),
          confidence: 0.35,
          sourceSpan: null,
      };
  const visibleSelection =
    visibleExtraction ??
    selectVisibleJobExtraction({
      flagEnabled: false,
      heuristic: {
        summary: summaryExtraction.value,
        requirements: flattenExtractionValues(mustHavesExtraction),
        keywords: flattenExtractionValues(keywordsExtraction),
      },
      rawLanguageDetected: job.rawLanguageDetected,
    });
  const reviewItems = projectReviewItemsWithVisibleExtraction({
    reviewItems: job.reviewItems ?? [],
    visibleExtraction: visibleSelection,
  });

  return {
    id: String(job._id),
    title: job.title,
    company: job.company,
    location: job.location,
    isSample: Boolean(job.isSample),
    isFavorite: Boolean(job.isFavorite),
    sourceUrl: job.sourceUrl,
    sourceDomain: job.sourceDomain,
    sourceType: job.sourceType,
    applicationUrl: job.applicationUrl,
    parseStatus: job.parseStatus,
    reviewState:
      visibleSelection.source === "llm"
        ? resolveCanonicalJobReviewState(reviewItems)
        : job.reviewState,
    summary: summaryExtraction.value,
    summaryExtraction,
    visibleSummary: visibleSelection.summary,
    visibleRequirements: visibleSelection.requirements,
    visibleKeywords: visibleSelection.keywords,
    visibleExtractionSource: visibleSelection.source,
    rawDescription: job.rawDescription,
    responsibilities: flattenExtractionValues(responsibilitiesExtraction),
    responsibilitiesExtraction,
    keywords: flattenExtractionValues(keywordsExtraction),
    keywordsExtraction,
    mustHaves: flattenExtractionValues(mustHavesExtraction),
    mustHavesExtraction,
    toneCues: flattenExtractionValues(toneCuesExtraction),
    toneCuesExtraction,
    contacts: job.contacts ?? [],
    status: job.status,
    ...(storedResume.resumeId ? { resumeId: storedResume.resumeId } : {}),
    ...(storedResume.resumeName ? { resumeName: storedResume.resumeName } : {}),
    ...(storedResume.source ? { resumeSource: storedResume.source } : {}),
    matchRead,
    matchReview,
    nextStepBlock,
    linkedProposalCount,
    linkedProposals,
    structuredShadowSummary,
    reviewItems: reviewItems.map((item: any) => ({
      id: item.id,
      fieldKey: item.fieldKey,
      label: item.label,
      reviewStatus: item.reviewStatus,
      suggestedValue: item.suggestedValue,
      approvedValue: item.approvedValue ?? undefined,
      sourceText: item.sourceText,
      confidence: item.confidence,
      updatedAt: item.updatedAt,
    })),
  };
}

async function resolveStructuredShadowSummaryForInternalUi(args: {
  identity: StructuredInternalIdentity | null;
  job: any;
  matchRead: MatchRead;
  sourceProfile: CanonicalUserProfile | MatchReadResumeProfile | null;
  shadowRows: any[];
}): Promise<StructuredShadowSummary | null> {
  const flagEnabled = isStructuredMatchReadShadowEnabled();
  const uiEnabled = isStructuredMatchReadInternalUiEnabled();
  const advisoryBetaEnabled = isStructuredMatchReadAdvisoryBetaEnabled();
  const internalViewer = isStructuredMatchReadInternalViewer(args.identity);
  const advisoryBetaViewer = isStructuredMatchReadBetaViewer(args.identity);
  const canViewInternal = uiEnabled && internalViewer;
  const canViewAdvisory = advisoryBetaEnabled && advisoryBetaViewer;
  if (!flagEnabled || (!canViewInternal && !canViewAdvisory)) {
    return null;
  }

  const debug = buildStructuredMatchReadDebug({
    old: args.matchRead,
    job: {
      id: String(args.job._id),
      rawLanguageDetected: args.job.rawLanguageDetected,
    },
    profile: args.sourceProfile,
    shadowRows: args.shadowRows,
  });
  const summary = buildStructuredShadowSummary({
    debug,
    flagEnabled,
    internalViewer,
    uiEnabled,
    advisoryBetaEnabled,
    advisoryBetaViewer,
    rawLanguageDetected: args.job.rawLanguageDetected,
  });

  return summary.status === "available" ? summary : null;
}

async function requireCanonicalUserProfile(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const profile = await ensureCanonicalProfileForClerk({
    ctx,
    clerkId: identity.subject,
    fallbackEmail: identity.email,
    fallbackName: identity.name,
  });

  return {
    _id: profile.id,
    clerkId: profile.clerkId,
    email: profile.email,
    name: profile.name,
    version: profile.version,
    skills: profile.skills,
    keywords: profile.keywords,
  };
}

type JobsProjectionProfile = {
  _id?: string | CanonicalUserProfile["id"];
  id?: string | CanonicalUserProfile["id"];
  profileId?: string;
  defaultResumeId?: string | null;
  defaultResumeName?: string | null;
  version?: number;
  skills?: string[];
  keywords?: string[];
} & MatchReadResumeProfile;

async function requireJobForLinkedProfile(ctx: any, jobId: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const normalizedJobId = ctx.db.normalizeId("jobs", jobId);
  if (!normalizedJobId) {
    throw new Error("Invalid jobId");
  }

  const profiles = await listProfilesForClerk(ctx, identity.subject);
  if (profiles.length === 0) {
    throw new Error("User profile not found");
  }

  const job = await ctx.db.get(normalizedJobId);
  const ownerProfile =
    job
      ? profiles.find((profile) => String(profile._id) === String(job.userId))
      : null;

  if (!job || !ownerProfile) {
    throw new Error("Job not found");
  }

  return {
    normalizedJobId,
    job,
    ownerProfile,
    profiles,
  };
}

function normalizeProjectionProfiles(
  profiles: JobsProjectionProfile[],
): JobsProjectionProfile[] {
  const seenProfileIds = new Set<string>();
  const normalizedProfiles: JobsProjectionProfile[] = [];

  for (const profile of profiles) {
    const profileId = String(profile._id ?? profile.id ?? "");
    if (!profileId || seenProfileIds.has(profileId)) {
      continue;
    }

    seenProfileIds.add(profileId);
    normalizedProfiles.push(profile);
  }

  return normalizedProfiles;
}

async function listProjectedJobsForProfiles(
  ctx: any,
  profiles: JobsProjectionProfile[],
  options?: { includeArchived?: boolean; trackMatchRead?: boolean },
) {
  const normalizedProfiles = normalizeProjectionProfiles(profiles);
  if (normalizedProfiles.length === 0) {
    return [];
  }

  const primaryProfile = normalizedProfiles[0] ?? null;

  const jobGroups = await Promise.all(
    normalizedProfiles.map((profile) =>
      listJobsForProfileId(ctx, String(profile._id ?? profile.id ?? "")),
    ),
  );
  const jobs = jobGroups.flat();

  const proposalGroups = await Promise.all(
    normalizedProfiles.map((profile) =>
      ctx.db
        .query("proposals")
        .withIndex("by_user", (q: any) =>
          q.eq("userId", String(profile._id ?? profile.id ?? "")),
        )
        .collect(),
    ),
  );
  const proposals = proposalGroups.flat();

  const linkedProposalStats = new Map<
    string,
    { count: number; latestUpdatedAt: number }
  >();

  for (const proposal of proposals) {
    const jobId = typeof proposal.jobId === "string" ? proposal.jobId : "";
    if (!jobId) {
      continue;
    }

    const current = linkedProposalStats.get(jobId) ?? {
      count: 0,
      latestUpdatedAt: 0,
    };

    linkedProposalStats.set(jobId, {
      count: current.count + 1,
      latestUpdatedAt: Math.max(
        current.latestUpdatedAt,
        proposal.updatedAt ?? proposal.createdAt ?? 0,
      ),
    });
  }

  const visibleJobs = jobs.filter((job: any) =>
    options?.includeArchived
      ? job.archivedAt !== null && job.archivedAt !== undefined
      : job.archivedAt === null || job.archivedAt === undefined,
  );

  const projections = visibleJobs.map((job: any) => {
    const storedResume = resolveStoredResumeSelection({
      job,
      primaryProfile,
    });
    const matchReadProfile = resolveMatchReadSourceProfile({
      job,
      primaryProfile,
      profiles: normalizedProfiles,
    });
    const matchRead = computeMatchRead({
      job: {
        id: String(job._id),
        parseVersion: job.parseVersion,
        parseStatus: job.parseStatus,
        mustHaves: job.mustHaves,
        keywords: job.keywords,
        mustHavesExtraction: job.mustHavesExtraction,
        keywordsExtraction: job.keywordsExtraction,
      },
      profile: buildMatchReadProfile(matchReadProfile),
    });
    const stats = linkedProposalStats.get(String(job._id));
    const lastActivityAt = Math.max(
      job.updatedAt ?? 0,
      job.lastOpenedAt ?? 0,
      stats?.latestUpdatedAt ?? 0,
    );
    return {
      id: String(job._id),
      title: job.title,
      company: job.company,
      location: job.location,
      isSample: Boolean(job.isSample),
      isFavorite: Boolean(job.isFavorite),
      sourceUrl: job.sourceUrl,
      sourceDomain: job.sourceDomain,
      sourceType: job.sourceType,
      parseStatus: job.parseStatus,
      reviewState: job.reviewState,
      matchTier: matchRead.tier,
      status: job.status,
      importedAt: job.importedAt,
      updatedAt: job.updatedAt,
      lastOpenedAt: job.lastOpenedAt,
      lastActivityAt,
      linkedDocumentCount: stats?.count ?? 0,
    };
  });

  return projections;
}

async function listProjectedJobsForProfile(
  ctx: any,
  profile: JobsProjectionProfile,
  options?: { trackMatchRead?: boolean },
) {
  return listProjectedJobsForProfiles(ctx, [profile], options);
}

export const createOrReuseFromSource = mutation({
  args: {
    title: v.string(),
    rawDescription: v.string(),
    company: v.optional(v.string()),
    location: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    sourceDomain: v.optional(v.string()),
    sourceType: v.optional(v.string()),
    applicationUrl: v.optional(v.string()),
  },
  returns: v.object({
    jobId: v.string(),
    dedupeHit: v.boolean(),
    parseStatus: v.string(),
    reviewState: v.string(),
  }),
  handler: async (ctx, args) => {
    const profile = await requireCanonicalUserProfile(ctx);
    const draft = buildCanonicalJobDraftFromSource(args);

    await archiveActiveSampleJobsForProfile(ctx, String(profile._id));

    const existing = await ctx.db
      .query("jobs")
      .withIndex("by_user_dedupe", (q) =>
        q.eq("userId", profile._id).eq("dedupeKey", draft.dedupeKey),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastOpenedAt: Date.now(),
        updatedAt: Date.now(),
      });
      return {
        jobId: String(existing._id),
        dedupeHit: true,
        parseStatus: existing.parseStatus,
        reviewState: existing.reviewState,
      };
    }

    const jobId = await ctx.db.insert("jobs", {
      userId: profile._id,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      importedAt: draft.importedAt,
      lastOpenedAt: draft.lastOpenedAt,
      sourceUrl: draft.sourceUrl,
      sourceDomain: draft.sourceDomain,
      sourceType: draft.sourceType,
      applicationUrl: draft.applicationUrl,
      dedupeKey: draft.dedupeKey,
      parseVersion: draft.parseVersion,
      parseStatus: "parsing",
      reviewState: "pending",
      title: draft.title,
      company: draft.company,
      location: draft.location,
      rawDescription: draft.rawDescription,
      rawLanguageDetected: draft.rawLanguageDetected,
      summary: "",
      responsibilities: [],
      keywords: [],
      mustHaves: [],
      toneCues: [],
      contacts: [],
      isSample: false,
      isFavorite: false,
      status: draft.status,
      archivedAt: draft.archivedAt,
      reviewItems: [],
    });

    await ctx.scheduler.runAfter(
      0,
      (internal as any).jobsPublic.parseCreatedJob,
      { jobId: String(jobId) },
    );

    return {
      jobId: String(jobId),
      dedupeHit: false,
      parseStatus: "parsing",
      reviewState: "pending",
    };
  },
});

export const getById = query({
  args: {
    jobId: v.string(),
    clientRefreshKey: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      id: v.string(),
      title: v.string(),
      company: v.string(),
      location: v.string(),
      isSample: v.boolean(),
      isFavorite: v.boolean(),
      sourceUrl: v.string(),
      sourceDomain: v.string(),
      sourceType: v.string(),
      applicationUrl: v.string(),
      parseStatus: v.string(),
      reviewState: v.string(),
      summary: v.string(),
      visibleSummary: v.union(v.string(), v.null()),
      visibleRequirements: v.array(v.string()),
      visibleKeywords: v.array(v.string()),
      visibleExtractionSource: v.optional(
        v.union(v.literal("llm"), v.literal("heuristic"), v.literal("empty")),
      ),
      summaryExtraction: v.object({
        value: v.string(),
        confidence: v.number(),
        sourceSpan: v.union(
          v.object({
            start: v.number(),
            end: v.number(),
          }),
          v.null(),
        ),
      }),
      rawDescription: v.string(),
      responsibilities: v.array(v.string()),
      responsibilitiesExtraction: v.array(
        v.object({
          value: v.string(),
          confidence: v.number(),
          sourceSpan: v.union(
            v.object({
              start: v.number(),
              end: v.number(),
            }),
            v.null(),
          ),
        }),
      ),
      keywords: v.array(v.string()),
      keywordsExtraction: v.array(
        v.object({
          value: v.string(),
          confidence: v.number(),
          sourceSpan: v.union(
            v.object({
              start: v.number(),
              end: v.number(),
            }),
            v.null(),
          ),
        }),
      ),
      mustHaves: v.array(v.string()),
      mustHavesExtraction: v.array(
        v.object({
          value: v.string(),
          confidence: v.number(),
          sourceSpan: v.union(
            v.object({
              start: v.number(),
              end: v.number(),
            }),
            v.null(),
          ),
        }),
      ),
      toneCues: v.array(v.string()),
      toneCuesExtraction: v.array(
        v.object({
          value: v.string(),
          confidence: v.number(),
          sourceSpan: v.union(
            v.object({
              start: v.number(),
              end: v.number(),
            }),
            v.null(),
          ),
        }),
      ),
      contacts: v.array(v.string()),
      status: v.string(),
      resumeId: v.optional(v.string()),
      resumeName: v.optional(v.string()),
      resumeSource: v.optional(v.union(v.literal("job"), v.literal("default"))),
      matchRead: v.union(
        v.null(),
        v.object({
          tier: v.string(),
          score: v.union(v.number(), v.null()),
          scoreVisible: v.boolean(),
          confidence: v.string(),
          matched: v.array(v.string()),
          missing: v.array(v.string()),
          basedOn: v.object({
            profileId: v.string(),
            profileLabel: v.string(),
            jobId: v.string(),
          }),
          computedAt: v.number(),
          method: v.string(),
          fallback: v.string(),
        }),
      ),
      matchReview: v.union(v.null(), jobMatchReviewValidator),
      nextStepBlock: v.union(
        v.null(),
        v.object({
          headline: v.string(),
          usesCohortData: v.boolean(),
          actions: v.array(
            v.union(
              v.literal("cover_letter"),
              v.literal("resume"),
              v.literal("save_for_later"),
            ),
          ),
        }),
      ),
      linkedProposalCount: v.number(),
      linkedProposals: v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          status: v.string(),
          updatedAt: v.number(),
        }),
      ),
      structuredShadowSummary: v.union(v.null(), structuredShadowSummaryValidator),
      reviewItems: v.array(
        v.object({
          id: v.string(),
          fieldKey: v.string(),
          label: v.string(),
          reviewStatus: v.string(),
          suggestedValue: v.any(),
          approvedValue: v.optional(v.any()),
          sourceText: v.string(),
          confidence: v.number(),
          updatedAt: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const profiles = await listProfilesForClerk(ctx, identity?.subject ?? "");
    if (profiles.length === 0) {
      return null;
    }

    const normalizedJobId = ctx.db.normalizeId("jobs", args.jobId);
    if (!normalizedJobId) {
      return null;
    }

    const job = await ctx.db.get(normalizedJobId);
    if (
      !job ||
      !profiles.some((profile) => String(profile._id) === String(job.userId)) ||
      (job.archivedAt !== null && job.archivedAt !== undefined)
    ) {
      return null;
    }

    const linkedProposals = await ctx.db
      .query("proposals")
      .withIndex("by_job", (q) => q.eq("jobId", String(job._id)))
      .collect();

    const projectedLinkedProposals = linkedProposals
      .map((proposal) => ({
        id: String(proposal._id),
        title: proposal.title ?? "Untitled proposal",
        status: proposal.status ?? "draft",
        updatedAt: proposal.updatedAt ?? 0,
      }))
      .sort((left, right) => right.updatedAt - left.updatedAt);

    const primaryProfile = profiles[0] ?? null;
    const storedResume = resolveStoredResumeSelection({
      job,
      primaryProfile,
    });
    const matchReadProfile = resolveMatchReadSourceProfile({
      job,
      primaryProfile,
      profiles,
    });
    const pendingMatchRead = buildStructuredPendingMatchRead({
      jobId: String(job._id),
      profileId: String(
        (matchReadProfile as any)?.profileId ??
          (matchReadProfile as any)?._id ??
          (matchReadProfile as any)?.id ??
          "",
      ),
    });
    const shadowRows = await ctx.db
      .query("job_extraction_shadow")
      .withIndex("by_job_id", (q) => q.eq("job_id", job._id))
      .collect();
    const structuredDebug = buildStructuredMatchReadDebug({
      old: pendingMatchRead,
      job: {
        id: String(job._id),
        rawLanguageDetected: job.rawLanguageDetected,
      },
      profile: matchReadProfile,
      shadowRows,
    });
    const matchRead = buildVisibleMatchReadFromStructuredDebug({
      pendingMatchRead,
      debug: structuredDebug,
    });
    const matchReview = buildJobMatchReviewFromStructuredDebug(structuredDebug);
    const nextStepBlock = await resolveNextStepBlock(ctx, matchRead.tier);
    const visibleFallbackMustHaves =
      Array.isArray(job.mustHavesExtraction) && job.mustHavesExtraction.length > 0
        ? flattenExtractionValues(job.mustHavesExtraction)
        : (job.mustHaves ?? []);
    const visibleFallbackKeywords =
      Array.isArray(job.keywordsExtraction) && job.keywordsExtraction.length > 0
        ? flattenExtractionValues(job.keywordsExtraction)
        : (job.keywords ?? []);
    const visibleExtraction = selectVisibleJobExtraction({
      flagEnabled: isJobLlmVisibleExtractionEnabled(),
      shadowRows,
      heuristic: {
        summary:
          typeof job.summaryExtraction?.value === "string"
            ? job.summaryExtraction.value
            : job.summary,
        requirements: visibleFallbackMustHaves,
        keywords: visibleFallbackKeywords,
      },
      rawLanguageDetected: job.rawLanguageDetected,
    });
    const structuredShadowSummary =
      await resolveStructuredShadowSummaryForInternalUi({
        identity,
        job,
        matchRead: pendingMatchRead,
        sourceProfile: matchReadProfile,
        shadowRows,
      });

    return buildJobProjection(
      job,
      matchRead,
      storedResume,
      nextStepBlock,
      linkedProposals.length,
      projectedLinkedProposals,
      visibleExtraction,
      structuredShadowSummary,
      matchReview,
    );
  },
});

// Temporary read-only debug query to inspect the exact match-input chain for one job.
export const debugInspectMatchInputByJobId = query({
  args: {
    jobId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      jobId: v.string(),
      lastResumeId: v.union(v.string(), v.null()),
      resolvedProfileId: v.union(v.string(), v.null()),
      profileSkills: v.array(v.string()),
      profileKeywords: v.array(v.string()),
      summary: v.union(v.string(), v.null()),
      experience: v.array(v.any()),
      raw_text: v.union(v.string(), v.null()),
      derivedKeywords: v.array(v.string()),
      matchReadFallback: v.string(),
      score: v.union(v.number(), v.null()),
      matchedSignals: v.array(v.string()),
      missingSignals: v.array(v.string()),
      structuredShadow: v.any(),
      structuredShadowSummary: structuredShadowSummaryValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const profiles = await listProfilesForClerk(ctx, identity.subject);
    if (profiles.length === 0) {
      return null;
    }

    const normalizedJobId = ctx.db.normalizeId("jobs", args.jobId);
    if (!normalizedJobId) {
      return null;
    }

    const job = await ctx.db.get(normalizedJobId);
    if (
      !job ||
      !profiles.some((profile) => String(profile._id) === String(job.userId)) ||
      (job.archivedAt !== null && job.archivedAt !== undefined)
    ) {
      return null;
    }

    const primaryProfile = profiles[0] ?? null;
    const sourceProfile = resolveMatchReadSourceProfile({
      job,
      primaryProfile,
      profiles,
    });
    const scoringProfile = buildMatchReadProfile(sourceProfile);
    const pendingMatchRead = buildStructuredPendingMatchRead({
      jobId: String(job._id),
      profileId: scoringProfile?.id ?? null,
    });
    const structuredShadowFlagEnabled = isStructuredMatchReadShadowEnabled();
    const structuredShadowInternalViewer =
      isStructuredMatchReadInternalViewer(identity);
    const structuredShadow = !structuredShadowFlagEnabled
      ? buildUnavailableStructuredShadow(pendingMatchRead, "shadow_disabled")
      : !structuredShadowInternalViewer
        ? buildUnavailableStructuredShadow(pendingMatchRead, "internal_viewer_required")
        : buildStructuredMatchReadDebug({
            old: pendingMatchRead,
            job: {
              id: String(job._id),
              rawLanguageDetected: job.rawLanguageDetected,
            },
            profile: sourceProfile,
            shadowRows: await ctx.db
              .query("job_extraction_shadow")
              .withIndex("by_job_id", (q) => q.eq("job_id", normalizedJobId))
              .collect(),
          });
    const structuredShadowSummary = buildStructuredShadowSummary({
      debug: structuredShadow,
      flagEnabled: structuredShadowFlagEnabled,
      internalViewer: structuredShadowInternalViewer,
      uiEnabled: isStructuredMatchReadInternalUiEnabled(),
      advisoryBetaEnabled: isStructuredMatchReadAdvisoryBetaEnabled(),
      advisoryBetaViewer: isStructuredMatchReadBetaViewer(identity),
      rawLanguageDetected: job.rawLanguageDetected,
    });

    return {
      jobId: String(job._id),
      lastResumeId:
        typeof job.lastResumeId === "string" ? job.lastResumeId : null,
      resolvedProfileId: scoringProfile?.id ?? null,
      profileSkills: sourceProfile?.skills ?? [],
      profileKeywords: sourceProfile?.keywords ?? [],
      summary: sourceProfile?.summary ?? null,
      experience: sourceProfile?.experience ?? [],
      raw_text: sourceProfile?.raw_text ?? null,
      derivedKeywords: scoringProfile?.keywords ?? [],
      matchReadFallback: pendingMatchRead.fallback,
      score: pendingMatchRead.score,
      matchedSignals: pendingMatchRead.matched,
      missingSignals: pendingMatchRead.missing,
      structuredShadow,
      structuredShadowSummary,
    };
  },
});

export const recordStructuredMatchReview = mutation({
  args: {
    jobId: v.string(),
    label: structuredMatchReviewLabelValidator,
    notes: v.optional(v.string()),
    extractionSummaryVerdict: v.optional(
      structuredMatchReviewExtractionVerdictValidator,
    ),
    extractionRequirementsVerdict: v.optional(
      structuredMatchReviewExtractionVerdictValidator,
    ),
    extractionKeywordsVerdict: v.optional(
      structuredMatchReviewExtractionVerdictValidator,
    ),
  },
  returns: v.object({
    reviewId: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    if (!isStructuredMatchReadShadowEnabled()) {
      throw new Error("Structured match shadow is disabled");
    }
    const advisoryBetaEnabled = isStructuredMatchReadAdvisoryBetaEnabled();
    const isReviewViewer =
      isStructuredMatchReadInternalViewer(identity) ||
      (advisoryBetaEnabled && isStructuredMatchReadBetaViewer(identity));
    if (!isReviewViewer) {
      throw new Error("Structured match reviewer required");
    }
    if (!isStructuredMatchReviewLabel(args.label)) {
      throw new Error("Invalid structured match review label");
    }
    for (const [fieldName, verdict] of [
      ["extractionSummaryVerdict", args.extractionSummaryVerdict],
      ["extractionRequirementsVerdict", args.extractionRequirementsVerdict],
      ["extractionKeywordsVerdict", args.extractionKeywordsVerdict],
    ] as const) {
      if (
        verdict !== undefined &&
        !isStructuredMatchReviewExtractionVerdict(verdict)
      ) {
        throw new Error(`Invalid structured match review ${fieldName}`);
      }
    }
    const appGitCommitSha = resolveStructuredMatchReviewAppGitCommitSha();
    if (!appGitCommitSha) {
      throw new Error(
        "Structured match review versioning is not configured: missing app git commit SHA",
      );
    }

    const profiles = await listProfilesForClerk(ctx, identity.subject);
    if (profiles.length === 0) {
      throw new Error("No reviewer profile available");
    }

    const normalizedJobId = ctx.db.normalizeId("jobs", args.jobId);
    if (!normalizedJobId) {
      throw new Error("Job not found");
    }

    const job = await ctx.db.get(normalizedJobId);
    if (
      !job ||
      !profiles.some((profile) => String(profile._id) === String(job.userId)) ||
      (job.archivedAt !== null && job.archivedAt !== undefined)
    ) {
      throw new Error("Job not found");
    }

    const primaryProfile = profiles[0] ?? null;
    const sourceProfile = resolveMatchReadSourceProfile({
      job,
      primaryProfile,
      profiles,
    });
    const scoringProfile = buildMatchReadProfile(sourceProfile);
    const pendingMatchRead = buildStructuredPendingMatchRead({
      jobId: String(job._id),
      profileId: scoringProfile?.id ?? null,
    });
    const shadowRows = await ctx.db
      .query("job_extraction_shadow")
      .withIndex("by_job_id", (q) => q.eq("job_id", normalizedJobId))
      .collect();
    const debug = buildStructuredMatchReadDebug({
      old: pendingMatchRead,
      job: {
        id: String(job._id),
        rawLanguageDetected: job.rawLanguageDetected,
      },
      profile: sourceProfile,
      shadowRows,
    });
    const summary = buildStructuredShadowSummary({
      debug,
      flagEnabled: true,
      internalViewer: isStructuredMatchReadInternalViewer(identity),
      uiEnabled: isStructuredMatchReadInternalUiEnabled(),
      advisoryBetaEnabled,
      advisoryBetaViewer: isStructuredMatchReadBetaViewer(identity),
      rawLanguageDetected: job.rawLanguageDetected,
    });
    if (summary.status !== "available") {
      throw new Error("Structured match shadow is unavailable");
    }

    const profileId = String(
      (sourceProfile as any)?.profileId ?? (sourceProfile as any)?._id ?? "",
    );
    const normalizedNotes = String(args.notes ?? "").trim();
    const extractionModel = resolveJobExtractionModel();
    const reviewedAt = Date.now();
    const reviewId = await ctx.db.insert("structured_match_reviews", {
      reviewerId: identity.subject,
      reviewerEmail: identity.email ?? null,
      jobId: String(job._id),
      profileId,
      resumeId: typeof job.lastResumeId === "string" ? job.lastResumeId : null,
      productionScore: summary.structuredScore,
      productionTier: summary.structuredTier ?? "unknown",
      structuredScore: summary.structuredScore,
      structuredTier: summary.structuredTier,
      matchedCount: summary.matchedCount,
      partialCount: summary.partialCount,
      missingCount: summary.missingCount,
      unknownCount: summary.unknownCount,
      hardGateMissingCount: summary.hardGateMissingCount,
      metadataLeakCount: summary.metadataLeakCount,
      languagePreserved: summary.languagePreserved,
      provenanceComplete: summary.provenanceComplete,
      reviewerLabel: args.label,
      ...(normalizedNotes ? { notes: normalizedNotes } : {}),
      ...(args.extractionSummaryVerdict
        ? { extractionSummaryVerdict: args.extractionSummaryVerdict }
        : {}),
      ...(args.extractionRequirementsVerdict
        ? {
            extractionRequirementsVerdict:
              args.extractionRequirementsVerdict,
          }
        : {}),
      ...(args.extractionKeywordsVerdict
        ? { extractionKeywordsVerdict: args.extractionKeywordsVerdict }
        : {}),
      appGitCommitSha,
      structuredScorerVersion: STRUCTURED_MATCH_REVIEW_SCORER_VERSION,
      extractionModel,
      extractionPromptVersion: PROMPT_VERSION,
      reviewedAt,
      scorerVersion: {
        model: extractionModel,
        promptVersion: PROMPT_VERSION,
      },
      createdAt: reviewedAt,
    });

    return { reviewId: String(reviewId) };
  },
});

export const listForUser = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      company: v.string(),
      location: v.string(),
      isSample: v.boolean(),
      isFavorite: v.boolean(),
      sourceUrl: v.string(),
      sourceDomain: v.string(),
      sourceType: v.string(),
      parseStatus: v.string(),
      reviewState: v.string(),
      matchTier: v.union(
        v.literal("strong"),
        v.literal("partial"),
        v.literal("weak"),
        v.literal("unknown"),
      ),
      status: v.string(),
      importedAt: v.number(),
      updatedAt: v.number(),
      lastOpenedAt: v.number(),
      lastActivityAt: v.number(),
      linkedDocumentCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const profiles = await listProfilesForClerk(ctx, identity.subject);
    if (profiles.length === 0) {
      return [];
    }

    return listProjectedJobsForProfiles(ctx, profiles);
  },
});

export const exportLiveMatchReviewRecordsForUser = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(liveMatchReviewRecordValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    if (!isStructuredMatchReadInternalViewer(identity)) {
      throw new Error("Structured match reviewer required");
    }

    const profiles = await listProfilesForClerk(ctx, identity.subject);
    const normalizedProfiles = normalizeProjectionProfiles(profiles);
    if (normalizedProfiles.length === 0) {
      return [];
    }

    const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 50)));
    const primaryProfile = normalizedProfiles[0] ?? null;
    const jobGroups = await Promise.all(
      normalizedProfiles.map((profile) =>
        listJobsForProfileId(ctx, String(profile._id ?? profile.id ?? "")),
      ),
    );
    const jobs = jobGroups
      .flat()
      .filter(
        (job: any) =>
          job.archivedAt === null || job.archivedAt === undefined,
      )
      .sort(
        (left: any, right: any) =>
          Number(right.updatedAt ?? right.importedAt ?? 0) -
          Number(left.updatedAt ?? left.importedAt ?? 0),
      )
      .slice(0, limit);

    return Promise.all(
      jobs.map(async (job: any) => {
        const storedResume = resolveStoredResumeSelection({
          job,
          primaryProfile,
        });
        const matchReadProfile = resolveMatchReadSourceProfile({
          job,
          primaryProfile,
          profiles: normalizedProfiles,
        });
        const pendingMatchRead = buildStructuredPendingMatchRead({
          jobId: String(job._id),
          profileId: String(
            (matchReadProfile as any)?.profileId ??
              (matchReadProfile as any)?._id ??
              (matchReadProfile as any)?.id ??
              "",
          ),
        });
        const shadowRows = await ctx.db
          .query("job_extraction_shadow")
          .withIndex("by_job_id", (q: any) => q.eq("job_id", job._id))
          .collect();
        const structuredDebug = buildStructuredMatchReadDebug({
          old: pendingMatchRead,
          job: {
            id: String(job._id),
            rawLanguageDetected: job.rawLanguageDetected,
          },
          profile: matchReadProfile,
          shadowRows,
        });
        const matchRead = buildVisibleMatchReadFromStructuredDebug({
          pendingMatchRead,
          debug: structuredDebug,
        });
        const matchReview = buildJobMatchReviewFromStructuredDebug(structuredDebug);
        const visibleExtraction = await resolveVisibleExtractionForJob(ctx, job);
        const hardGateMissingCount =
          structuredDebug.structured.status === "available"
            ? structuredDebug.structured.hardGateMissing.length
            : null;

        return buildLiveMatchReviewRecord({
          jobId: String(job._id),
          jobTitle: job.title,
          company: job.company,
          profileLabel:
            storedResume.resumeName ??
            (matchReadProfile as any)?.name ??
            (matchReadProfile as any)?.profileId ??
            null,
          tier: matchRead.tier,
          matchReview,
          visibleRequirements: visibleExtraction.requirements,
          hardGateMissingCount,
        });
      }),
    );
  },
});

export const listArchivedForUser = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      company: v.string(),
      location: v.string(),
      isSample: v.boolean(),
      isFavorite: v.boolean(),
      sourceUrl: v.string(),
      sourceDomain: v.string(),
      sourceType: v.string(),
      parseStatus: v.string(),
      reviewState: v.string(),
      matchTier: v.union(
        v.literal("strong"),
        v.literal("partial"),
        v.literal("weak"),
        v.literal("unknown"),
      ),
      status: v.string(),
      importedAt: v.number(),
      updatedAt: v.number(),
      lastOpenedAt: v.number(),
      lastActivityAt: v.number(),
      linkedDocumentCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const profiles = await listProfilesForClerk(ctx, identity.subject);
    if (profiles.length === 0) {
      return [];
    }

    return listProjectedJobsForProfiles(ctx, profiles, {
      includeArchived: true,
    });
  },
});

export const loadForUser = mutation({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      company: v.string(),
      location: v.string(),
      isSample: v.boolean(),
      isFavorite: v.boolean(),
      sourceUrl: v.string(),
      sourceDomain: v.string(),
      sourceType: v.string(),
      parseStatus: v.string(),
      reviewState: v.string(),
      matchTier: v.union(
        v.literal("strong"),
        v.literal("partial"),
        v.literal("weak"),
        v.literal("unknown"),
      ),
      status: v.string(),
      importedAt: v.number(),
      updatedAt: v.number(),
      lastOpenedAt: v.number(),
      lastActivityAt: v.number(),
      linkedDocumentCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const profile = await requireCanonicalUserProfile(ctx);
    return listProjectedJobsForProfile(ctx, profile, { trackMatchRead: true });
  },
});

export const setResumeForJob = mutation({
  args: {
    jobId: v.string(),
    resumeId: v.union(v.string(), v.null()),
    resumeName: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const profiles = await listProfilesForClerk(ctx, identity.subject);
    if (profiles.length === 0) {
      throw new Error("User profile not found");
    }

    const normalizedJobId = ctx.db.normalizeId("jobs", args.jobId);
    if (!normalizedJobId) {
      throw new Error("Invalid jobId");
    }

    const job = await ctx.db.get(normalizedJobId);
    if (
      !job ||
      !profiles.some((profile) => String(profile._id) === String(job.userId))
    ) {
      throw new Error("Job not found");
    }

    if (args.resumeId) {
      const resumeProfile = resolveResumeProfileById(profiles, args.resumeId);
      if (!resumeProfile) {
        throw new Error("Resume not found");
      }
      await backfillResumeProfileScoringFromCvDocument(ctx, resumeProfile);
    }

    await ctx.db.patch(normalizedJobId, {
      lastResumeId: args.resumeId ?? null,
      lastResumeName: args.resumeName ?? null,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const setJobFavorite = mutation({
  args: {
    jobId: v.string(),
    isFavorite: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const profiles = await listProfilesForClerk(ctx, identity.subject);
    if (profiles.length === 0) {
      throw new Error("User profile not found");
    }

    const normalizedJobId = ctx.db.normalizeId("jobs", args.jobId);
    if (!normalizedJobId) {
      throw new Error("Invalid jobId");
    }

    const job = await ctx.db.get(normalizedJobId);
    if (
      !job ||
      !profiles.some((profile) => String(profile._id) === String(job.userId))
    ) {
      throw new Error("Job not found");
    }

    await ctx.db.patch(normalizedJobId, {
      isFavorite: args.isFavorite,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const setDefaultResume = mutation({
  args: {
    resumeId: v.union(v.string(), v.null()),
    resumeName: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const profiles = await listProfilesForClerk(ctx, identity.subject);
    const primaryProfile = profiles[0] ?? null;
    if (!primaryProfile) {
      throw new Error("User profile not found");
    }

    if (args.resumeId) {
      const resumeProfile = resolveResumeProfileById(profiles, args.resumeId);
      if (!resumeProfile) {
        throw new Error("Resume not found");
      }
    }

    await ctx.db.patch(primaryProfile._id, {
      defaultResumeId: args.resumeId ?? null,
      defaultResumeName: args.resumeName ?? null,
      updatedAt: Date.now(),
      version: (primaryProfile.version ?? 1) + 1,
    });

    return null;
  },
});

export const storeMatchReadSynthesis = internalMutation({
  args: {
    jobId: v.id("jobs"),
    cacheKey: v.string(),
    status: v.union(v.literal("ready"), v.literal("error")),
    provider: v.string(),
    model: v.string(),
    matched: v.optional(v.array(v.string())),
    missing: v.optional(v.array(v.string())),
    computedAt: v.optional(v.number()),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    estimatedCostUsd: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.matchReadSynthesis?.cacheKey !== args.cacheKey) {
      return null;
    }

    await ctx.db.patch(args.jobId, {
      matchReadSynthesis: {
        cacheKey: args.cacheKey,
        status: args.status,
        provider: args.provider,
        model: args.model,
        ...(args.matched ? { matched: args.matched } : {}),
        ...(args.missing ? { missing: args.missing } : {}),
        ...(args.computedAt ? { computedAt: args.computedAt } : {}),
        ...(args.promptTokens !== undefined
          ? { promptTokens: args.promptTokens }
          : {}),
        ...(args.completionTokens !== undefined
          ? { completionTokens: args.completionTokens }
          : {}),
        ...(args.estimatedCostUsd !== undefined
          ? { estimatedCostUsd: args.estimatedCostUsd }
          : {}),
        ...(args.error ? { error: args.error } : {}),
      },
    });

    return null;
  },
});

export const runMatchReadSynthesis = internalAction({
  args: {
    jobId: v.id("jobs"),
    cacheKey: v.string(),
    title: v.string(),
    company: v.string(),
    tier: v.union(
      v.literal("strong"),
      v.literal("partial"),
      v.literal("weak"),
      v.literal("unknown"),
    ),
    confidence: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    matched: v.array(v.string()),
    missing: v.array(v.string()),
  },
  returns: v.null(),
  handler: async () => {
    // Disabled: structured job extraction is now the only LLM-backed match engine.
    // This prevents stale queued synthesis work from spending tokens.
    return null;
  },
});

export const recordFirstRunPath = mutation({
  args: {
    path: v.union(
      v.literal("import"),
      v.literal("sample"),
      v.literal("bounce"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await scheduleFirstRunPathMetric(ctx, args.path);
    return null;
  },
});

export const trackEvent = mutation({
  args: {
    event: v.union(
      v.literal("job_opened"),
      v.literal("job_decision_made"),
      v.literal("match_read_computed"),
      v.literal("field_corrected"),
      v.literal("first_run_path"),
      v.literal("import_accepted"),
      v.literal("import_rejected"),
    ),
    jobId: v.optional(v.string()),
    path: v.optional(
      v.union(v.literal("import"), v.literal("sample"), v.literal("bounce")),
    ),
    outcome: v.optional(
      v.union(
        v.literal("cover_letter"),
        v.literal("resume"),
        v.literal("bounce"),
      ),
    ),
    timeToDecisionMs: v.optional(v.number()),
    fieldKey: v.optional(v.string()),
    beforeConfidence: v.optional(v.number()),
    hasMatchRead: v.optional(v.boolean()),
    reviewState: v.optional(v.string()),
    tier: v.optional(v.string()),
    confidence: v.optional(v.string()),
    method: v.optional(v.string()),
    fallback: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await ctx.scheduler.runAfter(
      0,
      internal.metrics.recordMetric,
      buildJobsMetricArgs(args),
    );
    return null;
  },
});

export const seedSampleJob = mutation({
  args: {},
  returns: v.object({
    jobId: v.string(),
  }),
  handler: async (ctx) => {
    const profile = await requireCanonicalUserProfile(ctx);
    const jobs = await listJobsForProfileId(ctx, String(profile._id));

    const activeSampleJob = jobs.find(
      (job: any) =>
        Boolean(job.isSample) &&
        (job.archivedAt === null || job.archivedAt === undefined),
    );

    if (activeSampleJob) {
      const now = Date.now();
      await ctx.db.patch(activeSampleJob._id, {
        lastOpenedAt: now,
        updatedAt: now,
      });
      await scheduleFirstRunPathMetric(ctx, "sample");
      return { jobId: String(activeSampleJob._id) };
    }

    const archivedSampleJob = jobs.find(
      (job: any) =>
        Boolean(job.isSample) &&
        job.archivedAt !== null &&
        job.archivedAt !== undefined,
    );

    if (archivedSampleJob) {
      const now = Date.now();
      await ctx.db.patch(archivedSampleJob._id, {
        archivedAt: null,
        lastOpenedAt: now,
        updatedAt: now,
      });
      await scheduleFirstRunPathMetric(ctx, "sample");
      return { jobId: String(archivedSampleJob._id) };
    }

    const now = Date.now();
    const sampleJob = buildSampleJobDraft(now);
    const jobId = await ctx.db.insert("jobs", {
      userId: profile._id,
      ...sampleJob,
    });
    await scheduleFirstRunPathMetric(ctx, "sample");
    return { jobId: String(jobId) };
  },
});

export const markOpened = mutation({
  args: {
    jobId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { normalizedJobId } = await requireJobForLinkedProfile(ctx, args.jobId);

    const now = Date.now();
    await ctx.db.patch(normalizedJobId, {
      lastOpenedAt: now,
      updatedAt: now,
    });

    return null;
  },
});

export const refreshStructuredMatch = mutation({
  args: {
    jobId: v.string(),
  },
  returns: v.object({
    queued: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { normalizedJobId, job } = await requireJobForLinkedProfile(
      ctx,
      args.jobId,
    );

    if (!String(job.rawDescription ?? "").trim()) {
      return { queued: false };
    }

    const jobTextHash = await hashNormalizedJobText(job.rawDescription);
    const model = resolveJobExtractionModel();
    const existingRows = await ctx.db
      .query("job_extraction_shadow")
      .withIndex("by_job_id", (q) => q.eq("job_id", normalizedJobId))
      .collect();
    const hasCurrentValidExtraction = existingRows.some(
      (row) =>
        row.job_text_hash === jobTextHash &&
        row.model === model &&
        row.prompt_version === PROMPT_VERSION &&
        row.validation_status === "valid" &&
        row.fallback_used === false,
    );
    if (hasCurrentValidExtraction) {
      return { queued: false };
    }

    await ctx.scheduler.runAfter(
      0,
      (internal as any).jobsPublic.runShadowJobExtraction,
      { jobId: normalizedJobId, force: true },
    );

    return { queued: true };
  },
});

export const updateField = mutation({
  args: {
    jobId: v.string(),
    fieldKey: v.string(),
    value: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { normalizedJobId, job } = await requireJobForLinkedProfile(
      ctx,
      args.jobId,
    );

    const now = Date.now();
    const reviewItems = resolveReviewItemsAfterFieldUpdate({
      reviewItems: job.reviewItems ?? [],
      fieldKey: args.fieldKey,
      nextValue: args.value,
      now,
    });

    await ctx.db.patch(normalizedJobId, {
      [args.fieldKey]: args.value,
      reviewItems,
      reviewState: resolveCanonicalJobReviewState(reviewItems),
      updatedAt: now,
    });

    return null;
  },
});

export const approveReviewItem = mutation({
  args: {
    jobId: v.string(),
    reviewItemId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { normalizedJobId, job } = await requireJobForLinkedProfile(
      ctx,
      args.jobId,
    );

    const now = Date.now();
    const visibleExtraction = await resolveVisibleExtractionForJob(ctx, job);
    const projectedReviewItems = projectReviewItemsWithVisibleExtraction({
      reviewItems: job.reviewItems ?? [],
      visibleExtraction,
    });
    const reviewItems = resolveReviewItemsAfterApprove({
      reviewItems: projectedReviewItems,
      reviewItemId: args.reviewItemId,
      now,
    });
    const approvedItem = reviewItems.find(
      (item) => item.id === args.reviewItemId,
    );

    await ctx.db.patch(normalizedJobId, {
      ...(approvedItem
        ? {
            [approvedItem.fieldKey]:
              approvedItem.approvedValue ?? approvedItem.suggestedValue,
          }
        : {}),
      reviewItems,
      reviewState: resolveCanonicalJobReviewState(reviewItems),
      updatedAt: now,
    });

    return null;
  },
});

export const archiveJob = mutation({
  args: {
    jobId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { normalizedJobId } = await requireJobForLinkedProfile(
      ctx,
      args.jobId,
    );

    const now = Date.now();
    await ctx.db.patch(normalizedJobId, {
      archivedAt: now,
      updatedAt: now,
    });

    return null;
  },
});

export const restoreArchivedJob = mutation({
  args: {
    jobId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { normalizedJobId } = await requireJobForLinkedProfile(
      ctx,
      args.jobId,
    );

    await ctx.db.patch(normalizedJobId, {
      archivedAt: null,
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const deleteArchivedJob = mutation({
  args: {
    jobId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { normalizedJobId, job } = await requireJobForLinkedProfile(
      ctx,
      args.jobId,
    );
    if (job.archivedAt === null || job.archivedAt === undefined) {
      throw new Error("Archived job not found");
    }

    await ctx.db.delete(normalizedJobId);

    return null;
  },
});

export const duplicateJob = mutation({
  args: {
    jobId: v.string(),
  },
  returns: v.object({
    jobId: v.string(),
  }),
  handler: async (ctx, args) => {
    const { job } = await requireJobForLinkedProfile(ctx, args.jobId);

    const now = Date.now();
    const duplicatedJobId = await ctx.db.insert("jobs", {
      userId: job.userId,
      createdAt: now,
      updatedAt: now,
      importedAt: now,
      lastOpenedAt: now,
      sourceUrl: job.sourceUrl,
      sourceDomain: job.sourceDomain,
      sourceType: job.sourceType,
      applicationUrl: job.applicationUrl,
      dedupeKey: `${job.dedupeKey}-copy-${now}`,
      parseVersion: job.parseVersion,
      parseStatus: job.parseStatus,
      reviewState: job.reviewState,
      title: job.title,
      company: job.company,
      location: job.location,
      rawDescription: job.rawDescription,
      rawLanguageDetected: job.rawLanguageDetected,
      summary: job.summary,
      ...(job.summaryExtraction
        ? { summaryExtraction: job.summaryExtraction }
        : {}),
      responsibilities: job.responsibilities ?? [],
      ...(job.responsibilitiesExtraction
        ? { responsibilitiesExtraction: job.responsibilitiesExtraction }
        : {}),
      keywords: job.keywords ?? [],
      ...(job.keywordsExtraction
        ? { keywordsExtraction: job.keywordsExtraction }
        : {}),
      mustHaves: job.mustHaves ?? [],
      ...(job.mustHavesExtraction
        ? { mustHavesExtraction: job.mustHavesExtraction }
        : {}),
      toneCues: job.toneCues ?? [],
      ...(job.toneCuesExtraction
        ? { toneCuesExtraction: job.toneCuesExtraction }
        : {}),
      contacts: job.contacts ?? [],
      isSample: false,
      isFavorite: Boolean(job.isFavorite),
      status: job.status,
      archivedAt: null,
      reviewItems: job.reviewItems ?? [],
    });

    return { jobId: String(duplicatedJobId) };
  },
});

export const parseCreatedJob = internalMutation({
  args: {
    jobId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const normalizedJobId = ctx.db.normalizeId("jobs", args.jobId);
    if (!normalizedJobId) {
      return null;
    }

    const job = await ctx.db.get(normalizedJobId);
    if (!job) {
      return null;
    }

    try {
      const draft = buildCanonicalJobDraftFromSource({
        title: job.title,
        rawDescription: job.rawDescription,
        sourceUrl: job.sourceUrl,
        sourceDomain: job.sourceDomain,
        sourceType: job.sourceType,
        applicationUrl: job.applicationUrl,
      });

      await ctx.db.patch(normalizedJobId, {
        company: resolveReparsedCompany({
          existingCompany: job.company,
          parsedCompany: draft.company,
        }),
        location: resolveReparsedLocation({
          existingLocation: job.location,
          parsedLocation: draft.location,
        }),
        rawLanguageDetected: draft.rawLanguageDetected,
        summary: draft.summary,
        summaryExtraction: draft.summaryExtraction,
        responsibilities: draft.responsibilities,
        responsibilitiesExtraction: draft.responsibilitiesExtraction,
        keywords: draft.keywords,
        keywordsExtraction: draft.keywordsExtraction,
        mustHaves: draft.mustHaves,
        mustHavesExtraction: draft.mustHavesExtraction,
        toneCues: draft.toneCues,
        toneCuesExtraction: draft.toneCuesExtraction,
        contacts: draft.contacts,
        parseVersion: draft.parseVersion,
        parseStatus: "parsed",
        reviewState: draft.reviewState,
        reviewItems: draft.reviewItems,
        updatedAt: Date.now(),
      });

      if (isJobLlmExtractionShadowEnabled()) {
        // Pass 2 guardrail: keep any future visible_source_decision stable per job.
        // Shadow output must not flip UI/source behavior after the heuristic parse is shown.
        await ctx.scheduler.runAfter(
          0,
          (internal as any).jobsPublic.runShadowJobExtraction,
          { jobId: normalizedJobId },
        );
      }
    } catch (error) {
      console.error("[jobsPublic.parseCreatedJob] parse failed", error);
      await ctx.db.patch(normalizedJobId, {
        parseStatus: "failed",
        reviewState: "pending",
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});
