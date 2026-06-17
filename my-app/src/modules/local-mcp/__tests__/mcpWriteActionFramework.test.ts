import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";
import {
  assertMcpWriteActionExecutionDisabled,
  blockMcpWriteAction,
  createMcpNoopWriteActionResult,
  createMcpWriteActionConfirmationRequest,
  createMcpWriteActionProposal,
  type McpWriteActionConfirmationResultV1,
  type McpWriteActionIntentV1,
  type McpWriteActionProposalV1,
} from "../mcpWriteActionFramework";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FRAMEWORK_SOURCE_FILE = resolve(TEST_DIR, "../mcpWriteActionFramework.ts");
const TEST_SOURCE_FILE = resolve(TEST_DIR, "mcpWriteActionFramework.test.ts");

function writeIntent(
  overrides: Partial<McpWriteActionIntentV1> = {},
): McpWriteActionIntentV1 {
  return {
    kind: "mcp_write_action_intent",
    intentKind: "write_action",
    actionLabel: "send_application_message",
    actionCategory: "send_message",
    affectedSurface: "external_email",
    userVisibleSummary:
      "Send the approved application message to the selected destination.",
    riskLevel: "high",
    requiredConfirmationCopy:
      "I confirm this approved application message should be sent.",
    idempotencyKey: "mcp-write-action:send-application-message:001",
    rollbackPlan:
      "No external state exists in PR76; revert the enabling PR if needed.",
    dataClasses: [
      "safe_summary",
      "generated_artifact",
      "application_material",
      "destination_metadata",
      "user_confirmation",
      "audit_metadata",
    ],
    version: 1,
    ...overrides,
  };
}

function readOnlyIntent(
  overrides: Partial<McpWriteActionIntentV1> = {},
): McpWriteActionIntentV1 {
  return {
    kind: "mcp_write_action_intent",
    intentKind: "read_only_operation",
    actionLabel: "summarize_review_state",
    actionCategory: "read_only",
    affectedSurface: "local_mcp_safe_summary",
    userVisibleSummary:
      "Read-only summary text may mention send, submit, or apply as prose.",
    riskLevel: "none",
    rollbackPlan: "No write state exists; no rollback is required.",
    dataClasses: ["safe_summary", "audit_metadata"],
    version: 1,
    ...overrides,
  };
}

function expectProposal(
  result: ReturnType<typeof createMcpWriteActionProposal>,
): McpWriteActionProposalV1 {
  expect(result.allowed).toBe(true);
  if (!result.allowed) throw new TypeError("expected write action proposal");
  assertLocalMcpPrivacySafeOutput(result);
  return result.proposal;
}

function confirmedFor(
  proposal: McpWriteActionProposalV1,
): McpWriteActionConfirmationResultV1 {
  if (!proposal.idempotencyKey || !proposal.confirmation.requiredCopy) {
    throw new TypeError("expected proposal to require confirmation");
  }
  return {
    kind: "mcp_write_action_confirmation_result",
    proposalRef: proposal.proposalRef,
    state: "confirmed",
    actor: "human_user",
    confirmationCopy: proposal.confirmation.requiredCopy,
    idempotencyKey: proposal.idempotencyKey,
    version: 1,
  };
}

function sourceFiles(): readonly string[] {
  return [FRAMEWORK_SOURCE_FILE, TEST_SOURCE_FILE].map((file) =>
    readFileSync(file, "utf8"),
  );
}

