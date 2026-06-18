import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1,
  createMcpJobPlatformApplyDryRun,
  createMcpJobPlatformDryRunSafeSummary,
  type McpJobPlatformDryRunFieldDefinitionV1,
  type McpJobPlatformDryRunResultV1,
  type McpJobPlatformDryRunSchemaV1,
} from "../mcpJobPlatformApplyDryRun";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const DRY_RUN_SOURCE_FILE = resolve(TEST_DIR, "../mcpJobPlatformApplyDryRun.ts");

const REQUESTED_AT = "2026-06-18T17:20:00.000Z";
const REVIEWED_AT = "2026-06-18T17:10:00.000Z";
const ARTIFACT_UPDATED_AT = "2026-06-18T17:00:00.000Z";
const JOB_REF = "mcp-safe-ref:job-target:fixture1";
const APPLICATION_PACKAGE_REF = "mcp-safe-ref:application-package:pkg1";
const RESUME_REF = "mcp-safe-ref:resume-variant:resume1";
const COVER_LETTER_REF = "mcp-safe-ref:cover-letter:letter1";
const EVIDENCE_SOURCE_REF = "mcp-safe-ref:evidence-graph:profile";

const SAFE_OUTPUT_FORBIDDEN_FRAGMENTS = [
  "Alex Rivera",
  "alex.rivera@example.test",
  "+15550101234",
  "https://portfolio.example/profile",
  "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
  "NEVER_USE_SENTINEL_DO_NOT_EXPOSE",
  "SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
  "SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE",
] as const;

