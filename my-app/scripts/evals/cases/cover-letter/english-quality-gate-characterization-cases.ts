export const ENGLISH_QUALITY_GATE_KNOWN_FAILURE_IDS = [] as const;

export const ENGLISH_QUALITY_GATE_EXPECTED_CASE_IDS = [
  "p2-employer-job-level-em-dash",
  "p2-employer-job-level-case-variation",
  "p2-employer-heading-before-authority",
  "p2-employer-heading-punctuation-variation",
  "history-employer-explicit-at-minimal-pair",
  "history-employer-explicit-at-punctuation-variation",
  "history-employer-missing-fails-safe",
  "history-employer-missing-case-variation",
  "p2-employer-numeric-only-authority",
  "p1-numeric-context-100m-unstructured",
  "p1-numeric-context-100m-structured",
  "p2-duration-three-day-paraphrase",
  "p2-duration-three-day-case-punctuation",
  "p2-brand-7-eleven-legal-suffix",
  "p2-brand-7-eleven-case-punctuation",
  "p2-employer-99-authorized",
  "p2-employer-99-elsewhere-is-metric",
  "p1-prose-make-teams-grow-fragment",
  "history-prose-help-teams-grow-fragment",
  "p2-prose-main-predicate-after-infinitive",
  "p2-prose-main-predicate-case-punctuation",
  "p2-prose-main-predicate-removed-minimal-pair",
  "history-prose-finite-subject-control",
  "history-prose-finite-subject-punctuation-variation",
  "pr-d-prose-abbreviations-corp-us",
  "pr-d-prose-abbreviation-co",
  "pr-d-prose-simple-subject",
  "pr-d-prose-modified-subject",
  "pr-d-prose-coordinated-subject",
  "pr-d-prose-relative-clause",
  "pr-d-prose-bounded-infinitive-clause",
  "pr-d-prose-imperative-form",
  "pr-d-prose-unknown-observation",
] as const;

export const ENGLISH_QUALITY_GATE_EXPECTED_DIVERGENT_CASE_IDS = [] as const;

export const ENGLISH_QUALITY_GATE_EXPECTED_DIVERGENT_OBSERVATIONS = {} as const satisfies Readonly<
  Record<
    (typeof ENGLISH_QUALITY_GATE_EXPECTED_DIVERGENT_CASE_IDS)[number],
    string
  >
>;

export type EnglishQualityGateKnownFailureId =
  (typeof ENGLISH_QUALITY_GATE_KNOWN_FAILURE_IDS)[number];

type CharacterizationProvenance = "P1" | "P2" | "PR347" | "PR349";

type CharacterizationCaseBase = Readonly<{
  id: string;
  provenance: CharacterizationProvenance;
  pairId: string;
  knownFailureId?: EnglishQualityGateKnownFailureId;
}>;

export type TargetEmployerCharacterizationCase = CharacterizationCaseBase &
  Readonly<{
    axis: "target_employer";
    canonicalEmployer: string | null;
    jobTitle: string;
    jobDescription: string;
    expectedEmployerName: string | null;
  }>;

export type NumericEvidenceCharacterizationCase = CharacterizationCaseBase &
  Readonly<{
    axis: "numeric_evidence";
    canonicalEmployer: string | null;
    sourceText: string;
    sourceMetrics: readonly string[];
    sourceEntities: readonly string[];
    visibleText: string;
    expectedUnsupportedMetrics: readonly string[];
  }>;

export type EnglishProseCharacterizationCase = CharacterizationCaseBase &
  Readonly<{
    axis: "english_prose";
    visibleText: string;
    expectedIncomplete: boolean;
    expectedAnalyses?: readonly Readonly<{
      sentenceSpan: Readonly<{ start: number; end: number }>;
      classification: "VALID" | "INVALID" | "UNKNOWN";
      confidence: "high" | "medium" | "low";
      reasonCodes: readonly string[];
      subjectSpan: Readonly<{ start: number; end: number }> | null;
      finitePredicateSpan: Readonly<{ start: number; end: number }> | null;
      infinitiveSpans: readonly Readonly<{ start: number; end: number }>[];
    }>[];
  }>;

