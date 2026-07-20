import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveOpenAIProposalReasoningEffort } from "../../../../config/llmConfig";
import {
  MISTRAL_PREMIUM_COVER_LETTER_ADAPTER,
  PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA,
  PREMIUM_WRITER_OUTPUT_V1_SCHEMA,
  PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
  QWEN_PREMIUM_COVER_LETTER_ADAPTER,
  attemptPremiumCoverLetterGeneration,
  buildAllowedFactsPack,
  buildAllowedFactsPackFromFactGraph,
  buildPremiumClaimPlanV1,
  buildPremiumFactGraphV1,
  buildPremiumJobDemandGraphV1,
  buildJobOfferPriorityPack,
  buildPremiumCoverLetterOpenAIRequest,
  buildPremiumCoverLetterOpenAIRequestForExactModel,
  buildPremiumCoverLetterBrief,
  buildPremiumCoverLetterFinalProvenance,
  buildPremiumCoverLetterPrompt,
  evaluatePremiumCoverLetterQualityShadow,
  evaluatePremiumCoverLetterEligibility,
  extractOpenAIJsonPayload,
  inferPremiumCoverLetterContextClass,
  isCoverLetterQualityRepairV1Enabled,
  isCoverLetterPremiumPromptV2Enabled,
  isCoverLetterPremiumPathV1Enabled,
  isPremiumCoverLetterPromptV2MistralEnabled,
  premiumCoverLetterFinalProvenanceSatisfiesCandidateEvidence,
  rankAllowedFacts,
  repairPremiumCoverLetterBodyParts,
  resolvePremiumCoverLetterWriterModel,
  toCoverLetterBodyParts,
  validatePremiumCoverLetterBodyParts,
  validatePremiumClaimPlanV1,
  validatePremiumWriterOutputV1,
} from "../premiumCoverLetter";
import {
  generateOpenAIResponsesStructured,
  type OpenAIResponsesSchemaContract,
} from "../premiumCoverLetterOpenAITransport";

afterEach(() => {
  vi.unstubAllEnvs();
});

const directContext = {
  name: "Alex Martin",
  summary:
    "Frontend engineer building customer-facing web applications and reusable UI systems.",
  topSkills: ["React", "TypeScript", "Excel"],
  recentExperience: [
    {
      company: "Orbit",
      position: "Senior Frontend Engineer",
      highlights: [
        "Improved signup conversion by 11% after iterative UI experiments.",
        "Led a design system migration used across 4 product squads.",
      ],
    },
  ],
  standoutAchievements: [
    "Built experimentation dashboards used by product and growth teams.",
  ],
};

const directJob = {
  jobTitle: "Senior Frontend Engineer",
  jobDescription:
    "Lead React and TypeScript delivery for customer-facing web applications, design systems, and experimentation workflows. Outstanding benefits and a mission-led culture are part of the package.",
};

const adjacentContext = {
  name: "Maya Chen",
  summary:
    "Operations specialist working across reporting, handoffs, and process documentation.",
  topSkills: ["Zendesk", "Excel", "Process documentation"],
  recentExperience: [
    {
      company: "Northline",
      position: "Customer Operations Coordinator",
      highlights: [
        "Owned ticket triage, handoffs, and SLA reporting across support and product teams.",
        "Built weekly dashboards to track backlog, response times, and process bottlenecks.",
      ],
    },
  ],
  standoutAchievements: [
    "Reduced backlog response times by 18% through queue and handoff changes.",
  ],
};

const adjacentJob = {
  jobTitle: "Implementation Analyst",
  jobDescription:
    "Coordinate implementation workflows, track deliverables, manage cross-functional handoffs, and maintain reporting across teams.",
};

const adjacentMonitoringContext = {
  name: "Robert Cooper",
  summary:
    "Safety conscious site guard with eight years experience protecting VIP individuals and defense sites.",
  topSkills: [
    "Investigation skills",
    "Safety compliance",
    "Criminal justice knowledge",
  ],
  recentExperience: [
    {
      company: "Sentinel Services",
      position: "Security Guard",
      highlights: [
        "Completed reports by recording observations, occurrences, surveillance activities, and interviewing witnesses.",
      ],
    },
    {
      company: "WatchDesk",
      position: "Security Guard",
      highlights: [
        "Monitored selected areas via CCTV app on smart devices and scanned grounds for suspicious items.",
      ],
    },
  ],
};

const adjacentMonitoringJob = {
  jobTitle: "Operations Associate",
  jobDescription:
    "Maintain site safety through structured patrols, access control, incident response, detailed reporting, key checkouts, professional communication, and escalation to an operations center.",
};

function buildDirectClaimPlanFixture() {
  const factGraph = buildPremiumFactGraphV1({
    personalizationContext: directContext,
    jobDescription: directJob.jobDescription,
  });
  const jobDemandGraph = buildPremiumJobDemandGraphV1(directJob.jobDescription);
  const allowedFactsPack = buildAllowedFactsPackFromFactGraph(factGraph);
  const rankedEvidencePack = rankAllowedFacts({
    allowedFactsPack,
    jobTitle: directJob.jobTitle,
    jobDescription: directJob.jobDescription,
    contextClass: "cv_direct",
  });
  const claimPlan = buildPremiumClaimPlanV1({
    factGraph,
    jobDemandGraph,
    rankedEvidencePack,
    contextClass: "cv_direct",
    preset: "signature",
    outputLanguage: "English",
    jobTitle: directJob.jobTitle,
  });
  const brief = buildPremiumCoverLetterBrief({
    preset: "signature",
    outputLanguage: "English",
    jobTitle: directJob.jobTitle,
    jobDescription: directJob.jobDescription,
    contextClass: "cv_direct",
    allowedFactsPack,
    rankedEvidencePack,
    claimPlan,
    factGraph,
    jobDemandGraph,
  });
  return { factGraph, jobDemandGraph, rankedEvidencePack, claimPlan, brief };
}

function buildDirectPremiumWriterOutputFixture(bodyParts: {
  opening: string;
  proofBlock: string;
  employerValueBlock: string;
  closeLine: string;
}) {
  const { claimPlan } = buildDirectClaimPlanFixture();
  const openingClaim = claimPlan.claims.find((claim) => claim.section === "opening")!;
  const proofClaim = claimPlan.claims.find((claim) => claim.section === "proofBlock")!;
  const employerClaim = claimPlan.claims.find(
    (claim) => claim.section === "employerValueBlock",
  )!;
  const closeClaim = claimPlan.claims.find((claim) => claim.section === "closeLine")!;
  return {
    version: "premium_writer_output_v1" as const,
    bodyParts: {
      opening: {
        section: "opening" as const,
        text: bodyParts.opening,
        claimIds: [openingClaim.id],
        factIds: openingClaim.factIds,
        demandIds: openingClaim.demandIds,
      },
      proofBlock: {
        section: "proofBlock" as const,
        text: bodyParts.proofBlock,
        claimIds: [proofClaim.id],
        factIds: proofClaim.factIds,
        demandIds: proofClaim.demandIds,
      },
      employerValueBlock: {
        section: "employerValueBlock" as const,
        text: bodyParts.employerValueBlock,
        claimIds: [employerClaim.id],
        factIds: employerClaim.factIds,
        demandIds: employerClaim.demandIds,
      },
      closeLine: {
        section: "closeLine" as const,
        text: bodyParts.closeLine,
        claimIds: [closeClaim.id],
        factIds: closeClaim.factIds,
        demandIds: closeClaim.demandIds,
      },
    },
  };
}

async function withQualityRepairFlag<T>(
  value: string | undefined,
  run: () => Promise<T>,
): Promise<T> {
  const previous = process.env.ENABLE_COVER_LETTER_QUALITY_REPAIR_V1;
  if (value === undefined) {
    delete process.env.ENABLE_COVER_LETTER_QUALITY_REPAIR_V1;
  } else {
    process.env.ENABLE_COVER_LETTER_QUALITY_REPAIR_V1 = value;
  }
  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env.ENABLE_COVER_LETTER_QUALITY_REPAIR_V1;
    } else {
      process.env.ENABLE_COVER_LETTER_QUALITY_REPAIR_V1 = previous;
    }
  }
}

function attemptDirectQualityRepair(
  writer: Parameters<typeof attemptPremiumCoverLetterGeneration>[0]["writer"],
  personalizationContext = directContext,
) {
  return withQualityRepairFlag("1", () =>
    attemptPremiumCoverLetterGeneration({
      personalizationContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      writer,
    }),
  );
}

function attemptDirectQwenLegacyBodyParts(args: {
  bodyParts: {
    opening: string;
    proofBlock: string;
    employerValueBlock: string;
    closeLine: string;
  };
  onFailure: NonNullable<
    Parameters<typeof attemptPremiumCoverLetterGeneration>[0]["onFailure"]
  >;
}) {
  return attemptPremiumCoverLetterGeneration({
    personalizationContext: directContext,
    voicePreset: "signature",
    outputLanguage: "English",
    jobTitle: directJob.jobTitle,
    jobDescription: directJob.jobDescription,
    candidateName: "Alex Martin",
    writerProvider: "qwen",
    writerModel: "qwen3.7-max",
    onFailure: args.onFailure,
    writer: async () => args.bodyParts,
  });
}

