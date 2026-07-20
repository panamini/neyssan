import { describe, expect, it } from "vitest";

import type {
  ClaimPlanV1,
  FactGraphV1,
  PremiumWriterOutputV1,
} from "../premiumCoverLetter";
import {
  analyzeEnglishCvBackedQualityGate,
  validateEnglishCvBackedQualityGate,
} from "../premiumCoverLetterEnglishQualityGate";

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

  it("normalizes decimal precision and thousands separators in metrics", () => {
    const metricFactGraph: FactGraphV1 = {
      ...factGraph,
      facts: factGraph.facts.map((fact) =>
        fact.id === "fact_opening"
          ? {
              ...fact,
              text: "Reduced a backlog of 1,000 items by 24%.",
              metrics: ["1,000", "24%"],
            }
          : fact,
      ),
    };
    const issues = validateEnglishCvBackedQualityGate({
      writerOutput: output({
        opening: "I reduced a backlog of 1000 items by 24.0%.",
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
