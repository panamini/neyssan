import { stableSerialize } from "../application-harness/fingerprints";
import {
  assertMcpWriteActionExecutionDisabled,
  createMcpWriteActionProposal,
  type McpWriteActionProposalV1,
} from "./mcpWriteActionFramework";

export type McpJobPlatformDryRunActionV1 =
  | "apply_to_job"
  | "submit_application";

export type McpJobPlatformDryRunStatusV1 =
  | "mapping_complete"
  | "human_input_required"
  | "missing_required_data"
  | "unsupported_schema"
  | "blocked";

export type McpJobPlatformDryRunFieldKindV1 =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "url"
  | "select"
  | "boolean"
  | "date"
  | "artifact_ref"
  | "attestation";

export type McpJobPlatformDryRunSourcePolicyV1 =
  | "explicit_approved_fact"
  | "approved_artifact_ref"
  | "approved_answer_artifact"
  | "human_only"
  | "unsupported";

export type McpJobPlatformDryRunMappingStateV1 =
  | "mapped"
  | "missing"
  | "human_input_required"
  | "unsupported"
  | "blocked_by_policy"
  | "invalid_value";

type McpJobPlatformDryRunSensitivityV1 =
  | "standard"
  | "personal_contact"
  | "sensitive"
  | "legally_significant";

type McpJobPlatformDryRunHumanInputPolicyV1 =
  | "auto_map_if_explicit"
  | "reviewed_exact_answer_required"
  | "human_only";

export type McpJobPlatformDryRunFieldDefinitionV1 = Readonly<{
  fieldId: string;
  safeLabel: string;
  fieldKind: McpJobPlatformDryRunFieldKindV1;
  required: boolean;
  sourcePolicy: McpJobPlatformDryRunSourcePolicyV1;
  sourceKey?: string;
  maxLength?: number;
  allowedOptionCodes?: readonly string[];
  sensitivity: McpJobPlatformDryRunSensitivityV1;
  humanInputPolicy: McpJobPlatformDryRunHumanInputPolicyV1;
  questionSchemaVersion?: string;
  version: 1;
}>;

export type McpJobPlatformDryRunAttachmentSlotV1 = Readonly<{
  slotId: string;
  safeLabel: string;
  required: boolean;
  acceptedArtifactKinds: readonly McpJobPlatformDryRunArtifactKindV1[];
  version: 1;
}>;

export type McpJobPlatformDryRunSchemaV1 = Readonly<{
  kind: "mcp_job_platform_dry_run_schema";
  integrationId: "local_fixture_job_platform_v1";
  schemaVersion: string;
  nonProduction: true;
  supportedFieldKinds: readonly McpJobPlatformDryRunFieldKindV1[];
  supportedFields: readonly McpJobPlatformDryRunFieldDefinitionV1[];
  attachmentSlots: readonly McpJobPlatformDryRunAttachmentSlotV1[];
  version: 1;
}>;

export type McpJobPlatformDryRunArtifactKindV1 =
  | "resume_variant"
  | "cover_letter"
  | "application_package";

type McpJobPlatformDryRunApprovedFactV1 = Readonly<{
  kind: "mcp_job_platform_dry_run_approved_fact";
  factRef: string;
  sourceKey: string;
  sourceRef: string;
  valueKind: McpJobPlatformDryRunFieldKindV1;
  value: string | boolean;
  approval: Readonly<{
    approved: boolean;
    fresh: boolean;
    allowedForApplicationUse: boolean;
    reviewedAt: string;
    version: 1;
  }>;
  privacy: "standard" | "private" | "never_use";
  version: 1;
}>;

type McpJobPlatformDryRunApprovedAnswerArtifactV1 = Readonly<{
  kind: "mcp_job_platform_dry_run_approved_answer_artifact";
  answerRef: string;
  sourceKey: string;
  sourceRef: string;
  questionSchemaVersion: string;
  answerText: string;
  approved: boolean;
  fresh: boolean;
  version: 1;
}>;

type McpJobPlatformDryRunApprovedArtifactRefV1 = Readonly<{
  kind: "mcp_job_platform_dry_run_approved_artifact_ref";
  artifactKind: McpJobPlatformDryRunArtifactKindV1;
  artifactRef: string;
  approvedArtifactUpdatedAt: string;
  currentArtifactUpdatedAt: string;
  revisionLineage: readonly string[];
  latestApprovedRevisionRef: string;
  hasPendingRevision: false;
  version: 1;
}>;

type McpJobPlatformDryRunSourceBindingV1 = Readonly<{
  kind: "mcp_job_platform_dry_run_source_binding";
  sourceKey: string;
  sourceRef: string;
  version: 1;
}>;

export type McpJobPlatformDryRunFieldPlanV1 = Readonly<{
  kind: "mcp_job_platform_dry_run_field_plan";
  fieldId: string;
  safeLabel: string;
  fieldKind: McpJobPlatformDryRunFieldKindV1;
  required: boolean;
  sourcePolicy: McpJobPlatformDryRunSourcePolicyV1;
  sourceKey?: string;
  sensitivity: McpJobPlatformDryRunSensitivityV1;
  mappingState: McpJobPlatformDryRunMappingStateV1;
  reasonCode: string;
  sourceRef?: string;
  valueRef?: string;
  version: 1;
}>;

export type McpJobPlatformDryRunAttachmentPlanV1 = Readonly<{
  kind: "mcp_job_platform_dry_run_attachment_plan";
  slotId: string;
  safeLabel: string;
  required: boolean;
  acceptedArtifactKinds: readonly McpJobPlatformDryRunArtifactKindV1[];
  mappingState: Extract<
    McpJobPlatformDryRunMappingStateV1,
    "mapped" | "missing" | "unsupported" | "blocked_by_policy"
  >;
  reasonCode: string;
  artifactKind?: McpJobPlatformDryRunArtifactKindV1;
  artifactRef?: string;
  revisionLineage?: readonly string[];
  uploadAttempted: false;
  version: 1;
}>;

type McpJobPlatformDryRunRestrictedPreviewV1 = Readonly<{
  kind: "mcp_job_platform_dry_run_restricted_preview";
  visibility: "restricted_user_review_only";
  modelVisible: false;
  componentVisible: false;
  fieldValues: readonly Readonly<{
    fieldId: string;
    valueKind: McpJobPlatformDryRunFieldKindV1;
    value: string | boolean;
    sourceRef: string;
    valueRef: string;
    version: 1;
  }>[];
  attachmentRefs: readonly Readonly<{
    slotId: string;
    artifactKind: McpJobPlatformDryRunArtifactKindV1;
    artifactRef: string;
    version: 1;
  }>[];
  version: 1;
}>;

export type McpJobPlatformDryRunSafeCountsV1 = Readonly<{
  fields: number;
  mappedFields: number;
  missingFields: number;
  missingRequiredFields: number;
  requiredBlockingFields: number;
  humanInputRequiredFields: number;
  unsupportedFields: number;
  blockedByPolicyFields: number;
  invalidFields: number;
  attachmentSlots: number;
  mappedAttachments: number;
  missingAttachments: number;
  version: 1;
}>;

export type McpJobPlatformDryRunAuditEventV1 = Readonly<{
  kind: "mcp_job_platform_dry_run_audit_event";
  eventKind: "job_platform_apply_dry_run_created" | "job_platform_apply_dry_run_blocked";
  dryRunStatus: McpJobPlatformDryRunStatusV1;
  intendedAction?: McpJobPlatformDryRunActionV1;
  integrationId?: "local_fixture_job_platform_v1";
  integrationSchemaVersion?: string;
  jobRef?: string;
  applicationPackageRef?: string;
  mappingDigest?: string;
  mappingRef?: string;
  safeCounts?: McpJobPlatformDryRunSafeCountsV1;
  rawDataExposed: false;
  applyAttempted: false;
  submitAttempted: false;
  uploadAttempted: false;
  writeActionExecuted: false;
  networkRequestExecuted: false;
  externalSideEffect: false;
  localPersistenceWrite: false;
  credentialStorage: "none";
  tokenStorage: "none";
  version: 1;
}>;

export type McpJobPlatformDryRunSafeRefusalV1 = Readonly<{
  kind: "mcp_job_platform_apply_dry_run_safe_refusal";
  code: "job_platform_apply_dry_run_blocked";
  msg: "Refused. Job platform dry run blocked.";
  safeForModel: true;
  rawDataExposed: false;
  applyAttempted: false;
  submitAttempted: false;
  uploadAttempted: false;
  writeActionExecuted: false;
  networkRequestExecuted: false;
  externalSideEffect: false;
  version: 1;
}>;

export type McpJobPlatformDryRunSafeSummaryV1 = Readonly<{
  kind: "mcp_job_platform_apply_dry_run_safe_summary";
  allowed: boolean;
  dryRunCreated: boolean;
  dryRunStatus: McpJobPlatformDryRunStatusV1;
  intendedAction?: McpJobPlatformDryRunActionV1;
  integrationId?: "local_fixture_job_platform_v1";
  integrationSchemaVersion?: string;
  jobRef?: string;
  applicationPackageRef?: string;
  mappingDigest?: string;
  mappingRef?: string;
  safeCounts?: McpJobPlatformDryRunSafeCountsV1;
  mappedFieldPlans: readonly McpJobPlatformDryRunFieldPlanV1[];
  missingRequiredFieldIds: readonly string[];
  requiredBlockingFieldIds: readonly string[];
  humanInputRequiredFieldIds: readonly string[];
  unsupportedFieldIds: readonly string[];
  attachmentPlans: readonly McpJobPlatformDryRunAttachmentPlanV1[];
  auditEvent: McpJobPlatformDryRunAuditEventV1;
  humanReviewRequired: true;
  liveConfirmationRequired: true;
  liveExecutionAllowed: false;
  applyAttempted: false;
  submitAttempted: false;
  uploadAttempted: false;
  writeActionExecuted: false;
  realExecutionAllowed: false;
  networkRequestExecuted: false;
  externalSideEffect: false;
  localPersistenceWrite: false;
  credentialStorage: "none";
  tokenStorage: "none";
  version: 1;
}>;

type McpJobPlatformDryRunResultBaseV1 = Omit<
  McpJobPlatformDryRunSafeSummaryV1,
  "kind"
>;

