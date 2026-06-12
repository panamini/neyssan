import { describe, expect, it } from "vitest";
import registrySource from "../mcpDescriptorRegistry.ts?raw";
import {
  assertLocalMcpDescriptorRegistryFixtureOnly,
  buildLocalMcpDescriptorRegistryFixtureOnly,
} from "../mcpDescriptorRegistry";
import { projectLocalMcpRegistryToMcpToolsList } from "../mcpSchemaProjection";
import type { LocalMcpDescriptorRegistryFixtureOnlyV1 } from "../mcpDescriptorRegistry";

const EXPECTED_DESCRIPTOR_NAMES = [
  "twoweeks.application_package.summarize",
  "twoweeks.evidence_graph.summarize",
  "twoweeks.resume_variant_plan.summarize",
  "twoweeks.review_cockpit.summarize",
] as const;

const EXPECTED_LOCAL_TOOL_IDS = [
  "local_mcp.application_package.summarize",
  "local_mcp.evidence_graph.summarize",
  "local_mcp.resume_variant_plan.summarize",
  "local_mcp.review_cockpit.summarize",
] as const;

function withRegistryPatch(
  patch: Partial<Record<keyof LocalMcpDescriptorRegistryFixtureOnlyV1, unknown>>,
): LocalMcpDescriptorRegistryFixtureOnlyV1 {
  return {
    ...buildLocalMcpDescriptorRegistryFixtureOnly(),
    ...patch,
  } as LocalMcpDescriptorRegistryFixtureOnlyV1;
}

describe("local MCP descriptor registry fixture", () => {
  it("builds a deterministic fixture-only registry from the PR38 descriptor projection", () => {
    const first = buildLocalMcpDescriptorRegistryFixtureOnly();
    const second = buildLocalMcpDescriptorRegistryFixtureOnly();
    const projected = projectLocalMcpRegistryToMcpToolsList();

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.kind).toBe("local_mcp_descriptor_registry_fixture_only");
    expect(first.fixtureOnly).toBe(true);
    expect(first.callable).toBe(false);
    expect(first.runnable).toBe(false);
    expect(first.networkReachable).toBe(false);
    expect(first.version).toBe(1);
    expect(first.descriptors).toEqual(projected.tools);
    expect(first.descriptors).not.toBe(projected.tools);
  });

  it("contains exactly the four PR38 descriptor mappings in stable order", () => {
    const registry = buildLocalMcpDescriptorRegistryFixtureOnly();

    expect(registry.descriptorNames).toEqual(EXPECTED_DESCRIPTOR_NAMES);
    expect(registry.localToolIds).toEqual(EXPECTED_LOCAL_TOOL_IDS);
    expect(registry.descriptors.map((descriptor) => descriptor.name)).toEqual(EXPECTED_DESCRIPTOR_NAMES);
    expect(registry.descriptors.map((descriptor) => descriptor.localToolId)).toEqual(EXPECTED_LOCAL_TOOL_IDS);
  });

  it("keeps descriptors inert with no handler, callable, runnable, or _meta attachment", () => {
    for (const descriptor of buildLocalMcpDescriptorRegistryFixtureOnly().descriptors) {
      expect(descriptor).not.toHaveProperty("handler");
      expect(descriptor).not.toHaveProperty("execute");
      expect(descriptor).not.toHaveProperty("call");
      expect(descriptor).not.toHaveProperty("callable");
      expect(descriptor).not.toHaveProperty("runnable");
      expect(descriptor).not.toHaveProperty("_meta");
      expect(Object.values(descriptor).some((value) => typeof value === "function")).toBe(false);
    }
  });

  it("returns clones so callers cannot mutate the static fixture registry", () => {
    const first = buildLocalMcpDescriptorRegistryFixtureOnly();
    (first.descriptors[0] as { name: string }).name = "twoweeks.mutated.summarize";
    (first.descriptorNames as string[])[0] = "twoweeks.mutated.summarize";

    const second = buildLocalMcpDescriptorRegistryFixtureOnly();

    expect(second.descriptorNames).toEqual(EXPECTED_DESCRIPTOR_NAMES);
    expect(second.descriptors[0].name).toBe("twoweeks.application_package.summarize");
  });

  it("rejects attempts to make the fixture registry runnable or reachable", () => {
    const cases: readonly LocalMcpDescriptorRegistryFixtureOnlyV1[] = [
      withRegistryPatch({ fixtureOnly: false }),
      withRegistryPatch({ callable: true }),
      withRegistryPatch({ runnable: true }),
      withRegistryPatch({ networkReachable: true }),
      withRegistryPatch({ descriptorNames: [...EXPECTED_DESCRIPTOR_NAMES, "twoweeks.extra.summarize"] }),
      withRegistryPatch({ localToolIds: [...EXPECTED_LOCAL_TOOL_IDS].reverse() }),
      withRegistryPatch({
        descriptors: [
          {
            ...buildLocalMcpDescriptorRegistryFixtureOnly().descriptors[0],
            handler: () => undefined,
          },
        ],
      }),
    ] as unknown as readonly LocalMcpDescriptorRegistryFixtureOnlyV1[];

    for (const candidate of cases) {
      expect(() => assertLocalMcpDescriptorRegistryFixtureOnly(candidate)).toThrow(TypeError);
    }
  });

  it("keeps the implementation disconnected from SDK imports, endpoints, protocol methods, and servers", () => {
    const forbiddenSourcePatterns = [
      /@modelcontextprotocol/u,
      /@openai/u,
      /from\s+["'][^"']*(openai|oauth|next\/server|convex|react)[^"']*["']/iu,
      /registerTool/u,
      /registerResource/u,
      /StreamableHTTP/u,
      /createServer/u,
      /\.listen\(/u,
      /server\.connect/u,
      /tools\/list/u,
      /tools\/call/u,
      /["'`]\/mcp/u,
      /fetch\(/u,
      /WebSocket/u,
      /EventSource/u,
    ] as const;

    for (const pattern of forbiddenSourcePatterns) {
      expect(registrySource).not.toMatch(pattern);
    }
  });
});
