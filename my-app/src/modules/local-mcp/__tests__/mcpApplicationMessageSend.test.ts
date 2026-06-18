import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  createMcpApplicationMessageFinalPreview,
  sendMcpApprovedApplicationMessage,
  type McpApplicationMessageChannelSendRequestV1,
  type McpApplicationMessageControlledChannelV1,
  type McpApplicationMessageFinalPreviewV1,
  type McpApplicationMessageProviderReceiptV1,
} from "../mcpApplicationMessageSend";
import {
  createMcpOutboundEgressPolicy,
  type McpOutboundEgressAllowlistRuleV1,
} from "../mcpOutboundEgressPolicy";
import {
  assertMcpWriteActionExecutionDisabled,
  createMcpWriteActionProposal,
} from "../mcpWriteActionFramework";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SEND_SOURCE_FILE = resolve(TEST_DIR, "../mcpApplicationMessageSend.ts");
const WRITE_FRAMEWORK_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpWriteActionFramework.ts",
);
const EGRESS_SOURCE_FILE = resolve(TEST_DIR, "../mcpOutboundEgressPolicy.ts");

const ARTIFACT_REF = {
  id: "mcp-safe-ref:application-package:message-preview",
  label: "Application pkg artifact",
  status: "approved_for_preview",
  category: "application_package",
  count: 1,
  updatedAt: "2026-06-18T07:00:00.000Z",
  version: 1,
} as const;

const APPROVED_BODY =
  "Dear Hiring Team,\n\nI am applying for the role with a focused, approved application message.\n\nRegards,\nAlex";

const CHANNEL_ENDPOINT =
  "https://api.twoweeks-send.example/v1/application-messages";

const BASE_EGRESS_RULE: McpOutboundEgressAllowlistRuleV1 = {
  id: "mcp-egress-rule:application-message-api",
  host: "api.twoweeks-send.example",
  schemes: ["https"],
  methods: ["POST"],
  pathPrefixes: ["/v1/application-messages"],
  actionCategory: "send_message",
  purpose: "Controlled application message channel.",
  dataClasses: [
    "generated_artifact",
    "application_material",
    "destination_metadata",
    "safe_ref",
    "user_confirmation",
    "audit_metadata",
  ],
  userVisibleReason:
    "The approved application message channel is explicitly allowlisted.",
  timeoutMs: 5000,
  maxResponseBytes: 4096,
  version: 1,
};

const FORBIDDEN_SAFE_RESULT_FRAGMENTS = [
  APPROVED_BODY,
  "hiring@example.test",
  "Dear Hiring Team",
  "Application for Senior Product Engineer",
  "Bearer ",
  "accessToken",
  "refreshToken",
  "RAW_APPLICATION_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
  "SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
] as const;

