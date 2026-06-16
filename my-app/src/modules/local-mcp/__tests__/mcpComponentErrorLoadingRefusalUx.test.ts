import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateLocalMcpComponentDataPolicy } from "../mcpComponentDataPolicy";
import {
  buildMcpComponentErrorLoadingRefusalUx,
  buildMcpComponentErrorLoadingRefusalUxSafeRefusal,
  type McpComponentErrorLoadingRefusalUxActionLabelV1,
  type McpComponentErrorLoadingRefusalUxReasonV1,
  type McpComponentErrorLoadingRefusalUxResultV1,
} from "../mcpComponentErrorLoadingRefusalUx";
import { assertLocalMcpPrivacySafeOutput } from "../privacyRedactionFixtures";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const UX_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpComponentErrorLoadingRefusalUx.ts",
);
const TEST_SOURCE_FILE = resolve(
  TEST_DIR,
  "mcpComponentErrorLoadingRefusalUx.test.ts",
);

const FORBIDDEN_FRAGMENTS = [
  "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_RESUME_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_JOB_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_PROPOSAL_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_APPLICATION_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "RAW_COVER_LETTER_SENTINEL_DO_NOT_EXPOSE",
  "SOURCE_QUOTE_DUMP_SENTINEL_DO_NOT_EXPOSE",
  "PRIVATE_FACT_SENTINEL_DO_NOT_EXPOSE",
  "NEVER_USE_SENTINEL_DO_NOT_EXPOSE",
  "GENERATED_FULL_TEXT_SENTINEL_DO_NOT_EXPOSE",
  "SECRET_TOKEN_SENTINEL_DO_NOT_EXPOSE",
  "SESSION_DETAIL_SENTINEL_DO_NOT_EXPOSE",
  "real-user@example.test",
  "clerk_DO_NOT_EXPOSE",
  "user_DO_NOT_EXPOSE",
  "stytch_subject_DO_NOT_EXPOSE",
  "provider_subject_DO_NOT_EXPOSE",
  "rawClaims",
  "accessToken",
  "refreshToken",
  "Bearer ",
  "j97convexdocumentid",
] as const;

const STATE_CASES = [
  ["loading", "loading", "pending", "refresh_inputs", false, false],
  [
    "missing_consent",
    "unavailable",
    "onboarding_required",
    "add_application_context",
    true,
    false,
  ],
  [
    "missing_auth",
    "unavailable",
    "onboarding_required",
    "add_application_context",
    true,
    false,
  ],
  [
    "missing_account_link",
    "unavailable",
    "onboarding_required",
    "add_application_context",
    true,
    false,
  ],
  [
    "expired_auth",
    "unavailable",
    "onboarding_required",
    "add_application_context",
    true,
    false,
  ],
  ["privacy_blocked", "refusal", "blocked", "review_blockers", false, false],
  [
    "unavailable_review_data",
    "unavailable",
    "no_data_available",
    "add_application_context",
    false,
    false,
  ],
  ["budget_exceeded", "error", "blocked", "review_blockers", false, true],
  [
    "unsafe_action_refused",
    "refusal",
    "blocked",
    "review_blockers",
    false,
    false,
  ],
  [
    "safe_unavailable",
    "unavailable",
    "no_data_available",
    "ready_for_review",
    false,
    false,
  ],
  ["safe_refusal", "refusal", "blocked", "review_blockers", false, false],
] as const;

function uxStateInput(
  reason: McpComponentErrorLoadingRefusalUxReasonV1,
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_component_error_loading_refusal_ux_state_input",
    reason,
    version: 1,
    ...overrides,
  };
}

function componentInput(
  reason: McpComponentErrorLoadingRefusalUxReasonV1,
  stateOverrides: Record<string, unknown> = {},
  inputOverrides: Record<string, unknown> = {},
) {
  return {
    kind: "mcp_component_error_loading_refusal_ux_input",
    uxState: uxStateInput(reason, stateOverrides),
    version: 1,
    ...inputOverrides,
  };
}

