import {
  projectLocalMcpRegistryToMcpToolsList,
} from "./mcpSchemaProjection";
import type {
  LocalMcpProjectedToolDescriptorV1,
} from "./mcpSchemaProjection";
import type { LocalMcpToolIdV1 } from "./schema";

export type LocalMcpDescriptorRegistryFixtureOnlyV1 = Readonly<{
  kind: "local_mcp_descriptor_registry_fixture_only";
  fixtureOnly: true;
  callable: false;
  runnable: false;
  networkReachable: false;
  descriptors: readonly LocalMcpProjectedToolDescriptorV1[];
  descriptorNames: readonly string[];
  localToolIds: readonly LocalMcpToolIdV1[];
  version: 1;
}>;

const EXPECTED_DESCRIPTOR_NAMES = [
  "twoweeks.application_package.summarize",
  "twoweeks.evidence_graph.summarize",
  "twoweeks.resume_variant_plan.summarize",
  "twoweeks.review_cockpit.summarize",
] as const;

const EXPECTED_LOCAL_TOOL_IDS: readonly LocalMcpToolIdV1[] = [
  "local_mcp.application_package.summarize",
  "local_mcp.evidence_graph.summarize",
  "local_mcp.resume_variant_plan.summarize",
  "local_mcp.review_cockpit.summarize",
] as const;

const STATIC_DESCRIPTOR_REGISTRY_FIXTURE_ONLY = buildStaticDescriptorRegistry();

export function buildLocalMcpDescriptorRegistryFixtureOnly(): LocalMcpDescriptorRegistryFixtureOnlyV1 {
  return cloneDescriptorRegistry(STATIC_DESCRIPTOR_REGISTRY_FIXTURE_ONLY);
}

export function assertLocalMcpDescriptorRegistryFixtureOnly(
  registry: LocalMcpDescriptorRegistryFixtureOnlyV1,
): void {
  const record = asPlainRecord(registry, "Local MCP descriptor registry must be an object");
  const expectedKeys = [
    "kind",
    "fixtureOnly",
    "callable",
    "runnable",
    "networkReachable",
    "descriptors",
    "descriptorNames",
    "localToolIds",
    "version",
  ] as const;
  assertExactKeys(record, expectedKeys, "Local MCP descriptor registry");

  if (record.kind !== "local_mcp_descriptor_registry_fixture_only") {
    throw new TypeError("Local MCP descriptor registry kind is invalid");
  }
  if (record.fixtureOnly !== true || record.callable !== false || record.runnable !== false) {
    throw new TypeError("Local MCP descriptor registry must stay fixture-only and non-runnable");
  }
  if (record.networkReachable !== false) {
    throw new TypeError("Local MCP descriptor registry must not be network reachable");
  }
  if (record.version !== 1) {
    throw new TypeError("Local MCP descriptor registry version must be 1");
  }
  assertStringArray(record.descriptorNames, [...EXPECTED_DESCRIPTOR_NAMES], "descriptor names");
  assertStringArray(record.localToolIds, [...EXPECTED_LOCAL_TOOL_IDS], "local tool ids");
  assertDescriptorArray(record.descriptors);
}

function buildStaticDescriptorRegistry(): LocalMcpDescriptorRegistryFixtureOnlyV1 {
  const descriptors = projectLocalMcpRegistryToMcpToolsList().tools;
  const registry: LocalMcpDescriptorRegistryFixtureOnlyV1 = {
    kind: "local_mcp_descriptor_registry_fixture_only",
    fixtureOnly: true,
    callable: false,
    runnable: false,
    networkReachable: false,
    descriptors,
    descriptorNames: descriptors.map((descriptor) => descriptor.name),
    localToolIds: descriptors.map((descriptor) => descriptor.localToolId),
    version: 1,
  };

  assertLocalMcpDescriptorRegistryFixtureOnly(registry);
  return cloneDescriptorRegistry(registry);
}

function assertDescriptorArray(value: unknown): asserts value is readonly LocalMcpProjectedToolDescriptorV1[] {
  if (!Array.isArray(value)) {
    throw new TypeError("Local MCP descriptor registry descriptors must be an array");
  }
  if (value.length !== EXPECTED_DESCRIPTOR_NAMES.length) {
    throw new TypeError("Local MCP descriptor registry must contain exactly the PR38 descriptors");
  }

  value.forEach((descriptor, index) => {
    const record = asPlainRecord(descriptor, "Local MCP descriptor must be an object");
    if (record.name !== EXPECTED_DESCRIPTOR_NAMES[index]) {
      throw new TypeError("Local MCP descriptor registry descriptor order is invalid");
    }
    if (record.localToolId !== EXPECTED_LOCAL_TOOL_IDS[index]) {
      throw new TypeError("Local MCP descriptor registry local tool order is invalid");
    }
    if (containsExecutableValue(record)) {
      throw new TypeError("Local MCP descriptor registry must not contain executable fields");
    }
    if ("handler" in record || "execute" in record || "call" in record || "_meta" in record) {
      throw new TypeError("Local MCP descriptor registry descriptor must remain inert");
    }
  });
}

function cloneDescriptorRegistry(
  registry: LocalMcpDescriptorRegistryFixtureOnlyV1,
): LocalMcpDescriptorRegistryFixtureOnlyV1 {
  return {
    ...registry,
    descriptors: registry.descriptors.map(cloneDescriptor),
    descriptorNames: [...registry.descriptorNames],
    localToolIds: [...registry.localToolIds],
  };
}

function cloneDescriptor(
  descriptor: LocalMcpProjectedToolDescriptorV1,
): LocalMcpProjectedToolDescriptorV1 {
  return {
    ...descriptor,
    inputSchema: cloneJsonSchema(descriptor.inputSchema),
    outputSchema: cloneJsonSchema(descriptor.outputSchema),
    annotations: { ...descriptor.annotations },
  };
}

type JsonSchemaClone = LocalMcpProjectedToolDescriptorV1["inputSchema"];

function cloneJsonSchema(schema: JsonSchemaClone): JsonSchemaClone {
  return {
    ...schema,
    ...(schema.additionalProperties !== undefined
      ? {
          additionalProperties:
            typeof schema.additionalProperties === "object"
              ? cloneJsonSchema(schema.additionalProperties)
              : schema.additionalProperties,
        }
      : {}),
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

function assertStringArray(value: unknown, expected: readonly string[], label: string): void {
  if (!Array.isArray(value)) {
    throw new TypeError(`Local MCP descriptor registry ${label} must be an array`);
  }
  if (value.length !== expected.length || !expected.every((item, index) => value[index] === item)) {
    throw new TypeError(`Local MCP descriptor registry ${label} drifted`);
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  label: string,
): void {
  const actualKeys = Object.keys(value);
  if (actualKeys.length !== expectedKeys.length || !expectedKeys.every((key) => actualKeys.includes(key))) {
    throw new TypeError(`${label} must not contain extra or missing fields`);
  }
}

function asPlainRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return value as Record<string, unknown>;
}

function containsExecutableValue(value: unknown): boolean {
  if (typeof value === "function") return true;
  if (!value || typeof value !== "object") return false;

  const nestedValues = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  return nestedValues.some((nestedValue) => containsExecutableValue(nestedValue));
}