export type EnglishQualityGateCharacterizationCase =
  | TargetEmployerCharacterizationCase
  | NumericEvidenceCharacterizationCase
  | EnglishProseCharacterizationCase;

const targetEmployerCases: readonly TargetEmployerCharacterizationCase[] = [
  {
    id: "p2-employer-job-level-em-dash",
    provenance: "P2",
    pairId: "employer-job-level",
    axis: "target_employer",
    canonicalEmployer: "Acme",
    jobTitle: "Software Engineer — Level 3",
    jobDescription: "Build reliable platform services.",
    expectedEmployerName: "Acme",
  },
  {
    id: "p2-employer-job-level-case-variation",
    provenance: "PR349",
    pairId: "employer-job-level",
    axis: "target_employer",
    canonicalEmployer: "Acme",
    jobTitle: "SOFTWARE ENGINEER - LEVEL 3",
    jobDescription: "Build reliable platform services.",
    expectedEmployerName: "Acme",
  },
  {
    id: "p2-employer-heading-before-authority",
    provenance: "P2",
    pairId: "employer-heading",
    axis: "target_employer",
    canonicalEmployer: "Acme",
    jobTitle: "Software Engineer",
    jobDescription: "Join Our Engineering Team. Work at Acme Corp.",
    expectedEmployerName: "Acme",
  },
  {
    id: "p2-employer-heading-punctuation-variation",
    provenance: "PR349",
    pairId: "employer-heading",
    axis: "target_employer",
    canonicalEmployer: "Acme",
    jobTitle: "Software Engineer",
    jobDescription: "JOIN OUR ENGINEERING TEAM! Work at Acme Corp.",
    expectedEmployerName: "Acme",
  },
  {
    id: "history-employer-explicit-at-minimal-pair",
    provenance: "PR347",
    pairId: "employer-explicit-at",
    axis: "target_employer",
    canonicalEmployer: "Acme",
    jobTitle: "Software Engineer at Acme",
    jobDescription: "Build reliable platform services.",
    expectedEmployerName: "Acme",
  },
  {
    id: "history-employer-explicit-at-punctuation-variation",
    provenance: "PR347",
    pairId: "employer-explicit-at",
    axis: "target_employer",
    canonicalEmployer: "Acme",
    jobTitle: "Software Engineer at Acme.",
    jobDescription: "Build reliable platform services.",
    expectedEmployerName: "Acme",
  },
  {
    id: "history-employer-missing-fails-safe",
    provenance: "PR347",
    pairId: "employer-missing",
    axis: "target_employer",
    canonicalEmployer: null,
    jobTitle: "Software Engineer",
    jobDescription: "Build reliable platform services.",
    expectedEmployerName: null,
  },
  {
    id: "history-employer-missing-case-variation",
    provenance: "PR347",
    pairId: "employer-missing",
    axis: "target_employer",
    canonicalEmployer: null,
    jobTitle: "SOFTWARE ENGINEER",
    jobDescription: "BUILD RELIABLE PLATFORM SERVICES.",
    expectedEmployerName: null,
  },
  {
    id: "p2-employer-numeric-only-authority",
    provenance: "P2",
    pairId: "numeric-only-employer",
    axis: "target_employer",
    canonicalEmployer: "99",
    jobTitle: "Data Analyst",
    jobDescription: "Maintain reliable delivery reporting.",
    expectedEmployerName: "99",
  },
];

