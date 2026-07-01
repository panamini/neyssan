import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateMcpProductionToolsCallBoundary } from "../mcpProductionToolsCallBoundary";
import { buildMcpProductionToolsListResult } from "../mcpProductionToolsListProjection";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpProductionToolsCallBoundary.ts");
const TOOL_ARGUMENTS = [
  [
    "twoweeks.application_package.summarize",
    { applicationPackageRef: { id: "mcp-safe-ref:application-package:latest" } },
  ],
  [
    "twoweeks.evidence_graph.summarize",
    { evidenceGraphRef: { id: "mcp-safe-ref:evidence-graph:profile" } },
  ],
  [
    "twoweeks.resume_variant_plan.summarize",
    { resumeVariantPlanRef: { id: "mcp-safe-ref:resume-variant-plan:latest" } },
  ],
  [
    "twoweeks.review_cockpit.summarize",
    { reviewCockpitRef: { id: "mcp-safe-ref:review-cockpit:latest" } },
  ],
] as const;
const TOOL_ARGUMENT_FIELD_NAMES = [
  "applicationPackageRef",
  "evidenceGraphRef",
  "resumeVariantPlanRef",
  "reviewCockpitRef",
] as const;
const STALE_SYNTHETIC_RESULT_MARKERS = Object.freeze([
  "mcp_production_tools_call_readonly_synthetic_result",
  "validated_synthetic_summary_only",
  "buildMcpProductionToolsCallReadonlySyntheticResult",
  "PR102 returns a synthetic summary only",
] as const);

function validate(params: unknown) {
  return validateMcpProductionToolsCallBoundary({
    method: "tools/call",
    params,
    version: 1,
  });
}

function withPrototypeNamedExtra(validArgs: Readonly<Record<string, unknown>>, key: string): Record<string, unknown> {
  if (key === "__proto__") {
    const args = { ...validArgs };
    Object.defineProperty(args, "__proto__", {
      configurable: true,
      enumerable: true,
      value: "closed",
    });
    return args;
  }
  return { ...validArgs, [key]: "closed" };
}

