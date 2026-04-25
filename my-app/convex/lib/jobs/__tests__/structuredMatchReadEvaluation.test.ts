import { describe, expect, it } from "vitest";

import { computeMatchRead, type MatchReadTier } from "../matchRead";
import {
  buildStructuredMatchReadDebug,
  type JobRequirementEntity,
  type StructuredMatchReadDebug,
  type StructuredMatchReadShadowRow,
} from "../structuredMatchRead";
import type { NormalizedJobExtraction } from "../jobExtractionSchema";

type EvaluationFamily =
  | "retail_service"
  | "security_licensed"
  | "technical"
  | "admin_office"
  | "healthcare_regulated"
  | "short_noisy"
  | "long_duplicated_scrape"
  | "multilingual"
  | "negative_control";

type ManualExpectedLabel =
  | "good_fit"
  | "partial_fit"
  | "weak_fit"
  | "insufficient_data";

type StructuredEvaluationRow = {
  fixtureId: string;
  family: EvaluationFamily;
  oldScore: number | null;
  oldTier: MatchReadTier | null;
  oldProfileKeywordCount: number;
  oldProfileKeywordJunkExamples: string[];
  oldDerivedKeywordJunkExamples: string[];
  oldMissingMetadataExamples: string[];
  oldSummaryLooksCandidateCentric: boolean;
  structuredScore: number | null;
  structuredTier: MatchReadTier | null;
  structuredJobRequirementLabels: string[];
  structuredProfileEvidenceSources: string[];
  structuredMetadataLeakCount: number;
  structuredMatchedEvidenceLabels: string[];
  structuredUnknownLabels: string[];
  matchedCount: number;
  partialCount: number;
  missingCount: number;
  unknownCount: number;
  metadataLeakCount: number;
  provenanceComplete: boolean;
  manualExpectedLabel: ManualExpectedLabel;
};

type EvaluationFixture = {
  fixtureId: string;
  family: EvaluationFamily;
  manualExpectedLabel: ManualExpectedLabel;
  extraction: NormalizedJobExtraction;
  profile: Record<string, unknown>;
  oldSignals: string[];
  rawLanguageDetected?: string | null;
  metadataTerms?: string[];
  oldProfileKeywords?: string[];
  oldDerivedKeywords?: string[];
  oldSummary?: string;
};

const MODEL = "mistral-small-latest";
const PROMPT_VERSION = "p9_v1";
const OLD_KEYWORD_JUNK_EXAMPLES = [
  "safety",
  "conscious",
  "attentive",
  "eight",
  "years",
  "possible",
  "nonh",
] as const;
const OLD_METADATA_EXAMPLES = ["location", "status", "compensation"] as const;
const STRUCTURED_METADATA_EXCLUSIONS = [
  "location",
  "status",
  "compensation",
  "miami",
  "design",
  "district",
  "store",
] as const;

function extraction(overrides: Partial<NormalizedJobExtraction>): NormalizedJobExtraction {
  const { environment, ...rest } = overrides;
  const base: NormalizedJobExtraction = {
    summary_short: "Structured evaluation fixture.",
    role_title_normalized: "Role",
    requirements: [],
    keywords_canonical: [],
    licenses_or_certifications: [],
    schedule_constraints: [],
    environment: {
      customer_facing: null,
      retail: null,
      physical_standing: null,
      onsite: null,
    },
    confidence: "high",
  };
  return {
    ...base,
    ...rest,
    environment: {
      ...base.environment,
      ...environment,
    },
  };
}

function shadowRow(output: NormalizedJobExtraction): StructuredMatchReadShadowRow {
  return {
    llm_normalized_output: output,
    validation_status: "valid",
    fallback_used: false,
    model: MODEL,
    prompt_version: PROMPT_VERSION,
    created_at: 100,
  };
}

