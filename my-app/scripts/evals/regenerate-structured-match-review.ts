import { readFileSync, writeFileSync } from "node:fs";

import type { NormalizedJobExtraction } from "../../convex/lib/jobs/jobExtractionSchema";
import type { MatchRead, MatchReadTier } from "../../convex/lib/jobs/matchRead";
import {
  buildStructuredMatchReadDebug,
  type StructuredMatchReadShadowRow,
} from "../../convex/lib/jobs/structuredMatchRead";
import {
  STRUCTURED_MATCH_REVIEW_BLOCKER_LABELS,
  type StructuredMatchReviewCase,
  type StructuredMatchReviewLabel,
} from "../../convex/lib/jobs/structuredMatchReview";

type ReviewCaseRecord = StructuredMatchReviewCase & {
  family?: string;
  jobId?: string;
  profileId?: string;
  oldScore?: number | null;
  oldTier?: MatchReadTier | null;
  manualExpectedLabel?: "good_fit" | "partial_fit" | "weak_fit" | "insufficient_data";
  blocker?: boolean;
  notes?: string;
};

type ReviewFixture = {
  profile: Record<string, unknown>;
  rawLanguageDetected?: string | null;
  shadowRows: StructuredMatchReadShadowRow[];
  metadataTerms?: string[];
  languageProbe?: RegExp;
};

const MODEL = "mistral-small-latest";
const PROMPT_VERSION = "p9_v2";
const BLOCKER_LABELS = new Set<StructuredMatchReviewLabel>(
  STRUCTURED_MATCH_REVIEW_BLOCKER_LABELS,
);