function stripStringAndPatternLiterals(src: string): string {
  return src
    .replace(/`(?:\\.|[^`\\])*`/gmu, '""')
    .replace(/"(?:\\.|[^"\\])*"/gmu, '""')
    .replace(/'(?:\\.|[^'\\])*'/gmu, '""')
    .replace(/\/(?:\\.|[^/\\\n])+\/[a-z]*/gimu, "/_/u");
}

describe("PR76 write action framework", () => {
  it("represents write action proposals with deterministic policy metadata", () => {
    const proposal = expectProposal(createMcpWriteActionProposal(writeIntent()));

    expect(proposal).toMatchObject({
      kind: "mcp_write_action_proposal",
      operationKind: "proposed_write_action",
      actionLabel: "send_application_message",
      actionCategory: "send_message",
      affectedSurface: "external_email",
      riskLevel: "high",
      executionStatus: "proposed_pending_confirmation",
      writeActionExecuted: false,
      realExecutionAllowed: false,
      externalSideEffect: false,
      persisted: false,
      networkAccess: false,
      version: 1,
    });
    expect(proposal.confirmation).toEqual({
      kind: "mcp_write_action_confirmation_requirement",
      required: true,
      state: "required_unconfirmed",
      requiredCopy: "I confirm this approved application message should be sent.",
      version: 1,
    });
    expect(proposal.capabilities).toMatchObject({
      dataWrites: "blocked",
      writeActions: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      persistenceWrites: "blocked",
      externalSideEffects: "blocked",
      credentialStorage: "none",
      tokenStorage: "none",
    });
    expect(proposal.dataClasses).toEqual([
      "safe_summary",
      "generated_artifact",
      "application_material",
      "destination_metadata",
      "user_confirmation",
      "audit_metadata",
    ]);
    expect(proposal.auditEvent).toMatchObject({
      kind: "mcp_write_action_audit_event",
      eventKind: "write_action_proposed",
      persisted: false,
      writeActionExecuted: false,
      version: 1,
    });
  });

  it("blocks unconfirmed write action execution centrally", () => {
    const proposal = expectProposal(createMcpWriteActionProposal(writeIntent()));

    const guard = assertMcpWriteActionExecutionDisabled(proposal);

    expect(guard).toMatchObject({
      kind: "mcp_write_action_guard_result",
      allowed: false,
      reason: "confirmation_required",
      operationKind: "blocked_write_action",
      executionStatus: "blocked",
      userVisibleReason: "Confirmation is required before this write action.",
      realExecutionAllowed: false,
      writeActionExecuted: false,
      externalSideEffect: false,
      persisted: false,
      networkAccess: false,
      version: 1,
    });
    expect(guard.safeRefusal.msg).toBe(
      "Refused. Write action execution is disabled.",
    );
    assertLocalMcpPrivacySafeOutput(guard);
  });

  it("keeps confirmed write actions non-executable in PR76", () => {
    const proposal = expectProposal(createMcpWriteActionProposal(writeIntent()));
    const confirmationRequest = createMcpWriteActionConfirmationRequest(proposal);
    const confirmation = confirmedFor(proposal);

    expect(confirmationRequest).toMatchObject({
      kind: "mcp_write_action_confirmation_request",
      required: true,
      state: "confirmation_required",
      proposalRef: proposal.proposalRef,
      requiredCopy: proposal.confirmation.requiredCopy,
      riskLevel: "high",
      version: 1,
    });

    const guard = assertMcpWriteActionExecutionDisabled(proposal, confirmation);

    expect(guard).toMatchObject({
      allowed: false,
      reason: "write_execution_disabled",
      operationKind: "confirmed_not_executable_placeholder",
      executionStatus: "confirmed_execution_disabled",
      userVisibleReason:
        "Write action is confirmed but real execution is disabled in this framework.",
      realExecutionAllowed: false,
      writeActionExecuted: false,
      externalSideEffect: false,
      persisted: false,
      networkAccess: false,
    });
    assertLocalMcpPrivacySafeOutput(guard);
  });

  it("can return a confirmed simulated no-op result without side effects", () => {
    const proposal = expectProposal(
      createMcpWriteActionProposal(
        writeIntent({ actionCategory: "apply_to_job" }),
      ),
    );
    const result = createMcpNoopWriteActionResult(
      proposal,
      confirmedFor(proposal),
    );

    expect(result).toMatchObject({
      kind: "mcp_write_action_noop_result",
      allowed: true,
      reason: "simulated_noop",
      operationKind: "simulated_noop_result",
      executionStatus: "simulated_noop",
      safeSummary:
        "Write action simulated as a no-op. No external side effect executed.",
      realExecutionAllowed: false,
      writeActionExecuted: false,
      externalSideEffect: false,
      persisted: false,
      networkAccess: false,
      version: 1,
    });
    expect(result.auditEvent).toMatchObject({
      eventKind: "write_action_noop_simulated",
      actionCategory: "apply_to_job",
      persisted: false,
      writeActionExecuted: false,
    });
    assertLocalMcpPrivacySafeOutput(result);
  });

  it("keeps blocked reasons deterministic and user-visible", () => {
    const proposal = expectProposal(
      createMcpWriteActionProposal(
        writeIntent({ actionCategory: "submit_application" }),
      ),
    );

    const blocked = blockMcpWriteAction(
      proposal,
      "unsupported_write_action",
      "Submit/apply behavior is not implemented in PR76.",
    );

    expect(blocked).toMatchObject({
      kind: "mcp_write_action_guard_result",
      allowed: false,
      reason: "unsupported_write_action",
      operationKind: "blocked_write_action",
      executionStatus: "blocked",
      userVisibleReason: "Submit/apply behavior is not implemented in PR76.",
      writeActionExecuted: false,
      realExecutionAllowed: false,
      version: 1,
    });
    expect(blocked.safeRefusal.msg).toBe(
      "Refused. Write action execution is disabled.",
    );
  });

  it("does not classify natural-language prose as executable write intent", () => {
    const readOnly = expectProposal(
      createMcpWriteActionProposal(
        readOnlyIntent({
          userVisibleSummary:
            "The reviewed cover letter says submit the materials after approval.",
        }),
      ),
    );

    expect(readOnly.operationKind).toBe("read_only_operation");
    expect(readOnly.executionStatus).toBe("read_only_no_write");
    expect(readOnly.confirmation.required).toBe(false);

    const guard = assertMcpWriteActionExecutionDisabled(readOnly);
    expect(guard).toMatchObject({
      allowed: true,
      reason: "read_only_operation",
      operationKind: "read_only_operation",
      executionStatus: "read_only_no_write",
      writeActionExecuted: false,
      realExecutionAllowed: false,
    });

    const executableMetadata = expectProposal(
      createMcpWriteActionProposal(
        writeIntent({
          actionLabel: "apply_after_human_confirmation",
          actionCategory: "apply_to_job",
          userVisibleSummary:
            "Apply action metadata is explicit and remains blocked.",
        }),
      ),
    );
    expect(executableMetadata.operationKind).toBe("proposed_write_action");
  });

  it("fails closed for malformed write metadata", () => {
    for (const input of [
      {
        ...writeIntent(),
        requiredConfirmationCopy: undefined,
      },
      {
        ...writeIntent(),
        idempotencyKey: "send-now",
      },
      {
        ...writeIntent(),
        actionCategory: "read_only",
      },
      {
        ...writeIntent(),
        dataClasses: ["safe_summary", "raw_resume_text"],
      },
      {
        ...writeIntent(),
        affectedSurface: "https://example.test/apply",
      },
      {
        ...writeIntent(),
        userVisibleSummary: "Bearer abc123",
      },
    ] as const) {
      const result = createMcpWriteActionProposal(input);
      expect(result.allowed).toBe(false);
      if (result.allowed) throw new TypeError("expected malformed metadata");
      expect(result.reason).toBe("invalid_input");
      expect(result.writeActionExecuted).toBe(false);
      assertLocalMcpPrivacySafeOutput(result);
    }
  });

  it("keeps the framework free of runtime, network, storage, and connector execution", () => {
    for (const source of sourceFiles()) {
      const stripped = stripStringAndPatternLiterals(source);
      expect(source).not.toMatch(/from\s+["'][^"']*(?:components|pages|routes|convex)\//iu);
      expect(source).not.toMatch(/from\s+["']node:(?:http|https|fs|net|tls|child_process)/iu);
      expect(source).not.toMatch(/\bprocess\./u);
      expect(stripped).not.toMatch(
        /\b(fetch|axios|XMLHttpRequest|WebSocket|EventSource|OpenAI|chat\.completions|responses\.create)\b/u,
      );
      expect(stripped).not.toMatch(
        /\b(mutation|action|internalMutation|internalAction)\s*\(/u,
      );
      expect(stripped).not.toMatch(
        /\b(writeFile|appendFile|createWriteStream|mkdir|rm|rename|unlink)\s*\(/u,
      );
      expect(stripped).not.toMatch(
        /\b(registerTool|registerResource|tools\/call|tools\/list|window\.openai|postMessage)\b/u,
      );
    }
  });
});
