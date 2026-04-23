import type { CanonicalJobExtraction } from "./canonicalJobs";
import type { MatchReadSynthesisCache } from "./matchReadSynthesis";

export type MatchReadTier = "strong" | "partial" | "weak" | "unknown";
export type MatchReadConfidence = "high" | "medium" | "low";
export type MatchReadFallback =
  | "none"
  | "profile_missing"
  | "parse_failed"
  | "requirements_missing";
export type MatchReadMethod = "keyword-overlap" | "llm";

export type MatchRead = {
  tier: MatchReadTier;
  score: number | null;
  scoreVisible: boolean;
  confidence: MatchReadConfidence;
  matched: string[];
  missing: string[];
  basedOn: {
    profileId: string;
    profileLabel: string;
    jobId: string;
  };
  computedAt: number;
  method: MatchReadMethod;
  fallback: MatchReadFallback;
};

export function buildMatchReadTelemetryArgs(matchRead: MatchRead) {
  return {
    name: "jobs-v2:match_read_computed",
    value: 1,
    metadata: {
      namespace: "jobs-v2",
      event: "match_read_computed",
      jobId: matchRead.basedOn.jobId,
      tier: matchRead.tier,
      confidence: matchRead.confidence,
      method: matchRead.method,
      fallback: matchRead.fallback,
    },
    labels: {
      namespace: "jobs-v2",
      event: "match_read_computed",
      tier: matchRead.tier,
      confidence: matchRead.confidence,
      method: matchRead.method,
      fallback: matchRead.fallback,
    },
  };
}

type MatchReadProfile = {
  id?: string;
  version?: number;
  skills?: string[];
  keywords?: string[];
};

type MatchReadJob = {
  id: string;
  updatedAt?: number;
  parseVersion?: string | null;
  parseStatus?: string | null;
  mustHaves?: string[];
  keywords?: string[];
  mustHavesExtraction?: CanonicalJobExtraction[];
  keywordsExtraction?: CanonicalJobExtraction[];
};

type MatchSignal = {
  value: string;
  confidence: number;
};

const MATCH_READ_STOP_WORDS = new Set([
  "about",
  "across",
  "along",
  "among",
  "and",
  "experience",
  "for",
  "have",
  "need",
  "requirements",
  "required",
  "role",
  "should",
  "the",
  "their",
  "this",
  "with",
]);

