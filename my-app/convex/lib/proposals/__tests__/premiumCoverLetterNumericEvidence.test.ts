import { describe, expect, it } from "vitest";

import type {
  ClaimPlanV1,
  FactGraphV1,
  JobDemandGraphV1,
} from "../premiumCoverLetter";
import {
  buildPremiumCoverLetterNumericEvidenceProjection,
  matchPremiumCoverLetterNumericEvidence,
  numericEvidenceNormalizedValues,
} from "../premiumCoverLetterNumericEvidence";
import { resolveTargetEmployerAuthorities } from "../premiumCoverLetterTargetEmployer";

const emptyClaimPlan: ClaimPlanV1 = {
  version: "claim_plan_v1",
  contextClass: "cv_direct",
  language: "English",
  targetRole: "Implementation Analyst",
  preset: "signature",
  globalForbidden: [],
  claims: [],
};

const emptyDemandGraph: JobDemandGraphV1 = {
  version: "job_demand_graph_v1",
  demands: [],
  priorityTokens: [],
};

function factGraph(
  facts: Array<
    Partial<FactGraphV1["facts"][number]> &
      Pick<FactGraphV1["facts"][number], "id" | "text" | "source">
  >,
): FactGraphV1 {
  return {
    version: "fact_graph_v1",
    facts: facts.map((fact) => ({
      sourcePath: `fixture.${fact.id}`,
      confidence: "high",
      category: fact.source === "cv" ? "achievement" : "job_context",
      metrics: [],
      entities: [],
      allowedVerbs: ["completed"],
      forbiddenUpgrades: [],
      ownershipLevel: "support",
      ...fact,
    })),
  };
}

function projection(args: {
  factGraph?: FactGraphV1;
  jobDemandGraph?: JobDemandGraphV1;
  employer?: string | null;
}) {
  return buildPremiumCoverLetterNumericEvidenceProjection({
    factGraph: args.factGraph ?? factGraph([]),
    claimPlan: emptyClaimPlan,
    jobDemandGraph: args.jobDemandGraph ?? emptyDemandGraph,
    targetEmployer: resolveTargetEmployerAuthorities([args.employer]),
  });
}

