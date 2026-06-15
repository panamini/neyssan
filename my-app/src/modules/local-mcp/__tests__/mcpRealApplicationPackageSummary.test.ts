import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildMcpRealApplicationPackageSummarySafeRefusal,
  projectMcpRealApplicationPackageSummary,
} from "../mcpRealApplicationPackageSummary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SUMMARY_SOURCE_FILE = resolve(TEST_DIR, "../mcpRealApplicationPackageSummary.ts");
const TEST_SOURCE_FILE = resolve(TEST_DIR, "mcpRealApplicationPackageSummary.test.ts");

function applicationPackageRef(overrides: Record<string, unknown> = {}) {
  return {
    id: "mcp-safe-ref:application-package:latest",
    label: "Application package availability",
    status: "available",
    category: "application_package",
    count: 1,
    updatedAt: "2026-06-15T11:59:59.750Z",
    version: 1,
    ...overrides,
  };
}

function adapterResult(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_read_only_twoweeks_data_adapter_result",
    allowed: true,
    reason: "read_only_refs_projected",
    refs: {
      applicationPackageRef: applicationPackageRef(),
    },
    blockedRefClasses: [],
    availabilitySummary: {
      available: 1,
      noData: 0,
      onboarding: 0,
      blocked: 0,
      version: 1,
    },
    audit: {
      checked: true,
      persisted: false,
      rawPayloadLogged: false,
      eventId: "redacted-audit:mcp-read-only-data-refs",
      redactionCount: 0,
      version: 1,
    },
    capabilities: {
      auth: "production_stytch_verified",
      accountLink: "server_only_owner_resolved",
      consent: "future_real_data_read",
      audit: "redacted_boundary_checked",
      retention: "boundary_checked",
      dataReads: "convex_read_only_refs",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
      rawDataProjection: "blocked",
      credentialStorage: "none",
      tokenStorage: "none",
      version: 1,
    },
    modelVisible: true,
    version: 1,
    ...overrides,
  };
}

function blockedAdapterResult() {
  return {
    kind: "mcp_read_only_twoweeks_data_adapter_result",
    allowed: false,
    reason: "auth_required",
    safeRefusal: {
      code: "read_only_twoweeks_data_adapter_blocked",
      message: "Refused. Read-only Twoweeks data adapter blocked.",
      safeForModel: true,
      rawDataExposed: false,
      credentialsExposed: false,
      ownerIdentityExposed: false,
      writeActionExecuted: false,
      version: 1,
    },
    capabilities: {
      auth: "blocked",
      accountLink: "blocked",
      consent: "blocked",
      audit: "not_evaluated",
      retention: "blocked",
      dataReads: "blocked",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
      rawDataProjection: "blocked",
      credentialStorage: "none",
      tokenStorage: "none",
      version: 1,
    },
    modelVisible: true,
    version: 1,
  };
}

function applicationPackageSummary(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_application_package_summary_result",
    allowed: true,
    status: "available",
    packageRef: applicationPackageRef(),
    availability: {
      source: "convex_application_package_summary",
      ownerState: "resolved",
      version: 1,
    },
    safeCounts: {
      packages: 1,
      artifacts: 2,
      provenanceLinks: 7,
      reviewItems: 1,
      warnings: 0,
      blockers: 0,
      version: 1,
    },
    safeCategories: {
      packageStatus: "ready_for_review",
      resumeVariantArtifactStatus: "ready_for_generation",
      coverLetterArtifactStatus: "ready_for_review",
      version: 1,
    },
    updatedAt: "2026-06-15T11:59:59.750Z",
    capabilities: {
      ownerResolution: "server_only",
      dataReads: "convex_application_package_summary",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
      rawDataProjection: "blocked",
      version: 1,
    },
    modelVisible: true,
    version: 1,
    ...overrides,
  };
}

