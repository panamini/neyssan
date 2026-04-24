import { describe, expect, it } from "vitest";

import { computeMatchRead } from "../matchRead";
import {
  buildStructuredMatchReadDebug,
  buildStructuredProfileEvidence,
  isStructuredMatchReadShadowEnabled,
  selectEligibleStructuredJobExtraction,
  type StructuredMatchReadShadowRow,
} from "../structuredMatchRead";
import type { NormalizedJobExtraction } from "../jobExtractionSchema";

const kithExtraction: NormalizedJobExtraction = {
  summary_short:
    "Security Guard role overseeing store entry, crowd management, loss prevention, and customer safety.",
  role_title_normalized: "Security Guard",
  requirements: [
    { value: "security guard license", type: "certification", required: true },
    { value: "crowd management", type: "skill", required: true },
    { value: "de-escalation", type: "skill", required: true },
    { value: "customer-facing retail experience", type: "experience", required: true },
  ],
  keywords_canonical: [
    "security guard",
    "crowd management",
    "loss prevention",
    "customer safety",
    "retail operations",
  ],
  licenses_or_certifications: ["security guard license"],
  schedule_constraints: ["weekends and holidays"],
  environment: {
    customer_facing: true,
    onsite: true,
    physical_standing: true,
    retail: true,
  },
  confidence: "high",
};

const validKithShadowRow: StructuredMatchReadShadowRow = {
  llm_normalized_output: kithExtraction,
  validation_status: "valid",
  fallback_used: false,
  model: "mistral-small-latest",
  prompt_version: "p9_v1",
  created_at: 100,
};

const robertProfile = {
  _id: "c2c9c19c-f6cc-4cf6-b23c-c0c970b428bf",
  profileId: "c2c9c19c-f6cc-4cf6-b23c-c0c970b428bf",
  version: 1,
  summary:
    "Safety conscious, attentive Security Guard with eight years experience in protecting and guarding VIP individuals in the military and defense sectors. Presently finishing a bachelor's in criminal justice and qualified as a CPO (Certified Protection Guard).",
  skills: [
    "Investigation skills",
    "Safety compliance",
    "Criminal justice knowledge",
    "Restraining devices",
    "Martial arts/Physical combat training",
  ],
  keywords: [
    "investigation skills",
    "safety compliance",
    "criminal justice knowledge",
  ],
  experience: [
    {
      company: "ADT Security",
      title: "Security Guard",
      startDate: "January 2021",
      endDate: "April 2022",
      description:
        "Responsible for completing reports by recording information, observations, occurrences, and surveillance activities, including interviewing of witnesses and acquiring signatures. Maintaining environments by monitoring the grounds and equipment controls.",
    },
    {
      company: "Copwatch",
      title: "Security Guard",
      startDate: "January 2020",
      endDate: "April 2022",
      description:
        "Primary purpose is to scan area of grounds for objects/items that seem out of place. Monitoring selected areas via CCTV app on smart devices.",
    },
  ],
  raw_text:
    "Security Guard Certificate Program (SOCP), ASIS International. Course Curriculum: Law Enforcement Ethics, Foundations in Criminal Law, Report Writing, Criminal Profiling, Interviewing Techniques, Crisis Intervention.",
  cvDocument: {
    metadata: {
      authoritativeResume: {
        normalized: {
          profile: {
            desiredPosition: "Security Guard",
          },
          certifications: [
            {
              certificationName: "Certified Protection Guard Program (CPOP)",
              issuingOrganization: "International Foundation for Protection Guards",
              issueDate: "January 2021 - April 2022",
            },
            {
              certificationName: "Security Guard Certificate Program (SOCP)",
              issuingOrganization: "ASIS International",
              issueDate: "April 2022 - April 2022",
            },
            {
              certificationName: "S.A.F.E. Approach Level II Training",
              issuingOrganization: "Hawaii Western College",
              issueDate: "January 2015 - November 2019",
            },
          ],
          education: [
            {
              degree: "S.A.F.E. Approach Level II Training",
              institution: "Hawaii Western College",
              description:
                "Course Curriculum: Law Enforcement Ethics, Foundations in Criminal Law, Report Writing, Criminal Profiling, Interviewing Techniques, Crisis Intervention.",
            },
          ],
          languages: [
            { name: "English", level: "Intermediate" },
            { name: "Spanish", level: "Intermediate" },
          ],
          projects: [],
          publications: [],
          achievements: [],
        },
      },
    },
  },
};