export type McpJobPlatformDryRunResultV1 = Readonly<
  | (McpJobPlatformDryRunResultBaseV1 & {
      kind: "mcp_job_platform_apply_dry_run_result";
      allowed: true;
      dryRunCreated: true;
      restrictedPreview: McpJobPlatformDryRunRestrictedPreviewV1;
      writeActionProposal: McpWriteActionProposalV1;
      dryRunReviewedDoesNotMeanLiveApproved: true;
      mappingDigestIsNotLiveConsentProof: true;
      pr80RequiresFreshValidationAndManualConfirmation: true;
    })
  | (McpJobPlatformDryRunResultBaseV1 & {
      kind: "mcp_job_platform_apply_dry_run_result";
      allowed: false;
      dryRunCreated: false;
      safeRefusal: McpJobPlatformDryRunSafeRefusalV1;
      reason:
        | "invalid_input"
        | "unsupported_schema"
        | "ambiguous_input"
        | "approved_application_required";
    })
>;

type ParsedRequest = Readonly<{
  integrationId: "local_fixture_job_platform_v1";
  integrationSchemaVersion: string;
  intendedAction: McpJobPlatformDryRunActionV1;
  jobRef: string;
  applicationPackageRef: string;
  approvedFacts: readonly McpJobPlatformDryRunApprovedFactV1[];
  sourceBindings: readonly McpJobPlatformDryRunSourceBindingV1[];
  approvedAnswerArtifacts: readonly McpJobPlatformDryRunApprovedAnswerArtifactV1[];
  approvedArtifactRefs: readonly McpJobPlatformDryRunApprovedArtifactRefV1[];
  requestedAt: string;
}>;

type ValidRequestRecord = Record<string, unknown> &
  Readonly<{
    integrationSchemaVersion: string;
    intendedAction: McpJobPlatformDryRunActionV1;
    jobRef: string;
    applicationPackageRef: string;
    requestedAt: string;
  }>;

type ParsedRequestCollections = Readonly<{
  approvedFacts: McpJobPlatformDryRunApprovedFactV1[];
  sourceBindings: McpJobPlatformDryRunSourceBindingV1[];
  approvedAnswerArtifacts: McpJobPlatformDryRunApprovedAnswerArtifactV1[];
  approvedArtifactRefs: McpJobPlatformDryRunApprovedArtifactRefV1[];
}>;

type ParsedArtifactRefParts = Readonly<{
  artifactKind: McpJobPlatformDryRunArtifactKindV1;
  artifactRef: string;
  approvedArtifactUpdatedAt: string;
  currentArtifactUpdatedAt: string;
  revisionLineage: readonly string[];
  latestApprovedRevisionRef: string;
}>;

type SchemaValidation =
  | Readonly<{ ok: true; schema: McpJobPlatformDryRunSchemaV1 }>
  | Readonly<{ ok: false }>;

type ValidSchemaRecord = Record<string, unknown> & { schemaVersion: string };

type ParsedSchemaCollections = Readonly<{
  supportedFieldKinds: McpJobPlatformDryRunFieldKindV1[];
  fields: McpJobPlatformDryRunFieldDefinitionV1[];
  slots: McpJobPlatformDryRunAttachmentSlotV1[];
}>;

type ParsedFieldParts = McpJobPlatformDryRunFieldDefinitionV1;

type RequiredFieldParts = Readonly<{
  fieldId: string;
  safeLabel: string;
  fieldKind: McpJobPlatformDryRunFieldKindV1;
  required: boolean;
  sourcePolicy: McpJobPlatformDryRunSourcePolicyV1;
  sensitivity: McpJobPlatformDryRunSensitivityV1;
  humanInputPolicy: McpJobPlatformDryRunHumanInputPolicyV1;
}>;

type OptionalFieldParts = Readonly<
  Pick<
    McpJobPlatformDryRunFieldDefinitionV1,
    "sourceKey" | "maxLength" | "allowedOptionCodes" | "questionSchemaVersion"
  >
>;

type ParsedValue = Readonly<{
  value: string | boolean;
  valueKind: McpJobPlatformDryRunFieldKindV1;
  valueRef: string;
  sourceRef: string;
}>;

const INTEGRATION_ID = "local_fixture_job_platform_v1" as const;
const DEFAULT_SCHEMA_VERSION = "local_fixture_job_platform_v1.schema.1";
const CURRENT_VERSION = 1;

export const LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1: McpJobPlatformDryRunSchemaV1 =
  {
    kind: "mcp_job_platform_dry_run_schema",
    integrationId: INTEGRATION_ID,
    schemaVersion: DEFAULT_SCHEMA_VERSION,
    nonProduction: true,
    supportedFieldKinds: [
      "short_text",
      "long_text",
      "email",
      "phone",
      "url",
      "select",
      "boolean",
      "date",
      "artifact_ref",
      "attestation",
    ],
    supportedFields: [
      {
        fieldId: "candidate_full_name",
        safeLabel: "Candidate name",
        fieldKind: "short_text",
        required: true,
        sourcePolicy: "explicit_approved_fact",
        sourceKey: "candidate_full_name",
        maxLength: 120,
        sensitivity: "standard",
        humanInputPolicy: "auto_map_if_explicit",
        version: 1,
      },
      {
        fieldId: "candidate_email",
        safeLabel: "Candidate email",
        fieldKind: "email",
        required: true,
        sourcePolicy: "explicit_approved_fact",
        sourceKey: "candidate_email",
        maxLength: 254,
        sensitivity: "personal_contact",
        humanInputPolicy: "auto_map_if_explicit",
        version: 1,
      },
      {
        fieldId: "candidate_phone",
        safeLabel: "Candidate phone",
        fieldKind: "phone",
        required: false,
        sourcePolicy: "explicit_approved_fact",
        sourceKey: "candidate_phone",
        maxLength: 40,
        sensitivity: "personal_contact",
        humanInputPolicy: "auto_map_if_explicit",
        version: 1,
      },
      {
        fieldId: "portfolio_url",
        safeLabel: "Portfolio URL",
        fieldKind: "url",
        required: false,
        sourcePolicy: "explicit_approved_fact",
        sourceKey: "portfolio_url",
        maxLength: 300,
        sensitivity: "standard",
        humanInputPolicy: "auto_map_if_explicit",
        version: 1,
      },
      {
        fieldId: "earliest_start_date",
        safeLabel: "Earliest start date",
        fieldKind: "date",
        required: false,
        sourcePolicy: "explicit_approved_fact",
        sourceKey: "earliest_start_date",
        sensitivity: "standard",
        humanInputPolicy: "auto_map_if_explicit",
        version: 1,
      },
      {
        fieldId: "remote_preference",
        safeLabel: "Work mode preference",
        fieldKind: "select",
        required: false,
        sourcePolicy: "explicit_approved_fact",
        sourceKey: "remote_preference",
        allowedOptionCodes: ["hybrid", "onsite", "remote"],
        sensitivity: "standard",
        humanInputPolicy: "auto_map_if_explicit",
        version: 1,
      },
      {
        fieldId: "screening_motivation",
        safeLabel: "Screening answer",
        fieldKind: "long_text",
        required: false,
        sourcePolicy: "approved_answer_artifact",
        sourceKey: "screening_motivation",
        questionSchemaVersion: "local_fixture_screening_question_v1",
        maxLength: 600,
        sensitivity: "standard",
        humanInputPolicy: "reviewed_exact_answer_required",
        version: 1,
      },
      {
        fieldId: "work_authorization",
        safeLabel: "Work authorization",
        fieldKind: "select",
        required: false,
        sourcePolicy: "human_only",
        sourceKey: "work_authorization",
        allowedOptionCodes: ["authorized", "not_authorized"],
        sensitivity: "legally_significant",
        humanInputPolicy: "human_only",
        version: 1,
      },
      {
        fieldId: "sponsorship_required",
        safeLabel: "Sponsorship requirement",
        fieldKind: "boolean",
        required: false,
        sourcePolicy: "human_only",
        sourceKey: "sponsorship_required",
        sensitivity: "legally_significant",
        humanInputPolicy: "human_only",
        version: 1,
      },
      {
        fieldId: "salary_expectation",
        safeLabel: "Salary expectation",
        fieldKind: "short_text",
        required: false,
        sourcePolicy: "human_only",
        sourceKey: "salary_expectation",
        maxLength: 80,
        sensitivity: "legally_significant",
        humanInputPolicy: "human_only",
        version: 1,
      },
      {
        fieldId: "relocation",
        safeLabel: "Relocation",
        fieldKind: "boolean",
        required: false,
        sourcePolicy: "human_only",
        sourceKey: "relocation",
        sensitivity: "legally_significant",
        humanInputPolicy: "human_only",
        version: 1,
      },
      {
        fieldId: "eeo_disability_status",
        safeLabel: "EEO disability status",
        fieldKind: "select",
        required: false,
        sourcePolicy: "human_only",
        sourceKey: "eeo_disability_status",
        allowedOptionCodes: ["decline", "no", "yes"],
        sensitivity: "legally_significant",
        humanInputPolicy: "human_only",
        version: 1,
      },
      {
        fieldId: "terms_attestation",
        safeLabel: "Terms attestation",
        fieldKind: "attestation",
        required: false,
        sourcePolicy: "human_only",
        sourceKey: "terms_attestation",
        sensitivity: "legally_significant",
        humanInputPolicy: "human_only",
        version: 1,
      },
    ],
    attachmentSlots: [
      {
        slotId: "resume_upload",
        safeLabel: "Resume attachment",
        required: true,
        acceptedArtifactKinds: ["resume_variant"],
        version: 1,
      },
      {
        slotId: "cover_letter_upload",
        safeLabel: "Cover letter attachment",
        required: false,
        acceptedArtifactKinds: ["cover_letter", "application_package"],
        version: 1,
      },
    ],
    version: 1,
  };