describe("premium ClaimPlan provenance v1", () => {
  it("builds stable FactGraphV1 ids with metrics and ownership levels", () => {
    const factGraph = buildPremiumFactGraphV1({
      personalizationContext: directContext,
      jobDescription: directJob.jobDescription,
      systemInferenceHints: ["Adjacent overlap exists in related workflow."],
    });

    expect(factGraph.version).toBe("fact_graph_v1");
    expect(factGraph.facts.map((fact) => fact.id)).toEqual(
      expect.arrayContaining([
        "fact_summary_001",
        "fact_skill_001",
        "fact_experience_001_role",
        "fact_experience_001_highlight_001",
        "fact_achievement_001",
        "fact_job_post_001",
        "fact_system_001",
      ]),
    );
    expect(
      factGraph.facts.find((fact) => fact.id === "fact_experience_001_highlight_001")
        ?.metrics,
    ).toContain("11");
    expect(
      factGraph.facts.find((fact) => fact.text.includes("Led a design system"))
        ?.ownershipLevel,
    ).toBe("leadership");
  });

  it("extracts a contextual numeric employer name as an entity", () => {
    const factGraph = buildPremiumFactGraphV1({
      personalizationContext: {
        ...directContext,
        summary: "Worked at 3M improving onboarding.",
      },
      jobDescription: directJob.jobDescription,
    });

    expect(
      factGraph.facts.find((fact) => fact.id === "fact_summary_001")
        ?.entities,
    ).toContain("3M");
  });

  it.each(["7-Eleven", "1-800-Flowers"])(
    "extracts the contextual digit-leading employer %s with separators",
    (employer) => {
      const factGraph = buildPremiumFactGraphV1({
        personalizationContext: {
          ...directContext,
          summary: `Worked at ${employer} improving onboarding.`,
        },
        jobDescription: directJob.jobDescription,
      });

      expect(
        factGraph.facts.find((fact) => fact.id === "fact_summary_001")
          ?.entities,
      ).toContain(employer);
    },
  );

  it("wraps job priority buckets into stable JobDemandGraphV1 demand ids", () => {
    const jobDemandGraph = buildPremiumJobDemandGraphV1(
      "Coordinate implementation workflows. Must have reporting experience. Excel is a plus. Reliable and organized. Great benefits and mission-led culture.",
    );

    expect(jobDemandGraph.version).toBe("job_demand_graph_v1");
    expect(jobDemandGraph.demands.every((demand) => demand.mustNotBecomeCandidateClaim)).toBe(
      true,
    );
    expect(jobDemandGraph.demands.map((demand) => demand.id)).toEqual(
      expect.arrayContaining([
        "demand_core_001",
        "demand_low_value_001",
        "demand_fluff_001",
      ]),
    );
    expect(
      jobDemandGraph.demands.find((demand) => demand.id === "demand_low_value_001")
        ?.requiredness,
    ).toBe("low_value");
    expect(
      jobDemandGraph.demands.find((demand) => demand.id === "demand_fluff_001")
        ?.bucket,
    ).toBe("company_fluff");
  });

  it("builds and validates deterministic cv_direct ClaimPlanV1 sections", () => {
    const { claimPlan, factGraph, jobDemandGraph } = buildDirectClaimPlanFixture();
    const openingClaim = claimPlan.claims.find((claim) => claim.section === "opening")!;
    const proofClaim = claimPlan.claims.find((claim) => claim.section === "proofBlock")!;
    const closeClaim = claimPlan.claims.find((claim) => claim.section === "closeLine")!;

    expect(claimPlan.claims.map((claim) => claim.id)).toEqual([
      "claim_opening_001",
      "claim_proof_001",
      "claim_employer_value_001",
      "claim_close_001",
    ]);
    expect(claimPlan.claims.every((claim) => claim.factIds.length > 0)).toBe(true);
    expect(openingClaim.demandIds[0]).toMatch(/^demand_core_/);
    expect(openingClaim.editorialGuideline).toContain(
      "candidate's relevant experience",
    );
    expect(openingClaim.editorialGuideline).toContain(
      "without teaching the employer",
    );
    expect(proofClaim.factIds).not.toEqual(
      expect.arrayContaining(openingClaim.factIds),
    );
    expect(proofClaim.factIds).toHaveLength(2);
    expect(closeClaim.factIds).toEqual(
      expect.arrayContaining(proofClaim.factIds),
    );
    expect(
      claimPlan.claims.find((claim) => claim.section === "employerValueBlock")
        ?.demandIds[0],
    ).toMatch(/^demand_core_/);
    expect(validatePremiumClaimPlanV1({ claimPlan, factGraph, jobDemandGraph })).toEqual(
      [],
    );
  });

  it("keeps the English and French proof contract satisfiable with one concrete CV fact", () => {
    const { rankedEvidencePack, factGraph, jobDemandGraph } =
      buildDirectClaimPlanFixture();
    const singleFactRankedEvidencePack = {
      ...rankedEvidencePack,
      strongestEvidence: rankedEvidencePack.strongestEvidence.slice(0, 1),
      supportingEvidence: [],
      transferCore: [],
    };

    for (const outputLanguage of ["English", "French"] as const) {
      const claimPlan = buildPremiumClaimPlanV1({
        factGraph,
        jobDemandGraph,
        rankedEvidencePack: singleFactRankedEvidencePack,
        contextClass: "cv_direct",
        preset: "signature",
        outputLanguage,
        jobTitle: directJob.jobTitle,
      });
      const openingClaim = claimPlan.claims.find(
        (claim) => claim.section === "opening",
      )!;
      const proofClaim = claimPlan.claims.find(
        (claim) => claim.section === "proofBlock",
      )!;
      const brief = buildPremiumCoverLetterBrief({
        preset: "signature",
        outputLanguage,
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        contextClass: "cv_direct",
        allowedFactsPack: buildAllowedFactsPackFromFactGraph(factGraph),
        rankedEvidencePack: singleFactRankedEvidencePack,
        claimPlan,
        factGraph,
        jobDemandGraph,
      });
      const prompt = buildPremiumCoverLetterPrompt({ brief });

      expect(proofClaim.factIds).toEqual(openingClaim.factIds);
      expect(proofClaim.editorialGuideline).toContain(
        "Only one concrete CV proof is available",
      );
      expect(prompt).toContain(
        "Only one concrete CV proof is assigned; develop a different supported aspect of it once",
      );
      expect(prompt).not.toContain(
        "use the distinct fact assigned to proofBlock",
      );
    }

    const allowedFactsPack = buildAllowedFactsPackFromFactGraph(factGraph);
    const nonConcreteFact = allowedFactsPack.facts.find(
      (fact) =>
        fact.source === "cv" &&
        ["domain", "tool", "trait"].includes(fact.category),
    )!;
    const sparseRankedEvidencePack = {
      ...singleFactRankedEvidencePack,
      strongestEvidence: [
        singleFactRankedEvidencePack.strongestEvidence[0]!,
        nonConcreteFact,
      ],
    };
    const sparseClaimPlan = buildPremiumClaimPlanV1({
      factGraph,
      jobDemandGraph,
      rankedEvidencePack: sparseRankedEvidencePack,
      contextClass: "cv_direct",
      preset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
    });
    const sparseOpeningClaim = sparseClaimPlan.claims.find(
      (claim) => claim.section === "opening",
    )!;
    const sparseProofClaim = sparseClaimPlan.claims.find(
      (claim) => claim.section === "proofBlock",
    )!;
    const sparsePrompt = buildPremiumCoverLetterPrompt({
      brief: buildPremiumCoverLetterBrief({
        preset: "signature",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        contextClass: "cv_direct",
        allowedFactsPack,
        rankedEvidencePack: sparseRankedEvidencePack,
        claimPlan: sparseClaimPlan,
        factGraph,
        jobDemandGraph,
      }),
    });

    expect(sparseProofClaim.factIds).toContain(sparseOpeningClaim.factIds[0]);
    expect(sparseProofClaim.editorialGuideline).toContain(
      "Only one concrete CV proof is available",
    );
    expect(sparsePrompt).toContain(
      "Only one concrete CV proof is assigned",
    );
    expect(sparsePrompt).not.toContain(
      "Use the distinct fact assigned to proofBlock",
    );

    const noConcreteRankedEvidencePack = {
      ...singleFactRankedEvidencePack,
      strongestEvidence: [nonConcreteFact],
      supportingEvidence: [],
      transferCore: [],
    };
    const noConcreteClaimPlan = buildPremiumClaimPlanV1({
      factGraph,
      jobDemandGraph,
      rankedEvidencePack: noConcreteRankedEvidencePack,
      contextClass: "cv_direct",
      preset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
    });
    const noConcreteProofClaim = noConcreteClaimPlan.claims.find(
      (claim) => claim.section === "proofBlock",
    )!;
    const noConcretePrompt = buildPremiumCoverLetterPrompt({
      brief: buildPremiumCoverLetterBrief({
        preset: "signature",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        contextClass: "cv_direct",
        allowedFactsPack,
        rankedEvidencePack: noConcreteRankedEvidencePack,
        claimPlan: noConcreteClaimPlan,
        factGraph,
        jobDemandGraph,
      }),
    });

    expect(noConcreteProofClaim.editorialGuideline).toContain(
      "No concrete CV proof is available",
    );
    expect(noConcretePrompt).toContain(
      "No concrete CV proof is assigned; use the assigned CV context only as bounded background",
    );
    expect(noConcretePrompt).not.toContain(
      "Only one concrete CV proof is assigned",
    );
  });

  it("falls back safely when no role responsibility can be assigned", () => {
    const { rankedEvidencePack, factGraph } = buildDirectClaimPlanFixture();
    const sparseJobDescription =
      "Outstanding benefits and a mission-led culture are part of the package.";
    const jobDemandGraph = buildPremiumJobDemandGraphV1(sparseJobDescription);
    const claimPlan = buildPremiumClaimPlanV1({
      factGraph,
      jobDemandGraph,
      rankedEvidencePack,
      contextClass: "cv_direct",
      preset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
    });
    const openingClaim = claimPlan.claims.find(
      (claim) => claim.section === "opening",
    )!;
    const closeClaim = claimPlan.claims.find(
      (claim) => claim.section === "closeLine",
    )!;
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: sparseJobDescription,
      contextClass: "cv_direct",
      allowedFactsPack: buildAllowedFactsPackFromFactGraph(factGraph),
      rankedEvidencePack,
      claimPlan,
      factGraph,
      jobDemandGraph,
    });
    const prompt = buildPremiumCoverLetterPrompt({ brief });

    expect(
      jobDemandGraph.demands.some((demand) =>
        ["core_responsibility", "key_requirement"].includes(demand.bucket),
      ),
    ).toBe(false);
    expect(openingClaim.demandIds).toEqual([]);
    expect(closeClaim.demandIds).toEqual([]);
    expect(openingClaim.editorialGuideline).toContain(
      "No role responsibility is assigned",
    );
    expect(closeClaim.editorialGuideline).not.toContain(
      "assigned responsibility",
    );
    expect(prompt).toContain(
      "No role responsibility is assigned; open with concise professional context around the assigned CV proof",
    );
    expect(prompt).not.toContain(
      "start from one concrete assigned responsibility",
    );
  });

  it("keeps legacy ClaimPlan evidence allocation outside English and French", () => {
    const { rankedEvidencePack, factGraph, jobDemandGraph } =
      buildDirectClaimPlanFixture();
    const claimPlan = buildPremiumClaimPlanV1({
      factGraph,
      jobDemandGraph,
      rankedEvidencePack,
      contextClass: "cv_direct",
      preset: "signature",
      outputLanguage: "Spanish",
      jobTitle: directJob.jobTitle,
    });
    const openingClaim = claimPlan.claims.find((claim) => claim.section === "opening")!;
    const proofClaim = claimPlan.claims.find((claim) => claim.section === "proofBlock")!;
    const closeClaim = claimPlan.claims.find((claim) => claim.section === "closeLine")!;

    expect(openingClaim.demandIds).toEqual([]);
    expect(proofClaim.factIds).toEqual(closeClaim.factIds);
    expect(proofClaim.factIds).toEqual(
      expect.arrayContaining(openingClaim.factIds),
    );
  });

  it("allocates distinct concrete proof facts for English and French adjacent letters", () => {
    const factGraph = buildPremiumFactGraphV1({
      personalizationContext: adjacentContext,
      jobDescription: adjacentJob.jobDescription,
    });
    const jobDemandGraph = buildPremiumJobDemandGraphV1(
      adjacentJob.jobDescription,
    );
    const allowedFactsPack = buildAllowedFactsPackFromFactGraph(factGraph);
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      contextClass: "cv_adjacent",
    });

    for (const outputLanguage of ["English", "French"] as const) {
      const claimPlan = buildPremiumClaimPlanV1({
        factGraph,
        jobDemandGraph,
        rankedEvidencePack,
        contextClass: "cv_adjacent",
        preset: "signature",
        outputLanguage,
        jobTitle: adjacentJob.jobTitle,
      });
      const openingClaim = claimPlan.claims.find(
        (claim) => claim.section === "opening",
      )!;
      const proofClaim = claimPlan.claims.find(
        (claim) => claim.section === "proofBlock",
      )!;

      expect(openingClaim.demandIds[0]).toMatch(/^demand_core_/);
      expect(proofClaim.factIds).not.toEqual(
        expect.arrayContaining(openingClaim.factIds),
      );
      expect(proofClaim.factIds.length).toBeGreaterThan(0);
      expect(proofClaim.factIds.length).toBeLessThanOrEqual(2);
      expect(
        proofClaim.factIds.map(
          (id) => factGraph.facts.find((fact) => fact.id === id)?.category,
        ),
      ).toEqual(expect.not.arrayContaining(["domain", "tool", "trait"]));
    }
  });

  it("fails ClaimPlanV1 with unknown facts, low-value proof, and company fluff motivation", () => {
    const { claimPlan, factGraph, jobDemandGraph } = buildDirectClaimPlanFixture();
    const lowValueDemand = {
      id: "demand_low_value_999",
      text: "Reliable and organized.",
      bucket: "low_value_checklist" as const,
      requiredness: "low_value" as const,
      tokens: ["reliable", "organized"],
      mustNotBecomeCandidateClaim: true,
    };
    const fluffDemand = {
      id: "demand_fluff_999",
      text: "Great benefits and mission-led culture.",
      bucket: "company_fluff" as const,
      requiredness: "fluff" as const,
      tokens: ["benefits", "culture"],
      mustNotBecomeCandidateClaim: true,
    };
    const invalidPlan = {
      ...claimPlan,
      claims: claimPlan.claims.map((claim) =>
        claim.section === "opening"
          ? { ...claim, factIds: ["missing_fact"] }
          : claim.section === "proofBlock"
            ? { ...claim, demandIds: [lowValueDemand.id] }
            : claim.section === "employerValueBlock"
              ? { ...claim, demandIds: [fluffDemand.id] }
              : claim,
      ),
    };

    const issueCodes = validatePremiumClaimPlanV1({
      claimPlan: invalidPlan,
      factGraph,
      jobDemandGraph: {
        ...jobDemandGraph,
        demands: [...jobDemandGraph.demands, lowValueDemand, fluffDemand],
      },
    }).map((issue) => issue.code);

    expect(issueCodes).toEqual(
      expect.arrayContaining([
        "missing_fact_id",
        "low_value_primary_proof",
        "company_fluff_as_motivation",
      ]),
    );
  });

  it("puts ClaimPlan and provenance ids in the prompt and removes RoleThesis ownership", () => {
    const { brief } = buildDirectClaimPlanFixture();
    const prompt = buildPremiumCoverLetterPrompt({ brief });

    expect(prompt).toContain("The ClaimPlan owns strategy");
    expect(prompt).toContain(
      "natural first paragraph rooted in the candidate's relevant experience",
    );
    expect(prompt).toContain(
      "do not use generic setups such as 'X is most valuable when...'",
    );
    expect(prompt).toContain("claim_plan_v1");
    expect(prompt).toContain("fact_experience_001_highlight_001");
    expect(prompt).toContain("demand_core_001");
    expect(prompt).toContain("Return only PremiumWriterOutputV1 JSON");
    expect(prompt).not.toContain("Build a dynamic RoleThesis");
    expect(prompt).toContain("Do not include greeting, signoff");
    expect(prompt).toContain("Do not use self-scoring or section-label openings");
    expect(prompt).toContain("my strongest match");
    expect(prompt).toContain("lowValueChecklist is diagnostic-only");
  });

  it("validates PremiumWriterOutputV1 provenance and adapts back to body parts", () => {
    const { claimPlan, factGraph, jobDemandGraph, brief } = buildDirectClaimPlanFixture();
    const openingClaim = claimPlan.claims.find((claim) => claim.section === "opening")!;
    const proofClaim = claimPlan.claims.find((claim) => claim.section === "proofBlock")!;
    const employerClaim = claimPlan.claims.find(
      (claim) => claim.section === "employerValueBlock",
    )!;
    const closeClaim = claimPlan.claims.find((claim) => claim.section === "closeLine")!;
    const writerOutput = {
      version: "premium_writer_output_v1" as const,
      bodyParts: {
        opening: {
          section: "opening" as const,
          text: "I improved signup conversion by 11% after iterative UI experiments.",
          claimIds: [openingClaim.id],
          factIds: openingClaim.factIds,
          demandIds: [],
        },
        proofBlock: {
          section: "proofBlock" as const,
          text: "I led a design system migration used across 4 product squads.",
          claimIds: [proofClaim.id],
          factIds: proofClaim.factIds,
          demandIds: [],
        },
        employerValueBlock: {
          section: "employerValueBlock" as const,
          text: "That work is relevant to customer-facing React and TypeScript delivery.",
          claimIds: [employerClaim.id],
          factIds: employerClaim.factIds,
          demandIds: employerClaim.demandIds,
        },
        closeLine: {
          section: "closeLine" as const,
          text: "I bring grounded frontend evidence around experimentation, reusable systems, and product-facing interfaces.",
          claimIds: [closeClaim.id],
          factIds: closeClaim.factIds,
          demandIds: [],
        },
      },
    };

    expect(
      validatePremiumWriterOutputV1({
        writerOutput,
        claimPlan,
        factGraph,
        jobDemandGraph,
        brief,
      }),
    ).toEqual([]);
    expect(toCoverLetterBodyParts(writerOutput)).toEqual({
      opening: writerOutput.bodyParts.opening.text,
      proofBlock: writerOutput.bodyParts.proofBlock.text,
      employerValueBlock: writerOutput.bodyParts.employerValueBlock.text,
      closeLine: writerOutput.bodyParts.closeLine.text,
    });
  });

  it("allows exact job-demand text as role context beside separate candidate evidence", () => {
    const { claimPlan, factGraph, jobDemandGraph, brief } =
      buildDirectClaimPlanFixture();
    const openingClaim = claimPlan.claims.find(
      (claim) => claim.section === "opening",
    )!;
    const referencedDemand = jobDemandGraph.demands.find(
      (demand) => demand.id === openingClaim.demandIds[0],
    )!;
    const demandSurface = referencedDemand.text.replace(/[.!?]$/u, "");
    const writerOutput = buildDirectPremiumWriterOutputFixture({
      opening: `The role centers on this responsibility: ${demandSurface}. I improved signup conversion by 11% after iterative UI experiments.`,
      proofBlock:
        "I led a design system migration used across 4 product squads.",
      employerValueBlock:
        "That work supports reliable customer-facing interfaces.",
      closeLine: `${demandSurface} is central to the work. I built experimentation dashboards used by product and growth teams.`,
    });

    expect(
      validatePremiumWriterOutputV1({
        writerOutput,
        claimPlan,
        factGraph,
        jobDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).not.toContain("job_demand_as_candidate_experience");

    const evidenceBridgeWriterOutput = {
      ...writerOutput,
      bodyParts: {
        ...writerOutput.bodyParts,
        opening: {
          ...writerOutput.bodyParts.opening,
          text: `I improved signup conversion by 11%, experience relevant to ${demandSurface}.`,
        },
      },
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: evidenceBridgeWriterOutput,
        claimPlan,
        factGraph,
        jobDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).not.toContain("job_demand_as_candidate_experience");

    const invalidWriterOutput = {
      ...writerOutput,
      bodyParts: {
        ...writerOutput.bodyParts,
        opening: {
          ...writerOutput.bodyParts.opening,
          text: `${demandSurface} was work I managed.`,
        },
      },
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: invalidWriterOutput,
        claimPlan,
        factGraph,
        jobDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    const appositiveOwnershipWriterOutput = {
      ...writerOutput,
      bodyParts: {
        ...writerOutput.bodyParts,
        opening: {
          ...writerOutput.bodyParts.opening,
          text: `${demandSurface}—responsibilities I managed at BrightLayer.`,
        },
      },
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: appositiveOwnershipWriterOutput,
        claimPlan,
        factGraph,
        jobDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    for (const text of [
      `I was responsible for ${demandSurface}.`,
      `I coordinate ${demandSurface}.`,
      `I manage ${demandSurface}.`,
      `I supported ${demandSurface}.`,
    ]) {
      const ownershipWriterOutput = {
        ...writerOutput,
        bodyParts: {
          ...writerOutput.bodyParts,
          opening: {
            ...writerOutput.bodyParts.opening,
            text,
          },
        },
      };
      expect(
        validatePremiumWriterOutputV1({
          writerOutput: ownershipWriterOutput,
          claimPlan,
          factGraph,
          jobDemandGraph,
          brief,
        }).map((issue) => issue.code),
      ).toContain("job_demand_as_candidate_experience");
    }

    const openingFactId = writerOutput.bodyParts.opening.factIds[0]!;
    const cvSupportedFactGraph = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === openingFactId
          ? {
              ...fact,
              text: "Supported product launches for enterprise customers.",
              allowedVerbs: ["supported"],
            }
          : fact,
      ),
    };
    const cvSupportedDemandGraph = {
      ...jobDemandGraph,
      demands: jobDemandGraph.demands.map((demand) =>
        demand.id === referencedDemand.id
          ? {
              ...demand,
              text: "Support product launches.",
              tokens: ["product", "launches"],
            }
          : demand,
      ),
    };
    const cvSupportedDemandWriterOutput = {
      ...writerOutput,
      bodyParts: {
        ...writerOutput.bodyParts,
        opening: {
          ...writerOutput.bodyParts.opening,
          text: "I support product launches.",
          demandIds: [],
        },
      },
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: cvSupportedDemandWriterOutput,
        claimPlan,
        factGraph: cvSupportedFactGraph,
        jobDemandGraph: cvSupportedDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).not.toContain("job_demand_as_candidate_experience");

    for (const scenario of [
      {
        factText: "Managed service tickets for regional offices.",
        allowedVerbs: ["managed"],
        demandText: "Manage vendor relationships.",
        demandTokens: ["vendor", "relationships"],
        generatedText: "I managed vendor relationships.",
      },
      {
        factText: "J’ai géré les demandes de service des bureaux régionaux.",
        allowedVerbs: ["géré"],
        demandText: "Gérer les relations fournisseurs.",
        demandTokens: ["relations", "fournisseurs"],
        generatedText: "J’ai géré les relations fournisseurs.",
      },
      {
        factText: "Supported service tickets for regional offices.",
        allowedVerbs: ["supported"],
        demandText: "Prepare weekly reports.",
        demandTokens: ["weekly", "reports"],
        generatedText: "I prepared weekly reports.",
      },
      {
        factText: "Managed service tickets for regional offices.",
        allowedVerbs: ["managed"],
        demandText: "This role will manage vendor relationships.",
        demandTokens: ["vendor", "relationships"],
        generatedText: "I managed vendor relationships.",
      },
      {
        factText: "Supported service tickets for regional offices.",
        allowedVerbs: ["supported"],
        demandText: "Candidates should prepare weekly reports.",
        demandTokens: ["weekly", "reports"],
        generatedText: "I prepared weekly reports.",
      },
      {
        factText: "Managed service tickets for regional offices.",
        allowedVerbs: ["managed"],
        demandText: "Be responsible for vendor relationships.",
        demandTokens: ["responsible", "vendor", "relationships"],
        generatedText: "I was responsible for vendor relationships.",
      },
      {
        factText: "J’ai géré les demandes de service des bureaux régionaux.",
        allowedVerbs: ["géré"],
        demandText: "Être responsable des relations fournisseurs.",
        demandTokens: ["responsable", "relations", "fournisseurs"],
        generatedText: "J’étais responsable des relations fournisseurs.",
      },
      {
        factText: "Supported service tickets for regional offices.",
        allowedVerbs: ["supported"],
        demandText: "Be proficient in Salesforce.",
        demandTokens: ["proficient", "salesforce"],
        generatedText: "I was proficient in Salesforce.",
      },
      {
        factText: "Supported service tickets for regional offices.",
        allowedVerbs: ["supported"],
        demandText: "Be proficient in Salesforce.",
        demandTokens: ["proficient", "salesforce"],
        generatedText: "I'm proficient in Salesforce.",
      },
      {
        factText: "Managed service tickets for regional offices.",
        allowedVerbs: ["managed"],
        demandText: "Be responsible for vendor relationships.",
        demandTokens: ["responsible", "vendor", "relationships"],
        generatedText: "I'm responsible for vendor relationships.",
      },
      {
        factText: "J’ai traité les demandes de service des bureaux régionaux.",
        allowedVerbs: ["traité"],
        demandText: "Être à l’aise avec Salesforce.",
        demandTokens: ["aise", "salesforce"],
        generatedText: "Je suis à l’aise avec Salesforce.",
      },
      {
        factText: "J’ai traité les demandes de service des bureaux régionaux.",
        allowedVerbs: ["traité"],
        demandText: "Suivre les relations fournisseurs.",
        demandTokens: ["relations", "fournisseurs"],
        generatedText: "Je suis les relations fournisseurs.",
      },
      {
        factText: "J’ai traité les demandes de service des bureaux régionaux.",
        allowedVerbs: ["traité"],
        demandText: "Responsable d’un portefeuille clients.",
        demandTokens: ["portefeuille", "clients"],
        generatedText: "J’étais responsable d’un portefeuille clients.",
      },
    ] as const) {
      const unrelatedActionFactGraph = {
        ...factGraph,
        facts: factGraph.facts.map((fact) =>
          fact.id === openingFactId
            ? {
                ...fact,
                text: scenario.factText,
                allowedVerbs: [...scenario.allowedVerbs],
              }
            : fact,
        ),
      };
      const actionLedDemandGraph = {
        ...jobDemandGraph,
        demands: jobDemandGraph.demands.map((demand) =>
          demand.id === referencedDemand.id
            ? {
                ...demand,
                text: scenario.demandText,
                tokens: [...scenario.demandTokens],
              }
            : demand,
        ),
      };
      const actionLedIssueCodes = validatePremiumWriterOutputV1({
          writerOutput: {
            ...writerOutput,
            bodyParts: {
              ...writerOutput.bodyParts,
              opening: {
                ...writerOutput.bodyParts.opening,
                text: scenario.generatedText,
              },
            },
          },
          claimPlan,
          factGraph: unrelatedActionFactGraph,
          jobDemandGraph: actionLedDemandGraph,
          brief,
        }).map((issue) => issue.code);
      expect(actionLedIssueCodes, scenario.generatedText).toContain(
        "job_demand_as_candidate_experience",
      );
    }

    for (const scenario of [
      {
        factText: "Managed service tickets for regional offices.",
        allowedVerbs: ["managed"],
        demandText: "Manage vendor relationships.",
        demandTokens: ["vendor", "relationships"],
        generatedText:
          "Vendor relationships were among the responsibilities I managed.",
      },
      {
        factText: "J’ai géré les demandes de service des bureaux régionaux.",
        allowedVerbs: ["géré"],
        demandText: "Gérer les relations fournisseurs.",
        demandTokens: ["relations", "fournisseurs"],
        generatedText:
          "Les relations fournisseurs étaient parmi les responsabilités que j’ai gérées.",
      },
    ] as const) {
      const unrelatedActionFactGraph = {
        ...factGraph,
        facts: factGraph.facts.map((fact) =>
          fact.id === openingFactId
            ? {
                ...fact,
                text: scenario.factText,
                allowedVerbs: [...scenario.allowedVerbs],
              }
            : fact,
        ),
      };
      const actionLedDemandGraph = {
        ...jobDemandGraph,
        demands: jobDemandGraph.demands.map((demand) =>
          demand.id === referencedDemand.id
            ? {
                ...demand,
                text: scenario.demandText,
                tokens: [...scenario.demandTokens],
              }
            : demand,
        ),
      };
      const actionLedIssueCodes = validatePremiumWriterOutputV1({
        writerOutput: {
          ...writerOutput,
          bodyParts: {
            ...writerOutput.bodyParts,
            opening: {
              ...writerOutput.bodyParts.opening,
              text: scenario.generatedText,
            },
          },
        },
        claimPlan,
        factGraph: unrelatedActionFactGraph,
        jobDemandGraph: actionLedDemandGraph,
        brief,
      }).map((issue) => issue.code);
      expect(actionLedIssueCodes, scenario.generatedText).toContain(
        "job_demand_as_candidate_experience",
      );
    }

    for (const scenario of [
      {
        factText: "Managed vendor relationships for regional accounts.",
        allowedVerbs: ["managed"],
        demandText: "Manage vendor relationships.",
        demandTokens: ["vendor", "relationships"],
        generatedText: "I managed vendor relationships.",
      },
      {
        factText: "J’ai géré les relations fournisseurs dans trois régions.",
        allowedVerbs: ["géré"],
        demandText: "Gérer les relations fournisseurs.",
        demandTokens: ["relations", "fournisseurs"],
        generatedText: "J’ai géré les relations fournisseurs.",
      },
      {
        factText: "Prepared weekly reports for regional operations.",
        allowedVerbs: ["prepared"],
        demandText: "Prepare weekly reports.",
        demandTokens: ["weekly", "reports"],
        generatedText: "I prepared weekly reports.",
      },
      {
        factText: "Managed vendor relationships for regional accounts.",
        allowedVerbs: ["managed"],
        demandText: "This role will manage vendor relationships.",
        demandTokens: ["vendor", "relationships"],
        generatedText: "I managed vendor relationships.",
      },
      {
        factText: "Prepared weekly reports for regional operations.",
        allowedVerbs: ["prepared"],
        demandText: "Candidates should prepare weekly reports.",
        demandTokens: ["weekly", "reports"],
        generatedText: "I prepared weekly reports.",
      },
      {
        factText:
          "Was responsible for vendor relationships across three regions.",
        allowedVerbs: ["owned"],
        demandText: "Be responsible for vendor relationships.",
        demandTokens: ["responsible", "vendor", "relationships"],
        generatedText: "I was responsible for vendor relationships.",
      },
      {
        factText:
          "J’étais responsable des relations fournisseurs dans trois régions.",
        allowedVerbs: ["géré"],
        demandText: "Être responsable des relations fournisseurs.",
        demandTokens: ["responsable", "relations", "fournisseurs"],
        generatedText: "J’étais responsable des relations fournisseurs.",
      },
      {
        factText: "Was proficient in Salesforce during CRM rollouts.",
        allowedVerbs: ["supported"],
        demandText: "Be proficient in Salesforce.",
        demandTokens: ["proficient", "salesforce"],
        generatedText: "I was proficient in Salesforce.",
      },
      {
        factText: "I've been proficient in Salesforce during CRM rollouts.",
        allowedVerbs: ["supported"],
        demandText: "Be proficient in Salesforce.",
        demandTokens: ["proficient", "salesforce"],
        generatedText: "I'm proficient in Salesforce.",
      },
      {
        factText:
          "I've been responsible for vendor relationships across three regions.",
        allowedVerbs: ["owned"],
        demandText: "Be responsible for vendor relationships.",
        demandTokens: ["responsible", "vendor", "relationships"],
        generatedText: "I'm responsible for vendor relationships.",
      },
      {
        factText:
          "J’étais à l’aise avec Salesforce lors des déploiements CRM.",
        allowedVerbs: ["traité"],
        demandText: "Être à l’aise avec Salesforce.",
        demandTokens: ["aise", "salesforce"],
        generatedText: "Je suis à l’aise avec Salesforce.",
      },
      {
        factText:
          "J’ai suivi les relations fournisseurs dans trois régions.",
        allowedVerbs: ["suivi"],
        demandText: "Suivre les relations fournisseurs.",
        demandTokens: ["relations", "fournisseurs"],
        generatedText: "Je suis les relations fournisseurs.",
      },
      {
        factText: "Responsable d’un portefeuille clients.",
        allowedVerbs: ["géré"],
        demandText: "Responsable d’un portefeuille clients.",
        demandTokens: ["portefeuille", "clients"],
        generatedText: "J’étais responsable d’un portefeuille clients.",
      },
    ] as const) {
      const supportedActionFactGraph = {
        ...factGraph,
        facts: factGraph.facts.map((fact) =>
          fact.id === openingFactId
            ? {
                ...fact,
                text: scenario.factText,
                allowedVerbs: [...scenario.allowedVerbs],
              }
            : fact,
        ),
      };
      const actionLedDemandGraph = {
        ...jobDemandGraph,
        demands: jobDemandGraph.demands.map((demand) =>
          demand.id === referencedDemand.id
            ? {
                ...demand,
                text: scenario.demandText,
                tokens: [...scenario.demandTokens],
              }
            : demand,
        ),
      };
      const actionLedIssueCodes = validatePremiumWriterOutputV1({
        writerOutput: {
          ...writerOutput,
          bodyParts: {
            ...writerOutput.bodyParts,
            opening: {
              ...writerOutput.bodyParts.opening,
              text: scenario.generatedText,
            },
          },
        },
        claimPlan,
        factGraph: supportedActionFactGraph,
        jobDemandGraph: actionLedDemandGraph,
        brief,
      }).map((issue) => issue.code);
      expect(actionLedIssueCodes, scenario.generatedText).not.toContain(
        "job_demand_as_candidate_experience",
      );
    }

    const strongerDemandGraph = {
      ...cvSupportedDemandGraph,
      demands: cvSupportedDemandGraph.demands.map((demand) =>
        demand.id === referencedDemand.id
          ? { ...demand, text: "Lead product launches." }
          : demand,
      ),
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "I lead product launches.",
            },
          },
        },
        claimPlan,
        factGraph: cvSupportedFactGraph,
        jobDemandGraph: strongerDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    const nounLedDemandGraph = {
      ...cvSupportedDemandGraph,
      demands: cvSupportedDemandGraph.demands.map((demand) =>
        demand.id === referencedDemand.id
          ? {
              ...demand,
              text: "Product launches.",
              tokens: ["product", "launches"],
            }
          : demand,
      ),
    };
    for (const [text, expected] of [
      ["I support product launches.", false],
      ["I coordinated product launches.", true],
      ["I lead product launches.", true],
    ] as const) {
      const issueCodes = validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text,
            },
          },
        },
        claimPlan,
        factGraph: cvSupportedFactGraph,
        jobDemandGraph: nounLedDemandGraph,
        brief,
      }).map((issue) => issue.code);
      if (expected) {
        expect(issueCodes).toContain("job_demand_as_candidate_experience");
      } else {
        expect(issueCodes).not.toContain("job_demand_as_candidate_experience");
      }
    }

    const englishCrossClauseFactGraph = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === openingFactId
          ? {
              ...fact,
              text: "I supported customer onboarding and coordinated product launches.",
              allowedVerbs: ["supported", "coordinated"],
            }
          : fact,
      ),
    };
    const englishCrossClauseDemandGraph = {
      ...jobDemandGraph,
      demands: jobDemandGraph.demands.map((demand) =>
        demand.id === referencedDemand.id
          ? {
              ...demand,
              text: "Customer onboarding.",
              tokens: ["customer", "onboarding"],
            }
          : demand,
      ),
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "I coordinated customer onboarding.",
            },
          },
        },
        claimPlan,
        factGraph: englishCrossClauseFactGraph,
        jobDemandGraph: englishCrossClauseDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "I support customer onboarding systems.",
            },
          },
        },
        claimPlan,
        factGraph: englishCrossClauseFactGraph,
        jobDemandGraph: englishCrossClauseDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "I support customer onboarding with Salesforce automation.",
            },
          },
        },
        claimPlan,
        factGraph: englishCrossClauseFactGraph,
        jobDemandGraph: englishCrossClauseDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    const englishGroundedComplementFactGraph = {
      ...englishCrossClauseFactGraph,
      facts: englishCrossClauseFactGraph.facts.map((fact) =>
        fact.id === openingFactId
          ? {
              ...fact,
              text: "I supported customer onboarding across three regions.",
              allowedVerbs: ["supported"],
            }
          : fact,
      ),
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "I supported customer onboarding across three regions.",
            },
          },
        },
        claimPlan,
        factGraph: englishGroundedComplementFactGraph,
        jobDemandGraph: englishCrossClauseDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).not.toContain("job_demand_as_candidate_experience");

    const englishIndirectSupportFactGraph = {
      ...englishCrossClauseFactGraph,
      facts: englishCrossClauseFactGraph.facts.map((fact) =>
        fact.id === openingFactId
          ? {
              ...fact,
              text: "I supported documentation for customer onboarding.",
              allowedVerbs: ["supported"],
            }
          : fact,
      ),
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "I supported customer onboarding.",
            },
          },
        },
        claimPlan,
        factGraph: englishIndirectSupportFactGraph,
        jobDemandGraph: englishCrossClauseDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    const englishNarrowObjectFactGraph = {
      ...englishCrossClauseFactGraph,
      facts: englishCrossClauseFactGraph.facts.map((fact) =>
        fact.id === openingFactId
          ? {
              ...fact,
              text: "I supported customer onboarding documentation.",
              allowedVerbs: ["supported"],
            }
          : fact,
      ),
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "I support customer onboarding.",
            },
          },
        },
        claimPlan,
        factGraph: englishNarrowObjectFactGraph,
        jobDemandGraph: englishCrossClauseDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "I supported customer onboarding, a responsibility I managed.",
            },
          },
        },
        claimPlan,
        factGraph: englishCrossClauseFactGraph,
        jobDemandGraph: englishCrossClauseDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "I support customer onboarding. I coordinated customer onboarding.",
            },
          },
        },
        claimPlan,
        factGraph: englishCrossClauseFactGraph,
        jobDemandGraph: englishCrossClauseDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    const frenchSupportedFactGraph = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === openingFactId
          ? {
              ...fact,
              text: "J’ai suivi les déploiements clients.",
              allowedVerbs: ["described"],
              ownershipLevel: "support" as const,
            }
          : fact,
      ),
    };
    const frenchNounLedDemandGraph = {
      ...jobDemandGraph,
      demands: jobDemandGraph.demands.map((demand) =>
        demand.id === referencedDemand.id
          ? {
              ...demand,
              text: "Déploiements clients.",
              tokens: ["déploiements", "clients"],
            }
          : demand,
      ),
    };
    for (const [text, expected] of [
      ["J’ai suivi les déploiements clients.", false],
      ["J’ai coordonné les déploiements clients.", true],
      ["J’ai piloté les déploiements clients.", true],
    ] as const) {
      const issueCodes = validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text,
            },
          },
        },
        claimPlan,
        factGraph: frenchSupportedFactGraph,
        jobDemandGraph: frenchNounLedDemandGraph,
        brief,
      }).map((issue) => issue.code);
      if (expected) {
        expect(issueCodes).toContain("job_demand_as_candidate_experience");
      } else {
        expect(issueCodes).not.toContain("job_demand_as_candidate_experience");
      }
    }

    const frenchCrossClauseFactGraph = {
      ...frenchSupportedFactGraph,
      facts: frenchSupportedFactGraph.facts.map((fact) =>
        fact.id === openingFactId
          ? {
              ...fact,
              text: "J’ai suivi les déploiements clients et piloté les audits internes.",
            }
          : fact,
      ),
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "J’ai piloté les déploiements clients.",
            },
          },
        },
        claimPlan,
        factGraph: frenchCrossClauseFactGraph,
        jobDemandGraph: frenchNounLedDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    const frenchIndirectSupportFactGraph = {
      ...frenchSupportedFactGraph,
      facts: frenchSupportedFactGraph.facts.map((fact) =>
        fact.id === openingFactId
          ? {
              ...fact,
              text: "J’ai suivi des rapports sur les déploiements clients.",
            }
          : fact,
      ),
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "J’ai suivi les déploiements clients.",
            },
          },
        },
        claimPlan,
        factGraph: frenchIndirectSupportFactGraph,
        jobDemandGraph: frenchNounLedDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    const frenchNarrowObjectFactGraph = {
      ...frenchSupportedFactGraph,
      facts: frenchSupportedFactGraph.facts.map((fact) =>
        fact.id === openingFactId
          ? {
              ...fact,
              text: "J’ai suivi les déploiements clients pilotes.",
            }
          : fact,
      ),
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "J’ai suivi les déploiements clients.",
            },
          },
        },
        claimPlan,
        factGraph: frenchNarrowObjectFactGraph,
        jobDemandGraph: frenchNounLedDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "J’ai suivi les déploiements clients pilotes.",
            },
          },
        },
        claimPlan,
        factGraph: frenchSupportedFactGraph,
        jobDemandGraph: frenchNounLedDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "J’ai suivi les déploiements clients avec Salesforce.",
            },
          },
        },
        claimPlan,
        factGraph: frenchSupportedFactGraph,
        jobDemandGraph: frenchNounLedDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    const frenchGroundedComplementFactGraph = {
      ...frenchSupportedFactGraph,
      facts: frenchSupportedFactGraph.facts.map((fact) =>
        fact.id === openingFactId
          ? {
              ...fact,
              text: "J’ai suivi les déploiements clients dans trois régions.",
            }
          : fact,
      ),
    };
    const frenchGroundedComplementIssues = validatePremiumWriterOutputV1({
      writerOutput: {
        ...cvSupportedDemandWriterOutput,
        bodyParts: {
          ...cvSupportedDemandWriterOutput.bodyParts,
          opening: {
            ...cvSupportedDemandWriterOutput.bodyParts.opening,
            text: "J’ai suivi les déploiements clients dans trois régions.",
          },
        },
      },
      claimPlan,
      factGraph: frenchGroundedComplementFactGraph,
      jobDemandGraph: frenchNounLedDemandGraph,
      brief,
    });
    expect(
      frenchGroundedComplementIssues.map((issue) => issue.code),
    ).not.toContain("job_demand_as_candidate_experience");

    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "J’ai suivi les déploiements clients — des responsabilités que j’ai pilotées.",
            },
          },
        },
        claimPlan,
        factGraph: frenchSupportedFactGraph,
        jobDemandGraph: frenchNounLedDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          ...cvSupportedDemandWriterOutput,
          bodyParts: {
            ...cvSupportedDemandWriterOutput.bodyParts,
            opening: {
              ...cvSupportedDemandWriterOutput.bodyParts.opening,
              text: "J’ai suivi les déploiements clients. J’ai piloté les déploiements clients.",
            },
          },
        },
        claimPlan,
        factGraph: frenchSupportedFactGraph,
        jobDemandGraph: frenchNounLedDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    const omittedDemandWriterOutput = {
      ...writerOutput,
      bodyParts: {
        ...writerOutput.bodyParts,
        opening: {
          ...writerOutput.bodyParts.opening,
          text: `I documented ${demandSurface}.`,
          demandIds: [],
        },
      },
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: omittedDemandWriterOutput,
        claimPlan,
        factGraph,
        jobDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    const frenchDemandSurface =
      "Coordonner les déploiements et suivre les livrables";
    const frenchJobDemandGraph = {
      ...jobDemandGraph,
      demands: jobDemandGraph.demands.map((demand) =>
        demand.id === referencedDemand.id
          ? { ...demand, text: `${frenchDemandSurface}.` }
          : demand,
      ),
    };
    const omittedFrenchDemandWriterOutput = {
      ...writerOutput,
      bodyParts: {
        ...writerOutput.bodyParts,
        opening: {
          ...writerOutput.bodyParts.opening,
          text: `J’ai géré ${frenchDemandSurface}.`,
          demandIds: [],
        },
      },
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: omittedFrenchDemandWriterOutput,
        claimPlan,
        factGraph,
        jobDemandGraph: frenchJobDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    const frenchEvidenceBridgeWriterOutput = {
      ...writerOutput,
      bodyParts: {
        ...writerOutput.bodyParts,
        opening: {
          ...writerOutput.bodyParts.opening,
          text: `J’ai amélioré les délais de 11 %, une expérience pertinente pour ${frenchDemandSurface.toLowerCase()}.`,
          demandIds: [],
        },
      },
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: frenchEvidenceBridgeWriterOutput,
        claimPlan,
        factGraph,
        jobDemandGraph: frenchJobDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).not.toContain("job_demand_as_candidate_experience");

    const frenchAppositiveOwnershipWriterOutput = {
      ...writerOutput,
      bodyParts: {
        ...writerOutput.bodyParts,
        opening: {
          ...writerOutput.bodyParts.opening,
          text: `${frenchDemandSurface} — des responsabilités que j’ai gérées.`,
          demandIds: [],
        },
      },
    };
    expect(
      validatePremiumWriterOutputV1({
        writerOutput: frenchAppositiveOwnershipWriterOutput,
        claimPlan,
        factGraph,
        jobDemandGraph: frenchJobDemandGraph,
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");

    for (const text of [
      `J’étais responsable de ${frenchDemandSurface.toLowerCase()}.`,
      `J’améliore ${frenchDemandSurface.toLowerCase()}.`,
      `J’assure ${frenchDemandSurface.toLowerCase()}.`,
    ]) {
      const ownershipWriterOutput = {
        ...writerOutput,
        bodyParts: {
          ...writerOutput.bodyParts,
          opening: {
            ...writerOutput.bodyParts.opening,
            text,
            demandIds: [],
          },
        },
      };
      expect(
        validatePremiumWriterOutputV1({
          writerOutput: ownershipWriterOutput,
          claimPlan,
          factGraph,
          jobDemandGraph: frenchJobDemandGraph,
          brief,
        }).map((issue) => issue.code),
      ).toContain("job_demand_as_candidate_experience");
    }
  });

  it("validates premium final provenance from final text instead of cited ids alone", () => {
    const { claimPlan, factGraph } = buildDirectClaimPlanFixture();
    const openingClaim = claimPlan.claims.find((claim) => claim.section === "opening")!;
    const proofClaim = claimPlan.claims.find((claim) => claim.section === "proofBlock")!;
    const employerClaim = claimPlan.claims.find(
      (claim) => claim.section === "employerValueBlock",
    )!;
    const closeClaim = claimPlan.claims.find((claim) => claim.section === "closeLine")!;
    const writerOutput = {
      version: "premium_writer_output_v1" as const,
      bodyParts: {
        opening: {
          section: "opening" as const,
          text: "I improved signup conversion by 11% after iterative UI experiments.",
          claimIds: [openingClaim.id],
          factIds: openingClaim.factIds,
          demandIds: [],
        },
        proofBlock: {
          section: "proofBlock" as const,
          text: "I led a design system migration used across 4 product squads.",
          claimIds: [proofClaim.id],
          factIds: proofClaim.factIds,
          demandIds: [],
        },
        employerValueBlock: {
          section: "employerValueBlock" as const,
          text: "That work is relevant to customer-facing React and TypeScript delivery.",
          claimIds: [employerClaim.id],
          factIds: employerClaim.factIds,
          demandIds: employerClaim.demandIds,
        },
        closeLine: {
          section: "closeLine" as const,
          text: "I bring grounded frontend evidence around experimentation and product-facing interfaces.",
          claimIds: [closeClaim.id],
          factIds: closeClaim.factIds,
          demandIds: [],
        },
      },
    };

    const validated = buildPremiumCoverLetterFinalProvenance({
      writerOutput,
      finalBodyParts: toCoverLetterBodyParts(writerOutput),
      claimPlan,
      factGraph,
      legacyWrapped: false,
      provenanceIdsNormalized: false,
    });
    expect(validated.status).toBe("validated_final_text");
    expect(validated.origin).toBe("provider_reported");
    expect(validated.verifiedCandidateFactIds.length).toBeGreaterThan(0);
    expect(
      premiumCoverLetterFinalProvenanceSatisfiesCandidateEvidence({
        provenance: validated,
        finalText: Object.values(toCoverLetterBodyParts(writerOutput)).join(" "),
      }),
    ).toBe(true);

    const decorativeIdsOnly = buildPremiumCoverLetterFinalProvenance({
      writerOutput,
      finalBodyParts: {
        opening:
          "The role centers on structured delivery, collaboration, and careful stakeholder communication.",
        proofBlock:
          "The team needs someone who can understand priorities and keep projects moving.",
        employerValueBlock:
          "That context makes the opportunity interesting for a product-focused team.",
        closeLine: "I would be glad to discuss the role further.",
      },
      claimPlan,
      factGraph,
      legacyWrapped: false,
      provenanceIdsNormalized: false,
    });
    expect(decorativeIdsOnly.candidateFactIds.length).toBeGreaterThan(0);
    expect(decorativeIdsOnly.status).toBe("invalidated_by_late_mutation");
    expect(
      premiumCoverLetterFinalProvenanceSatisfiesCandidateEvidence({
        provenance: decorativeIdsOnly,
        finalText: Object.values(decorativeIdsOnly.sections)
          .map((section) => section.text)
          .join(" "),
      }),
    ).toBe(false);

    const legacyWrapped = buildPremiumCoverLetterFinalProvenance({
      writerOutput,
      finalBodyParts: toCoverLetterBodyParts(writerOutput),
      claimPlan,
      factGraph,
      legacyWrapped: true,
      provenanceIdsNormalized: false,
    });
    expect(legacyWrapped.status).toBe("untrusted_legacy_wrapped");
  });

  it("counts a pluralized lexical concept once in final provenance", () => {
    const { claimPlan, factGraph } = buildDirectClaimPlanFixture();
    const openingClaim = claimPlan.claims.find(
      (claim) => claim.section === "opening",
    )!;
    const citedFactId = openingClaim.factIds[0];
    const narrowedFactGraph = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === citedFactId
          ? {
              ...fact,
              text: "Customer services.",
              metrics: [],
              entities: [],
            }
          : fact,
      ),
    };
    const writerOutput = buildDirectPremiumWriterOutputFixture({
      opening: "These services are relevant.",
      proofBlock: "I led a design system migration used across 4 product squads.",
      employerValueBlock:
        "I built experimentation dashboards used by product and growth teams.",
      closeLine:
        "I would bring that design-system discipline to product-facing interface work.",
    });
    const provenance = buildPremiumCoverLetterFinalProvenance({
      writerOutput,
      finalBodyParts: toCoverLetterBodyParts(writerOutput),
      claimPlan,
      factGraph: narrowedFactGraph,
      legacyWrapped: false,
      provenanceIdsNormalized: false,
    });

    expect(
      provenance.sections.opening.verifiedCandidateFactIds,
    ).not.toContain(citedFactId);
  });

  it.each([
    ["AWS", "GCP"],
    ["SQL", "AWS"],
    ["R", "Go"],
    ["Go", "R"],
    ["C#", "C++"],
  ])(
    "keeps short technical identifiers distinct in final provenance: %s vs %s",
    (sourceIdentifier, generatedIdentifier) => {
      const { claimPlan, factGraph } = buildDirectClaimPlanFixture();
      const openingClaim = claimPlan.claims.find(
        (claim) => claim.section === "opening",
      )!;
      const citedFactId = openingClaim.factIds[0];
      const technicalFactGraph = {
        ...factGraph,
        facts: factGraph.facts.map((fact) =>
          fact.id === citedFactId
            ? {
                ...fact,
                text: `Built APIs with ${sourceIdentifier}.`,
                metrics: [],
                entities: [sourceIdentifier],
              }
            : fact,
        ),
      };
      const writerOutput = buildDirectPremiumWriterOutputFixture({
        opening: `I built APIs with ${generatedIdentifier}.`,
        proofBlock:
          "I led a design system migration used across 4 product squads.",
        employerValueBlock:
          "I built experimentation dashboards used by product and growth teams.",
        closeLine:
          "I would bring that design-system discipline to product-facing interface work.",
      });
      const provenance = buildPremiumCoverLetterFinalProvenance({
        writerOutput,
        finalBodyParts: toCoverLetterBodyParts(writerOutput),
        claimPlan,
        factGraph: technicalFactGraph,
        legacyWrapped: false,
        provenanceIdsNormalized: false,
      });

      expect(
        provenance.sections.opening.verifiedCandidateFactIds,
      ).not.toContain(citedFactId);
    },
  );

  it("fails non-repairable writer provenance and keeps greeting leakage repairable", () => {
    const { claimPlan, factGraph, jobDemandGraph, brief } = buildDirectClaimPlanFixture();
    const openingClaim = claimPlan.claims.find((claim) => claim.section === "opening")!;
    const writerOutput = {
      version: "premium_writer_output_v1" as const,
      bodyParts: {
        opening: {
          section: "opening" as const,
          text: "Dear Hiring Manager,",
          claimIds: ["unknown_claim"],
          factIds: ["unknown_fact"],
          demandIds: [],
        },
        proofBlock: {
          section: "proofBlock" as const,
          text: "I reduced duplicate components by 40%.",
          claimIds: [openingClaim.id],
          factIds: openingClaim.factIds,
          demandIds: [],
        },
        employerValueBlock: {
          section: "employerValueBlock" as const,
          text: "I admire your mission-led culture.",
          claimIds: ["claim_employer_value_001"],
          factIds: [],
          demandIds: [],
        },
        closeLine: {
          section: "closeLine" as const,
          text: "Sincerely,",
          claimIds: ["claim_close_001"],
          factIds: [],
          demandIds: [],
        },
      },
    };

    const issues = validatePremiumWriterOutputV1({
      writerOutput,
      claimPlan,
      factGraph,
      jobDemandGraph,
      brief,
    });
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "unknown_claim_id",
        "unknown_fact_id",
        "section_claim_mismatch",
        "unsupported_numeric_claim",
        "greeting_leakage",
        "signoff_leakage",
      ]),
    );
    expect(issues.find((issue) => issue.code === "greeting_leakage")?.repairable).toBe(
      true,
    );
    expect(issues.find((issue) => issue.code === "unknown_fact_id")?.repairable).toBe(
      false,
    );
  });
});

const weakChecklistContext = {
  name: "Samir Patel",
  summary:
    "Facilities support coordinator handling maintenance intake, scheduling, and service record follow-through.",
  topSkills: ["Excel", "Word", "Windows", "Scheduling"],
  recentExperience: [
    {
      company: "Metro Facilities",
      position: "Facilities Coordinator",
      highlights: [
        "Handled maintenance intake, scheduling, and vendor follow-up for office sites.",
        "Improved work-order turnaround by 9% after reorganizing request routing and follow-up.",
      ],
    },
  ],
  standoutAchievements: [
    "Built a simple tracker that reduced missed vendor callbacks during weekly scheduling reviews.",
  ],
};

const weakChecklistJob = {
  jobTitle: "Facilities Support Coordinator",
  jobDescription:
    "Coordinate maintenance requests, schedule vendors, update service records, manage Excel trackers, answer emails, support Word documentation, stay flexible, and be ready to help across office operations. Candidates should be organized, reliable, adaptable, willing to learn, and comfortable with Windows, Microsoft Word, Microsoft Excel, and general administrative support.",
};

const noCvJob = {
  jobTitle: "Operations Coordinator",
  jobDescription:
    "Coordinate service requests, track follow-up, keep records current, and communicate clearly with internal teams and vendors. The role depends on careful scheduling, accurate documentation, and steady day-to-day coordination. Excel is helpful and strong communication is required.",
};

const backendAdjacentContext = {
  name: "Alex Martin",
  summary:
    "Frontend engineer with some API integration exposure and strong product collaboration.",
  topSkills: ["React", "TypeScript", "Frontend Architecture"],
  recentExperience: [
    {
      company: "BrightLayer",
      position: "Frontend Engineer",
      highlights: [
        "Partnered with backend engineers on API contracts and data-heavy UI features.",
      ],
    },
  ],
};

const backendAdjacentJob = {
  jobTitle: "Full Stack Engineer",
  jobDescription:
    "Looking for a Full Stack Engineer with strong Node.js backend skills, API design, database work, and enough React experience to contribute to the frontend. Experience designing scalable services is required.",
};

const adminMorphologyDriftContext = {
  name: "Nora Silva",
  summary:
    "Customer support coordinator handling escalations, documentation, and handoffs.",
  topSkills: ["Escalation management", "Documentation", "Status reporting"],
  recentExperience: [
    {
      company: "BrightDesk",
      position: "Customer Support Coordinator",
      highlights: [
        "Managed escalations, documented account updates, and coordinated handoffs across support and product teams.",
        "Prepared weekly status summaries and maintained issue trackers for service follow-through.",
      ],
    },
  ],
  standoutAchievements: [
    "Reduced repeat follow-up by standardizing escalation notes.",
  ],
};

const adminMorphologyDriftJob = {
  jobTitle: "Office Administrator",
  jobDescription:
    "Manage calendars, records, documentation, and administrative follow-through across a busy team.",
};