const robertSecurityProfile = {
  _id: "c2c9c19c-f6cc-4cf6-b23c-c0c970b428bf",
  profileId: "c2c9c19c-f6cc-4cf6-b23c-c0c970b428bf",
  summary:
    "Safety conscious Security Guard with eight years experience in protecting VIP individuals and defense sites.",
  skills: [
    "Investigation skills",
    "Safety compliance",
    "Criminal justice knowledge",
  ],
  keywords: ["investigation skills", "safety compliance"],
  experience: [
    {
      company: "ADT Security",
      title: "Security Guard",
      description:
        "Completed reports by recording observations, occurrences, surveillance activities, and interviewing witnesses.",
    },
    {
      company: "Copwatch",
      title: "Security Guard",
      description:
        "Monitored selected areas via CCTV app on smart devices and scanned grounds for suspicious items.",
    },
  ],
  raw_text:
    "Security Guard Certificate Program (SOCP). Course Curriculum: Report Writing, Criminal Profiling, Interviewing Techniques, Crisis Intervention.",
  cvDocument: {
    metadata: {
      authoritativeResume: {
        normalized: {
          profile: { desiredPosition: "Security Guard" },
          certifications: [
            { certificationName: "Certified Protection Guard Program (CPOP)" },
            { certificationName: "Security Guard Certificate Program (SOCP)" },
            { certificationName: "S.A.F.E. Approach Level II Training" },
          ],
          education: [
            {
              degree: "S.A.F.E. Approach Level II Training",
              description:
                "Course Curriculum: Law Enforcement Ethics, Report Writing, Criminal Profiling, Interviewing Techniques, Crisis Intervention.",
            },
          ],
          languages: [{ name: "English" }],
        },
      },
    },
  },
};

