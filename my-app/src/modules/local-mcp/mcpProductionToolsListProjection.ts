import { buildLocalMcpDescriptorRegistryMetadataOnly } from "./mcpDescriptorRegistry";
import type { LocalMcpProjectedToolDescriptorV1 } from "./mcpSchemaProjection";

export type McpProductionToolDescriptorV1 = Readonly<{
  name: string;
  title: string;
  description: string;
  inputSchema: LocalMcpProjectedToolDescriptorV1["inputSchema"];
  annotations: LocalMcpProjectedToolDescriptorV1["annotations"];
}>;

export type McpProductionToolsListResultV1 = Readonly<{
  tools: readonly McpProductionToolDescriptorV1[];
}>;

const PRODUCTION_TOOL_DESCRIPTIONS: Readonly<Record<string, string>> = Object.freeze({
  "twoweeks.application_package.summarize": "Use this to inspect read-only application package metadata for an existing reference.",
  "twoweeks.evidence_graph.summarize": "Use this to inspect read-only evidence graph metadata for an existing reference.",
  "twoweeks.resume_variant_plan.summarize": "Use this to inspect read-only resume variant plan metadata for an existing reference.",
  "twoweeks.review_cockpit.summarize": "Use this to inspect read-only review cockpit metadata for an existing reference.",
});

const MCP_PRODUCTION_TOOLS_LIST_RESULT = buildMcpProductionToolsListResultFromRegistry();

export function buildMcpProductionToolsListResult(): McpProductionToolsListResultV1 {
  return MCP_PRODUCTION_TOOLS_LIST_RESULT;
}

function buildMcpProductionToolsListResultFromRegistry(): McpProductionToolsListResultV1 {
  const registry = buildLocalMcpDescriptorRegistryMetadataOnly();
  return Object.freeze({
    tools: Object.freeze(registry.descriptors.map(projectProductionToolDescriptor)),
  });
}

function projectProductionToolDescriptor(
  descriptor: LocalMcpProjectedToolDescriptorV1,
): McpProductionToolDescriptorV1 {
  return Object.freeze({
    name: descriptor.name,
    title: descriptor.title,
    description: productionToolDescription(descriptor),
    inputSchema: cloneJsonSchema(descriptor.inputSchema),
    annotations: Object.freeze({ ...descriptor.annotations }),
  });
}

function productionToolDescription(descriptor: LocalMcpProjectedToolDescriptorV1): string {
  const description = PRODUCTION_TOOL_DESCRIPTIONS[descriptor.name];
  if (!description) {
    throw new TypeError("Production tools/list descriptor is missing a public description");
  }
  return description;
}

function cloneJsonSchema(
  schema: LocalMcpProjectedToolDescriptorV1["inputSchema"],
): LocalMcpProjectedToolDescriptorV1["inputSchema"] {
  return Object.freeze({
    ...schema,
    ...(schema.additionalProperties !== undefined
      ? {
          additionalProperties:
            typeof schema.additionalProperties === "object"
              ? cloneJsonSchema(schema.additionalProperties)
              : schema.additionalProperties,
        }
      : {}),
    ...(schema.enum ? { enum: Object.freeze([...schema.enum]) } : {}),
    ...(schema.required ? { required: Object.freeze([...schema.required]) } : {}),
    ...(schema.properties
      ? {
          properties: Object.freeze(
            Object.fromEntries(
              Object.entries(schema.properties).map(([key, value]) => [key, cloneJsonSchema(value)]),
            ),
          ),
        }
      : {}),
  });
}
