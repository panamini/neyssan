import { buildLocalMcpDescriptorRegistryFixtureOnly } from "./mcpDescriptorRegistry";
import type { LocalMcpProjectedToolDescriptorV1 } from "./mcpSchemaProjection";

type LocalMcpToolsListFixtureRequestV1 = Readonly<{
  kind: "local_mcp_tools_list_fixture_request";
  method: "tools/list";
  version: 1;
}>;

export type LocalMcpToolsListFixtureSuccessV1 = Readonly<{
  kind: "local_mcp_tools_list_fixture_response";
  method: "tools/list";
  success: true;
  fixtureOnly: true;
  callable: false;
  runnable: false;
  networkReachable: false;
  tools: readonly LocalMcpProjectedToolDescriptorV1[];
  toolCount: number;
  version: 1;
}>;

export type LocalMcpToolsListFixtureErrorV1 = Readonly<{
  code: "malformed_input";
  message: "The tools/list fixture request is malformed.";
  safeForModel: true;
  version: 1;
}>;

export type LocalMcpToolsListFixtureFailureV1 = Readonly<{
  kind: "local_mcp_tools_list_fixture_response";
  method: "tools/list";
  success: false;
  fixtureOnly: true;
  error: LocalMcpToolsListFixtureErrorV1;
  version: 1;
}>;

export type LocalMcpToolsListFixtureResponseV1 =
  | LocalMcpToolsListFixtureSuccessV1
  | LocalMcpToolsListFixtureFailureV1;

const REQUEST_KEYS = ["kind", "method", "version"] as const;

export function simulateLocalMcpToolsListFixture(
  request: unknown = {
    kind: "local_mcp_tools_list_fixture_request",
    method: "tools/list",
    version: 1,
  },
): LocalMcpToolsListFixtureResponseV1 {
  if (!isToolsListFixtureRequest(request)) {
    return buildMalformedInputFailure();
  }

  const registry = buildLocalMcpDescriptorRegistryFixtureOnly();
  return {
    kind: "local_mcp_tools_list_fixture_response",
    method: "tools/list",
    success: true,
    fixtureOnly: true,
    callable: false,
    runnable: false,
    networkReachable: false,
    tools: registry.descriptors,
    toolCount: registry.descriptors.length,
    version: 1,
  };
}

function buildMalformedInputFailure(): LocalMcpToolsListFixtureFailureV1 {
  return {
    kind: "local_mcp_tools_list_fixture_response",
    method: "tools/list",
    success: false,
    fixtureOnly: true,
    error: {
      code: "malformed_input",
      message: "The tools/list fixture request is malformed.",
      safeForModel: true,
      version: 1,
    },
    version: 1,
  };
}

function isToolsListFixtureRequest(value: unknown): value is LocalMcpToolsListFixtureRequestV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== REQUEST_KEYS.length || !REQUEST_KEYS.every((key) => keys.includes(key))) return false;

  return (
    record.kind === "local_mcp_tools_list_fixture_request" &&
    record.method === "tools/list" &&
    record.version === 1
  );
}
