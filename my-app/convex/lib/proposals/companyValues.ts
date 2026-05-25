export type CompanyValuesConfidence = "none" | "implicit" | "explicit";

export type CompanyValuesPack = {
  confidence: CompanyValuesConfidence;
  explicitValues: string[];
  implicitValues: string[];
  valueEvidenceSnippets: string[];
  workSurfaceLinks: string[];
  bannedValueClaims: string[];
};

export const COMPANY_VALUE_BANNED_CLAIMS = [
  "your mission resonates with me",
  "I share your values",
  "I admire your culture",
  "your values align with mine",
  "your culture is inspiring",
  "I am passionate about your mission",
] as const;

const EXPLICIT_VALUE_CUE_PATTERN =
  /\b(?:our|the company(?:'s)?|we)\s+(?:values?|mission|principles?|commitments?|culture|operating philosophy|purpose|ethos)\b|\b(?:values?|mission|principles?|commitments?|operating philosophy|purpose|ethos)\s+(?:are|is|include|includes|guide|drives?)\b|\bwe believe\b|\bcommitted to\b/i;
const GENERIC_EMPLOYER_FLUFF_PATTERN =
  /\b(?:competitive benefits?|perks?|compensation|career growth|growth opportunities|great place to work|dynamic(?: culture)?|fast[-\s]?paced|world[-\s]?class|best[-\s]?in[-\s]?class|passionate|exciting|innovative|cutting[-\s]?edge|high[-\s]?performing|great culture|fun culture|join us|why join)\b/i;
const WORK_SURFACE_PATTERN =
  /\b(?:lead|own|coordinate|track|manage|maintain|support|build|improve|handle|answer|update|prepare|document|design|analy[sz]e|supervise|monitor|report|deliver|develop|create|review|operate|collaborate|implement|schedule|handoffs?|records?|workflows?|systems?|customers?|users?|service|quality|compliance|safety|incident|documentation|accessibility|reliability)\b/i;

const VALUE_PATTERNS: ReadonlyArray<{
  value: string;
  pattern: RegExp;
}> = [
  { value: "safety", pattern: /\b(?:safety|safe|incident|risk|secure)\b/i },
  {
    value: "reliability",
    pattern: /\b(?:reliable|reliability|dependable|steady|current|follow[-\s]?through|relies?|uptime)\b/i,
  },
  { value: "speed", pattern: /\b(?:speed|fast|faster|rapid|quick|timely|turnaround)\b/i },
  { value: "craft", pattern: /\b(?:craft|quality|polish|well-made|excellence)\b/i },
  { value: "service", pattern: /\b(?:service|serve|support|help)\b/i },
  { value: "compliance", pattern: /\b(?:compliance|compliant|regulatory|policy|audit|logs?)\b/i },
  {
    value: "collaboration",
    pattern: /\b(?:collaboration|collaborate|cross-functional|handoffs?|partner|team)\b/i,
  },
  { value: "accountability", pattern: /\b(?:accountability|accountable)\b/i },
  { value: "ownership", pattern: /\b(?:ownership|own|responsible)\b/i },
  { value: "precision", pattern: /\b(?:precision|precise|accurate|accuracy|careful|detail)\b/i },
  {
    value: "customer care",
    pattern: /\b(?:customer care|customer|client|guest|patient|user care|users?)\b/i,
  },
  {
    value: "sustainability",
    pattern: /\b(?:sustainability|sustainable|environment|environmental)\b/i,
  },
  {
    value: "accessibility",
    pattern: /\b(?:accessibility|accessible|inclusive|inclusion|universal access)\b/i,
  },
  { value: "trust", pattern: /\b(?:trust|trusted|integrity|transparent|transparency)\b/i },
];

function compactWhitespace(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForMatch(value: string): string {
  return compactWhitespace(value)
    .normalize("NFKC")
    .replace(/[’`]/g, "'")
    .toLowerCase();
}

function dedupe(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const compact = compactWhitespace(value);
    if (!compact) continue;
    const key = normalizeForMatch(compact);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(compact);
  }
  return result;
}

function splitSentences(value: string): string[] {
  return dedupe(
    compactWhitespace(value)
      .replace(/\r/g, "\n")
      .split(/\n+|(?<=[.!?])\s+|;\s+/)
      .map((part) => compactWhitespace(part)),
  );
}

function sentenceHasConcreteValue(sentence: string): boolean {
  return VALUE_PATTERNS.some(({ pattern }) => pattern.test(sentence));
}

function extractKnownValues(sentence: string): string[] {
  return VALUE_PATTERNS.filter(({ pattern }) => pattern.test(sentence)).map(
    ({ value }) => value,
  );
}

function extractExplicitMissionPhrase(sentence: string): string | null {
  const normalized = compactWhitespace(sentence.replace(/[.!?]$/u, ""));
  const match = normalized.match(
    /\b(?:mission|purpose|operating philosophy|ethos)\s+(?:is|are|to)\s+([^.;:]{4,90})/i,
  );
  if (!match?.[1]) return null;
  const phrase = compactWhitespace(
    match[1].replace(/\b(?:through|by|while|and the role)\b[\s\S]*$/i, ""),
  );
  if (!phrase || GENERIC_EMPLOYER_FLUFF_PATTERN.test(phrase)) return null;
  return phrase.toLowerCase();
}

function buildWorkSurfaceLinks(sentences: string[]): string[] {
  return dedupe(
    sentences
      .filter((sentence) => WORK_SURFACE_PATTERN.test(sentence))
      .map((sentence) => compactWhitespace(sentence)),
  ).slice(0, 4);
}

function distinctConcreteSnippetsForValue(args: {
  snippets: string[];
  pattern: RegExp;
}): string[] {
  return dedupe(
    args.snippets.filter(
      (snippet) =>
        args.pattern.test(snippet) &&
        WORK_SURFACE_PATTERN.test(snippet) &&
        !GENERIC_EMPLOYER_FLUFF_PATTERN.test(snippet),
    ),
  );
}

export function analyzeCompanyValues(jobDescription: string): CompanyValuesPack {
  const sentences = splitSentences(jobDescription);
  const explicitEvidence = sentences.filter(
    (sentence) =>
      EXPLICIT_VALUE_CUE_PATTERN.test(sentence) &&
      !GENERIC_EMPLOYER_FLUFF_PATTERN.test(sentence) &&
      sentenceHasConcreteValue(sentence),
  );
  const explicitValues = dedupe(
    explicitEvidence.flatMap((sentence) => [
      ...extractKnownValues(sentence),
      extractExplicitMissionPhrase(sentence),
    ]),
  ).slice(0, 6);

  const valueCounts = new Map<
    string,
    { count: number; snippets: string[]; pattern: RegExp }
  >();
  for (const sentence of sentences) {
    if (GENERIC_EMPLOYER_FLUFF_PATTERN.test(sentence)) continue;
    for (const { value, pattern } of VALUE_PATTERNS) {
      if (!pattern.test(sentence)) continue;
      const entry = valueCounts.get(value) ?? { count: 0, snippets: [], pattern };
      entry.count += 1;
      entry.snippets.push(sentence);
      valueCounts.set(value, entry);
    }
  }

  const implicitValues =
    explicitValues.length > 0
      ? []
      : Array.from(valueCounts.entries())
          .filter(([, entry]) => {
            const concreteSnippets = distinctConcreteSnippetsForValue({
              snippets: entry.snippets,
              pattern: entry.pattern,
            });
            return entry.count >= 2 && concreteSnippets.length >= 2;
          })
          .map(([value]) => value)
          .slice(0, 6);

  const confidence: CompanyValuesConfidence =
    explicitValues.length > 0
      ? "explicit"
      : implicitValues.length > 0
        ? "implicit"
        : "none";
  const evidenceSnippets =
    confidence === "explicit"
      ? explicitEvidence
      : confidence === "implicit"
        ? dedupe(
            implicitValues.flatMap((value) => {
              const entry = valueCounts.get(value);
              return entry
                ? distinctConcreteSnippetsForValue({
                    snippets: entry.snippets,
                    pattern: entry.pattern,
                  })
                : [];
            }),
          )
        : [];

  return {
    confidence,
    explicitValues,
    implicitValues,
    valueEvidenceSnippets: evidenceSnippets.slice(0, 4),
    workSurfaceLinks: buildWorkSurfaceLinks(sentences),
    bannedValueClaims: [...COMPANY_VALUE_BANNED_CLAIMS],
  };
}

function renderList(label: string, values: readonly string[]): string[] {
  return values.length > 0
    ? [`- ${label}: ${values.join(" | ")}`]
    : [`- ${label}: none`];
}

export function formatCompanyValuesPromptBlock(
  pack: CompanyValuesPack | null | undefined,
): string {
  if (!pack || pack.confidence === "none") {
    return [
      "Company values audit context (bounded; read-only):",
      "- confidence: none",
      "- values rule: do not invent mission, culture, principles, or value alignment.",
    ].join("\n");
  }

  return [
    "Company values audit context (bounded; read-only):",
    `- confidence: ${pack.confidence}`,
    ...renderList("explicit_values", pack.explicitValues),
    ...renderList("implicit_values", pack.implicitValues),
    ...renderList("value_evidence_snippets", pack.valueEvidenceSnippets),
    ...renderList("work_surface_links", pack.workSurfaceLinks),
    `- banned_value_claim_count: ${pack.bannedValueClaims.length}`,
    "- Values may be used only when they sharpen a concrete hiring case tied to a work surface or source-backed candidate evidence.",
    "- Values must not replace source-backed candidate evidence.",
    "- Values must not outrank stronger candidate proof.",
    "- Do not infer personal alignment, admiration, culture fit, or mission resonance.",
    "- If no strong mapping exists, leave company values unused.",
  ].join("\n");
}
