import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stableSerialize } from "../../application-harness/fingerprints";
import {
  assertInternalToolContract,
  assertInternalToolContractRegistry,
  assertInternalToolContractsDoNotContainGeneratedText,
} from "../contractRules";
import {
  buildInternalToolContractContent,
  buildInternalToolContractRegistry,
  buildInternalToolContractRegistryHash,
  collectInternalToolContractIds,
  getInternalToolContract,
  listInternalToolContracts,
} from "../contracts";
import type {
  InternalToolContractRegistryV1,
  InternalToolContractV1,
} from "../schema";

const EXPECTED_CONTRACT_IDS = [
  "application_context.describe",
  "application_package.summarize",
  "application_package.validate",
  "cover_letter_artifact.summarize",
  "evidence_graph.summarize",
  "internal_tool_contracts.describe",
  "internal_tool_contracts.list",
  "resume_variant_artifact.summarize",
  "resume_variant_plan.summarize",
  "review_cockpit.summarize",
] as const;

const FORBIDDEN_HELPER_NAMES = [
  "runInternalTool",
  "executeInternalTool",
  "callInternalTool",
  "dispatchInternalTool",
  "invokeTool",
  "registerToolHandler",
  "performToolAction",
] as const;

function firstContract(overrides: Partial<InternalToolContractV1> = {}): InternalToolContractV1 {
  return { ...listInternalToolContracts()[0], ...overrides } as InternalToolContractV1;
}

function registryWith(
  contracts: readonly InternalToolContractV1[],
  contractIds = contracts.map((contract) => contract.id),
): InternalToolContractRegistryV1 {
  return { contracts, contractIds, version: 1 } as InternalToolContractRegistryV1;
}

function sorted(values: readonly string[]): readonly string[] {
  return [...values].sort();
}