const REQUEST_KEYS = [
  "kind",
  "integrationId",
  "integrationSchemaVersion",
  "intendedAction",
  "jobRef",
  "applicationPackageRef",
  "approvedFacts",
  "sourceBindings",
  "approvedAnswerArtifacts",
  "approvedArtifactRefs",
  "requestedAt",
  "version",
] as const;
const DEPS_KEYS = ["schema"] as const;
const SCHEMA_KEYS = [
  "kind",
  "integrationId",
  "schemaVersion",
  "nonProduction",
  "supportedFieldKinds",
  "supportedFields",
  "attachmentSlots",
  "version",
] as const;
const FIELD_KEYS = [
  "fieldId",
  "safeLabel",
  "fieldKind",
  "required",
  "sourcePolicy",
  "sourceKey",
  "maxLength",
  "allowedOptionCodes",
  "sensitivity",
  "humanInputPolicy",
  "questionSchemaVersion",
  "version",
] as const;
const FIELD_REQUIRED_KEYS = [
  "fieldId",
  "safeLabel",
  "fieldKind",
  "required",
  "sourcePolicy",
  "sensitivity",
  "humanInputPolicy",
  "version",
] as const;
const SLOT_KEYS = [
  "slotId",
  "safeLabel",
  "required",
  "acceptedArtifactKinds",
  "version",
] as const;
const SOURCE_BINDING_KEYS = ["kind", "sourceKey", "sourceRef", "version"] as const;
const FACT_KEYS = [
  "kind",
  "factRef",
  "sourceKey",
  "sourceRef",
  "valueKind",
  "value",
  "approval",
  "privacy",
  "version",
] as const;
const FACT_APPROVAL_KEYS = [
  "approved",
  "fresh",
  "allowedForApplicationUse",
  "reviewedAt",
  "version",
] as const;
const ANSWER_KEYS = [
  "kind",
  "answerRef",
  "sourceKey",
  "sourceRef",
  "questionSchemaVersion",
  "answerText",
  "approved",
  "fresh",
  "version",
] as const;
const ARTIFACT_KEYS = [
  "kind",
  "artifactKind",
  "artifactRef",
  "approvedArtifactUpdatedAt",
  "currentArtifactUpdatedAt",
  "revisionLineage",
  "latestApprovedRevisionRef",
  "hasPendingRevision",
  "version",
] as const;

const FIELD_KINDS = new Set<McpJobPlatformDryRunFieldKindV1>(
  LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1.supportedFieldKinds,
);
const SOURCE_POLICIES = new Set<McpJobPlatformDryRunSourcePolicyV1>([
  "explicit_approved_fact",
  "approved_artifact_ref",
  "approved_answer_artifact",
  "human_only",
  "unsupported",
]);
const SENSITIVITIES = new Set<McpJobPlatformDryRunSensitivityV1>([
  "standard",
  "personal_contact",
  "sensitive",
  "legally_significant",
]);
const HUMAN_INPUT_POLICIES = new Set<McpJobPlatformDryRunHumanInputPolicyV1>([
  "auto_map_if_explicit",
  "reviewed_exact_answer_required",
  "human_only",
]);
const ARTIFACT_KINDS = new Set<McpJobPlatformDryRunArtifactKindV1>([
  "resume_variant",
  "cover_letter",
  "application_package",
]);
const SENSITIVE_HUMAN_ONLY_SOURCE_KEYS = new Set([
  "accuracy_certification",
  "criminal_history",
  "eeo_disability_status",
  "electronic_signature",
  "gender",
  "privacy_consent",
  "relocation",
  "salary_expectation",
  "sponsorship_required",
  "terms_attestation",
  "veteran_status",
  "work_authorization",
]);
const UNSAFE_TEXT_PATTERNS: readonly RegExp[] = [
  /RAW_(?:(?:CV|RESUME|JOB|PROPOSAL|APP|COVER_LETTER)(?:_TEXT)?|SOURCE_DOCUMENT|ARGUMENTS)_SENTINEL_DO_NOT_EXPOSE/u,
  /SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE/u,
  /PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE/u,
  /NEVER_USE_SENTINEL_DO_NOT_EXPOSE/u,
  /GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE/u,
  /SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE/u,
  /SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE/u,
  /STACK_TRACE_SENTINEL_DO_NOT_EXPOSE/u,
  /DO_NOT_EXPOSE/u,
  /\bBearer\s+[A-Za-z0-9._-]+/u,
  /\b(?:access|refresh)[_-]?token\b/iu,
  /\braw[_ -]?(?:cv|resume|job|proposal|app|text)\b/iu,
  /\b(?:private[_ -]?fact|never[_ -]?use|source[_ -]?quote|debug[_ -]?payload)\b/iu,
  /<\s*\/?\s*(?:script|style|html|body|iframe|svg)\b/iu,
  /\bjavascript\s*:/iu,
  /\b(?:ignore previous|system prompt|developer message)\b/iu,
];
const FORBIDDEN_SAFE_REF_TOKENS =
  /(?:raw|text|content|quote|private|never|token|secret|session|clerk|stytch|provider|userid|email|documentid|convex|downloadurl|signedurl|base64|blob|cookie|oauth)/u;

export function createMcpJobPlatformApplyDryRun(
  input: unknown,
  deps?: unknown,
): McpJobPlatformDryRunResultV1 {
  const schemaValidation = parseDeps(deps);
  if (!schemaValidation.ok) return buildBlockedResult("unsupported_schema");
  const schema = schemaValidation.schema;
  const parsed = parseRequest(input);
  if (!parsed) return buildBlockedResult("invalid_input");
  if (
    parsed.integrationId !== schema.integrationId ||
    parsed.integrationSchemaVersion !== schema.schemaVersion
  ) {
    return buildBlockedResult("unsupported_schema", parsed, schema);
  }
  if (hasAmbiguousInput(parsed)) {
    return buildBlockedResult("ambiguous_input", parsed, schema);
  }
  if (!hasApprovedApplicationPackage(parsed)) {
    return buildBlockedResult("approved_application_required", parsed, schema);
  }

  const fieldPlans = schema.supportedFields
    .slice()
    .sort((left, right) => compareStrings(left.fieldId, right.fieldId))
    .map((field) => buildFieldPlan(field, parsed));
  const attachmentPlans = schema.attachmentSlots
    .slice()
    .sort((left, right) => compareStrings(left.slotId, right.slotId))
    .map((slot) => buildAttachmentPlan(slot, parsed));
  const safeCounts = buildSafeCounts(fieldPlans, attachmentPlans);
  const dryRunStatus = deriveDryRunStatus(fieldPlans, attachmentPlans);
  const restrictedPreview = buildRestrictedPreview(
    fieldPlans,
    attachmentPlans,
    parsed,
    schema,
  );
  const digestInput = buildDigestInput(parsed, schema, fieldPlans, attachmentPlans);
  const mappingDigest = buildDeterministicDigest(digestInput);
  const mappingRef = `mcp-safe-ref:job-platform-dry-run:${mappingDigest.slice(-16)}`;
  const writeActionProposal = buildWriteActionProposal(
    parsed.intendedAction,
    mappingDigest,
  );
  const writeGuard = assertMcpWriteActionExecutionDisabled(writeActionProposal);
  if (writeGuard.realExecutionAllowed !== false) {
    return buildBlockedResult("invalid_input", parsed, schema);
  }
  const auditEvent = buildAuditEvent({
    eventKind: "job_platform_apply_dry_run_created",
    dryRunStatus,
    parsed,
    mappingDigest,
    mappingRef,
    safeCounts,
  });
  const safeSummary = buildSafeSummary({
    allowed: true,
    dryRunCreated: true,
    dryRunStatus,
    parsed,
    mappingDigest,
    mappingRef,
    safeCounts,
    fieldPlans,
    attachmentPlans,
    auditEvent,
  });

  return {
    ...safeSummary,
    kind: "mcp_job_platform_apply_dry_run_result",
    allowed: true,
    dryRunCreated: true,
    restrictedPreview,
    writeActionProposal,
    dryRunReviewedDoesNotMeanLiveApproved: true,
    mappingDigestIsNotLiveConsentProof: true,
    pr80RequiresFreshValidationAndManualConfirmation: true,
  };
}

export function createMcpJobPlatformDryRunSafeSummary(
  result: McpJobPlatformDryRunResultV1,
): McpJobPlatformDryRunSafeSummaryV1 {
  return {
    kind: "mcp_job_platform_apply_dry_run_safe_summary",
    allowed: result.allowed,
    dryRunCreated: result.dryRunCreated,
    dryRunStatus: result.dryRunStatus,
    ...(result.intendedAction ? { intendedAction: result.intendedAction } : {}),
    ...(result.integrationId ? { integrationId: result.integrationId } : {}),
    ...(result.integrationSchemaVersion
      ? { integrationSchemaVersion: result.integrationSchemaVersion }
      : {}),
    ...(result.jobRef ? { jobRef: result.jobRef } : {}),
    ...(result.applicationPackageRef
      ? { applicationPackageRef: result.applicationPackageRef }
      : {}),
    ...(result.mappingDigest ? { mappingDigest: result.mappingDigest } : {}),
    ...(result.mappingRef ? { mappingRef: result.mappingRef } : {}),
    ...(result.safeCounts ? { safeCounts: result.safeCounts } : {}),
    mappedFieldPlans: result.mappedFieldPlans,
    missingRequiredFieldIds: result.missingRequiredFieldIds,
    requiredBlockingFieldIds: result.requiredBlockingFieldIds,
    humanInputRequiredFieldIds: result.humanInputRequiredFieldIds,
    unsupportedFieldIds: result.unsupportedFieldIds,
    attachmentPlans: result.attachmentPlans,
    auditEvent: result.auditEvent,
    humanReviewRequired: true,
    liveConfirmationRequired: true,
    liveExecutionAllowed: false,
    applyAttempted: false,
    submitAttempted: false,
    uploadAttempted: false,
    writeActionExecuted: false,
    realExecutionAllowed: false,
    networkRequestExecuted: false,
    externalSideEffect: false,
    localPersistenceWrite: false,
    credentialStorage: "none",
    tokenStorage: "none",
    version: 1,
  };
}

function parseDeps(deps: unknown): SchemaValidation {
  if (deps === undefined) {
    return validateSchema(LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1);
  }
  const record = readExactRecord(deps, DEPS_KEYS, DEPS_KEYS);
  if (!record) return { ok: false };
  return validateSchema(record.schema);
}

function validateSchema(schema: unknown): SchemaValidation {
  const record = readValidSchemaRecord(schema);
  if (!record) return { ok: false };
  const parsed = readSchemaCollections(record);
  if (!parsed || !areSchemaCollectionsCoherent(parsed)) return { ok: false };
  return {
    ok: true,
    schema: {
      kind: "mcp_job_platform_dry_run_schema",
      integrationId: INTEGRATION_ID,
      schemaVersion: record.schemaVersion,
      nonProduction: true,
      supportedFieldKinds: parsed.supportedFieldKinds,
      supportedFields: parsed.fields,
      attachmentSlots: parsed.slots,
      version: 1,
    },
  };
}

