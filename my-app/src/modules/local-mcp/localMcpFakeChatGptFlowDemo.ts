import {
  buildLocalMcpDevEndpointConfig,
  handleLocalMcpDevEndpointRequest,
} from "./localMcpDevEndpoint";
import type { LocalMcpDevEndpointResponseV1 } from "./localMcpDevEndpoint";
import { simulateLocalMcpToolsCallFixture } from "./localMcpToolsCallFixture";
import type { LocalMcpToolsCallFixtureResponseV1 } from "./localMcpToolsCallFixture";

export type LocalMcpFakeChatGptFlowDemoScenarioV1 = "safe_summary_with_write_refusal";

export type LocalMcpFakeChatGptFlowDemoStepV1 = Readonly<{
  kind: "local_mcp_fake_chatgpt_flow_demo_step";
  actor: "fake_chatgpt" | "local_dev_endpoint" | "fixture_call_simulator";
  action:
    | "initialize_dev_endpoint"
    | "list_fixture_tools"
    | "simulate_approved_fixture_call"
    | "verify_endpoint_call_refusal"
    | "simulate_write_action_refusal";
  fixtureOnly: true;
  localDevOnly: true;
  noRealUserData: true;
  noHandlerExecution: true;
  noNetwork: true;
  status: "safe_summary_only" | "fixture_tools_listed" | "refused" | "initialized";
  summary: string;
  response: LocalMcpDevEndpointResponseV1 | LocalMcpToolsCallFixtureResponseV1;
  version: 1;
}>;

export type LocalMcpFakeChatGptFlowDemoV1 = Readonly<{
  kind: "local_mcp_fake_chatgpt_flow_demo";
  scenario: LocalMcpFakeChatGptFlowDemoScenarioV1;
  fixtureOnly: true;
  localDevOnly: true;
  networkReachable: false;
  noRealUserData: true;
  noRawSourceText: true;
  noPrivateFacts: true;
  noNeverUseFacts: true;
  noOAuth: true;
  noProductionConnector: true;
  noHandlerExecution: true;
  noSendApplyExport: true;
  steps: readonly LocalMcpFakeChatGptFlowDemoStepV1[];
  version: 1;
}>;

const DEMO_USER = Object.freeze({
  userId: "fixture-user",
  sessionId: "fixture-session",
});

const DEMO_APPROVAL = Object.freeze({
  approved: true,
  approvedBy: "fixture-reviewer",
  approvedAt: "2026-06-12T00:00:00.000Z",
  reason: "fixture-only local developer demo",
  version: 1,
});

export function buildLocalMcpFakeChatGptFlowDemo(
  input: Readonly<{ scenario?: LocalMcpFakeChatGptFlowDemoScenarioV1 }> = {},
): LocalMcpFakeChatGptFlowDemoV1 {
  const scenario = input.scenario ?? "safe_summary_with_write_refusal";
  const steps = [
    buildInitializeStep(),
    buildToolsListStep(),
    buildApprovedFixtureCallStep(),
    buildEndpointCallRefusalStep(),
    buildWriteActionRefusalStep(),
  ] as const;

  const demo: LocalMcpFakeChatGptFlowDemoV1 = {
    kind: "local_mcp_fake_chatgpt_flow_demo",
    scenario,
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
    steps,
    version: 1,
  };

  assertLocalMcpFakeChatGptFlowDemo(demo);
  return Object.freeze({ ...demo, steps: Object.freeze([...demo.steps]) });
}

