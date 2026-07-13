import { finalizePremiumCoverLetterPayloadForPersistence } from "../../convex/generateProposalMutation";
import { buildStableHash } from "../../src/modules/application-harness/fingerprints";
import {
  PROPOSAL_GENERATION_QUALITY_MODES,
  type ProposalGenerationQualityMode,
} from "../../convex/lib/proposals/proposalQualityMode";

type PremiumFinalizerArgs = Parameters<
  typeof finalizePremiumCoverLetterPayloadForPersistence
>[0];
type PremiumFinalizerPayload = PremiumFinalizerArgs["payload"];
type PremiumFinalizerResult = ReturnType<
  typeof finalizePremiumCoverLetterPayloadForPersistence
>;
type FinalProvenance = NonNullable<PremiumFinalizerResult["finalProvenance"]>;
type QualityShadow = NonNullable<PremiumFinalizerPayload["qualityShadow"]>;
type QualityRepair = NonNullable<PremiumFinalizerPayload["qualityRepair"]>;
type FinalizationTrace = NonNullable<PremiumFinalizerArgs["debugTrace"]>;

const ARTIFACT_HASH_NAMESPACE = "cover-letter-eval-artifact";
const PROVENANCE_HASH_NAMESPACE = "cover-letter-eval-provenance";
const VERSION_TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const SYNTHETIC_CASE_ID_RE = /^[a-z0-9][a-z0-9._-]{0,95}$/u;
const SHA_256_HEX_RE = /^[a-f0-9]{64}$/u;
const CONFIG_VERSION_KEYS = [
  "generationControls",
  "companyValues",
  "writerSchema",
  "cancellation",
  "finalizer",
] as const;
const PROVENANCE_SECTION_ORDER = [
  "opening",
  "proofBlock",
  "employerValueBlock",
  "closeLine",
] as const;

export const COVER_LETTER_EVAL_HASH_CONTRACT = Object.freeze({
  version: "cover_letter_eval_hash_v1",
  algorithm: "sha-256",
  unicodeNormalization: "none",
  lineEndings: "preserve",
  encoding: "utf-8",
  serialization: "stableSerialize_v1",
} as const);

export const COVER_LETTER_EVAL_CONTRACT_VERSIONS = Object.freeze({
  artifact: "cover_letter_eval_artifact_v1",
  projection: "cover_letter_eval_finalizer_projection_v1",
  productionFinalizer:
    "finalize_premium_cover_letter_payload_for_persistence_v1",
} as const);

export type CoverLetterEvalConfigVersions = Readonly<{
  generationControls: string;
  companyValues: string;
  writerSchema: string;
  cancellation: string;
  finalizer: string;
}>;

export type CoverLetterEvalFrozenConfig = Readonly<{
  provider: "openai" | "mistral";
  model: string;
  outputLanguage: PremiumFinalizerArgs["outputLanguage"];
  preset: PremiumFinalizerArgs["voicePreset"];
  proposalQualityMode: ProposalGenerationQualityMode;
  hasCandidateContext: boolean;
  providerMaxRetries: number;
  writerMaxOutputTokens: number;
  promptV2: boolean;
  qualityRepair: boolean;
  reasoningEffort: string;
  generationControlsHash: string;
  companyValuesHash: string;
  writerSchemaHash: string;
}>;

type QualityShadowProjection = Readonly<{
  passed: boolean;
  score: number;
  issueClasses: readonly string[];
}>;

type QualityRepairProjection = Readonly<{
  enabled: boolean;
  eligible: boolean;
  attempted: boolean;
  outcome: string;
  rejectionCategory: string | null;
  finalProvenanceStatus: string | null;
  verifiedCandidateFactCount: number | null;
  qualityBefore: QualityShadowProjection;
  qualityAfter: QualityShadowProjection | null;
}>;

export type CoverLetterEvalArtifactProjection = Readonly<{
  kind: "cover_letter_eval_artifact";
  version: 1;
  dataClass: "synthetic_fixture";
  caseId: string;
  decision: "accepted" | "rejected";
  finalContent: string | null;
  sections: readonly Readonly<{ type: "text"; content: string }>[];
  provenance: FinalProvenance | null;
  provenanceHash: string | null;
  diagnostics: Readonly<{
    finalization: Readonly<{
      acceptanceMode: string;
      errorClass:
        | "none"
        | "proposal_finalization_error"
        | "error"
        | "unknown_error";
      failureStage: string | null;
      selectedBodyCandidate: string | null;
      substantiveBodyPassed: boolean | null;
      removedBridgeSentenceCount: number;
      removedLastGroundedSentence: boolean;
    }>;
    qualityShadow: QualityShadowProjection | null;
    qualityRepair: QualityRepairProjection | null;
  }>;
  configVersions: CoverLetterEvalConfigVersions;
  frozenConfig: CoverLetterEvalFrozenConfig;
  contractVersions: typeof COVER_LETTER_EVAL_CONTRACT_VERSIONS;
  hashContract: typeof COVER_LETTER_EVAL_HASH_CONTRACT;
}>;

