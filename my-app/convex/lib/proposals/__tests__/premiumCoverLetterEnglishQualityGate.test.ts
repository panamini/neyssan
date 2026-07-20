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
              text: "Built 3D workflows for 5G systems under ISO 27001.",
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
        opening: "I built 3D workflows for 5G systems under ISO 27001.",
        proofBlock:
          "I documented 3D assets for 5G programs aligned with ISO 27001.",
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