const fixtures: EvaluationFixture[] = [
  {
    fixtureId: "security_kith_robert",
    family: "security_licensed",
    manualExpectedLabel: "good_fit",
    rawLanguageDetected: "en",
    metadataTerms: [
      "location",
      "miami",
      "design",
      "district",
      "store",
      "status",
      "part-time",
      "compensation",
    ],
    extraction: extraction({
      summary_short:
        "Security Guard role overseeing entry, crowd management, loss prevention, and customer safety.",
      role_title_normalized: "Security Guard",
      requirements: [
        { value: "security guard license", type: "certification", required: true },
        { value: "crowd management", type: "skill", required: true },
        { value: "de-escalation", type: "skill", required: true },
        { value: "customer-facing retail experience", type: "experience", required: true },
      ],
      keywords_canonical: ["security guard", "loss prevention", "customer safety"],
      licenses_or_certifications: ["security guard license"],
      schedule_constraints: ["weekends and holidays"],
      environment: { customer_facing: true, retail: true, physical_standing: true, onsite: true },
    }),
    profile: robertSecurityProfile,
    oldProfileKeywords: [
      "safety",
      "conscious",
      "attentive",
      "eight",
      "years",
      "possible",
      "nonh",
      "investigation skills",
      "safety compliance",
    ],
    oldDerivedKeywords: ["safety", "conscious", "eight", "years", "nonh"],
    oldSummary: robertSecurityProfile.summary,
    oldSignals: [
      "location",
      "miami",
      "design",
      "district",
      "store",
      "status",
      "part-time",
      "compensation",
    ],
  },
  {
    fixtureId: "retail_service_associate",
    family: "retail_service",
    manualExpectedLabel: "good_fit",
    rawLanguageDetected: "en",
    metadataTerms: [
      "posted",
      "benefits",
      "apply now",
      "employee discount",
      "kith brand story",
      "source platform",
      "join our team",
      "great place to work",
      "compensation",
      "location",
    ],
    extraction: extraction({
      summary_short: "Retail Associate role focused on customer service and inventory support.",
      role_title_normalized: "Retail Associate",
      requirements: [
        { value: "customer service", type: "skill", required: true },
        { value: "cash handling", type: "skill", required: true },
        { value: "inventory restocking", type: "skill", required: false },
        { value: "employee discount and benefits package", type: "skill", required: false },
        { value: "Kith brand story and culture", type: "skill", required: false },
        { value: "source platform: Greenhouse", type: "skill", required: false },
        { value: "join our team and enjoy a great place to work", type: "skill", required: false },
        { value: "compensation $18/hr", type: "skill", required: false },
        { value: "Miami store location", type: "skill", required: false },
      ],
      keywords_canonical: ["customer service", "cash handling", "inventory"],
      schedule_constraints: ["weekend availability"],
      environment: { customer_facing: true, retail: true, physical_standing: true, onsite: true },
    }),
    profile: {
      _id: "profile_retail_service",
      summary: "Retail associate with customer service, cash handling, and restocking experience.",
      skills: ["customer service", "cash handling", "inventory restocking"],
      keywords: ["customer service", "cash handling"],
      experience: [
        {
          company: "City Market",
          title: "Retail Associate",
          description:
            "Helped customers, operated cash drawer, and restocked floor inventory.",
        },
      ],
    },
    oldSignals: ["posted", "benefits", "apply now"],
  },
  {
    fixtureId: "technical_frontend_engineer",
    family: "technical",
    manualExpectedLabel: "good_fit",
    rawLanguageDetected: "en",
    extraction: extraction({
      summary_short: "Frontend Engineer role building React and TypeScript interfaces.",
      role_title_normalized: "Frontend Engineer",
      requirements: [
        { value: "React", type: "skill", required: true },
        { value: "TypeScript", type: "skill", required: true },
        { value: "API integration", type: "skill", required: true },
        { value: "Next.js", type: "skill", required: false },
      ],
      keywords_canonical: ["React", "TypeScript", "API integration", "Next.js"],
      environment: { onsite: false },
    }),
    profile: {
      _id: "profile_frontend",
      headline: "Frontend Engineer",
      summary: "Frontend engineer focused on React, TypeScript, and API integration.",
      skills: ["React", "TypeScript", "API integration", "Next.js"],
      keywords: ["React", "TypeScript"],
      experience: [
        {
          company: "Product Studio",
          title: "Frontend Engineer",
          description:
            "Built React and TypeScript interfaces connected to REST API services.",
        },
      ],
      projects: ["Next.js dashboard for customer onboarding"],
    },
    oldSignals: ["react", "typescript", "api integration"],
  },
  {
    fixtureId: "admin_office_coordinator",
    family: "admin_office",
    manualExpectedLabel: "partial_fit",
    rawLanguageDetected: "en",
    extraction: extraction({
      summary_short: "Office Coordinator role supporting scheduling, vendors, and reporting.",
      role_title_normalized: "Office Coordinator",
      requirements: [
        { value: "calendar management", type: "skill", required: true },
        { value: "Microsoft Excel", type: "skill", required: true },
        { value: "vendor communication", type: "skill", required: true },
        { value: "grant writing", type: "skill", required: false },
      ],
      keywords_canonical: ["calendar management", "Microsoft Excel", "vendor communication"],
    }),
    profile: {
      _id: "profile_admin",
      summary: "Administrative coordinator supporting calendars, vendors, and office reports.",
      skills: ["calendar management", "Microsoft Excel", "vendor communication"],
      keywords: ["calendar management", "Excel"],
      experience: [
        {
          company: "Bright Office",
          title: "Administrative Coordinator",
          description:
            "Managed executive calendars, vendor communication, and weekly Excel reporting.",
        },
      ],
    },
    oldSignals: ["office", "calendar", "excel"],
  },
  {
    fixtureId: "healthcare_medical_assistant",
    family: "healthcare_regulated",
    manualExpectedLabel: "good_fit",
    rawLanguageDetected: "en",
    extraction: extraction({
      summary_short: "Medical Assistant role requiring certification and patient intake.",
      role_title_normalized: "Medical Assistant",
      requirements: [
        { value: "medical assistant certification", type: "certification", required: true },
        { value: "patient intake", type: "skill", required: true },
        { value: "HIPAA compliance", type: "skill", required: true },
      ],
      keywords_canonical: ["medical assistant", "patient intake", "HIPAA"],
      licenses_or_certifications: ["medical assistant certification"],
      environment: { customer_facing: true, onsite: true },
    }),
    profile: {
      _id: "profile_medical_assistant",
      summary: "Certified medical assistant with patient intake and HIPAA compliance experience.",
      skills: ["patient intake", "HIPAA compliance", "vital signs"],
      keywords: ["patient intake", "HIPAA"],
      certifications: ["medical assistant certification"],
      experience: [
        {
          company: "Community Clinic",
          title: "Medical Assistant",
          description:
            "Handled patient intake, vital signs, and HIPAA-compliant chart updates.",
        },
      ],
    },
    oldSignals: ["patient intake", "HIPAA"],
  },
  {
    fixtureId: "short_noisy_cashier",
    family: "short_noisy",
    manualExpectedLabel: "partial_fit",
    rawLanguageDetected: "en",
    metadataTerms: ["location: miami", "apply now"],
    extraction: extraction({
      summary_short: "Short cashier posting with one real requirement.",
      role_title_normalized: "Cashier",
      requirements: [
        { value: "Location: Miami", type: "constraint", required: true },
        { value: "Apply now", type: "constraint", required: false },
        { value: "cash handling", type: "skill", required: true },
      ],
      keywords_canonical: ["cash handling"],
      environment: { customer_facing: true, retail: true, onsite: true },
    }),
    profile: {
      _id: "profile_cashier",
      summary: "Cashier with cash handling and customer service experience.",
      skills: ["cash handling", "customer service"],
      keywords: ["cash handling"],
      experience: [
        {
          company: "Corner Shop",
          title: "Cashier",
          description: "Handled cash drawer and served customers during peak hours.",
        },
      ],
    },
    oldSignals: ["location", "miami", "apply now"],
  },
  {
    fixtureId: "long_duplicated_scrape_inventory",
    family: "long_duplicated_scrape",
    manualExpectedLabel: "good_fit",
    rawLanguageDetected: "en",
    metadataTerms: ["equal opportunity", "benefits package", "compensation"],
    extraction: extraction({
      summary_short:
        "Long duplicated scrape with inventory requirements and repeated boilerplate.",
      role_title_normalized: "Inventory Specialist",
      requirements: [
        {
          value: "Equal opportunity employer equal opportunity employer apply now",
          type: "constraint",
          required: false,
        },
        { value: "benefits package", type: "constraint", required: false },
        { value: "compensation $18/hr", type: "constraint", required: false },
        { value: "inventory management", type: "skill", required: true },
        { value: "stockroom operations", type: "skill", required: true },
      ],
      keywords_canonical: ["inventory management", "stockroom operations"],
      environment: { onsite: true },
    }),
    profile: {
      _id: "profile_inventory",
      summary: "Inventory specialist with stockroom operations and inventory management.",
      skills: ["inventory management", "stockroom operations"],
      keywords: ["inventory management", "stockroom"],
      experience: [
        {
          company: "Warehouse Team",
          title: "Inventory Specialist",
          description:
            "Maintained inventory counts and coordinated stockroom operations.",
        },
      ],
    },
    oldSignals: ["benefits", "equal opportunity", "compensation"],
  },
  {
    fixtureId: "multilingual_fr_support",
    family: "multilingual",
    manualExpectedLabel: "good_fit",
    rawLanguageDetected: "fr",
    metadataTerms: ["candidature", "lieu"],
    extraction: extraction({
      summary_short: "Poste de support client avec suivi des demandes.",
      role_title_normalized: "Charge de support client",
      requirements: [
        { value: "support client", type: "skill", required: true },
        { value: "gestion des demandes", type: "skill", required: true },
        { value: "Francais courant", type: "language", required: true },
      ],
      keywords_canonical: ["support client", "gestion des demandes", "Francais"],
      environment: { customer_facing: true, onsite: false },
    }),
    profile: {
      _id: "profile_support_fr",
      headline: "Charge de support client",
      summary: "Support client avec gestion des demandes et communication en Francais.",
      skills: ["support client", "gestion des demandes"],
      keywords: ["support client", "gestion demandes"],
      languages: ["Francais courant"],
      experience: [
        {
          company: "Service Paris",
          title: "Charge de support client",
          description:
            "Traitement du support client et gestion des demandes entrantes.",
        },
      ],
    },
    oldSignals: ["support client", "gestion demandes"],
  },
  {
    fixtureId: "negative_control_frontend_vs_food_service",
    family: "negative_control",
    manualExpectedLabel: "weak_fit",
    rawLanguageDetected: "en",
    extraction: extraction({
      summary_short: "Frontend Engineer role building React and TypeScript interfaces.",
      role_title_normalized: "Frontend Engineer",
      requirements: [
        { value: "React", type: "skill", required: true },
        { value: "TypeScript", type: "skill", required: true },
        { value: "API integration", type: "skill", required: true },
      ],
      keywords_canonical: ["React", "TypeScript", "API integration"],
      environment: { onsite: false },
    }),
    profile: {
      _id: "profile_food_service",
      summary: "Food service worker with cashier, prep, and customer counter experience.",
      skills: ["cash handling", "food prep", "customer service"],
      keywords: ["cashier", "food prep"],
      experience: [
        {
          company: "Quick Lunch",
          title: "Food Service Worker",
          description:
            "Prepared orders, handled cash drawer, and cleaned the customer counter.",
        },
      ],
    },
    oldSignals: ["react", "typescript", "api integration"],
  },
];

