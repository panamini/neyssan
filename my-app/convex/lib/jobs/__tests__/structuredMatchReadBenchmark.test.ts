import { describe, expect, it } from "vitest";

import { computeMatchRead, type MatchRead } from "../matchRead";
import {
  buildJobMatchReviewFromStructuredDebug,
  buildStructuredMatchReadDebug,
  type JobMatchReview,
  type JobMatchReviewVerdict,
  type StructuredMatchReadShadowRow,
} from "../structuredMatchRead";
import type { NormalizedJobExtraction } from "../jobExtractionSchema";

type BenchmarkCategory =
  | "obvious_positive"
  | "credential_caution"
  | "credential_hard_gate"
  | "unrelated_negative"
  | "generic_fragment_noise"
  | "no_profile"
  | "privacy_raw_evidence";

type ExpectedOutcome = {
  verdicts?: JobMatchReviewVerdict[];
  minScore?: number;
  maxScore?: number;
  requiresWatchOut?: RegExp;
  forbidsWatchOut?: RegExp;
  noProbablySkipZero?: boolean;
};

type BenchmarkFixture = {
  id: string;
  category: BenchmarkCategory;
  obviousPositive?: boolean;
  unrelatedNegative?: boolean;
  expected: ExpectedOutcome;
  profile: Record<string, unknown>;
  extraction: NormalizedJobExtraction;
};

const MODEL = "mistral-small-latest";
const PROMPT_VERSION = "p9_v2";