const FORBIDDEN_SEND_SOURCE_PATTERNS = [
  /fetch\s*\(/iu,
  /XMLHttpRequest/iu,
  /axios/iu,
  /sendgrid/iu,
  /postmark/iu,
  /resend/iu,
  /mailgun/iu,
  /nodemailer/iu,
  /from\s+["'][^"']*(?:components|pages|routes|convex)\//iu,
  /from\s+["'][^"']*(?:openai|@openai|@\/convex|convex\/)/iu,
  /process\.env/iu,
] as const;

function makeApprovalState(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_generated_artifact_human_approval_workflow_summary",
    allowed: true,
    artifactKind: "application_package",
    artifactRef: ARTIFACT_REF,
    artifactStatus: "approved_for_preview",
    workflowStatus: "approved_for_preview",
    decisionStatus: "approved_for_preview",
    decision: "approve_preview",
    visibilityCategory: "safe_summary_only",
    safeSummary: "Approved application message preview.",
    nextUserAction: "none",
    refIds: [ARTIFACT_REF.id],
    safeCounts: {
      artifactRefs: 1,
      fullContentReturned: 0,
      version: 1,
    },
    safeCategories: {
      artifactKinds: ["application_package"],
      version: 1,
    },
    safeFlags: {
      humanReviewRequired: false,
      approvedForPreview: true,
      approvedForExport: false,
      approvedForDownload: false,
      approvedForSend: false,
      approvedForSubmit: false,
      approvedForApply: false,
      fullContentRestricted: true,
      rawDataExposed: false,
      version: 1,
    },
    diffReview: {
      required: false,
      version: 1,
    },
    auditEvent: {
      kind: "mcp_generated_artifact_human_approval_audit_event",
      eventKind: "human_approval_decision_recorded",
      artifactKind: "application_package",
      artifactRef: ARTIFACT_REF,
      decision: "approve_preview",
      safeCounts: {
        artifactRefs: 1,
        fullContentReturned: 0,
        version: 1,
      },
      redactedFlags: {
        rawDataExposed: false,
        fullContentRestricted: true,
        tokenOrIdentityExposed: false,
        persisted: false,
        version: 1,
      },
      occurredAt: "2026-06-18T07:03:00.000Z",
      persisted: false,
      version: 1,
    },
    capabilities: {
      dataReads: "blocked",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
      exportActions: "blocked",
      rawDataProjection: "blocked",
      credentialStorage: "none",
      tokenStorage: "none",
      version: 1,
    },
    modelVisible: true,
    componentVisible: true,
    version: 1,
    ...overrides,
  };
}

function makeRestrictedArtifact(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_application_message_restricted_approved_artifact",
    artifactKind: "application_package",
    artifactRef: ARTIFACT_REF,
    visibility: "restricted_full_content",
    plainTextBody: APPROVED_BODY,
    version: 1,
    ...overrides,
  };
}

function makeFreshnessState(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_application_message_send_freshness_state",
    artifactRef: ARTIFACT_REF,
    approvedArtifactUpdatedAt: ARTIFACT_REF.updatedAt,
    currentArtifactUpdatedAt: ARTIFACT_REF.updatedAt,
    revisionLineage: [ARTIFACT_REF.id],
    latestApprovedRevisionRef: ARTIFACT_REF.id,
    hasPendingRevision: false,
    checkedAt: "2026-06-18T07:04:00.000Z",
    version: 1,
    ...overrides,
  };
}

function makePreviewRequest(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_application_message_send_request",
    artifactKind: "application_package",
    approvalState: makeApprovalState(),
    approvedArtifact: makeRestrictedArtifact(),
    freshnessState: makeFreshnessState(),
    destination: {
      kind: "mcp_application_message_email_destination",
      email: "hiring@example.test",
      version: 1,
    },
    subject: "Application for Senior Product Engineer",
    channelId: "application_message_api",
    idempotencyKey: "mcp-write-action:send-application-message:001",
    requestedAt: "2026-06-18T07:05:00.000Z",
    version: 1,
    ...overrides,
  };
}

function expectPreviewAllowed(
  request: unknown = makePreviewRequest(),
): McpApplicationMessageFinalPreviewV1 {
  const result = createMcpApplicationMessageFinalPreview(request);
  expect(result.allowed).toBe(true);
  if (!result.allowed) {
    throw new Error(result.reason);
  }
  expect(result.finalPreview.modelVisible).toBe(false);
  expect(result.finalPreview.componentVisible).toBe(false);
  expect(result.finalPreview.finalPreviewDigest).toMatch(/^fnv1a32:[a-f0-9]{8}$/u);
  expect(result.finalPreview.requiredConfirmationCopy).toBe(
    `SEND ${result.finalPreview.finalPreviewDigest}`,
  );
  expect(result.finalPreview.proposal.actionCategory).toBe("send_message");
  expect(result.finalPreview.proposal.realExecutionAllowed).toBe(false);
  return result.finalPreview;
}

