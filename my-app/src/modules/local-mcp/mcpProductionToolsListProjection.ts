import { buildLocalMcpDescriptorRegistryMetadataOnly } from "./mcpDescriptorRegistry";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "./mcpAuthPolicyBoundary";
import type { LocalMcpProjectedToolDescriptorV1 } from "./mcpSchemaProjection";

type McpProductionToolSecuritySchemeV1 = Readonly<{
  type: "oauth2";
  scopes: readonly [typeof TWOWEEKS_APPLICATIONS_READ_SCOPE];
}>;

export type McpProductionToolDescriptorV1 = Readonly<{
  name: string;
  title: string;
  description: string;
  inputSchema: LocalMcpProjectedToolDescriptorV1["inputSchema"];
  annotations: LocalMcpProjectedToolDescriptorV1["annotations"];
  securitySchemes: readonly McpProductionToolSecuritySchemeV1[];
  _meta: Readonly<{
    securitySchemes: readonly McpProductionToolSecuritySchemeV1[];
  }>;
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

const PRODUCTION_SAFE_REF_IDS: Readonly<Record<string, Readonly<{
  argumentKey: string;
  safeRefId: string;
}>>> = Object.freeze({
  "twoweeks.application_package.summarize": Object.freeze({
    argumentKey: "applicationPackageRef",
    safeRefId: "mcp-safe-ref:application-package:latest",
  }),
  "twoweeks.evidence_graph.summarize": Object.freeze({
    argumentKey: "evidenceGraphRef",
    safeRefId: "mcp-safe-ref:evidence-graph:profile",
  }),
  "twoweeks.resume_variant_plan.summarize": Object.freeze({
    argumentKey: "resumeVariantPlanRef",
    safeRefId: "mcp-safe-ref:resume-variant-plan:latest",
  }),
  "twoweeks.review_cockpit.summarize": Object.freeze({
    argumentKey: "reviewCockpitRef",
    safeRefId: "mcp-safe-ref:review-cockpit:latest",
  }),
});

const OAUTH_READ_SECURITY_SCHEMES: readonly McpProductionToolSecuritySchemeV1[] = Object.freeze([
  Object.freeze({
    type: "oauth2",
    scopes: Object.freeze([TWOWEEKS_APPLICATIONS_READ_SCOPE]) as readonly [typeof TWOWEEKS_APPLICATIONS_READ_SCOPE],
  }),
]);
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
    inputSchema: productionInputSchema(descriptor),
    annotations: Object.freeze({ ...descriptor.annotations }),
    securitySchemes: OAUTH_READ_SECURITY_SCHEMES,
    _meta: Object.freeze({
      securitySchemes: OAUTH_READ_SECURITY_SCHEMES,
    }),
  });
}

function productionToolDescription(descriptor: LocalMcpProjectedToolDescriptorV1): string {
  const description = PRODUCTION_TOOL_DESCRIPTIONS[descriptor.name];
  if (!description) {
    throw new TypeError("Production tools/list descriptor is missing a public description");
  }
  return description;
}

function productionInputSchema(
  descriptor: LocalMcpProjectedToolDescriptorV1,
): LocalMcpProjectedToolDescriptorV1["inputSchema"] {
  const schema = cloneJsonSchema(descriptor.inputSchema);
  const safeRef = PRODUCTION_SAFE_REF_IDS[descriptor.name];
  if (!safeRef) {
    throw new TypeError("Production tools/list descriptor is missing a public safe ref contract");
  }
  const argumentSchema = schema.properties?.[safeRef.argumentKey];
  const idSchema = argumentSchema?.properties?.id;
  if (!argumentSchema || !idSchema) {
    throw new TypeError("Production tools/list descriptor is missing the safe ref input schema");
  }

  return Object.freeze({
    ...schema,
    properties: Object.freeze({
      ...schema.properties,
      [safeRef.argumentKey]: Object.freeze({
        ...argumentSchema,
        properties: Object.freeze({
          ...argumentSchema.properties,
          id: Object.freeze({
            ...idSchema,
            description: `Canonical production safe ref id: ${safeRef.safeRefId}.`,
            const: safeRef.safeRefId,
            enum: Object.freeze([safeRef.safeRefId]),
          }),
        }),
      }),
    }),
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