const FORBIDDEN_SOURCE_PATTERNS = [
  /fetch\s*\(/iu,
  /axios/iu,
  /undici/iu,
  /node:http/iu,
  /node:https/iu,
  /http\.request/iu,
  /https\.request/iu,
  /XMLHttpRequest/iu,
  /WebSocket/iu,
  /EventSource/iu,
  /dns\./iu,
  /playwright/iu,
  /puppeteer/iu,
  /selenium/iu,
  /page\.click/iu,
  /browser\.newPage/iu,
  /sendMcpApprovedApplicationMessage/iu,
  /OpenAI/iu,
  /chat\.completions/iu,
  /responses\.create/iu,
  /registerTool/iu,
  /registerResource/iu,
  /tools\/list/iu,
  /tools\/call/iu,
  /window\.openai/iu,
  /postMessage/iu,
  /\bmutation\s*\(/iu,
  /\binternalMutation\s*\(/iu,
  /\baction\s*\(/iu,
  /\binternalAction\s*\(/iu,
  /writeFile/iu,
  /appendFile/iu,
  /createWriteStream/iu,
] as const;

type JsonRecord = Record<string, unknown>;
type RequestFixture = JsonRecord & {
  approvedFacts: JsonRecord[];
  sourceBindings: JsonRecord[];
  approvedAnswerArtifacts: JsonRecord[];
  approvedArtifactRefs: JsonRecord[];
};
type AllowedResult = Extract<McpJobPlatformDryRunResultV1, { allowed: true }>;

function approval(overrides: JsonRecord = {}): JsonRecord {
  return {
    approved: true,
    fresh: true,
    allowedForApplicationUse: true,
    reviewedAt: REVIEWED_AT,
    version: 1,
    ...overrides,
  };
}

function sourceRefFor(sourceKey: string): string {
  const refs: Record<string, string> = {
    candidate_full_name: "mcp-safe-ref:evidence-graph:name",
    candidate_email: "mcp-safe-ref:evidence-graph:contact",
    candidate_phone: "mcp-safe-ref:evidence-graph:phone",
    portfolio_url: "mcp-safe-ref:evidence-graph:portfolio",
    earliest_start_date: "mcp-safe-ref:evidence-graph:start",
    remote_preference: "mcp-safe-ref:evidence-graph:mode",
    screening_motivation: "mcp-safe-ref:evidence-graph:motivation",
    willing_to_travel: "mcp-safe-ref:evidence-graph:travel",
    work_authorization: "mcp-safe-ref:evidence-graph:authz",
    salary_expectation: "mcp-safe-ref:evidence-graph:salary",
  };
  return refs[sourceKey] ?? EVIDENCE_SOURCE_REF;
}

function factRefFor(sourceKey: string): string {
  const refs: Record<string, string> = {
    candidate_full_name: "mcp-safe-ref:candidate-fact:name",
    candidate_email: "mcp-safe-ref:candidate-fact:contact",
    candidate_phone: "mcp-safe-ref:candidate-fact:phone",
    portfolio_url: "mcp-safe-ref:candidate-fact:portfolio",
    earliest_start_date: "mcp-safe-ref:candidate-fact:start",
    remote_preference: "mcp-safe-ref:candidate-fact:mode",
    willing_to_travel: "mcp-safe-ref:candidate-fact:travel",
    work_authorization: "mcp-safe-ref:candidate-fact:authz",
    salary_expectation: "mcp-safe-ref:candidate-fact:salary",
  };
  return refs[sourceKey] ?? `mcp-safe-ref:candidate-fact:${sourceKey}`;
}

function makeFact(
  sourceKey: string,
  valueKind: string,
  value: string | boolean,
  overrides: JsonRecord = {},
): JsonRecord {
  return {
    kind: "mcp_job_platform_dry_run_approved_fact",
    factRef: factRefFor(sourceKey),
    sourceKey,
    sourceRef: sourceRefFor(sourceKey),
    valueKind,
    value,
    approval: approval(),
    privacy: "standard",
    version: 1,
    ...overrides,
  };
}

function makeSourceBinding(sourceKey: string, overrides: JsonRecord = {}): JsonRecord {
  return {
    kind: "mcp_job_platform_dry_run_source_binding",
    sourceKey,
    sourceRef: sourceRefFor(sourceKey),
    version: 1,
    ...overrides,
  };
}

function makeAnswer(overrides: JsonRecord = {}): JsonRecord {
  return {
    kind: "mcp_job_platform_dry_run_approved_answer_artifact",
    answerRef: "mcp-safe-ref:screening-answer:motivation",
    sourceKey: "screening_motivation",
    sourceRef: sourceRefFor("screening_motivation"),
    questionSchemaVersion: "local_fixture_screening_question_v1",
    answerText: "I have approved this concise screening answer for this role.",
    approved: true,
    fresh: true,
    version: 1,
    ...overrides,
  };
}

function makeArtifact(
  artifactKind: "application_package" | "resume_variant" | "cover_letter",
  artifactRef: string,
  overrides: JsonRecord = {},
): JsonRecord {
  return {
    kind: "mcp_job_platform_dry_run_approved_artifact_ref",
    artifactKind,
    artifactRef,
    approvedArtifactUpdatedAt: ARTIFACT_UPDATED_AT,
    currentArtifactUpdatedAt: ARTIFACT_UPDATED_AT,
    revisionLineage: [artifactRef],
    latestApprovedRevisionRef: artifactRef,
    hasPendingRevision: false,
    version: 1,
    ...overrides,
  };
}

function baseFacts(): JsonRecord[] {
  return [
    makeFact("candidate_full_name", "short_text", "Alex Rivera"),
    makeFact("candidate_email", "email", "alex.rivera@example.test"),
    makeFact("candidate_phone", "phone", "+15550101234"),
    makeFact("portfolio_url", "url", "https://portfolio.example/profile"),
    makeFact("earliest_start_date", "date", "2026-07-01"),
    makeFact("remote_preference", "select", "remote"),
  ];
}

function baseSourceBindings(extraKeys: readonly string[] = []): JsonRecord[] {
  return [
    "candidate_full_name",
    "candidate_email",
    "candidate_phone",
    "portfolio_url",
    "earliest_start_date",
    "remote_preference",
    "screening_motivation",
    ...extraKeys,
  ].map((sourceKey) => makeSourceBinding(sourceKey));
}

function baseRequest(overrides: JsonRecord = {}): RequestFixture {
  return {
    kind: "mcp_job_platform_apply_dry_run_request",
    integrationId: "local_fixture_job_platform_v1",
    integrationSchemaVersion: LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1.schemaVersion,
    intendedAction: "apply_to_job",
    jobRef: JOB_REF,
    applicationPackageRef: APPLICATION_PACKAGE_REF,
    approvedFacts: baseFacts(),
    sourceBindings: baseSourceBindings(),
    approvedAnswerArtifacts: [makeAnswer()],
    approvedArtifactRefs: [
      makeArtifact("application_package", APPLICATION_PACKAGE_REF),
      makeArtifact("resume_variant", RESUME_REF),
      makeArtifact("cover_letter", COVER_LETTER_REF),
    ],
    requestedAt: REQUESTED_AT,
    version: 1,
    ...overrides,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeSchema(
  overrides: Partial<McpJobPlatformDryRunSchemaV1> = {},
): McpJobPlatformDryRunSchemaV1 {
  return {
    ...clone(LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1),
    ...overrides,
  };
}

function withFields(
  fields: readonly McpJobPlatformDryRunFieldDefinitionV1[],
  overrides: Partial<McpJobPlatformDryRunSchemaV1> = {},
): McpJobPlatformDryRunSchemaV1 {
  return makeSchema({
    supportedFields: fields,
    ...overrides,
  });
}

function addField(
  schema: McpJobPlatformDryRunSchemaV1,
  field: McpJobPlatformDryRunFieldDefinitionV1,
): McpJobPlatformDryRunSchemaV1 {
  return withFields([...schema.supportedFields, field], {
    schemaVersion: schema.schemaVersion,
    attachmentSlots: schema.attachmentSlots,
  });
}

function fieldById(fieldId: string): McpJobPlatformDryRunFieldDefinitionV1 {
  const field = LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1.supportedFields.find(
    (item) => item.fieldId === fieldId,
  );
  if (!field) throw new TypeError(`Missing field ${fieldId}`);
  return field;
}

function run(
  request: RequestFixture = baseRequest(),
  schema?: McpJobPlatformDryRunSchemaV1,
): McpJobPlatformDryRunResultV1 {
  return createMcpJobPlatformApplyDryRun(
    request,
    schema ? { schema } : undefined,
  );
}

function expectAllowed(result: McpJobPlatformDryRunResultV1): asserts result is AllowedResult {
  expect(result.allowed).toBe(true);
  expect(result.dryRunCreated).toBe(true);
}

function expectNoExecution(value: {
  applyAttempted: false;
  submitAttempted: false;
  uploadAttempted: false;
  writeActionExecuted: false;
  networkRequestExecuted: false;
  externalSideEffect: false;
}): void {
  expect(value.applyAttempted).toBe(false);
  expect(value.submitAttempted).toBe(false);
  expect(value.uploadAttempted).toBe(false);
  expect(value.writeActionExecuted).toBe(false);
  expect(value.networkRequestExecuted).toBe(false);
  expect(value.externalSideEffect).toBe(false);
}

function expectAmbiguousBlocked(result: McpJobPlatformDryRunResultV1): void {
  expect(result.allowed).toBe(false);
  if (!result.allowed) {
    expect(result.reason).toBe("ambiguous_input");
  }
  expect(result.dryRunStatus).toBe("blocked");
  expectNoExecution(result);
  expectSafeSummaryHasNoRawValues(result);
}

function plan(result: McpJobPlatformDryRunResultV1, fieldId: string) {
  const item = result.mappedFieldPlans.find((fieldPlan) => fieldPlan.fieldId === fieldId);
  if (!item) throw new TypeError(`Missing field plan ${fieldId}`);
  return item;
}

function previewValue(result: AllowedResult, fieldId: string) {
  const item = result.restrictedPreview.fieldValues.find((field) => field.fieldId === fieldId);
  if (!item) throw new TypeError(`Missing preview value ${fieldId}`);
  return item;
}

function safeSummary(result: McpJobPlatformDryRunResultV1) {
  return createMcpJobPlatformDryRunSafeSummary(result);
}

function expectSafeSummaryHasNoRawValues(result: McpJobPlatformDryRunResultV1): void {
  const summary = safeSummary(result);
  assertLocalMcpPrivacySafeOutput(summary);
  const serialized = JSON.stringify(summary);
  for (const fragment of SAFE_OUTPUT_FORBIDDEN_FRAGMENTS) {
    expect(serialized).not.toContain(fragment);
  }
}

function replaceFact(
  request: RequestFixture,
  sourceKey: string,
  replacement: JsonRecord | undefined,
): RequestFixture {
  const copy = clone(request);
  copy.approvedFacts = copy.approvedFacts.filter((fact) => fact.sourceKey !== sourceKey);
  if (replacement) copy.approvedFacts.push(replacement);
  return copy;
}

function replaceBinding(
  request: RequestFixture,
  sourceKey: string,
  replacement: JsonRecord,
): RequestFixture {
  const copy = clone(request);
  copy.sourceBindings = copy.sourceBindings.map((binding) =>
    binding.sourceKey === sourceKey ? replacement : binding,
  );
  return copy;
}

function stripSourceComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/\/\/[^\n\r]*/gu, "");
}

describe("createMcpJobPlatformApplyDryRun", () => {
  it("creates a complete dry-run mapping without live apply, submit, upload, or network effects", () => {
    const result = run();

    expectAllowed(result);
    expect(result.dryRunStatus).toBe("mapping_complete");
    expect(result.mappingDigest).toMatch(/^fnv1a32:[a-f0-9]{8}$/u);
    expect(result.mappingRef).toMatch(/^mcp-safe-ref:job-platform-dry-run:/u);
    expect(result.humanReviewRequired).toBe(true);
    expect(result.liveConfirmationRequired).toBe(true);
    expect(result.liveExecutionAllowed).toBe(false);
    expect(result.realExecutionAllowed).toBe(false);
    expectNoExecution(result);
    expectNoExecution(result.auditEvent);
    expect(result.localPersistenceWrite).toBe(false);
    expect(result.credentialStorage).toBe("none");
    expect(result.tokenStorage).toBe("none");
    expect(result.writeActionProposal.actionCategory).toBe("apply_to_job");
    expect(result.writeActionProposal.riskLevel).toBe("critical");
    expect(result.writeActionProposal.realExecutionAllowed).toBe(false);
    expect(result.writeActionProposal.writeActionExecuted).toBe(false);
    expect(result.writeActionProposal.networkAccess).toBe(false);
    expect(result.restrictedPreview.modelVisible).toBe(false);
    expect(result.restrictedPreview.componentVisible).toBe(false);
    expect(previewValue(result, "candidate_email").value).toBe(
      "alex.rivera@example.test",
    );
    expect(previewValue(result, "candidate_full_name").value).toBe("Alex Rivera");
    expect(result.attachmentPlans.every((item) => item.uploadAttempted === false)).toBe(
      true,
    );
    expectSafeSummaryHasNoRawValues(result);
  });

  it("produces a deterministic digest and stable sorted field order", () => {
    const first = run();
    const second = run();

    expectAllowed(first);
    expectAllowed(second);
    expect(first.mappingDigest).toBe(second.mappingDigest);
    expect(first.mappedFieldPlans.map((field) => field.fieldId)).toEqual(
      [...first.mappedFieldPlans.map((field) => field.fieldId)].sort(),
    );
  });

  it("changes the mapping digest when the job, schema, facts, artifacts, or intended action changes", () => {
    const baseline = run();
    expectAllowed(baseline);

    const schemaV2 = makeSchema({
      schemaVersion: "local_fixture_job_platform_v1.schema.2",
    });
    const schemaFieldChanged = withFields(
      [
        ...LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1.supportedFields.filter(
          (field) => field.fieldId !== "candidate_phone",
        ),
        { ...fieldById("candidate_phone"), safeLabel: "Phone number" },
      ],
      { schemaVersion: "local_fixture_job_platform_v1.schema.3" },
    );
    const artifactChanged = baseRequest({
      approvedArtifactRefs: [
        makeArtifact("application_package", APPLICATION_PACKAGE_REF),
        makeArtifact("resume_variant", "mcp-safe-ref:resume-variant:resume2"),
        makeArtifact("cover_letter", COVER_LETTER_REF),
      ],
    });

    const variants = [
      run(baseRequest({ jobRef: "mcp-safe-ref:job-target:fixture2" })),
      run(
        baseRequest({
          integrationSchemaVersion: schemaV2.schemaVersion,
        }),
        schemaV2,
      ),
      run(
        baseRequest({
          integrationSchemaVersion: schemaFieldChanged.schemaVersion,
        }),
        schemaFieldChanged,
      ),
      run(
        replaceFact(
          baseRequest(),
          "candidate_full_name",
          makeFact("candidate_full_name", "short_text", "Alex Morgan"),
        ),
      ),
      run(artifactChanged),
      run(baseRequest({ intendedAction: "submit_application" })),
    ];

    for (const variant of variants) {
      expectAllowed(variant);
      expect(variant.mappingDigest).not.toBe(baseline.mappingDigest);
    }
  });

  it("reports missing required data instead of fabricating required values", () => {
    const result = run(replaceFact(baseRequest(), "candidate_email", undefined));

    expectAllowed(result);
    expect(result.dryRunStatus).toBe("missing_required_data");
    expect(result.missingRequiredFieldIds).toEqual(["candidate_email"]);
    expect(result.requiredBlockingFieldIds).toEqual(["candidate_email"]);
    expect(result.safeCounts?.requiredBlockingFields).toBe(1);
    expect(plan(result, "candidate_email").mappingState).toBe("missing");
    expect(result.restrictedPreview.fieldValues.map((field) => field.fieldId)).not.toContain(
      "candidate_email",
    );
    expectSafeSummaryHasNoRawValues(result);
  });

  it("requires direct human input for required human-only fields and never defaults consent", () => {
    const schema = withFields(
      LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1.supportedFields.map((field) =>
        field.fieldId === "terms_attestation" ? { ...field, required: true } : field,
      ),
    );
    const result = run(baseRequest(), schema);

    expectAllowed(result);
    expect(result.dryRunStatus).toBe("human_input_required");
    expect(result.humanInputRequiredFieldIds).toContain("terms_attestation");
    expect(result.requiredBlockingFieldIds).toContain("terms_attestation");
    expect(plan(result, "terms_attestation").mappingState).toBe("human_input_required");
    expect(result.restrictedPreview.fieldValues.map((field) => field.fieldId)).not.toContain(
      "terms_attestation",
    );
  });

  it("keeps legally significant fields human-only even if facts are provided", () => {
    const request = baseRequest({
      approvedFacts: [
        ...baseFacts(),
        makeFact("work_authorization", "select", "authorized"),
        makeFact("sponsorship_required", "boolean", false),
        makeFact("salary_expectation", "short_text", "$120k"),
        makeFact("relocation", "boolean", true),
        makeFact("eeo_disability_status", "select", "decline"),
      ],
      sourceBindings: baseSourceBindings([
        "work_authorization",
        "sponsorship_required",
        "salary_expectation",
        "relocation",
        "eeo_disability_status",
      ]),
    });
    const result = run(request);

    expectAllowed(result);
    for (const fieldId of [
      "work_authorization",
      "sponsorship_required",
      "salary_expectation",
      "relocation",
      "eeo_disability_status",
    ]) {
      expect(plan(result, fieldId).mappingState).toBe("human_input_required");
    }
  });

  it("maps only approved, fresh, source-bound facts", () => {
    const unapproved = run(
      replaceFact(
        baseRequest(),
        "candidate_full_name",
        makeFact("candidate_full_name", "short_text", "Alex Rivera", {
          approval: approval({ approved: false }),
        }),
      ),
    );
    const stale = run(
      replaceFact(
        baseRequest(),
        "candidate_full_name",
        makeFact("candidate_full_name", "short_text", "Alex Rivera", {
          approval: approval({ fresh: false }),
        }),
      ),
    );
    const sourceMismatch = run(
      replaceBinding(
        baseRequest(),
        "candidate_full_name",
        makeSourceBinding("candidate_full_name", {
          sourceRef: "mcp-safe-ref:evidence-graph:othername",
        }),
      ),
    );

    for (const result of [unapproved, stale, sourceMismatch]) {
      expectAllowed(result);
      expect(plan(result, "candidate_full_name").mappingState).toBe("blocked_by_policy");
      expect(result.dryRunStatus).toBe("missing_required_data");
      expect(result.requiredBlockingFieldIds).toContain("candidate_full_name");
    }
  });

  it("blocks private and never-use facts without leaking sentinel text in safe output", () => {
    const privateResult = run(
      replaceFact(
        baseRequest(),
        "candidate_full_name",
        makeFact(
          "candidate_full_name",
          "short_text",
          "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
          { privacy: "private" },
        ),
      ),
    );
    const neverUseResult = run(
      replaceFact(
        baseRequest(),
        "candidate_full_name",
        makeFact(
          "candidate_full_name",
          "short_text",
          "NEVER_USE_SENTINEL_DO_NOT_EXPOSE",
          { privacy: "never_use" },
        ),
      ),
    );

    for (const result of [privateResult, neverUseResult]) {
      expectAllowed(result);
      expect(plan(result, "candidate_full_name").mappingState).toBe("blocked_by_policy");
      expectSafeSummaryHasNoRawValues(result);
    }
  });

  it("maps exact select option codes and rejects unknown or fuzzy select values", () => {
    const mapped = run();
    const unknown = run(
      replaceFact(
        baseRequest(),
        "remote_preference",
        makeFact("remote_preference", "select", "distributed"),
      ),
    );
    const fuzzy = run(
      replaceFact(
        baseRequest(),
        "remote_preference",
        makeFact("remote_preference", "select", "work from home"),
      ),
    );
    const missing = run(replaceFact(baseRequest(), "remote_preference", undefined));

    expectAllowed(mapped);
    expect(previewValue(mapped, "remote_preference").value).toBe("remote");
    for (const result of [unknown, fuzzy]) {
      expectAllowed(result);
      expect(plan(result, "remote_preference").mappingState).toBe("invalid_value");
    }
    expectAllowed(missing);
    expect(plan(missing, "remote_preference").mappingState).toBe("missing");
    expect(missing.restrictedPreview.fieldValues.map((field) => field.fieldId)).not.toContain(
      "remote_preference",
    );
  });

  it("maps booleans explicitly and does not coerce strings or missing booleans", () => {
    const booleanField: McpJobPlatformDryRunFieldDefinitionV1 = {
      fieldId: "willing_to_travel",
      safeLabel: "Travel preference",
      fieldKind: "boolean",
      required: false,
      sourcePolicy: "explicit_approved_fact",
      sourceKey: "willing_to_travel",
      sensitivity: "standard",
      humanInputPolicy: "auto_map_if_explicit",
      version: 1,
    };
    const schema = addField(makeSchema(), booleanField);
    const withBoolean = baseRequest({
      approvedFacts: [...baseFacts(), makeFact("willing_to_travel", "boolean", true)],
      sourceBindings: baseSourceBindings(["willing_to_travel"]),
    });
    const falseRequest = replaceFact(
      withBoolean,
      "willing_to_travel",
      makeFact("willing_to_travel", "boolean", false),
    );
    const stringRequest = replaceFact(
      withBoolean,
      "willing_to_travel",
      makeFact("willing_to_travel", "boolean", "false"),
    );
    const missingRequest = replaceFact(withBoolean, "willing_to_travel", undefined);

    const trueResult = run(withBoolean, schema);
    const falseResult = run(falseRequest, schema);
    const stringResult = run(stringRequest, schema);
    const missingResult = run(missingRequest, schema);

    expectAllowed(trueResult);
    expect(previewValue(trueResult, "willing_to_travel").value).toBe(true);
    expectAllowed(falseResult);
    expect(previewValue(falseResult, "willing_to_travel").value).toBe(false);
    expectAllowed(stringResult);
    expect(plan(stringResult, "willing_to_travel").mappingState).toBe("invalid_value");
    expectAllowed(missingResult);
    expect(plan(missingResult, "willing_to_travel").mappingState).toBe("missing");
  });

  it("accepts canonical dates and rejects ambiguous or partial dates", () => {
    const canonical = run();
    const ambiguous = run(
      replaceFact(
        baseRequest(),
        "earliest_start_date",
        makeFact("earliest_start_date", "date", "07/01/2026"),
      ),
    );
    const partial = run(
      replaceFact(
        baseRequest(),
        "earliest_start_date",
        makeFact("earliest_start_date", "date", "2026-07"),
      ),
    );

    expectAllowed(canonical);
    expect(previewValue(canonical, "earliest_start_date").value).toBe("2026-07-01");
    for (const result of [ambiguous, partial]) {
      expectAllowed(result);
      expect(plan(result, "earliest_start_date").mappingState).toBe("invalid_value");
    }
  });

  it("rejects oversized, control-character, and executable text values", () => {
    const oversized = run(
      replaceFact(
        baseRequest(),
        "candidate_full_name",
        makeFact("candidate_full_name", "short_text", "A".repeat(121)),
      ),
    );
    const controlCharacter = run(
      replaceFact(
        baseRequest(),
        "candidate_full_name",
        makeFact("candidate_full_name", "short_text", "Alex\u0000Rivera"),
      ),
    );
    const executableText = run(
      replaceFact(
        baseRequest(),
        "candidate_full_name",
        makeFact("candidate_full_name", "short_text", "<script>alert(1)</script>"),
      ),
    );

    for (const result of [oversized, controlCharacter, executableText]) {
      expectAllowed(result);
      expect(plan(result, "candidate_full_name").mappingState).toBe("invalid_value");
      expect(result.dryRunStatus).toBe("missing_required_data");
      expect(result.requiredBlockingFieldIds).toContain("candidate_full_name");
    }
  });

  it("uses only approved answer artifacts for screening fields", () => {
    const mapped = run();
    const missing = run(baseRequest({ approvedAnswerArtifacts: [] }));
    const generatedOnly = run(
      baseRequest({
        approvedAnswerArtifacts: [makeAnswer({ approved: false })],
      }),
    );

    expectAllowed(mapped);
    expect(previewValue(mapped, "screening_motivation").value).toBe(
      "I have approved this concise screening answer for this role.",
    );
    for (const result of [missing, generatedOnly]) {
      expectAllowed(result);
      expect(plan(result, "screening_motivation").mappingState).toBe(
        "human_input_required",
      );
    }
  });

  it("maps approved attachment references without bytes, paths, upload URLs, or upload attempts", () => {
    const result = run();

    expectAllowed(result);
    expect(result.attachmentPlans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slotId: "resume_upload",
          artifactKind: "resume_variant",
          artifactRef: RESUME_REF,
          uploadAttempted: false,
        }),
        expect.objectContaining({
          slotId: "cover_letter_upload",
          artifactKind: "cover_letter",
          artifactRef: COVER_LETTER_REF,
          uploadAttempted: false,
        }),
      ]),
    );
    expect(result.restrictedPreview.attachmentRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slotId: "resume_upload", artifactRef: RESUME_REF }),
      ]),
    );
    const serializedAttachments = JSON.stringify(result.restrictedPreview.attachmentRefs);
    for (const forbidden of ["bytes", "path", "uploadUrl", "base64", "blob"]) {
      expect(serializedAttachments).not.toContain(forbidden);
    }
  });

  it("rejects duplicate schema field identifiers", () => {
    const duplicateSchema = withFields([
      ...LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1.supportedFields,
      fieldById("candidate_email"),
    ]);

    const result = run(baseRequest(), duplicateSchema);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("unsupported_schema");
    expectNoExecution(result);
  });

  it("blocks integration or schema mismatches", () => {
    const schemaMismatch = run(
      baseRequest({ integrationSchemaVersion: "local_fixture_job_platform_v1.schema.404" }),
    );
    const integrationMismatch = run(
      baseRequest({ integrationId: "real_platform_integration_v1" }),
    );

    expect(schemaMismatch.allowed).toBe(false);
    expect(schemaMismatch.reason).toBe("unsupported_schema");
    expect(integrationMismatch.allowed).toBe(false);
    expect(integrationMismatch.reason).toBe("invalid_input");
  });

  it("rejects public schema injection in the request envelope", () => {
    const result = run(
      baseRequest({
        schema: LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1,
      }),
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("invalid_input");
    expectNoExecution(result);
  });

  it("rejects endpoint, header, and upload URL injection attempts", () => {
    const endpointInjection = run(
      baseRequest({
        endpointUrl: "https://jobs.example/apply",
        headers: { Authorization: "Bearer SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE" },
      }),
    );
    const uploadUrlInjection = run(
      baseRequest({
        approvedArtifactRefs: [
          makeArtifact("application_package", APPLICATION_PACKAGE_REF),
          makeArtifact("resume_variant", RESUME_REF, {
            uploadUrl: "https://jobs.example/upload",
          }),
        ],
      }),
    );

    expect(endpointInjection.allowed).toBe(false);
    expect(endpointInjection.reason).toBe("invalid_input");
    expect(uploadUrlInjection.allowed).toBe(false);
    expect(uploadUrlInjection.reason).toBe("invalid_input");
  });

  it("blocks ambiguous facts, bindings, answers, and artifacts instead of choosing the first item", () => {
    const duplicateFact = run(
      baseRequest({
        approvedFacts: [
          ...baseFacts(),
          makeFact("candidate_email", "email", "alex.other@example.test", {
            factRef: "mcp-safe-ref:candidate-fact:contact2",
            sourceRef: "mcp-safe-ref:evidence-graph:contact2",
          }),
        ],
      }),
    );
    const duplicateBinding = run(
      baseRequest({
        sourceBindings: [
          ...baseSourceBindings(),
          makeSourceBinding("candidate_email", {
            sourceRef: "mcp-safe-ref:evidence-graph:contact2",
          }),
        ],
      }),
    );
    const duplicateAnswer = run(
      baseRequest({
        approvedAnswerArtifacts: [
          makeAnswer(),
          makeAnswer({
            answerRef: "mcp-safe-ref:screening-answer:motivation2",
            answerText: "A second approved answer should not be guessed.",
          }),
        ],
      }),
    );
    const duplicateArtifactRef = run(
      baseRequest({
        approvedArtifactRefs: [
          makeArtifact("application_package", APPLICATION_PACKAGE_REF),
          makeArtifact("resume_variant", RESUME_REF),
          makeArtifact("resume_variant", RESUME_REF),
        ],
      }),
    );
    const duplicateArtifactKind = run(
      baseRequest({
        approvedArtifactRefs: [
          makeArtifact("application_package", APPLICATION_PACKAGE_REF),
          makeArtifact("resume_variant", RESUME_REF),
          makeArtifact("resume_variant", "mcp-safe-ref:resume-variant:resume2"),
        ],
      }),
    );

    for (const result of [
      duplicateFact,
      duplicateBinding,
      duplicateAnswer,
      duplicateArtifactRef,
      duplicateArtifactKind,
    ]) {
      expectAmbiguousBlocked(result);
    }
  });

  it("includes every required non-mapped state in required blocking field ids", () => {
    const requiredUnsupportedSchema = withFields(
      LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1.supportedFields.map((field) =>
        field.fieldId === "candidate_email"
          ? { ...field, sourcePolicy: "unsupported" }
          : field,
      ),
    );
    const requiredHumanSchema = withFields(
      LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1.supportedFields.map((field) =>
        field.fieldId === "terms_attestation" ? { ...field, required: true } : field,
      ),
    );
    const cases = [
      {
        result: run(replaceFact(baseRequest(), "candidate_email", undefined)),
        fieldId: "candidate_email",
        state: "missing",
      },
      {
        result: run(
          replaceFact(
            baseRequest(),
            "candidate_full_name",
            makeFact("candidate_full_name", "short_text", "A".repeat(121)),
          ),
        ),
        fieldId: "candidate_full_name",
        state: "invalid_value",
      },
      {
        result: run(
          replaceFact(
            baseRequest(),
            "candidate_full_name",
            makeFact("candidate_full_name", "short_text", "Alex Rivera", {
              approval: approval({ approved: false }),
            }),
          ),
        ),
        fieldId: "candidate_full_name",
        state: "blocked_by_policy",
      },
      {
        result: run(baseRequest(), requiredUnsupportedSchema),
        fieldId: "candidate_email",
        state: "unsupported",
      },
      {
        result: run(baseRequest(), requiredHumanSchema),
        fieldId: "terms_attestation",
        state: "human_input_required",
      },
    ];

    for (const item of cases) {
      expectAllowed(item.result);
      expect(item.result.dryRunStatus).not.toBe("mapping_complete");
      expect(plan(item.result, item.fieldId).mappingState).toBe(item.state);
      expect(item.result.requiredBlockingFieldIds).toContain(item.fieldId);
      expect(item.result.safeCounts?.requiredBlockingFields).toBeGreaterThan(0);
    }
  });

  it("rejects schema fields whose kind is not declared as supported", () => {
    const schema = makeSchema({
      supportedFieldKinds: LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1.supportedFieldKinds.filter(
        (kind) => kind !== "email",
      ),
    });

    const result = run(baseRequest(), schema);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("unsupported_schema");
    expectNoExecution(result);
  });

  it("rejects approved artifact ref fields with incompatible value kinds", () => {
    const booleanArtifactField: McpJobPlatformDryRunFieldDefinitionV1 = {
      fieldId: "package_ref_boolean",
      safeLabel: "Package ref boolean",
      fieldKind: "boolean",
      required: false,
      sourcePolicy: "approved_artifact_ref",
      sourceKey: "package_ref_boolean",
      sensitivity: "standard",
      humanInputPolicy: "auto_map_if_explicit",
      version: 1,
    };
    const textArtifactField: McpJobPlatformDryRunFieldDefinitionV1 = {
      ...booleanArtifactField,
      fieldId: "package_ref_text",
      safeLabel: "Package ref text",
      fieldKind: "short_text",
      sourceKey: "package_ref_text",
    };

    for (const schema of [
      addField(makeSchema(), booleanArtifactField),
      addField(makeSchema(), textArtifactField),
    ]) {
      const result = run(baseRequest(), schema);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("unsupported_schema");
      expectNoExecution(result);
    }
  });

  it("keeps PR76 write-action execution disabled even for complete mappings", () => {
    const result = run(baseRequest({ intendedAction: "submit_application" }));

    expectAllowed(result);
    expect(result.writeActionProposal.actionCategory).toBe("submit_application");
    expect(result.writeActionProposal.operationKind).toBe("proposed_write_action");
    expect(result.writeActionProposal.executionStatus).toBe(
      "proposed_pending_confirmation",
    );
    expect(result.writeActionProposal.confirmation.state).toBe("required_unconfirmed");
    expect(result.writeActionProposal.realExecutionAllowed).toBe(false);
    expect(result.writeActionProposal.capabilities.writeActions).toBe("blocked");
    expect(result.writeActionProposal.capabilities.networkAccess).toBe("blocked");
    expectNoExecution(result);
  });

  it("keeps safe summaries redacted while restricted previews carry the exact mapped values", () => {
    const result = run();

    expectAllowed(result);
    expect(previewValue(result, "candidate_email").value).toBe(
      "alex.rivera@example.test",
    );
    expect(previewValue(result, "candidate_phone").value).toBe("+15550101234");
    expectSafeSummaryHasNoRawValues(result);
  });

  it("fails closed on getter, symbol-key, and proxy-hostile request objects", () => {
    const getterRequest = baseRequest();
    Object.defineProperty(getterRequest, "endpointUrl", {
      enumerable: true,
      get() {
        throw new Error("getter must not be read");
      },
    });
    const symbolRequest = baseRequest() as Record<PropertyKey, unknown>;
    symbolRequest[Symbol("raw")] = "SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE";
    const proxyRequest = new Proxy(baseRequest(), {
      getOwnPropertyDescriptor() {
        throw new Error("proxy must fail closed");
      },
    });

    for (const hostile of [getterRequest, symbolRequest, proxyRequest]) {
      const result = createMcpJobPlatformApplyDryRun(hostile);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("invalid_input");
      expectNoExecution(result);
    }
  });

  it("fails closed on arrays with extra non-canonical numeric keys", () => {
    const request = baseRequest();
    Object.defineProperty(request.approvedFacts, "01", {
      enumerable: true,
      value: makeFact("candidate_email", "email", "shadow@example.test", {
        factRef: "mcp-safe-ref:candidate-fact:shadow",
        sourceRef: "mcp-safe-ref:evidence-graph:shadow",
      }),
    });

    const result = createMcpJobPlatformApplyDryRun(request);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("invalid_input");
    expectNoExecution(result);
  });

  it("does not trigger proxy get traps while copying plain descriptor values", () => {
    let getTrapHits = 0;
    const proxyRequest = new Proxy(baseRequest(), {
      get(target, prop, receiver) {
        if (prop === "kind") getTrapHits += 1;
        return Reflect.get(target, prop, receiver);
      },
    });

    const result = createMcpJobPlatformApplyDryRun(proxyRequest);

    expect(getTrapHits).toBe(0);
    expectAllowed(result);
  });

  it("never changes execution flags for complete, missing-data, human-required, or blocked outcomes", () => {
    const requiredHumanSchema = withFields(
      LOCAL_FIXTURE_JOB_PLATFORM_SCHEMA_V1.supportedFields.map((field) =>
        field.fieldId === "terms_attestation" ? { ...field, required: true } : field,
      ),
    );
    const outcomes = [
      run(),
      run(replaceFact(baseRequest(), "candidate_email", undefined)),
      run(baseRequest(), requiredHumanSchema),
      run(baseRequest({ endpointUrl: "https://jobs.example/apply" })),
    ];

    for (const outcome of outcomes) {
      expectNoExecution(outcome);
      expect(outcome.realExecutionAllowed).toBe(false);
      expect(outcome.liveExecutionAllowed).toBe(false);
      expect(outcome.localPersistenceWrite).toBe(false);
      expect(outcome.credentialStorage).toBe("none");
      expect(outcome.tokenStorage).toBe("none");
    }
  });

  it("rejects secret, session, and provider internals from safe output", () => {
    const secretFact = run(
      replaceFact(
        baseRequest(),
        "candidate_full_name",
        makeFact(
          "candidate_full_name",
          "short_text",
          "SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
        ),
      ),
    );
    const sessionDetail = run(
      replaceFact(
        baseRequest(),
        "candidate_full_name",
        makeFact(
          "candidate_full_name",
          "short_text",
          "SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE",
        ),
      ),
    );
    const providerRef = run(
      replaceFact(
        baseRequest(),
        "candidate_full_name",
        makeFact("candidate_full_name", "short_text", "Alex Rivera", {
          sourceRef: "mcp-safe-ref:provider:internal",
        }),
      ),
    );

    expectAllowed(secretFact);
    expect(plan(secretFact, "candidate_full_name").mappingState).toBe("invalid_value");
    expectAllowed(sessionDetail);
    expect(plan(sessionDetail, "candidate_full_name").mappingState).toBe(
      "invalid_value",
    );
    expect(providerRef.allowed).toBe(false);
    expect(providerRef.reason).toBe("invalid_input");
    for (const result of [secretFact, sessionDetail, providerRef]) {
      expectSafeSummaryHasNoRawValues(result);
    }
  });

  it("contains no source-level browser, network, persistence, OpenAI, or PR78 send surfaces", () => {
    const source = stripSourceComments(readFileSync(DRY_RUN_SOURCE_FILE, "utf8"));

    for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });
});