describe("premium cover letter evidence ranking", () => {
  it("prioritizes quantified achievements over secondary qualifications", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: directContext,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
    });

    expect(rankedEvidencePack.strongestEvidence[0]?.text).toContain("11%");
    expect(
      rankedEvidencePack.secondaryQualifications.some((fact) =>
        fact.text.includes("Excel"),
      ),
    ).toBe(true);
  });


  it("prioritizes quantified and operational French proof over generic role context", () => {
    const personalizationContext = {
      name: "Camille Martin",
      summary:
        "Responsable réussite client avec une expérience en intégration et fidélisation.",
      topSkills: ["Réussite client", "Fidélisation", "Intégration"],
      recentExperience: [
        {
          company: "Acme",
          position: "Responsable réussite client",
          highlights: [
            "Hausse de 21 % de la fidélisation à 90 jours grâce à des jalons d'intégration et d'escalade.",
            "Pilotage d'un portefeuille de 35 comptes clients avec revues trimestrielles.",
            "Création d'un tableau de bord de santé client pour prioriser les comptes à risque.",
          ],
        },
      ],
      standoutAchievements: [],
    };
    const jobTitle = "Responsable Customer Success";
    const jobDescription =
      "Piloter l'intégration, la fidélisation, les revues de comptes et le suivi des comptes à risque.";
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext,
      jobTitle,
      jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle,
      jobDescription,
      contextClass: "cv_direct",
    });
    const strongestEvidence = rankedEvidencePack.strongestEvidence
      .map((fact) => fact.text)
      .join(" ");

    expect(strongestEvidence).toContain("21 %");
    expect(strongestEvidence).toContain("35 comptes clients");
    expect(strongestEvidence).toContain("tableau de bord de santé client");
    expect(strongestEvidence).not.toContain(
      "Responsable réussite client avec une expérience",
    );
  });

  it("demotes secondary qualifications when stronger evidence exists", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: directContext,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
    });

    expect(
      rankedEvidencePack.strongestEvidence.every(
        (fact) => !fact.text.includes("Excel"),
      ),
    ).toBe(true);
    expect(
      rankedEvidencePack.weakOrDoNotLeadWith.some((fact) =>
        fact.text.includes("Excel"),
      ),
    ).toBe(true);
  });

  it("excludes benefits and company-admiration content from top evidence", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: directContext,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
    });

    expect(
      rankedEvidencePack.strongestEvidence.every(
        (fact) => !/benefits|mission-led culture/i.test(fact.text),
      ),
    ).toBe(true);
    expect(
      rankedEvidencePack.weakOrDoNotLeadWith.some((fact) =>
        /benefits/i.test(fact.text),
      ),
    ).toBe(false);
  });

  it("builds transferCore for adjacent cases from actual CV evidence", () => {
    const contextClass = inferPremiumCoverLetterContextClass({
      personalizationContext: adjacentContext,
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
    });
    expect(contextClass).toBe("cv_adjacent");

    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: adjacentContext,
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      contextClass: "cv_adjacent",
    });
    const brief = buildPremiumCoverLetterBrief({
      preset: "engaging",
      outputLanguage: "English",
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      contextClass: "cv_adjacent",
      allowedFactsPack,
      rankedEvidencePack,
    });

    expect(brief.transferCore).toBeDefined();
    expect(brief.transferCore?.length).toBeGreaterThan(0);
    expect(brief.transferCore?.join(" ")).toMatch(/handoffs|reporting|workflow/i);
  });

  it("ranks concrete adjacent reporting and monitoring evidence before domain or duration facts", () => {
    const contextClass = inferPremiumCoverLetterContextClass({
      personalizationContext: adjacentMonitoringContext,
      jobTitle: adjacentMonitoringJob.jobTitle,
      jobDescription: adjacentMonitoringJob.jobDescription,
    });
    expect(contextClass).toBe("cv_adjacent");

    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: adjacentMonitoringContext,
      jobTitle: adjacentMonitoringJob.jobTitle,
      jobDescription: adjacentMonitoringJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: adjacentMonitoringJob.jobTitle,
      jobDescription: adjacentMonitoringJob.jobDescription,
      contextClass: "cv_adjacent",
    });

    expect(rankedEvidencePack.strongestEvidence.map((fact) => fact.text).slice(0, 2)).toEqual([
      expect.stringMatching(/Completed reports by recording observations/i),
      expect.stringMatching(/Monitored selected areas via CCTV app/i),
    ]);
  });

  it("prioritizes reporting evidence over maintenance support when the job emphasizes reporting and escalation", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: {
        ...adjacentMonitoringContext,
        recentExperience: [
          ...(adjacentMonitoringContext.recentExperience ?? []),
          {
            company: "Facilities Desk",
            position: "Support Guard",
            highlights: [
              "Supported equipment readiness through preventive maintenance, manufacturer instructions, troubleshooting, and repair coordination.",
            ],
          },
        ],
      },
      jobTitle: adjacentMonitoringJob.jobTitle,
      jobDescription: adjacentMonitoringJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: adjacentMonitoringJob.jobTitle,
      jobDescription: adjacentMonitoringJob.jobDescription,
      contextClass: "cv_adjacent",
    });
    const strongestText = rankedEvidencePack.strongestEvidence.map(
      (fact) => fact.text,
    );

    expect(strongestText[0]).toMatch(/Completed reports by recording observations/i);
    expect(strongestText.join(" ")).toContain(
      "Supported equipment readiness through preventive maintenance",
    );
    expect(strongestText.indexOf(strongestText.find((text) => /Completed reports/i.test(text))!))
      .toBeLessThan(
        strongestText.indexOf(
          strongestText.find((text) => /Supported equipment readiness/i.test(text))!,
        ),
      );
  });

  it("keeps system_inference effectively non-substantive in v1", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: adjacentContext,
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      systemInferenceHints: [
        "Managed enterprise payroll for 300 employees.",
        "Adjacent workflow overlap through reporting and handoffs.",
      ],
    });

    const inferenceFacts = allowedFactsPack.facts.filter(
      (fact) => fact.source === "system_inference",
    );
    expect(inferenceFacts).toEqual([
      expect.objectContaining({
        category: "transfer_signal",
        confidence: "medium",
      }),
    ]);
    expect(
      inferenceFacts.some((fact) => /payroll|300 employees/i.test(fact.text)),
    ).toBe(false);
  });

  it("treats backend-heavy must-haves as the primary overlap signal for context class", () => {
    const contextClass = inferPremiumCoverLetterContextClass({
      personalizationContext: backendAdjacentContext,
      jobTitle: backendAdjacentJob.jobTitle,
      jobDescription: backendAdjacentJob.jobDescription,
    });

    expect(contextClass).toBe("cv_adjacent");
  });

  it("keeps realistic CV-backed admin workflow matches premium-eligible despite morphology drift", () => {
    const contextClass = inferPremiumCoverLetterContextClass({
      personalizationContext: adminMorphologyDriftContext,
      jobTitle: adminMorphologyDriftJob.jobTitle,
      jobDescription: adminMorphologyDriftJob.jobDescription,
    });

    expect(contextClass).toBe("cv_adjacent");

    const eligibility = evaluatePremiumCoverLetterEligibility({
      personalizationContext: adminMorphologyDriftContext,
      voicePreset: "signature",
      jobTitle: adminMorphologyDriftJob.jobTitle,
      jobDescription: adminMorphologyDriftJob.jobDescription,
    });

    expect(eligibility).toEqual({
      eligible: true,
      contextClass: "cv_adjacent",
    });
  });

  it("classifies structured no-CV job offers as no_cv and ranks employer priorities instead of checklist noise", () => {
    const contextClass = inferPremiumCoverLetterContextClass({
      personalizationContext: null,
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
    });
    expect(contextClass).toBe("no_cv");

    const eligibility = evaluatePremiumCoverLetterEligibility({
      personalizationContext: null,
      voicePreset: "signature",
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
    });
    expect(eligibility).toEqual({
      eligible: true,
      contextClass: "no_cv",
    });

    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: null,
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      contextClass: "no_cv",
    });

    const strongestEvidenceText = rankedEvidencePack.strongestEvidence
      .map((fact) => fact.text)
      .join(" ");

    expect(rankedEvidencePack.strongestEvidence.length).toBeGreaterThan(0);
    expect(strongestEvidenceText).not.toMatch(/Excel/i);
    expect(strongestEvidenceText).toMatch(
      /service requests|follow-up|records current|scheduling|coordination/i,
    );
  });
});

describe("premium cover letter prompt contract", () => {
  const buildDirectBrief = (outputLanguage = "English") => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: directContext,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
    });
    return buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
      allowedFactsPack,
      rankedEvidencePack,
    });
  };

  const buildAdjacentAdminBrief = (outputLanguage = "English") => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: {
        name: "Camille Bernard",
        summary:
          "Operations lead experienced in coordination, process documentation, and cross-team communication.",
        desiredPosition: "Operations Coordinator",
        topSkills: [
          "Coordination",
          "Documentation",
          "Stakeholder Communication",
        ],
        recentExperience: [
          {
            company: "Nexa Services",
            position: "Operations Coordinator",
            highlights: [
              "Coordinated workflows, documented procedures, tracked deadlines, handled vendor correspondence, and communicated updates across teams.",
            ],
          },
        ],
      },
      jobTitle: "Administrative Coordinator",
      jobDescription:
        "The Administrative Coordinator will manage schedules, documentation, vendor communication, and general office support. Highly organized communication and process follow-through required.",
    });
    return buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage,
      jobTitle: "Administrative Coordinator",
      jobDescription:
        "The Administrative Coordinator will manage schedules, documentation, vendor communication, and general office support. Highly organized communication and process follow-through required.",
      contextClass: "cv_adjacent",
      allowedFactsPack,
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack,
        jobTitle: "Administrative Coordinator",
        jobDescription:
          "The Administrative Coordinator will manage schedules, documentation, vendor communication, and general office support. Highly organized communication and process follow-through required.",
        contextClass: "cv_adjacent",
      }),
    });
  };

  it.each([
    {
      jobTitle: "Implementation Analyst at 4-H",
      jobDescription: directJob.jobDescription,
      employerName: "4-H",
    },
    {
      jobTitle: directJob.jobTitle,
      jobDescription: `Join 5-Hour Energy. The role is open. ${directJob.jobDescription}`,
      employerName: "5-Hour Energy",
    },
    {
      jobTitle: directJob.jobTitle,
      jobDescription: `Join 3-Day Blinds as an implementation analyst. ${directJob.jobDescription}`,
      employerName: "3-Day Blinds",
    },
  ])(
    "preserves the numeric employer $employerName in the structured brief",
    ({ jobTitle, jobDescription, employerName }) => {
      const { factGraph, jobDemandGraph, rankedEvidencePack, claimPlan } =
        buildDirectClaimPlanFixture();
      const brief = buildPremiumCoverLetterBrief({
        preset: "signature",
        outputLanguage: "English",
        jobTitle,
        jobDescription,
        contextClass: "cv_direct",
        allowedFactsPack: buildAllowedFactsPackFromFactGraph(factGraph),
        rankedEvidencePack,
        claimPlan,
        factGraph,
        jobDemandGraph,
      });

      expect(brief.employerName).toBe(employerName);
    },
  );

  it("adds the CV-backed editorial quality contract to English and French direct and adjacent prompts only", () => {
    const inScopePrompts = [
      buildPremiumCoverLetterPrompt({ brief: buildDirectBrief("English") }),
      buildPremiumCoverLetterPrompt({
        brief: buildAdjacentAdminBrief("English"),
      }),
      buildPremiumCoverLetterPrompt({ brief: buildDirectBrief("French") }),
      buildPremiumCoverLetterPrompt({
        brief: buildAdjacentAdminBrief("French"),
      }),
    ];

    for (const prompt of inScopePrompts) {
      expect(prompt).toContain("CV-backed editorial quality contract:");
      expect(prompt).toContain(
        "write a natural first paragraph rooted in the candidate's relevant experience",
      );
      expect(prompt).toContain(
        "Connect that experience to the assigned responsibility as role context",
      );
      expect(prompt).toContain(
        "do not use generic setups such as 'X is most valuable when...'",
      );
      expect(prompt).toContain(
        "Use the distinct fact assigned to proofBlock and never repeat an opening metric, result, employer, duty, or cadence",
      );
      expect(prompt).toContain(
        "Every sentence must contain a complete thought with a subject and finite predicate",
      );
      expect(prompt).toContain(
        "close with one specific evidence-grounded contribution to the assigned responsibility",
      );
      expect(prompt).toContain(
        "Across cv_direct and cv_adjacent modes, sound like a person making a case, not a memo.",
      );
      expect(prompt).toContain(
        "Use one cautious employer-facing implication. Avoid formula bridges ('That is useful...', 'That matters...', 'day-to-day depends...', 'those habits matter'); write the concrete team consequence plainly.",
      );
    }

    expect(inScopePrompts[0]).toContain("English editorial contract:");
    expect(inScopePrompts[1]).toContain("English editorial contract:");
    expect(inScopePrompts[2]).toContain("French editorial contract:");
    expect(inScopePrompts[3]).toContain("French editorial contract:");
    expect(inScopePrompts[2]).toContain(
      "compose in idiomatic professional French",
    );
    expect(inScopePrompts[3]).toContain("je serais ravi de");
    expect(inScopePrompts[2]).toContain("'mon socle'");
    expect(inScopePrompts[3]).toContain("handoffs, rollouts, or enterprise");

    for (const language of [
      "Spanish",
      "German",
      "Italian",
      "Portuguese",
      "Polish",
      "Dutch",
      "Greek",
      "Hungarian",
      "Lithuanian",
      "Estonian",
      "Russian",
      "Arabic",
    ] as const) {
      const prompt = buildPremiumCoverLetterPrompt({
        brief: buildDirectBrief(language),
      });
      expect(prompt).toContain("CV-backed editorial quality contract:");
      expect(prompt).toContain("use one role-specific opening");
      expect(prompt).not.toContain(
        "write a natural first paragraph rooted in the candidate's relevant experience",
      );
      expect(prompt).not.toContain("English editorial contract:");
      expect(prompt).not.toContain("French editorial contract:");
    }

    const noCvFacts = buildAllowedFactsPack({
      personalizationContext: null,
      jobTitle: "Operations Assistant",
      jobDescription: "Coordinate schedules and maintain records.",
    });
    const noCvBrief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "French",
      jobTitle: "Operations Assistant",
      jobDescription: "Coordinate schedules and maintain records.",
      contextClass: "no_cv",
      allowedFactsPack: noCvFacts,
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack: noCvFacts,
        jobTitle: "Operations Assistant",
        jobDescription: "Coordinate schedules and maintain records.",
        contextClass: "no_cv",
      }),
    });

    const noCvPrompt = buildPremiumCoverLetterPrompt({ brief: noCvBrief });
    expect(noCvPrompt).toContain(
      [
        "Preset affects rhetorical texture only. It must not change truthfulness, claim strength, or evidence priority. Do not change ownership, metrics, tools, responsibilities, or boundaries.",
        "Across cv_direct and cv_adjacent modes, sound like a person making a case, not a memo.",
        "Avoid clunky inanimate-object phrasing and evaluator/meta phrases like 'the evidence I would bring'.",
        "Do not narrate the writing plan or provenance. Never write 'I have described', 'I described', 'as described', 'the evidence shows', 'this section shows', 'this letter shows', 'the claim is', 'work surface', or 'concrete bridge'.",
        "Do not use self-scoring or section-label openings such as 'my strongest match', 'my best match', 'the strongest evidence', 'my fit for this role', or 'the main reason I am a fit'.",
        "Use one cautious employer-facing implication. Avoid formula bridges ('That is useful...', 'That matters...', 'day-to-day depends...', 'those habits matter'); write the concrete team consequence plainly.",
        "closeLine: concise evidence-grounded contribution, not generic interview-request wording.",
      ].join("\n"),
    );
    expect(noCvPrompt).not.toContain("CV-backed editorial quality contract:");
    expect(noCvPrompt).not.toContain(
      "write a natural first paragraph rooted in the candidate's relevant experience",
    );
    expect(noCvPrompt).not.toContain("English editorial contract:");
    expect(noCvPrompt).not.toContain("French editorial contract:");
  });

  it("scopes premium provider adapters to Mistral and Qwen without changing GPT/default prompts", () => {
    const brief = buildDirectBrief();
    const defaultPrompt = buildPremiumCoverLetterPrompt({ brief });
    const gptPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "openai",
      writerModel: "gpt-5.5",
    });
    const unknownPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "unknown",
    });
    const mistralPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "mistral",
      writerModel: "mistral-large-latest",
    });
    const qwenPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "qwen",
      writerModel: "qwen3.7-max",
    });

    expect(MISTRAL_PREMIUM_COVER_LETTER_ADAPTER).toContain(
      "Provider adapter: Mistral",
    );
    expect(QWEN_PREMIUM_COVER_LETTER_ADAPTER).toContain(
      "Provider adapter: Qwen",
    );
    expect(gptPrompt).toBe(defaultPrompt);
    expect(unknownPrompt).toBe(defaultPrompt);
    for (const prompt of [defaultPrompt, gptPrompt, unknownPrompt]) {
      expect(prompt).not.toContain("Provider adapter: Mistral");
      expect(prompt).not.toContain("Provider adapter: Qwen");
      expect(prompt).not.toContain("Truth outranks fluency");
      expect(prompt).not.toContain("monitored ≠ managed");
      expect(prompt).not.toContain(
        "Ownership boundary: use the candidate's CV verbs exactly",
      );
      expect(prompt).not.toContain("ensure smooth coordination");
      expect(prompt).not.toContain("kept notes current");
      expect(prompt).not.toContain("MISTRAL ADJACENT-FIT ADDENDUM");
      expect(prompt).not.toContain("MISTRAL ADJACENT-FIT STRICT ADDENDUM");
      expect(prompt).not.toContain("MISTRAL ADJACENT ROLE-MAPPING LOCK");
      expect(prompt).not.toContain("Mistral cv_direct contract");
      expect(prompt).not.toContain("normal premium cover letter");
      expect(prompt).not.toContain("source-backed cover-letter contract");
      expect(prompt).not.toContain("strict evidence-only adjacent letter");
      expect(prompt).not.toContain("Mistral cv_adjacent body-part contract");
      expect(prompt).not.toContain("Let the reader infer relevance");
      expect(prompt).not.toContain("Do not write a transfer argument");
      expect(prompt).not.toContain("restrained employer-facing bridge");
      expect(prompt).not.toContain(
        "The bridge must stay at the level of overlap, relevance, or operating context",
      );
      expect(prompt).not.toContain(
        "In adjacent cases, never convert proximity into role fit, role alignment, future contribution, or promised impact",
      );
    }

    expect(mistralPrompt).toContain("Provider adapter: Mistral");
    expect(mistralPrompt).toContain("Mistral cv_direct contract");
    expect(mistralPrompt).toContain("normal premium cover letter");
    expect(mistralPrompt).toContain("source-backed cover-letter contract");
    expect(mistralPrompt).toContain("Do not invent impact");
    expect(mistralPrompt).toContain("Avoid generic fit language");
    expect(mistralPrompt).toContain("Truth outranks fluency");
    expect(mistralPrompt).toContain(
      "CV evidence outranks job-description keywords",
    );
    expect(mistralPrompt).toContain("monitored ≠ managed");
    expect(mistralPrompt).toContain("documented ≠ managed");
    expect(mistralPrompt).toContain("valid driver's license");
    expect(mistralPrompt).toContain("high school diploma");
    expect(mistralPrompt).toContain("MISTRAL ADJACENT ROLE-MAPPING LOCK");
    expect(mistralPrompt).toContain("Role reference rule:");
    expect(mistralPrompt).toContain(
      "In adjacent cases, never convert proximity into direct target-role experience, unsupported ownership, guaranteed future performance, or measurable impact not present in candidate facts",
    );
    expect(mistralPrompt).toContain(
      "Mistral cv_adjacent may include one restrained employer-facing bridge",
    );
    expect(mistralPrompt).toContain(
      "The bridge must stay at the level of overlap, relevance, or operating context",
    );
    expect(mistralPrompt).toContain("for an Administrative Coordinator");
    expect(mistralPrompt).toContain(
      "Do not write \"For a [JD role], these skills...\"",
    );
    expect(mistralPrompt).toContain("Adjacent-safe writing rule:");
    expect(mistralPrompt).toContain(
      "Do not use generic relevance explanations",
    );
    expect(mistralPrompt).toContain(
      "Every body paragraph should include at least one concrete CV-derived anchor when available",
    );
    expect(mistralPrompt).toContain("Mistral compactness rule:");
    expect(mistralPrompt).toContain(
      "Use each candidate evidence anchor once across all body parts",
    );
    expect(mistralPrompt).toContain(
      "Do not summarize the whole CV in the opening.",
    );
    expect(mistralPrompt).toContain(
      "I bring the same discipline around records, deadlines, and communication",
    );
    expect(mistralPrompt).toContain(
      "Return only the required JSON body parts",
    );
    expect(mistralPrompt).not.toContain("Provider adapter: Qwen");
    expect(mistralPrompt).not.toContain(
      "Ownership boundary: use the candidate's CV verbs exactly",
    );
    expect(mistralPrompt).not.toContain("ensure smooth coordination");
    expect(mistralPrompt).not.toContain("kept notes current");

    expect(qwenPrompt).toContain("Provider adapter: Qwen");
    expect(qwenPrompt).toContain("separated evidence zones");
    expect(qwenPrompt).toContain(
      "Never transfer a requirement from job facts into candidate experience",
    );
    expect(qwenPrompt).toContain(
      "Use ATS terms only when attached to a CV-backed action",
    );
    expect(qwenPrompt).toContain(
      "For cv_adjacent, allow at most one restrained employer-facing bridge.",
    );
    expect(qwenPrompt).toContain(
      "Do not use the target role title as proof.",
    );
    expect(qwenPrompt).toContain(
      "Silently reject any sentence that says the candidate aligns directly with the role",
    );
    expect(qwenPrompt).toContain(
      "Silently reject any sentence that says your goal, your needs, your requirements, I can help, I can support, I would contribute, or I am ready to as proof of fit.",
    );
    expect(qwenPrompt).toContain("Preferred safe bridge shapes:");
    expect(qwenPrompt).toContain(
      "The overlap is strongest around onboarding handoffs, rollout documentation, and feedback tracking.",
    );
    expect(qwenPrompt).toContain(
      "That background is relevant to work where rollout planning, documentation, and cross-functional updates matter.",
    );
    expect(qwenPrompt).toContain("Return only the required JSON body parts");
    expect(qwenPrompt).toContain("Do not output chain-of-thought, audit, XML, citations, markdown, or explanations.");
    expect(qwenPrompt).not.toContain("Provider adapter: Mistral");
    expect(qwenPrompt).not.toContain("Mistral cv_direct contract");
    expect(qwenPrompt).not.toContain("normal premium cover letter");
    expect(qwenPrompt).not.toContain("source-backed cover-letter contract");
    expect(qwenPrompt).not.toContain("strict evidence-only adjacent letter");
    expect(qwenPrompt).not.toContain("Mistral cv_adjacent body-part contract");
    expect(qwenPrompt).not.toContain("Let the reader infer relevance");
    expect(qwenPrompt).not.toContain("Do not write a transfer argument");
    expect(qwenPrompt).not.toContain("MISTRAL ADJACENT-FIT ADDENDUM");
    expect(qwenPrompt).not.toContain("MISTRAL ADJACENT-FIT STRICT ADDENDUM");
    expect(qwenPrompt).not.toContain("MISTRAL ADJACENT ROLE-MAPPING LOCK");
  });

  it("keeps premium prompt V2 off by default and enables it only for explicit Mistral provider", () => {
    const brief = buildDirectBrief();
    const flagEnv = {
      lower: process.env.cover_letter_premium_prompt_v2,
      upper: process.env.COVER_LETTER_PREMIUM_PROMPT_V2,
      enable: process.env.ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2,
    };
    const versionMarker =
      "Premium cover-letter prompt version: premium_cover_letter_prompt_v2_mistral.";

    delete process.env.cover_letter_premium_prompt_v2;
    delete process.env.COVER_LETTER_PREMIUM_PROMPT_V2;
    delete process.env.ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2;

    try {
      const v1DefaultPrompt = buildPremiumCoverLetterPrompt({ brief });
      const v1OpenAiPrompt = buildPremiumCoverLetterPrompt({
        brief,
        writerProvider: "openai",
        writerModel: "gpt-5.5",
      });
      const v1QwenPrompt = buildPremiumCoverLetterPrompt({
        brief,
        writerProvider: "qwen",
        writerModel: "qwen3.7-max",
      });
      const v1MistralPrompt = buildPremiumCoverLetterPrompt({
        brief,
        writerProvider: "mistral",
        writerModel: "mistral-large-latest",
      });
      const v1ModelOnlyMistralPrompt = buildPremiumCoverLetterPrompt({
        brief,
        writerProvider: "unknown",
        writerModel: "mistral-large-latest",
      });

      expect(v1MistralPrompt).not.toContain(versionMarker);

      process.env.ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2 = "1";

      const v2MistralPrompt = buildPremiumCoverLetterPrompt({
        brief,
        writerProvider: "mistral",
        writerModel: "mistral-large-latest",
      });

      expect(v2MistralPrompt).toContain(versionMarker);
      expect(v2MistralPrompt).toContain("Offer appropriation:");
      expect(v2MistralPrompt).toContain("Requirement-to-candidate angle:");
      expect(v2MistralPrompt).toContain("No job-offer listing:");
      expect(v2MistralPrompt).toContain("Factuality lock:");
      expect(v2MistralPrompt).toContain("Structured evidence lock:");
      expect(v2MistralPrompt).toContain("Provider adapter: Mistral");
      expect(v2MistralPrompt).toContain(
        "Return only PremiumWriterOutputV1 JSON.",
      );
      expect(v2MistralPrompt).not.toBe(v1MistralPrompt);

      expect(buildPremiumCoverLetterPrompt({ brief })).toBe(v1DefaultPrompt);
      expect(
        buildPremiumCoverLetterPrompt({
          brief,
          writerProvider: "openai",
          writerModel: "gpt-5.5",
        }),
      ).toBe(v1OpenAiPrompt);
      expect(
        buildPremiumCoverLetterPrompt({
          brief,
          writerProvider: "qwen",
          writerModel: "qwen3.7-max",
        }),
      ).toBe(v1QwenPrompt);
      expect(
        buildPremiumCoverLetterPrompt({
          brief,
          writerProvider: "unknown",
          writerModel: "mistral-large-latest",
        }),
      ).toBe(v1ModelOnlyMistralPrompt);
    } finally {
      if (flagEnv.lower === undefined) {
        delete process.env.cover_letter_premium_prompt_v2;
      } else {
        process.env.cover_letter_premium_prompt_v2 = flagEnv.lower;
      }
      if (flagEnv.upper === undefined) {
        delete process.env.COVER_LETTER_PREMIUM_PROMPT_V2;
      } else {
        process.env.COVER_LETTER_PREMIUM_PROMPT_V2 = flagEnv.upper;
      }
      if (flagEnv.enable === undefined) {
        delete process.env.ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2;
      } else {
        process.env.ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2 = flagEnv.enable;
      }
    }
  });

  it("keeps premium prompt V2 inside existing provenance and factuality constraints", () => {
    const brief = buildDirectBrief();
    const previousFlag = process.env.ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2;
    process.env.ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2 = "true";
    try {
      const prompt = buildPremiumCoverLetterPrompt({
        brief,
        writerProvider: "mistral",
        writerModel: "mistral-large-latest",
      });

      expect(prompt).toContain(
        "Each body part must cite the claimIds, factIds, and demandIds it used.",
      );
      expect(prompt).toContain(
        "Job demands are role context only and must not become candidate experience.",
      );
      expect(prompt).toContain(
        "Use brief facts only. Do not invent credentials, ownership, metrics, tools, timelines, or proof.",
      );
      expect(prompt).toContain(
        "Cite only claimIds, factIds, and demandIds actually used by that section; demandIds remain role context and never candidate proof.",
      );
      expect(prompt).toContain(
        "Missing requirements are gaps, omissions, or non-claims.",
      );
      expect(prompt).toContain(
        "Never convert a job demand, preferred qualification, compliance framework, credential, or employer goal into candidate experience.",
      );
    } finally {
      if (previousFlag === undefined) {
        delete process.env.ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2;
      } else {
        process.env.ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2 = previousFlag;
      }
    }
  });

  it("keeps Mistral V2 from expanding design-system migration into unsupported system details", async () => {
    const previousFlag = process.env.ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2;
    process.env.ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2 = "true";
    const designSystemMigrationContext = {
      name: "Alex Martin",
      summary:
        "Frontend engineer building customer-facing web applications and reusable UI systems.",
      topSkills: ["React", "TypeScript", "Design systems"],
      recentExperience: [
        {
          company: "Orbit",
          position: "Senior Frontend Engineer",
          highlights: [
            "Led a design system migration used across 4 product squads.",
            "Improved release consistency across shared interface work.",
          ],
        },
      ],
    };
    const forbiddenUnsupportedInferencePatterns = [
      /standardizing component usage and versioning/i,
      /\bcomponent versioning\b/i,
      /\bcomponent governance\b/i,
      /\btoken architecture\b/i,
      /\brelease process ownership\b/i,
      /\btooling ownership\b/i,
      /\bsystem standardization\b/i,
    ];
    let capturedPrompt = "";

    try {
      const result = await attemptPremiumCoverLetterGeneration({
        personalizationContext: designSystemMigrationContext,
        voicePreset: "signature",
        outputLanguage: "English",
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript delivery for customer-facing web applications, design systems, shared interfaces, release consistency, component versioning, component governance, token architecture, release process ownership, tooling ownership, and system standardization.",
        candidateName: "Alex Martin",
        writerProvider: "mistral",
        writerModel: "mistral-large-latest",
        writer: async ({ prompt }) => {
          capturedPrompt = prompt;
          const hasAtomicMigrationBoundary =
            prompt.includes(
              "Atomic CV fact lock: CV facts are atomic and non-expandable.",
            ) &&
            prompt.includes(
              'Migration boundary: "migration" describes movement only.',
            ) &&
            prompt.includes("Design-system migration boundary:") &&
            prompt.includes(
              "component versioning, component governance, token architecture, release process ownership, tooling ownership, or system standardization",
            ) &&
            prompt.includes("unless the CV evidence explicitly says");

          if (!hasAtomicMigrationBoundary) {
            return {
              opening:
                "I led a design system migration used across 4 product squads.",
              proofBlock:
                "I improved release consistency across shared interface work.",
              employerValueBlock:
                "That work is relevant to standardizing component usage and versioning, component versioning, component governance, token architecture, release process ownership, tooling ownership, and system standardization.",
              closeLine:
                "I bring React, TypeScript, design systems, and system standardization experience.",
            };
          }

          return {
            opening:
              "I led a design system migration used across 4 product squads.",
            proofBlock:
              "I improved release consistency across shared interface work.",
            employerValueBlock:
              "That work is relevant to frontend teams maintaining shared interface quality.",
            closeLine:
              "I bring experience in React, TypeScript, design-system migration, and shared interface work.",
          };
        },
      });

      expect(capturedPrompt).toContain(
        "Atomic CV fact lock: CV facts are atomic and non-expandable.",
      );
      expect(capturedPrompt).toContain(
        'Migration boundary: "migration" describes movement only.',
      );
      expect(capturedPrompt).toContain("Design-system migration boundary:");
      expect(capturedPrompt).toContain(
        "unless the CV evidence explicitly says that exact system or process detail",
      );
      expect(capturedPrompt).toContain(
        "If the CV says only design-system migration across squads and improved release consistency across shared interface work",
      );

      expect(result).not.toBeNull();
      const finalText = result?.content ?? "";
      expect(finalText).toContain(
        "design system migration used across 4 product squads",
      );
      expect(finalText).toContain(
        "improved release consistency across shared interface work",
      );
      for (const pattern of forbiddenUnsupportedInferencePatterns) {
        expect(finalText).not.toMatch(pattern);
      }

      const explicitCvSupportedResult = await attemptPremiumCoverLetterGeneration({
        personalizationContext: {
          ...designSystemMigrationContext,
          recentExperience: [
            {
              company: "Orbit",
              position: "Senior Frontend Engineer",
              highlights: [
                "Led a design system migration used across 4 product squads.",
                "Improved release consistency across shared interface work.",
                "Owned component versioning, component governance, token architecture, release process ownership, tooling ownership, and system standardization for a shared design system.",
              ],
            },
          ],
        },
        voicePreset: "signature",
        outputLanguage: "English",
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript delivery for customer-facing web applications and shared design systems.",
        candidateName: "Alex Martin",
        writerProvider: "mistral",
        writerModel: "mistral-large-latest",
        writer: async () => ({
          opening:
            "I owned component versioning, component governance, token architecture, release process ownership, tooling ownership, and system standardization for a shared design system.",
          proofBlock:
            "I led a design system migration used across 4 product squads and improved release consistency across shared interface work.",
          employerValueBlock:
            "That work is relevant to frontend teams maintaining shared interface quality.",
          closeLine:
            "I bring experience in React, TypeScript, component versioning, component governance, token architecture, release process ownership, tooling ownership, system standardization, and shared interface work.",
        }),
      });

      expect(explicitCvSupportedResult).not.toBeNull();
      expect(explicitCvSupportedResult?.content).toContain(
        "component versioning, component governance, token architecture, release process ownership, tooling ownership, and system standardization",
      );
      expect(explicitCvSupportedResult?.content).toContain(
        "owned component versioning, component governance, token architecture, release process ownership, tooling ownership, and system standardization for a shared design system",
      );
    } finally {
      if (previousFlag === undefined) {
        delete process.env.ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2;
      } else {
        process.env.ENABLE_COVER_LETTER_PREMIUM_PROMPT_V2 = previousFlag;
      }
    }
  });

  it("adds Qwen cv_direct ownership and scope guidance without leaking to GPT or Mistral", () => {
    const brief = buildDirectBrief();
    const defaultPrompt = buildPremiumCoverLetterPrompt({ brief });
    const mistralPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "mistral",
      writerModel: "mistral-large-latest",
    });
    const qwenPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "qwen",
      writerModel: "qwen3.7-max",
    });

    const contractMarker = "Qwen cv_direct ownership and scope contract:";

    expect(qwenPrompt).toContain(contractMarker);
    expect(qwenPrompt).toContain(
      "Direct match means strong source-backed overlap, not permission to borrow every JD responsibility as candidate experience.",
    );
    expect(qwenPrompt).toContain(
      "Do not borrow high-ownership verbs from the job description.",
    );
    expect(qwenPrompt).toContain(
      "Do not convert employer objectives into candidate achievements.",
    );
    expect(qwenPrompt).toContain(
      "Do not convert collaboration into ownership or control of product, business, or delivery outcomes.",
    );
    expect(qwenPrompt).toContain(
      "Do not expand \"Improved release consistency across shared interface work\" into \"significantly improved release consistency across all shared interface work\" unless that exact scope is source-backed.",
    );
    expect(qwenPrompt).toContain(
      "Avoid unsupported expansion language unless source-backed: directly aligns, your objective, business objectives, perfectly matches, perfect fit, seamless, ensure, ensuring, significantly, across all, elevate design system quality, drive product outcomes, own delivery, manage delivery, or lead development across surfaces.",
    );
    expect(qwenPrompt).toContain(
      "Do not make design systems, reusable components, collaboration, or cross-functional delivery the actor that drives, ensures, or elevates outcomes unless candidate facts directly support that exact outcome.",
    );
    expect(qwenPrompt).toContain(
      "I led a design-system migration used across four product squads.",
    );
    expect(qwenPrompt).toContain(
      "The strongest overlap is around React, TypeScript, design systems, and product-facing interface work.",
    );
    expect(qwenPrompt).toContain(
      "That experience is relevant to frontend work where reusable systems, product iteration, and customer-facing surfaces matter.",
    );

    expect(defaultPrompt).not.toContain(contractMarker);
    expect(mistralPrompt).not.toContain(contractMarker);
    expect(
      qwenPrompt.split(contractMarker).length - 1,
    ).toBe(1);
  });

  it("keeps shared cv_adjacent guidance evidence-first for GPT/default and narrows provider prompts to grounded bridges", () => {
    const brief = buildAdjacentAdminBrief();
    const defaultPrompt = buildPremiumCoverLetterPrompt({ brief });
    const mistralPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
    });
    const qwenPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "qwen",
      writerModel: "qwen3.7-max",
    });

    expect(defaultPrompt).toContain(
      "keep candidate evidence candidate-side and job facts work-surface-side",
    );
    expect(defaultPrompt).toContain(
      "prioritize concrete CV-backed actions before any employer bridge",
    );
    expect(defaultPrompt).toContain(
      "do not use the target role title, job requirements, employer needs, direct-fit wording, role-mapping language, or future-value promises as proof",
    );
    expect(defaultPrompt).toContain(
      "make persuasion from the operating discipline already present in the CV facts",
    );
    expect(defaultPrompt).toContain(
      "cv_adjacent body-part contract:",
    );
    expect(defaultPrompt).toContain(
      "proofBlock: strongest concrete CV-backed evidence first, before employer context; develop what the work required instead of listing duties flatly",
    );
    expect(defaultPrompt).toContain(
      "The bridge should explain the operating discipline behind the evidence, not just name overlapping duties.",
    );
    expect(defaultPrompt).toContain(
      "closeLine: one short sentence restating CV-backed operating strengths only",
    );
    expect(defaultPrompt).toContain(
      "Do not use \"for this role,\" \"in this role,\" the target role title as proof, \"your needs,\" \"helps with,\" \"can help,\" \"can support,\" \"would bring,\" \"would contribute,\" \"ready to,\" \"translates,\" \"aligns,\" \"smoothly,\" or \"efficiently.\"",
    );

    expect(mistralPrompt).toContain(
      "grounded adjacent letter with at most one restrained employer-facing bridge",
    );
    expect(mistralPrompt).toContain(
      "Mistral cv_adjacent may include one restrained employer-facing bridge",
    );
    expect(mistralPrompt).toContain(
      "The bridge must stay at the level of overlap, relevance, or operating context",
    );
    expect(mistralPrompt).toContain(
      "employerValueBlock: concrete CV-backed evidence or one restrained employer-facing bridge",
    );
    expect(mistralPrompt).toContain(
      "Do not include greeting, signoff, or candidate name",
    );
    expect(mistralPrompt).toContain(
      "Every body part should include at least one concrete CV-backed anchor",
    );
    expect(mistralPrompt).toContain(
      "Sentence budget: opening 1 sentence, proofBlock at most 2 sentences, employerValueBlock 1 sentence, closeLine 1 sentence.",
    );
    expect(mistralPrompt).toContain(
      "If topResponsibilities or workContext are present, employerValueBlock should be the restrained bridge, not another evidence-only sentence.",
    );
    expect(mistralPrompt).toContain(
      "Evidence reuse budget: each employer, duty, cadence, credential, environment, artifact, or workflow may appear in only one body part.",
    );
    expect(mistralPrompt).toContain(
      "closeLine must be first person and must not begin with detached noun phrases like \"Experience includes\" or \"Background includes\".",
    );
    expect(mistralPrompt).toContain(
      "If evidence is limited, return shorter body parts",
    );
    expect(mistralPrompt).not.toContain(
      "keep candidate evidence candidate-side and job facts work-surface-side",
    );
    expect(mistralPrompt).not.toContain(
      "prioritize concrete CV-backed actions before any employer bridge",
    );
    expect(mistralPrompt).not.toContain(
      "EmployerValueBlock: move directly to an employer-facing implication",
    );
    expect(mistralPrompt).not.toContain(
      "CloseLine: one short role-specific sentence",
    );
    expect(qwenPrompt).toContain(
      "Qwen cv_adjacent contract:",
    );
    expect(qwenPrompt).toContain(
      "Evidence first: keep candidate facts candidate-side and JD facts work-surface context only.",
    );
    expect(qwenPrompt).toContain(
      "Allow at most one restrained employer-facing bridge.",
    );
    expect(qwenPrompt).toContain(
      "Do not use the target role title, job requirements, or employer goals as proof.",
    );
    expect(qwenPrompt).toContain(
      "Silently reject any sentence that says the candidate aligns directly with the role, translates into the role, or provides direct fit or perfect fit.",
    );
    expect(qwenPrompt).toContain(
      "Ownership boundary: use the candidate's CV verbs exactly or lower-ownership verbs",
    );
    expect(qwenPrompt).toContain(
      "Do not use high-ownership verbs unless the exact verb and scope are directly present in candidate facts",
    );
    expect(qwenPrompt).toContain(
      "Avoid outcome-control bridges such as ensure smooth coordination",
    );
    expect(qwenPrompt).toContain(
      "Prefer lower-ownership supported verbs: documented, tracked, maintained, reported, shared updates, kept notes current",
    );
    expect(qwenPrompt).toContain(
      "Safe bridge examples:",
    );
    expect(qwenPrompt).toContain(
      "The overlap is strongest around onboarding handoffs, rollout documentation, and feedback tracking.",
    );
    expect(qwenPrompt).toContain(
      "That background is relevant to work where rollout planning, documentation, and cross-functional updates matter.",
    );
    expect(qwenPrompt).toContain(
      "Return only the required JSON body parts",
    );
    expect(qwenPrompt).toContain(
      "Do not output chain-of-thought, audit, XML, citations, markdown, or explanations.",
    );
    expect(qwenPrompt).not.toContain(
      "keep candidate evidence candidate-side and job facts work-surface-side",
    );
    expect(qwenPrompt).not.toContain(
      "prioritize concrete CV-backed actions before any employer bridge",
    );
    expect(qwenPrompt).not.toContain("strict evidence-only adjacent letter");
    expect(qwenPrompt).not.toContain("Mistral cv_adjacent body-part contract");
    expect(qwenPrompt).not.toContain("Let the reader infer relevance");
    expect(qwenPrompt).not.toContain("Do not write a transfer argument");
    expect(
      qwenPrompt.split("Ownership boundary: use the candidate's CV verbs exactly")
        .length - 1,
    ).toBe(1);
    expect(qwenPrompt).not.toContain(
      "Qwen cv_direct ownership and scope contract:",
    );
  });

  it("keeps provider adapter order between the shared premium prompt and structured brief", () => {
    const prompt = buildPremiumCoverLetterPrompt({
      brief: buildDirectBrief(),
      writerModel: "mistral-medium-latest",
    });
    const sharedPromptIndex = prompt.indexOf(
      "Write premium cover-letter body parts.",
    );
    const adapterIndex = prompt.indexOf("Provider adapter: Mistral");
    const structuredBriefIndex = prompt.indexOf("Structured brief:");

    expect(sharedPromptIndex).toBeGreaterThanOrEqual(0);
    expect(adapterIndex).toBeGreaterThan(sharedPromptIndex);
    expect(structuredBriefIndex).toBeGreaterThan(adapterIndex);
  });

  it("keeps strongest evidence priority, demotes secondary qualifications, includes forbidden moves, and stays compact", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: directContext,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
    });
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
      allowedFactsPack,
      rankedEvidencePack,
    });
    const prompt = buildPremiumCoverLetterPrompt({ brief });

    expect(prompt).toContain("Prioritize strongest evidence first.");
    expect(prompt).toContain(
      "Do not lead with secondary qualifications or spend body space on admiration",
    );
    expect(prompt).toContain(
      "Preset affects rhetorical texture only. It must not change truthfulness, claim strength, or evidence priority.",
    );
    expect(prompt).toContain("Preset contract for signature:");
    expect(prompt).toContain(
      "Do not lead with secondary qualifications or spend body space on admiration",
    );
    expect(prompt).toContain(
      "If evidence is modest, let the best available concrete proof carry the case.",
    );
    expect(prompt).toContain(
      "Opening: position through the strongest relevant evidence",
    );
    expect(prompt).toContain(
      "EmployerValueBlock: move directly to an employer-facing implication",
    );
    expect(prompt).toContain('"version":"premium_writer_output_v1"');
    expect(prompt).toContain('"text":"string"');
    expect(prompt).toContain("topResponsibilities");
    expect(prompt).toContain("keyRequirements");
    expect(
      PREMIUM_COVER_LETTER_BODY_PARTS_JSON_SCHEMA.required,
    ).toStrictEqual([
      "opening",
      "proofBlock",
      "employerValueBlock",
      "closeLine",
    ]);
    expect(prompt.length).toBeLessThan(6800);
    expect(prompt.split("\n").length).toBeLessThan(42);
  });

  it("adds distinct preset guidance for signature, expert, and engaging", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: directContext,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
    });

    const signaturePrompt = buildPremiumCoverLetterPrompt({
      brief: buildPremiumCoverLetterBrief({
        preset: "signature",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        contextClass: "cv_direct",
        allowedFactsPack,
        rankedEvidencePack,
      }),
    });
    const expertPrompt = buildPremiumCoverLetterPrompt({
      brief: buildPremiumCoverLetterBrief({
        preset: "expert",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        contextClass: "cv_direct",
        allowedFactsPack,
        rankedEvidencePack,
      }),
    });
    const engagingPrompt = buildPremiumCoverLetterPrompt({
      brief: buildPremiumCoverLetterBrief({
        preset: "engaging",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        contextClass: "cv_direct",
        allowedFactsPack,
        rankedEvidencePack,
      }),
    });

    expect(signaturePrompt).toContain(
      "Preset contract for signature: professional, warm, personal, concise, and stable;",
    );
    expect(signaturePrompt).toContain(
      "do not let it read like colder expert analysis or a minimal shell.",
    );
    expect(expertPrompt).toContain(
      "Preset contract for expert: compact, professional, and controlled;",
    );
    expect(expertPrompt).toContain(
      "make one precise employer-facing observation about what controlled execution produces for this specific role",
    );
    expect(engagingPrompt).toContain(
      "Preset contract for engaging: warmer but restrained;",
    );
    expect(engagingPrompt).toContain(
      "let one grounded sentence show who benefits when coordination, reporting, service, or follow-through are done well",
    );
    expect(engagingPrompt).toContain(
      "avoid neutral template lead-ins such as a flat relevance summary",
    );
  });

  it("builds a hierarchical offer brief instead of flattening checklist-heavy job text", () => {
    const offerPriorityPack = buildJobOfferPriorityPack(
      weakChecklistJob.jobDescription,
    );
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: weakChecklistContext,
      jobTitle: weakChecklistJob.jobTitle,
      jobDescription: weakChecklistJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: weakChecklistJob.jobTitle,
      jobDescription: weakChecklistJob.jobDescription,
      contextClass: "cv_direct",
    });
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: weakChecklistJob.jobTitle,
      jobDescription: weakChecklistJob.jobDescription,
      contextClass: "cv_direct",
      allowedFactsPack,
      rankedEvidencePack,
    });

    expect(offerPriorityPack.coreResponsibilities.join(" ")).toContain(
      "Coordinate maintenance requests.",
    );
    expect(offerPriorityPack.coreResponsibilities.join(" ")).toContain(
      "schedule vendors.",
    );
    expect(offerPriorityPack.lowValueChecklist.join(" ")).toMatch(
      /organized|reliable|adaptable|willing to learn|Windows|Microsoft Word|Microsoft Excel/i,
    );
    expect(brief.topResponsibilities).toBeDefined();
    expect(brief.lowValueChecklist).toBeDefined();
    expect(brief.workContext).toBeDefined();
    expect(brief.topResponsibilities?.join(" ")).toContain(
      "Coordinate maintenance requests.",
    );
    expect(brief.topResponsibilities?.join(" ")).not.toMatch(
      /Windows|Word|Excel|flexible|willing to learn/i,
    );
    expect(brief.lowValueChecklist?.join(" ")).toMatch(
      /organized|reliable|adaptable|willing to learn|Windows|Word|Excel/i,
    );
    expect(brief.workContext?.join(" ")).toContain(
      "Coordinate maintenance requests.",
    );
  });

  it("builds a no-CV premium brief that stays employer-side and prompt-guided", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: null,
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      contextClass: "no_cv",
    });
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      contextClass: "no_cv",
      allowedFactsPack,
      rankedEvidencePack,
    });
    const prompt = buildPremiumCoverLetterPrompt({ brief });

    expect(brief.candidateEvidenceAvailable).toBe(false);
    expect(brief.transferCore).toBeUndefined();
    expect(brief.topEvidence.join(" ")).toMatch(
      /service requests|follow-up|records current|scheduling|coordination/i,
    );
    expect(brief.topEvidence.join(" ")).not.toMatch(/Excel/i);
    expect(prompt).toContain(
      "For no_cv, there is no supported candidate history.",
    );
    expect(prompt).toContain(
      "Use job-offer work surfaces and candidate intent only, never prior history.",
    );
    expect(prompt).toContain(
      "job descriptions can become neutral role explanation, intent statements, or conditional approach statements only",
    );
    expect(prompt).toContain(
      "stay in first person and sound like a candidate, not a role summary or memo",
    );
    expect(prompt).toContain(
      "vary the opening and avoid repeated stems like 'I am drawn to work...', 'I am applying... with a clear focus on...', 'This role centers on...', or 'The highest-value work...'",
    );
    expect(prompt).toContain(
      "do not claim prior roles, achievements, credentials, tool usage, skills, habits, worker identity, readiness, or impact",
    );
    expect(prompt).toContain(
      "keep employerValueBlock on operational consequence and closeLine on modest first-person intent",
    );
    const mistralPrompt = buildPremiumCoverLetterPrompt({
      brief,
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
    });
    expect(mistralPrompt).toContain("Mistral no_cv contract:");
    expect(mistralPrompt).toContain(
      "Never convert JOB SURFACE into CANDIDATE EXPERIENCE.",
    );
    expect(mistralPrompt).toContain(
      "Allowed no_cv stems include \"I am interested in this role because\"",
    );
    expect(mistralPrompt).toContain(
      "Forbidden no_cv stems include \"I coordinate\"",
    );
    expect(mistralPrompt).toContain(
      "Do not begin closeLine with \"Experience includes\"",
    );
    expect(prompt.length).toBeLessThan(6500);
    expect(prompt.split("\n").length).toBeLessThan(44);
  });

  it("requests strict JSON-schema body parts from OpenAI for premium generation", () => {
    const request = buildPremiumCoverLetterOpenAIRequest({
      prompt: "Structured brief: {}",
      writerModel: "gpt-5.4",
    });

    expect(request).toEqual({
      model: "gpt-5.4",
      input: "Structured brief: {}",
      reasoning: {
        effort: "low",
      },
      text: {
        verbosity: "medium",
        format: {
          type: "json_schema",
          name: "premium_writer_output_v1",
          schema: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
          strict: true,
        },
      },
    });
    expect(request.text.format).not.toHaveProperty("json_schema");

    expect(
      buildPremiumCoverLetterOpenAIRequest({
        prompt: "Structured brief: {}",
        writerModel: "gpt-5.4",
        maxOutputTokens: 2048,
      }),
    ).toMatchObject({ max_output_tokens: 2048 });
  });

  it("shares the direct Responses JSON-schema contract across parse, create, and raw fetch", async () => {
    const responseFormat = {
      name: "premium_writer_output_v1",
      jsonSchema: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
      zodSchema: PREMIUM_WRITER_OUTPUT_V1_SCHEMA,
    } satisfies OpenAIResponsesSchemaContract;
    const structuredOutput = {
      version: "premium_writer_output_v1",
      bodyParts: {
        opening: {
          section: "opening",
          text: "Opening.",
          claimIds: [],
          factIds: [],
          demandIds: [],
        },
        proofBlock: {
          section: "proofBlock",
          text: "Proof.",
          claimIds: [],
          factIds: [],
          demandIds: [],
        },
        employerValueBlock: {
          section: "employerValueBlock",
          text: "Value.",
          claimIds: [],
          factIds: [],
          demandIds: [],
        },
        closeLine: {
          section: "closeLine",
          text: "Close.",
          claimIds: [],
          factIds: [],
          demandIds: [],
        },
      },
    } as const;
    const expectDirectFormat = (request: any) => {
      expect(request.text.format).toEqual(
        expect.objectContaining({
          type: "json_schema",
          name: responseFormat.name,
          schema: responseFormat.jsonSchema,
          strict: true,
        }),
      );
      expect(request.text.format).not.toHaveProperty("json_schema");
    };
    const makeOpenAIModule = (responses: Record<string, unknown>) => ({
      OpenAI: class {
        responses = responses;
      },
    });

    const parse = vi.fn(async () => ({
      output_parsed: structuredOutput,
      model: "gpt-5.5",
    }));
    const zodTextFormat = vi.fn((schema: unknown, name: string) => {
      void schema;
      return {
        type: "json_schema",
        name,
        schema: responseFormat.jsonSchema,
        strict: true,
      };
    });
    await generateOpenAIResponsesStructured({
      apiKey: "offline",
      prompt: "parse prompt",
      writerModel: "gpt-5.5",
      responseFormat,
      maxOutputTokens: 1101,
      reasoningEffort: "low",
      dependencies: {
        loadOpenAIModule: async () =>
          makeOpenAIModule({ parse, create: undefined }),
        loadZodHelperModule: async () => ({ zodTextFormat }),
        fetchImpl: vi.fn(),
      },
    });
    const parseRequest = parse.mock.calls[0]?.[0];
    expect(parseRequest).toBeDefined();
    expectDirectFormat(parseRequest);
    expect(parseRequest.max_output_tokens).toBe(1101);
    expect(zodTextFormat).toHaveBeenCalledWith(
      responseFormat.zodSchema,
      responseFormat.name,
    );

    const create = vi.fn(async () => ({
      output_parsed: structuredOutput,
      model: "gpt-5.5",
    }));
    await generateOpenAIResponsesStructured({
      apiKey: "offline",
      prompt: "create prompt",
      writerModel: "gpt-5.5",
      responseFormat,
      maxOutputTokens: 1202,
      reasoningEffort: "low",
      dependencies: {
        loadOpenAIModule: async () =>
          makeOpenAIModule({ parse: undefined, create }),
        loadZodHelperModule: async () => null,
        fetchImpl: vi.fn(),
      },
    });
    const createRequest = create.mock.calls[0]?.[0];
    expect(createRequest).toBeDefined();
    expectDirectFormat(createRequest);
    expect(createRequest.max_output_tokens).toBe(1202);

    const fetchImpl = vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ output_parsed: structuredOutput }),
        text: async () => "",
      }) as any,
    );
    await generateOpenAIResponsesStructured({
      apiKey: "offline",
      prompt: "raw fetch prompt",
      writerModel: "gpt-5.5",
      responseFormat,
      maxOutputTokens: 1303,
      reasoningEffort: "low",
      dependencies: {
        loadOpenAIModule: async () => null,
        fetchImpl,
      },
    });
    const rawRequest = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expectDirectFormat(rawRequest);
    expect(rawRequest.max_output_tokens).toBe(1303);
  });

  it.each(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"] as const)(
    "builds the shared OpenAI request with exact evaluation-only model id %s",
    (writerModel) => {
      expect(
        buildPremiumCoverLetterOpenAIRequestForExactModel({
          prompt: "Structured brief: {}",
          writerModel,
          maxOutputTokens: 2048,
        }),
      ).toMatchObject({
        model: writerModel,
        input: "Structured brief: {}",
        max_output_tokens: 2048,
        reasoning: { effort: "low" },
        text: {
          verbosity: "medium",
          format: {
            type: "json_schema",
            name: "premium_writer_output_v1",
            schema: PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA,
            strict: true,
          },
        },
      });
    },
  );

  it("normalizes OpenAI proposal reasoning effort when the request is built", () => {
    vi.stubEnv("OPENAI_PROPOSAL_REASONING_EFFORT", "  HiGh  ");

    expect(
      buildPremiumCoverLetterOpenAIRequest({
        prompt: "Structured brief: {}",
        writerModel: "gpt-5.4",
      }).reasoning,
    ).toEqual({ effort: "high" });

    vi.stubEnv("OPENAI_PROPOSAL_REASONING_EFFORT", "not-supported");

    expect(
      buildPremiumCoverLetterOpenAIRequest({
        prompt: "Structured brief: {}",
        writerModel: "gpt-5.4",
      }).reasoning,
    ).toEqual({ effort: "low" });
  });

  it("prefers an explicit per-call OpenAI reasoning effort", () => {
    vi.stubEnv("OPENAI_PROPOSAL_REASONING_EFFORT", "high");

    expect(
      buildPremiumCoverLetterOpenAIRequestForExactModel({
        prompt: "Structured brief: {}",
        writerModel: "gpt-5.6-luna",
        reasoningEffort: "none",
      }).reasoning,
    ).toEqual({ effort: "none" });
  });

  it("whitelists every OpenAI proposal reasoning effort value", () => {
    const cases: Array<
      [
        string | undefined,
        "none" | "minimal" | "low" | "medium" | "high",
      ]
    > = [
      [undefined, "low"],
      ["", "low"],
      ["   ", "low"],
      ["not-supported", "low"],
      ["none", "none"],
      ["minimal", "minimal"],
      ["low", "low"],
      [" MeDiUm ", "medium"],
      [" high ", "high"],
    ];

    for (const [value, expected] of cases) {
      expect(resolveOpenAIProposalReasoningEffort(value)).toBe(expected);
    }
  });

  it("prefers parsed structured payloads from the Responses API envelope", () => {
    const payload = extractOpenAIJsonPayload({
      output_parsed: {
        opening: "Opening sentence.",
        proofBlock: "Proof sentence.",
        employerValueBlock: "Employer value sentence.",
        closeLine: "Close sentence.",
      },
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Dear Hiring Manager,\n\nFallback text that should not win.",
            },
          ],
        },
      ],
    });

    expect(payload).toEqual({
      opening: "Opening sentence.",
      proofBlock: "Proof sentence.",
      employerValueBlock: "Employer value sentence.",
      closeLine: "Close sentence.",
    });
  });

  it("keeps scanning when an earlier text field is plain prose and a later item contains parseable JSON", () => {
    const payload = extractOpenAIJsonPayload({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Dear Hiring Manager,\n\nThis is plain prose, not JSON.",
            },
            {
              type: "output_text",
              text: JSON.stringify({
                opening: "Opening sentence.",
                proofBlock: "Proof sentence.",
                employerValueBlock: "Employer value sentence.",
                closeLine: "Close sentence.",
              }),
            },
          ],
        },
      ],
    });

    expect(payload).toEqual({
      opening: "Opening sentence.",
      proofBlock: "Proof sentence.",
      employerValueBlock: "Employer value sentence.",
      closeLine: "Close sentence.",
    });
  });
});

