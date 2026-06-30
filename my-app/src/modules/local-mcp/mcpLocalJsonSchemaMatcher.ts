import type { LocalMcpJsonSchemaV1 } from "./mcpSchemaProjection";

export type NormalizedLocalMcpAdditionalPropertiesV1 = Readonly<
  | {
      state: "absent";
      version: 1;
    }
  | {
      state: "false";
      version: 1;
    }
  | {
      state: "schema";
      schema: NormalizedLocalMcpJsonSchemaV1;
      version: 1;
    }
>;

export type NormalizedLocalMcpJsonSchemaV1 = Readonly<{
  type: LocalMcpJsonSchemaV1["type"];
  description?: string;
  const?: string | number | boolean;
  enum?: readonly string[];
  minLength?: number;
  properties?: Readonly<Record<string, NormalizedLocalMcpJsonSchemaV1>>;
  required?: readonly string[];
  additionalProperties: NormalizedLocalMcpAdditionalPropertiesV1;
  version: 1;
}>;

export function normalizeLocalMcpJsonSchema(
  schema: LocalMcpJsonSchemaV1,
): NormalizedLocalMcpJsonSchemaV1 | undefined {
  return normalizeJsonSchema(schema, new WeakSet<object>());
}

export function localMcpJsonSchemaMatches(
  value: unknown,
  schema: LocalMcpJsonSchemaV1,
): boolean {
  const normalizedSchema = normalizeLocalMcpJsonSchema(schema);
  return normalizedSchema !== undefined && matchesNormalizedSchema(value, normalizedSchema, new WeakSet<object>());
}

function normalizeJsonSchema(
  schema: LocalMcpJsonSchemaV1,
  activeSchemas: WeakSet<object>,
): NormalizedLocalMcpJsonSchemaV1 | undefined {
  if (!isPlainRecord(schema) || activeSchemas.has(schema)) return undefined;
  if (!isLocalMcpJsonSchemaType(schema.type)) return undefined;
  if (!hasValidOptionalSchemaMetadata(schema)) return undefined;
  activeSchemas.add(schema);
  const additionalProperties = normalizeAdditionalProperties(schema.additionalProperties, activeSchemas);
  if (!additionalProperties) {
    activeSchemas.delete(schema);
    return undefined;
  }
  const base = normalizeBaseFields(schema, additionalProperties);
  if (schema.type !== "object") {
    activeSchemas.delete(schema);
    return base;
  }
  const properties = normalizeProperties(schema.properties, activeSchemas);
  const required = normalizeRequired(schema.required);
  activeSchemas.delete(schema);
  if (!properties || !required) return undefined;
  return Object.freeze({
    ...base,
    properties,
    required,
  });
}

function normalizeBaseFields(
  schema: LocalMcpJsonSchemaV1,
  additionalProperties: NormalizedLocalMcpAdditionalPropertiesV1,
): NormalizedLocalMcpJsonSchemaV1 {
  return Object.freeze({
    type: schema.type,
    ...(schema.description !== undefined ? { description: schema.description } : {}),
    ...("const" in schema ? { const: schema.const } : {}),
    ...(schema.enum !== undefined ? { enum: Object.freeze([...schema.enum]) } : {}),
    ...(schema.minLength !== undefined ? { minLength: schema.minLength } : {}),
    additionalProperties,
    version: 1,
  });
}

function normalizeAdditionalProperties(
  additionalProperties: LocalMcpJsonSchemaV1["additionalProperties"],
  activeSchemas: WeakSet<object>,
): NormalizedLocalMcpAdditionalPropertiesV1 | undefined {
  if (additionalProperties === undefined) {
    return Object.freeze({ state: "absent" as const, version: 1 });
  }
  if (additionalProperties === false) {
    return Object.freeze({ state: "false" as const, version: 1 });
  }
  const schema = normalizeJsonSchema(additionalProperties, activeSchemas);
  if (!schema) return undefined;
  return Object.freeze({ state: "schema" as const, schema, version: 1 });
}

function normalizeProperties(
  properties: LocalMcpJsonSchemaV1["properties"],
  activeSchemas: WeakSet<object>,
): Readonly<Record<string, NormalizedLocalMcpJsonSchemaV1>> | undefined {
  if (properties === undefined) return Object.freeze({});
  if (!isPlainRecord(properties)) return undefined;
  const entries: [string, NormalizedLocalMcpJsonSchemaV1][] = [];
  for (const [key, value] of Object.entries(properties)) {
    const normalized = normalizeJsonSchema(value, activeSchemas);
    if (!normalized) return undefined;
    entries.push([key, normalized]);
  }
  return Object.freeze(Object.fromEntries(entries));
}

