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
    if (suffix.length >= tokens.length) continue;
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
      /\p{N}/u.test(span.alias) &&
      numericAliasHasEmployerContext(args.value, span) &&
      args.occurrenceIndex >= span.start && args.occurrenceIndex < span.end,
  );
}

function numericAliasHasEmployerContext(
  value: string,
  span: Readonly<{ start: number; end: number }>,
): boolean {
  const prefix = value.slice(0, span.start);
  const suffix = value.slice(span.end);
  if (/\b(?:at|join|joining)\s+$/iu.test(prefix)) return true;
  if (/^\s*['’]s\b/iu.test(suffix)) return true;
  return (
    (span.start === 0 || /[.!?]\s*$/u.test(prefix)) &&
    /^\s*(?:offers?|is|seeks?|needs?|values?|provides?|builds?|supports?)\b/iu.test(
      suffix,
    )
  );
}

const GENERIC_AT_CONTEXT_TOKENS = new Set([
  "a",
  "an",
  "my",
  "our",
  "scale",
  "the",
  "this",
  "that",
]);

export function hasConflictingTargetEmployerMention(args: {
  value: string;
  targetEmployer?: TargetEmployerResolution;
}): boolean {
  if (args.targetEmployer?.status !== "RESOLVED") return false;
  const spans = targetEmployerAliasSpans({
    value: args.value,
    targetEmployer: args.targetEmployer,
  });
  for (const match of args.value.matchAll(
    /\b(?:[Aa]t|[Jj]oining)\s+(?=[\p{Lu}\p{N}])/gu,
  )) {
    const mentionStart = match.index + match[0].length;
    const mentionToken = employerTokens(args.value.slice(mentionStart))[0];
    if (
      !mentionToken ||
      GENERIC_AT_CONTEXT_TOKENS.has(mentionToken.normalized)
    ) {
      continue;
    }
    if (!spans.some((span) => span.start === mentionStart)) return true;
  }
  return false;
}
