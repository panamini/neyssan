import {
  buildMcpProductionReadonlySummaryExecutionInput,
  type McpProductionReadonlySummaryExecutorV1,
} from "./mcpProductionReadonlySummaryExecutor";
import { buildMcpProductionReadonlySummaryMcpResultV2 } from "./mcpProductionReadonlySummaryProjectorV2";
import { buildMcpProductionToolsListResult } from "./mcpProductionToolsListProjection";
import type {
  McpSafeSummaryIdentityAttestation,
  McpSafeSummaryProofAdapter,
  McpSafeSummaryProofIdentityRole,
  McpSafeSummaryProofToolName,
} from "./mcpSafeSummaryProjectionProofHarness";

export type McpSafeSummaryServerIdentityV1 = Readonly<{
  subject: string;
  issuer: string;
  ownerProfileId: string;
  version: 1;
}>;

export type McpSafeSummaryServerIdentityResolverV1 = (
  role: McpSafeSummaryProofIdentityRole,
) => Promise<McpSafeSummaryServerIdentityV1 | undefined>;

export type McpSafeSummaryServerReferenceResolverV1 = (
  identity: McpSafeSummaryServerIdentityV1,
  toolName: McpSafeSummaryProofToolName,
) => Promise<Readonly<{ id: string }> | undefined>;

export type McpSafeSummaryServerSeedPortV1 = (
  identity: McpSafeSummaryServerIdentityV1,
) => Promise<unknown>;

export type McpSafeSummaryServerCleanupPortV1 = (
  identity: McpSafeSummaryServerIdentityV1,
) => Promise<unknown>;

export type McpSafeSummaryServerRuntimePortV1 = Readonly<{
  start: () => Promise<boolean>;
  recoverOldRuntime: () => Promise<boolean>;
}>;

export type McpSafeSummaryServerSessionV1 = Readonly<{
  adapter: McpSafeSummaryProofAdapter;
}>;

export type McpSafeSummaryServerSessionInputV1 = Readonly<{
  resolveIdentity: McpSafeSummaryServerIdentityResolverV1;
  resolveReference: McpSafeSummaryServerReferenceResolverV1;
  executeSummary: McpProductionReadonlySummaryExecutorV1;
  seedA: McpSafeSummaryServerSeedPortV1;
  cleanupA: McpSafeSummaryServerCleanupPortV1;
  runtime: McpSafeSummaryServerRuntimePortV1;
  nowEpochMs?: () => number;
}>;

const VALID_SUBJECT_OR_PROFILE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;