function extraction(overrides: Partial<NormalizedJobExtraction>): NormalizedJobExtraction {
  const { environment, ...rest } = overrides;
  const base: NormalizedJobExtraction = {
    summary_short: "Benchmark fixture.",
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

function oldBaseline(fixture: BenchmarkFixture): MatchRead {
  const skills = Array.isArray(fixture.profile.skills)
    ? fixture.profile.skills.map(String)
    : [];
  const keywords = Array.isArray(fixture.profile.keywords)
    ? fixture.profile.keywords.map(String)
    : skills;

  return computeMatchRead({
    now: 1234,
    profile: {
      id: String(fixture.profile._id ?? fixture.id),
      skills,
      keywords,
    },
    job: {
      id: fixture.id,
      parseStatus: "parsed",
      mustHaves: [],
      keywords: fixture.extraction.keywords_canonical,
      mustHavesExtraction: [],
      keywordsExtraction: fixture.extraction.keywords_canonical.map((value, index) => ({
        value,
        confidence: 0.6,
        sourceSpan: { start: index, end: index + value.length },
      })),
    },
  });
}

function reviewForFixture(fixture: BenchmarkFixture): JobMatchReview {
  return buildJobMatchReviewFromStructuredDebug(
    buildStructuredMatchReadDebug({
      old: oldBaseline(fixture),
      job: { id: fixture.id, rawLanguageDetected: "en" },
      profile: fixture.profile,
      shadowRows: [shadowRow(fixture.extraction)],
      model: MODEL,
      promptVersion: PROMPT_VERSION,
    }),
  );
}

function visibleText(review: JobMatchReview): string {
  return [
    review.one_liner,
    ...review.why_this_may_interest_you,
    ...review.watch_out,
  ].join("\n");
}

const securityProfile = {
  _id: "profile_security",
  summary: "Protection guard with patrol, incident response, access checks, and report writing.",
  skills: ["building patrol", "incident response", "access control", "report writing"],
  keywords: ["security patrol", "incident response"],
  experience: [
    {
      title: "Protection Guard",
      company: "Metro Protection",
      description:
        "Patrolled buildings, checked access points, wrote incident reports, and supported visitors.",
    },
  ],
};

const teacherProfile = {
  _id: "profile_teacher",
  summary: "Teacher with student teaching, classroom lesson planning, and early learner support.",
  skills: ["lesson planning", "classroom instruction", "student teaching"],
  keywords: ["teacher", "lesson planning"],
  education: [{ degree: "Bachelor of Arts", field: "Elementary Education" }],
  experience: [
    {
      title: "Kindergarten Teacher",
      company: "Oak Primary",
      description: "Completed student teaching and prepared classroom lessons.",
    },
  ],
};

const retailProfile = {
  _id: "profile_retail",
  summary: "Retail associate with customer service, cash handling, and floor restocking.",
  skills: ["customer service", "cash handling", "inventory restocking"],
  keywords: ["retail", "customer service"],
  experience: [
    {
      title: "Sales Associate",
      company: "City Market",
      description: "Helped customers, operated the cash drawer, and restocked inventory.",
    },
  ],
};

const warehouseProfile = {
  _id: "profile_warehouse",
  summary: "Warehouse associate with inventory counts, stockroom operations, and order picking.",
  skills: ["inventory management", "stockroom operations", "order picking"],
  keywords: ["warehouse", "inventory"],
  experience: [
    {
      title: "Warehouse Associate",
      company: "North Dock",
      description: "Maintained inventory counts, picked orders, and coordinated stockroom work.",
    },
  ],
};

const fixtures: BenchmarkFixture[] = [
  {
    id: "positive_security_guard",
    category: "obvious_positive",
    obviousPositive: true,
    expected: { verdicts: ["possible_lead", "strong_lead"], minScore: 55 },
    profile: securityProfile,
    extraction: extraction({
      role_title_normalized: "Security Guard",
      summary_short: "Security guard role covering patrol, incident response, and reports.",
      requirements: [
        { value: "building patrol", type: "experience", required: true },
        { value: "incident response", type: "skill", required: true },
        { value: "report writing", type: "skill", required: true },
      ],
      keywords_canonical: ["security guard", "building patrol", "incident response"],
      environment: { onsite: true, physical_standing: true },
    }),
  },
  {
    id: "positive_teacher",
    category: "obvious_positive",
    obviousPositive: true,
    expected: { verdicts: ["possible_lead", "strong_lead"], minScore: 55 },
    profile: teacherProfile,
    extraction: extraction({
      role_title_normalized: "Kindergarten Teacher",
      summary_short: "Teacher role requiring lessons, student teaching, and a degree.",
      requirements: [
        { value: "classroom lesson planning", type: "skill", required: true },
        { value: "student teaching", type: "experience", required: true },
        { value: "bachelor degree", type: "education", required: true },
      ],
      keywords_canonical: ["teacher", "lesson planning", "student teaching"],
      environment: { customer_facing: true, onsite: true },
    }),
  },
  {
    id: "positive_retail_sales_associate",
    category: "obvious_positive",
    obviousPositive: true,
    expected: { verdicts: ["possible_lead", "strong_lead"], minScore: 55 },
    profile: retailProfile,
    extraction: extraction({
      role_title_normalized: "Sales Associate",
      summary_short: "Store associate role focused on service, cash, and restocking.",
      requirements: [
        { value: "customer service", type: "skill", required: true },
        { value: "cash handling", type: "skill", required: true },
        { value: "inventory restocking", type: "skill", required: true },
      ],
      keywords_canonical: ["sales associate", "customer service", "cash handling"],
      environment: { customer_facing: true, retail: true, onsite: true },
    }),
  },
  {
    id: "positive_warehouse_inventory",
    category: "obvious_positive",
    obviousPositive: true,
    expected: { verdicts: ["possible_lead", "strong_lead"], minScore: 55 },
    profile: warehouseProfile,
    extraction: extraction({
      role_title_normalized: "Inventory Operations Associate",
      summary_short: "Inventory role requiring stockroom operations and order picking.",
      requirements: [
        { value: "inventory management", type: "skill", required: true },
        { value: "stockroom operations", type: "experience", required: true },
        { value: "order picking", type: "skill", required: true },
      ],
      keywords_canonical: ["inventory", "warehouse", "stockroom operations"],
      environment: { onsite: true, physical_standing: true },
    }),
  },
  ...Array.from({ length: 6 }, (_, index): BenchmarkFixture => ({
    id: `positive_retail_variant_${index + 1}`,
    category: "obvious_positive",
    obviousPositive: true,
    expected: { verdicts: ["possible_lead", "strong_lead"], minScore: 55 },
    profile: index % 2 === 0 ? retailProfile : warehouseProfile,
    extraction: extraction({
      role_title_normalized:
        index % 2 === 0 ? "Store Associate" : "Warehouse Operations Associate",
      summary_short: "Same-family positive benchmark fixture.",
      requirements:
        index % 2 === 0
          ? [
              { value: "customer service", type: "skill", required: true },
              { value: "cash handling", type: "skill", required: true },
              { value: "inventory restocking", type: "skill", required: true },
            ]
          : [
              { value: "inventory management", type: "skill", required: true },
              { value: "stockroom operations", type: "experience", required: true },
              { value: "order picking", type: "skill", required: true },
            ],
      keywords_canonical:
        index % 2 === 0
          ? ["store associate", "customer service", "cash handling"]
          : ["warehouse", "inventory", "stockroom operations"],
      environment: { customer_facing: index % 2 === 0, retail: index % 2 === 0, onsite: true },
    }),
  })),
  ...Array.from({ length: 3 }, (_, index): BenchmarkFixture => ({
    id: `credential_preferred_${index + 1}`,
    category: "credential_caution",
    expected: {
      verdicts: ["possible_lead", "strong_lead"],
      minScore: 55,
      requiresWatchOut: /license|certif|credential|guard card/i,
      forbidsWatchOut: /blocking/i,
    },
    profile: index % 2 === 0 ? securityProfile : teacherProfile,
    extraction: extraction({
      role_title_normalized: index % 2 === 0 ? "Security Guard" : "Teacher Assistant",
      summary_short: "Preferred credential benchmark fixture.",
      requirements:
        index % 2 === 0
          ? [
              { value: "building patrol", type: "experience", required: true },
              { value: "incident response", type: "skill", required: true },
              { value: "report writing", type: "skill", required: true },
              { value: "guard card/license preferred", type: "certification", required: false },
            ]
          : [
              { value: "lesson planning", type: "skill", required: true },
              { value: "student teaching", type: "experience", required: true },
              { value: "state teaching credential preferred", type: "certification", required: false },
            ],
      keywords_canonical:
        index % 2 === 0
          ? ["security guard", "building patrol", "incident response", "report writing"]
          : ["teacher", "lesson planning", "student teaching"],
      licenses_or_certifications: [],
      environment: { onsite: true },
    }),
  })),
  ...Array.from({ length: 2 }, (_, index): BenchmarkFixture => ({
    id: `credential_required_absent_${index + 1}`,
    category: "credential_hard_gate",
    expected: {
      verdicts: ["probably_skip", "possible_lead"],
      maxScore: 55,
      requiresWatchOut: /license|certif|credential|registered nurse/i,
    },
    profile: index % 2 === 0 ? retailProfile : warehouseProfile,
    extraction: extraction({
      role_title_normalized: index % 2 === 0 ? "Registered Nurse" : "Licensed Electrician",
      summary_short: "Regulated role with a required absent credential.",
      requirements:
        index % 2 === 0
          ? [
              { value: "registered nurse license", type: "certification", required: true },
              { value: "patient intake", type: "skill", required: true },
            ]
          : [
              { value: "electrician license", type: "certification", required: true },
              { value: "electrical troubleshooting", type: "skill", required: true },
            ],
      keywords_canonical:
        index % 2 === 0
          ? ["registered nurse license", "patient intake"]
          : ["electrician license", "electrical troubleshooting"],
      licenses_or_certifications:
        index % 2 === 0 ? ["registered nurse license"] : ["electrician license"],
      environment: { onsite: true },
    }),
  })),
  ...Array.from({ length: 5 }, (_, index): BenchmarkFixture => ({
    id: `unrelated_negative_${index + 1}`,
    category: "unrelated_negative",
    unrelatedNegative: true,
    expected: { verdicts: ["probably_skip"], maxScore: 35 },
    profile: index % 2 === 0 ? securityProfile : teacherProfile,
    extraction: extraction({
      role_title_normalized:
        index % 2 === 0 ? "Frontend Engineer" : "Regulatory Affairs Specialist",
      summary_short: "Unrelated specialist benchmark fixture.",
      requirements:
        index % 2 === 0
          ? [
              { value: "React", type: "skill", required: true },
              { value: "TypeScript", type: "skill", required: true },
              { value: "API integration", type: "skill", required: true },
            ]
          : [
              { value: "regulatory submissions", type: "skill", required: true },
              { value: "clinical trial documentation", type: "skill", required: true },
              { value: "quality management systems", type: "skill", required: true },
            ],
      keywords_canonical:
        index % 2 === 0
          ? ["React", "TypeScript", "API integration"]
          : ["regulatory submissions", "clinical trials", "quality systems"],
      environment: { onsite: false },
    }),
  })),
  {
    id: "generic_fragment_noise",
    category: "generic_fragment_noise",
    expected: { verdicts: ["possible_lead", "strong_lead"], minScore: 55 },
    profile: securityProfile,
    extraction: extraction({
      role_title_normalized: "Security Guard",
      summary_short: "Security role with noisy generic extraction fragments.",
      requirements: [
        { value: "building patrol", type: "experience", required: true },
        { value: "incident response", type: "skill", required: true },
        { value: "report writing", type: "skill", required: true },
        { value: "valid", type: "skill", required: true },
        { value: "ability", type: "skill", required: true },
        { value: "preferred", type: "skill", required: false },
        { value: "more", type: "skill", required: false },
        { value: "lift", type: "constraint", required: true },
      ],
      keywords_canonical: [
        "security guard",
        "building patrol",
        "incident response",
        "report writing",
      ],
      environment: { onsite: true, physical_standing: true },
    }),
  },
  ...Array.from({ length: 5 }, (_, index): BenchmarkFixture => ({
    id: `no_profile_fallback_${index + 1}`,
    category: "no_profile",
    expected: { verdicts: ["not_enough_signal"], noProbablySkipZero: true },
    profile: {},
    extraction: extraction({
      role_title_normalized:
        index % 2 === 0 ? "Operations Associate" : "Customer Service Associate",
      requirements: [
        { value: "customer service", type: "skill", required: true },
        { value: "report writing", type: "skill", required: true },
      ],
      keywords_canonical: ["customer service", "report writing"],
    }),
  })),
  ...Array.from({ length: 4 }, (_, index): BenchmarkFixture => ({
    id: `privacy_raw_evidence_${index + 1}`,
    category: "privacy_raw_evidence",
    expected: { verdicts: ["possible_lead", "strong_lead"], minScore: 55 },
    profile: {
      _id: `profile_privacy_${index + 1}`,
      summary:
        "alex@example.com +1 (415) 555-2671 123e4567-e89b-12d3-a456-426614174000 " +
        "Long resume paragraph with customer service, report writing, and intake coordination repeated many times.",
      skills: ["customer service", "report writing", "intake coordination"],
      experience: [
        {
          title: "Operations Associate",
          company: "Metro Ops",
          description:
            "Handled customer service, report writing, and intake coordination. " +
            "alex@example.com +1 (415) 555-2671 123e4567-e89b-12d3-a456-426614174000",
        },
      ],
    },
    extraction: extraction({
      role_title_normalized: "Operations Associate",
      requirements: [
        { value: "customer service", type: "skill", required: true },
        { value: "report writing", type: "skill", required: true },
        { value: "intake coordination", type: "skill", required: true },
      ],
      keywords_canonical: ["customer service", "report writing", "intake coordination"],
      environment: { customer_facing: true, onsite: true },
    }),
  })),
];

function hasPiiOrRawEvidenceLeak(review: JobMatchReview): boolean {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b555-2671\b|123e4567-e89b-12d3-a456-426614174000|Long resume paragraph/i.test(
    visibleText(review),
  );
}

function hasGenericFragmentLeak(review: JobMatchReview): boolean {
  const text = visibleText(review).toLowerCase();
  return /\b(valid|ability|preferred|more|lift|strong|excellent|responsible|motivated|fast-paced)\b/.test(
    text,
  );
}

function hasCredentialHallucination(review: JobMatchReview): boolean {
  return review.evidence.some((item) =>
    /\b(license|licensed|certification|credential|registered nurse|electrician)\b/i.test(
      `${item.profile_signal} ${item.explanation}`,
    ),
  );
}

function hasCriticalContradiction(review: JobMatchReview): boolean {
  const text = visibleText(review);
  return (
    review.verdict === "probably_skip" &&
    /\b(mostly overlaps|strong match|good fit|matches well)\b/i.test(text)
  );
}

describe("Match Review V1 benchmark validation", () => {
  it("covers the required internal beta benchmark categories", () => {
    expect(fixtures).toHaveLength(30);
    expect(fixtures.filter((fixture) => fixture.obviousPositive)).toHaveLength(10);
    expect(
      fixtures.filter(
        (fixture) =>
          fixture.category === "credential_caution" ||
          fixture.category === "credential_hard_gate",
      ),
    ).toHaveLength(5);
    expect(fixtures.filter((fixture) => fixture.unrelatedNegative)).toHaveLength(5);
    expect(
      fixtures.filter(
        (fixture) =>
          fixture.category === "generic_fragment_noise" ||
          fixture.category === "privacy_raw_evidence",
      ),
    ).toHaveLength(5);
    expect(fixtures.filter((fixture) => fixture.category === "no_profile")).toHaveLength(5);
    expect(new Set(fixtures.map((fixture) => fixture.category))).toEqual(
      new Set<BenchmarkCategory>([
        "obvious_positive",
        "credential_caution",
        "credential_hard_gate",
        "unrelated_negative",
        "generic_fragment_noise",
        "no_profile",
        "privacy_raw_evidence",
      ]),
    );
  });

  it("meets the internal beta KPI thresholds with readable diagnostics", () => {
    const rows = fixtures.map((fixture) => {
      const review = reviewForFixture(fixture);
      const text = visibleText(review);
      const expectedVerdictPass =
        !fixture.expected.verdicts || fixture.expected.verdicts.includes(review.verdict);
      const minScorePass =
        fixture.expected.minScore === undefined || review.score >= fixture.expected.minScore;
      const maxScorePass =
        fixture.expected.maxScore === undefined || review.score <= fixture.expected.maxScore;
      const watchOutText = review.watch_out.join("\n");
      const requiredWatchOutPass =
        !fixture.expected.requiresWatchOut ||
        fixture.expected.requiresWatchOut.test(watchOutText);
      const forbiddenWatchOutPass =
        !fixture.expected.forbidsWatchOut ||
        !fixture.expected.forbidsWatchOut.test(watchOutText);
      const noProbablySkipZeroPass =
        !fixture.expected.noProbablySkipZero ||
        !(review.verdict === "probably_skip" && review.score === 0);

      return {
        id: fixture.id,
        category: fixture.category,
        verdict: review.verdict,
        score: review.score,
        one_liner: review.one_liner,
        why_count: review.why_this_may_interest_you.length,
        watch_out_count: review.watch_out.length,
        expectedVerdictPass,
        minScorePass,
        maxScorePass,
        requiredWatchOutPass,
        forbiddenWatchOutPass,
        noProbablySkipZeroPass,
        falseZero:
          Boolean(fixture.obviousPositive) &&
          (review.score === 0 || review.verdict === "probably_skip"),
        contradiction: hasCriticalContradiction(review),
        credentialHallucination: hasCredentialHallucination(review),
        piiOrRawEvidenceLeak: hasPiiOrRawEvidenceLeak(review),
        genericFragmentLeak:
          fixture.category === "generic_fragment_noise" && hasGenericFragmentLeak(review),
        visibleText: text,
      };
    });

    const falseZeroCount = rows.filter((row) => row.falseZero).length;
    const contradictionCount = rows.filter((row) => row.contradiction).length;
    const credentialHallucinationCount = rows.filter(
      (row) => row.credentialHallucination,
    ).length;
    const piiOrRawEvidenceLeakCount = rows.filter(
      (row) => row.piiOrRawEvidenceLeak,
    ).length;
    const genericFragmentLeakCount = rows.filter((row) => row.genericFragmentLeak).length;
    const obviousPositiveRows = rows.filter((row) =>
      fixtures.find((fixture) => fixture.id === row.id)?.obviousPositive,
    );
    const unrelatedNegativeRows = rows.filter((row) =>
      fixtures.find((fixture) => fixture.id === row.id)?.unrelatedNegative,
    );
    const obviousPositiveRecall =
      obviousPositiveRows.filter((row) =>
        ["possible_lead", "strong_lead"].includes(row.verdict),
      ).length / obviousPositiveRows.length;
    const unrelatedNegativePassRate =
      unrelatedNegativeRows.filter((row) => row.verdict === "probably_skip").length /
      unrelatedNegativeRows.length;

    const kpis = {
      false_zero_count: falseZeroCount,
      contradiction_count: contradictionCount,
      credential_hallucination_count: credentialHallucinationCount,
      pii_or_raw_evidence_leak_count: piiOrRawEvidenceLeakCount,
      generic_fragment_leak_count: genericFragmentLeakCount,
      obvious_positive_recall: obviousPositiveRecall,
      unrelated_negative_pass_rate: unrelatedNegativePassRate,
    };

    console.info(
      "match review v1 benchmark results",
      JSON.stringify({ kpis, rows }, null, 2),
    );

    const failedRows = rows.filter(
      (row) =>
        !row.expectedVerdictPass ||
        !row.minScorePass ||
        !row.maxScorePass ||
        !row.requiredWatchOutPass ||
        !row.forbiddenWatchOutPass ||
        !row.noProbablySkipZeroPass ||
        row.why_count > 3 ||
        row.watch_out_count > 2,
    );

    expect(failedRows, JSON.stringify(failedRows, null, 2)).toEqual([]);
    expect(kpis.false_zero_count, JSON.stringify(rows, null, 2)).toBe(0);
    expect(kpis.contradiction_count, JSON.stringify(rows, null, 2)).toBe(0);
    expect(kpis.credential_hallucination_count, JSON.stringify(rows, null, 2)).toBe(0);
    expect(kpis.pii_or_raw_evidence_leak_count, JSON.stringify(rows, null, 2)).toBe(0);
    expect(kpis.generic_fragment_leak_count, JSON.stringify(rows, null, 2)).toBe(0);
    expect(kpis.obvious_positive_recall).toBeGreaterThanOrEqual(0.85);
    expect(kpis.unrelated_negative_pass_rate).toBeGreaterThanOrEqual(0.9);
  });
});