function makeManualConfirmation(
  preview: McpApplicationMessageFinalPreviewV1,
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_application_message_manual_confirmation",
    actor: "human_user",
    state: "confirmed",
    proposalRef: preview.proposal.proposalRef,
    idempotencyKey: preview.idempotencyKey,
    finalPreviewDigest: preview.finalPreviewDigest,
    confirmationCopy: preview.requiredConfirmationCopy,
    confirmedAt: "2026-06-18T07:06:00.000Z",
    version: 1,
    ...overrides,
  };
}

function makeSendAuthorization(
  preview: McpApplicationMessageFinalPreviewV1,
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_application_message_send_authorization",
    finalPreview: preview,
    manualConfirmation: makeManualConfirmation(preview),
    version: 1,
    ...overrides,
  };
}

function makeEgressPolicy(
  rules: readonly McpOutboundEgressAllowlistRuleV1[] = [BASE_EGRESS_RULE],
) {
  return createMcpOutboundEgressPolicy({
    kind: "mcp_outbound_egress_policy",
    allowlist: rules,
    version: 1,
  });
}

function makeControlledChannel(options: {
  endpointUrl?: string;
  receipt?: McpApplicationMessageProviderReceiptV1;
  onSend?: (
    request: McpApplicationMessageChannelSendRequestV1,
  ) => McpApplicationMessageProviderReceiptV1 | Promise<McpApplicationMessageProviderReceiptV1>;
} = {}) {
  const calls: McpApplicationMessageChannelSendRequestV1[] = [];
  let externalDeliveries = 0;
  const fingerprintsByIdempotencyKey = new Map<string, string>();

  const channel: McpApplicationMessageControlledChannelV1 = {
    kind: "mcp_application_message_controlled_channel",
    channelId: "application_message_api",
    endpointUrl: options.endpointUrl ?? CHANNEL_ENDPOINT,
    credentialMode: "none",
    version: 1,
    async sendApprovedApplicationMessage(request) {
      calls.push(request);
      if (options.onSend) {
        return options.onSend(request);
      }

      const previous = fingerprintsByIdempotencyKey.get(request.idempotencyKey);
      if (previous === request.payloadFingerprint) {
        return {
          kind: "mcp_application_message_provider_receipt",
          status: "duplicate_accepted",
          providerReceiptRef: "mcp-provider-receipt:duplicate-001",
          networkRequestExecuted: true,
          externalSideEffect: false,
          retrySafe: true,
          version: 1,
        };
      }
      if (previous && previous !== request.payloadFingerprint) {
        return {
          kind: "mcp_application_message_provider_receipt",
          status: "idempotency_conflict",
          providerReceiptRef: "mcp-provider-receipt:conflict-001",
          networkRequestExecuted: true,
          externalSideEffect: false,
          retrySafe: false,
          version: 1,
        };
      }

      fingerprintsByIdempotencyKey.set(
        request.idempotencyKey,
        request.payloadFingerprint,
      );
      externalDeliveries += 1;
      return (
        options.receipt ?? {
          kind: "mcp_application_message_provider_receipt",
          status: "sent",
          providerReceiptRef: "mcp-provider-receipt:sent-001",
          networkRequestExecuted: true,
          externalSideEffect: true,
          retrySafe: false,
          version: 1,
        }
      );
    },
  };

  return {
    channel,
    calls,
    get externalDeliveries() {
      return externalDeliveries;
    },
  };
}

function expectSafeSendResult(result: unknown) {
  expect(
    (result as { localPersistenceWrite?: unknown }).localPersistenceWrite,
  ).toBe(false);
  assertLocalMcpPrivacySafeOutput(result);
  const serialized = JSON.stringify(result);
  for (const fragment of FORBIDDEN_SAFE_RESULT_FRAGMENTS) {
    expect(serialized).not.toContain(fragment);
  }
}