const expectedOldScorerByFixture: Record<
  string,
  { oldScore: number | null; oldTier: MatchReadTier }
> = {
  security_kith_robert: { oldScore: 0, oldTier: "weak" },
  retail_service_associate: { oldScore: 0, oldTier: "weak" },
  technical_frontend_engineer: { oldScore: 100, oldTier: "strong" },
  admin_office_coordinator: { oldScore: 67, oldTier: "partial" },
  healthcare_medical_assistant: { oldScore: 100, oldTier: "strong" },
  short_noisy_cashier: { oldScore: 0, oldTier: "weak" },
  long_duplicated_scrape_inventory: { oldScore: 0, oldTier: "weak" },
  multilingual_fr_support: { oldScore: 100, oldTier: "strong" },
  negative_control_frontend_vs_food_service: { oldScore: 0, oldTier: "weak" },
};

function oldMatchForFixture(fixture: EvaluationFixture) {
  const profileSkills = Array.isArray(fixture.profile.skills)
    ? (fixture.profile.skills as string[])
    : [];
  const profileKeywords = Array.isArray(fixture.profile.keywords)
    ? (fixture.profile.keywords as string[])
    : profileSkills;

  return computeMatchRead({
    now: 1234,
    profile: {
      id: String(fixture.profile._id ?? fixture.fixtureId),
      skills: profileSkills,
      keywords: profileKeywords,
    },
    job: {
      id: fixture.fixtureId,
      parseStatus: "parsed",
      mustHaves: [],
      keywords: fixture.oldSignals,
      mustHavesExtraction: [],
      keywordsExtraction: fixture.oldSignals.map((value, index) => ({
        value,
        confidence: 0.5,
        sourceSpan: { start: index, end: index + value.length },
      })),
    },
  });
}