export type CoverLetterEvalArtifact = CoverLetterEvalArtifactProjection &
  Readonly<{ artifactHash: string }>;

export type PrepareCoverLetterEvalArtifactResult = Readonly<{
  artifact: CoverLetterEvalArtifact;
  finalizedPayload: PremiumFinalizerResult | null;
}>;

export type PrepareCoverLetterEvalArtifactArgs = Readonly<{
  caseId: string;
  payload: PremiumFinalizerPayload;
  outputLanguage: PremiumFinalizerArgs["outputLanguage"];
  candidateName?: string;
  voicePreset: PremiumFinalizerArgs["voicePreset"];
  hasCandidateContext: boolean;
  configVersions: CoverLetterEvalConfigVersions;
  frozenConfig: CoverLetterEvalFrozenConfig;
}>;

export async function buildCoverLetterEvalArtifactHash(
  projection: CoverLetterEvalArtifactProjection,
): Promise<string> {
  return buildStableHash({
    namespace: ARTIFACT_HASH_NAMESPACE,
    type: "finalized-cover-letter",
    version: 1,
    artifact: projection,
  });
}

export async function prepareCoverLetterEvalArtifact(
  args: PrepareCoverLetterEvalArtifactArgs,
): Promise<PrepareCoverLetterEvalArtifactResult> {
  assertSyntheticCaseId(args.caseId);
  const configVersions = normalizeConfigVersions(args.configVersions);
  const frozenConfig = normalizeFrozenConfig({
    value: args.frozenConfig,
    outputLanguage: args.outputLanguage,
    voicePreset: args.voicePreset,
    hasCandidateContext: args.hasCandidateContext,
  });
  const trace = createFinalizationTrace(args.payload.content);

  let finalized: PremiumFinalizerResult | null = null;
  let errorClass: CoverLetterEvalArtifactProjection["diagnostics"]["finalization"]["errorClass"] =
    "none";

  try {
    finalized = finalizePremiumCoverLetterPayloadForPersistence({
      payload: args.payload,
      format: "cover_letter",
      outputLanguage: args.outputLanguage,
      candidateName: args.candidateName,
      voicePreset: args.voicePreset,
      hasCandidateContext: args.hasCandidateContext,
      debugTrace: trace,
    });
  } catch (error) {
    errorClass = classifyFinalizationError(error);
  }

  const diagnosticPayload = finalized ?? args.payload;
  const projection: CoverLetterEvalArtifactProjection = {
    kind: "cover_letter_eval_artifact",
    version: 1,
    dataClass: "synthetic_fixture",
    caseId: args.caseId,
    decision: finalized ? "accepted" : "rejected",
    finalContent: finalized?.content ?? null,
    sections: finalized
      ? finalized.sections.map((section) => ({
          type: section.type,
          content: section.content,
        }))
      : [],
    provenance: finalized?.finalProvenance
      ? cloneProvenance(finalized.finalProvenance)
      : null,
    provenanceHash: finalized?.finalProvenance
      ? await buildProvenanceHash(finalized.finalProvenance)
      : null,
    diagnostics: {
      finalization: projectFinalizationDiagnostics(trace, errorClass),
      qualityShadow: projectQualityShadow(diagnosticPayload.qualityShadow),
      qualityRepair: projectQualityRepair(diagnosticPayload.qualityRepair),
    },
    configVersions,
    frozenConfig,
    contractVersions: COVER_LETTER_EVAL_CONTRACT_VERSIONS,
    hashContract: COVER_LETTER_EVAL_HASH_CONTRACT,
  };

  return {
    artifact: {
      ...projection,
      artifactHash: await buildCoverLetterEvalArtifactHash(projection),
    },
    finalizedPayload: finalized,
  };
}

