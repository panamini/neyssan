import type { BenchmarkCase } from "./types";

export type BenchmarkOutputQualityGateFailureCode =
  | "english_fallback_leak"
  | "forbidden_claim"
  | "unsupported_numeric_claim"
  | "unsupported_duration_claim"
  | "metric_company_attribution_mismatch";

export type BenchmarkOutputQualityGateFailure = {
  code: BenchmarkOutputQualityGateFailureCode;
  evidence: string;
  message: string;
};

type AnalyzeBenchmarkOutputQualityArgs = {
  benchmarkCase: BenchmarkCase;
  outputText: string;
  expectedLanguage?: string | null;
};

const ENGLISH_FALLBACK_PATTERN =
  /\b(?:Dear Hiring Manager|Sincerely|Best regards|Kind regards|Cordially)\b/i;

const NUMERIC_CLAIM_PATTERN =
  /\b\d+(?:[.,]\d+)?(?:[-\s]*(?:%|percent(?:age)?(?:\s+points?)?|pour\s*cent|prozent\p{L}*|procent\p{L}*|proc\.?|процент(?:ов|а)?|por\s*cento))?(?=$|[^\p{L}\p{N}])/giu;

const DIGIT_DURATION_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*(?:days?|weeks?|months?|years?|jours?|semaines?|mois|ans?|tage|wochen|monate|jahre|dni|tygodnie|miesi(?:a|ą)ce|lat(?:a)?|rok(?:u)?|дн(?:я|ей)|недел(?:я|и|ь)|месяц(?:а|ев)?|год(?:а|ов)?|سن(?:ة|وات)|أيام|اسابيع|أشهر)\b/giu;

const WORD_NUMBERS: Array<{ value: string; words: string[] }> = [
  {
    value: "1",
    words: ["one", "un", "une", "ein", "eine", "jeden", "jedna", "один", "одна", "واحد"],
  },
  {
    value: "2",
    words: ["two", "deux", "zwei", "dwa", "dwie", "два", "две", "اثنان"],
  },
  {
    value: "3",
    words: ["three", "trois", "drei", "trzy", "три", "ثلاث"],
  },
  {
    value: "4",
    words: ["four", "quatre", "vier", "cztery", "четыре", "اربع"],
  },
  {
    value: "5",
    words: ["five", "cinq", "fünf", "funf", "pięć", "piec", "пять", "خمس"],
  },
  {
    value: "6",
    words: ["six", "sechs", "sześć", "szesc", "шесть", "ست"],
  },
  {
    value: "7",
    words: ["seven", "sept", "sieben", "siedem", "семь", "سبع"],
  },
  {
    value: "8",
    words: ["eight", "huit", "acht", "osiem", "восемь", "ثمان"],
  },
  {
    value: "9",
    words: ["nine", "neuf", "neun", "dziewięć", "dziewiec", "девять", "تسع"],
  },
  {
    value: "10",
    words: ["ten", "dix", "zehn", "dziesięć", "dziesiec", "десять", "عشر"],
  },
];

const DURATION_WORDS = [
  "day",
  "days",
  "jour",
  "jours",
  "tag",
  "tage",
  "dzien",
  "dzień",
  "dni",
  "день",
  "дня",
  "дней",
  "يوم",
  "أيام",
  "week",
  "weeks",
  "semaine",
  "semaines",
  "woche",
  "wochen",
  "tydzien",
  "tydzień",
  "tygodnie",
  "неделя",
  "недели",
  "недель",
  "اسبوع",
  "اسابيع",
  "month",
  "months",
  "mois",
  "monat",
  "monate",
  "miesiac",
  "miesiąc",
  "miesiace",
  "miesiące",
  "месяц",
  "месяца",
  "месяцев",
  "شهر",
  "أشهر",
  "year",
  "years",
  "an",
  "ans",
  "jahr",
  "jahre",
  "rok",
  "roku",
  "lata",
  "lat",
  "год",
  "года",
  "лет",
  "سنة",
  "سنوات",
];

const VAGUE_DURATION_PATTERN =
  /(?:^|\s)(?:for\s+years|over\s+the\s+years|last\s+few\s+years|in\s+recent\s+years|depuis\s+des\s+annees|depuis\s+des\s+ans|ces\s+dernieres\s+annees|seit\s+jahren|in\s+den\s+letzten\s+jahren|od\s+lat|przez\s+lata|за\s+годы|на\s+протяжении\s+лет|منذ\s+سنوات)(?=$|\s)/giu;

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForMatch(value: string): string {
  return compactWhitespace(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}.%+\s-]/gu, " ");
}

