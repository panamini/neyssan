import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildLocalMcpDescriptorRegistryFixtureOnly } from "../mcpDescriptorRegistry";
import { simulateLocalMcpToolsListFixture } from "../localMcpToolsListFixture";

const SOURCE_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../localMcpToolsListFixture.ts");

function implementationSource(): string {
  return readFileSync(SOURCE_FILE, "utf8");
}

describe("local MCP tools/list fixture", () => {
  it("returns fixture-only descriptor data from the static descriptor registry", () => {
    const response = simulateLocalMcpToolsListFixture();
    const registry = buildLocalMcpDescriptorRegistryFixtureOnly();

    expect(response).toMatchObject({
      kind: "local_mcp_tools_list_fixture_response",
      method: "tools/list",
      success: true,
      fixtureOnly: true,
      callable: false,
      runnable: false,
      networkReachable: false,
      toolCount: 4,
      version: 1,
    });
    if (!response.success) throw new TypeError("expected tools/list fixture success");
    expect(response.tools).toEqual(registry.descriptors);
    const originalToolCount = response.tools.length;
    (response.tools as unknown as unknown[]).push({ name: "mutated" });
    const nextResponse = simulateLocalMcpToolsListFixture();
    expect(nextResponse).toMatchObject({ success: true, toolCount: originalToolCount });
    if (!nextResponse.success) throw new TypeError("expected tools/list fixture success");
    expect(nextResponse.tools.map((tool) => tool.name)).toEqual(registry.descriptors.map((tool) => tool.name));
    expect(nextResponse.tools.map((tool) => tool.name)).toEqual([
      "twoweeks.application_package.summarize",
      "twoweeks.evidence_graph.summarize",
      "twoweeks.resume_variant_plan.summarize",
      "twoweeks.review_cockpit.summarize",
    ]);
  });

  it("rejects malformed tools/list fixture requests", () => {
    expect(simulateLocalMcpToolsListFixture(null)).toMatchObject({
      success: false,
      error: { code: "malformed_input" },
    });
    expect(
      simulateLocalMcpToolsListFixture({
        kind: "local_mcp_tools_list_fixture_request",
        method: "tools/list",
        cursor: "cursor_1",
        version: 1,
      }),
    ).toMatchObject({
      success: false,
      error: { code: "malformed_input" },
    });
    expect(
      simulateLocalMcpToolsListFixture({
        kind: "local_mcp_tools_list_fixture_request",
        method: "tools/unknown",
        version: 1,
      }),
    ).toMatchObject({
      success: false,
      error: { code: "malformed_input" },
    });
  });

  it("does not expose handlers, callable flags, runtime fields, or _meta", () => {
    const response = simulateLocalMcpToolsListFixture();
    if (!response.success) throw new TypeError("expected tools/list fixture success");

    for (const tool of response.tools) {
      expect(tool).not.toHaveProperty("handler");
      expect(tool).not.toHaveProperty("execute");
      expect(tool).not.toHaveProperty("call");
      expect(tool).not.toHaveProperty("callable");
      expect(tool).not.toHaveProperty("runnable");
      expect(tool).not.toHaveProperty("_meta");
      expect(Object.values(tool).some((value) => typeof value === "function")).toBe(false);
    }
  });

  it("keeps the implementation disconnected from endpoints, transports, call runtime, and handlers", () => {
    const source = implementationSource();
    const forbiddenPatterns = [
      /@modelcontextprotocol/u,
      /@openai/u,
      /from\s+["'][^"']*(openai|oauth|next\/server|convex|react)[^"']*["']/iu,
      /registerTool/u,
      /registerResource/u,
      /StreamableHTTP/u,
      /createServer/u,
      /\.listen\(/u,
      /server\.connect/u,
      /tools\/call/u,
      /["'`]\/mcp/u,
      /fetch\(/u,
      /WebSocket/u,
      /EventSource/u,
      /registerHandler/u,
      /requestHandler\s*[:=]/u,
    ] as const;

    for (const pattern of forbiddenPatterns) {
      expect(source).not.toMatch(pattern);
    }
  });
});
