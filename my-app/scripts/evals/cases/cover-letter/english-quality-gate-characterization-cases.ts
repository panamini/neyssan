export const ENGLISH_QUALITY_GATE_KNOWN_FAILURE_IDS = [
  "p2-job-level-not-employer",
  "p2-heading-not-employer",
  "p2-hyphenated-duration-paraphrase",
  "p2-numeric-brand-legal-suffix",
  "p2-numeric-only-employer",
] as const;

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
] as const;

export const ENGLISH_QUALITY_GATE_EXPECTED_DIVERGENT_CASE_IDS = [
  "p2-employer-job-level-em-dash",
  "p2-employer-job-level-case-variation",
  "p2-employer-heading-before-authority",
  "p2-employer-heading-punctuation-variation",
  "p2-employer-numeric-only-authority",
  "p2-duration-three-day-paraphrase",
  "p2-duration-three-day-case-punctuation",
  "p2-brand-7-eleven-legal-suffix",
] as const;

export const ENGLISH_QUALITY_GATE_EXPECTED_DIVERGENT_OBSERVATIONS = {
  "p2-employer-job-level-em-dash": "null",
  "p2-employer-job-level-case-variation": "null",
  "p2-employer-heading-before-authority": '"Acme Corp."',
  "p2-employer-heading-punctuation-variation": '"Acme Corp."',
  "p2-employer-numeric-only-authority": "null",
  "p2-duration-three-day-paraphrase": '["3"]',
  "p2-duration-three-day-case-punctuation": '["3"]',
  "p2-brand-7-eleven-legal-suffix": '["11","7"]',
} as const satisfies Readonly<
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
    knownFailureId: "p2-job-level-not-employer",
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
    knownFailureId: "p2-job-level-not-employer",
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
    knownFailureId: "p2-heading-not-employer",
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
    knownFailureId: "p2-heading-not-employer",
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
    expectedEmployerName: "Acme.",
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
    knownFailureId: "p2-numeric-only-employer",
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
    knownFailureId: "p2-hyphenated-duration-paraphrase",
    axis: "numeric_evidence",
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
    knownFailureId: "p2-hyphenated-duration-paraphrase",
    axis: "numeric_evidence",
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
    knownFailureId: "p2-numeric-brand-legal-suffix",
    axis: "numeric_evidence",
    sourceText: "Target employer: 7-Eleven Inc.",
    sourceMetrics: [],
    sourceEntities: ["7-Eleven Inc."],
    visibleText: "7-Eleven offers clear delivery handoffs.",
    expectedUnsupportedMetrics: [],
  },
  {
    id: "p2-brand-7-eleven-case-punctuation",
    provenance: "PR349",
    pairId: "numeric-brand-legal-suffix",
    axis: "numeric_evidence",
    sourceText: "Target employer: 7-Eleven, Inc.",
    sourceMetrics: [],
    sourceEntities: ["7-Eleven, Inc."],
    visibleText: "At 7-ELEVEN, reporting supports delivery.",
    expectedUnsupportedMetrics: [],
  },
  {
    id: "p2-employer-99-authorized",
    provenance: "P2",
    pairId: "numeric-only-employer",
    axis: "numeric_evidence",
    sourceText: "Target employer: 99.",
    sourceMetrics: [],
    sourceEntities: ["99"],
    visibleText: "At 99, that reporting supports clear delivery handoffs.",
    expectedUnsupportedMetrics: [],
  },
  {
    id: "p2-employer-99-elsewhere-is-metric",
    provenance: "P2",
    pairId: "numeric-only-employer",
    axis: "numeric_evidence",
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
];

export const ENGLISH_QUALITY_GATE_CHARACTERIZATION_CASES: readonly EnglishQualityGateCharacterizationCase[] =
  [...targetEmployerCases, ...numericEvidenceCases, ...englishProseCases];
