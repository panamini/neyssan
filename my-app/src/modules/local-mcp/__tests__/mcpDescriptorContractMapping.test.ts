import { describe, expect, it } from "vitest";
import projectionSource from "../mcpSchemaProjection.ts?raw";
import { projectLocalMcpRegistryToMcpToolsList } from "../mcpSchemaProjection";
import type { LocalMcpProjectedToolDescriptorV1 } from "../mcpSchemaProjection";
import type { LocalMcpToolIdV1 } from "../schema";

type ExpectedPr38Mapping = Readonly<{
  localToolId: LocalMcpToolIdV1;
  descriptorName: string;
  refField: string;
  outputKind: string;
}>;

const EXPECTED_PR38_MAPPINGS: readonly ExpectedPr38Mapping[] = [
  {
    localToolId: "local_mcp.application_package.summarize",
    descriptorName: "twoweeks.application_package.summarize",
    refField: "applicationPackageRef",
    outputKind: "application_package_summary",
  },
  {
    localToolId: "local_mcp.evidence_graph.summarize",
    descriptorName: "twoweeks.evidence_graph.summarize",
    refField: "evidenceGraphRef",
    outputKind: "evidence_graph_summary",
  },
  {
    localToolId: "local_mcp.resume_variant_plan.summarize",
    descriptorName: "twoweeks.resume_variant_plan.summarize",
    refField: "resumeVariantPlanRef",
    outputKind: "resume_variant_plan_summary",
  },
  {
    localToolId: "local_mcp.review_cockpit.summarize",
    descriptorName: "twoweeks.review_cockpit.summarize",
    refField: "reviewCockpitRef",
    outputKind: "review_cockpit_summary",
  },
] as const;

const FORBIDDEN_DESCRIPTOR_NAME_TERMS = [
  "export",
  "download",
  "send",
  "submit",
  "apply",
  "update",
  "publish",
  "connect",
  "oauth",
  "network",
  "chatgpt",
  "openai",
  "browser",
  "scrape",
] as const;

const FORBIDDEN_SCHEMA_FIELDS = [
  "rawText",
  "rawCvText",
  "rawResumeText",
  "rawCoverLetterText",
  "rawJobText",
  "rawSourceDocuments",
  "sourceQuotes",
  "privateFacts",
  "neverUseFacts",
  "tokens",
  "secrets",
  "sessionId",
  "userId",
  "generatedResume",
  "generatedCoverLetter",
  "fullArtifact",
] as const;

const REQUIRED_DESCRIPTION_PHRASES = [
  "Use this when",
  "safe dry-run metadata",
  "local dry-run fields",
  "existing reference",
] as const;

