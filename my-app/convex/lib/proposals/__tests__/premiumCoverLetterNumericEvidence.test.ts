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

  it("does not let a nearby month turn an ordinary count into a date", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_monthly_user_scale",
          source: "cv",
          text: "In January, I supported 2,000 users.",
        },
      ]),
    });

    expect(
      evidence.sources.find(
        (source) => source.factId === "fact_monthly_user_scale",
      ),
    ).toEqual(expect.objectContaining({ role: "METRIC" }));
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "I supported 2,000 users.",
        section: "proofBlock",
        factIds: ["fact_monthly_user_scale"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);
  });

  it("classifies an open-ended CV year range as a date", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_open_role_dates",
          source: "cv",
          text: "Engineer — 2020–Present",
        },
      ]),
    });

    expect(
      evidence.sources.find(
        (source) => source.factId === "fact_open_role_dates",
      ),
    ).toEqual(expect.objectContaining({ role: "DATE" }));
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "I have worked as an engineer since 2020.",
        section: "proofBlock",
        factIds: ["fact_open_role_dates"],
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

  it.each([
    ["Spanish", "Trabajé en la plataforma durante 3 años."],
    ["German", "Ich arbeitete 3 Jahre an der Plattform."],
  ])(
    "matches a translated duration unit for enabled %s output",
    (_language, visibleText) => {
      const evidence = projection({
        factGraph: factGraph([
          {
            id: "fact_duration_enabled_language",
            source: "cv",
            text: "Worked on the platform for 3 years.",
          },
        ]),
      });

      expect(
        matchPremiumCoverLetterNumericEvidence({
          projection: evidence,
          visibleText,
          section: "proofBlock",
          factIds: ["fact_duration_enabled_language"],
          demandIds: [],
          claimIds: [],
          allowMeasurementTranslation: true,
        }).unsupported,
      ).toEqual([]);
    },
  );

  it("does not let duration translation change the canonical unit", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_three_days",
          source: "cv",
          text: "Completed the migration in 3 days.",
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "Completé la migración en 3 años.",
        section: "proofBlock",
        factIds: ["fact_three_days"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).not.toEqual([]);
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

  it("does not treat unrelated French metric nouns as translations", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_customer_count",
          source: "cv",
          text: "Supported 5 customers through onboarding.",
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "J’ai dirigé 5 équipes.",
        section: "proofBlock",
        factIds: ["fact_customer_count"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).not.toEqual([]);
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "J’ai accompagné 5 clients.",
        section: "proofBlock",
        factIds: ["fact_customer_count"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).toEqual([]);
  });

  it("does not ignore numeric versions for supported tool qualifiers", () => {
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: projection({}),
        visibleText: "I delivered Docker 99 applications.",
        section: "proofBlock",
        factIds: [],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).not.toEqual([]);
  });

  it("ignores qualitative written-number prose", () => {
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: projection({}),
        visibleText:
          "One practical way I could contribute is by documenting handoffs.",
        section: "employerValueBlock",
        factIds: [],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);
  });

  it("matches between-and paraphrases of cited date ranges", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_between_role_dates",
          source: "cv",
          text: "Engineer — 2020–2024",
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "I worked there between 2020 and 2024.",
        section: "proofBlock",
        factIds: ["fact_between_role_dates"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);
  });

  it.each([
    "Engineer — 2020 to 2024",
    "Engineer — 2020 through 2024",
    "Engineer — 2020 until 2024",
    "Engineer — 2020 to Present",
  ])("classifies the first endpoint of textual date ranges: %s", (text) => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_textual_role_dates",
          source: "cv",
          text,
        },
      ]),
    });

    expect(
      evidence.sources.find(
        (source) =>
          source.factId === "fact_textual_role_dates" &&
          source.normalizedValue === "2020",
      ),
    ).toEqual(expect.objectContaining({ role: "DATE" }));
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "I have worked as an engineer since 2020.",
        section: "proofBlock",
        factIds: ["fact_textual_role_dates"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);
  });

  it("matches only complete semantic versions with the same tool qualifier", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_angular_semver",
          source: "cv",
          text: "Built applications with Angular 18.2.1.",
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "I built applications with Angular 18.2.1.",
        section: "proofBlock",
        factIds: ["fact_angular_semver"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "I built applications with React 99.9.1.",
        section: "proofBlock",
        factIds: ["fact_angular_semver"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).not.toEqual([]);
  });

  it("allows translated metric measurements only with candidate fact provenance", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_multilingual_customers",
          source: "cv",
          text: "Supported 5 customers through onboarding.",
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "Apoyé a 5 clientes durante la incorporación.",
        section: "proofBlock",
        factIds: ["fact_multilingual_customers"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).toEqual([]);
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "Apoyé a 5 clientes durante la incorporación.",
        section: "proofBlock",
        factIds: [],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).not.toEqual([]);
  });

  it("allows the exact French response-time measurement alias", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_response_time",
          source: "cv",
          text: "Improved 5 response times.",
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "J’ai amélioré 5 délais de réponse.",
        section: "proofBlock",
        factIds: ["fact_response_time"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).toEqual([]);
  });

  it("rejects an unmapped translated measurement substitution", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_projects",
          source: "cv",
          text: "Managed 5 projects.",
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "Managed 5 servers.",
        section: "proofBlock",
        factIds: ["fact_projects"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).not.toEqual([]);
  });

  it("does not use a nearby translated alias to override an explicit measurement", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_revenue_count",
          source: "cv",
          text: "Managed 10 revenue.",
        },
      ]),
    });

    expect(evidence.sources).toContainEqual(
      expect.objectContaining({
        factId: "fact_revenue_count",
        measurement: "revenue",
      }),
    );
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "Revenue by 10 servers.",
        section: "proofBlock",
        factIds: ["fact_revenue_count"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).not.toEqual([]);
  });

  it("rejects a percentage direction inversion in the generic fallback", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_conversion_increase",
          source: "cv",
          text: "Increased conversion by 10%.",
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "I delivered a 10% reduction.",
        section: "proofBlock",
        factIds: ["fact_conversion_increase"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).not.toEqual([]);
  });

  it("matches localized date context only when translation is allowed", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_calendar_year",
          source: "cv",
          text: "Worked there in 2024.",
        },
      ]),
    });
    const match = (allowMeasurementTranslation: boolean) =>
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "J’y ai travaillé en 2024.",
        section: "proofBlock",
        factIds: ["fact_calendar_year"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation,
      }).unsupported;

    expect(match(true)).toEqual([]);
    expect(match(false)).not.toEqual([]);
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "2024",
        section: "proofBlock",
        factIds: ["fact_calendar_year"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).not.toEqual([]);
  });

  it.each([
    [
      "fact_conversion_fr",
      "Improved signup conversion by 11% after iterative UI experiments.",
      "J’ai amélioré la conversion des inscriptions de 11 % grâce à des expériences d’interface itératives.",
    ],
    [
      "fact_teams_fr",
      "Led a design system migration used across 4 product squads.",
      "J’ai dirigé une migration de design system utilisée par 4 équipes produit.",
    ],
    [
      "fact_duration_teams_fr",
      "Completed a design system migration in 3 years across 4 product squads.",
      "J’ai réalisé une migration de design system en 3 ans pour 4 équipes produit.",
    ],
  ])(
    "matches exact validated French measurement aliases for %s",
    (factId, sourceText, visibleText) => {
      const evidence = projection({
        factGraph: factGraph([
          {
            id: factId,
            source: "cv",
            text: sourceText,
          },
        ]),
      });

      expect(
        matchPremiumCoverLetterNumericEvidence({
          projection: evidence,
          visibleText,
          section: "proofBlock",
          factIds: [factId],
          demandIds: [],
          claimIds: [],
          allowMeasurementTranslation: true,
        }).unsupported,
      ).toEqual([]);
    },
  );

  it("matches an exact Spanish revenue alias without arbitrary fallback", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_revenue_es",
          source: "cv",
          text: "Increased revenue by 10%.",
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "Aumenté los ingresos un 10%.",
        section: "proofBlock",
        factIds: ["fact_revenue_es"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).toEqual([]);
  });

  it.each([
    ["French", "revenus"],
    ["Spanish", "ingresos"],
    ["German", "Umsatz"],
    ["Italian", "ricavi"],
    ["Portuguese", "receitas"],
    ["Polish", "przychody"],
    ["Dutch", "omzet"],
    ["Greek", "έσοδα"],
    ["Hungarian", "bevétel"],
    ["Lithuanian", "pajamos"],
    ["Estonian", "tulu"],
    ["Russian", "доход"],
    ["Arabic", "إيرادات"],
  ])("matches the exact revenue alias for enabled %s output", (_language, alias) => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_enabled_language_revenue",
          source: "cv",
          text: "Managed 10 revenue.",
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: `10 ${alias}`,
        section: "proofBlock",
        factIds: ["fact_enabled_language_revenue"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).toEqual([]);
  });

  it.each([
    ["French", "conversion"],
    ["Spanish", "conversión"],
    ["German", "Konversion"],
    ["Italian", "conversione"],
    ["Portuguese", "conversão"],
    ["Polish", "konwersja"],
    ["Dutch", "conversie"],
    ["Greek", "μετατροπή"],
    ["Hungarian", "konverzió"],
    ["Lithuanian", "konversija"],
    ["Estonian", "konversioon"],
    ["Russian", "конверсия"],
    ["Arabic", "تحويل"],
  ])("matches the exact conversion alias for enabled %s output", (_language, alias) => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_enabled_language_conversion",
          source: "cv",
          text: "Improved 10 conversion.",
        },
      ]),
    });

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: `10 ${alias}`,
        section: "proofBlock",
        factIds: ["fact_enabled_language_conversion"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).toEqual([]);
  });

  it.each(["in the year 2020", "during the year 2020"])(
    "matches the common calendar-year paraphrase %s",
    (visibleDate) => {
      const evidence = projection({
        factGraph: factGraph([
          {
            id: "fact_joined_2020",
            source: "cv",
            text: "Joined the company in 2020.",
          },
        ]),
      });

      expect(
        matchPremiumCoverLetterNumericEvidence({
          projection: evidence,
          visibleText: `I joined the company ${visibleDate}.`,
          section: "proofBlock",
          factIds: ["fact_joined_2020"],
          demandIds: [],
          claimIds: [],
        }).unsupported,
      ).toEqual([]);
    },
  );

  it("matches a signed decrease to equivalent directional percentage phrasing", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_churn_decrease",
          source: "cv",
          text: "Churn: -20%.",
        },
      ]),
    });

    expect(evidence.sources).toContainEqual(
      expect.objectContaining({
        factId: "fact_churn_decrease",
        baseKey: "percent:-20",
        measurement: "churn",
      }),
    );
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "I delivered a 20% reduction in churn.",
        section: "proofBlock",
        factIds: ["fact_churn_decrease"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);
  });

  it("preserves compliance-standard identifiers as numeric evidence", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_iso_standard",
          source: "cv",
          text: "Implemented ISO/IEC 27001 controls.",
        },
      ]),
    });

    expect(evidence.sources).toContainEqual(
      expect.objectContaining({
        factId: "fact_iso_standard",
        role: "VERSION",
        normalizedValue: "27001",
        contextQualifier: "iso/iec",
      }),
    );
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "I implemented ISO/IEC 27002 controls.",
        section: "proofBlock",
        factIds: ["fact_iso_standard"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).not.toEqual([]);
  });

  it("ignores the adjectival one-team idiom", () => {
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: projection({}),
        visibleText: "I aligned stakeholders as one cohesive team.",
        section: "proofBlock",
        factIds: [],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);
  });

  it("retains semantic versions for adjacent unlisted tools", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_spring_boot_version",
          source: "cv",
          text: "Built services with Spring Boot 3.2.1.",
        },
      ]),
    });

    expect(evidence.sources).toContainEqual(
      expect.objectContaining({
        factId: "fact_spring_boot_version",
        role: "VERSION",
        normalizedValue: "3.2.1",
        contextQualifier: "spring boot",
      }),
    );
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText: "I built services with Spring Boot 4.0.0.",
        section: "proofBlock",
        factIds: ["fact_spring_boot_version"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).not.toEqual([]);
  });

  it("binds an unlisted semantic version to the adjacent tool, not the sentence verb", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_next_version",
          source: "cv",
          text: "Built Next.js 3.2.1 applications.",
        },
      ]),
    });
    const match = (visibleText: string) =>
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText,
        section: "proofBlock",
        factIds: ["fact_next_version"],
        demandIds: [],
        claimIds: [],
      }).unsupported;

    expect(evidence.sources).toContainEqual(
      expect.objectContaining({
        factId: "fact_next_version",
        contextQualifier: "next.js",
      }),
    );
    expect(match("Used Next.js 3.2.1 applications.")).toEqual([]);
    expect(match("Used Nuxt.js 3.2.1 applications.")).not.toEqual([]);
  });

  it("does not let translated matching bypass candidate ownership", () => {
    const jobDemandGraph: JobDemandGraphV1 = {
      ...emptyDemandGraph,
      demands: [
        {
          id: "demand_translated_scale",
          text: "Support 5 customers.",
          bucket: "key_requirement",
          requiredness: "required",
          tokens: ["support", "customers"],
          mustNotBecomeCandidateClaim: true,
        },
      ],
    };

    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: projection({ jobDemandGraph }),
        visibleText: "Apoyé a 5 clientes.",
        section: "proofBlock",
        factIds: [],
        demandIds: ["demand_translated_scale"],
        claimIds: [],
        allowMeasurementTranslation: true,
      }).unsupported,
    ).toContainEqual(
      expect.objectContaining({
        reasonCodes: expect.arrayContaining(["owner_mismatch"]),
      }),
    );
  });

  it.each([
    ["French", "5 clients"],
    ["Spanish", "5 clientes"],
    ["German", "5 Kunden"],
    ["Italian", "5 clienti"],
    ["Portuguese", "5 clientes"],
    ["Polish", "5 klientów"],
    ["Dutch", "5 klanten"],
    ["Greek", "5 πελάτες"],
    ["Hungarian", "5 ügyfelek"],
    ["Lithuanian", "5 klientų"],
    ["Estonian", "5 kliendid"],
    ["Russian", "5 клиентов"],
    ["Arabic", "5 عملاء"],
  ])(
    "matches the explicit customer alias for enabled %s output",
    (_language, visibleText) => {
      const evidence = projection({
        factGraph: factGraph([
          {
            id: "fact_enabled_language_customers",
            source: "cv",
            text: "Supported 5 customers.",
          },
        ]),
      });

      expect(
        matchPremiumCoverLetterNumericEvidence({
          projection: evidence,
          visibleText,
          section: "proofBlock",
          factIds: ["fact_enabled_language_customers"],
          demandIds: [],
          claimIds: [],
          allowMeasurementTranslation: true,
        }).unsupported,
      ).toEqual([]);
    },
  );

  it("matches exact written-number target-employer aliases", () => {
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: projection({ employer: "Two Sigma" }),
        visibleText: "Two Sigma offers reliable delivery.",
        section: "employerValueBlock",
        factIds: [],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);
  });

  it.each([
    "One clear focus would be reliable handoffs.",
    "One opportunity is to improve handoffs.",
  ])("ignores qualitative one-prefaces: %s", (visibleText) => {
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: projection({}),
        visibleText,
        section: "employerValueBlock",
        factIds: [],
        demandIds: [],
        claimIds: [],
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

  it("uses a Unicode-safe magnitude boundary for translated measurements", () => {
    const evidence = projection({
      factGraph: factGraph([
        { id: "fact_span", source: "cv", text: "Measured 5 meters." },
        { id: "fact_scale", source: "cv", text: "Managed a 5M portfolio." },
        {
          id: "fact_storage",
          source: "cv",
          text: "Reduced the payload to 5 MB.",
        },
      ]),
    });
    const match = (visibleText: string, factId: string) =>
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText,
        section: "proofBlock",
        factIds: [factId],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: true,
      });

    expect(evidence.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factId: "fact_span",
          normalizedValue: "5",
          measurement: "meter",
        }),
        expect.objectContaining({
          factId: "fact_scale",
          normalizedValue: "5000000",
        }),
        expect.objectContaining({
          factId: "fact_storage",
          normalizedValue: "5",
          measurement: "mb",
        }),
      ]),
    );
    expect(match("J’ai mesuré 5 mètres.", "fact_span").unsupported).toEqual([]);
    expect(match("Managed a 5M portfolio.", "fact_scale").unsupported).toEqual([]);
    expect(match("Reduced the payload to 5 MB.", "fact_storage").unsupported).toEqual([]);
  });

  it("matches a finite localized job-level alias only in translation mode", () => {
    const evidence = projection({
      factGraph: factGraph([
        {
          id: "fact_level",
          source: "job_post",
          text: "Engineer Level 3.",
        },
      ]),
    });
    const match = (
      visibleText: string,
      allowMeasurementTranslation: boolean,
      requiredOwner: "CANDIDATE" | "JOB_CONTEXT" = "JOB_CONTEXT",
    ) =>
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText,
        section: "proofBlock",
        factIds: ["fact_level"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation,
        requiredOwner,
      });

    expect(match("Ingénieur de niveau 3.", true).unsupported).toEqual([]);
    expect(match("Ingénieur de niveau 3.", false).unsupported).not.toEqual([]);
    expect(match("Ingénieur de niveau 4.", true).unsupported).not.toEqual([]);
    expect(
      match("Ingénieur de niveau 3.", true, "CANDIDATE").unsupported,
    ).toContainEqual(
      expect.objectContaining({
        reasonCodes: expect.arrayContaining(["owner_mismatch"]),
      }),
    );
  });

  it("treats No. N rankings as numeric evidence unless a structured identity proves them", () => {
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: projection({}),
        visibleText: "I ranked No. 1 in sales.",
        section: "proofBlock",
        factIds: [],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).not.toEqual([]);

    const ranked = projection({
      factGraph: factGraph([
        { id: "fact_rank", source: "cv", text: "Ranked No. 1 in sales." },
      ]),
    });
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: ranked,
        visibleText: "I ranked No. 1 in sales.",
        section: "proofBlock",
        factIds: ["fact_rank"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: ranked,
        visibleText: "I ranked No. 2 in sales.",
        section: "proofBlock",
        factIds: ["fact_rank"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).not.toEqual([]);

    const identity = projection({
      factGraph: factGraph([
        {
          id: "fact_identity",
          source: "cv",
          text: "Managed the No. 7 brand.",
          entities: ["No. 7"],
        },
      ]),
    });
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: identity,
        visibleText: "I managed the No. 7 brand.",
        section: "proofBlock",
        factIds: ["fact_identity"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);
  });

  it.each([
    ["team", "équipes", "equipos", "teams", "squadre", "equipes", "zespoły", "teams", "ομάδες", "csapatok", "komandos", "meeskonnad", "команды", "فرق"],
    ["project", "projets", "proyectos", "projekte", "progetti", "projetos", "projekty", "projecten", "έργα", "projektek", "projektai", "projektid", "проекты", "مشاريع"],
    ["user", "utilisateurs", "usuarios", "benutzer", "utenti", "usuários", "użytkowników", "gebruikers", "χρήστες", "felhasználók", "naudotojai", "kasutajad", "пользователи", "مستخدمون"],
    ["time", "temps", "tiempo", "zeit", "tempo", "tempo", "czas", "tijd", "χρόνος", "idő", "laikas", "aeg", "время", "وقت"],
  ])(
    "covers the finite translated %s measurement matrix",
    (canonical, ...aliases) => {
      const evidence = projection({
        factGraph: factGraph([
          {
            id: `fact_${canonical}_matrix`,
            source: "cv",
            text: `Managed 4 ${canonical}.`,
          },
        ]),
      });
      for (const alias of aliases) {
        expect(
          matchPremiumCoverLetterNumericEvidence({
            projection: evidence,
            visibleText: `4 ${alias}`,
            section: "proofBlock",
            factIds: [`fact_${canonical}_matrix`],
            demandIds: [],
            claimIds: [],
            allowMeasurementTranslation: true,
          }).unsupported,
        ).toEqual([]);
      }
    },
  );

  it("treats qualitative one-compounds as prose but preserves measured units", () => {
    for (const visibleText of [
      "I built a one-stop onboarding hub.",
      "I bring a one-of-a-kind perspective.",
    ]) {
      expect(
        matchPremiumCoverLetterNumericEvidence({
          projection: projection({}),
          visibleText,
          section: "proofBlock",
          factIds: [],
          demandIds: [],
          claimIds: [],
        }).unsupported,
      ).toEqual([]);
    }
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: projection({}),
        visibleText: "I completed a one-year program.",
        section: "proofBlock",
        factIds: [],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).not.toEqual([]);
  });

  it("recognizes bounded numeric month/year ranges without accepting invalid months", () => {
    const valid = projection({
      factGraph: factGraph([
        {
          id: "fact_numeric_dates",
          source: "cv",
          text: "Engineer — 05/2020 – 06/2024",
        },
        {
          id: "fact_numeric_dates_dash",
          source: "cv",
          text: "Engineer — 05-2020 – 06-2024",
        },
      ]),
    });
    expect(
      valid.sources.filter((source) => source.role === "DATE"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factId: "fact_numeric_dates",
          normalizedValue: "2020",
        }),
        expect.objectContaining({
          factId: "fact_numeric_dates",
          normalizedValue: "2024",
        }),
        expect.objectContaining({
          factId: "fact_numeric_dates_dash",
          normalizedValue: "2020",
        }),
        expect.objectContaining({
          factId: "fact_numeric_dates_dash",
          normalizedValue: "2024",
        }),
      ]),
    );
    expect(
      matchPremiumCoverLetterNumericEvidence({
        projection: valid,
        visibleText: "I worked as an engineer from 2020 to 2024.",
        section: "proofBlock",
        factIds: ["fact_numeric_dates"],
        demandIds: [],
        claimIds: [],
      }).unsupported,
    ).toEqual([]);

    for (const text of ["Engineer — 13/2020", "Ratio 1/2020"]) {
      const invalid = projection({
        factGraph: factGraph([{ id: "fact_invalid_date", source: "cv", text }]),
      });
      expect(
        invalid.sources.some(
          (source) =>
            source.normalizedValue === "2020" && source.role === "DATE",
        ),
      ).toBe(false);
    }
  });

  it("canonicalizes source measurements independently of the output language", () => {
    const evidence = projection({
      factGraph: factGraph([
        { id: "fact_projects_fr", source: "cv", text: "Géré 5 projets." },
      ]),
    });
    const match = (visibleText: string) =>
      matchPremiumCoverLetterNumericEvidence({
        projection: evidence,
        visibleText,
        section: "proofBlock",
        factIds: ["fact_projects_fr"],
        demandIds: [],
        claimIds: [],
        allowMeasurementTranslation: false,
      }).unsupported;

    expect(match("I managed 5 projects.")).toEqual([]);
    expect(match("I managed 5 servers.")).not.toEqual([]);
  });

  it("emits one only for strong quantitative measurements", () => {
    for (const visibleText of [
      "One area where I can contribute is delivery.",
      "One challenge is reliable handoffs.",
      "One goal is clear communication.",
    ]) {
      expect(
        matchPremiumCoverLetterNumericEvidence({
          projection: projection({}),
          visibleText,
          section: "proofBlock",
          factIds: [],
          demandIds: [],
          claimIds: [],
        }).unsupported,
      ).toEqual([]);
    }
    for (const visibleText of [
      "I supported one client.",
      "I led one team.",
      "I completed a one-year program.",
    ]) {
      expect(
        matchPremiumCoverLetterNumericEvidence({
          projection: projection({}),
          visibleText,
          section: "proofBlock",
          factIds: [],
          demandIds: [],
          claimIds: [],
        }).unsupported,
      ).not.toEqual([]);
    }
  });

  it.each([
    ["3 yrs", "3 years", "3 months"],
    ["6 mos", "6 months", "6 weeks"],
    ["4 wks", "4 weeks", "4 days"],
    ["2 days", "2 days", "2 years"],
  ])(
    "normalizes duration abbreviation %s without changing units",
    (sourceDuration, visibleDuration, wrongDuration) => {
      const evidence = projection({
        factGraph: factGraph([
          {
            id: "fact_abbreviated_duration",
            source: "cv",
            text: `Delivered for ${sourceDuration}.`,
          },
        ]),
      });
      const match = (visibleText: string) =>
        matchPremiumCoverLetterNumericEvidence({
          projection: evidence,
          visibleText,
          section: "proofBlock",
          factIds: ["fact_abbreviated_duration"],
          demandIds: [],
          claimIds: [],
        }).unsupported;

      expect(match(`Delivered for ${visibleDuration}.`)).toEqual([]);
      expect(match(`Delivered for ${wrongDuration}.`)).not.toEqual([]);
    },
  );
});