function readValidSchemaRecord(schema: unknown): ValidSchemaRecord | undefined {
  const record = readExactRecord(schema, SCHEMA_KEYS, SCHEMA_KEYS);
  if (!record) return undefined;
  if (record.kind !== "mcp_job_platform_dry_run_schema") return undefined;
  if (record.integrationId !== INTEGRATION_ID) return undefined;
  if (record.nonProduction !== true) return undefined;
  if (!isSafeSchemaVersion(record.schemaVersion)) return undefined;
  if (record.version !== CURRENT_VERSION) return undefined;
  return record as ValidSchemaRecord;
}

function readSchemaCollections(
  record: Record<string, unknown>,
): ParsedSchemaCollections | undefined {
  const supportedFieldKinds = readStringArray(record.supportedFieldKinds);
  const supportedFields = readArrayValues(record.supportedFields)?.map(parseField);
  const attachmentSlots = readArrayValues(record.attachmentSlots)?.map(parseSlot);
  if (!supportedFieldKinds || !supportedFields || !attachmentSlots) return undefined;
  if (supportedFields.some((field) => field === undefined)) return undefined;
  if (attachmentSlots.some((slot) => slot === undefined)) return undefined;
  if (!areSupportedFieldKindsValid(supportedFieldKinds)) return undefined;
  return {
    supportedFieldKinds: supportedFieldKinds as McpJobPlatformDryRunFieldKindV1[],
    fields: supportedFields as McpJobPlatformDryRunFieldDefinitionV1[],
    slots: attachmentSlots as McpJobPlatformDryRunAttachmentSlotV1[],
  };
}

function areSupportedFieldKindsValid(kinds: readonly string[]): boolean {
  return (
    !hasDuplicate(kinds) &&
    kinds.every((kind) => FIELD_KINDS.has(kind as McpJobPlatformDryRunFieldKindV1))
  );
}

function areSchemaCollectionsCoherent(parsed: ParsedSchemaCollections): boolean {
  if (hasDuplicate(parsed.fields.map((field) => field.fieldId))) return false;
  if (hasDuplicate(parsed.slots.map((slot) => slot.slotId))) return false;
  return parsed.fields.every(
    (field) =>
      parsed.supportedFieldKinds.includes(field.fieldKind) && isFieldPolicyCoherent(field),
  );
}

function parseField(input: unknown): McpJobPlatformDryRunFieldDefinitionV1 | undefined {
  const record = readExactRecord(input, FIELD_KEYS, FIELD_REQUIRED_KEYS);
  if (!record) return undefined;
  const field = readFieldParts(record);
  if (!field) return undefined;
  if (!isFieldSourceShapeValid(field)) return undefined;
  if (!isSelectFieldShapeValid(field)) return undefined;
  return field;
}

function readFieldParts(record: Record<string, unknown>): ParsedFieldParts | undefined {
  const requiredParts = readRequiredFieldParts(record);
  const optionalParts = readOptionalFieldParts(record);
  if (!requiredParts || !optionalParts) return undefined;
  if (record.version !== CURRENT_VERSION) return undefined;
  return {
    ...requiredParts,
    ...optionalParts,
    version: 1,
  };
}

function readRequiredFieldParts(
  record: Record<string, unknown>,
): RequiredFieldParts | undefined {
  const fieldKind = readFieldKind(record.fieldKind);
  const sourcePolicy = readSourcePolicy(record.sourcePolicy);
  const sensitivity = readSensitivity(record.sensitivity);
  const humanInputPolicy = readHumanInputPolicy(record.humanInputPolicy);
  if (
    !isSafeFieldId(record.fieldId) ||
    !isSafeLabel(record.safeLabel) ||
    !fieldKind ||
    typeof record.required !== "boolean" ||
    !sourcePolicy ||
    !sensitivity ||
    !humanInputPolicy
  ) {
    return undefined;
  }
  return {
    fieldId: record.fieldId,
    safeLabel: record.safeLabel,
    fieldKind,
    required: record.required,
    sourcePolicy,
    sensitivity,
    humanInputPolicy,
  };
}

function readOptionalFieldParts(
  record: Record<string, unknown>,
): OptionalFieldParts | undefined {
  const sourceKey = readOptionalSourceKey(record.sourceKey);
  const maxLength = readOptionalPositiveInteger(record.maxLength, 5000);
  const allowedOptionCodes = readOptionalOptionCodes(record.allowedOptionCodes);
  const questionSchemaVersion = readOptionalSchemaVersion(record.questionSchemaVersion);
  if (
    sourceKey === false ||
    maxLength === false ||
    allowedOptionCodes === false ||
    questionSchemaVersion === false
  ) {
    return undefined;
  }
  return {
    ...(sourceKey ? { sourceKey } : {}),
    ...(maxLength ? { maxLength } : {}),
    ...(allowedOptionCodes ? { allowedOptionCodes } : {}),
    ...(questionSchemaVersion ? { questionSchemaVersion } : {}),
  };
}

function isFieldSourceShapeValid(field: McpJobPlatformDryRunFieldDefinitionV1): boolean {
  return (
    (field.sourcePolicy !== "explicit_approved_fact" &&
      field.sourcePolicy !== "approved_answer_artifact") ||
    Boolean(field.sourceKey)
  );
}

function isSelectFieldShapeValid(field: McpJobPlatformDryRunFieldDefinitionV1): boolean {
  return field.fieldKind !== "select" || Boolean(field.allowedOptionCodes?.length);
}

function parseSlot(input: unknown): McpJobPlatformDryRunAttachmentSlotV1 | undefined {
  const record = readExactRecord(input, SLOT_KEYS, SLOT_KEYS);
  const acceptedArtifactKinds = record
    ? readArtifactKindArray(record.acceptedArtifactKinds)
    : undefined;
  if (
    !record ||
    !isSafeFieldId(record.slotId) ||
    !isSafeLabel(record.safeLabel) ||
    typeof record.required !== "boolean" ||
    !acceptedArtifactKinds ||
    acceptedArtifactKinds.length === 0 ||
    record.version !== CURRENT_VERSION
  ) {
    return undefined;
  }
  return {
    slotId: record.slotId,
    safeLabel: record.safeLabel,
    required: record.required,
    acceptedArtifactKinds,
    version: 1,
  };
}

function parseRequest(input: unknown): ParsedRequest | undefined {
  const record = readValidRequestRecord(input);
  if (!record) return undefined;
  const collections = readRequestCollections(record);
  if (!collections) return undefined;
  return {
    integrationId: INTEGRATION_ID,
    integrationSchemaVersion: record.integrationSchemaVersion,
    intendedAction: record.intendedAction,
    jobRef: record.jobRef,
    applicationPackageRef: record.applicationPackageRef,
    approvedFacts: collections.approvedFacts,
    sourceBindings: collections.sourceBindings,
    approvedAnswerArtifacts: collections.approvedAnswerArtifacts,
    approvedArtifactRefs: collections.approvedArtifactRefs,
    requestedAt: record.requestedAt,
  };
}

function readValidRequestRecord(input: unknown): ValidRequestRecord | undefined {
  const record = readExactRecord(input, REQUEST_KEYS, REQUEST_KEYS);
  if (!record) return undefined;
  if (record.kind !== "mcp_job_platform_apply_dry_run_request") return undefined;
  if (record.integrationId !== INTEGRATION_ID) return undefined;
  if (!isSafeSchemaVersion(record.integrationSchemaVersion)) return undefined;
  if (!isDryRunAction(record.intendedAction)) return undefined;
  if (!isSafeRef(record.jobRef)) return undefined;
  if (!isSafeRef(record.applicationPackageRef)) return undefined;
  if (!isIsoTimestamp(record.requestedAt)) return undefined;
  if (record.version !== CURRENT_VERSION) return undefined;
  return record as ValidRequestRecord;
}

function readRequestCollections(
  record: Record<string, unknown>,
): ParsedRequestCollections | undefined {
  const approvedFacts = readParsedArray(record.approvedFacts, parseApprovedFact);
  const sourceBindings = readParsedArray(record.sourceBindings, parseSourceBinding);
  const approvedAnswerArtifacts = readParsedArray(
    record.approvedAnswerArtifacts,
    parseApprovedAnswerArtifact,
  );
  const approvedArtifactRefs = readParsedArray(
    record.approvedArtifactRefs,
    parseApprovedArtifactRef,
  );
  if (!approvedFacts || !sourceBindings || !approvedAnswerArtifacts || !approvedArtifactRefs) {
    return undefined;
  }
  return {
    approvedFacts,
    sourceBindings,
    approvedAnswerArtifacts,
    approvedArtifactRefs,
  };
}

function parseSourceBinding(
  input: unknown,
): McpJobPlatformDryRunSourceBindingV1 | undefined {
  const record = readExactRecord(input, SOURCE_BINDING_KEYS, SOURCE_BINDING_KEYS);
  if (
    !record ||
    record.kind !== "mcp_job_platform_dry_run_source_binding" ||
    !isSafeSourceKey(record.sourceKey) ||
    !isSafeRef(record.sourceRef) ||
    record.version !== CURRENT_VERSION
  ) {
    return undefined;
  }
  return {
    kind: "mcp_job_platform_dry_run_source_binding",
    sourceKey: record.sourceKey,
    sourceRef: record.sourceRef,
    version: 1,
  };
}

function parseApprovedFact(
  input: unknown,
): McpJobPlatformDryRunApprovedFactV1 | undefined {
  const record = readExactRecord(input, FACT_KEYS, FACT_KEYS);
  if (!record || record.kind !== "mcp_job_platform_dry_run_approved_fact") {
    return undefined;
  }
  const approval = parseFactApproval(record.approval);
  const valueKind = readFieldKind(record.valueKind);
  if (
    !isSafeRef(record.factRef) ||
    !isSafeSourceKey(record.sourceKey) ||
    !isSafeRef(record.sourceRef) ||
    !valueKind ||
    !isFactValue(record.value) ||
    !approval ||
    !isFactPrivacy(record.privacy) ||
    record.version !== CURRENT_VERSION
  ) {
    return undefined;
  }
  return {
    kind: "mcp_job_platform_dry_run_approved_fact",
    factRef: record.factRef,
    sourceKey: record.sourceKey,
    sourceRef: record.sourceRef,
    valueKind,
    value: record.value,
    approval,
    privacy: record.privacy,
    version: 1,
  };
}

