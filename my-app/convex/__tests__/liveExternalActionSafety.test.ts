import { describe, expect, it, vi } from "vitest";
import liveExternalActionSafetySource from "../liveExternalActionSafety.ts?raw";
import {
  finalizeExternalAction,
  markExternalActionDispatching,
  readLiveExternalActionServerConfigStatus,
  reserveExternalAction,
} from "../liveExternalActionSafety";

type ExecutionState =
  | "reserved"
  | "dispatching"
  | "submitted"
  | "duplicate_accepted"
  | "rejected"
  | "submission_status_unknown";

type ExecutionRecord = {
  _id: string;
  _creationTime: number;
  idempotencyKeyHash: string;
  payloadFingerprint: string;
  integrationId: string;
  actionCategory: "apply_to_job";
  safeJobRef: string;
  state: ExecutionState;
  safeProviderReceiptRef?: string;
  safeFailureCode?: string;
  createdAt: number;
  updatedAt: number;
  version: 1;
};

const IDEMPOTENCY_HASH = "a".repeat(64);
const PAYLOAD_FINGERPRINT = "b".repeat(64);
const OTHER_PAYLOAD_FINGERPRINT = "c".repeat(64);
const INTEGRATION_ID = "ats_authorization_pending_v1";
const SAFE_JOB_REF = "mcp-safe-ref:job-target:authorized-job-1";

function baseRecord(
  overrides: Partial<ExecutionRecord> = {},
): ExecutionRecord {
  return {
    _id: "live_external_action_1",
    _creationTime: 1,
    idempotencyKeyHash: IDEMPOTENCY_HASH,
    payloadFingerprint: PAYLOAD_FINGERPRINT,
    integrationId: INTEGRATION_ID,
    actionCategory: "apply_to_job",
    safeJobRef: SAFE_JOB_REF,
    state: "reserved",
    createdAt: 1000,
    updatedAt: 1000,
    version: 1,
    ...overrides,
  };
}

function reserveArgs(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKeyHash: IDEMPOTENCY_HASH,
    payloadFingerprint: PAYLOAD_FINGERPRINT,
    integrationId: INTEGRATION_ID,
    actionCategory: "apply_to_job",
    safeJobRef: SAFE_JOB_REF,
    now: 2000,
    ...overrides,
  };
}

function markArgs(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKeyHash: IDEMPOTENCY_HASH,
    payloadFingerprint: PAYLOAD_FINGERPRINT,
    now: 3000,
    ...overrides,
  };
}

function finalizeArgs(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKeyHash: IDEMPOTENCY_HASH,
    payloadFingerprint: PAYLOAD_FINGERPRINT,
    finalState: "submitted",
    safeProviderReceiptRef: "mcp-safe-ref:external-action-receipt:app-123",
    now: 4000,
    ...overrides,
  };
}

function makeCtx(initialRecords: ExecutionRecord[] = []) {
  const records = [...initialRecords];
  const insert = vi.fn(async (_table: string, doc: Omit<ExecutionRecord, "_id" | "_creationTime">) => {
    const id = `live_external_action_${records.length + 1}`;
    records.push({ _id: id, _creationTime: 1, ...doc });
    return id;
  });
  const patch = vi.fn(async (id: string, patchDoc: Partial<ExecutionRecord>) => {
    const record = records.find((item) => item._id === id);
    if (!record) throw new Error("record not found");
    Object.assign(record, patchDoc);
  });
  const query = vi.fn((_table: string) => ({
    withIndex: (
      _indexName: string,
      buildQuery: (q: {
        eq: (fieldName: "idempotencyKeyHash", value: string) => unknown;
      }) => unknown,
    ) => {
      let idempotencyKeyHash = "";
      const q = {
        eq: (_fieldName: "idempotencyKeyHash", value: string) => {
          idempotencyKeyHash = value;
          return q;
        },
      };
      buildQuery(q);
      return {
        unique: vi.fn(async () =>
          records.find((item) => item.idempotencyKeyHash === idempotencyKeyHash) ??
          null,
        ),
      };
    },
  }));

  return {
    ctx: { db: { insert, patch, query } },
    insert,
    patch,
    records,
  };
}