function oldKithMatchRead() {
  return computeMatchRead({
    now: 1234,
    profile: {
      id: "c2c9c19c-f6cc-4cf6-b23c-c0c970b428bf",
      skills: robertProfile.skills,
      keywords: robertProfile.keywords,
    },
    job: {
      id: "kx792v2vx1ptxz2c4x4y5zxf4x85eqj2",
      parseStatus: "parsed",
      mustHaves: [],
      keywords: [
        "location",
        "miami",
        "design",
        "district",
        "store",
        "status",
        "part-time",
        "compensation",
      ],
      mustHavesExtraction: [],
      keywordsExtraction: [
        { value: "location", confidence: 0.45, sourceSpan: { start: 29, end: 37 } },
        { value: "miami", confidence: 0.45, sourceSpan: { start: 39, end: 44 } },
        { value: "design", confidence: 0.45, sourceSpan: { start: 45, end: 51 } },
        { value: "district", confidence: 0.45, sourceSpan: { start: 52, end: 60 } },
        { value: "store", confidence: 0.62, sourceSpan: { start: 61, end: 66 } },
        { value: "status", confidence: 0.45, sourceSpan: { start: 67, end: 73 } },
        { value: "part-time", confidence: 0.45, sourceSpan: { start: 75, end: 84 } },
        {
          value: "compensation",
          confidence: 0.45,
          sourceSpan: { start: 85, end: 97 },
        },
      ],
    },
  });
}

