import { describe, expect, it } from "vitest";

import type {
  ClaimPlanV1,
  FactGraphV1,
  JobDemandGraphV1,
  PremiumWriterOutputV1,
} from "../premiumCoverLetter";
import {
  analyzeEnglishCvBackedQualityGate,
  validateEnglishCvBackedQualityGate,
} from "../premiumCoverLetterEnglishQualityGate";
import {
  canonicalizePremiumCoverLetterNoun,
  canonicalizePremiumCoverLetterToken,
  expandPremiumCoverLetterTokenVariants,
} from "../premiumCoverLetterTokenNormalization";

const factGraph: FactGraphV1 = {
  version: "fact_graph_v1",
  facts: [
    {
      id: "fact_opening",
      text: "Reduced onboarding backlog by 24 percent.",
      source: "cv",
      sourcePath: "cv.highlight.0",
      confidence: "high",
      category: "achievement",
      metrics: ["24%"],
      entities: ["onboarding backlog"],
      allowedVerbs: ["reduced"],
      forbiddenUpgrades: ["owned"],
      ownershipLevel: "support",
    },
    {
      id: "fact_proof",
      text: "Documented handoffs for three implementation teams.",
      source: "cv",
      sourcePath: "cv.highlight.1",
      confidence: "high",
      category: "responsibility",
      metrics: ["three"],
      entities: ["implementation teams"],
      allowedVerbs: ["documented"],
      forbiddenUpgrades: ["managed"],
      ownershipLevel: "support",
    },
    {
      id: "fact_close",
      text: "Maintained weekly reporting for delivery teams.",
      source: "cv",
      sourcePath: "cv.highlight.2",
      confidence: "high",
      category: "workflow",
      metrics: [],
      entities: ["weekly reporting", "delivery teams"],
      allowedVerbs: ["maintained"],
      forbiddenUpgrades: ["led"],
      ownershipLevel: "support",
    },
    {
      id: "fact_close_extra",
      text: "Maintained release notes for product teams.",
      source: "cv",
      sourcePath: "cv.highlight.3",
      confidence: "high",
      category: "workflow",
      metrics: [],
      entities: ["release notes", "product teams"],
      allowedVerbs: ["maintained"],
      forbiddenUpgrades: ["led"],
      ownershipLevel: "support",
    },
  ],
};

const claimPlan: ClaimPlanV1 = {
  version: "claim_plan_v1",
  contextClass: "cv_direct",
  language: "English",
  targetRole: "Implementation Analyst",
  preset: "signature",
  globalForbidden: [],
  claims: [
    {
      id: "claim_opening_001",
      section: "opening",
      factIds: ["fact_opening"],
      demandIds: [],
      claimType: "source_backed",
      requiredElements: [],
      allowedVerbs: [],
      forbiddenVerbs: [],
      forbiddenClaims: [],
      maxOwnership: "support",
      allowEmployerBridge: false,
      editorialGuideline: "",
    },
    {
      id: "claim_proof_001",
      section: "proofBlock",
      factIds: ["fact_proof"],
      demandIds: [],
      claimType: "source_backed",
      requiredElements: [],
      allowedVerbs: [],
      forbiddenVerbs: [],
      forbiddenClaims: [],
      maxOwnership: "support",
      allowEmployerBridge: false,
      editorialGuideline: "",
    },
    {
      id: "claim_employer_value_001",
      section: "employerValueBlock",
      factIds: ["fact_close"],
      demandIds: [],
      claimType: "source_backed",
      requiredElements: [],
      allowedVerbs: [],
      forbiddenVerbs: [],
      forbiddenClaims: [],
      maxOwnership: "support",
      allowEmployerBridge: true,
      editorialGuideline: "",
    },
    {
      id: "claim_close_001",
      section: "closeLine",
      factIds: [],
      demandIds: [],
      claimType: "source_backed",
      requiredElements: [],
      allowedVerbs: [],
      forbiddenVerbs: [],
      forbiddenClaims: [],
      maxOwnership: "support",
      allowEmployerBridge: false,
      editorialGuideline: "",
    },
  ],
};

function part(
  section: "opening" | "proofBlock" | "employerValueBlock" | "closeLine",
  text: string,
  factIds: string[],
): PremiumWriterOutputV1["bodyParts"][typeof section] {
  const claimIdBySection = {
    opening: "claim_opening_001",
    proofBlock: "claim_proof_001",
    employerValueBlock: "claim_employer_value_001",
    closeLine: "claim_close_001",
  } as const;
  return {
    section,
    text,
    claimIds: [claimIdBySection[section]],
    factIds,
    demandIds: [],
  };
}

function output(args: {
  opening: string;
  proofBlock: string;
  employerValueBlock: string;
  closeLine: string;
  openingFacts?: string[];
  proofFacts?: string[];
  employerFacts?: string[];
  closeFacts?: string[];
}): PremiumWriterOutputV1 {
  return {
    version: "premium_writer_output_v1",
    bodyParts: {
      opening: part(
        "opening",
        args.opening,
        args.openingFacts ?? ["fact_opening"],
      ),
      proofBlock: part(
        "proofBlock",
        args.proofBlock,
        args.proofFacts ?? ["fact_proof"],
      ),
      employerValueBlock: part(
        "employerValueBlock",
        args.employerValueBlock,
        args.employerFacts ?? ["fact_close"],
      ),
      closeLine: part("closeLine", args.closeLine, args.closeFacts ?? []),
    },
  };
}

