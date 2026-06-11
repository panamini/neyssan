import { describe, expect, it } from "vitest";
import { stableSerialize } from "../../application-harness/fingerprints";
import projectionSource from "../mcpSchemaProjection.ts?raw";
import {
  assertLocalMcpProjectedToolDescriptor,
  buildLocalMcpInputJsonSchema,
  buildLocalMcpOutputJsonSchema,
  projectLocalMcpRegistryToMcpToolsList,
  projectLocalMcpToolToMcpDescriptor,
} from "../mcpSchemaProjection";
import type { LocalMcpJsonSchemaV1 } from "../mcpSchemaProjection";
import type { LocalMcpToolRegistryV1 } from "../schema";
import { buildLocalMcpToolRegistry } from "../toolRegistry";

// Ces tests protègent le contrat de projection local.
// Si `schema.ts` ou `toolRegistry.ts` changent, mettez à jour ce fichier avant de toucher au runtime.
const EXPECTED_PROJECTED_TOOL_NAMES = [
  "twoweeks.application_package.summarize",
  "twoweeks.evidence_graph.summarize",
  "twoweeks.resume_variant_plan.summarize",
  "twoweeks.review_cockpit.summarize",
] as const;

const EXPECTED_REF_FIELDS = [
  "applicationPackageRef",
  "evidenceGraphRef",
  "resumeVariantPlanRef",
  "reviewCockpitRef",
] as const;