function parseFactApproval(
  input: unknown,
): McpJobPlatformDryRunApprovedFactV1["approval"] | undefined {
  const record = readExactRecord(input, FACT_APPROVAL_KEYS, FACT_APPROVAL_KEYS);
  if (
    !record ||
    typeof record.approved !== "boolean" ||
    typeof record.fresh !== "boolean" ||
    typeof record.allowedForApplicationUse !== "boolean" ||
    !isIsoTimestamp(record.reviewedAt) ||
    record.version !== CURRENT_VERSION
  ) {
    return undefined;
  }
  return {
    approved: record.approved,
    fresh: record.fresh,
    allowedForApplicationUse: record.allowedForApplicationUse,
    reviewedAt: record.reviewedAt,
    version: 1,
  };
}

function parseApprovedAnswerArtifact(
  input: unknown,
): McpJobPlatformDryRunApprovedAnswerArtifactV1 | undefined {
  const record = readExactRecord(input, ANSWER_KEYS, ANSWER_KEYS);
  if (
    !record ||
    record.kind !== "mcp_job_platform_dry_run_approved_answer_artifact" ||
    !isSafeRef(record.answerRef) ||
    !isSafeSourceKey(record.sourceKey) ||
    !isSafeRef(record.sourceRef) ||
    !isSafeSchemaVersion(record.questionSchemaVersion) ||
    typeof record.answerText !== "string" ||
    typeof record.approved !== "boolean" ||
    typeof record.fresh !== "boolean" ||
    record.version !== CURRENT_VERSION
  ) {
    return undefined;
  }
  return {
    kind: "mcp_job_platform_dry_run_approved_answer_artifact",
    answerRef: record.answerRef,
    sourceKey: record.sourceKey,
    sourceRef: record.sourceRef,
    questionSchemaVersion: record.questionSchemaVersion,
    answerText: record.answerText,
    approved: record.approved,
    fresh: record.fresh,
    version: 1,
  };
}

function parseApprovedArtifactRef(
  input: unknown,
): McpJobPlatformDryRunApprovedArtifactRefV1 | undefined {
  const record = readExactRecord(input, ARTIFACT_KEYS, ARTIFACT_KEYS);
  if (!record || record.kind !== "mcp_job_platform_dry_run_approved_artifact_ref") {
    return undefined;
  }
  const parts = readApprovedArtifactRefParts(record);
  if (!parts || !isApprovedArtifactRefCurrent(parts)) return undefined;
  return {
    kind: "mcp_job_platform_dry_run_approved_artifact_ref",
    artifactKind: parts.artifactKind,
    artifactRef: parts.artifactRef,
    approvedArtifactUpdatedAt: parts.approvedArtifactUpdatedAt,
    currentArtifactUpdatedAt: parts.currentArtifactUpdatedAt,
    revisionLineage: parts.revisionLineage,
    latestApprovedRevisionRef: parts.latestApprovedRevisionRef,
    hasPendingRevision: false,
    version: 1,
  };
}

function readApprovedArtifactRefParts(
  record: Record<string, unknown>,
): ParsedArtifactRefParts | undefined {
  const artifactKind = readArtifactKind(record.artifactKind);
  const revisionLineage = readStringArray(record.revisionLineage);
  if (
    !artifactKind ||
    !isSafeArtifactRefForKind(record.artifactRef, artifactKind) ||
    !isIsoTimestamp(record.approvedArtifactUpdatedAt) ||
    !isIsoTimestamp(record.currentArtifactUpdatedAt) ||
    !revisionLineage ||
    revisionLineage.length === 0 ||
    !revisionLineage.every(isSafeRef) ||
    !isSafeRef(record.latestApprovedRevisionRef) ||
    record.hasPendingRevision !== false ||
    record.version !== CURRENT_VERSION
  ) {
    return undefined;
  }
  return {
    artifactKind,
    artifactRef: record.artifactRef,
    approvedArtifactUpdatedAt: record.approvedArtifactUpdatedAt,
    currentArtifactUpdatedAt: record.currentArtifactUpdatedAt,
    revisionLineage,
    latestApprovedRevisionRef: record.latestApprovedRevisionRef,
  };
}

function isApprovedArtifactRefCurrent(parts: ParsedArtifactRefParts): boolean {
  return (
    parts.approvedArtifactUpdatedAt === parts.currentArtifactUpdatedAt &&
    parts.revisionLineage[parts.revisionLineage.length - 1] === parts.artifactRef &&
    parts.latestApprovedRevisionRef === parts.artifactRef
  );
}

function hasApprovedApplicationPackage(parsed: ParsedRequest): boolean {
  return parsed.approvedArtifactRefs.some(
    (artifact) =>
      artifact.artifactKind === "application_package" &&
      artifact.artifactRef === parsed.applicationPackageRef,
  );
}

function hasAmbiguousInput(parsed: ParsedRequest): boolean {
  return (
    hasDuplicate(parsed.approvedFacts.map((fact) => fact.sourceKey)) ||
    hasDuplicate(parsed.sourceBindings.map((binding) => binding.sourceKey)) ||
    hasDuplicate(
      parsed.approvedAnswerArtifacts.map(
        (answer) => `${answer.sourceKey}\u0000${answer.questionSchemaVersion}`,
      ),
    ) ||
    hasDuplicate(parsed.approvedArtifactRefs.map((artifact) => artifact.artifactRef)) ||
    hasDuplicate(parsed.approvedArtifactRefs.map((artifact) => artifact.artifactKind))
  );
}

function buildFieldPlan(
  field: McpJobPlatformDryRunFieldDefinitionV1,
  parsed: ParsedRequest,
): McpJobPlatformDryRunFieldPlanV1 {
  if (field.sourcePolicy === "unsupported") {
    return fieldPlan(field, "unsupported", "field_source_policy_unsupported");
  }
  if (field.sourcePolicy === "human_only" || isHumanOnlySensitiveField(field)) {
    return fieldPlan(field, "human_input_required", "human_input_required");
  }
  if (field.sourcePolicy === "approved_answer_artifact") {
    return buildAnswerArtifactFieldPlan(field, parsed);
  }
  if (field.sourcePolicy === "approved_artifact_ref") {
    return buildArtifactRefFieldPlan(field, parsed);
  }
  return buildApprovedFactFieldPlan(field, parsed);
}

function buildApprovedFactFieldPlan(
  field: McpJobPlatformDryRunFieldDefinitionV1,
  parsed: ParsedRequest,
): McpJobPlatformDryRunFieldPlanV1 {
  const fact = parsed.approvedFacts.find((item) => item.sourceKey === field.sourceKey);
  if (!fact) return fieldPlan(field, "missing", "explicit_fact_missing");
  const binding = parsed.sourceBindings.find((item) => item.sourceKey === fact.sourceKey);
  if (
    !fact.approval.approved ||
    !fact.approval.fresh ||
    !fact.approval.allowedForApplicationUse ||
    fact.privacy !== "standard" ||
    !binding ||
    binding.sourceRef !== fact.sourceRef
  ) {
    return fieldPlan(field, "blocked_by_policy", "explicit_fact_not_approved_for_use", fact);
  }
  const parsedValue = parseMappedValue(field, fact);
  if (!parsedValue) {
    return fieldPlan(field, "invalid_value", "explicit_fact_value_invalid", fact);
  }
  return fieldPlan(field, "mapped", "explicit_approved_fact_mapped", fact);
}

function buildAnswerArtifactFieldPlan(
  field: McpJobPlatformDryRunFieldDefinitionV1,
  parsed: ParsedRequest,
): McpJobPlatformDryRunFieldPlanV1 {
  const answer = parsed.approvedAnswerArtifacts.find(
    (item) =>
      item.sourceKey === field.sourceKey &&
      item.questionSchemaVersion === field.questionSchemaVersion,
  );
  if (!answer) {
    return fieldPlan(field, "human_input_required", "approved_answer_artifact_missing");
  }
  const binding = parsed.sourceBindings.find((item) => item.sourceKey === answer.sourceKey);
  if (!answer.approved || !answer.fresh || !binding || binding.sourceRef !== answer.sourceRef) {
    return fieldPlan(
      field,
      "human_input_required",
      "approved_answer_artifact_not_usable",
      undefined,
      answer,
    );
  }
  if (!isTextValueAllowed(answer.answerText, field.maxLength ?? 5000)) {
    return fieldPlan(
      field,
      "invalid_value",
      "approved_answer_artifact_value_invalid",
      undefined,
      answer,
    );
  }
  return fieldPlan(
    field,
    "mapped",
    "approved_answer_artifact_mapped",
    undefined,
    answer,
  );
}

function buildArtifactRefFieldPlan(
  field: McpJobPlatformDryRunFieldDefinitionV1,
  parsed: ParsedRequest,
): McpJobPlatformDryRunFieldPlanV1 {
  const artifact = parsed.approvedArtifactRefs.find(
    (item) => item.artifactRef === parsed.applicationPackageRef,
  );
  if (!artifact) return fieldPlan(field, "missing", "approved_artifact_ref_missing");
  return fieldPlan(
    field,
    "mapped",
    "approved_artifact_ref_mapped",
    undefined,
    undefined,
    artifact,
  );
}

function fieldPlan(
  field: McpJobPlatformDryRunFieldDefinitionV1,
  mappingState: McpJobPlatformDryRunMappingStateV1,
  reasonCode: string,
  fact?: McpJobPlatformDryRunApprovedFactV1,
  answer?: McpJobPlatformDryRunApprovedAnswerArtifactV1,
  artifact?: McpJobPlatformDryRunApprovedArtifactRefV1,
): McpJobPlatformDryRunFieldPlanV1 {
  return {
    kind: "mcp_job_platform_dry_run_field_plan",
    fieldId: field.fieldId,
    safeLabel: field.safeLabel,
    fieldKind: field.fieldKind,
    required: field.required,
    sourcePolicy: field.sourcePolicy,
    ...(field.sourceKey ? { sourceKey: field.sourceKey } : {}),
    sensitivity: field.sensitivity,
    mappingState,
    reasonCode,
    ...fieldPlanRefs(fact, answer, artifact),
    version: 1,
  };
}