function extraction(overrides: Partial<NormalizedJobExtraction>): NormalizedJobExtraction {
  const { environment, ...rest } = overrides;
  const base: NormalizedJobExtraction = {
    summary_short: "Structured review fixture.",
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

function shadowRow(
  output: NormalizedJobExtraction,
  overrides: Partial<StructuredMatchReadShadowRow> = {},
): StructuredMatchReadShadowRow {
  return {
    llm_normalized_output: output,
    validation_status: "valid",
    fallback_used: false,
    model: MODEL,
    prompt_version: PROMPT_VERSION,
    created_at: 100,
    ...overrides,
  };
}

const securityExtraction = extraction({
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
  environment: {
    customer_facing: true,
    retail: true,
    physical_standing: true,
    onsite: true,
  },
});

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

const retailExtraction = extraction({
  summary_short: "Retail Associate role with boilerplate in the scrape.",
  role_title_normalized: "Retail Associate",
  requirements: [
    { value: "customer service", type: "skill", required: true },
    { value: "cash handling", type: "skill", required: true },
    { value: "employee discount and benefits package", type: "skill", required: false },
    { value: "Kith brand story and culture", type: "skill", required: false },
    { value: "source platform: Greenhouse", type: "skill", required: false },
    { value: "join our team and enjoy a great place to work", type: "skill", required: false },
    { value: "compensation $18/hr", type: "skill", required: false },
    { value: "Miami store location", type: "skill", required: false },
    { value: "apply now to join our retail team", type: "skill", required: false },
  ],
  keywords_canonical: ["customer service", "cash handling"],
  environment: {
    customer_facing: true,
    onsite: true,
    retail: true,
  },
});

const shortNoisyExtraction = extraction({
  summary_short: "Short noisy cashier posting with thin evidence.",
  role_title_normalized: "Cashier",
  requirements: [
    { value: "cash handling", type: "skill", required: true },
    { value: "customer communication", type: "skill", required: true },
    { value: "lottery terminal operation", type: "tool", required: true },
    { value: "inventory reconciliation", type: "skill", required: false },
  ],
  keywords_canonical: ["cash handling"],
  environment: {
    customer_facing: true,
    onsite: true,
    retail: true,
  },
});

const healthcareExtraction = extraction({
  summary_short: "Medical Assistant role requiring certification and patient intake.",
  role_title_normalized: "Medical Assistant",
  requirements: [
    { value: "medical assistant certification", type: "certification", required: true },
    { value: "patient intake", type: "skill", required: true },
    { value: "HIPAA compliance", type: "skill", required: true },
  ],
  keywords_canonical: ["medical assistant", "patient intake", "HIPAA"],
  licenses_or_certifications: ["medical assistant certification"],
  environment: {
    customer_facing: true,
    onsite: true,
  },
});

const frenchSourceExtraction = extraction({
  summary_short: "Poste de support client avec suivi des demandes.",
  role_title_normalized: "Charge de support client",
  requirements: [
    { value: "support client", type: "skill", required: true },
    { value: "gestion des demandes", type: "skill", required: true },
    { value: "Francais courant", type: "language", required: true },
  ],
  keywords_canonical: ["support client", "gestion des demandes", "Francais"],
  environment: {
    customer_facing: true,
    onsite: false,
  },
});

const translatedFrenchExtraction = extraction({
  summary_short: "Customer support role tracking incoming requests.",
  role_title_normalized: "Customer Support Specialist",
  requirements: [
    { value: "customer support", type: "skill", required: true },
    { value: "ticket management", type: "skill", required: true },
    { value: "fluent French", type: "language", required: true },
  ],
  keywords_canonical: ["customer support", "ticket management", "French"],
  environment: {
    customer_facing: true,
    onsite: false,
  },
});

const negativeControlExtraction = extraction({
  summary_short: "Frontend Engineer role building React and TypeScript interfaces.",
  role_title_normalized: "Frontend Engineer",
  requirements: [
    { value: "React", type: "skill", required: true },
    { value: "TypeScript", type: "skill", required: true },
    { value: "API integration", type: "skill", required: true },
  ],
  keywords_canonical: ["React", "TypeScript", "API integration"],
  environment: { onsite: false },
});

const fixturesByCaseId: Record<string, ReviewFixture> = {
  security_kith_robert_alpha: {
    profile: robertSecurityProfile,
    rawLanguageDetected: "en",
    shadowRows: [shadowRow(securityExtraction)],
  },
  retail_service_alpha: {
    profile: {
      _id: "profile_retail_service",
      summary: "Retail associate with customer service and cash handling experience.",
      skills: ["customer service", "cash handling"],
      keywords: ["customer service", "cash handling"],
      experience: [
        {
          company: "City Market",
          title: "Retail Associate",
          description: "Helped customers and operated the cash drawer.",
        },
      ],
    },
    rawLanguageDetected: "en",
    shadowRows: [shadowRow(retailExtraction)],
    metadataTerms: [
      "benefits",
      "employee discount",
      "brand story",
      "source platform",
      "join our team",
      "great place to work",
      "compensation",
      "miami",
      "apply now",
    ],
  },
  healthcare_alpha: {
    profile: {
      _id: "profile_medical_assistant",
      summary: "Certified medical assistant with patient intake and HIPAA compliance experience.",
      skills: ["patient intake", "HIPAA compliance"],
      keywords: ["patient intake", "HIPAA"],
      certifications: ["medical assistant certification"],
      experience: [
        {
          company: "Community Clinic",
          title: "Medical Assistant",
          description: "Handled patient intake and HIPAA-compliant chart updates.",
        },
      ],
    },
    rawLanguageDetected: "en",
    shadowRows: [shadowRow(healthcareExtraction)],
  },
  multilingual_alpha: {
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
    rawLanguageDetected: "fr",
    shadowRows: [
      shadowRow(frenchSourceExtraction, { created_at: 100 }),
      shadowRow(translatedFrenchExtraction, { created_at: 200 }),
    ],
    languageProbe: /\b(charge de support client|gestion des demandes|francais courant)\b/i,
  },
  short_noisy_alpha: {
    profile: {
      _id: "profile_cashier_sparse",
      summary: "Cashier with cash handling and customer service experience.",
      skills: ["cash handling", "customer service"],
      keywords: ["cash handling", "customer service"],
      experience: [
        {
          company: "Corner Shop",
          title: "Cashier",
          description: "Handled the cash drawer during customer rushes.",
        },
      ],
    },
    rawLanguageDetected: "en",
    shadowRows: [shadowRow(shortNoisyExtraction)],
  },
  negative_control_alpha: {
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
    rawLanguageDetected: "en",
    shadowRows: [shadowRow(negativeControlExtraction)],
  },
};

function parseJsonl(path: string): ReviewCaseRecord[] {
  return readFileSync(path, "utf8")
    .trim()
    .split(/\r?\n/g)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ReviewCaseRecord);
}

function oldReadFromCase(reviewCase: ReviewCaseRecord): MatchRead {
  return {
    tier: reviewCase.productionTier ?? reviewCase.oldTier ?? "unknown",
    score: reviewCase.productionScore ?? reviewCase.oldScore ?? null,
    scoreVisible: reviewCase.productionScore !== null,
    confidence: "medium",
    matched: [],
    missing: [],
    basedOn: {
      profileId: reviewCase.profileId ?? "unknown_profile",
      profileLabel: "Review fixture",
      jobId: reviewCase.jobId ?? reviewCase.caseId,
    },
    computedAt: 1234,
    method: "keyword-overlap",
    fallback: "none",
  };
}

function normalize(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function countMetadataLeaks(values: string[], extraTerms: string[] = []): number {
  const exactTerms = new Set(extraTerms.map(normalize));
  const metadataPattern =
    /\b(equal opportunity|apply now|compensation|salary|benefits|employee discount|brand story|source platform|join our team|great place to work|location|miami|privacy|cookie)\b/i;

  return values.filter((value) => {
    const normalizedValue = normalize(value);
    return (
      exactTerms.has(normalizedValue) ||
      extraTerms.some((term) => normalizedValue.includes(normalize(term))) ||
      metadataPattern.test(value)
    );
  }).length;
}

function languagePreserved(
  fixture: ReviewFixture,
  requirementValues: string[],
  evidenceValues: string[],
): boolean {
  if (fixture.rawLanguageDetected !== "fr") {
    return true;
  }
  const text = [...requirementValues, ...evidenceValues].map(normalize).join("\n");
  return fixture.languageProbe ? fixture.languageProbe.test(text) : /\bfrancais\b/i.test(text);
}

function hasHighUnknownPressure(reviewCase: Pick<
  StructuredMatchReviewCase,
  "matchedCount" | "partialCount" | "unknownCount"
>): boolean {
  const evidenceBearingCount = reviewCase.matchedCount + reviewCase.partialCount;
  return reviewCase.unknownCount > 0 && reviewCase.unknownCount >= evidenceBearingCount;
}

function deriveLabels(
  base: ReviewCaseRecord,
  current: StructuredMatchReviewCase,
): StructuredMatchReviewLabel[] {
  const expected = base.manualExpectedLabel;
  const labels: StructuredMatchReviewLabel[] = [];

  if (current.metadataLeakCount > 0) {
    labels.push("metadata leak");
  }
  if (!current.languagePreserved) {
    labels.push("language issue");
  }
  if (
    current.structuredTier === "strong" &&
    (hasHighUnknownPressure(current) ||
      (current.strongMatchedEvidenceCount ?? current.matchedCount) < 2)
  ) {
    labels.push("overmatched");
  }
  if (current.category === "negative_control" && current.structuredTier !== "weak") {
    labels.push("overmatched");
  }
  if (expected === "weak_fit" && current.structuredTier !== "weak") {
    labels.push("overmatched");
  }
  if (expected === "good_fit" && current.structuredTier === "weak") {
    labels.push("undermatched");
  }

  if (labels.length > 0) {
    return [...new Set(labels)];
  }
  if (
    (expected === "good_fit" && current.structuredTier === "partial") ||
    (expected === "partial_fit" && current.structuredTier === "weak")
  ) {
    return ["acceptable but conservative"];
  }
  return ["good"];
}

function regenerateCase(base: ReviewCaseRecord): ReviewCaseRecord {
  const fixture = fixturesByCaseId[base.caseId];
  if (!fixture) {
    return base;
  }

  const debug = buildStructuredMatchReadDebug({
    old: oldReadFromCase(base),
    job: {
      id: base.jobId ?? base.caseId,
      rawLanguageDetected: fixture.rawLanguageDetected,
    },
    profile: fixture.profile,
    shadowRows: fixture.shadowRows,
    model: MODEL,
    promptVersion: PROMPT_VERSION,
  });

  if (debug.structured.status !== "available") {
    const unavailable: StructuredMatchReviewCase = {
      caseId: base.caseId,
      category: base.category,
      labels: ["undermatched"],
      structuredScore: null,
      structuredTier: null,
      productionScore: base.productionScore,
      productionTier: base.productionTier,
      productionScoreChanged: false,
      matchedCount: 0,
      partialCount: 0,
      missingCount: 0,
      unknownCount: 0,
      metadataLeakCount: 0,
      languagePreserved: false,
    };
    return {
      ...base,
      ...unavailable,
      blocker: unavailable.labels.some((label) => BLOCKER_LABELS.has(label)),
      note: "Current structured scorer did not find an eligible structured row.",
      notes: "Current structured scorer did not find an eligible structured row.",
    };
  }

  const structured = debug.structured;
  const requirementValues = structured.jobRequirements.map((requirement) => requirement.value);
  const evidenceValues = structured.profileEvidence.map((evidence) => evidence.evidenceText);
  const metadataLeakCount = countMetadataLeaks(requirementValues, fixture.metadataTerms);
  const current: StructuredMatchReviewCase = {
    caseId: base.caseId,
    category: base.category,
    labels: [],
    structuredScore: structured.structuredScore,
    structuredTier: structured.structuredTier,
    productionScore: base.productionScore,
    productionTier: base.productionTier,
    productionScoreChanged: false,
    matchedCount: structured.matched.length,
    partialCount: structured.partial.length,
    missingCount: structured.missing.length + structured.hardGateMissing.length,
    unknownCount: structured.unknown.length,
    metadataLeakCount,
    languagePreserved: languagePreserved(fixture, requirementValues, evidenceValues),
    strongMatchedEvidenceCount: structured.matched.filter((outcome) => outcome.evidence)
      .length,
  };
  const labels = deriveLabels(base, current);

  return {
    ...base,
    ...current,
    labels,
    blocker: labels.some((label) => BLOCKER_LABELS.has(label)),
    note: undefined,
    notes:
      labels.includes("acceptable but conservative")
        ? "Current scorer is conservative but no blocker diagnostic remains."
        : "Regenerated from current structured scorer output.",
  };
}

function usage(): never {
  throw new Error(
    "Usage: node --import tsx/esm scripts/evals/regenerate-structured-match-review.ts <old.jsonl> <output.jsonl>",
  );
}

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  usage();
}

const regenerated = parseJsonl(inputPath).map(regenerateCase);
writeFileSync(
  outputPath,
  `${regenerated.map((reviewCase) => JSON.stringify(reviewCase)).join("\n")}\n`,
);