function expectAllowed(
  result: McpComponentErrorLoadingRefusalUxResultV1,
): Extract<McpComponentErrorLoadingRefusalUxResultV1, { allowed: true }> {
  expect(result.allowed).toBe(true);
  if (!result.allowed)
    throw new TypeError("expected component UX state to be allowed");
  expect(result.capabilities).toEqual({
    componentData: "policy_checked",
    componentRendering: "view_model_only",
    componentRuntime: "blocked",
    uiBridgeRuntime: "blocked",
    toolCalls: "blocked",
    modelContextRuntime: "blocked",
    dataReads: "blocked",
    dataWrites: "blocked",
    exportActions: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    rawDataProjection: "blocked",
    credentialStorage: "none",
    tokenStorage: "none",
    version: 1,
  });
  assertSafeOutput(result);
  return result;
}

function expectBlocked(
  input: unknown,
): Extract<McpComponentErrorLoadingRefusalUxResultV1, { allowed: false }> {
  const result = buildMcpComponentErrorLoadingRefusalUx(input);
  expect(result.allowed).toBe(false);
  if (result.allowed)
    throw new TypeError("expected component UX state to be blocked");
  expect(result.safeRefusal).toEqual(
    buildMcpComponentErrorLoadingRefusalUxSafeRefusal(),
  );
  expect(result).not.toHaveProperty("component");
  expect(validateSurface("component_visible_error", result.safeRefusal)).toEqual(
    expect.objectContaining({ allowed: true }),
  );
  assertSafeOutput(result);
  return result;
}

function assertSafeOutput(value: unknown): void {
  assertLocalMcpPrivacySafeOutput(value);
  const serialized = JSON.stringify(value);
  for (const fragment of FORBIDDEN_FRAGMENTS) {
    expect(serialized).not.toContain(fragment);
  }
  expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/u);
}

function validateSurface(surface: string, payload: unknown) {
  return validateLocalMcpComponentDataPolicy({
    kind: "local_mcp_component_data_policy_input",
    surface,
    payload,
    version: 1,
  });
}

function sourceFiles(): readonly string[] {
  return [UX_SOURCE_FILE, TEST_SOURCE_FILE].map((file) =>
    readFileSync(file, "utf8"),
  );
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuvy]*/gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