function fieldPlanRefs(
  fact?: McpJobPlatformDryRunApprovedFactV1,
  answer?: McpJobPlatformDryRunApprovedAnswerArtifactV1,
  artifact?: McpJobPlatformDryRunApprovedArtifactRefV1,
): Pick<McpJobPlatformDryRunFieldPlanV1, "sourceRef" | "valueRef"> {
  if (fact) return { sourceRef: fact.sourceRef, valueRef: fact.factRef };
  if (answer) return { sourceRef: answer.sourceRef, valueRef: answer.answerRef };
  if (artifact) return { sourceRef: artifact.artifactRef, valueRef: artifact.artifactRef };
  return {};
}

function parseMappedValue(
  field: McpJobPlatformDryRunFieldDefinitionV1,
  fact: McpJobPlatformDryRunApprovedFactV1,
): ParsedValue | undefined {
  if (!fieldKindAcceptsFactValue(field.fieldKind, fact)) return undefined;
  if (field.fieldKind === "boolean") return parseMappedBooleanValue(field, fact);
  if (typeof fact.value !== "string") return undefined;
  const value = parseMappedStringValue(field, fact.value);
  return value === undefined ? undefined : mappedValue(field, fact, value);
}

function parseMappedBooleanValue(
  field: McpJobPlatformDryRunFieldDefinitionV1,
  fact: McpJobPlatformDryRunApprovedFactV1,
): ParsedValue | undefined {
  return typeof fact.value === "boolean" ? mappedValue(field, fact, fact.value) : undefined;
}

function parseMappedStringValue(
  field: McpJobPlatformDryRunFieldDefinitionV1,
  value: string,
): string | undefined {
  if (field.fieldKind === "select") return parseSelectValue(field, value);
  if (field.fieldKind === "date") return isCanonicalDate(value) ? value : undefined;
  if (field.fieldKind === "email") return isEmail(value) ? value.trim().toLowerCase() : undefined;
  if (field.fieldKind === "phone") return isPhone(value) ? value.trim() : undefined;
  if (field.fieldKind === "url") return isSafeHttpsUrl(value) ? value.trim() : undefined;
  return isTextValueAllowed(value, field.maxLength ?? 5000) ? value.trim() : undefined;
}

function parseSelectValue(
  field: McpJobPlatformDryRunFieldDefinitionV1,
  value: string,
): string | undefined {
  return (field.allowedOptionCodes ?? []).includes(value) ? value : undefined;
}

function mappedValue(
  field: McpJobPlatformDryRunFieldDefinitionV1,
  fact: McpJobPlatformDryRunApprovedFactV1,
  value: string | boolean,
): ParsedValue {
  return {
    value,
    valueKind: field.fieldKind,
    valueRef: fact.factRef,
    sourceRef: fact.sourceRef,
  };
}

function buildAttachmentPlan(
  slot: McpJobPlatformDryRunAttachmentSlotV1,
  parsed: ParsedRequest,
): McpJobPlatformDryRunAttachmentPlanV1 {
  const artifact = slot.acceptedArtifactKinds
    .map((artifactKind) =>
      parsed.approvedArtifactRefs.find((item) => item.artifactKind === artifactKind),
    )
    .find((item): item is McpJobPlatformDryRunApprovedArtifactRefV1 => item !== undefined);
  if (!artifact) {
    return {
      kind: "mcp_job_platform_dry_run_attachment_plan",
      slotId: slot.slotId,
      safeLabel: slot.safeLabel,
      required: slot.required,
      acceptedArtifactKinds: [...slot.acceptedArtifactKinds],
      mappingState: "missing",
      reasonCode: "approved_attachment_ref_missing",
      uploadAttempted: false,
      version: 1,
    };
  }
  return {
    kind: "mcp_job_platform_dry_run_attachment_plan",
    slotId: slot.slotId,
    safeLabel: slot.safeLabel,
    required: slot.required,
    acceptedArtifactKinds: [...slot.acceptedArtifactKinds],
    mappingState: "mapped",
    reasonCode: "approved_attachment_ref_mapped",
    artifactKind: artifact.artifactKind,
    artifactRef: artifact.artifactRef,
    revisionLineage: [...artifact.revisionLineage],
    uploadAttempted: false,
    version: 1,
  };
}

function buildRestrictedPreview(
  fieldPlans: readonly McpJobPlatformDryRunFieldPlanV1[],
  attachmentPlans: readonly McpJobPlatformDryRunAttachmentPlanV1[],
  parsed: ParsedRequest,
  schema: McpJobPlatformDryRunSchemaV1,
): McpJobPlatformDryRunRestrictedPreviewV1 {
  return {
    kind: "mcp_job_platform_dry_run_restricted_preview",
    visibility: "restricted_user_review_only",
    modelVisible: false,
    componentVisible: false,
    fieldValues: fieldPlans
      .flatMap((plan) => {
        const field = schema.supportedFields.find((item) => item.fieldId === plan.fieldId);
        const mapped = field
          ? findRestrictedPreviewFieldValue(plan, field, parsed)
          : undefined;
        return mapped
          ? [
              {
                fieldId: plan.fieldId,
                valueKind: mapped.valueKind,
                value: mapped.value,
                sourceRef: mapped.sourceRef,
                valueRef: mapped.valueRef,
                version: 1 as const,
              },
            ]
          : [];
      }),
    attachmentRefs: attachmentPlans
      .filter((plan) => plan.mappingState === "mapped" && plan.artifactRef && plan.artifactKind)
      .map((plan) => ({
        slotId: plan.slotId,
        artifactKind: plan.artifactKind as McpJobPlatformDryRunArtifactKindV1,
        artifactRef: plan.artifactRef as string,
        version: 1,
      })),
    version: 1,
  };
}

function findRestrictedPreviewFieldValue(
  plan: McpJobPlatformDryRunFieldPlanV1,
  field: McpJobPlatformDryRunFieldDefinitionV1,
  parsed: ParsedRequest,
): ParsedValue | undefined {
  if (plan.mappingState !== "mapped") return undefined;
  if (field.sourcePolicy === "explicit_approved_fact") {
    const fact = parsed.approvedFacts.find((item) => item.sourceKey === field.sourceKey);
    return fact ? parseMappedValue(field, fact) : undefined;
  }
  if (field.sourcePolicy === "approved_answer_artifact") {
    const answer = parsed.approvedAnswerArtifacts.find(
      (item) =>
        item.sourceKey === field.sourceKey &&
        item.questionSchemaVersion === field.questionSchemaVersion,
    );
    return answer
      ? {
          value: answer.answerText,
          valueKind: field.fieldKind,
          valueRef: answer.answerRef,
          sourceRef: answer.sourceRef,
        }
      : undefined;
  }
  if (field.sourcePolicy === "approved_artifact_ref") {
    const artifact = parsed.approvedArtifactRefs.find(
      (item) => item.artifactRef === parsed.applicationPackageRef,
    );
    return artifact
      ? {
          value: artifact.artifactRef,
          valueKind: field.fieldKind,
          valueRef: artifact.artifactRef,
          sourceRef: artifact.artifactRef,
        }
      : undefined;
  }
  return undefined;
}

function buildDigestInput(
  parsed: ParsedRequest,
  schema: McpJobPlatformDryRunSchemaV1,
  fieldPlans: readonly McpJobPlatformDryRunFieldPlanV1[],
  attachmentPlans: readonly McpJobPlatformDryRunAttachmentPlanV1[],
): unknown {
  return {
    digestKind: "job_platform_apply_dry_run_mapping",
    integrationId: schema.integrationId,
    integrationSchemaVersion: schema.schemaVersion,
    schemaFields: schema.supportedFields,
    attachmentSlots: schema.attachmentSlots,
    intendedAction: parsed.intendedAction,
    jobRef: parsed.jobRef,
    applicationPackageRef: parsed.applicationPackageRef,
    approvedFacts: parsed.approvedFacts.map((fact) => ({
      factRef: fact.factRef,
      sourceKey: fact.sourceKey,
      sourceRef: fact.sourceRef,
      valueKind: fact.valueKind,
      value: fact.value,
      approval: fact.approval,
      privacy: fact.privacy,
    })),
    approvedAnswerArtifacts: parsed.approvedAnswerArtifacts.map((answer) => ({
      answerRef: answer.answerRef,
      sourceKey: answer.sourceKey,
      sourceRef: answer.sourceRef,
      questionSchemaVersion: answer.questionSchemaVersion,
      answerText: answer.answerText,
      approved: answer.approved,
      fresh: answer.fresh,
    })),
    approvedArtifactRefs: parsed.approvedArtifactRefs.map((artifact) => ({
      artifactKind: artifact.artifactKind,
      artifactRef: artifact.artifactRef,
      approvedArtifactUpdatedAt: artifact.approvedArtifactUpdatedAt,
      currentArtifactUpdatedAt: artifact.currentArtifactUpdatedAt,
      revisionLineage: artifact.revisionLineage,
      latestApprovedRevisionRef: artifact.latestApprovedRevisionRef,
    })),
    fieldPlans,
    attachmentPlans,
    version: 1,
  };
}

function buildWriteActionProposal(
  intendedAction: McpJobPlatformDryRunActionV1,
  mappingDigest: string,
): McpWriteActionProposalV1 {
  const result = createMcpWriteActionProposal({
    kind: "mcp_write_action_intent",
    intentKind: "write_action",
    actionLabel: `dry_run_${intendedAction}`,
    actionCategory: intendedAction,
    affectedSurface: "local_fixture_job_platform_form",
    userVisibleSummary:
      "Review one dry-run job application mapping. Real execution remains disabled.",
    riskLevel: "critical",
    requiredConfirmationCopy: `PR80_REQUIRED ${mappingDigest}`,
    idempotencyKey: `mcp-write-action:${intendedAction}:${mappingDigest.slice(-16)}`,
    rollbackPlan:
      "No rollback is required for PR79 because no submit, apply, upload, network, or persistence action executes.",
    dataClasses: [
      "safe_summary",
      "generated_artifact",
      "application_material",
      "destination_metadata",
      "safe_ref",
      "audit_metadata",
    ],
    version: 1,
  });
  if (!result.allowed) {
    throw new TypeError("PR79 write-action proposal must be constructible");
  }
  return result.proposal;
}