describe("live external action safety foundation", () => {
  it("reserves a new durable idempotency key with safe metadata only", async () => {
    const { ctx, insert, records } = makeCtx();

    const result = await reserveExternalAction._handler(ctx as any, reserveArgs());

    expect(result).toMatchObject({
      outcome: "reserved",
      canDispatch: true,
      state: "reserved",
    });
    expect(insert).toHaveBeenCalledOnce();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      idempotencyKeyHash: IDEMPOTENCY_HASH,
      payloadFingerprint: PAYLOAD_FINGERPRINT,
      integrationId: INTEGRATION_ID,
      actionCategory: "apply_to_job",
      safeJobRef: SAFE_JOB_REF,
      state: "reserved",
      version: 1,
    });
    expect(Object.keys(records[0]).sort()).toEqual(
      [
        "_creationTime",
        "_id",
        "actionCategory",
        "createdAt",
        "idempotencyKeyHash",
        "integrationId",
        "payloadFingerprint",
        "safeJobRef",
        "state",
        "updatedAt",
        "version",
      ].sort(),
    );
  });

  it("returns an existing same-key same-fingerprint reservation without replacing it", async () => {
    const { ctx, insert } = makeCtx([baseRecord()]);

    const result = await reserveExternalAction._handler(ctx as any, reserveArgs());

    expect(result).toMatchObject({
      outcome: "existing",
      state: "reserved",
      canDispatch: true,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("reports idempotency conflict for the same key with different material", async () => {
    const { ctx, insert, patch } = makeCtx([baseRecord()]);

    const result = await reserveExternalAction._handler(
      ctx as any,
      reserveArgs({ payloadFingerprint: OTHER_PAYLOAD_FINGERPRINT }),
    );

    expect(result).toMatchObject({
      outcome: "idempotency_conflict",
      state: "reserved",
      canDispatch: false,
    });
    expect(insert).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it("prevents redispatch for submitted, dispatching, and unknown-status records", async () => {
    for (const state of [
      "submitted",
      "dispatching",
      "submission_status_unknown",
    ] satisfies ExecutionState[]) {
      const { ctx, patch } = makeCtx([baseRecord({ state })]);

      const reserve = await reserveExternalAction._handler(ctx as any, reserveArgs());
      const mark = await markExternalActionDispatching._handler(
        ctx as any,
        markArgs(),
      );

      expect(reserve).toMatchObject({
        outcome: "existing",
        state,
        canDispatch: false,
      });
      expect(mark).toMatchObject({
        outcome: "dispatch_blocked",
        state,
        canDispatch: false,
      });
      expect(patch).not.toHaveBeenCalled();
    }
  });

  it("marks a reserved record dispatching immediately before dispatch", async () => {
    const { ctx, patch, records } = makeCtx([baseRecord()]);

    const result = await markExternalActionDispatching._handler(
      ctx as any,
      markArgs(),
    );

    expect(result).toMatchObject({
      outcome: "dispatching",
      state: "dispatching",
      canDispatch: true,
    });
    expect(patch).toHaveBeenCalledWith("live_external_action_1", {
      state: "dispatching",
      updatedAt: 3000,
    });
    expect(records[0].state).toBe("dispatching");
  });

  it("finalizes only a dispatching record into an allowed terminal state", async () => {
    const { ctx, patch, records } = makeCtx([
      baseRecord({ state: "dispatching" }),
    ]);

    const result = await finalizeExternalAction._handler(
      ctx as any,
      finalizeArgs(),
    );

    expect(result).toMatchObject({
      outcome: "finalized",
      state: "submitted",
      canFinalize: true,
    });
    expect(patch).toHaveBeenCalledWith("live_external_action_1", {
      state: "submitted",
      safeProviderReceiptRef: "mcp-safe-ref:external-action-receipt:app-123",
      updatedAt: 4000,
    });
    expect(records[0].state).toBe("submitted");
  });

  it("blocks finalization when the record was never marked dispatching", async () => {
    const { ctx, patch } = makeCtx([baseRecord({ state: "reserved" })]);

    const result = await finalizeExternalAction._handler(
      ctx as any,
      finalizeArgs(),
    );

    expect(result).toMatchObject({
      outcome: "finalize_blocked",
      state: "reserved",
      canFinalize: false,
    });
    expect(patch).not.toHaveBeenCalled();
  });

  it("defaults the live external action feature flag off and treats malformed values as off", () => {
    expect(readLiveExternalActionServerConfigStatus({}).enabled).toBe(false);
    expect(
      readLiveExternalActionServerConfigStatus({
        TWOWEEKS_LIVE_EXTERNAL_ACTIONS_ENABLED: "1",
      }).enabled,
    ).toBe(false);
    expect(
      readLiveExternalActionServerConfigStatus({
        TWOWEEKS_LIVE_EXTERNAL_ACTIONS_ENABLED: "true",
      }),
    ).toMatchObject({
      enabled: true,
      configured: false,
      status: "provider_authorization_required",
      valuesExposed: false,
      credentialStorage: "none",
      tokenStorage: "none",
    });
  });

  it("reports missing provider authorization without exposing credential values", () => {
    const status = readLiveExternalActionServerConfigStatus({
      TWOWEEKS_LIVE_EXTERNAL_ACTIONS_ENABLED: "true",
    });

    expect(status).toMatchObject({
      enabled: true,
      configured: false,
      status: "provider_authorization_required",
      valuesExposed: false,
    });
    expect(status.missingConfiguration).toEqual([
      "provider_authorization",
      "provider_credentials",
      "test_tenant",
      "test_posting",
    ]);
    expect(JSON.stringify(status)).not.toContain("server-only");
  });

  it("fails closed for hostile input and stores no raw application data", async () => {
    const { ctx, insert } = makeCtx();

    await expect(
      reserveExternalAction._handler(
        ctx as any,
        reserveArgs({
          safeJobRef: "mcp-safe-ref:job-target:alex@example.com",
        }),
      ),
    ).rejects.toThrow(/Invalid live external action execution input/);
    await expect(
      reserveExternalAction._handler(
        ctx as any,
        reserveArgs({
          rawApplicationPayload: "RAW_APP_TEXT_SENTINEL_DO_NOT_EXPOSE",
        }),
      ),
    ).rejects.toThrow(/Invalid live external action execution input/);
    expect(insert).not.toHaveBeenCalled();
  });

  it("contains no provider transport or provider-specific live API call path", () => {
    expect(liveExternalActionSafetySource).not.toMatch(
      /\b(fetch|axios|undici|XMLHttpRequest|WebSocket|EventSource)\b/u,
    );
    expect(liveExternalActionSafetySource).not.toMatch(
      /api\.lever\.co|api\.smartrecruiters\.com|ashby|teamtailor|greenhouse|\/v1\/postings|\/v1\/uploads|Authorization|Basic\s/u,
    );
  });
});