describe("structured match-read shadow scorer", () => {
  it("selects only current-policy valid non-fallback LLM extraction rows", () => {
    expect(
      selectEligibleStructuredJobExtraction({
        model: "mistral-small-latest",
        promptVersion: "p9_v1",
        shadowRows: [
          { ...validKithShadowRow, validation_status: "schema_invalid" },
          { ...validKithShadowRow, fallback_used: true },
          { ...validKithShadowRow, prompt_version: "old" },
          validKithShadowRow,
        ],
      })?.normalizedOutput.role_title_normalized,
    ).toBe("Security Guard");
  });

  it("excludes metadata from job requirement entities and keeps constraints separate", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "kx792v2vx1ptxz2c4x4y5zxf4x85eqj2",
        rawLanguageDetected: "en",
      },
      profile: robertProfile,
      shadowRows: [validKithShadowRow],
      model: "mistral-small-latest",
      promptVersion: "p9_v1",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    expect(debug.structured.jobRequirements.map((item) => item.value)).not.toEqual(
      expect.arrayContaining([
        "location",
        "miami",
        "design",
        "district",
        "store",
        "status",
        "part-time",
        "compensation",
      ]),
    );
    expect(debug.structured.jobConstraints.map((item) => item.category)).toEqual(
      expect.arrayContaining(["schedule", "physical"]),
    );
    expect(debug.structured.jobRequirements.map((item) => item.category)).not.toEqual(
      expect.arrayContaining(["availability", "physical"]),
    );
  });

  it("emits profile evidence from structured sections with provenance", () => {
    const evidence = buildStructuredProfileEvidence(robertProfile);

    expect(evidence.map((item) => item.sourceSection)).toEqual(
      expect.arrayContaining([
        "summary",
        "skills",
        "experience_title",
        "experience_description",
        "experience_company",
        "education",
        "certifications",
        "languages",
        "raw_text",
      ]),
    );
    expect(
      evidence.find((item) => item.value.includes("Security Guard Certificate Program")),
    ).toMatchObject({
      category: "certification",
      provenance: expect.objectContaining({
        source: "cv_document",
        section: "certifications",
        sourceText: expect.stringContaining("Security Guard Certificate Program"),
      }),
    });
    expect(evidence.find((item) => item.sourceSection === "raw_text")?.confidence).toBeLessThan(
      evidence.find((item) => item.sourceSection === "skills")?.confidence ?? 0,
    );
  });

  it("classifies desired position as supportive role alignment, not strong proof", () => {
    const evidence = buildStructuredProfileEvidence(robertProfile);
    const desiredPosition = evidence.find(
      (item) => item.sourceSection === "desired_position",
    );

    expect(desiredPosition).toMatchObject({
      category: "role_alignment",
      confidence: expect.any(Number),
    });
    expect(desiredPosition?.confidence).toBeLessThan(
      evidence.find((item) => item.sourceSection === "experience_title")?.confidence ?? 0,
    );
  });

  it("requires concrete evidence for matched and partial outcomes", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "kx792v2vx1ptxz2c4x4y5zxf4x85eqj2",
        rawLanguageDetected: "en",
      },
      profile: robertProfile,
      shadowRows: [validKithShadowRow],
      model: "mistral-small-latest",
      promptVersion: "p9_v1",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    for (const outcome of [...debug.structured.matched, ...debug.structured.partial]) {
      expect(outcome.evidence?.evidenceText).toEqual(expect.any(String));
      expect(outcome.evidence?.provenance.sourceText).toEqual(expect.any(String));
    }
  });

  it("classifies unsupported requirements as unknown when no evidence exists", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "job_no_evidence",
        rawLanguageDetected: "en",
      },
      profile: robertProfile,
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            ...kithExtraction,
            requirements: [
              { value: "marine cargo screening", type: "skill", required: true },
            ],
            schedule_constraints: [],
            environment: {
              customer_facing: null,
              onsite: null,
              physical_standing: null,
              retail: null,
            },
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v1",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;
    expect(debug.structured.unknown[0]).toMatchObject({
      outcome: "unknown",
      evidence: undefined,
    });
  });

  it("keeps Pass 2A visible fields projection-only for production match read", () => {
    const old = oldKithMatchRead();
    const debug = buildStructuredMatchReadDebug({
      old,
      job: {
        id: "kx792v2vx1ptxz2c4x4y5zxf4x85eqj2",
        rawLanguageDetected: "en",
      },
      profile: robertProfile,
      shadowRows: [validKithShadowRow],
      model: "mistral-small-latest",
      promptVersion: "p9_v1",
    });

    expect(debug.old).toEqual({
      score: old.score,
      tier: old.tier,
      matched: old.matched,
      missing: old.missing,
      method: old.method,
      fallback: old.fallback,
    });
    expect(old.score).toBe(0);
    expect(old.tier).toBe("weak");
  });

  it("produces structured Kith/Robert score above zero without changing old score", () => {
    const old = oldKithMatchRead();
    const debug = buildStructuredMatchReadDebug({
      old,
      job: {
        id: "kx792v2vx1ptxz2c4x4y5zxf4x85eqj2",
        rawLanguageDetected: "en",
      },
      profile: robertProfile,
      shadowRows: [validKithShadowRow],
      model: "mistral-small-latest",
      promptVersion: "p9_v1",
    });

    expect(old).toMatchObject({
      score: 0,
      tier: "weak",
      matched: [],
      missing: [
        "location",
        "miami",
        "design",
        "district",
        "store",
        "status",
        "part-time",
        "compensation",
      ],
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;
    expect(debug.structured.structuredScore).toBeGreaterThan(0);
    expect(debug.structured.matched.map((item) => item.requirement.value)).toEqual(
      expect.arrayContaining(["Security Guard", "security guard license"]),
    );
    expect(
      debug.structured.profileEvidence.map((item) => item.evidenceText).join("\n"),
    ).toEqual(expect.stringContaining("ADT Security"));
    expect(
      debug.structured.profileEvidence.map((item) => item.evidenceText).join("\n"),
    ).toEqual(expect.stringContaining("Copwatch"));
    expect(
      debug.structured.profileEvidence.map((item) => item.evidenceText).join("\n"),
    ).toEqual(expect.stringContaining("Crisis Intervention"));
  });

  it("returns unavailable when no valid structured extraction exists", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: { id: "job_missing_shadow", rawLanguageDetected: "en" },
      profile: robertProfile,
      shadowRows: [],
    });

    expect(debug.structured).toEqual({
      status: "unavailable",
      reason: "no_valid_llm_extraction",
    });
  });

  it("parses the dedicated structured shadow flag only", () => {
    expect(isStructuredMatchReadShadowEnabled("1")).toBe(true);
    expect(isStructuredMatchReadShadowEnabled("true")).toBe(true);
    expect(isStructuredMatchReadShadowEnabled("off")).toBe(false);
  });
});