function buildSafeCounts(
  fieldPlans: readonly McpJobPlatformDryRunFieldPlanV1[],
  attachmentPlans: readonly McpJobPlatformDryRunAttachmentPlanV1[],
): McpJobPlatformDryRunSafeCountsV1 {
  return {
    fields: fieldPlans.length,
    mappedFields: countStates(fieldPlans, "mapped"),
    missingFields: countStates(fieldPlans, "missing"),
    missingRequiredFields: fieldPlans.filter(
      (plan) => plan.required && plan.mappingState === "missing",
    ).length,
    requiredBlockingFields: fieldPlans.filter(isRequiredBlockingFieldPlan).length,
    humanInputRequiredFields: countStates(fieldPlans, "human_input_required"),
    unsupportedFields: countStates(fieldPlans, "unsupported"),
    blockedByPolicyFields: countStates(fieldPlans, "blocked_by_policy"),
    invalidFields: countStates(fieldPlans, "invalid_value"),
    attachmentSlots: attachmentPlans.length,
    mappedAttachments: attachmentPlans.filter((plan) => plan.mappingState === "mapped").length,
    missingAttachments: attachmentPlans.filter((plan) => plan.mappingState === "missing").length,
    version: 1,
  };
}

function deriveDryRunStatus(
  fieldPlans: readonly McpJobPlatformDryRunFieldPlanV1[],
  attachmentPlans: readonly McpJobPlatformDryRunAttachmentPlanV1[],
): McpJobPlatformDryRunStatusV1 {
  const requiredFieldPlans = fieldPlans.filter((plan) => plan.required);
  const requiredAttachmentPlans = attachmentPlans.filter((plan) => plan.required);
  if (
    requiredFieldPlans.some((plan) => plan.mappingState === "unsupported") ||
    requiredAttachmentPlans.some((plan) => plan.mappingState === "unsupported")
  ) {
    return "unsupported_schema";
  }
  if (
    requiredFieldPlans.some((plan) => plan.mappingState === "human_input_required")
  ) {
    return "human_input_required";
  }
  if (
    requiredFieldPlans.some((plan) =>
      ["missing", "blocked_by_policy", "invalid_value"].includes(plan.mappingState),
    ) ||
    requiredAttachmentPlans.some((plan) => plan.mappingState !== "mapped")
  ) {
    return "missing_required_data";
  }
  return "mapping_complete";
}

function buildSafeSummary(input: Readonly<{
  allowed: boolean;
  dryRunCreated: boolean;
  dryRunStatus: McpJobPlatformDryRunStatusV1;
  parsed?: ParsedRequest;
  mappingDigest?: string;
  mappingRef?: string;
  safeCounts?: McpJobPlatformDryRunSafeCountsV1;
  fieldPlans: readonly McpJobPlatformDryRunFieldPlanV1[];
  attachmentPlans: readonly McpJobPlatformDryRunAttachmentPlanV1[];
  auditEvent: McpJobPlatformDryRunAuditEventV1;
}>): McpJobPlatformDryRunSafeSummaryV1 {
  return {
    kind: "mcp_job_platform_apply_dry_run_safe_summary",
    allowed: input.allowed,
    dryRunCreated: input.dryRunCreated,
    dryRunStatus: input.dryRunStatus,
    ...(input.parsed
      ? {
          intendedAction: input.parsed.intendedAction,
          integrationId: input.parsed.integrationId,
          integrationSchemaVersion: input.parsed.integrationSchemaVersion,
          jobRef: input.parsed.jobRef,
          applicationPackageRef: input.parsed.applicationPackageRef,
        }
      : {}),
    ...(input.mappingDigest ? { mappingDigest: input.mappingDigest } : {}),
    ...(input.mappingRef ? { mappingRef: input.mappingRef } : {}),
    ...(input.safeCounts ? { safeCounts: input.safeCounts } : {}),
    mappedFieldPlans: input.fieldPlans,
    missingRequiredFieldIds: input.fieldPlans
      .filter((plan) => plan.required && plan.mappingState === "missing")
      .map((plan) => plan.fieldId),
    requiredBlockingFieldIds: input.fieldPlans
      .filter(isRequiredBlockingFieldPlan)
      .map((plan) => plan.fieldId),
    humanInputRequiredFieldIds: input.fieldPlans
      .filter((plan) => plan.mappingState === "human_input_required")
      .map((plan) => plan.fieldId),
    unsupportedFieldIds: input.fieldPlans
      .filter((plan) => plan.mappingState === "unsupported")
      .map((plan) => plan.fieldId),
    attachmentPlans: input.attachmentPlans,
    auditEvent: input.auditEvent,
    humanReviewRequired: true,
    liveConfirmationRequired: true,
    liveExecutionAllowed: false,
    applyAttempted: false,
    submitAttempted: false,
    uploadAttempted: false,
    writeActionExecuted: false,
    realExecutionAllowed: false,
    networkRequestExecuted: false,
    externalSideEffect: false,
    localPersistenceWrite: false,
    credentialStorage: "none",
    tokenStorage: "none",
    version: 1,
  };
}

function buildBlockedResult(
  reason: Extract<McpJobPlatformDryRunResultV1, { allowed: false }>["reason"],
  parsed?: ParsedRequest,
  schema?: McpJobPlatformDryRunSchemaV1,
): McpJobPlatformDryRunResultV1 {
  const dryRunStatus: McpJobPlatformDryRunStatusV1 =
    reason === "unsupported_schema" ? "unsupported_schema" : "blocked";
  const auditEvent = buildAuditEvent({
    eventKind: "job_platform_apply_dry_run_blocked",
    dryRunStatus,
    parsed,
  });
  return {
    ...buildSafeSummary({
      allowed: false,
      dryRunCreated: false,
      dryRunStatus,
      parsed:
        parsed && schema && parsed.integrationSchemaVersion === schema.schemaVersion
          ? parsed
          : undefined,
      fieldPlans: [],
      attachmentPlans: [],
      auditEvent,
    }),
    kind: "mcp_job_platform_apply_dry_run_result",
    allowed: false,
    dryRunCreated: false,
    reason,
    safeRefusal: buildSafeRefusal(),
  };
}

function buildAuditEvent(input: Readonly<{
  eventKind: McpJobPlatformDryRunAuditEventV1["eventKind"];
  dryRunStatus: McpJobPlatformDryRunStatusV1;
  parsed?: ParsedRequest;
  mappingDigest?: string;
  mappingRef?: string;
  safeCounts?: McpJobPlatformDryRunSafeCountsV1;
}>): McpJobPlatformDryRunAuditEventV1 {
  return {
    kind: "mcp_job_platform_dry_run_audit_event",
    eventKind: input.eventKind,
    dryRunStatus: input.dryRunStatus,
    ...(input.parsed
      ? {
          intendedAction: input.parsed.intendedAction,
          integrationId: input.parsed.integrationId,
          integrationSchemaVersion: input.parsed.integrationSchemaVersion,
          jobRef: input.parsed.jobRef,
          applicationPackageRef: input.parsed.applicationPackageRef,
        }
      : {}),
    ...(input.mappingDigest ? { mappingDigest: input.mappingDigest } : {}),
    ...(input.mappingRef ? { mappingRef: input.mappingRef } : {}),
    ...(input.safeCounts ? { safeCounts: input.safeCounts } : {}),
    rawDataExposed: false,
    applyAttempted: false,
    submitAttempted: false,
    uploadAttempted: false,
    writeActionExecuted: false,
    networkRequestExecuted: false,
    externalSideEffect: false,
    localPersistenceWrite: false,
    credentialStorage: "none",
    tokenStorage: "none",
    version: 1,
  };
}

function buildSafeRefusal(): McpJobPlatformDryRunSafeRefusalV1 {
  return {
    kind: "mcp_job_platform_apply_dry_run_safe_refusal",
    code: "job_platform_apply_dry_run_blocked",
    msg: "Refused. Job platform dry run blocked.",
    safeForModel: true,
    rawDataExposed: false,
    applyAttempted: false,
    submitAttempted: false,
    uploadAttempted: false,
    writeActionExecuted: false,
    networkRequestExecuted: false,
    externalSideEffect: false,
    version: 1,
  };
}

function countStates(
  plans: readonly McpJobPlatformDryRunFieldPlanV1[],
  state: McpJobPlatformDryRunMappingStateV1,
): number {
  return plans.filter((plan) => plan.mappingState === state).length;
}

function isRequiredBlockingFieldPlan(plan: McpJobPlatformDryRunFieldPlanV1): boolean {
  return (
    plan.required &&
    [
      "missing",
      "invalid_value",
      "blocked_by_policy",
      "unsupported",
      "human_input_required",
    ].includes(plan.mappingState)
  );
}

function fieldKindAcceptsFactValue(
  fieldKind: McpJobPlatformDryRunFieldKindV1,
  fact: McpJobPlatformDryRunApprovedFactV1,
): boolean {
  if (fieldKind === "attestation" || fieldKind === "artifact_ref") return false;
  return fact.valueKind === fieldKind;
}

function isFieldPolicyCoherent(field: McpJobPlatformDryRunFieldDefinitionV1): boolean {
  if (field.sourcePolicy === "approved_artifact_ref") {
    return field.fieldKind === "artifact_ref";
  }
  if (field.sourcePolicy === "approved_answer_artifact") {
    return field.fieldKind === "short_text" || field.fieldKind === "long_text";
  }
  if (field.sourcePolicy === "explicit_approved_fact") {
    return field.fieldKind !== "artifact_ref" && field.fieldKind !== "attestation";
  }
  if (field.sourcePolicy === "human_only") {
    return field.humanInputPolicy === "human_only";
  }
  return field.sourcePolicy === "unsupported";
}

function isHumanOnlySensitiveField(
  field: McpJobPlatformDryRunFieldDefinitionV1,
): boolean {
  return Boolean(
    field.humanInputPolicy === "human_only" ||
      field.sensitivity === "legally_significant" ||
      (field.sourceKey && SENSITIVE_HUMAN_ONLY_SOURCE_KEYS.has(field.sourceKey)),
  );
}

