import React from "react";
import { useAuth } from "@clerk/clerk-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createMcpSafeSummaryProofSessionId,
  MCP_SAFE_SUMMARY_CONTROLLED_PROOF_OPERATOR_TOKEN_PATH,
  normalizeMcpSafeSummaryProofSessionId,
  type McpSafeSummaryProofOperatorRole,
} from "../modules/local-mcp/mcpSafeSummaryProofOperatorContract";
import { MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT } from
  "../modules/local-mcp/mcpSafeSummaryProjectionProofHarness";

type OperatorResponse = Readonly<Record<string, unknown>>;

export function McpSafeSummaryProofOperatorPage(): JSX.Element {
  const { getToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = React.useState("Prêt à envoyer le bearer éphémère.");
  const role = readRole(location.search);
  const [generatedProofSessionId] = React.useState(createMcpSafeSummaryProofSessionId);
  const providedProofSessionId = readProofSessionId(location.search);
  const proofSessionId = providedProofSessionId ??
    (role === "A" ? generatedProofSessionId : undefined);
  const operatorBHref = role === "A" && proofSessionId
    ? buildOperatorHref(location.pathname, location.search, "B", proofSessionId)
    : undefined;

  React.useEffect(() => {
    if (role !== "A" || providedProofSessionId || !proofSessionId) return;
    void navigate(
      buildOperatorHref(location.pathname, location.search, "A", proofSessionId),
      { replace: true },
    );
  }, [
    location.pathname,
    location.search,
    navigate,
    proofSessionId,
    providedProofSessionId,
    role,
  ]);

  const submit = React.useCallback(async () => {
    if (!role) {
      setStatus("Rôle manquant : utilisez ?role=A ou ?role=B.");
      return;
    }
    if (!proofSessionId) {
      setStatus("Session de preuve manquante.");
      return;
    }
    setStatus(`Vérification de l’opérateur ${role}…`);
    try {
      const token = await getToken({ template: "convex" });
      if (!token) {
        setStatus("Clerk n’a pas fourni de bearer.");
        return;
      }
      const response = await fetch(MCP_SAFE_SUMMARY_CONTROLLED_PROOF_OPERATOR_TOKEN_PATH, {
        method: "POST",
        credentials: "omit",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, token, sessionId: proofSessionId }),
      });
      const payload = await response.json() as OperatorResponse;
      setStatus(formatOperatorResponse(payload, response.status));
    } catch {
      setStatus("Échec du pont opérateur.");
    }
  }, [getToken, proofSessionId, role]);

  if (!import.meta.env.DEV) {
    return <main>Unavailable.</main>;
  }

  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem", fontFamily: "sans-serif" }}>
      <h1>MCP safe-summary — opérateur {role ?? "?"}</h1>
      <p>{status}</p>
      {operatorBHref ? (
        <p>
          <a href={operatorBHref}>Ouvrir ou copier le lien opérateur B</a>
        </p>
      ) : null}
      <button type="button" onClick={() => void submit()} disabled={!role || !proofSessionId}>
        Envoyer la preuve éphémère
      </button>
    </main>
  );
}

function formatOperatorResponse(payload: OperatorResponse, httpStatus: number): string {
  const status = typeof payload.status === "string" ? payload.status : `HTTP ${httpStatus}`;
  const reason = typeof payload.reason === "string" ? ` (${payload.reason})` : "";
  const proof = isRecord(payload.proof) ? payload.proof : undefined;
  const sequence = proof && isRecord(proof.sequence)
    ? proof.sequence
    : isRecord(payload.sequence)
      ? payload.sequence
      : undefined;
  if (!sequence) return `${status}${reason}`;
  const completed = typeof payload.completed === "boolean" ? payload.completed : "unknown";
  const sequenceCompleted = typeof payload.sequenceCompleted === "boolean"
    ? payload.sequenceCompleted
    : "unknown";
  const protectedCalls = readNumber(sequence.protectedCallCount);
  const seedCount = readNumber(sequence.seedCount);
  const cleanupCount = readNumber(sequence.cleanupCount);
  const recovery = readString(sequence.recovery);
  const baseline = readString(sequence.baseline);
  const postSeedDelta = readString(sequence.postSeedDelta);
  const staticProof = proof && isRecord(proof.staticProof) ? readString(proof.staticProof.kind) : undefined;
  const firstCall = formatMcpSafeSummaryFirstToolsCallDiagnostic(sequence.firstToolsCallDiagnostic);
  const deltaDiagnostic = formatMcpSafeSummaryPostSeedDeltaDiagnostic(sequence.postSeedDiagnostic);
  return `${status}${reason} · completed=${completed} · sequenceCompleted=${sequenceCompleted} · protected=${protectedCalls ?? "?"}/8 · seed=${seedCount ?? "?"}/${MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT} · cleanup=${cleanupCount ?? "?"}/${MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT} · recovery=${recovery ?? "?"} · baseline=${baseline ?? "?"} · delta=${postSeedDelta ?? "?"} · static=${staticProof ?? "?"}${firstCall ? ` · firstCall=${firstCall}` : ""}${deltaDiagnostic ? ` · deltaDiagnostic=${deltaDiagnostic}` : ""}`;
}