function compactWhitespace(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeSignalValue(value: string): string {
  return compactWhitespace(value)
    .toLowerCase()
    .replace(/^[^a-z0-9+#./-]+|[^a-z0-9+#./-]+$/g, "");
}

function tokenizeSignal(value: string): string[] {
  return (normalizeSignalValue(value).match(/[a-z0-9+#./-]{3,}/g) ?? []).filter(
    (token) => !MATCH_READ_STOP_WORDS.has(token),
  );
}

function dedupeStrings(values: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = compactWhitespace(value);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(normalized);
  }

  return deduped;
}

function dedupeSignals(values: MatchSignal[]): MatchSignal[] {
  const deduped: MatchSignal[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = compactWhitespace(value.value);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push({
      value: normalized,
      confidence: Math.max(0, Math.min(1, value.confidence)),
    });
  }

  return deduped;
}

function buildJobSignals(job: MatchReadJob): MatchSignal[] {
  const mustHavesSignals =
    Array.isArray(job.mustHavesExtraction) && job.mustHavesExtraction.length > 0
      ? job.mustHavesExtraction.map((item) => ({
          value: item.value,
          confidence: item.confidence,
        }))
      : (job.mustHaves ?? []).map((value) => ({
          value,
          confidence: 0.48,
        }));

  const keywordSignals =
    Array.isArray(job.keywordsExtraction) && job.keywordsExtraction.length > 0
      ? job.keywordsExtraction.map((item) => ({
          value: item.value,
          confidence: item.confidence,
        }))
      : (job.keywords ?? []).map((value) => ({
          value,
          confidence: 0.42,
        }));

  return dedupeSignals([...mustHavesSignals, ...keywordSignals]);
}

function buildProfileSignalState(profile: MatchReadProfile | null) {
  const phrases = new Set<string>();
  const tokens = new Set<string>();

  for (const value of dedupeStrings([
    ...(profile?.skills ?? []),
    ...(profile?.keywords ?? []),
  ])) {
    const normalizedPhrase = normalizeSignalValue(value);
    if (!normalizedPhrase) {
      continue;
    }

    phrases.add(normalizedPhrase);
    for (const token of tokenizeSignal(normalizedPhrase)) {
      tokens.add(token);
    }
  }

  return { phrases, tokens };
}

function isSignalMatched(
  signal: MatchSignal,
  profileState: ReturnType<typeof buildProfileSignalState>,
): boolean {
  const normalizedSignal = normalizeSignalValue(signal.value);
  if (!normalizedSignal) {
    return false;
  }

  if (profileState.phrases.has(normalizedSignal)) {
    return true;
  }

  const signalTokens = tokenizeSignal(signal.value);
  if (signalTokens.length === 0) {
    return false;
  }

  const matchedTokens = signalTokens.filter((token) =>
    profileState.tokens.has(token),
  ).length;

  return matchedTokens / signalTokens.length >= 0.5;
}

function resolveTier(score: number): MatchReadTier {
  if (score >= 75) {
    return "strong";
  }
  if (score >= 40) {
    return "partial";
  }
  return "weak";
}

function resolveConfidence(args: {
  signalCount: number;
  averageJobSignalConfidence: number;
  profileSignalCount: number;
}): MatchReadConfidence {
  if (
    args.signalCount >= 3 &&
    args.averageJobSignalConfidence >= 0.75 &&
    args.profileSignalCount >= 3
  ) {
    return "high";
  }

  if (
    args.signalCount >= 2 &&
    args.averageJobSignalConfidence >= 0.55 &&
    args.profileSignalCount >= 2
  ) {
    return "medium";
  }

  return "low";
}

export function buildMatchReadSynthesisCacheKey(args: {
  job: MatchReadJob;
  profile: MatchReadProfile | null;
  matchRead: MatchRead;
}): string {
  return [
    String(args.job.id ?? ""),
    String(args.job.parseVersion ?? ""),
    String(args.profile?.id ?? ""),
    String(args.profile?.version ?? ""),
    args.matchRead.tier,
    args.matchRead.confidence,
    args.matchRead.matched.join("|"),
    args.matchRead.missing.join("|"),
  ].join("::");
}

function applyMatchReadSynthesis(args: {
  baseMatchRead: MatchRead;
  synthesis: MatchReadSynthesisCache | null | undefined;
  cacheKey: string;
}): MatchRead {
  if (
    args.baseMatchRead.fallback !== "none" ||
    args.synthesis?.status !== "ready" ||
    args.synthesis.cacheKey !== args.cacheKey
  ) {
    return args.baseMatchRead;
  }

  return {
    ...args.baseMatchRead,
    matched: Array.isArray(args.synthesis.matched)
      ? dedupeStrings(args.synthesis.matched)
      : args.baseMatchRead.matched,
    missing: Array.isArray(args.synthesis.missing)
      ? dedupeStrings(args.synthesis.missing)
      : args.baseMatchRead.missing,
    computedAt:
      typeof args.synthesis.computedAt === "number"
        ? args.synthesis.computedAt
        : args.baseMatchRead.computedAt,
    method: "llm",
  };
}

export function computeMatchRead(args: {
  job: MatchReadJob;
  profile: MatchReadProfile | null;
  now?: number;
  synthesis?: MatchReadSynthesisCache | null;
}): MatchRead {
  const computedAt = args.now ?? Date.now();
  const basedOn = {
    profileId: String(args.profile?.id ?? ""),
    profileLabel: "Your profile",
    jobId: args.job.id,
  };

  if (args.job.parseStatus === "failed") {
    return {
      tier: "unknown",
      score: null,
      scoreVisible: false,
      confidence: "low",
      matched: [],
      missing: [],
      basedOn,
      computedAt,
      method: "keyword-overlap",
      fallback: "parse_failed",
    };
  }

  const jobSignals = buildJobSignals(args.job);
  if (jobSignals.length === 0) {
    return {
      tier: "unknown",
      score: null,
      scoreVisible: false,
      confidence: "low",
      matched: [],
      missing: [],
      basedOn,
      computedAt,
      method: "keyword-overlap",
      fallback: "requirements_missing",
    };
  }

  const profileState = buildProfileSignalState(args.profile);
  if (profileState.tokens.size === 0 && profileState.phrases.size === 0) {
    return {
      tier: "unknown",
      score: null,
      scoreVisible: false,
      confidence: "low",
      matched: [],
      missing: dedupeStrings(jobSignals.map((signal) => signal.value)),
      basedOn,
      computedAt,
      method: "keyword-overlap",
      fallback: "profile_missing",
    };
  }

  const matchedSignals = jobSignals.filter((signal) =>
    isSignalMatched(signal, profileState),
  );
  const missingSignals = jobSignals.filter(
    (signal) => !isSignalMatched(signal, profileState),
  );
  const score = Math.round((matchedSignals.length / jobSignals.length) * 100);
  const confidence = resolveConfidence({
    signalCount: jobSignals.length,
    averageJobSignalConfidence:
      jobSignals.reduce((total, signal) => total + signal.confidence, 0) /
      jobSignals.length,
    profileSignalCount: Math.max(
      profileState.tokens.size,
      profileState.phrases.size,
    ),
  });

  const baseMatchRead: MatchRead = {
    tier: resolveTier(score),
    score,
    scoreVisible: confidence !== "low",
    confidence,
    matched: dedupeStrings(matchedSignals.map((signal) => signal.value)),
    missing: dedupeStrings(missingSignals.map((signal) => signal.value)),
    basedOn,
    computedAt,
    method: "keyword-overlap",
    fallback: "none",
  };

  return applyMatchReadSynthesis({
    baseMatchRead,
    synthesis: args.synthesis,
    cacheKey: buildMatchReadSynthesisCacheKey({
      job: args.job,
      profile: args.profile,
      matchRead: baseMatchRead,
    }),
  });
}