function summaryInput(overrides: Record<string, unknown> = {}) {
  return {
    kind: "mcp_real_application_package_summary_input",
    adapterResult: adapterResult(),
    applicationPackageSummary: applicationPackageSummary(),
    version: 1,
    ...overrides,
  };
}

function expectBlocked(value: unknown, reason: string): void {
  expect(() => projectMcpRealApplicationPackageSummary(value)).not.toThrow();
  expect(projectMcpRealApplicationPackageSummary(value)).toEqual({
    kind: "mcp_real_application_package_summary_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpRealApplicationPackageSummarySafeRefusal(),
    capabilities: expect.objectContaining({
      dataReads: "blocked",
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
    }),
    modelVisible: true,
    version: 1,
  });
}

function assertNoSensitiveOutput(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const fragment of [
    "package_storage_id_DO_NOT_ECHO",
    "profile_storage_id_DO_NOT_ECHO",
    "clerk_DO_NOT_ECHO",
    "user_DO_NOT_ECHO",
    "real-user@example.test",
    "stytch_subject_DO_NOT_ECHO",
    "rawClaims",
    "accessToken",
    "refreshToken",
    "Bearer ",
    "RAW_CV_TEXT",
    "RAW_JOB_TEXT",
    "proposal content",
    "generated artifact content",
    "sourceText",
    "source quote",
    "privateFacts",
    "never_use",
    "debugPayload",
    "structuredShadow",
    "j97convexdocumentid",
  ] as const) {
    expect(serialized).not.toContain(fragment);
  }
}

function sourceFiles(): readonly string[] {
  return [SUMMARY_SOURCE_FILE, TEST_SOURCE_FILE].map((file) => readFileSync(file, "utf8"));
}

function importSpecifiers(source: string): readonly string[] {
  return [...source.matchAll(/^\s*import(?:\s+type)?[\s\S]*?\sfrom\s+"([^"]+)";/gmu)].map(
    (match) => match[1],
  );
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuvy]*/gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