export function formatMcpSafeSummaryFirstToolsCallDiagnostic(value: unknown): string | undefined {
  if (
    !isRecord(value) ||
    value.kind !== "mcp_safe_summary_first_tools_call_diagnostic" ||
    value.step !== "FIRST_TOOLS_CALL"
  ) {
    return undefined;
  }
  const failureKind = value.failureKind === "ROUTE_REJECTED" ||
    value.failureKind === "JSON_RPC_ERROR" ||
    value.failureKind === "RESULT_MALFORMED"
    ? value.failureKind
    : undefined;
  const httpStatus = readNumber(value.httpStatus);
  if (!failureKind || httpStatus === undefined || !Number.isInteger(httpStatus)) return undefined;
  const publicReason = readFirstToolsCallPublicReason(value.publicReason);
  const jsonRpcCode = readNumber(value.jsonRpcCode);
  return [
    failureKind,
    `HTTP_${httpStatus}`,
    ...(publicReason ? [publicReason] : []),
    ...(jsonRpcCode !== undefined && Number.isInteger(jsonRpcCode) ? [`JSONRPC_${jsonRpcCode}`] : []),
  ].join("/");
}

export function formatMcpSafeSummaryPostSeedDeltaDiagnostic(value: unknown): string | undefined {
  if (
    !isRecord(value) ||
    value.kind !== "mcp_safe_summary_post_seed_delta_diagnostic" ||
    value.step !== "POST_SEED_DELTA" ||
    value.safeForLogging !== true
  ) {
    return undefined;
  }
  const check = readPostSeedDeltaCheck(value.check);
  if (!check) return undefined;

  const role = value.role === "A" || value.role === "B" ? value.role : undefined;
  const toolName = readPostSeedDeltaToolName(value.toolName);
  if (check === "SNAPSHOT_SHAPE" && (!role || !toolName)) return check;
  if (!role || !toolName) return undefined;
  if (check !== "COUNT_DELTA") return `${check}/${role}/${toolName}`;

  const countKey = readPostSeedDeltaCountKey(toolName, value.countKey);
  const expected = readBoundedSafeCount(value.expected);
  const actual = readBoundedSafeCount(value.actual);
  if (!countKey || expected === undefined || actual === undefined) return undefined;
  return `${check}/${role}/${toolName}/${countKey}/expected_${expected}/actual_${actual}`;
}

function readPostSeedDeltaCheck(value: unknown): string | undefined {
  switch (value) {
    case "SNAPSHOT_SHAPE":
    case "UNEXPECTED_CHANGE":
    case "DERIVED_METADATA":
    case "COUNT_SHAPE":
    case "COUNT_DELTA":
    case "SAFE_FLAGS":
      return value;
    default:
      return undefined;
  }
}

function readPostSeedDeltaToolName(value: unknown): keyof typeof POST_SEED_DELTA_COUNT_KEYS | undefined {
  return typeof value === "string" && value in POST_SEED_DELTA_COUNT_KEYS
    ? value as keyof typeof POST_SEED_DELTA_COUNT_KEYS
    : undefined;
}

function readPostSeedDeltaCountKey(
  toolName: keyof typeof POST_SEED_DELTA_COUNT_KEYS,
  value: unknown,
): string | undefined {
  return typeof value === "string" && POST_SEED_DELTA_COUNT_KEYS[toolName].includes(value)
    ? value
    : undefined;
}

function readBoundedSafeCount(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 100
    ? Number(value)
    : undefined;
}

const POST_SEED_DELTA_COUNT_KEYS = Object.freeze({
  "twoweeks.application_package.summarize": Object.freeze([
    "packages", "artifacts", "provenanceLinks", "reviewItems", "warnings", "blockers",
  ]),
  "twoweeks.evidence_graph.summarize": Object.freeze([
    "sourceDocuments", "candidateFacts", "approvedFacts", "pendingFacts", "rejectedFacts",
    "restrictedEvidence", "archivedEvidence", "provenanceLinks", "evidenceMatches",
    "allowedClaims", "missingEvidence", "riskFlags", "staleSources", "warnings", "blockers",
  ]),
  "twoweeks.resume_variant_plan.summarize": Object.freeze([
    "plans", "planItems", "claimBackedItems", "missingInputItems", "reviewNeededItems",
    "acceptedItems", "rejectedItems", "blockedItems", "warnings", "blockers",
    "restrictedFactBlockers", "excludedFactBlockers", "artifactTextBlockers", "allowedClaims",
    "sourceFacts", "evidenceMatches", "demands", "riskFlags",
  ]),
  "twoweeks.review_cockpit.summarize": Object.freeze([
    "reviewContexts", "reviewRuns", "reviewArtifacts", "applicationPackages", "pendingReviews",
    "approvedReviews", "blockedReviews", "failedRuns", "blockedRuns", "blockedArtifacts",
    "blockedPackages", "missingReviewItems", "approvalNeeded", "staleInputs",
    "overLimitCollections",
  ]),
} as const);

function readFirstToolsCallPublicReason(value: unknown): string | undefined {
  switch (value) {
    case "dependency_unavailable":
    case "invalid_configuration":
    case "invalid_host":
    case "invalid_authorization_header":
    case "bearer_verification_caller_untrusted":
    case "bearer_verification_quota_denied":
    case "bearer_verification_failed":
    case "private_beta_gate_denied":
    case "launch_readiness_blocked":
      return value;
    default:
      return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readRole(search: string): McpSafeSummaryProofOperatorRole | undefined {
  const role = new URLSearchParams(search).get("role");
  return role === "A" || role === "B" ? role : undefined;
}

function readProofSessionId(search: string): string | undefined {
  return normalizeMcpSafeSummaryProofSessionId(
    new URLSearchParams(search).get("proofSession"),
  );
}

function buildOperatorHref(
  pathname: string,
  search: string,
  role: McpSafeSummaryProofOperatorRole,
  proofSessionId: string,
): string {
  const params = new URLSearchParams(search);
  params.set("role", role);
  params.set("proofSession", proofSessionId);
  return `${pathname}?${params.toString()}`;
}
