import type {
  InternalToolIdV1,
  InternalToolInputKindV1,
  InternalToolOutputKindV1,
} from "../internal-tool-contracts/schema";
import type {
  LocalMcpToolDefinitionV1,
  LocalMcpToolIdV1,
  LocalMcpToolRegistryV1,
} from "./schema";
import { buildLocalMcpToolRegistry } from "./toolRegistry";

// PR18: projection locale uniquement.
// Lire aussi `schema.ts`, `toolRegistry.ts` et `mcpSchemaProjection.test.ts` si le registre change.
// Modifier seulement ce module et ses tests si le contrat bouge; ne pas ajouter de transport, handler runtime ou schéma plus large ici.
// Risques à surveiller: casser le mapping `local_mcp.* -> twoweeks.*` ou ouvrir le JSON Schema.
// Vérifier avec `vitest --run src/modules/local-mcp/__tests__/*.test.ts` puis `tsc --noEmit`.
export type LocalMcpJsonSchemaV1 = Readonly<{
  type: "object" | "string" | "number" | "boolean" | "integer";
  description?: string;
  const?: string | number | boolean;
  enum?: readonly string[];
  minLength?: number;
  properties?: Readonly<Record<string, LocalMcpJsonSchemaV1>>;
  required?: readonly string[];
  additionalProperties?: false | LocalMcpJsonSchemaV1;
}>;

export type LocalMcpProjectedToolDescriptorV1 = Readonly<{
  name: string;
  title: string;
  description: string;
  inputSchema: LocalMcpJsonSchemaV1;
  outputSchema: LocalMcpJsonSchemaV1;
  annotations: Readonly<{
    readOnlyHint: true;
    destructiveHint: false;
    openWorldHint: false;
  }>;
  localToolId: LocalMcpToolIdV1;
  internalToolId: InternalToolIdV1;
  version: 1;
}>;

export type LocalMcpProjectedToolsListV1 = Readonly<{
  tools: readonly LocalMcpProjectedToolDescriptorV1[];
  nextCursor?: string;
  version: 1;
}>;

const FORBIDDEN_DESCRIPTOR_TERMS: readonly string[] = [
  "send",
  "submit",
  "apply",
  "export",
  "download",
  "network",
  "oauth",
  "chatgpt",
  "openai",
  "browser",
  "scrape",
] as const;

const TOOL_TITLES: Readonly<Record<LocalMcpToolIdV1, string>> = {
  "local_mcp.application_package.summarize": "Summarize application package",
  "local_mcp.evidence_graph.summarize": "Summarize evidence graph",
  "local_mcp.resume_variant_plan.summarize": "Summarize resume variant plan",
  "local_mcp.review_cockpit.summarize": "Summarize review cockpit",
} as const;

export function projectLocalMcpToolToMcpDescriptor(
  tool: LocalMcpToolDefinitionV1,
): LocalMcpProjectedToolDescriptorV1 {
  const descriptor: LocalMcpProjectedToolDescriptorV1 = {
    name: buildProjectedToolName(tool.id),
    title: TOOL_TITLES[tool.id],
    description: buildProjectedToolDescription(tool),
    inputSchema: buildLocalMcpInputJsonSchema(tool),
    outputSchema: buildLocalMcpOutputJsonSchema(tool),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
    localToolId: tool.id,
    internalToolId: tool.internalToolId,
    version: 1,
  };

  assertLocalMcpProjectedToolDescriptor(descriptor);
  return cloneProjectedToolDescriptor(descriptor);
}

export function projectLocalMcpRegistryToMcpToolsList(
  registry: LocalMcpToolRegistryV1 = buildLocalMcpToolRegistry(),
): LocalMcpProjectedToolsListV1 {
  return {
    tools: registry.tools
      .map(projectLocalMcpToolToMcpDescriptor)
      .sort((a, b) => compareStrings(a.name, b.name)),
    version: 1,
  };
}

export function buildLocalMcpInputJsonSchema(
  tool: LocalMcpToolDefinitionV1,
): LocalMcpJsonSchemaV1 {
  const properties = Object.fromEntries(
    tool.inputKinds.map((kind) => [inputKindToFieldName(kind), buildRefJsonSchema(kind)]),
  );
  const required = tool.inputKinds.map(inputKindToFieldName);

  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

export function buildLocalMcpOutputJsonSchema(
  tool: LocalMcpToolDefinitionV1,
): LocalMcpJsonSchemaV1 {
  // La sortie doit rester le dry-run actuel, pas un résumé métier futur.
  // Si le format évolue, mettre à jour ce schéma et le test PR18 en même temps.
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      kind: {
        type: "string",
        const: "local_mcp_dry_run",
      },
      internalToolId: {
        type: "string",
        const: tool.internalToolId,
      },
      input: buildLocalMcpInputJsonSchema(tool),
      outputKind: {
        type: "string",
        const: tool.outputKind,
      },
      version: {
        type: "number",
        const: 1,
      },
    },
    required: ["kind", "internalToolId", "input", "outputKind", "version"],
  };
}

