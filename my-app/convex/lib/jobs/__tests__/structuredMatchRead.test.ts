import { describe, expect, it } from "vitest";

import { computeMatchRead } from "../matchRead";
import {
  buildJobMatchReviewFromStructuredDebug,
  buildVisibleMatchReadFromStructuredDebug,
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
  prompt_version: "p9_v2",
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

function licenseOnlyShadowRow(requirementValue = "security guard license"): StructuredMatchReadShadowRow {
  return {
    ...validKithShadowRow,
    llm_normalized_output: {
      summary_short: "Licensed security role.",
      role_title_normalized: "Security Guard",
      requirements: [
        { value: requirementValue, type: "certification", required: true },
      ],
      keywords_canonical: [requirementValue],
      licenses_or_certifications: [requirementValue],
      schedule_constraints: [],
      environment: {
        customer_facing: null,
        onsite: null,
        physical_standing: null,
        retail: null,
      },
      confidence: "high",
    },
  };
}

type VisibleJobMatchReview = ReturnType<typeof buildJobMatchReviewFromStructuredDebug>;

function visibleReviewText(review: VisibleJobMatchReview): string {
  return [review.one_liner, ...review.why_this_may_interest_you, ...review.watch_out].join(
    "\n",
  );
}

function expectCompactReviewCopy(review: VisibleJobMatchReview): void {
  expect(review.one_liner.length).toBeLessThanOrEqual(120);
  for (const item of review.why_this_may_interest_you) {
    expect(item.length).toBeLessThanOrEqual(80);
  }
  for (const item of review.watch_out) {
    expect(item.length).toBeLessThanOrEqual(100);
  }
  expect(visibleReviewText(review)).not.toMatch(/maps to profile evidence/i);
  expect(visibleReviewText(review)).not.toMatch(
    /No concrete profile evidence was strong enough/i,
  );
}

describe("structured match-read shadow scorer", () => {
  it("selects only current-policy valid non-fallback LLM extraction rows", () => {
    expect(
      selectEligibleStructuredJobExtraction({
        model: "mistral-small-latest",
        promptVersion: "p9_v2",
        shadowRows: [
          { ...validKithShadowRow, validation_status: "schema_invalid" },
          { ...validKithShadowRow, fallback_used: true },
          { ...validKithShadowRow, prompt_version: "old" },
          validKithShadowRow,
        ],
      })?.normalizedOutput.role_title_normalized,
    ).toBe("Security Guard");
  });

  it("ignores mistral-small-latest rows when current policy is Ministral 3 3B", () => {
    expect(
      selectEligibleStructuredJobExtraction({
        model: "ministral-3b-2512",
        promptVersion: "p9_v2",
        shadowRows: [validKithShadowRow],
      }),
    ).toBeNull();
  });

  it("ignores old p9_v1 rows under the current prompt version", () => {
    expect(
      selectEligibleStructuredJobExtraction({
        model: "mistral-small-latest",
        promptVersion: "p9_v2",
        shadowRows: [{ ...validKithShadowRow, prompt_version: "p9_v1" }],
      }),
    ).toBeNull();
  });

  it("rejects translated English shadow rows for French source-language jobs", () => {
    const translatedFrenchJob: NormalizedJobExtraction = {
      summary_short: "Customer support role tracking incoming requests.",
      role_title_normalized: "Customer Support Specialist",
      requirements: [
        { value: "customer support", type: "skill", required: true },
        { value: "ticket management", type: "skill", required: true },
        { value: "fluent French", type: "language", required: true },
      ],
      keywords_canonical: ["customer support", "ticket management", "French"],
      licenses_or_certifications: [],
      schedule_constraints: [],
      environment: {
        customer_facing: true,
        onsite: false,
        physical_standing: null,
        retail: null,
      },
      confidence: "high",
    };

    expect(
      selectEligibleStructuredJobExtraction({
        model: "mistral-small-latest",
        promptVersion: "p9_v2",
        rawLanguageDetected: "fr",
        shadowRows: [
          {
            ...validKithShadowRow,
            llm_normalized_output: translatedFrenchJob,
          },
        ],
      }),
    ).toBeNull();
  });

  it("prefers source-language French rows over newer translated rows", () => {
    const translatedFrenchJob: NormalizedJobExtraction = {
      summary_short: "Customer support role tracking incoming requests.",
      role_title_normalized: "Customer Support Specialist",
      requirements: [
        { value: "customer support", type: "skill", required: true },
        { value: "ticket management", type: "skill", required: true },
        { value: "fluent French", type: "language", required: true },
      ],
      keywords_canonical: ["customer support", "ticket management", "French"],
      licenses_or_certifications: [],
      schedule_constraints: [],
      environment: {
        customer_facing: true,
        onsite: false,
        physical_standing: null,
        retail: null,
      },
      confidence: "high",
    };
    const sourceLanguageFrenchJob: NormalizedJobExtraction = {
      summary_short: "Poste de support client avec suivi des demandes.",
      role_title_normalized: "Charge de support client",
      requirements: [
        { value: "support client", type: "skill", required: true },
        { value: "gestion des demandes", type: "skill", required: true },
        { value: "Francais courant", type: "language", required: true },
      ],
      keywords_canonical: ["support client", "gestion des demandes", "Francais"],
      licenses_or_certifications: [],
      schedule_constraints: [],
      environment: {
        customer_facing: true,
        onsite: false,
        physical_standing: null,
        retail: null,
      },
      confidence: "high",
    };

    expect(
      selectEligibleStructuredJobExtraction({
        model: "mistral-small-latest",
        promptVersion: "p9_v2",
        rawLanguageDetected: "fr",
        shadowRows: [
          {
            ...validKithShadowRow,
            llm_normalized_output: sourceLanguageFrenchJob,
            created_at: 100,
          },
          {
            ...validKithShadowRow,
            llm_normalized_output: translatedFrenchJob,
            created_at: 200,
          },
        ],
      })?.normalizedOutput.role_title_normalized,
    ).toBe("Charge de support client");
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
      promptVersion: "p9_v2",
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

  it("excludes retail benefits and brand boilerplate from scorable requirements", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "retail_service_alpha_metadata_regression",
        rawLanguageDetected: "en",
      },
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
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
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
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: true,
              onsite: true,
              physical_standing: null,
              retail: true,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    const requirementText = debug.structured.jobRequirements
      .map((requirement) => requirement.value.toLowerCase())
      .join("\n");

    expect(requirementText).toContain("customer service");
    expect(requirementText).toContain("cash handling");
    expect(requirementText).not.toContain("benefits");
    expect(requirementText).not.toContain("employee discount");
    expect(requirementText).not.toContain("brand story");
    expect(requirementText).not.toContain("source platform");
    expect(requirementText).not.toContain("join our team");
    expect(requirementText).not.toContain("great place to work");
    expect(requirementText).not.toContain("compensation");
    expect(requirementText).not.toContain("miami");
    expect(requirementText).not.toContain("apply now");
    expect(debug.structured.matched.map((outcome) => outcome.requirement.value)).toEqual(
      expect.arrayContaining(["Retail Associate", "customer service", "cash handling"]),
    );
  });

  it("keeps vague soft/process phrases out of user-facing missing requirements", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "soft_process_requirement_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "profile_designer",
        summary: "Designer with ecommerce production experience.",
        skills: ["Figma", "layout design"],
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Production design role with tool requirements.",
            role_title_normalized: "Production Designer",
            requirements: [
              { value: "Figma", type: "tool", required: true },
              { value: "Strong attention to detail", type: "skill", required: true },
              { value: "Ability to follow style guides accurately", type: "skill", required: true },
            ],
            keywords_canonical: ["Figma", "production design"],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: null,
              onsite: null,
              physical_standing: null,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    const supportingRequirements = debug.structured.jobRequirements
      .filter((requirement) => requirement.importance === "supporting")
      .map((requirement) => requirement.value);
    const userFacingMissing = [
      ...debug.structured.missing,
      ...debug.structured.unknown.filter(
        (outcome) => outcome.requirement.importance !== "supporting",
      ),
      ...debug.structured.hardGateMissing,
    ].map((outcome) => outcome.requirement.value);

    expect(supportingRequirements).toEqual(
      expect.arrayContaining([
        "Strong attention to detail",
        "Ability to follow style guides accurately",
      ]),
    );
    expect(userFacingMissing).not.toEqual(
      expect.arrayContaining([
        "Strong attention to detail",
        "Ability to follow style guides accurately",
      ]),
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
      promptVersion: "p9_v2",
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
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;
    expect(debug.structured.unknown[0]).toMatchObject({
      outcome: "unknown",
      evidence: undefined,
    });
  });

  it("does not match license requirements from generic security or safety evidence", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "generic_security_training_license_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "generic_security_profile",
        summary:
          "Safety conscious security worker with protection experience and compliance awareness.",
        skills: ["security operations", "safety compliance"],
        keywords: ["security", "safety"],
        certifications: ["Security Awareness Training"],
        experience: [
          {
            company: "Venue Team",
            title: "Security Guard",
            description: "Protected guests and monitored entrances.",
          },
        ],
      },
      shadowRows: [licenseOnlyShadowRow()],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    const licenseOutcome = [
      ...debug.structured.matched,
      ...debug.structured.partial,
      ...debug.structured.unknown,
    ].find((outcome) => outcome.requirement.value === "security guard license");

    expect(licenseOutcome).toMatchObject({
      outcome: "unknown",
      evidence: undefined,
    });
  });

  it("matches explicit structured credential evidence for credential requirements", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "explicit_security_license_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "explicit_license_profile",
        summary: "Security worker.",
        certifications: ["security guard license"],
      },
      shadowRows: [licenseOnlyShadowRow()],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    const licenseOutcome = debug.structured.matched.find(
      (outcome) => outcome.requirement.value === "security guard license",
    );

    expect(licenseOutcome).toMatchObject({
      outcome: "matched",
      evidence: expect.objectContaining({
        sourceSection: "certifications",
        evidenceText: "security guard license",
      }),
    });
  });

  it("treats exact raw text credential evidence as weaker than structured credentials", () => {
    const rawOnly = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "raw_text_security_license_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "raw_credential_profile",
        summary: "Security worker.",
        raw_text: "Security Guard Certificate Program (SOCP), ASIS International.",
      },
      shadowRows: [licenseOnlyShadowRow()],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });
    const structured = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "structured_security_license_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "structured_credential_profile",
        summary: "Security worker.",
        certifications: ["Security Guard Certificate Program (SOCP)"],
        raw_text: "Security Guard Certificate Program (SOCP), ASIS International.",
      },
      shadowRows: [licenseOnlyShadowRow()],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(rawOnly.structured.status).toBe("available");
    expect(structured.structured.status).toBe("available");
    if (rawOnly.structured.status !== "available" || structured.structured.status !== "available") {
      return;
    }

    const rawOutcome = rawOnly.structured.partial.find(
      (outcome) => outcome.requirement.value === "security guard license",
    );
    const structuredOutcome = structured.structured.matched.find(
      (outcome) => outcome.requirement.value === "security guard license",
    );

    expect(rawOutcome).toMatchObject({
      outcome: "partial",
      evidence: expect.objectContaining({
        sourceSection: "raw_text",
      }),
    });
    expect(structuredOutcome).toMatchObject({
      outcome: "matched",
      evidence: expect.objectContaining({
        sourceSection: "certifications",
      }),
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
      promptVersion: "p9_v2",
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
      promptVersion: "p9_v2",
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
      debug.structured.matched.find(
        (item) => item.requirement.value === "security guard license",
      )?.evidence,
    ).toMatchObject({
      sourceSection: "certifications",
      evidenceText: expect.stringMatching(
        /Certified Protection Guard Program|Security Guard Certificate Program|CPOP|SOCP/,
      ),
    });
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

  it("uses general structured CV evidence for common cross-role requirements", () => {
    const old = oldKithMatchRead();
    const debug = buildStructuredMatchReadDebug({
      old,
      job: {
        id: "common_cross_role_requirements_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "profile_common_cross_role",
        summary:
          "Operations coordinator with customer service experience, report writing, stakeholder interviews, tablet app workflows, and a bachelor's degree.",
        skills: ["customer service", "digital record keeping"],
        experience: [
          {
            company: "City Services",
            title: "Customer Service Associate",
            description:
              "Helped visitors, completed daily reports, interviewed customers for intake notes, and used tablet apps for digital records.",
          },
        ],
        cvDocument: {
          metadata: {
            authoritativeResume: {
              normalized: {
                education: [
                  {
                    degree: "Bachelor of Arts",
                    institution: "State College",
                  },
                ],
              },
            },
          },
        },
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Operations role requiring customer-facing communication and digital tools.",
            role_title_normalized: "Operations Associate",
            requirements: [
              { value: "Basic computer knowledge", type: "skill", required: true },
              { value: "Strong communication skills", type: "skill", required: true },
              { value: "High school diploma or equivalent", type: "education", required: true },
              { value: "Customer service experience", type: "experience", required: true },
              { value: "Comfortable using a computer/tablet", type: "tool", required: true },
            ],
            keywords_canonical: [
              "computer",
              "communication",
              "customer service",
            ],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: true,
              onsite: true,
              physical_standing: true,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    const matchedOrPartial = [
      ...debug.structured.matched,
      ...debug.structured.partial,
    ].map((outcome) => outcome.requirement.value);
    const missing = [
      ...debug.structured.missing,
      ...debug.structured.unknown,
      ...debug.structured.hardGateMissing,
    ].map((outcome) => outcome.requirement.value);

    expect(matchedOrPartial).toEqual(
      expect.arrayContaining([
        "Basic computer knowledge",
        "Strong communication skills",
        "High school diploma or equivalent",
        "Customer service experience",
        "Comfortable using a computer/tablet",
      ]),
    );
    expect(missing).not.toEqual(
      expect.arrayContaining([
        "Basic computer knowledge",
        "Strong communication skills",
        "High school diploma or equivalent",
        "Customer service experience",
        "Comfortable using a computer/tablet",
      ]),
    );
    expect(debug.structured.structuredScore).toBeGreaterThan(0);
  });

  it("keeps a directional nonzero score when role evidence is clear but exact requirements are still missing", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "directional_role_signal_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "profile_event_coordinator",
        summary: "Event coordinator with venue operations experience.",
        experience: [
          {
            company: "City Venue",
            title: "Event Coordinator",
            description: "Coordinated event setup, vendor handoffs, and guest flow.",
          },
        ],
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Event Coordinator role with several specific requirements.",
            role_title_normalized: "Event Coordinator",
            requirements: [
              { value: "Forklift certification", type: "certification", required: true },
              { value: "Payroll system administration", type: "tool", required: true },
              { value: "French fluency", type: "language", required: false },
            ],
            keywords_canonical: ["event coordination", "forklift", "payroll"],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: true,
              onsite: true,
              physical_standing: null,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    expect(debug.structured.structuredScore).toBeGreaterThan(0);
    expect(debug.structured.structuredScore).toBeLessThan(35);
    expect(debug.structured.structuredTier).toBe("weak");
    expect(debug.structured.matched.map((outcome) => outcome.requirement.value)).toEqual(
      expect.arrayContaining(["Event Coordinator"]),
    );
    expect(
      [
        ...debug.structured.unknown,
        ...debug.structured.hardGateMissing,
      ].map((outcome) => outcome.requirement.value),
    ).toEqual(
      expect.arrayContaining([
        "Forklift certification",
        "Payroll system administration",
        "French fluency",
      ]),
    );
  });

  it("adapts available structured scoring into the visible match-read shape", () => {
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
      promptVersion: "p9_v2",
    });
    const visible = buildVisibleMatchReadFromStructuredDebug({
      pendingMatchRead: old,
      debug,
      now: 4321,
    });

    expect(visible.score).toBeGreaterThan(0);
    expect(visible.scoreVisible).toBe(true);
    expect(visible.method).toBe("llm");
    expect(visible.fallback).toBe("none");
    expect(visible.computedAt).toBe(4321);
    expect(visible.matched).toEqual(
      expect.arrayContaining(["Security Guard", "security guard license"]),
    );
    expect(visible.missing).not.toEqual(
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
  });

  it("caps high-unknown sparse matches below partial confidence", () => {
    const old = oldKithMatchRead();
    const debug = buildStructuredMatchReadDebug({
      old,
      job: {
        id: "short_noisy_alpha_regression",
        rawLanguageDetected: "en",
      },
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
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Short noisy cashier posting with thin evidence.",
            role_title_normalized: "Cashier",
            requirements: [
              { value: "cash handling", type: "skill", required: true },
              { value: "customer communication", type: "skill", required: true },
              { value: "lottery terminal operation", type: "tool", required: true },
              { value: "inventory reconciliation", type: "skill", required: false },
            ],
            keywords_canonical: ["cash handling"],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: true,
              onsite: true,
              physical_standing: null,
              retail: true,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    const matchedScorableCount = debug.structured.matched.filter(
      (outcome) => outcome.requirement.importance !== "supporting",
    ).length;

    expect(matchedScorableCount).toBe(1);
    expect(debug.structured.unknown.length).toBeGreaterThanOrEqual(2);
    expect(debug.structured.structuredScore).toBeLessThan(35);
    expect(debug.structured.structuredTier).toBe("weak");
  });

  it("does not allow strong tier when matched scorable evidence is too thin", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "thin_strong_guard_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "thin_profile",
        summary: "Certified security guard.",
        skills: ["security guard"],
        keywords: ["security guard"],
        certifications: ["security guard license"],
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Sparse licensed security posting.",
            role_title_normalized: "Security Guard",
            requirements: [
              { value: "security guard license", type: "certification", required: true },
            ],
            keywords_canonical: ["security guard license"],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: null,
              onsite: null,
              physical_standing: null,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    expect(debug.structured.matched).toHaveLength(1);
    expect(debug.structured.structuredTier).not.toBe("strong");
  });

  it("marks missing required regulated credentials as hard-gate missing and prevents strong tier", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "healthcare_hard_gate_missing_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "profile_patient_intake_no_cert",
        summary: "Patient intake specialist with clinic front desk experience.",
        skills: ["patient intake", "HIPAA compliance"],
        keywords: ["patient intake", "HIPAA"],
        experience: [
          {
            company: "Community Clinic",
            title: "Patient Intake Coordinator",
            description: "Handled patient intake and HIPAA-compliant chart updates.",
          },
        ],
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Medical Assistant role requiring certification and patient intake.",
            role_title_normalized: "Medical Assistant",
            requirements: [
              { value: "medical assistant certification", type: "certification", required: true },
              { value: "patient intake", type: "skill", required: true },
              { value: "HIPAA compliance", type: "skill", required: true },
            ],
            keywords_canonical: ["medical assistant", "patient intake", "HIPAA"],
            licenses_or_certifications: ["medical assistant certification"],
            schedule_constraints: [],
            environment: {
              customer_facing: true,
              onsite: true,
              physical_standing: null,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    expect(debug.structured.hardGateMissing).toEqual([
      expect.objectContaining({
        outcome: "hard_gate_missing",
        evidence: undefined,
        requirement: expect.objectContaining({
          value: "medical assistant certification",
        }),
        reason: expect.stringContaining("Required regulated credential"),
      }),
    ]);
    expect(debug.structured.structuredTier).not.toBe("strong");
  });

  it("allows present regulated credentials to score normally", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "healthcare_hard_gate_present_regression",
        rawLanguageDetected: "en",
      },
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
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Medical Assistant role requiring certification and patient intake.",
            role_title_normalized: "Medical Assistant",
            requirements: [
              { value: "medical assistant certification", type: "certification", required: true },
              { value: "patient intake", type: "skill", required: true },
              { value: "HIPAA compliance", type: "skill", required: true },
            ],
            keywords_canonical: ["medical assistant", "patient intake", "HIPAA"],
            licenses_or_certifications: ["medical assistant certification"],
            schedule_constraints: [],
            environment: {
              customer_facing: true,
              onsite: true,
              physical_standing: null,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    expect(debug.structured.hardGateMissing).toEqual([]);
    expect(
      debug.structured.matched.find(
        (outcome) => outcome.requirement.value === "medical assistant certification",
      ),
    ).toMatchObject({
      outcome: "matched",
      evidence: expect.objectContaining({
        sourceSection: "certifications",
      }),
    });
    expect(debug.structured.structuredTier).toBe("strong");
  });

  it("does not hard gate optional or generic training certifications", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "optional_training_not_hard_gate_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "profile_retail_no_training",
        summary: "Retail associate with customer service and cash handling experience.",
        skills: ["customer service", "cash handling"],
        keywords: ["customer service", "cash handling"],
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Retail Associate role with optional training preference.",
            role_title_normalized: "Retail Associate",
            requirements: [
              { value: "customer service", type: "skill", required: true },
              { value: "product knowledge training certificate", type: "certification", required: false },
            ],
            keywords_canonical: ["customer service"],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: true,
              onsite: true,
              physical_standing: null,
              retail: true,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    expect(debug.structured.hardGateMissing).toEqual([]);
    expect(debug.structured.unknown.map((outcome) => outcome.requirement.value)).toContain(
      "product knowledge training certificate",
    );
  });

  it("builds a user-facing review for semantic protection/security alignment without exact keyword dependence", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "unarmed_airport_security_semantic_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "profile_protection_guard_no_license",
        summary:
          "Protection guard with patrol, incident response, public safety, and visitor support experience.",
        skills: ["incident response", "customer service", "site safety"],
        experience: [
          {
            company: "Metro Protection",
            title: "Protection Guard",
            description:
              "Patrolled airport public areas, monitored access points, handled incident response, and supported passengers with customer service.",
          },
        ],
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short:
              "Unarmed airport security guard role focused on patrol, public safety, incident response, and customer service.",
            role_title_normalized: "Unarmed Security Guard",
            requirements: [
              { value: "patrol airport public areas", type: "experience", required: true },
              { value: "incident response", type: "skill", required: true },
              { value: "customer service", type: "skill", required: true },
              { value: "guard card/license preferred", type: "certification", required: false },
            ],
            keywords_canonical: [
              "unarmed security",
              "airport patrol",
              "incident response",
              "customer service",
            ],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: true,
              onsite: true,
              physical_standing: true,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    const review = buildJobMatchReviewFromStructuredDebug(debug);

    expect(review.verdict).toEqual(expect.stringMatching(/^(strong_lead|possible_lead)$/));
    expect(review.score).toBeGreaterThan(55);
    expect(review.suggested_next_step).toBe("apply_if_requirement_true");
    expect(review.why_this_may_interest_you.join("\n").toLowerCase()).toContain(
      "incident response",
    );
    expect(review.watch_out.join("\n").toLowerCase()).toMatch(/guard card|license/);
    expectCompactReviewCopy(review);
    expect(review.missing_or_unclear_requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirement: "guard card/license preferred",
          severity: "unclear",
        }),
      ]),
    );
    expect(review.missing_or_unclear_requirements).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirement: "guard card/license preferred",
          severity: "blocking",
        }),
      ]),
    );
  });

  it("compresses long raw evidence into short user-facing review copy", () => {
    const longEvidence =
      "Led customer intake, report writing, and follow-up coordination across multiple queues. " +
      "This raw paragraph should not surface in the visible review.";

    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "long_review_copy_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "profile_long_review_copy",
        summary: longEvidence,
        experience: [
          {
            company: "Northwind",
            title: "Operations Associate",
            description: longEvidence,
          },
        ],
        skills: ["customer service", "report writing"],
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Operations role with customer contact and reporting.",
            role_title_normalized: "Operations Associate",
            requirements: [
              { value: "customer service", type: "skill", required: true },
              { value: "report writing", type: "skill", required: true },
              { value: "coordination", type: "skill", required: true },
            ],
            keywords_canonical: ["customer service", "report writing", "coordination"],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: true,
              onsite: true,
              physical_standing: null,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    const review = buildJobMatchReviewFromStructuredDebug(debug);

    expect(review.verdict).toEqual(expect.stringMatching(/^(strong_lead|possible_lead)$/));
    expectCompactReviewCopy(review);
    expect(visibleReviewText(review)).not.toContain(longEvidence);
    expect(review.why_this_may_interest_you.join(" ")).toContain("Customer service");
    expect(review.why_this_may_interest_you.join(" ")).toContain("Report writing");
  });

  it("redacts email phone and UUID-like text from visible review copy", () => {
    const piiBlob =
      "alex@example.com +1 (415) 555-2671 123e4567-e89b-12d3-a456-426614174000";

    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "pii_review_copy_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "profile_pii_review_copy",
        summary: piiBlob,
        experience: [
          {
            company: "Metro Ops",
            title: "Operations Associate",
            description: `Handled intake, reporting, and follow-up. ${piiBlob}`,
          },
        ],
        skills: ["customer service", "report writing"],
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Customer-facing operations role.",
            role_title_normalized: "Operations Associate",
            requirements: [
              { value: "customer service", type: "skill", required: true },
              { value: "report writing", type: "skill", required: true },
            ],
            keywords_canonical: ["customer service", "report writing"],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: true,
              onsite: true,
              physical_standing: null,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    const review = buildJobMatchReviewFromStructuredDebug(debug);
    const visibleText = visibleReviewText(review);

    expect(review.verdict).toEqual(expect.stringMatching(/^(strong_lead|possible_lead)$/));
    expectCompactReviewCopy(review);
    expect(visibleText).not.toContain("alex@example.com");
    expect(visibleText).not.toContain("555-2671");
    expect(visibleText).not.toContain("123e4567-e89b-12d3-a456-426614174000");
  });

  it("omits debug phrasing from visible review copy", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "debug_phrase_copy_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "profile_debug_phrase_copy",
        summary: "Protection guard with patrol and incident response experience.",
        skills: ["incident response", "customer service"],
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Unarmed airport security guard role.",
            role_title_normalized: "Unarmed Security Guard",
            requirements: [
              { value: "incident response", type: "skill", required: true },
              { value: "customer service", type: "skill", required: true },
              { value: "guard card/license preferred", type: "certification", required: false },
            ],
            keywords_canonical: ["incident response", "customer service"],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: true,
              onsite: true,
              physical_standing: true,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    const review = buildJobMatchReviewFromStructuredDebug(debug);
    const visibleText = visibleReviewText(review);

    expectCompactReviewCopy(review);
    expect(visibleText).not.toMatch(/maps to profile evidence/i);
    expect(visibleText).not.toMatch(/No concrete profile evidence was strong enough/i);
  });

  it("returns not enough signal when profile evidence is missing", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "missing_profile_review_regression",
        rawLanguageDetected: "en",
      },
      profile: {},
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Operations role with customer contact.",
            role_title_normalized: "Operations Associate",
            requirements: [
              { value: "customer service", type: "skill", required: true },
              { value: "report writing", type: "skill", required: true },
            ],
            keywords_canonical: ["customer service", "report writing"],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: true,
              onsite: true,
              physical_standing: null,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    const review = buildJobMatchReviewFromStructuredDebug(debug);

    expect(review.verdict).toBe("not_enough_signal");
    expect(review.one_liner).toContain("Not enough signal");
    expect(review.one_liner).not.toContain("Probably skip");
    expect(review.suggested_next_step).toBe("review_manually");
    expect(review.why_this_may_interest_you).toEqual([]);
    expect(review.watch_out).toEqual([]);
  });

  it("keeps standalone generic fragments out of structured missing requirements", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "generic_requirement_fragments_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "profile_security_patrol",
        summary: "Security guard with patrol experience.",
        skills: ["security patrol"],
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Security patrol role with noisy requirement fragments.",
            role_title_normalized: "Security Guard",
            requirements: [
              { value: "security patrol", type: "skill", required: true },
              { value: "valid", type: "skill", required: true },
              { value: "ability", type: "skill", required: true },
              { value: "preferred", type: "skill", required: false },
              { value: "lift", type: "constraint", required: true },
              { value: "more", type: "skill", required: false },
            ],
            keywords_canonical: ["security patrol"],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: null,
              onsite: true,
              physical_standing: true,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    const userFacingMissing = [
      ...debug.structured.missing,
      ...debug.structured.unknown,
      ...debug.structured.hardGateMissing,
    ].map((outcome) => outcome.requirement.value.toLowerCase());

    for (const genericFragment of ["valid", "ability", "preferred", "lift", "more"]) {
      expect(
        debug.structured.jobRequirements.map((item) => item.value.toLowerCase()),
      ).not.toContain(genericFragment);
      expect(userFacingMissing).not.toContain(genericFragment);
    }
  });

  it("flags a required security license as an important risk without inferring credentials", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "required_security_license_no_inference_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "profile_security_no_license",
        summary: "Protection guard with patrol and incident response experience.",
        skills: ["security patrol", "incident response"],
        experience: [
          {
            company: "Metro Protection",
            title: "Protection Guard",
            description: "Patrolled public sites and handled incident response.",
          },
        ],
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Security guard role requiring license, patrol, and incident response.",
            role_title_normalized: "Security Guard",
            requirements: [
              { value: "security guard license", type: "certification", required: true },
              { value: "security patrol", type: "skill", required: true },
              { value: "incident response", type: "skill", required: true },
            ],
            keywords_canonical: ["security guard", "security patrol", "incident response"],
            licenses_or_certifications: ["security guard license"],
            schedule_constraints: [],
            environment: {
              customer_facing: true,
              onsite: true,
              physical_standing: true,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    const review = buildJobMatchReviewFromStructuredDebug(debug);

    expect(review.missing_or_unclear_requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirement: "security guard license",
          severity: "important",
        }),
      ]),
    );
    expect(review.evidence.map((item) => item.job_signal)).not.toContain(
      "security guard license",
    );
    expect(review.suggested_next_step).toBe("apply_if_requirement_true");
    expect(review.score).toBeLessThan(90);
  });

  it("returns a probably-skip review for a clearly unrelated specialist job", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "security_profile_unrelated_specialist_regression",
        rawLanguageDetected: "en",
      },
      profile: robertProfile,
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Frontend platform engineer role focused on React and API architecture.",
            role_title_normalized: "Frontend Platform Engineer",
            requirements: [
              { value: "React", type: "skill", required: true },
              { value: "TypeScript", type: "skill", required: true },
              { value: "API architecture", type: "skill", required: true },
            ],
            keywords_canonical: ["React", "TypeScript", "API architecture"],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: null,
              onsite: false,
              physical_standing: null,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    const review = buildJobMatchReviewFromStructuredDebug(debug);

    expect(review.verdict).toBe("probably_skip");
    expect(review.suggested_next_step).toBe("skip");
    expect(review.score).toBeLessThan(35);
  });

  it("uses project and achievement body text as concrete tool and outcome evidence", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "technical_project_evidence_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "profile_project_evidence",
        summary: "Product builder with dashboard experience.",
        projects: [
          {
            name: "Customer onboarding dashboard",
            description: "Built React and TypeScript workflows backed by API integration.",
          },
        ],
        achievements: [
          {
            title: "Activation improvement",
            description: "Improved customer onboarding activation by 22%.",
          },
        ],
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Frontend role building onboarding dashboards.",
            role_title_normalized: "Frontend Engineer",
            requirements: [
              { value: "React", type: "tool", required: true },
              { value: "API integration", type: "tool", required: true },
              { value: "customer onboarding", type: "skill", required: false },
            ],
            keywords_canonical: ["React", "API integration", "customer onboarding"],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: null,
              onsite: null,
              physical_standing: null,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    expect(debug.structured.matched).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirement: expect.objectContaining({ value: "React" }),
          evidence: expect.objectContaining({
            sourceSection: "projects",
            evidenceText: expect.stringContaining("React and TypeScript"),
          }),
        }),
        expect.objectContaining({
          requirement: expect.objectContaining({ value: "API integration" }),
          evidence: expect.objectContaining({
            sourceSection: "projects",
          }),
        }),
      ]),
    );
    expect(debug.structured.profileEvidence.map((item) => item.evidenceText).join("\n")).toEqual(
      expect.stringContaining("Improved customer onboarding activation"),
    );
  });

  it("lets summary support general requirements but caps it below a full match", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "summary_support_cap_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "profile_summary_only",
        summary:
          "Security operations professional with incident response and visitor safety experience.",
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Security operations role.",
            role_title_normalized: "Security Operations Specialist",
            requirements: [
              { value: "incident response", type: "skill", required: true },
            ],
            keywords_canonical: ["incident response"],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: null,
              onsite: null,
              physical_standing: null,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    expect(debug.structured.matched).toEqual([]);
    expect(debug.structured.partial).toEqual([
      expect.objectContaining({
        requirement: expect.objectContaining({ value: "incident response" }),
        evidence: expect.objectContaining({
          sourceSection: "summary",
        }),
      }),
    ]);
    expect(debug.structured.structuredScore).toBe(50);
  });

  it("uses affiliations and additional information as capped support evidence", () => {
    const debug = buildStructuredMatchReadDebug({
      old: oldKithMatchRead(),
      job: {
        id: "additional_affiliations_support_regression",
        rawLanguageDetected: "en",
      },
      profile: {
        _id: "profile_additional_affiliations",
        affiliations: [
          {
            organization: "National Public Safety Association",
            role: "Member",
          },
        ],
        additional_information: [
          "Completed first aid training and emergency response workshops.",
        ],
      },
      shadowRows: [
        {
          ...validKithShadowRow,
          llm_normalized_output: {
            summary_short: "Public safety support role.",
            role_title_normalized: "Public Safety Officer",
            requirements: [
              { value: "public safety", type: "skill", required: true },
              { value: "first aid training", type: "certification", required: false },
            ],
            keywords_canonical: ["public safety", "first aid"],
            licenses_or_certifications: [],
            schedule_constraints: [],
            environment: {
              customer_facing: null,
              onsite: null,
              physical_standing: null,
              retail: null,
            },
            confidence: "high",
          },
        },
      ],
      model: "mistral-small-latest",
      promptVersion: "p9_v2",
    });

    expect(debug.structured.status).toBe("available");
    if (debug.structured.status !== "available") return;

    expect(debug.structured.matched).toEqual([]);
    expect(debug.structured.partial.map((outcome) => outcome.evidence?.sourceSection)).toEqual(
      expect.arrayContaining(["affiliations", "additional_information"]),
    );
    expect(debug.structured.structuredTier).toBe("partial");
    expect(debug.structured.structuredScore).toBeLessThan(75);
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