describe("premium cover letter generation and rendering", () => {
  const buildDirectFrontendBrief = (
    outputLanguage = "English",
    personalizationContext = directContext,
  ) => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
    });
    return buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
      allowedFactsPack,
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack,
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        contextClass: "cv_direct",
      }),
    });
  };

  const buildNoCvBrief = () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: null,
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      contextClass: "no_cv",
    });
    return buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      contextClass: "no_cv",
      allowedFactsPack,
      rankedEvidencePack,
    });
  };

  const buildAdjacentAdminBrief = (outputLanguage = "English") => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: {
        name: "Camille Bernard",
        summary:
          "Operations lead experienced in coordination, process documentation, and cross-team communication.",
        desiredPosition: "Operations Coordinator",
        topSkills: [
          "Coordination",
          "Documentation",
          "Stakeholder Communication",
        ],
        recentExperience: [
          {
            company: "Nexa Services",
            position: "Operations Coordinator",
            highlights: [
              "Coordinated workflows, documented procedures, tracked deadlines, handled vendor correspondence, and communicated updates across teams.",
            ],
          },
        ],
      },
      jobTitle: "Administrative Coordinator",
      jobDescription:
        "The Administrative Coordinator will manage schedules, documentation, vendor communication, and general office support. Highly organized communication and process follow-through required.",
    });
    return buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage,
      jobTitle: "Administrative Coordinator",
      jobDescription:
        "The Administrative Coordinator will manage schedules, documentation, vendor communication, and general office support. Highly organized communication and process follow-through required.",
      contextClass: "cv_adjacent",
      allowedFactsPack,
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack,
        jobTitle: "Administrative Coordinator",
        jobDescription:
          "The Administrative Coordinator will manage schedules, documentation, vendor communication, and general office support. Highly organized communication and process follow-through required.",
        contextClass: "cv_adjacent",
      }),
    });
  };

  const buildAdjacentOpsBrief = () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: adjacentContext,
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
    });
    return buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      contextClass: "cv_adjacent",
      allowedFactsPack,
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack,
        jobTitle: adjacentJob.jobTitle,
        jobDescription: adjacentJob.jobDescription,
        contextClass: "cv_adjacent",
      }),
    });
  };

  const baseAdjacentAdminBodyParts = {
    opening:
      "I coordinated workflows, documented procedures, tracked deadlines, handled vendor correspondence, and communicated updates across teams.",
    proofBlock:
      "I maintained clear records, scheduling follow-through, and cross-team updates.",
    employerValueBlock:
      "I documented process notes, tracked open items, and maintained vendor correspondence records.",
    closeLine:
      "I bring experience in coordination, documentation, scheduling, vendor correspondence, and stakeholder communication.",
  };

  const adjacentAdminIssueCodesFor = (value: string) =>
    validatePremiumCoverLetterBodyParts({
      brief: buildAdjacentAdminBrief(),
      bodyParts: {
        ...baseAdjacentAdminBodyParts,
        employerValueBlock: value,
      },
    }).map((issue) => issue.code);

  const adjacentOpsIssueCodesFor = (value: string) =>
    validatePremiumCoverLetterBodyParts({
      brief: buildAdjacentOpsBrief(),
      bodyParts: {
        opening:
          "I reduced backlog response times by 18% through queue and handoff changes.",
        proofBlock:
          "I owned ticket triage, handoffs, and SLA reporting across support and product teams.",
        employerValueBlock: value,
        closeLine:
          "I bring experience in cross-team coordination, process documentation, and reporting.",
      },
    }).map((issue) => issue.code);

  const directFrontendIssueCodesFor = (value: string) =>
    validatePremiumCoverLetterBodyParts({
      brief: buildDirectFrontendBrief(),
      bodyParts: {
        opening:
          "I improved signup conversion by 11% after iterative UI experiments.",
        proofBlock:
          "I led a design system migration used across 4 product squads.",
        employerValueBlock: value,
        closeLine:
          "I bring experience in React, TypeScript, design systems, and experimentation dashboards.",
      },
    }).map((issue) => issue.code);

  it("fails cv_adjacent output when experience translates into role support", () => {
    expect(
      adjacentAdminIssueCodesFor(
        "This experience translates into the ability to support general office operations with clear records, timely communication, and reliable follow-up.",
      ),
    ).toContain("adjacent_direct_fit");
  });

  it("fails cv_adjacent output when skills are mapped to an Administrative Coordinator role", () => {
    expect(
      adjacentAdminIssueCodesFor(
        "For an Administrative Coordinator, these skills help with general office support, vendor communication, and schedule management.",
      ),
    ).toContain("adjacent_direct_fit");
  });

  it("fails cv_adjacent output when strong-foundation commentary maps to role responsibilities", () => {
    expect(
      adjacentAdminIssueCodesFor(
        "This experience has given me a strong foundation in managing vendor communication and general office support, which are key responsibilities for this role.",
      ),
    ).toContain("adjacent_direct_fit");
  });

  it("fails cv_adjacent output when background can help ensure efficient office operations", () => {
    expect(
      adjacentAdminIssueCodesFor(
        "My background in coordination and documentation can help ensure that office operations run efficiently.",
      ),
    ).toContain("adjacent_direct_fit");
  });

  it("fails cv_adjacent output when operating strengths support smooth office operations", () => {
    expect(
      adjacentAdminIssueCodesFor(
        "I bring the same focus on coordination, documentation, and communication to support smooth office operations.",
      ),
    ).toContain("adjacent_direct_fit");
  });

  it("allows neutral cv_adjacent evidence-only wording", () => {
    expect(
      adjacentAdminIssueCodesFor(
        "I coordinated workflows, documented processes, tracked deadlines, handled vendor correspondence, and communicated updates across teams.",
      ),
    ).not.toContain("adjacent_direct_fit");
  });

  it("allows restrained cv_adjacent employer-facing bridges grounded in overlap and operating context", () => {
    const safeBridgeExamples = [
      "That background is relevant to work where clear handoffs, documentation, and reporting matter.",
      "Those operating habits fit environments that depend on accurate records and timely cross-team updates.",
      "The overlap is strongest around coordination, reporting, and documentation.",
      "That experience is closest to roles where documentation, coordination, and timely updates matter.",
    ];

    for (const bridge of safeBridgeExamples) {
      expect(adjacentAdminIssueCodesFor(bridge)).not.toContain(
        "adjacent_direct_fit",
      );
    }
  });

  it("fails forbidden cv_adjacent bridge shapes that claim direct role fit, future performance, requirements, or mission alignment", () => {
    expect(
      adjacentAdminIssueCodesFor(
        "I have direct experience as an Implementation Analyst.",
      ),
    ).toContain("adjacent_direct_fit");
    expect(
      adjacentAdminIssueCodesFor("I can own your implementation workflows."),
    ).toContain("adjacent_direct_fit");
    expect(
      adjacentAdminIssueCodesFor("This will improve your delivery speed."),
    ).toContain("adjacent_direct_fit");
    expect(
      adjacentAdminIssueCodesFor(
        "My background perfectly aligns with your role.",
      ),
    ).toContain("adjacent_direct_fit");
    expect(
      adjacentAdminIssueCodesFor("I can guarantee smoother operations."),
    ).toContain("adjacent_direct_fit");
    expect(
      adjacentAdminIssueCodesFor("I am passionate about your mission."),
    ).toContain("fabricated_mission_claim");
    expect(
      adjacentAdminIssueCodesFor("I meet your requirements."),
    ).toContain("adjacent_direct_fit");
    expect(
      adjacentAdminIssueCodesFor("I am qualified for every requirement."),
    ).toContain("adjacent_direct_fit");
  });

  it("removes leaked wrong signatures and renders the provided candidate name", async () => {
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: directContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      writer: async () => ({
        opening:
          "I improved signup conversion by 11% after iterative UI experiments.",
        proofBlock:
          "I led a design system migration used across 4 product squads.",
        employerValueBlock:
          "I built experimentation dashboards used by product and growth teams.",
        closeLine: "Sincerely,\nCamille Bernard",
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.content).toMatch(/Sincerely,\nAlex Martin$/);
    expect(result?.content).not.toContain("Camille Bernard");
  });

  it("finalizes a grounded French CV-backed letter with canonical boundaries", async () => {
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: directContext,
      voicePreset: "signature",
      outputLanguage: "French",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      writer: async () => ({
        opening:
          "J’ai amélioré la conversion des inscriptions de 11 % grâce à des expériences d’interface itératives.",
        proofBlock:
          "J’ai dirigé une migration de design system utilisée par 4 équipes produit.",
        employerValueBlock:
          "Cette expérience correspond à votre besoin de piloter des applications React et TypeScript ainsi que des systèmes de design.",
        closeLine:
          "Je serais ravi d’échanger sur la manière dont cette approche pourrait soutenir vos équipes.",
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.content).toMatch(/^Madame, Monsieur,/u);
    expect(result?.content).toMatch(
      /Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées\.\nAlex Martin$/u,
    );
    expect(result?.bodyParts.proofBlock).toContain("4 équipes produit");
  });

  it("repairs generic closes and missing bridges for English and French direct and adjacent CV evidence", () => {
    const cases = [
      {
        brief: buildDirectFrontendBrief("English"),
        opening: "I improved signup conversion by 11% through iterative UI experiments.",
        proofBlock: "I led a design-system migration used across 4 product squads.",
        genericClose: "I welcome the opportunity to discuss the role further.",
        closePattern:
          /^That experience continues to inform my work\.$/u,
        bridgePattern: /^In .+ work, that background supports /u,
      },
      {
        brief: buildAdjacentAdminBrief("English"),
        opening: "I coordinated workflows and documented procedures.",
        proofBlock: "I tracked deadlines and handled vendor correspondence.",
        genericClose:
          "I would welcome the opportunity to discuss the position further.",
        closePattern: /^I bring discipline around /u,
        bridgePattern: /^In .+ work, that kind of background supports /u,
      },
      {
        brief: buildDirectFrontendBrief("French"),
        opening:
          "J'ai amélioré la conversion des inscriptions de 11 % grâce à des expérimentations d'interface.",
        proofBlock:
          "J'ai dirigé une migration de design system utilisée par 4 équipes produit.",
        genericClose: "Je serais ravi d'en discuter.",
        closePattern:
          /^Cette expérience continue de nourrir ma pratique professionnelle\.$/u,
        bridgePattern: /^Dans .+, cette expérience apporte /u,
      },
      {
        brief: buildAdjacentAdminBrief("French"),
        opening:
          "J'ai coordonné des flux de travail et documenté des procédures.",
        proofBlock:
          "J'ai suivi les échéances et géré les échanges avec les fournisseurs.",
        genericClose: "Je serais ravie de discuter de cette opportunité.",
        closePattern: /^J'apporte de la rigueur dans /u,
        bridgePattern:
          /^Cette expérience est pertinente pour .+, où les priorités incluent /u,
      },
    ];

    for (const testCase of cases) {
      const repaired = repairPremiumCoverLetterBodyParts({
        brief: testCase.brief,
        bodyParts: {
          opening: testCase.opening,
          proofBlock: testCase.proofBlock,
          employerValueBlock: "",
          closeLine: testCase.genericClose,
        },
      });

      expect(repaired.closeLine).toMatch(testCase.closePattern);
      expect(repaired.closeLine).not.toBe(testCase.genericClose);
      expect(repaired.employerValueBlock).toMatch(testCase.bridgePattern);
    }

    const mixedClose = repairPremiumCoverLetterBodyParts({
      brief: buildDirectFrontendBrief("English"),
      bodyParts: {
        opening:
          "I improved signup conversion by 11% through iterative UI experiments.",
        proofBlock:
          "I led a design-system migration used across 4 product squads.",
        employerValueBlock:
          "That evidence is relevant to customer-facing product work.",
        closeLine:
          "I would bring the same design-system discipline and would welcome the opportunity to discuss the role further.",
      },
    });
    expect(mixedClose.closeLine).toBe(
      "I would bring the same design-system discipline.",
    );

    const frenchGenericClose = repairPremiumCoverLetterBodyParts({
      brief: buildDirectFrontendBrief("French"),
      bodyParts: {
        opening:
          "J'ai amélioré la conversion des inscriptions de 11 % grâce à des expérimentations d'interface.",
        proofBlock:
          "J'ai dirigé une migration de design system utilisée par 4 équipes produit.",
        employerValueBlock:
          "Cette expérience est pertinente pour des applications destinées aux utilisateurs.",
        closeLine: "Au plaisir d'échanger avec vous.",
      },
    });
    expect(frenchGenericClose.closeLine).toBe(
      "Cette expérience continue de nourrir ma pratique professionnelle.",
    );

    const frenchMixedClose = repairPremiumCoverLetterBodyParts({
      brief: buildDirectFrontendBrief("French"),
      bodyParts: {
        opening:
          "J'ai amélioré la conversion des inscriptions de 11 % grâce à des expérimentations d'interface.",
        proofBlock:
          "J'ai dirigé une migration de design system utilisée par 4 équipes produit.",
        employerValueBlock:
          "Cette expérience est pertinente pour des applications destinées aux utilisateurs.",
        closeLine:
          "Cette expérience nourrit ma pratique, au plaisir d'échanger avec vous.",
      },
    });
    expect(frenchMixedClose.closeLine).toBe(
      "Cette expérience nourrit ma pratique.",
    );

    const frenchAdjacent = cases[3];
    const repairedFrenchAdjacent = repairPremiumCoverLetterBodyParts({
      brief: frenchAdjacent.brief,
      bodyParts: {
        opening: frenchAdjacent.opening,
        proofBlock: frenchAdjacent.proofBlock,
        employerValueBlock: "",
        closeLine: frenchAdjacent.genericClose,
      },
    });
    expect(repairedFrenchAdjacent.employerValueBlock).not.toContain(
      "sont essentiels",
    );

    for (const testCase of cases.slice(2)) {
      const repaired = repairPremiumCoverLetterBodyParts({
        brief: testCase.brief,
        bodyParts: {
          opening: testCase.opening,
          proofBlock: testCase.proofBlock,
          employerValueBlock: "",
          closeLine: testCase.genericClose,
        },
      });
      expect(`${repaired.employerValueBlock} ${repaired.closeLine}`).not.toMatch(
        /\b(?:In|work|supports|background|and|follow-through|handoffs)\b/u,
      );
    }
  });

  it("preserves no-CV generic-close repair behavior byte-for-byte", () => {
    const original = {
      opening:
        "I am interested in this role because it centers on careful coordination.",
      proofBlock:
        "The work requires accurate records and steady follow-through.",
      employerValueBlock:
        "The role points to operations and scheduling work that calls for organized coordination and steady follow-through.",
      closeLine: "I would be glad to discuss the role further.",
    };

    expect(
      repairPremiumCoverLetterBodyParts({
        brief: buildNoCvBrief(),
        bodyParts: original,
      }),
    ).toEqual(original);

    const repairedMissingFields = repairPremiumCoverLetterBodyParts({
      brief: buildNoCvBrief(),
      bodyParts: {
        ...original,
        employerValueBlock: "",
        closeLine: "",
      },
    });
    expect(repairedMissingFields.employerValueBlock).toBe(
      "The role points to reporting and documentation work that calls for accurate records and clear handoffs.",
    );
    expect(repairedMissingFields.closeLine).toBe(
      "I would approach the work with care, clear communication, and steady follow-through.",
    );
  });

  it("removes a duplicated generic close before replacing it", () => {
    const genericClose = "Je serais ravi d'échanger sur le rôle.";
    const repaired = repairPremiumCoverLetterBodyParts({
      brief: buildDirectFrontendBrief("French"),
      bodyParts: {
        opening:
          "J'ai amélioré la conversion des inscriptions de 11 % grâce à des expérimentations d'interface.",
        proofBlock:
          "J'ai dirigé une migration de design system utilisée par 4 équipes produit.",
        employerValueBlock: [
          "Cette expérience est pertinente pour les interfaces produit.",
          genericClose,
        ].join(" "),
        closeLine: genericClose,
      },
    });

    expect(repaired.employerValueBlock).toBe(
      "Cette expérience est pertinente pour les interfaces produit.",
    );
    expect(repaired.employerValueBlock).not.toContain(genericClose);
    expect(repaired.closeLine).not.toBe(genericClose);
  });

  it("refills employer value when the duplicated close was its only sentence", () => {
    const genericClose = "Je serais ravi d'échanger sur le rôle.";
    const repaired = repairPremiumCoverLetterBodyParts({
      brief: buildDirectFrontendBrief("French"),
      bodyParts: {
        opening:
          "J'ai amélioré la conversion des inscriptions de 11 % grâce à des expérimentations d'interface.",
        proofBlock:
          "J'ai dirigé une migration de design system utilisée par 4 équipes produit.",
        employerValueBlock: genericClose,
        closeLine: genericClose,
      },
    });

    expect(repaired.employerValueBlock).toMatch(/^Dans .+, cette expérience apporte /u);
    expect(repaired.employerValueBlock).not.toContain(genericClose);
    expect(repaired.closeLine).not.toBe(genericClose);
  });

  it("removes a bare welcome clause after a grounded English close", () => {
    const repaired = repairPremiumCoverLetterBodyParts({
      brief: buildDirectFrontendBrief("English"),
      bodyParts: {
        opening: "I improved signup conversion by 11% through iterative UI experiments.",
        proofBlock: "I led a design-system migration used across 4 product squads.",
        employerValueBlock:
          "That evidence is relevant to customer-facing product work.",
        closeLine:
          "I bring the same design-system discipline and welcome the opportunity to discuss the role further.",
      },
    });

    expect(repaired.closeLine).toBe(
      "I bring the same design-system discipline.",
    );
  });

  it("preserves terminal closing quotes through active validation and repair", () => {
    const bodyParts = {
      opening:
        "I improved signup conversion by 11% through iterative UI experiments.",
      proofBlock: "The approach remained “reliable.”",
      employerValueBlock:
        "That experience supports dependable product-facing delivery.",
      closeLine:
        "I would bring the same discipline to reusable interface work.",
    };
    const brief = buildDirectFrontendBrief("English");

    expect(
      validatePremiumCoverLetterBodyParts({ bodyParts, brief }),
    ).not.toContainEqual(
      expect.objectContaining({ code: "incomplete_sentence" }),
    );
    expect(
      repairPremiumCoverLetterBodyParts({ bodyParts, brief }).proofBlock,
    ).toBe(bodyParts.proofBlock);
  });

  it("falls back to deterministic close repair when model quality repair fails", async () => {
    await withQualityRepairFlag("1", async () => {
      const calls: string[] = [];
      const genericClose = "I would welcome the opportunity to discuss the role further.";
      const result = await attemptPremiumCoverLetterGeneration({
        personalizationContext: directContext,
        voicePreset: "signature",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        candidateName: "Alex Martin",
        writer: async ({ prompt }) => {
          calls.push(prompt);
          if (calls.length === 1) {
            return buildDirectPremiumWriterOutputFixture({
              opening:
                "I improved signup conversion by 11% through iterative UI experiments.",
              proofBlock:
                "I led a design-system migration used across 4 product squads.",
              employerValueBlock:
                "That evidence is relevant to customer-facing product work.",
              closeLine: genericClose,
            });
          }
          return { notBodyParts: true };
        },
      });

      expect(calls).toHaveLength(2);
      expect(result?.qualityRepair).toMatchObject({
        enabled: true,
        attempted: true,
        outcome: "rejected_invalid_output",
      });
      expect(result?.bodyParts.closeLine).not.toBe(genericClose);
      expect(result?.bodyParts.closeLine).not.toMatch(/welcome.+discuss/iu);
      expect(result?.qualityShadow?.issues).not.toContain("generic_tone");
    });
  });

  it("fails unsupported generated numeric claims", () => {
    expect(
      directFrontendIssueCodesFor(
        "The design system migration reduced component duplication by 40%.",
      ),
    ).toContain("unsupported_numeric_claim");
    expect(
      adjacentOpsIssueCodesFor(
        "I restructured the intake form and cut misrouted tickets by 22% over three months.",
      ),
    ).toContain("unsupported_numeric_claim");
  });

  it("allows source-backed generated numeric claims", () => {
    expect(
      directFrontendIssueCodesFor(
        "The iterative UI experiments improved signup conversion by 11%.",
      ),
    ).not.toContain("unsupported_numeric_claim");
    expect(
      adjacentOpsIssueCodesFor(
        "I reduced backlog response times by 18%.",
      ),
    ).not.toContain("unsupported_numeric_claim");
    expect(
      directFrontendIssueCodesFor(
        "I led a design system migration used across 4 product squads.",
      ),
    ).not.toContain("unsupported_numeric_claim");
  });

  it("normalizes decimal commas without accepting a tenfold metric inflation", () => {
    const issueCodesFor = (sourceClaim: string, opening: string) => {
      const personalizationContext = {
        ...directContext,
        recentExperience: [
          {
            ...directContext.recentExperience[0],
            highlights: [
              sourceClaim,
              directContext.recentExperience[0].highlights[1],
            ],
          },
        ],
      };
      return validatePremiumCoverLetterBodyParts({
        brief: buildDirectFrontendBrief("English", personalizationContext),
        bodyParts: {
          opening,
          proofBlock:
            "I led a design system migration used across 4 product squads.",
          employerValueBlock:
            "I built experimentation dashboards used by product and growth teams.",
          closeLine:
            "I bring experience in React, TypeScript, design systems, and experimentation dashboards.",
        },
      }).map((issue) => issue.code);
    };
    const decimalSource =
      "Improved signup conversion by 11,5% after iterative UI experiments.";

    expect(
      issueCodesFor(
        decimalSource,
        "I improved signup conversion by 11.5% after iterative UI experiments.",
      ),
    ).not.toContain("unsupported_numeric_claim");
    expect(
      issueCodesFor(
        decimalSource,
        "I improved signup conversion by 115% after iterative UI experiments.",
      ),
    ).toContain("unsupported_numeric_claim");
    expect(
      issueCodesFor(
        "Supported 1,000 customers through onboarding.",
        "I supported 1000 customers through onboarding.",
      ),
    ).not.toContain("unsupported_numeric_claim");
  });

  it("allows source-backed ownership verbs", () => {
    expect(
      adjacentOpsIssueCodesFor(
        "I owned ticket triage, handoffs, and SLA reporting across support and product teams.",
      ),
    ).not.toContain("unsupported_ownership_verb");
    expect(
      directFrontendIssueCodesFor(
        "I led a design system migration used across 4 product squads.",
      ),
    ).not.toContain("unsupported_ownership_verb");
  });

  it("fails unsupported ownership verb upgrades", () => {
    expect(
      adjacentOpsIssueCodesFor(
        "I managed ticket triage, handoffs, and SLA reporting across support and product teams.",
      ),
    ).toContain("unsupported_ownership_verb");
    expect(
      directFrontendIssueCodesFor(
        "I owned the full delivery cycle from implementation to measurable user impact.",
      ),
    ).toContain("unsupported_ownership_verb");
  });

  it("downgrades unsupported ownership verbs for default writers without loosening validation", async () => {
    const failures: any[] = [];
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: directContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      onFailure: (trace) => {
        failures.push(trace);
      },
      writer: async () => ({
        opening:
          "I improved signup conversion by 11% after iterative UI experiments.",
        proofBlock:
          "I managed customer-facing frontend delivery and oversaw design-system quality across product surfaces.",
        employerValueBlock:
          "I built experimentation dashboards used by product and growth teams.",
        closeLine:
          "The strongest overlap is around React, TypeScript, design systems, and product-facing interface work.",
      }),
    });

    expect(failures).toHaveLength(0);
    expect(result).not.toBeNull();
    expect(result?.content).toContain(
      "I handled customer-facing frontend delivery and coordinated design-system quality across product surfaces.",
    );
    expect(result?.content).not.toContain("managed customer-facing");
    expect(result?.content).not.toContain("oversaw design-system");
    expect(
      directFrontendIssueCodesFor(
        "I managed customer-facing frontend delivery and oversaw design-system quality across product surfaces.",
      ),
    ).toContain("unsupported_ownership_verb");
  });

  it("does not downgrade possessive own into a broken ownership repair", () => {
    const allowedFactsPack = buildAllowedFactsPack({
      personalizationContext: directContext,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
    });
    const rankedEvidencePack = rankAllowedFacts({
      allowedFactsPack,
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      contextClass: "cv_direct",
    });
    const repaired = repairPremiumCoverLetterBodyParts({
      brief: buildPremiumCoverLetterBrief({
        preset: "signature",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        contextClass: "cv_direct",
        allowedFactsPack,
        rankedEvidencePack,
      }),
      bodyParts: {
        opening:
          "I improved signup conversion by 11% after iterative UI experiments.",
        proofBlock:
          "I built experimentation dashboards used by product and growth teams.",
        employerValueBlock:
          "That matters where team members need to stay focused on their own work.",
        closeLine:
          "I bring discipline around product-facing interface work.",
      },
    });

    expect(repaired.employerValueBlock).toContain("their own work");
    expect(repaired.employerValueBlock).not.toContain("their handle work");
    expect(
      directFrontendIssueCodesFor(
        "That matters where team members need to stay focused on their own work.",
      ),
    ).not.toContain("unsupported_ownership_verb");
  });

  it("rejects Qwen cv_direct body parts that upgrade source evidence into unsupported ownership", async () => {
    const failures: any[] = [];
    const result = await attemptDirectQwenLegacyBodyParts({
      onFailure: (trace) => {
        failures.push(trace);
      },
      bodyParts: {
        opening:
          "I improved signup conversion by 11% after iterative UI experiments.",
        proofBlock:
          "I managed customer-facing frontend delivery and oversaw design-system quality across product surfaces.",
        employerValueBlock:
          "I built experimentation dashboards used by product and growth teams.",
        closeLine:
          "The strongest overlap is around React, TypeScript, design systems, and product-facing interface work.",
      },
    });

    expect(result).toBeNull();
    expect(failures).toEqual([
      expect.objectContaining({
        stage: "validation",
        reason: "non_repairable_validation",
        issues: expect.arrayContaining(["unsupported_ownership_verb"]),
      }),
    ]);
  });

  it("rejects captured Qwen cv_direct wording that turns design-system evidence into outcome control", async () => {
    const failures: any[] = [];
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: directContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      writerProvider: "qwen",
      writerModel: "qwen3.7-max",
      onFailure: (trace) => {
        failures.push(trace);
      },
      writer: async () => ({
        opening:
          "My frontend engineering work centers on building and scaling design systems that drive interface consistency across multiple product teams.",
        proofBlock:
          "At Acme, I led a design system migration used across four product squads. This initiative improved release consistency across shared interface work, relying on close coordination with product teams to align component delivery with active development cycles.",
        employerValueBlock:
          "That background is relevant to frontend work where reusable systems, product iteration, and customer-facing surfaces matter. The overlap is strongest around design system quality, shared interface work, and cross-functional delivery.",
        closeLine:
          "I would welcome the chance to discuss how my background in design system migrations applies to your current frontend initiatives.",
      }),
    });

    expect(result).toBeNull();
    expect(failures).toEqual([
      expect.objectContaining({
        stage: "validation",
        reason: "non_repairable_validation",
        issues: expect.arrayContaining(["unsupported_ownership_verb"]),
      }),
    ]);
  });

  it("allows Qwen cv_direct body parts that stay source-backed and recruiter-readable", async () => {
    const failures: any[] = [];
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: directContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      writerProvider: "qwen",
      writerModel: "qwen3.7-max",
      onFailure: (trace) => {
        failures.push(trace);
      },
      writer: async () => ({
        opening:
          "I led a design-system migration used across product squads.",
        proofBlock:
          "I improved release consistency across shared interface work and built experimentation dashboards used by product and growth teams.",
        employerValueBlock:
          "The strongest overlap is around React, TypeScript, design systems, and product-facing interface work.",
        closeLine:
          "That experience is relevant to frontend work where reusable systems, product iteration, and customer-facing surfaces matter.",
      }),
    });

    expect(result).not.toBeNull();
    expect(failures).toHaveLength(0);
    expect(result?.content).toContain(
      "I led a design-system migration used across product squads.",
    );
    expect(result?.content).toContain(
      "I improved release consistency across shared interface work",
    );
    expect(result?.content).toContain(
      "built experimentation dashboards used by product and growth teams",
    );
  });

  it("applies employer-grounding enforcement to legacy-shaped Qwen output", async () => {
    const failures: any[] = [];
    const result = await attemptDirectQwenLegacyBodyParts({
      onFailure: (trace) => {
        failures.push(trace);
      },
      bodyParts: {
        opening:
          "I improved signup conversion by 11% after iterative UI experiments.",
        proofBlock:
          "I led a design-system migration used across four product squads.",
        employerValueBlock: "Delivery matters.",
        closeLine:
          "That experience is relevant to frontend work where reusable systems and product iteration matter.",
      },
    });

    expect(result).toBeNull();
    expect(failures).toEqual([
      expect.objectContaining({
        stage: "validation",
        reason: "non_repairable_validation",
        issues: expect.arrayContaining(["employer_value_not_grounded"]),
      }),
    ]);
  });

  it("blocks fragment issues in legacy-shaped Qwen output", async () => {
    const failures: any[] = [];
    const result = await attemptDirectQwenLegacyBodyParts({
      onFailure: (trace) => {
        failures.push(trace);
      },
      bodyParts: {
        opening:
          "I improved signup conversion by 11% after iterative UI experiments.",
        proofBlock:
          "Led a design-system migration used across four product squads.",
        employerValueBlock:
          "I built experimentation dashboards used by product and growth teams.",
        closeLine:
          "That experience is relevant to frontend work where reusable systems and product iteration matter.",
      },
    });

    expect(result).toBeNull();
    expect(failures).toEqual([
      expect.objectContaining({
        stage: "validation",
        reason: "non_repairable_validation",
        issues: expect.arrayContaining(["incomplete_sentence"]),
      }),
    ]);
  });

  it("reports writer-output validation before invoking model repair", async () => {
    const events: string[] = [];
    const onModelRepairRequired = vi.fn();
    let writerCallCount = 0;
    const validBodyParts = {
      opening:
        "I improved signup conversion by 11% after iterative UI experiments.",
      proofBlock:
        "I led a design system migration used across 4 product squads.",
      employerValueBlock:
        "That work is relevant to customer-facing React and TypeScript delivery.",
      closeLine:
        "I bring grounded frontend evidence around experimentation, reusable systems, and product-facing interfaces.",
    };

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: directContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      onModelRepairRequired: (diagnostic) => {
        events.push(`repair:${diagnostic.stage}`);
        onModelRepairRequired(diagnostic);
      },
      writer: async ({ prompt }) => {
        writerCallCount += 1;
        events.push(`writer:${writerCallCount}`);
        if (writerCallCount === 2) {
          expect(prompt).toContain(
            "Repair PremiumWriterOutputV1 without changing claim strategy.",
          );
        }
        return buildDirectPremiumWriterOutputFixture({
          ...validBodyParts,
          opening:
            writerCallCount === 1
              ? ""
              : validBodyParts.opening,
        });
      },
    });

    expect(events).toEqual([
      "writer:1",
      "repair:writer_output_validation",
      "writer:2",
    ]);
    expect(onModelRepairRequired).toHaveBeenCalledOnce();
    expect(onModelRepairRequired).toHaveBeenCalledWith({
      stage: "writer_output_validation",
      issues: expect.arrayContaining(["empty_section"]),
    });
    expect(result).not.toBeNull();
  });

  it("rejects visible duplication through the active English CV-backed quality gate", async () => {
    const failures: any[] = [];
    const duplicateSentence =
      "I bring grounded frontend delivery experience.";
    const writer = vi.fn(async () =>
      buildDirectPremiumWriterOutputFixture({
        opening: duplicateSentence,
        proofBlock: duplicateSentence,
        employerValueBlock:
          "That experimentation experience supports product-facing delivery.",
        closeLine:
          "I would bring reusable-system discipline to the frontend team.",
      }),
    );

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: directContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      onFailure: (trace) => {
        failures.push(trace);
      },
      writer,
    });

    expect(writer).toHaveBeenCalledOnce();
    expect(result).toBeNull();
    expect(failures).toEqual([
      expect.objectContaining({
        stage: "validation",
        reason: "non_repairable_validation",
        issues: expect.arrayContaining(["duplicate_visible_sentence"]),
      }),
    ]);
  });

  it("rejects an ungrounded employer-value block through the active English CV-backed quality gate", async () => {
    const failures: any[] = [];
    const writer = vi.fn(async () =>
      buildDirectPremiumWriterOutputFixture({
        opening:
          "I improved signup conversion by 11% after iterative UI experiments.",
        proofBlock:
          "I led a design system migration used across 4 product squads.",
        employerValueBlock: "I bring strong skills.",
        closeLine:
          "I would bring reusable-system discipline to the frontend team.",
      }),
    );

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: directContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      onFailure: (trace) => {
        failures.push(trace);
      },
      writer,
    });

    expect(writer).toHaveBeenCalledOnce();
    expect(result).toBeNull();
    expect(failures).toEqual([
      expect.objectContaining({
        stage: "validation",
        reason: "non_repairable_validation",
        issues: expect.arrayContaining(["employer_value_not_grounded"]),
      }),
    ]);
  });

  it("retries Mistral once on adjacent_direct_fit and accepts repaired cv_adjacent output", async () => {
    const calls: string[] = [];
    const onModelRepairRequired = vi.fn();
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: adjacentContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      candidateName: "Camille Bernard",
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
      onModelRepairRequired,
      writer: async ({ prompt }) => {
        calls.push(prompt);
        if (calls.length === 1) {
          return {
            opening:
              "This experience translates into the ability to support general office operations with clear records, timely communication, and reliable follow-up.",
            proofBlock:
              "For an Administrative Coordinator, these skills help with general office support, vendor communication, and schedule management.",
            employerValueBlock:
              "This experience has given me a strong foundation in managing vendor communication and general office support, which are key responsibilities for this role.",
            closeLine:
              "I bring the same focus on coordination, documentation, and communication to support smooth office operations.",
          };
        }
        return {
          opening:
            "I coordinated workflows, documented procedures, tracked deadlines, and handled vendor correspondence.",
          proofBlock:
            "I maintained clear records and scheduling follow-through for cross-functional projects.",
          employerValueBlock:
            "I documented process notes, tracked open items, and maintained vendor correspondence records.",
          closeLine:
            "I bring experience in coordination, documentation, scheduling, vendor correspondence, and stakeholder communication.",
        };
      },
    });

    expect(calls).toHaveLength(2);
    expect(onModelRepairRequired).toHaveBeenCalledOnce();
    expect(onModelRepairRequired).toHaveBeenCalledWith({
      stage: "body_parts_validation",
      issues: expect.arrayContaining(["adjacent_direct_fit"]),
    });
    expect(calls[1]).toContain(
      "Rewrite the cover-letter body parts to satisfy validation.",
    );
    expect(calls[1]).toContain(
      "adjacent role-mapping, future-impact language, meta-commentary, unsupported ownership verbs, or unsupported outcome claims",
    );
    expect(result).not.toBeNull();
    expect(result?.content).toContain(
      "I coordinated workflows, documented procedures, tracked deadlines, and handled vendor correspondence.",
    );
    expect(result?.content).toContain(
      "I bring experience in coordination, documentation, scheduling, vendor correspondence, and stakeholder communication.",
    );
  });

  it("downgrades unsupported Mistral ownership verbs before retrying cv_direct output", async () => {
    const calls: string[] = [];
    const failures: any[] = [];
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: directContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      writerProvider: "mistral",
      writerModel: "mistral-large-latest",
      onFailure: (trace) => {
        failures.push(trace);
      },
      writer: async ({ prompt }) => {
        calls.push(prompt);
        return {
          opening:
            "I improved signup conversion by 11% after iterative UI experiments.",
          proofBlock:
            "I managed customer-facing frontend delivery and oversaw design-system quality across product surfaces.",
          employerValueBlock:
            "I built experimentation dashboards used by product and growth teams.",
          closeLine:
            "The strongest overlap is around React, TypeScript, design systems, and product-facing interface work.",
        };
      },
    });

    expect(calls).toHaveLength(1);
    expect(failures).toHaveLength(0);
    expect(result).not.toBeNull();
    expect(result?.content).toContain(
      "I handled customer-facing frontend delivery and coordinated design-system quality across product surfaces.",
    );
    expect(result?.content).not.toContain("managed customer-facing");
    expect(result?.content).not.toContain("oversaw design-system");
  });

  it("retries adjacent_direct_fit repair for GPT/default and Qwen", async () => {
    const unsafeBodyParts = {
      opening:
        "I coordinated workflows, documented procedures, tracked deadlines, handled vendor correspondence, and communicated updates across teams.",
      proofBlock:
        "I maintained clear records and scheduling follow-through for cross-functional projects.",
      employerValueBlock:
        "This experience translates into the ability to support general office operations with clear records, timely communication, and reliable follow-up.",
      closeLine:
        "I bring experience in coordination, documentation, scheduling, vendor correspondence, and stakeholder communication.",
    };

    const safeBodyParts = {
      opening:
        "I coordinated workflows, documented procedures, tracked deadlines, handled vendor correspondence, and communicated updates across teams.",
      proofBlock:
        "I maintained clear records and scheduling follow-through for cross-functional projects.",
      employerValueBlock:
        "The overlap is strongest around reporting, handoffs, and process documentation.",
      closeLine:
        "I bring experience in coordination, documentation, scheduling, vendor correspondence, and stakeholder communication.",
    };

    const baseArgs = {
      personalizationContext: adjacentContext,
      voicePreset: "signature" as const,
      outputLanguage: "English" as const,
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      candidateName: "Camille Bernard",
      writer: async () => unsafeBodyParts,
    };

    const gptCalls: string[] = [];
    const gptResult = await attemptPremiumCoverLetterGeneration({
      ...baseArgs,
      writerProvider: "openai",
      writerModel: "gpt-5.5",
      writer: async ({ prompt }) => {
        gptCalls.push(prompt);
        return gptCalls.length === 1 ? unsafeBodyParts : safeBodyParts;
      },
    });
    const qwenCalls: string[] = [];
    const qwenResult = await attemptPremiumCoverLetterGeneration({
      ...baseArgs,
      writerProvider: "qwen",
      writerModel: "qwen3.7-max",
      writer: async ({ prompt }) => {
        qwenCalls.push(prompt);
        return qwenCalls.length === 1 ? unsafeBodyParts : safeBodyParts;
      },
    });

    expect(gptCalls).toHaveLength(1);
    expect(qwenCalls).toHaveLength(2);
    expect(qwenCalls[1]).toContain(
      "Rewrite the cover-letter body parts to satisfy validation.",
    );
    expect(gptResult).not.toBeNull();
    expect(qwenResult).not.toBeNull();
  });

  it("keeps Qwen adjacent validation strict while allowing a safe one-bridge replacement", async () => {
    const unsafeFailure: any[] = [];
    const unsafeResult = await attemptPremiumCoverLetterGeneration({
      personalizationContext: adjacentContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      candidateName: "Camille Bernard",
      writerProvider: "qwen",
      writerModel: "qwen3.7-max",
      onFailure: (trace) => {
        unsafeFailure.push(trace);
      },
      writer: async () => ({
        opening:
          "I coordinated onboarding handoffs and documented rollout workflows across customers and internal teams.",
        proofBlock:
          "I tracked open issues between customers and internal teams and kept the handoff notes current.",
        employerValueBlock:
          "My experience coordinating onboarding handoffs, managing rollout notes, and tracking issues between customers and internal teams aligns directly with your goal to improve rollout planning and cross-functional coordination.",
        closeLine:
          "I bring experience in coordination, documentation, scheduling, vendor correspondence, and stakeholder communication.",
      }),
    });

    const safeFailure: any[] = [];
    const safeResult = await attemptPremiumCoverLetterGeneration({
      personalizationContext: adjacentContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      candidateName: "Camille Bernard",
      writerProvider: "qwen",
      writerModel: "qwen3.7-max",
      onFailure: (trace) => {
        safeFailure.push(trace);
      },
      writer: async () => ({
        opening:
          "I coordinated onboarding handoffs and documented rollout workflows across customers and internal teams.",
        proofBlock:
          "I tracked open issues between customers and internal teams and kept the handoff notes current.",
        employerValueBlock:
          "The overlap is strongest around onboarding handoffs, rollout documentation, and feedback tracking.",
        closeLine:
          "I bring experience in coordination, documentation, scheduling, issue tracking, and stakeholder communication.",
      }),
    });

    expect(unsafeResult).toBeNull();
    expect(unsafeFailure).toEqual([
      expect.objectContaining({
        stage: "validation",
        reason: "repair_failed_validation",
        issues: expect.arrayContaining(["adjacent_direct_fit"]),
      }),
    ]);
    expect(safeResult).not.toBeNull();
    expect(safeResult?.content).toContain(
      "I coordinated onboarding handoffs and documented rollout workflows across customers and internal teams.",
    );
    expect(safeResult?.content).toContain(
      "The overlap is strongest around onboarding handoffs, rollout documentation, and feedback tracking.",
    );
    expect(safeFailure).toHaveLength(0);
  });

  it("keeps Qwen adjacent ownership validation strict while allowing lower-ownership wording", async () => {
    const qwenAdjacentContext = {
      name: "Maya Chen",
      summary:
        "Customer success specialist coordinating onboarding handoffs, rollout notes, and issue tracking between customers and internal teams.",
      topSkills: [
        "Customer onboarding",
        "Workflow documentation",
        "Issue tracking",
        "Stakeholder coordination",
      ],
      recentExperience: [
        {
          company: "CareBridge Systems",
          position: "Customer Success Specialist",
          highlights: [
            "Documented rollout workflows for recurring onboarding handoffs.",
            "Tracked open issues between customers and internal teams.",
            "Synthesized customer feedback into notes for support and implementation teams.",
          ],
        },
      ],
      standoutAchievements: [
        "Documented rollout workflows for recurring onboarding handoffs.",
      ],
    };
    const qwenAdjacentJob = {
      jobTitle: "Product Operations Associate",
      jobDescription:
        "The company is hiring a Product Operations Associate to improve rollout planning, internal documentation, customer feedback loops, and cross-functional coordination. The role values operational process hygiene, clear handoffs, and practical support for teams working across customers and internal stakeholders.",
    };

    const unsafeFailure: any[] = [];
    const unsafeResult = await attemptPremiumCoverLetterGeneration({
      personalizationContext: qwenAdjacentContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: qwenAdjacentJob.jobTitle,
      jobDescription: qwenAdjacentJob.jobDescription,
      candidateName: "Maya Chen",
      writerProvider: "qwen",
      writerModel: "qwen3.7-max",
      onFailure: (trace) => {
        unsafeFailure.push(trace);
      },
      writer: async () => ({
        opening:
          "I documented recurring onboarding handoffs and kept rollout notes current for internal teams.",
        proofBlock:
          "I tracked customer issues and shared updates between customer-facing and internal teams.",
        employerValueBlock:
          "I managed rollout notes and resolved customer-facing friction across internal teams.",
        closeLine:
          "I bring experience in documentation, issue tracking, handoffs, and customer-facing updates.",
      }),
    });

    const safeFailure: any[] = [];
    const safeResult = await attemptPremiumCoverLetterGeneration({
      personalizationContext: qwenAdjacentContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: qwenAdjacentJob.jobTitle,
      jobDescription: qwenAdjacentJob.jobDescription,
      candidateName: "Maya Chen",
      writerProvider: "qwen",
      writerModel: "qwen3.7-max",
      onFailure: (trace) => {
        safeFailure.push(trace);
      },
      writer: async () => ({
        opening:
          "I documented recurring onboarding handoffs and kept rollout notes current for internal teams.",
        proofBlock:
          "I tracked customer issues and shared updates between customer-facing and internal teams.",
        employerValueBlock:
          "The overlap is strongest around documented handoffs, rollout notes, and feedback tracking.",
        closeLine:
          "I bring experience in documentation, issue tracking, handoffs, and customer-facing updates.",
      }),
    });

    expect(unsafeResult).toBeNull();
    expect(unsafeFailure).toEqual([
      expect.objectContaining({
        stage: "validation",
        reason: "non_repairable_validation",
        issues: expect.arrayContaining(["unsupported_ownership_verb"]),
      }),
    ]);
    expect(safeResult).not.toBeNull();
    expect(safeResult?.content).toContain(
      "I documented recurring onboarding handoffs and kept rollout notes current for internal teams.",
    );
    expect(safeResult?.content).toContain(
      "The overlap is strongest around documented handoffs, rollout notes, and feedback tracking.",
    );
    expect(safeFailure).toHaveLength(0);
  });

  it("does not overwrite valid adjacent writer output with the evidence-order normalizer", async () => {
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: {
        name: "Robert Cooper",
        summary:
          "Safety conscious, attentive Security Guard with eight years experience protecting VIP individuals in military and defense sectors, presently finishing a bachelor's in criminal justice and qualified as a CPO.",
        topSkills: [
          "Investigation skills",
          "Safety compliance",
          "Criminal justice knowledge",
          "Restraining devices",
        ],
        recentExperience: [
          {
            company: "ADT Security",
            position: "Security Guard",
            highlights: [
              "Supported equipment readiness through preventive maintenance, manufacturer instructions, troubleshooting, and repair coordination.",
              "Completed reports by recording information, observations, occurrences, surveillance activities, interviewing witnesses, and acquiring signatures.",
              "Maintained environments by monitoring grounds and equipment controls.",
            ],
          },
          {
            company: "Copwatch",
            position: "Security Guard",
            highlights: [
              "Monitored selected areas via CCTV app on smart devices.",
              "Inspected restrooms after closing time for vagrants or unauthorized personnel.",
            ],
          },
        ],
      },
      voicePreset: "engaging",
      outputLanguage: "English",
      jobTitle: "High Level Security Officer",
      jobDescription:
        "Securitas Security is hiring a High Level Security Officer to maintain site safety through structured patrols, access control, incident response, detailed reporting, professional communication, and escalation to the operations center.",
      candidateName: "Robert Cooper",
      writer: async () => ({
        opening:
          "I supported equipment readiness through preventive maintenance, manufacturer instructions, troubleshooting, and repair coordination.",
        proofBlock:
          "I maintained environments by monitoring grounds and equipment controls. I monitored selected areas via CCTV app on smart devices. I completed reports by recording information, observations, occurrences, surveillance activities, interviewing witnesses, and acquiring signatures.",
        employerValueBlock:
          "I inspected restrooms after closing time for vagrants or unauthorized personnel.",
        closeLine:
          "I bring discipline around careful observation, accurate records, and clear handoffs.",
      }),
    });

    expect(result?.content).toContain(
      "I supported equipment readiness through preventive maintenance, manufacturer instructions, troubleshooting, and repair coordination.",
    );
    expect(result?.content).toContain(
      "I maintained environments by monitoring grounds and equipment controls.",
    );
    expect(result?.content).not.toContain(
      "Across eight years protecting VIP individuals in military and defense sectors",
    );
  });

  it("repairs low-value direct employer-value echo without dropping security evidence", async () => {
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: {
        name: "Robert Cooper",
        summary:
          "Safety conscious, attentive Security Guard with eight years experience protecting VIP individuals in military and defense sectors.",
        topSkills: [
          "Investigation skills",
          "Safety compliance",
          "Criminal justice knowledge",
        ],
        recentExperience: [
          {
            company: "ADT Security",
            position: "Security Guard",
            highlights: [
              "Completed reports by recording information, observations, occurrences, and surveillance activity.",
              "Maintained environments by monitoring grounds and equipment controls.",
            ],
          },
          {
            company: "Copwatch",
            position: "Security Guard",
            highlights: ["Monitored selected areas via CCTV app on smart devices."],
          },
        ],
      },
      voicePreset: "engaging",
      outputLanguage: "English",
      jobTitle: "High Level Security Officer",
      jobDescription:
        "Securitas Security is hiring a High Level Security Officer to maintain site safety through structured patrols, access control, incident response, detailed reporting, professional communication, and escalation to the operations center. The company offers Region and Area Management Support Staff to guide growth and advancement.",
      candidateName: "Robert Cooper",
      writer: async () => ({
        opening:
          "In security work, careful reporting matters because it gives the next person a clear record to act on.",
        proofBlock:
          "At ADT Security, I completed reports by recording information, observations, occurrences, and surveillance activity.",
        employerValueBlock:
          "For Securitas Security, that means a High Level Security Officer who is used to staying attentive, documenting what happens, and supporting the kind of clear communication that helps Region and Area Management Support Staff guide growth and advancement effectively.",
        closeLine:
          "I bring discipline around accurate records, steady monitoring, and clear communication.",
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.content).toContain("At ADT Security");
    expect(result?.bodyParts.employerValueBlock).toMatch(
      /In .* work, that kind of background supports/i,
    );
    expect(result?.bodyParts.employerValueBlock).not.toContain(
      "Region and Area Management Support Staff",
    );
    expect(result?.bodyParts.employerValueBlock).not.toContain(
      "growth and advancement",
    );
    expect(result?.qualityShadow?.issues ?? []).not.toContain(
      "low_value_job_echo",
    );
  });

  it("repairs weak Mistral adjacent bridge and detached close without replacing evidence", async () => {
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: adjacentMonitoringContext,
      voicePreset: "engaging",
      outputLanguage: "English",
      jobTitle: adjacentMonitoringJob.jobTitle,
      jobDescription: adjacentMonitoringJob.jobDescription,
      candidateName: "Robert Cooper",
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
      writer: async () => ({
        opening:
          "For eight years I completed reports by recording observations, occurrences, and witness statements while monitoring grounds and CCTV feeds.",
        proofBlock:
          "Reports included field notes, surveillance logs from CCTV monitoring via mobile app, and signed witness statements. I monitored selected areas via CCTV app on smart devices and scanned grounds for suspicious items.",
        employerValueBlock:
          "Surveillance activities used smart-device CCTV apps to track selected areas.",
        closeLine:
          "Experience includes eight years of surveillance documentation and CCTV monitoring.",
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.bodyParts.opening).toMatch(
      /As a security guard at .*for eight years I completed reports/i,
    );
    expect(result?.bodyParts.proofBlock).toContain("Reports included field notes");
    expect(result?.bodyParts.employerValueBlock).toContain(
      "Surveillance activities used smart-device CCTV apps",
    );
    expect(result?.bodyParts.closeLine).toMatch(/^I bring discipline around/i);
  });

  it("does not accept a Mistral adjacent repair unless second validation passes", async () => {
    const calls: string[] = [];
    let failure: any = null;
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: adjacentContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      candidateName: "Camille Bernard",
      writerProvider: "mistral",
      writerModel: "mistral-large-latest",
      onFailure: (trace) => {
        failure = trace;
      },
      writer: async ({ prompt }) => {
        calls.push(prompt);
        return {
          opening:
            "This experience translates into the ability to support general office operations with clear records, timely communication, and reliable follow-up.",
          proofBlock:
            "For an Administrative Coordinator, these skills help with general office support, vendor communication, and schedule management.",
          employerValueBlock:
            "This experience has given me a strong foundation in managing vendor communication and general office support, which are key responsibilities for this role.",
          closeLine:
            "I bring the same focus on coordination, documentation, and communication to support smooth office operations.",
        };
      },
    });

    expect(calls).toHaveLength(2);
    expect(result).toBeNull();
    expect(failure).toMatchObject({
      stage: "validation",
      reason: "repair_failed_validation",
      issues: expect.arrayContaining(["adjacent_direct_fit"]),
    });
  });

  it("runs a mocked employment-strong-frontend premium smoke without fixture-opening reuse", async () => {
    let capturedPrompt = "";
    let capturedSchema: Record<string, unknown> | null = null;
    const bodyParts = {
      opening:
        "At BrightLayer, I led a design-system migration used across four product squads and reduced page-load time by 28 percent through bundle and rendering improvements.",
      proofBlock:
        "At Northline Labs, I built experimentation dashboards for product and growth teams and partnered directly with design on customer-facing workflow improvements; targeted UI experiments improved signup conversion by 11 percent.",
      employerValueBlock:
        "That experience maps cleanly to frontend work where reusable systems, performance, and product iteration matter together, with React and TypeScript as the base.",
      closeLine:
        "I would bring that same discipline to shipped interface work, reliable performance, and clean partnership with product and design.",
    };

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: {
        name: "Alex Martin",
        summary:
          "Frontend engineer focused on React, TypeScript, design systems, and product-facing web apps.",
        desiredPosition: "Senior Frontend Engineer",
        topSkills: [
          "React",
          "TypeScript",
          "Design Systems",
          "Performance Optimization",
          "A/B Testing",
        ],
        recentExperience: [
          {
            company: "BrightLayer",
            position: "Frontend Engineer",
            highlights: [
              "Led a design system migration used across 4 product squads.",
              "Reduced page load time by 28 percent through bundle and rendering optimizations.",
            ],
          },
          {
            company: "Northline Labs",
            position: "Product Engineer",
            highlights: [
              "Built experimentation dashboards used by product and growth teams.",
              "Partnered directly with design on customer-facing workflow improvements.",
            ],
          },
        ],
        standoutAchievements: [
          "Improved signup conversion by 11 percent after iterative UI experiments.",
        ],
      },
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Lead React and TypeScript development for a customer-facing SaaS platform, build reusable UI systems, improve performance, collaborate with product and design, and use experimentation carefully.",
      candidateName: "Alex Martin",
      writer: async ({ prompt, schema }) => {
        capturedPrompt = prompt;
        capturedSchema = schema;
        return bodyParts;
      },
    });

    expect(result).not.toBeNull();
    expect(capturedSchema).toEqual(PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA);
    expect(capturedPrompt).toContain("already resolved into ClaimPlan");
    expect(capturedPrompt).toContain("Structured brief:");
    expect(capturedPrompt).toContain(
      "A JD keyword, tool, certification, compliance framework, domain, or responsibility may appear as candidate experience only when the CV supports that exact capability",
    );
    expect(capturedPrompt).toContain(
      "Bind ATS terms to a concrete action or result; never list them",
    );
    expect(capturedPrompt).toContain(
      "Bind ATS and JD terms to a concrete CV-backed action, artifact, responsibility, or result",
    );
    expect(capturedPrompt).toContain("clipped fragments like 'St.'");
    expect(capturedPrompt).toContain(
      "Avoid clunky inanimate-object phrasing and evaluator/meta phrases like 'the evidence I would bring'",
    );
    expect(capturedPrompt).toContain(
      "Avoid clunky inanimate-object phrasing and evaluator/meta phrases like 'the evidence I would bring'",
    );
    expect(result?.bodyParts).toEqual(bodyParts);
    expect(result?.content).toContain("Dear Hiring Manager,");
    expect(result?.content).toContain("design-system migration used across four product squads");
    expect(result?.content).toContain("page-load time by 28 percent");
    expect(result?.content).toContain("React and TypeScript");
    expect(result?.content).toContain("partnered directly with design");
    expect(result?.content).toContain("experimentation dashboards");
    expect(result?.content).toContain("targeted UI experiments improved signup conversion by 11 percent");
    expect(result?.content).toContain(
      "That experience maps cleanly to frontend work where reusable systems, performance, and product iteration matter together",
    );
    expect(result?.content).toContain("signup conversion by 11 percent");
    expect(result?.content).not.toContain("Your frontend role sits where");
    expect(result?.content).not.toMatch(
      /helped targeted UI experiments improve|evidence I would bring/i,
    );
    expect(result?.content).not.toMatch(/mentoring|people management|backend|mobile/i);
    expect(result?.content).not.toMatch(
      /I am excited to apply|I am writing to express my interest|My background aligns/i,
    );
  });

  it("wraps nested legacy bodyParts returned by Mistral-compatible writers", async () => {
    const bodyParts = {
      opening:
        "At BrightLayer, I led a design-system migration used across four product squads and reduced page-load time by 28 percent through bundle and rendering improvements.",
      proofBlock:
        "At Northline Labs, I built experimentation dashboards for product and growth teams and partnered directly with design on customer-facing workflow improvements; targeted UI experiments improved signup conversion by 11 percent.",
      employerValueBlock:
        "That experience maps cleanly to frontend work where reusable systems, performance, and product iteration matter together, with React and TypeScript as the base.",
      closeLine:
        "I would bring that same discipline to shipped interface work, reliable performance, and clean partnership with product and design.",
    };

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: {
        name: "Alex Martin",
        summary:
          "Frontend engineer focused on React, TypeScript, design systems, and product-facing web apps.",
        desiredPosition: "Senior Frontend Engineer",
        topSkills: [
          "React",
          "TypeScript",
          "Design Systems",
          "Performance Optimization",
          "A/B Testing",
        ],
        recentExperience: [
          {
            company: "BrightLayer",
            position: "Frontend Engineer",
            highlights: [
              "Led a design system migration used across 4 product squads.",
              "Reduced page load time by 28 percent through bundle and rendering optimizations.",
            ],
          },
          {
            company: "Northline Labs",
            position: "Product Engineer",
            highlights: [
              "Built experimentation dashboards used by product and growth teams.",
              "Partnered directly with design on customer-facing workflow improvements.",
            ],
          },
        ],
        standoutAchievements: [
          "Improved signup conversion by 11 percent after iterative UI experiments.",
        ],
      },
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Lead React and TypeScript development for a customer-facing SaaS platform, build reusable UI systems, improve performance, collaborate with product and design, and use experimentation carefully.",
      candidateName: "Alex Martin",
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
      writer: async () => ({
        version: "legacy_body_parts_v1",
        bodyParts,
      }),
    });

    expect(result?.bodyParts).toEqual(bodyParts);
    expect(result?.content).toContain("Dear Hiring Manager,");
    expect(result?.content).toContain("signup conversion by 11 percent");
    expect(result?.content).not.toContain("Warm regards");
  });

  it("validates wrapped legacy bodyParts with the same provenance guardrails", async () => {
    let failure: any = null;

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: {
        name: "Alex Martin",
        summary:
          "Frontend engineer focused on React, TypeScript, performance tuning, and customer-facing web apps.",
        desiredPosition: "Senior Frontend Engineer",
        topSkills: ["React", "TypeScript", "Performance Optimization"],
        recentExperience: [
          {
            company: "BrightLayer",
            position: "Frontend Engineer",
            highlights: [
              "Reduced page load time by 28 percent through bundle and rendering optimizations.",
              "Partnered directly with design on customer-facing workflow improvements.",
            ],
          },
        ],
      },
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Built reusable UI systems and improved shared component workflows.",
      candidateName: "Alex Martin",
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
      onFailure: (trace) => {
        failure = trace;
      },
      writer: async () => ({
        version: "legacy_body_parts_v1",
        bodyParts: {
          opening:
            "I reduced page load time by 28 percent through bundle and rendering optimizations.",
          proofBlock:
            "I reduced page load time by 28 percent through bundle and rendering optimizations.",
          employerValueBlock:
            "I built reusable UI systems and improved shared component workflows.",
          closeLine:
            "I bring discipline around reliable interfaces and clean product collaboration.",
        },
      }),
    });

    expect(result).toBeNull();
    expect(failure).toMatchObject({
      stage: "validation",
      reason: "non_repairable_validation",
      issues: expect.arrayContaining(["job_demand_as_candidate_experience"]),
    });
  });

  it("still fails writer meta prose when repair returns invalid provenance", async () => {
    let failure: any = null;

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: {
        name: "Alex Martin",
        summary:
          "Frontend engineer focused on React, TypeScript, design systems, and product-facing web apps.",
        desiredPosition: "Senior Frontend Engineer",
        topSkills: ["React", "TypeScript", "Design Systems"],
        recentExperience: [
          {
            company: "BrightLayer",
            position: "Frontend Engineer",
            highlights: [
              "Led a design system migration used across 4 product squads.",
              "Reduced page load time by 28 percent through bundle and rendering optimizations.",
            ],
          },
        ],
      },
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Lead React and TypeScript development for a customer-facing SaaS platform, build reusable UI systems, improve performance, and collaborate with product and design.",
      candidateName: "Alex Martin",
      onFailure: (trace) => {
        failure = trace;
      },
      writer: async () => ({
        version: "premium_writer_output_v1",
        bodyParts: {
          opening: {
            section: "opening",
            text: "I have described my design-system migration and performance work in relation to the role.",
            claimIds: ["claim_opening_001"],
            factIds: ["fact_experience_001_highlight_001"],
            demandIds: [],
          },
          proofBlock: {
            section: "proofBlock",
            text: "I reduced page load time by 28 percent through bundle and rendering optimizations.",
            claimIds: ["claim_proof_001"],
            factIds: ["fact_experience_001_highlight_002"],
            demandIds: [],
          },
          employerValueBlock: {
            section: "employerValueBlock",
            text: "That work is relevant to frontend environments where reusable systems and performance matter.",
            claimIds: ["claim_employer_value_001"],
            factIds: ["fact_experience_001_highlight_001"],
            demandIds: [],
          },
          closeLine: {
            section: "closeLine",
            text: "I bring discipline around reliable interfaces and clean collaboration.",
            claimIds: ["claim_close_001"],
            factIds: ["fact_experience_001_highlight_001"],
            demandIds: [],
          },
        },
      }),
    });

    expect(result).toBeNull();
    expect(failure).toMatchObject({
      stage: "validation",
      reason: "non_repairable_validation",
      issues: expect.arrayContaining(["section_fact_not_allowed"]),
    });
  });

  it("rejects Mistral provider-local fact ids instead of assigning planned facts", async () => {
    let failure: any = null;

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: {
        name: "Alex Martin",
        summary:
          "Frontend engineer focused on React, TypeScript, design systems, and product-facing web apps.",
        desiredPosition: "Senior Frontend Engineer",
        topSkills: ["React", "TypeScript", "Design Systems"],
        recentExperience: [
          {
            company: "BrightLayer",
            position: "Frontend Engineer",
            highlights: [
              "Led a design system migration used across 4 product squads.",
              "Reduced page load time by 28 percent through bundle and rendering optimizations.",
            ],
          },
        ],
      },
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Lead React and TypeScript development for a customer-facing SaaS platform, build reusable UI systems, improve performance, and collaborate with product and design.",
      candidateName: "Alex Martin",
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
      onFailure: (trace) => {
        failure = trace;
      },
      writer: async () => ({
        version: "premium_writer_output_v1",
        bodyParts: {
          opening: {
            section: "opening",
            text: "I have led design-system work across product squads in React and TypeScript environments.",
            claimIds: ["mistral_claim_opening"],
            factIds: ["mistral_fact_opening"],
            demandIds: ["mistral_demand_opening"],
          },
          proofBlock: {
            section: "proofBlock",
            text: "I reduced page load time by 28 percent through bundle and rendering optimizations.",
            claimIds: ["mistral_claim_proof"],
            factIds: ["mistral_fact_proof"],
            demandIds: ["mistral_demand_proof"],
          },
          employerValueBlock: {
            section: "employerValueBlock",
            text: "That background is relevant to teams building reusable UI systems where performance, collaboration, and product-facing quality matter.",
            claimIds: ["mistral_claim_employer_value"],
            factIds: ["fact_experience_001_highlight_001"],
            demandIds: ["mistral_demand_employer_value"],
          },
          closeLine: {
            section: "closeLine",
            text: "I bring discipline around reliable interfaces, reusable systems, and clean product collaboration.",
            claimIds: ["mistral_claim_close"],
            factIds: ["fact_experience_001_highlight_001"],
            demandIds: ["mistral_demand_close"],
          },
        },
      }),
    });

    expect(result).toBeNull();
    expect(failure).toMatchObject({
      stage: "validation",
      reason: "non_repairable_validation",
      issues: expect.arrayContaining(["unknown_fact_id"]),
    });
  });

  it("does not relabel a known opening fact as an allowed Mistral proof fact", async () => {
    let failure: any = null;

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: {
        name: "Alex Martin",
        summary:
          "Frontend engineer focused on React, TypeScript, design systems, and product-facing web apps.",
        desiredPosition: "Senior Frontend Engineer",
        topSkills: ["React", "TypeScript", "Design Systems"],
        recentExperience: [
          {
            company: "BrightLayer",
            position: "Frontend Engineer",
            highlights: [
              "Led a design system migration used across 4 product squads.",
              "Reduced page load time by 28 percent through bundle and rendering optimizations.",
            ],
          },
        ],
      },
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Lead React and TypeScript development for a customer-facing SaaS platform, build reusable UI systems, improve performance, and collaborate with product and design.",
      candidateName: "Alex Martin",
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
      onFailure: (trace) => {
        failure = trace;
      },
      writer: async () => ({
        version: "premium_writer_output_v1",
        bodyParts: {
          opening: {
            section: "opening",
            text: "I led a design system migration used across 4 product squads.",
            claimIds: ["claim_opening_001"],
            factIds: ["fact_experience_001_highlight_001"],
            demandIds: [],
          },
          proofBlock: {
            section: "proofBlock",
            text: "I led a design system migration used across 4 product squads.",
            claimIds: ["claim_proof_001"],
            factIds: ["fact_experience_001_highlight_001"],
            demandIds: [],
          },
          employerValueBlock: {
            section: "employerValueBlock",
            text: "That experience supports reusable UI work across product teams.",
            claimIds: ["claim_employer_value_001"],
            factIds: ["fact_experience_001_highlight_001"],
            demandIds: ["demand_core_001"],
          },
          closeLine: {
            section: "closeLine",
            text: "I would bring disciplined interface delivery and product collaboration.",
            claimIds: ["claim_close_001"],
            factIds: ["fact_experience_001_highlight_001"],
            demandIds: [],
          },
        },
      }),
    });

    expect(result).toBeNull();
    expect(failure).toMatchObject({
      stage: "validation",
      reason: "non_repairable_validation",
      issues: expect.arrayContaining(["section_fact_not_allowed"]),
    });
  });

  it("does not relabel unknown Mistral proof ids without section-level evidence", async () => {
    let failure: any = null;

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: {
        name: "Alex Martin",
        summary:
          "Frontend engineer focused on React, TypeScript, design systems, and product-facing web apps.",
        desiredPosition: "Senior Frontend Engineer",
        topSkills: ["React", "TypeScript", "Design Systems"],
        recentExperience: [
          {
            company: "BrightLayer",
            position: "Frontend Engineer",
            highlights: [
              "Led a design system migration used across 4 product squads.",
              "Reduced page load time by 28 percent through bundle and rendering optimizations.",
            ],
          },
        ],
      },
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Lead React and TypeScript development for a customer-facing SaaS platform, build reusable UI systems, improve performance, and collaborate with product and design.",
      candidateName: "Alex Martin",
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
      onFailure: (trace) => {
        failure = trace;
      },
      writer: async () => ({
        version: "premium_writer_output_v1",
        bodyParts: {
          opening: {
            section: "opening",
            text: "I led a design system migration used across 4 product squads.",
            claimIds: ["claim_opening_001"],
            factIds: ["fact_experience_001_highlight_001"],
            demandIds: [],
          },
          proofBlock: {
            section: "proofBlock",
            text: "I led a design system migration used across 4 product squads.",
            claimIds: ["claim_proof_001"],
            factIds: ["mistral_local_repeated_opening_fact"],
            demandIds: [],
          },
          employerValueBlock: {
            section: "employerValueBlock",
            text: "That experience supports reusable UI work across product teams.",
            claimIds: ["claim_employer_value_001"],
            factIds: ["fact_experience_001_highlight_001"],
            demandIds: ["demand_core_001"],
          },
          closeLine: {
            section: "closeLine",
            text: "I would bring disciplined interface delivery and product collaboration.",
            claimIds: ["claim_close_001"],
            factIds: ["fact_experience_001_highlight_001"],
            demandIds: [],
          },
        },
      }),
    });

    expect(result).toBeNull();
    expect(failure).toMatchObject({
      stage: "validation",
      reason: "non_repairable_validation",
      issues: expect.arrayContaining(["unknown_fact_id"]),
    });
  });

  it("normalizes writer-output jargon before validation while preserving hard meta failures", async () => {
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: adjacentContext,
      voicePreset: "engaging",
      outputLanguage: "English",
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      candidateName: "Maya Chen",
      writer: async () => ({
        opening:
          "I completed reports that described handoffs, process bottlenecks, and weekly status updates.",
        proofBlock:
          "I built weekly dashboards to track backlog, response times, and process bottlenecks.",
        employerValueBlock:
          "In reporting and documentation work, clear records help handoffs stay usable.",
        closeLine:
          "I bring discipline around reporting, documentation, and clear handoffs.",
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.content).toContain("completed reports documenting");
    expect(result?.content).not.toMatch(/work surfaces?|reports that described/i);
  });

  it("normalizes passive Mistral reporting without replacing valid evidence-only employer value", async () => {
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: adjacentMonitoringContext,
      voicePreset: "engaging",
      outputLanguage: "English",
      jobTitle: adjacentMonitoringJob.jobTitle,
      jobDescription: adjacentMonitoringJob.jobDescription,
      candidateName: "Robert Cooper",
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
      writer: async () => ({
        opening:
          "Reports were completed by recording observations, occurrences, and surveillance activities, with witness interviews and signatures included.",
        proofBlock:
          "Grounds and equipment controls were monitored to maintain secure environments. Selected areas were tracked using CCTV applications on smart devices.",
        employerValueBlock:
          "Detailed reports documented incidents, observations, and surveillance logs.",
        closeLine:
          "I bring discipline around careful observation, accurate records, and clear handoffs.",
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.bodyParts.opening).toContain(
      "I completed reports documenting",
    );
    expect(result?.bodyParts.employerValueBlock).toContain(
      "Detailed reports documented incidents, observations, and surveillance logs.",
    );
    expect(result?.bodyParts.opening).toMatch(/As .* at /i);
    expect(result?.bodyParts.employerValueBlock).not.toMatch(
      /That is useful in .* work where the day-to-day depends on/i,
    );
  });

  it("uses deterministic Mistral adjacent bridges only for low-value employer value", async () => {
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: adjacentMonitoringContext,
      voicePreset: "engaging",
      outputLanguage: "English",
      jobTitle: adjacentMonitoringJob.jobTitle,
      jobDescription: adjacentMonitoringJob.jobDescription,
      candidateName: "Robert Cooper",
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
      writer: async () => ({
        opening:
          "Reports were completed by recording observations, occurrences, and surveillance activities, with witness interviews and signatures included.",
        proofBlock:
          "Grounds and equipment controls were monitored to maintain secure environments. Selected areas were tracked using CCTV applications on smart devices.",
        employerValueBlock:
          "This helps Region and Area Management Support Staff guide growth and advancement.",
        closeLine:
          "I bring discipline around careful observation, accurate records, and clear handoffs.",
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.bodyParts.employerValueBlock).toMatch(
      /In .* work, that kind of background supports/i,
    );
    expect(result?.bodyParts.employerValueBlock).not.toMatch(
      /Region and Area Management Support Staff|growth and advancement/i,
    );
  });

  it("fails no-CV drafts that use detached experience-history closes", async () => {
    let failure: any = null;
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: null,
      voicePreset: "engaging",
      outputLanguage: "English",
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      candidateName: "Sophie Martin",
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
      onFailure: (trace) => {
        failure = trace;
      },
      writer: async () => ({
        opening:
          "Daily office operations rely on coordination between scheduling, correspondence, and logistical workflows.",
        proofBlock:
          "Scheduling and onboarding logistics follow defined steps to ensure deadlines and handoffs remain clear.",
        employerValueBlock:
          "Tracking requests and updating records keeps workflows visible to teams that depend on them.",
        closeLine:
          "Experience includes maintaining office workflows through scheduling, documentation, and logistical coordination.",
      }),
    });

    expect(result).toBeNull();
    expect(failure).toMatchObject({
      stage: "validation",
      reason: "non_repairable_validation",
      contextClass: "no_cv",
      issues: expect.arrayContaining(["no_cv_uses_candidate_fact"]),
    });
  });

  it("scores premium quality in shadow mode without gating output", () => {
    const result = evaluatePremiumCoverLetterQualityShadow({
      bodyParts: {
        opening:
          "I have described my design-system migration in relation to the role.",
        proofBlock:
          "I led a design system migration used across 4 product squads.",
        employerValueBlock: "Interface quality.",
        closeLine:
          "I bring discipline around reusable systems and shared interfaces.",
      },
      content: [
        "Dear Hiring Manager,",
        "",
        "I have described my design-system migration in relation to the role.",
        "",
        "I led a design system migration used across 4 product squads.",
        "",
        "Interface quality.",
        "",
        "I bring discipline around reusable systems and shared interfaces.",
        "",
        "Sincerely,",
        "Alex Martin",
      ].join("\n"),
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining(["meta_prose", "weak_employer_argument"]),
    );
    expect(result.score).toBeLessThan(100);
  });

  it("flags low-value job echo in employer-value prose", () => {
    const result = evaluatePremiumCoverLetterQualityShadow({
      bodyParts: {
        opening:
          "I bring eight years of safety-conscious Security Guard experience.",
        proofBlock:
          "At ADT Security, I completed reports by recording observations and surveillance activity.",
        employerValueBlock:
          "For Securitas Security, that means a High Level Security Officer who supports Region and Area Management Support Staff guide growth and advancement effectively.",
        closeLine:
          "I bring discipline around accurate records and steady monitoring.",
      },
      content: [
        "Dear Hiring Manager,",
        "",
        "I bring eight years of safety-conscious Security Guard experience.",
        "",
        "At ADT Security, I completed reports by recording observations and surveillance activity.",
        "",
        "For Securitas Security, that means a High Level Security Officer who supports Region and Area Management Support Staff guide growth and advancement effectively.",
        "",
        "I bring discipline around accurate records and steady monitoring.",
        "",
        "Sincerely,",
        "Robert Cooper",
      ].join("\n"),
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toContain("low_value_job_echo");
  });

  it("flags robotic bridge and generic interview-request closings in shadow quality", () => {
    const result = evaluatePremiumCoverLetterQualityShadow({
      bodyParts: {
        opening:
          "I completed reports that record observations and surveillance activity with care.",
        proofBlock:
          "I bring eight years of attentive security experience protecting VIP individuals.",
        employerValueBlock:
          "That is useful in work where consistent support, clear reporting, and careful observation help maintain a dependable security operation.",
        closeLine: "I would be glad to discuss the position further.",
      },
      content: [
        "Dear Hiring Manager,",
        "",
        "I completed reports that record observations and surveillance activity with care.",
        "",
        "I bring eight years of attentive security experience protecting VIP individuals.",
        "",
        "That is useful in work where consistent support, clear reporting, and careful observation help maintain a dependable security operation.",
        "",
        "I would be glad to discuss the position further.",
        "",
        "Sincerely,",
        "Robert Cooper",
      ].join("\n"),
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toContain("generic_tone");
  });

  it("accepts deterministic French employer bridges in shadow quality", () => {
    const result = evaluatePremiumCoverLetterQualityShadow({
      contextClass: "cv_direct",
      bodyParts: {
        opening:
          "J’ai amélioré la conversion de 11 % grâce à des expérimentations d’interface.",
        proofBlock:
          "J’ai mené la migration d’un design system utilisé par quatre équipes produit.",
        employerValueBlock:
          "Dans le travail sur les interfaces produit, cette expérience apporte une pratique structurée des systèmes réutilisables.",
        closeLine:
          "Cette expérience continue de nourrir ma pratique professionnelle.",
      },
      content: [
        "Madame, Monsieur,",
        "",
        "J’ai amélioré la conversion de 11 % grâce à des expérimentations d’interface.",
        "",
        "J’ai mené la migration d’un design system utilisé par quatre équipes produit.",
        "",
        "Dans le travail sur les interfaces produit, cette expérience apporte une pratique structurée des systèmes réutilisables.",
        "",
        "Cette expérience continue de nourrir ma pratique professionnelle.",
        "",
        "Cordialement,",
        "Alex Martin",
      ].join("\n"),
    });

    expect(result.issues).not.toContain("weak_employer_argument");
  });

  it("does not treat experience alone as a French employer argument", () => {
    const result = evaluatePremiumCoverLetterQualityShadow({
      contextClass: "cv_direct",
      bodyParts: {
        opening:
          "J’ai amélioré la conversion de 11 % grâce à des expérimentations d’interface.",
        proofBlock:
          "J’ai mené la migration d’un design system utilisé par quatre équipes produit.",
        employerValueBlock: "Cette expérience est solide.",
        closeLine:
          "Cette expérience continue de nourrir ma pratique professionnelle.",
      },
      content:
        "J’ai amélioré la conversion de 11 %. Cette expérience est solide.",
    });

    expect(result.issues).toContain("weak_employer_argument");
  });

  it("does not treat apporte alone as a French employer argument", () => {
    const result = evaluatePremiumCoverLetterQualityShadow({
      contextClass: "cv_direct",
      bodyParts: {
        opening:
          "J’ai amélioré la conversion de 11 % grâce à des expérimentations d’interface.",
        proofBlock:
          "J’ai mené la migration d’un design system utilisé par quatre équipes produit.",
        employerValueBlock: "J’apporte de la rigueur.",
        closeLine:
          "Cette expérience continue de nourrir ma pratique professionnelle.",
      },
      content: "J’ai amélioré la conversion de 11 %. J’apporte de la rigueur.",
    });

    expect(result.issues).toContain("weak_employer_argument");
  });

  it.each([
    "Cette expérience aide vos équipes.",
    "Cette expérience est utile là où les priorités évoluent.",
  ])("recognizes Unicode-safe French employer bridge markers: %s", (employerValueBlock) => {
    const result = evaluatePremiumCoverLetterQualityShadow({
      contextClass: "cv_direct",
      bodyParts: {
        opening:
          "J’ai amélioré la conversion de 11 % grâce à des expérimentations d’interface.",
        proofBlock:
          "J’ai mené la migration d’un design system utilisé par quatre équipes produit.",
        employerValueBlock,
        closeLine:
          "Cette expérience continue de nourrir ma pratique professionnelle.",
      },
      content: `J’ai amélioré la conversion de 11 %. ${employerValueBlock}`,
    });

    expect(result.issues).not.toContain("weak_employer_argument");
  });

  it("does not flag the legacy French no-CV discussion close as generic tone", () => {
    const result = evaluatePremiumCoverLetterQualityShadow({
      contextClass: "no_cv",
      bodyParts: {
        opening:
          "Votre offre met l’accent sur la coordination quotidienne des activités.",
        proofBlock:
          "Le poste demande un suivi clair des demandes et des échéances.",
        employerValueBlock:
          "Le rôle exige une organisation fiable pour garder les priorités visibles.",
        closeLine: "Je serais ravi d’en discuter.",
      },
      content: [
        "Madame, Monsieur,",
        "",
        "Votre offre met l’accent sur la coordination quotidienne des activités.",
        "",
        "Le poste demande un suivi clair des demandes et des échéances.",
        "",
        "Le rôle exige une organisation fiable pour garder les priorités visibles.",
        "",
        "Je serais ravi d’en discuter.",
        "",
        "Cordialement,",
        "Sophie Martin",
      ].join("\n"),
    });

    expect(result.issues).not.toContain("generic_tone");
  });

  it.each([
    "I would be glad to discuss the role further.",
    "I would welcome the chance to discuss the position further.",
  ])(
    "does not flag a legacy English no-CV discussion close as generic tone: %s",
    (closeLine) => {
      const result = evaluatePremiumCoverLetterQualityShadow({
        contextClass: "no_cv",
        bodyParts: {
          opening:
            "The role centers on careful coordination and accurate records.",
          proofBlock:
            "The work requires clear communication and steady follow-through.",
          employerValueBlock:
            "The role points to operations work that requires organized coordination.",
          closeLine,
        },
        content: [
          "Dear Hiring Manager,",
          "",
          "The role centers on careful coordination and accurate records.",
          "",
          "The work requires clear communication and steady follow-through.",
          "",
          "The role points to operations work that requires organized coordination.",
          "",
          closeLine,
          "",
          "Sincerely,",
          "Alex Martin",
        ].join("\n"),
      });

      expect(result.issues).not.toContain("generic_tone");
    },
  );

  it("does not run quality repair when the only shadow issue is non-repairable specificity", async () => {
    const calls: string[] = [];
    const result = await withQualityRepairFlag("on", () =>
      attemptPremiumCoverLetterGeneration({
        personalizationContext: directContext,
        voicePreset: "signature",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        candidateName: "Alex Martin",
        writer: async ({ prompt }) => {
          calls.push(prompt);
          return buildDirectPremiumWriterOutputFixture({
            opening:
              "I improved signup conversion through iterative UI experiments.",
            proofBlock:
              "I led a design system migration used across product squads.",
            employerValueBlock:
              "That experience is relevant where React, TypeScript, reusable systems, and product-facing interface work matter.",
            closeLine:
              "I bring grounded frontend evidence around experimentation, reusable systems, and product-facing interfaces.",
          });
        },
      }),
    );

    expect(result).not.toBeNull();
    expect(calls).toHaveLength(1);
    expect(result?.qualityShadow?.issues).toContain("low_specificity");
    expect(result?.qualityRepair).toMatchObject({
      enabled: true,
      eligible: false,
      attempted: false,
      outcome: "not_needed",
    });
  });

  it.each([undefined, "off", "false", "0"] as const)(
    "keeps quality repair disabled when flag is %s",
    async (flagValue) => {
      const calls: string[] = [];
      const originalEmployerValue =
        "I built experimentation dashboards used by product and growth teams.";
      const result = await withQualityRepairFlag(flagValue, () =>
        attemptPremiumCoverLetterGeneration({
          personalizationContext: directContext,
          voicePreset: "signature",
          outputLanguage: "English",
          jobTitle: directJob.jobTitle,
          jobDescription: directJob.jobDescription,
          candidateName: "Alex Martin",
          writer: async ({ prompt }) => {
            calls.push(prompt);
            return buildDirectPremiumWriterOutputFixture({
              opening:
                "I improved signup conversion by 11% after iterative UI experiments.",
              proofBlock:
                "I led a design system migration used across 4 product squads.",
              employerValueBlock: originalEmployerValue,
              closeLine:
                "I bring grounded frontend evidence around experimentation, reusable systems, and product-facing interfaces.",
            });
          },
        }),
      );

      expect(result).not.toBeNull();
      expect(calls).toHaveLength(1);
      expect(result?.bodyParts.employerValueBlock).toBe(originalEmployerValue);
      expect(result?.qualityRepair).toMatchObject({
        enabled: false,
        eligible: false,
        attempted: false,
        outcome: "disabled",
      });
    },
  );

  it("does not run quality repair for legacy-wrapped output when enabled", async () => {
    const calls: string[] = [];
    const bodyParts = {
      opening:
        "I improved signup conversion by 11% after iterative UI experiments.",
      proofBlock:
        "I led a design system migration used across 4 product squads.",
      employerValueBlock:
        "I built experimentation dashboards used by product and growth teams.",
      closeLine:
        "I bring grounded frontend evidence around experimentation, reusable systems, and product-facing interfaces.",
    };
    const result = await withQualityRepairFlag("true", () =>
      attemptPremiumCoverLetterGeneration({
        personalizationContext: directContext,
        voicePreset: "signature",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        candidateName: "Alex Martin",
        writer: async ({ prompt }) => {
          calls.push(prompt);
          return { version: "legacy_body_parts_v1", bodyParts };
        },
      }),
    );

    expect(result).not.toBeNull();
    expect(calls).toHaveLength(1);
    expect(result?.qualityRepair).toMatchObject({
      enabled: true,
      eligible: false,
      attempted: false,
      outcome: "not_needed",
    });
  });

  it("runs one bounded quality repair and keeps final provenance validated", async () => {
    const calls: string[] = [];
    const originalEmployerValue =
      "I built experimentation dashboards used by product and growth teams.";
    const repairedCloseLine =
      "I would bring that design-system discipline to product-facing interface work.";
    const result = await attemptDirectQualityRepair(async ({ prompt }) => {
      calls.push(prompt);
      if (calls.length === 1) {
        return buildDirectPremiumWriterOutputFixture({
          opening:
            "I improved signup conversion by 11% after iterative UI experiments.",
          proofBlock:
            "I led a design system migration used across 4 product squads.",
          employerValueBlock: originalEmployerValue,
          closeLine: "I would be glad to discuss the position further.",
        });
      }
      return {
            opening:
              "I improved signup conversion by 11% after iterative UI experiments.",
            proofBlock:
              "I led a design system migration used across 4 product squads.",
            employerValueBlock: originalEmployerValue,
            closeLine: repairedCloseLine,
      };
    });

    expect(result).not.toBeNull();
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("Repair cover-letter body parts for quality only.");
    expect(result?.bodyParts.closeLine).toBe(repairedCloseLine);
    expect(result?.qualityShadow?.issues).not.toContain("generic_tone");
    expect(result?.qualityRepair).toMatchObject({
      enabled: true,
      eligible: true,
      attempted: true,
      outcome: "attempted_accepted",
      finalProvenanceStatus: "validated_after_structured_repair",
      verifiedCandidateFactCount: expect.any(Number),
    });
    expect(result?.finalProvenance?.status).toBe(
      "validated_after_structured_repair",
    );
    expect(
      result?.finalProvenance?.verifiedCandidateFactIds.length ?? 0,
    ).toBeGreaterThan(0);
  });

  it("accepts a quality repair that only normalizes supported numeric formatting", async () => {
    const calls: string[] = [];
    const originalEmployerValue =
      "I built experimentation dashboards used by product and growth teams.";
    const repairedCloseLine =
      "I would bring that design-system discipline to product-facing interface work.";
    const result = await attemptDirectQualityRepair(async () => {
      calls.push("writer");
      if (calls.length === 1) {
        return buildDirectPremiumWriterOutputFixture({
          opening:
            "I improved signup conversion by 11.0% after iterative UI experiments.",
          proofBlock:
            "I led a design system migration used across 4.0 product squads.",
          employerValueBlock: originalEmployerValue,
          closeLine: "I would be glad to discuss the position further.",
        });
      }
      return {
        opening:
          "I improved signup conversion by 11% after iterative UI experiments.",
        proofBlock:
          "I led a design system migration used across 4 product squads.",
        employerValueBlock: originalEmployerValue,
        closeLine: repairedCloseLine,
      };
    });

    expect(calls).toHaveLength(2);
    expect(result?.bodyParts.opening).toContain("11%");
    expect(result?.bodyParts.proofBlock).toContain("4 product squads");
    expect(result?.qualityRepair).toMatchObject({
      attempted: true,
      outcome: "attempted_accepted",
      finalProvenanceStatus: "validated_after_structured_repair",
    });
  });

  it("rejects a cited repair when it adds distinguishing uncited CV detail", async () => {
    const calls: string[] = [];
    const originalEmployerValue =
      "I built experimentation dashboards used by product and growth teams.";
    const result = await attemptDirectQualityRepair(async () => {
      calls.push("writer");
      if (calls.length === 1) {
        return buildDirectPremiumWriterOutputFixture({
          opening:
            "I improved signup conversion by 11% after iterative UI experiments.",
          proofBlock:
            "I led a design system migration used across 4 product squads.",
          employerValueBlock: originalEmployerValue,
          closeLine: "I would be glad to discuss the position further.",
        });
      }
      return {
        opening:
          "I improved signup conversion by 11% after iterative UI experiments.",
        proofBlock:
          "I led a design system migration across 4 product squads for customer-facing web applications.",
        employerValueBlock: originalEmployerValue,
        closeLine:
          "I would bring that design-system discipline to product-facing interface work.",
      };
    });

    expect(calls).toHaveLength(2);
    expect(result?.qualityRepair).toMatchObject({
      attempted: true,
      outcome: "rejected_provenance",
      rejectionCategory: "rejected_provenance",
    });
    expect(result?.bodyParts.proofBlock).toBe(
      "I led a design system migration used across 4 product squads.",
    );
  });

  it("rejects a repair that appends an uncited fact after a comma", async () => {
    const calls: string[] = [];
    const originalProof =
      "I led a design system migration used across 4 product squads.";
    const originalEmployerValue =
      "I built experimentation dashboards used by product and growth teams.";
    const result = await attemptDirectQualityRepair(async () => {
      calls.push("writer");
      if (calls.length === 1) {
        return buildDirectPremiumWriterOutputFixture({
          opening:
            "I improved signup conversion by 11% after iterative UI experiments.",
          proofBlock: originalProof,
          employerValueBlock: originalEmployerValue,
          closeLine: "I would be glad to discuss the position further.",
        });
      }
      return {
        opening:
          "I improved signup conversion by 11% after iterative UI experiments.",
        proofBlock:
          "I led a design system migration used across 4 product squads, improving signup conversion through iterative UI experiments.",
        employerValueBlock: originalEmployerValue,
        closeLine:
          "I would bring that design-system discipline to product-facing interface work.",
      };
    });

    expect(calls).toHaveLength(2);
    expect(result?.bodyParts.proofBlock).toBe(originalProof);
    expect(result?.qualityRepair).toMatchObject({
      attempted: true,
      outcome: "rejected_provenance",
      rejectionCategory: "rejected_provenance",
    });
  });

  it("rejects a repair that appends an uncited short CV fact", async () => {
    const calls: string[] = [];
    const originalProof =
      "I led a design system migration used across 4 product squads.";
    const originalEmployerValue =
      "I built experimentation dashboards used by product and growth teams.";
    const result = await attemptDirectQualityRepair(
      async () => {
        calls.push("writer");
        if (calls.length === 1) {
          return buildDirectPremiumWriterOutputFixture({
            opening:
              "I improved signup conversion by 11% after iterative UI experiments.",
            proofBlock: originalProof,
            employerValueBlock: originalEmployerValue,
            closeLine: "I would be glad to discuss the position further.",
          });
        }
        return {
          opening:
            "I improved signup conversion by 11% after iterative UI experiments.",
          proofBlock: `${originalProof} Used Salesforce.`,
          employerValueBlock: originalEmployerValue,
          closeLine:
            "I would bring that design-system discipline to product-facing interface work.",
        };
      },
      {
        ...directContext,
        topSkills: [...directContext.topSkills, "Used Salesforce"],
      },
    );

    expect(calls).toHaveLength(2);
    expect(result?.bodyParts.proofBlock).toBe(originalProof);
    expect(result?.qualityRepair).toMatchObject({
      attempted: true,
      outcome: "rejected_provenance",
      rejectionCategory: "rejected_provenance",
    });
  });

  it("rejects a quality repair that moves a supported metric to the wrong section", async () => {
    const calls: string[] = [];
    const originalProof =
      "I led a design system migration used across 4 product squads.";
    const originalEmployerValue =
      "I built experimentation dashboards used by product and growth teams.";
    const originalOutput = buildDirectPremiumWriterOutputFixture({
      opening:
        "I improved signup conversion by 11% after iterative UI experiments.",
      proofBlock: originalProof,
      employerValueBlock: originalEmployerValue,
      closeLine: "I would be glad to discuss the position further.",
    });
    const result = await attemptDirectQualityRepair(async ({ prompt }) => {
      calls.push(prompt);
      if (calls.length === 1) {
        return originalOutput;
      }
      return {
            opening:
              "I improved signup conversion through iterative UI experiments.",
            proofBlock:
              "I led a design system migration used across 4 product squads and improved signup conversion by 11%.",
            employerValueBlock: originalEmployerValue,
            closeLine:
              "I would bring that design-system discipline to product-facing interface work.",
      };
    });

    expect(calls).toHaveLength(2);
    expect(result).not.toBeNull();
    expect(result?.bodyParts.proofBlock).toBe(originalProof);
    expect(result?.qualityRepair).toMatchObject({
      attempted: true,
      outcome: "rejected_provenance",
      rejectionCategory: "rejected_provenance",
    });
  });

  it("rejects a quality repair that moves a nonnumeric fact without updating section provenance", async () => {
    const calls: string[] = [];
    const originalProof =
      "I led a design system migration used across 4 product squads.";
    const originalEmployerValue =
      "I built experimentation dashboards used by product and growth teams.";
    const result = await attemptDirectQualityRepair(async ({ prompt }) => {
      calls.push(prompt);
      if (calls.length === 1) {
        return buildDirectPremiumWriterOutputFixture({
          opening:
            "I improved signup conversion by 11% after iterative UI experiments.",
          proofBlock: originalProof,
          employerValueBlock: originalEmployerValue,
          closeLine: "I would be glad to discuss the position further.",
        });
      }
      return {
            opening:
              "I improved signup conversion by 11% after iterative UI experiments.",
            proofBlock:
              `${originalProof.replace(/\.$/u, "")} and I also improved signup conversion through iterative UI experiments.`,
            employerValueBlock: originalEmployerValue,
            closeLine:
              "I would bring that design-system discipline to product-facing interface work.",
      };
    });

    expect(result).not.toBeNull();
    expect(calls).toHaveLength(2);
    expect(result?.bodyParts.proofBlock).toBe(originalProof);
    expect(result?.qualityRepair).toMatchObject({
      attempted: true,
      outcome: "rejected_provenance",
      rejectionCategory: "rejected_provenance",
    });
  });

  it("rejects a quality repair that adds an uncited single-token skill", async () => {
    const calls: string[] = [];
    const originalProof =
      "I led a design system migration used across 4 product squads.";
    const originalEmployerValue =
      "I built experimentation dashboards used by product and growth teams.";
    const result = await attemptDirectQualityRepair(async ({ prompt }) => {
      calls.push(prompt);
      if (calls.length === 1) {
        return buildDirectPremiumWriterOutputFixture({
          opening:
            "I improved signup conversion by 11% after iterative UI experiments.",
          proofBlock: originalProof,
          employerValueBlock: originalEmployerValue,
          closeLine: "I would be glad to discuss the position further.",
        });
      }
      return {
        opening:
          "I improved signup conversion by 11% after iterative UI experiments.",
        proofBlock: `${originalProof} I also used React.`,
        employerValueBlock: originalEmployerValue,
        closeLine:
          "I would bring that design-system discipline to product-facing interface work.",
      };
    });

    expect(result).not.toBeNull();
    expect(calls).toHaveLength(2);
    expect(result?.bodyParts.proofBlock).toBe(originalProof);
    expect(result?.qualityRepair).toMatchObject({
      attempted: true,
      outcome: "rejected_provenance",
      rejectionCategory: "rejected_provenance",
    });
  });

  it("keeps the original safe output when quality repair returns invalid JSON", async () => {
    const failures: any[] = [];
    const calls: string[] = [];
    const originalEmployerValue =
      "I built experimentation dashboards used by product and growth teams.";
    const result = await withQualityRepairFlag("on", () =>
      attemptPremiumCoverLetterGeneration({
        personalizationContext: directContext,
        voicePreset: "signature",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        candidateName: "Alex Martin",
        onFailure: (trace) => {
          failures.push(trace);
        },
        writer: async ({ prompt }) => {
          calls.push(prompt);
          if (calls.length === 1) {
            return buildDirectPremiumWriterOutputFixture({
              opening:
                "I improved signup conversion by 11% after iterative UI experiments.",
              proofBlock:
                "I led a design system migration used across 4 product squads.",
              employerValueBlock: originalEmployerValue,
              closeLine:
                "I bring grounded frontend evidence around experimentation, reusable systems, and product-facing interfaces.",
            });
          }
          return { notBodyParts: true };
        },
      }),
    );

    expect(result).not.toBeNull();
    expect(failures).toHaveLength(0);
    expect(calls).toHaveLength(2);
    expect(result?.bodyParts.employerValueBlock).toBe(originalEmployerValue);
    expect(result?.qualityRepair).toMatchObject({
      enabled: true,
      eligible: true,
      attempted: true,
      outcome: "rejected_invalid_output",
      rejectionCategory: "rejected_invalid_output",
    });
    expect(result?.qualityShadow?.issues).toEqual(
      expect.arrayContaining(["factual_inventory", "weak_employer_argument"]),
    );
  });

  it("keeps the original safe output when optional repair fails the final gate", async () => {
    const failures: any[] = [];
    const calls: string[] = [];
    const originalProof =
      "I built experimentation dashboards used by product and growth teams.";
    const originalClose = "I would be glad to discuss the position further.";
    const originalEmployerValue =
      "That experimentation work would support product-facing interface decisions.";
    const result = await withQualityRepairFlag("on", () =>
      attemptPremiumCoverLetterGeneration({
        personalizationContext: directContext,
        voicePreset: "signature",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        candidateName: "Alex Martin",
        onFailure: (trace) => {
          failures.push(trace);
        },
        writer: async ({ prompt }) => {
          calls.push(prompt);
          if (calls.length === 1) {
            return buildDirectPremiumWriterOutputFixture({
              opening:
                "I improved signup conversion by 11% after iterative UI experiments.",
              proofBlock: originalProof,
              employerValueBlock: originalEmployerValue,
              closeLine: originalClose,
            });
          }
          return {
            opening:
              "I improved signup conversion by 11% after iterative UI experiments.",
            proofBlock: originalProof,
            employerValueBlock: originalEmployerValue,
            closeLine: originalProof,
          };
        },
      }),
    );

    expect(result).not.toBeNull();
    expect(failures).toHaveLength(0);
    expect(calls).toHaveLength(2);
    expect(result?.bodyParts.closeLine).toBe(originalClose);
    expect(result?.qualityRepair).toMatchObject({
      enabled: true,
      eligible: true,
      attempted: true,
      outcome: "rejected_validation",
      rejectionCategory: "rejected_validation",
    });
  });

  it("rejects quality repair that would drop candidate-evidence provenance", async () => {
    const calls: string[] = [];
    const originalEmployerValue =
      "I built experimentation dashboards used by product and growth teams.";
    const result = await withQualityRepairFlag("on", () =>
      attemptPremiumCoverLetterGeneration({
        personalizationContext: directContext,
        voicePreset: "signature",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        candidateName: "Alex Martin",
        writer: async ({ prompt }) => {
          calls.push(prompt);
          if (calls.length === 1) {
            return buildDirectPremiumWriterOutputFixture({
              opening:
                "I improved signup conversion by 11% after iterative UI experiments.",
              proofBlock:
                "I led a design system migration used across 4 product squads.",
              employerValueBlock: originalEmployerValue,
              closeLine:
                "I bring grounded frontend evidence around experimentation, reusable systems, and product-facing interfaces.",
            });
          }
          return {
            opening:
              "The opportunity calls for organized planning and clear follow-through.",
            proofBlock:
              "The team needs steady communication, careful priorities, and reliable delivery habits.",
            employerValueBlock:
              "That context matters where planning, communication, and follow-through keep work moving.",
            closeLine: "That approach would support the team with steady execution.",
          };
        },
      }),
    );

    expect(result).not.toBeNull();
    expect(calls).toHaveLength(2);
    expect(result?.bodyParts.employerValueBlock).toBe(originalEmployerValue);
    expect(result?.qualityRepair).toMatchObject({
      enabled: true,
      eligible: true,
      attempted: true,
      outcome: "rejected_provenance",
      rejectionCategory: "rejected_provenance",
    });
    expect(result?.content).not.toContain(
      "The opportunity calls for organized planning",
    );
    expect(result?.finalProvenance?.status).toBe("validated_final_text");
    expect(
      result?.finalProvenance?.verifiedCandidateFactIds.length ?? 0,
    ).toBeGreaterThan(0);
  });

  it("rejects a quality repair that borrows job-context metrics or compliance as candidate proof", async () => {
    const calls: string[] = [];
    const originalEmployerValue =
      "I built experimentation dashboards used by product and growth teams.";
    const result = await withQualityRepairFlag("on", () =>
      attemptPremiumCoverLetterGeneration({
        personalizationContext: directContext,
        voicePreset: "signature",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: [
          directJob.jobDescription,
          "The team wants SOC 2 readiness work and a 42% adoption growth goal.",
        ].join(" "),
        candidateName: "Alex Martin",
        writer: async ({ prompt }) => {
          calls.push(prompt);
          if (calls.length === 1) {
            return buildDirectPremiumWriterOutputFixture({
              opening:
                "I improved signup conversion by 11% after iterative UI experiments.",
              proofBlock:
                "I led a design system migration used across 4 product squads.",
              employerValueBlock: originalEmployerValue,
              closeLine:
                "I bring grounded frontend evidence around experimentation, reusable systems, and product-facing interfaces.",
            });
          }
          return {
            opening:
              "I improved signup conversion by 11% after iterative UI experiments.",
            proofBlock:
              "I led a design system migration used across 4 product squads.",
            employerValueBlock:
              "That design system migration is relevant where SOC 2 readiness and 42% adoption growth are priorities.",
            closeLine:
              "I bring grounded frontend evidence around experimentation, reusable systems, and product-facing interfaces.",
          };
        },
      }),
    );

    expect(result).not.toBeNull();
    expect(calls).toHaveLength(2);
    expect(result?.bodyParts.employerValueBlock).toBe(originalEmployerValue);
    expect(result?.qualityRepair).toMatchObject({
      enabled: true,
      eligible: true,
      attempted: true,
      outcome: "rejected_provenance",
      rejectionCategory: "rejected_provenance",
    });
    expect(result?.content).not.toContain("SOC 2 readiness");
    expect(result?.content).not.toContain("42% adoption growth");
  });

  it("rejects a quality repair with unsupported metrics, credentials, licenses, or ownership claims", async () => {
    const calls: string[] = [];
    const originalEmployerValue =
      "I built experimentation dashboards used by product and growth teams.";
    const result = await withQualityRepairFlag("on", () =>
      attemptPremiumCoverLetterGeneration({
        personalizationContext: directContext,
        voicePreset: "signature",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        candidateName: "Alex Martin",
        writer: async ({ prompt }) => {
          calls.push(prompt);
          if (calls.length === 1) {
            return buildDirectPremiumWriterOutputFixture({
              opening:
                "I improved signup conversion by 11% after iterative UI experiments.",
              proofBlock:
                "I led a design system migration used across 4 product squads.",
              employerValueBlock: originalEmployerValue,
              closeLine:
                "I bring grounded frontend evidence around experimentation, reusable systems, and product-facing interfaces.",
            });
          }
          return {
            opening:
              "I drove a 42% revenue lift and hold a high school diploma.",
            proofBlock:
              "I hold a valid driver's license and managed emergency preparedness drills.",
            employerValueBlock:
              "That experience is relevant to customer-facing React and TypeScript work.",
            closeLine:
              "That work is relevant to shipped interface work and product iteration.",
          };
        },
      }),
    );

    expect(result).not.toBeNull();
    expect(calls).toHaveLength(2);
    expect(result?.bodyParts.employerValueBlock).toBe(originalEmployerValue);
    expect(result?.qualityRepair).toMatchObject({
      enabled: true,
      eligible: true,
      attempted: true,
      outcome: "rejected_validation",
      rejectionCategory: "rejected_validation",
    });
    expect(result?.content).not.toContain("42% revenue");
    expect(result?.content).not.toContain("high school diploma");
    expect(result?.content).not.toContain("driver's license");
  });

  it("rejects a quality repair that is not improved and keeps the original safe output", async () => {
    const calls: string[] = [];
    const originalEmployerValue =
      "I built experimentation dashboards used by product and growth teams.";
    const originalBodyParts = {
      opening:
        "I improved signup conversion by 11% after iterative UI experiments.",
      proofBlock:
        "I led a design system migration used across 4 product squads.",
      employerValueBlock: originalEmployerValue,
      closeLine:
        "I bring grounded frontend evidence around experimentation, reusable systems, and product-facing interfaces.",
    };
    const result = await withQualityRepairFlag("on", () =>
      attemptPremiumCoverLetterGeneration({
        personalizationContext: directContext,
        voicePreset: "signature",
        outputLanguage: "English",
        jobTitle: directJob.jobTitle,
        jobDescription: directJob.jobDescription,
        candidateName: "Alex Martin",
        writer: async ({ prompt }) => {
          calls.push(prompt);
          if (calls.length === 1) {
            return buildDirectPremiumWriterOutputFixture(originalBodyParts);
          }
          return originalBodyParts;
        },
      }),
    );

    expect(result).not.toBeNull();
    expect(calls).toHaveLength(2);
    expect(result?.bodyParts.employerValueBlock).toBe(originalEmployerValue);
    expect(result?.qualityRepair).toMatchObject({
      enabled: true,
      eligible: true,
      attempted: true,
      outcome: "rejected_not_improved",
      rejectionCategory: "rejected_not_improved",
    });
  });

  it("propagates cancellation from a quality repair writer call", async () => {
    const calls: string[] = [];
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";

    await withQualityRepairFlag("on", async () => {
      await expect(
        attemptPremiumCoverLetterGeneration({
          personalizationContext: directContext,
          voicePreset: "signature",
          outputLanguage: "English",
          jobTitle: directJob.jobTitle,
          jobDescription: directJob.jobDescription,
          candidateName: "Alex Martin",
          writer: async ({ prompt }) => {
            calls.push(prompt);
            if (calls.length === 1) {
              return buildDirectPremiumWriterOutputFixture({
                opening:
                  "I improved signup conversion by 11% after iterative UI experiments.",
                proofBlock:
                  "I led a design system migration used across 4 product squads.",
                employerValueBlock:
                  "I built experimentation dashboards used by product and growth teams.",
                closeLine:
                  "I bring grounded frontend evidence around experimentation, reusable systems, and product-facing interfaces.",
              });
            }
            throw abortError;
          },
        }),
      ).rejects.toMatchObject({ name: "AbortError" });
    });

    expect(calls).toHaveLength(2);
  });

  it("builds employer-value bridges from universal work surfaces, not security-specific templates", () => {
    const bridgeCases = [
      {
        contextClass: "cv_direct",
        targetRole: "Revenue Operations Lead",
        topEvidence: [
          "Improved forecast accuracy by 19% after redesigning pipeline review and reporting workflows.",
        ],
        supportEvidence: [
          "Led a quarterly operating cadence across sales, finance, and customer success.",
        ],
        workContext: [
          "Lead revenue operations reporting and forecasting workflows.",
        ],
        expected: /revenue reporting and forecasting/i,
      },
      {
        contextClass: "cv_direct",
        targetRole: "Facilities Support Coordinator",
        topEvidence: [
          "Handled maintenance intake, scheduling, and vendor follow-up for office sites.",
        ],
        supportEvidence: [
          "Kept service records and completion status current across recurring facilities requests.",
        ],
        workContext: [
          "Coordinate maintenance requests, schedule vendors, and update service records.",
        ],
        expected: /facilities and maintenance coordination/i,
      },
      {
        contextClass: "cv_direct",
        targetRole: "Customer Success Manager",
        topEvidence: [
          "Improved 90-day retention by 18% by redesigning onboarding checkpoints and escalation triggers.",
        ],
        supportEvidence: [
          "Built a customer health-score dashboard used by the CS team to prioritize at-risk accounts.",
        ],
        workContext: [
          "Own account health, retention reporting, onboarding, and expansion workflows.",
        ],
        expected: /customer success and retention work/i,
      },
      {
        contextClass: "no_cv",
        targetRole: "Office Coordinator",
        topEvidence: [],
        supportEvidence: [],
        workContext: [
          "Coordinate team scheduling, service intake, vendor follow-up, and daily office routines.",
        ],
        expected: /operations and scheduling/i,
      },
    ] as const;

    for (const bridgeCase of bridgeCases) {
      const repaired = repairPremiumCoverLetterBodyParts({
        brief: {
          language: "English",
          preset: "engaging",
          candidateEvidenceAvailable: bridgeCase.contextClass !== "no_cv",
          requiredMoves: [],
          forbiddenMoves: [],
          keyRequirements: [],
          preferredQualifications: [],
          lowValueChecklist: [],
          topResponsibilities: bridgeCase.workContext,
          ...bridgeCase,
        } as any,
        bodyParts: {
          opening: "Opening sentence.",
          proofBlock: "Proof sentence.",
          employerValueBlock:
            "This helps Region and Area Management Support Staff guide growth and advancement.",
          closeLine: "I bring careful follow-through.",
        },
      });

      expect(repaired.employerValueBlock).toMatch(bridgeCase.expected);
      expect(repaired.employerValueBlock).not.toMatch(/security environments/i);
      expect(repaired.employerValueBlock).not.toMatch(/Region and Area Management Support Staff|growth and advancement/i);
      if (bridgeCase.contextClass === "cv_adjacent") {
        expect(repaired.employerValueBlock).not.toMatch(/\bI can (?:help|support)\b/i);
      }
    }
  });

  it("flags universal planning/meta prose across domains", () => {
    const metaPhrases = [
      "The evidence shows that I improved forecast accuracy by 19%.",
      "My strongest match is customer success retention work.",
      "That gives the letter a concrete bridge to facilities coordination.",
      "This section shows my reporting and documentation background.",
    ];

    for (const phrase of metaPhrases) {
      const result = evaluatePremiumCoverLetterQualityShadow({
        bodyParts: {
          opening: phrase,
          proofBlock:
            "I improved signup conversion by 11% after iterative UI experiments.",
          employerValueBlock:
            "That matters where customer-facing product work depends on clear evidence.",
          closeLine:
            "I bring discipline around concrete proof and clear follow-through.",
        },
        content: [
          "Dear Hiring Manager,",
          "",
          phrase,
          "",
          "I improved signup conversion by 11% after iterative UI experiments.",
          "",
          "That matters where customer-facing product work depends on clear evidence.",
          "",
          "I bring discipline around concrete proof and clear follow-through.",
          "",
          "Sincerely,",
          "Alex Martin",
        ].join("\n"),
      });

      expect(result.passed).toBe(false);
      expect(result.issues).toContain("meta_prose");
    }
  });

  it("cleans report-description phrasing without security-specific branching", () => {
    const repaired = repairPremiumCoverLetterBodyParts({
      brief: {
        language: "English",
        preset: "engaging",
        contextClass: "cv_adjacent",
        candidateEvidenceAvailable: true,
        targetRole: "Operations Coordinator",
        topEvidence: [
          "Completed reports by recording observations, occurrences, and follow-up notes.",
        ],
        supportEvidence: [
          "Tracked handoffs and maintained records for internal teams.",
        ],
        transferCore: [
          "Completed reports by recording observations, occurrences, and follow-up notes.",
        ],
        topResponsibilities: [
          "Coordinate documentation, reporting, and internal follow-up.",
        ],
        keyRequirements: [],
        preferredQualifications: [],
        lowValueChecklist: [],
        workContext: [
          "Coordinate documentation, reporting, and internal follow-up.",
        ],
        requiredMoves: [],
        forbiddenMoves: [],
      } as any,
      bodyParts: {
        opening:
          "I completed reports that described observations, occurrences, and follow-up notes.",
        proofBlock:
          "I completed reports by recording observations, occurrences, and follow-up notes.",
        employerValueBlock: "",
        closeLine: "I bring discipline around accurate records.",
      },
    });

    expect(repaired.opening).toContain("completed reports documenting");
    expect(repaired.proofBlock).toContain("completed reports documenting");
    expect(repaired.opening).not.toContain("reports that described");
    expect(repaired.proofBlock).not.toContain("reports by recording");
    expect(repaired.employerValueBlock).toMatch(/reporting and documentation/i);
    expect(repaired.employerValueBlock).not.toMatch(/security/i);
  });

  it("rejects clipped source fragments and allows source-safe team fallbacks", async () => {
    const baseArgs = {
      personalizationContext: {
        name: "Test Candidate",
        summary:
          "Safety-conscious Security Guard with eight years of experience protecting VIP individuals.",
        desiredPosition: "Security Guard",
        topSkills: ["Safety compliance", "Investigation skills"],
        recentExperience: [
          {
            company: "Sentinel Services",
            position: "Security Guard",
            highlights: [
              "Maintained environments by monitoring grounds and equipment controls.",
              "Logged into security headquarters on a set schedule to report all-in-order statuses.",
            ],
          },
        ],
      },
      voicePreset: "signature" as const,
      outputLanguage: "English" as const,
      jobTitle: "Security Officer",
      jobDescription:
        "Location: St. Support visitors and staff, patrol campus grounds, and document safety incidents.",
      candidateName: "Test Candidate",
    };

    const unsafe = await attemptPremiumCoverLetterGeneration({
      ...baseArgs,
      writer: async () => ({
        opening:
          "I bring security experience monitoring grounds and equipment controls.",
        proofBlock:
          "At Sentinel Services, I logged all-in-order statuses on a set schedule.",
        employerValueBlock:
          "That experience fits campus security work that depends on steady monitoring.",
        closeLine:
          "I would welcome the opportunity to contribute to your St. campus team.",
      }),
    });
    const safe = await attemptPremiumCoverLetterGeneration({
      ...baseArgs,
      writer: async () => ({
        opening:
          "I bring security experience monitoring grounds and equipment controls.",
        proofBlock:
          "At Sentinel Services, I logged all-in-order statuses on a set schedule.",
        employerValueBlock:
          "That experience fits campus security work that depends on steady monitoring.",
        closeLine:
          "I would welcome the opportunity to contribute to the campus security team.",
      }),
    });

    expect(unsafe).toBeNull();
    expect(safe?.content).toContain("monitoring grounds and equipment controls");
    expect(safe?.content).not.toContain("your St. campus team");
  });

  it("fails ATS keyword lists and compliance-framework hallucinations but allows source-backed action phrases", () => {
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: "Security Officer",
      jobDescription:
        "Support access control, document incidents, and maintain routine safety coverage.",
      contextClass: "cv_direct",
      allowedFactsPack: buildAllowedFactsPack({
        personalizationContext: {
          name: "Test Candidate",
          summary: "Security Guard with access control monitoring and incident documentation experience.",
          recentExperience: [
            {
              company: "Sentinel Services",
              position: "Security Guard",
              highlights: [
                "Monitored access points and documented safety incidents.",
                "Maintained routine reporting across security shifts.",
              ],
            },
          ],
        },
        jobTitle: "Security Officer",
        jobDescription:
          "Support access control, document incidents, and maintain routine safety coverage.",
      }),
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack: buildAllowedFactsPack({
          personalizationContext: {
            name: "Test Candidate",
            summary: "Security Guard with access control monitoring and incident documentation experience.",
            recentExperience: [
              {
                company: "Sentinel Services",
                position: "Security Guard",
                highlights: [
                  "Monitored access points and documented safety incidents.",
                  "Maintained routine reporting across security shifts.",
                ],
              },
            ],
          },
          jobTitle: "Security Officer",
          jobDescription:
            "Support access control, document incidents, and maintain routine safety coverage.",
        }),
        jobTitle: "Security Officer",
        jobDescription:
          "Support access control, document incidents, and maintain routine safety coverage.",
        contextClass: "cv_direct",
      }),
    });

    const keywordListIssues = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "Skills: access control monitoring, incident documentation, HIPAA, and OSHA.",
        proofBlock:
          "I monitored access points and documented safety incidents across shifts.",
        employerValueBlock:
          "That work supports routine facility safety and clear reporting.",
        closeLine: "I would welcome the opportunity to contribute to your team.",
      },
    });

    const complianceIssues = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "I bring HIPAA compliance and JCAHO standards to security work.",
        proofBlock:
          "I monitored access points and documented safety incidents across shifts.",
        employerValueBlock:
          "That work supports routine facility safety and clear reporting.",
        closeLine: "I would welcome the opportunity to contribute to your team.",
      },
    });

    const safeIssues = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "I supported access control monitoring and incident documentation across shifts.",
        proofBlock:
          "I monitored access points and documented safety incidents across shifts.",
        employerValueBlock:
          "That work supports routine facility safety and clear reporting.",
        closeLine: "I would welcome the opportunity to contribute to your team.",
      },
    });

    expect(keywordListIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ats_keyword_list",
          repairable: false,
        }),
      ]),
    );
    expect(complianceIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_compliance_framework",
          repairable: false,
        }),
      ]),
    );
    expect(safeIssues).toEqual([]);
  });

  it("fails closed on unsupported security ownership and fabricated mission claims", () => {
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: "Security Officer",
      jobDescription:
        "Support visitors and staff, lead emergency preparedness drills, and manage and document safety incidents.",
      contextClass: "cv_direct",
      allowedFactsPack: buildAllowedFactsPack({
        personalizationContext: {
          name: "Test Candidate",
          summary: "Security Guard with monitoring and reporting experience.",
          recentExperience: [
            {
              company: "Sentinel Services",
              position: "Security Guard",
              highlights: [
                "Maintained environments by monitoring grounds and equipment controls.",
                "Completed reports by recording observations and occurrences.",
              ],
            },
          ],
        },
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, lead emergency preparedness drills, and manage and document safety incidents.",
      }),
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack: buildAllowedFactsPack({
          personalizationContext: {
            name: "Test Candidate",
            summary: "Security Guard with monitoring and reporting experience.",
            recentExperience: [
              {
                company: "Sentinel Services",
                position: "Security Guard",
                highlights: [
                  "Maintained environments by monitoring grounds and equipment controls.",
                  "Completed reports by recording observations and occurrences.",
                ],
              },
            ],
          },
          jobTitle: "Security Officer",
          jobDescription:
            "Support visitors and staff, lead emergency preparedness drills, and manage and document safety incidents.",
        }),
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, lead emergency preparedness drills, and manage and document safety incidents.",
        contextClass: "cv_direct",
      }),
    });

    const issues = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "My monitoring and reporting experience fits security work on a healthcare campus.",
        proofBlock:
          "I am adept at leading emergency preparedness drills and my experience includes managing and documenting safety incidents.",
        employerValueBlock:
          "That work supports Northstar Care's mission of safeguarding patients and staff.",
        closeLine:
          "I am ready to contribute to reimagining healthcare security.",
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_security_ownership",
          repairable: false,
        }),
        expect.objectContaining({
          code: "fabricated_mission_claim",
          repairable: false,
        }),
      ]),
    );
  });

  it("fails unsupported emergency ownership but allows supported emergency readiness phrasing", () => {
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: "Security Officer",
      jobDescription:
        "Support visitors and staff, document incidents, and maintain emergency readiness.",
      contextClass: "cv_direct",
      allowedFactsPack: buildAllowedFactsPack({
        personalizationContext: {
          name: "Test Candidate",
          summary: "Security Guard with monitoring and reporting experience.",
          recentExperience: [
            {
              company: "Sentinel Services",
              position: "Security Guard",
              highlights: [
                "Monitored access points and documented safety incidents.",
                "Maintained routine reporting across security shifts.",
              ],
            },
          ],
        },
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, document incidents, and maintain emergency readiness.",
      }),
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack: buildAllowedFactsPack({
          personalizationContext: {
            name: "Test Candidate",
            summary: "Security Guard with monitoring and reporting experience.",
            recentExperience: [
              {
                company: "Sentinel Services",
                position: "Security Guard",
                highlights: [
                  "Monitored access points and documented safety incidents.",
                  "Maintained routine reporting across security shifts.",
                ],
              },
            ],
          },
          jobTitle: "Security Officer",
          jobDescription:
            "Support visitors and staff, document incidents, and maintain emergency readiness.",
        }),
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, document incidents, and maintain emergency readiness.",
        contextClass: "cv_direct",
      }),
    });

    const unsafeIssues = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "I monitored access points and documented safety incidents across shifts.",
        proofBlock:
          "I managed safety incidents and led emergency drills as part of my work.",
        employerValueBlock:
          "That work supports routine facility safety and clear reporting.",
        closeLine: "I would welcome the opportunity to contribute to your team.",
      },
    });

    const safeIssues = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "I monitored access points and documented safety incidents across shifts.",
        proofBlock:
          "I supported emergency readiness by documenting incidents and monitoring access points.",
        employerValueBlock:
          "That work supports routine facility safety and clear reporting.",
        closeLine: "I would welcome the opportunity to contribute to your team.",
      },
    });

    expect(unsafeIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_security_ownership",
          repairable: false,
        }),
      ]),
    );
    expect(safeIssues).toEqual([]);
  });

  it("fails provider-inflated incident, license, and education claims without CV support", () => {
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: "Security Officer",
      jobDescription:
        "Support visitors and staff, document incidents, maintain emergency readiness, and hold a driver's license before hire.",
      contextClass: "cv_direct",
      allowedFactsPack: buildAllowedFactsPack({
        personalizationContext: {
          name: "Test Candidate",
          summary: "Security Guard with monitoring and reporting experience.",
          recentExperience: [
            {
              company: "Sentinel Services",
              position: "Security Guard",
              highlights: [
                "Monitored access points and documented safety incidents.",
                "Maintained routine reporting across security shifts.",
              ],
            },
          ],
        },
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, document incidents, maintain emergency readiness, and hold a driver's license before hire.",
      }),
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack: buildAllowedFactsPack({
          personalizationContext: {
            name: "Test Candidate",
            summary: "Security Guard with monitoring and reporting experience.",
            recentExperience: [
              {
                company: "Sentinel Services",
                position: "Security Guard",
                highlights: [
                  "Monitored access points and documented safety incidents.",
                  "Maintained routine reporting across security shifts.",
                ],
              },
            ],
          },
          jobTitle: "Security Officer",
          jobDescription:
            "Support visitors and staff, document incidents, maintain emergency readiness, and hold a driver's license before hire.",
        }),
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, document incidents, maintain emergency readiness, and hold a driver's license before hire.",
        contextClass: "cv_direct",
      }),
    });

    const issues = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "My background in monitoring grounds and managing safety incidents aligns directly with this role.",
        proofBlock:
          "I documented safety incidents to identify and resolve hazards before they escalated.",
        employerValueBlock:
          "A valid driver's license and high school diploma further meet your core requirements without delay.",
        closeLine:
          "I look forward to discussing how my active driver's license can contribute to daily campus safety.",
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_security_ownership",
          repairable: false,
        }),
        expect.objectContaining({
          code: "unsupported_license_claim",
          repairable: false,
        }),
        expect.objectContaining({
          code: "unsupported_education_credential",
          repairable: false,
        }),
      ]),
    );
  });

  it("keeps premium safety validation gates fail-closed", () => {
    const brief = buildPremiumCoverLetterBrief({
      preset: "signature",
      outputLanguage: "English",
      jobTitle: "Security Officer",
      jobDescription:
        "Ascension needs a Security Officer to support visitors and staff, document incidents, maintain emergency readiness, hold a valid driver's license, have a bachelor's degree, and follow HIPAA and OSHA requirements.",
      contextClass: "cv_direct",
      allowedFactsPack: buildAllowedFactsPack({
        personalizationContext: {
          name: "Test Candidate",
          summary: "Security Guard with monitoring and reporting experience.",
          recentExperience: [
            {
              company: "Sentinel Services",
              position: "Security Guard",
              highlights: [
                "Monitored access points and documented visitor logs.",
                "Reported all-clear status during routine patrols.",
              ],
            },
          ],
        },
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, document incidents, maintain emergency readiness, hold a valid driver's license, have a bachelor's degree, and follow HIPAA and OSHA requirements.",
      }),
      rankedEvidencePack: rankAllowedFacts({
        allowedFactsPack: buildAllowedFactsPack({
          personalizationContext: {
            name: "Test Candidate",
            summary: "Security Guard with monitoring and reporting experience.",
            recentExperience: [
              {
                company: "Sentinel Services",
                position: "Security Guard",
                highlights: [
                  "Monitored access points and documented visitor logs.",
                  "Reported all-clear status during routine patrols.",
                ],
              },
            ],
          },
          jobTitle: "Security Officer",
          jobDescription:
            "Support visitors and staff, document incidents, maintain emergency readiness, hold a valid driver's license, have a bachelor's degree, and follow HIPAA and OSHA requirements.",
        }),
        jobTitle: "Security Officer",
        jobDescription:
          "Support visitors and staff, document incidents, maintain emergency readiness, hold a valid driver's license, have a bachelor's degree, and follow HIPAA and OSHA requirements.",
        contextClass: "cv_direct",
      }),
    });

    const issueCodes = validatePremiumCoverLetterBodyParts({
      brief,
      bodyParts: {
        opening:
          "A valid driver's license and high school diploma further meet your core requirements without delay.",
        proofBlock:
          "Skills: access control, emergency response, HIPAA, and OSHA.",
        employerValueBlock:
          "I am drawn to Ascension's mission of safeguarding patients, staff, and facilities.",
        closeLine:
          "I managed safety incidents, led emergency preparedness drills, and would contribute to your St. team.",
      },
    }).map((issue) => issue.code);

    expect(issueCodes).toEqual(
      expect.arrayContaining([
        "unsupported_security_ownership",
        "unsupported_license_claim",
        "unsupported_education_credential",
        "unsupported_compliance_framework",
        "fabricated_mission_claim",
        "clipped_source_fragment",
        "ats_keyword_list",
      ]),
    );
  });

  it("generates a direct signature cover letter with strongest evidence in context and no weak-qualification dominance", async () => {
    let capturedPrompt = "";

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: directContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      writer: async ({ prompt, schema }) => {
        capturedPrompt = prompt;
        expect(schema).toEqual(PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA);
        return {
          opening:
            "I am applying for the Senior Frontend Engineer role with a background in customer-facing web applications and reusable UI systems.",
          proofBlock:
            "I improved signup conversion by 11% after iterative UI experiments and led a design system migration used across 4 product squads.",
          employerValueBlock:
            "That mix of experimentation and system-level UI work is directly relevant to a role centered on design systems and customer-facing web applications.",
          closeLine:
            "I would welcome the opportunity to discuss the role further.",
        };
      },
    });

    expect(result).not.toBeNull();
    expect(result?.mode).toBe("direct");
    expect(result?.brief.topEvidence[0]).toContain("11%");
    expect(capturedPrompt).toContain(result?.brief.topEvidence[0] ?? "");
    expect(capturedPrompt).not.toContain("Excel");
    expect(result?.bodyParts.opening).not.toContain("Dear Hiring Manager");
    expect(result?.bodyParts.closeLine).not.toContain("Sincerely");
    expect(result?.content).toContain("Dear Hiring Manager,");
    expect(result?.content).toContain("Sincerely,");
    expect(result?.content).toContain("Alex Martin");
  });

  it("generates a direct expert cover letter with a substantive employerValueBlock", async () => {
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: directContext,
      voicePreset: "expert",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      writer: async () => ({
        opening:
          "The Senior Frontend Engineer role is a strong match for work I have done in customer-facing product environments.",
        proofBlock:
          "I improved signup conversion by 11% after iterative UI experiments, led a design system migration used across 4 product squads, and built experimentation dashboards used by product and growth teams.",
        employerValueBlock:
          "That combination is relevant to a role that depends on design-system discipline, experimentation workflows, and clear delivery across product teams.",
        closeLine:
          "I would welcome the opportunity to discuss the role further.",
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.mode).toBe("direct");
    expect(
      `${result?.brief.topEvidence.join(" ")} ${result?.brief.supportEvidence.join(" ")}`,
    ).toContain("design system");
    expect(result?.bodyParts.employerValueBlock.split(/\s+/).length).toBeGreaterThan(
      10,
    );
    expect(result?.bodyParts.closeLine).toBe(
      "That experience continues to inform my work.",
    );
    expect(result?.content).not.toContain(
      "I would welcome the opportunity to discuss the role further.",
    );
    expect(result?.qualityShadow?.issues ?? []).not.toContain("generic_tone");
  });

  it("compacts verbose Mistral body parts after validation without affecting premium success", async () => {
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: directContext,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: directJob.jobTitle,
      jobDescription: directJob.jobDescription,
      candidateName: "Alex Martin",
      writerProvider: "mistral",
      writerModel: "mistral-medium-latest",
      writer: async () => ({
        opening:
          "I improved signup conversion by 11% after iterative UI experiments. I led a design system migration used across 4 product squads.",
        proofBlock:
          "I led a design system migration used across 4 product squads. I built experimentation dashboards used by product and growth teams. I worked with React and TypeScript.",
        employerValueBlock:
          "That experimentation work supports product-facing iteration.",
        closeLine:
          "I bring experience in React and TypeScript. I would be glad to discuss the position further.",
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.bodyParts.opening).toBe(
      "I improved signup conversion by 11% after iterative UI experiments.",
    );
    expect(result?.bodyParts.proofBlock).toBe(
      "I led a design system migration used across 4 product squads. I built experimentation dashboards used by product and growth teams.",
    );
    expect(result?.bodyParts.employerValueBlock).toBe(
      "That experimentation work supports product-facing iteration.",
    );
    expect(result?.bodyParts.closeLine).toBe(
      "I bring experience in React and TypeScript.",
    );
    expect(result?.content).not.toContain("I worked with React and TypeScript.");
    expect(result?.content).not.toContain(
      "I would be glad to discuss the position further.",
    );
  });

  it("repairs a recoverable adjacent engaging cover letter without greeting or signoff leakage in body parts", async () => {
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: adjacentContext,
      voicePreset: "engaging",
      outputLanguage: "English",
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      candidateName: "Maya Chen",
      writer: async () => ({
        opening:
          "Dear Hiring Manager,\nI am interested in the Implementation Analyst role because my background stays close to reporting and cross-functional handoffs",
        proofBlock:
          "I reduced backlog response times by 18% through queue and handoff changes, and I built weekly dashboards to track bottlenecks and response times.",
        employerValueBlock: "",
        closeLine:
          "Sincerely,\nI would welcome the opportunity to discuss the role further.",
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.mode).toBe("transfer");
    expect(result?.brief.transferCore?.length).toBeGreaterThan(0);
    expect(result?.bodyParts.opening).not.toContain("Dear Hiring Manager");
    expect(result?.bodyParts.closeLine).not.toContain("Sincerely");
    expect(result?.bodyParts.employerValueBlock.split(/\s+/).length).toBeGreaterThan(
      8,
    );
    expect(result?.content).toContain("Dear Hiring Manager,");
    expect(result?.content).toContain("Sincerely,");
    expect(result?.content).toContain("Maya Chen");
  });

  it("normalizes default cv_adjacent output when the first draft claims direct target-role experience", async () => {
    let failure: any = null;

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: adjacentContext,
      voicePreset: "expert",
      outputLanguage: "English",
      jobTitle: adjacentJob.jobTitle,
      jobDescription: adjacentJob.jobDescription,
      candidateName: "Maya Chen",
      onFailure: (trace) => {
        failure = trace;
      },
      writer: async () => ({
        opening:
          "I am applying for the Implementation Analyst role with experience as an Implementation Analyst in cross-functional delivery environments.",
        proofBlock:
          "I reduced backlog response times by 18% through queue and handoff changes.",
        employerValueBlock:
          "That background would help keep reporting and handoffs aligned across teams.",
        closeLine:
          "I would welcome the opportunity to discuss the role further.",
      }),
    });

    expect(result).not.toBeNull();
    expect(failure).toBeNull();
    expect(result?.content).toContain(
      "I reduced backlog response times by 18% through queue and handoff changes.",
    );
    expect(result?.content).not.toContain("experience as an Implementation Analyst");
  });

  it("generates a no-CV premium cover letter without inventing candidate history", async () => {
    let capturedPrompt = "";
    const calls: string[] = [];

    const result = await withQualityRepairFlag("on", () =>
      attemptPremiumCoverLetterGeneration({
        personalizationContext: null,
        voicePreset: "signature",
        outputLanguage: "English",
        jobTitle: noCvJob.jobTitle,
        jobDescription: noCvJob.jobDescription,
        writer: async ({ prompt, schema }) => {
          calls.push(prompt);
          capturedPrompt = prompt;
          expect(schema).toEqual(PREMIUM_WRITER_OUTPUT_V1_JSON_SCHEMA);
          return {
            opening:
              "I am applying for the Operations Coordinator role because the work is centered on service requests, follow-through, and accurate day-to-day coordination.",
            proofBlock:
              "What stands out most is the need to track follow-up, keep records current, and keep scheduling and communication aligned across vendors and internal teams.",
            employerValueBlock:
              "That mix of documentation, communication, and steady coordination is clearly where the role creates value from day to day.",
            closeLine:
              "I would welcome the opportunity to discuss the role further.",
          };
        },
      }),
    );

    expect(result).not.toBeNull();
    expect(calls).toHaveLength(1);
    expect(result?.contextClass).toBe("no_cv");
    expect(result?.mode).toBe("no_cv");
    expect(result?.brief.candidateEvidenceAvailable).toBe(false);
    expect(result?.qualityRepair).toMatchObject({
      enabled: true,
      eligible: false,
      attempted: false,
      outcome: "not_needed",
    });
    expect(result?.brief.topEvidence.join(" ")).not.toMatch(/Excel/i);
    expect(capturedPrompt).toContain("For no_cv, there is no supported candidate history.");
    expect(result?.content).toContain("Dear Hiring Manager,");
    expect(result?.content).toContain("Sincerely,");
    expect(result?.content).not.toMatch(/my experience|in previous roles|I have worked with/i);
  });

  it("scopes no-CV operational-identity validation while allowing conditional intent", () => {
    const noCvBrief = buildNoCvBrief();
    const directBrief = buildDirectFrontendBrief();
    const issueCodesFor = (text: string, brief = noCvBrief) =>
      validatePremiumCoverLetterBodyParts({
        bodyParts: {
          opening: text,
          proofBlock:
            "The role involves coordination, communication, and steady follow-through.",
          employerValueBlock:
            "Clear organization helps the team keep daily work moving.",
          closeLine:
            "I would welcome the opportunity to discuss the position further.",
        },
        brief,
      }).map((issue) => issue.code);

    for (const blocked of [
      "I focus on coordinating daily office operations.",
      "I handle scheduling and communication.",
      "I maintain organized administrative workflows.",
      "I bring discipline around coordination and follow-through.",
      "I specialize in keeping shared operations organized.",
    ]) {
      expect(issueCodesFor(blocked)).toContain("no_cv_history_claim");
      expect(issueCodesFor(blocked, directBrief)).not.toContain(
        "no_cv_history_claim",
      );
    }

    const allowedIssues = validatePremiumCoverLetterBodyParts({
      bodyParts: {
        opening:
          "I'm interested in this role because it involves structured coordination.",
        proofBlock:
          "I understand the role involves scheduling, correspondence, and follow-through.",
        employerValueBlock:
          "I would approach this work by keeping communication and handoffs clear.",
        closeLine:
          "I would focus on understanding the team's needs, and I would welcome the opportunity to discuss the position further.",
      },
      brief: noCvBrief,
    }).map((issue) => issue.code);

    expect(allowedIssues).not.toContain("no_cv_history_claim");
  });

  it("blocks French no-CV present-tense candidate operations while allowing conditional intent", () => {
    const noCvBrief = buildNoCvBrief();
    const issueCodesFor = (text: string) =>
      validatePremiumCoverLetterBodyParts({
        bodyParts: {
          opening: text,
          proofBlock:
            "Le poste implique coordination, communication et suivi régulier.",
          employerValueBlock:
            "Une organisation claire aide l'équipe à garder les opérations quotidiennes lisibles.",
          closeLine: "Je serais ravi d'en discuter.",
        },
        brief: noCvBrief,
      }).map((issue) => issue.code);

    for (const blocked of [
      "Je coordonne les opérations quotidiennes.",
      "Je gère la planification et la communication.",
      "Je m’occupe de garder les dossiers à jour.",
      "Je veille à maintenir des flux de travail organisés.",
      "Je suis spécialisé dans la coordination administrative.",
    ]) {
      expect(issueCodesFor(blocked)).toContain("no_cv_history_claim");
    }

    const allowedIssues = validatePremiumCoverLetterBodyParts({
      bodyParts: {
        opening:
          "Je souhaite échanger sur ce rôle parce qu'il implique une coordination structurée.",
        proofBlock:
          "Le poste implique de maintenir l'organisation, la communication et le suivi.",
        employerValueBlock:
          "Je veillerais à aborder ce travail avec méthode et clarté.",
        closeLine: "Je serais ravi d'en discuter.",
      },
      brief: noCvBrief,
    }).map((issue) => issue.code);

    expect(allowedIssues).not.toContain("no_cv_history_claim");
  });

  it("allows no-CV premium drafts that keep job surface separate from candidate intent", async () => {
    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: null,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      writer: async () => ({
        opening:
          "I'm interested in this role because it involves structured coordination, clear communication, and reliable day-to-day operations.",
        proofBlock:
          "The position appears to focus on maintaining organization, handling communication between teams, and ensuring consistent follow-through.",
        employerValueBlock:
          "I would approach this work by keeping the role's communication and follow-through needs clear.",
        closeLine:
          "I would be glad to discuss how I would approach this type of work.",
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.contextClass).toBe("no_cv");
    expect(result?.finalProvenance?.status).toBe("untrusted_no_cv");
    expect(result?.finalProvenance?.verifiedCandidateFactIds).toHaveLength(0);
    expect(result?.qualityRepair).toMatchObject({
      enabled: false,
      eligible: false,
      attempted: false,
      outcome: "disabled",
    });
  });

  it("fails closed when a French no-CV premium draft turns job surface into candidate operations", async () => {
    let failure: any = null;

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: null,
      voicePreset: "signature",
      outputLanguage: "French",
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      onFailure: (trace) => {
        failure = trace;
      },
      writer: async () => ({
        opening:
          "Je coordonne les opérations quotidiennes avec attention à la planification et à la communication.",
        proofBlock:
          "Je gère les échanges entre équipes et je m’occupe de garder les dossiers à jour.",
        employerValueBlock:
          "Je veille à maintenir des flux de travail organisés.",
        closeLine:
          "Je suis spécialisé dans la coordination administrative.",
      }),
    });

    expect(result).toBeNull();
    expect(failure).toEqual({
      stage: "validation",
      reason: "non_repairable_validation",
      contextClass: "no_cv",
      issues: expect.arrayContaining(["no_cv_uses_candidate_fact"]),
    });
  });

  it("fails closed when a no-CV premium draft invents prior experience", async () => {
    let failure: any = null;

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: null,
      voicePreset: "expert",
      outputLanguage: "English",
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      onFailure: (trace) => {
        failure = trace;
      },
      writer: async () => ({
        opening:
          "I am applying for the Operations Coordinator role with experience coordinating service requests in previous roles.",
        proofBlock:
          "I managed vendor follow-up and kept records current across multiple teams.",
        employerValueBlock:
          "That experience would help me step into the role immediately.",
        closeLine:
          "I would welcome the opportunity to discuss the role further.",
      }),
    });

    expect(result).toBeNull();
    expect(failure).toEqual({
      stage: "validation",
      reason: "non_repairable_validation",
      contextClass: "no_cv",
      issues: expect.arrayContaining(["no_cv_uses_candidate_fact"]),
    });
  });

  it("fails closed when a no-CV premium draft turns job surface into present-tense candidate operations", async () => {
    let failure: any = null;

    const result = await attemptPremiumCoverLetterGeneration({
      personalizationContext: null,
      voicePreset: "signature",
      outputLanguage: "English",
      jobTitle: noCvJob.jobTitle,
      jobDescription: noCvJob.jobDescription,
      onFailure: (trace) => {
        failure = trace;
      },
      writer: async () => ({
        opening:
          "I focus on coordinating daily office operations with attention to scheduling, correspondence, and onboarding logistics.",
        proofBlock:
          "I handle scheduling, communication, and reliable day-to-day operations.",
        employerValueBlock:
          "I bring discipline around coordination, documentation, and follow-through.",
        closeLine:
          "I specialize in maintaining organized workflows for busy teams.",
      }),
    });

    expect(result).toBeNull();
    expect(failure).toEqual({
      stage: "validation",
      reason: "non_repairable_validation",
      contextClass: "no_cv",
      issues: expect.arrayContaining(["no_cv_uses_candidate_fact"]),
    });
  });

  it("reads the premium feature flag conservatively", () => {
    expect(isCoverLetterPremiumPathV1Enabled("1")).toBe(true);
    expect(isCoverLetterPremiumPathV1Enabled("true")).toBe(true);
    expect(isCoverLetterPremiumPathV1Enabled("on")).toBe(true);
    expect(isCoverLetterPremiumPathV1Enabled("off")).toBe(false);
    expect(isCoverLetterPremiumPathV1Enabled("")).toBe(false);
  });

  it("reads the quality repair flag conservatively", () => {
    expect(isCoverLetterQualityRepairV1Enabled("1")).toBe(true);
    expect(isCoverLetterQualityRepairV1Enabled("true")).toBe(true);
    expect(isCoverLetterQualityRepairV1Enabled("on")).toBe(true);
    expect(isCoverLetterQualityRepairV1Enabled("false")).toBe(false);
    expect(isCoverLetterQualityRepairV1Enabled("0")).toBe(false);
    expect(isCoverLetterQualityRepairV1Enabled("off")).toBe(false);
    expect(isCoverLetterQualityRepairV1Enabled("")).toBe(false);
  });

  it("reads the premium prompt V2 flag conservatively and gates it to Mistral provider", () => {
    expect(isCoverLetterPremiumPromptV2Enabled("1")).toBe(true);
    expect(isCoverLetterPremiumPromptV2Enabled("true")).toBe(true);
    expect(isCoverLetterPremiumPromptV2Enabled("on")).toBe(true);
    expect(isCoverLetterPremiumPromptV2Enabled("off")).toBe(false);
    expect(isCoverLetterPremiumPromptV2Enabled("")).toBe(false);
    expect(
      isPremiumCoverLetterPromptV2MistralEnabled({
        writerProvider: "mistral",
        rawFlagValue: "1",
      }),
    ).toBe(true);
    expect(
      isPremiumCoverLetterPromptV2MistralEnabled({
        writerProvider: "openai",
        rawFlagValue: "1",
      }),
    ).toBe(false);
    expect(
      isPremiumCoverLetterPromptV2MistralEnabled({
        writerProvider: "unknown",
        rawFlagValue: "1",
      }),
    ).toBe(false);
  });

  it("accepts the ENABLE_* env convention for the premium flag", () => {
    process.env.ENABLE_COVER_LETTER_PREMIUM_PATH_V1 = "1";
    try {
      expect(isCoverLetterPremiumPathV1Enabled()).toBe(true);
    } finally {
      delete process.env.ENABLE_COVER_LETTER_PREMIUM_PATH_V1;
    }
  });

  it("defaults the premium writer model to gpt-5.5 and safely accepts smaller fallbacks", () => {
    delete process.env.COVER_LETTER_PREMIUM_WRITER_MODEL;
    expect(resolvePremiumCoverLetterWriterModel()).toBe("gpt-5.5");

    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL = "gpt-5.4";
    expect(resolvePremiumCoverLetterWriterModel()).toBe("gpt-5.4");

    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL = "gpt-5-mini";
    expect(resolvePremiumCoverLetterWriterModel()).toBe("gpt-5-mini");

    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL = "unsupported-model";
    expect(resolvePremiumCoverLetterWriterModel()).toBe("gpt-5.5");

    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL = "gpt-5.6-sol";
    expect(resolvePremiumCoverLetterWriterModel()).toBe("gpt-5.5");

    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL = "gpt-5.6-terra";
    expect(resolvePremiumCoverLetterWriterModel()).toBe("gpt-5.5");

    process.env.COVER_LETTER_PREMIUM_WRITER_MODEL = "gpt-5.6-luna";
    expect(resolvePremiumCoverLetterWriterModel()).toBe("gpt-5.5");

    delete process.env.COVER_LETTER_PREMIUM_WRITER_MODEL;
  });
});