describe("premium cover-letter numeric evidence", () => {
  it("matches a digit source to a written hyphenated duration with fact provenance", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_training",
          source: "cv",
          text: "Completed a 3-Day Training Program.",
          metrics: ["3-Day"],
        },
      ]),
    });

    const result = matchPremiumCoverLetterNumericEvidence({
      projection: evidence,
      visibleText: "That three-day training program supports delivery.",
      section: "proofBlock",
      factIds: ["fact_training"],
      demandIds: [],
      claimIds: [],
    });

    expect(result.unsupported).toEqual([]);
    expect(result.matches).toContainEqual(
      expect.objectContaining({
        section: "proofBlock",
        role: "DURATION",
        owner: "CANDIDATE",
        factId: "fact_training",
        visibleSpan: expect.objectContaining({ text: "three" }),
      }),
    );
  });

  it.each([
    "That THREE-DAY training program supports delivery!",
    "That three day training program supports delivery.",
    "That 3-day training program supports delivery.",
  ])("normalizes duration case, punctuation, digits, words, and hyphens: %s", (visibleText) => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_training",
          source: "cv",
          text: "Completed a 3-Day Training Program.",
          metrics: ["3-Day"],
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText,
        section: "proofBlock",
        factIds: ["fact_training"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);
  });

  it("does not authorize a different duration unit with the same number", () => {
    const evidence = projection({
      factGraph: factGraph([
        { id: "fact_duration", source: "cv", text: "Completed the work in 3 days." },
      ]),
    });

    const sameUnit = matchPremiumCoverLetterNumericEvidence({
      projection: evidence,
      visibleText: "I completed the work in three days.",
      section: "proofBlock",
      factIds: ["fact_duration"],
      demandIds: [],
      claimIds: [],
    });
    const changedUnit = matchPremiumCoverLetterNumericEvidence({
      projection: evidence,
      visibleText: "I completed the work in three months.",
      section: "proofBlock",
      factIds: ["fact_duration"],
      demandIds: [],
      claimIds: [],
    });

    expect(sameUnit.unsupported).toEqual([]);
    expect(changedUnit.matches).toEqual([]);
    expect(changedUnit.unsupported).toContainEqual(
      expect.objectContaining({ normalizedValue: "3" }),
    );
  });

  it("does not authorize a contextual version from a metric with the same number", () => {
    const evidence = projection({
      factGraph: factGraph([
        { id: "fact_count", source: "cv", text: "Delivered 3 projects." },
      ]),
    });

    const result = matchPremiumCoverLetterNumericEvidence({
      projection: evidence,
      visibleText: "Used Python 3 in production.",
      section: "proofBlock",
      factIds: ["fact_count"],
      demandIds: [],
      claimIds: [],
    });

    expect(result.matches).toEqual([]);
    expect(result.unsupported).toContainEqual(
      expect.objectContaining({ normalizedValue: "3" }),
    );
  });

  it("keeps version qualifiers bound to their classified source", () => {
    const evidence = projection({
      factGraph: factGraph([
        { id: "fact_python", source: "cv", text: "Used Python 3 in production." },
      ]),
    });

    const sameQualifier = matchPremiumCoverLetterNumericEvidence({
      projection: evidence,
      visibleText: "I used Python 3 in production.",
      section: "proofBlock",
      factIds: ["fact_python"],
      demandIds: [],
      claimIds: [],
    });
    const changedQualifier = matchPremiumCoverLetterNumericEvidence({
      projection: evidence,
      visibleText: "I used React 3 in production.",
      section: "proofBlock",
      factIds: ["fact_python"],
      demandIds: [],
      claimIds: [],
    });

    expect(sameQualifier.unsupported).toEqual([]);
    expect(changedQualifier.matches).toEqual([]);
    expect(changedQualifier.unsupported).toContainEqual(
      expect.objectContaining({ normalizedValue: "3" }),
    );
  });

  it("rejects unsupported 100M and accepts the same structured candidate metric", () => {
    const unsupported = matchPremiumCoverLetterNumericEvidence({
      projection: projection({}),
      visibleText: "At 100M, reporting supports delivery.",
      section: "opening",
      factIds: [],
      demandIds: [],
      claimIds: [],
    });
    expect(unsupported.unsupported).toContainEqual(
      expect.objectContaining({ normalizedValue: "100000000" }),
    );

    const supportedProjection = projection({
      factGraph: factGraph([
        {
          id: "fact_scale",
          source: "cv",
          text: "Maintained reporting at 100M scale.",
          metrics: ["100M"],
        },
      ]),
    });
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: supportedProjection,
        visibleText: "At 100M, reporting supports delivery.",
        section: "opening",
        factIds: ["fact_scale"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);
  });

  it("normalizes decimal commas and thousands separators without accepting inflation", () => {
    const decimalProjection = projection({
      factGraph: factGraph([
        {
          id: "fact_conversion",
          source: "cv",
          text: "Improved signup conversion by 11,5%.",
          metrics: ["11,5%"],
        },
        {
          id: "fact_customers",
          source: "cv",
          text: "Supported 1,000 customers through onboarding.",
          metrics: ["1,000"],
        },
      ]),
    });
    const match = (visibleText: string, factIds: string[]) =>
      matchPremiumCoverLetterNumericEvidence({
        projection: decimalProjection,
        visibleText,
        section: "opening",
        factIds,
        demandIds: [],
        claimIds: [],
      });

    expect(match("Improved conversion by 11.5%.", ["fact_conversion"]).unsupported).toEqual([]);
    expect(
      match("Supported 1000 customers through onboarding.", ["fact_customers"])
        .unsupported,
    ).toEqual([]);
    expect(match("Improved conversion by 115%.", ["fact_conversion"]).unsupported).toHaveLength(1);
  });

  it("classifies date, version, job level, proper name, and employer from source context", () => {
    const evidence = projection({
      employer: "7-Eleven Inc.",
      factGraph: factGraph([
        { id: "fact_date", source: "cv", text: "Completed the migration in 2024." },
        { id: "fact_version", source: "cv", text: "Migrated React 18 applications." },
        { id: "fact_level", source: "job_post", text: "Software Engineer — Level 3." },
        {
          id: "fact_brand",
          source: "cv",
          text: "Supported the Formula 1 account.",
          entities: ["Formula 1"],
        },
      ]),
    });

    expect(evidence.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ factId: "fact_date", role: "DATE", owner: "CANDIDATE" }),
        expect.objectContaining({ factId: "fact_version", role: "VERSION", owner: "CANDIDATE" }),
        expect.objectContaining({ factId: "fact_level", role: "JOB_LEVEL", owner: "JOB_CONTEXT" }),
        expect.objectContaining({ factId: "fact_brand", role: "PROPER_NAME", owner: "CANDIDATE" }),
        expect.objectContaining({ role: "EMPLOYER", owner: "TARGET_EMPLOYER" }),
      ]),
    );
  });

  it("classifies bare CV year ranges once and matches a visible date paraphrase", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_role_dates",
          source: "cv",
          text: "Engineer — 2020–2024",
        },
      ]),
    });

    expect(
      evidence.sources.filter((source) => source.factId === "fact_role_dates"),
    ).toEqual([
      expect.objectContaining({ role: "DATE", normalizedValue: "2020" }),
      expect.objectContaining({ role: "DATE", normalizedValue: "2024" }),
    ]);
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "I worked as an engineer from 2020 to 2024.",
        section: "proofBlock",
        factIds: ["fact_role_dates"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);
  });

  it("does not classify an ordinary count in the calendar-year range as a date", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_user_scale",
          source: "cv",
          text: "Scaled the platform to 2,000 users.",
        },
      ]),
    });

    expect(
      evidence.sources.find((source) => source.factId === "fact_user_scale"),
    ).toEqual(expect.objectContaining({ role: "METRIC" }));
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "I supported 2,000 users.",
        section: "proofBlock",
        factIds: ["fact_user_scale"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);
  });

  it("matches a French duration unit when measurement translation is allowed", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_duration_translation",
          source: "cv",
          text: "Worked on the platform for 3 years.",
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "J’ai travaillé sur la plateforme pendant 3 ans.",
        section: "proofBlock",
        factIds: ["fact_duration_translation"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).toEqual([]);
  });

  it("matches a localized trailing currency symbol", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_currency_translation",
          source: "cv",
          text: "Managed $1M in annual revenue.",
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "J’ai géré 1 M$ de chiffre d’affaires annuel.",
        section: "proofBlock",
        factIds: ["fact_currency_translation"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).toEqual([]);
  });

  it.each([
    ["7-Eleven Inc.", "7-Eleven offers reliable delivery."],
    ["99", "At 99, reporting supports delivery."],
  ])("preserves numeric target-employer regressions for %s", (employer, visibleText) => {
    const result = matchPremiumCoverLetterNumericEvidence({
      projection: projection({ employer }),
      visibleText,
      section: "employerValueBlock",
      factIds: [],
      demandIds: [],
      claimIds: [],
    });

    expect(result.unsupported).toEqual([]);
    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "EMPLOYER", owner: "TARGET_EMPLOYER" }),
      ]),
    );
  });

  it("does not let a structured proper name authorize an unrelated metric", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_brand",
          source: "cv",
          text: "Supported the Formula 1 account.",
          entities: ["Formula 1"],
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "I supported 1 account.",
        section: "proofBlock",
        factIds: ["fact_brand"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toContainEqual(
      expect.objectContaining({
        section: "proofBlock",
        normalizedValue: "1",
      }),
    );
  });

  it("never turns target-employer or job-context evidence into candidate evidence", () => {
    const jobDemandGraph: JobDemandGraphV1 = {
      ...emptyDemandGraph,
      demands: [
        {
          id: "demand_scale",
          text: "Operate a 100M business line.",
          bucket: "core_responsibility",
          requiredness: "core",
          tokens: ["operate", "business"],
          mustNotBecomeCandidateClaim: true,
        },
        {
          id: "demand_training",
          text: "Complete a 3-Day Training Program.",
          bucket: "key_requirement",
          requiredness: "required",
          tokens: ["complete", "training"],
          mustNotBecomeCandidateClaim: true,
        },
      ],
    };
    const evidence = projection({ employer: "99", jobDemandGraph });

    const jobMatch = matchPremiumCoverLetterNumericEvidence({
      projection: evidence,
      visibleText: "I operated a 100M business line.",
      section: "proofBlock",
      factIds: [],
      demandIds: ["demand_scale"],
      claimIds: [],
    });
    expect(jobMatch.unsupported).toContainEqual(
      expect.objectContaining({ reasonCodes: expect.arrayContaining(["owner_mismatch"]) }),
    );

    const durationMatch = matchPremiumCoverLetterNumericEvidence({
      projection: evidence,
      visibleText: "I completed a three-day training program.",
      section: "proofBlock",
      factIds: [],
      demandIds: ["demand_training"],
      claimIds: [],
    });
    expect(durationMatch.unsupported).toContainEqual(
      expect.objectContaining({
        normalizedValue: "3",
        reasonCodes: expect.arrayContaining(["owner_mismatch"]),
      }),
    );

    const employerValueMatch = matchPremiumCoverLetterNumericEvidence({
      projection: evidence,
      visibleText: "I operated a 100M business line.",
      section: "employerValueBlock",
      factIds: [],
      demandIds: ["demand_scale"],
      claimIds: [],
    });
    expect(employerValueMatch.matches).toEqual([]);
    expect(employerValueMatch.unsupported).toContainEqual(
      expect.objectContaining({ reasonCodes: expect.arrayContaining(["owner_mismatch"]) }),
    );

    const explicitJobContextMatch = matchPremiumCoverLetterNumericEvidence({
      projection: evidence,
      visibleText: "The role includes a 100M business line.",
      section: "employerValueBlock",
      factIds: [],
      demandIds: ["demand_scale"],
      claimIds: [],
      requiredOwner: "JOB_CONTEXT",
    });
    expect(explicitJobContextMatch.unsupported).toEqual([]);
    expect(explicitJobContextMatch.matches).toContainEqual(
      expect.objectContaining({ owner: "JOB_CONTEXT", demandId: "demand_scale" }),
    );

    const employerMatch = matchPremiumCoverLetterNumericEvidence({
      projection: evidence,
      visibleText: "I delivered 99 projects.",
      section: "proofBlock",
      factIds: [],
      demandIds: [],
      claimIds: [],
      requiredOwner: "CANDIDATE",
    });
    expect(employerMatch.unsupported.length).toBeGreaterThan(0);
  });

  it.each([
    ["React 18 delivery.", "I delivered React 18 applications."],
    ["Engineer from 2020 to 2024.", "I worked as an engineer from 2020 to 2024."],
    ["Engineer — Level 3.", "I worked at Level 3."],
  ])(
    "requires candidate ownership for job-context numeric roles: %s",
    (demandText, visibleText) => {
      const jobDemandGraph: JobDemandGraphV1 = {
        ...emptyDemandGraph,
        demands: [
          {
            id: "demand_numeric_role",
            text: demandText,
            bucket: "key_requirement",
            requiredness: "required",
            tokens: ["delivery"],
            mustNotBecomeCandidateClaim: true,
          },
        ],
      };
      const result = matchPremiumCoverLetterNumericEvidence({
        projection: projection({ jobDemandGraph }),
        visibleText,
        section: "proofBlock",
        factIds: [],
        demandIds: ["demand_numeric_role"],
        claimIds: [],
      });

      expect(result.matches).toEqual([]);
      expect(result.unsupported).toContainEqual(
        expect.objectContaining({
          reasonCodes: expect.arrayContaining(["owner_mismatch"]),
        }),
      );
    },
  );

  it("keeps duration units in repair comparison keys", () => {
    expect(numericEvidenceNormalizedValues("Completed in three days.")).not.toEqual(
      numericEvidenceNormalizedValues("Completed in three years."),
    );
  });

  it("refuses claimIds as source provenance", () => {
    const evidence = projection({
      factGraph: factGraph([
        { id: "fact_metric", source: "cv", text: "Reduced backlog by 24%." },
      ]),
    });

    const result = matchPremiumCoverLetterNumericEvidence({
      projection: evidence,
      visibleText: "I reduced backlog by 24%.",
      section: "opening",
      factIds: [],
      demandIds: [],
      claimIds: ["claim_opening_001"],
    });

    expect(result.matches).toEqual([]);
    expect(result.unsupported).toContainEqual(
      expect.objectContaining({
        reasonCodes: expect.arrayContaining(["claim_id_not_source_provenance"]),
      }),
    );
  });

  it("keeps source classification stable when visible text changes", () => {
    const evidence = projection({
      factGraph: factGraph([
        { id: "fact_duration", source: "cv", text: "Completed a 3-day program." },
      ]),
    });
    const before = JSON.stringify(evidence.sources);

    matchPremiumCoverLetterNumericEvidence({
      projection: evidence,
      visibleText: "Completed a three-day program.",
      section: "proofBlock",
      factIds: ["fact_duration"],
      demandIds: [],
      claimIds: [],
    });
    matchPremiumCoverLetterNumericEvidence({
      projection: evidence,
      visibleText: "Completed version 3 of the program.",
      section: "proofBlock",
      factIds: ["fact_duration"],
      demandIds: [],
      claimIds: [],
    });

    expect(JSON.stringify(evidence.sources)).toBe(before);
    expect(evidence.sources).toContainEqual(
      expect.objectContaining({ role: "DURATION", factId: "fact_duration" }),
    );
  });
});
