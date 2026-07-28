import type { McpSafeSummaryProofOperatorRole } from "./mcpSafeSummaryProofOperatorContract";

export type McpSafeSummaryProofSessionTimerPort = Readonly<{
  set: (callback: () => void, delayMs: number) => unknown;
  clear: (handle: unknown) => void;
}>;

type OperatorCredentials = Partial<Record<McpSafeSummaryProofOperatorRole, string>>;
type OperatorIdentityKeys = Partial<Record<McpSafeSummaryProofOperatorRole, string>>;

export type McpSafeSummaryProofRunLease = Readonly<{
  release: () => void;
}>;

export type McpSafeSummaryProofSessionRegistration =
  | Readonly<{ kind: "waiting" }>
  | Readonly<{ kind: "busy" }>
  | Readonly<{ kind: "capacity" }>
  | Readonly<{ kind: "duplicate_role" }>
  | Readonly<{ kind: "duplicate_token" }>
  | Readonly<{ kind: "duplicate_identity" }>
  | Readonly<{
    kind: "ready";
    credentials: Readonly<Record<McpSafeSummaryProofOperatorRole, string>>;
    lease: McpSafeSummaryProofRunLease;
  }>;

export type McpSafeSummaryProofRunAcquisition =
  | Readonly<{ kind: "busy" }>
  | Readonly<{ kind: "acquired"; lease: McpSafeSummaryProofRunLease }>;

export type McpSafeSummaryProofSessionCoordinator = Readonly<{
  registerAuthenticated: (
    sessionId: string,
    role: McpSafeSummaryProofOperatorRole,
    token: string,
    identityKey: string,
  ) => McpSafeSummaryProofSessionRegistration;
  tryAcquireRun: () => McpSafeSummaryProofRunAcquisition;
  snapshot: () => Readonly<{
    activeRun: boolean;
    pendingSessionCount: number;
  }>;
}>;

type PendingSession = Readonly<{
  credentials: OperatorCredentials;
  identityKeys: OperatorIdentityKeys;
  expiryKey: symbol;
  timerHandle: unknown;
}>;

const DEFAULT_SESSION_TTL_MS = 60_000;
const DEFAULT_MAX_PENDING_SESSIONS = 8;
const DEFAULT_TIMER: McpSafeSummaryProofSessionTimerPort = Object.freeze({
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
});

export function createMcpSafeSummaryProofSessionCoordinator(
  options: Readonly<{
    sessionTtlMs?: number;
    maxPendingSessions?: number;
    timer?: McpSafeSummaryProofSessionTimerPort;
  }> = {},
): McpSafeSummaryProofSessionCoordinator {
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const maxPendingSessions =
    options.maxPendingSessions ?? DEFAULT_MAX_PENDING_SESSIONS;
  const timer = options.timer ?? DEFAULT_TIMER;
  const pendingSessions = new Map<string, PendingSession>();
  let activeLeaseKey: symbol | undefined;

  const acquireRun = (): McpSafeSummaryProofRunAcquisition => {
    if (activeLeaseKey) return Object.freeze({ kind: "busy" as const });
    const leaseKey = Symbol("mcp-safe-summary-proof-run");
    activeLeaseKey = leaseKey;
    return Object.freeze({
      kind: "acquired" as const,
      lease: Object.freeze({
        release: () => {
          if (activeLeaseKey === leaseKey) activeLeaseKey = undefined;
        },
      }),
    });
  };

  const registerAuthenticated = (
    sessionId: string,
    role: McpSafeSummaryProofOperatorRole,
    token: string,
    identityKey: string,
  ): McpSafeSummaryProofSessionRegistration => {
    if (activeLeaseKey) return Object.freeze({ kind: "busy" as const });

    const pending = pendingSessions.get(sessionId);
    if (!pending && pendingSessions.size >= maxPendingSessions) {
      return Object.freeze({ kind: "capacity" as const });
    }
    if (pending?.credentials[role]) {
      return Object.freeze({ kind: "duplicate_role" as const });
    }
    const otherRole = role === "A" ? "B" : "A";
    if (pending?.credentials[otherRole] === token) {
      return Object.freeze({ kind: "duplicate_token" as const });
    }
    if (pending?.identityKeys[otherRole] === identityKey) {
      return Object.freeze({ kind: "duplicate_identity" as const });
    }

    const nextCredentials = Object.freeze({
      ...(pending?.credentials ?? {}),
      [role]: token,
    }) as OperatorCredentials;
    const nextIdentityKeys = Object.freeze({
      ...(pending?.identityKeys ?? {}),
      [role]: identityKey,
    }) as OperatorIdentityKeys;
    const credentialA = nextCredentials.A;
    const credentialB = nextCredentials.B;
    if (!credentialA || !credentialB) {
      const expiryKey = Symbol("mcp-safe-summary-proof-session-expiry");
      const timerHandle = timer.set(() => {
        const current = pendingSessions.get(sessionId);
        if (current?.expiryKey === expiryKey) pendingSessions.delete(sessionId);
      }, sessionTtlMs);
      pendingSessions.set(sessionId, Object.freeze({
        credentials: nextCredentials,
        identityKeys: nextIdentityKeys,
        expiryKey,
        timerHandle,
      }));
      return Object.freeze({ kind: "waiting" as const });
    }

    if (pending) timer.clear(pending.timerHandle);
    pendingSessions.delete(sessionId);
    const acquired = acquireRun();
    if (acquired.kind !== "acquired") {
      throw new Error("mcp_safe_summary_proof_run_lease_invariant");
    }
    return Object.freeze({
      kind: "ready" as const,
      credentials: Object.freeze({ A: credentialA, B: credentialB }),
      lease: acquired.lease,
    });
  };

  return Object.freeze({
    registerAuthenticated,
    tryAcquireRun: acquireRun,
    snapshot: () => Object.freeze({
      activeRun: activeLeaseKey !== undefined,
      pendingSessionCount: pendingSessions.size,
    }),
  });
}
