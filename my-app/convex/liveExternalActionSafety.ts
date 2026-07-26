import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import {
  liveExternalActionCategoryValidator,
  liveExternalActionFinalStateValidator,
  liveExternalActionIntegrationIdValidator,
  liveExternalActionStateValidator,
  liveExternalActionStoredExecutionValidator,
} from "./lib/liveExternalActionSafety";

const CURRENT_VERSION = 1;
const LIVE_EXTERNAL_ACTION_CATEGORY = "apply_to_job" as const;
const LIVE_EXTERNAL_ACTIONS_ENABLED_FLAG =
  "TWOWEEKS_LIVE_EXTERNAL_ACTIONS_ENABLED" as const;
const PROVIDER_ACCESS_BLOCKERS = [
  "provider_authorization",
  "provider_credentials",
  "test_tenant",
  "test_posting",
] as const;

const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_INTEGRATION_ID_PATTERN = /^[a-z][a-z0-9_]{1,80}$/u;
const SAFE_JOB_REF_PATTERN = /^mcp-safe-ref:job-target:[A-Za-z0-9][A-Za-z0-9._:-]{0,160}$/u;
const SAFE_RECEIPT_REF_PATTERN =
  /^mcp-safe-ref:external-action-receipt:[A-Za-z0-9][A-Za-z0-9._:-]{0,160}$/u;
const SAFE_FAILURE_CODE_PATTERN = /^[a-z][a-z0-9_]{1,80}$/u;
const UNSAFE_TEXT_PATTERN =
  /(?:@|Bearer|token|secret|cookie|raw|payload|candidate|resume|cover|answer|phone|email|address|PRIVATE_FACT|NEVER_USE|DO_NOT_EXPOSE)/iu;

const RESERVE_ARG_KEYS = [
  "idempotencyKeyHash",
  "payloadFingerprint",
  "integrationId",
  "actionCategory",
  "safeJobRef",
  "now",
] as const;

const MARK_ARG_KEYS = ["idempotencyKeyHash", "payloadFingerprint", "now"] as const;

const FINALIZE_ARG_KEYS = [
  "idempotencyKeyHash",
  "payloadFingerprint",
  "finalState",
  "safeProviderReceiptRef",
  "safeFailureCode",
  "now",
] as const;
const FINALIZE_REQUIRED_ARG_KEYS = [
  "idempotencyKeyHash",
  "payloadFingerprint",
  "finalState",
  "now",
] as const;

type LiveExternalActionIntegrationId = string;
type LiveExternalActionCategory = typeof LIVE_EXTERNAL_ACTION_CATEGORY;
type LiveExternalActionState =
  | "reserved"
  | "dispatching"
  | "submitted"
  | "duplicate_accepted"
  | "rejected"
  | "submission_status_unknown";
type LiveExternalActionFinalState = Exclude<
  LiveExternalActionState,
  "reserved" | "dispatching"
>;

type ReservationArgs = Readonly<{
  idempotencyKeyHash: string;
  payloadFingerprint: string;
  integrationId: LiveExternalActionIntegrationId;
  actionCategory: LiveExternalActionCategory;
  safeJobRef: string;
  now: number;
}>;

type MarkArgs = Readonly<{
  idempotencyKeyHash: string;
  payloadFingerprint: string;
  now: number;
}>;

type FinalizeArgs = Readonly<{
  idempotencyKeyHash: string;
  payloadFingerprint: string;
  finalState: LiveExternalActionFinalState;
  safeProviderReceiptRef?: string;
  safeFailureCode?: string;
  now: number;
}>;

const executionResultValidator = v.object({
  kind: v.literal("live_external_action_execution_result"),
  outcome: v.union(
    v.literal("reserved"),
    v.literal("existing"),
    v.literal("dispatching"),
    v.literal("finalized"),
    v.literal("idempotency_conflict"),
    v.literal("dispatch_blocked"),
    v.literal("finalize_blocked"),
    v.literal("not_found"),
  ),
  canDispatch: v.boolean(),
  canFinalize: v.boolean(),
  id: v.optional(v.id("liveExternalActionExecutions")),
  state: v.optional(liveExternalActionStateValidator),
  version: v.literal(1),
});