describe("English CV-backed quality gate", () => {
  it("accepts complete, disjoint evidence across all four sections", () => {
    expect(
      validateEnglishCvBackedQualityGate({
        writerOutput: output({
          opening: "I reduced the onboarding backlog by 24%.",
          proofBlock: "I documented handoffs for three implementation teams.",
          employerValueBlock:
            "That reporting supports clear delivery handoffs.",
          closeLine: "I would bring that discipline to the team.",
        }),
        claimPlan,
        factGraph,
      }),
    ).toEqual([]);
  });

  it("keeps the same gate contract for English adjacent CV-backed output", () => {
    expect(
      validateEnglishCvBackedQualityGate({
        writerOutput: output({
          opening: "I reduced the onboarding backlog by 24%.",
          proofBlock: "I documented handoffs for three implementation teams.",
          employerValueBlock:
            "That reporting supports clear delivery handoffs.",
          closeLine: "I would bring that discipline to the team.",
        }),
        claimPlan: { ...claimPlan, contextClass: "cv_adjacent" },
        factGraph,
      }),
    ).toEqual([]);
  });

  it("does not block cross-section fact overlap authorized by both claims", () => {
    const overlappingClaimPlan: ClaimPlanV1 = {
      ...claimPlan,
      claims: claimPlan.claims.map((claim) =>
        claim.section === "employerValueBlock" || claim.section === "closeLine"
          ? {
              ...claim,
              factIds: [...claim.factIds, "fact_opening"],
            }
          : claim,
      ),
    };

    const analysis = analyzeEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock:
          "That onboarding experience supports disciplined delivery handoffs.",
        closeLine: "I would bring that backlog discipline to the team.",
        employerFacts: ["fact_opening"],
        closeFacts: ["fact_opening"],
      }),
      claimPlan: overlappingClaimPlan,
      factGraph,
    });

    expect(analysis.issues).toEqual([]);
    expect(analysis.observations).toEqual([
      {
        code: "intentional_claim_overlap",
        section: "employerValueBlock",
        otherSection: "opening",
        factId: "fact_opening",
      },
      {
        code: "intentional_claim_overlap",
        section: "closeLine",
        otherSection: "opening",
        factId: "fact_opening",
      },
    ]);
  });

  it("reports unexpected reuse separately from visible duplication", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I coordinated implementation handoffs.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
        proofFacts: ["fact_opening"],
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "unexpected_writer_reuse",
      section: "proofBlock",
      otherSection: "opening",
      factId: "fact_opening",
    });
    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "duplicate_visible_sentence" }),
    );
  });

  it("fails closed on repeated visible evidence and repeated fact IDs, without rewriting text", () => {
    const writerOutput = output({
      opening: "I reduced the onboarding backlog by 24%.",
      proofBlock: "I reduced the onboarding backlog by 24%.",
      employerValueBlock: "I reduced the onboarding backlog by 24%.",
      closeLine: "I reduced the onboarding backlog by 24%.",
      proofFacts: ["fact_opening"],
      employerFacts: ["fact_opening"],
      closeFacts: ["fact_opening"],
    });

    const before = JSON.stringify(writerOutput);
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput,
      claimPlan: {
        ...claimPlan,
        claims: claimPlan.claims.map((claim) => ({
          ...claim,
          factIds:
            claim.section === "closeLine" ? ["fact_opening"] : claim.factIds,
        })),
      },
      factGraph,
    });

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "unexpected_writer_reuse",
        "duplicate_visible_sentence",
        "duplicate_visible_metric",
      ]),
    );
    expect(JSON.stringify(writerOutput)).toBe(before);
  });

  it("fails closed when visible metrics are not supported by section facts", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 99%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "99%",
    });
  });

  it("normalizes decimal precision, decimal commas, and thousands separators in metrics", () => {
    const metricFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Reduced a backlog of 1,000 items by 24% over 3,5 years.",
              metrics: ["1,000", "24%", "3,5 years"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced a backlog of 1000 items by 24.0% over 3.5 years.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: metricFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "unsupported_visible_metric" }),
    );

    const misreadIssues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced a backlog of 1000 items by 24.0% over 35 years.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: metricFactGraph,
    });

    expect(misreadIssues).toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "35",
    });
  });

  it("preserves the quantified noun through inserted adjectives", () => {
    const metricFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_proof"
          ? {
              ...fact,
              text: "Led delivery across 4 product squads.",
              metrics: ["4"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I led delivery across 4 cross-functional product squads.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: metricFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "unsupported_visible_metric" }),
    );
  });

  it("matches a metric when its quantified noun moves before the number", () => {
    const metricFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Managed a portfolio budget of $4M.",
              metrics: ["$4M"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I managed a $4M portfolio budget.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: metricFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "unsupported_visible_metric" }),
    );
  });

  it("matches a metric when its quantified noun moves after the number", () => {
    const metricFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Managed a $4M portfolio budget.",
              metrics: ["$4M"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "The portfolio budget I managed was $4M.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: metricFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "unsupported_visible_metric" }),
    );
  });

  it("stops metric measurement at a trailing clause boundary", () => {
    const metricFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Led delivery across 4 product squads during a migration.",
              metrics: ["4"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I led delivery across 4 product squads.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: metricFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "unsupported_visible_metric" }),
    );
  });

  it("preserves the head noun through a gerund compound modifier", () => {
    const engineeringFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Supported 20 software engineering teams.",
              metrics: ["20"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I supported 20 engineering teams.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: engineeringFactGraph,
    });

    expect(issues).not.toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "20",
    });
  });

  it.each([
    {
      name: "client and customer",
      sourceText: "Served 100 clients.",
      sourceMetrics: ["100"],
      generatedText: "I served 100 customers.",
    },
    {
      name: "currency symbol and ISO currency code",
      sourceText: "Managed a $4M portfolio.",
      sourceMetrics: ["$4M"],
      generatedText: "I managed a USD 4 million portfolio.",
    },
    {
      name: "currency symbol and trailing ISO currency code",
      sourceText: "Managed a $4M portfolio.",
      sourceMetrics: ["$4M"],
      generatedText: "I managed a 4 million USD portfolio.",
    },
  ])(
    "matches semantic metric paraphrases for $name",
    ({ sourceText, sourceMetrics, generatedText }) => {
      const metricFactGraph: FactGraphV1 = {
        ...factGraph,
        facts: factGraph.facts.map((fact) =>
          fact.id === "fact_opening"
            ? {
                ...fact,
                text: sourceText,
                metrics: sourceMetrics,
              }
            : fact,
        ),
      };
      const issues = validateEnglishCvBackedQualityGate({
        writerOutput: output({
          opening: generatedText,
          proofBlock: "I documented handoffs for three implementation teams.",
          employerValueBlock:
            "That reporting supports clear delivery handoffs.",
          closeLine: "I would bring that discipline to the team.",
        }),
        claimPlan,
        factGraph: metricFactGraph,
      });

      expect(issues).not.toContainEqual(
        expect.objectContaining({ code: "unsupported_visible_metric" }),
      );
    },
  );

  it("does not misread a compound written hundred as its leading unit", () => {
    const metricFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Supported 100 customers.",
              metrics: ["100"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I supported one hundred customers.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: metricFactGraph,
    });

    expect(issues).not.toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "1",
    });
  });

  it("preserves distinct quantified head nouns with the same derivational root", () => {
    const metricFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Supported 4 operations.",
              metrics: ["4"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I supported 4 operators.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: metricFactGraph,
    });

    expect(canonicalizePremiumCoverLetterNoun("operations")).toBe("operation");
    expect(canonicalizePremiumCoverLetterNoun("operators")).toBe("operator");
    expect(issues).toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "4",
    });
  });

  it("rejects unsupported written-out quantitative claims", () => {
    const unmeasuredFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Managed product squads.",
              metrics: [],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I managed five product squads.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: unmeasuredFactGraph,
    });

    expect(issues).toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "5",
    });
  });

  it("rejects unsupported compound written-out quantitative claims", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I supported one hundred clients.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "100",
    });
  });

  it("does not treat the tail of a conjunction compound as supported", () => {
    const conjunctionFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Supported one hundred and twenty clients.",
              metrics: ["120"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I supported twenty clients.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: conjunctionFactGraph,
    });

    expect(issues).toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "20",
    });
  });

  it("preserves signs on written-out percentage claims", () => {
    const signedWrittenFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Changed churn by five percent.",
              metrics: ["5%"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I changed churn by negative five percent.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: signedWrittenFactGraph,
    });

    expect(issues).toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "-5%",
    });
  });

  it("validates measurable hyphenated written quantities", () => {
    const durationFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Completed a five-year program.",
              metrics: ["5"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I completed a ten-year program.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: durationFactGraph,
    });

    expect(issues).toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "10",
    });
  });

  it("keeps the quantified duration head before experience", () => {
    const experienceFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Brought 5 years of experience.",
              metrics: ["5"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I bring 5 years experience.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: experienceFactGraph,
    });

    expect(issues).not.toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "5",
    });
  });

  it.each([
    "One reason I improved delivery was clearer handoffs.",
    "One practical advantage is my structured follow-through.",
    "One specific contribution I would bring is clearer reporting.",
    "One strength I would bring is structured follow-through.",
    "One thing I value most is client onboarding.",
    "I held one-on-one meetings with delivery teams.",
    "I provided one-to-one coaching across the team.",
    "I maintained two-way communication across teams.",
  ])("does not treat non-quantitative cardinal prose as a metric: %s", (opening) => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening,
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({
        code: "unsupported_visible_metric",
        section: "opening",
      }),
    );
  });

  it("does not treat a cited numeric employer name as a visible metric", () => {
    const brandFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Worked at 3M improving onboarding.",
              metrics: [],
              entities: ["3M"],
            }
          : fact,
      ),
    };
    const brandClaimPlan: ClaimPlanV1 = {
      ...claimPlan,
      claims: claimPlan.claims.map((claim) =>
        claim.section === "proofBlock"
          ? { ...claim, factIds: ["fact_opening"] }
          : claim,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "At 3M, I improved onboarding.",
        proofBlock: "My work at 3M supported delivery teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
        proofFacts: ["fact_opening"],
      }),
      claimPlan: brandClaimPlan,
      factGraph: brandFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({
        code: "unsupported_visible_metric",
        metric: "3000000",
      }),
    );
    expect(issues).not.toContainEqual(
      expect.objectContaining({
        code: "duplicate_visible_metric",
        metric: "3000000",
      }),
    );
  });

  it.each([
    {
      sourceText: "Managed 5 product squads.",
      generatedText: "I managed five product squads.",
    },
    {
      sourceText: "Managed twenty-five product squads.",
      generatedText: "I managed 25 product squads.",
    },
    {
      sourceText: "Improved conversion by 5%.",
      generatedText: "I improved conversion by five percent.",
    },
  ])(
    "normalizes written and digit quantitative forms: $generatedText",
    ({ sourceText, generatedText }) => {
      const measuredFactGraph: FactGraphV1 = {
        ...factGraph,
        facts: factGraph.facts.map((fact) =>
          fact.id === "fact_opening"
            ? {
                ...fact,
                text: sourceText,
                metrics: [],
              }
            : fact,
        ),
      };
      const issues = validateEnglishCvBackedQualityGate({
        writerOutput: output({
          opening: generatedText,
          proofBlock: "I documented handoffs for three implementation teams.",
          employerValueBlock:
            "That reporting supports clear delivery handoffs.",
          closeLine: "I would bring that discipline to the team.",
        }),
        claimPlan,
        factGraph: measuredFactGraph,
      });

      expect(issues).not.toContainEqual(
        expect.objectContaining({ code: "unsupported_visible_metric" }),
      );
    },
  );

  it.each([
    "Led 4 teams responsible for onboarding.",
    "Led 4 teams focused on onboarding.",
    "Led 4 teams based in Europe.",
    "Led 4 teams supporting onboarding.",
  ])("preserves a quantified head noun in: %s", (sourceText) => {
    const metricFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: sourceText,
              metrics: ["4"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I led 4 onboarding teams.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: metricFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "unsupported_visible_metric" }),
    );
  });

  it.each([
    "I gave 4 product squads a shared foundation.",
    "Those 4 product squads would use a shared foundation.",
    "Those 4 product squads were responsible for onboarding.",
  ])("stops a metric head noun before a new clause: %s", (generatedText) => {
    const metricFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Led 4 product squads.",
              metrics: ["4"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: generatedText,
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: metricFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "unsupported_visible_metric" }),
    );
  });

  it("accepts a numeral supported by the section's assigned job demand", () => {
    const demandId = "demand_always_on";
    const demandClaimPlan: ClaimPlanV1 = {
      ...claimPlan,
      claims: claimPlan.claims.map((claim) =>
        claim.section === "employerValueBlock"
          ? { ...claim, demandIds: [demandId] }
          : claim,
      ),
    };
    const jobDemandGraph: JobDemandGraphV1 = {
      version: "job_demand_graph_v1",
      priorityTokens: ["operation"],
      demands: [
        {
          id: demandId,
          text: "Support 24/7 operations.",
          bucket: "core_responsibility",
          requiredness: "core",
          tokens: ["support", "operation"],
          mustNotBecomeCandidateClaim: true,
        },
      ],
    };
    const writerOutput = output({
      opening: "I reduced the onboarding backlog by 24%.",
      proofBlock: "I documented handoffs for three implementation teams.",
      employerValueBlock:
        "That reporting supports accurate coverage for 24/7 operations.",
      closeLine: "I would bring that discipline to the team.",
    });
    writerOutput.bodyParts.employerValueBlock.demandIds = [demandId];

    const issues = validateEnglishCvBackedQualityGate({
      writerOutput,
      claimPlan: demandClaimPlan,
      factGraph,
      jobDemandGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({
        code: "unsupported_visible_metric",
        section: "employerValueBlock",
      }),
    );
  });

  it("preserves explicit metric signs", () => {
    const signedMetricFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Changed churn by -5%.",
              metrics: ["-5%"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I changed churn by +5%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: signedMetricFactGraph,
    });

    expect(issues).toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "5%",
    });
  });

  it.each(["built", "led", "improved"])(
    "accepts the finite verb %s after a participial opener",
    (predicate) => {
      const issues = validateEnglishCvBackedQualityGate({
        writerOutput: output({
          opening: "I reduced the onboarding backlog by 24%.",
          proofBlock: `Supported by product data, I ${predicate} a renewal workflow.`,
          employerValueBlock: "That reporting supports clear delivery handoffs.",
          closeLine: "I would bring that discipline to the team.",
        }),
        claimPlan,
        factGraph,
      });

      expect(issues).not.toContainEqual({
        code: "incomplete_sentence",
        section: "proofBlock",
      });
    },
  );

  it.each(["minus 5%", "negative 5%", "−5%"])(
    "normalizes the verbal sign in %s",
    (generatedMetric) => {
      const signedMetricFactGraph: FactGraphV1 = {
        ...factGraph,
        facts: factGraph.facts.map((fact) =>
          fact.id === "fact_opening"
            ? {
                ...fact,
                text: "Changed churn by -5%.",
                metrics: ["-5%"],
              }
            : fact,
        ),
      };
      const issues = validateEnglishCvBackedQualityGate({
        writerOutput: output({
          opening: `I changed churn by ${generatedMetric}.`,
          proofBlock: "I documented handoffs for three implementation teams.",
          employerValueBlock:
            "That reporting supports clear delivery handoffs.",
          closeLine: "I would bring that discipline to the team.",
        }),
        claimPlan,
        factGraph: signedMetricFactGraph,
      });

      expect(issues).not.toContainEqual(
        expect.objectContaining({ code: "unsupported_visible_metric" }),
      );
    },
  );

  it.each(["2019-2021", "2019 - 2021"])(
    "treats the hyphen in the date range %s as a separator",
    (generatedRange) => {
      const rangeFactGraph: FactGraphV1 = {
        ...factGraph,
        facts: factGraph.facts.map((fact) =>
          fact.id === "fact_opening"
            ? {
                ...fact,
                text: "Supported onboarding from 2019–2021.",
                metrics: ["2019", "2021"],
              }
            : fact,
        ),
      };
      const issues = validateEnglishCvBackedQualityGate({
        writerOutput: output({
          opening: `I supported onboarding from ${generatedRange}.`,
          proofBlock: "I documented handoffs for three implementation teams.",
          employerValueBlock:
            "That reporting supports clear delivery handoffs.",
          closeLine: "I would bring that discipline to the team.",
        }),
        claimPlan,
        factGraph: rangeFactGraph,
      });

      expect(issues).not.toContainEqual(
        expect.objectContaining({ code: "unsupported_visible_metric" }),
      );
    },
  );

  it("allows the same metric value when distinct section facts support it", () => {
    const sameNumberFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) => {
        if (fact.id === "fact_opening") {
          return {
            ...fact,
            text: "Led delivery across 4 product squads.",
            metrics: ["4"],
          };
        }
        if (fact.id === "fact_proof") {
          return {
            ...fact,
            text: "Delivered 4 migration projects.",
            metrics: ["4"],
          };
        }
        return fact;
      }),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I led delivery across 4 product squads.",
        proofBlock: "I delivered 4 migration projects.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: sameNumberFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "duplicate_visible_metric" }),
    );
  });

  it("does not attribute an ambiguous metric to every cited fact", () => {
    const sameNumberFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) => {
        if (fact.id === "fact_opening") {
          return {
            ...fact,
            text: "Led delivery across 4 product squads.",
            metrics: ["4"],
            entities: ["product squads"],
          };
        }
        if (fact.id === "fact_proof") {
          return {
            ...fact,
            text: "Delivered 4 migration projects.",
            metrics: ["4"],
            entities: ["migration projects"],
          };
        }
        return fact;
      }),
    };
    const overlappingClaimPlan: ClaimPlanV1 = {
      ...claimPlan,
      claims: claimPlan.claims.map((claim) =>
        claim.section === "opening"
          ? {
              ...claim,
              factIds: ["fact_opening", "fact_proof"],
            }
          : claim,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I led delivery across 4 product squads.",
        proofBlock: "I delivered 4 migration projects.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
        openingFacts: ["fact_opening", "fact_proof"],
      }),
      claimPlan: overlappingClaimPlan,
      factGraph: sameNumberFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "duplicate_visible_metric" }),
    );
  });

  it("does not split decimal metrics or abbreviations into duplicate fragments", () => {
    const decimalFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) => {
        if (fact.id === "fact_opening") {
          return {
            ...fact,
            text: "Improved conversion by 24.5% for U.S. delivery teams.",
            metrics: ["24.5%"],
          };
        }
        if (fact.id === "fact_proof") {
          return {
            ...fact,
            text: "Improved conversion by 24.7% for U.K. delivery teams.",
            metrics: ["24.7%"],
          };
        }
        return fact;
      }),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I improved conversion by 24.5% for U.S. delivery teams.",
        proofBlock: "I improved conversion by 24.7% for U.K. delivery teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: decimalFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "duplicate_visible_sentence" }),
    );
  });

  it.each(["Co.", "Corp.", "LLC.", "Ltd."])(
    "keeps the company suffix %s inside a continuing sentence",
    (suffix) => {
      const issues = validateEnglishCvBackedQualityGate({
        writerOutput: output({
          opening: `I worked at Acme ${suffix} on reporting workflows.`,
          proofBlock: `I worked at Acme ${suffix} before moving into onboarding.`,
          employerValueBlock:
            "That reporting supports clear delivery handoffs.",
          closeLine: "I would bring that discipline to the team.",
        }),
        claimPlan,
        factGraph,
      });

      expect(issues).not.toContainEqual(
        expect.objectContaining({ code: "duplicate_visible_sentence" }),
      );
    },
  );

  it("does not split title and number abbreviations into duplicate fragments", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "Dr. Smith improved onboarding handoffs in No. 5 unit.",
        proofBlock: "Dr. Jones documented migration handoffs in No. 7 unit.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "duplicate_visible_sentence" }),
    );
  });

  it.each(["U.S. Bank", "e.g. React", "J.P. Morgan"])(
    "keeps %s inside an uppercase proper-name continuation",
    (properName) => {
      const issues = validateEnglishCvBackedQualityGate({
        writerOutput: output({
          opening: `I worked with ${properName}.`,
          proofBlock: `I consulted ${properName}.`,
          employerValueBlock:
            "That reporting supports clear delivery handoffs.",
          closeLine: "I would bring that discipline to the team.",
        }),
        claimPlan,
        factGraph,
      });

      expect(issues).not.toContainEqual(
        expect.objectContaining({ code: "duplicate_visible_sentence" }),
      );
    },
  );

  it("detects a repeated sentence after an abbreviation ends the prior sentence", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening:
          "I coordinated teams across the U.S. I documented the handoffs.",
        proofBlock: "I documented the handoffs.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "duplicate_visible_sentence",
      section: "proofBlock",
      otherSection: "opening",
    });
  });

  it.each(["iOS", "eBay", "npm"])(
    "splits before the lowercase-styled proper noun %s after a terminal abbreviation",
    (properNoun) => {
      const repeatedSentence = `${properNoun} releases stayed reliable.`;
      const issues = validateEnglishCvBackedQualityGate({
        writerOutput: output({
          opening: `I worked at Acme Inc. ${repeatedSentence}`,
          proofBlock: repeatedSentence,
          employerValueBlock: "That reporting supports clear delivery handoffs.",
          closeLine: "I would bring that discipline to the team.",
        }),
        claimPlan,
        factGraph,
      });

      expect(issues).toContainEqual({
        code: "duplicate_visible_sentence",
        section: "proofBlock",
        otherSection: "opening",
      });
    },
  );

  it("detects a repeated proper-noun sentence after a terminal initialism", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening:
          "I coordinated teams across the U.S. Acme values disciplined delivery.",
        proofBlock: "Acme values disciplined delivery.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "duplicate_visible_sentence",
      section: "proofBlock",
      otherSection: "opening",
    });
  });

  it("detects a repeated sentence after a terminal list abbreviation", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening:
          "I handled scheduling, reporting, etc. I documented handoffs.",
        proofBlock: "I documented handoffs.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "duplicate_visible_sentence",
      section: "proofBlock",
      otherSection: "opening",
    });
  });

  it("does not treat numeric identifiers as evidence metrics", () => {
    const identifierFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text:
                "Built 3D workflows for 5G systems under ISO 27001 using Windows 10 and Python 3.",
              metrics: [],
            }
          : fact,
      ),
    };
    const overlappingClaimPlan: ClaimPlanV1 = {
      ...claimPlan,
      claims: claimPlan.claims.map((claim) =>
        claim.section === "proofBlock"
          ? {
              ...claim,
              factIds: ["fact_opening"],
            }
          : claim,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening:
          "I built 3D workflows for 5G systems under ISO 27001 using Windows 10 and Python 3.",
        proofBlock:
          "I documented 3D assets for 5G programs aligned with ISO-27001 on Windows 10 and Python 3.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
        proofFacts: ["fact_opening"],
      }),
      claimPlan: overlappingClaimPlan,
      factGraph: identifierFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "duplicate_visible_metric" }),
    );
    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "unsupported_visible_metric" }),
    );
  });

  it("parses compact magnitude suffixes as complete metrics", () => {
    const compactMetricFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Supported a $4M portfolio.",
              metrics: ["$4M"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I supported a $5M portfolio.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: compactMetricFactGraph,
    });

    expect(issues).toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "5000000",
    });
  });

  it("detects unsupported compact multiplier metrics", () => {
    const multiplierFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Grew revenue 2x.",
              metrics: ["2x"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I grew revenue 3x.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: multiplierFactGraph,
    });

    expect(issues).toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "3x",
    });
  });

  it("normalizes x and multiplication-sign multiplier metrics equivalently", () => {
    const multiplierFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Grew revenue 3x.",
              metrics: ["3x"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I grew revenue 3×.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: multiplierFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "unsupported_visible_metric" }),
    );
  });

  it("normalizes compact and spelled-out magnitude suffixes equivalently", () => {
    const compactMetricFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Supported a $4M portfolio.",
              metrics: ["$4M"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I supported a $4 million portfolio.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: compactMetricFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "unsupported_visible_metric" }),
    );
  });

  it("preserves currency in normalized metric identities", () => {
    const currencyFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Supported a $4M portfolio.",
              metrics: ["$4M"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I supported a €4M portfolio.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: currencyFactGraph,
    });

    expect(issues).toContainEqual({
      code: "unsupported_visible_metric",
      section: "opening",
      metric: "4000000",
    });
  });

  it("does not conflate equal counts for different measurements in one fact", () => {
    const measurementFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Led 4 teams across 4 countries.",
              metrics: ["4"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I led 4 teams across 4 countries.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: measurementFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "duplicate_visible_metric" }),
    );
  });

  it("keeps a quantified noun stable when the paraphrase adds an adverb", () => {
    const reportFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Managed 12 direct reports.",
              metrics: ["12"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I managed 12 reports directly.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: reportFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "unsupported_visible_metric" }),
    );
  });

  it("detects a supported metric repeated within one section", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening:
          "I reduced the onboarding backlog by 24%. That 24% result improved handoffs.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "duplicate_visible_metric",
      section: "opening",
      metric: "24%",
    });
  });

  it("attributes repeated metric values using each occurrence's sentence", () => {
    const sameNumberFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) => {
        if (fact.id === "fact_opening") {
          return {
            ...fact,
            text: "Led delivery across 4 product squads.",
            metrics: ["4"],
            entities: ["product squads"],
          };
        }
        if (fact.id === "fact_proof") {
          return {
            ...fact,
            text: "Delivered 4 migration projects.",
            metrics: ["4"],
            entities: ["migration projects"],
          };
        }
        return fact;
      }),
    };
    const overlappingClaimPlan: ClaimPlanV1 = {
      ...claimPlan,
      claims: claimPlan.claims.map((claim) =>
        claim.section === "opening"
          ? {
              ...claim,
              factIds: ["fact_opening", "fact_proof"],
            }
          : claim,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening:
          "I led delivery across 4 product squads. I delivered 4 migration projects.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
        openingFacts: ["fact_opening", "fact_proof"],
      }),
      claimPlan: overlappingClaimPlan,
      factGraph: sameNumberFactGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "duplicate_visible_metric" }),
    );
  });

  it("requires a fact reference when the assigned source-backed claim has facts", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I bring relevant implementation experience.",
        proofBlock: "I support dependable delivery.",
        employerValueBlock: "I would contribute effectively.",
        closeLine: "I would bring that discipline to the team.",
        openingFacts: [],
        proofFacts: [],
        employerFacts: [],
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        {
          code: "missing_fact_reference",
          section: "opening",
        },
        {
          code: "missing_fact_reference",
          section: "proofBlock",
        },
        {
          code: "missing_fact_reference",
          section: "employerValueBlock",
        },
      ]),
    );
  });

  it("rejects employer grounding based only on common anchor words", () => {
    const commonWordFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Worked with Acme.",
              entities: ["Acme"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "I would work with your team.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: commonWordFactGraph,
    });

    expect(issues).toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("rejects employer grounding based only on a generic team anchor", () => {
    const genericTeamFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Collaborated with the product team.",
              entities: ["product team"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "I would work well with your team.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: genericTeamFactGraph,
    });

    expect(issues).toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("rejects a generic token extracted from a title entity as grounding", () => {
    const genericTitleFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Worked as a Customer Support Specialist.",
              entities: ["Customer Support Specialist"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That support would help your team.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: genericTitleFactGraph,
    });

    expect(issues).toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("does not use a standalone written number as an evidence anchor", () => {
    const writtenNumberFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Supported three teams.",
              entities: [],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock:
          "Three priorities matter to your organization.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: writtenNumberFactGraph,
    });

    expect(issues).toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("preserves short CV acronyms as employer grounding anchors", () => {
    const acronymFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Worked in QA at IBM.",
              entities: ["QA", "IBM"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock:
          "That QA experience at IBM supports reliable delivery.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: acronymFactGraph,
    });

    expect(issues).not.toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("preserves a short title-case technology as a grounding anchor", () => {
    const technologyFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Used Git.",
              entities: ["Git"],
              allowedVerbs: ["used"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock:
          "That Git experience supports reliable delivery.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: technologyFactGraph,
    });

    expect(issues).not.toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("preserves accented CV entities as employer grounding anchors", () => {
    const accentedFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Worked at Café.",
              entities: ["Café"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock:
          "That Café experience supports reliable delivery.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: accentedFactGraph,
    });

    expect(issues).not.toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it.each(["C++", "C#", "R", "Go"])(
    "preserves the punctuation-bearing or single-letter technology anchor %s",
    (technology) => {
      const technologyFactGraph: FactGraphV1 = {
        ...factGraph,
        facts: factGraph.facts.map((fact) =>
          fact.id === "fact_close"
            ? {
                ...fact,
                text: `Built APIs in ${technology}.`,
                entities: [technology],
              }
            : fact,
        ),
      };
      const issues = validateEnglishCvBackedQualityGate({
        writerOutput: output({
          opening: "I reduced the onboarding backlog by 24%.",
          proofBlock: "I documented handoffs for three implementation teams.",
          employerValueBlock:
            `That ${technology} background supports systems work.`,
          closeLine: "I would bring that discipline to the team.",
        }),
        claimPlan,
        factGraph: technologyFactGraph,
      });

      expect(issues).not.toContainEqual({
        code: "employer_value_not_grounded",
        section: "employerValueBlock",
      });
    },
    );

  it("rejects generic experience as the only employer grounding anchor", () => {
    const genericExperienceFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Gained experience supporting delivery.",
              entities: [],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That experience would help in this role.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: genericExperienceFactGraph,
    });

    expect(issues).toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("rejects a single generic employer grounding token", () => {
    const genericDeliveryFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Led delivery across product squads.",
              entities: [],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "Delivery matters.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: genericDeliveryFactGraph,
    });

    expect(issues).toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("accepts an exact noun-and-verb echo from a sparse cited workflow fact", () => {
    const sparseWorkflowFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Supported workflows.",
              entities: [],
              allowedVerbs: ["supported"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock:
          "That workflow support is relevant to this work.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: sparseWorkflowFactGraph,
    });

    expect(issues).not.toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("compares generic employer anchors in canonical form", () => {
    const genericOperationsFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Coordinated operations.",
              entities: [],
              allowedVerbs: ["coordinated"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "Operations matter.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: genericOperationsFactGraph,
    });

    expect(issues).toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("does not treat a sentence-leading action verb as an entity anchor", () => {
    const verbEntityFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Managed schedules and tracked handoffs.",
              entities: ["Managed"],
              allowedVerbs: ["managed", "tracked"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock:
          "That management experience would help in this role.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: verbEntityFactGraph,
    });

    expect(issues).toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("does not treat a generic sentence opener as an entity anchor", () => {
    const genericEntityFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Strong communication.",
              entities: ["Strong"],
              allowedVerbs: [],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock:
          "That strong operational background would support dependable delivery.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: genericEntityFactGraph,
    });

    expect(issues).toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("does not treat an ordinary title-cased noun as an entity anchor", () => {
    const genericEntityFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Delivery coordination.",
              entities: ["Delivery"],
              allowedVerbs: [],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "Delivery matters.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: genericEntityFactGraph,
    });

    expect(issues).toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("accepts one distinctive lexical employer-grounding anchor", () => {
    const payrollFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Maintained payroll reconciliations.",
              entities: [],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock:
          "That payroll background supports accurate financial operations.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: payrollFactGraph,
    });

    expect(issues).not.toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("aligns singular nouns ending in s with irregular plurals", () => {
    const irregularPluralFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Tracked release status and analysis.",
              entities: [],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock:
          "Those release statuses and analyses supported decisions.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: irregularPluralFactGraph,
    });

    expect(issues).not.toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it.each(["news", "series", "species"])(
    "does not singularize the invariant noun %s",
    (token) => {
      expect(canonicalizePremiumCoverLetterToken(token)).toBe(token);
      expect(expandPremiumCoverLetterTokenVariants(token)).toEqual([token]);
    },
  );

  it("does not derive a Canva overlap from the singular noun canvas", () => {
    expect(expandPremiumCoverLetterTokenVariants("canvas")).toEqual(["canvas"]);
    expect(canonicalizePremiumCoverLetterNoun("canvas")).toBe("canvas");
  });

  it.each([
    ["atlases", "atlas"],
    ["biases", "bias"],
    ["canvases", "canvas"],
    ["chaoses", "chaos"],
    ["gases", "gas"],
  ])("canonicalizes the s-ending plural %s", (plural, singular) => {
    expect(canonicalizePremiumCoverLetterNoun(plural)).toBe(singular);
  });

  it("canonicalizes inflected evidence anchors for employer grounding", () => {
    const inflectedFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Coordinated schedules and tracked handoffs.",
              entities: [],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock:
          "That coordination and scheduling experience supports reliable delivery.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: inflectedFactGraph,
    });

    expect(issues).not.toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("canonicalizes ordinary plural evidence anchors for employer grounding", () => {
    const pluralFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Built experimentation dashboards.",
              entities: ["experimentation dashboards"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock:
          "That dashboard experience supports product decisions.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph: pluralFactGraph,
    });

    expect(issues).not.toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("preserves the ordinary plural meaning of bases", () => {
    expect(canonicalizePremiumCoverLetterNoun("bases")).toBe("base");
  });

  it("grounds an adjacent employer bridge against assigned facts when fact IDs are omitted", () => {
    const adjacentClaimPlan: ClaimPlanV1 = {
      ...claimPlan,
      contextClass: "cv_adjacent",
      claims: claimPlan.claims.map((claim) =>
        claim.section === "employerValueBlock"
          ? {
              ...claim,
              claimType: "adjacent_safe_bridge",
            }
          : claim,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That experience is relevant to this work.",
        closeLine: "I would bring that discipline to the team.",
        employerFacts: [],
      }),
      claimPlan: adjacentClaimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("uses assigned facts for adjacent bridge metrics when fact IDs are omitted", () => {
    const adjacentClaimPlan: ClaimPlanV1 = {
      ...claimPlan,
      contextClass: "cv_adjacent",
      claims: claimPlan.claims.map((claim) =>
        claim.section === "employerValueBlock"
          ? {
              ...claim,
              claimType: "adjacent_safe_bridge",
            }
          : claim,
      ),
    };
    const adjacentMetricFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_close"
          ? {
              ...fact,
              text: "Reduced the onboarding backlog by 24%.",
              entities: ["onboarding backlog"],
              metrics: ["24%"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock:
          "That 24% onboarding backlog reduction is relevant to this work.",
        closeLine: "I would bring that discipline to the team.",
        employerFacts: [],
      }),
      claimPlan: adjacentClaimPlan,
      factGraph: adjacentMetricFactGraph,
    });

    expect(issues).not.toContainEqual({
      code: "unsupported_visible_metric",
      section: "employerValueBlock",
      metric: "24%",
    });
  });

  it("detects a repeated visible sentence within one section", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock:
          "I documented the handoffs. I documented the handoffs.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "duplicate_visible_sentence",
      section: "proofBlock",
    });
  });

  it("detects repeated visible prose despite different terminal punctuation", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I bring grounded frontend delivery experience.",
        proofBlock: "I bring grounded frontend delivery experience!",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "duplicate_visible_sentence",
      section: "proofBlock",
      otherSection: "opening",
    });
  });

  it("detects repeated visible prose inside opening quotation marks", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I documented the handoffs.",
        proofBlock: "“I documented the handoffs.”",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "duplicate_visible_sentence",
      section: "proofBlock",
      otherSection: "opening",
    });
  });

  it("detects a repeated sentence that begins with a lowercase brand", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I built dashboards. iOS teams used them.",
        proofBlock: "iOS teams used them.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "duplicate_visible_sentence",
      section: "proofBlock",
      otherSection: "opening",
    });
  });

  it("detects a repeated sentence after terminal punctuation and a closing quote", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening:
          "The process was “reliable.” I documented the handoffs.",
        proofBlock: "I documented the handoffs.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "duplicate_visible_sentence",
      section: "proofBlock",
      otherSection: "opening",
    });
  });

  it("accepts terminal punctuation followed by a closing quote", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I described the approach as “reliable.”",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).not.toContainEqual({
      code: "incomplete_sentence",
      section: "proofBlock",
    });
  });

  it("requires complete employer-value and close sections", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "",
        closeLine: "",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["missing_employer_value", "missing_close_line"]),
    );
  });

  it("flags a fragment-like verb-led sentence after a completed sentence", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs. Managed reporting.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "incomplete_sentence",
      section: "proofBlock",
    });
  });

  it("rejects a verb-led fragment with a plural object and trailing adverb", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs. Managed services efficiently.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "incomplete_sentence",
      section: "proofBlock",
    });
  });

  it("rejects a verb-led fragment with a hyphenated modifier", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs. Led large-scale migrations across teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "incomplete_sentence",
      section: "proofBlock",
    });
  });

  it("rejects an inferred predicate that follows a preposition", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs. Built for enterprise scale.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "incomplete_sentence",
      section: "proofBlock",
    });
  });

  it("accepts a fronted participial clause with a later subject", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock:
          "I documented handoffs. Supported by product data, teams improved workflows.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).not.toContainEqual({
      code: "incomplete_sentence",
      section: "proofBlock",
    });
  });

  it("accepts a fronted participial clause with a possessive subject", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock:
          "Built on user research, my work emphasizes reliable delivery.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).not.toContainEqual({
      code: "incomplete_sentence",
      section: "proofBlock",
    });
  });

  it("rejects a verb-led fragment after a semicolon", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I improved reporting; Led weekly handoffs.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "incomplete_sentence",
      section: "proofBlock",
    });
  });

  it("accepts participial adjectives when a later finite predicate completes the sentence", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock:
          "Managed services improve reliability. Improved processes sustained the result.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).not.toContainEqual({
      code: "incomplete_sentence",
      section: "proofBlock",
    });
  });

  it("accepts an irregular finite predicate after a verb-led subject", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "Tracked adoption grew steadily.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).not.toContainEqual({
      code: "incomplete_sentence",
      section: "proofBlock",
    });
  });

  it.each([
    "Improved processes yield clearer handoffs.",
    "Improved processes offer clearer handoffs.",
    "Improved processes foster clearer handoffs.",
  ])("accepts an unlisted finite predicate in a complete sentence: %s", (proofBlock) => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock,
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).not.toContainEqual({
      code: "incomplete_sentence",
      section: "proofBlock",
    });
  });

  it("flags a generic employer-value sentence without a fact anchor", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced the onboarding backlog by 24%.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "I bring strong skills.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).toContainEqual({
      code: "employer_value_not_grounded",
      section: "employerValueBlock",
    });
  });

  it("fails closed when a section omits or mislabels its claim reference", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: {
        ...output({
          opening: "I reduced the onboarding backlog by 24%.",
          proofBlock: "I documented handoffs for three implementation teams.",
          employerValueBlock: "That reporting supports clear delivery handoffs.",
          closeLine: "I would bring that discipline to the team.",
        }),
        bodyParts: {
          ...output({
            opening: "I reduced the onboarding backlog by 24%.",
            proofBlock: "I documented handoffs for three implementation teams.",
            employerValueBlock: "That reporting supports clear delivery handoffs.",
            closeLine: "I would bring that discipline to the team.",
          }).bodyParts,
          opening: {
            ...output({
              opening: "I reduced the onboarding backlog by 24%.",
              proofBlock: "I documented handoffs for three implementation teams.",
              employerValueBlock: "That reporting supports clear delivery handoffs.",
              closeLine: "I would bring that discipline to the team.",
            }).bodyParts.opening,
            claimIds: ["unknown_claim"],
          },
        },
      },
      claimPlan,
      factGraph,
    });

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["claim_reference_mismatch", "unknown_claim_reference"]),
    );
  });

  it("does not treat ordinary word numbers as unsupported metrics", () => {
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I was one of the teams supporting delivery.",
        proofBlock: "I documented handoffs for three implementation teams.",
        employerValueBlock: "That reporting supports clear delivery handoffs.",
        closeLine: "I would bring that discipline to the team.",
      }),
      claimPlan,
      factGraph,
    });

    expect(issues).not.toContainEqual(
      expect.objectContaining({ code: "unsupported_visible_metric" }),
    );
  });

  it("is inactive for French and no-CV claim plans", () => {
    const writerOutput = output({
      opening: "I reduced the onboarding backlog by 24%.",
      proofBlock: "I reduced the onboarding backlog by 24%.",
      employerValueBlock: "I reduced the onboarding backlog by 24%.",
      closeLine: "I reduced the onboarding backlog by 24%.",
    });

    expect(
      validateEnglishCvBackedQualityGate({
        writerOutput,
        claimPlan: { ...claimPlan, language: "French" },
        factGraph,
      }),
    ).toEqual([]);
    expect(
      validateEnglishCvBackedQualityGate({
        writerOutput,
        claimPlan: { ...claimPlan, language: "English", contextClass: "no_cv" },
        factGraph,
      }),
    ).toEqual([]);
  });
});