describe("PR38 descriptor contract mapping", () => {
  it("maps exactly one local fixture tool to exactly one future descriptor name", () => {
    const descriptors = projectLocalMcpRegistryToMcpToolsList().tools;

    expect(descriptors).toHaveLength(EXPECTED_PR38_MAPPINGS.length);
    expect(descriptors.map((descriptor) => descriptor.localToolId).sort()).toEqual(
      EXPECTED_PR38_MAPPINGS.map((mapping) => mapping.localToolId).sort(),
    );

    for (const mapping of EXPECTED_PR38_MAPPINGS) {
      const descriptor = getDescriptor(mapping.localToolId);
      expect(descriptor.name).toBe(mapping.descriptorName);
      expect(descriptor.name.startsWith("twoweeks.")).toBe(true);
      expect(descriptor.name.endsWith(".summarize")).toBe(true);
    }
  });

  it("keeps descriptor names free of mutation, network, auth, and write-action verbs", () => {
    for (const descriptor of projectLocalMcpRegistryToMcpToolsList().tools) {
      const normalizedName = descriptor.name.toLowerCase();

      for (const term of FORBIDDEN_DESCRIPTOR_NAME_TERMS) {
        expect(normalizedName).not.toContain(term);
      }
    }
  });

  it("uses narrow MCP-style descriptions without executable or outbound claims", () => {
    for (const descriptor of projectLocalMcpRegistryToMcpToolsList().tools) {
      for (const phrase of REQUIRED_DESCRIPTION_PHRASES) {
        expect(descriptor.description).toContain(phrase);
      }

      const normalizedDescription = descriptor.description.toLowerCase();
      for (const term of FORBIDDEN_DESCRIPTOR_NAME_TERMS) {
        expect(normalizedDescription).not.toContain(term);
      }
      expect(normalizedDescription).not.toContain("handler");
      expect(normalizedDescription).not.toContain("runtime");
      expect(normalizedDescription).not.toContain("production");
    }
  });

  it("uses closed one-ref input schemas from the PR38 mapping table", () => {
    for (const mapping of EXPECTED_PR38_MAPPINGS) {
      const descriptor = getDescriptor(mapping.localToolId);
      const inputSchema = descriptor.inputSchema;
      const refSchema = inputSchema.properties?.[mapping.refField];

      expect(inputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: [mapping.refField],
      });
      expect(Object.keys(inputSchema.properties ?? {})).toEqual([mapping.refField]);
      expect(refSchema).toEqual({
        type: "object",
        description: expect.any(String),
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

  it("keeps input and output schemas free of raw data, secrets, user ids, and generated artifacts", () => {
    for (const descriptor of projectLocalMcpRegistryToMcpToolsList().tools) {
      const schemaText = JSON.stringify({
        inputSchema: descriptor.inputSchema,
        outputSchema: descriptor.outputSchema,
      });

      for (const forbiddenField of FORBIDDEN_SCHEMA_FIELDS) {
        expect(schemaText).not.toContain(forbiddenField);
      }
    }
  });

  it("keeps output policy in the current safe dry-run shape only", () => {
    for (const mapping of EXPECTED_PR38_MAPPINGS) {
      const descriptor = getDescriptor(mapping.localToolId);
      const outputSchema = descriptor.outputSchema;

      expect(outputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
        required: ["kind", "internalToolId", "input", "outputKind", "version"],
      });
      expect(Object.keys(outputSchema.properties ?? {})).toEqual([
        "kind",
        "internalToolId",
        "input",
        "outputKind",
        "version",
      ]);
      expect(outputSchema.properties?.kind).toEqual({
        type: "string",
        const: "local_mcp_dry_run",
      });
      expect(outputSchema.properties?.internalToolId).toEqual({
        type: "string",
        const: descriptor.internalToolId,
      });
      expect(outputSchema.properties?.outputKind).toEqual({
        type: "string",
        const: mapping.outputKind,
      });
      expect(outputSchema.properties).not.toHaveProperty("structuredContent");
      expect(outputSchema.properties).not.toHaveProperty("content");
      expect(outputSchema.properties).not.toHaveProperty("_meta");
    }
  });

  it("uses PR38 read-only, non-destructive, closed-world annotations for every descriptor", () => {
    for (const descriptor of projectLocalMcpRegistryToMcpToolsList().tools) {
      expect(descriptor.annotations).toEqual({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      });
    }
  });

  it("does not attach _meta, runtime handlers, or callable/listable protocol methods to descriptors", () => {
    for (const descriptor of projectLocalMcpRegistryToMcpToolsList().tools) {
      expect(hasFunctionValue(descriptor)).toBe(false);
      expect(descriptor).not.toHaveProperty("handler");
      expect(descriptor).not.toHaveProperty("execute");
      expect(descriptor).not.toHaveProperty("call");
      expect(descriptor).not.toHaveProperty("callable");
      expect(descriptor).not.toHaveProperty("runnable");
      expect(descriptor).not.toHaveProperty("_meta");
    }
  });

  it("keeps the projection source disconnected from MCP SDK, server skeleton, transport, and call runtime", () => {
    const forbiddenSourcePatterns = [
      /@modelcontextprotocol/u,
      /localMcpServerSkeleton/u,
      /executeLocalMcpRequest/u,
      /parseLocalMcpCallEnvelope/u,
      /validateLocalMcpRemoteTransportPreflight/u,
      /registerTool/u,
      /registerResource/u,
      /StreamableHTTP/u,
      /createServer/u,
      /\.listen\(/u,
      /tools\/list/u,
      /tools\/call/u,
      /\/mcp/u,
    ] as const;

    for (const pattern of forbiddenSourcePatterns) {
      expect(projectionSource).not.toMatch(pattern);
    }
  });
});

function getDescriptor(localToolId: LocalMcpToolIdV1): LocalMcpProjectedToolDescriptorV1 {
  const descriptor = projectLocalMcpRegistryToMcpToolsList().tools.find(
    (candidate) => candidate.localToolId === localToolId,
  );
  if (!descriptor) throw new TypeError(`Missing descriptor for ${localToolId}`);
  return descriptor;
}

function hasFunctionValue(value: unknown): boolean {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasFunctionValue);
  return Object.values(value as Record<string, unknown>).some(hasFunctionValue);
}