type LiveExternalActionStoredExecution = Infer<
  typeof liveExternalActionStoredExecutionValidator
>;
type LiveExternalActionExecutionResult = Infer<typeof executionResultValidator>;
type ProviderAccessBlocker = (typeof PROVIDER_ACCESS_BLOCKERS)[number];

export type LiveExternalActionSafeConfigStatus = Readonly<{
  kind: "live_external_action_server_config_status";
  integrationId: LiveExternalActionIntegrationId;
  actionCategory: LiveExternalActionCategory;
  featureFlagId: typeof LIVE_EXTERNAL_ACTIONS_ENABLED_FLAG;
  featureFlagVersion: 1;
  enabled: boolean;
  configured: false;
  status: "feature_disabled" | "provider_authorization_required";
  missingConfiguration: readonly ProviderAccessBlocker[];
  credentialStorage: "none";
  tokenStorage: "none";
  valuesExposed: false;
  version: 1;
}>;

export function readLiveExternalActionServerConfigStatus(
  env: Readonly<Record<string, string | undefined>> = process.env,
): LiveExternalActionSafeConfigStatus {
  const enabled = env[LIVE_EXTERNAL_ACTIONS_ENABLED_FLAG] === "true";

  return {
    kind: "live_external_action_server_config_status",
    integrationId: "ats_authorization_pending_v1",
    actionCategory: LIVE_EXTERNAL_ACTION_CATEGORY,
    featureFlagId: LIVE_EXTERNAL_ACTIONS_ENABLED_FLAG,
    featureFlagVersion: 1,
    enabled,
    configured: false,
    status: !enabled
      ? "feature_disabled"
      : "provider_authorization_required",
    missingConfiguration: enabled ? PROVIDER_ACCESS_BLOCKERS : [],
    credentialStorage: "none",
    tokenStorage: "none",
    valuesExposed: false,
    version: 1,
  };
}

export const reserveExternalAction = internalMutation({
  args: {
    idempotencyKeyHash: v.string(),
    payloadFingerprint: v.string(),
    integrationId: liveExternalActionIntegrationIdValidator,
    actionCategory: liveExternalActionCategoryValidator,
    safeJobRef: v.string(),
    now: v.number(),
  },
  returns: executionResultValidator,
  handler: async (ctx, args): Promise<LiveExternalActionExecutionResult> => {
    const parsed = parseReservationArgs(args);
    const existing = await getExecutionByIdempotencyKeyHash(
      ctx,
      parsed.idempotencyKeyHash,
    );

    if (!existing) {
      const id = await ctx.db.insert("liveExternalActionExecutions", {
        idempotencyKeyHash: parsed.idempotencyKeyHash,
        payloadFingerprint: parsed.payloadFingerprint,
        integrationId: parsed.integrationId,
        actionCategory: parsed.actionCategory,
        safeJobRef: parsed.safeJobRef,
        state: "reserved",
        createdAt: parsed.now,
        updatedAt: parsed.now,
        version: CURRENT_VERSION,
      });

      return executionResult("reserved", {
        id,
        state: "reserved",
        canDispatch: true,
      });
    }

    if (!recordMatchesReservation(existing, parsed)) {
      return executionResult("idempotency_conflict", {
        id: existing._id,
        state: existing.state,
      });
    }

    return executionResult("existing", {
      id: existing._id,
      state: existing.state,
      canDispatch: existing.state === "reserved",
    });
  },
});

