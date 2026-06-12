import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertLocalMcpDevTransportAdapterDisabled,
  buildDisabledLocalMcpDevTransportAdapter,
} from "../localMcpDevTransportAdapter";
import type { LocalMcpDevTransportAdapterV1 } from "../localMcpDevTransportAdapter";

const SOURCE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../localMcpDevTransportAdapter.ts");

function implementationSource(): string {
  return readFileSync(SOURCE_FILE, "utf8");
}

function withAdapterPatch(
  patch: Partial<Record<keyof LocalMcpDevTransportAdapterV1, unknown>>,
): LocalMcpDevTransportAdapterV1 {
  return {
    ...buildDisabledLocalMcpDevTransportAdapter(),
    ...patch,
  } as LocalMcpDevTransportAdapterV1;
}

describe("local MCP dev transport adapter", () => {
  it("builds a deterministic disabled local-dev-only adapter", () => {
    const first = buildDisabledLocalMcpDevTransportAdapter();
    const second = buildDisabledLocalMcpDevTransportAdapter();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first).toMatchObject({
      kind: "local_mcp_dev_transport_adapter",
      mode: "disabled",
      environment: "local_dev_only",
      enabled: false,
      transport: "none",
      endpoint: "none",
      listener: "none",
      publicEndpoint: false,
      networkReachable: false,
      toolsListRuntime: false,
      toolsCallRuntime: false,
      realHandlers: false,
      realUserData: false,
      oauth: false,
      productionBehavior: false,
      version: 1,
    });
  });

  it("composes only the disabled server skeleton and disabled remote transport config", () => {
    const adapter = buildDisabledLocalMcpDevTransportAdapter();

    expect(adapter.serverSkeleton).toMatchObject({
      kind: "local_mcp_server_skeleton",
      mode: "disabled",
      enabled: false,
      endpoint: "none",
      listener: "none",
      routePaths: [],
      exposedToolNames: [],
      callableToolNames: [],
      resourceUris: [],
      version: 1,
    });
    expect(adapter.remoteTransportConfig).toMatchObject({
      kind: "local_mcp_remote_transport_config",
      mode: "disabled",
      transportKind: "none",
      allowedOrigins: [],
      allowedHosts: [],
      authMode: "future_required",
      requireOriginValidation: true,
      requireExplicitAuthBeforeRemote: true,
      requireApprovalBoundary: true,
      requireAuditBoundary: true,
      requireHandlerBoundary: true,
      version: 1,
    });
  });

  it("returns frozen clones so callers cannot mutate the disabled adapter shape", () => {
    const adapter = buildDisabledLocalMcpDevTransportAdapter();

    expect(Object.isFrozen(adapter)).toBe(true);
    expect(Object.isFrozen(adapter.serverSkeleton)).toBe(true);
    expect(Object.isFrozen(adapter.remoteTransportConfig)).toBe(true);
    expect(Object.isFrozen(adapter.remoteTransportConfig.allowedOrigins)).toBe(true);
    expect(Object.isFrozen(adapter.remoteTransportConfig.allowedHosts)).toBe(true);
    expect(Object.isFrozen(adapter.remoteTransportConfig.rateLimit)).toBe(true);
    expect(() => {
      (adapter as { enabled: boolean }).enabled = true;
    }).toThrow(TypeError);
    expect(() => {
      (adapter.remoteTransportConfig.allowedOrigins as string[]).push("http://localhost:3000");
    }).toThrow(TypeError);

    expect(buildDisabledLocalMcpDevTransportAdapter().enabled).toBe(false);
  });

  it("rejects attempts to enable local-dev transport or add runtime surfaces", () => {
    const cases: readonly LocalMcpDevTransportAdapterV1[] = [
      withAdapterPatch({ mode: "enabled" }),
      withAdapterPatch({ environment: "production" }),
      withAdapterPatch({ enabled: true }),
      withAdapterPatch({ transport: "http" }),
      withAdapterPatch({ endpoint: "local" }),
      withAdapterPatch({ listener: "local" }),
      withAdapterPatch({ publicEndpoint: true }),
      withAdapterPatch({ networkReachable: true }),
      withAdapterPatch({ toolsListRuntime: true }),
      withAdapterPatch({ toolsCallRuntime: true }),
      withAdapterPatch({ realHandlers: true }),
      withAdapterPatch({ realUserData: true }),
      withAdapterPatch({ oauth: true }),
      withAdapterPatch({ productionBehavior: true }),
      {
        ...buildDisabledLocalMcpDevTransportAdapter(),
        requestHandler: () => undefined,
      } as unknown as LocalMcpDevTransportAdapterV1,
    ];

    for (const candidate of cases) {
      expect(() => assertLocalMcpDevTransportAdapterDisabled(candidate)).toThrow(TypeError);
    }
  });

  it("rejects nested skeleton or remote transport drift", () => {
    const adapter = buildDisabledLocalMcpDevTransportAdapter();

    expect(() =>
      assertLocalMcpDevTransportAdapterDisabled({
        ...adapter,
        serverSkeleton: {
          ...adapter.serverSkeleton,
          endpoint: "local",
        },
      } as LocalMcpDevTransportAdapterV1),
    ).toThrow(TypeError);

    expect(() =>
      assertLocalMcpDevTransportAdapterDisabled({
        ...adapter,
        remoteTransportConfig: {
          ...adapter.remoteTransportConfig,
          mode: "non_production_spike_only",
          transportKind: "streamable_http_design",
        },
      } as LocalMcpDevTransportAdapterV1),
    ).toThrow(TypeError);

    expect(() =>
      assertLocalMcpDevTransportAdapterDisabled({
        ...adapter,
        remoteTransportConfig: {
          ...adapter.remoteTransportConfig,
          requireExplicitAuthBeforeRemote: false,
        },
      } as LocalMcpDevTransportAdapterV1),
    ).toThrow(TypeError);

    expect(() =>
      assertLocalMcpDevTransportAdapterDisabled({
        ...adapter,
        remoteTransportConfig: {
          ...adapter.remoteTransportConfig,
          endpoint: "local",
        },
      } as unknown as LocalMcpDevTransportAdapterV1),
    ).toThrow(TypeError);

    expect(() =>
      assertLocalMcpDevTransportAdapterDisabled({
        ...adapter,
        remoteTransportConfig: {
          ...adapter.remoteTransportConfig,
          rateLimit: {
            ...adapter.remoteTransportConfig.rateLimit,
            handlerBudget: 1,
          },
        },
      } as unknown as LocalMcpDevTransportAdapterV1),
    ).toThrow(TypeError);

    expect(() =>
      assertLocalMcpDevTransportAdapterDisabled({
        ...adapter,
        remoteTransportConfig: {
          ...adapter.remoteTransportConfig,
          rateLimit: {
            ...adapter.remoteTransportConfig.rateLimit,
            globalPerMinute: 1.5,
          },
        },
      } as LocalMcpDevTransportAdapterV1),
    ).toThrow(TypeError);
  });

  it("keeps the implementation source free of SDK imports, endpoints, handlers, and product actions", () => {
    const source = implementationSource();
    const forbiddenFragments = [
      "@modelcontextprotocol",
      "@openai",
      "next/server",
      "convex",
      "node:http",
      "node:https",
      "registerTool(",
      "registerResource(",
      "StreamableHTTP",
      "createServer(",
      ".listen(",
      "server.connect",
      "\"/mcp\"",
      "'/mcp'",
      "fetch(",
      "axios",
      "undici",
      "XMLHttpRequest",
      "WebSocket(",
      "EventSource(",
      "OAuthProvider",
      "ChatGPTConnector",
      "executeLocalMcpRequest(",
      "simulateLocalMcpToolsListFixture(",
      "simulateLocalMcpToolsCallFixture(",
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