function evaluateFixture(fixture: EvaluationFixture): {
  row: StructuredEvaluationRow;
  debug: StructuredMatchReadDebug;
} {
  const old = oldMatchForFixture(fixture);
  const debug = buildStructuredMatchReadDebug({
    old,
    job: {
      id: fixture.fixtureId,
      rawLanguageDetected: fixture.rawLanguageDetected,
    },
    profile: fixture.profile,
    shadowRows: [shadowRow(fixture.extraction)],
    model: MODEL,
    promptVersion: PROMPT_VERSION,
  });

  if (debug.structured.status !== "available") {
    return {
      debug,
      row: {
        fixtureId: fixture.fixtureId,
        family: fixture.family,
        oldScore: old.score,
        oldTier: old.tier,
        oldProfileKeywordCount: getOldProfileKeywords(fixture).length,
        oldProfileKeywordJunkExamples: keywordExamples(
          getOldProfileKeywords(fixture),
          OLD_KEYWORD_JUNK_EXAMPLES,
        ),
        oldDerivedKeywordJunkExamples: keywordExamples(
          fixture.oldDerivedKeywords ?? [],
          OLD_KEYWORD_JUNK_EXAMPLES,
        ),
        oldMissingMetadataExamples: keywordExamples(
          fixture.oldSignals,
          OLD_METADATA_EXAMPLES,
        ),
        oldSummaryLooksCandidateCentric: summaryLooksCandidateCentric(
          fixture.oldSummary ?? fixture.profile.summary,
        ),
        structuredScore: null,
        structuredTier: null,
        structuredJobRequirementLabels: [],
        structuredProfileEvidenceSources: [],
        structuredMetadataLeakCount: 0,
        structuredMatchedEvidenceLabels: [],
        structuredUnknownLabels: [],
        matchedCount: 0,
        partialCount: 0,
        missingCount: 0,
        unknownCount: 0,
        metadataLeakCount: 0,
        provenanceComplete: false,
        manualExpectedLabel: fixture.manualExpectedLabel,
      },
    };
  }

  const structured = debug.structured;
  const metadataLeakCount = countMetadataLeaks(
    structured.jobRequirements,
    fixture.metadataTerms ?? [],
  );
  return {
    debug,
    row: {
      fixtureId: fixture.fixtureId,
      family: fixture.family,
      oldScore: old.score,
      oldTier: old.tier,
      oldProfileKeywordCount: getOldProfileKeywords(fixture).length,
      oldProfileKeywordJunkExamples: keywordExamples(
        getOldProfileKeywords(fixture),
        OLD_KEYWORD_JUNK_EXAMPLES,
      ),
      oldDerivedKeywordJunkExamples: keywordExamples(
        fixture.oldDerivedKeywords ?? [],
        OLD_KEYWORD_JUNK_EXAMPLES,
      ),
      oldMissingMetadataExamples: keywordExamples(
        fixture.oldSignals,
        OLD_METADATA_EXAMPLES,
      ),
      oldSummaryLooksCandidateCentric: summaryLooksCandidateCentric(
        fixture.oldSummary ?? fixture.profile.summary,
      ),
      structuredScore: structured.structuredScore,
      structuredTier: structured.structuredTier,
      structuredJobRequirementLabels: structured.jobRequirements.map(
        (requirement) => requirement.value,
      ),
      structuredProfileEvidenceSources: uniqueStrings(
        structured.profileEvidence.map((evidence) => evidence.evidenceText),
      ),
      structuredMetadataLeakCount: metadataLeakCount,
      structuredMatchedEvidenceLabels: uniqueStrings(
        [...structured.matched, ...structured.partial]
          .map((outcome) => outcome.evidence?.evidenceText)
          .filter((value): value is string => Boolean(value)),
      ),
      structuredUnknownLabels: structured.unknown.map(
        (outcome) => outcome.requirement.value,
      ),
      matchedCount: structured.matched.length,
      partialCount: structured.partial.length,
      missingCount: structured.missing.length,
      unknownCount: structured.unknown.length,
      metadataLeakCount,
      provenanceComplete: hasCompleteProvenance(structured),
      manualExpectedLabel: fixture.manualExpectedLabel,
    },
  };
}