export const markExternalActionDispatching = internalMutation({
  args: {
    idempotencyKeyHash: v.string(),
    payloadFingerprint: v.string(),
    now: v.number(),
  },
  returns: executionResultValidator,
  handler: async (ctx, args): Promise<LiveExternalActionExecutionResult> => {
    const parsed = parseMarkArgs(args);
    const existing = await getExecutionByIdempotencyKeyHash(
      ctx,
      parsed.idempotencyKeyHash,
    );

    if (!existing) {
      return executionResult("not_found", {});
    }
    if (existing.payloadFingerprint !== parsed.payloadFingerprint) {
      return executionResult("idempotency_conflict", {
        id: existing._id,
        state: existing.state,
      });
    }
    if (existing.state !== "reserved") {
      return executionResult("dispatch_blocked", {
        id: existing._id,
        state: existing.state,
      });
    }

    await ctx.db.patch(existing._id, {
      state: "dispatching",
      updatedAt: parsed.now,
    });

    return executionResult("dispatching", {
      id: existing._id,
      state: "dispatching",
      canDispatch: true,
    });
  },
});

export const finalizeExternalAction = internalMutation({
  args: {
    idempotencyKeyHash: v.string(),
    payloadFingerprint: v.string(),
    finalState: liveExternalActionFinalStateValidator,
    safeProviderReceiptRef: v.optional(v.string()),
    safeFailureCode: v.optional(v.string()),
    now: v.number(),
  },
  returns: executionResultValidator,
  handler: async (ctx, args): Promise<LiveExternalActionExecutionResult> => {
    const parsed = parseFinalizeArgs(args);
    const existing = await getExecutionByIdempotencyKeyHash(
      ctx,
      parsed.idempotencyKeyHash,
    );

    if (!existing) {
      return executionResult("not_found", {});
    }
    if (existing.payloadFingerprint !== parsed.payloadFingerprint) {
      return executionResult("idempotency_conflict", {
        id: existing._id,
        state: existing.state,
      });
    }
    if (existing.state !== "dispatching") {
      return executionResult("finalize_blocked", {
        id: existing._id,
        state: existing.state,
      });
    }

    await ctx.db.patch(existing._id, {
      state: parsed.finalState,
      ...(parsed.safeProviderReceiptRef
        ? { safeProviderReceiptRef: parsed.safeProviderReceiptRef }
        : {}),
      ...(parsed.safeFailureCode ? { safeFailureCode: parsed.safeFailureCode } : {}),
      updatedAt: parsed.now,
    });

    return executionResult("finalized", {
      id: existing._id,
      state: parsed.finalState,
      canFinalize: true,
    });
  },
});

export const getExternalActionByIdempotencyKeyHash = internalQuery({
  args: {
    idempotencyKeyHash: v.string(),
  },
  returns: v.union(v.null(), liveExternalActionStoredExecutionValidator),
  handler: async (ctx, args) => {
    assertSafeHash(args.idempotencyKeyHash, "idempotencyKeyHash");
    return await getExecutionByIdempotencyKeyHash(ctx, args.idempotencyKeyHash);
  },
});

async function getExecutionByIdempotencyKeyHash(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  idempotencyKeyHash: string,
): Promise<LiveExternalActionStoredExecution | null> {
  return await ctx.db
    .query("liveExternalActionExecutions")
    .withIndex("by_idempotency_key_hash", (q) =>
      q.eq("idempotencyKeyHash", idempotencyKeyHash),
    )
    .unique();
}

function parseReservationArgs(input: unknown): ReservationArgs {
  const record = readExactRecord(input, RESERVE_ARG_KEYS, RESERVE_ARG_KEYS);
  assertSafeHash(record.idempotencyKeyHash, "idempotencyKeyHash");
  assertSafeHash(record.payloadFingerprint, "payloadFingerprint");
  assertTimestamp(record.now);
  if (!isSafeIntegrationId(record.integrationId)) {
    throw new Error("Invalid live external action execution input");
  }
  if (record.actionCategory !== LIVE_EXTERNAL_ACTION_CATEGORY) {
    throw new Error("Invalid live external action execution input");
  }
  assertSafeJobRef(record.safeJobRef);
  return record as ReservationArgs;
}