export function buildMcpSafeSummaryServerSession(
  input: McpSafeSummaryServerSessionInputV1,
): McpSafeSummaryServerSessionV1 {
  let initialA: McpSafeSummaryServerIdentityV1 | undefined;
  let active: McpSafeSummaryServerIdentityV1 | undefined;
  let activeRole: McpSafeSummaryProofIdentityRole | undefined;
  let runtimeStarted = false;

  const resolveAndAttest = async (
    role: McpSafeSummaryProofIdentityRole,
  ): Promise<McpSafeSummaryIdentityAttestation> => {
    const identity = await input.resolveIdentity(role);
    if (!identity || !isValidIdentity(identity)) {
      throw new Error("server_identity_unavailable");
    }

    if (role === "A" && !initialA) {
      initialA = identity;
      active = identity;
      activeRole = "A";
      return Object.freeze({
        role: "A",
        verified: true,
        relationToInitialA: "INITIAL",
        version: 1,
      });
    }

    if (role === "B") {
      if (!initialA || isServerIdentityNotDistinct(identity, initialA)) {
        throw new Error("server_identity_not_distinct");
      }
      active = identity;
      activeRole = "B";
      return Object.freeze({
        role: "B",
        verified: true,
        relationToInitialA: "DISTINCT_FROM_INITIAL_A",
        version: 1,
      });
    }

    if (!initialA || !sameServerIdentity(identity, initialA)) {
      throw new Error("server_identity_return_mismatch");
    }
    active = identity;
    activeRole = "A";
    return Object.freeze({
      role: "A",
      verified: true,
      relationToInitialA: "SAME_AS_INITIAL_A",
      version: 1,
    });
  };

  const adapter: McpSafeSummaryProofAdapter = Object.freeze({
    prepare: async () => {
      runtimeStarted = await input.runtime.start();
      return Object.freeze({ status: "ready" as const, runtimeStarted, version: 1 as const });
    },
    listTools: async () => buildMcpProductionToolsListResult(),
    enterIdentity: resolveAndAttest,
    seedA: async () => {
      if (!initialA) throw new Error("server_identity_not_initialized");
      return input.seedA(initialA);
    },
    callTool: async (role, toolName) => {
      if (!active || activeRole !== role) {
        throw new Error("server_identity_not_active");
      }
      const ref = await input.resolveReference(active, toolName);
      if (!ref) throw new Error("server_reference_unavailable");
      const executionInput = buildMcpProductionReadonlySummaryExecutionInput({
        validation: buildValidatedSummaryCall(toolName, ref.id),
        twoweeksClerkId: active.subject,
        version: 1,
      });
      if (!executionInput) throw new Error("server_summary_input_unavailable");
      const executionResult = await input.executeSummary(executionInput);
      const projected = buildMcpProductionReadonlySummaryMcpResultV2({
        toolName,
        executionResult,
        nowEpochMs: input.nowEpochMs?.() ?? Date.now(),
        forbiddenSubstrings: [active.subject, active.ownerProfileId],
        version: 2,
      });
      return Object.freeze({
        content: projected.content,
        structuredContent: projected.structuredContent,
      });
    },
    cleanupA: async () => {
      if (!initialA) throw new Error("server_identity_not_initialized");
      return input.cleanupA(initialA);
    },
    recover: async () => {
      if (!runtimeStarted) return Object.freeze({ status: "recovered" as const, version: 1 as const });
      if (!(await input.runtime.recoverOldRuntime())) throw new Error("old_runtime_recovery_failed");
      runtimeStarted = false;
      return Object.freeze({ status: "recovered" as const, version: 1 as const });
    },
  });

  return Object.freeze({ adapter });
}

function sameServerIdentity(
  left: McpSafeSummaryServerIdentityV1,
  right: McpSafeSummaryServerIdentityV1 | undefined,
): boolean {
  return right !== undefined &&
    left.subject === right.subject &&
    left.issuer === right.issuer &&
    left.ownerProfileId === right.ownerProfileId;
}

function isServerIdentityNotDistinct(
  left: McpSafeSummaryServerIdentityV1,
  right: McpSafeSummaryServerIdentityV1 | undefined,
): boolean {
  return right !== undefined && (
    left.ownerProfileId === right.ownerProfileId ||
    sameCanonicalAuthIdentity(left, right)
  );
}

function sameCanonicalAuthIdentity(
  left: McpSafeSummaryServerIdentityV1,
  right: McpSafeSummaryServerIdentityV1,
): boolean {
  // Convex resolves the controlled owner from the authenticated Clerk subject;
  // an issuer variation must not make that same server-resolved subject distinct.
  return left.subject === right.subject;
}

function isValidIdentity(value: McpSafeSummaryServerIdentityV1): boolean {
  return value.version === 1 &&
    VALID_SUBJECT_OR_PROFILE.test(value.subject) &&
    VALID_SUBJECT_OR_PROFILE.test(value.ownerProfileId) &&
    isCanonicalHttpsIssuer(value.issuer);
}

function isCanonicalHttpsIssuer(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.origin === value &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "";
  } catch {
    return false;
  }
}

function buildValidatedSummaryCall(
  toolName: McpSafeSummaryProofToolName,
  refId: string,
) {
  return {
    valid: true as const,
    tool: { name: toolName },
    params: {
      arguments: { [argumentKey(toolName)]: { id: refId } },
    },
  } as unknown as Parameters<typeof buildMcpProductionReadonlySummaryExecutionInput>[0]["validation"];
}

function argumentKey(toolName: McpSafeSummaryProofToolName): string {
  switch (toolName) {
    case "twoweeks.application_package.summarize": return "applicationPackageRef";
    case "twoweeks.evidence_graph.summarize": return "evidenceGraphRef";
    case "twoweeks.resume_variant_plan.summarize": return "resumeVariantPlanRef";
    case "twoweeks.review_cockpit.summarize": return "reviewCockpitRef";
  }
}
