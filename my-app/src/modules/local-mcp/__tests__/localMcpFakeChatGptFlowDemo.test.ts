import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertLocalMcpFakeChatGptFlowDemo,
  buildLocalMcpFakeChatGptFlowDemo,
} from "../localMcpFakeChatGptFlowDemo";
import {
  assertLocalMcpPrivacySafeOutput,
  buildLocalMcpPrivacyFixtureSet,
} from "../privacyRedactionFixtures";

const SOURCE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../localMcpFakeChatGptFlowDemo.ts");

function implementationSource(): string {
  return readFileSync(SOURCE_FILE, "utf8");
}

describe("local MCP fake ChatGPT flow demo", () => {
  it("builds a deterministic fake-data-only local developer flow", () => {
    const first = buildLocalMcpFakeChatGptFlowDemo();
    const second = buildLocalMcpFakeChatGptFlowDemo();

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      kind: "local_mcp_fake_chatgpt_flow_demo",
      scenario: "safe_summary_with_write_refusal",
      fixtureOnly: true,
      localDevOnly: true,
      networkReachable: false,
      noRealUserData: true,
      noRawSourceText: true,
      noPrivateFacts: true,
      noNeverUseFacts: true,
      noOAuth: true,
      noProductionConnector: true,
      noHandlerExecution: true,
      noSendApplyExport: true,
      version: 1,
    });
    expect(first.steps.map((step) => step.action)).toEqual([
      "initialize_dev_endpoint",
      "list_fixture_tools",
      "simulate_approved_fixture_call",
      "verify_endpoint_call_refusal",
      "simulate_write_action_refusal",
    ]);
  });

  it("keeps every step fixture-only, local-dev-only, and non-executable", () => {
    const demo = buildLocalMcpFakeChatGptFlowDemo();

    assertLocalMcpFakeChatGptFlowDemo(demo);
    expect(Object.isFrozen(demo)).toBe(true);
    expect(Object.isFrozen(demo.steps)).toBe(true);
    for (const step of demo.steps) {
      expect(Object.isFrozen(step)).toBe(true);
      expect(Object.isFrozen(step.response)).toBe(true);
      expect(step).toMatchObject({
        kind: "local_mcp_fake_chatgpt_flow_demo_step",
        fixtureOnly: true,
        localDevOnly: true,
        noRealUserData: true,
        noHandlerExecution: true,
        noNetwork: true,
        version: 1,
      });
    }
  });

  it("covers fake endpoint initialize and tools/list without real connector behavior", () => {
    const demo = buildLocalMcpFakeChatGptFlowDemo();
    const [initialize, toolsList] = demo.steps;

    expect(initialize.response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        result: {
          fixtureOnly: true,
          localDevOnly: true,
          capabilities: { tools: { listChanged: false } },
        },
      },
    });
    expect(toolsList.response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        result: {
          kind: "local_mcp_tools_list_fixture_response",
          fixtureOnly: true,
          callable: false,
          runnable: false,
          networkReachable: false,
          toolCount: 4,
        },
      },
    });
  });

  it("shows only safe-summary fixture calls and endpoint handler refusal", () => {
    const demo = buildLocalMcpFakeChatGptFlowDemo();
    const approvedFixtureCall = demo.steps[2];
    const endpointCallRefusal = demo.steps[3];
    const writeActionRefusal = demo.steps[4];

    expect(approvedFixtureCall.response).toMatchObject({
      success: true,
      fixtureOnly: true,
      result: {
        kind: "local_mcp_safe_text_fixture_output",
        status: "safe_summary_only",
        summary: "Fixture-only tools/call accepted for local_mcp.application_package.summarize. No product action executed.",
      },
    });
    expect(endpointCallRefusal.response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        error: {
          code: -32020,
          message: "Local dev MCP endpoint does not run tool handlers.",
          fixtureOnly: true,
          localDevOnly: true,
        },
      },
    });
    expect(writeActionRefusal.response).toMatchObject({
      success: false,
      fixtureOnly: true,
      error: {
        code: "write_action_refusal",
        message: "Refused. Write action blocked.",
        safeForModel: true,
      },
    });
  });

  it("does not expose privacy sentinels, real-data fields, or raw prompt payloads", () => {
    const demo = buildLocalMcpFakeChatGptFlowDemo();
    const fixtureSet = buildLocalMcpPrivacyFixtureSet();
    const serialized = JSON.stringify(demo);

    assertLocalMcpPrivacySafeOutput(demo, fixtureSet);
    for (const sentinel of fixtureSet.sentinels) {
      expect(serialized).not.toContain(sentinel.val);
    }
    for (const forbidden of [
      "rawCv",
      "rawResume",
      "rawCoverLetter",
      "rawJob",
      "sourceQuote",
      "privateFacts",
      "neverUseFacts",
      "oauthToken",
      "clerkUserId",
      "convexUserId",
    ] as const) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(serialized).not.toContain("fixture-application-package");
    expect(serialized).not.toContain("Apply to this job now.");
  });

  it("keeps implementation source free of SDKs, real handlers, outbound calls, OAuth, and product actions", () => {
    const source = implementationSource();
    const forbiddenFragments = [
      "@modelcontextprotocol",
      "@openai",
      "next/server",
      "convex",
      "node:http",
      "node:https",
      "createServer(",
      ".listen(",
      "server.connect",
      "fetch(",
      "axios",
      "undici",
      "XMLHttpRequest",
      "WebSocket(",
      "EventSource(",
      "OAuthProvider",
      "ChatGPTConnector",
      "executeLocalMcpRequest(",
      "exportFile(",
      "downloadFile(",
      "sendEmail(",
      "submitApplication(",
      "applyToJob(",
    ] as const;

    for (const fragment of forbiddenFragments) {
      expect(source).not.toContain(fragment);
    }
  });
});