function countMetadataLeaks(
  requirements: JobRequirementEntity[],
  fixtureMetadataTerms: string[],
): number {
  const exactTerms = new Set(fixtureMetadataTerms.map((term) => normalize(term)));
  const metadataPattern =
    /\b(equal opportunity|apply now|compensation|salary|benefits package|posted|source platform|status:|location:|privacy|cookie)\b/i;

  return requirements.filter((requirement) => {
    const value = normalize(requirement.value);
    return exactTerms.has(value) || fixtureMetadataTerms.some((term) => value.includes(normalize(term))) || metadataPattern.test(value);
  }).length;
}

function hasCompleteProvenance(
  structured: Extract<StructuredMatchReadDebug["structured"], { status: "available" }>,
): boolean {
  const entities = [
    ...structured.jobRequirements,
    ...structured.jobConstraints,
    ...structured.profileEvidence,
    ...structured.profileConstraints,
  ];
  const entitiesHaveProvenance = entities.every(
    (entity) => Boolean(entity.provenance.source) && normalize(entity.provenance.sourceText).length > 0,
  );
  const outcomesHaveConcreteEvidence = [
    ...structured.matched,
    ...structured.partial,
  ].every(
    (outcome) =>
      Boolean(outcome.evidence) &&
      normalize(outcome.requirement.provenance.sourceText).length > 0 &&
      normalize(outcome.evidence?.evidenceText).length > 0 &&
      normalize(outcome.evidence?.provenance.sourceText).length > 0,
  );

  return entitiesHaveProvenance && outcomesHaveConcreteEvidence;
}

function normalize(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function getOldProfileKeywords(fixture: EvaluationFixture): string[] {
  if (fixture.oldProfileKeywords) return fixture.oldProfileKeywords;
  if (Array.isArray(fixture.profile.keywords)) {
    return (fixture.profile.keywords as unknown[]).map(String);
  }
  return [];
}

function keywordExamples(
  values: string[],
  examples: readonly string[],
): string[] {
  const normalizedValues = new Set(values.map((value) => normalize(value)));
  return examples.filter((example) => normalizedValues.has(normalize(example)));
}

function summaryLooksCandidateCentric(value: unknown): boolean {
  const summary = normalize(value);
  return (
    /\b(security guard|candidate|applicant)\b/.test(summary) &&
    /\b(eight years|years experience|vip individuals|defense sites)\b/.test(summary)
  );
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => normalize(value).length > 0))];
}