function parseMarkArgs(input: unknown): MarkArgs {
  const record = readExactRecord(input, MARK_ARG_KEYS, MARK_ARG_KEYS);
  assertSafeHash(record.idempotencyKeyHash, "idempotencyKeyHash");
  assertSafeHash(record.payloadFingerprint, "payloadFingerprint");
  assertTimestamp(record.now);
  return record as MarkArgs;
}

function parseFinalizeArgs(input: unknown): FinalizeArgs {
  const record = readExactRecord(
    input,
    FINALIZE_ARG_KEYS,
    FINALIZE_REQUIRED_ARG_KEYS,
  );
  assertSafeHash(record.idempotencyKeyHash, "idempotencyKeyHash");
  assertSafeHash(record.payloadFingerprint, "payloadFingerprint");
  if (!isFinalState(record.finalState)) {
    throw new Error("Invalid live external action execution input");
  }
  if (
    record.safeProviderReceiptRef !== undefined &&
    !isSafeProviderReceiptRef(record.safeProviderReceiptRef)
  ) {
    throw new Error("Invalid live external action execution input");
  }
  if (
    record.safeFailureCode !== undefined &&
    !isSafeFailureCode(record.safeFailureCode)
  ) {
    throw new Error("Invalid live external action execution input");
  }
  assertTimestamp(record.now);
  return record as FinalizeArgs;
}

function recordMatchesReservation(
  existing: Readonly<{
    payloadFingerprint: string;
    integrationId: string;
    actionCategory: string;
    safeJobRef: string;
  }>,
  parsed: ReservationArgs,
): boolean {
  return (
    existing.payloadFingerprint === parsed.payloadFingerprint &&
    existing.integrationId === parsed.integrationId &&
    existing.actionCategory === parsed.actionCategory &&
    existing.safeJobRef === parsed.safeJobRef
  );
}

function executionResult(
  outcome:
    | "reserved"
    | "existing"
    | "dispatching"
    | "finalized"
    | "idempotency_conflict"
    | "dispatch_blocked"
    | "finalize_blocked"
    | "not_found",
  options: Readonly<{
    id?: LiveExternalActionExecutionResult["id"];
    state?: LiveExternalActionState;
    canDispatch?: boolean;
    canFinalize?: boolean;
  }>,
): LiveExternalActionExecutionResult {
  return {
    kind: "live_external_action_execution_result" as const,
    outcome,
    canDispatch: options.canDispatch ?? false,
    canFinalize: options.canFinalize ?? false,
    ...(options.id ? { id: options.id } : {}),
    ...(options.state ? { state: options.state } : {}),
    version: 1,
  };
}

function readExactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid live external action execution input");
  }
  const record = value as Record<string, unknown>;
  if (
    !Object.keys(record).every((key) => allowedKeys.includes(key)) ||
    !requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key))
  ) {
    throw new Error("Invalid live external action execution input");
  }
  return record;
}

function assertSafeHash(value: unknown, _fieldName: string): asserts value is string {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new Error("Invalid live external action execution input");
  }
}

function assertSafeJobRef(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !SAFE_JOB_REF_PATTERN.test(value) ||
    UNSAFE_TEXT_PATTERN.test(value)
  ) {
    throw new Error("Invalid live external action execution input");
  }
}

function assertTimestamp(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Invalid live external action execution input");
  }
}

function isFinalState(value: unknown): value is LiveExternalActionFinalState {
  return (
    value === "submitted" ||
    value === "duplicate_accepted" ||
    value === "rejected" ||
    value === "submission_status_unknown"
  );
}

function isSafeProviderReceiptRef(value: string): boolean {
  return SAFE_RECEIPT_REF_PATTERN.test(value) && !UNSAFE_TEXT_PATTERN.test(value);
}

function isSafeFailureCode(value: string): boolean {
  return SAFE_FAILURE_CODE_PATTERN.test(value) && !UNSAFE_TEXT_PATTERN.test(value);
}

function isSafeIntegrationId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    SAFE_INTEGRATION_ID_PATTERN.test(value) &&
    !UNSAFE_TEXT_PATTERN.test(value)
  );
}