function createFinalizationTrace(content: string): FinalizationTrace {
  const emptyCandidate = () => ({
    candidate: "",
    saveableSentences: [],
    saveableSentenceCount: 0,
    groundedOperationalSentenceCount: 0,
    groundedSupportSentenceCount: 0,
    isSaveable: false,
  });

  return {
    acceptanceMode: "legacy_thin",
    rawGeneratedBody: content,
    cleanedBodySelection: {
      aggressive: emptyCandidate(),
      conservative: emptyCandidate(),
      selectedCandidate: null,
      selectedBody: null,
    },
  };
}

function projectFinalizationDiagnostics(
  trace: FinalizationTrace,
  errorClass: CoverLetterEvalArtifactProjection["diagnostics"]["finalization"]["errorClass"],
): CoverLetterEvalArtifactProjection["diagnostics"]["finalization"] {
  return {
    acceptanceMode: trace.acceptanceMode,
    errorClass,
    failureStage: trace.failureStage ?? null,
    selectedBodyCandidate: trace.cleanedBodySelection.selectedCandidate,
    substantiveBodyPassed: trace.substantiveBodyAssertion?.passed ?? null,
    removedBridgeSentenceCount:
      trace.finalSavedOutputBridgeCleanup?.removedSentenceTexts.length ?? 0,
    removedLastGroundedSentence:
      trace.finalSavedOutputBridgeCleanup?.removedLastGroundedSentence ?? false,
  };
}

function projectQualityShadow(
  qualityShadow: QualityShadow | undefined,
): QualityShadowProjection | null {
  if (!qualityShadow) return null;
  return {
    passed: qualityShadow.passed,
    score: qualityShadow.score,
    issueClasses: [...new Set(qualityShadow.issues)].sort(),
  };
}

function projectQualityRepair(
  qualityRepair: QualityRepair | undefined,
): QualityRepairProjection | null {
  if (!qualityRepair) return null;
  return {
    enabled: qualityRepair.enabled,
    eligible: qualityRepair.eligible,
    attempted: qualityRepair.attempted,
    outcome: qualityRepair.outcome,
    rejectionCategory: qualityRepair.rejectionCategory ?? null,
    finalProvenanceStatus: qualityRepair.finalProvenanceStatus ?? null,
    verifiedCandidateFactCount:
      qualityRepair.verifiedCandidateFactCount ?? null,
    qualityBefore: projectQualityShadow(qualityRepair.qualityBefore)!,
    qualityAfter: projectQualityShadow(qualityRepair.qualityAfter),
  };
}

async function buildProvenanceHash(
  provenance: FinalProvenance,
): Promise<string> {
  return buildStableHash({
    namespace: PROVENANCE_HASH_NAMESPACE,
    type: "finalized-premium-cover-letter-provenance",
    version: 1,
    provenance,
  });
}

function cloneProvenance(provenance: FinalProvenance): FinalProvenance {
  return {
    version: provenance.version,
    status: provenance.status,
    origin: provenance.origin,
    contextClass: provenance.contextClass,
    candidateFactIds: [...provenance.candidateFactIds],
    verifiedCandidateFactIds: [...provenance.verifiedCandidateFactIds],
    candidateFacts: provenance.candidateFacts.map((fact) => ({
      ...fact,
      metrics: [...fact.metrics],
      entities: [...fact.entities],
    })),
    sections: Object.fromEntries(
      PROVENANCE_SECTION_ORDER.map((section) => {
        const value = provenance.sections[section];
        return [
          section,
          {
            ...value,
            claimIds: [...value.claimIds],
            factIds: [...value.factIds],
            demandIds: [...value.demandIds],
            candidateFactIds: [...value.candidateFactIds],
            verifiedCandidateFactIds: [...value.verifiedCandidateFactIds],
          },
        ];
      }),
    ) as FinalProvenance["sections"],
  };
}

function classifyFinalizationError(
  error: unknown,
): CoverLetterEvalArtifactProjection["diagnostics"]["finalization"]["errorClass"] {
  if (!(error instanceof Error)) return "unknown_error";
  if (error.name === "ProposalFinalizationError") {
    return "proposal_finalization_error";
  }
  return "error";
}

function assertSyntheticCaseId(caseId: string): void {
  if (!SYNTHETIC_CASE_ID_RE.test(caseId)) {
    throw new TypeError(
      "Cover-letter eval artifact requires a bounded synthetic caseId",
    );
  }
}

