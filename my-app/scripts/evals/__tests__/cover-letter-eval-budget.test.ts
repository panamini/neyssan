import { describe, expect, it, vi } from "vitest";

import {
  CoverLetterEvalBudgetError,
  createCoverLetterEvalBudget,
  type CoverLetterEvalBudgetOptions,
} from "../cover-letter-eval-budget";

const liveBudgetOptions = {
  explicitLiveProviderOptIn: true,
  maxCalls: 3,
  maxRepairs: 2,
  maxUsd: 0.6,
  declaredMaxUsdPerCall: 0.2,
} satisfies CoverLetterEvalBudgetOptions;

describe("cover-letter evaluation live-call budget", () => {
  it.each([
    ["maxCalls", 0],
    ["maxCalls", -1],
    ["maxCalls", 1.5],
    ["maxCalls", Number.NaN],
    ["maxCalls", Number.POSITIVE_INFINITY],
    ["maxCalls", undefined],
    ["maxRepairs", -1],
    ["maxRepairs", 1.5],
    ["maxRepairs", Number.NaN],
    ["maxRepairs", Number.POSITIVE_INFINITY],
    ["maxRepairs", undefined],
    ["maxUsd", 0],
    ["maxUsd", -1],
    ["maxUsd", Number.NaN],
    ["maxUsd", Number.POSITIVE_INFINITY],
    ["maxUsd", undefined],
    ["declaredMaxUsdPerCall", 0],
    ["declaredMaxUsdPerCall", -1],
    ["declaredMaxUsdPerCall", Number.NaN],
    ["declaredMaxUsdPerCall", Number.POSITIVE_INFINITY],
    ["declaredMaxUsdPerCall", undefined],
  ] as const)("rejects invalid limit %s=%s", (field, value) => {
    expect(() =>
      createCoverLetterEvalBudget({
        ...liveBudgetOptions,
        [field]: value,
      }),
    ).toThrowError(CoverLetterEvalBudgetError);
  });

  it("rejects a provider callback when live execution lacks explicit opt-in", async () => {
    const budget = createCoverLetterEvalBudget({
      maxCalls: 3,
      maxRepairs: 2,
      maxUsd: 0.6,
      declaredMaxUsdPerCall: 0.2,
    });
    const providerCall = vi.fn().mockResolvedValue("should not run");

    await expect(
      budget.beginWriterAttempt().runProviderCall(providerCall),
    ).rejects.toMatchObject({ code: "live_provider_calls_disabled" });

    expect(providerCall).not.toHaveBeenCalled();
    expect(budget.snapshot().usage).toEqual({
      reservedCalls: 0,
      reservedRepairs: 0,
      reservedUsd: 0,
    });
  });

  it("reserves every provider call and counts later calls in one writer attempt as repairs", async () => {
    const budget = createCoverLetterEvalBudget(liveBudgetOptions);
    const firstAttempt = budget.beginWriterAttempt();

    await expect(
      firstAttempt.runProviderCall(async () => "initial"),
    ).resolves.toBe("initial");
    await expect(
      firstAttempt.runProviderCall(async () => "repair"),
    ).resolves.toBe("repair");
    await expect(
      budget
        .beginWriterAttempt()
        .runProviderCall(async () => "next-attempt-initial"),
    ).resolves.toBe("next-attempt-initial");

    expect(budget.snapshot()).toMatchObject({
      liveProviderCallsEnabled: true,
      usage: {
        reservedCalls: 3,
        reservedRepairs: 1,
        reservedUsd: 0.6,
      },
      usdReservationBasis:
        "declared_max_usd_per_call_ceiling_not_observed_billing",
    });
  });

  it("keeps a failed provider invocation reserved and counts the next writer call as a repair", async () => {
    const budget = createCoverLetterEvalBudget(liveBudgetOptions);
    const attempt = budget.beginWriterAttempt();

    await expect(
      attempt.runProviderCall(async () => {
        throw new Error("provider failed after invocation");
      }),
    ).rejects.toThrow("provider failed after invocation");
    await attempt.runProviderCall(async () => "repair after provider failure");

    expect(budget.snapshot().usage).toEqual({
      reservedCalls: 2,
      reservedRepairs: 1,
      reservedUsd: 0.4,
    });
  });

  it("rejects before network activity when the call cap would be exceeded", async () => {
    const budget = createCoverLetterEvalBudget({
      ...liveBudgetOptions,
      maxCalls: 1,
      maxUsd: 10,
      declaredMaxUsdPerCall: 1,
    });
    await budget
      .beginWriterAttempt()
      .runProviderCall(async () => "only allowed call");
    const rejectedProviderCall = vi.fn().mockResolvedValue("must not run");
    const beforeRejection = budget.snapshot();

    await expect(
      budget.beginWriterAttempt().runProviderCall(rejectedProviderCall),
    ).rejects.toMatchObject({ code: "call_limit_exceeded" });

    expect(rejectedProviderCall).not.toHaveBeenCalled();
    expect(budget.snapshot()).toEqual(beforeRejection);
  });

  it("rejects before network activity when the repair cap would be exceeded", async () => {
    const budget = createCoverLetterEvalBudget({
      ...liveBudgetOptions,
      maxCalls: 3,
      maxRepairs: 1,
      maxUsd: 10,
      declaredMaxUsdPerCall: 1,
    });
    const attempt = budget.beginWriterAttempt();
    await attempt.runProviderCall(async () => "initial");
    await attempt.runProviderCall(async () => "first repair");
    const rejectedProviderCall = vi.fn().mockResolvedValue("must not run");
    const beforeRejection = budget.snapshot();

    await expect(
      attempt.runProviderCall(rejectedProviderCall),
    ).rejects.toMatchObject({ code: "repair_limit_exceeded" });

    expect(rejectedProviderCall).not.toHaveBeenCalled();
    expect(budget.snapshot()).toEqual(beforeRejection);
  });

  it("allows maxRepairs=0 to reject the second writer call before network activity", async () => {
    const budget = createCoverLetterEvalBudget({
      ...liveBudgetOptions,
      maxCalls: 2,
      maxRepairs: 0,
      maxUsd: 2,
      declaredMaxUsdPerCall: 1,
    });
    const attempt = budget.beginWriterAttempt();
    await attempt.runProviderCall(async () => "initial");
    const rejectedProviderCall = vi.fn().mockResolvedValue("must not run");
    const beforeRejection = budget.snapshot();

    await expect(
      attempt.runProviderCall(rejectedProviderCall),
    ).rejects.toMatchObject({ code: "repair_limit_exceeded" });

    expect(rejectedProviderCall).not.toHaveBeenCalled();
    expect(budget.snapshot()).toEqual(beforeRejection);
  });

  it("rejects before network activity when declared USD reservations would exceed the cap", async () => {
    const budget = createCoverLetterEvalBudget({
      ...liveBudgetOptions,
      maxCalls: 3,
      maxRepairs: 2,
      maxUsd: 0.5,
      declaredMaxUsdPerCall: 0.3,
    });
    await budget
      .beginWriterAttempt()
      .runProviderCall(async () => "reserved at declared ceiling");
    const rejectedProviderCall = vi.fn().mockResolvedValue("must not run");
    const beforeRejection = budget.snapshot();

    await expect(
      budget.beginWriterAttempt().runProviderCall(rejectedProviderCall),
    ).rejects.toMatchObject({ code: "reserved_usd_limit_exceeded" });

    expect(rejectedProviderCall).not.toHaveBeenCalled();
    expect(budget.snapshot()).toEqual(beforeRejection);
  });

  it("returns a deeply frozen snapshot whose USD values are reservations, not observed billing", async () => {
    const budget = createCoverLetterEvalBudget(liveBudgetOptions);
    await budget
      .beginWriterAttempt()
      .runProviderCall(async () => "provider result");

    const snapshot = budget.snapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.limits)).toBe(true);
    expect(Object.isFrozen(snapshot.usage)).toBe(true);
    expect(snapshot.limits.declaredMaxUsdPerCall).toBe(0.2);
    expect(snapshot.usage.reservedUsd).toBe(0.2);
    expect(snapshot.usdReservationBasis).toBe(
      "declared_max_usd_per_call_ceiling_not_observed_billing",
    );
    expect(() => {
      (snapshot.usage as { reservedCalls: number }).reservedCalls = 99;
    }).toThrow(TypeError);
    expect(budget.snapshot().usage.reservedCalls).toBe(1);
  });
});