describe("internal tool contracts", () => {
  it("builds deterministic registry", () => {
    const first = buildInternalToolContractRegistry();
    const second = buildInternalToolContractRegistry();

    expect(first).toEqual(second);
    expect(first.version).toBe(1);
    expect(first.contracts).not.toBe(second.contracts);
  });

  it("registry hash is stable", async () => {
    const first = buildInternalToolContractRegistry();
    const second = buildInternalToolContractRegistry();

    await expect(buildInternalToolContractRegistryHash(first)).resolves.toBe(
      await buildInternalToolContractRegistryHash(second),
    );
  });

  it('content helper returns kind: "internal_tool_contracts"', () => {
    const registry = buildInternalToolContractRegistry();
    const content = buildInternalToolContractContent(registry);

    expect(content.kind).toBe("internal_tool_contracts");
    expect(content.registry).toEqual(registry);
    expect(content.version).toBe(1);
  });

  it("registry includes all expected safe contracts", () => {
    const registry = buildInternalToolContractRegistry();

    expect(registry.contractIds).toEqual(EXPECTED_CONTRACT_IDS);
  });

  it("contracts sorted by ID", () => {
    const ids = buildInternalToolContractRegistry().contracts.map((contract) => contract.id);

    expect(ids).toEqual(sorted(ids));
  });

  it("contractIds sorted by ID", () => {
    const ids = buildInternalToolContractRegistry().contractIds;

    expect(ids).toEqual(sorted(ids));
  });

  it("duplicate contract IDs rejected", () => {
    const duplicate = firstContract();

    expect(() => assertInternalToolContractRegistry(registryWith([duplicate, duplicate]))).toThrow(TypeError);
  });

  it("unknown effect rejected", () => {
    expect(() =>
      assertInternalToolContract(firstContract({ effect: "network" as InternalToolContractV1["effect"] })),
    ).toThrow(TypeError);
  });

  it("unknown risk level rejected", () => {
    expect(() =>
      assertInternalToolContract(firstContract({ riskLevel: "high" as InternalToolContractV1["riskLevel"] })),
    ).toThrow(TypeError);
  });

  it("unknown status rejected", () => {
    expect(() =>
      assertInternalToolContract(firstContract({ status: "ready" as InternalToolContractV1["status"] })),
    ).toThrow(TypeError);
  });

  it("unknown input kind rejected", () => {
    const contract = firstContract({
      input: [
        {
          ...firstContract().input[0],
          kind: "raw_job_text" as InternalToolContractV1["input"][number]["kind"],
        },
      ],
    });

    expect(() => assertInternalToolContract(contract)).toThrow(TypeError);
  });

  it("unknown output kind rejected", () => {
    expect(() =>
      assertInternalToolContract(firstContract({
        output: {
          ...firstContract().output,
          kind: "pdf_file" as InternalToolContractV1["output"]["kind"],
        },
      })),
    ).toThrow(TypeError);
  });

  it("active contract with requiresApproval: true rejected", () => {
    expect(() => assertInternalToolContract(firstContract({ requiresApproval: true }))).toThrow(TypeError);
  });

  it('active contract with riskLevel "blocked" rejected', () => {
    expect(() => assertInternalToolContract(firstContract({ riskLevel: "blocked" }))).toThrow(TypeError);
  });

  it("active contract with forbiddenUntil rejected", () => {
    expect(() => assertInternalToolContract(firstContract({ forbiddenUntil: "future PR" }))).toThrow(TypeError);
  });

  it('ID containing "export" rejected', () => {
    expect(() =>
      assertInternalToolContract(firstContract({ id: "application_package.export" as InternalToolContractV1["id"] })),
    ).toThrow(TypeError);
  });

  it('ID containing "send" rejected', () => {
    expect(() =>
      assertInternalToolContract(firstContract({ id: "application_package.send" as InternalToolContractV1["id"] })),
    ).toThrow(TypeError);
  });

  it('ID containing "submit" rejected', () => {
    expect(() =>
      assertInternalToolContract(firstContract({ id: "application_package.submit" as InternalToolContractV1["id"] })),
    ).toThrow(TypeError);
  });

  it('ID containing "apply" rejected', () => {
    expect(() =>
      assertInternalToolContract(firstContract({ id: "application_package.apply" as InternalToolContractV1["id"] })),
    ).toThrow(TypeError);
  });

  it('ID containing "track" rejected', () => {
    expect(() =>
      assertInternalToolContract(firstContract({ id: "application_package.track" as InternalToolContractV1["id"] })),
    ).toThrow(TypeError);
  });

  it('ID containing "generation" rejected', () => {
    expect(() =>
      assertInternalToolContract(firstContract({ id: "application_package.generation" as InternalToolContractV1["id"] })),
    ).toThrow(TypeError);
  });

  it('ID containing "scout" or "mcp" rejected', () => {
    expect(() =>
      assertInternalToolContract(firstContract({ id: "application_package.scout" as InternalToolContractV1["id"] })),
    ).toThrow(TypeError);
    expect(() =>
      assertInternalToolContract(firstContract({ id: "application_package.mcp" as InternalToolContractV1["id"] })),
    ).toThrow(TypeError);
  });

  it("description implying export/send/apply/track/generation/network/scraping rejected", () => {
    for (const description of [
      "Export the application package as PDF.",
      "Send the package to the employer.",
      "Submit the package to the job site.",
      "Apply to the opening using this package.",
      "Track the application after submission.",
      "Generate a new document.",
      "Call a network endpoint.",
      "Scrape an external page.",
    ]) {
      expect(() => assertInternalToolContract(firstContract({ description }))).toThrow(TypeError);
    }
  });

  it("generated-looking resume text in metadata rejected", () => {
    expect(() =>
      assertInternalToolContractsDoNotContainGeneratedText(registryWith([
        firstContract({ description: "Improved conversion by 32% through a new workflow." }),
      ])),
    ).toThrow(TypeError);
  });

  it("generated-looking cover-letter text in metadata rejected", () => {
    expect(() =>
      assertInternalToolContractsDoNotContainGeneratedText(registryWith([
        firstContract({ description: "Dear Hiring Manager, I am excited to apply." }),
      ])),
    ).toThrow(TypeError);
  });

  it("getInternalToolContract returns requested contract", () => {
    expect(getInternalToolContract("application_package.validate")?.id).toBe("application_package.validate");
  });

  it("getInternalToolContract returns undefined for unknown ID", () => {
    expect(getInternalToolContract("missing.contract")).toBeUndefined();
  });

  it("listInternalToolContracts returns deterministic sorted contracts", () => {
    const first = listInternalToolContracts();
    const second = listInternalToolContracts();

    expect(first).toEqual(second);
    expect(first.map((contract) => contract.id)).toEqual(EXPECTED_CONTRACT_IDS);
  });

  it("registry exposes no execution helpers", async () => {
    const module = await import("../contracts");

    for (const key of Object.keys(module)) {
      expect(FORBIDDEN_HELPER_NAMES).not.toContain(key);
    }
  });

  it("registry contains no MCP or Scout contracts", () => {
    const registryText = JSON.stringify(buildInternalToolContractRegistry()).toLowerCase();

    expect(registryText).not.toMatch(/\bmcp\b/u);
    expect(registryText).not.toMatch(/\bscout\b/u);
  });

  it("registry contains no export/send/apply/track contracts", () => {
    const registry = buildInternalToolContractRegistry();

    for (const contract of registry.contracts) {
      expect(contract.id).not.toMatch(/export|send|apply|track/u);
      expect(contract.description.toLowerCase()).not.toMatch(/\b(export|send|apply|track)\b/u);
    }
  });

  it("no imports/calls from forbidden surfaces", () => {
    const sourceFiles = [
      new URL("../schema.ts", import.meta.url),
      new URL("../contracts.ts", import.meta.url),
      new URL("../contractRules.ts", import.meta.url),
    ];

    for (const sourceFile of sourceFiles) {
      const source = readFileSync(sourceFile, "utf8");
      expect(source).not.toMatch(
        /from\s+["'][^"']*(convex|premiumCoverLetter|proposal|cv-forge|mcp|scout|pdf|docx|generation|prompt|mistral|openai)[^"']*["']/iu,
      );
      expect(source).not.toMatch(
        /\b(fetch|axios|nodeFetch|undici|runInternalTool|executeInternalTool|callInternalTool|dispatchInternalTool|invokeTool|registerToolHandler|performToolAction)\s*\(/u,
      );
    }
  });

  it("helpers do not mutate inputs", async () => {
    const registry = buildInternalToolContractRegistry();
    const before = stableSerialize(registry);

    assertInternalToolContractRegistry(registry);
    await buildInternalToolContractRegistryHash(registry);
    buildInternalToolContractContent(registry);
    collectInternalToolContractIds(registry);

    expect(stableSerialize(registry)).toBe(before);
  });

  it("output arrays are deterministic", () => {
    const first = buildInternalToolContractRegistry();
    const second = buildInternalToolContractRegistry();

    expect(first.contractIds).toEqual(second.contractIds);
    expect(first.contracts.map((contract) => contract.input.map((parameter) => parameter.name))).toEqual(
      second.contracts.map((contract) => contract.input.map((parameter) => parameter.name)),
    );
    expect(collectInternalToolContractIds(first)).toEqual(EXPECTED_CONTRACT_IDS);
  });
});