const numericEvidenceCases: readonly NumericEvidenceCharacterizationCase[] = [
  {
    id: "p1-numeric-context-100m-unstructured",
    provenance: "P1",
    pairId: "numeric-100m-authority",
    axis: "numeric_evidence",
    canonicalEmployer: null,
    sourceText: "Maintained weekly reporting for delivery teams.",
    sourceMetrics: [],
    sourceEntities: ["weekly reporting", "delivery teams"],
    visibleText: "At 100M, that reporting supports clear delivery handoffs.",
    expectedUnsupportedMetrics: ["100000000"],
  },
  {
    id: "p1-numeric-context-100m-structured",
    provenance: "P1",
    pairId: "numeric-100m-authority",
    axis: "numeric_evidence",
    canonicalEmployer: null,
    sourceText: "Maintained reporting at 100M for delivery teams.",
    sourceMetrics: [],
    sourceEntities: ["100M", "delivery teams"],
    visibleText: "At 100M, that reporting supports clear delivery handoffs.",
    expectedUnsupportedMetrics: [],
  },
  {
    id: "p2-duration-three-day-paraphrase",
    provenance: "P2",
    pairId: "numeric-three-day-duration",
    axis: "numeric_evidence",
    canonicalEmployer: null,
    sourceText: "Completed a 3-Day Training Program.",
    sourceMetrics: ["3-Day"],
    sourceEntities: ["Training Program"],
    visibleText:
      "That three-day training program supports clear delivery handoffs.",
    expectedUnsupportedMetrics: [],
  },
  {
    id: "p2-duration-three-day-case-punctuation",
    provenance: "PR349",
    pairId: "numeric-three-day-duration",
    axis: "numeric_evidence",
    canonicalEmployer: null,
    sourceText: "Completed a 3-day training program.",
    sourceMetrics: ["3-day"],
    sourceEntities: ["training program"],
    visibleText: "That THREE-DAY training program supports delivery.",
    expectedUnsupportedMetrics: [],
  },
  {
    id: "p2-brand-7-eleven-legal-suffix",
    provenance: "P2",
    pairId: "numeric-brand-legal-suffix",
    axis: "numeric_evidence",
    canonicalEmployer: "7-Eleven Inc.",
    sourceText: "Maintained reliable delivery handoffs.",
    sourceMetrics: [],
    sourceEntities: ["delivery handoffs"],
    visibleText: "7-Eleven offers clear delivery handoffs.",
    expectedUnsupportedMetrics: [],
  },
  {
    id: "p2-brand-7-eleven-case-punctuation",
    provenance: "PR349",
    pairId: "numeric-brand-legal-suffix",
    axis: "numeric_evidence",
    canonicalEmployer: "7-Eleven, Inc.",
    sourceText: "Maintained reliable delivery reporting.",
    sourceMetrics: [],
    sourceEntities: ["delivery reporting"],
    visibleText: "At 7-ELEVEN, reporting supports delivery.",
    expectedUnsupportedMetrics: [],
  },
  {
    id: "p2-employer-99-authorized",
    provenance: "P2",
    pairId: "numeric-only-employer",
    axis: "numeric_evidence",
    canonicalEmployer: "99",
    sourceText: "Maintained reliable delivery reporting.",
    sourceMetrics: [],
    sourceEntities: ["delivery reporting"],
    visibleText: "At 99, that reporting supports clear delivery handoffs.",
    expectedUnsupportedMetrics: [],
  },
  {
    id: "p2-employer-99-elsewhere-is-metric",
    provenance: "P2",
    pairId: "numeric-only-employer",
    axis: "numeric_evidence",
    canonicalEmployer: null,
    sourceText: "Maintained weekly reporting for delivery teams.",
    sourceMetrics: [],
    sourceEntities: ["delivery teams"],
    visibleText: "I maintained 99 weekly reports for delivery teams.",
    expectedUnsupportedMetrics: ["99"],
  },
];