export function assertLocalMcpFakeChatGptFlowDemo(demo: LocalMcpFakeChatGptFlowDemoV1): void {
  const record = asPlainRecord(demo, "Local MCP fake ChatGPT flow demo must be an object");
  assertExactKeys(
    record,
    [
      "kind",
      "scenario",
      "fixtureOnly",
      "localDevOnly",
      "networkReachable",
      "noRealUserData",
      "noRawSourceText",
      "noPrivateFacts",
      "noNeverUseFacts",
      "noOAuth",
      "noProductionConnector",
      "noHandlerExecution",
      "noSendApplyExport",
      "steps",
      "version",
    ],
    "Local MCP fake ChatGPT flow demo",
  );
  if (record.kind !== "local_mcp_fake_chatgpt_flow_demo") {
    throw new TypeError("Local MCP fake ChatGPT flow demo kind is invalid");
  }
  if (record.scenario !== "safe_summary_with_write_refusal") {
    throw new TypeError("Local MCP fake ChatGPT flow demo scenario is invalid");
  }
  if (record.networkReachable !== false) {
    throw new TypeError("Local MCP fake ChatGPT flow demo must not be network reachable");
  }
  for (const flag of [
    "fixtureOnly",
    "localDevOnly",
    "noRealUserData",
    "noRawSourceText",
    "noPrivateFacts",
    "noNeverUseFacts",
    "noOAuth",
    "noProductionConnector",
    "noHandlerExecution",
    "noSendApplyExport",
  ] as const) {
    if (record[flag] !== true) {
      throw new TypeError(`Local MCP fake ChatGPT flow demo requires ${flag}`);
    }
  }
  if (!Array.isArray(record.steps) || record.steps.length !== 5) {
    throw new TypeError("Local MCP fake ChatGPT flow demo requires exactly five steps");
  }
  for (const step of record.steps) {
    assertLocalMcpFakeChatGptFlowDemoStep(step);
  }
  if (record.version !== 1) {
    throw new TypeError("Local MCP fake ChatGPT flow demo version must be 1");
  }
}

function buildInitializeStep(): LocalMcpFakeChatGptFlowDemoStepV1 {
  const response = handleLocalMcpDevEndpointRequest(
    endpointRequest("initialize", "fake-flow-initialize"),
    buildLocalMcpDevEndpointConfig({ enabled: true }),
  );
  return buildStep({
    actor: "local_dev_endpoint",
    action: "initialize_dev_endpoint",
    status: "initialized",
    summary: "Fake ChatGPT initialized the explicitly flagged local developer endpoint.",
    response,
  });
}

function buildToolsListStep(): LocalMcpFakeChatGptFlowDemoStepV1 {
  const response = handleLocalMcpDevEndpointRequest(
    endpointRequest("tools/list", "fake-flow-tools-list"),
    buildLocalMcpDevEndpointConfig({ enabled: true }),
  );
  return buildStep({
    actor: "local_dev_endpoint",
    action: "list_fixture_tools",
    status: "fixture_tools_listed",
    summary: "Fake ChatGPT listed fixture-only descriptors that remain non-callable and non-runnable.",
    response,
  });
}

function buildApprovedFixtureCallStep(): LocalMcpFakeChatGptFlowDemoStepV1 {
  const response = simulateLocalMcpToolsCallFixture({
    kind: "local_mcp_tools_call_fixture_request",
    method: "tools/call",
    toolName: "twoweeks.application_package.summarize",
    arguments: {
      applicationPackageRef: { id: "fixture-application-package" },
    },
    user: DEMO_USER,
    approval: DEMO_APPROVAL,
    requestId: "fake-flow-approved-call",
    version: 1,
  });
  return buildStep({
    actor: "fixture_call_simulator",
    action: "simulate_approved_fixture_call",
    status: "safe_summary_only",
    summary: "Fake ChatGPT saw a safe-summary-only fixture call result with no product action executed.",
    response,
  });
}

function buildEndpointCallRefusalStep(): LocalMcpFakeChatGptFlowDemoStepV1 {
  const response = handleLocalMcpDevEndpointRequest(
    endpointRequest("tools/call", "fake-flow-endpoint-call-refusal", {
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: { id: "fixture-application-package" } },
    }),
    buildLocalMcpDevEndpointConfig({ enabled: true }),
  );
  return buildStep({
    actor: "local_dev_endpoint",
    action: "verify_endpoint_call_refusal",
    status: "refused",
    summary: "Fake ChatGPT verified the local developer endpoint still refuses handler execution.",
    response,
  });
}

