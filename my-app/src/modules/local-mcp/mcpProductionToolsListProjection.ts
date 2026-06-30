import { buildLocalMcpDescriptorRegistryFixtureOnly } from "./mcpDescriptorRegistry";
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

export function buildMcpProductionToolsListResult(): McpProductionToolsListResultV1 {
  const registry = buildLocalMcpDescriptorRegistryFixtureOnly();
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
    description: descriptor.description,
    inputSchema: cloneJsonSchema(descriptor.inputSchema),
    annotations: Object.freeze({ ...descriptor.annotations }),
  });
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