describe("PR60 real application package summary boundary", () => {
  it("fails closed when the PR59 adapter result is missing", () => {
    expectBlocked(
      { kind: "mcp_real_application_package_summary_input", version: 1 },
      "invalid_input",
    );
  });

  it("fails closed when the PR59 adapter result is blocked", () => {
    expectBlocked(
      summaryInput({ adapterResult: blockedAdapterResult(), applicationPackageSummary: undefined }),
      "adapter_required",
    );
  });

  it("returns safe no-data when applicationPackageRef is missing", () => {
    const result = projectMcpRealApplicationPackageSummary(
      summaryInput({
        adapterResult: adapterResult({
          reason: "read_only_refs_unavailable",
          refs: {},
          availabilitySummary: {
            available: 0,
            noData: 1,
            onboarding: 0,
            blocked: 0,
            version: 1,
          },
        }),
        applicationPackageSummary: undefined,
      }),
    );

    expect(result).toMatchObject({
      allowed: true,
      status: "no_data_available",
      missingDataReason: "application_package_ref_missing",
      packageRef: {
        id: "mcp-safe-ref:application-package:latest",
        status: "no_data_available",
        category: "application_package",
        count: 0,
      },
      safeCounts: {
        packages: 0,
        artifacts: 0,
        provenanceLinks: 0,
        reviewItems: 0,
        warnings: 0,
        blockers: 0,
      },
      capabilities: {
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
      },
      modelVisible: true,
      version: 1,
    });
    assertNoSensitiveOutput(result);
  });

  it("returns safe onboarding state when applicationPackageRef is onboarding", () => {
    const result = projectMcpRealApplicationPackageSummary(
      summaryInput({
        adapterResult: adapterResult({
          reason: "read_only_refs_unavailable",
          refs: {
            applicationPackageRef: applicationPackageRef({
              status: "onboarding_required",
              count: 0,
              updatedAt: undefined,
            }),
          },
          availabilitySummary: {
            available: 0,
            noData: 0,
            onboarding: 1,
            blocked: 0,
            version: 1,
          },
        }),
        applicationPackageSummary: undefined,
      }),
    );

    expect(result).toMatchObject({
      allowed: true,
      status: "onboarding_required",
      missingDataReason: "owner_onboarding_required",
      packageRef: {
        id: "mcp-safe-ref:application-package:latest",
        status: "onboarding_required",
        category: "application_package",
        count: 0,
      },
    });
    assertNoSensitiveOutput(result);
  });

  it("returns safe application package summary only for a valid applicationPackageRef", () => {
    const result = projectMcpRealApplicationPackageSummary(summaryInput());

    expect(result).toEqual({
      kind: "mcp_real_application_package_summary_result",
      allowed: true,
      status: "available",
      packageRef: applicationPackageRef(),
      availability: {
        source: "convex_application_package_summary",
        ownerState: "resolved",
        version: 1,
      },
      safeCounts: {
        packages: 1,
        artifacts: 2,
        provenanceLinks: 7,
        reviewItems: 1,
        warnings: 0,
        blockers: 0,
        version: 1,
      },
      safeCategories: {
        packageStatus: "ready_for_review",
        resumeVariantArtifactStatus: "ready_for_generation",
        coverLetterArtifactStatus: "ready_for_review",
        version: 1,
      },
      updatedAt: "2026-06-15T11:59:59.750Z",
      capabilities: {
        adapter: "pr59_read_only_adapter_verified",
        dataReads: "convex_application_package_summary",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        exportActions: "blocked",
        rawDataProjection: "blocked",
        credentialStorage: "none",
        tokenStorage: "none",
        version: 1,
      },
      modelVisible: true,
      version: 1,
    });
    assertNoSensitiveOutput(result);
  });

  it("rejects raw package content and generated artifact content", () => {
    expectBlocked(
      summaryInput({
        applicationPackageSummary: applicationPackageSummary({
          packageContent: "proposal content",
        }),
      }),
      "unsafe_summary_blocked",
    );
    expectBlocked(
      summaryInput({
        applicationPackageSummary: applicationPackageSummary({
          generatedArtifactContent: "generated artifact content",
        }),
      }),
      "unsafe_summary_blocked",
    );
  });

  it("rejects CV, job, proposal, source, private, never-use, debug, and shadow fields", () => {
    for (const unsafeSummary of [
      { rawCvText: "RAW_CV_TEXT" },
      { rawJobText: "RAW_JOB_TEXT" },
      { proposalContent: "proposal content" },
      { sourceText: "sourceText" },
      { sourceQuote: "source quote" },
      { privateFacts: ["privateFacts"] },
      { never_use: true },
      { debugPayload: { ok: false } },
      { structuredShadow: { hidden: true } },
    ] as const) {
      expectBlocked(
        summaryInput({
          applicationPackageSummary: applicationPackageSummary(unsafeSummary),
        }),
        "unsafe_summary_blocked",
      );
    }
  });

  it("does not return identity, token, raw-claim, or Convex document identifiers", () => {
    for (const unsafeSummary of [
      { clerkId: "clerk_DO_NOT_ECHO" },
      { userId: "user_DO_NOT_ECHO" },
      { email: "real-user@example.test" },
      { stytchSubject: "stytch_subject_DO_NOT_ECHO" },
      { accessToken: "accessToken" },
      { rawClaims: { sub: "stytch_subject_DO_NOT_ECHO" } },
      { convexDocumentId: "j97convexdocumentid" },
    ] as const) {
      const result = projectMcpRealApplicationPackageSummary(
        summaryInput({ applicationPackageSummary: applicationPackageSummary(unsafeSummary) }),
      );

      expect(result).toMatchObject({ allowed: false, reason: "unsafe_summary_blocked" });
      assertNoSensitiveOutput(result);
    }
  });

  it("fails closed for malformed top-level input", () => {
    for (const value of [undefined, null, [], {}, { kind: "wrong", version: 1 }] as const) {
      expectBlocked(value, "invalid_input");
    }
  });

  it("fails closed for top-level descriptor hazards without invoking getters", () => {
    for (const buildHazard of [
      () => Object.create(summaryInput()),
      () => {
        const input = summaryInput() as Record<PropertyKey, unknown>;
        input[Symbol("unexpected")] = "blocked";
        return input;
      },
      () => {
        const input = summaryInput() as Record<PropertyKey, unknown>;
        Object.defineProperty(input, "hidden", {
          enumerable: false,
          value: "blocked",
        });
        return input;
      },
    ] as const) {
      expectBlocked(buildHazard(), "invalid_input");
    }

    for (const propertyName of ["kind", "adapterResult", "applicationPackageSummary"] as const) {
      let getterInvoked = false;
      const input = summaryInput() as Record<PropertyKey, unknown>;
      Object.defineProperty(input, propertyName, {
        enumerable: true,
        get() {
          getterInvoked = true;
          throw new Error(`${propertyName} getter must not be invoked`);
        },
      });

      expectBlocked(input, "invalid_input");
      expect(getterInvoked).toBe(false);
    }
  });

  it("keeps source disconnected from forbidden imports, calls, and unsafe top-level reads", () => {
    const allowedImports = new Set([
      "../mcpRealApplicationPackageSummary",
      "node:fs",
      "node:path",
      "node:url",
      "vitest",
    ]);
    const forbiddenImportSpecifier =
      /activeCvSnapshots|profilesPublic|jobsPublic|proposalsPublic|(?:^|\/)(?:_generated|handlers?|tools\/list|tools\/call)(?:\/|$)|node:https?$|https?$|@openai|openai|langchain|axios|undici|oauth|token/iu;
    const forbiddenCallPatterns = [
      /\bfetch\s*\(/u,
      /\bXMLHttpRequest\b/u,
      /\bcreateServer\s*\(/u,
      /\.listen\s*\(/u,
      /\bnew\s+WebSocket\b/u,
      /\bEventSource\s*\(/u,
      /\bctx\.(?:db|runQuery|runMutation|scheduler|auth)\b/u,
      /\b(?:query|mutation|internalQuery|internalMutation|internalAction|action)\s*\(/u,
      /\b(?:exportFile|downloadFile|sendEmail|submitApplication|applyToJob)\s*\(/u,
      /\b(?:openai|langchain|tokenEndpoint|refreshToken|revocationEndpoint|oauth\/callback)\b/iu,
    ] as const;

    for (const source of sourceFiles()) {
      for (const specifier of importSpecifiers(source)) {
        expect(allowedImports.has(specifier) || !forbiddenImportSpecifier.test(specifier)).toBe(true);
      }
      const executableSource = stripStringAndPatternLiterals(source);
      for (const pattern of forbiddenCallPatterns) {
        expect(executableSource).not.toMatch(pattern);
      }
    }

    const implementation = readFileSync(SUMMARY_SOURCE_FILE, "utf8");
    const executableImplementation = stripStringAndPatternLiterals(implementation);
    const functionStart = executableImplementation.indexOf(
      "export function projectMcpRealApplicationPackageSummary",
    );
    const parseCall = executableImplementation.indexOf("parseSummaryInput(input)", functionStart);
    const preParseSource = executableImplementation.slice(functionStart, parseCall);

    expect(functionStart).toBeGreaterThanOrEqual(0);
    expect(parseCall).toBeGreaterThan(functionStart);
    expect(executableImplementation).toContain("function parseSummaryInput(value: unknown)");
    expect(executableImplementation).toContain("Object.getOwnPropertyDescriptors");
    expect(executableImplementation).toContain("Reflect.ownKeys");
    expect(preParseSource).not.toMatch(
      /\binput\.(?:kind|adapterResult|applicationPackageSummary|version)\b/u,
    );
  });
});
