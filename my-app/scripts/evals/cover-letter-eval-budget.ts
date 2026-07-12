export const COVER_LETTER_EVAL_USD_RESERVATION_BASIS =
  "declared_max_usd_per_call_ceiling_not_observed_billing" as const;

export type CoverLetterEvalBudgetOptions = Readonly<{
  /** Must come from an explicit live-execution flag. Omission keeps live calls disabled. */
  explicitLiveProviderOptIn?: boolean;
  maxCalls: number;
  /** Set to zero to hard-disable model-assisted repair calls. */
  maxRepairs: number;
  maxUsd: number;
  /**
   * A caller-declared ceiling reserved before each provider call. This is not
   * observed or reconciled provider billing.
   */
  declaredMaxUsdPerCall: number;
}>;

export type CoverLetterEvalBudgetSnapshot = Readonly<{
  liveProviderCallsEnabled: boolean;
  limits: Readonly<{
    maxCalls: number;
    maxRepairs: number;
    maxUsd: number;
    declaredMaxUsdPerCall: number;
  }>;
  usage: Readonly<{
    reservedCalls: number;
    reservedRepairs: number;
    reservedUsd: number;
  }>;
  usdReservationBasis: typeof COVER_LETTER_EVAL_USD_RESERVATION_BASIS;
}>;

export type CoverLetterEvalBudgetErrorCode =
  | "invalid_budget_config"
  | "live_provider_calls_disabled"
  | "call_limit_exceeded"
  | "repair_limit_exceeded"
  | "reserved_usd_limit_exceeded";

export class CoverLetterEvalBudgetError extends Error {
  readonly code: CoverLetterEvalBudgetErrorCode;
  readonly snapshot?: CoverLetterEvalBudgetSnapshot;

  constructor(args: {
    code: CoverLetterEvalBudgetErrorCode;
    message: string;
    snapshot?: CoverLetterEvalBudgetSnapshot;
  }) {
    super(args.message);
    this.name = "CoverLetterEvalBudgetError";
    this.code = args.code;
    this.snapshot = args.snapshot;
  }
}

export type CoverLetterEvalWriterAttemptBudget = Readonly<{
  /** Reserves budget synchronously before invoking the supplied provider callback. */
  runProviderCall<T>(providerCall: () => T | PromiseLike<T>): Promise<T>;
}>;

export type CoverLetterEvalBudget = Readonly<{
  /** The first call is generation; every later call in this attempt is a repair. */
  beginWriterAttempt(): CoverLetterEvalWriterAttemptBudget;
  snapshot(): CoverLetterEvalBudgetSnapshot;
}>;

const USD_DECIMAL_PLACES = 12;

function normalizeUsd(value: number): number {
  return Number(value.toFixed(USD_DECIMAL_PLACES));
}

function invalidConfig(message: string): never {
  throw new CoverLetterEvalBudgetError({
    code: "invalid_budget_config",
    message,
  });
}

function requirePositiveInteger(name: string, value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    return invalidConfig(`${name} must be a positive integer.`);
  }
  return value;
}

function requireNonNegativeInteger(name: string, value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return invalidConfig(`${name} must be a non-negative integer.`);
  }
  return value;
}

function requirePositiveUsd(name: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return invalidConfig(`${name} must be a positive finite number.`);
  }
  const normalized = normalizeUsd(value);
  if (normalized <= 0) {
    return invalidConfig(
      `${name} must remain positive at ${USD_DECIMAL_PLACES}-decimal USD precision.`,
    );
  }
  return normalized;
}

function freezeSnapshot(args: {
  liveProviderCallsEnabled: boolean;
  limits: CoverLetterEvalBudgetSnapshot["limits"];
  reservedCalls: number;
  reservedRepairs: number;
  reservedUsd: number;
}): CoverLetterEvalBudgetSnapshot {
  return Object.freeze({
    liveProviderCallsEnabled: args.liveProviderCallsEnabled,
    limits: args.limits,
    usage: Object.freeze({
      reservedCalls: args.reservedCalls,
      reservedRepairs: args.reservedRepairs,
      reservedUsd: args.reservedUsd,
    }),
    usdReservationBasis: COVER_LETTER_EVAL_USD_RESERVATION_BASIS,
  });
}

export function createCoverLetterEvalBudget(
  options: CoverLetterEvalBudgetOptions,
): CoverLetterEvalBudget {
  if (!options || typeof options !== "object") {
    return invalidConfig("Budget options are required.");
  }

  const liveProviderCallsEnabled = options.explicitLiveProviderOptIn === true;
  const limits = Object.freeze({
    maxCalls: requirePositiveInteger("maxCalls", options.maxCalls),
    maxRepairs: requireNonNegativeInteger("maxRepairs", options.maxRepairs),
    maxUsd: requirePositiveUsd("maxUsd", options.maxUsd),
    declaredMaxUsdPerCall: requirePositiveUsd(
      "declaredMaxUsdPerCall",
      options.declaredMaxUsdPerCall,
    ),
  });

  let reservedCalls = 0;
  let reservedRepairs = 0;
  let reservedUsd = 0;

  const snapshot = (): CoverLetterEvalBudgetSnapshot =>
    freezeSnapshot({
      liveProviderCallsEnabled,
      limits,
      reservedCalls,
      reservedRepairs,
      reservedUsd,
    });

  const reject = (
    code: Exclude<CoverLetterEvalBudgetErrorCode, "invalid_budget_config">,
    message: string,
  ): never => {
    throw new CoverLetterEvalBudgetError({
      code,
      message,
      snapshot: snapshot(),
    });
  };

  const reserveProviderCall = (isRepair: boolean): void => {
    if (!liveProviderCallsEnabled) {
      return reject(
        "live_provider_calls_disabled",
        "Live provider calls require explicitLiveProviderOptIn=true from an explicit live-execution flag.",
      );
    }

    const nextReservedCalls = reservedCalls + 1;
    const nextReservedRepairs = reservedRepairs + (isRepair ? 1 : 0);
    const nextReservedUsd = normalizeUsd(
      nextReservedCalls * limits.declaredMaxUsdPerCall,
    );

    if (nextReservedCalls > limits.maxCalls) {
      return reject(
        "call_limit_exceeded",
        `Provider call ${nextReservedCalls} would exceed maxCalls=${limits.maxCalls}.`,
      );
    }
    if (nextReservedRepairs > limits.maxRepairs) {
      return reject(
        "repair_limit_exceeded",
        `Repair ${nextReservedRepairs} would exceed maxRepairs=${limits.maxRepairs}.`,
      );
    }
    if (nextReservedUsd > limits.maxUsd) {
      return reject(
        "reserved_usd_limit_exceeded",
        `The declared per-call ceiling would reserve USD ${nextReservedUsd}, exceeding maxUsd=${limits.maxUsd}. This is a reservation ceiling, not observed billing.`,
      );
    }

    reservedCalls = nextReservedCalls;
    reservedRepairs = nextReservedRepairs;
    reservedUsd = nextReservedUsd;
  };

  const beginWriterAttempt = (): CoverLetterEvalWriterAttemptBudget => {
    let writerCallsInAttempt = 0;

    return Object.freeze({
      runProviderCall: async <T>(
        providerCall: () => T | PromiseLike<T>,
      ): Promise<T> => {
        if (typeof providerCall !== "function") {
          throw new TypeError("providerCall must be a function.");
        }

        reserveProviderCall(writerCallsInAttempt > 0);
        writerCallsInAttempt += 1;
        return await providerCall();
      },
    });
  };

  return Object.freeze({
    beginWriterAttempt,
    snapshot,
  });
}