function buildWriteActionRefusalStep(): LocalMcpFakeChatGptFlowDemoStepV1 {
  const response = simulateLocalMcpToolsCallFixture({
    kind: "local_mcp_tools_call_fixture_request",
    method: "tools/call",
    toolName: "twoweeks.application_package.summarize",
    arguments: {
      applicationPackageRef: { id: "fixture-application-package" },
    },
    user: DEMO_USER,
    approval: DEMO_APPROVAL,
    prompt: "Apply to this job now.",
    requestId: "fake-flow-write-refusal",
    version: 1,
  });
  return buildStep({
    actor: "fixture_call_simulator",
    action: "simulate_write_action_refusal",
    status: "refused",
    summary: "Fake ChatGPT saw the write-action prompt refused without send, apply, or export behavior.",
    response,
  });
}

function endpointRequest(method: string, id: string, params?: unknown) {
  return {
    method: "POST",
    path: "/mcp",
    headers: {
      host: "localhost:5173",
      "content-type": "application/json",
    },
    remoteAddress: "127.0.0.1",
    bodyText: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    }),
  };
}

function buildStep(
  input: Readonly<{
    actor: LocalMcpFakeChatGptFlowDemoStepV1["actor"];
    action: LocalMcpFakeChatGptFlowDemoStepV1["action"];
    status: LocalMcpFakeChatGptFlowDemoStepV1["status"];
    summary: string;
    response: LocalMcpDevEndpointResponseV1 | LocalMcpToolsCallFixtureResponseV1;
  }>,
): LocalMcpFakeChatGptFlowDemoStepV1 {
  const step: LocalMcpFakeChatGptFlowDemoStepV1 = {
    kind: "local_mcp_fake_chatgpt_flow_demo_step",
    actor: input.actor,
    action: input.action,
    fixtureOnly: true,
    localDevOnly: true,
    noRealUserData: true,
    noHandlerExecution: true,
    noNetwork: true,
    status: input.status,
    summary: input.summary,
    response: freezeResponse(input.response),
    version: 1,
  };
  assertLocalMcpFakeChatGptFlowDemoStep(step);
  return Object.freeze(step);
}

function freezeResponse(
  response: LocalMcpDevEndpointResponseV1 | LocalMcpToolsCallFixtureResponseV1,
): LocalMcpDevEndpointResponseV1 | LocalMcpToolsCallFixtureResponseV1 {
  return Object.freeze(response);
}

function assertLocalMcpFakeChatGptFlowDemoStep(step: unknown): void {
  const record = asPlainRecord(step, "Local MCP fake ChatGPT flow demo step must be an object");
  assertExactKeys(
    record,
    [
      "kind",
      "actor",
      "action",
      "fixtureOnly",
      "localDevOnly",
      "noRealUserData",
      "noHandlerExecution",
      "noNetwork",
      "status",
      "summary",
      "response",
      "version",
    ],
    "Local MCP fake ChatGPT flow demo step",
  );
  if (record.kind !== "local_mcp_fake_chatgpt_flow_demo_step") {
    throw new TypeError("Local MCP fake ChatGPT flow demo step kind is invalid");
  }
  for (const flag of ["fixtureOnly", "localDevOnly", "noRealUserData", "noHandlerExecution", "noNetwork"] as const) {
    if (record[flag] !== true) {
      throw new TypeError(`Local MCP fake ChatGPT flow demo step requires ${flag}`);
    }
  }
  if (typeof record.summary !== "string" || record.summary.trim().length === 0) {
    throw new TypeError("Local MCP fake ChatGPT flow demo step summary is required");
  }
  if (record.version !== 1) {
    throw new TypeError("Local MCP fake ChatGPT flow demo step version must be 1");
  }
}

function assertExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[], label: string): void {
  const actualKeys = Object.keys(value);
  if (actualKeys.length !== expectedKeys.length || !expectedKeys.every((key) => actualKeys.includes(key))) {
    throw new TypeError(`${label} must not contain extra or missing fields`);
  }
}

function asPlainRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return value as Record<string, unknown>;
}
