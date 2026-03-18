// convex/generateProposalMutation.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { ConvexError } from "convex/values";
import { ProposalService } from "./langchain";
import { GPT4Adapter } from "./langchain/models/gpt4_adapter";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatMistralAI } from "@langchain/mistralai";
import { Mistral } from "@mistralai/mistralai";
import { parseProposalContent } from "./langchain/types";
import {
  resolveEffectiveProposalTone,
  type EffectiveProposalTone,
} from "./lib/proposals/effectiveTone";
import {
  DEFAULT_PROPOSAL_VOICE_PRESET,
  IDENTITY_BACKGROUND_HARD_STOP_RULES,
  JOB_DESCRIPTION_TO_CANDIDATE_RULES,
  NO_CONTEXT_CANDIDATE_CLAIM_RULES,
  SOURCE_BACKED_SPECIFICITY_RULES,
  UNIVERSAL_PROPOSAL_VOICE_GUARDRAILS,
  UNSUPPORTED_PROPOSAL_CLAIMS_BLACKLIST,
  getProposalVoicePresetDefinition,
  normalizeProposalVoicePresetForMode,
  resolveProposalVoicePreset,
  type ProposalVoicePreset,
} from "./lib/proposals/voicePresets";
import {
  PROPOSAL_ALLOWED_CAUTIOUS_BRIDGES,
  PROPOSAL_FORBIDDEN_BRIDGES,
  PROPOSAL_GENERIC_FUTURE_VALUE_TARGETS,
  PROPOSAL_GENERIC_FUTURE_VALUE_VERBS,
  PROPOSAL_PLANNER_SCHEMA,
  buildProposalPlannerPrompt,
  buildProposalSourceFactBank,
  buildProposalWriterPlanBlock,
  containsForbiddenProposalBridge,
  computeProposalPlannerContextMode,
  normalizeProposalPlannerResult,
  normalizeProposalConstraintText,
  type ProposalPlannerContextMode,
  type ProposalPlannerResult,
} from "./lib/proposals/proposalPlanner";
import {
  STRUCTURED_COVER_LETTER_CONTENT_PLAN_SCHEMA,
  buildStructuredCoverLetterContentPlanPrompt,
  parseStructuredCoverLetterBody,
  validateStructuredCoverLetterContentPlan,
  type StructuredCoverLetterContentPlan,
} from "./lib/proposals/proposalContentPlan";
import {
  buildStructuredCoverLetterComposerPrompt,
  buildStructuredCoverLetterComposerRetryPrompt,
} from "./lib/proposals/proposalBodyComposer";
import {
  buildProposalOutputLanguageInstruction,
  resolveProposalOutputLanguage,
  resolveStoredProposalTitle,
  type ProposalOutputLanguage,
} from "./lib/proposals/proposalOutput";
import {
  ENGLISH_APPLICATION_MESSAGE_FINAL_SENTENCE,
  ENGLISH_SAFE_FINAL_SENTENCES,
  ENGLISH_SIGNOFFS,
  FRENCH_APPLICATION_MESSAGE_FINAL_SENTENCE,
  FRENCH_SAFE_FINAL_SENTENCES,
  FRENCH_SIGNOFFS,
  applyDeterministicProposalBoundaries,
  getDeterministicProposalRenderPolicy,
  parseStructuredApplicationMessageParts,
  renderStructuredApplicationMessage,
  renderStructuredCoverLetter,
} from "./lib/proposals/proposalRenderer";
import {
  attemptPremiumCoverLetterGeneration,
  buildJobOfferPriorityPack,
  evaluatePremiumCoverLetterEligibility,
  generatePremiumCoverLetterBodyPartsWithOpenAI,
  isCoverLetterPremiumPathV1Enabled,
  resolvePremiumCoverLetterWriterModel,
} from "./lib/proposals/premiumCoverLetter";
import {
  analyzeProposalDraft,
  applyProposalSentencePatches,
  buildProposalRepairPrompt,
  extractProposalBodyForRepair,
  extractFinalProposalContent,
  getDeterministicInterestOnlyRepairSentence,
  hasOverProjectiveRepairWording,
  hasStrictNoContextRepairViolation,
  repairProposalSentenceLocally,
} from "./lib/proposals/proposalEnforcement";

export { getDeterministicProposalRenderPolicy };

const modelChoice = v.union(
  v.literal("chatgpt"),
  v.literal("mistral-large-latest"),
  v.literal("mistral-small-latest"),
  v.literal("mistral-agent"),
);

const proposalTypeChoice = v.union(
  v.literal("technical"),
  v.literal("creative"),
  v.literal("cover_letter"),
  v.literal("application_message"),
  v.literal("freelance_proposal"),
);

const proposalVoicePresetChoice = v.union(
  v.literal("signature"),
  v.literal("expert"),
  v.literal("direct"),
  v.literal("engaging"),
  v.literal("storyteller"),
);

export const personalizationContextValidator = v.object({
  name: v.optional(v.string()),
  summary: v.optional(v.string()),
  desiredPosition: v.optional(v.string()),
  topSkills: v.optional(v.array(v.string())),
  recentExperience: v.optional(
    v.array(
      v.object({
        company: v.optional(v.string()),
        position: v.optional(v.string()),
        highlights: v.optional(v.array(v.string())),
      }),
    ),
  ),
  standoutAchievements: v.optional(v.array(v.string())),
});

const personalizationRichnessChoice = v.union(
  v.literal("none"),
  v.literal("minimal"),
  v.literal("sparse"),
  v.literal("rich"),
);

const personalizationModeChoice = v.union(
  v.literal("default"),
  v.literal("explicit_only"),
);

type PersonalizationContext = {
  name?: string;
  summary?: string;
  desiredPosition?: string;
  topSkills?: string[];
  recentExperience?: Array<{
    company?: string;
    position?: string;
    highlights?: string[];
  }>;
  standoutAchievements?: string[];
};

type PersonalizationRichness = "none" | "minimal" | "sparse" | "rich";
type PersonalizationMode = "default" | "explicit_only";

export type GenerateProposalArgs = {
  jobTitle: string;
  jobDescription: string;
  proposalType:
    | "technical"
    | "creative"
    | "cover_letter"
    | "application_message"
    | "freelance_proposal";
  voicePreset?: ProposalVoicePreset;
  formalityLevel?: string;
  creativity?: string;
  modelType?:
    | "chatgpt"
    | "mistral-large-latest"
    | "mistral-small-latest"
    | "mistral-agent";
  agentId?: string;
  personalizationContext?: PersonalizationContext;
  personalizationRichness?: PersonalizationRichness;
  personalizationMode?: PersonalizationMode;
};

export const generateProposalArgs = {
  jobTitle: v.string(),
  jobDescription: v.string(),
  proposalType: proposalTypeChoice,
  voicePreset: v.optional(proposalVoicePresetChoice),
  formalityLevel: v.optional(v.string()),
  creativity: v.optional(v.string()),
  modelType: v.optional(modelChoice),
  agentId: v.optional(v.string()),
  personalizationContext: v.optional(personalizationContextValidator),
  personalizationRichness: v.optional(personalizationRichnessChoice),
  personalizationMode: v.optional(personalizationModeChoice),
};

type ProfileFallbackDoc = {
  name?: string;
  summary?: string;
  skills?: string[];
  achievements?: string[];
  proposalVoicePreset?: string | null;
  experience?: Array<{
    company?: string;
    title?: string;
    description?: string;
  }>;
};

type OutputFormat =
  | "cover_letter"
  | "application_message"
  | "freelance_proposal";

const MAX_SUMMARY_LENGTH = 240;
const MAX_SKILLS = 8;
const MAX_RECENT_EXPERIENCE = 3;
const MAX_HIGHLIGHTS_PER_EXPERIENCE = 2;
const MAX_HIGHLIGHT_LENGTH = 110;
const MAX_ACHIEVEMENTS = 4;
const APPLICATION_MESSAGE_REQUIREMENT_YEAR_RANGE_PATTERN =
  /\b\d+\s*(?:[-–]\s*\d+|\+)\s+years?\b/i;
const APPLICATION_MESSAGE_REQUIREMENT_STYLE_PATTERNS = [
  /\b(?:requirements?|qualifications?)\b/i,
  /\baligns?\s+well\s+with\s+(?:the\s+)?requirements?\b/i,
  /\bcustomer-?facing\s+environments?\b/i,
  /\bretail(?:\/| and )apparel\b/i,
  /\bretail\s+environments?\b/i,
  /\bapparel\s+environments?\b/i,
  /\bminimum\b[^.!?\n]{0,40}\byears?\b/i,
  /\bat\s+least\b[^.!?\n]{0,40}\byears?\b/i,
] as const;
const META_OUTPUT_PREFIX_PATTERNS = [
  /^(?:here(?:'s| is)\s+(?:a\s+)?(?:concise|brief|short|interest-led|interest first|refined|repaired|corrected)\s+(?:cover letter|application message|message|proposal|draft)\b.*)$/i,
  /^(?:here(?:'s| is)\s+(?:the\s+)?(?:proposal|cover letter|message|response)\b.*)$/i,
  /^(?:here(?:'s| is)|below is)\s+(?:the\s+)?(?:tailored|custom(?:ized)?|personalized)\s+(?:employment\s+)?(?:cover letter|application message|message|proposal)\b.*$/i,
  /^(?:cover letter|application message|message|proposal)(?:\s+for\b.*)?[:.!…-]*$/i,
  /^(?:the following\s+(?:letter|proposal|message)\b.*)$/i,
  /^(?:i have written\b.*)$/i,
  /^(?:below is my response\b.*)$/i,
];
const META_OUTPUT_SENTENCE_PATTERNS = [
  /^(?:here(?:'s| is)\b.*)$/i,
  /^(?:cover letter|application message|message|proposal)(?:\s+for\b.*)?[:.!…-]*$/i,
  /^(?:the following\b.*)$/i,
  /^(?:i have written\b.*)$/i,
  /^(?:below is my response\b.*)$/i,
] as const;
const WORD_COUNT_META_LINE_PATTERN = /^\(?\s*word\s+count\s*:\s*\d+\s*\)?$/i;
const PLACEHOLDER_SIGNATURE_PATTERNS = [
  /^\[\s*your\s+name\s*\]$/i,
  /^\[\s*candidate\s+name\s*\]$/i,
] as const;
const ENGLISH_SAFE_FREELANCE_FINAL_SENTENCE =
  "I’d welcome the opportunity to discuss the project further.";
const FRENCH_SAFE_FREELANCE_FINAL_SENTENCE =
  "Je serais disponible pour échanger davantage au sujet du projet.";

const FINAL_SAVED_ALIGNMENT_TARGET_PATTERN =
  /\b(?:your\s+(?:need|needs|need\s+for|emphasis|responsibilit(?:y|ies)|goals?|mission|requirements?)|what\s+you(?:['’]re| are)\s+looking\s+for|the\s+(?:role|position|job|opportunity|requirements?|role\s+requirements|technical\s+requirements)|the\s+responsibilit(?:y|ies)(?:\s+you(?:['’]ve| have)\s+outlined)?|the\s+responsibilities\s+described|responsibilities\s+described|the\s+technical\s+and\s+collaborative\s+aspects\s+of\s+the\s+position|requirements?|responsibilit(?:y|ies)|need(?:s)?|need\s+for|opportunity)\b/i;
const FINAL_SAVED_ALIGNMENT_SPLIT_PATTERN =
  /\baligns?(?:\s+well)?\s+with\b/i;
const FINAL_SAVED_REQUIRED_FOR_THIS_ROLE_ALIGNMENT_PATTERN =
  /\baligns?(?:\s+well)?\s+with\b[^.!?\n]{0,140}\brequired\s+for\s+this\s+role\b/i;
const FINAL_SAVED_ALIGNMENT_CANDIDATE_SIDE_PATTERN =
  /\b(?:my|this|that|these|those)\s+(?:background|experience|experiences?|approach|skills?|expertise|work|mindset|ability|interest|curiosity|focus|collaborative\s+approach|cross-functional\s+mindset|hands-on\s+experience|professional\s+curiosity)\b|\b(?:background|experience|interest)\s+in\b|\bi(?:'m| am)\s+interested\b/i;
const FINAL_SAVED_ALIGNMENT_CLOSING_PREFIX_PATTERN =
  /^(?:let\s+me\s+know\s+if|if\b)/i;
const FINAL_SAVED_COULD_TEAM_VALUE_PATTERN =
  /\bcould\b[^.!?\n]{0,80}\b(?:team|teams|operations|goals?|mission|needs?)\b/i;
const FINAL_SAVED_MODAL_BRIDGE_START_PATTERN =
  /\b(?:could|would|can|will|may|might)\b[^.!?\n]{0,24}\b(?:support|contribute|help|add|inform|benefit|strengthen|guide)\b/i;
const FINAL_SAVED_WEAK_TRANSFER_PATTERN =
  /\b(?:resonates with|particularly compelling|translate(?:s|d)? well(?:\s+to)?|translates directly to|strong foundation for|positions me to)\b/i;

type StructuredCoverLetterFallbackReason =
  | "structured_plan_parse_fail"
  | "structured_plan_validation_fail"
  | "structured_body_generation_fail"
  | "structured_body_validation_fail"
  | "structured_render_fail"
  | "structured_verify_fail"
  | "structured_repair_fail"
  | "structured_repair_validation_fail"
  | "premium_generation_failed";

type StructuredCoverLetterAttemptResult = {
  content: string;
  sections: Array<{
    type: "text";
    content: string;
  }>;
  residualVerifierWarningTag: string | null;
  generationPath: "structured_success" | "structured_repaired_success";
};

type ProposalGenerationPathLabel =
  | "premium success"
  | "premium fail-closed to legacy fallback"
  | "structured success"
  | "structured repaired success"
  | "structured fail-closed to legacy fallback"
  | "application-message inline path"
  | "legacy-only path after planner bypass"
  | "legacy-only path";

type CoverLetterTelemetryAttemptedPathLabel =
  | ProposalGenerationPathLabel
  | "planner-only path before structured generation"
  | "planner-only path before legacy generation"
  | "structured-only path before legacy fallback";

type ProposalProviderBusyStage =
  | "planner_parse"
  | "planner_json_retry"
  | "structured_plan_parse"
  | "structured_plan_json_retry"
  | "structured_body_generation"
  | "legacy_generation"
  | "repair";

type StructuredCoverLetterRolloutFallbackReason =
  | "not_applicable"
  | "rollout_disabled"
  | "model_not_in_rollout"
  | "output_format_not_cover_letter"
  | "flag_disabled"
  | "missing_candidate_context"
  | "empty_source_fact_bank"
  | "polluted_source_fact_bank"
  | "preset_not_supported"
  | "unsupported_context_class"
  | "no_allowed_facts"
  | "planner_dependency_bypassed"
  | "provider_busy"
  | StructuredCoverLetterFallbackReason;

type ProposalRoutingPlannedPath = "structured" | "legacy";
type ProposalRoutingExecutedPath = "structured" | "legacy";
type ProposalValidatorOutcome =
  | "not_run"
  | "structured_success"
  | "structured_repaired_success"
  | "structured_failed"
  | "legacy_verified_clean"
  | "legacy_verified_warning";
type ProposalSaveOutcome =
  | "not_saved"
  | "structured_saved"
  | "legacy_saved_parsed"
  | "legacy_saved_raw"
  | "legacy_saved_after_parse_error"
  | "fail_closed";

type ProposalRoutingTrace = {
  plannedPath: ProposalRoutingPlannedPath;
  executedPath: ProposalRoutingExecutedPath;
  fallbackReason: StructuredCoverLetterRolloutFallbackReason;
  validatorOutcome: ProposalValidatorOutcome;
  saveOutcome: ProposalSaveOutcome;
};

type ProposalModelType = NonNullable<GenerateProposalArgs["modelType"]>;
type ProposalFallbackTriggerCode =
  | "proposal_generation_provider_busy"
  | "proposal_generation_provider_transport_error";

type ProposalExecutionProvenance = {
  requestedModelType: ProposalModelType;
  actualModelType: ProposalModelType;
  fallbackTriggerCode: ProposalFallbackTriggerCode | null;
};

type MistralDiagnosticStage = ProposalProviderBusyStage | "agent_generation";
type MistralDiagnosticStatus =
  | "success"
  | "failed_busy"
  | "failed_transport"
  | "failed_other";

type MistralCallDiagnostic = {
  sequence: number;
  stage: MistralDiagnosticStage;
  modelType: ProposalModelType;
  approximateInputChars: number;
  approximateInputTokens: number;
  approximateOutputChars: number | null;
  approximateOutputTokens: number | null;
  status: MistralDiagnosticStatus;
};

type MistralDiagnosticsAccumulator = {
  calls: MistralCallDiagnostic[];
  nextSequence: number;
};

type MistralDiagnosticSummary = {
  mistralCallCount: number;
  totalApproximateInputChars: number;
  totalApproximateInputTokens: number;
  totalApproximateOutputCharsKnown: number;
  totalApproximateOutputTokensKnown: number;
  perStageBreakdown: Record<
    string,
    {
      count: number;
      approximateInputChars: number;
      approximateInputTokens: number;
      approximateOutputCharsKnown: number;
      approximateOutputTokensKnown: number;
    }
  >;
  calls: MistralCallDiagnostic[];
};

export type CoverLetterRoutingTelemetry = {
  preset: ProposalVoicePreset;
  hasCv: boolean;
  contextMode: ProposalPlannerContextMode;
  resolvedStructuredRolloutMode: StructuredMistralCoverLetterRolloutMode;
  structuredEligible: boolean;
  structuredEligibilityReason: string;
  outcomeClass:
    | "success"
    | "provider_busy"
    | "provider_transport_error"
    | "other_controlled_failure"
    | "unexpected_failure";
  normalizedFailureCode: string | null;
  runtimeFailureReason: string | null;
  counterfactualNextStructuredGate:
    | Exclude<StructuredCoverLetterRolloutFallbackReason, "rollout_disabled">
    | "eligible";
  attemptedPath: CoverLetterTelemetryAttemptedPathLabel;
  requestedModelType: ProposalModelType;
  actualModelType: ProposalModelType;
  fallbackTriggerCode: ProposalFallbackTriggerCode | null;
  usedFallback: boolean;
  finalOutcome: ProposalSaveOutcome;
  failureStage: CoverLetterTelemetryFailureStage | null;
};

type StructuredCoverLetterRolloutEligibility = {
  eligible: boolean;
  plannedPath: ProposalRoutingPlannedPath;
  fallbackReason: StructuredCoverLetterRolloutFallbackReason;
  sourceFactBankWarnings: string[];
};

export type StructuredMistralCoverLetterRolloutMode =
  | "disabled"
  | "small_cover_letters"
  | "all_cover_letters";

const CONTROLLED_PROPOSAL_PROVIDER_BUSY_CODE =
  "proposal_generation_provider_busy";
const CONTROLLED_PROPOSAL_PROVIDER_BUSY_MESSAGE =
  "Proposal generation is temporarily busy because the model provider is rate limited.";
const CONTROLLED_PROPOSAL_PROVIDER_BUSY_MESSAGE_PREFIX =
  "Proposal generation provider busy.";
const CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_CODE =
  "proposal_generation_provider_transport_error";
const CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_MESSAGE =
  "Proposal generation is temporarily unavailable because the model provider request could not be completed. Please try again.";
const CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_MESSAGE_PREFIX =
  "Proposal generation provider transport error.";
const CONTROLLED_PROPOSAL_FINALIZATION_FAILURE_TELEMETRY_CODE =
  "proposal_generation_finalization_failed_closed";

function isMistralModel(modelType: ProposalModelType): boolean {
  return (
    modelType === "mistral-small-latest" ||
    modelType === "mistral-large-latest" ||
    modelType === "mistral-agent"
  );
}

function logProposalFallbackActivation(args: {
  requestedModelType: ProposalModelType;
  fallbackModelType: ProposalModelType;
  triggerCode: ProposalFallbackTriggerCode;
  triggerStage: CoverLetterTelemetryFailureStage;
  hasCv: boolean;
  attemptedPath: ProposalGenerationPathLabel;
}): void {
  console.info("Proposal generation fallback activation", {
    requestedModelType: args.requestedModelType,
    fallbackModelType: args.fallbackModelType,
    triggerCode: args.triggerCode,
    triggerStage: args.triggerStage,
    hasCv: args.hasCv,
    attemptedPath: args.attemptedPath,
  });
}

function estimateApproximateTokenCountFromChars(charCount: number): number {
  if (charCount <= 0) return 0;
  return Math.ceil(charCount / 4);
}

function createMistralDiagnosticsAccumulator(): MistralDiagnosticsAccumulator {
  return {
    calls: [],
    nextSequence: 1,
  };
}

function canAttemptProposalFallback(args: {
  requestedModelType: ProposalModelType;
  outputFormat: OutputFormat;
  normalizedFailureCode: string | null;
  failureStage: CoverLetterTelemetryFailureStage | null;
  hasAttemptedFallback: boolean;
}): args is {
  requestedModelType: ProposalModelType;
  outputFormat: OutputFormat;
  normalizedFailureCode: ProposalFallbackTriggerCode;
  failureStage: "legacy_generation";
  hasAttemptedFallback: false;
} {
  return (
    !args.hasAttemptedFallback &&
    isMistralModel(args.requestedModelType) &&
    args.requestedModelType !== "chatgpt" &&
    args.outputFormat === "cover_letter" &&
    args.failureStage === "legacy_generation" &&
    (args.normalizedFailureCode === CONTROLLED_PROPOSAL_PROVIDER_BUSY_CODE ||
      args.normalizedFailureCode ===
        CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_CODE)
  );
}

class ProposalProviderBusyError extends Error {
  provider: "mistral";
  stage: ProposalProviderBusyStage;
  retryAfterMs?: number;

  constructor(args: {
    provider: "mistral";
    stage: ProposalProviderBusyStage;
    retryAfterMs?: number;
  }) {
    super(
      [
        CONTROLLED_PROPOSAL_PROVIDER_BUSY_MESSAGE_PREFIX,
        `provider=${args.provider}`,
        `stage=${args.stage}`,
        typeof args.retryAfterMs === "number"
          ? `retryAfterMs=${args.retryAfterMs}`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
    this.name = "ProposalProviderBusyError";
    this.provider = args.provider;
    this.stage = args.stage;
    this.retryAfterMs = args.retryAfterMs;
  }
}

class ProposalProviderTransportError extends Error {
  provider: "mistral";
  stage: ProposalProviderBusyStage;
  statusCode?: number;

  constructor(args: {
    provider: "mistral";
    stage: ProposalProviderBusyStage;
    statusCode?: number;
  }) {
    super(
      [
        CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_MESSAGE_PREFIX,
        `provider=${args.provider}`,
        `stage=${args.stage}`,
        typeof args.statusCode === "number" ? `statusCode=${args.statusCode}` : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
    this.name = "ProposalProviderTransportError";
    this.provider = args.provider;
    this.stage = args.stage;
    this.statusCode = args.statusCode;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getHeaderValue(
  headers: unknown,
  headerName: string,
): string | undefined {
  const normalizedName = headerName.toLowerCase();
  if (!headers) return undefined;

  if (headers instanceof Headers) {
    return headers.get(headerName) ?? headers.get(normalizedName) ?? undefined;
  }

  if (Array.isArray(headers)) {
    for (const entry of headers) {
      if (
        Array.isArray(entry) &&
        entry.length >= 2 &&
        typeof entry[0] === "string" &&
        entry[0].toLowerCase() === normalizedName
      ) {
        return String(entry[1]);
      }
    }
    return undefined;
  }

  if (!isRecord(headers)) return undefined;

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== normalizedName) continue;
    if (Array.isArray(value)) {
      const firstValue = value[0];
      return typeof firstValue === "string" ? firstValue : String(firstValue);
    }
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
  }

  return undefined;
}

function parseRetryAfterMsValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.ceil(value);
  }
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.ceil(numeric);
  }
  const parsedDate = Date.parse(normalized);
  if (!Number.isNaN(parsedDate)) {
    return Math.max(0, parsedDate - Date.now());
  }
  return undefined;
}

function parseRetryAfterSecondsOrDate(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.ceil(value * 1000);
  }
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.ceil(numeric * 1000);
  }
  const parsedDate = Date.parse(normalized);
  if (!Number.isNaN(parsedDate)) {
    return Math.max(0, parsedDate - Date.now());
  }
  return undefined;
}

function getRetryAfterMsFromHeaders(headers: unknown): number | undefined {
  return (
    parseRetryAfterMsValue(getHeaderValue(headers, "retry-after-ms")) ??
    parseRetryAfterSecondsOrDate(getHeaderValue(headers, "retry-after"))
  );
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (isRecord(value)) return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getNestedRecordValue(
  value: Record<string, unknown> | null,
  key: string,
): unknown {
  if (!value) return undefined;
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey.toLowerCase() === key.toLowerCase()) {
      return entryValue;
    }
  }
  return undefined;
}

function getErrorStatusCode(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;

  const directStatus =
    getNestedRecordValue(error, "statusCode") ??
    getNestedRecordValue(error, "status") ??
    getNestedRecordValue(error, "status_code");
  if (typeof directStatus === "number") return directStatus;
  if (typeof directStatus === "string" && directStatus.trim()) {
    const numeric = Number(directStatus);
    if (Number.isFinite(numeric)) return numeric;
  }

  const rawResponse = getNestedRecordValue(error, "rawResponse");
  if (isRecord(rawResponse)) {
    const rawStatus = getNestedRecordValue(rawResponse, "status");
    if (typeof rawStatus === "number") return rawStatus;
    if (typeof rawStatus === "string" && rawStatus.trim()) {
      const numeric = Number(rawStatus);
      if (Number.isFinite(numeric)) return numeric;
    }
  }

  const response = getNestedRecordValue(error, "response");
  if (isRecord(response)) {
    const responseStatus = getNestedRecordValue(response, "status");
    if (typeof responseStatus === "number") return responseStatus;
    if (typeof responseStatus === "string" && responseStatus.trim()) {
      const numeric = Number(responseStatus);
      if (Number.isFinite(numeric)) return numeric;
    }
  }

  const parsedBody =
    parseJsonRecord(getNestedRecordValue(error, "body")) ??
    parseJsonRecord(getNestedRecordValue(error, "responseBody"));
  const bodyStatus =
    getNestedRecordValue(parsedBody, "status") ??
    getNestedRecordValue(parsedBody, "status_code");
  if (typeof bodyStatus === "number") return bodyStatus;
  if (typeof bodyStatus === "string" && bodyStatus.trim()) {
    const numeric = Number(bodyStatus);
    if (Number.isFinite(numeric)) return numeric;
  }

  return undefined;
}

function extractRetryAfterMsFromError(error: unknown): number | undefined {
  if (!isRecord(error)) return undefined;

  const directRetryAfterMs =
    parseRetryAfterMsValue(getNestedRecordValue(error, "retryAfterMs")) ??
    parseRetryAfterSecondsOrDate(getNestedRecordValue(error, "retryAfter"));
  if (typeof directRetryAfterMs === "number") return directRetryAfterMs;

  const rawResponse = getNestedRecordValue(error, "rawResponse");
  const rawHeaders =
    isRecord(rawResponse) || rawResponse instanceof Headers
      ? getNestedRecordValue(
          rawResponse as Record<string, unknown>,
          "headers",
        ) ?? rawResponse
      : rawResponse;
  const rawRetryAfterMs = getRetryAfterMsFromHeaders(rawHeaders);
  if (typeof rawRetryAfterMs === "number") return rawRetryAfterMs;

  const response = getNestedRecordValue(error, "response");
  const responseHeaders =
    isRecord(response) || response instanceof Headers
      ? getNestedRecordValue(response as Record<string, unknown>, "headers") ??
        response
      : response;
  const responseRetryAfterMs = getRetryAfterMsFromHeaders(responseHeaders);
  if (typeof responseRetryAfterMs === "number") return responseRetryAfterMs;

  const parsedBody =
    parseJsonRecord(getNestedRecordValue(error, "body")) ??
    parseJsonRecord(getNestedRecordValue(error, "responseBody"));
  const bodyRetryAfterMs =
    parseRetryAfterMsValue(getNestedRecordValue(parsedBody, "retryAfterMs")) ??
    parseRetryAfterMsValue(getNestedRecordValue(parsedBody, "retry_after_ms")) ??
    parseRetryAfterSecondsOrDate(getNestedRecordValue(parsedBody, "retryAfter")) ??
    parseRetryAfterSecondsOrDate(getNestedRecordValue(parsedBody, "retry_after"));
  if (typeof bodyRetryAfterMs === "number") return bodyRetryAfterMs;

  return undefined;
}

function isMistralRateLimitError(error: unknown): boolean {
  if (getErrorStatusCode(error) === 429) return true;

  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`.toLowerCase()
      : String(error).toLowerCase();
  if (/\brate[_\s-]?limited\b/.test(message)) return true;
  if (/\b429\b/.test(message) && /\bstatus\b/.test(message)) return true;

  if (!isRecord(error)) return false;
  const parsedBody =
    parseJsonRecord(getNestedRecordValue(error, "body")) ??
    parseJsonRecord(getNestedRecordValue(error, "responseBody"));
  const bodyCode =
    getNestedRecordValue(parsedBody, "code") ??
    getNestedRecordValue(parsedBody, "type");
  if (typeof bodyCode === "string" && /rate[_\s-]?limited/i.test(bodyCode)) {
    return true;
  }

  const directCode =
    getNestedRecordValue(error, "code") ?? getNestedRecordValue(error, "type");
  return typeof directCode === "string" && /rate[_\s-]?limited/i.test(directCode);
}

function getMistralErrorSearchText(error: unknown): string {
  const parts: string[] = [];
  if (error instanceof Error) {
    parts.push(error.name, error.message);
  } else {
    parts.push(String(error));
  }

  if (isRecord(error)) {
    const body = getNestedRecordValue(error, "body");
    const responseBody = getNestedRecordValue(error, "responseBody");
    if (typeof body === "string") {
      parts.push(body);
    }
    if (typeof responseBody === "string") {
      parts.push(responseBody);
    }

    const parsedBody = parseJsonRecord(body) ?? parseJsonRecord(responseBody);
    const bodyMessage = getNestedRecordValue(parsedBody, "message");
    if (typeof bodyMessage === "string") {
      parts.push(bodyMessage);
    }
  }

  return parts.join(" ").toLowerCase();
}

function isMistralTransportApiError(error: unknown): boolean {
  if (isMistralRateLimitError(error)) return false;
  if (getErrorStatusCode(error) === 411) return true;

  const message = getMistralErrorSearchText(error);
  return message.includes("a valid content-length header is required");
}

function getMistralProviderBusyError(
  error: unknown,
  stage: ProposalProviderBusyStage,
): ProposalProviderBusyError | null {
  if (isProposalProviderBusyError(error)) return error;
  if (!isMistralRateLimitError(error)) return null;
  return new ProposalProviderBusyError({
    provider: "mistral",
    stage,
    retryAfterMs: extractRetryAfterMsFromError(error),
  });
}

function getMistralProviderTransportError(
  error: unknown,
  stage: ProposalProviderBusyStage,
): ProposalProviderTransportError | null {
  if (isProposalProviderTransportError(error)) return error;
  if (!isMistralTransportApiError(error)) return null;
  return new ProposalProviderTransportError({
    provider: "mistral",
    stage,
    statusCode: getErrorStatusCode(error),
  });
}

function recordMistralDiagnosticCall(args: {
  diagnostics: MistralDiagnosticsAccumulator | undefined;
  stage: MistralDiagnosticStage;
  modelType: ProposalModelType;
  inputText: string;
  outputText?: string | null;
  status: MistralDiagnosticStatus;
}): void {
  if (!args.diagnostics) return;
  const approximateInputChars = args.inputText.length;
  const approximateOutputChars =
    typeof args.outputText === "string" ? args.outputText.length : null;
  args.diagnostics.calls.push({
    sequence: args.diagnostics.nextSequence,
    stage: args.stage,
    modelType: args.modelType,
    approximateInputChars,
    approximateInputTokens: estimateApproximateTokenCountFromChars(
      approximateInputChars,
    ),
    approximateOutputChars,
    approximateOutputTokens:
      approximateOutputChars === null
        ? null
        : estimateApproximateTokenCountFromChars(approximateOutputChars),
    status: args.status,
  });
  args.diagnostics.nextSequence += 1;
}

function recordMistralDiagnosticFailure(args: {
  diagnostics: MistralDiagnosticsAccumulator | undefined;
  stage: ProposalProviderBusyStage;
  modelType: ProposalModelType;
  inputText: string;
  error: unknown;
}): void {
  const status: MistralDiagnosticStatus = getMistralProviderBusyError(
    args.error,
    args.stage,
  )
    ? "failed_busy"
    : getMistralProviderTransportError(args.error, args.stage)
        ? "failed_transport"
        : "failed_other";
  recordMistralDiagnosticCall({
    diagnostics: args.diagnostics,
    stage: args.stage,
    modelType: args.modelType,
    inputText: args.inputText,
    status,
  });
}

function summarizeMistralDiagnostics(
  diagnostics: MistralDiagnosticsAccumulator,
): MistralDiagnosticSummary {
  const perStageBreakdown: MistralDiagnosticSummary["perStageBreakdown"] = {};
  let totalApproximateInputChars = 0;
  let totalApproximateInputTokens = 0;
  let totalApproximateOutputCharsKnown = 0;
  let totalApproximateOutputTokensKnown = 0;

  for (const call of diagnostics.calls) {
    totalApproximateInputChars += call.approximateInputChars;
    totalApproximateInputTokens += call.approximateInputTokens;
    totalApproximateOutputCharsKnown += call.approximateOutputChars ?? 0;
    totalApproximateOutputTokensKnown += call.approximateOutputTokens ?? 0;

    const stageBreakdown = perStageBreakdown[call.stage] ?? {
      count: 0,
      approximateInputChars: 0,
      approximateInputTokens: 0,
      approximateOutputCharsKnown: 0,
      approximateOutputTokensKnown: 0,
    };
    stageBreakdown.count += 1;
    stageBreakdown.approximateInputChars += call.approximateInputChars;
    stageBreakdown.approximateInputTokens += call.approximateInputTokens;
    stageBreakdown.approximateOutputCharsKnown +=
      call.approximateOutputChars ?? 0;
    stageBreakdown.approximateOutputTokensKnown +=
      call.approximateOutputTokens ?? 0;
    perStageBreakdown[call.stage] = stageBreakdown;
  }

  return {
    mistralCallCount: diagnostics.calls.length,
    totalApproximateInputChars,
    totalApproximateInputTokens,
    totalApproximateOutputCharsKnown,
    totalApproximateOutputTokensKnown,
    perStageBreakdown,
    calls: diagnostics.calls,
  };
}

function isProposalProviderBusyError(
  error: unknown,
): error is ProposalProviderBusyError {
  return (
    error instanceof ProposalProviderBusyError ||
    (isRecord(error) &&
      error.name === "ProposalProviderBusyError" &&
      error.provider === "mistral" &&
      typeof error.stage === "string")
  );
}

function isProposalProviderTransportError(
  error: unknown,
): error is ProposalProviderTransportError {
  return (
    error instanceof ProposalProviderTransportError ||
    (isRecord(error) &&
      error.name === "ProposalProviderTransportError" &&
      error.provider === "mistral" &&
      typeof error.stage === "string")
  );
}

function coerceProposalProviderBusyToConvexError(
  error: ProposalProviderBusyError,
): ConvexError {
  return new ConvexError({
    code: CONTROLLED_PROPOSAL_PROVIDER_BUSY_CODE,
    message: CONTROLLED_PROPOSAL_PROVIDER_BUSY_MESSAGE,
    provider: error.provider,
    stage: error.stage,
    ...(typeof error.retryAfterMs === "number"
      ? { retryAfterMs: error.retryAfterMs }
      : {}),
  });
}

function coerceProposalProviderTransportToConvexError(
  error: ProposalProviderTransportError,
): ConvexError {
  return new ConvexError({
    code: CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_CODE,
    message: CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_MESSAGE,
    provider: error.provider,
    stage: error.stage,
    ...(typeof error.statusCode === "number"
      ? { statusCode: error.statusCode }
      : {}),
  });
}

const STRUCTURED_ROLLOUT_SOURCE_FACT_WARNING_PATTERNS = [
  {
    code: "numeric_residue",
    pattern: /^\d+\s+(?:month|months|year|years)\s+work experience\b/i,
  },
  {
    code: "malformed_fragment",
    pattern: /\b(?:which|that|who|while|because|although|though|and|but|or)\.$/i,
  },
  {
    code: "orphan_trait_tail",
    pattern:
      /(?:[—-]|,\s*)(?:qualities?|skills?|strengths?|traits?|capabilities?)\.$/i,
  },
  {
    code: "orphan_capability_tail",
    pattern:
      /\b(?:a|an|the)\s+(?:skill|strength|quality|trait|ability|capability)\.$/i,
  },
] as const;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

class ProposalFinalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProposalFinalizationError";
  }
}

export type ProposalFinalizationStageName =
  | "cleaned_body_selection"
  | "deterministic_boundary_application"
  | "final_saved_output_bridge_cleanup"
  | "substantive_body_assertion";

type CoverLetterTelemetryFailureStage =
  | ProposalFinalizationStageName
  | ProposalProviderBusyStage;

type ProposalBodyCandidateDebugInfo = {
  candidate: string;
  saveableSentences: string[];
  saveableSentenceCount: number;
  groundedOperationalSentenceCount: number;
  groundedSupportSentenceCount: number;
  isSaveable: boolean;
};

export type ProposalFinalizationDebugTrace = {
  acceptanceMode: ProposalBodyAcceptanceMode;
  rawGeneratedBody?: string;
  cleanedBodySelection: {
    aggressive: ProposalBodyCandidateDebugInfo;
    conservative: ProposalBodyCandidateDebugInfo;
    selectedCandidate: "aggressive" | "conservative" | "rescued" | null;
    selectedBody: string | null;
  };
  noContextLeadCleanup?: {
    before: string;
    after: string;
    removedSentence: string | null;
    removedSentences: string[];
    preservedSentences: string[];
    neutralizedSentences: Array<{
      before: string;
      after: string;
    }>;
    preservedForSaveability: boolean;
  };
  deterministicBoundaryApplication?: {
    content: string;
  };
  finalSavedOutputBridgeCleanup?: {
    before: string;
    after: string;
    removedSentenceTexts: string[];
    removedLastGroundedSentence: boolean;
  };
  substantiveBodyAssertion?: {
    body: string;
    passed: boolean;
  };
  applicationMessageRejectionReasons?: ApplicationMessageRejectionReasonTag[];
  failureStage?: ProposalFinalizationStageName;
  errorMessage?: string;
  finalOutput?: string;
};

export function coerceProposalFinalizationFailureToConvexError(args: {
  error: unknown;
  attemptedPath: ProposalGenerationPathLabel;
}): ConvexError {
  const message =
    args.error instanceof Error ? args.error.message : String(args.error);
  return new ConvexError(
    `Proposal generation failed closed during finalization. Attempted path: ${args.attemptedPath}. Final result: fail-closed final result. Reason: ${message}`,
  );
}

function toGenerationPathTag(path: ProposalGenerationPathLabel): string {
  switch (path) {
    case "premium success":
      return "generation_path:premium_success";
    case "premium fail-closed to legacy fallback":
      return "generation_path:premium_fail_closed_to_legacy_fallback";
    case "structured success":
      return "generation_path:structured_success";
    case "structured repaired success":
      return "generation_path:structured_repaired_success";
    case "structured fail-closed to legacy fallback":
      return "generation_path:structured_fail_closed_to_legacy_fallback";
    case "application-message inline path":
      return "generation_path:application_message_inline_path";
    case "legacy-only path after planner bypass":
      return "generation_path:legacy_only_path_after_planner_bypass";
    case "legacy-only path":
    default:
      return "generation_path:legacy_only_path";
  }
}

function clampText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const compact = compactWhitespace(value);
  if (!compact) return undefined;
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function dedupe(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function splitIntoSnippets(value: string): string[] {
  const normalized = value
    .replace(/\r/g, "\n")
    .replace(/[•·●◦]/g, "\n")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z])/))
    .map((part) => compactWhitespace(part))
    .filter(Boolean);
  return dedupe(
    normalized.map((part) => clampText(part, MAX_HIGHLIGHT_LENGTH)),
  );
}

function isApplicationMessageRequirementStyleEvidence(value: string): boolean {
  const compact = compactWhitespace(value);
  if (!compact) return false;
  if (APPLICATION_MESSAGE_REQUIREMENT_YEAR_RANGE_PATTERN.test(compact)) {
    return true;
  }
  return APPLICATION_MESSAGE_REQUIREMENT_STYLE_PATTERNS.some((pattern) =>
    pattern.test(compact),
  );
}

function filterApplicationMessageEvidenceItems(
  values: readonly string[] | undefined,
  options?: {
    splitSnippets?: boolean;
  },
): string[] {
  if (!values || values.length === 0) return [];
  return dedupe(
    values
      .flatMap((value) => {
        if (typeof value !== "string") return [];
        const compact = compactWhitespace(value);
        if (!compact) return [];
        return options?.splitSnippets ? splitIntoSnippets(compact) : [compact];
      })
      .filter(
        (item) => !isApplicationMessageRequirementStyleEvidence(item),
      ),
  );
}

function sanitizePersonalizationContext(
  input: PersonalizationContext | null | undefined,
): PersonalizationContext | null {
  if (!input) return null;

  const recentExperience = Array.isArray(input.recentExperience)
    ? (input.recentExperience
        .slice(0, MAX_RECENT_EXPERIENCE)
        .map((entry) => {
          const company = clampText(entry?.company, 80);
          const position = clampText(entry?.position, 80);
          const highlights = Array.isArray(entry?.highlights)
            ? dedupe(
                entry.highlights.map((highlight) =>
                  clampText(highlight, MAX_HIGHLIGHT_LENGTH),
                ),
              ).slice(0, MAX_HIGHLIGHTS_PER_EXPERIENCE)
            : [];
          if (!company && !position && highlights.length === 0) return null;
          return {
            ...(company ? { company } : {}),
            ...(position ? { position } : {}),
            ...(highlights.length > 0 ? { highlights } : {}),
          };
        })
        .filter(Boolean) as PersonalizationContext["recentExperience"])
    : undefined;

  const sanitized: PersonalizationContext = {
    ...(clampText(input.name, 80) ? { name: clampText(input.name, 80) } : {}),
    ...(clampText(input.summary, MAX_SUMMARY_LENGTH)
      ? { summary: clampText(input.summary, MAX_SUMMARY_LENGTH) }
      : {}),
    ...(clampText(input.desiredPosition, 80)
      ? { desiredPosition: clampText(input.desiredPosition, 80) }
      : {}),
    ...(Array.isArray(input.topSkills)
      ? {
          topSkills: dedupe(
            input.topSkills.map((skill) => clampText(skill, 40)),
          ).slice(0, MAX_SKILLS),
        }
      : {}),
    ...(recentExperience && recentExperience.length > 0
      ? { recentExperience }
      : {}),
    ...(Array.isArray(input.standoutAchievements)
      ? {
          standoutAchievements: dedupe(
            input.standoutAchievements.map((achievement) =>
              clampText(achievement, MAX_HIGHLIGHT_LENGTH),
            ),
          ).slice(0, MAX_ACHIEVEMENTS),
        }
      : {}),
  };

  if (sanitized.topSkills && sanitized.topSkills.length === 0)
    delete sanitized.topSkills;
  if (
    sanitized.standoutAchievements &&
    sanitized.standoutAchievements.length === 0
  ) {
    delete sanitized.standoutAchievements;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function sanitizeApplicationMessagePersonalizationContext(
  input: PersonalizationContext | null | undefined,
): PersonalizationContext | null {
  const sanitized = sanitizePersonalizationContext(input);
  if (!sanitized) return null;

  const filteredSummarySnippets = sanitized.summary
    ? filterApplicationMessageEvidenceItems([sanitized.summary], {
        splitSnippets: true,
      })
    : [];
  const filteredTopSkills = filterApplicationMessageEvidenceItems(
    sanitized.topSkills,
  ).slice(0, MAX_SKILLS);
  const filteredAchievements = filterApplicationMessageEvidenceItems(
    sanitized.standoutAchievements,
    {
      splitSnippets: true,
    },
  ).slice(0, MAX_ACHIEVEMENTS);
  const filteredRecentExperience = sanitized.recentExperience
    ?.map((entry) => {
      const highlights = filterApplicationMessageEvidenceItems(
        entry.highlights,
        {
          splitSnippets: true,
        },
      ).slice(0, MAX_HIGHLIGHTS_PER_EXPERIENCE);
      if (!entry.company && !entry.position && highlights.length === 0) {
        return null;
      }
      return {
        ...(entry.company ? { company: entry.company } : {}),
        ...(entry.position ? { position: entry.position } : {}),
        ...(highlights.length > 0 ? { highlights } : {}),
      };
    })
    .filter(Boolean) as PersonalizationContext["recentExperience"] | undefined;

  const filtered = sanitizePersonalizationContext({
    name: sanitized.name,
    summary:
      filteredSummarySnippets.length > 0
        ? filteredSummarySnippets.join(" ")
        : undefined,
    desiredPosition: sanitized.desiredPosition,
    topSkills: filteredTopSkills,
    recentExperience: filteredRecentExperience,
    standoutAchievements: filteredAchievements,
  });

  if (!filtered) return null;
  return buildProposalSourceFactBank(filtered).length > 0 ? filtered : null;
}

const APPLICATION_MESSAGE_WEAK_SECONDARY_SIGNAL_PATTERNS = [
  /\beffective communication\b/i,
  /\bcommunication\b/i,
  /\bteamwork\b/i,
  /\bteam player\b/i,
  /\bproblem[-\s]?solving\b/i,
  /\bdetail[-\s]?oriented\b/i,
  /\badaptable\b/i,
  /\breliable\b/i,
  /\borganized\b/i,
  /\bmotivated\b/i,
  /\bprofessional(?:ism)?\b/i,
] as const;

function isApplicationMessageWeakSecondarySignal(value: string): boolean {
  const compact = compactWhitespace(value);
  if (!compact) return true;
  return APPLICATION_MESSAGE_WEAK_SECONDARY_SIGNAL_PATTERNS.some((pattern) =>
    pattern.test(compact),
  );
}

const APPLICATION_MESSAGE_RANKING_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "under",
  "over",
  "across",
  "while",
  "where",
  "when",
  "your",
  "their",
  "have",
  "has",
  "had",
  "been",
  "being",
  "about",
  "role",
  "work",
]);
const APPLICATION_MESSAGE_SIGNAL_QUANTIFIED_PATTERN =
  /\b(?:\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?%?|\d+\+)\b/;
const APPLICATION_MESSAGE_SIGNAL_ACTION_PATTERN =
  /\b(?:built|build|developed|develop|implemented|implement|maintained|maintain|monitor(?:ed|ing)?|reduced|improved|documented|document|handled|handle|supported|support|debugged|debug|shipped|ship|managed|manage|coordinated|coordinate|contributed|contribute|designed|design|operated|operate)\b/i;
const APPLICATION_MESSAGE_SIGNAL_WEAK_LEAD_PATTERN = [
  /\bi(?:['’]ve| have)\s+spent\s+time\b/i,
  /\bbackground in\b/i,
  /\bexperience with\b/i,
  /\bmy skills include\b/i,
  /\bwith a strong background in\b/i,
  /\bi(?:['’]m| am)\s+focused on\b/i,
] as const;
const APPLICATION_MESSAGE_SIGNAL_VANITY_PATTERN =
  /\blines?\s+of\s+code\b/i;

function normalizeApplicationMessageRankingTokens(value: string): string[] {
  return compactWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9+#]+/i)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length > 1 && !APPLICATION_MESSAGE_RANKING_STOPWORDS.has(token),
    );
}

function countApplicationMessageTokenOverlap(
  tokens: string[],
  comparison: Set<string>,
): number {
  let overlap = 0;
  for (const token of new Set(tokens)) {
    if (comparison.has(token)) overlap += 1;
  }
  return overlap;
}

function scoreApplicationMessageSignal(args: {
  text: string;
  jobTokens: Set<string>;
  jobTitleTokens: Set<string>;
}): number {
  const text = compactWhitespace(args.text);
  const tokens = normalizeApplicationMessageRankingTokens(text);
  const overlap = countApplicationMessageTokenOverlap(tokens, args.jobTokens);
  const titleOverlap = countApplicationMessageTokenOverlap(
    tokens,
    args.jobTitleTokens,
  );

  let score = overlap * 12 + titleOverlap * 18;
  if (APPLICATION_MESSAGE_SIGNAL_ACTION_PATTERN.test(text)) score += 12;
  if (APPLICATION_MESSAGE_SIGNAL_QUANTIFIED_PATTERN.test(text)) score += 8;
  if (APPLICATION_MESSAGE_SIGNAL_VANITY_PATTERN.test(text)) score -= 18;
  if (APPLICATION_MESSAGE_SIGNAL_WEAK_LEAD_PATTERN.some((pattern) => pattern.test(text))) {
    score -= 20;
  }
  if (tokens.length < 4) score -= 6;
  return score;
}

function rankApplicationMessageSignalItems(args: {
  items: string[];
  jobTitle: string;
  jobDescription: string;
}): string[] {
  const priorityPack = buildJobOfferPriorityPack(args.jobDescription);
  const jobTitleTokens = new Set(
    normalizeApplicationMessageRankingTokens(args.jobTitle),
  );
  const jobTokens = new Set([
    ...jobTitleTokens,
    ...(
      priorityPack.priorityTokens.length > 0
        ? priorityPack.priorityTokens
        : normalizeApplicationMessageRankingTokens(args.jobDescription)
    ),
  ]);

  return args.items
    .map((item, index) => ({
      item,
      index,
      score: scoreApplicationMessageSignal({
        text: item,
        jobTokens,
        jobTitleTokens,
      }),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.item);
}

function buildFallbackPersonalizationContext(
  userProfile: ProfileFallbackDoc | null | undefined,
): PersonalizationContext | null {
  const recentExperience = Array.isArray(userProfile?.experience)
    ? userProfile.experience
        .slice(0, MAX_RECENT_EXPERIENCE)
        .map((entry) => {
          const company = clampText(entry?.company, 80);
          const position = clampText(entry?.title, 80);
          const highlights =
            typeof entry?.description === "string"
              ? splitIntoSnippets(entry.description).slice(
                  0,
                  MAX_HIGHLIGHTS_PER_EXPERIENCE,
                )
              : [];
          if (!company && !position && highlights.length === 0) return null;
          return {
            ...(company ? { company } : {}),
            ...(position ? { position } : {}),
            ...(highlights.length > 0 ? { highlights } : {}),
          };
        })
        .filter(Boolean)
    : undefined;

  return sanitizePersonalizationContext({
    name: userProfile?.name ?? undefined,
    summary: userProfile?.summary ?? undefined,
    desiredPosition: userProfile?.experience?.[0]?.title ?? undefined,
    topSkills: Array.isArray(userProfile?.skills)
      ? userProfile.skills
      : undefined,
    recentExperience:
      recentExperience as PersonalizationContext["recentExperience"],
    standoutAchievements: Array.isArray(userProfile?.achievements)
      ? userProfile.achievements
      : undefined,
  });
}

function mergePersonalizationContexts(
  clientContext: PersonalizationContext | null | undefined,
  fallbackContext: PersonalizationContext | null | undefined,
): PersonalizationContext | null {
  const client = sanitizePersonalizationContext(clientContext);
  const fallback = sanitizePersonalizationContext(fallbackContext);
  if (!client && !fallback) return null;
  return sanitizePersonalizationContext({
    name: client?.name ?? fallback?.name,
    summary: client?.summary ?? fallback?.summary,
    desiredPosition: client?.desiredPosition ?? fallback?.desiredPosition,
    topSkills:
      client?.topSkills && client.topSkills.length > 0
        ? client.topSkills
        : fallback?.topSkills,
    recentExperience:
      client?.recentExperience && client.recentExperience.length > 0
        ? client.recentExperience
        : fallback?.recentExperience,
    standoutAchievements:
      client?.standoutAchievements && client.standoutAchievements.length > 0
        ? client.standoutAchievements
        : fallback?.standoutAchievements,
  });
}

function resolvePersonalizationContext(
  clientContext: PersonalizationContext | null | undefined,
  fallbackContext: PersonalizationContext | null | undefined,
  richness: PersonalizationRichness | undefined,
): PersonalizationContext | null {
  switch (richness) {
    case "none":
      return null;
    case "minimal":
    case "sparse":
      return sanitizePersonalizationContext(clientContext);
    case "rich":
      return mergePersonalizationContexts(clientContext, fallbackContext);
    default:
      return mergePersonalizationContexts(clientContext, fallbackContext);
  }
}

function buildPersonalizationStrengthPromptBlock(
  richness: PersonalizationRichness | undefined,
): string {
  switch (richness) {
    case "none":
      return [
        "The active CV contains little or no usable candidate detail.",
        "Use reduced personalization.",
        "Keep the output cautious, generic, and honest rather than accomplishment-heavy.",
        "Do not imply candidate-specific strengths or evidence that are not actually supported.",
      ].join(" ");
    case "minimal":
      return [
        "The active CV contains only minimal candidate detail.",
        "Reduce claim density and personalize lightly using only the small amount of supported information.",
        "If one concrete supported detail is available, keep that exact detail rather than smoothing it into generic fit language.",
        "Use fewer proof points rather than broader proof points when support is thin.",
        "Do not compensate by inferring fit, tools, domain familiarity, client history, or ownership that the candidate background does not support.",
      ].join(" ");
    case "sparse":
      return [
        "The active CV contains limited but usable candidate detail.",
        "Keep claim density restrained and the output evidence-based.",
        "Prefer a small number of exact supported details over broader paraphrase or inferred specifics.",
        "Use only a small number of directly supported proof points when the support is partial.",
        "Do not bridge missing evidence with aggressive fit claims, invented project scope, domain expertise, or implied ownership.",
      ].join(" ");
    default:
      return "";
  }
}

function buildPersonalizationPromptBlock(
  context: PersonalizationContext | null,
): string {
  if (!context) return "";
  const lines: string[] = ["Candidate background for personalization:"];

  if (context.name) lines.push(`- Name: ${context.name}`);
  if (context.summary) lines.push(`- Professional summary: ${context.summary}`);
  if (context.desiredPosition)
    lines.push(`- Target role / headline: ${context.desiredPosition}`);
  if (context.topSkills && context.topSkills.length > 0) {
    lines.push(`- Core skills: ${context.topSkills.join(", ")}`);
  }
  if (context.recentExperience && context.recentExperience.length > 0) {
    lines.push("- Recent experience:");
    for (const entry of context.recentExperience) {
      const role = [
        entry.position,
        entry.company ? `at ${entry.company}` : undefined,
      ]
        .filter(Boolean)
        .join(" ");
      const highlights =
        entry.highlights && entry.highlights.length > 0
          ? `: ${entry.highlights.join("; ")}`
          : "";
      lines.push(`  - ${role || "Relevant role"}${highlights}`);
    }
  }
  if (context.standoutAchievements && context.standoutAchievements.length > 0) {
    lines.push(
      `- Standout achievements: ${context.standoutAchievements.join("; ")}`,
    );
  }

  lines.push("Use this background only to tailor tone and relevance.");
  lines.push(
    "Do not invent employers, achievements, years, or technical experience.",
  );
  return lines.join("\n");
}

function buildApplicationMessageCandidatePriorityBlock(args: {
  context: PersonalizationContext | null;
  jobTitle: string;
  jobDescription: string;
}): string {
  const context = args.context;
  if (!context) return "";

  const strongestCandidateProof = rankApplicationMessageSignalItems({
    items: dedupe([
      ...(context.standoutAchievements ?? []).flatMap((achievement) =>
        splitIntoSnippets(achievement),
      ),
      ...(context.recentExperience ?? []).flatMap((entry) =>
        (entry.highlights ?? []).flatMap((highlight) => splitIntoSnippets(highlight)),
      ),
    ]),
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
  }).slice(0, 1);

  const supportedScopeFromExperience = (context.recentExperience ?? []).map((entry) =>
    compactWhitespace(
      [entry.position, entry.company ? `at ${entry.company}` : ""]
        .filter(Boolean)
        .join(" "),
    ),
  );
  const supportedBackgroundSnippets = context.summary
    ? splitIntoSnippets(context.summary)
    : [];
  const supportedScopeOrBackground =
    strongestCandidateProof.length === 0
      ? rankApplicationMessageSignalItems({
          items: dedupe([
            ...supportedScopeFromExperience,
            ...supportedBackgroundSnippets,
          ])
            .filter(Boolean)
            .filter(
              (item) =>
                !strongestCandidateProof.some(
                  (proof) =>
                    normalizeProposalConstraintText(proof) ===
                    normalizeProposalConstraintText(item),
                ),
            ),
          jobTitle: args.jobTitle,
          jobDescription: args.jobDescription,
        }).slice(0, 1)
      : [];

  const secondaryProfileSignalsSource =
    strongestCandidateProof.length === 0 && supportedScopeOrBackground.length === 0
      ? dedupe([context.desiredPosition, ...(context.topSkills ?? [])])
      : [];
  const secondaryProfileSignals = secondaryProfileSignalsSource
    .filter(Boolean)
    .filter(
      (item) =>
        !isApplicationMessageWeakSecondarySignal(item) &&
        !supportedScopeOrBackground.some(
          (background) =>
            normalizeProposalConstraintText(background) ===
            normalizeProposalConstraintText(item),
        ),
    )
    .slice(0, 2);

  if (
    strongestCandidateProof.length === 0 &&
    supportedScopeOrBackground.length === 0 &&
    secondaryProfileSignals.length === 0
  ) {
    return "";
  }

  return [
    "Application-message candidate priority snapshot:",
    `- strongest_candidate_proof: ${formatApplicationMessagePriorityItems(
      strongestCandidateProof,
    )}`,
    `- supported_scope_or_background: ${formatApplicationMessagePriorityItems(
      supportedScopeOrBackground,
    )}`,
    `- secondary_profile_signals_nonleading: ${formatApplicationMessagePriorityItems(
      secondaryProfileSignals,
    )}`,
    "- Treat strongest_candidate_proof as the candidate-side priority order.",
    "- Rank candidate-side proof by recruiter-useful overlap with the role before choosing what to lead with; do not default to the first available snippet.",
    "- Build the note around one strongest_candidate_proof when available instead of summarizing the candidate.",
    "- Use supported_scope_or_background only as the single best fallback when no proof is available; do not treat it as parallel evidence when strongest_candidate_proof exists.",
    "- Use secondary_profile_signals_nonleading only as a last resort when stronger proof and supported scope are unavailable; never turn them into a professional-summary opener, headline, or skills list.",
    "- When both candidate-side and employer-side snapshots are present, connect one strongest_candidate_proof to one strongest_work_surfaces item; use supported_scope_or_background only when no proof exists.",
  ].join("\n");
}

function buildNoContextPromptBlock(format: OutputFormat): string {
  const shared = [
    "No candidate background is available for this request.",
    ...NO_CONTEXT_CANDIDATE_CLAIM_RULES,
    "Do not claim or imply any profession, software tools, projects, employers, industries, years of experience, accomplishments, readiness, contribution potential, fit, or qualification.",
    "Do not infer candidate qualifications, strengths, tools, systems, incidents, domain experience, or team value from the job description.",
    "Do not combine a personal trait with the target role, company, team, or projects in a contribution-like way.",
    "Do not mention contribution to safety, mission, operations, team value, or how the candidate would perform tasks.",
    "Do not mention secure environments, scenarios, patrols, access control, conflict resolution, or similar operational execution as something the candidate would do.",
    "Do not mention contribution, support, mission support, team value, goals support, community safety as future contribution, add value, or how the candidate would help.",
    "Do not use phrases such as 'bring my reliability to the team', 'bring my attention to detail to the role', 'bring my skills to your projects', 'eager to contribute', 'prepared to adapt quickly', 'would allow me to contribute', 'could support your team', 'my approach could support', 'my background aligns with your needs', 'opportunity to contribute to community safety', 'the opportunity to contribute to your mission', 'how I might support your goals', 'I am ready to', 'I am able to', 'I am capable of', 'I am well qualified', 'my background positions me well', or 'add value'.",
    "In no-context mode, every sentence must stay forward-looking, modest, and non-claiming.",
  ];

  switch (format) {
    case "application_message":
      return [
        ...shared,
        "Treat no-context mode as a short, grounded application message rather than a capability pitch.",
        "Use one concrete role context or work surface from the job description as the center of the note.",
        "Do not use abstract attraction language such as 'I am interested in the ... position', 'I’m focused on...', 'the role’s focus on ... draws my attention', or 'that part of the role stands out to me'.",
        "Let at most one sentence rely mainly on personal-interest framing; move any later sentence to the work itself, workflow, operating context, or team interaction described in the job description.",
      ].join(" ");
    case "freelance_proposal":
      return [
        ...shared,
        "Treat no-context mode as a cautious project proposal grounded in the client's described need, workflow, scope, deliverables, or collaboration context rather than in claimed prior project history.",
        "Use only the work itself, practical approach, operating context, and next-step discussion that the brief supports.",
        "Do not lean on repeated personal-interest phrasing or generic enthusiasm.",
      ].join(" ");
    case "cover_letter":
    default:
      return [
        ...shared,
        "Treat no-context mode as a grounded, non-claiming cover-letter body rather than a capability pitch.",
        "Use concrete role context, work surfaces from the job description, and employer-specific detail when the job description gives enough context to do so honestly.",
        "Aim for a body built from two grounded job-description sentences about the work itself, workflow, operating context, coordination, or employer context, plus at most one brief role-interest or curiosity sentence before the close.",
        "When the job description gives enough concrete detail, make at least two substantive sentences about recurring responsibilities, workflow, operating context, coordination, communication, records, or team interaction from the job description before the brief close.",
        "When concrete job-description material exists, make the first substantive sentence describe the actual work, products, outputs, media, files, process, or operating context rather than personal interest or admiration.",
        "When concrete job-description material exists, make the next substantive sentence describe workflow, collaboration, revision, production constraints, deliverables, or coordination from the job description before any motivation-led sentence.",
        "Do not let a role-title summary, scenic employer description, or generic paraphrase of the job description count as one of the grounded body sentences.",
        "Do not let benefit summaries, environment summaries, or generic teamwork, professionalism, reliability, or seriousness filler count as body substance.",
        "If you include one curiosity, seriousness, or role-interest sentence, make it concrete about the work, operating context, or employer context rather than generic admiration, benefits, or atmosphere.",
        "Keep the main body substance on the work itself rather than on mission admiration, culture admiration, schedule, flexibility, growth language, or generic role-interest rhetoric.",
        "Keep challenge language, opportunity language, mission admiration, growth language, and personal-interest rhetoric secondary only; they must not carry the body or come before the concrete work/process sentences when those are available.",
        "Let at most one sentence rely mainly on personal-interest framing; move later sentences to the work itself, workflow, operating context, or team interaction described in the job description.",
        "Do not use phrases such as 'I am particularly drawn to', 'The opportunity to', 'The day-to-day work itself', 'prepared to adapt', 'prepared to meet the minimum requirements', 'develop skills in', 'particularly engaging', 'compelling', 'attractive place to grow professionally', or 'resonates with my understanding'.",
        "Do not let schedule, flexibility, or willingness-to-adapt language serve as one of the main supporting sentences.",
      ].join(" ");
  }
}

function formatApplicationMessagePriorityItems(items: string[]): string {
  return items.length > 0 ? items.join(" | ") : "none";
}

function buildApplicationMessageEmployerPriorityBlock(
  jobDescription: string,
): string {
  const priorityPack = buildJobOfferPriorityPack(jobDescription);
  const hasStructuredPriority = Boolean(
    priorityPack.coreResponsibilities.length > 0 ||
      priorityPack.keyRequirements.length > 0 ||
      priorityPack.preferredQualifications.length > 0 ||
      priorityPack.lowValueChecklist.length > 0 ||
      priorityPack.companyFluff.length > 0,
  );

  if (!hasStructuredPriority) {
    return "";
  }

  return [
    "Application-message employer priority snapshot:",
    `- strongest_work_surfaces: ${formatApplicationMessagePriorityItems(
      priorityPack.coreResponsibilities,
    )}`,
    `- key_requirements: ${formatApplicationMessagePriorityItems(
      priorityPack.keyRequirements,
    )}`,
    `- preferred_requirements_nonleading: ${formatApplicationMessagePriorityItems(
      priorityPack.preferredQualifications,
    )}`,
    `- lower_value_checklist_demoted: ${formatApplicationMessagePriorityItems(
      priorityPack.lowValueChecklist,
    )}`,
    `- low_signal_employer_text_ignore: ${formatApplicationMessagePriorityItems(
      priorityPack.companyFluff,
    )}`,
    "- Treat strongest_work_surfaces as the employer-side priority order.",
    "- Use key_requirements only when they sharpen strongest_work_surfaces or a supported candidate proof point.",
    "- Do not lead with preferred_requirements_nonleading, lower_value_checklist_demoted, or low_signal_employer_text_ignore when stronger work surfaces exist.",
    "- If you mention employer-side detail, choose one or two strongest_work_surfaces instead of flattening the whole posting into a checklist summary.",
  ].join("\n");
}

function buildApplicationMessageWriterBriefBlock(args: {
  isNoContext: boolean;
  safePresetGuidance: string;
}): string {
  const safePresetGuidance = compactWhitespace(args.safePresetGuidance);

  return [
    "Application-message writer brief:",
    "- Write a short recruiter-facing note that reads like a real recruiter DM, a short email body, or a teaser note. It should open the conversation with one recruiter-useful idea, not explain the whole application.",
    "- Keep the three labeled lines short, natural, and connected so they render as one short paragraph.",
    "- opener = contact context only. Name the role or contact context naturally. Do not carry proof, years, fit language, a background summary, or interest/application formulas.",
    "- proof_line = the only substantive sentence. Make it one concrete micro-proof: one real thing the candidate handled, shipped, designed, supported, operated, documented, or improved or, in no-context mode, one concrete work surface from the role.",
    "- proof_line should sound like one observable proof point, workflow, artifact, deliverable, employer, or operating surface, not a broad category summary, competency list, or profile summary.",
    "- Preferred CV-backed proof shapes are 'At <company>, I <action> <result>.', 'I <action> at <company> <context/result>.', or 'One relevant example: <named fact>.'",
    "- When supported experience is the proof, name the employer, site, project, artifact, workflow, result, or operating surface instead of hiding it behind anonymous previous-role or previous-employer setup.",
    "- Keep proof_line on one named fact that clearly maps to one employer-side work surface in the posting. Do not turn it into a resume summary, category-level experience claim, background-summary claim, record-of-results slogan, generic role label, or fit/alignment shell.",
    "- Do not treat a concrete but weakly related academic, research, presentation, or profile fact as strong proof unless it clearly connects to one hiring-useful work surface in the posting.",
    "- follow_up_line = one short continuation of the exact same thread. Usually name the same surface, artifact, workflow, or operating context again in lighter form.",
    "- Do not open a new topic, ask for a conversation, offer extra detail, point to the profile or portfolio, repeat the proof, mention reply behavior, or summarize fit, readiness, value, or future contribution.",
    "- When candidate-side and employer-side priority snapshots are present, use proof_line to connect one strongest candidate proof to one strongest employer work surface, then stop.",
    args.isNoContext
      ? "- In no-context mode, use one honest pattern: opener names the role or contact context, proof_line names one concrete work surface, artifact, deliverable, operating context, or coordination thread from the posting, and follow_up_line stays lightly on that same surface."
      : "- When supported proof exists, let it carry the note. Do not convert it into a résumé-summary or category-level self-description.",
    args.isNoContext
      ? "- In no-context mode, stay honest and non-claiming: keep the note on one concrete surface from the job description with no past execution, no pseudo-proof, no self-introduction, and no profile summary."
      : "",
    args.isNoContext
      ? "- In no-context mode, keep proof_line on one concrete surface from the posting itself, not a restated checklist or a softened summary of the full job description."
      : "",
    args.isNoContext
      ? "- In no-context mode, do not use past-execution verbs in proof_line or follow_up_line unless the note is actually source-backed and not running in no-context mode."
      : "",
    args.isNoContext
      ? "- In no-context mode, keep follow_up_line tied to that same surface without turning it into a recruiter close, detail offer, candidate-summary line, or meta note about introducing yourself."
      : "",
    "- Presets change texture only. signature = cleaner / more premium. expert = slightly sharper / more precise. engaging = slightly warmer / more human.",
    "- No preset may turn the note into a self-summary, formal application note, cover-letter fragment, or profile blurb.",
    args.isNoContext
      ? "- In no-context mode, signature, expert, and engaging all inherit the same honest base note; only the surface texture changes."
      : "",
    safePresetGuidance
      ? `- Apply the selected preset only as surface texture: ${safePresetGuidance}`
      : "",
    "- Examples below teach feel and rhythm only. Do not reuse their wording.",
    "Application-message examples:",
    "- Good CV-backed example: 'Reaching out about the Brand Designer role. At Northline, I built launch signage kits for seasonal drops and handed clean print files to production partners on tight timelines. That production-handoff thread is the part of the posting my Northline work maps to most clearly.'",
    "- Good no-context example: 'I saw the Security Guard opening at the Miami Design District store. The entrance coverage and crowd-flow side of the posting looks like the real center of the shift there. That entrance-coverage thread is the part of the role that stood out most to me.'",
    "- Bad example: 'Reaching out about the Security Guard role. My work history covers retail safety, guest support, and calm communication across busy shifts. Open to connecting whenever useful.' Reason: summary-first proof plus generic recruiter close.",
    "- Bad example: 'I’m reaching out about the Graphic Designer role. My design work covers print, digital, branding, and fast-moving launches. Happy to send over more whenever useful.' Reason: category summary plus detail-offer filler.",
    "- Bad example: 'I saw the Security Guard opening. The role feels like a strong fit for my professional story. I would bring a calm approach to the team.' Reason: fit-summary note, not one concrete employer-side thread.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildApplicationMessageNoContextSafetyBlock(
  isNoContext: boolean,
): string {
  if (!isNoContext) return "";

  return [
    "Application-message no-context safety:",
    "- Stay non-claiming throughout.",
    "- Do not imply readiness, contribution, fit, qualification, or supported task capability.",
    "- Use only role context and concrete work surfaces from the job description.",
    "- Let at most one sentence rely mainly on personal-interest framing; keep any later sentence on concrete work context, workflow, operating context, or team interaction from the job description.",
    "- Do not turn job-description tasks into prior candidate experience or future operational capability.",
    "- Do not combine a trait, interest, or value statement with operational execution, support, contribution, or future team value.",
  ].join("\n");
}

function extractTextFromChatMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((entry: any) => (entry?.type === "text" ? entry.text : ""))
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return "";
}

function extractTextFromMistralResponseContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((entry: any) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object") {
          if (typeof entry.text === "string") return entry.text;
          if (entry.type === "text" && typeof entry.text === "string")
            return entry.text;
        }
        return "";
      })
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return "";
}

export async function buildStructuredProposalPlan(args: {
  mistralKey: string;
  modelType: "mistral-large-latest" | "mistral-small-latest";
  prompt: string;
  diagnostics?: MistralDiagnosticsAccumulator;
}): Promise<ProposalPlannerResult> {
  const client = new Mistral({ apiKey: args.mistralKey });
  const plannerPrompt = args.prompt;
  try {
    const parsedResponse = await client.chat.parse({
      model: args.modelType,
      messages: [{ role: "user", content: plannerPrompt }],
      responseFormat: PROPOSAL_PLANNER_SCHEMA,
    });
    const parsed =
      parsedResponse.choices?.[0]?.message &&
      typeof parsedResponse.choices[0].message === "object"
        ? (parsedResponse.choices[0].message as { parsed?: ProposalPlannerResult })
            .parsed
        : undefined;
    if (parsed) {
      recordMistralDiagnosticCall({
        diagnostics: args.diagnostics,
        stage: "planner_parse",
        modelType: args.modelType,
        inputText: plannerPrompt,
        outputText: JSON.stringify(parsed),
        status: "success",
      });
      return parsed;
    }
    recordMistralDiagnosticCall({
      diagnostics: args.diagnostics,
      stage: "planner_parse",
      modelType: args.modelType,
      inputText: plannerPrompt,
      status: "failed_other",
    });
    throw new Error("Planner parse response did not contain parsed JSON");
  } catch (structuredError) {
    if (!(structuredError instanceof Error && structuredError.message === "Planner parse response did not contain parsed JSON")) {
      recordMistralDiagnosticFailure({
        diagnostics: args.diagnostics,
        stage: "planner_parse",
        modelType: args.modelType,
        inputText: plannerPrompt,
        error: structuredError,
      });
    }
    const providerBusyError = getMistralProviderBusyError(
      structuredError,
      "planner_parse",
    );
    if (providerBusyError) {
      throw providerBusyError;
    }
    const providerTransportError = getMistralProviderTransportError(
      structuredError,
      "planner_parse",
    );
    if (providerTransportError) {
      throw providerTransportError;
    }
    console.warn(
      "Structured proposal planner failed, retrying with JSON mode:",
      structuredError,
    );
    let fallbackResponse;
    const fallbackPrompt = `${plannerPrompt}\n\nReturn JSON only.`;
    try {
      fallbackResponse = await client.chat.complete({
        model: args.modelType,
        messages: [
          {
            role: "user",
            content: fallbackPrompt,
          },
        ],
        responseFormat: {
          type: "json_object",
        },
      });
    } catch (fallbackError) {
      recordMistralDiagnosticFailure({
        diagnostics: args.diagnostics,
        stage: "planner_json_retry",
        modelType: args.modelType,
        inputText: fallbackPrompt,
        error: fallbackError,
      });
      throw (
        getMistralProviderBusyError(fallbackError, "planner_json_retry") ??
        getMistralProviderTransportError(fallbackError, "planner_json_retry") ??
        fallbackError
      );
    }
    const fallbackContent = extractTextFromMistralResponseContent(
      fallbackResponse.choices?.[0]?.message?.content,
    );
    recordMistralDiagnosticCall({
      diagnostics: args.diagnostics,
      stage: "planner_json_retry",
      modelType: args.modelType,
      inputText: fallbackPrompt,
      outputText: fallbackContent,
      status: "success",
    });
    return PROPOSAL_PLANNER_SCHEMA.parse(JSON.parse(fallbackContent));
  }
}

async function buildStructuredCoverLetterContentPlanWithMistral(args: {
  mistralKey: string;
  modelType: "mistral-large-latest" | "mistral-small-latest";
  prompt: string;
  diagnostics?: MistralDiagnosticsAccumulator;
}): Promise<StructuredCoverLetterContentPlan> {
  const client = new Mistral({ apiKey: args.mistralKey });
  const contentPlanPrompt = args.prompt;
  try {
    const parsedResponse = await client.chat.parse({
      model: args.modelType,
      messages: [{ role: "user", content: contentPlanPrompt }],
      responseFormat: STRUCTURED_COVER_LETTER_CONTENT_PLAN_SCHEMA,
    });
    const parsed =
      parsedResponse.choices?.[0]?.message &&
      typeof parsedResponse.choices[0].message === "object"
        ? (parsedResponse.choices[0].message as {
            parsed?: StructuredCoverLetterContentPlan;
          }).parsed
        : undefined;
    if (parsed) {
      recordMistralDiagnosticCall({
        diagnostics: args.diagnostics,
        stage: "structured_plan_parse",
        modelType: args.modelType,
        inputText: contentPlanPrompt,
        outputText: JSON.stringify(parsed),
        status: "success",
      });
      return parsed;
    }
    recordMistralDiagnosticCall({
      diagnostics: args.diagnostics,
      stage: "structured_plan_parse",
      modelType: args.modelType,
      inputText: contentPlanPrompt,
      status: "failed_other",
    });
    throw new Error("Structured cover letter content plan parse response did not contain parsed JSON");
  } catch (structuredError) {
    if (!(structuredError instanceof Error && structuredError.message === "Structured cover letter content plan parse response did not contain parsed JSON")) {
      recordMistralDiagnosticFailure({
        diagnostics: args.diagnostics,
        stage: "structured_plan_parse",
        modelType: args.modelType,
        inputText: contentPlanPrompt,
        error: structuredError,
      });
    }
    const providerBusyError = getMistralProviderBusyError(
      structuredError,
      "structured_plan_parse",
    );
    if (providerBusyError) {
      throw providerBusyError;
    }
    const providerTransportError = getMistralProviderTransportError(
      structuredError,
      "structured_plan_parse",
    );
    if (providerTransportError) {
      throw providerTransportError;
    }
    console.warn(
      "Structured cover letter content plan failed, retrying with JSON mode:",
      structuredError,
    );
    let fallbackResponse;
    const fallbackPrompt = `${contentPlanPrompt}\n\nReturn JSON only.`;
    try {
      fallbackResponse = await client.chat.complete({
        model: args.modelType,
        messages: [
          {
            role: "user",
            content: fallbackPrompt,
          },
        ],
        responseFormat: {
          type: "json_object",
        },
      });
    } catch (fallbackError) {
      recordMistralDiagnosticFailure({
        diagnostics: args.diagnostics,
        stage: "structured_plan_json_retry",
        modelType: args.modelType,
        inputText: fallbackPrompt,
        error: fallbackError,
      });
      throw (
        getMistralProviderBusyError(
          fallbackError,
          "structured_plan_json_retry",
        ) ??
        getMistralProviderTransportError(
          fallbackError,
          "structured_plan_json_retry",
        ) ??
        fallbackError
      );
    }
    const fallbackContent = extractTextFromMistralResponseContent(
      fallbackResponse.choices?.[0]?.message?.content,
    );
    recordMistralDiagnosticCall({
      diagnostics: args.diagnostics,
      stage: "structured_plan_json_retry",
      modelType: args.modelType,
      inputText: fallbackPrompt,
      outputText: fallbackContent,
      status: "success",
    });
    return STRUCTURED_COVER_LETTER_CONTENT_PLAN_SCHEMA.parse(
      JSON.parse(fallbackContent),
    );
  }
}

async function generateStructuredCoverLetterBodyWithMistral(args: {
  mistralKey: string;
  modelType: "mistral-large-latest" | "mistral-small-latest";
  prompt: string;
  diagnostics?: MistralDiagnosticsAccumulator;
}): Promise<string> {
  const systemPrompt =
    "Write only the body of a cover letter. Follow the required paragraph count and role order. Use only the supplied facts and themes. Do not invent experience, achievements, credentials, readiness, or target-role experience. Do not output a greeting, sign-off, signature, CTA, bullets, markdown, or meta text.";
  const model = new ChatMistralAI({
    apiKey: args.mistralKey,
    modelName: args.modelType,
    temperature: 0.2,
  });
  let response;
  try {
    response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(args.prompt),
    ]);
  } catch (error) {
    recordMistralDiagnosticFailure({
      diagnostics: args.diagnostics,
      stage: "structured_body_generation",
      modelType: args.modelType,
      inputText: `${systemPrompt}\n${args.prompt}`,
      error,
    });
    throw (
      getMistralProviderBusyError(error, "structured_body_generation") ??
      getMistralProviderTransportError(error, "structured_body_generation") ??
      error
    );
  }
  const outputText = extractTextFromChatMessageContent(response.content) ?? "";
  recordMistralDiagnosticCall({
    diagnostics: args.diagnostics,
    stage: "structured_body_generation",
    modelType: args.modelType,
    inputText: `${systemPrompt}\n${args.prompt}`,
    outputText,
    status: "success",
  });
  return outputText;
}

export function resolveStructuredMistralCoverLetterRolloutMode(
  rawValue: string | undefined = process.env.ENABLE_PROPOSAL_STRUCTURED_MISTRAL,
): StructuredMistralCoverLetterRolloutMode {
  const normalized = compactWhitespace(rawValue ?? "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  switch (normalized) {
    case "":
      return "small_cover_letters";
    case "0":
    case "false":
    case "off":
    case "disabled":
      return "disabled";
    case "1":
    case "true":
    case "on":
    case "all":
    case "cover_letter":
    case "cover_letters":
    case "all_cover_letter":
    case "all_cover_letters":
      return "all_cover_letters";
    case "small":
    case "small_cover_letter":
    case "small_cover_letters":
    case "mistral_small":
    case "mistral_small_cover_letter":
    case "mistral_small_cover_letters":
      return "small_cover_letters";
    default:
      return "disabled";
  }
}

export function isStructuredMistralCoverLetterEnabled(args: {
  modelType: string;
  outputFormat: OutputFormat;
  rolloutValue?: string;
}): boolean {
  if (args.outputFormat !== "cover_letter") return false;
  const rolloutMode = resolveStructuredMistralCoverLetterRolloutMode(
    args.rolloutValue,
  );
  if (rolloutMode === "small_cover_letters") {
    return args.modelType === "mistral-small-latest";
  }
  if (rolloutMode === "all_cover_letters") {
    return (
      args.modelType === "mistral-small-latest" ||
      args.modelType === "mistral-large-latest"
    );
  }
  return false;
}

function getStructuredRolloutSourceFactBankWarnings(
  sourceFactBank: readonly string[],
): string[] {
  const warnings = new Set<string>();

  for (const rawFact of sourceFactBank) {
    const fact = compactWhitespace(rawFact);
    if (!fact) continue;

    for (const entry of STRUCTURED_ROLLOUT_SOURCE_FACT_WARNING_PATTERNS) {
      if (entry.pattern.test(fact)) {
        warnings.add(entry.code);
      }
    }

    if (
      /^(?:the|this|these|those)\b/i.test(fact) &&
      /\bi\s+(?:installed|built|developed|created|implemented|maintained|managed|configured|designed)\b/i.test(
        fact,
      )
    ) {
      warnings.add("clipped_fact_continuation");
    }
  }

  return Array.from(warnings);
}

export function evaluateStructuredCoverLetterRolloutEligibility(args: {
  modelType: string;
  outputFormat: OutputFormat;
  rolloutValue?: string;
  contextMode: ProposalPlannerContextMode;
  sourceFactBank: readonly string[];
}): StructuredCoverLetterRolloutEligibility {
  if (args.outputFormat !== "cover_letter") {
    return {
      eligible: false,
      plannedPath: "legacy",
      fallbackReason: "output_format_not_cover_letter",
      sourceFactBankWarnings: [],
    };
  }

  const rolloutMode = resolveStructuredMistralCoverLetterRolloutMode(
    args.rolloutValue,
  );
  if (rolloutMode === "disabled") {
    return {
      eligible: false,
      plannedPath: "legacy",
      fallbackReason: "rollout_disabled",
      sourceFactBankWarnings: [],
    };
  }

  if (
    !isStructuredMistralCoverLetterEnabled({
      modelType: args.modelType,
      outputFormat: args.outputFormat,
      rolloutValue: args.rolloutValue,
    })
  ) {
    return {
      eligible: false,
      plannedPath: "legacy",
      fallbackReason: "model_not_in_rollout",
      sourceFactBankWarnings: [],
    };
  }

  if (args.contextMode === "none") {
    return {
      eligible: false,
      plannedPath: "legacy",
      fallbackReason: "missing_candidate_context",
      sourceFactBankWarnings: [],
    };
  }

  const usableFacts = args.sourceFactBank.map((fact) => compactWhitespace(fact)).filter(Boolean);
  if (usableFacts.length === 0) {
    return {
      eligible: false,
      plannedPath: "legacy",
      fallbackReason: "empty_source_fact_bank",
      sourceFactBankWarnings: [],
    };
  }

  const sourceFactBankWarnings = getStructuredRolloutSourceFactBankWarnings(
    usableFacts,
  );
  if (sourceFactBankWarnings.length > 0) {
    return {
      eligible: false,
      plannedPath: "legacy",
      fallbackReason: "polluted_source_fact_bank",
      sourceFactBankWarnings,
    };
  }

  return {
    eligible: true,
    plannedPath: "structured",
    fallbackReason: "not_applicable",
    sourceFactBankWarnings: [],
  };
}

function mapPremiumCoverLetterEligibilityReason(
  reason:
    | NonNullable<ReturnType<typeof evaluatePremiumCoverLetterEligibility>["reason"]>
    | "flag_disabled",
): StructuredCoverLetterRolloutFallbackReason {
  switch (reason) {
    case "flag_disabled":
      return "flag_disabled";
    case "missing_cv":
      return "missing_candidate_context";
    case "preset_not_supported":
      return "preset_not_supported";
    case "unsupported_context_class":
      return "unsupported_context_class";
    case "no_allowed_facts":
      return "no_allowed_facts";
    default:
      return "not_applicable";
  }
}

function evaluatePrimaryCoverLetterPathEligibility(args: {
  modelType: ProposalModelType;
  outputFormat: OutputFormat;
  rolloutValue?: string;
  contextMode: ProposalPlannerContextMode;
  sourceFactBank: readonly string[];
  personalizationContext: PersonalizationContext | null;
  voicePreset: ProposalVoicePreset;
  jobTitle: string;
  jobDescription: string;
}): StructuredCoverLetterRolloutEligibility {
  if (args.outputFormat !== "cover_letter") {
    return evaluateStructuredCoverLetterRolloutEligibility({
      modelType: args.modelType,
      outputFormat: args.outputFormat,
      rolloutValue: args.rolloutValue,
      contextMode: args.contextMode,
      sourceFactBank: args.sourceFactBank,
    });
  }

  if (args.modelType === "chatgpt") {
    if (!isCoverLetterPremiumPathV1Enabled()) {
      return {
        eligible: false,
        plannedPath: "legacy",
        fallbackReason: "flag_disabled",
        sourceFactBankWarnings: [],
      };
    }

    const premiumEligibility = evaluatePremiumCoverLetterEligibility({
      personalizationContext: args.personalizationContext,
      voicePreset: args.voicePreset,
      jobTitle: args.jobTitle,
      jobDescription: args.jobDescription,
    });

    if (!premiumEligibility.eligible) {
      return {
        eligible: false,
        plannedPath: "legacy",
        fallbackReason: mapPremiumCoverLetterEligibilityReason(
          premiumEligibility.reason ?? "no_allowed_facts",
        ),
        sourceFactBankWarnings: [],
      };
    }

    return {
      eligible: true,
      plannedPath: "structured",
      fallbackReason: "not_applicable",
      sourceFactBankWarnings: [],
    };
  }

  return evaluateStructuredCoverLetterRolloutEligibility({
    modelType: args.modelType,
    outputFormat: args.outputFormat,
    rolloutValue: args.rolloutValue,
    contextMode: args.contextMode,
    sourceFactBank: args.sourceFactBank,
  });
}

export function assertStructuredCoverLetterRoutingConsistency(args: {
  plannedPath: ProposalRoutingPlannedPath;
  executedPath: ProposalRoutingExecutedPath;
  attemptedGenerationPath: ProposalGenerationPathLabel;
  fallbackReason: StructuredCoverLetterRolloutFallbackReason;
}): void {
  if (args.plannedPath !== "structured") return;
  if (
    args.executedPath === "legacy" &&
    args.attemptedGenerationPath === "legacy-only path after planner bypass" &&
    args.fallbackReason === "planner_dependency_bypassed"
  ) {
    return;
  }
  if (
    args.attemptedGenerationPath === "legacy-only path" ||
    (args.executedPath === "legacy" && args.fallbackReason === "not_applicable")
  ) {
    throw new Error(
      "Eligible structured cover-letter request cannot collapse to legacy without a typed fallback reason.",
    );
  }
}

function buildProposalRoutingMetadata(args: {
  base: Record<string, unknown>;
  jobId: string;
  tags: string[];
  routing: ProposalRoutingTrace;
  provenance: ProposalExecutionProvenance;
}) {
  return {
    ...args.base,
    jobId: args.jobId,
    tags: args.tags,
    planned_path: args.routing.plannedPath,
    executed_path: args.routing.executedPath,
    fallback_reason: args.routing.fallbackReason,
    validator_outcome: args.routing.validatorOutcome,
    save_outcome: args.routing.saveOutcome,
    requestedModelType: args.provenance.requestedModelType,
    actualModelType: args.provenance.actualModelType,
    ...(args.provenance.fallbackTriggerCode
      ? { fallbackTriggerCode: args.provenance.fallbackTriggerCode }
      : {}),
  };
}

function getStructuredEligibilityReason(args: {
  structuredEligible: boolean;
  structuredEligibilityFallbackReason: StructuredCoverLetterRolloutFallbackReason;
}): string {
  if (args.structuredEligible) {
    return "eligible";
  }

  switch (args.structuredEligibilityFallbackReason) {
    case "flag_disabled":
      return "feature_flag_gate:flag_disabled";
    case "rollout_disabled":
    case "model_not_in_rollout":
      return `rollout_gate:${args.structuredEligibilityFallbackReason}`;
    case "missing_candidate_context":
      return `context_gate:${args.structuredEligibilityFallbackReason}`;
    case "empty_source_fact_bank":
    case "polluted_source_fact_bank":
    case "preset_not_supported":
    case "unsupported_context_class":
    case "no_allowed_facts":
      return `eligibility_gate:${args.structuredEligibilityFallbackReason}`;
    case "output_format_not_cover_letter":
      return `intentional_exclusion:${args.structuredEligibilityFallbackReason}`;
    case "not_applicable":
      return "accidental_exclusion:not_applicable";
    default:
      return `accidental_exclusion:${args.structuredEligibilityFallbackReason}`;
  }
}

function getRuntimeFailureReason(args: {
  fallbackReason: StructuredCoverLetterRolloutFallbackReason;
  attemptedPath: ProposalGenerationPathLabel;
}): string | null {
  if (args.fallbackReason === "provider_busy") {
    return "runtime_failure:provider_busy";
  }

  if (
    (args.attemptedPath === "structured fail-closed to legacy fallback" ||
      args.attemptedPath === "premium fail-closed to legacy fallback") &&
    args.fallbackReason !== "not_applicable"
  ) {
    return `fallback_before_attempt:${args.fallbackReason}`;
  }

  return null;
}

function getTelemetryAttemptedPath(args: {
  attemptedPath: ProposalGenerationPathLabel;
  structuredEligible: boolean;
  runtimeFailureReason: string | null;
  failureStage: CoverLetterTelemetryFailureStage | null;
}): CoverLetterTelemetryAttemptedPathLabel {
  if (args.runtimeFailureReason !== "runtime_failure:provider_busy") {
    return args.attemptedPath;
  }

  switch (args.failureStage) {
    case "planner_parse":
    case "planner_json_retry":
      return args.structuredEligible
        ? "planner-only path before structured generation"
        : "planner-only path before legacy generation";
    case "structured_plan_parse":
    case "structured_plan_json_retry":
    case "structured_body_generation":
      return "structured-only path before legacy fallback";
    default:
      return args.attemptedPath;
  }
}

function getOutcomeClass(args: {
  finalOutcome: ProposalSaveOutcome;
  normalizedFailureCode: string | null;
}):
  | "success"
  | "provider_busy"
  | "provider_transport_error"
  | "other_controlled_failure"
  | "unexpected_failure" {
  if (args.normalizedFailureCode === CONTROLLED_PROPOSAL_PROVIDER_BUSY_CODE) {
    return "provider_busy";
  }
  if (
    args.normalizedFailureCode ===
    CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_CODE
  ) {
    return "provider_transport_error";
  }
  if (args.normalizedFailureCode !== null || args.finalOutcome === "fail_closed") {
    return "other_controlled_failure";
  }
  if (args.finalOutcome === "not_saved") {
    return "unexpected_failure";
  }
  return "success";
}

function resolveCounterfactualStructuredRolloutValue(
  modelType: string,
  resolvedStructuredRolloutMode: StructuredMistralCoverLetterRolloutMode,
): string {
  if (resolvedStructuredRolloutMode === "all_cover_letters") {
    return "all_cover_letters";
  }
  if (resolvedStructuredRolloutMode === "small_cover_letters") {
    return "small_cover_letters";
  }
  return modelType === "mistral-small-latest"
    ? "small_cover_letters"
    : "all_cover_letters";
}

function getCounterfactualNextStructuredGate(args: {
  modelType: string;
  outputFormat: OutputFormat;
  contextMode: ProposalPlannerContextMode;
  sourceFactBank: readonly string[];
  resolvedStructuredRolloutMode: StructuredMistralCoverLetterRolloutMode;
}):
  | Exclude<StructuredCoverLetterRolloutFallbackReason, "rollout_disabled">
  | "eligible" {
  const counterfactualRolloutValue = resolveCounterfactualStructuredRolloutValue(
    args.modelType,
    args.resolvedStructuredRolloutMode,
  );
  const counterfactualEligibility =
    evaluateStructuredCoverLetterRolloutEligibility({
      modelType: args.modelType,
      outputFormat: args.outputFormat,
      rolloutValue: counterfactualRolloutValue,
      contextMode: args.contextMode,
      sourceFactBank: args.sourceFactBank,
    });
  return counterfactualEligibility.eligible
    ? "eligible"
    : counterfactualEligibility.fallbackReason;
}

export function buildCoverLetterRoutingTelemetry(args: {
  preset: ProposalVoicePreset;
  modelType: string;
  outputFormat: OutputFormat;
  rolloutValue?: string;
  contextMode: ProposalPlannerContextMode;
  sourceFactBank: readonly string[];
  structuredEligible: boolean;
  structuredEligibilityFallbackReason: StructuredCoverLetterRolloutFallbackReason;
  fallbackReason: StructuredCoverLetterRolloutFallbackReason;
  attemptedPath: ProposalGenerationPathLabel;
  finalOutcome: ProposalSaveOutcome;
  failureStage?: CoverLetterTelemetryFailureStage | null;
  normalizedFailureCode?: string | null;
  requestedModelType?: ProposalModelType;
  actualModelType?: ProposalModelType;
  fallbackTriggerCode?: ProposalFallbackTriggerCode | null;
  usedFallback?: boolean;
}): CoverLetterRoutingTelemetry {
  const resolvedStructuredRolloutMode =
    resolveStructuredMistralCoverLetterRolloutMode(args.rolloutValue);
  const runtimeFailureReason = getRuntimeFailureReason({
    fallbackReason: args.fallbackReason,
    attemptedPath: args.attemptedPath,
  });
  const failureStage = args.failureStage ?? null;
  const normalizedFailureCode = args.normalizedFailureCode ?? null;
  const requestedModelType =
    args.requestedModelType ?? (args.modelType as ProposalModelType);
  const actualModelType =
    args.actualModelType ?? (args.modelType as ProposalModelType);
  const fallbackTriggerCode = args.fallbackTriggerCode ?? null;
  const usedFallback = args.usedFallback ?? fallbackTriggerCode !== null;
  const counterfactualNextStructuredGate =
    args.modelType === "chatgpt" && args.outputFormat === "cover_letter"
      ? args.structuredEligible
        ? "eligible"
        : args.structuredEligibilityFallbackReason === "rollout_disabled"
          ? "flag_disabled"
          : args.structuredEligibilityFallbackReason
      : getCounterfactualNextStructuredGate({
          modelType: args.modelType,
          outputFormat: args.outputFormat,
          contextMode: args.contextMode,
          sourceFactBank: args.sourceFactBank,
          resolvedStructuredRolloutMode,
        });
  return {
    preset: args.preset,
    hasCv: args.contextMode !== "none",
    contextMode: args.contextMode,
    resolvedStructuredRolloutMode,
    structuredEligible: args.structuredEligible,
    structuredEligibilityReason: getStructuredEligibilityReason({
      structuredEligible: args.structuredEligible,
      structuredEligibilityFallbackReason:
        args.structuredEligibilityFallbackReason,
    }),
    outcomeClass: getOutcomeClass({
      finalOutcome: args.finalOutcome,
      normalizedFailureCode,
    }),
    normalizedFailureCode,
    runtimeFailureReason,
    counterfactualNextStructuredGate,
    attemptedPath: getTelemetryAttemptedPath({
      attemptedPath: args.attemptedPath,
      structuredEligible: args.structuredEligible,
      runtimeFailureReason,
      failureStage,
    }),
    requestedModelType,
    actualModelType,
    fallbackTriggerCode,
    usedFallback,
    finalOutcome: args.finalOutcome,
    failureStage,
  };
}

function logCoverLetterRoutingTelemetry(
  telemetry: CoverLetterRoutingTelemetry,
): void {
  console.info("Cover letter routing telemetry", telemetry);
}

function formatStructuredError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

function summarizeStructuredValidationError(error: unknown): string {
  if (error instanceof Error) {
    return compactWhitespace(error.message);
  }
  return compactWhitespace(String(error));
}

function extractStructuredPlannerTokens(value: string): string[] {
  return Array.from(
    new Set(
      normalizeProposalConstraintText(value)
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4),
    ),
  );
}

function structuredThemeOverlapsClaim(theme: string, claim: string): boolean {
  const normalizedTheme = normalizeProposalConstraintText(theme);
  const normalizedClaim = normalizeProposalConstraintText(claim);
  if (!normalizedTheme || !normalizedClaim) return false;
  if (
    normalizedTheme.includes(normalizedClaim) ||
    normalizedClaim.includes(normalizedTheme)
  ) {
    return true;
  }

  const themeTokens = new Set(extractStructuredPlannerTokens(theme));
  if (themeTokens.size === 0) return false;

  let overlap = 0;
  for (const token of extractStructuredPlannerTokens(claim)) {
    if (themeTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap >= Math.min(2, themeTokens.size);
}

function sanitizePlannerResultForStructuredCoverLetter(args: {
  plannerResult: ProposalPlannerResult;
  jobTitle: string;
  jobDescription: string;
}): ProposalPlannerResult {
  const plannerResult = args.plannerResult;
  const requiresThemeTightening =
    plannerResult.context_mode !== "none" &&
    (plannerResult.domain_gap !== "direct" ||
      plannerResult.credential_status !== "exact_required" ||
      plannerResult.transfer_mode !== "literal" ||
      plannerResult.proof_strategy !== "concrete_supported");

  if (!requiresThemeTightening || plannerResult.allowed_transfer_themes.length === 0) {
    return plannerResult;
  }

  const concreteTokens = new Set(
    extractStructuredPlannerTokens(plannerResult.allowed_concrete_facts.join(" ")),
  );
  const jobTokens = new Set(
    extractStructuredPlannerTokens(`${args.jobTitle} ${args.jobDescription}`),
  );
  const disallowedClaims = [
    ...plannerResult.disallowed_claims,
    ...plannerResult.identity_hard_stops,
  ];
  const retainedThemes: string[] = [];
  const filteredThemes: string[] = [];

  for (const theme of plannerResult.allowed_transfer_themes) {
    const themeTokens = extractStructuredPlannerTokens(theme);
    const overlapsDisallowedClaim = disallowedClaims.some((claim) =>
      structuredThemeOverlapsClaim(theme, claim),
    );
    const jobSpecificOnly =
      themeTokens.length >= 2 &&
      themeTokens.every((token) => jobTokens.has(token)) &&
      themeTokens.every((token) => !concreteTokens.has(token));

    if (overlapsDisallowedClaim || jobSpecificOnly) {
      filteredThemes.push(theme);
      continue;
    }

    retainedThemes.push(theme);
  }

  if (filteredThemes.length === 0) {
    return plannerResult;
  }

  return {
    ...plannerResult,
    allowed_transfer_themes: retainedThemes,
    disallowed_claims: Array.from(
      new Set([...plannerResult.disallowed_claims, ...filteredThemes]),
    ),
  };
}

function logStructuredCoverLetterFallback(
  reason: StructuredCoverLetterFallbackReason,
  metadata: {
    modelType: "mistral-large-latest" | "mistral-small-latest";
    jobTitle: string;
    format: OutputFormat;
  },
  error: unknown,
): void {
  console.warn("Structured cover letter path failed.", {
    reason,
    ...metadata,
    error: formatStructuredError(error),
  });
  console.warn("Structured cover letter path is falling back to legacy.", {
    reason: "structured_fallback_to_legacy",
    upstreamReason: reason,
    ...metadata,
  });
}

function assertStructuredCoverLetterTail(args: {
  content: string;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  voicePreset: ProposalVoicePreset;
  noContextMode: boolean;
}): void {
  const policy = getDeterministicProposalRenderPolicy({
    format: "cover_letter",
    outputLanguage: args.outputLanguage,
    voicePreset: args.voicePreset,
    noContextMode: args.noContextMode,
  });
  const nonEmptyLines = args.content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const salutation = policy.salutation ? compactWhitespace(policy.salutation) : null;
  const signOff = policy.signOff ? compactWhitespace(policy.signOff) : null;
  const candidateName = compactWhitespace(args.candidateName ?? "");

  if (!salutation || !signOff) {
    throw new Error("Structured cover letter tail validation expected deterministic cover-letter boundaries.");
  }

  if (compactWhitespace(nonEmptyLines[0] ?? "") !== salutation) {
    throw new Error("Structured cover letter lost its deterministic salutation.");
  }

  if (candidateName) {
    if (compactWhitespace(nonEmptyLines[nonEmptyLines.length - 1] ?? "") !== candidateName) {
      throw new Error("Structured cover letter ended with text after the candidate name line.");
    }
    if (compactWhitespace(nonEmptyLines[nonEmptyLines.length - 2] ?? "") !== signOff) {
      throw new Error("Structured cover letter ended with text after the deterministic sign-off.");
    }
    return;
  }

  if (compactWhitespace(nonEmptyLines[nonEmptyLines.length - 1] ?? "") !== signOff) {
    throw new Error("Structured cover letter ended with text after the deterministic sign-off.");
  }
}

function stripRendererOwnedFinalSentenceFromBody(args: {
  body: string;
  outputLanguage: ProposalOutputLanguage;
  voicePreset: ProposalVoicePreset;
  noContextMode: boolean;
}): string {
  const policy = getDeterministicProposalRenderPolicy({
    format: "cover_letter",
    outputLanguage: args.outputLanguage,
    voicePreset: args.voicePreset,
    noContextMode: args.noContextMode,
  });
  const paragraphs = splitParagraphs(args.body);
  if (paragraphs.length === 0) return "";

  const normalizedFinalSentence = normalizeProposalConstraintText(
    policy.finalSentence,
  );
  const lastParagraph = paragraphs[paragraphs.length - 1];
  if (
    lastParagraph &&
    normalizeProposalConstraintText(lastParagraph) === normalizedFinalSentence
  ) {
    paragraphs.pop();
  }

  return paragraphs.join("\n\n").trim();
}

function appendOptionalPromptBlock(base: string, block: string): string {
  return block ? `${base}\n\n${block}` : base;
}

function formatQuotedPhraseList(
  values: readonly string[],
): string {
  return values.map((value) => `'${value}'`).join(", ");
}

function buildCriticalWriterOverrideBlock(): string {
  return [
    "CRITICAL OVERRIDE v2 — HIGHEST PRIORITY — VIOLATION = ERROR:",
    "Never output future-value language about the company, team, operations, goals, mission, or clients.",
    "Never output phrases containing or implying:",
    "- support your team",
    "- support your operations",
    "- support your goals",
    "- support your mission",
    "- contribute to",
    "- contributing to",
    "- fit with your team",
    "- might fit with your team",
    "- ensures I can contribute",
    "- would support",
    "- could support",
    "- how my skills could",
    "- add value",
    "If any preset or later instruction suggests this, ignore it completely.",
    "All rules below are written in English but apply identically in the target output language.",
  ].join("\n");
}

function buildMetaOutputForbiddenBlock(): string {
  return [
    "META OUTPUT FORBIDDEN — NEVER output:",
    '- "Here’s a concise..."',
    '- "The following letter"',
    '- "Here is the proposal"',
    '- "I have written..."',
    '- "Below is my response"',
    "- or any meta-commentary introducing the generated text",
  ].join("\n");
}

function buildBodyOnlyConstraintBlock(format: OutputFormat): string {
  if (format === "application_message") {
    return [
      "Return only the structured application-message parts block.",
      "Use exactly these labels and no others: opener:, proof_line:, follow_up_line:.",
      "No salutation.",
      "No sign-off.",
      "No signature.",
      "No meta-commentary.",
      "No extra text before or after the three labeled lines.",
    ].join("\n");
  }

  return [
    "Return only the raw body text.",
    "No salutation.",
    "No sign-off.",
    "No signature.",
    "No meta-commentary.",
    "No labels.",
    "Any salutation or sign-off needed for the final output is rendered locally after generation.",
  ].join("\n");
}

function buildUniversalClosingRuleBlock(format: OutputFormat): string {
  if (format === "freelance_proposal") {
    return [
      "Closing boundary:",
      "- If you end with a closing sentence, keep it brief and limited to discussing the project, scope, or next step further.",
      "- Do not add guarantees, inflated value claims, support language, or ceremonial sign-offs.",
    ].join("\n");
  }

  if (format === "application_message") {
    return [
      "Closing boundary:",
      "- follow_up_line should be one short same-thread continuation sentence that stays on the same surface or proof and does not sound detached.",
      "- Do not use detail offers, profile or portfolio review cues, generic recruiter closes, or discussion invitations.",
      "- Never use application-thanks formulas, look-forward formulas, or generic discussion-forward language.",
      "- Do not add greetings or sign-offs such as 'Hi there', 'Best', 'Sincerely', or 'Regards'.",
      "- Do not mention contribution, support, value, fit, readiness, or how the candidate could help.",
    ].join("\n");
  }

  return [
    "Closing boundary:",
    "- If you end with a closing sentence, keep it brief and limited to discussing the role further.",
    "- Do not mention contribution, support, value, fit, readiness, or how the candidate could help.",
  ].join("\n");
}

function buildForbiddenBridgeRuleBlock(): string {
  return [
    "Forbidden bridge boundary:",
    `- Do not use bridge language such as ${formatQuotedPhraseList(
      PROPOSAL_FORBIDDEN_BRIDGES,
    )}.`,
    `- After the evidence anchor, the only allowed bridge is one cautious relevance sentence using phrasing such as ${formatQuotedPhraseList(
      PROPOSAL_ALLOWED_CAUTIOUS_BRIDGES,
    )}.`,
    `- Any phrase that combines ${formatQuotedPhraseList(
      PROPOSAL_GENERIC_FUTURE_VALUE_VERBS,
    )} with ${formatQuotedPhraseList(
      PROPOSAL_GENERIC_FUTURE_VALUE_TARGETS,
    )} is forbidden unless it is literally source-backed.`,
  ].join("\n");
}

function sanitizePresetGuidanceForClaimSafety(guidance: string): string {
  return guidance
    .replace(
      /\blike(?:ly)? contribution within the opening lines\b/gi,
      "grounded relevance within the opening lines",
    )
    .replace(/\bteam contribution\b/gi, "team context")
    .replace(/\bfit explanation\b/gi, "relevance explanation")
    .replace(/\bhow the candidate would help\b/gi, "how the candidate is interested")
    .replace(/\bauthoritative\b/gi, "disciplined");
}

function buildCoverLetterPresetBodyOverlay(
  voicePreset: ProposalVoicePreset | undefined,
): string[] {
  switch (voicePreset) {
    case "expert":
      return [
        "For expert, make the body feel analytical and assured by using one measured sentence that explains what the supported evidence says about the role's actual demands, workflow, or operating context; keep the opening as clear role-relevant positioning rather than a bare fact inventory, and do not let the body collapse into two factual lines plus the closing invitation when more grounded material exists.",
      ];
    case "direct":
      return [
        "For direct, keep the body lean and plainspoken, but still make the opening read like clear role-relevant positioning and include one grounded supporting sentence or one concrete role-relevance sentence beyond the opening proof when material exists instead of jumping straight to the close.",
      ];
    case "engaging":
      return [
        "For engaging, let one grounded sentence carry people, team, guest, user, or service context when the source or job description supports it; keep the energy human rather than enthusiastic, and make that human-facing sentence still say something concrete about the day-to-day work.",
      ];
    case "storyteller":
      return [
        "For storyteller, keep one visible supported thread across the body from evidence or background to a concrete reason the role makes sense now; use connected transitions, fully closed sentences, and explicit sentence-to-sentence continuity rather than fragmentary narrative beats, isolated relevance fragments, or softer wording alone.",
      ];
    case "signature":
    default:
      return [
        "For signature, keep the body professional, warm, and concise, but do not let it feel minimal or shell-like; make the opening read like clear professional positioning, add one grounded development or employer-facing relevance sentence after the opening point when material exists, and avoid stand-alone interest, commitment, or discussion fragments that do not add body substance.",
      ];
  }
}

function buildWriterBoundaryExamplesBlock(format: OutputFormat): string {
  if (format === "application_message") {
    return [
      "Boundary reminders:",
      "- Return only the three labeled application-message part lines.",
      "- Do not add greetings, sign-offs, signatures, headers, bullets, or meta introductions.",
      "- Each part should be one complete sentence, not a fragment, heading, or bullet.",
    ].join("\n");
  }

  return [
    "Boundary reminders:",
    "- Return only the body text for the requested artifact.",
    "- Do not add greetings, sign-offs, signatures, headers, subject lines, bullets, or meta introductions.",
    "- Do not turn unsupported bridge or future-value language into filler sentences; keep only the grounded part that is actually supported.",
  ].join("\n");
}

function buildCoverLetterCompositionPriorityBlock(
  format: OutputFormat,
  isNoContext: boolean,
): string | null {
  if (format !== "cover_letter") {
    return null;
  }

  return [
    "Cover-letter composition priority:",
    "- This is a body-composition requirement, not a tone suggestion.",
    ...(isNoContext
      ? [
          "- The body is incomplete unless it contains at least two substantive grounded movements before the closing invitation.",
          "- Movement 1: describe a concrete work surface, workflow, operating context, employer context, or day-to-day responsibility from the job description.",
          "- Movement 2: add another grounded work/workflow/context sentence, or explain a concrete operational consequence or dependency using coordination, documentation, records, scheduling, handoffs, follow-through, service continuity, compliance, safety, or users-served detail from the job description.",
          "- JD summary plus appreciation, admiration, generic communication/professionalism/reliability filler, or a generic interest sentence is incomplete and does not satisfy Movement 2.",
          "- A role-summary sentence, appreciation sentence, benefit summary, or generic professionalism sentence does not count as one of those substantive movements.",
        ]
      : [
          "- The body is incomplete unless it contains the opening positioning move and at least one additional substantive body movement before the closing invitation.",
          "- Movement 1: clear role-relevant positioning grounded in the strongest supported proof or scope/background fact.",
          "- Movement 2: either one additional supported fact or operating detail, or one explicit employer-facing relevance sentence that names the work, workflow, users, team context, or operating environment the evidence speaks to.",
          "- The employer-facing move counts only if it explains a concrete team, workflow, users, operating environment, service quality, safety, compliance, coordination, or delivery consequence the evidence is relevant to; vague alignment, fit, independence, deadline-comfort, communication, or professionalism summaries do not count.",
          "- When strong supported evidence exists, use both the employer-facing relevance move and one additional supported fact or operating detail before the close rather than stopping after one proof sentence.",
          "- One proof cluster plus a weak relevance or fit-summary sentence is incomplete.",
          "- A thin proof summary followed by a generic discussion sentence is incomplete.",
        ]),
    "- Keep the prose natural and concise; do not turn this into headings or a rigid formula.",
  ].join("\n");
}

function buildCoverLetterEvidencePriorityBlock(
  format: OutputFormat,
  isNoContext: boolean,
): string | null {
  if (format !== "cover_letter" || isNoContext) {
    return null;
  }

  return [
    "CV-backed evidence priority:",
    "- This is a ranking rule for what deserves body space when candidate background is available.",
    "- If quantified achievements, concrete operational proof, strong scope, or clearly role-relevant accomplishments are present, they must appear before weaker qualification listing or attraction language.",
    "- Language proficiency, generic software familiarity, office tools, future certification interest, schedule flexibility, generic company admiration, benefits attraction, employee-experience praise, or excitement about joining are low-priority details when stronger evidence exists.",
    "- Do not spend the opening or a full supporting sentence on those low-priority details when stronger evidence exists.",
    "- Use low-priority qualification detail only if it is central to the role and the stronger evidence has already been stated.",
    "- If both strong proof and soft requirement matching are available, the strong proof outranks the soft requirement matching.",
    "- Do not turn the body into a requirement checklist or a company-attraction paragraph when stronger proof exists.",
  ].join("\n");
}

async function repairProposalDraftWithMistral(args: {
  mistralKey: string;
  modelType: "mistral-large-latest" | "mistral-small-latest";
  prompt: string;
  diagnostics?: MistralDiagnosticsAccumulator;
}): Promise<string> {
  const model = new ChatMistralAI({
    apiKey: args.mistralKey,
    modelName: args.modelType,
  });
  let response;
  try {
    response = await model.invoke([new HumanMessage(args.prompt)]);
  } catch (error) {
    recordMistralDiagnosticFailure({
      diagnostics: args.diagnostics,
      stage: "repair",
      modelType: args.modelType,
      inputText: args.prompt,
      error,
    });
    throw (
      getMistralProviderBusyError(error, "repair") ??
      getMistralProviderTransportError(error, "repair") ??
      error
    );
  }
  const outputText = extractTextFromChatMessageContent(response.content) ?? "";
  recordMistralDiagnosticCall({
    diagnostics: args.diagnostics,
    stage: "repair",
    modelType: args.modelType,
    inputText: args.prompt,
    outputText,
    status: "success",
  });
  return outputText;
}

function sanitizeRepairSentenceOutput(args: {
  content: string;
  candidateName?: string;
  fallback: string;
  plan: ProposalPlannerResult;
  outputLanguage: ProposalOutputLanguage;
}): string {
  const flattened = args.content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        Boolean(line) &&
        !isMetaOutputLine(line) &&
        !isSalutationLine(line) &&
        !isClosingLine(line) &&
        !isPlaceholderSignatureLine(line) &&
        !isCandidateNameLine(line, args.candidateName),
    )
    .join(" ");
  const firstSentence = splitSentences(flattened)[0] ?? "";
  const normalized = compactWhitespace(firstSentence);
  const fallback = compactWhitespace(args.fallback);

  if (
    !normalized ||
    isMetaOutputSentence(normalized) ||
    isSalutationLine(normalized) ||
    isClosingLine(normalized) ||
    isCandidateNameLine(normalized, args.candidateName)
  ) {
    return fallback;
  }

  if (
    args.plan.context_mode === "none" &&
    (hasStrictNoContextRepairViolation(normalized) ||
      hasOverProjectiveRepairWording(normalized) ||
      containsForbiddenProposalBridge(normalized))
  ) {
    return getDeterministicInterestOnlyRepairSentence(args.outputLanguage);
  }

  if (
    (args.plan.context_mode === "none" || args.plan.domain_gap === "distant") &&
    (hasOverProjectiveRepairWording(normalized) ||
      containsForbiddenProposalBridge(normalized))
  ) {
    return fallback;
  }

  return normalized;
}

async function repairProposalDraftBySentence(args: {
  mistralKey: string;
  modelType: "mistral-large-latest" | "mistral-small-latest";
  content: string;
  plan: ProposalPlannerResult;
  format: OutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  flaggedSentences: ReturnType<typeof analyzeProposalDraft>["flaggedSentences"];
  diagnostics?: MistralDiagnosticsAccumulator;
}): Promise<string> {
  const repairableBody = extractProposalBodyForRepair({
    content: args.content,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
  });
  const bodySentences = splitParagraphs(repairableBody).flatMap((paragraph) =>
    splitSentences(paragraph),
  );
  const patches: Array<{
    sentenceIndex: number;
    originalSentence: string;
    replacementSentence: string;
  }> = [];

  for (const flaggedSentence of args.flaggedSentences) {
    const previousSentence =
      flaggedSentence.sentenceIndex > 0
        ? bodySentences[flaggedSentence.sentenceIndex - 1] ?? null
        : null;
    const nextSentence =
      flaggedSentence.sentenceIndex + 1 < bodySentences.length
        ? bodySentences[flaggedSentence.sentenceIndex + 1] ?? null
        : null;
    const localReplacement =
      repairProposalSentenceLocally({
        flaggedSentence,
        plan: args.plan,
        outputLanguage: args.outputLanguage,
      }) ?? "";
    let replacementSentence = localReplacement;
    const allowModelFallback = args.plan.context_mode !== "none";

    if (allowModelFallback && !compactWhitespace(replacementSentence)) {
      replacementSentence = sanitizeRepairSentenceOutput({
        content: await repairProposalDraftWithMistral({
          mistralKey: args.mistralKey,
          modelType: args.modelType,
          prompt: buildProposalRepairPrompt({
            flaggedSentence,
            plan: args.plan,
            format: args.format,
            outputLanguage: args.outputLanguage,
            candidateName: args.candidateName,
            previousSentence,
            nextSentence,
          }),
          diagnostics: args.diagnostics,
        }),
        candidateName: args.candidateName,
        fallback: localReplacement,
        plan: args.plan,
        outputLanguage: args.outputLanguage,
      });
    } else {
      replacementSentence = sanitizeRepairSentenceOutput({
        content: replacementSentence,
        candidateName: args.candidateName,
        fallback: localReplacement,
        plan: args.plan,
        outputLanguage: args.outputLanguage,
      });
    }

    patches.push({
      sentenceIndex: flaggedSentence.sentenceIndex,
      originalSentence: flaggedSentence.originalSentence,
      replacementSentence,
    });
  }

  return applyProposalSentencePatches({
    content: args.content,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
    patches,
  });
}

function applyStructuredParagraphLocalRepairs(args: {
  bodyParagraphs: string[];
  flaggedSentences: ReturnType<typeof analyzeProposalDraft>["flaggedSentences"];
  plan: ProposalPlannerResult;
  outputLanguage: ProposalOutputLanguage;
}): string[] {
  const paragraphSentences = args.bodyParagraphs.map((paragraph) =>
    splitSentences(paragraph),
  );
  const sentenceLocations: Array<{
    paragraphIndex: number;
    sentenceInParagraphIndex: number;
    globalSentenceIndex: number;
    sentence: string;
  }> = [];

  paragraphSentences.forEach((sentences, paragraphIndex) => {
    sentences.forEach((sentence, sentenceInParagraphIndex) => {
      sentenceLocations.push({
        paragraphIndex,
        sentenceInParagraphIndex,
        globalSentenceIndex: sentenceLocations.length,
        sentence,
      });
    });
  });

  for (const flaggedSentence of args.flaggedSentences) {
    const normalizedOriginalSentence = normalizeProposalConstraintText(
      flaggedSentence.originalSentence,
    );
    const location =
      sentenceLocations[flaggedSentence.sentenceIndex] &&
      normalizeProposalConstraintText(
        sentenceLocations[flaggedSentence.sentenceIndex]?.sentence ?? "",
      ) === normalizedOriginalSentence
        ? sentenceLocations[flaggedSentence.sentenceIndex]!
        : sentenceLocations.find(
            (candidate) =>
              normalizeProposalConstraintText(candidate.sentence) ===
              normalizedOriginalSentence,
          );
    if (!location) continue;

    const replacementSentence =
      repairProposalSentenceLocally({
        flaggedSentence,
        plan: args.plan,
        outputLanguage: args.outputLanguage,
      }) ?? "";

    paragraphSentences[location.paragraphIndex][
      location.sentenceInParagraphIndex
    ] = compactWhitespace(replacementSentence);
  }

  return paragraphSentences
    .map((sentences) => joinSentences(sentences))
    .map((paragraph) => compactWhitespace(paragraph))
    .filter(Boolean);
}

type AttemptStructuredCoverLetterArgs = {
  gateEnabled: boolean;
  mistralKey: string;
  modelType: "mistral-large-latest" | "mistral-small-latest";
  plannerResult: ProposalPlannerResult | null;
  outputFormat: OutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  voicePreset: ProposalVoicePreset;
  jobTitle: string;
  jobDescription: string;
  diagnostics?: MistralDiagnosticsAccumulator;
};

type AttemptStructuredCoverLetterDeps = {
  buildContentPlan?: (args: {
    mistralKey: string;
    modelType: "mistral-large-latest" | "mistral-small-latest";
    prompt: string;
    diagnostics?: MistralDiagnosticsAccumulator;
  }) => Promise<StructuredCoverLetterContentPlan>;
  generateParagraph?: (args: {
    mistralKey: string;
    modelType: "mistral-large-latest" | "mistral-small-latest";
    prompt: string;
    diagnostics?: MistralDiagnosticsAccumulator;
  }) => Promise<string>;
  generateBody?: (args: {
    mistralKey: string;
    modelType: "mistral-large-latest" | "mistral-small-latest";
    prompt: string;
    diagnostics?: MistralDiagnosticsAccumulator;
  }) => Promise<string>;
  analyzeDraft?: typeof analyzeProposalDraft;
  repairDraft?: typeof repairProposalDraftBySentence;
  onFallbackReason?: (reason: StructuredCoverLetterFallbackReason) => void;
};

export async function attemptStructuredCoverLetterGeneration(
  args: AttemptStructuredCoverLetterArgs,
  deps: AttemptStructuredCoverLetterDeps = {},
): Promise<StructuredCoverLetterAttemptResult | null> {
  if (!args.gateEnabled) return null;
  if (args.outputFormat !== "cover_letter") return null;
  if (!args.plannerResult) return null;
  if (
    args.plannerResult.output_language !== "en" &&
    args.plannerResult.output_language !== "fr"
  ) {
    return null;
  }
  const plannerResult = sanitizePlannerResultForStructuredCoverLetter({
    plannerResult: args.plannerResult,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
  });

  const logMetadata = {
    modelType: args.modelType,
    jobTitle: args.jobTitle,
    format: args.outputFormat,
  };
  const buildContentPlan =
    deps.buildContentPlan ?? buildStructuredCoverLetterContentPlanWithMistral;
  const generateBody =
    deps.generateBody ??
    deps.generateParagraph ??
    generateStructuredCoverLetterBodyWithMistral;
  const analyzeDraft = deps.analyzeDraft ?? analyzeProposalDraft;
  const repairDraft = deps.repairDraft ?? repairProposalDraftBySentence;
  const recordFallback = (
    reason: StructuredCoverLetterFallbackReason,
    error: unknown,
  ): null => {
    deps.onFallbackReason?.(reason);
    logStructuredCoverLetterFallback(reason, logMetadata, error);
    return null;
  };

  let contentPlan: StructuredCoverLetterContentPlan;
  try {
    contentPlan = await buildContentPlan({
      mistralKey: args.mistralKey,
      modelType: args.modelType,
      prompt: buildStructuredCoverLetterContentPlanPrompt({
        plannerResult,
        voicePreset: args.voicePreset,
        jobTitle: args.jobTitle,
        jobDescription: args.jobDescription,
      }),
      diagnostics: args.diagnostics,
    });
  } catch (error) {
    if (isProposalProviderBusyError(error)) {
      throw error;
    }
    return recordFallback("structured_plan_parse_fail", error);
  }

  try {
    contentPlan = validateStructuredCoverLetterContentPlan({
      plan: contentPlan,
      plannerResult,
      voicePreset: args.voicePreset,
    });
  } catch (error) {
    return recordFallback("structured_plan_validation_fail", error);
  }

  let bodyParagraphs: string[] | null = null;
  let lastBodyValidationError: unknown = null;
  const maxBodyAttempts = 4;
  let structuredGenerationPath: StructuredCoverLetterAttemptResult["generationPath"] =
    "structured_success";

  for (
    let bodyAttemptIndex = 0;
    bodyAttemptIndex < maxBodyAttempts;
    bodyAttemptIndex += 1
  ) {
    let rawGeneratedBody = "";
    try {
      rawGeneratedBody = await generateBody({
        mistralKey: args.mistralKey,
        modelType: args.modelType,
        prompt:
          bodyAttemptIndex === 0 || !lastBodyValidationError
            ? buildStructuredCoverLetterComposerPrompt({
                plannerResult,
                contentPlan,
                jobTitle: args.jobTitle,
                jobDescription: args.jobDescription,
              })
            : buildStructuredCoverLetterComposerRetryPrompt({
                plannerResult,
                contentPlan,
                jobTitle: args.jobTitle,
                jobDescription: args.jobDescription,
                failureReason:
                  summarizeStructuredValidationError(lastBodyValidationError),
              }),
        diagnostics: args.diagnostics,
      });
    } catch (error) {
      if (isProposalProviderBusyError(error)) {
        throw error;
      }
      return recordFallback("structured_body_generation_fail", error);
    }

    try {
      bodyParagraphs = parseStructuredCoverLetterBody({
        content: sanitizeStructuredBodyCandidate({
          content: rawGeneratedBody,
          candidateName: args.candidateName,
          outputLanguage: args.outputLanguage,
          voicePreset: args.voicePreset,
          noContextMode: plannerResult.context_mode === "none",
        }),
        expectedParagraphCount: contentPlan.body_paragraphs.length,
        candidateName: args.candidateName,
        contentPlan,
        plannerResult,
        jobTitle: args.jobTitle,
        jobDescription: args.jobDescription,
        stage: "generation",
      });
      lastBodyValidationError = null;
      break;
    } catch (error) {
      lastBodyValidationError = error;
    }
  }

  if (!bodyParagraphs) {
    return recordFallback(
      "structured_body_validation_fail",
      lastBodyValidationError,
    );
  }

  let renderedContent: string;
  try {
    renderedContent = renderStructuredCoverLetter({
      bodyParagraphs,
      outputLanguage: args.outputLanguage,
      candidateName: args.candidateName,
      voicePreset: args.voicePreset,
      noContextMode: plannerResult.context_mode === "none",
    }).content;
    assertStructuredCoverLetterTail({
      content: renderedContent,
      outputLanguage: args.outputLanguage,
      candidateName: args.candidateName,
      voicePreset: args.voicePreset,
      noContextMode: plannerResult.context_mode === "none",
    });
  } catch (error) {
    return recordFallback("structured_render_fail", error);
  }

  try {
    let verificationResult = analyzeDraft({
      content: renderedContent,
      plan: plannerResult,
      format: "cover_letter",
      outputLanguage: args.outputLanguage,
      candidateName: args.candidateName,
      jobTitle: args.jobTitle,
      jobDescription: args.jobDescription,
    });
    let verificationIssues = verificationResult.issues;

    if (
      verificationIssues.length > 0 &&
      verificationResult.flaggedSentences.length > 0
    ) {
      let repairedBody: string;
      try {
        repairedBody = await repairDraft({
          mistralKey: args.mistralKey,
          modelType: args.modelType,
          content: renderedContent,
          plan: plannerResult,
          format: "cover_letter",
          outputLanguage: args.outputLanguage,
          candidateName: args.candidateName,
          flaggedSentences: verificationResult.flaggedSentences,
          diagnostics: args.diagnostics,
        });
      } catch (error) {
        if (isProposalProviderBusyError(error)) {
          throw error;
        }
        return recordFallback("structured_repair_fail", error);
      }

      try {
        repairedBody = sanitizeStructuredBodyCandidate({
          content: repairedBody,
          candidateName: args.candidateName,
          outputLanguage: args.outputLanguage,
          voicePreset: args.voicePreset,
          noContextMode: plannerResult.context_mode === "none",
        });
        bodyParagraphs = parseStructuredCoverLetterBody({
          content: repairedBody,
          expectedParagraphCount: contentPlan.body_paragraphs.length,
          candidateName: args.candidateName,
          contentPlan,
          plannerResult,
          jobTitle: args.jobTitle,
          jobDescription: args.jobDescription,
          stage: "repair",
        });
      } catch (error) {
        try {
          bodyParagraphs = parseStructuredCoverLetterBody({
            content: sanitizeStructuredBodyCandidate({
              content: await generateBody({
                mistralKey: args.mistralKey,
                modelType: args.modelType,
                prompt: buildStructuredCoverLetterComposerRetryPrompt({
                  plannerResult,
                  contentPlan,
                  jobTitle: args.jobTitle,
                  jobDescription: args.jobDescription,
                  failureReason: summarizeStructuredValidationError(error),
                }),
                diagnostics: args.diagnostics,
              }),
              candidateName: args.candidateName,
              outputLanguage: args.outputLanguage,
              voicePreset: args.voicePreset,
              noContextMode: plannerResult.context_mode === "none",
            }),
            expectedParagraphCount: contentPlan.body_paragraphs.length,
            candidateName: args.candidateName,
            contentPlan,
            plannerResult,
            jobTitle: args.jobTitle,
            jobDescription: args.jobDescription,
            stage: "repair",
          });
        } catch (regenerationError) {
          if (isProposalProviderBusyError(regenerationError)) {
            throw regenerationError;
          }
          try {
            bodyParagraphs = parseStructuredCoverLetterBody({
              content: sanitizeStructuredBodyCandidate({
                content: applyStructuredParagraphLocalRepairs({
                  bodyParagraphs,
                  flaggedSentences: verificationResult.flaggedSentences,
                  plan: plannerResult,
                  outputLanguage: args.outputLanguage,
                }).join("\n\n"),
                candidateName: args.candidateName,
                outputLanguage: args.outputLanguage,
                voicePreset: args.voicePreset,
                noContextMode: plannerResult.context_mode === "none",
              }),
              expectedParagraphCount: contentPlan.body_paragraphs.length,
              candidateName: args.candidateName,
              contentPlan,
              plannerResult,
              jobTitle: args.jobTitle,
              jobDescription: args.jobDescription,
              stage: "repair",
            });
          } catch (fallbackError) {
            return recordFallback(
              "structured_repair_validation_fail",
              fallbackError,
            );
          }
        }
      }

      try {
        renderedContent = renderStructuredCoverLetter({
          bodyParagraphs,
          outputLanguage: args.outputLanguage,
          candidateName: args.candidateName,
          voicePreset: args.voicePreset,
          noContextMode: plannerResult.context_mode === "none",
        }).content;
        assertStructuredCoverLetterTail({
          content: renderedContent,
          outputLanguage: args.outputLanguage,
          candidateName: args.candidateName,
          voicePreset: args.voicePreset,
          noContextMode: plannerResult.context_mode === "none",
        });
      } catch (error) {
        return recordFallback("structured_render_fail", error);
      }

      try {
        verificationResult = analyzeDraft({
          content: renderedContent,
          plan: plannerResult,
          format: "cover_letter",
          outputLanguage: args.outputLanguage,
          candidateName: args.candidateName,
          jobTitle: args.jobTitle,
          jobDescription: args.jobDescription,
        });
        verificationIssues = verificationResult.issues;
        structuredGenerationPath = "structured_repaired_success";
      } catch (error) {
        return recordFallback("structured_verify_fail", error);
      }
    }

    if (verificationIssues.length > 0) {
      return recordFallback(
        "structured_verify_fail",
        new Error(
          `Structured cover letter retained verifier issues after repair: ${verificationIssues
            .map((issue) => `${issue.code}:${issue.message}`)
            .join(" | ")}`,
        ),
      );
    }
  } catch (error) {
    if (isProposalProviderBusyError(error)) {
      throw error;
    }
    return recordFallback("structured_verify_fail", error);
  }

  const guardedContent = applyFinalSavedOutputBridgeGuard({
    content: renderedContent,
    format: "cover_letter",
    outputLanguage: args.outputLanguage,
  });

  if (!guardedContent.trim()) {
    return recordFallback(
      "structured_render_fail",
      new Error("Structured cover letter guard produced empty content"),
    );
  }

  try {
    assertStructuredCoverLetterTail({
      content: guardedContent,
      outputLanguage: args.outputLanguage,
      candidateName: args.candidateName,
      voicePreset: args.voicePreset,
      noContextMode: plannerResult.context_mode === "none",
    });
    assertSavedOutputHasSubstantiveBody({
      content: guardedContent,
      format: "cover_letter",
      outputLanguage: args.outputLanguage,
      candidateName: args.candidateName,
      noContextMode: plannerResult.context_mode === "none",
    });
  } catch (error) {
    return recordFallback("structured_render_fail", error);
  }

  return {
    content: guardedContent,
    sections: [{ type: "text", content: guardedContent }],
    residualVerifierWarningTag: null,
    generationPath: structuredGenerationPath,
  };
}

function normalizeOutputFormat(
  proposalType: GenerateProposalArgs["proposalType"],
): OutputFormat {
  switch (proposalType) {
    case "technical":
      return "freelance_proposal";
    case "creative":
      return "cover_letter";
    case "application_message":
      return "application_message";
    case "freelance_proposal":
      return "freelance_proposal";
    case "cover_letter":
    default:
      return "cover_letter";
  }
}

function compactParagraphSpacing(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function splitParagraphs(text: string): string[] {
  return compactParagraphSpacing(text)
    .split(/\n{2,}/)
    .map((paragraph) => compactWhitespace(paragraph))
    .filter(Boolean);
}

function splitRawParagraphs(text: string): string[] {
  const compacted = compactParagraphSpacing(text);
  if (!compacted) return [];
  return compacted
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  const protectedText = protectSentenceBoundaryAbbreviations(text);
  const matches = protectedText.match(/[^.!?\n]+(?:[.!?]+|$)/g);
  if (!matches) return compactWhitespace(text) ? [compactWhitespace(text)] : [];
  return matches
    .map((sentence) =>
      compactWhitespace(restoreSentenceBoundaryAbbreviations(sentence)),
    )
    .filter(Boolean);
}

function normalizeJoinedSentence(sentence: string): string {
  return compactWhitespace(sentence)
    .replace(/[,;:]+([.!?])$/u, "$1")
    .replace(/([.!?]),$/u, "$1")
    .replace(/,+$/u, "");
}

function joinSentences(sentences: string[]): string {
  return sentences
    .map((sentence) => normalizeJoinedSentence(sentence))
    .filter(Boolean)
    .join(" ");
}

function normalizeBoundaryLine(line: string): string {
  return normalizeProposalConstraintText(line).replace(/[,:;.!?]+$/u, "").trim();
}

function isWordCountMetaLine(line: string): boolean {
  return WORD_COUNT_META_LINE_PATTERN.test(compactWhitespace(line));
}

function isMetaOutputLine(line: string): boolean {
  const normalized = normalizeProposalConstraintText(line);
  return (
    isWordCountMetaLine(normalized) ||
    META_OUTPUT_PREFIX_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

function isMetaOutputSentence(sentence: string): boolean {
  const normalized = normalizeProposalConstraintText(sentence);
  return (
    isWordCountMetaLine(normalized) ||
    META_OUTPUT_SENTENCE_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

function isPlaceholderSignatureLine(line: string): boolean {
  return PLACEHOLDER_SIGNATURE_PATTERNS.some((pattern) => pattern.test(line.trim()));
}

function isSalutationLine(line: string): boolean {
  const normalized = normalizeBoundaryLine(line);
  return (
    normalized === "dear hiring manager" ||
    normalized === "madame, monsieur" ||
    normalized === "madame monsieur"
  );
}

const CANONICAL_CLOSING_LINES = new Set(
  [
    ...Object.values(ENGLISH_SIGNOFFS),
    ...Object.values(FRENCH_SIGNOFFS),
    "Regards,",
    "Respectfully,",
    "Yours sincerely,",
    "Yours faithfully,",
    "Respectueusement,",
  ].map((line) => normalizeBoundaryLine(line)),
);
const RAW_CANONICAL_CLOSING_LINES = [
  ...Object.values(ENGLISH_SIGNOFFS),
  ...Object.values(FRENCH_SIGNOFFS),
  "Regards,",
  "Respectfully,",
  "Yours sincerely,",
  "Yours faithfully,",
  "Respectueusement,",
];
const ESCAPED_RAW_CANONICAL_CLOSING_LINES = RAW_CANONICAL_CLOSING_LINES.map(
  (line) => line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
);
const STACKED_CLOSING_TAIL_PATTERN = new RegExp(
  `(${ESCAPED_RAW_CANONICAL_CLOSING_LINES.join("|")})\\s*(?=(${ESCAPED_RAW_CANONICAL_CLOSING_LINES.join("|")}))`,
  "gi",
);
const APPLICATION_MESSAGE_BOUNDARY_PATTERNS = [
  /^(?:hi|hello)(?:\s+there)?[!,.]*$/i,
  /^(?:bonjour|salut)[!,.]*$/i,
  /^(?:best|thanks|thank you|regards|sincerely|kind regards|best regards|warm regards|cordially|cordialement|bien cordialement|respectueusement|merci)[!,.:-]*$/i,
] as const;
const APPLICATION_MESSAGE_BOILERPLATE_SENTENCE_PATTERNS = [
  /^thank you for considering my application\b/i,
  /^merci\b[^.!?\n]{0,120}\b(?:ma candidature|l['’]attention portee a ma candidature)\b/i,
  /^i\s+have\s+(?:extensive|strong|solid|broad|significant)\s+experience\s+in\b/i,
  /^i(?:['’]m| am)\s+(?:a|an)\s+(?:talented|skilled|seasoned|experienced|passionate|dedicated|motivated|results-driven|detail-oriented)\b/i,
  /^i(?:['’]m| am)\s+(?:a|an)\s+[\w-]+\s+professional\b/i,
] as const;
const APPLICATION_MESSAGE_FOLLOW_UP_ONLY_PATTERNS = [
  /^happy to share more if useful[.!?]*$/i,
  /^if useful, i can share a bit more(?: detail| about that work)?[.!?]*$/i,
  /^if helpful, i can provide further details(?: about [^.?!]+)?[.!?]*$/i,
  /^i(?:['’]m| am)\s+happy to chat further[.!?]*$/i,
  /^happy to send over (?:a couple of |the )?relevant examples[.!?]*$/i,
  /^(?:open|happy)\s+to\s+(?:share|sharing)\s+(?:more\s+)?details?\s+about\s+my\s+(?:experience|background)\b[^.!?\n]*[.!?]*$/i,
  /^if helpful, i can share (?:more\s+)?details?\s+about\s+my\s+(?:experience|background)\b[^.!?\n]*[.!?]*$/i,
  /^je peux en dire (?:un peu )?plus si utile[.!?]*$/i,
] as const;
const APPLICATION_MESSAGE_RESUME_SUMMARY_PATTERNS = [
  /^i(?:['’]ve| have)\s+\d+(?:\+)?\s+years?\s+of\s+experience\b/i,
  /^i(?:['’]ve| have)\s+experience\s+(?:in|as)\b/i,
  /^my\s+skills\s+include\b/i,
  /^with a strong background in\b/i,
  /^my\s+(?:background|experience)\b/i,
] as const;
const APPLICATION_MESSAGE_GENERIC_FIT_PATTERNS = [
  /\bwell-suited\s+for\s+(?:this|the)\s+role\b/i,
  /\bstrong\s+fit\b/i,
  /\baligns?\s+well\s+with\b/i,
  /\baligns?\s+perfectly\b/i,
  /\b(?:makes?|positions?)\s+me\s+(?:a\s+)?strong\s+fit\b/i,
] as const;
const APPLICATION_MESSAGE_ABSTRACT_ATTRACTION_PATTERNS = [
  /^i(?:['’]m| am)\s+focused on\b/i,
  /^i(?:['’]m| am)\s+interested in\b/i,
  /^i(?:['’]m| am)\s+drawn to\b/i,
  /^the role['’]s\s+(?:focus|emphasis)\s+on\b/i,
  /\b(?:draws?\s+my\s+attention|stands?\s+out\s+to\s+me|appeals?\s+to\s+me)\b/i,
] as const;
const APPLICATION_MESSAGE_MALFORMED_DISCUSSION_FRAGMENT_PATTERNS = [
  /^i(?:['’]d| would)\s+be\s+happy\s+to\s+discuss\s+how\s+my\s+(?:background|experience|skills?|work|approach|training|certification)(?:\s+and\s+(?:background|experience|skills?|work|approach|training|certification))?[.!?]*$/i,
] as const;
const APPLICATION_MESSAGE_WEAK_EXPERIENCE_LEAD_PATTERNS = [
  /^at my previous (?:role|position|job)\b/i,
  /^in my (?:previous|last) role\b/i,
  /^in my last job\b/i,
  /^as a[n]?\s+[^,.!?]{1,40}\s+professional\b/i,
] as const;
const APPLICATION_MESSAGE_SUBSTANTIVE_FACT_LEAD_PATTERNS = [
  /^i(?:['’]ve| have)\b/i,
  /^i\s+(?:built|build|developed|develop|implemented|implement|maintained|maintain|handled|handle|supported|support|documented|document|managed|manage|worked|work|wrote|write|reduced|reduce|improved|improve|monitored|monitor|contributed|contribute|designed|design|operated|operate|coordinated|coordinate)\b/i,
  /^my (?:background|experience|skills)\b/i,
  /^with a strong background in\b/i,
  /^background in\b/i,
  /^i(?:['’]m| am)\s+focused on\b/i,
  /^i(?:['’]m| am)\s+(?:a|an)\b/i,
] as const;

type ApplicationMessageRejectionReasonTag =
  | "resume_summary_opener"
  | "generic_interest_opener"
  | "requirement_echo_proof"
  | "previous_role_proof"
  | "profile_summary_proof"
  | "generic_fit_proof"
  | "no_context_experience_claim"
  | "filler_follow_up";

function isClosingLine(line: string): boolean {
  return CANONICAL_CLOSING_LINES.has(normalizeBoundaryLine(line));
}

function isApplicationMessageBoundaryLine(line: string): boolean {
  const normalized = compactWhitespace(line);
  if (!normalized) return false;
  return APPLICATION_MESSAGE_BOUNDARY_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

function isCandidateNameLine(
  line: string,
  candidateName?: string,
): boolean {
  if (!candidateName) return false;
  return (
    normalizeBoundaryLine(line) ===
    normalizeBoundaryLine(candidateName)
  );
}

function stripLeadingMetaOutput(text: string): string {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim());

  while (
    lines.length > 0 &&
    (lines[0] === "" ||
      isMetaOutputLine(lines[0]) ||
      isWordCountMetaLine(lines[0]))
  ) {
    lines.shift();
  }

  const paragraphs = compactParagraphSpacing(lines.join("\n"))
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return "";

  const firstParagraphSentences = splitSentences(paragraphs[0]).filter(
    (sentence) => !isMetaOutputSentence(sentence),
  );
  paragraphs[0] = joinSentences(firstParagraphSentences);
  return paragraphs.filter(Boolean).join("\n\n").trim();
}

function normalizeStackedClosingTails(text: string): string {
  return text.replace(STACKED_CLOSING_TAIL_PATTERN, "$1\n");
}

function sentenceLooksClosingTailFragment(sentence: string): boolean {
  const normalized = normalizeStackedClosingTails(sentence)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return normalized.length > 0 && normalized.every((line) => isClosingLine(line));
}

function stripStandaloneBoundaryLines(args: {
  content: string;
  candidateName?: string;
  format?: OutputFormat;
}): string {
  const lines = normalizeStackedClosingTails(args.content)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim());
  const kept: string[] = [];

  for (const line of lines) {
    if (!line) {
      if (kept.length > 0 && kept[kept.length - 1] !== "") {
        kept.push("");
      }
      continue;
    }

    if (
      isMetaOutputLine(line) ||
      isWordCountMetaLine(line) ||
      isSalutationLine(line) ||
      isClosingLine(line) ||
      (args.format === "application_message" &&
        isApplicationMessageBoundaryLine(line)) ||
      isPlaceholderSignatureLine(line) ||
      isCandidateNameLine(line, args.candidateName)
    ) {
      continue;
    }

    kept.push(line);
  }

  while (kept.length > 0 && kept[0] === "") {
    kept.shift();
  }
  while (kept.length > 0 && kept[kept.length - 1] === "") {
    kept.pop();
  }

  return kept.join("\n").trim();
}

function isClosingDiscussionSentence(sentence: string): boolean {
  const normalized = normalizeProposalConstraintText(sentence);
  if (!normalized) return false;
  if (containsForbiddenProposalBridge(normalized)) return true;
  if (
    /^thank you for considering my application\b/.test(normalized) ||
    /^merci\b[^.!?\n]{0,120}\b(?:ma candidature|l['’]attention portee a ma candidature)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  if (
    /^(?:happy|glad)\s+to\s+(?:share|send|provide)\s+more\b/.test(normalized) ||
    /^(?:je peux|je serais disponible pour)\s+(?:en dire plus|partager plus de details)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  return (
    /\b(?:welcome|appreciate|value|look forward|opportunity|chance)\b/.test(
      normalized,
    ) &&
    /\b(?:discuss|exchange|speak|learn more)\b/.test(normalized)
  );
}

const GENERIC_BODY_ONLY_SENTENCE_PATTERNS = [
  /^what interests me about this role\b/i,
  /^i(?:'m| am) interested in\b/i,
  /^i(?:'m| am) drawn to\b/i,
  /^the day-to-day work(?: itself)?\b/i,
  /^the day-to-day work and operating context\b/i,
  /^the role appears to depend on\b/i,
  /^the work seems to call for\b/i,
  /^the emphasis on reliability\b/i,
  /^ce qui m['’]interesse\b/i,
  /^le travail au quotidien\b/i,
  /^le poste semble demander\b/i,
] as const;

const GENERIC_ROLE_SUMMARY_SENTENCE_PATTERNS = [
  /^the (?:role|position|opportunity|chance|focus|emphasis|balance|flexibility)\b/i,
  /^the (?:remote|part-?time|hybrid)\b/i,
  /^the chance to\b/i,
  /^the opportunity to\b/i,
  /^working remotely\b/i,
] as const;
const NO_CONTEXT_ROLE_SUMMARY_OPENER_PATTERN =
  /^(?:the\s+(?:role|position)\b|the\s+responsibilities?\s+of\b|this\s+(?:includes|involves|requires)\b)/i;
const NO_CONTEXT_OPERATIONAL_ROLE_SUMMARY_DETAIL_PATTERN =
  /\b(?:coordinating|coordinate|managing|manage|supporting|support|drafting|draft|tracking|track|maintaining|maintain|leveraging|leverage|collaborating|collaborate|campaigns?|client\s+communications?|business\s+development|proposals?|pitch\s+materials?|marketing\s+collateral|credentials|brochures?|crm|engagement|content|events?|sector\s+trends|strategies|client\s+outreach|teams?|patrolling|patrol|monitoring|monitor|surveillance|incidents?|incident\s+reporting|logs?|log|hotel\s+policies|security\s+standards|safety\s+concerns?|guest\s+services?|property|departments?)\b/i;
const LOW_VALUE_NO_CONTEXT_LEAD_PATTERNS = [
  /^the role at\b/i,
  /^the role of\b/i,
  /^the security officer role at\b/i,
  /^the security role at\b/i,
  /^the security role of\b/i,
  /^the position at\b/i,
  /^the position of\b/i,
  /^the (?:rotating\s+)?schedule\b/i,
  /^the prn\b/i,
  /^the availability\b/i,
  /^the flexibility\b/i,
  /^the day-to-day work(?: itself)?\b/i,
  /^the role appears to depend on\b/i,
  /^the work seems to call for\b/i,
] as const;
const NO_CONTEXT_SHELL_SENTENCE_PATTERN =
  /^the day-to-day work(?: itself)? is the part of the role that stands out to me most\.?$/i;
const NO_CONTEXT_BARE_EMPHASIS_FRAGMENT_PATTERN =
  /^the emphasis on\b/i;
const NO_CONTEXT_ROLE_UNDERSTANDING_PATTERN =
  /\baligns?\s+with\s+my\s+understanding\s+of\b/i;
const NO_CONTEXT_ALIGNMENT_COMMITMENT_PATTERN =
  /\baligns?\s+with\s+a\s+commitment\s+to\b/i;
const NO_CONTEXT_WEAK_COMMITMENT_PATTERN =
  /\breflects?\s+a\s+commitment\s+to\b/i;
const NO_CONTEXT_FUTURE_LEARNING_CLAUSE_PATTERN =
  /,\s*(?:and\s+)?i(?:['’]m| am)(?:\s+particularly)?\s+drawn\s+to\s+the\s+(?:chance|opportunity)\s+to\s+develop\s+skills?\s+in\b/i;
const NO_CONTEXT_FUTURE_LEARNING_SENTENCE_PATTERN =
  /^(?:the\s+chance|the\s+opportunity)\s+to\s+develop\s+skills?\s+in\b/i;
const NO_CONTEXT_DRAWN_TO_DEVELOP_SKILLS_SENTENCE_PATTERN =
  /^i(?:['’]m| am)(?:\s+particularly)?\s+drawn\s+to\s+the\s+(?:chance|opportunity)\s+to\s+develop\s+skills?\s+in\b/i;
const NO_CONTEXT_APPRECIATE_OPPORTUNITY_TO_DEVELOP_PATTERN =
  /^i\s+appreciate\s+the\s+opportunity\s+to\s+develop\s+skills?\s+in\b/i;
const NO_CONTEXT_CHANCE_TO_ENGAGE_AND_DEVELOP_PATTERN =
  /^(?:the\s+chance|the\s+opportunity)\s+to\s+engage\b[^.!?\n]{0,120}\bdevelop\s+skills?\s+in\b/i;
const NO_CONTEXT_POSITION_DETAILS_HIGHLIGHT_PATTERN =
  /^the\s+details\s+shared\s+about\s+the\s+position\s+highlight\b/i;
const NO_CONTEXT_BARE_JD_SUMMARY_FRAGMENT_PATTERN =
  /^the\s+responsibilities?\s+(?:outlined|described)(?:[—–,:-]\s*|\s+)such\s+as\b/i;
const NO_CONTEXT_WEAK_OPPORTUNITY_APPEAL_PATTERN =
  /^(?:the\s+(?:opportunity|chance|responsibilit(?:y|ies)|role|position)\b[^.!?\n]{0,180}\b(?:appeals?\s+to\s+me|is\s+(?:especially|particularly)\s+(?:appealing|compelling)|stands?\s+out)\b)/i;
const NO_CONTEXT_ENVIRONMENT_ADMIRATION_PATTERN =
  /^(?:the\s+[^.!?\n]{0,180}\b(?:resort(?:-style)?|property|location|amenities|setting|atmosphere|environment|waterfront|waterslides?|mission\s+bay|seaworld|belmont\s+park|attractions?|hospitality|guest\s+experience)\b[^.!?\n]{0,180}\b(?:appeals?|is\s+(?:especially|particularly)\s+(?:appealing|compelling)|stands?\s+out|presents?\s+(?:an\s+)?(?:engaging|dynamic|rewarding|challenging)\s+(?:work\s+)?environment|creates?\s+(?:an\s+)?(?:engaging|dynamic)\s+setting|makes?\s+it\s+an\s+attractive\s+place\s+to\s+work|adds?\s+a\s+dynamic\s+element|offers?\s+(?:a\s+)?dynamic\s+environment)\b|the\s+opportunity\s+to\s+work\b[^.!?\n]{0,180}\b(?:resort(?:-style)?|indoor\s+and\s+outdoor|varying\s+environments?)\b[^.!?\n]{0,120}\b(?:appeals?|is\s+(?:especially|particularly)\s+(?:appealing|compelling))\b)/i;
const NO_CONTEXT_PSEUDO_CAPABILITY_PATTERN =
  /\b(?:prepared\s+to\s+adapt|well\s+within\s+my\s+capabilities)\b/i;
const NO_CONTEXT_SCENIC_ENVIRONMENT_PATTERN =
  /\b(?:waterfront|waterslides?|seaworld|belmont\s+park|vibrant\s+(?:atmosphere|location|setting)|dynamic\s+(?:setting|environment)|attractive\s+place\s+to\s+work|engaging\s+(?:work\s+environment|setting)|proximity\s+to\s+attractions?|resort['’]s\s+(?:location|amenities|setting|vibrant\s+location)|property['’]s\s+vibrant\s+location|resort-style\s+amenities|resort-style\s+atmosphere|commitment\s+to\s+hospitality)\b/i;
const NO_CONTEXT_SCHEDULE_FLEX_PADDING_PATTERN =
  /\b(?:rotating\s+schedule|rotating\s+shifts?|prn|availability|flexibility)\b/i;
const NO_CONTEXT_SCHEDULE_OR_PHYSICAL_MIRROR_PATTERN =
  /\b(?:flexible\s+scheduling|flexible\s+shifts?|mornings?|evenings?|overnights?|weekends?|holidays|lift(?:ing)?\s+up\s+to\s+\d+\s*(?:lbs?|pounds?)|physical\s+(?:demands?|capability)|package\s+handling|guest\s+services?|assisting?\s+with\s+(?:guest\s+services?|package\s+handling)|patrolling\s+large\s+areas?)\b/i;
const NO_CONTEXT_GENERIC_DUTY_PRAISE_PATTERN =
  /\b(?:(?:combination|mix)\s+of\s+indoor\s+and\s+outdoor\s+duties|indoor\s+and\s+outdoor\s+duties|indoor\s+and\s+outdoor\s+patrols?)\b[^.!?\n]{0,140}\b(?:dynamic|engaging|challenging|rewarding|appeals?|stands?\s+out|presents?)\b/i;
const NO_CONTEXT_WEAK_APPEAL_SPLIT_PATTERN =
  /\b(?:appeals?\s+to\s+me|is\s+(?:especially|particularly)\s+(?:appealing|compelling)|stands?\s+out)\b/i;
const NO_CONTEXT_CONTRIBUTION_SHELL_PATTERN =
  /\bwould\s+allow(?:\s+me)?\s+to\s+contribut(?:e|ing)\b/i;
const NO_CONTEXT_GENERIC_REFLECTION_PATTERN =
  /^(?:i\s+(?:understand|appreciate|recognize|value)\b|(?:these|such)\s+(?:skills|qualities)\s+(?:are|remain)\b)/i;
const NO_CONTEXT_ROLE_RELEVANCE_DETAIL_PATTERN =
  /\b(?:collaborating|collaboration|departments?|safety\s+concerns?|clear\s+communication|incident\s+reporting|maintaining\s+order|compliance|hotel\s+policies|security\s+standards|operational\s+precision|guest\s+interactions?|teamwork|problem-?solving|detailed\s+logs?|documentation|monitoring|responding\s+to\s+incidents?)\b/i;
const CLIPPED_JD_SUMMARY_FRAGMENT_START_PATTERNS = [
  /^the\s+role['’]s\s+requirements,\s+including\b/i,
  /^the\s+structured\s+approach\s+to\b/i,
] as const;
const CLIPPED_JD_SUMMARY_FRAGMENT_VERB_PATTERN =
  /\b(?:is|are|was|were|reflects?|aligns?|highlights?|underscores?|shows?|demonstrates?|offers?|presents?|supports?|requires?|involves?|helps?|provides?|means?|allows?|keeps?|improves?|reduces?|matters?|stands?\s+out|resonates?)\b/i;
const ORPHAN_ROLE_LOCATION_FRAGMENT_PATTERN =
  /^the\s+(?:(?:[\w'’&./-]+\s+){0,6})?(?:role|position|opportunity)\s+at\b/i;
const ORPHAN_ROLE_OF_LOCATION_FRAGMENT_PATTERN =
  /^the\s+role\s+of\b[^.!?\n]{0,80}\bat\b/i;
const ORPHAN_CLIENT_LOCATION_FRAGMENT_PATTERN =
  /^working\s+directly\s+with\s+clients?\s+in\b/i;

const MALFORMED_FRAGMENT_PATTERNS = [
  /\b(?:which|that|who|while|because|although|though|and|but|or)\.$/i,
  /\b(?:which|that|who|while|because|although|though|and|but|or)[.…]+$/i,
  /\bwhich\s+(?:cut|reduced|improved|increased|lifted|kept|made|gave)\.$/i,
  /(?:[—-]|,\s*)(?:areas?|qualities?|skills?|strengths?|traits?|capabilities?)\.$/i,
  /\b(?:a|an|the)\s+(?:skill|strength|quality|trait|ability|capability)\.$/i,
  /\b(?:is|are|was|were|am)\.$/i,
  /\b(?:could|would|should|may|might)\.$/i,
  /^(?:troubleshooting|business analytics|data mining|safety compliance)\.$/i,
  /^i\s+look\s+forward\s+to\s+discussing\s+how\s+my\s+(?:background|experience|skills?|work|approach|training|certification)\.$/i,
  /^(?:i\s+would\s+welcome\s+the\s+(?:chance|opportunity)\s+to\s+discuss|i\s+would\s+welcome\s+discussing)\s+how\s+my\s+(?:background|experience|skills?|work|approach|training|certification)\.$/i,
  /^i\s+am\s+available\s+to\s+discuss\s+how\s+my\s+(?:background|experience|skills?|work|approach|training|certification)\b[^.!?\n]*\.$/i,
] as const;

const COVER_LETTER_LOWERCASE_RESTART_PATTERN =
  /^(?:i\b|i['’]m\b|my\b|the\b|this\b|these\b|as\b|working\b|collaborating\b|preparing\b|developing\b|designing\b|managing\b|coordinating\b|with\b)/i;

const BARE_NOUN_PHRASE_TAIL_PATTERN =
  /^(?:[a-z]+(?:\s+[a-z]+){0,2})\s+(?:skills?|knowledge|expertise|experience|background|training|operations|monitoring|management)\.$/i;
const TRUNCATED_ELLIPSIS_TAIL_PATTERN =
  /\b[a-z]{1,8}(?:…\.{0,3}|\.{3,})$/i;

const NUMERIC_RESIDUE_PATTERNS = [
  /^\d+\s+(?:month|months|year|years)\s+work experience\b/i,
  /^\d+\s+(?:month|months|year|years)\b/i,
  /\bfor a combined \d+\s+(?:month|months|year|years)\b/i,
] as const;

const SENTENCE_BOUNDARY_ABBREVIATIONS = [
  "Pvt.",
  "Ltd.",
  "St.",
  "Inc.",
  "Co.",
  "Corp.",
  "Mr.",
  "Mrs.",
  "Ms.",
  "Dr.",
  "Sr.",
  "Jr.",
  "D.C.",
  "D. C.",
] as const;
const ENTITY_INITIALS_WITH_NAME_PATTERN =
  /\b(?:[A-Z]\.\s*){2,}[A-Z][\w&'.-]*\b/g;

const EVIDENCE_ACTION_VERB_PATTERN =
  /\b(?:built|designed|developed|maintained|managed|led|handled|contributed|partnered|worked|evaluated|documented|created|used|reduced|improved|increased|decreased|installed|implemented|migrated|launched|supervised|optimized|executed)\b/i;

const WORK_SURFACE_DETAIL_PATTERN =
  /\b(?:work|workflow|records?|coordination|communication|process|api|apis|database|security|documentation|handoff|ticket|queue|reporting|tooling|evaluation|delivery|engineers?|stakeholders?|drawings?|technical drawings?|documents?|documentation|construction|designs?|specifications?|requirements?|reviews?|reviewing|layouts?|monitoring|operations?|drills?|training|project teams?|project requirements?|client requirements?|surveillance|incidents?|incident reporting|patrolling|logs?|policies|departments?|guests?|property|hospitality|compliance|order)\b/i;

const FACT_DUPLICATE_STOPWORDS = new Set([
  "about",
  "after",
  "along",
  "also",
  "and",
  "around",
  "because",
  "been",
  "being",
  "both",
  "close",
  "daily",
  "directly",
  "every",
  "from",
  "gave",
  "give",
  "have",
  "into",
  "more",
  "most",
  "over",
  "role",
  "team",
  "that",
  "their",
  "them",
  "this",
  "through",
  "using",
  "used",
  "with",
  "work",
  "worked",
]);

function protectSentenceBoundaryAbbreviations(value: string): string {
  let protectedValue = value;
  for (const abbreviation of SENTENCE_BOUNDARY_ABBREVIATIONS) {
    const escaped = abbreviation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    protectedValue = protectedValue.replace(
      new RegExp(`\\b${escaped}(?=\\s|$)`, "g"),
      abbreviation.replace(/\./g, "__DOT__"),
    );
  }
  protectedValue = protectedValue.replace(
    ENTITY_INITIALS_WITH_NAME_PATTERN,
    (match) => match.replace(/\./g, "__DOT__"),
  );
  return protectedValue;
}

function restoreSentenceBoundaryAbbreviations(value: string): string {
  return value.replace(/__DOT__/g, ".");
}

function normalizeFactDedupToken(token: string): string {
  const normalized = token.toLowerCase();
  if (/^\d/.test(normalized)) return normalized;
  if (normalized.length > 3 && normalized.endsWith("s")) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

function extractSentenceFactTokens(sentence: string): string[] {
  return Array.from(
    new Set(
      compactWhitespace(sentence)
        .split(/[^A-Za-z0-9+#-]+/)
        .map((token) => normalizeFactDedupToken(token))
        .filter(
          (token) =>
            Boolean(token) &&
            !FACT_DUPLICATE_STOPWORDS.has(token) &&
            (token.length >= 4 || /\d/.test(token) || token === "api"),
        ),
    ),
  );
}

function sentencesShareUnderlyingFact(
  leftTokens: string[],
  rightTokens: string[],
): boolean {
  if (leftTokens.length < 3 || rightTokens.length < 3) return false;

  const rightTokenSet = new Set(rightTokens);
  const sharedTokens = leftTokens.filter((token) => rightTokenSet.has(token));
  if (sharedTokens.length < 3) return false;

  const smallerTokenCount = Math.min(leftTokens.length, rightTokens.length);
  const overlapRatio = sharedTokens.length / smallerTokenCount;
  const sharedNumericAnchor = sharedTokens.some((token) => /\d/.test(token));
  const sharedRareAnchor = sharedTokens.some((token) => token.length >= 6);

  return (
    (sharedNumericAnchor && overlapRatio >= 0.34) ||
    (sharedRareAnchor && sharedTokens.length >= 4) ||
    overlapRatio >= 0.7
  );
}

function sentenceLooksNumericResidue(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (!normalized) return false;
  return NUMERIC_RESIDUE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sentenceLooksGenericRoleSummary(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (!normalized) return false;
  if (sentenceLooksNumericResidue(normalized)) return false;
  if (
    sentenceHasGroundedWorkSurfaceDetail(sentence) ||
    sentenceHasConcreteEvidenceAnchor(sentence)
  ) {
    return false;
  }
  return GENERIC_ROLE_SUMMARY_SENTENCE_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

function sentenceLooksWeakAdmirationOrCapability(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (!normalized || sentenceLooksNumericResidue(normalized)) {
    return false;
  }

  return (
    NO_CONTEXT_WEAK_OPPORTUNITY_APPEAL_PATTERN.test(normalized) ||
    NO_CONTEXT_ENVIRONMENT_ADMIRATION_PATTERN.test(normalized) ||
    NO_CONTEXT_PSEUDO_CAPABILITY_PATTERN.test(normalized)
  );
}

function sentenceLooksGenericNoContextReflection(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (!normalized || sentenceLooksNumericResidue(normalized)) {
    return false;
  }

  return NO_CONTEXT_GENERIC_REFLECTION_PATTERN.test(normalized);
}

function sentenceLooksNoContextShellRhetoric(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (!normalized || sentenceLooksNumericResidue(normalized)) {
    return false;
  }

  return (
    sentenceLooksGenericNoContextReflection(normalized) ||
    sentenceLooksWeakAdmirationOrCapability(normalized) ||
    NO_CONTEXT_SCENIC_ENVIRONMENT_PATTERN.test(normalized) ||
    NO_CONTEXT_SCHEDULE_OR_PHYSICAL_MIRROR_PATTERN.test(normalized) ||
    NO_CONTEXT_GENERIC_DUTY_PRAISE_PATTERN.test(normalized)
  );
}

function sentenceHasConcreteEvidenceAnchor(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (!normalized || sentenceLooksNumericResidue(normalized)) {
    return false;
  }
  if (
    /^(?:i\s+(?:hold|held|worked|have worked|have experience|supported|handled|managed|supervised|documented|designed|developed|built|maintained|contributed|led)\b|as a\b)/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (
    /\b\d+(?:[%+]|k\b|x\b|\s*(?:percent|cctv|api|apis|cameras?))\b/i.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/\bat\s+[A-Z][\w&'.-]+/u.test(sentence)) {
    return true;
  }
  if (EVIDENCE_ACTION_VERB_PATTERN.test(normalized)) {
    return extractSentenceFactTokens(sentence).length >= 4;
  }
  return false;
}

function sentenceHasGroundedWorkSurfaceDetail(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (!normalized || sentenceLooksNumericResidue(normalized)) {
    return false;
  }
  const factTokens = extractSentenceFactTokens(sentence);
  return (
    factTokens.length >= 5 &&
    WORK_SURFACE_DETAIL_PATTERN.test(normalized)
  );
}

function sentenceLooksSaveableWorkSurfaceSentence(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (
    !normalized ||
    sentenceLooksNumericResidue(normalized) ||
    sentenceLooksGenericRoleSummary(sentence)
  ) {
    return false;
  }
  return sentenceHasGroundedWorkSurfaceDetail(sentence);
}

function sentenceLooksGroundedNoContextRoleSummarySentence(
  sentence: string,
): boolean {
  const normalized = compactWhitespace(sentence);
  if (
    !normalized ||
    sentenceLooksNumericResidue(normalized) ||
    !NO_CONTEXT_ROLE_SUMMARY_OPENER_PATTERN.test(normalized)
  ) {
    return false;
  }

  const factTokens = extractSentenceFactTokens(sentence);
  return (
    factTokens.length >= 5 &&
    NO_CONTEXT_OPERATIONAL_ROLE_SUMMARY_DETAIL_PATTERN.test(normalized)
  );
}

function sentenceLooksGroundedNoContextSupportSentence(
  sentence: string,
): boolean {
  const normalized = compactWhitespace(sentence);
  if (
    !normalized ||
    sentenceLooksNumericResidue(normalized) ||
    sentenceLooksMalformedFragment(normalized) ||
    sentenceLooksNoContextShellRhetoric(normalized) ||
    NO_CONTEXT_CONTRIBUTION_SHELL_PATTERN.test(normalized) ||
    sentenceLooksUnsupportedRequirementLeakage(normalized)
  ) {
    return false;
  }

  const factTokens = extractSentenceFactTokens(sentence);
  if (factTokens.length < 5) {
    return false;
  }

  if (sentenceLooksGroundedNoContextRoleSummarySentence(normalized)) {
    return true;
  }

  return (
    NO_CONTEXT_ROLE_RELEVANCE_DETAIL_PATTERN.test(normalized) &&
    (WORK_SURFACE_DETAIL_PATTERN.test(normalized) ||
      /\b(?:role|work|responsibilities|operations?|security|hospitality|compliance|communication|coordination|reporting|policies|guests?|order)\b/i.test(
        normalized,
      ))
  );
}

function countNoContextGroundedOperationalSentences(
  sentences: string[],
): number {
  const groundedRoleSummaryIndices = new Set(
    sentences.flatMap((sentence, index) =>
      sentenceLooksGroundedNoContextRoleSummarySentence(sentence) ? [index] : [],
    ),
  );
  const groundedSentenceIndices = new Set(
    sentences.flatMap((sentence, index) =>
      sentenceLooksSaveableWorkSurfaceSentence(sentence) ? [index] : [],
    ),
  );

  for (const index of groundedRoleSummaryIndices) {
    const hasGroundedPartner = sentences.some((otherSentence, otherIndex) => {
      if (otherIndex === index) return false;
      return (
        groundedSentenceIndices.has(otherIndex) ||
        groundedRoleSummaryIndices.has(otherIndex) ||
        sentenceLooksSaveableWorkSurfaceSentence(otherSentence)
      );
    });
    if (hasGroundedPartner) {
      groundedSentenceIndices.add(index);
    }
  }

  return groundedSentenceIndices.size;
}

function countNoContextGroundedSupportSentences(sentences: string[]): number {
  return sentences.filter((sentence) =>
    sentenceLooksGroundedNoContextSupportSentence(sentence),
  ).length;
}

function sentenceLooksMalformedFragment(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (!normalized) return false;
  const looksLikeOrphanRoleLocationFragment =
    ORPHAN_ROLE_LOCATION_FRAGMENT_PATTERN.test(normalized) &&
    !/\b(?:is|are|was|were|offers?|requires?|involves?|focuses?|centers?|helps?|helped|builds?|built|develops?|developed|designs?|designed|led|lead|managed|manage|coordinated|coordinate|collaborated|collaborate|honed|shaped|proved|provides?|provided|gave|gives)\b/i.test(
      normalized,
    );
  const looksLikeOrphanRoleOfLocationFragment =
    ORPHAN_ROLE_OF_LOCATION_FRAGMENT_PATTERN.test(normalized) &&
    !/\b(?:is|are|was|were|offers?|requires?|involves?|focuses?|centers?|helps?|helped|builds?|built|develops?|developed|designs?|designed|led|lead|managed|manage|coordinated|coordinate|collaborated|collaborate|honed|shaped|proved|provides?|provided|gave|gives)\b/i.test(
      normalized,
    );
  const looksLikeOrphanClientLocationFragment =
    ORPHAN_CLIENT_LOCATION_FRAGMENT_PATTERN.test(normalized) &&
    !/\b(?:required|requires|helped|helps|honed|involved|involves|meant|means|allowed|allows|gave|gives|provided|provides|built|builds|developed|develops|shaped|shapes|strengthened|strengthens)\b/i.test(
      normalized,
    );
  const clippedDeterminerContinuation = (() => {
    if (!/^(?:the|this|these|those)\b/i.test(normalized)) return false;
    const match = normalized.match(
      /\bi(?:\s+|(?:['’]ve|have)\s+)(installed|built|developed|created|implemented|maintained|managed|configured|designed)\b/i,
    );
    if (!match || match.index === undefined) return false;
    const trailing = compactWhitespace(
      normalized.slice(match.index + match[0].length),
    );
    if (!trailing) return false;
    return !/\b(?:were|was|are|is|reduced|improved|increased|decreased|provided|provides|gave|gives|enabled|enables|helped|helps|supported|supports|kept|keeps|led|lead|resulted|results|cut|cuts|boosted|boosts|made|make|makes|allow|allows|maintain|maintains|protect|protects|strengthen|strengthens|improve|improves|streamline|streamlines)\b/i.test(
      trailing,
    );
  })();
  const looksLikeBareNounPhraseTail =
    BARE_NOUN_PHRASE_TAIL_PATTERN.test(normalized) &&
    !/\b(?:is|are|was|were|am|be|been|being|have|has|had|do|does|did|can|could|would|should|may|might|must|will|shall)\b/i.test(
      normalized,
    );
  const looksLikeTruncatedEllipsisTail =
    TRUNCATED_ELLIPSIS_TAIL_PATTERN.test(normalized);
  const looksLikeClippedJDSummaryFragment =
    CLIPPED_JD_SUMMARY_FRAGMENT_START_PATTERNS.some((pattern) =>
      pattern.test(normalized),
    ) && !CLIPPED_JD_SUMMARY_FRAGMENT_VERB_PATTERN.test(normalized);
  const looksLikeFirstPersonAbilityFragment =
    /^(?:my\s+(?:ability|capability)\s+to\b|my\s+(?:skill|strength)\s+in\b)/i.test(
      normalized,
    ) &&
    !/\b(?:is|are|was|were|has|have|had|helps?|helped|supports?|supported|allows?|allowed|enables?|enabled|proves?|proved|shows?|demonstrates?|keeps?|kept|made|makes|resulted|results|matters?)\b/i.test(
      normalized,
    );
  return (
    sentenceLooksNumericResidue(normalized) ||
    looksLikeOrphanRoleLocationFragment ||
    looksLikeOrphanRoleOfLocationFragment ||
    looksLikeOrphanClientLocationFragment ||
    clippedDeterminerContinuation ||
    looksLikeBareNounPhraseTail ||
    looksLikeTruncatedEllipsisTail ||
    looksLikeClippedJDSummaryFragment ||
    looksLikeFirstPersonAbilityFragment ||
    MALFORMED_FRAGMENT_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

function sentenceLooksGenericBodyOnly(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (!normalized) return true;
  if (isMetaOutputSentence(normalized) || isClosingDiscussionSentence(normalized)) {
    return true;
  }
  if (sentenceLooksWeakAdmirationOrCapability(normalized)) {
    return true;
  }
  return (
    sentenceLooksNumericResidue(normalized) ||
    sentenceLooksGenericRoleSummary(normalized) ||
    GENERIC_BODY_ONLY_SENTENCE_PATTERNS.some((pattern) =>
      pattern.test(normalized),
    )
  );
}

function sentenceLooksApplicationMessageBoilerplate(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (!normalized) return true;

  return (
    sentenceLooksClosingTailFragment(normalized) ||
    APPLICATION_MESSAGE_BOUNDARY_PATTERNS.some((pattern) =>
      pattern.test(normalized),
    ) ||
    APPLICATION_MESSAGE_BOILERPLATE_SENTENCE_PATTERNS.some((pattern) =>
      pattern.test(normalized),
    )
  );
}

function stripStructuredApplicationMessageLabelPrefix(sentence: string): string {
  return compactWhitespace(
    sentence.replace(/^(?:opener|proof_line|follow_up_line):\s*/i, ""),
  );
}

function sentenceLooksApplicationMessageFollowUpOnly(sentence: string): boolean {
  const normalized = stripStructuredApplicationMessageLabelPrefix(sentence);
  if (!normalized) return false;
  return APPLICATION_MESSAGE_FOLLOW_UP_ONLY_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

function sentenceLooksApplicationMessageSubstantiveFact(sentence: string): boolean {
  const normalized = stripStructuredApplicationMessageLabelPrefix(sentence);
  if (!normalized || sentenceLooksApplicationMessageBoilerplate(normalized)) {
    return false;
  }

  return (
    APPLICATION_MESSAGE_SUBSTANTIVE_FACT_LEAD_PATTERNS.some((pattern) =>
      pattern.test(normalized),
    ) ||
    (APPLICATION_MESSAGE_SIGNAL_ACTION_PATTERN.test(normalized) &&
      /\bI\b/u.test(normalized)) ||
    APPLICATION_MESSAGE_SIGNAL_QUANTIFIED_PATTERN.test(normalized)
  );
}

function sentenceLooksApplicationMessageResumeSummary(sentence: string): boolean {
  const normalized = stripStructuredApplicationMessageLabelPrefix(sentence);
  if (!normalized) return false;
  return APPLICATION_MESSAGE_RESUME_SUMMARY_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

function sentenceLooksApplicationMessageGenericFit(sentence: string): boolean {
  const normalized = stripStructuredApplicationMessageLabelPrefix(sentence);
  if (!normalized) return false;
  return APPLICATION_MESSAGE_GENERIC_FIT_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

function sentenceLooksApplicationMessageRequirementEcho(
  sentence: string,
): boolean {
  const normalized = stripStructuredApplicationMessageLabelPrefix(sentence);
  if (!normalized) return false;
  return (
    isApplicationMessageRequirementStyleEvidence(normalized) ||
    /\b(?:meet|meets|meeting)\s+(?:the\s+)?(?:minimum\s+)?requirements?\b/i.test(
      normalized,
    ) ||
    /\b(?:minimum|required|preferred)\b[^.!?\n]{0,60}\b(?:license|licen[cs]e|certification|credential|clearance)\b/i.test(
      normalized,
    )
  );
}

function sentenceLooksApplicationMessageAbstractAttraction(
  sentence: string,
): boolean {
  const normalized = stripStructuredApplicationMessageLabelPrefix(sentence);
  if (!normalized) return false;
  return APPLICATION_MESSAGE_ABSTRACT_ATTRACTION_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

function sentenceLooksApplicationMessageMalformedDiscussionFragment(
  sentence: string,
): boolean {
  const normalized = stripStructuredApplicationMessageLabelPrefix(sentence);
  if (!normalized) return false;
  return APPLICATION_MESSAGE_MALFORMED_DISCUSSION_FRAGMENT_PATTERNS.some(
    (pattern) => pattern.test(normalized),
  );
}

function sentenceLooksApplicationMessageWeakExperienceLead(
  sentence: string,
): boolean {
  const normalized = stripStructuredApplicationMessageLabelPrefix(sentence);
  if (!normalized) return false;
  return APPLICATION_MESSAGE_WEAK_EXPERIENCE_LEAD_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

function sentenceLooksApplicationMessageOpenerAsProof(sentence: string): boolean {
  const normalized = stripStructuredApplicationMessageLabelPrefix(sentence);
  if (!normalized) return false;
  return (
    /^i(?:['’]ve| have)\b/i.test(normalized) ||
    /\bI\s+(?:built|build|developed|develop|implemented|implement|maintained|maintain|handled|handle|supported|support|documented|document|managed|manage|worked|write|wrote|reduced|reduce|improved|improve|monitored|monitor|contributed|contribute|designed|design|operated|operate|coordinated|coordinate)\b/i.test(
      normalized,
    ) ||
    APPLICATION_MESSAGE_SIGNAL_QUANTIFIED_PATTERN.test(normalized) ||
    /^my (?:background|experience|skills)\b/i.test(normalized) ||
    /^with a strong background in\b/i.test(normalized) ||
    /^background in\b/i.test(normalized) ||
    /^i(?:['’]m| am)\s+(?:a|an)\b/i.test(normalized)
  );
}

function sentenceLooksApplicationMessageInvalidOpener(sentence: string): boolean {
  const normalized = stripStructuredApplicationMessageLabelPrefix(sentence);
  if (!normalized) return true;
  return (
    sentenceLooksMalformedFragment(normalized) ||
    sentenceLooksApplicationMessageMalformedDiscussionFragment(normalized) ||
    sentenceLooksApplicationMessageWeakExperienceLead(normalized) ||
    sentenceLooksApplicationMessageOpenerAsProof(normalized) ||
    sentenceLooksApplicationMessageResumeSummary(normalized) ||
    sentenceLooksApplicationMessageRequirementEcho(normalized) ||
    sentenceLooksApplicationMessageAbstractAttraction(normalized) ||
    sentenceLooksApplicationMessageGenericFit(normalized)
  );
}

function sentenceLooksApplicationMessageInvalidProofLine(
  sentence: string,
): boolean {
  const normalized = stripStructuredApplicationMessageLabelPrefix(sentence);
  if (!normalized) return true;
  return (
    sentenceLooksMalformedFragment(normalized) ||
    sentenceLooksApplicationMessageMalformedDiscussionFragment(normalized) ||
    sentenceLooksApplicationMessageWeakExperienceLead(normalized) ||
    sentenceLooksApplicationMessageResumeSummary(normalized) ||
    sentenceLooksApplicationMessageRequirementEcho(normalized) ||
    sentenceLooksApplicationMessageGenericFit(normalized) ||
    sentenceLooksApplicationMessageAbstractAttraction(normalized) ||
    sentenceLooksApplicationMessageFollowUpOnly(normalized) ||
    isClosingDiscussionSentence(normalized)
  );
}

function sentenceLooksApplicationMessageInvalidFollowUp(
  sentence: string,
): boolean {
  const normalized = stripStructuredApplicationMessageLabelPrefix(sentence);
  if (!normalized) return true;
  return (
    sentenceLooksMalformedFragment(normalized) ||
    sentenceLooksApplicationMessageMalformedDiscussionFragment(normalized) ||
    sentenceLooksApplicationMessageFollowUpOnly(normalized) ||
    isClosingDiscussionSentence(normalized) ||
    sentenceLooksApplicationMessageResumeSummary(normalized) ||
    sentenceLooksApplicationMessageGenericFit(normalized)
  );
}

function collectApplicationMessageRejectionReasonTags(args: {
  opener: string;
  proofLine?: string;
  followUpLine?: string;
  noContextMode: boolean;
}): ApplicationMessageRejectionReasonTag[] {
  const reasons = new Set<ApplicationMessageRejectionReasonTag>();
  const opener = stripStructuredApplicationMessageLabelPrefix(args.opener);
  const proofLine = stripStructuredApplicationMessageLabelPrefix(
    args.proofLine ?? "",
  );
  const followUpLine = stripStructuredApplicationMessageLabelPrefix(
    args.followUpLine ?? "",
  );

  if (
    opener &&
    (sentenceLooksApplicationMessageResumeSummary(opener) ||
      sentenceLooksApplicationMessageOpenerAsProof(opener) ||
      sentenceLooksApplicationMessageWeakExperienceLead(opener))
  ) {
    reasons.add("resume_summary_opener");
  }

  if (opener && sentenceLooksApplicationMessageAbstractAttraction(opener)) {
    reasons.add("generic_interest_opener");
  }

  if (proofLine && sentenceLooksApplicationMessageRequirementEcho(proofLine)) {
    reasons.add("requirement_echo_proof");
  }

  if (proofLine && sentenceLooksApplicationMessageWeakExperienceLead(proofLine)) {
    reasons.add("previous_role_proof");
  }

  if (
    proofLine &&
    (sentenceLooksApplicationMessageResumeSummary(proofLine) ||
      /^i(?:['’]ve| have)\s+(?:a\s+)?proven\s+track\s+record\b/i.test(
        proofLine,
      ) ||
      /^my\s+background\s+includes\b/i.test(proofLine) ||
      /^as a[n]?\s+[^,.!?]{1,40}\s+professional\b/i.test(proofLine))
  ) {
    reasons.add("profile_summary_proof");
  }

  if (proofLine && sentenceLooksApplicationMessageGenericFit(proofLine)) {
    reasons.add("generic_fit_proof");
  }

  if (
    args.noContextMode &&
    proofLine &&
    sentenceLooksApplicationMessageNoContextUnsupportedExperienceClaim(
      proofLine,
    )
  ) {
    reasons.add("no_context_experience_claim");
  }

  if (
    followUpLine &&
    (sentenceLooksApplicationMessageInvalidFollowUp(followUpLine) ||
      sentenceLooksApplicationMessageFollowUpOnly(followUpLine) ||
      isClosingDiscussionSentence(followUpLine) ||
      /\baligns?\s+with\b/i.test(followUpLine) ||
      /\bdiscuss\s+(?:further|more)\b/i.test(followUpLine))
  ) {
    reasons.add("filler_follow_up");
  }

  return Array.from(reasons);
}

function sentenceLooksApplicationMessageNoContextAbstractAttraction(
  sentence: string,
): boolean {
  const normalized = stripStructuredApplicationMessageLabelPrefix(sentence);
  if (!normalized) return false;
  return (
    sentenceLooksApplicationMessageAbstractAttraction(normalized) &&
    !sentenceHasGroundedWorkSurfaceDetail(normalized)
  );
}

function sentenceLooksApplicationMessageNoContextUnsupportedExperienceClaim(
  sentence: string,
): boolean {
  const normalized = stripStructuredApplicationMessageLabelPrefix(sentence);
  if (!normalized) return false;

  return (
    /\b(?:at|in)\s+my\s+previous\b/i.test(normalized) ||
    /\bin\s+previous\s+roles?\b/i.test(normalized) ||
    /\bduring\s+my\b/i.test(normalized) ||
    /\bmy\s+(?:experience|background)\b/i.test(normalized) ||
    /\b(?:worked|working)\s+(?:as|at)\b/i.test(normalized) ||
    /\bserved\s+as\b/i.test(normalized) ||
    /\bi(?:['’]ve| have)\s+(?:worked|managed|handled|supported|documented|monitored|coordinated|conducted|performed|responded|patrolled|de-?escalated|reduced|improved|built|designed|developed|maintained|operated)\b/i.test(
      normalized,
    ) ||
    /\bi\s+(?:worked|managed|handled|supported|documented|monitored|coordinated|conducted|performed|responded|patrolled|de-?escalated|reduced|improved|built|designed|developed|maintained|operated)\b/i.test(
      normalized,
    ) ||
    /\bat\s+[A-Z][\w&'.-]+\b[^.!?\n]{0,120}\bi\s+(?:worked|managed|handled|supported|documented|monitored|coordinated|conducted|performed|responded|patrolled|de-?escalated|reduced|improved|built|designed|developed|maintained|operated)\b/i.test(
      normalized,
    )
  );
}

function applicationMessageViolatesSemanticContract(args: {
  opener: string;
  proofLine?: string;
  followUpLine?: string;
  noContextMode: boolean;
}): boolean {
  const opener = stripStructuredApplicationMessageLabelPrefix(args.opener);
  const proofLine = stripStructuredApplicationMessageLabelPrefix(
    args.proofLine ?? "",
  );
  const followUpLine = stripStructuredApplicationMessageLabelPrefix(
    args.followUpLine ?? "",
  );

  if (!opener || sentenceLooksApplicationMessageInvalidOpener(opener)) {
    return true;
  }

  if (
    args.noContextMode &&
    (sentenceLooksApplicationMessageNoContextAbstractAttraction(opener) ||
      sentenceLooksApplicationMessageNoContextUnsupportedExperienceClaim(
        opener,
      ))
  ) {
    return true;
  }

  if (proofLine) {
    if (sentenceLooksApplicationMessageInvalidProofLine(proofLine)) {
      return true;
    }
    if (
      args.noContextMode &&
      (sentenceLooksApplicationMessageNoContextAbstractAttraction(proofLine) ||
        sentenceLooksApplicationMessageNoContextUnsupportedExperienceClaim(
          proofLine,
        ))
    ) {
      return true;
    }
  }

  if (followUpLine && sentenceLooksApplicationMessageInvalidFollowUp(followUpLine)) {
    return true;
  }

  return (
    Boolean(proofLine) &&
    Boolean(followUpLine) &&
    applicationMessageLooksLikeFactDumpWithFiller({
      opener,
      proofLine,
      followUpLine,
    })
  );
}

function applicationMessageLooksLikeFactDumpWithFiller(args: {
  opener: string;
  proofLine: string;
  followUpLine: string;
}): boolean {
  return (
    sentenceLooksApplicationMessageSubstantiveFact(args.opener) &&
    sentenceLooksApplicationMessageSubstantiveFact(args.proofLine) &&
    sentenceLooksApplicationMessageFollowUpOnly(args.followUpLine)
  );
}

function applicationMessageHasRescuedStructuredShape(args: {
  sentences: string[];
  noContextMode: boolean;
}): boolean {
  if (args.sentences.length !== 2) {
    return false;
  }

  const [proofLine, followUpLine] = args.sentences;
  if (!proofLine || !followUpLine) {
    return false;
  }

  if (sentenceLooksApplicationMessageInvalidProofLine(proofLine)) {
    return false;
  }

  if (!sentenceHasGroundedWorkSurfaceDetail(proofLine)) {
    return false;
  }

  if (
    args.noContextMode &&
    (sentenceLooksApplicationMessageNoContextAbstractAttraction(proofLine) ||
      sentenceLooksApplicationMessageNoContextUnsupportedExperienceClaim(
        proofLine,
      ))
  ) {
    return false;
  }

  const normalizedFollowUp = normalizeProposalConstraintText(followUpLine);
  const isDeterministicSafeFollowUp =
    normalizedFollowUp ===
      normalizeProposalConstraintText(
        ENGLISH_APPLICATION_MESSAGE_FINAL_SENTENCE,
      ) ||
    normalizedFollowUp ===
      normalizeProposalConstraintText(
        FRENCH_APPLICATION_MESSAGE_FINAL_SENTENCE,
      );

  if (
    !isDeterministicSafeFollowUp &&
    (sentenceLooksApplicationMessageInvalidFollowUp(followUpLine) ||
      sentenceLooksApplicationMessageSubstantiveFact(followUpLine))
  ) {
    return false;
  }

  return true;
}

function sentenceLooksLowValueNoContextLead(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (!normalized || sentenceLooksNumericResidue(normalized)) {
    return false;
  }
  if (LOW_VALUE_NO_CONTEXT_LEAD_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  if (sentenceLooksGenericBodyOnly(normalized)) {
    return true;
  }
  if (sentenceLooksNoContextShellRhetoric(normalized)) {
    return true;
  }
  if (sentenceHasGroundedWorkSurfaceDetail(normalized)) {
    return false;
  }
  return (
    /^(?:the|my)\s+/i.test(normalized) &&
    /\b(?:schedule|availability|flexibility|rotating\s+shifts?|prn)\b/i.test(
      normalized,
    )
  );
}

function buildStandaloneNoContextSentenceFromFragment(
  fragment: string,
): string | null {
  const cleaned = compactWhitespace(
    stripLeadingSentenceConnector(fragment)
      .replace(/[,:;—–-]+\s*$/u, "")
      .replace(/\b(?:which|that|and)\s*$/i, ""),
  );
  if (!cleaned) return null;
  if (/^the\s+(?:opportunity|chance)\s+to\b/i.test(cleaned)) {
    return null;
  }

  const transformedCandidate =
    (() => {
      const match = cleaned.match(/^the\s+emphasis\s+on\s+(.+)$/i);
      if (!match) return null;
      return `The role places emphasis on ${match[1]}`;
    })() ??
    (() => {
      const match = cleaned.match(/^the\s+focus\s+on\s+(.+)$/i);
      if (!match) return null;
      return `The role focuses on ${match[1]}`;
    })();

  const candidate =
    buildStandaloneSentenceFromCandidateFragment(cleaned) ??
    (transformedCandidate
      ? ensureTerminalSentence(capitalizeSentenceStart(transformedCandidate))
      : null) ??
    (sentenceHasGroundedWorkSurfaceDetail(cleaned) ||
    sentenceLooksSaveableWorkSurfaceSentence(cleaned) ||
    /^the\b/i.test(cleaned)
      ? ensureTerminalSentence(capitalizeSentenceStart(cleaned))
      : null);

  return candidate && compactWhitespace(candidate) !== compactWhitespace(fragment)
    ? candidate
    : null;
}

function buildGenericNoContextSentenceFromFragment(
  fragment: string,
): string | null {
  const cleaned = compactWhitespace(
    stripLeadingSentenceConnector(fragment)
      .replace(/[,:;—–-]+\s*$/u, "")
      .replace(/\b(?:which|that|and)\s*$/i, ""),
  );
  if (
    !cleaned ||
    sentenceLooksMalformedFragment(cleaned) ||
    sentenceLooksNumericResidue(cleaned)
  ) {
    return null;
  }
  return ensureTerminalSentence(capitalizeSentenceStart(cleaned));
}

function getNoContextEarlyBodySentenceCleanup(sentence: string):
  | {
      mode: "remove" | "neutralize";
      replacement: string;
    }
  | null {
  const normalized = compactWhitespace(sentence);
  if (!normalized) return null;

  if (NO_CONTEXT_SHELL_SENTENCE_PATTERN.test(normalized)) {
    return {
      mode: "remove",
      replacement: "",
    };
  }

  const neutralizeFromPattern = (pattern: RegExp): string | null => {
    const match = pattern.exec(normalized);
    if (!match || match.index === undefined || match.index <= 0) {
      return null;
    }
    const fragment = normalized.slice(0, match.index);
    return (
      buildStandaloneNoContextSentenceFromFragment(fragment) ??
      (pattern === NO_CONTEXT_FUTURE_LEARNING_CLAUSE_PATTERN
        ? buildGenericNoContextSentenceFromFragment(fragment)
        : null)
    );
  };

  const neutralizeGroundedNoContextPrefix = (pattern: RegExp): string | null => {
    const match = pattern.exec(normalized);
    if (!match || match.index === undefined || match.index <= 0) {
      return null;
    }
    const fragment = normalized.slice(0, match.index);
    const candidate = buildStandaloneNoContextSentenceFromFragment(fragment);
    if (!candidate) return null;
    return sentenceLooksGroundedNoContextSupportSentence(candidate)
      ? candidate
      : null;
  };

  const weakAppealNeutralized = neutralizeGroundedNoContextPrefix(
    NO_CONTEXT_WEAK_APPEAL_SPLIT_PATTERN,
  );
  if (weakAppealNeutralized) {
    return {
      mode: "neutralize",
      replacement: weakAppealNeutralized,
    };
  }

  const contributionNeutralized = neutralizeGroundedNoContextPrefix(
    NO_CONTEXT_CONTRIBUTION_SHELL_PATTERN,
  );
  if (
    contributionNeutralized &&
    !/^[A-Z][a-z]+ing\b/.test(contributionNeutralized)
  ) {
    return {
      mode: "neutralize",
      replacement: contributionNeutralized,
    };
  }

  if (sentenceLooksNoContextShellRhetoric(normalized)) {
    return {
      mode: "remove",
      replacement: "",
    };
  }

  if (
    NO_CONTEXT_BARE_EMPHASIS_FRAGMENT_PATTERN.test(normalized) &&
    !/\b(?:reflects?|aligns?|highlights?|underscores?|shows?|demonstrates?|is|are|offers?|presents?|stands?\s+out)\b/i.test(
      normalized,
    )
  ) {
    return {
      mode: "remove",
      replacement: "",
    };
  }

  if (NO_CONTEXT_BARE_JD_SUMMARY_FRAGMENT_PATTERN.test(normalized)) {
    return {
      mode: "remove",
      replacement: "",
    };
  }

  if (
    sentenceLooksLowValueNoContextLead(normalized) ||
    (NO_CONTEXT_SCHEDULE_FLEX_PADDING_PATTERN.test(normalized) &&
      /\b(?:aligns?\s+with\s+my\s+availability|fit(?:s)?\s+well\s+with\s+my\s+availability|prn\s+flexibility)\b/i.test(
        normalized,
      ))
  ) {
    return {
      mode: "remove",
      replacement: "",
    };
  }

  if (
    NO_CONTEXT_DRAWN_TO_DEVELOP_SKILLS_SENTENCE_PATTERN.test(normalized) ||
    NO_CONTEXT_APPRECIATE_OPPORTUNITY_TO_DEVELOP_PATTERN.test(normalized) ||
    NO_CONTEXT_CHANCE_TO_ENGAGE_AND_DEVELOP_PATTERN.test(normalized) ||
    NO_CONTEXT_POSITION_DETAILS_HIGHLIGHT_PATTERN.test(normalized)
  ) {
    return {
      mode: "remove",
      replacement: "",
    };
  }

  const roleUnderstandingNeutralized = neutralizeFromPattern(
    NO_CONTEXT_ROLE_UNDERSTANDING_PATTERN,
  );
  if (roleUnderstandingNeutralized) {
    return {
      mode: "neutralize",
      replacement: roleUnderstandingNeutralized,
    };
  }

  const alignmentCommitmentNeutralized = neutralizeFromPattern(
    NO_CONTEXT_ALIGNMENT_COMMITMENT_PATTERN,
  );
  if (alignmentCommitmentNeutralized) {
    return {
      mode: "neutralize",
      replacement: alignmentCommitmentNeutralized,
    };
  }

  const weakCommitmentNeutralized = neutralizeFromPattern(
    NO_CONTEXT_WEAK_COMMITMENT_PATTERN,
  );
  if (weakCommitmentNeutralized) {
    return {
      mode: "neutralize",
      replacement: weakCommitmentNeutralized,
    };
  }

  const futureLearningNeutralized = neutralizeFromPattern(
    NO_CONTEXT_FUTURE_LEARNING_CLAUSE_PATTERN,
  );
  if (futureLearningNeutralized) {
    return {
      mode: "neutralize",
      replacement: futureLearningNeutralized,
    };
  }

  if (NO_CONTEXT_FUTURE_LEARNING_SENTENCE_PATTERN.test(normalized)) {
    return {
      mode: "remove",
      replacement: "",
    };
  }

  return null;
}

function cleanProposalBodyText(args: {
  content: string;
  candidateName?: string;
  dropDuplicateSentences: boolean;
  format?: OutputFormat;
}): string {
  const paragraphs = splitRawParagraphs(args.content);
  if (paragraphs.length === 0) return "";

  const seenSentences = new Set<string>();
  const seenFactTokenSets: string[][] = [];
  const cleanedParagraphs = paragraphs
    .map((paragraph) => {
      const paragraphText = paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(
          (line) =>
            Boolean(line) &&
            !isMetaOutputLine(line) &&
            !isWordCountMetaLine(line) &&
            !isSalutationLine(line) &&
            !isClosingLine(line) &&
            !(
              args.format === "application_message" &&
              isApplicationMessageBoundaryLine(line)
            ) &&
            !isPlaceholderSignatureLine(line) &&
            !isCandidateNameLine(line, args.candidateName),
        )
        .join(" ");

      const cleanedSentences = splitSentences(paragraphText).filter((sentence) => {
        const normalized = normalizeProposalConstraintText(sentence);
        if (!normalized) return false;
        if (isMetaOutputSentence(normalized)) return false;
        if (sentenceLooksMalformedFragment(sentence)) return false;
        if (sentenceLooksClosingTailFragment(sentence)) return false;
        if (
          args.format === "application_message" &&
          sentenceLooksApplicationMessageBoilerplate(sentence)
        ) {
          return false;
        }
        if (
          args.format === "cover_letter" &&
          sentenceLooksUnsupportedRequirementLeakage(sentence)
        ) {
          return false;
        }
        const sentenceFactTokens = extractSentenceFactTokens(sentence);
        if (args.dropDuplicateSentences && seenSentences.has(normalized)) {
          return false;
        }
        if (
          args.dropDuplicateSentences &&
          sentenceFactTokens.length > 0 &&
          seenFactTokenSets.some((seenTokens) =>
            sentencesShareUnderlyingFact(sentenceFactTokens, seenTokens),
          )
        ) {
          return false;
        }
        seenSentences.add(normalized);
        if (sentenceFactTokens.length > 0) {
          seenFactTokenSets.push(sentenceFactTokens);
        }
        return true;
      });

      return joinSentences(cleanedSentences);
    })
    .filter(Boolean);

  return cleanedParagraphs.join("\n\n").trim();
}

function hasSubstantiveBodyContent(args: {
  body: string;
  format: OutputFormat;
  noContextMode?: boolean;
}): boolean {
  const sentences = splitParagraphs(args.body).flatMap((paragraph) =>
    splitSentences(paragraph),
  );
  const substantiveSentences = sentences.filter(
    (sentence) =>
      !(
        args.format === "application_message" &&
        (sentenceLooksApplicationMessageBoilerplate(sentence) ||
          sentenceLooksApplicationMessageFollowUpOnly(sentence))
      ) &&
      !sentenceLooksGenericBodyOnly(sentence) &&
      !sentenceLooksMalformedFragment(sentence),
  );

  if (substantiveSentences.length === 0) {
    return false;
  }

  if (args.format === "application_message") {
    const violatesSemanticContract = applicationMessageViolatesSemanticContract({
      opener: sentences[0] ?? "",
      proofLine: sentences[1] ?? "",
      followUpLine: sentences[2] ?? "",
      noContextMode: Boolean(args.noContextMode),
    });

    if (
      violatesSemanticContract &&
      !applicationMessageHasRescuedStructuredShape({
        sentences,
        noContextMode: Boolean(args.noContextMode),
      })
    ) {
      return false;
    }
  }

  const sentenceLooksStandaloneConcrete = (sentence: string): boolean => {
    const normalized = compactWhitespace(sentence);
    if (!normalized) return false;
    return (
      normalized.length >= 70 ||
      /\d/.test(normalized) ||
      /\bat\s+[A-Z][\w&'.-]+/u.test(normalized) ||
      /\b(?:built|designed|developed|maintained|managed|led|handled|contributed|partnered|worked|evaluated|documented|created|used|reduced|improved|increased|decreased|installed|implemented|migrated|launched)\b/i.test(
        normalized,
      )
    );
  };

  if (args.format === "cover_letter" && substantiveSentences.length === 1) {
    return sentenceLooksStandaloneConcrete(substantiveSentences[0]!);
  }

  return true;
}

export type ProposalBodyAcceptanceMode = "strict" | "legacy_thin";

const FINAL_SAVED_RELEVANT_EXPERIENCE_OR_PERSPECTIVE_PATTERN =
  /\b(?:may|could)\s+offer\s+(?:a\s+)?relevant (?:experience|perspective)\b/i;
const FINAL_SAVED_ROLE_EMPHASIS_ALIGNMENT_PATTERN =
  /\baligns?(?:\s+well)?\s+with\s+the\s+role['’]s\s+emphasis\s+on\b/i;
const FINAL_SAVED_RESPONSIBILITIES_RELEVANCE_PATTERN =
  /\b(?:is|are|was|were)\s+relevant\s+to\s+the\s+responsibilities?\s+of\b/i;
const FINAL_SAVED_TEAM_FOCUS_RELEVANCE_PATTERN =
  /\b(?:would|could|may|might)\s+be\s+relevant\s+to\s+your\s+team['’]s\s+focus\s+on\b/i;
const FINAL_SAVED_MANAGING_RELEVANCE_PATTERN =
  /\b(?:would|could|may|might)\s+be\s+relevant\s+to\s+managing\b/i;
const FINAL_SAVED_APPLY_THESE_SKILLS_PATTERN =
  /\bpresents?\s+an\s+opportunity\s+to\s+apply\s+these\s+skills\b/i;
const FINAL_SAVED_MAY_APPLY_TO_THIS_POSITION_PATTERN =
  /\bmay\s+apply\s+to\s+this\s+position\b/i;
const FINAL_SAVED_MAY_ASSIST_IN_PATTERN =
  /\bmay\s+assist\s+in\b/i;
const COVER_LETTER_UNSUPPORTED_DURATION_CLAIM_PATTERN =
  /^i(?:['’]ve| have)\s+spent\s+years\b/i;
const COVER_LETTER_UNSUPPORTED_AVAILABILITY_CLAIM_PATTERN =
  /\b(?:i\s+am\s+available\s+to\s+work|available\s+to\s+work)\b[^.!?\n]{0,180}\b(?:flexible|rotating|mornings?|evenings?|overnights?|weekends?|holidays)\b/i;
const COVER_LETTER_UNSUPPORTED_PHYSICAL_REQUIREMENT_PATTERN =
  /\b(?:lifting?\s+up\s+to\s+\d+\s*(?:lbs?|pounds?)|well\s+within\s+my\s+capabilities)\b/i;
const COVER_LETTER_UNSUPPORTED_REQUIREMENT_FAMILIARITY_PATTERN =
  /^(?:i\s+(?:am\s+familiar\s+with|have\s+experience\s+(?:with|in))\b[^.!?\n]{0,180}\b(?:monitoring\s+)?surveillance\s+systems?\b|i\s+(?:am\s+familiar\s+with|have\s+experience\s+(?:with|in))\b[^.!?\n]{0,180}\b(?:incident\s+reporting|responding\s+to\s+incidents?|patrolling\s+large\s+areas?|patrolling\b|enforcing\s+(?:hotel|site|security)?\s*policies)\b)/i;

function normalizeCoverLetterSentenceForSaveability(sentence: string): string {
  const normalized = compactWhitespace(sentence);
  if (!normalized) return "";
  if (sentenceLooksUnsupportedRequirementLeakage(normalized)) {
    return "";
  }
  if (!isFinalSavedOutputSoftBridgeSentence(normalized)) {
    return normalized;
  }
  return neutralizeFinalSavedOutputBridgeSentence(normalized, "cover_letter");
}

function normalizeNoContextSentenceForSaveability(sentence: string): string {
  const normalized = compactWhitespace(sentence);
  if (!normalized) return "";

  const neutralizeGroundedPrefix = (pattern: RegExp): string | null => {
    const match = pattern.exec(normalized);
    if (!match || match.index === undefined || match.index <= 0) {
      return null;
    }
    const fragment = normalized.slice(0, match.index);
    const candidate = buildStandaloneNoContextSentenceFromFragment(fragment);
    if (!candidate) return null;
    return sentenceLooksGroundedNoContextSupportSentence(candidate)
      ? candidate
      : null;
  };

  const weakAppealNeutralized = neutralizeGroundedPrefix(
    NO_CONTEXT_WEAK_APPEAL_SPLIT_PATTERN,
  );
  if (weakAppealNeutralized) {
    return weakAppealNeutralized;
  }

  const contributionNeutralized = neutralizeGroundedPrefix(
    NO_CONTEXT_CONTRIBUTION_SHELL_PATTERN,
  );
  if (
    contributionNeutralized &&
    !/^[A-Z][a-z]+ing\b/.test(contributionNeutralized)
  ) {
    return contributionNeutralized;
  }

  if (sentenceLooksNoContextShellRhetoric(normalized)) {
    return "";
  }

  return normalized;
}

function sentenceLooksWeakCoverLetterResidual(args: {
  sentence: string;
  noContextMode: boolean;
}): boolean {
  const normalized = compactWhitespace(args.sentence);
  if (!normalized) return true;

  return (
    sentenceLooksMalformedFragment(normalized) ||
    sentenceLooksClosingTailFragment(normalized) ||
    sentenceLooksUnsupportedRequirementLeakage(normalized) ||
    sentenceLooksGenericBodyOnly(normalized) ||
    (args.noContextMode && sentenceLooksNoContextShellRhetoric(normalized))
  );
}

function sentenceLooksUnsupportedRequirementLeakage(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (!normalized) return false;

  return (
    COVER_LETTER_UNSUPPORTED_DURATION_CLAIM_PATTERN.test(normalized) ||
    COVER_LETTER_UNSUPPORTED_AVAILABILITY_CLAIM_PATTERN.test(normalized) ||
    COVER_LETTER_UNSUPPORTED_PHYSICAL_REQUIREMENT_PATTERN.test(normalized) ||
    COVER_LETTER_UNSUPPORTED_REQUIREMENT_FAMILIARITY_PATTERN.test(normalized)
  );
}

function hasGroundedSaveableCoverLetterSentence(args: {
  sentences: string[];
  noContextMode: boolean;
}): boolean {
  if (args.noContextMode) {
    return args.sentences.some(
      (sentence) =>
        sentenceLooksGroundedNoContextSupportSentence(sentence) ||
        sentenceLooksGroundedNoContextRoleSummarySentence(sentence) ||
        sentenceLooksSaveableWorkSurfaceSentence(sentence),
    );
  }

  return args.sentences.some(
    (sentence) =>
      sentenceHasConcreteEvidenceAnchor(sentence) ||
      sentenceLooksSaveableWorkSurfaceSentence(sentence),
  );
}

function assertFinalBridgeCleanupDidNotCollapseCoverLetterBody(args: {
  before: string;
  after: string;
  format: OutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  noContextMode: boolean;
  debugTrace?: ProposalFinalizationDebugTrace;
}): void {
  if (args.format !== "cover_letter" || args.before === args.after) {
    return;
  }

  const beforeBody = sanitizeGeneratedProposalBody({
    content: args.before,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
  });
  const afterBody = sanitizeGeneratedProposalBody({
    content: args.after,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
  });
  if (!beforeBody) {
    return;
  }

  const beforeSaveable = getCoverLetterSaveableSentences(
    beforeBody,
    args.noContextMode,
  );
  if (
    beforeSaveable.length === 0 ||
    !hasGroundedSaveableCoverLetterSentence({
      sentences: beforeSaveable,
      noContextMode: args.noContextMode,
    })
  ) {
    return;
  }

  const afterSaveable = getCoverLetterSaveableSentences(
    afterBody,
    args.noContextMode,
  );
  if (
    afterSaveable.length > 0 &&
    hasGroundedSaveableCoverLetterSentence({
      sentences: afterSaveable,
      noContextMode: args.noContextMode,
    })
  ) {
    return;
  }

  const afterSentences = splitParagraphs(afterBody).flatMap((paragraph) =>
    splitSentences(paragraph),
  );
  if (
    afterSentences.length > 0 &&
    !afterSentences.every((sentence) =>
      sentenceLooksWeakCoverLetterResidual({
        sentence,
        noContextMode: args.noContextMode,
      }),
    )
  ) {
    return;
  }

  markProposalFinalizationFailure(
    args.debugTrace,
    "final_saved_output_bridge_cleanup",
  );
  throw new ProposalFinalizationError(
    "Final bridge cleanup removed grounded body content for cover_letter.",
  );
}

function getCoverLetterSaveableSentences(
  body: string,
  noContextMode = false,
): string[] {
  return splitParagraphs(body)
    .flatMap((paragraph) => splitSentences(paragraph))
    .map((sentence) =>
      noContextMode
        ? normalizeNoContextSentenceForSaveability(sentence)
        : normalizeCoverLetterSentenceForSaveability(sentence),
    )
    .map((sentence) => compactWhitespace(sentence))
    .filter(
      (sentence) =>
        Boolean(sentence) &&
        !sentenceLooksUnsupportedRequirementLeakage(sentence) &&
        !(noContextMode && sentenceLooksNoContextShellRhetoric(sentence)) &&
        !sentenceLooksGenericBodyOnly(sentence) &&
        !sentenceLooksMalformedFragment(sentence) &&
        !sentenceLooksClosingTailFragment(sentence),
    );
}

function getGroundedOperationalCoverLetterSentences(args: {
  sentences: string[];
  noContextMode: boolean;
}): string[] {
  return args.sentences.filter((sentence) =>
    args.noContextMode
      ? sentenceLooksGroundedNoContextRoleSummarySentence(sentence) ||
        sentenceLooksSaveableWorkSurfaceSentence(sentence)
      : sentenceHasConcreteEvidenceAnchor(sentence) ||
        sentenceLooksSaveableWorkSurfaceSentence(sentence),
  );
}

function getCoverLetterSentenceDebugCounts(args: {
  saveableSentences: string[];
  noContextMode: boolean;
}): {
  saveableSentenceCount: number;
  groundedOperationalSentenceCount: number;
  groundedSupportSentenceCount: number;
} {
  if (args.noContextMode) {
    return {
      saveableSentenceCount: args.saveableSentences.length,
      groundedOperationalSentenceCount:
        countNoContextGroundedOperationalSentences(args.saveableSentences),
      groundedSupportSentenceCount:
        countNoContextGroundedSupportSentences(args.saveableSentences),
    };
  }

  const groundedOperationalSentenceCount =
    getGroundedOperationalCoverLetterSentences({
      sentences: args.saveableSentences,
      noContextMode: false,
    }).length;
  return {
    saveableSentenceCount: args.saveableSentences.length,
    groundedOperationalSentenceCount,
    groundedSupportSentenceCount: Math.max(
      0,
      args.saveableSentences.length - groundedOperationalSentenceCount,
    ),
  };
}

function getProposalBodyCandidateDebugInfo(args: {
  candidate: string;
  format: OutputFormat;
  noContextMode: boolean;
  acceptanceMode?: ProposalBodyAcceptanceMode;
}): ProposalBodyCandidateDebugInfo {
  const saveableSentences =
    args.format === "cover_letter"
      ? getCoverLetterSaveableSentences(args.candidate, args.noContextMode)
      : [];
  const sentenceCounts =
    args.format === "cover_letter"
      ? getCoverLetterSentenceDebugCounts({
          saveableSentences,
          noContextMode: args.noContextMode,
        })
      : {
          saveableSentenceCount: 0,
          groundedOperationalSentenceCount: 0,
          groundedSupportSentenceCount: 0,
        };
  return {
    candidate: args.candidate,
    saveableSentences,
    saveableSentenceCount: sentenceCounts.saveableSentenceCount,
    groundedOperationalSentenceCount:
      sentenceCounts.groundedOperationalSentenceCount,
    groundedSupportSentenceCount:
      sentenceCounts.groundedSupportSentenceCount,
    isSaveable: hasSaveableBodyContent({
      body: args.candidate,
      format: args.format,
      noContextMode: args.noContextMode,
      acceptanceMode: args.acceptanceMode,
    }),
  };
}

function sentenceLooksCandidateBackedCvGroundedSentence(
  sentence: string,
): boolean {
  const normalized = compactWhitespace(sentence);
  if (
    !normalized ||
    sentenceLooksNumericResidue(normalized) ||
    sentenceLooksMalformedFragment(normalized) ||
    sentenceLooksGenericRoleSummary(normalized) ||
    !sentenceLooksSaveableWorkSurfaceSentence(normalized)
  ) {
    return false;
  }

  if (
    /^(?:the|this|that)\s+(?:role|position|job|responsibilities?|work|opportunity)\b/i.test(
      normalized,
    )
  ) {
    return false;
  }

  return (
    sentenceHasConcreteEvidenceAnchor(normalized) ||
    /^(?:i\b|my\b|with\s+a\s+background\s+in\b|background\s+in\b|experience\s+in\b|work(?:ing)?\s+in\b|exposure\s+to\b|knowledge\s+of\b|coordination\s+of\b|supervision\s+of\b|oversight\s+of\b|maintenance\s+of\b|management\s+of\b|documentation\s+of\b|analysis\s+of\b|production\s+of\b)\b/i.test(
      normalized,
    )
  );
}

function buildNarrowCvBackedGroundedRescueBodyCandidate(
  body: string,
): string | null {
  const saveableSentences = getCoverLetterSaveableSentences(body, false);
  if (saveableSentences.length < 2) {
    return null;
  }

  const groundedOperationalSentences = getGroundedOperationalCoverLetterSentences(
    {
      sentences: saveableSentences,
      noContextMode: false,
    },
  );
  if (groundedOperationalSentences.length < 2) {
    return null;
  }

  const candidateBackedGroundedSentenceCount = groundedOperationalSentences.filter(
    sentenceLooksCandidateBackedCvGroundedSentence,
  ).length;
  if (candidateBackedGroundedSentenceCount < 2) {
    return null;
  }

  const nonGroundedSentenceCount = Math.max(
    0,
    saveableSentences.length - groundedOperationalSentences.length,
  );
  if (nonGroundedSentenceCount > 1) {
    return null;
  }

  return joinSentences(saveableSentences);
}

function hasNarrowCvBackedGroundedRescueContent(body: string): boolean {
  return Boolean(buildNarrowCvBackedGroundedRescueBodyCandidate(body));
}

function sentenceLooksModestNoContextRoleWorkContextSentence(
  sentence: string,
): boolean {
  const normalized = compactWhitespace(sentence);
  if (
    !normalized ||
    sentenceLooksNumericResidue(normalized) ||
    sentenceLooksMalformedFragment(normalized) ||
    sentenceLooksClosingTailFragment(normalized) ||
    sentenceLooksNoContextShellRhetoric(normalized) ||
    sentenceLooksWeakAdmirationOrCapability(normalized) ||
    sentenceLooksUnsupportedRequirementLeakage(normalized)
  ) {
    return false;
  }

  const factTokens = extractSentenceFactTokens(sentence);
  if (factTokens.length < 5) {
    return false;
  }

  if (
    !/^(?:the|this|that)\s+(?:role|work|workflow|position|day-to-day\s+work|day-to-day\s+workflow)\s+(?:also\s+)?(?:depends|relies|turns|centers|requires)\s+on\b/i.test(
      normalized,
    )
  ) {
    return false;
  }

  return /\b(?:operational precision|operating discipline|follow-?through|follow-?up|communication|coordination|documentation|accuracy|handoffs?|scheduling|dispatch|service(?:\s+continuity)?|work orders?|customers?|technicians?|records?)\b/i.test(
    normalized,
  );
}

function getNarrowNoContextGroundedFinalizationSentences(body: string): string[] {
  return splitParagraphs(body)
    .flatMap((paragraph) => splitSentences(paragraph))
    .map((sentence) => normalizeNoContextSentenceForSaveability(sentence))
    .map((sentence) => compactWhitespace(sentence))
    .filter(Boolean)
    .filter(
      (sentence) =>
        !sentenceLooksUnsupportedRequirementLeakage(sentence) &&
        !sentenceLooksMalformedFragment(sentence) &&
        !sentenceLooksClosingTailFragment(sentence) &&
        !sentenceLooksNoContextShellRhetoric(sentence) &&
        !sentenceLooksWeakAdmirationOrCapability(sentence),
    )
    .filter(
      (sentence) =>
        sentenceLooksSaveableWorkSurfaceSentence(sentence) ||
        sentenceLooksGroundedNoContextRoleSummarySentence(sentence) ||
        sentenceLooksGroundedNoContextSupportSentence(sentence) ||
        sentenceLooksModestNoContextRoleWorkContextSentence(sentence),
    );
}

function hasNarrowNoContextGroundedFinalizationContent(body: string): boolean {
  const groundedSentences = getNarrowNoContextGroundedFinalizationSentences(body);
  if (groundedSentences.length < 2) {
    return false;
  }

  const groundedOperationalSentenceCount =
    countNoContextGroundedOperationalSentences(groundedSentences);
  if (groundedOperationalSentenceCount < 1) {
    return false;
  }

  return groundedSentences.every(
    (sentence) =>
      (!sentenceLooksGenericBodyOnly(sentence) ||
        sentenceLooksModestNoContextRoleWorkContextSentence(sentence)) &&
      !sentenceLooksNoContextShellRhetoric(sentence) &&
      !sentenceLooksWeakAdmirationOrCapability(sentence),
  );
}

function buildRawCvBackedGroundedRescueBodyFromContent(args: {
  content: string;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
}): string | null {
  const extracted = extractFinalProposalContent({
    content: args.content,
    format: "cover_letter",
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
  });
  const withoutBoundaries = stripStandaloneBoundaryLines({
    content: extracted,
    candidateName: args.candidateName,
    format: args.format,
  });
  const withoutMeta = stripLeadingMetaOutput(withoutBoundaries);
  const disciplineNormalized = normalizeCoverLetterBodyDiscipline(withoutMeta);
  return buildNarrowCvBackedGroundedRescueBodyCandidate(
    stripTrailingClosingDiscussion(disciplineNormalized),
  );
}

function buildRescuedCoverLetterBodyFromBodies(args: {
  bodies: string[];
  noContextMode: boolean;
  acceptanceMode?: ProposalBodyAcceptanceMode;
}): string | null {
  if (!args.noContextMode) {
    const cvRescueCandidates = args.bodies
      .map((body) => buildNarrowCvBackedGroundedRescueBodyCandidate(body))
      .filter((body): body is string => Boolean(body))
      .map((body) => {
        const saveableSentences = getCoverLetterSaveableSentences(body, false);
        const groundedOperationalSentenceCount =
          getGroundedOperationalCoverLetterSentences({
            sentences: saveableSentences,
            noContextMode: false,
          }).length;
        const candidateBackedGroundedSentenceCount = saveableSentences.filter(
          sentenceLooksCandidateBackedCvGroundedSentence,
        ).length;
        return {
          body,
          groundedOperationalSentenceCount,
          candidateBackedGroundedSentenceCount,
          saveableSentenceCount: saveableSentences.length,
        };
      })
      .sort((left, right) => {
        if (
          right.candidateBackedGroundedSentenceCount !==
          left.candidateBackedGroundedSentenceCount
        ) {
          return (
            right.candidateBackedGroundedSentenceCount -
            left.candidateBackedGroundedSentenceCount
          );
        }
        if (
          right.groundedOperationalSentenceCount !==
          left.groundedOperationalSentenceCount
        ) {
          return (
            right.groundedOperationalSentenceCount -
            left.groundedOperationalSentenceCount
          );
        }
        return right.saveableSentenceCount - left.saveableSentenceCount;
      });

    if (cvRescueCandidates.length > 0) {
      return cvRescueCandidates[0].body;
    }
  }

  const rescuedSentences: string[] = [];
  const seen = new Set<string>();

  for (const body of args.bodies) {
    const sourceSentences = args.noContextMode
      ? getNarrowNoContextGroundedFinalizationSentences(body)
      : getCoverLetterSaveableSentences(body, args.noContextMode);
    for (const sentence of sourceSentences) {
      const normalized = compactWhitespace(sentence);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      rescuedSentences.push(ensureTerminalSentence(normalized));
      seen.add(normalized);
    }
  }

  if (rescuedSentences.length < 2) {
    return null;
  }

  const groundedOperationalSentenceCount =
    getGroundedOperationalCoverLetterSentences({
      sentences: rescuedSentences,
      noContextMode: args.noContextMode,
    }).length;
  const rescuedBody = joinSentences(rescuedSentences);
  if (!rescuedBody) {
    return null;
  }

  if (args.noContextMode) {
    const groundedSupportSentenceCount =
      countNoContextGroundedSupportSentences(rescuedSentences);
    if (
      groundedOperationalSentenceCount < 2 &&
      !(
        groundedOperationalSentenceCount >= 1 &&
        groundedSupportSentenceCount >= 2
      ) &&
      !hasNarrowNoContextGroundedFinalizationContent(rescuedBody)
    ) {
      return null;
    }
  } else {
    const concreteEvidenceSentenceCount = rescuedSentences.filter(
      sentenceHasConcreteEvidenceAnchor,
    ).length;
    if (
      groundedOperationalSentenceCount < 2 ||
      concreteEvidenceSentenceCount < 1
    ) {
      return null;
    }
  }

  if (
    !hasSaveableBodyContent({
      body: rescuedBody,
      format: "cover_letter",
      noContextMode: args.noContextMode,
      acceptanceMode: args.noContextMode ? "strict" : args.acceptanceMode,
    })
  ) {
    const passesNarrowRescue = args.noContextMode
      ? hasNarrowNoContextGroundedFinalizationContent(rescuedBody)
      : hasNarrowCvBackedGroundedRescueContent(rescuedBody);
    if (!passesNarrowRescue) {
      return null;
    }
  }

  return rescuedBody;
}

function subtractSentenceMultiset(
  source: string[],
  toRemove: string[],
): string[] {
  const remaining = new Map<string, number>();
  for (const sentence of toRemove) {
    const normalized = compactWhitespace(sentence);
    if (!normalized) continue;
    remaining.set(normalized, (remaining.get(normalized) ?? 0) + 1);
  }

  const removed: string[] = [];
  for (const sentence of source) {
    const normalized = compactWhitespace(sentence);
    if (!normalized) continue;
    const count = remaining.get(normalized) ?? 0;
    if (count > 0) {
      remaining.set(normalized, count - 1);
      continue;
    }
    removed.push(sentence);
  }
  return removed;
}

function getFinalSavedOutputBridgeCleanupDebugInfo(args: {
  before: string;
  after: string;
  format: OutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  noContextMode: boolean;
}): {
  removedSentenceTexts: string[];
  removedLastGroundedSentence: boolean;
} {
  const beforeBody = sanitizeGeneratedProposalBody({
    content: args.before,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
  });
  const afterBody = sanitizeGeneratedProposalBody({
    content: args.after,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
  });

  const beforeSentences = splitParagraphs(beforeBody)
    .flatMap((paragraph) => splitSentences(paragraph))
    .map((sentence) => compactWhitespace(sentence))
    .filter(Boolean);
  const afterSentences = splitParagraphs(afterBody)
    .flatMap((paragraph) => splitSentences(paragraph))
    .map((sentence) => compactWhitespace(sentence))
    .filter(Boolean);
  const removedSentenceTexts = subtractSentenceMultiset(
    beforeSentences,
    afterSentences,
  );

  const beforeGroundedSentences = getGroundedOperationalCoverLetterSentences({
    sentences: getCoverLetterSaveableSentences(beforeBody, args.noContextMode),
    noContextMode: args.noContextMode,
  }).map((sentence) => compactWhitespace(sentence));
  const afterGroundedSentences = getGroundedOperationalCoverLetterSentences({
    sentences: getCoverLetterSaveableSentences(afterBody, args.noContextMode),
    noContextMode: args.noContextMode,
  }).map((sentence) => compactWhitespace(sentence));
  const removedGroundedSentenceTexts = subtractSentenceMultiset(
    beforeGroundedSentences,
    afterGroundedSentences,
  );

  return {
    removedSentenceTexts,
    removedLastGroundedSentence:
      beforeGroundedSentences.length > 0 &&
      afterGroundedSentences.length === 0 &&
      removedGroundedSentenceTexts.length > 0,
  };
}

function markProposalFinalizationFailure(
  debugTrace: ProposalFinalizationDebugTrace | undefined,
  stage: ProposalFinalizationStageName,
): void {
  if (debugTrace && !debugTrace.failureStage) {
    debugTrace.failureStage = stage;
  }
}

function hasSaveableBodyContent(args: {
  body: string;
  format: OutputFormat;
  noContextMode: boolean;
  acceptanceMode?: ProposalBodyAcceptanceMode;
}): boolean {
  if (args.format !== "cover_letter") {
    return hasSubstantiveBodyContent({
      body: args.body,
      format: args.format,
      noContextMode: args.noContextMode,
    });
  }

  const acceptanceMode = args.acceptanceMode ?? "strict";
  const saveableSentences = getCoverLetterSaveableSentences(
    args.body,
    args.noContextMode,
  );

  if (saveableSentences.length === 0) {
    return false;
  }

  const concreteEvidenceSentences = saveableSentences.filter(
    sentenceHasConcreteEvidenceAnchor,
  );
  const workSurfaceSentences = saveableSentences.filter(
    sentenceLooksSaveableWorkSurfaceSentence,
  );
  const noContextGroundedOperationalSentenceCount = args.noContextMode
    ? countNoContextGroundedOperationalSentences(saveableSentences)
    : 0;
  const noContextGroundedSupportSentenceCount = args.noContextMode
    ? countNoContextGroundedSupportSentences(saveableSentences)
    : 0;

  if (acceptanceMode === "legacy_thin") {
    if (saveableSentences.length < 2) {
      return false;
    }

    if (args.noContextMode) {
      return noContextGroundedOperationalSentenceCount >= 1;
    }

    return concreteEvidenceSentences.length >= 1;
  }

  if (args.noContextMode) {
    return (
      noContextGroundedOperationalSentenceCount >= 2 ||
      (noContextGroundedOperationalSentenceCount >= 1 &&
        noContextGroundedSupportSentenceCount >= 2)
    );
  }

  if (saveableSentences.length === 1) {
    return concreteEvidenceSentences.length === 1;
  }

  return concreteEvidenceSentences.length >= 1;
}

export function evaluateProposalBodySaveability(args: {
  body: string;
  format: OutputFormat;
  noContextMode: boolean;
  acceptanceMode?: "strict" | "legacy_thin";
}): boolean {
  return hasSaveableBodyContent(args);
}

function rebuildNoContextParagraphSentences(
  paragraphSentences: string[][],
): string {
  return paragraphSentences
    .map((sentences) => joinSentences(sentences.filter(Boolean)))
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function cleanupNoContextEarlyBodySentences(args: {
  body: string;
  acceptanceMode: ProposalBodyAcceptanceMode;
  debugTrace?: ProposalFinalizationDebugTrace;
}): string {
  const paragraphs = splitParagraphs(args.body);
  if (paragraphs.length === 0) {
    return args.body;
  }

  const paragraphSentences = paragraphs.map((paragraph) =>
    splitSentences(paragraph),
  );
  const removedSentences: string[] = [];
  const preservedSentences: string[] = [];
  const neutralizedSentences: Array<{ before: string; after: string }> = [];
  let preservedForSaveability = false;
  let ordinal = 0;

  while (true) {
    const locations = paragraphSentences.flatMap((sentences, paragraphIndex) =>
      sentences.map((sentence, sentenceIndex) => ({
        paragraphIndex,
        sentenceIndex,
        sentence,
      })),
    );
    const location = locations[ordinal];
    if (!location) {
      break;
    }

    const cleanup = getNoContextEarlyBodySentenceCleanup(location.sentence);
    if (!cleanup) {
      ordinal += 1;
      continue;
    }

    const nextParagraphSentences = paragraphSentences.map((sentences) => [
      ...sentences,
    ]);
    nextParagraphSentences[location.paragraphIndex]![location.sentenceIndex] =
      cleanup.replacement;
    nextParagraphSentences[location.paragraphIndex] =
      nextParagraphSentences[location.paragraphIndex]!.filter(Boolean);
    const cleanedBody = rebuildNoContextParagraphSentences(nextParagraphSentences);
    if (
      !cleanedBody ||
      (!hasSaveableBodyContent({
        body: cleanedBody,
        format: "cover_letter",
        noContextMode: true,
        acceptanceMode: args.acceptanceMode,
      }) &&
        !hasNarrowNoContextGroundedFinalizationContent(cleanedBody))
    ) {
      preservedForSaveability = true;
      preservedSentences.push(location.sentence);
      ordinal += 1;
      continue;
    }

    paragraphSentences.splice(0, paragraphSentences.length, ...nextParagraphSentences);
    if (cleanup.mode === "remove") {
      removedSentences.push(location.sentence);
    } else {
      neutralizedSentences.push({
        before: location.sentence,
        after: cleanup.replacement,
      });
    }
  }

  const cleanedBody = rebuildNoContextParagraphSentences(paragraphSentences);
  if (
    removedSentences.length === 0 &&
    neutralizedSentences.length === 0 &&
    !preservedForSaveability
  ) {
    if (args.debugTrace) {
      args.debugTrace.noContextLeadCleanup = {
        before: args.body,
        after: args.body,
        removedSentence: null,
        removedSentences: [],
        preservedSentences: [],
        neutralizedSentences: [],
        preservedForSaveability: false,
      };
    }
    return args.body;
  }

  if (args.debugTrace) {
    args.debugTrace.noContextLeadCleanup = {
      before: args.body,
      after: cleanedBody || args.body,
      removedSentence: removedSentences[0] ?? null,
      removedSentences,
      preservedSentences,
      neutralizedSentences,
      preservedForSaveability,
    };
  }

  return cleanedBody || args.body;
}

function stripTrailingClosingDiscussion(text: string): string {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) return "";

  const lastParagraphSentences = splitSentences(
    paragraphs[paragraphs.length - 1],
  );
  while (
    lastParagraphSentences.length > 0 &&
    isClosingDiscussionSentence(
      lastParagraphSentences[lastParagraphSentences.length - 1],
    )
  ) {
    lastParagraphSentences.pop();
  }

  if (lastParagraphSentences.length === 0) {
    paragraphs.pop();
  } else {
    paragraphs[paragraphs.length - 1] = joinSentences(lastParagraphSentences);
  }

  return paragraphs.filter(Boolean).join("\n\n").trim();
}

function normalizeCoverLetterSentenceDiscipline(sentence: string): string {
  let normalized = compactWhitespace(sentence);
  if (!normalized) return "";

  const replacements: Array<[RegExp, string]> = [
    [/\b(?:he|she)\s+has\b/gi, "I have"],
    [/\b(?:he|she)\s+had\b/gi, "I had"],
    [/\b(?:he|she)\s+is\b/gi, "I am"],
    [/\b(?:he|she)\s+was\b/gi, "I was"],
    [/\b(?:he|she)\s+works\b/gi, "I work"],
    [/\b(?:he|she)\s+worked\b/gi, "I worked"],
    [/\b(?:he|she)\s+brings\b/gi, "I bring"],
    [
      /\b(?:her|his)\s+(?=(?:background|experience|approach|work|skills?|certification|training|interest|focus|ability|abilities|expertise)\b)/gi,
      "my ",
    ],
  ];

  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  if (
    /^[a-z]/.test(normalized) &&
    COVER_LETTER_LOWERCASE_RESTART_PATTERN.test(normalized)
  ) {
    normalized = capitalizeSentenceStart(normalized);
  }

  return normalized;
}

function normalizeCoverLetterBodyDiscipline(text: string): string {
  const paragraphs = splitRawParagraphs(text);
  if (paragraphs.length === 0) return text;

  return paragraphs
    .map((paragraph) =>
      joinSentences(
        splitSentences(paragraph)
          .map((sentence) => normalizeCoverLetterSentenceDiscipline(sentence))
          .filter(Boolean),
      ),
    )
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function buildProposalBodyCandidate(args: {
  content: string;
  format: OutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  removeForbiddenBridges: boolean;
}): string {
  const extracted = extractFinalProposalContent({
    content: args.content,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
  });
  const withoutBoundaries = stripStandaloneBoundaryLines({
    content: extracted,
    candidateName: args.candidateName,
  });
  const withoutMeta = stripLeadingMetaOutput(withoutBoundaries);
  const disciplineNormalized =
    args.format === "cover_letter"
      ? normalizeCoverLetterBodyDiscipline(withoutMeta)
      : withoutMeta;
  const cleaned = cleanProposalBodyText({
    content: disciplineNormalized,
    candidateName: args.candidateName,
    dropDuplicateSentences: true,
    format: args.format,
  });
  const maybeWithoutBridges = args.removeForbiddenBridges
    ? removeForbiddenBridgeSentences(cleaned)
    : cleaned;
  const disciplineNormalizedAfterBridgeRemoval =
    args.format === "cover_letter"
      ? normalizeCoverLetterBodyDiscipline(maybeWithoutBridges)
      : maybeWithoutBridges;
  const cleanedAfterBridgeRemoval = cleanProposalBodyText({
    content: disciplineNormalizedAfterBridgeRemoval,
    candidateName: args.candidateName,
    dropDuplicateSentences: true,
    format: args.format,
  });
  return stripTrailingClosingDiscussion(cleanedAfterBridgeRemoval);
}

function selectProposalBodyCandidateOrThrow(args: {
  content: string;
  format: OutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  noContextMode: boolean;
  acceptanceMode?: ProposalBodyAcceptanceMode;
  debugTrace?: ProposalFinalizationDebugTrace;
}): string {
  const aggressiveCandidate = sanitizeGeneratedProposalBody({
    content: args.content,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
  });
  const aggressiveInfo = getProposalBodyCandidateDebugInfo({
    candidate: aggressiveCandidate,
    format: args.format,
    noContextMode: args.noContextMode,
    acceptanceMode: args.acceptanceMode,
  });
  const conservativeCandidate = buildProposalBodyCandidate({
    content: args.content,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
    removeForbiddenBridges: false,
  });
  const conservativeInfo = getProposalBodyCandidateDebugInfo({
    candidate: conservativeCandidate,
    format: args.format,
    noContextMode: args.noContextMode,
    acceptanceMode: args.acceptanceMode,
  });
  const cvRawRescueCandidate =
    args.format === "cover_letter" && !args.noContextMode
      ? buildRawCvBackedGroundedRescueBodyFromContent({
          content: args.content,
          outputLanguage: args.outputLanguage,
          candidateName: args.candidateName,
        })
      : null;

  if (args.debugTrace) {
    args.debugTrace.cleanedBodySelection = {
      aggressive: aggressiveInfo,
      conservative: conservativeInfo,
      selectedCandidate: null,
      selectedBody: null,
    };
  }

  if (
    aggressiveCandidate &&
    aggressiveInfo.isSaveable
  ) {
    if (args.debugTrace) {
      args.debugTrace.cleanedBodySelection.selectedCandidate = "aggressive";
      args.debugTrace.cleanedBodySelection.selectedBody = aggressiveCandidate;
    }
    return aggressiveCandidate;
  }

  if (
    conservativeCandidate &&
    conservativeInfo.isSaveable
  ) {
    if (args.debugTrace) {
      args.debugTrace.cleanedBodySelection.selectedCandidate = "conservative";
      args.debugTrace.cleanedBodySelection.selectedBody = conservativeCandidate;
    }
    return conservativeCandidate;
  }

  if (args.format === "cover_letter") {
    const rescuedCandidate = buildRescuedCoverLetterBodyFromBodies({
      bodies: [
        aggressiveCandidate,
        conservativeCandidate,
        cvRawRescueCandidate ?? "",
      ],
      noContextMode: args.noContextMode,
      acceptanceMode: args.acceptanceMode,
    });
    if (rescuedCandidate) {
      if (args.debugTrace) {
        args.debugTrace.cleanedBodySelection.selectedCandidate = "rescued";
        args.debugTrace.cleanedBodySelection.selectedBody = rescuedCandidate;
      }
      return rescuedCandidate;
    }
  }

  if (
    args.format === "application_message" &&
    args.debugTrace &&
    !args.debugTrace.applicationMessageRejectionReasons
  ) {
    const parsed = parseStructuredApplicationMessageParts(args.content);
    if (parsed) {
      const opener = normalizeStructuredApplicationMessageLine(parsed.opener);
      const proofLine = normalizeStructuredApplicationMessageLine(
        parsed.proofLine,
      );
      const followUpLine = normalizeStructuredApplicationMessageLine(
        parsed.followUpLine,
      );
      const reasons = collectApplicationMessageRejectionReasonTags({
        opener,
        proofLine,
        followUpLine,
        noContextMode: args.noContextMode,
      });
      if (reasons.length > 0) {
        args.debugTrace.applicationMessageRejectionReasons = reasons;
      }
    }
  }

  markProposalFinalizationFailure(args.debugTrace, "cleaned_body_selection");
  throw new ProposalFinalizationError(
    `Cleanup removed all substantive body content for ${args.format}.`,
  );
}

function assertSavedOutputHasSubstantiveBody(args: {
  content: string;
  format: OutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  noContextMode: boolean;
  acceptanceMode?: ProposalBodyAcceptanceMode;
  debugTrace?: ProposalFinalizationDebugTrace;
}): void {
  const body = stripTrailingClosingDiscussion(
    cleanProposalBodyText({
      content: stripStandaloneBoundaryLines({
        content: args.content,
        candidateName: args.candidateName,
        format: args.format,
      }),
      candidateName: args.candidateName,
      dropDuplicateSentences: true,
      format: args.format,
    }),
  );
  if (
    !hasSaveableBodyContent({
      body,
      format: args.format,
      noContextMode: args.noContextMode,
      acceptanceMode: args.acceptanceMode,
    })
  ) {
    if (
      args.format === "cover_letter" &&
      !args.noContextMode &&
      hasNarrowCvBackedGroundedRescueContent(body)
    ) {
      if (args.debugTrace) {
        args.debugTrace.substantiveBodyAssertion = {
          body,
          passed: true,
        };
      }
      return;
    }
    if (
      args.format === "cover_letter" &&
      args.noContextMode &&
      hasNarrowNoContextGroundedFinalizationContent(body)
    ) {
      if (args.debugTrace) {
        args.debugTrace.substantiveBodyAssertion = {
          body,
          passed: true,
        };
      }
      return;
    }
    if (args.debugTrace) {
      args.debugTrace.substantiveBodyAssertion = {
        body,
        passed: false,
      };
    }
    markProposalFinalizationFailure(args.debugTrace, "substantive_body_assertion");
    throw new ProposalFinalizationError(
      `Final saved output for ${args.format} does not contain substantive body content.`,
    );
  }
  if (args.debugTrace) {
    args.debugTrace.substantiveBodyAssertion = {
      body,
      passed: true,
    };
  }
}

function sanitizeStructuredBodyCandidate(args: {
  content: string;
  candidateName?: string;
  outputLanguage: ProposalOutputLanguage;
  voicePreset: ProposalVoicePreset;
  noContextMode: boolean;
}): string {
  const withoutRendererFinalSentence = stripRendererOwnedFinalSentenceFromBody({
    body: args.content,
    outputLanguage: args.outputLanguage,
    voicePreset: args.voicePreset,
    noContextMode: args.noContextMode,
  });
  const withoutBoundaries = stripStandaloneBoundaryLines({
    content: withoutRendererFinalSentence,
    candidateName: args.candidateName,
  });
  const withoutMeta = stripLeadingMetaOutput(withoutBoundaries);
  const cleaned = cleanProposalBodyText({
    content: withoutMeta,
    candidateName: args.candidateName,
    dropDuplicateSentences: true,
    format: "cover_letter",
  });
  return stripTrailingClosingDiscussion(cleaned);
}

function removeForbiddenBridgeSentences(text: string): string {
  const cleanedParagraphs = splitParagraphs(text)
    .map((paragraph) =>
      joinSentences(
        splitSentences(paragraph).filter(
          (sentence) =>
            !isMetaOutputSentence(sentence) &&
            !containsForbiddenProposalBridge(sentence),
        ),
      ),
    )
    .filter(Boolean);

  return cleanedParagraphs.join("\n\n").trim();
}

function ensureTerminalSentence(value: string): string {
  const normalized = compactWhitespace(value);
  if (!normalized) return "";
  if (/[.!?]["'”’)\]]*$/u.test(normalized)) {
    return normalized;
  }
  return `${normalized}.`;
}

function stripLeadingSentenceConnector(value: string): string {
  return compactWhitespace(value)
    .replace(
      /^(?:additionally|also|further|furthermore|moreover|plus|in addition|as such|taken together),\s*/i,
      "",
    )
    .replace(/^(?:and|but|so)\s+/i, "");
}

function capitalizeSentenceStart(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeFinalSavedOutputFactFragment(value: string): string {
  return compactWhitespace(
    stripLeadingSentenceConnector(value)
      .replace(/^[,;:\-\s]+/u, "")
      .replace(/[,;:\-\s]+$/u, "")
      .replace(/\b(?:which|that)\s*$/i, "")
      .replace(/\s+(?:and|but)$/i, ""),
  );
}

function buildStandaloneSentenceFromCandidateFragment(
  fragment: string,
): string | null {
  const cleaned = capitalizeSentenceStart(
    normalizeFinalSavedOutputFactFragment(fragment),
  );
  if (!cleaned) return null;

  const exactFragments = new Set([
    "My background",
    "My experience",
    "Background",
    "Experience",
    "My interest",
  ]);
  if (exactFragments.has(cleaned)) return null;

  const fragmentLooksConcreteFact = (value: string): boolean =>
    (!sentenceLooksNumericResidue(value) && /\d/.test(value)) ||
    /\bat\s+[A-Z][\w&'.-]+/u.test(value) ||
    sentenceHasConcreteEvidenceAnchor(value);

  if (/^i\b/i.test(cleaned)) {
    if (/^i(?:'m| am)\s+(?:interested|drawn)\b/i.test(cleaned)) {
      return null;
    }
    return ensureTerminalSentence(cleaned);
  }

  if (
    /^my experience includes\b/i.test(cleaned) ||
    /^my background includes\b/i.test(cleaned) ||
    /^my skills include\b/i.test(cleaned) ||
    /^my expertise includes\b/i.test(cleaned)
  ) {
    return fragmentLooksConcreteFact(cleaned)
      ? ensureTerminalSentence(cleaned)
      : null;
  }

  if (
    /^(?:my experience(?:\s+(?:with|in))?|experience(?:\s+(?:with|in))?|my background(?:\s+in)?|background(?:\s+in)?|my skills in|my expertise in|my interest in|interest in|my professional curiosity about|my curiosity about)\b/i.test(
      cleaned,
    )
  ) {
    return null;
  }

  if (
    /^my\b/i.test(cleaned) &&
    /\b(?:experience|background|skills?|expertise|work|approach|interest|focus)\b/i.test(
      cleaned,
    ) &&
    /\b(?:includes?|spans?|covers?|reflects?|focuses?\s+on|involves?|has|required|meant)\b/i.test(
      cleaned,
    )
  ) {
    return fragmentLooksConcreteFact(cleaned)
      ? ensureTerminalSentence(cleaned)
      : null;
  }

  if (fragmentLooksConcreteFact(cleaned)) {
    return ensureTerminalSentence(cleaned);
  }

  return null;
}

function buildStandaloneCoverLetterGroundedSentenceFromFragment(
  fragment: string,
): string | null {
  const cleaned = capitalizeSentenceStart(
    normalizeFinalSavedOutputFactFragment(fragment),
  );
  if (!cleaned) return null;
  if (
    /^the\s+(?:opportunity|chance)\s+to\b/i.test(cleaned) ||
    /^(?:these|those)\s+skills?\s+in\b/i.test(cleaned) ||
    (/^(?:my\s+)?(?:background|experience|skills?|expertise)\s+in\b/i.test(
      cleaned,
    ) &&
      !sentenceHasConcreteEvidenceAnchor(cleaned))
  ) {
    return null;
  }

  const directCandidate = buildStandaloneSentenceFromCandidateFragment(cleaned);
  if (
    directCandidate &&
    (sentenceHasConcreteEvidenceAnchor(directCandidate) ||
      /^the\s+role\b/i.test(directCandidate)) &&
    !sentenceLooksWeakCoverLetterResidual({
      sentence: directCandidate,
      noContextMode: false,
    })
  ) {
    return directCandidate;
  }

  const groundedCandidates = [
    (() => {
      const match = cleaned.match(/^The\s+(?:combination|mix|blend)\s+of\s+(.+)$/i);
      if (!match) return null;
      return `The role involves ${match[1]}`;
    })(),
    (() => {
      const match = cleaned.match(/^The\s+emphasis\s+on\s+(.+)$/i);
      if (!match) return null;
      return `The role places emphasis on ${match[1]}`;
    })(),
    (() => {
      const match = cleaned.match(/^The\s+focus\s+on\s+(.+)$/i);
      if (!match) return null;
      return `The role focuses on ${match[1]}`;
    })(),
    (() => {
      const match = cleaned.match(
        /^The\s+collaborative\s+nature\s+of\s+(?:the\s+)?(?:role|position|work)(?:,\s*including|\s+including)\s+(.+)$/i,
      );
      if (!match) return null;
      return `The role also involves ${match[1]}`;
    })(),
    cleaned,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of groundedCandidates) {
    const normalizedCandidate = ensureTerminalSentence(
      capitalizeSentenceStart(compactWhitespace(candidate)),
    );
    if (
      !normalizedCandidate ||
      sentenceLooksMalformedFragment(normalizedCandidate) ||
      sentenceLooksClosingTailFragment(normalizedCandidate) ||
      sentenceLooksGenericBodyOnly(normalizedCandidate) ||
      sentenceLooksUnsupportedRequirementLeakage(normalizedCandidate)
    ) {
      continue;
    }

    if (
      /^the role (?:places emphasis on|focuses on)\b/i.test(
        normalizedCandidate,
      ) ||
      sentenceLooksSaveableWorkSurfaceSentence(normalizedCandidate) ||
      sentenceLooksGroundedNoContextRoleSummarySentence(normalizedCandidate) ||
      sentenceLooksGroundedNoContextSupportSentence(normalizedCandidate) ||
      sentenceLooksModestNoContextRoleWorkContextSentence(normalizedCandidate)
    ) {
      return normalizedCandidate;
    }
  }

  return null;
}

function extractCandidateFragmentFromAlignmentSentence(
  sentence: string,
): string | null {
  const match = compactWhitespace(sentence).match(
    /^(.*?)(?:,\s*(?:which|that))?\s+\baligns?(?:\s+well)?\s+with\b(.*)$/i,
  );
  if (!match) return null;

  const left = compactWhitespace(match[1]);
  const right = compactWhitespace(match[2]);
  if (!left || !right) return null;

  const leftIsCandidate = FINAL_SAVED_ALIGNMENT_CANDIDATE_SIDE_PATTERN.test(
    left,
  );
  const rightIsCandidate = FINAL_SAVED_ALIGNMENT_CANDIDATE_SIDE_PATTERN.test(
    right,
  );

  if (
    leftIsCandidate &&
    !/^(?:your vision|your goals|the final design|this approach|the proposal)\b/i.test(
      right,
    )
  ) {
    return left;
  }

  if (
    !leftIsCandidate &&
    sentenceHasConcreteEvidenceAnchor(left) &&
    !/^(?:your|the final design|the proposal|this approach)\b/i.test(right)
  ) {
    return left;
  }

  if (
    !leftIsCandidate &&
    sentenceHasConcreteEvidenceAnchor(left) &&
    FINAL_SAVED_ALIGNMENT_TARGET_PATTERN.test(right)
  ) {
    return left;
  }

  if (rightIsCandidate && !leftIsCandidate) {
    return right;
  }

  if (FINAL_SAVED_ALIGNMENT_TARGET_PATTERN.test(left) && rightIsCandidate) {
    return right;
  }

  return null;
}

function hasFinalSavedOutputAlignmentBridge(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (
    !normalized ||
    (!FINAL_SAVED_ALIGNMENT_SPLIT_PATTERN.test(normalized) &&
      !FINAL_SAVED_ROLE_EMPHASIS_ALIGNMENT_PATTERN.test(normalized) &&
      !FINAL_SAVED_REQUIRED_FOR_THIS_ROLE_ALIGNMENT_PATTERN.test(normalized))
  ) {
    return false;
  }

  if (FINAL_SAVED_ROLE_EMPHASIS_ALIGNMENT_PATTERN.test(normalized)) {
    return true;
  }

  if (FINAL_SAVED_REQUIRED_FOR_THIS_ROLE_ALIGNMENT_PATTERN.test(normalized)) {
    return true;
  }

  if (
    FINAL_SAVED_ALIGNMENT_CLOSING_PREFIX_PATTERN.test(normalized) &&
    FINAL_SAVED_ALIGNMENT_TARGET_PATTERN.test(normalized)
  ) {
    return true;
  }

  return extractCandidateFragmentFromAlignmentSentence(normalized) !== null;
}

function isFinalSavedOutputSoftBridgeSentence(sentence: string): boolean {
  const normalized = compactWhitespace(sentence);
  if (!normalized) return false;
  if (containsForbiddenProposalBridge(normalized)) return true;
  if (FINAL_SAVED_RELEVANT_EXPERIENCE_OR_PERSPECTIVE_PATTERN.test(normalized))
    return true;
  if (FINAL_SAVED_RESPONSIBILITIES_RELEVANCE_PATTERN.test(normalized))
    return true;
  if (FINAL_SAVED_TEAM_FOCUS_RELEVANCE_PATTERN.test(normalized)) return true;
  if (FINAL_SAVED_MANAGING_RELEVANCE_PATTERN.test(normalized)) return true;
  if (FINAL_SAVED_WEAK_TRANSFER_PATTERN.test(normalized)) return true;
  if (hasFinalSavedOutputAlignmentBridge(normalized)) return true;
  if (FINAL_SAVED_COULD_TEAM_VALUE_PATTERN.test(normalized)) return true;
  if (FINAL_SAVED_APPLY_THESE_SKILLS_PATTERN.test(normalized)) return true;
  if (FINAL_SAVED_MAY_APPLY_TO_THIS_POSITION_PATTERN.test(normalized)) return true;
  if (FINAL_SAVED_MAY_ASSIST_IN_PATTERN.test(normalized)) return true;
  if (sentenceLooksUnsupportedRequirementLeakage(normalized)) return true;
  return false;
}

export function neutralizeFinalSavedOutputBridgeSentence(
  sentence: string,
  format?: OutputFormat,
): string {
  const normalized = compactWhitespace(sentence);
  if (!normalized) return "";
  if (!isFinalSavedOutputSoftBridgeSentence(normalized)) {
    return normalized;
  }

  if (
    FINAL_SAVED_ALIGNMENT_CLOSING_PREFIX_PATTERN.test(normalized) &&
    FINAL_SAVED_ALIGNMENT_SPLIT_PATTERN.test(normalized)
  ) {
    const withoutConditionalPrefix = compactWhitespace(
      normalized.replace(
        /^(?:let\s+me\s+know\s+if|if)\b[^,]*\baligns?(?:\s+well)?\s+with\b[^,]*,\s*/i,
        "",
      ),
    );
    if (withoutConditionalPrefix && withoutConditionalPrefix !== normalized) {
      const neutralizedRemainder =
        (format === "cover_letter"
          ? buildStandaloneCoverLetterGroundedSentenceFromFragment(
              withoutConditionalPrefix,
            )
          : buildStandaloneSentenceFromCandidateFragment(
              withoutConditionalPrefix,
            )) ??
        ensureTerminalSentence(
          capitalizeSentenceStart(
            stripLeadingSentenceConnector(withoutConditionalPrefix),
          ),
        );
      if (neutralizedRemainder) {
        return neutralizedRemainder;
      }
    }

    return "";
  }

  if (FINAL_SAVED_ALIGNMENT_SPLIT_PATTERN.test(normalized)) {
    if (format === "cover_letter") {
      const splitMatch = normalized.match(
        /^(.*?)(?:,\s*(?:which|that))?\s+\baligns?(?:\s+well)?\s+with\b(.*)$/i,
      );
      const leftFragment = compactWhitespace(splitMatch?.[1] ?? "");
      if (leftFragment) {
        const neutralizedLeft =
          buildStandaloneCoverLetterGroundedSentenceFromFragment(leftFragment);
        if (neutralizedLeft) {
          return neutralizedLeft;
        }
      }
    }

    const candidateFragment =
      extractCandidateFragmentFromAlignmentSentence(normalized);
    if (candidateFragment) {
      const neutralizedCandidate =
        format === "cover_letter"
          ? buildStandaloneCoverLetterGroundedSentenceFromFragment(
              candidateFragment,
            )
          : buildStandaloneSentenceFromCandidateFragment(candidateFragment);
      if (neutralizedCandidate) {
        return neutralizedCandidate;
      }
    }
  }

  if (FINAL_SAVED_REQUIRED_FOR_THIS_ROLE_ALIGNMENT_PATTERN.test(normalized)) {
    const splitMatch = normalized.match(
      /^(.*?)(?:,\s*(?:which|that))?\s+\baligns?(?:\s+well)?\s+with\b(.*)$/i,
    );
    if (splitMatch) {
      const candidateFragment = compactWhitespace(splitMatch[1]);
      if (
        candidateFragment &&
        (sentenceHasConcreteEvidenceAnchor(candidateFragment) ||
          sentenceHasGroundedWorkSurfaceDetail(candidateFragment))
      ) {
        const neutralizedCandidate =
          format === "cover_letter"
            ? buildStandaloneCoverLetterGroundedSentenceFromFragment(
                candidateFragment,
              )
            : buildStandaloneSentenceFromCandidateFragment(candidateFragment);
        if (neutralizedCandidate) {
          return neutralizedCandidate;
        }
      }
    }
    return "";
  }

  const preservePrefixForPattern = (pattern: RegExp): string | null => {
    const match = pattern.exec(normalized);
    if (!match || match.index === undefined || match.index <= 0) {
      return null;
    }
    const beforePattern = compactWhitespace(
      normalized.slice(0, match.index).replace(/[,:;—–-]+\s*$/u, ""),
    );
    return format === "cover_letter"
      ? buildStandaloneCoverLetterGroundedSentenceFromFragment(beforePattern)
      : buildStandaloneSentenceFromCandidateFragment(beforePattern);
  };

  if (FINAL_SAVED_ROLE_EMPHASIS_ALIGNMENT_PATTERN.test(normalized)) {
    const neutralizedAlignment = preservePrefixForPattern(
      FINAL_SAVED_ROLE_EMPHASIS_ALIGNMENT_PATTERN,
    );
    if (neutralizedAlignment) {
      return neutralizedAlignment;
    }
    return "";
  }

  if (FINAL_SAVED_RELEVANT_EXPERIENCE_OR_PERSPECTIVE_PATTERN.test(normalized)) {
    const perspectiveMatch =
      FINAL_SAVED_RELEVANT_EXPERIENCE_OR_PERSPECTIVE_PATTERN.exec(normalized);
    const beforePerspective = compactWhitespace(
      normalized
        .slice(0, perspectiveMatch?.index ?? 0)
        .replace(/[,:;—–-]+\s*$/u, "")
        .replace(/\b(?:which|that|and)\s*$/i, ""),
    );
    const neutralizedPerspective =
      format === "cover_letter"
        ? buildStandaloneCoverLetterGroundedSentenceFromFragment(
            beforePerspective,
          )
        : buildStandaloneSentenceFromCandidateFragment(beforePerspective);
    if (neutralizedPerspective) {
      return neutralizedPerspective;
    }
  }

  if (FINAL_SAVED_RESPONSIBILITIES_RELEVANCE_PATTERN.test(normalized)) {
    const neutralizedResponsibilities = preservePrefixForPattern(
      FINAL_SAVED_RESPONSIBILITIES_RELEVANCE_PATTERN,
    );
    if (neutralizedResponsibilities) {
      return neutralizedResponsibilities;
    }
    return "";
  }

  if (FINAL_SAVED_TEAM_FOCUS_RELEVANCE_PATTERN.test(normalized)) {
    const neutralizedTeamFocus = preservePrefixForPattern(
      FINAL_SAVED_TEAM_FOCUS_RELEVANCE_PATTERN,
    );
    if (neutralizedTeamFocus) {
      return neutralizedTeamFocus;
    }
    return "";
  }

  if (FINAL_SAVED_MANAGING_RELEVANCE_PATTERN.test(normalized)) {
    const neutralizedManaging = preservePrefixForPattern(
      FINAL_SAVED_MANAGING_RELEVANCE_PATTERN,
    );
    if (neutralizedManaging) {
      return neutralizedManaging;
    }
    return "";
  }

  if (FINAL_SAVED_APPLY_THESE_SKILLS_PATTERN.test(normalized)) {
    const neutralizedApplySkills = preservePrefixForPattern(
      FINAL_SAVED_APPLY_THESE_SKILLS_PATTERN,
    );
    if (neutralizedApplySkills) {
      return neutralizedApplySkills;
    }
    return "";
  }

  if (FINAL_SAVED_MAY_APPLY_TO_THIS_POSITION_PATTERN.test(normalized)) {
    const neutralizedMayApply = preservePrefixForPattern(
      FINAL_SAVED_MAY_APPLY_TO_THIS_POSITION_PATTERN,
    );
    if (neutralizedMayApply) {
      return neutralizedMayApply;
    }
    return "";
  }

  if (FINAL_SAVED_MAY_ASSIST_IN_PATTERN.test(normalized)) {
    const neutralizedMayAssist = preservePrefixForPattern(
      FINAL_SAVED_MAY_ASSIST_IN_PATTERN,
    );
    if (neutralizedMayAssist) {
      return neutralizedMayAssist;
    }
    return "";
  }

  if (
    containsForbiddenProposalBridge(normalized) ||
    FINAL_SAVED_WEAK_TRANSFER_PATTERN.test(normalized) ||
    FINAL_SAVED_COULD_TEAM_VALUE_PATTERN.test(normalized)
  ) {
    const weakTransferStart =
      FINAL_SAVED_WEAK_TRANSFER_PATTERN.exec(normalized)?.index ?? -1;
    const modalBridgeStart =
      FINAL_SAVED_MODAL_BRIDGE_START_PATTERN.exec(normalized)?.index ?? -1;
    const bridgeStart =
      modalBridgeStart > 0
        ? modalBridgeStart
        : weakTransferStart > 0
          ? weakTransferStart
          : -1;
    if (bridgeStart > 0) {
      const beforeBridge = compactWhitespace(
        normalized.slice(0, bridgeStart).replace(/[,;:\-\s]+$/u, ""),
      );
      const neutralizedPrefix =
        format === "cover_letter"
          ? buildStandaloneCoverLetterGroundedSentenceFromFragment(beforeBridge)
          : buildStandaloneSentenceFromCandidateFragment(beforeBridge);
      if (neutralizedPrefix) {
        return neutralizedPrefix;
      }
    }
  }

  if (sentenceLooksUnsupportedRequirementLeakage(normalized)) {
    return "";
  }

  return "";
}

function getFinalSavedOutputFallbackSentence(
  format: OutputFormat,
  outputLanguage: ProposalOutputLanguage,
): string | null {
  if (format !== "freelance_proposal") return null;
  return outputLanguage === "French"
    ? FRENCH_SAFE_FREELANCE_FINAL_SENTENCE
    : ENGLISH_SAFE_FREELANCE_FINAL_SENTENCE;
}

function isBoundaryParagraph(paragraph: string): boolean {
  const lines = paragraph
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;
  return isSalutationLine(lines[0]) || isClosingLine(lines[0]);
}

export function applyFinalSavedOutputBridgeGuard(args: {
  content: string;
  format: OutputFormat;
  outputLanguage: ProposalOutputLanguage;
}): string {
  const paragraphs = splitRawParagraphs(args.content);
  if (paragraphs.length === 0) return "";

  const cleanedParagraphs = paragraphs
    .map((paragraph, index) => {
      if (isBoundaryParagraph(paragraph)) {
        return paragraph;
      }

      const sentences = splitSentences(paragraph);
      if (sentences.length === 0) {
        return paragraph;
      }

      const hasTargetedSentence = sentences.some((sentence) =>
        isFinalSavedOutputSoftBridgeSentence(sentence),
      );
      if (!hasTargetedSentence) {
        return paragraph;
      }

      const filteredSentences: string[] = [];
      let previousSentenceRemoved = false;
      for (const sentence of sentences) {
        const isTargetedSentence =
          isFinalSavedOutputSoftBridgeSentence(sentence);
        if (!isTargetedSentence) {
          const preservedSentence = previousSentenceRemoved
            ? stripLeadingSentenceConnector(sentence)
            : sentence;
          if (compactWhitespace(preservedSentence)) {
            filteredSentences.push(ensureTerminalSentence(preservedSentence));
            previousSentenceRemoved = false;
          }
          continue;
        }

        const neutralizedSentence =
          neutralizeFinalSavedOutputBridgeSentence(sentence, args.format);
        if (neutralizedSentence) {
          filteredSentences.push(neutralizedSentence);
          previousSentenceRemoved = false;
          continue;
        }

        previousSentenceRemoved = true;
      }

      if (filteredSentences.length > 0) {
        return joinSentences(filteredSentences);
      }

      const fallbackSentence = getFinalSavedOutputFallbackSentence(
        args.format,
        args.outputLanguage,
      );
      if (fallbackSentence && index === paragraphs.length - 1) {
        return fallbackSentence;
      }

      return "";
    })
    .filter(Boolean);

  return cleanedParagraphs.join("\n\n").trim();
}

function sanitizeGeneratedProposalBody(args: {
  content: string;
  format: OutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
}): string {
  return buildProposalBodyCandidate({
    content: args.content,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
    removeForbiddenBridges: true,
  });
}

function normalizeApplicationMessageBodyForRendering(body: string): string {
  const cleanedSentences = splitParagraphs(body)
    .flatMap((paragraph) => splitSentences(paragraph))
    .map((sentence) => compactWhitespace(sentence))
    .filter(Boolean)
    .filter(
      (sentence) => !sentenceLooksApplicationMessageBoilerplate(sentence),
    );

  return joinSentences(cleanedSentences.slice(0, 2));
}

function normalizeStructuredApplicationMessageLine(value: string): string {
  const cleanedSentences = splitSentences(compactWhitespace(value))
    .map((sentence) => compactWhitespace(sentence))
    .filter(Boolean)
    .filter(
      (sentence) =>
        !isMetaOutputSentence(sentence) &&
        !isSalutationLine(sentence) &&
        !isClosingLine(sentence) &&
        !isApplicationMessageBoundaryLine(sentence) &&
        !sentenceLooksApplicationMessageBoilerplate(sentence),
    );

  return joinSentences(cleanedSentences.slice(0, 1));
}

function renderApplicationMessageSentenceSequence(sentences: string[]): string {
  return sentences
    .map((sentence) => ensureTerminalSentence(sentence))
    .map((sentence) => compactWhitespace(sentence))
    .filter(Boolean)
    .join(" ");
}

function tryRescueStructuredApplicationMessage(args: {
  opener: string;
  proofLine: string;
  followUpLine: string;
  noContextMode: boolean;
  outputLanguage: ProposalOutputLanguage;
  voicePreset: ProposalVoicePreset;
}): string | null {
  const openerInvalid =
    !args.opener ||
    sentenceLooksApplicationMessageInvalidOpener(args.opener) ||
    (args.noContextMode &&
      (sentenceLooksApplicationMessageNoContextAbstractAttraction(args.opener) ||
        sentenceLooksApplicationMessageNoContextUnsupportedExperienceClaim(
          args.opener,
        )));
  if (!openerInvalid) {
    return null;
  }

  if (
    !args.proofLine ||
    sentenceLooksApplicationMessageInvalidProofLine(args.proofLine) ||
    !sentenceHasGroundedWorkSurfaceDetail(args.proofLine) ||
    (args.noContextMode &&
      (sentenceLooksApplicationMessageNoContextAbstractAttraction(
        args.proofLine,
      ) ||
        sentenceLooksApplicationMessageNoContextUnsupportedExperienceClaim(
          args.proofLine,
        )))
  ) {
    return null;
  }

  const followUpLine =
    args.followUpLine &&
    !sentenceLooksApplicationMessageInvalidFollowUp(args.followUpLine) &&
    !sentenceLooksApplicationMessageSubstantiveFact(args.followUpLine)
      ? args.followUpLine
      : "";

  if (!followUpLine) {
    return null;
  }

  return renderApplicationMessageSentenceSequence([
    args.proofLine,
    followUpLine,
  ]);
}

function tryRenderStructuredApplicationMessage(args: {
  content: string;
  noContextMode: boolean;
  outputLanguage: ProposalOutputLanguage;
  voicePreset: ProposalVoicePreset;
  debugTrace?: ProposalFinalizationDebugTrace;
}): string | null {
  const parsed = parseStructuredApplicationMessageParts(args.content);
  if (!parsed) return null;

  const opener = normalizeStructuredApplicationMessageLine(parsed.opener);
  const proofLine = normalizeStructuredApplicationMessageLine(parsed.proofLine);
  const followUpLine = normalizeStructuredApplicationMessageLine(
    parsed.followUpLine,
  );

  if (!opener || !proofLine || !followUpLine) {
    return null;
  }

  if (
    applicationMessageViolatesSemanticContract({
      opener,
      proofLine,
      followUpLine,
      noContextMode: args.noContextMode,
    })
  ) {
    const rejectionReasons = collectApplicationMessageRejectionReasonTags({
      opener,
      proofLine,
      followUpLine,
      noContextMode: args.noContextMode,
    });
    const rescued = tryRescueStructuredApplicationMessage({
      opener,
      proofLine,
      followUpLine,
      noContextMode: args.noContextMode,
      outputLanguage: args.outputLanguage,
      voicePreset: args.voicePreset,
    });
    if (rescued) {
      if (args.debugTrace) {
        args.debugTrace.deterministicBoundaryApplication = {
          content: rescued,
        };
      }
      return rescued;
    }
    if (args.debugTrace) {
      args.debugTrace.applicationMessageRejectionReasons = rejectionReasons;
    }
    return null;
  }

  const rendered = renderStructuredApplicationMessage({
    parts: {
      opener,
      proofLine,
      followUpLine,
    },
  });
  if (args.debugTrace) {
    args.debugTrace.deterministicBoundaryApplication = {
      content: rendered.content,
    };
  }
  return rendered.content;
}

export function finalizeProposalForSave(args: {
  content: string;
  format: OutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  voicePreset: ProposalVoicePreset;
  noContextMode: boolean;
  acceptanceMode?: ProposalBodyAcceptanceMode;
  debugTrace?: ProposalFinalizationDebugTrace;
}): string {
  if (
    args.format !== "cover_letter" &&
    args.format !== "application_message"
  ) {
    return args.content;
  }

  if (args.format === "application_message") {
    const structuredRendered = tryRenderStructuredApplicationMessage({
      content: args.content,
      noContextMode: args.noContextMode,
      outputLanguage: args.outputLanguage,
      voicePreset: args.voicePreset,
      debugTrace: args.debugTrace,
    });
    if (structuredRendered) {
      return structuredRendered;
    }
  }

  const acceptanceMode =
    args.acceptanceMode ??
    (args.format === "cover_letter" ? "legacy_thin" : "strict");
  const selectedBody = selectProposalBodyCandidateOrThrow({
    content: args.content,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
    noContextMode: args.noContextMode,
    acceptanceMode,
    debugTrace: args.debugTrace,
  });
  const bodyForBoundaryRendering =
    args.format === "application_message"
      ? normalizeApplicationMessageBodyForRendering(selectedBody)
      : args.format === "cover_letter" && args.noContextMode
      ? cleanupNoContextEarlyBodySentences({
          body: selectedBody,
          acceptanceMode,
          debugTrace: args.debugTrace,
        })
      : selectedBody;

  try {
    const rendered = applyDeterministicProposalBoundaries({
      body: bodyForBoundaryRendering,
      format: args.format,
      outputLanguage: args.outputLanguage,
      candidateName: args.candidateName,
      voicePreset: args.voicePreset,
      noContextMode: args.noContextMode,
    });
    if (args.debugTrace) {
      args.debugTrace.deterministicBoundaryApplication = {
        content: rendered,
      };
    }
    return rendered;
  } catch (error) {
    markProposalFinalizationFailure(
      args.debugTrace,
      "deterministic_boundary_application",
    );
    throw error;
  }
}

export function finalizeProposalForPersistence(args: {
  content: string;
  format: OutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  voicePreset: ProposalVoicePreset;
  noContextMode: boolean;
  acceptanceMode?: ProposalBodyAcceptanceMode;
  debugTrace?: ProposalFinalizationDebugTrace;
}): string {
  const acceptanceMode =
    args.acceptanceMode ??
    (args.format === "cover_letter" ? "legacy_thin" : "strict");

  if (args.format === "freelance_proposal") {
    const cleanedFreelanceBody = selectProposalBodyCandidateOrThrow({
      content: args.content,
      format: args.format,
      outputLanguage: args.outputLanguage,
      candidateName: args.candidateName,
      noContextMode: args.noContextMode,
      acceptanceMode,
      debugTrace: args.debugTrace,
    });
  const guardedFreelanceBody = applyFinalSavedOutputBridgeGuard({
      content: cleanedFreelanceBody,
      format: args.format,
      outputLanguage: args.outputLanguage,
    });
    if (args.debugTrace) {
      const cleanupDiagnostics = getFinalSavedOutputBridgeCleanupDebugInfo({
        before: cleanedFreelanceBody,
        after: guardedFreelanceBody,
        format: args.format,
        outputLanguage: args.outputLanguage,
        candidateName: args.candidateName,
        noContextMode: args.noContextMode,
      });
      args.debugTrace.finalSavedOutputBridgeCleanup = {
        before: cleanedFreelanceBody,
        after: guardedFreelanceBody,
        removedSentenceTexts: cleanupDiagnostics.removedSentenceTexts,
        removedLastGroundedSentence:
          cleanupDiagnostics.removedLastGroundedSentence,
      };
    }
    assertSavedOutputHasSubstantiveBody({
      content: guardedFreelanceBody,
      format: args.format,
      outputLanguage: args.outputLanguage,
      candidateName: args.candidateName,
      noContextMode: args.noContextMode,
      acceptanceMode,
      debugTrace: args.debugTrace,
    });
    if (args.debugTrace) {
      args.debugTrace.finalOutput = guardedFreelanceBody;
    }
    return guardedFreelanceBody;
  }

  const finalized = finalizeProposalForSave(args);
  let guarded = applyFinalSavedOutputBridgeGuard({
    content: finalized,
    format: args.format,
    outputLanguage: args.outputLanguage,
  });
  if (args.format === "cover_letter") {
    const guardedBody = sanitizeGeneratedProposalBody({
      content: guarded,
      format: args.format,
      outputLanguage: args.outputLanguage,
      candidateName: args.candidateName,
    });
    if (
      !hasSaveableBodyContent({
        body: guardedBody,
        format: args.format,
        noContextMode: args.noContextMode,
        acceptanceMode,
      })
    ) {
      const finalizedBody = sanitizeGeneratedProposalBody({
        content: finalized,
        format: args.format,
        outputLanguage: args.outputLanguage,
        candidateName: args.candidateName,
      });
      const finalizedConservativeBody = buildProposalBodyCandidate({
        content: finalized,
        format: args.format,
        outputLanguage: args.outputLanguage,
        candidateName: args.candidateName,
        removeForbiddenBridges: false,
      });
      const rawCvRescueCandidate = !args.noContextMode
        ? buildRawCvBackedGroundedRescueBodyFromContent({
            content: finalized,
            outputLanguage: args.outputLanguage,
            candidateName: args.candidateName,
          })
        : null;
      const rescuedBody = buildRescuedCoverLetterBodyFromBodies({
        bodies: [
          guardedBody,
          finalizedBody,
          finalizedConservativeBody,
          rawCvRescueCandidate ?? "",
        ],
        noContextMode: args.noContextMode,
        acceptanceMode,
      });
      if (rescuedBody) {
        guarded = applyDeterministicProposalBoundaries({
          body: rescuedBody,
          format: args.format,
          outputLanguage: args.outputLanguage,
          candidateName: args.candidateName,
          voicePreset: args.voicePreset,
          noContextMode: args.noContextMode,
        });
      }
    }
  }
  if (args.debugTrace) {
    const cleanupDiagnostics = getFinalSavedOutputBridgeCleanupDebugInfo({
      before: finalized,
      after: guarded,
      format: args.format,
      outputLanguage: args.outputLanguage,
      candidateName: args.candidateName,
      noContextMode: args.noContextMode,
    });
    args.debugTrace.finalSavedOutputBridgeCleanup = {
      before: finalized,
      after: guarded,
      removedSentenceTexts: cleanupDiagnostics.removedSentenceTexts,
      removedLastGroundedSentence:
        cleanupDiagnostics.removedLastGroundedSentence,
    };
  }
  assertFinalBridgeCleanupDidNotCollapseCoverLetterBody({
    before: finalized,
    after: guarded,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
    noContextMode: args.noContextMode,
    debugTrace: args.debugTrace,
  });
  assertSavedOutputHasSubstantiveBody({
    content: guarded,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
    noContextMode: args.noContextMode,
    acceptanceMode,
    debugTrace: args.debugTrace,
  });
  if (args.debugTrace) {
    args.debugTrace.finalOutput = guarded;
  }
  return guarded;
}

export function inspectProposalFinalization(args: {
  content: string;
  format: OutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  voicePreset: ProposalVoicePreset;
  noContextMode: boolean;
  acceptanceMode?: ProposalBodyAcceptanceMode;
}): ProposalFinalizationDebugTrace {
  const trace: ProposalFinalizationDebugTrace = {
    acceptanceMode:
      args.acceptanceMode ??
      (args.format === "cover_letter" ? "legacy_thin" : "strict"),
    rawGeneratedBody: args.content,
    cleanedBodySelection: {
      aggressive: {
        candidate: "",
        saveableSentences: [],
        saveableSentenceCount: 0,
        groundedOperationalSentenceCount: 0,
        groundedSupportSentenceCount: 0,
        isSaveable: false,
      },
      conservative: {
        candidate: "",
        saveableSentences: [],
        saveableSentenceCount: 0,
        groundedOperationalSentenceCount: 0,
        groundedSupportSentenceCount: 0,
        isSaveable: false,
      },
      selectedCandidate: null,
      selectedBody: null,
    },
  };

  try {
    trace.finalOutput = finalizeProposalForPersistence({
      ...args,
      debugTrace: trace,
    });
  } catch (error) {
    trace.errorMessage =
      error instanceof Error ? error.message : String(error);
  }

  if (
    args.format === "application_message" &&
    !trace.applicationMessageRejectionReasons
  ) {
    const parsed = parseStructuredApplicationMessageParts(args.content);
    if (parsed) {
      const opener = normalizeStructuredApplicationMessageLine(parsed.opener);
      const proofLine = normalizeStructuredApplicationMessageLine(
        parsed.proofLine,
      );
      const followUpLine = normalizeStructuredApplicationMessageLine(
        parsed.followUpLine,
      );
      const reasons = collectApplicationMessageRejectionReasonTags({
        opener,
        proofLine,
        followUpLine,
        noContextMode: args.noContextMode,
      });
      if (reasons.length > 0) {
        trace.applicationMessageRejectionReasons = reasons;
      }
    }
  }

  return trace;
}

type ProposalFinalizationTraceCaptureArgs = {
  content: string;
  format: OutputFormat;
  outputLanguage: ProposalOutputLanguage;
  candidateName?: string;
  voicePreset: ProposalVoicePreset;
  noContextMode: boolean;
  acceptanceMode?: ProposalBodyAcceptanceMode;
  attemptedPath: ProposalGenerationPathLabel;
};

function logProposalFinalizationTrace(
  args: ProposalFinalizationTraceCaptureArgs,
): ProposalFinalizationDebugTrace {
  const trace = inspectProposalFinalization({
    content: args.content,
    format: args.format,
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
    voicePreset: args.voicePreset,
    noContextMode: args.noContextMode,
    acceptanceMode: args.acceptanceMode,
  });
  console.error("Proposal finalization fail-closed trace", {
    attemptedPath: args.attemptedPath,
    rawGeneratedBody: trace.rawGeneratedBody,
    aggressiveCandidate: trace.cleanedBodySelection.aggressive.candidate,
    aggressiveSaveableSentences:
      trace.cleanedBodySelection.aggressive.saveableSentences,
    aggressiveSaveableSentenceCount:
      trace.cleanedBodySelection.aggressive.saveableSentenceCount,
    aggressiveGroundedOperationalSentenceCount:
      trace.cleanedBodySelection.aggressive.groundedOperationalSentenceCount,
    aggressiveGroundedSupportSentenceCount:
      trace.cleanedBodySelection.aggressive.groundedSupportSentenceCount,
    conservativeCandidate: trace.cleanedBodySelection.conservative.candidate,
    conservativeSaveableSentences:
      trace.cleanedBodySelection.conservative.saveableSentences,
    conservativeSaveableSentenceCount:
      trace.cleanedBodySelection.conservative.saveableSentenceCount,
    conservativeGroundedOperationalSentenceCount:
      trace.cleanedBodySelection.conservative.groundedOperationalSentenceCount,
    conservativeGroundedSupportSentenceCount:
      trace.cleanedBodySelection.conservative.groundedSupportSentenceCount,
    selectedBody: trace.cleanedBodySelection.selectedBody ?? null,
    applicationMessageRejectionReasons:
      trace.applicationMessageRejectionReasons ?? null,
    noContextCleanup: trace.noContextLeadCleanup ?? null,
    finalBridgeCleanup: trace.finalSavedOutputBridgeCleanup ?? null,
    failureStage: trace.failureStage ?? null,
    errorMessage: trace.errorMessage ?? null,
  });
  return trace;
}

export function buildInlineMistralPrompt(
  args: GenerateProposalArgs,
  tone: EffectiveProposalTone,
  presetGuidance: string,
  format: OutputFormat,
  outputLanguage: ProposalOutputLanguage,
  personalizationBlock: string,
  personalizationRichness?: PersonalizationRichness,
  noContextBlock?: string,
  plannerBlock?: string,
): string {
  const isNoContext = Boolean(noContextBlock);
  const applicationMessageEmployerPriorityBlock =
    format === "application_message"
      ? buildApplicationMessageEmployerPriorityBlock(args.jobDescription)
      : "";
  const safePresetGuidance = sanitizePresetGuidanceForClaimSafety(
    presetGuidance,
  );
  const applicationMessageWriterBrief =
    format === "application_message"
      ? buildApplicationMessageWriterBriefBlock({
          isNoContext,
          safePresetGuidance,
        })
      : "";
  const applicationMessageNoContextSafety =
    format === "application_message"
      ? buildApplicationMessageNoContextSafetyBlock(isNoContext)
      : "";
  const toneGuidance = `Use "${tone.formalityLevel}" formality and "${tone.creativity}" style only as tone guidance.`;
  const languageGuidance =
    buildProposalOutputLanguageInstruction(outputLanguage);
  const universalVoiceGuidance = UNIVERSAL_PROPOSAL_VOICE_GUARDRAILS.join(" ");
  const criticalOverrideBlock = buildCriticalWriterOverrideBlock();
  const metaOutputForbiddenBlock = buildMetaOutputForbiddenBlock();
  const bodyOnlyConstraintBlock = buildBodyOnlyConstraintBlock(format);
  const coverLetterCompositionPriorityBlock =
    buildCoverLetterCompositionPriorityBlock(format, isNoContext);
  const coverLetterEvidencePriorityBlock =
    buildCoverLetterEvidencePriorityBlock(format, isNoContext);
  const universalClosingRuleBlock = buildUniversalClosingRuleBlock(format);
  const forbiddenBridgeRuleBlock = buildForbiddenBridgeRuleBlock();
  const writerBoundaryExamplesBlock = buildWriterBoundaryExamplesBlock(format);
  const coverLetterPresetOverlay =
    format === "cover_letter"
      ? buildCoverLetterPresetBodyOverlay(args.voicePreset)
      : [];
  const presetOverlayBlock = [
    "Voice preset overlay:",
    "Use the selected preset only for tone, pacing, warmth, directness, narrative smoothness, and body texture within the allowed evidence boundaries.",
    "Do not use the preset to force an opening pattern, paragraph progression, proof order, or closing shape.",
    "The preset may change transition style, paragraph feel, and how explicitly the body carries a through-line, but it must not change the underlying evidence boundaries.",
    "The preset must not increase claim strength, readiness, contribution implication, qualification implication, task-readiness, or fit language.",
    "If any preset wording suggests stronger fit, contribution, ownership, readiness, or qualification, ignore that escalation and keep only the surface tone.",
    ...coverLetterPresetOverlay,
    safePresetGuidance,
  ].join("\n");
  const unsupportedClaimsBlock = [
    "Unsupported claims blacklist:",
    ...UNSUPPORTED_PROPOSAL_CLAIMS_BLACKLIST.map((rule) => `- ${rule}`),
  ].join("\n");
  const sourceBackedSpecificityBlock = [
    "Source-backed specificity rules:",
    ...SOURCE_BACKED_SPECIFICITY_RULES.map((rule) => `- ${rule}`),
  ].join("\n");
  const jobDescriptionBoundaryBlock = [
    "Job-description boundary rules:",
    ...JOB_DESCRIPTION_TO_CANDIDATE_RULES.map((rule) => `- ${rule}`),
  ].join("\n");
  const identityBackgroundHardStopBlock = [
    "Identity and background hard-stop rules:",
    ...IDENTITY_BACKGROUND_HARD_STOP_RULES.map((rule) => `- ${rule}`),
  ].join("\n");
  const specificityContrastBlock = [
    "Specificity contrast example:",
    "- Acceptable: if the source names a tool, certification, employer, procedure, language, or quantified outcome, keep that same concrete detail when it is useful.",
    "- Not acceptable: do not turn a supported detail into a narrower operational claim or broader ownership, workflow, incident, or domain-expertise claim unless the source clearly supports that stronger version.",
  ].join("\n");
  const jobDescriptionContrastBlock = [
    "JD-only contrast example:",
    "- Acceptable: 'The role involves CCTV and access control monitoring, and I would approach that responsibility with professionalism and attention to detail.'",
    "- Not acceptable: 'I have managed CCTV and access control systems' when those facts appear only in the job description.",
  ].join("\n");
  const identityBackgroundContrastBlock = [
    "Identity/domain contrast example:",
    "- Acceptable: 'I have worked in military and defense sectors.'",
    "- Not acceptable: 'As a veteran', 'my military service', or 'my public-service background' unless the candidate background explicitly says that.",
  ].join("\n");
  const antiTemplateLanguageBlock = [
    "Anti-template language rules:",
    "- Avoid stock application or pitch announcements when they add no specificity.",
    "- Do not force every output to open with the same evidence-first, enthusiasm-first, or personal-interest-first formula.",
    "- If you express interest or motivation, tie it to supported evidence, employer context, shared-goal context, work context, or a clear trajectory link instead of ceremonial enthusiasm.",
    "- Use one grounded reason or proof point at a time instead of repeating motivation, fit, professionalism, or closing formulas across multiple sentences.",
  ].join("\n");
  const contextualClaimBoundaryGuidance = isNoContext
    ? format === "application_message"
      ? [
          "In no-context mode, stay non-claiming throughout.",
          "In no-context mode, do not imply readiness, contribution, fit, qualification, or supported task capability.",
          "In no-context mode, use only role context, concrete work surfaces from the job description, shared-goal context when the employer context supports it, and grounded curiosity.",
          "In no-context application-message mode, let at most one sentence rely mainly on personal-interest framing; move any later sentence to concrete work context, workflow, operating context, or team interaction from the job description.",
          "In no-context mode, do not turn job-description tasks into prior candidate experience or future operational capability.",
          "In no-context mode, do not combine a trait, interest, or value statement with operational execution, support, contribution, or future team value.",
        ]
      : [
          "In no-context mode, stay non-claiming throughout.",
          "In no-context mode, do not imply readiness, contribution, fit, qualification, or supported task capability.",
          "In no-context mode, use only role context, concrete work surfaces from the job description, shared-goal context when the employer context supports it, and grounded curiosity.",
          "In no-context cover-letter mode, when the job description gives enough concrete detail, make at least two substantive sentences about recurring responsibilities, workflow, operating context, coordination, communication, records, or team interaction from the job description before the brief close.",
          "In no-context cover-letter mode, when concrete job-description material exists, make the first substantive movement describe the actual work, products, outputs, media, files, process, or operating context rather than personal interest or admiration.",
          "In no-context cover-letter mode, make the next substantive movement describe workflow, collaboration, revision, production constraints, deliverables, or coordination from the job description before any motivation-led sentence.",
          "In no-context cover-letter mode, do not let benefit summaries, environment summaries, or generic teamwork, professionalism, reliability, or seriousness filler stand in for the main body substance.",
          "In no-context cover-letter mode, if you include one curiosity, seriousness, or role-interest sentence, make it concrete about the work, operating context, or employer context rather than generic admiration, benefits, or atmosphere.",
          "In no-context cover-letter mode, keep the main body substance on the work itself rather than on mission admiration, culture admiration, schedule, flexibility, growth language, or generic role-interest rhetoric.",
          "In no-context cover-letter mode, keep challenge language, opportunity language, mission admiration, growth language, and personal-interest rhetoric secondary only; they must not carry the body or appear before the concrete work/process sentences when those are available.",
          "In no-context mode, let at most one sentence rely mainly on personal-interest framing; move any later sentence to concrete work context, workflow, operating context, or team interaction from the job description.",
          "In no-context cover-letter mode, do not use stock role-interest lines such as 'I am particularly drawn to ...', 'The opportunity to ...', 'The day-to-day work itself ...', 'prepared to adapt', 'prepared to meet the minimum requirements', 'develop skills in ...', 'particularly engaging', 'compelling', 'attractive place to grow professionally', or 'resonates with my understanding ...'.",
          "In no-context mode, do not turn job-description tasks into prior candidate experience or future operational capability.",
          "In no-context mode, do not combine a trait, interest, or value statement with operational execution, support, contribution, or future team value.",
        ]
    : [
        "For strong matches, use supported proof without upgrading claim strength.",
        "For partial or adjacent matches, use one grounded overlap point and keep any relevance link cautious and factual.",
        "For distant matches, prefer one factual overlap and one honest limit over abstract transfer rhetoric.",
        "Do not translate background, traits, degree, discipline, communication, or reliability into direct target-role readiness, contribution, support, ownership, team value, mission support, or ability transfer into the target environment unless that exact claim is source-backed.",
        "In adjacent-role mode, do not imply future team value, operational support, mission support, readiness for target-role tasks, or ability transfer into the target environment.",
        "In distant-role mode, do not project future operational value, team value, mission support, or readiness for target-role tasks.",
        "For very weak matches, keep the output honest, cautious, and grounded rather than capability-led.",
      ];
  const antiHallucinationGuidance = [
    "Use the candidate background as the only source of claims about the candidate.",
    "Every claim, qualification, strength, or achievement you mention must be grounded in the candidate background.",
    "Never treat the job description as if it were evidence about the candidate.",
    "If a fact appears only in the job description, do not present it as something the candidate has already done.",
    "Job requirements may frame fit or motivation, but they are not prior work, prior systems used, prior incidents handled, prior certifications, or prior quantified results unless the candidate background supports them.",
    "Do not infer or claim veteran status, military service, public-service background, accreditation/licensing, completed degree status, or direct domain-practice background unless the candidate background explicitly supports it.",
    "Do not invent job titles, employers, industries, software tools, certifications, licenses, degrees, portfolio work, side projects, informal practice, years of experience, or measurable outcomes.",
    "Do not synthesize employer-style names or combine the candidate name with a role unless that exact organization or employer name appears in the candidate background.",
    "Preserve exact supported detail when it exists instead of smoothing it into vaguer or more embellished wording.",
    "When the candidate background includes concrete employers, tools, certifications, procedures, languages, equipment, or quantified outcomes, keep that specificity when it helps the reader.",
    "Do not strengthen a supported detail into broader ownership, deeper domain expertise, incident experience, workflow responsibility, or system scope unless the source explicitly supports it.",
    "Do not sharpen supported facts into visitor-documentation work, broader emergency-response history, stronger system ownership, exact required credential fit, or completed-degree language unless the source explicitly supports that stronger version.",
    "Do not rewrite the candidate into a different profession or imply they already have hard requirements that are not supported.",
    "If an important requirement is missing from the candidate background, do not imply that the candidate has it.",
    ...contextualClaimBoundaryGuidance,
    `Do not use phrases such as ${formatQuotedPhraseList(
      PROPOSAL_FORBIDDEN_BRIDGES,
    )} unless that stronger claim is directly supported.`,
    `Any phrase that combines ${formatQuotedPhraseList(
      PROPOSAL_GENERIC_FUTURE_VALUE_VERBS,
    )} with ${formatQuotedPhraseList(
      PROPOSAL_GENERIC_FUTURE_VALUE_TARGETS,
    )} is forbidden unless it is literally source-backed.`,
    "If fewer supported proof points are available, use fewer rather than inventing more.",
  ].join(" ");

  let base: string;
  switch (format) {
    case "application_message":
      base = [
        `Write a short recruiter-facing application message for "${args.jobTitle}".`,
        `Job description: ${args.jobDescription}.`,
        "Return exactly three labeled lines and nothing else:",
        "opener: <one short recruiter-facing sentence>",
        "proof_line: <one short grounded sentence>",
        "follow_up_line: <one short same-thread continuation sentence>",
        "Write in first person.",
        "Treat it like a LinkedIn message, recruiter email, or short application note rather than a formal letter.",
        "The final saved artifact should be a one-paragraph note with 3 short sentences total and usually about 60 to 120 words.",
        "Each labeled line should contain exactly one complete sentence.",
        "Do not use headings, bullet points, subject lines, greetings, sign-offs, signatures, or any labels beyond opener, proof_line, and follow_up_line.",
        "Keep it concise, direct, grounded, and human.",
        "Use formality and creativity only as tone guidance, not structure guidance.",
        languageGuidance,
        universalVoiceGuidance,
        toneGuidance,
      ].join(" ");
      break;
    case "freelance_proposal":
      base = [
        `Write a client-facing freelance proposal for "${args.jobTitle}".`,
        `Job description: ${args.jobDescription}.`,
        "Return only the raw proposal body.",
        "Write in first person.",
        "Focus on a concrete read of the client's need, relevant supported proof when available, a concise working approach, and a direct close.",
        "Keep it specific, practical, and credible without sounding bloated, salesy, or overly formal.",
        "Do not add greetings, sign-offs, signatures, or ceremonial pitch language.",
        ...(isNoContext
          ? [
              "In no-context mode, ground the proposal in the described work, workflow, deliverables, scope, constraints, or collaboration model rather than in claimed prior client work.",
              "Do not invent prior clients, shipped projects, tools, delivery timelines, or quantified outcomes.",
            ]
          : [
              "Use supported experience or scope when it materially clarifies credibility, but do not over-claim domain expertise or delivery readiness.",
            ]),
        "Avoid unnecessary headings unless they materially improve clarity.",
        languageGuidance,
        universalVoiceGuidance,
        toneGuidance,
      ].join(" ");
      break;
    case "cover_letter":
    default:
      base = [
        `Write a tailored employment cover letter for "${args.jobTitle}".`,
        `Job description: ${args.jobDescription}.`,
        "Return only the raw body text.",
        "Write in first person.",
        "Keep all cover-letter body prose in first person throughout. Do not switch to he, she, they, or third-person self-reference for the candidate.",
        "Every sentence must be complete and grammatically closed. Do not leave trailing clauses, unfinished continuations, or half-finished sentences such as '... is.' or 'I look forward to discussing how my background.'.",
        "For engaging and storyteller tones, prioritize completed sentence closure and clean paragraph endings over flourish.",
        "Prefer 2 to 3 concise paragraphs rather than a ceremonial multi-step template.",
        "Keep the total length around 160 to 220 words.",
        "Do not use headings, bullet points, tables, subject lines, greetings, sign-offs, signatures, or postal/contact header lines.",
        "Do not output placeholders such as [Your Email], [Your Phone Number], [Date], [Your Address], or [Company Address].",
        "Keep it natural, specific, and human rather than ceremonially formal.",
        "Open naturally and specifically, tied to the role, employer, or hiring context when the job description provides enough context.",
        "Avoid generic openings unless they are made specific to the role or company, including stock phrasing such as 'I am writing to express my interest' when it adds no real specificity.",
        "Do not repeat application-intro, motivation, fit, or professionalism formulas across multiple paragraphs.",
        "Use at most one brief closing invitation and avoid a separate end paragraph that only restates enthusiasm, fit, or reliability.",
        "Make the body feel complete and employer-useful even if the final discussion sentence is removed.",
        "Give the reader a reason to interview the candidate before the closing sentence arrives.",
        ...(isNoContext
          ? [
              "When no candidate background is available, write a grounded, non-claiming cover-letter body rather than a capability-based cover letter.",
              "Do not include accomplishments, prior-work proof points, retrospective evidence, readiness language, contribution language, fit language, or qualification language when no candidate background is available.",
              "Use role context, concrete work surfaces from the job description, employer-specific detail when supported, grounded curiosity, and one brief discussion-forward close.",
              "Open from a specific work surface, workflow, operating context, employer context, or day-to-day responsibility from the job description rather than from generic admiration for the opportunity.",
              "Aim for a body built from two grounded job-description sentences about the work itself, workflow, operating context, coordination, or employer context, plus at most one brief role-interest or curiosity sentence before the close.",
              "When enough job-description detail exists, make the main body stand on two JD-grounded substantive sentences about the work itself, workflow, operating context, coordination, communication, records, or team interaction before the brief close.",
              "When concrete job-description material exists, make the first substantive sentence about the actual work, products, outputs, media, files, process, or operating context rather than about personal interest or admiration.",
              "When concrete job-description material exists, make the next substantive sentence about workflow, collaboration, revision, production constraints, deliverables, or coordination from the job description before any motivation-led sentence.",
              "If you add one supporting sentence beyond the core work-surface movements, let it explain why the day-to-day work depends on coordination, documentation, accuracy, follow-through, service continuity, or operating discipline rather than generic professionalism, benefits, or atmosphere.",
              "Treat job-description summary plus appreciation, admiration, or a generic communication/professionalism sentence as incomplete; the second body movement must still add grounded operational consequence, dependency, or workflow substance.",
              "Do not let a role-title summary, scenic employer description, or generic paraphrase of the job description count as one of the grounded body sentences.",
              "Do not let benefit summaries, environment summaries, or generic teamwork, professionalism, reliability, or seriousness filler count as body substance.",
              "If you use employer-specific detail, use it only to clarify the operating setting, users served, or day-to-day environment; do not spend a sentence on atmosphere, prestige, or perks.",
              "Keep mission admiration, culture admiration, schedule, flexibility, and generic interest rhetoric secondary at most; they must not carry the body.",
              "Keep challenge language, opportunity language, mission admiration, growth language, and personal-interest rhetoric secondary only; they must not carry the body or come before the concrete work/process sentences when those are available.",
              "Do not combine a personal trait with the target role, team, company, or projects in a contribution-like way.",
              "Do not mention contribution to safety, mission, operations, team value, or how the candidate would perform tasks.",
              "Do not mention secure environments, scenarios, patrols, access control, conflict resolution, or similar operational execution as something the candidate would do.",
              "Do not use generic role-interest templates such as 'I am particularly drawn to ...', 'The opportunity to ...', 'The day-to-day work itself ...', 'prepared to adapt', 'prepared to meet the minimum requirements', 'develop skills in ...', 'particularly engaging', 'compelling', 'attractive place to grow professionally', or 'resonates with my understanding ...'.",
              "Do not let schedule, flexibility, or willingness-to-adapt language serve as one of the main supporting sentences.",
              "Do not let more than one sentence rely mainly on personal-interest framing.",
              "The body must still feel useful and complete before the final discussion-forward sentence; do not rely on the close to carry the main persuasive movement.",
            ]
          : [
              "Bring a strong supported proof point or scope fact in early when one exists, but do not force a resume-style opener.",
              "Open with a clear role-relevant positioning move grounded in the strongest supported proof or scope/background fact rather than a generic application formula or a bare fact dump.",
              "When candidate background is available and supported evidence exists, anchor the first substantive sentence in one concrete supported evidence point or one supported scope/background fact.",
              "If supported achievements are available, they are the highest-value proof points and should appear before softer background framing.",
              "Prefer top supported evidence, supported scope, and relevant background facts before abstract transferable traits, mission admiration, or generic transfer language.",
              "If quantified achievement evidence, operational proof, or strong role-relevant scope exists, do not spend the opening or main supporting sentence on language proficiency, office software, future certification interest, schedule flexibility, or generic company enthusiasm.",
              "After the evidence anchor, use the next substantive sentence to explain why that supported proof matters for the role's actual work, workflow, users, team context, or operating environment rather than merely saying it aligns or is transferable.",
              "After the evidence anchor, include one explicit employer-facing relevance sentence that states what part of the role's work, workflow, users, team, or operating environment the supported evidence speaks to.",
              "That employer-facing sentence does not count if it only says the background aligns, is a strong fit, ensures efficient workflows, or restates communication, professionalism, independence, or deadline comfort without a concrete operating consequence.",
              "When supported evidence exists beyond the opening point, spend one additional grounded supporting sentence on a second supported scope/background fact or concrete operating detail before the close.",
              "Secondary qualifications such as language ability, generic office tools, or future certification interest should appear only if they are central to the role and the stronger evidence has already been stated.",
              "For adjacent or distant backgrounds, make that explanation name one concrete overlap, operating constraint, or perspective the supported evidence speaks to rather than broad future-value or adaptability language.",
              "When supported evidence is thin but real, interpret the best supported fact against one concrete work surface or operating constraint from the job description instead of defaulting to generic fit, value, or adaptability language.",
              "Use transferable traits only as brief secondary framing after concrete proof, not as the main body substance when stronger evidence exists.",
              `After the evidence anchor, the only allowed bridge is one cautious relevance sentence using phrasing such as ${formatQuotedPhraseList(
                PROPOSAL_ALLOWED_CAUTIOUS_BRIDGES,
              )}.`,
              "Do not compensate for missing achievement evidence with readiness, fit, contribution, or qualification language.",
              "For adjacent-role backgrounds, keep the link soft and factual: relevant background, experience in, or may offer relevant perspective.",
              "For adjacent or distant but still recoverable backgrounds, write a prudent transfer cover letter: keep one supported overlap or perspective concrete, say what part of the work it helps the reader trust, and do not imply direct target-role readiness.",
              "Do not use future-value, support, fit, readiness, or contribution bridge language.",
              "Do not let a requirement-checklist paragraph, benefits-attraction paragraph, or company-admiration paragraph outrank stronger supported evidence.",
              "The body must still read like a concise hiring case before the final discussion sentence; do not let the close do the work of missing body substance.",
            ]),
        "Show interest in the role and organization through grounded, non-formulaic language without stacking repeated motivation sentences.",
        "Do not let the body read like a CV summary or a job-description summary; use the available evidence or work context to make a concise hiring case.",
        "Do not restate the job description line by line.",
        "Do not simply restate the CV.",
        "Do not let the body collapse into proof point, generic relevance sentence, and generic close only.",
        "Do not let the close do the work of a missing body sentence.",
        "Do not let a JD-summary shell, benefit-summary shell, or teamwork/professionalism filler block stand in for the body.",
        "Keep the prose appropriate for a professional application letter, not a client proposal, consultant pitch, or RFP response.",
        "Keep it credible, concise, and non-theatrical.",
        "Use formality and creativity only as tone guidance, not structure guidance.",
        languageGuidance,
        universalVoiceGuidance,
        toneGuidance,
      ].join(" ");
      break;
  }

  const strengthGuidance = buildPersonalizationStrengthPromptBlock(
    personalizationRichness,
  );
  if (format === "application_message") {
    return [
      criticalOverrideBlock,
      metaOutputForbiddenBlock,
      bodyOnlyConstraintBlock,
      plannerBlock,
      applicationMessageWriterBrief,
      applicationMessageEmployerPriorityBlock,
      unsupportedClaimsBlock,
      jobDescriptionBoundaryBlock,
      identityBackgroundHardStopBlock,
      applicationMessageNoContextSafety,
      base,
      strengthGuidance,
      personalizationBlock,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return [
    criticalOverrideBlock,
    metaOutputForbiddenBlock,
    bodyOnlyConstraintBlock,
    coverLetterCompositionPriorityBlock,
    coverLetterEvidencePriorityBlock,
    plannerBlock,
    applicationMessageEmployerPriorityBlock,
    forbiddenBridgeRuleBlock,
    noContextBlock,
    universalClosingRuleBlock,
    writerBoundaryExamplesBlock,
    unsupportedClaimsBlock,
    sourceBackedSpecificityBlock,
    jobDescriptionBoundaryBlock,
    identityBackgroundHardStopBlock,
    antiHallucinationGuidance,
    base,
    presetOverlayBlock,
    specificityContrastBlock,
    jobDescriptionContrastBlock,
    identityBackgroundContrastBlock,
    antiTemplateLanguageBlock,
    strengthGuidance,
    personalizationBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function handleGenerateProposal(
  ctx: any,
  args: GenerateProposalArgs,
): Promise<
  {
    proposalId: string;
    proposalContent: string;
  } & ProposalExecutionProvenance
> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("User not authenticated");
  }

  let userProfile = await ctx.runQuery(internal.profiles.get);
  if (!userProfile) {
    console.warn(
      "User profile not found. Creating a new profile with default preferences.",
    );
    await ctx.runMutation(internal.profiles.upsert, {
      preferences: {
        writingStyle: "professional",
        tonePreference: "formal",
        autoSend: false,
      },
    });
    userProfile = await ctx.runQuery(internal.profiles.get);
    if (!userProfile) {
      throw new ConvexError("Failed to create or retrieve user profile.");
    }
  }

  const outputFormat = normalizeOutputFormat(args.proposalType);
  const explicitPersonalization = sanitizePersonalizationContext(
    args.personalizationContext,
  );
  const personalizationMode = args.personalizationMode ?? "default";
  const resolvedPersonalization =
    personalizationMode === "explicit_only"
      ? explicitPersonalization
      : resolvePersonalizationContext(
          args.personalizationContext,
          buildFallbackPersonalizationContext(
            userProfile as ProfileFallbackDoc | null,
          ),
          args.personalizationRichness,
        );
  const effectivePersonalization =
    outputFormat === "application_message"
      ? sanitizeApplicationMessagePersonalizationContext(
          resolvedPersonalization,
        )
      : resolvedPersonalization;
  const requestedModelType: ProposalModelType =
    args.modelType || "mistral-small-latest";
  const resolvedVoicePreset =
    normalizeProposalVoicePresetForMode({
      value:
        args.voicePreset ??
        (userProfile as ProfileFallbackDoc | null)?.proposalVoicePreset,
      proposalType: args.proposalType,
      modelType: requestedModelType,
    }) ??
    DEFAULT_PROPOSAL_VOICE_PRESET;
  const voicePresetDefinition =
    getProposalVoicePresetDefinition(resolvedVoicePreset);
  const effectiveTone = resolveEffectiveProposalTone({
    tonePreset: resolvedVoicePreset,
    formalityLevel: args.formalityLevel,
    creativity: args.creativity,
  });
  const hasCandidateContext = effectivePersonalization !== null;
  const effectivePromptRichness = hasCandidateContext
    ? args.personalizationRichness
    : "none";
  const plannerContextMode = computeProposalPlannerContextMode(
    effectivePromptRichness,
    hasCandidateContext,
  );
  const outputLanguage = resolveProposalOutputLanguage(args.jobDescription);
  const plannerOutputLanguage = outputLanguage === "French" ? "fr" : "en";
  const candidateName = effectivePersonalization?.name ?? undefined;
  const outputLanguageInstruction =
    buildProposalOutputLanguageInstruction(outputLanguage);
  const defaultStoredTitle = resolveStoredProposalTitle({
    jobTitle: args.jobTitle,
    format: outputFormat,
  });
  const effectiveJobTitle = defaultStoredTitle;
  const personalizationBlock =
    outputFormat === "application_message"
      ? buildApplicationMessageCandidatePriorityBlock({
          context: effectivePersonalization,
          jobTitle: effectiveJobTitle,
          jobDescription: args.jobDescription,
        })
      : buildPersonalizationPromptBlock(effectivePersonalization);
  const sourceFactBank = buildProposalSourceFactBank(effectivePersonalization);
  const noContextPromptBlock = hasCandidateContext
    ? ""
    : buildNoContextPromptBlock(outputFormat);
  const candidateGuidanceBlock = [
    outputLanguageInstruction,
    personalizationBlock,
    noContextPromptBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
  const plannerPrompt = buildProposalPlannerPrompt({
    jobTitle: effectiveJobTitle,
    jobDescription: args.jobDescription,
    voicePreset: resolvedVoicePreset,
    contextMode: plannerContextMode,
    outputLanguage: plannerOutputLanguage,
    personalizationContext: effectivePersonalization,
  });
  let plannerResult: ProposalPlannerResult | null = null;
  let prompt = buildInlineMistralPrompt(
    {
      ...args,
      jobTitle: effectiveJobTitle,
    },
    effectiveTone,
    voicePresetDefinition.guidance,
    outputFormat,
    outputLanguage,
    personalizationBlock,
    effectivePromptRichness,
    noContextPromptBlock,
    plannerResult ? buildProposalWriterPlanBlock(plannerResult, outputFormat) : "",
  );
  const enrichedJobDescription = appendOptionalPromptBlock(
    args.jobDescription,
    candidateGuidanceBlock,
  );
  const expertiseFromProfile =
    effectivePersonalization?.topSkills &&
    effectivePersonalization.topSkills.length > 0
      ? effectivePersonalization.topSkills
      : [];
  const premiumCoverLetterFlagEnabled = isCoverLetterPremiumPathV1Enabled();
  const premiumCoverLetterWriterModel = resolvePremiumCoverLetterWriterModel();
  const premiumCoverLetterEligibility =
    requestedModelType === "chatgpt" && outputFormat === "cover_letter"
      ? evaluatePremiumCoverLetterEligibility({
          personalizationContext: effectivePersonalization,
          voicePreset: resolvedVoicePreset,
          jobTitle: effectiveJobTitle,
          jobDescription: args.jobDescription,
        })
      : null;
  const coverLetterPrimaryPathEligibility =
    evaluatePrimaryCoverLetterPathEligibility({
      modelType: requestedModelType,
      outputFormat,
      contextMode: plannerContextMode,
      sourceFactBank,
      personalizationContext: effectivePersonalization,
      voicePreset: resolvedVoicePreset,
      jobTitle: effectiveJobTitle,
      jobDescription: args.jobDescription,
    });
  const structuredRolloutEligibility =
    evaluateStructuredCoverLetterRolloutEligibility({
      modelType: requestedModelType,
      outputFormat,
      contextMode: plannerContextMode,
      sourceFactBank,
    });
  const shouldBypassPlannerForNoContextLegacyCoverLetter =
    outputFormat === "cover_letter" &&
    !structuredRolloutEligibility.eligible &&
    structuredRolloutEligibility.fallbackReason ===
      "missing_candidate_context";
  const shouldBypassPlannerForCvBackedLegacyCoverLetter =
    outputFormat === "cover_letter" &&
    hasCandidateContext &&
    structuredRolloutEligibility.eligible;
  const structuredCoverLetterEnabled = structuredRolloutEligibility.eligible;
  const structuredCoverLetterGateEnabled = isStructuredMistralCoverLetterEnabled({
    modelType: requestedModelType,
    outputFormat,
  });
  const normalizedSourceJobDescription = compactWhitespace(args.jobDescription);
  const proposalMetadataBase = {
    platform: "web",
    ...(normalizedSourceJobDescription
      ? { sourceJobDescription: args.jobDescription }
      : {}),
    voicePreset: resolvedVoicePreset,
    formalityLevel: effectiveTone.formalityLevel,
    creativity: effectiveTone.creativity,
    proposalType: outputFormat,
  };
  let residualVerifierWarningTag: string | null = null;
  let proposalContent: string;
  let structuredPersistencePayload: StructuredCoverLetterAttemptResult | null =
    null;
  let premiumPersistencePayload:
    | {
        content: string;
        sections: Array<{
          type: "text";
          content: string;
        }>;
      }
    | null = null;
  let actualModelType: ProposalModelType = requestedModelType;
  let hasAttemptedFallback = false;
  let usedFallback = false;
  let fallbackTriggerCode: ProposalFallbackTriggerCode | null = null;
  let attemptedGenerationPath: ProposalGenerationPathLabel =
    outputFormat === "application_message"
      ? "application-message inline path"
      : shouldBypassPlannerForCvBackedLegacyCoverLetter
      ? "legacy-only path after planner bypass"
      : requestedModelType === "chatgpt" &&
          outputFormat === "cover_letter" &&
          coverLetterPrimaryPathEligibility.eligible
        ? "premium fail-closed to legacy fallback"
      : "legacy-only path";
  const routingTrace: ProposalRoutingTrace = {
    plannedPath: coverLetterPrimaryPathEligibility.plannedPath,
    executedPath: "legacy",
    fallbackReason: shouldBypassPlannerForCvBackedLegacyCoverLetter
      ? "planner_dependency_bypassed"
      : coverLetterPrimaryPathEligibility.fallbackReason,
    validatorOutcome: "not_run",
    saveOutcome: "not_saved",
  };
  let routingFailureStage: CoverLetterTelemetryFailureStage | null = null;
  let routingNormalizedFailureCode: string | null = null;
  let coverLetterRoutingTelemetryLogged = false;
  const mistralDiagnostics = createMistralDiagnosticsAccumulator();
  const getExecutionProvenance = (): ProposalExecutionProvenance => ({
    requestedModelType,
    actualModelType,
    fallbackTriggerCode,
  });
  let mistralDiagnosticsLogged = false;
  const emitMistralDiagnosticsSummary = (
    outcome: "success" | "failure",
  ): void => {
    if (
      mistralDiagnosticsLogged ||
      (!isMistralModel(requestedModelType) && mistralDiagnostics.calls.length === 0)
    ) {
      return;
    }
    mistralDiagnosticsLogged = true;
    console.info("Proposal Mistral diagnostics", {
      outcome,
      fallbackTriggered: usedFallback,
      requestedModelType,
      actualModelType,
      fallbackTriggerCode,
      ...summarizeMistralDiagnostics(mistralDiagnostics),
    });
  };
  const emitCoverLetterRoutingTelemetry = (
    finalOutcome: ProposalSaveOutcome = routingTrace.saveOutcome,
    failureStage: CoverLetterTelemetryFailureStage | null = routingFailureStage,
  ): void => {
    if (outputFormat !== "cover_letter" || coverLetterRoutingTelemetryLogged) {
      return;
    }

    logCoverLetterRoutingTelemetry(
      buildCoverLetterRoutingTelemetry({
        preset: resolvedVoicePreset,
        modelType: requestedModelType,
        outputFormat,
        contextMode: plannerContextMode,
        sourceFactBank,
        structuredEligible: coverLetterPrimaryPathEligibility.eligible,
        structuredEligibilityFallbackReason:
          coverLetterPrimaryPathEligibility.fallbackReason,
        fallbackReason: routingTrace.fallbackReason,
        attemptedPath: attemptedGenerationPath,
        finalOutcome,
        failureStage,
        normalizedFailureCode: routingNormalizedFailureCode,
        requestedModelType,
        actualModelType,
        fallbackTriggerCode,
        usedFallback,
      }),
    );
    coverLetterRoutingTelemetryLogged = true;
  };
  const markProviderBusyFailure = (): void => {
    routingTrace.fallbackReason = "provider_busy";
    if (
      outputFormat === "cover_letter" &&
      structuredRolloutEligibility.eligible &&
      !shouldBypassPlannerForCvBackedLegacyCoverLetter
    ) {
      attemptedGenerationPath = "structured fail-closed to legacy fallback";
      if (routingTrace.validatorOutcome === "not_run") {
        routingTrace.validatorOutcome = "structured_failed";
      }
    }
  };

  let proposalId: string;
  let lastFinalizationTraceArgs:
    | Omit<ProposalFinalizationTraceCaptureArgs, "attemptedPath">
    | null = null;

  // Development stub: when DEV_STUB env var is set, return a placeholder proposal
  // This allows frontend testing without LLM API keys.
  if (process.env.DEV_STUB === "true") {
    proposalContent = `DEV STUB PROPOSAL for "${effectiveJobTitle}"\n\nJob description:\n${args.jobDescription}\n\n---\nThis is a development placeholder proposal generated because DEV_STUB=true. Replace with a real LLM response in production.`;
    routingTrace.executedPath = "legacy";
    routingTrace.saveOutcome = "legacy_saved_raw";
    proposalId = await ctx.runMutation(internal.proposals.storeProposal, {
      userId: userProfile._id,
      title: defaultStoredTitle,
      content: proposalContent,
      status: "pending",
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sections: [{ type: "text", content: proposalContent }],
      metrics: {},
      metadata: buildProposalRoutingMetadata({
        base: proposalMetadataBase,
        jobId: "DEV_STUB",
        routing: routingTrace,
        tags: [`model:dev_stub`],
        provenance: getExecutionProvenance(),
      }),
    });
    emitCoverLetterRoutingTelemetry();
    emitMistralDiagnosticsSummary("success");
    return { proposalId, proposalContent, ...getExecutionProvenance() };
  }

  while (true) {
    structuredPersistencePayload = null;
    premiumPersistencePayload = null;
    residualVerifierWarningTag = null;
    try {
      if (actualModelType === "chatgpt") {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new ConvexError("OpenAI API key is not configured");
        }

        if (outputFormat === "cover_letter") {
          console.info("Premium cover letter runtime check", {
            requestedModelType,
            actualModelType,
            premiumFlagEnabled: premiumCoverLetterFlagEnabled,
            premiumWriterModel: premiumCoverLetterWriterModel,
            premiumEligibilityResult:
              premiumCoverLetterEligibility ?? "not_evaluated",
            enteringPremiumAttempt:
              requestedModelType === "chatgpt" &&
              coverLetterPrimaryPathEligibility.eligible,
          });
        }

        if (
          requestedModelType === "chatgpt" &&
          outputFormat === "cover_letter" &&
          coverLetterPrimaryPathEligibility.eligible
        ) {
          try {
            premiumPersistencePayload =
              await attemptPremiumCoverLetterGeneration({
                personalizationContext: effectivePersonalization,
                voicePreset: resolvedVoicePreset,
                outputLanguage,
                jobTitle: effectiveJobTitle,
                jobDescription: args.jobDescription,
                candidateName,
                writer: ({ prompt }) =>
                  generatePremiumCoverLetterBodyPartsWithOpenAI({
                    apiKey,
                    prompt,
                  }),
              });
          } catch (premiumError) {
            console.warn(
              "Premium cover letter path v1 failed; falling back to legacy ChatGPT cover-letter generation.",
              premiumError,
            );
            premiumPersistencePayload = null;
          }

          if (premiumPersistencePayload) {
            attemptedGenerationPath = "premium success";
            routingTrace.executedPath = "structured";
            routingTrace.fallbackReason = "not_applicable";
            routingTrace.validatorOutcome = "structured_success";
          } else {
            attemptedGenerationPath = "premium fail-closed to legacy fallback";
            routingTrace.fallbackReason = "premium_generation_failed";
            if (routingTrace.validatorOutcome === "not_run") {
              routingTrace.validatorOutcome = "structured_failed";
            }
          }
        }

        if (premiumPersistencePayload) {
          proposalContent = premiumPersistencePayload.content;
        } else {
          const proposalService = new ProposalService({
            apiKey,
            modelName: "chatgpt",
          });
          const gpt4Adapter = new GPT4Adapter({ apiKey });

          if (outputFormat === "freelance_proposal") {
            const tokenLimit = 3000;
            let jobDescription = enrichedJobDescription;
            const estimatedTokens = gpt4Adapter.estimateTokens(jobDescription);

            if (estimatedTokens > tokenLimit) {
              jobDescription = jobDescription.slice(
                0,
                Math.floor((jobDescription.length * tokenLimit) / estimatedTokens),
              );
              console.warn(
                `Job description truncated due to token limit. Original tokens: ${estimatedTokens}, New length: ${jobDescription.length}`,
              );
            }

            const proposal = await proposalService.generateTechnicalProposal({
              jobTitle: effectiveJobTitle,
              jobDescription: jobDescription,
              requirements: expertiseFromProfile,
              expertise: expertiseFromProfile,
              tone: "technical",
              formalityLevel: effectiveTone.formalityLevel,
              creativity: effectiveTone.creativity,
            });
            proposalContent = proposal.content;
          } else if (outputFormat === "application_message") {
            proposalContent = await gpt4Adapter.generate(prompt, {});
          } else {
            const proposal = await proposalService.generateCreativeProposal({
              jobTitle: effectiveJobTitle,
              jobDescription: enrichedJobDescription,
              creativeDirection: effectivePersonalization?.desiredPosition ?? "",
            });
            proposalContent = proposal.content;
          }
        }
      } else if (
      actualModelType === "mistral-large-latest" ||
      actualModelType === "mistral-small-latest"
    ) {
      const mistralKey = process.env.MISTRAL_API_KEY;
      if (!mistralKey) {
        throw new ConvexError("Mistral API key is not configured");
      }
      if (
        !shouldBypassPlannerForNoContextLegacyCoverLetter &&
        !shouldBypassPlannerForCvBackedLegacyCoverLetter
      ) {
        try {
          plannerResult = normalizeProposalPlannerResult({
            rawPlan: await buildStructuredProposalPlan({
              mistralKey,
              modelType: actualModelType,
              prompt: plannerPrompt,
              diagnostics: mistralDiagnostics,
            }),
            voicePreset: resolvedVoicePreset,
            contextMode: plannerContextMode,
            sourceFactBank,
            outputLanguage: plannerOutputLanguage,
            jobTitle: effectiveJobTitle,
            jobDescription: args.jobDescription,
          });
          prompt = buildInlineMistralPrompt(
            {
              ...args,
              jobTitle: effectiveJobTitle,
            },
            effectiveTone,
            voicePresetDefinition.guidance,
            outputFormat,
            outputLanguage,
            personalizationBlock,
            effectivePromptRichness,
            noContextPromptBlock,
            buildProposalWriterPlanBlock(plannerResult, outputFormat),
          );
        } catch (plannerError) {
          if (isProposalProviderBusyError(plannerError)) {
            markProviderBusyFailure();
            throw plannerError;
          }
          console.warn("Proposal planner failed; continuing with base prompt:", plannerError);
          if (structuredCoverLetterEnabled) {
            attemptedGenerationPath =
              "structured fail-closed to legacy fallback";
            routingTrace.fallbackReason = "structured_plan_parse_fail";
            routingTrace.validatorOutcome = "structured_failed";
          }
        }
      }
      const model = new ChatMistralAI({
        apiKey: mistralKey,
        modelName: actualModelType,
      });
      let structuredFallbackReason: StructuredCoverLetterFallbackReason | null =
        null;
      if (!shouldBypassPlannerForCvBackedLegacyCoverLetter) {
        try {
          structuredPersistencePayload =
            await attemptStructuredCoverLetterGeneration(
              {
                gateEnabled: structuredCoverLetterEnabled,
                mistralKey,
                modelType: actualModelType,
                plannerResult,
                outputFormat,
                outputLanguage,
                candidateName,
                voicePreset: resolvedVoicePreset,
                jobTitle: effectiveJobTitle,
                jobDescription: args.jobDescription,
                diagnostics: mistralDiagnostics,
              },
              {
                onFallbackReason: (reason) => {
                  structuredFallbackReason = reason;
                },
              },
            );
        } catch (error) {
          if (isProposalProviderBusyError(error)) {
            markProviderBusyFailure();
          }
          throw error;
        }
      }

      if (structuredPersistencePayload) {
        attemptedGenerationPath =
          structuredPersistencePayload.generationPath === "structured_repaired_success"
            ? "structured repaired success"
            : "structured success";
        routingTrace.executedPath = "structured";
        routingTrace.fallbackReason = "not_applicable";
        routingTrace.validatorOutcome =
          structuredPersistencePayload.generationPath ===
          "structured_repaired_success"
            ? "structured_repaired_success"
            : "structured_success";
        proposalContent = structuredPersistencePayload.content;
        residualVerifierWarningTag =
          structuredPersistencePayload.residualVerifierWarningTag;
      } else {
        if (shouldBypassPlannerForCvBackedLegacyCoverLetter) {
          attemptedGenerationPath = "legacy-only path after planner bypass";
          routingTrace.fallbackReason = "planner_dependency_bypassed";
        } else if (
          outputFormat === "cover_letter" &&
          structuredCoverLetterEnabled
        ) {
          attemptedGenerationPath =
            "structured fail-closed to legacy fallback";
          routingTrace.fallbackReason =
            structuredFallbackReason ?? routingTrace.fallbackReason;
          if (routingTrace.validatorOutcome === "not_run") {
            routingTrace.validatorOutcome = "structured_failed";
          }
        } else if (
          outputFormat === "cover_letter" &&
          structuredCoverLetterGateEnabled &&
          routingTrace.fallbackReason === "not_applicable"
        ) {
          routingTrace.fallbackReason = structuredRolloutEligibility.fallbackReason;
        }
        routingTrace.executedPath = "legacy";
        assertStructuredCoverLetterRoutingConsistency({
          plannedPath: routingTrace.plannedPath,
          executedPath: routingTrace.executedPath,
          attemptedGenerationPath,
          fallbackReason: routingTrace.fallbackReason,
        });
        let response;
        try {
          response = await model.invoke([new HumanMessage(prompt)]);
        } catch (error) {
          recordMistralDiagnosticFailure({
            diagnostics: mistralDiagnostics,
            stage: "legacy_generation",
            modelType: actualModelType,
            inputText: prompt,
            error,
          });
          const providerBusyError = getMistralProviderBusyError(
            error,
            "legacy_generation",
          );
          if (providerBusyError) {
            markProviderBusyFailure();
            throw providerBusyError;
          }
          const providerTransportError = getMistralProviderTransportError(
            error,
            "legacy_generation",
          );
          if (providerTransportError) {
            throw providerTransportError;
          }
          throw error;
        }
        proposalContent =
          extractTextFromChatMessageContent(response.content) ?? "";
        recordMistralDiagnosticCall({
          diagnostics: mistralDiagnostics,
          stage: "legacy_generation",
          modelType: actualModelType,
          inputText: prompt,
          outputText: proposalContent,
          status: "success",
        });

        if (plannerResult) {
          lastFinalizationTraceArgs = {
            content: proposalContent,
            format: outputFormat,
            outputLanguage,
            candidateName,
            voicePreset: resolvedVoicePreset,
            noContextMode: plannerResult.context_mode === "none",
          };
          let verifiedContent = finalizeProposalForSave({
            content: proposalContent,
            format: outputFormat,
            outputLanguage,
            candidateName,
            voicePreset: resolvedVoicePreset,
            noContextMode: plannerResult.context_mode === "none",
          });
          let verificationResult = analyzeProposalDraft({
            content: verifiedContent,
            plan: plannerResult,
            format: outputFormat,
            outputLanguage,
            candidateName,
            jobTitle: effectiveJobTitle,
            jobDescription: args.jobDescription,
          });
          let verificationIssues = verificationResult.issues;

          if (
            verificationIssues.length > 0 &&
            verificationResult.flaggedSentences.length > 0
          ) {
            const repairedDraft = await repairProposalDraftBySentence({
              mistralKey,
              modelType: actualModelType,
              content: verifiedContent,
              plan: plannerResult,
              format: outputFormat,
              outputLanguage,
              candidateName,
              flaggedSentences: verificationResult.flaggedSentences,
              diagnostics: mistralDiagnostics,
            });

            lastFinalizationTraceArgs = {
              content: repairedDraft,
              format: outputFormat,
              outputLanguage,
              candidateName,
              voicePreset: resolvedVoicePreset,
              noContextMode: plannerResult.context_mode === "none",
            };
            verifiedContent = finalizeProposalForSave({
              content: repairedDraft,
              format: outputFormat,
              outputLanguage,
              candidateName,
              voicePreset: resolvedVoicePreset,
              noContextMode: plannerResult.context_mode === "none",
            });
            verificationResult = analyzeProposalDraft({
              content: verifiedContent,
              plan: plannerResult,
              format: outputFormat,
              outputLanguage,
              candidateName,
              jobTitle: effectiveJobTitle,
              jobDescription: args.jobDescription,
            });
            verificationIssues = verificationResult.issues;
          }

          if (verificationIssues.length > 0) {
            residualVerifierWarningTag = "warning:verifier_post_repair";
            routingTrace.validatorOutcome = "legacy_verified_warning";
            console.warn(
              "Generated proposal still has verifier findings after repair; saving repaired draft without hard-fail.",
              {
                jobTitle: effectiveJobTitle,
                modelType: actualModelType,
                issueCodes: verificationIssues.map((issue) => issue.code),
                issueMessages: verificationIssues.map(
                  (issue) => issue.message,
                ),
              },
            );
          } else {
            routingTrace.validatorOutcome = "legacy_verified_clean";
          }

          proposalContent = verifiedContent;
        }
      }
    } else if (actualModelType === "mistral-agent") {
      const mistralKey = process.env.MISTRAL_API_KEY;
      if (!mistralKey) {
        throw new ConvexError("Mistral API key is not configured");
      }
      const mistralAgentId = process.env.MISTRAL_AGENT_ID;
      if (!mistralAgentId) {
        throw new ConvexError("Mistral agent ID is not configured");
      }
      const client = new Mistral({ apiKey: mistralKey });
      const agentPrompt = prompt;
      let agentResponse;
      try {
        agentResponse = await client.agents.complete({
          agentId: mistralAgentId,
          messages: [{ role: "user", content: agentPrompt }],
        });
      } catch (error) {
        recordMistralDiagnosticCall({
          diagnostics: mistralDiagnostics,
          stage: "agent_generation",
          modelType: actualModelType,
          inputText: agentPrompt,
          status: "failed_other",
        });
        throw error;
      }
      if (
        !agentResponse.choices ||
        agentResponse.choices.length === 0 ||
        typeof agentResponse.choices[0].message.content !== "string"
      ) {
        recordMistralDiagnosticCall({
          diagnostics: mistralDiagnostics,
          stage: "agent_generation",
          modelType: actualModelType,
          inputText: agentPrompt,
          status: "failed_other",
        });
        throw new ConvexError("Invalid or empty response from Mistral agent");
      }
      proposalContent = agentResponse.choices[0].message.content;
      recordMistralDiagnosticCall({
        diagnostics: mistralDiagnostics,
        stage: "agent_generation",
        modelType: actualModelType,
        inputText: agentPrompt,
        outputText: proposalContent,
        status: "success",
      });
    } else {
      throw new ConvexError("Invalid model type selected");
    }

      if (structuredPersistencePayload) {
        routingTrace.saveOutcome = "structured_saved";
        proposalId = await ctx.runMutation(internal.proposals.storeProposal, {
          userId: userProfile._id,
          title: defaultStoredTitle,
          content: structuredPersistencePayload.content,
          status: "pending",
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sections: structuredPersistencePayload.sections,
          metrics: {},
          metadata: buildProposalRoutingMetadata({
            base: proposalMetadataBase,
            jobId: "N/A",
            routing: routingTrace,
            provenance: getExecutionProvenance(),
            tags: [
              `model:${actualModelType}`,
              "structured_cover_letter",
              toGenerationPathTag(attemptedGenerationPath),
              ...(residualVerifierWarningTag
                ? [residualVerifierWarningTag]
                : []),
            ],
          }),
        });

        emitCoverLetterRoutingTelemetry();
        emitMistralDiagnosticsSummary("success");
        return { proposalId, proposalContent, ...getExecutionProvenance() };
      }

      if (premiumPersistencePayload) {
        routingTrace.executedPath = "structured";
        routingTrace.fallbackReason = "not_applicable";
        if (routingTrace.validatorOutcome === "not_run") {
          routingTrace.validatorOutcome = "structured_success";
        }
        routingTrace.saveOutcome = "structured_saved";
        proposalId = await ctx.runMutation(internal.proposals.storeProposal, {
          userId: userProfile._id,
          title: defaultStoredTitle,
          content: premiumPersistencePayload.content,
          status: "pending",
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sections: premiumPersistencePayload.sections,
          metrics: {},
          metadata: buildProposalRoutingMetadata({
            base: proposalMetadataBase,
            jobId: "N/A",
            routing: routingTrace,
            provenance: getExecutionProvenance(),
            tags: [
              `model:${actualModelType}`,
              "premium_cover_letter_path_v1",
              "feature_flag:cover_letter_premium_path_v1",
              toGenerationPathTag(attemptedGenerationPath),
            ],
          }),
        });

        emitCoverLetterRoutingTelemetry();
        emitMistralDiagnosticsSummary("success");
        return { proposalId, proposalContent, ...getExecutionProvenance() };
      }

    const noContextPersistenceMode =
      plannerResult?.context_mode === "none" || plannerContextMode === "none";
    lastFinalizationTraceArgs = {
      content: proposalContent,
      format: outputFormat,
      outputLanguage,
      candidateName,
      voicePreset: resolvedVoicePreset,
      noContextMode: noContextPersistenceMode,
    };
    proposalContent = finalizeProposalForPersistence({
      content: proposalContent,
      format: outputFormat,
      outputLanguage,
      candidateName,
      voicePreset: resolvedVoicePreset,
      noContextMode: noContextPersistenceMode,
    });

    // Attempt a tolerant post-processing step: parse plain-text LLM output
    // into the structured Proposal schema. Only parse failures should fall
    // back to raw persistence; storage failures must surface as persistence
    // failures instead of retrying the same invalid payload unchanged.
    let parsed:
      | Awaited<ReturnType<typeof parseProposalContent>>
      | null = null;
    try {
      parsed = await parseProposalContent(proposalContent);
      if (!parsed?.content) {
        throw new Error("Parsed proposal missing content");
      }
    } catch (parseErr) {
      console.warn("Tolerant parse failed, using raw content:", parseErr);
    }

    if (parsed?.content) {
      // Use parsed content and sections when available.
      proposalContent = parsed.content;

      // Normalize sections to the expected literal union type for Convex.
      const sectionsForDb: {
        type: "text" | "code" | "image";
        content: string;
      }[] = (parsed.sections ?? []).map((s: any) => ({
        type: "text" as const,
        content: String(s.content ?? ""),
      }));

      // Normalize metrics to the small metrics shape used by the DB.
      // We map `duration` -> `score` and `success` -> `confidence` (heuristic).
      const metricsForDb: { score?: number; confidence?: number } = {};
      if (parsed.metrics) {
        if (typeof (parsed.metrics as any).duration === "number") {
          metricsForDb.score = (parsed.metrics as any).duration;
        }
        if (typeof (parsed.metrics as any).success === "boolean") {
          metricsForDb.confidence = (parsed.metrics as any).success ? 1 : 0;
        }
      }

      routingTrace.saveOutcome = "legacy_saved_parsed";
      try {
        proposalId = await ctx.runMutation(internal.proposals.storeProposal, {
          userId: userProfile._id,
          title: resolveStoredProposalTitle({
            jobTitle: effectiveJobTitle,
            parsedTitle: parsed.title,
            format: outputFormat,
          }),
          content: proposalContent,
          status: "pending",
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sections:
            sectionsForDb.length > 0
              ? sectionsForDb
              : [{ type: "text", content: proposalContent }],
          metrics: metricsForDb,
          metadata: buildProposalRoutingMetadata({
            base: proposalMetadataBase,
            jobId: "N/A",
            routing: routingTrace,
            provenance: getExecutionProvenance(),
            tags: [
              `model:${actualModelType}`,
              "parsed",
              toGenerationPathTag(attemptedGenerationPath),
              ...(residualVerifierWarningTag
                ? [residualVerifierWarningTag]
                : []),
            ],
          }),
        });
      } catch (persistenceErr) {
        console.error(
          "Parsed proposal persistence failed:",
          persistenceErr,
        );
        throw persistenceErr;
      }
    } else {
      routingTrace.saveOutcome = "legacy_saved_raw";
      try {
        proposalId = await ctx.runMutation(internal.proposals.storeProposal, {
          userId: userProfile._id,
          title: defaultStoredTitle,
          content: proposalContent,
          status: "pending",
          version: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sections: [{ type: "text", content: proposalContent }],
          metrics: {},
          metadata: buildProposalRoutingMetadata({
            base: proposalMetadataBase,
            jobId: "N/A",
            routing: routingTrace,
            provenance: getExecutionProvenance(),
            tags: [
              `model:${actualModelType}`,
              toGenerationPathTag(attemptedGenerationPath),
              ...(residualVerifierWarningTag
                ? [residualVerifierWarningTag]
                : []),
            ],
          }),
        });
      } catch (persistenceErr) {
        console.error("Raw proposal persistence failed:", persistenceErr);
        throw persistenceErr;
      }
    }

    emitCoverLetterRoutingTelemetry();
    emitMistralDiagnosticsSummary("success");
    return { proposalId, proposalContent, ...getExecutionProvenance() };
  } catch (error: any) {
    if (isProposalProviderBusyError(error)) {
      markProviderBusyFailure();
      routingFailureStage = error.stage;
      routingNormalizedFailureCode = CONTROLLED_PROPOSAL_PROVIDER_BUSY_CODE;
      if (
        canAttemptProposalFallback({
          requestedModelType,
          outputFormat,
          normalizedFailureCode: routingNormalizedFailureCode,
          failureStage: routingFailureStage,
          hasAttemptedFallback,
        })
      ) {
        fallbackTriggerCode = routingNormalizedFailureCode;
        usedFallback = true;
        hasAttemptedFallback = true;
        logProposalFallbackActivation({
          requestedModelType,
          fallbackModelType: "chatgpt",
          triggerCode: routingNormalizedFailureCode,
          triggerStage: routingFailureStage,
          hasCv: plannerContextMode !== "none",
          attemptedPath: attemptedGenerationPath,
        });
        actualModelType = "chatgpt";
        routingNormalizedFailureCode = null;
        continue;
      }
      emitCoverLetterRoutingTelemetry("not_saved", routingFailureStage);
      emitMistralDiagnosticsSummary("failure");
      throw coerceProposalProviderBusyToConvexError(error);
    }
    if (isProposalProviderTransportError(error)) {
      routingFailureStage = error.stage;
      routingNormalizedFailureCode =
        CONTROLLED_PROPOSAL_PROVIDER_TRANSPORT_ERROR_CODE;
      if (
        canAttemptProposalFallback({
          requestedModelType,
          outputFormat,
          normalizedFailureCode: routingNormalizedFailureCode,
          failureStage: routingFailureStage,
          hasAttemptedFallback,
        })
      ) {
        fallbackTriggerCode = routingNormalizedFailureCode;
        usedFallback = true;
        hasAttemptedFallback = true;
        logProposalFallbackActivation({
          requestedModelType,
          fallbackModelType: "chatgpt",
          triggerCode: routingNormalizedFailureCode,
          triggerStage: routingFailureStage,
          hasCv: plannerContextMode !== "none",
          attemptedPath: attemptedGenerationPath,
        });
        actualModelType = "chatgpt";
        routingNormalizedFailureCode = null;
        continue;
      }
      emitCoverLetterRoutingTelemetry("not_saved", routingFailureStage);
      emitMistralDiagnosticsSummary("failure");
      throw coerceProposalProviderTransportToConvexError(error);
    }
    if (error?.name === "ProposalFinalizationError") {
      routingTrace.saveOutcome = "fail_closed";
      routingNormalizedFailureCode =
        CONTROLLED_PROPOSAL_FINALIZATION_FAILURE_TELEMETRY_CODE;
      if (lastFinalizationTraceArgs) {
        const trace = logProposalFinalizationTrace({
          ...lastFinalizationTraceArgs,
          attemptedPath: attemptedGenerationPath,
        });
        routingFailureStage = trace.failureStage ?? null;
      }
      emitCoverLetterRoutingTelemetry("fail_closed");
      throw coerceProposalFinalizationFailureToConvexError({
        error,
        attemptedPath: attemptedGenerationPath,
      });
    }
    if (error.name === "ProposalParsingError" && error.rawContent) {
      console.warn("Using raw content due to parsing error:", error.message);
      try {
        lastFinalizationTraceArgs = {
          content: error.rawContent,
          format: outputFormat,
          outputLanguage,
          candidateName,
          voicePreset: resolvedVoicePreset,
          noContextMode:
            plannerResult?.context_mode === "none" ||
            plannerContextMode === "none",
        };
        proposalContent = finalizeProposalForPersistence({
          content: error.rawContent,
          format: outputFormat,
          outputLanguage,
          candidateName,
          voicePreset: resolvedVoicePreset,
          noContextMode:
            plannerResult?.context_mode === "none" ||
            plannerContextMode === "none",
        });
      } catch (finalizationError: any) {
        if (finalizationError?.name === "ProposalFinalizationError") {
          routingTrace.saveOutcome = "fail_closed";
          routingNormalizedFailureCode =
            CONTROLLED_PROPOSAL_FINALIZATION_FAILURE_TELEMETRY_CODE;
          if (lastFinalizationTraceArgs) {
            const trace = logProposalFinalizationTrace({
              ...lastFinalizationTraceArgs,
              attemptedPath: attemptedGenerationPath,
            });
            routingFailureStage = trace.failureStage ?? null;
          }
          emitCoverLetterRoutingTelemetry("fail_closed");
          throw coerceProposalFinalizationFailureToConvexError({
            error: finalizationError,
            attemptedPath: attemptedGenerationPath,
          });
        }
        throw finalizationError;
      }

      routingTrace.saveOutcome = "legacy_saved_after_parse_error";
      proposalId = await ctx.runMutation(internal.proposals.storeProposal, {
        userId: userProfile._id,
        title: defaultStoredTitle,
        content: proposalContent,
        status: "pending",
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sections: [{ type: "text", content: proposalContent }],
        metrics: {},
        metadata: buildProposalRoutingMetadata({
          base: proposalMetadataBase,
          jobId: "N/A",
          routing: routingTrace,
          provenance: getExecutionProvenance(),
          tags: [
            `model:${actualModelType}`,
            "parsing_error",
            toGenerationPathTag(attemptedGenerationPath),
            ...(residualVerifierWarningTag ? [residualVerifierWarningTag] : []),
          ],
        }),
      });

      emitCoverLetterRoutingTelemetry();
      emitMistralDiagnosticsSummary("success");
      return { proposalId, proposalContent, ...getExecutionProvenance() };
    }
    emitCoverLetterRoutingTelemetry("not_saved");
    emitMistralDiagnosticsSummary("failure");
    throw error;
  }
}
}

export default action({
  args: generateProposalArgs,
  handler: handleGenerateProposal,
});