function buildDeterministicDigest(value: unknown): string {
  return `fnv1a32:${fnv1a32(stableSerialize(value))}`;
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  forEachUtf8Byte(value, (byte) => {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  });
  return hash.toString(16).padStart(8, "0");
}

function forEachUtf8Byte(value: string, visitor: (byte: number) => void): void {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;
    if (codePoint <= 0x7f) {
      visitor(codePoint);
    } else if (codePoint <= 0x7ff) {
      visitor(0xc0 | (codePoint >> 6));
      visitor(0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      visitor(0xe0 | (codePoint >> 12));
      visitor(0x80 | ((codePoint >> 6) & 0x3f));
      visitor(0x80 | (codePoint & 0x3f));
    } else {
      visitor(0xf0 | (codePoint >> 18));
      visitor(0x80 | ((codePoint >> 12) & 0x3f));
      visitor(0x80 | ((codePoint >> 6) & 0x3f));
      visitor(0x80 | (codePoint & 0x3f));
    }
  }
}

function readFieldKind(value: unknown): McpJobPlatformDryRunFieldKindV1 | undefined {
  return typeof value === "string" && FIELD_KINDS.has(value as McpJobPlatformDryRunFieldKindV1)
    ? (value as McpJobPlatformDryRunFieldKindV1)
    : undefined;
}

function readSourcePolicy(
  value: unknown,
): McpJobPlatformDryRunSourcePolicyV1 | undefined {
  return typeof value === "string" &&
    SOURCE_POLICIES.has(value as McpJobPlatformDryRunSourcePolicyV1)
    ? (value as McpJobPlatformDryRunSourcePolicyV1)
    : undefined;
}

function readSensitivity(value: unknown): McpJobPlatformDryRunSensitivityV1 | undefined {
  return typeof value === "string" &&
    SENSITIVITIES.has(value as McpJobPlatformDryRunSensitivityV1)
    ? (value as McpJobPlatformDryRunSensitivityV1)
    : undefined;
}

function readHumanInputPolicy(
  value: unknown,
): McpJobPlatformDryRunHumanInputPolicyV1 | undefined {
  return typeof value === "string" &&
    HUMAN_INPUT_POLICIES.has(value as McpJobPlatformDryRunHumanInputPolicyV1)
    ? (value as McpJobPlatformDryRunHumanInputPolicyV1)
    : undefined;
}

function readArtifactKind(value: unknown): McpJobPlatformDryRunArtifactKindV1 | undefined {
  return typeof value === "string" &&
    ARTIFACT_KINDS.has(value as McpJobPlatformDryRunArtifactKindV1)
    ? (value as McpJobPlatformDryRunArtifactKindV1)
    : undefined;
}

function isDryRunAction(value: unknown): value is McpJobPlatformDryRunActionV1 {
  return value === "apply_to_job" || value === "submit_application";
}

function isFactPrivacy(value: unknown): value is McpJobPlatformDryRunApprovedFactV1["privacy"] {
  return value === "standard" || value === "private" || value === "never_use";
}

function isFactValue(value: unknown): value is string | boolean {
  return typeof value === "string" || typeof value === "boolean";
}

function isSafeFieldId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-z][a-z0-9_]{1,80}$/u.test(value) &&
    !containsUnsafeText(value)
  );
}

function isSafeSourceKey(value: unknown): value is string {
  return isSafeFieldId(value);
}

function isSafeLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /\S/u.test(value) &&
    value.length <= 120 &&
    !containsUnsafeText(value)
  );
}

function readOptionalSourceKey(value: unknown): string | undefined | false {
  if (value === undefined) return undefined;
  return isSafeSourceKey(value) ? value : false;
}

function readOptionalSchemaVersion(value: unknown): string | undefined | false {
  if (value === undefined) return undefined;
  return isSafeSchemaVersion(value) ? value : false;
}

function readOptionalPositiveInteger(
  value: unknown,
  max: number,
): number | undefined | false {
  if (value === undefined) return undefined;
  return Number.isInteger(value) && (value as number) > 0 && (value as number) <= max
    ? (value as number)
    : false;
}

function readOptionalOptionCodes(
  value: unknown,
): readonly string[] | undefined | false {
  if (value === undefined) return undefined;
  const values = readStringArray(value);
  if (
    !values ||
    values.length === 0 ||
    values.length > 50 ||
    values.some((item) => !/^[a-z][a-z0-9_:-]{0,80}$/u.test(item))
  ) {
    return false;
  }
  return [...new Set(values)].sort(compareStrings);
}

function readArtifactKindArray(
  value: unknown,
): readonly McpJobPlatformDryRunArtifactKindV1[] | undefined {
  const values = readStringArray(value);
  if (!values) return undefined;
  const artifactKinds = values.map(readArtifactKind);
  if (artifactKinds.some((kind) => kind === undefined)) return undefined;
  return artifactKinds.filter(
    (kind, index): kind is McpJobPlatformDryRunArtifactKindV1 =>
      kind !== undefined && artifactKinds.indexOf(kind) === index,
  );
}

function readStringArray(value: unknown): readonly string[] | undefined {
  const values = readArrayValues(value);
  if (!values || values.some((item) => typeof item !== "string")) return undefined;
  return values as string[];
}

function isSafeSchemaVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-z0-9][a-z0-9._:-]{1,96}$/u.test(value) &&
    !containsUnsafeText(value)
  );
}

function isSafeRef(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = value
    .normalize("NFKC")
    .replace(/[\s_/-]/gu, "")
    .toLowerCase();
  return (
    /^mcp-safe-ref:[a-z0-9][a-z0-9._:-]{1,180}$/u.test(value) &&
    !FORBIDDEN_SAFE_REF_TOKENS.test(normalized) &&
    !containsUnsafeText(value)
  );
}

function isSafeArtifactRefForKind(
  value: unknown,
  artifactKind: McpJobPlatformDryRunArtifactKindV1,
): value is string {
  if (typeof value !== "string") return false;
  const prefixByKind: Record<McpJobPlatformDryRunArtifactKindV1, string> = {
    resume_variant: "mcp-safe-ref:resume-variant:",
    cover_letter: "mcp-safe-ref:cover-letter:",
    application_package: "mcp-safe-ref:application-package:",
  };
  return value.startsWith(prefixByKind[artifactKind]) && isSafeRef(value);
}

function isEmail(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length <= 254 &&
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/iu.test(normalized) &&
    !/[\s,;]/u.test(normalized)
  );
}

function isPhone(value: string): boolean {
  const normalized = value.trim();
  return /^\+?[0-9][0-9 .()-]{6,38}$/u.test(normalized) && !containsUnsafeText(value);
}

function isSafeHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      parsed.hash === "" &&
      parsed.hostname.length > 0 &&
      !containsUnsafeText(value)
    );
  } catch {
    return false;
  }
}

function isCanonicalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isTextValueAllowed(value: string, maxLength: number): boolean {
  const normalized = value.normalize("NFKC");
  return (
    /\S/u.test(normalized) &&
    normalized.length <= maxLength &&
    !/[\u0000-\u001f\u007f]/u.test(normalized) &&
    !containsUnsafeText(normalized)
  );
}

function containsUnsafeText(value: string): boolean {
  return UNSAFE_TEXT_PATTERNS.some((pattern) => pattern.test(value.normalize("NFKC")));
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function hasDuplicate(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function readExactRecord(
  input: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | undefined {
  const record = readPlainObjectRecord(input);
  if (!record) return undefined;
  if (!Object.keys(record).every((key) => allowedKeys.includes(key))) return undefined;
  if (!requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key))) {
    return undefined;
  }
  return record;
}

function readPlainObjectRecord(input: unknown): Record<string, unknown> | undefined {
  const descriptors = readPlainObjectDescriptors(input);
  if (!descriptors) return undefined;
  try {
    const record: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return undefined;
      const descriptor = descriptors[key];
      if (!isEnumerableDataDescriptor(descriptor)) return undefined;
      record[key] = descriptor.value;
    }
    return record;
  } catch {
    return undefined;
  }
}

function readPlainObjectDescriptors(
  input: unknown,
): Record<PropertyKey, PropertyDescriptor | undefined> | undefined {
  try {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      return undefined;
    }
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    return Object.getOwnPropertyDescriptors(input);
  } catch {
    return undefined;
  }
}

function readArrayValues(input: unknown): readonly unknown[] | undefined {
  try {
    if (!Array.isArray(input)) return undefined;
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const arrayLength = readArrayDescriptorLength(descriptors.length);
    if (arrayLength === undefined) return undefined;
    if (!hasOnlyArrayIndexDescriptorKeys(descriptors, arrayLength)) return undefined;
    return readDenseArrayDescriptorValues(descriptors, arrayLength);
  } catch {
    return undefined;
  }
}

function readParsedArray<T>(
  input: unknown,
  parseItem: (item: unknown) => T | undefined,
): T[] | undefined {
  const values = readArrayValues(input);
  if (!values) return undefined;
  const parsed = values.map(parseItem);
  return parsed.some((item) => item === undefined) ? undefined : (parsed as T[]);
}

function readArrayDescriptorLength(descriptor: PropertyDescriptor | undefined): number | undefined {
  if (!isDataDescriptor(descriptor) || typeof descriptor.value !== "number") return undefined;
  if (!Number.isInteger(descriptor.value) || descriptor.value < 0) return undefined;
  return descriptor.value;
}

function hasOnlyArrayIndexDescriptorKeys(
  descriptors: Record<PropertyKey, PropertyDescriptor | undefined>,
  length: number,
): boolean {
  return Reflect.ownKeys(descriptors).every(
    (key) => key === "length" || isArrayIndexDescriptorKey(key, length),
  );
}

function isArrayIndexDescriptorKey(key: PropertyKey, length: number): boolean {
  if (typeof key !== "string" || !/^(0|[1-9]\d*)$/u.test(key)) return false;
  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

function readDenseArrayDescriptorValues(
  descriptors: Record<PropertyKey, PropertyDescriptor | undefined>,
  length: number,
): readonly unknown[] | undefined {
  const output: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!isEnumerableDataDescriptor(descriptor)) return undefined;
    output.push(descriptor.value);
  }
  return output;
}

function isEnumerableDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return (
    descriptor !== undefined &&
    descriptor.enumerable === true &&
    Object.prototype.hasOwnProperty.call(descriptor, "value")
  );
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, "value");
}

function compareStrings(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