async function sendWith(
  preview: McpApplicationMessageFinalPreviewV1,
  options: {
    channel?: McpApplicationMessageControlledChannelV1;
    authorization?: unknown;
    egressPolicy?: ReturnType<typeof makeEgressPolicy>;
  } = {},
) {
  return sendMcpApprovedApplicationMessage(
    options.authorization ?? makeSendAuthorization(preview),
    {
      channel: options.channel ?? makeControlledChannel().channel,
      egressPolicy: options.egressPolicy ?? makeEgressPolicy(),
    },
  );
}

describe("mcpApplicationMessageSend", () => {
  it("creates a restricted final preview bound to the approved application message artifact", () => {
    const preview = expectPreviewAllowed();

    expect(preview.artifactRef).toEqual(ARTIFACT_REF);
    expect(preview.revisionLineage).toEqual([ARTIFACT_REF.id]);
    expect(preview.channelId).toBe("application_message_api");
    expect(preview.channelEndpointRef).toMatch(
      /^mcp-safe-ref:application-message-endpoint:[a-f0-9]{8}$/u,
    );
    expect(preview.destinationRef).toMatch(
      /^mcp-safe-ref:application-message-destination:[a-f0-9]{8}$/u,
    );
    expect(preview.payload.body).toBe(APPROVED_BODY);
    expect(preview.payload.destination.email).toBe("hiring@example.test");
  });

  it("changes the final preview digest when exact send material changes", () => {
    const original = expectPreviewAllowed();
    const changedDestination = expectPreviewAllowed(
      makePreviewRequest({
        destination: {
          kind: "mcp_application_message_email_destination",
          email: "talent@example.test",
          version: 1,
        },
      }),
    );
    const changedSubject = expectPreviewAllowed(
      makePreviewRequest({ subject: "Application for Staff Product Engineer" }),
    );
    const changedBody = expectPreviewAllowed(
      makePreviewRequest({
        approvedArtifact: makeRestrictedArtifact({
          plainTextBody: `${APPROVED_BODY}\n\nAdditional approved sentence.`,
        }),
      }),
    );
    const changedKey = expectPreviewAllowed(
      makePreviewRequest({
        idempotencyKey: "mcp-write-action:send-application-message:002",
      }),
    );

    expect(new Set([
      original.finalPreviewDigest,
      changedDestination.finalPreviewDigest,
      changedSubject.finalPreviewDigest,
      changedBody.finalPreviewDigest,
      changedKey.finalPreviewDigest,
    ])).toHaveLength(5);
  });

  it("sends exactly once through the controlled channel after exact human confirmation and allowlisted egress", async () => {
    const preview = expectPreviewAllowed();
    const controlled = makeControlledChannel();

    const result = await sendMcpApprovedApplicationMessage(
      makeSendAuthorization(preview),
      { channel: controlled.channel, egressPolicy: makeEgressPolicy() },
    );

    expect(result.allowed).toBe(true);
    expect(result.deliveryStatus).toBe("sent");
    expect(result.writeActionExecuted).toBe(true);
    expect(result.externalSideEffect).toBe(true);
    expect(result.networkRequestExecuted).toBe(true);
    expect(result.auditEvent.allowlistRuleId).toBe(
      "mcp-egress-rule:application-message-api",
    );
    expect(result.auditEvent.finalPreviewDigest).toBe(
      preview.finalPreviewDigest,
    );
    expect(result.auditEvent.destinationRef).toBe(preview.destinationRef);
    expect(controlled.calls).toHaveLength(1);
    expect(controlled.calls[0]?.endpointUrl).toBe(CHANNEL_ENDPOINT);
    expect(controlled.calls[0]?.redirectPolicy).toEqual({
      mode: "disabled",
      maxRedirects: 0,
    });
    expect(controlled.calls[0]?.body).toBe(APPROVED_BODY);
    expect(controlled.calls[0]?.destination.email).toBe("hiring@example.test");
    expectSafeSendResult(result);
  });

  it("blocks missing, rejected, model, stale, and mismatched confirmations before channel invocation", async () => {
    const preview = expectPreviewAllowed();

    const blockedAuthorizations = [
      {
        name: "missing",
        value: {
          kind: "mcp_application_message_send_authorization",
          finalPreview: preview,
          version: 1,
        },
      },
      {
        name: "rejected",
        value: makeSendAuthorization(preview, {
          manualConfirmation: makeManualConfirmation(preview, {
            state: "rejected",
          }),
        }),
      },
      {
        name: "model",
        value: makeSendAuthorization(preview, {
          manualConfirmation: makeManualConfirmation(preview, {
            actor: "model",
          }),
        }),
      },
      {
        name: "stale",
        value: makeSendAuthorization(preview, {
          manualConfirmation: makeManualConfirmation(preview, {
            confirmedAt: "2026-06-18T07:04:59.999Z",
          }),
        }),
      },
      {
        name: "copy-mismatch",
        value: makeSendAuthorization(preview, {
          manualConfirmation: makeManualConfirmation(preview, {
            confirmationCopy: "SEND fnv1a32:00000000",
          }),
        }),
      },
      {
        name: "digest-mismatch",
        value: makeSendAuthorization(preview, {
          manualConfirmation: makeManualConfirmation(preview, {
            finalPreviewDigest: "fnv1a32:00000000",
          }),
        }),
      },
      {
        name: "idempotency-mismatch",
        value: makeSendAuthorization(preview, {
          manualConfirmation: makeManualConfirmation(preview, {
            idempotencyKey: "mcp-write-action:send-application-message:002",
          }),
        }),
      },
    ];

    for (const blockedAuthorization of blockedAuthorizations) {
      const controlled = makeControlledChannel();
      const result = await sendMcpApprovedApplicationMessage(
        blockedAuthorization.value,
        { channel: controlled.channel, egressPolicy: makeEgressPolicy() },
      );

      expect(result.allowed, blockedAuthorization.name).toBe(false);
      expect(result.writeActionExecuted, blockedAuthorization.name).toBe(false);
      expect(result.externalSideEffect, blockedAuthorization.name).toBe(false);
      expect(result.networkRequestExecuted, blockedAuthorization.name).toBe(false);
      expect(controlled.calls, blockedAuthorization.name).toHaveLength(0);
      expectSafeSendResult(result);
    }
  });

  it("blocks stale artifact freshness, pending revisions, and non-approved workflow states", () => {
    const blockedRequests = [
      {
        name: "current-artifact-newer-than-approval",
        value: makePreviewRequest({
          freshnessState: makeFreshnessState({
            currentArtifactUpdatedAt: "2026-06-18T07:01:00.000Z",
          }),
        }),
      },
      {
        name: "pending-revision",
        value: makePreviewRequest({
          freshnessState: makeFreshnessState({
            hasPendingRevision: true,
          }),
        }),
      },
      {
        name: "lineage-does-not-end-at-current-artifact",
        value: makePreviewRequest({
          freshnessState: makeFreshnessState({
            revisionLineage: ["mcp-safe-ref:application-package:older"],
          }),
        }),
      },
      {
        name: "not-approved-summary",
        value: makePreviewRequest({
          approvalState: makeApprovalState({ allowed: false }),
        }),
      },
      {
        name: "not-approved-for-preview",
        value: makePreviewRequest({
          approvalState: makeApprovalState({
            artifactStatus: "human_review_required",
            workflowStatus: "human_review_required",
            decisionStatus: "request_edit",
            decision: "request_edit",
            safeFlags: {
              humanReviewRequired: true,
              approvedForPreview: false,
              approvedForExport: false,
              approvedForDownload: false,
              approvedForSend: false,
              approvedForSubmit: false,
              approvedForApply: false,
              fullContentRestricted: true,
              rawDataExposed: false,
              version: 1,
            },
          }),
        }),
      },
      {
        name: "already-claims-send-approval",
        value: makePreviewRequest({
          approvalState: makeApprovalState({
            safeFlags: {
              humanReviewRequired: false,
              approvedForPreview: true,
              approvedForExport: false,
              approvedForDownload: false,
              approvedForSend: true,
              approvedForSubmit: false,
              approvedForApply: false,
              fullContentRestricted: true,
              rawDataExposed: false,
              version: 1,
            },
          }),
        }),
      },
    ];

    for (const blockedRequest of blockedRequests) {
      const result = createMcpApplicationMessageFinalPreview(
        blockedRequest.value,
      );

      expect(result.allowed, blockedRequest.name).toBe(false);
      expect(result.writeActionExecuted, blockedRequest.name).toBe(false);
      expect(result.networkRequestExecuted, blockedRequest.name).toBe(false);
      expectSafeSendResult(result);
    }
  });

  it("rejects raw model-provided message bodies and unsupported send surfaces", () => {
    const blockedRequests = [
      { name: "raw-body", value: makePreviewRequest({ body: APPROVED_BODY }) },
      {
        name: "html-body",
        value: makePreviewRequest({
          approvedArtifact: makeRestrictedArtifact({
            plainTextBody: "<html><body>Approved body</body></html>",
          }),
        }),
      },
      {
        name: "attachment",
        value: makePreviewRequest({ attachments: ["resume.pdf"] }),
      },
      {
        name: "cc",
        value: makePreviewRequest({
          destination: {
            kind: "mcp_application_message_email_destination",
            email: "hiring@example.test",
            cc: ["other@example.test"],
            version: 1,
          },
        }),
      },
      {
        name: "manual-endpoint",
        value: makePreviewRequest({
          endpointUrl: "https://attacker.example/v1/send",
        }),
      },
      {
        name: "apply-target",
        value: makePreviewRequest({ actionTarget: "apply_to_job" }),
      },
    ];

    for (const blockedRequest of blockedRequests) {
      const result = createMcpApplicationMessageFinalPreview(
        blockedRequest.value,
      );

      expect(result.allowed, blockedRequest.name).toBe(false);
      expect(result.writeActionExecuted, blockedRequest.name).toBe(false);
      expectSafeSendResult(result);
    }
  });

  it("validates the recipient and subject conservatively", () => {
    const blockedRequests = [
      {
        name: "multiple-recipients-comma",
        value: makePreviewRequest({
          destination: {
            kind: "mcp_application_message_email_destination",
            email: "one@example.test,two@example.test",
            version: 1,
          },
        }),
      },
      {
        name: "multiple-recipients-semicolon",
        value: makePreviewRequest({
          destination: {
            kind: "mcp_application_message_email_destination",
            email: "one@example.test;two@example.test",
            version: 1,
          },
        }),
      },
      {
        name: "header-injection-recipient",
        value: makePreviewRequest({
          destination: {
            kind: "mcp_application_message_email_destination",
            email: "hiring@example.test\nBcc: attacker@example.test",
            version: 1,
          },
        }),
      },
      {
        name: "malformed-recipient",
        value: makePreviewRequest({
          destination: {
            kind: "mcp_application_message_email_destination",
            email: "not-an-email",
            version: 1,
          },
        }),
      },
      {
        name: "header-injection-subject",
        value: makePreviewRequest({
          subject: "Application\r\nBcc: attacker@example.test",
        }),
      },
      {
        name: "empty-subject",
        value: makePreviewRequest({ subject: "   " }),
      },
    ];

    for (const blockedRequest of blockedRequests) {
      const result = createMcpApplicationMessageFinalPreview(
        blockedRequest.value,
      );

      expect(result.allowed, blockedRequest.name).toBe(false);
      expect(result.networkRequestExecuted, blockedRequest.name).toBe(false);
      expectSafeSendResult(result);
    }
  });

  it("requires PR77 outbound egress approval before invoking the channel", async () => {
    const preview = expectPreviewAllowed();
    const controlled = makeControlledChannel();
    const blockedPolicy = makeEgressPolicy([]);

    const result = await sendMcpApprovedApplicationMessage(
      makeSendAuthorization(preview),
      { channel: controlled.channel, egressPolicy: blockedPolicy },
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("egress_blocked");
    expect(result.writeActionExecuted).toBe(false);
    expect(result.networkRequestExecuted).toBe(false);
    expect(controlled.calls).toHaveLength(0);
    expectSafeSendResult(result);
  });

  it("blocks channel endpoint drift even when confirmation is valid", async () => {
    const preview = expectPreviewAllowed();
    const controlled = makeControlledChannel({
      endpointUrl: "https://api.twoweeks-send.example/v1/other",
    });

    const result = await sendMcpApprovedApplicationMessage(
      makeSendAuthorization(preview),
      { channel: controlled.channel, egressPolicy: makeEgressPolicy() },
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("channel_mismatch");
    expect(result.writeActionExecuted).toBe(false);
    expect(controlled.calls).toHaveLength(0);
    expectSafeSendResult(result);
  });

  it("uses provider-side idempotency to avoid duplicate external delivery and block key conflicts", async () => {
    const controlled = makeControlledChannel();
    const preview = expectPreviewAllowed();
    const first = await sendMcpApprovedApplicationMessage(
      makeSendAuthorization(preview),
      { channel: controlled.channel, egressPolicy: makeEgressPolicy() },
    );
    const duplicate = await sendMcpApprovedApplicationMessage(
      makeSendAuthorization(preview),
      { channel: controlled.channel, egressPolicy: makeEgressPolicy() },
    );
    const conflictingPreview = expectPreviewAllowed(
      makePreviewRequest({
        approvedArtifact: makeRestrictedArtifact({
          plainTextBody: `${APPROVED_BODY}\n\nDifferent approved payload.`,
        }),
      }),
    );
    const conflict = await sendMcpApprovedApplicationMessage(
      makeSendAuthorization(conflictingPreview),
      { channel: controlled.channel, egressPolicy: makeEgressPolicy() },
    );

    expect(first.allowed).toBe(true);
    expect(first.deliveryStatus).toBe("sent");
    expect(duplicate.allowed).toBe(true);
    expect(duplicate.deliveryStatus).toBe("duplicate_accepted");
    expect(conflict.allowed).toBe(false);
    expect(conflict.reason).toBe("idempotency_conflict");
    expect(controlled.externalDeliveries).toBe(1);
    expectSafeSendResult(first);
    expectSafeSendResult(duplicate);
    expectSafeSendResult(conflict);
  });

  it("does not claim success for provider rejection, unsafe receipts, or ambiguous delivery", async () => {
    const preview = expectPreviewAllowed();
    const cases = [
      {
        name: "provider-rejected",
        receipt: {
          kind: "mcp_application_message_provider_receipt",
          status: "rejected_by_provider",
          providerReceiptRef: "mcp-provider-receipt:rejected-001",
          networkRequestExecuted: true,
          externalSideEffect: false,
          retrySafe: false,
          version: 1,
        } satisfies McpApplicationMessageProviderReceiptV1,
        reason: "provider_rejected",
      },
      {
        name: "unsafe-receipt",
        receipt: {
          kind: "mcp_application_message_provider_receipt",
          status: "sent",
          providerReceiptRef: "hiring@example.test",
          networkRequestExecuted: true,
          externalSideEffect: true,
          retrySafe: false,
          version: 1,
        } satisfies McpApplicationMessageProviderReceiptV1,
        reason: "unsafe_provider_receipt",
      },
      {
        name: "delivery-unknown",
        receipt: {
          kind: "mcp_application_message_provider_receipt",
          status: "delivery_status_unknown",
          providerReceiptRef: "mcp-provider-receipt:unknown-001",
          networkRequestExecuted: true,
          externalSideEffect: true,
          retrySafe: false,
          version: 1,
        } satisfies McpApplicationMessageProviderReceiptV1,
        reason: "delivery_status_unknown",
      },
    ];

    for (const testCase of cases) {
      const controlled = makeControlledChannel({ receipt: testCase.receipt });
      const result = await sendMcpApprovedApplicationMessage(
        makeSendAuthorization(preview),
        { channel: controlled.channel, egressPolicy: makeEgressPolicy() },
      );

      expect(result.allowed, testCase.name).toBe(false);
      expect(result.reason, testCase.name).toBe(testCase.reason);
      expect(result.deliveryStatus, testCase.name).not.toBe("sent");
      expect(result.retrySafe, testCase.name).toBe(false);
      expect(controlled.calls, testCase.name).toHaveLength(1);
      expectSafeSendResult(result);
    }
  });

  it("returns delivery_status_unknown without retrying when the controlled channel throws after dispatch", async () => {
    const preview = expectPreviewAllowed();
    const controlled = makeControlledChannel({
      onSend() {
        throw new Error("socket closed after dispatch to hiring@example.test");
      },
    });

    const result = await sendMcpApprovedApplicationMessage(
      makeSendAuthorization(preview),
      { channel: controlled.channel, egressPolicy: makeEgressPolicy() },
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("delivery_status_unknown");
    expect(result.deliveryStatus).toBe("delivery_status_unknown");
    expect(result.writeActionExecuted).toBe(true);
    expect(result.networkRequestExecuted).toBe(true);
    expect(controlled.calls).toHaveLength(1);
    expectSafeSendResult(result);
  });

  it("keeps PR76 generic write execution disabled for unrelated write actions", () => {
    const proposalResult = createMcpWriteActionProposal({
      kind: "mcp_write_action_intent",
      intentKind: "write_action",
      actionLabel: "send_unrelated_message",
      actionCategory: "send_message",
      affectedSurface: "unrelated_surface",
      userVisibleSummary: "Unrelated write action remains blocked.",
      riskLevel: "high",
      requiredConfirmationCopy: "confirm_unrelated_send",
      idempotencyKey: "mcp-write-action:unrelated:001",
      rollbackPlan: "No rollback is available for unrelated sends.",
      dataClasses: ["application_material"],
      version: 1,
    });
    expect(proposalResult.allowed).toBe(true);
    if (!proposalResult.allowed) {
      throw new Error("Expected unrelated write proposal to be created.");
    }

    const result = assertMcpWriteActionExecutionDisabled(
      proposalResult.proposal,
      {
        kind: "mcp_write_action_confirmation_result",
        proposalRef: proposalResult.proposal.proposalRef,
        state: "confirmed",
        actor: "human_user",
        confirmationCopy: "confirm_unrelated_send",
        idempotencyKey: "mcp-write-action:unrelated:001",
        version: 1,
      },
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("write_execution_disabled");
    expect(result.writeActionExecuted).toBe(false);
    expect(result.externalSideEffect).toBe(false);
    expect(result.networkAccess).toBe(false);
  });

  it("keeps all network APIs and provider SDKs out of the PR78 orchestration module", () => {
    const source = readFileSync(SEND_SOURCE_FILE, "utf8");

    for (const pattern of FORBIDDEN_SEND_SOURCE_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });

  it("depends only on PR76 write-action and PR77 outbound-egress boundaries", () => {
    const source = readFileSync(SEND_SOURCE_FILE, "utf8");
    const writeFrameworkSource = readFileSync(WRITE_FRAMEWORK_SOURCE_FILE, "utf8");
    const egressSource = readFileSync(EGRESS_SOURCE_FILE, "utf8");

    expect(source).toContain("mcpWriteActionFramework");
    expect(source).toContain("mcpOutboundEgressPolicy");
    expect(writeFrameworkSource).toContain("write_execution_disabled");
    expect(egressSource).toContain("networkRequestExecuted: false");
  });
});
