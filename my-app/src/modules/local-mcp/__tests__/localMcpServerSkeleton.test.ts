import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertLocalMcpServerSkeletonDisabled,
  buildDisabledLocalMcpServerSkeleton,
} from "../localMcpServerSkeleton";
import type { LocalMcpServerSkeletonV1 } from "../localMcpServerSkeleton";

const SOURCE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../localMcpServerSkeleton.ts");

function implementationSource(): string {
  return readFileSync(SOURCE_FILE, "utf8");
}

function withSkeletonPatch(
  patch: Partial<Record<keyof LocalMcpServerSkeletonV1, unknown>>,
): LocalMcpServerSkeletonV1 {
  return {
    ...buildDisabledLocalMcpServerSkeleton(),
    ...patch,
  } as LocalMcpServerSkeletonV1;
}

describe("local MCP server skeleton", () => {
  it("builds a deterministic disabled local-only skeleton", () => {
    const first = buildDisabledLocalMcpServerSkeleton();
    const second = buildDisabledLocalMcpServerSkeleton();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.kind).toBe("local_mcp_server_skeleton");
    expect(first.mode).toBe("disabled");
    expect(first.enabled).toBe(false);
    expect(first.localOnly).toBe(true);
    expect(first.version).toBe(1);
  });

  it("has no endpoint, listener, routes, listed tools, callable tools, or resources", () => {
    const skeleton = buildDisabledLocalMcpServerSkeleton();

    expect(skeleton.endpoint).toBe("none");
    expect(skeleton.listener).toBe("none");
    expect(skeleton.routePaths).toEqual([]);
    expect(skeleton.exposedToolNames).toEqual([]);
    expect(skeleton.callableToolNames).toEqual([]);
    expect(skeleton.resourceUris).toEqual([]);
  });

  it("pins disabled-by-default safety constraints", () => {
    expect(buildDisabledLocalMcpServerSkeleton().constraints).toEqual({
      disabledByDefault: true,
      noEndpoint: true,
      noListener: true,
      noRoute: true,
      noRemoteTransport: true,
      noToolListingRuntime: true,
      noToolCallingRuntime: true,
      noRealHandlers: true,
      noRealUserData: true,
      noOAuth: true,
      noUiResources: true,
      noOutboundHttp: true,
      noLlmCalls: true,
      noExportDownloadSendSubmitApply: true,
      noProductionBehavior: true,
      version: 1,
    });
  });

  it("returns clones so callers cannot mutate the static disabled shape", () => {
    const first = buildDisabledLocalMcpServerSkeleton();
    (first.constraints as { noEndpoint: boolean }).noEndpoint = false;

    const second = buildDisabledLocalMcpServerSkeleton();
    expect(second.constraints.noEndpoint).toBe(true);
  });

  it("rejects attempts to enable the skeleton or add runtime surfaces", () => {
    const cases: readonly LocalMcpServerSkeletonV1[] = [
      withSkeletonPatch({ mode: "enabled" }),
      withSkeletonPatch({ enabled: true }),
      withSkeletonPatch({ localOnly: false }),
      withSkeletonPatch({ endpoint: "local" }),
      withSkeletonPatch({ listener: "local" }),
      withSkeletonPatch({ routePaths: ["local-route"] }),
      withSkeletonPatch({ exposedToolNames: ["twoweeks.application_package.summarize"] }),
      withSkeletonPatch({ callableToolNames: ["twoweeks.application_package.summarize"] }),
      withSkeletonPatch({ resourceUris: ["ui://local/fixture.html"] }),
      {
        ...buildDisabledLocalMcpServerSkeleton(),
        requestHandler: () => undefined,
      } as unknown as LocalMcpServerSkeletonV1,
    ];

    for (const candidate of cases) {
      expect(() => assertLocalMcpServerSkeletonDisabled(candidate)).toThrow(TypeError);
    }
  });

  it("rejects safety constraint drift", () => {
    const base = buildDisabledLocalMcpServerSkeleton();

    expect(() =>
      assertLocalMcpServerSkeletonDisabled({
        ...base,
        constraints: {
          ...base.constraints,
          noRemoteTransport: false,
        },
      } as LocalMcpServerSkeletonV1),
    ).toThrow(TypeError);

    expect(() =>
      assertLocalMcpServerSkeletonDisabled({
        ...base,
        constraints: {
          ...base.constraints,
          noToolCallingRuntime: false,
        },
      } as LocalMcpServerSkeletonV1),
    ).toThrow(TypeError);
  });

  it("keeps the implementation source free of live server wiring", () => {
    const source = implementationSource();
    const forbiddenTerms = [
      "@model" + "contextprotocol",
      "next/server",
      "convex/",
      "react",
      "create" + "Server",
      ".listen(",
      "register" + "Tool",
      "register" + "Resource",
      "tools" + "/" + "list",
      "tools" + "/" + "call",
      "\"/mcp",
      "'/mcp",
      "fetch(",
      "axios",
      "undici",
      "openai",
    ];

    for (const forbiddenTerm of forbiddenTerms) {
      expect(source.toLowerCase()).not.toContain(forbiddenTerm.toLowerCase());
    }
  });
});
