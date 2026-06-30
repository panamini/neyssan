import { describe, expect, it } from "vitest";
import matcherSource from "../mcpLocalJsonSchemaMatcher.ts?raw";
import {
  localMcpJsonSchemaMatches,
  normalizeLocalMcpJsonSchema,
} from "../mcpLocalJsonSchemaMatcher";
import type { LocalMcpJsonSchemaV1 } from "../mcpSchemaProjection";

const stringSchema: LocalMcpJsonSchemaV1 = Object.freeze({ type: "string", minLength: 1 });

describe("local MCP JSON schema matcher", () => {
  it("normalizes missing object properties and required fields to data-only empty defaults", () => {
    const normalized = normalizeLocalMcpJsonSchema({ type: "object" });

    expect(normalized).toEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: { state: "absent", version: 1 },
      version: 1,
    });
  });

  it("keeps absent additionalProperties explicit and closes undeclared keys by matcher default", () => {
    const schema: LocalMcpJsonSchemaV1 = {
      type: "object",
      properties: {
        id: stringSchema,
      },
      required: ["id"],
    };

    expect(normalizeLocalMcpJsonSchema(schema)?.additionalProperties).toEqual({
      state: "absent",
      version: 1,
    });
    expect(localMcpJsonSchemaMatches({ id: "ref-1" }, schema)).toBe(true);
    expect(localMcpJsonSchemaMatches({ id: "ref-1", extra: "closed" }, schema)).toBe(false);
  });

  it("rejects extra keys when normalized schema disallows extras", () => {
    const schema: LocalMcpJsonSchemaV1 = {
      type: "object",
      additionalProperties: false,
      properties: { id: stringSchema },
      required: ["id"],
    };

    expect(normalizeLocalMcpJsonSchema(schema)?.additionalProperties).toEqual({
      state: "false",
      version: 1,
    });
    const protoNamedExtras = Object.fromEntries([
      ["id", "ref-1"],
      ["toString", "closed"],
      ["constructor", "closed"],
    ]);
    Object.defineProperty(protoNamedExtras, "__proto__", {
      configurable: true,
      enumerable: true,
      value: "closed",
    });

    expect(localMcpJsonSchemaMatches({ id: "ref-1" }, schema)).toBe(true);
    expect(localMcpJsonSchemaMatches({ id: "ref-1", extra: "closed" }, schema)).toBe(false);
    expect(localMcpJsonSchemaMatches(protoNamedExtras, schema)).toBe(false);
  });

  it("validates schema-valued additionalProperties for every extra value", () => {
    const schema: LocalMcpJsonSchemaV1 = {
      type: "object",
      properties: { id: stringSchema },
      required: ["id"],
      additionalProperties: { type: "string", enum: ["read"] },
    };

    expect(normalizeLocalMcpJsonSchema(schema)?.additionalProperties).toMatchObject({ state: "schema" });
    expect(localMcpJsonSchemaMatches({ id: "ref-1", scope: "read", mode: "read" }, schema)).toBe(true);
    expect(localMcpJsonSchemaMatches({ id: "ref-1", scope: "write" }, schema)).toBe(false);
  });

  it("matches nested schema-valued additionalProperties recursively", () => {
    const schema: LocalMcpJsonSchemaV1 = {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          id: stringSchema,
        },
        required: ["id"],
        additionalProperties: {
          type: "object",
          properties: {
            status: { type: "string", const: "read_only" },
          },
          required: ["status"],
          additionalProperties: false,
        },
      },
    };

    expect(localMcpJsonSchemaMatches({
      one: { id: "ref-1", nested: { status: "read_only" } },
      two: { id: "ref-2" },
    }, schema)).toBe(true);
    expect(localMcpJsonSchemaMatches({
      one: { id: "ref-1", nested: { status: "read_only", extra: true } },
    }, schema)).toBe(false);
  });

  it("enforces required keys and declared property schemas", () => {
    const schema: LocalMcpJsonSchemaV1 = {
      type: "object",
      properties: {
        ref: {
          type: "object",
          properties: { id: stringSchema },
          required: ["id"],
          additionalProperties: false,
        },
      },
      required: ["ref"],
      additionalProperties: false,
    };

    expect(localMcpJsonSchemaMatches({ ref: { id: "ref-1" } }, schema)).toBe(true);
    expect(localMcpJsonSchemaMatches({}, schema)).toBe(false);
    expect(localMcpJsonSchemaMatches({ ref: { id: "" } }, schema)).toBe(false);
    expect(localMcpJsonSchemaMatches({ ref: { id: "ref-1", extra: true } }, schema)).toBe(false);
  });

  it("enforces string minLength, enum, and const behavior", () => {
    expect(localMcpJsonSchemaMatches("abc", { type: "string", minLength: 2 })).toBe(true);
    expect(localMcpJsonSchemaMatches("a", { type: "string", minLength: 2 })).toBe(false);
    expect(localMcpJsonSchemaMatches("read", { type: "string", enum: ["read", "list"] })).toBe(true);
    expect(localMcpJsonSchemaMatches("write", { type: "string", enum: ["read", "list"] })).toBe(false);
    expect(localMcpJsonSchemaMatches("read_only", { type: "string", const: "read_only" })).toBe(true);
    expect(localMcpJsonSchemaMatches("write", { type: "string", const: "read_only" })).toBe(false);
  });

  it("enforces finite number and safe integer behavior", () => {
    expect(localMcpJsonSchemaMatches(1.5, { type: "number" })).toBe(true);
    expect(localMcpJsonSchemaMatches(Number.POSITIVE_INFINITY, { type: "number" })).toBe(false);
    expect(localMcpJsonSchemaMatches(2, { type: "integer" })).toBe(true);
    expect(localMcpJsonSchemaMatches(2.5, { type: "integer" })).toBe(false);
    expect(localMcpJsonSchemaMatches(Number.MAX_SAFE_INTEGER + 1, { type: "integer" })).toBe(false);
  });

  it("fails closed for arrays, functions, prototypes, classes, cyclic values, and cyclic schemas", () => {
    class NonPlainPayload {
      readonly id = "ref-1";
    }
    const cyclicValue: Record<string, unknown> = { id: "ref-1" };
    cyclicValue.self = cyclicValue;
    const cyclicSchema: LocalMcpJsonSchemaV1 = {
      type: "object",
      properties: {},
      additionalProperties: false,
    };
    (cyclicSchema as { properties: Record<string, LocalMcpJsonSchemaV1> }).properties.self = cyclicSchema;

    expect(localMcpJsonSchemaMatches([], { type: "object" })).toBe(false);
    expect(localMcpJsonSchemaMatches({ fn: () => "nope" }, {
      type: "object",
      additionalProperties: { type: "string" },
    })).toBe(false);
    expect(localMcpJsonSchemaMatches(new NonPlainPayload(), { type: "object" })).toBe(false);
    expect(localMcpJsonSchemaMatches(cyclicValue, {
      type: "object",
      properties: { self: { type: "object" } },
      required: ["self"],
    })).toBe(false);
    expect(normalizeLocalMcpJsonSchema(cyclicSchema)).toBeUndefined();
    expect(localMcpJsonSchemaMatches({ self: {} }, cyclicSchema)).toBe(false);
    expect(normalizeLocalMcpJsonSchema({ type: "array" } as unknown as LocalMcpJsonSchemaV1)).toBeUndefined();
    expect(localMcpJsonSchemaMatches("read", {
      type: "string",
      enum: [1],
    } as unknown as LocalMcpJsonSchemaV1)).toBe(false);
  });

  it("stays independent from routes, auth, policy, JSON-RPC responses, and runtime handlers", () => {
    const forbiddenPatterns = [
      /tools\/call/u,
      /tools\/list/u,
      /jsonrpc/u,
      /evaluateMcpProductionPolicy/u,
      /McpAuthenticatedProtocolEnvelope/u,
      /buildMcpProductionToolsCallReadonlySyntheticResult/u,
      /handler/u,
      /fetch\(/u,
      /from\s+["'][^"']*(oauth|RouteAdapter|Policy|Envelope|toolRegistry|convex|react)[^"']*["']/iu,
    ] as const;

    for (const pattern of forbiddenPatterns) {
      expect(matcherSource).not.toMatch(pattern);
    }
  });
});
