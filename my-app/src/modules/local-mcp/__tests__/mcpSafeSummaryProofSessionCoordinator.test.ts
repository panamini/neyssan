import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMcpSafeSummaryProofSessionCoordinator,
  type McpSafeSummaryProofSessionTimerPort,
} from "../mcpSafeSummaryProofSessionCoordinator";

const TOKEN_A_1 = "operator-a-session-one";
const TOKEN_A_2 = "operator-a-session-two";
const TOKEN_B_1 = "operator-b-session-one";
const TOKEN_B_2 = "operator-b-session-two";
const IDENTITY_A_1 = "issuer.example\u0000subject-a-one";
const IDENTITY_A_2 = "issuer.example\u0000subject-a-two";
const IDENTITY_B_1 = "issuer.example\u0000subject-b-one";
const IDENTITY_B_2 = "issuer.example\u0000subject-b-two";

afterEach(() => {
  vi.useRealTimers();
});

describe("MCP safe-summary proof session coordinator", () => {
  it("never cross-pairs sessions and grants exactly one run lease", () => {
    const coordinator = createMcpSafeSummaryProofSessionCoordinator();

    expect(coordinator.registerAuthenticated("proof-session-one", "A", TOKEN_A_1, IDENTITY_A_1).kind)
      .toBe("waiting");
    expect(coordinator.registerAuthenticated("proof-session-two", "A", TOKEN_A_2, IDENTITY_A_2).kind)
      .toBe("waiting");

    const first = coordinator.registerAuthenticated(
      "proof-session-one",
      "B",
      TOKEN_B_1,
      IDENTITY_B_1,
    );
    expect(first).toMatchObject({
      kind: "ready",
      credentials: { A: TOKEN_A_1, B: TOKEN_B_1 },
    });
    expect(coordinator.registerAuthenticated("proof-session-two", "B", TOKEN_B_2, IDENTITY_B_2).kind)
      .toBe("busy");
    expect(coordinator.snapshot()).toEqual({
      activeRun: true,
      pendingSessionCount: 1,
    });

    if (first.kind !== "ready") throw new Error("expected ready session");
    first.lease.release();

    const second = coordinator.registerAuthenticated(
      "proof-session-two",
      "B",
      TOKEN_B_2,
      IDENTITY_B_2,
    );
    expect(second).toMatchObject({
      kind: "ready",
      credentials: { A: TOKEN_A_2, B: TOKEN_B_2 },
    });
  });

  it("shares one lease between paired and standalone proof routes", () => {
    const coordinator = createMcpSafeSummaryProofSessionCoordinator();
    const standalone = coordinator.tryAcquireRun();
    expect(standalone.kind).toBe("acquired");
    expect(coordinator.registerAuthenticated("proof-session-one", "A", TOKEN_A_1, IDENTITY_A_1).kind)
      .toBe("busy");

    if (standalone.kind !== "acquired") throw new Error("expected standalone lease");
    standalone.lease.release();
    expect(coordinator.registerAuthenticated("proof-session-one", "A", TOKEN_A_1, IDENTITY_A_1).kind)
      .toBe("waiting");
  });

  it("rejects duplicate roles and duplicate A/B tokens without consuming the pair", () => {
    const coordinator = createMcpSafeSummaryProofSessionCoordinator();

    expect(coordinator.registerAuthenticated("proof-session-one", "A", TOKEN_A_1, IDENTITY_A_1).kind)
      .toBe("waiting");
    expect(coordinator.registerAuthenticated("proof-session-one", "A", TOKEN_A_2, IDENTITY_A_2).kind)
      .toBe("duplicate_role");
    expect(coordinator.registerAuthenticated("proof-session-one", "B", TOKEN_A_1, IDENTITY_B_1).kind)
      .toBe("duplicate_token");
    expect(coordinator.registerAuthenticated("proof-session-one", "B", TOKEN_B_1, IDENTITY_A_1).kind)
      .toBe("duplicate_identity");
    expect(coordinator.snapshot()).toEqual({
      activeRun: false,
      pendingSessionCount: 1,
    });

    const ready = coordinator.registerAuthenticated(
      "proof-session-one",
      "B",
      TOKEN_B_1,
      IDENTITY_B_1,
    );
    expect(ready).toMatchObject({
      kind: "ready",
      credentials: { A: TOKEN_A_1, B: TOKEN_B_1 },
    });
  });

  it("caps new sessions while allowing an existing session to complete", () => {
    const coordinator = createMcpSafeSummaryProofSessionCoordinator({
      maxPendingSessions: 8,
    });
    for (let index = 0; index < 8; index += 1) {
      expect(coordinator.registerAuthenticated(
        `proof-session-${index}`,
        "A",
        `operator-a-${index}`,
        `issuer.example\u0000subject-a-${index}`,
      ).kind).toBe("waiting");
    }

    expect(coordinator.registerAuthenticated(
      "proof-session-nine",
      "A",
      "operator-a-nine",
      "issuer.example\u0000subject-a-nine",
    ).kind)
      .toBe("capacity");
    const ready = coordinator.registerAuthenticated(
      "proof-session-0",
      "B",
      TOKEN_B_1,
      IDENTITY_B_1,
    );
    expect(ready.kind).toBe("ready");
  });

  it("ignores a stale timer and removes credentials on ready and expiry", () => {
    const scheduled: Array<{
      callback: () => void;
      cancelled: boolean;
    }> = [];
    const timer: McpSafeSummaryProofSessionTimerPort = {
      set(callback) {
        const handle = { callback, cancelled: false };
        scheduled.push(handle);
        return handle;
      },
      clear(handle) {
        (handle as { cancelled: boolean }).cancelled = true;
      },
    };
    const coordinator = createMcpSafeSummaryProofSessionCoordinator({ timer });

    expect(coordinator.registerAuthenticated("proof-session-one", "A", TOKEN_A_1, IDENTITY_A_1).kind)
      .toBe("waiting");
    const firstTimer = scheduled[0];
    const ready = coordinator.registerAuthenticated(
      "proof-session-one",
      "B",
      TOKEN_B_1,
      IDENTITY_B_1,
    );
    expect(ready.kind).toBe("ready");
    expect(coordinator.snapshot().pendingSessionCount).toBe(0);
    if (ready.kind !== "ready") throw new Error("expected ready session");
    ready.lease.release();

    expect(coordinator.registerAuthenticated("proof-session-one", "A", TOKEN_A_2, IDENTITY_A_2).kind)
      .toBe("waiting");
    firstTimer.callback();
    expect(coordinator.snapshot().pendingSessionCount).toBe(1);

    const currentTimer = scheduled[1];
    currentTimer.callback();
    expect(coordinator.snapshot()).toEqual({
      activeRun: false,
      pendingSessionCount: 0,
    });
  });

  it("releases the run lease after an execution throws", () => {
    const coordinator = createMcpSafeSummaryProofSessionCoordinator();
    const acquired = coordinator.tryAcquireRun();
    expect(acquired.kind).toBe("acquired");

    expect(() => {
      try {
        throw new Error("runner failed");
      } finally {
        if (acquired.kind === "acquired") acquired.lease.release();
      }
    }).toThrow("runner failed");

    expect(coordinator.snapshot().activeRun).toBe(false);
    expect(coordinator.tryAcquireRun().kind).toBe("acquired");
  });
});