const FORBIDDEN_SCOPE_PATTERNS: readonly RegExp[] = [
  /from\s+["'][^"']*(?:components|pages|routes|convex)\//iu,
  /package\.json|package-lock|pnpm-lock|schema\.ts/iu,
  /\b(window|document|localStorage|sessionStorage)\b/u,
  /\bsetTimeout|setInterval|requestAnimationFrame\b/u,
];

describe("PR67 component error loading refusal UX boundary", () => {
  it.each(STATE_CASES)(
    "projects allowed %s state into policy-checked component surfaces",
    (reason, category, status, actionLabel, approvalNeeded, overLimit) => {
      const result = expectAllowed(
        buildMcpComponentErrorLoadingRefusalUx(
          componentInput(reason as McpComponentErrorLoadingRefusalUxReasonV1),
        ),
      );

      expect(result.reason).toBe("safe_ux_state_projected");
      expect(result.component.structuredContent).toEqual(
        expect.objectContaining({
          kind: "mcp_component_error_loading_refusal_ux_state",
          allowed: true,
          reason,
          category,
          status,
          nextUserAction: actionLabel,
          modelVisible: true,
          componentVisible: true,
          version: 1,
        }),
      );
      expect(result.component.structuredContent.safeFlags).toEqual({
        approvalNeeded,
        staleData: false,
        overLimit,
        version: 1,
      });
      expect(result.component.content).toEqual([
        { type: "text", text: result.component.structuredContent.message },
        {
          type: "text",
          text: expect.stringMatching(/^Next action: /u),
        },
      ]);
      expect(result.component.meta).toEqual(
        expect.objectContaining({
          kind: "local_mcp_component_data_policy_safe_meta",
          reason,
          category,
          status,
        }),
      );
      expect(result.component.props).toEqual(
        expect.objectContaining({
          kind: "local_mcp_component_data_policy_safe_props",
          title: expect.any(String),
          message: expect.any(String),
          safeSummary: expect.any(String),
          nextUserAction: actionLabel,
        }),
      );
      expect(result.component.bridgePayload).toEqual(
        expect.objectContaining({
          kind: "local_mcp_component_data_policy_safe_bridge_payload",
          reason,
          category,
          status,
        }),
      );
      expect(result.component.stateSnapshot).toEqual(
        expect.objectContaining({
          kind: "local_mcp_component_data_policy_safe_state_snapshot",
          safeRefs: ["mcp-safe-ref:review-cockpit:latest"],
        }),
      );
      expect(result.component.modelContextUpdate).toEqual(
        expect.objectContaining({
          kind: "local_mcp_component_data_policy_safe_model_context_update",
          safeSummary: expect.any(String),
        }),
      );
      expect(result.component.actionLabel).toBe(actionLabel);
      expect(result.policy).toEqual({
        model_visible_structured_content: "allowed",
        model_visible_content: "allowed",
        component_visible_structured_content: "allowed",
        component_visible_content: "allowed",
        component_visible_meta: "allowed",
        component_visible_props: "allowed",
        component_visible_bridge_payload: "allowed",
        component_visible_state_snapshot: "allowed",
        component_visible_model_context_update: "allowed",
        component_visible_action_label: "allowed",
      });
    },
  );

  it.each([
    ["model structured", "model_visible_structured_content", "structuredContent"],
    ["model content", "model_visible_content", "content"],
    [
      "component structured",
      "component_visible_structured_content",
      "structuredContent",
    ],
    ["component content", "component_visible_content", "content"],
    ["meta", "component_visible_meta", "meta"],
    ["props", "component_visible_props", "props"],
    ["bridge payload", "component_visible_bridge_payload", "bridgePayload"],
    ["state snapshot", "component_visible_state_snapshot", "stateSnapshot"],
    [
      "model context update",
      "component_visible_model_context_update",
      "modelContextUpdate",
    ],
  ] as const)("keeps %s passing PR65 policy", (_label, surface, payloadKey) => {
    const result = expectAllowed(
      buildMcpComponentErrorLoadingRefusalUx(componentInput("loading")),
    );
    const policyResult = validateSurface(surface, result.component[payloadKey]);

    expect(policyResult.allowed).toBe(true);
  });

  it("treats _meta as component-visible and blocks unsafe metadata", () => {
    const result = expectAllowed(
      buildMcpComponentErrorLoadingRefusalUx(componentInput("safe_refusal")),
    );
    const unsafeMeta = {
      ...result.component.meta,
      rawMeta: "RAW_CV_TEXT_SENTINEL_DO_NOT_EXPOSE",
    };

    expect(validateSurface("component_visible_meta", unsafeMeta)).toEqual(
      expect.objectContaining({ allowed: false }),
    );
  });

  it("keeps next-action labels safe and blocks write/export/download/send/submit/apply labels", () => {
    const allowedActions: readonly McpComponentErrorLoadingRefusalUxActionLabelV1[] =
      [
        "add_application_context",
        "ready_for_review",
        "refresh_inputs",
        "review_blockers",
      ];

    for (const actionLabel of allowedActions) {
      expect(
        validateSurface("component_visible_action_label", actionLabel),
      ).toEqual(expect.objectContaining({ allowed: true }));
    }

    for (const unsafeAction of [
      "write",
      "export",
      "download",
      "send",
      "submit",
      "apply",
    ] as const) {
      expect(validateSurface("component_visible_action_label", unsafeAction)).toEqual(
        expect.objectContaining({ allowed: false }),
      );
    }
  });

  it.each([
    [
      "raw CV ref",
      ["mcp-safe-ref:review-cockpit:raw-cv"],
      "policy_blocked",
    ],
    [
      "identity ref",
      ["mcp-safe-ref:review-cockpit:clerk_do_not_expose"],
      "policy_blocked",
    ],
    ["unsafe ref", ["j97convexdocumentid"], "invalid_input"],
  ] as const)(
    "blocks raw or sensitive sentinel material from refs: %s",
    (_label, refIds, reason) => {
      const result = expectBlocked(
        componentInput("privacy_blocked", {
          refIds,
        }),
      );

      expect(result.reason).toBe(reason);
    },
  );

  it.each([
    ["null", null],
    ["wrong kind", { kind: "wrong", uxState: uxStateInput("loading"), version: 1 }],
    ["missing UX state", { kind: "mcp_component_error_loading_refusal_ux_input", version: 1 }],
    [
      "missing nested UX reason",
      {
        kind: "mcp_component_error_loading_refusal_ux_input",
        uxState: {
          kind: "mcp_component_error_loading_refusal_ux_state_input",
          version: 1,
        },
        version: 1,
      },
    ],
    [
      "unknown UX reason",
      {
        kind: "mcp_component_error_loading_refusal_ux_input",
        uxState: {
          kind: "mcp_component_error_loading_refusal_ux_state_input",
          reason: "retry_later",
          version: 1,
        },
        version: 1,
      },
    ],
  ] as const)("fails closed for malformed input: %s", (_label, input) => {
    const result = expectBlocked(input);

    expect(result.reason).toBe("invalid_input");
  });

  it.each([
    ["loading plus error", componentInput("loading", { category: "error" })],
    ["loading plus refusal", componentInput("loading", { refusal: true })],
    [
      "refusal plus allowed state",
      componentInput("safe_refusal", { allowed: true }),
    ],
    [
      "expired auth plus missing consent",
      componentInput("expired_auth", { secondaryReason: "missing_consent" }),
    ],
  ] as const)("fails closed for contradictory states: %s", (_label, input) => {
    const result = expectBlocked(input);

    expect(result.reason).toBe("invalid_input");
  });

  it("fails closed for symbol keys, accessors, and hostile proxies without throwing", () => {
    const symbolInput = componentInput("loading", {
      [Symbol("hidden")]: "unsafe",
    });
    expect(expectBlocked(symbolInput).reason).toBe("invalid_input");

    const accessorInput = componentInput("loading");
    Object.defineProperty(accessorInput.uxState, "reason", {
      enumerable: true,
      get() {
        throw new TypeError("unsafe getter");
      },
    });
    expect(() => buildMcpComponentErrorLoadingRefusalUx(accessorInput)).not.toThrow();
    expect(expectBlocked(accessorInput).reason).toBe("invalid_input");

    const getTrapProxy = new Proxy(componentInput("loading"), {
      get() {
        throw new TypeError("unsafe get trap");
      },
    });
    expect(() => buildMcpComponentErrorLoadingRefusalUx(getTrapProxy)).not.toThrow();
    expect(expectBlocked(getTrapProxy).reason).toBe("invalid_input");

    const { proxy, revoke } = Proxy.revocable(componentInput("loading"), {
      getPrototypeOf() {
        throw new TypeError("revoked");
      },
    });
    revoke();
    expect(() => buildMcpComponentErrorLoadingRefusalUx(proxy)).not.toThrow();
    expect(expectBlocked(proxy).reason).toBe("invalid_input");
  });

  it("does not add runtime, network, model, write, or PR68 behavior", () => {
    const implementation = stripStringAndPatternLiterals(
      readFileSync(UX_SOURCE_FILE, "utf8"),
    );

    expect(implementation).not.toMatch(
      /window\.openai|postMessage|React|\.tsx|\.jsx|iframe|registerTool|registerResource/u,
    );
    expect(implementation).not.toMatch(/tools\/list|tools\/call/u);
    expect(implementation).not.toMatch(
      /\b(fetch|axios|XMLHttpRequest|WebSocket|EventSource|OpenAI|chat\.completions|responses\.create)\b/u,
    );
    expect(implementation).not.toMatch(
      /\b(mutation|action|internalMutation|internalAction)\s*\(/u,
    );
    expect(implementation).not.toMatch(
      /\b(download|send|submit|apply|export)\s*\(/u,
    );
    expect(implementation).not.toMatch(
      /generated artifact boundary|resume variant preview|cover letter preview|artifact storage/iu,
    );
  });

  it("keeps PR67 changed sources out of package, schema, runtime, and component files", () => {
    const hits = sourceFiles()
      .map(stripStringAndPatternLiterals)
      .flatMap((source) =>
        FORBIDDEN_SCOPE_PATTERNS.filter((pattern) => pattern.test(source)).map(
          String,
        ),
      );

    expect(hits).toEqual([]);
  });
});