function normalizeRequired(required: LocalMcpJsonSchemaV1["required"]): readonly string[] | undefined {
  if (required === undefined) return Object.freeze([]);
  if (!Array.isArray(required) || required.some((field) => typeof field !== "string")) return undefined;
  return Object.freeze([...required]);
}

function matchesNormalizedSchema(
  value: unknown,
  schema: NormalizedLocalMcpJsonSchemaV1,
  activeValues: WeakSet<object>,
): boolean {
  if (!matchesLiteralGuards(value, schema)) return false;
  const matcher = NORMALIZED_SCHEMA_TYPE_MATCHERS[schema.type];
  return matcher(value, schema, activeValues);
}

type NormalizedSchemaTypeMatcher = (
  value: unknown,
  schema: NormalizedLocalMcpJsonSchemaV1,
  activeValues: WeakSet<object>,
) => boolean;

const NORMALIZED_SCHEMA_TYPE_MATCHERS: Readonly<
  Record<LocalMcpJsonSchemaV1["type"], NormalizedSchemaTypeMatcher>
> = Object.freeze({
  object: matchesObjectSchema,
  string: matchesStringSchema,
  number: matchesFiniteNumberSchema,
  integer: matchesSafeIntegerSchema,
  boolean: matchesBooleanSchema,
});

function matchesLiteralGuards(value: unknown, schema: NormalizedLocalMcpJsonSchemaV1): boolean {
  const constMatches = !("const" in schema) || value === schema.const;
  const enumMatches = schema.enum === undefined || (typeof value === "string" && schema.enum.includes(value));
  return constMatches && enumMatches;
}

function matchesObjectSchema(
  value: unknown,
  schema: NormalizedLocalMcpJsonSchemaV1,
  activeValues: WeakSet<object>,
): boolean {
  if (!isPlainRecord(value) || activeValues.has(value)) return false;
  activeValues.add(value);
  const properties = schema.properties ?? {};
  const required = schema.required ?? [];
  const result =
    hasRequiredKeys(value, required) &&
    matchesDeclaredProperties(value, properties, activeValues) &&
    matchesExtraProperties(value, properties, schema.additionalProperties, activeValues);
  activeValues.delete(value);
  return result;
}

function matchesStringSchema(value: unknown, schema: NormalizedLocalMcpJsonSchemaV1): boolean {
  return typeof value === "string" && (schema.minLength === undefined || value.length >= schema.minLength);
}

function matchesFiniteNumberSchema(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function matchesSafeIntegerSchema(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function matchesBooleanSchema(value: unknown): boolean {
  return typeof value === "boolean";
}

function hasRequiredKeys(value: Record<string, unknown>, required: readonly string[]): boolean {
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function matchesDeclaredProperties(
  value: Record<string, unknown>,
  properties: Readonly<Record<string, NormalizedLocalMcpJsonSchemaV1>>,
  activeValues: WeakSet<object>,
): boolean {
  return Object.entries(properties).every(
    ([key, nestedSchema]) =>
      !Object.prototype.hasOwnProperty.call(value, key) ||
      matchesNormalizedSchema(value[key], nestedSchema, activeValues),
  );
}

function matchesExtraProperties(
  value: Record<string, unknown>,
  properties: Readonly<Record<string, NormalizedLocalMcpJsonSchemaV1>>,
  additionalProperties: NormalizedLocalMcpAdditionalPropertiesV1,
  activeValues: WeakSet<object>,
): boolean {
  const extraKeys = Object.keys(value).filter((key) => !(key in properties));
  if (extraKeys.length === 0) return true;
  if (additionalProperties.state !== "schema") return false;
  return extraKeys.every((key) => matchesNormalizedSchema(value[key], additionalProperties.schema, activeValues));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function isLocalMcpJsonSchemaType(value: unknown): value is LocalMcpJsonSchemaV1["type"] {
  return (
    value === "object" ||
    value === "string" ||
    value === "number" ||
    value === "boolean" ||
    value === "integer"
  );
}

function hasValidOptionalSchemaMetadata(schema: LocalMcpJsonSchemaV1): boolean {
  if (schema.description !== undefined && typeof schema.description !== "string") return false;
  if ("const" in schema && !isSupportedConstValue(schema.const)) return false;
  if (schema.enum !== undefined && !isStringArray(schema.enum)) return false;
  if (schema.minLength !== undefined && !isNonNegativeSafeInteger(schema.minLength)) return false;
  return true;
}

function isSupportedConstValue(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
