export type TargetEmployerResolved = Readonly<{
  status: "RESOLVED";
  canonicalName: string;
  displayName: string;
  normalizedName: string;
  aliases: readonly string[];
  numericName: boolean;
}>;

export type TargetEmployerMissing = Readonly<{
  status: "MISSING";
}>;

export type TargetEmployerInvalid = Readonly<{
  status: "INVALID";
  suppliedAuthorities: readonly string[];
}>;

export type TargetEmployerAmbiguous = Readonly<{
  status: "AMBIGUOUS";
  canonicalNames: readonly string[];
}>;

export type TargetEmployerResolution =
  | TargetEmployerResolved
  | TargetEmployerMissing
  | TargetEmployerInvalid
  | TargetEmployerAmbiguous;

export const MISSING_TARGET_EMPLOYER: TargetEmployerMissing = Object.freeze({
  status: "MISSING",
});

const LEGAL_SUFFIX_TOKEN_SEQUENCES: readonly (readonly string[])[] = [
  ["incorporated"],
  ["corporation"],
  ["company"],
  ["limited"],
  ["gmbh"],
  ["s", "a", "r", "l"],
  ["sarl"],
  ["s", "a", "s"],
  ["sas"],
  ["l", "l", "c"],
  ["llc"],
  ["p", "l", "c"],
  ["plc"],
  ["b", "v"],
  ["bv"],
  ["n", "v"],
  ["nv"],
  ["s", "a"],
  ["sa"],
  ["inc"],
  ["corp"],
  ["ltd"],
  ["co"],
];

type EmployerToken = Readonly<{
  normalized: string;
  start: number;
  end: number;
}>;

function compactAuthority(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function employerTokens(value: string): EmployerToken[] {
  return Array.from(value.matchAll(/[\p{L}\p{N}]+/gu), (match) => ({
    normalized: match[0].normalize("NFKC").toLocaleLowerCase("en-US"),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

export function normalizeTargetEmployerName(value: string): string {
  return employerTokens(compactAuthority(value))
    .map((token) => token.normalized)
    .join(" ");
}

function terminalLegalSuffixLength(tokens: readonly EmployerToken[]): number {
  for (const suffix of LEGAL_SUFFIX_TOKEN_SEQUENCES) {
    if (suffix.length > tokens.length) continue;
    const offset = tokens.length - suffix.length;
    if (
      suffix.every(
        (expected, index) => tokens[offset + index]?.normalized === expected,
      )
    ) {
      return suffix.length;
    }
  }
  return 0;
}

function trimTerminalPunctuation(value: string): string {
  return value.replace(/[\s\p{P}\p{S}]+$/gu, "").trim();
}

function resolveSingleAuthority(value: string): TargetEmployerResolved | null {
  const canonicalName = compactAuthority(value);
  const tokens = employerTokens(canonicalName);
  if (tokens.length === 0) return null;

  const suffixLength = terminalLegalSuffixLength(tokens);
  const displayTokens =
    suffixLength > 0 ? tokens.slice(0, -suffixLength) : tokens;
  if (displayTokens.length === 0) return null;

  const displayName =
    suffixLength > 0
      ? trimTerminalPunctuation(
          canonicalName.slice(0, tokens[tokens.length - suffixLength].start),
        )
      : trimTerminalPunctuation(canonicalName);
  if (!displayName) return null;

  const normalizedName = tokens.map((token) => token.normalized).join(" ");
  const normalizedDisplayName = displayTokens
    .map((token) => token.normalized)
    .join(" ");
  const aliases = [...new Set([normalizedName, normalizedDisplayName])].sort(
    (left, right) =>
      right.split(" ").length - left.split(" ").length ||
      right.length - left.length ||
      left.localeCompare(right),
  );

  return {
    status: "RESOLVED",
    canonicalName,
    displayName,
    normalizedName,
    aliases,
    numericName: /^\p{N}+(?:\s+\p{N}+)*$/u.test(normalizedDisplayName),
  };
}

export function resolveTargetEmployerAuthorities(
  authorities: readonly (string | null | undefined)[],
): TargetEmployerResolution {
  const suppliedAuthorities = authorities.filter(
    (authority): authority is string => authority !== null && authority !== undefined,
  );
  if (suppliedAuthorities.length === 0) return MISSING_TARGET_EMPLOYER;

  const resolvedAuthorities = suppliedAuthorities.map(resolveSingleAuthority);
  if (resolvedAuthorities.some((authority) => authority === null)) {
    return {
      status: "INVALID",
      suppliedAuthorities: suppliedAuthorities.map(compactAuthority),
    };
  }

  const resolved = resolvedAuthorities.filter(
    (authority): authority is TargetEmployerResolved => authority !== null,
  );
  const canonicalDisplayName = normalizeTargetEmployerName(
    resolved[0].displayName,
  );
  if (
    resolved.some(
      (authority) =>
        normalizeTargetEmployerName(authority.displayName) !==
        canonicalDisplayName,
    )
  ) {
    return {
      status: "AMBIGUOUS",
      canonicalNames: [...new Set(resolved.map((item) => item.canonicalName))],
    };
  }

  return resolved[0];
}

export function targetEmployerAliasSpans(args: {
  value: string;
  targetEmployer: TargetEmployerResolution;
}): Array<Readonly<{ start: number; end: number; alias: string }>> {
  if (args.targetEmployer.status !== "RESOLVED") return [];
  const tokens = employerTokens(args.value);
  const spans: Array<Readonly<{ start: number; end: number; alias: string }>> = [];

  for (const alias of args.targetEmployer.aliases) {
    const aliasTokens = alias.split(" ");
    for (let index = 0; index <= tokens.length - aliasTokens.length; index += 1) {
      if (
        aliasTokens.every(
          (expected, aliasIndex) =>
            tokens[index + aliasIndex]?.normalized === expected,
        )
      ) {
        spans.push({
          start: tokens[index].start,
          end: tokens[index + aliasTokens.length - 1].end,
          alias,
        });
      }
    }
  }

  return spans;
}

export function targetEmployerOwnsOccurrence(args: {
  value: string;
  occurrenceIndex: number;
  targetEmployer: TargetEmployerResolution;
}): boolean {
  return targetEmployerAliasSpans(args).some(
    (span) =>
      args.occurrenceIndex >= span.start && args.occurrenceIndex < span.end,
  );
}