function normalizeConfigVersions(
  value: CoverLetterEvalConfigVersions,
): CoverLetterEvalConfigVersions {
  if (!isPlainRecord(value)) {
    throw new TypeError("Cover-letter eval configVersions must be an object");
  }
  const keys = Object.keys(value).sort();
  const expectedKeys = [...CONFIG_VERSION_KEYS].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new TypeError(
      "Cover-letter eval configVersions must contain only version fields",
    );
  }

  const normalized = {} as Record<(typeof CONFIG_VERSION_KEYS)[number], string>;
  for (const key of CONFIG_VERSION_KEYS) {
    const version = value[key];
    if (!VERSION_TOKEN_RE.test(version)) {
      throw new TypeError(
        `Cover-letter eval config version ${key} must be a bounded version token`,
      );
    }
    normalized[key] = version;
  }
  return normalized;
}

function normalizeFrozenConfig(args: {
  value: CoverLetterEvalFrozenConfig;
  outputLanguage: PremiumFinalizerArgs["outputLanguage"];
  voicePreset: PremiumFinalizerArgs["voicePreset"];
  hasCandidateContext: boolean;
}): CoverLetterEvalFrozenConfig {
  const value = args.value;
  if (!isPlainRecord(value)) {
    throw new TypeError("Cover-letter eval frozenConfig must be an object");
  }
  const expectedKeys = [
    "provider",
    "model",
    "outputLanguage",
    "preset",
    "proposalQualityMode",
    "hasCandidateContext",
    "providerMaxRetries",
    "writerMaxOutputTokens",
    "promptV2",
    "qualityRepair",
    "reasoningEffort",
    "generationControlsHash",
    "companyValuesHash",
    "writerSchemaHash",
  ].sort();
  const keys = Object.keys(value).sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new TypeError(
      "Cover-letter eval frozenConfig must contain only frozen config fields",
    );
  }
  if (value.provider !== "openai" && value.provider !== "mistral") {
    throw new TypeError("Cover-letter eval frozenConfig provider is invalid");
  }
  if (!VERSION_TOKEN_RE.test(value.model)) {
    throw new TypeError("Cover-letter eval frozenConfig model is invalid");
  }
  if (value.outputLanguage !== args.outputLanguage) {
    throw new TypeError(
      "Cover-letter eval frozenConfig outputLanguage must match finalizer input",
    );
  }
  if (value.preset !== args.voicePreset) {
    throw new TypeError(
      "Cover-letter eval frozenConfig preset must match finalizer input",
    );
  }
  if (!PROPOSAL_GENERATION_QUALITY_MODES.includes(value.proposalQualityMode)) {
    throw new TypeError(
      "Cover-letter eval frozenConfig proposalQualityMode is invalid",
    );
  }
  if (value.hasCandidateContext !== args.hasCandidateContext) {
    throw new TypeError(
      "Cover-letter eval frozenConfig hasCandidateContext must match finalizer input",
    );
  }
  if (
    !Number.isInteger(value.providerMaxRetries) ||
    value.providerMaxRetries < 0
  ) {
    throw new TypeError(
      "Cover-letter eval frozenConfig providerMaxRetries must be a non-negative integer",
    );
  }
  if (
    !Number.isInteger(value.writerMaxOutputTokens) ||
    value.writerMaxOutputTokens <= 0
  ) {
    throw new TypeError(
      "Cover-letter eval frozenConfig writerMaxOutputTokens must be a positive integer",
    );
  }
  if (
    typeof value.promptV2 !== "boolean" ||
    typeof value.qualityRepair !== "boolean"
  ) {
    throw new TypeError(
      "Cover-letter eval frozenConfig feature flags must be boolean",
    );
  }
  if (!VERSION_TOKEN_RE.test(value.reasoningEffort)) {
    throw new TypeError(
      "Cover-letter eval frozenConfig reasoningEffort is invalid",
    );
  }
  for (const key of [
    "generationControlsHash",
    "companyValuesHash",
    "writerSchemaHash",
  ] as const) {
    if (!SHA_256_HEX_RE.test(value[key])) {
      throw new TypeError(
        `Cover-letter eval frozenConfig ${key} must be a SHA-256 hash`,
      );
    }
  }
  return {
    provider: value.provider,
    model: value.model,
    outputLanguage: value.outputLanguage,
    preset: value.preset,
    proposalQualityMode: value.proposalQualityMode,
    hasCandidateContext: value.hasCandidateContext,
    providerMaxRetries: value.providerMaxRetries,
    writerMaxOutputTokens: value.writerMaxOutputTokens,
    promptV2: value.promptV2,
    qualityRepair: value.qualityRepair,
    reasoningEffort: value.reasoningEffort,
    generationControlsHash: value.generationControlsHash,
    companyValuesHash: value.companyValuesHash,
    writerSchemaHash: value.writerSchemaHash,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
