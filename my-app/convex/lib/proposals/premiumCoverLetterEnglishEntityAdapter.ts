const EMPLOYER_NAME_TOKEN_SOURCE =
  String.raw`(?:(?:[A-Z]\.){2,}|[A-Z0-9](?:[\w&'.-]*[\w&'-])?)`;
const EMPLOYER_AFTER_AT_PATTERN = new RegExp(
  String.raw`\b[Aa]t\s+(${EMPLOYER_NAME_TOKEN_SOURCE}(?:\s+${EMPLOYER_NAME_TOKEN_SOURCE}){0,3})`,
  "gu",
);
const EMPLOYER_AFTER_JOIN_PATTERN = new RegExp(
  String.raw`\b[Jj]oin\s+(${EMPLOYER_NAME_TOKEN_SOURCE}(?:\s+${EMPLOYER_NAME_TOKEN_SOURCE}){0,3})`,
  "gu",
);
const NUMERIC_TITLE_SUFFIX_PATTERN = new RegExp(
  String.raw`(?:—|–|\|)\s*(${EMPLOYER_NAME_TOKEN_SOURCE}(?:\s+${EMPLOYER_NAME_TOKEN_SOURCE}){0,3})\s*$`,
  "gu",
);
const DESCRIPTION_LEADING_EMPLOYER_PATTERN = new RegExp(
  String.raw`^\s*(${EMPLOYER_NAME_TOKEN_SOURCE}(?:\s+${EMPLOYER_NAME_TOKEN_SOURCE}){0,3})(?=\s+(?:[Ii]s|[Aa]re|[Oo]ffers?|[Hh]ires?|[Ss]eeks?|[Bb]uilds?|[Pp]rovides?)\b)`,
  "gu",
);
const DIGIT_LEADING_PROPER_NAME_PATTERN =
  /\b((?:\d+[A-Z][A-Za-z0-9&'.-]*|\d+(?:[-–—]\d+)*(?:[-–—][A-Z][A-Za-z0-9&'.-]*))(?:\s+[A-Z][A-Za-z0-9&'.-]*){0,3})\b/gu;
const DIGIT_LEADING_PROPER_NAME_SHAPE =
  /^(?:\d+[A-Z][A-Za-z0-9&'.-]*|\d+(?:[-–—]\d+)*(?:[-–—][A-Z][A-Za-z0-9&'.-]*))(?:\s+[A-Z][A-Za-z0-9&'.-]*){0,3}$/u;
const GENERIC_EMPLOYER_CANDIDATES = new Set([
  "our company",
  "our team",
  "the company",
  "the team",
]);
const DURATION_NAME_SUFFIXES = new Set([
  "day",
  "days",
  "hour",
  "hours",
  "minute",
  "minutes",
  "month",
  "months",
  "second",
  "seconds",
  "week",
  "weeks",
  "year",
  "years",
]);
const NUMERIC_EMPLOYER_PREDICATES = new Set([
  "builds",
  "focuses",
  "hires",
  "offers",
  "operates",
  "provides",
  "seeks",
  "serves",
  "supports",
  "values",
]);

type EmployerCandidate = Readonly<{
  name: string;
  index: number;
}>;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isCredibleEmployerCandidate(args: {
  name: string;
  value: string;
  end: number;
}): boolean {
  if (!/^\p{N}/u.test(args.name)) return true;
  if (/\p{L}/u.test(args.name)) {
    return DIGIT_LEADING_PROPER_NAME_SHAPE.test(args.name);
  }
  return /^\s*(?:$|[.,;:!?)]|[-–—|])/u.test(args.value.slice(args.end));
}

function employerCandidates(
  value: string,
  pattern: RegExp,
): EmployerCandidate[] {
  return Array.from(value.matchAll(pattern), (match) => {
    const name = compactWhitespace(match[1] ?? "");
    return {
      name,
      index: match.index ?? Number.MAX_SAFE_INTEGER,
      end: (match.index ?? 0) + match[0].length,
    };
  })
    .filter(
      (candidate) =>
        candidate.name.length > 0 &&
        !GENERIC_EMPLOYER_CANDIDATES.has(
          candidate.name.toLocaleLowerCase("en-US"),
        ) &&
        isCredibleEmployerCandidate({
          name: candidate.name,
          value,
          end: candidate.end,
        }),
    )
    .map(({ name, index }) => ({ name, index }));
}

function firstEmployerCandidate(
  value: string,
  pattern: RegExp,
): string | undefined {
  return employerCandidates(value, pattern)[0]?.name;
}

function numericTitleSuffix(jobTitle: string): string | undefined {
  return employerCandidates(jobTitle, NUMERIC_TITLE_SUFFIX_PATTERN).find(
    ({ name }) => /\p{N}/u.test(name),
  )?.name;
}

function firstDescriptionEmployerCandidate(
  jobDescription: string,
): string | undefined {
  const leadingNumericCandidates = employerCandidates(
    jobDescription,
    DESCRIPTION_LEADING_EMPLOYER_PATTERN,
  ).filter(({ name }) => /\p{N}/u.test(name));
  return [
    ...employerCandidates(jobDescription, EMPLOYER_AFTER_AT_PATTERN),
    ...employerCandidates(jobDescription, EMPLOYER_AFTER_JOIN_PATTERN),
    ...leadingNumericCandidates,
  ].sort((left, right) => left.index - right.index)[0]?.name;
}

function isDurationShapedProperName(value: string): boolean {
  const tokens = compactWhitespace(value).split(" ");
  if (tokens.length !== 1) return false;
  const suffix = tokens[0].split(/[-–—]/u).at(-1)?.toLowerCase() ?? "";
  return DURATION_NAME_SUFFIXES.has(suffix);
}

export function extractDigitLeadingEnglishProperNames(
  value: string,
): string[] {
  return [
    ...new Set(
      Array.from(value.matchAll(DIGIT_LEADING_PROPER_NAME_PATTERN), (match) =>
        compactWhitespace(match[1] ?? ""),
      ).filter(
        (candidate) =>
          candidate.length > 0 && !isDurationShapedProperName(candidate),
      ),
    ),
  ];
}

export function extractTargetEmployerName(
  jobTitle: string,
  jobDescription: string,
): string | undefined {
  return (
    firstEmployerCandidate(jobTitle, EMPLOYER_AFTER_AT_PATTERN) ??
    numericTitleSuffix(jobTitle) ??
    firstDescriptionEmployerCandidate(jobDescription)
  );
}

export function isNumericOnlyTargetEmployerMentionAt(args: {
  value: string;
  start: number;
  length: number;
}): boolean {
  const prefix = args.value.slice(0, args.start);
  const suffix = args.value.slice(args.start + args.length);
  if (/^['’]s(?![\p{L}\p{N}&'.-])/u.test(suffix)) return true;
  if (!/(?:^|[.!?;:]\s*)$/u.test(prefix)) return false;

  const followingToken =
    /^\s+([\p{L}][\p{L}'-]*)/u.exec(suffix)?.[1].toLowerCase() ?? "";
  return NUMERIC_EMPLOYER_PREDICATES.has(followingToken);
}