describe("structured match-read evaluation matrix", () => {
  it("records a comparison row for each critical fixture family", () => {
    const rows = fixtures.map((fixture) => evaluateFixture(fixture).row);

    console.info(
      "structured match-read comparison summary",
      JSON.stringify(rows, null, 2),
    );

    expect(rows).toHaveLength(fixtures.length);
    expect(new Set(rows.map((row) => row.family))).toEqual(
      new Set<EvaluationFamily>([
        "retail_service",
        "security_licensed",
        "technical",
        "admin_office",
        "healthcare_regulated",
        "short_noisy",
        "long_duplicated_scrape",
        "multilingual",
        "negative_control",
      ]),
    );

    for (const row of rows) {
      expect(row).toEqual({
        fixtureId: expect.any(String),
        family: expect.any(String),
        oldScore: expect.any(Number),
        oldTier: expect.any(String),
        oldProfileKeywordCount: expect.any(Number),
        oldProfileKeywordJunkExamples: expect.any(Array),
        oldDerivedKeywordJunkExamples: expect.any(Array),
        oldMissingMetadataExamples: expect.any(Array),
        oldSummaryLooksCandidateCentric: expect.any(Boolean),
        structuredScore: expect.any(Number),
        structuredTier: expect.any(String),
        structuredJobRequirementLabels: expect.any(Array),
        structuredProfileEvidenceSources: expect.any(Array),
        structuredMetadataLeakCount: 0,
        structuredMatchedEvidenceLabels: expect.any(Array),
        structuredUnknownLabels: expect.any(Array),
        matchedCount: expect.any(Number),
        partialCount: expect.any(Number),
        missingCount: expect.any(Number),
        unknownCount: expect.any(Number),
        metadataLeakCount: 0,
        provenanceComplete: true,
        manualExpectedLabel: expect.any(String),
      });
    }
  });

  it("keeps the production scorer comparison baseline unchanged", () => {
    const rows = fixtures.map((fixture) => evaluateFixture(fixture).row);

    expect(Object.keys(expectedOldScorerByFixture).sort()).toEqual(
      fixtures.map((fixture) => fixture.fixtureId).sort(),
    );

    for (const row of rows) {
      expect({
        oldScore: row.oldScore,
        oldTier: row.oldTier,
      }).toEqual(expectedOldScorerByFixture[row.fixtureId]);
    }
  });

  it("keeps matched and partial outcomes tied to concrete profile provenance", () => {
    const evaluations = fixtures.map(evaluateFixture);

    for (const { debug } of evaluations) {
      expect(debug.structured.status).toBe("available");
      if (debug.structured.status !== "available") continue;

      for (const outcome of [...debug.structured.matched, ...debug.structured.partial]) {
        expect(normalize(outcome.evidence?.evidenceText).length).toBeGreaterThan(0);
        expect(normalize(outcome.evidence?.provenance.sourceText).length).toBeGreaterThan(0);
        expect(normalize(outcome.requirement.provenance.sourceText).length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps metadata and constraints out of positive requirements across fixtures", () => {
    const evaluations = fixtures.map(evaluateFixture);

    for (const evaluation of evaluations) {
      expect(evaluation.row.metadataLeakCount).toBe(0);
      expect(evaluation.debug.structured.status).toBe("available");
      if (evaluation.debug.structured.status !== "available") continue;

      const positiveCategories = evaluation.debug.structured.jobRequirements.map(
        (requirement) => requirement.category,
      );
      expect(positiveCategories).not.toEqual(expect.arrayContaining(["physical", "availability"]));
      expect(
        evaluation.debug.structured.jobConstraints.every(
          (constraint) => constraint.scoreDriving === false,
        ),
      ).toBe(true);
    }
  });

  it("preserves Kith/Robert old failure while structured evidence scores above zero", () => {
    const evaluation = evaluateFixture(
      fixtures.find((fixture) => fixture.fixtureId === "security_kith_robert")!,
    );

    expect(evaluation.row.oldScore).toBe(0);
    expect(evaluation.row.oldTier).toBe("weak");
    expect(evaluation.row.structuredScore).toBeGreaterThan(0);
    expect(evaluation.row.structuredTier).toBe("partial");
    expect(evaluation.row.metadataLeakCount).toBe(0);
    expect(evaluation.row.provenanceComplete).toBe(true);
  });

  it("allows the healthcare regulated fixture to proceed when the required credential is present", () => {
    const evaluation = evaluateFixture(
      fixtures.find((fixture) => fixture.fixtureId === "healthcare_medical_assistant")!,
    );

    expect(evaluation.row.family).toBe("healthcare_regulated");
    expect(evaluation.row.structuredTier).toBe("strong");
    expect(evaluation.debug.structured.status).toBe("available");
    if (evaluation.debug.structured.status !== "available") return;

    expect(evaluation.debug.structured.hardGateMissing).toEqual([]);
    expect(
      evaluation.debug.structured.matched.some(
        (outcome) =>
          outcome.requirement.value === "medical assistant certification" &&
          outcome.evidence?.sourceSection === "certifications",
      ),
    ).toBe(true);
  });

  it("separates Kith/Robert old keyword failures from structured evidence diagnostics", () => {
    const evaluation = evaluateFixture(
      fixtures.find((fixture) => fixture.fixtureId === "security_kith_robert")!,
    );
    const structuredRequirementText = evaluation.row.structuredJobRequirementLabels
      .map(normalize)
      .join("\n");
    const structuredEvidenceText = [
      ...evaluation.row.structuredProfileEvidenceSources,
      ...evaluation.row.structuredMatchedEvidenceLabels,
    ]
      .map(normalize)
      .join("\n");

    expect(evaluation.row.oldMissingMetadataExamples).toEqual(
      expect.arrayContaining(["location", "status", "compensation"]),
    );
    expect(evaluation.row.oldProfileKeywordCount).toBeGreaterThan(0);
    expect([
      ...evaluation.row.oldProfileKeywordJunkExamples,
      ...evaluation.row.oldDerivedKeywordJunkExamples,
    ]).toEqual(expect.arrayContaining(["conscious", "eight", "years", "nonh"]));
    expect(evaluation.row.oldSummaryLooksCandidateCentric).toBe(true);

    for (const term of STRUCTURED_METADATA_EXCLUSIONS) {
      expect(structuredRequirementText).not.toContain(term);
    }

    expect(structuredEvidenceText).toContain("adt security");
    expect(structuredEvidenceText).toContain("copwatch");
    expect(structuredEvidenceText).toMatch(
      /certified protection guard program|cpop/,
    );
    expect(structuredEvidenceText).toMatch(
      /security guard certificate program|socp/,
    );
    expect(structuredEvidenceText).toMatch(/reports|observations|cctv/);
    expect(
      evaluation.row.structuredMatchedEvidenceLabels.every(
        (label) => normalize(label).length > 0,
      ),
    ).toBe(true);
    expect(evaluation.row.structuredMetadataLeakCount).toBe(0);
    expect(evaluation.row.metadataLeakCount).toBe(0);
  });

  it("records unknown outcomes instead of confident matches when fixture evidence is absent", () => {
    const evaluations = fixtures.map(evaluateFixture);

    for (const evaluation of evaluations) {
      expect(evaluation.debug.structured.status).toBe("available");
      if (evaluation.debug.structured.status !== "available") continue;

      const allOutcomes = [
        ...evaluation.debug.structured.matched,
        ...evaluation.debug.structured.partial,
        ...evaluation.debug.structured.missing,
        ...evaluation.debug.structured.unknown,
      ];
      expect(
        allOutcomes
          .filter((outcome) => !outcome.evidence)
          .every((outcome) => outcome.outcome === "unknown"),
      ).toBe(true);
    }

    const adminEvaluation = evaluations.find(
      (evaluation) => evaluation.row.fixtureId === "admin_office_coordinator",
    );

    expect(adminEvaluation?.debug.structured.status).toBe("available");
    if (adminEvaluation?.debug.structured.status !== "available") return;

    expect(
      adminEvaluation.debug.structured.unknown.some(
        (outcome) => outcome.requirement.value === "grant writing" && !outcome.evidence,
      ),
    ).toBe(true);
  });
});
