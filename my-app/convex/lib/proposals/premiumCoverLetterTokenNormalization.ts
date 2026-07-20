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

export function expandPremiumCoverLetterTokenVariants(
  value: string,
): string[] {
  const token = value.toLowerCase();
  const variants = new Set([token]);

  if (token.endsWith("ies") && token.length > 5) {
    variants.add(`${token.slice(0, -3)}y`);
  }

  for (const rule of TOKEN_CANONICALIZATION_RULES) {
    if (rule.pattern.test(token)) {
      variants.add(rule.canonical);
    }
  }

  return [...variants];
}
