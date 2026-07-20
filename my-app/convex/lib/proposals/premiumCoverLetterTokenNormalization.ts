const TOKEN_CANONICALIZATION_RULES = [
  { pattern: /^admin(?:istrat(?:ion|ive|or|ors)?)$/, canonical: "admin" },
  {
    pattern: /^coordinat(?:e|ed|es|ing|ion|or|ors)$/,
    canonical: "coordinate",
  },
  {
    pattern: /^document(?:ation|ed|ing|s)?$/,
    canonical: "document",
  },
  { pattern: /^implement(?:ation|ed|ing|s|er|ers)?$/, canonical: "implement" },
  { pattern: /^manag(?:e|ed|es|ing|ement|er|ers)$/, canonical: "manage" },
  {
    pattern: /^operat(?:e|ed|es|ing|ion|ions|ional|or|ors)$/,
    canonical: "operate",
  },
  { pattern: /^record(?:ed|ing|s)?$/, canonical: "record" },
  { pattern: /^report(?:ed|ing|s)?$/, canonical: "report" },
  { pattern: /^schedul(?:e|ed|es|ing|er|ers)$/, canonical: "schedule" },
  { pattern: /^track(?:ed|ing|ers|er|s)?$/, canonical: "track" },
] as const;

const IRREGULAR_PLURAL_CANONICALS = new Map([
  ["analyses", "analysis"],
  ["bases", "basis"],
  ["crises", "crisis"],
  ["diagnoses", "diagnosis"],
  ["emphases", "emphasis"],
  ["hypotheses", "hypothesis"],
  ["statuses", "status"],
  ["theses", "thesis"],
]);
const INVARIANT_S_ENDING_TOKENS = new Set([
  "barracks",
  "corps",
  "crossroads",
  "headquarters",
  "means",
  "news",
  "series",
  "species",
]);

export function normalizePremiumCoverLetterNumericToken(
  value: string,
): string {
  if (!value.includes(",")) return String(Number(value));
  if (value.includes(".")) {
    return String(Number(value.replace(/,/g, "")));
  }
  const commaParts = value.split(",");
  const usesThousandsGrouping =
    commaParts.length > 1 &&
    commaParts[0] !== "0" &&
    commaParts.slice(1).every((part) => part.length === 3);
  const normalizedValue = usesThousandsGrouping
    ? commaParts.join("")
    : commaParts.length === 2
      ? commaParts.join(".")
      : value;
  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? String(parsedValue) : value;
}

export function expandPremiumCoverLetterTokenVariants(
  value: string,
): string[] {
  const token = value.toLowerCase();
  const variants = new Set([token]);
  if (INVARIANT_S_ENDING_TOKENS.has(token)) return [...variants];

  if (token.endsWith("ies") && token.length > 5) {
    variants.add(`${token.slice(0, -3)}y`);
  }
  if (token.endsWith("es") && token.length > 5) {
    variants.add(token.slice(0, -2));
  }
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 4) {
    variants.add(token.slice(0, -1));
  }

  for (const rule of TOKEN_CANONICALIZATION_RULES) {
    if (rule.pattern.test(token)) {
      variants.add(rule.canonical);
    }
  }

  return [...variants];
}

export function canonicalizePremiumCoverLetterToken(value: string): string {
  const token = value.toLowerCase();
  const canonicalRule = TOKEN_CANONICALIZATION_RULES.find((rule) =>
    rule.pattern.test(token),
  );
  if (canonicalRule) return canonicalRule.canonical;

  return canonicalizePremiumCoverLetterNoun(token);
}

export function canonicalizePremiumCoverLetterNoun(value: string): string {
  const token = value.toLowerCase();
  if (INVARIANT_S_ENDING_TOKENS.has(token)) return token;
  const irregularPlural = IRREGULAR_PLURAL_CANONICALS.get(token);
  if (irregularPlural) return irregularPlural;

  let canonical = token;
  if (token.endsWith("ies") && token.length > 5) {
    canonical = `${token.slice(0, -3)}y`;
  } else if (
    /(?:sses|xes|zes|ches|shes|oes)$/u.test(token) &&
    token.length > 5
  ) {
    canonical = token.slice(0, -2);
  } else if (
    token.endsWith("s") &&
    !token.endsWith("ss") &&
    !token.endsWith("is") &&
    !token.endsWith("us") &&
    token.length > 4
  ) {
    canonical = token.slice(0, -1);
  }

  return canonical;
}
