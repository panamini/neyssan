import { buildLocalMcpDescriptorRegistryMetadataOnly } from "./mcpDescriptorRegistry";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "./mcpAuthPolicyBoundary";
import type { LocalMcpProjectedToolDescriptorV1 } from "./mcpSchemaProjection";

type McpProductionToolSecuritySchemeV1 = Readonly<{
  type: "oauth2";
  scopes: readonly [typeof TWOWEEKS_APPLICATIONS_READ_SCOPE];
}>;

type McpProductionJsonSchemaV1 = Readonly<{
  type: "array" | "boolean" | "integer" | "number" | "object" | "string";
  description?: string;
  const?: string | number | boolean;
  enum?: readonly string[];
  minLength?: number;
  properties?: Readonly<Record<string, McpProductionJsonSchemaV1>>;
  required?: readonly string[];
  additionalProperties?: false | McpProductionJsonSchemaV1;
  items?: McpProductionJsonSchemaV1;
}>;

export type McpProductionToolDescriptorV1 = Readonly<{
  name: string;
  title: string;
  description: string;
  inputSchema: LocalMcpProjectedToolDescriptorV1["inputSchema"];
  outputSchema: McpProductionJsonSchemaV1;
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
    scopes: readOnlyApplicationsScopeTuple(),
  }),
]);
const READONLY_ANNOTATIONS = Object.freeze({
  readOnlyHint: true as const,
  destructiveHint: false as const,
  openWorldHint: false as const,
});
const SEARCH_INPUT_SCHEMA = Object.freeze({
  type: "object" as const,
  additionalProperties: false as const,
  properties: Object.freeze({
    query: Object.freeze({
      type: "string" as const,
    }),
  }),
  required: Object.freeze(["query"]),
});
const FETCH_INPUT_SCHEMA = Object.freeze({
  type: "object" as const,
  additionalProperties: false as const,
  properties: Object.freeze({
    id: Object.freeze({
      type: "string" as const,
    }),
  }),
  required: Object.freeze(["id"]),
});
const SEARCH_OUTPUT_SCHEMA = Object.freeze({
  type: "object" as const,
  additionalProperties: false as const,
  properties: Object.freeze({
    results: Object.freeze({
      type: "array" as const,
      items: Object.freeze({
        type: "object" as const,
        additionalProperties: false as const,
        properties: Object.freeze({
          id: Object.freeze({ type: "string" as const }),
          title: Object.freeze({ type: "string" as const }),
          url: Object.freeze({ type: "string" as const }),
        }),
        required: Object.freeze(["id", "title", "url"]),
      }),
    }),
  }),
  required: Object.freeze(["results"]),
});
const FETCH_OUTPUT_SCHEMA = Object.freeze({
  type: "object" as const,
  additionalProperties: false as const,
  properties: Object.freeze({
    id: Object.freeze({ type: "string" as const }),
    title: Object.freeze({ type: "string" as const }),
    text: Object.freeze({ type: "string" as const }),
    url: Object.freeze({ type: "string" as const }),
    metadata: Object.freeze({
      type: "object" as const,
      additionalProperties: Object.freeze({ type: "string" as const }),
    }),
  }),
  required: Object.freeze(["id", "title", "text", "url"]),
});
const READONLY_SUMMARY_STATUS_OUTPUT_SCHEMA = Object.freeze({
  type: "object" as const,
  additionalProperties: false as const,
  properties: Object.freeze({
    kind: Object.freeze({ type: "string" as const, const: "mcp_readonly_summary_status_result" }),
    status: Object.freeze({
      type: "string" as const,
      enum: Object.freeze(["OK", "STALE", "NO_DATA", "ONBOARDING_REQUIRED", "MALFORMED", "TIMEOUT", "DEPENDENCY_MISSING"]),
    }),
    toolName: Object.freeze({ type: "string" as const }),
    summary: Object.freeze({ type: "object" as const }),
    version: Object.freeze({ type: "integer" as const, const: 1 }),
  }),
  required: Object.freeze(["kind", "status", "toolName", "version"]),
});
const COMPATIBILITY_TOOL_DESCRIPTORS: readonly McpProductionToolDescriptorV1[] = Object.freeze([
  Object.freeze({
    name: "search",
    title: "Search Twoweeks safe summaries",
    description: "Search the fixed Twoweeks safe summary catalog.",
    inputSchema: SEARCH_INPUT_SCHEMA,
    outputSchema: SEARCH_OUTPUT_SCHEMA,
    annotations: READONLY_ANNOTATIONS,
    securitySchemes: OAUTH_READ_SECURITY_SCHEMES,
    _meta: Object.freeze({
      securitySchemes: OAUTH_READ_SECURITY_SCHEMES,
    }),
  }),
  Object.freeze({
    name: "fetch",
    title: "Fetch Twoweeks safe summary",
    description: "Fetch one fixed Twoweeks safe summary catalog item.",
    inputSchema: FETCH_INPUT_SCHEMA,
    outputSchema: FETCH_OUTPUT_SCHEMA,
    annotations: READONLY_ANNOTATIONS,
    securitySchemes: OAUTH_READ_SECURITY_SCHEMES,
    _meta: Object.freeze({
      securitySchemes: OAUTH_READ_SECURITY_SCHEMES,
    }),
  }),
]);
const MCP_PRODUCTION_TOOLS_LIST_RESULT = buildMcpProductionToolsListResultFromRegistry();

export function buildMcpProductionToolsListResult(): McpProductionToolsListResultV1 {
  return MCP_PRODUCTION_TOOLS_LIST_RESULT;
}

function buildMcpProductionToolsListResultFromRegistry(): McpProductionToolsListResultV1 {
  const registry = buildLocalMcpDescriptorRegistryMetadataOnly();
  return Object.freeze({
    tools: Object.freeze([
      ...COMPATIBILITY_TOOL_DESCRIPTORS,
      ...registry.descriptors.map(projectProductionToolDescriptor),
    ]),
  });
}

function readOnlyApplicationsScopeTuple(): readonly [typeof TWOWEEKS_APPLICATIONS_READ_SCOPE] {
  return Object.freeze([TWOWEEKS_APPLICATIONS_READ_SCOPE]);
}

function projectProductionToolDescriptor(
  descriptor: LocalMcpProjectedToolDescriptorV1,
): McpProductionToolDescriptorV1 {
  return Object.freeze({
    name: descriptor.name,
    title: descriptor.title,
    description: productionToolDescription(descriptor),
    inputSchema: productionInputSchema(descriptor),
    outputSchema: READONLY_SUMMARY_STATUS_OUTPUT_SCHEMA,
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