describe("production MCP tools/call boundary", () => {
  it("accepts each listed read-only tool only with its exact declared argument schema", () => {
    const toolsList = buildMcpProductionToolsListResult();

    for (const [name, args] of TOOL_ARGUMENTS) {
      const validation = validateMcpProductionToolsCallBoundary({
        method: "tools/call",
        params: { name, arguments: args, _meta: { progressToken: "progress-token-1" } },
        toolsList,
        version: 1,
      });

      expect(validation).toMatchObject({
        valid: true,
        method: "tools/call",
        phase: "pr102_readonly_boundary_validation",
        params: {
          name,
          progressTokenAccepted: true,
          rawArgumentsEchoed: false,
          metaEchoed: false,
        },
      });
      expect(validation.valid ? validation.tool.name : undefined).toBe(name);
      expect(JSON.stringify(validation)).not.toContain("progress-token-1");
    }
  });

  it("rejects unknown params, unsafe metadata, unknown tools, and non-tools/call methods", () => {
    expect(validate({ name: "twoweeks.application_package.summarize", arguments: {}, task: "do more" }))
      .toMatchObject({ valid: false, error: { code: "invalid_param_name" } });
    expect(validate({ name: "twoweeks.application_package.summarize", arguments: {}, cursor: "cursor-1" }))
      .toMatchObject({ valid: false, error: { code: "invalid_param_name" } });
    expect(validate({ name: "twoweeks.application_package.summarize", arguments: {}, filters: {} }))
      .toMatchObject({ valid: false, error: { code: "invalid_param_name" } });
    expect(validate({ name: "twoweeks.application_package.summarize", arguments: {}, unknown: true }))
      .toMatchObject({ valid: false, error: { code: "invalid_param_name" } });
    expect(validate({ name: "twoweeks.application_package.summarize", arguments: {}, _meta: { progressToken: { id: "nested" } } }))
      .toMatchObject({ valid: false, error: { code: "invalid_meta" } });
    expect(validate({ name: "twoweeks.missing.summarize", arguments: {} }))
      .toMatchObject({ valid: false, error: { code: "unknown_tool" } });
    expect(validateMcpProductionToolsCallBoundary({ method: "tools/list", params: {}, version: 1 }))
      .toMatchObject({ valid: false, error: { code: "invalid_method" } });
  });

  it("fails closed for malformed params and malformed arguments", () => {
    expect(validate(undefined)).toMatchObject({ valid: false, error: { code: "payload_not_json" } });
    expect(validate(null)).toMatchObject({ valid: false, error: { code: "invalid_params" } });
    expect(validate([])).toMatchObject({ valid: false, error: { code: "invalid_params" } });
    expect(validate({ name: 42, arguments: {} })).toMatchObject({ valid: false, error: { code: "invalid_name" } });
    expect(validate({ name: "", arguments: {} })).toMatchObject({ valid: false, error: { code: "invalid_name" } });
    expect(validate({ name: "twoweeks.application_package.summarize", arguments: null }))
      .toMatchObject({ valid: false, error: { code: "invalid_arguments" } });
    expect(validate({ name: "twoweeks.application_package.summarize", arguments: [] }))
      .toMatchObject({ valid: false, error: { code: "invalid_arguments" } });
  });

  it("rejects invalid arguments for every listed tool schema", () => {
    for (const [name, validArgs] of TOOL_ARGUMENTS) {
      const validFieldName = Object.keys(validArgs)[0];
      const wrongFieldName = TOOL_ARGUMENT_FIELD_NAMES.find((fieldName) => fieldName !== validFieldName);
      if (!wrongFieldName) throw new Error("test fixture must provide a wrong field name");
      const wrongFields = [
        { [wrongFieldName]: { id: "wrong-ref" } },
        { [validFieldName]: { id: "ref-1" }, extra: { id: "extra" } },
        { [validFieldName]: {} },
        { [validFieldName]: { id: "" } },
        { [validFieldName]: { id: "ref-1", extra: true } },
      ] as const;

      for (const args of wrongFields) {
        expect(validate({ name, arguments: args })).toMatchObject({
          valid: false,
          error: { code: "invalid_arguments" },
        });
      }
    }
  });

  it("rejects extra top-level and nested fields for each current production tool through the matcher", () => {
    for (const [name, validArgs] of TOOL_ARGUMENTS) {
      const fieldName = Object.keys(validArgs)[0];

      expect(validate({ name, arguments: { ...validArgs, extra: "closed" } })).toMatchObject({
        valid: false,
        error: { code: "invalid_arguments" },
      });
      for (const prototypeNamedExtra of ["toString", "constructor", "__proto__"]) {
        expect(validate({ name, arguments: withPrototypeNamedExtra(validArgs, prototypeNamedExtra) })).toMatchObject({
          valid: false,
          error: { code: "invalid_arguments" },
        });
      }
      expect(validate({
        name,
        arguments: {
          [fieldName]: {
            id: `${fieldName}-1`,
            extra: "closed",
          },
        },
      })).toMatchObject({
        valid: false,
        error: { code: "invalid_arguments" },
      });
    }
  });

  it("rejects overlarge, deep, cyclic, non-finite, and non-plain payloads before result construction", () => {
    const cyclic: Record<string, unknown> = {
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: { id: "ref-1" } },
    };
    cyclic.self = cyclic;

    class NonPlainPayload {
      readonly id = "ref-1";
    }

    expect(validate({
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: { id: "x".repeat(5_000) } },
    })).toMatchObject({ valid: false, error: { code: "payload_too_large" } });
    expect(validate({
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: { id: "ref-1" } },
      _meta: { progressToken: { a: { b: { c: { d: { e: { f: { g: { h: { i: "too-deep" } } } } } } } } } },
    })).toMatchObject({ valid: false, error: { code: "payload_too_deep" } });
    expect(validate(cyclic)).toMatchObject({ valid: false, error: { code: "payload_not_json" } });
    expect(validate({
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: { id: Number.NaN } },
    })).toMatchObject({ valid: false, error: { code: "payload_not_json" } });
    expect(validate({
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: new NonPlainPayload() },
    })).toMatchObject({ valid: false, error: { code: "payload_not_json" } });
    expect(validate({
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: { id: "ref-1", fn: () => "nope" } },
    })).toMatchObject({ valid: false, error: { code: "payload_not_json" } });
    expect(validate({
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: ["ref-1"] },
    })).toMatchObject({ valid: false, error: { code: "invalid_arguments" } });
  });

  it("stays validation-only without stale synthetic result metadata", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");
    for (const marker of STALE_SYNTHETIC_RESULT_MARKERS) {
      expect(source).not.toContain(marker);
    }

    const validation = validate({
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: { id: "mcp-safe-ref:application-package:latest" } },
      _meta: { progressToken: "progress-token-secret" },
    });
    if (!validation.valid) throw new Error("fixture should validate");

    const serialized = JSON.stringify(validation);

    expect(Object.keys(validation).sort()).toEqual([
      "method",
      "params",
      "phase",
      "tool",
      "valid",
      "version",
    ]);
    expect(validation.params).toEqual({
      name: "twoweeks.application_package.summarize",
      arguments: { applicationPackageRef: { id: "mcp-safe-ref:application-package:latest" } },
      argumentFields: ["applicationPackageRef"],
      progressTokenAccepted: true,
      rawArgumentsEchoed: false,
      metaEchoed: false,
      version: 1,
    });
    expect(serialized).not.toContain("progress-token-secret");
    expect(serialized).not.toContain("progressTokenEchoed");
    expect(serialized).not.toContain("effects");
    expect(serialized).not.toContain("publicOutput");
    expect(serialized).not.toContain("localToolId");
    expect(serialized).not.toContain("internalToolId");
    expect(serialized).not.toContain("handler");
    expect(serialized).not.toContain("stack");
    expect(serialized).not.toContain("access_token");
    expect(serialized).not.toContain("refresh_token");
    expect(serialized).not.toContain("authorizationCodeDigest");
    expect(serialized).not.toContain("mcpOAuthAccessTokens");
    expect(serialized.toLowerCase()).not.toContain("real handler");
  });
});