const englishProseCases: readonly EnglishProseCharacterizationCase[] = [
  {
    id: "p1-prose-make-teams-grow-fragment",
    provenance: "P1",
    pairId: "prose-infinitive-fragment",
    axis: "english_prose",
    visibleText: "Managed client reporting to make teams grow.",
    expectedIncomplete: true,
    expectedAnalyses: [
      {
        sentenceSpan: { start: 0, end: 44 },
        classification: "INVALID",
        confidence: "high",
        reasonCodes: ["verb_led_fragment", "missing_finite_predicate"],
        subjectSpan: null,
        finitePredicateSpan: null,
        infinitiveSpans: [{ start: 25, end: 43 }],
      },
    ],
  },
  {
    id: "history-prose-help-teams-grow-fragment",
    provenance: "PR347",
    pairId: "prose-infinitive-fragment",
    axis: "english_prose",
    visibleText: "Managed client reporting to help teams grow.",
    expectedIncomplete: true,
  },
  {
    id: "p2-prose-main-predicate-after-infinitive",
    provenance: "P2",
    pairId: "prose-main-predicate",
    axis: "english_prose",
    visibleText:
      "Managed services to help teams scale are central to reliable delivery.",
    expectedIncomplete: false,
    expectedAnalyses: [
      {
        sentenceSpan: { start: 0, end: 70 },
        classification: "VALID",
        confidence: "high",
        reasonCodes: [
          "finite_predicate",
          "modified_subject",
          "bounded_infinitive",
          "main_finite_predicate_after_infinitive",
        ],
        subjectSpan: { start: 0, end: 16 },
        finitePredicateSpan: { start: 37, end: 40 },
        infinitiveSpans: [{ start: 17, end: 36 }],
      },
    ],
  },
  {
    id: "p2-prose-main-predicate-case-punctuation",
    provenance: "PR349",
    pairId: "prose-main-predicate",
    axis: "english_prose",
    visibleText:
      "MANAGED services—to help teams scale—are central to reliable delivery!",
    expectedIncomplete: false,
  },
  {
    id: "p2-prose-main-predicate-removed-minimal-pair",
    provenance: "PR349",
    pairId: "prose-main-predicate",
    axis: "english_prose",
    visibleText: "Managed services to help teams scale.",
    expectedIncomplete: false,
  },
  {
    id: "history-prose-finite-subject-control",
    provenance: "PR347",
    pairId: "prose-finite-control",
    axis: "english_prose",
    visibleText: "I managed services to help teams scale.",
    expectedIncomplete: false,
  },
  {
    id: "history-prose-finite-subject-punctuation-variation",
    provenance: "PR347",
    pairId: "prose-finite-control",
    axis: "english_prose",
    visibleText: "I managed services—to help teams scale!",
    expectedIncomplete: false,
  },
  {
    id: "pr-d-prose-abbreviations-corp-us",
    provenance: "P2",
    pairId: "prose-abbreviation-segmentation",
    axis: "english_prose",
    visibleText: "Example Corp. shipped results. U.S. teams coordinated work.",
    expectedIncomplete: false,
    expectedAnalyses: [
      {
        sentenceSpan: { start: 0, end: 30 },
        classification: "VALID",
        confidence: "high",
        reasonCodes: ["finite_predicate", "modified_subject"],
        subjectSpan: { start: 0, end: 13 },
        finitePredicateSpan: { start: 14, end: 21 },
        infinitiveSpans: [],
      },
      {
        sentenceSpan: { start: 31, end: 59 },
        classification: "VALID",
        confidence: "high",
        reasonCodes: ["finite_predicate", "modified_subject"],
        subjectSpan: { start: 31, end: 41 },
        finitePredicateSpan: { start: 42, end: 53 },
        infinitiveSpans: [],
      },
    ],
  },
  {
    id: "pr-d-prose-abbreviation-co",
    provenance: "P2",
    pairId: "prose-abbreviation-segmentation",
    axis: "english_prose",
    visibleText: "Acme Co. delivered reports.",
    expectedIncomplete: false,
    expectedAnalyses: [
      {
        sentenceSpan: { start: 0, end: 27 },
        classification: "VALID",
        confidence: "high",
        reasonCodes: ["finite_predicate", "modified_subject"],
        subjectSpan: { start: 0, end: 8 },
        finitePredicateSpan: { start: 9, end: 18 },
        infinitiveSpans: [],
      },
    ],
  },
  {
    id: "pr-d-prose-simple-subject",
    provenance: "P2",
    pairId: "prose-subject-shapes",
    axis: "english_prose",
    visibleText: "Teams deliver results.",
    expectedIncomplete: false,
    expectedAnalyses: [
      {
        sentenceSpan: { start: 0, end: 22 },
        classification: "VALID",
        confidence: "high",
        reasonCodes: ["finite_predicate", "simple_subject"],
        subjectSpan: { start: 0, end: 5 },
        finitePredicateSpan: { start: 6, end: 13 },
        infinitiveSpans: [],
      },
    ],
  },
  {
    id: "pr-d-prose-modified-subject",
    provenance: "P2",
    pairId: "prose-subject-shapes",
    axis: "english_prose",
    visibleText: "The experienced teams deliver results.",
    expectedIncomplete: false,
    expectedAnalyses: [
      {
        sentenceSpan: { start: 0, end: 38 },
        classification: "VALID",
        confidence: "high",
        reasonCodes: ["finite_predicate", "modified_subject"],
        subjectSpan: { start: 0, end: 21 },
        finitePredicateSpan: { start: 22, end: 29 },
        infinitiveSpans: [],
      },
    ],
  },
  {
    id: "pr-d-prose-coordinated-subject",
    provenance: "P2",
    pairId: "prose-subject-shapes",
    axis: "english_prose",
    visibleText: "I and my colleague managed reporting.",
    expectedIncomplete: false,
    expectedAnalyses: [
      {
        sentenceSpan: { start: 0, end: 37 },
        classification: "VALID",
        confidence: "high",
        reasonCodes: ["finite_predicate", "coordinated_subject"],
        subjectSpan: { start: 0, end: 18 },
        finitePredicateSpan: { start: 19, end: 26 },
        infinitiveSpans: [],
      },
    ],
  },
  {
    id: "pr-d-prose-relative-clause",
    provenance: "P2",
    pairId: "prose-clause-bounds",
    axis: "english_prose",
    visibleText: "The teams that managed reporting improved delivery.",
    expectedIncomplete: false,
    expectedAnalyses: [
      {
        sentenceSpan: { start: 0, end: 51 },
        classification: "VALID",
        confidence: "high",
        reasonCodes: [
          "finite_predicate",
          "modified_subject",
          "relative_clause",
        ],
        subjectSpan: { start: 0, end: 9 },
        finitePredicateSpan: { start: 33, end: 41 },
        infinitiveSpans: [],
      },
    ],
  },
  {
    id: "pr-d-prose-bounded-infinitive-clause",
    provenance: "P2",
    pairId: "prose-clause-bounds",
    axis: "english_prose",
    visibleText:
      "Teams work to improve delivery while managers review results.",
    expectedIncomplete: false,
    expectedAnalyses: [
      {
        sentenceSpan: { start: 0, end: 61 },
        classification: "VALID",
        confidence: "high",
        reasonCodes: [
          "finite_predicate",
          "simple_subject",
          "bounded_infinitive",
        ],
        subjectSpan: { start: 0, end: 5 },
        finitePredicateSpan: { start: 6, end: 10 },
        infinitiveSpans: [{ start: 11, end: 30 }],
      },
    ],
  },
  {
    id: "pr-d-prose-imperative-form",
    provenance: "P2",
    pairId: "prose-policy-disposition",
    axis: "english_prose",
    visibleText: "Submit reports promptly.",
    expectedIncomplete: false,
    expectedAnalyses: [
      {
        sentenceSpan: { start: 0, end: 24 },
        classification: "VALID",
        confidence: "high",
        reasonCodes: ["imperative_form"],
        subjectSpan: null,
        finitePredicateSpan: { start: 0, end: 6 },
        infinitiveSpans: [],
      },
    ],
  },
  {
    id: "pr-d-prose-unknown-observation",
    provenance: "P2",
    pairId: "prose-policy-disposition",
    axis: "english_prose",
    visibleText: "Aligned for delivery.",
    expectedIncomplete: false,
    expectedAnalyses: [
      {
        sentenceSpan: { start: 0, end: 21 },
        classification: "UNKNOWN",
        confidence: "low",
        reasonCodes: ["ambiguous_clause_structure"],
        subjectSpan: null,
        finitePredicateSpan: null,
        infinitiveSpans: [],
      },
    ],
  },
];

export const ENGLISH_QUALITY_GATE_CHARACTERIZATION_CASES: readonly EnglishQualityGateCharacterizationCase[] =
  [...targetEmployerCases, ...numericEvidenceCases, ...englishProseCases];