function sourceSurfaceForBenchmarkCase(benchmarkCase: BenchmarkCase): string {
  const context = benchmarkCase.candidateContext;
  return [
    benchmarkCase.jobTitle,
    benchmarkCase.jobDescription,
    benchmarkCase.expectedGrounding.join(" "),
    context?.summary,
    context?.desiredPosition,
    ...(context?.topSkills ?? []),
    ...(context?.standoutAchievements ?? []),
    ...(context?.recentExperience ?? []).flatMap((experience) => [
      experience.company,
      experience.position,
      ...(experience.highlights ?? []),
    ]),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
}

function normalizeNumericClaim(value: string): string {
  const normalized = normalizeForMatch(value)
    .replace(/,/g, ".")
    .replace(/\s+/g, " ");
  const number = normalized.match(/\d+(?:\.\d+)?/)?.[0] ?? normalized;
  const isPercent =
    /%|percent|percentage|pour\s*cent|prozent|procent|proc|процент|por\s*cento/u.test(
      normalized,
    );
  return isPercent ? `${number} percent` : number;
}

function extractNumericClaims(value: string): string[] {
  return Array.from(value.matchAll(NUMERIC_CLAIM_PATTERN))
    .map((match) => normalizeNumericClaim(match[0]))
    .filter((claim, index, claims) => claim.length > 0 && claims.indexOf(claim) === index);
}

function normalizeDurationClaim(value: string): string {
  const normalized = normalizeForMatch(value);
  const digit = normalized.match(/\d+(?:\.\d+)?/)?.[0];
  if (digit) return `${digit} duration`;

  for (const entry of WORD_NUMBERS) {
    if (entry.words.some((word) => normalized.includes(normalizeForMatch(word)))) {
      return `${entry.value} duration`;
    }
  }
  return normalized;
}

function buildWordDurationPattern(): RegExp {
  const numberWords = WORD_NUMBERS.flatMap((entry) => entry.words)
    .map((word) => normalizeForMatch(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const durationWords = DURATION_WORDS.map((word) =>
    normalizeForMatch(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|");
  return new RegExp(`\\b(?:${numberWords})\\s+(?:${durationWords})\\b`, "giu");
}

const WORD_DURATION_PATTERN = buildWordDurationPattern();

function extractDurationClaims(value: string): string[] {
  const normalized = normalizeForMatch(value);
  return [
    ...Array.from(normalized.matchAll(DIGIT_DURATION_PATTERN)).map((match) =>
      normalizeDurationClaim(match[0]),
    ),
    ...Array.from(normalized.matchAll(WORD_DURATION_PATTERN)).map((match) =>
      normalizeDurationClaim(match[0]),
    ),
    ...Array.from(normalized.matchAll(VAGUE_DURATION_PATTERN)).map(
      () => "vague duration",
    ),
  ].filter((claim, index, claims) => claim.length > 0 && claims.indexOf(claim) === index);
}

function extractForbiddenClaimPhrases(benchmarkCase: BenchmarkCase): string[] {
  return benchmarkCase.forbiddenClaims
    .flatMap((claim) =>
      claim
        .replace(/^do not\s+/i, "")
        .replace(/\.$/, "")
        .split(/\bor\b|,|;/i)
        .map(normalizeForMatch),
    )
    .map((phrase) =>
      phrase
        .replace(/\b(?:claim|invent|beyond|do not|dont|experience)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((phrase) => phrase.length >= 4)
    .filter((phrase, index, phrases) => phrases.indexOf(phrase) === index);
}

function findUnsupportedClaims(args: {
  sourceClaims: string[];
  generatedClaims: string[];
}): string[] {
  const sourceSet = new Set(args.sourceClaims);
  return args.generatedClaims.filter((claim) => !sourceSet.has(claim));
}

function sentenceSplit(value: string): string[] {
  return value
    .replace(/\bInc\.(?=\s|$)/g, "Inc__DOT__")
    .replace(/\bCo\.(?=\s|$)/g, "Co__DOT__")
    .replace(/\bCorp\.(?=\s|$)/g, "Corp__DOT__")
    .match(/[^.!?\n]+(?:[.!?]+|$)/g)
    ?.map((sentence) => compactWhitespace(sentence.replace(/__DOT__/g, ".")))
    .filter(Boolean) ?? [];
}

function companyMetricSourcesForBenchmarkCase(
  benchmarkCase: BenchmarkCase,
): Array<{ company: string; metrics: string[] }> {
  return (benchmarkCase.candidateContext?.recentExperience ?? [])
    .map((experience) => ({
      company: experience.company ?? "",
      metrics: (experience.highlights ?? []).flatMap(extractNumericClaims),
    }))
    .filter((entry) => entry.company && entry.metrics.length > 0);
}

function findMetricCompanyAttributionFailures(args: {
  benchmarkCase: BenchmarkCase;
  outputText: string;
}): Array<{ company: string; metric: string }> {
  const companyMetricSources = companyMetricSourcesForBenchmarkCase(
    args.benchmarkCase,
  );
  if (companyMetricSources.length === 0) return [];

  const failures: Array<{ company: string; metric: string }> = [];
  const metricKnownForCompany = (company: string, metric: string) =>
    companyMetricSources.some(
      (entry) =>
        normalizeForMatch(entry.company) === normalizeForMatch(company) &&
        entry.metrics.includes(metric),
    );

  for (const sentence of sentenceSplit(args.outputText)) {
    const sentenceMetrics = extractNumericClaims(sentence);
    if (sentenceMetrics.length === 0) continue;
    for (const { company } of companyMetricSources) {
      if (!normalizeForMatch(sentence).includes(normalizeForMatch(company))) {
        continue;
      }
      for (const metric of sentenceMetrics) {
        if (!metricKnownForCompany(company, metric)) {
          failures.push({ company, metric });
        }
      }
    }
  }

  return failures.filter(
    (failure, index, values) =>
      values.findIndex(
        (value) =>
          value.company === failure.company && value.metric === failure.metric,
      ) === index,
  );
}

export function analyzeBenchmarkOutputQuality(
  args: AnalyzeBenchmarkOutputQualityArgs,
): BenchmarkOutputQualityGateFailure[] {
  const failures: BenchmarkOutputQualityGateFailure[] = [];
  const outputText = compactWhitespace(args.outputText);
  const expectedLanguage = compactWhitespace(args.expectedLanguage ?? "");
  const normalizedOutput = normalizeForMatch(outputText);
  const sourceSurface = sourceSurfaceForBenchmarkCase(args.benchmarkCase);

  if (
    expectedLanguage &&
    !/^english$/i.test(expectedLanguage) &&
    ENGLISH_FALLBACK_PATTERN.test(outputText)
  ) {
    failures.push({
      code: "english_fallback_leak",
      evidence: ENGLISH_FALLBACK_PATTERN.exec(outputText)?.[0] ?? "English fallback",
      message: "Non-English document output contains deterministic English fallback copy.",
    });
  }

  for (const phrase of extractForbiddenClaimPhrases(args.benchmarkCase)) {
    if (normalizedOutput.includes(phrase)) {
      failures.push({
        code: "forbidden_claim",
        evidence: phrase,
        message: "Output contains a benchmark forbidden claim phrase.",
      });
    }
  }

  for (const claim of findUnsupportedClaims({
    sourceClaims: extractNumericClaims(sourceSurface),
    generatedClaims: extractNumericClaims(outputText),
  })) {
    failures.push({
      code: "unsupported_numeric_claim",
      evidence: claim,
      message: "Output contains a numeric claim absent from the job or candidate source facts.",
    });
  }

  for (const failure of findMetricCompanyAttributionFailures({
    benchmarkCase: args.benchmarkCase,
    outputText,
  })) {
    failures.push({
      code: "metric_company_attribution_mismatch",
      evidence: `${failure.metric} at ${failure.company}`,
      message:
        "Output attributes a source-backed metric to a company that the benchmark evidence does not tie it to.",
    });
  }

  for (const claim of findUnsupportedClaims({
    sourceClaims: extractDurationClaims(sourceSurface),
    generatedClaims: extractDurationClaims(outputText),
  })) {
    failures.push({
      code: "unsupported_duration_claim",
      evidence: claim,
      message: "Output contains a duration claim absent from the job or candidate source facts.",
    });
  }

  return failures;
}