export function assertLocalMcpProjectedToolDescriptor(
  descriptor: LocalMcpProjectedToolDescriptorV1,
): void {
  const record = asPlainRecord(descriptor, "Local MCP projected descriptor must be an object");
  if (!isSafeProjectedName(record.name)) {
    throw new TypeError("Local MCP projected descriptor requires a safe name");
  }
  if (!isNonEmptyString(record.title)) {
    throw new TypeError("Local MCP projected descriptor requires title");
  }
  if (!isNonEmptyString(record.description) || !record.description.startsWith("Use this when")) {
    throw new TypeError("Local MCP projected descriptor requires MCP-style description");
  }
  if (containsForbiddenDescriptorTerm([record.name, record.title, record.description])) {
    throw new TypeError("Local MCP projected descriptor contains forbidden metadata");
  }
  assertObjectJsonSchema(record.inputSchema, "Local MCP projected descriptor inputSchema");
  assertObjectJsonSchema(record.outputSchema, "Local MCP projected descriptor outputSchema");
  if (!isNonEmptyString(record.localToolId)) {
    throw new TypeError("Local MCP projected descriptor requires localToolId");
  }
  if (!isNonEmptyString(record.internalToolId)) {
    throw new TypeError("Local MCP projected descriptor requires internalToolId");
  }
  assertSafeAnnotations(record.annotations);
  if (record.version !== 1) {
    throw new TypeError("Local MCP projected descriptor version must be 1");
  }
}

function buildProjectedToolName(toolId: LocalMcpToolIdV1): string {
  return toolId.replace(/^local_mcp\./u, "twoweeks.");
}

function buildProjectedToolDescription(tool: LocalMcpToolDefinitionV1): string {
  return `Use this when you need safe dry-run metadata for ${tool.internalToolId}. It returns only local dry-run fields for an existing reference.`;
}

function inputKindToFieldName(kind: InternalToolInputKindV1): string {
  switch (kind) {
    case "application_package_ref":
      return "applicationPackageRef";
    case "evidence_graph_ref":
      return "evidenceGraphRef";
    case "resume_variant_plan_ref":
      return "resumeVariantPlanRef";
    case "review_cockpit_ref":
      return "reviewCockpitRef";
    default:
      throw new TypeError("Unsupported Local MCP input kind");
  }
}

function buildRefJsonSchema(kind: InternalToolInputKindV1): LocalMcpJsonSchemaV1 {
  return {
    type: "object",
    description: `Reference object for ${kind}.`,
    additionalProperties: false,
    properties: {
      id: {
        type: "string",
        minLength: 1,
      },
    },
    required: ["id"],
  };
}

function cloneProjectedToolDescriptor(
  descriptor: LocalMcpProjectedToolDescriptorV1,
): LocalMcpProjectedToolDescriptorV1 {
  return {
    ...descriptor,
    inputSchema: cloneJsonSchema(descriptor.inputSchema),
    outputSchema: cloneJsonSchema(descriptor.outputSchema),
    annotations: { ...descriptor.annotations },
  };
}

function cloneJsonSchema(schema: LocalMcpJsonSchemaV1): LocalMcpJsonSchemaV1 {
  const cloned: LocalMcpJsonSchemaV1 = {
    ...schema,
    additionalProperties:
      typeof schema.additionalProperties === "object"
        ? cloneJsonSchema(schema.additionalProperties)
        : schema.additionalProperties,
  };

  return {
    ...cloned,
    ...(schema.enum ? { enum: [...schema.enum] } : {}),
    ...(schema.required ? { required: [...schema.required] } : {}),
    ...(schema.properties
      ? {
          properties: Object.fromEntries(
            Object.entries(schema.properties).map(([key, value]) => [key, cloneJsonSchema(value)]),
          ),
        }
      : {}),
  };
}

function assertObjectJsonSchema(value: unknown, label: string): void {
  const schema = asPlainRecord(value, `${label} must be an object`);
  if (schema.type !== "object") throw new TypeError(`${label} must be an object schema`);
  if (schema.additionalProperties !== false) {
    throw new TypeError(`${label} must reject additional properties`);
  }
  if (!isPlainRecord(schema.properties)) {
    throw new TypeError(`${label} requires properties`);
  }
  if (!Array.isArray(schema.required)) {
    throw new TypeError(`${label} requires required fields`);
  }
}

function assertSafeAnnotations(value: unknown): void {
  const annotations = asPlainRecord(value, "Local MCP projected descriptor requires annotations");
  if (annotations.readOnlyHint !== true) {
    throw new TypeError("Local MCP projected descriptor must be read-only");
  }
  if (annotations.destructiveHint !== false) {
    throw new TypeError("Local MCP projected descriptor must be non-destructive");
  }
  if (annotations.openWorldHint !== false) {
    throw new TypeError("Local MCP projected descriptor must be closed-world");
  }
}

function containsForbiddenDescriptorTerm(values: readonly unknown[]): boolean {
  const normalized = values
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .normalize("NFKC")
    .toLowerCase();

  return FORBIDDEN_DESCRIPTOR_TERMS.some((term) => normalized.includes(term));
}

function isSafeProjectedName(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9_.]*$/u.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asPlainRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isPlainRecord(value)) throw new TypeError(message);
  return value;
}

// Garde locale volontairement dupliquée pour protéger ce module sans dépendre d'un helper partagé.
// fallow-ignore-next-line code-duplication
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