describe("local MCP schema projection", () => {
  it("projects exactly four descriptors in deterministic name order", () => {
    const projected = projectLocalMcpRegistryToMcpToolsList();

    expect(projected.version).toBe(1);
    expect(projected.nextCursor).toBeUndefined();
    expect(projected.tools).toHaveLength(4);
    expect(projected.tools.map((tool) => tool.name)).toEqual(EXPECTED_PROJECTED_TOOL_NAMES);
    expect(projected.tools.map((tool) => tool.name)).toEqual(
      [...projected.tools.map((tool) => tool.name)].sort(),
    );
  });

  it("keeps the local and internal tool ids from the Local MCP registry", () => {
    const registry = buildLocalMcpToolRegistry();
    const projected = projectLocalMcpRegistryToMcpToolsList(registry);

    expect(projected.tools.map((tool) => tool.localToolId)).toEqual(registry.toolIds);
    expect(projected.tools.map((tool) => tool.internalToolId)).toEqual(
      registry.tools.map((tool) => tool.internalToolId),
    );
  });

  it("builds closed input schemas from Local MCP input kinds", () => {
    const registry = buildLocalMcpToolRegistry();

    for (const tool of registry.tools) {
      const schema = buildLocalMcpInputJsonSchema(tool);
      const fieldName = inputFieldForTool(tool.id);

      expect(schema.type).toBe("object");
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required).toEqual([fieldName]);
      expect(Object.keys(schema.properties ?? {})).toEqual([fieldName]);
      expect(schema.properties?.[fieldName]).toEqual({
        type: "object",
        description: `Reference object for ${tool.inputKinds[0]}.`,
        additionalProperties: false,
        properties: {
          id: {
            type: "string",
            minLength: 1,
          },
        },
        required: ["id"],
      });
    }
  });

  it("builds output schemas for the current dry-run result shape", () => {
    const registry = buildLocalMcpToolRegistry();

    for (const tool of registry.tools) {
      const schema = buildLocalMcpOutputJsonSchema(tool);

      expect(schema.type).toBe("object");
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required).toEqual(["kind", "internalToolId", "input", "outputKind", "version"]);
      expect(Object.keys(schema.properties ?? {})).toEqual([
        "kind",
        "internalToolId",
        "input",
        "outputKind",
        "version",
      ]);
      expect(schema.properties?.kind).toEqual({ type: "string", const: "local_mcp_dry_run" });
      expect(schema.properties?.internalToolId).toEqual({
        type: "string",
        const: tool.internalToolId,
      });
      expect(schema.properties?.input).toEqual(buildLocalMcpInputJsonSchema(tool));
      expect(schema.properties?.outputKind).toEqual({ type: "string", const: tool.outputKind });
      expect(schema.properties?.version).toEqual({ type: "number", const: 1 });
      expect(schema.properties).not.toHaveProperty("summary");
      expect(schema.properties).not.toHaveProperty("rawText");
      expect(schema.properties).not.toHaveProperty("generatedText");
      expect(schema.properties).not.toHaveProperty("privateFacts");
      expect(schema.properties).not.toHaveProperty("neverUseFacts");
    }
  });

  it("projects read-only non-destructive closed-world annotations", () => {
    const projected = projectLocalMcpRegistryToMcpToolsList();

    for (const descriptor of projected.tools) {
      expect(descriptor.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      });
    }
  });

  it("accepts every valid projected descriptor", () => {
    const projected = projectLocalMcpRegistryToMcpToolsList();

    for (const descriptor of projected.tools) {
      expect(() => assertLocalMcpProjectedToolDescriptor(descriptor)).not.toThrow();
    }
  });

  it("contains no forbidden action or external host terms in descriptor metadata", () => {
    const forbiddenTerms = [
      "send",
      "submit",
      "apply",
      "export",
      "download",
      "network",
      "oauth",
      "update",
      "publish",
      "browser",
      "scrape",
      "openai",
      "chatgpt",
    ] as const;
    const projected = projectLocalMcpRegistryToMcpToolsList();

    for (const descriptor of projected.tools) {
      const metadata = [descriptor.name, descriptor.title, descriptor.description]
        .join(" ")
        .toLowerCase();
      for (const term of forbiddenTerms) {
        expect(metadata).not.toContain(term);
      }
    }
  });

  it("does not import product runtimes, UI routes, transport, or external SDKs", () => {
    expect(projectionSource).not.toMatch(
      /from\s+["'][^"']*(convex|components|pages|routes|controlled-ats-scout)[^"']*["']/iu,
    );
    expect(projectionSource).not.toMatch(/\b(fetch|axios|undici)\b/u);
    expect(projectionSource).not.toMatch(/from\s+["'][^"']*(mcp|openai|oauth)[^"']*["']/iu);
  });

  it("does not mutate the input registry and returns stable clones", () => {
    const registry = buildLocalMcpToolRegistry();
    const before = stableSerialize(registry);
    const first = projectLocalMcpRegistryToMcpToolsList(registry);
    const second = projectLocalMcpRegistryToMcpToolsList(registry);

    expect(stableSerialize(registry)).toBe(before);
    expect(first).toEqual(second);
    expect(first.tools).not.toBe(second.tools);
    expect(first.tools[0]).not.toBe(second.tools[0]);
    expect(first.tools[0].inputSchema).not.toBe(second.tools[0].inputSchema);
    expect(first.tools[0].outputSchema).not.toBe(second.tools[0].outputSchema);
    expect(
      Object.keys(
        first.tools[0].inputSchema.properties?.applicationPackageRef.properties?.id ?? {},
      ),
    ).toEqual(["type", "minLength"]);
  });

  it("validator rejects malformed projected descriptors", () => {
    const descriptor = projectLocalMcpToolToMcpDescriptor(buildLocalMcpToolRegistry().tools[0]);

    expect(() =>
      assertLocalMcpProjectedToolDescriptor({ ...descriptor, name: "Invalid Name" }),
    ).toThrow(TypeError);
    expect(() =>
      assertLocalMcpProjectedToolDescriptor({
        ...descriptor,
        inputSchema: undefined as unknown as LocalMcpJsonSchemaV1,
      }),
    ).toThrow(TypeError);
    expect(() =>
      assertLocalMcpProjectedToolDescriptor({
        ...descriptor,
        inputSchema: { ...descriptor.inputSchema, additionalProperties: true } as unknown as LocalMcpJsonSchemaV1,
      }),
    ).toThrow(TypeError);
    expect(() =>
      assertLocalMcpProjectedToolDescriptor({
        ...descriptor,
        annotations: { ...descriptor.annotations, destructiveHint: true },
      }),
    ).toThrow(TypeError);
    expect(() =>
      assertLocalMcpProjectedToolDescriptor({
        ...descriptor,
        description: "Use this when you need to update local dry-run metadata.",
      }),
    ).toThrow(TypeError);
    expect(() =>
      assertLocalMcpProjectedToolDescriptor({
        ...descriptor,
        description: "Use this when you need to publish local dry-run metadata.",
      }),
    ).toThrow(TypeError);
    expect(() =>
      assertLocalMcpProjectedToolDescriptor({
        ...descriptor,
        inputSchema: {
          ...descriptor.inputSchema,
          properties: {
            applicationPackageRef: {
              ...descriptor.inputSchema.properties?.applicationPackageRef,
              additionalProperties: true,
            },
          },
        } as unknown as LocalMcpJsonSchemaV1,
      }),
    ).toThrow(TypeError);
    expect(() =>
      assertLocalMcpProjectedToolDescriptor({
        ...descriptor,
        inputSchema: {
          ...descriptor.inputSchema,
          properties: {
            applicationPackageRef: {
              ...descriptor.inputSchema.properties?.applicationPackageRef,
              required: undefined,
            },
          },
        } as unknown as LocalMcpJsonSchemaV1,
      }),
    ).toThrow(TypeError);
  });

  it("rejects unsupported input kinds instead of opening free-form arguments", () => {
    const registry = buildLocalMcpToolRegistry();
    const malformedRegistry: LocalMcpToolRegistryV1 = {
      ...registry,
      tools: [
        {
          ...registry.tools[0],
          inputKinds: ["application_context_ref"],
        },
      ],
      toolIds: [registry.toolIds[0]],
    };

    expect(() => projectLocalMcpRegistryToMcpToolsList(malformedRegistry)).toThrow(TypeError);
  });
});

function inputFieldForTool(toolId: string): string {
  switch (toolId) {
    case "local_mcp.application_package.summarize":
      return "applicationPackageRef";
    case "local_mcp.evidence_graph.summarize":
      return "evidenceGraphRef";
    case "local_mcp.resume_variant_plan.summarize":
      return "resumeVariantPlanRef";
    case "local_mcp.review_cockpit.summarize":
      return "reviewCockpitRef";
    default:
      throw new TypeError("Unexpected test tool id");
  }
}
