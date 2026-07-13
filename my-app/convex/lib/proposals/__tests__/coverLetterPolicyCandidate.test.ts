import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { decideCoverLetterPolicyCandidateV1 } from "../coverLetterPolicyCandidate";
import type {
  FactGraphV1,
  JobDemandGraphV1,
  PremiumCoverLetterEligibility,
  RankedEvidencePack,
} from "../premiumCoverLetter";

const emptyRankedEvidencePack: RankedEvidencePack = {
  strongestEvidence: [],
  supportingEvidence: [],
  secondaryQualifications: [],
  transferCore: [],
  weakOrDoNotLeadWith: [],
};

type JobDemandBucket = JobDemandGraphV1["demands"][number]["bucket"];

const REQUIREDNESS_BY_BUCKET: Record<
  JobDemandBucket,
  JobDemandGraphV1["demands"][number]["requiredness"]
> = {
  core_responsibility: "core",
  key_requirement: "required",
  preferred_qualification: "preferred",
  low_value_checklist: "low_value",
  company_fluff: "fluff",
};

function buildFactGraph(
  cvText?: string,
  category: "responsibility" | "tool" = "responsibility",
): FactGraphV1 {
  return {
    version: "fact_graph_v1",
    facts: cvText
      ? [
          {
            id: "fact_cv_001",
            text: cvText,
            source: "cv",
            sourcePath: "summary[0]",
            confidence: "high",
            category,
            metrics: [],
            entities: [],
            allowedVerbs: ["coordinated"],
            forbiddenUpgrades: ["led", "owned"],
            ownershipLevel: "coordination",
          },
        ]
      : [],
  };
}

function buildJobDemandGraph(
  bucket: JobDemandBucket | null = "core_responsibility",
): JobDemandGraphV1 {
  return {
    version: "job_demand_graph_v1",
    demands: bucket
      ? [
          {
            id: "demand_001",
            text: "Coordinate reliable cross-functional delivery.",
            bucket,
            requiredness: REQUIREDNESS_BY_BUCKET[bucket],
            tokens: ["coordinate", "delivery"],
            mustNotBecomeCandidateClaim: true,
          },
        ]
      : [],
    priorityTokens: bucket ? ["coordinate", "delivery"] : [],
  };
}

function withRankedCvEvidence(
  text: string,
  category: "responsibility" | "tool" = "responsibility",
): RankedEvidencePack {
  return {
    ...emptyRankedEvidencePack,
    strongestEvidence: [
      {
        text,
        source: "cv",
        confidence: "high",
        category,
      },
    ],
    transferCore:
      category === "responsibility"
        ? [
            {
              text,
              source: "cv",
              confidence: "high",
              category,
            },
          ]
        : [],
  };
}

function decide(args: {
  currentEligibility: PremiumCoverLetterEligibility;
  cvText?: string;
  cvCategory?: "responsibility" | "tool";
  rankedEvidencePack?: RankedEvidencePack;
  demandBucket?: Parameters<typeof buildJobDemandGraph>[0];
  hasCvInput: boolean;
}) {
  return decideCoverLetterPolicyCandidateV1({
    currentEligibility: args.currentEligibility,
    factGraph: buildFactGraph(args.cvText, args.cvCategory),
    jobDemandGraph: buildJobDemandGraph(args.demandBucket),
    rankedEvidencePack: args.rankedEvidencePack ?? emptyRankedEvidencePack,
    hasCvInput: args.hasCvInput,
  });
}

describe("decideCoverLetterPolicyCandidateV1", () => {
  it("keeps the policy candidate source deterministic and runtime-dependency free", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "convex/lib/proposals/coverLetterPolicyCandidate.ts",
      ),
      "utf8",
    );

    expect(source).toMatch(/^import type \{/u);
    expect(source.match(/\.\/premiumCoverLetter/g)).toHaveLength(1);
    expect(source).not.toMatch(/import\s+(?!type\b)/u);
    expect(source).not.toMatch(
      /@langchain|@mistralai|\bfetch\s*\(|process\.env|Date\.now|Math\.random|\bctx\.db\b|convex\/server/u,
    );
  });

  it.each([
    ["cv_direct", "direct"],
    ["cv_adjacent", "adjacent"],
  ] as const)(
    "preserves the current %s planning context",
    (contextClass, cohort) => {
      expect(
        decide({
          currentEligibility: { eligible: true, contextClass },
          cvText: "Coordinated recurring operational handoffs.",
          rankedEvidencePack: withRankedCvEvidence(
            "Coordinated recurring operational handoffs.",
          ),
          hasCvInput: true,
        }),
      ).toEqual({
        version: "cover_letter_policy_candidate_v1",
        status: "planned",
        cohort,
        planningContextClass: contextClass,
      });
    },
  );

  it("distinguishes current no-CV planning from a present but unusable CV", () => {
    expect(
      decide({
        currentEligibility: { eligible: true, contextClass: "no_cv" },
        hasCvInput: false,
      }),
    ).toMatchObject({
      status: "planned",
      cohort: "no_cv_job_surface_only",
      planningContextClass: "no_cv",
    });
    expect(
      decide({
        currentEligibility: { eligible: true, contextClass: "no_cv" },
        hasCvInput: true,
      }),
    ).toMatchObject({
      status: "planned",
      cohort: "cv_unusable_job_surface_only",
      planningContextClass: "no_cv",
    });
  });

  it.each([
    ["English", "Coordinated weekly operational handoffs."],
    ["French", "Coordination des transmissions opérationnelles hebdomadaires."],
    ["Spanish", "Coordinación de entregas operativas semanales."],
    ["German", "Koordination wöchentlicher operativer Übergaben."],
    ["Italian", "Coordinamento dei passaggi operativi settimanali."],
    ["Portuguese", "Coordenação de transições operacionais semanais."],
    ["Polish", "Koordynacja cotygodniowych przekazań operacyjnych."],
    ["Dutch", "Coördinatie van wekelijkse operationele overdrachten."],
    ["Greek", "Συντονισμός εβδομαδιαίων λειτουργικών παραδόσεων."],
    ["Hungarian", "Heti operatív átadások koordinálása."],
    ["Lithuanian", "Savaitinių veiklos perdavimų koordinavimas."],
    ["Estonian", "Iganädalaste tööüleandmiste koordineerimine."],
    ["Russian", "Координация еженедельной передачи операционных задач."],
    ["Arabic", "تنسيق عمليات التسليم التشغيلية الأسبوعية."],
  ] as const)(
    "plans distant cautious evidence without language-specific text rules for %s",
    (_language, cvText) => {
      expect(
        decide({
          currentEligibility: {
            eligible: false,
            reason: "unsupported_context_class",
          },
          cvText,
          rankedEvidencePack: withRankedCvEvidence(cvText),
          hasCvInput: true,
        }),
      ).toEqual({
        version: "cover_letter_policy_candidate_v1",
        status: "planned",
        cohort: "distant_cautious",
        planningContextClass: "cv_adjacent",
      });
    },
  );

  it("uses no-CV planning when substantive job surface exists but CV evidence is unusable or absent", () => {
    expect(
      decide({
        currentEligibility: {
          eligible: false,
          reason: "unsupported_context_class",
        },
        cvText: "Spreadsheet software.",
        cvCategory: "tool",
        rankedEvidencePack: withRankedCvEvidence(
          "Spreadsheet software.",
          "tool",
        ),
        hasCvInput: true,
      }),
    ).toMatchObject({
      status: "planned",
      cohort: "cv_unusable_job_surface_only",
      planningContextClass: "no_cv",
    });
    expect(
      decide({
        currentEligibility: {
          eligible: false,
          reason: "unsupported_context_class",
        },
        hasCvInput: false,
      }),
    ).toMatchObject({
      status: "planned",
      cohort: "no_cv_job_surface_only",
      planningContextClass: "no_cv",
    });
  });

  it("treats a preferred demand as usable fallback job surface for multilingual graphs", () => {
    const cvText = "Coordinated recurring operational handoffs.";
    expect(
      decide({
        currentEligibility: {
          eligible: false,
          reason: "unsupported_context_class",
        },
        cvText,
        rankedEvidencePack: withRankedCvEvidence(cvText),
        demandBucket: "preferred_qualification",
        hasCvInput: true,
      }),
    ).toMatchObject({
      status: "planned",
      cohort: "distant_cautious",
      planningContextClass: "cv_adjacent",
    });
  });

  it.each(["low_value_checklist", "company_fluff", null] as const)(
    "does not treat %s as usable job surface",
    (demandBucket) => {
      const cvText = "Coordinated recurring operational handoffs.";
      expect(
        decide({
          currentEligibility: {
            eligible: false,
            reason: "unsupported_context_class",
          },
          cvText,
          rankedEvidencePack: withRankedCvEvidence(cvText),
          demandBucket,
          hasCvInput: true,
        }),
      ).toEqual({
        version: "cover_letter_policy_candidate_v1",
        status: "rejected",
        cohort: "insufficient_input",
        reason: "insufficient_input",
      });
    },
  );

  it("requires ranked adjacent evidence to correspond to a usable CV fact", () => {
    expect(
      decide({
        currentEligibility: {
          eligible: false,
          reason: "unsupported_context_class",
        },
        cvText: "Coordinated recurring operational handoffs.",
        rankedEvidencePack: withRankedCvEvidence(
          "A different and ungrounded candidate assertion.",
        ),
        hasCvInput: true,
      }),
    ).toMatchObject({
      status: "planned",
      cohort: "cv_unusable_job_surface_only",
      planningContextClass: "no_cv",
    });
  });

  it.each([
    "flag_disabled",
    "missing_cv",
    "preset_not_supported",
    "no_allowed_facts",
  ] as const)("preserves the non-context rejection %s", (reason) => {
    const cvText = "Coordinated recurring operational handoffs.";
    expect(
      decide({
        currentEligibility: { eligible: false, reason },
        cvText,
        rankedEvidencePack: withRankedCvEvidence(cvText),
        hasCvInput: true,
      }),
    ).toEqual({
      version: "cover_letter_policy_candidate_v1",
      status: "rejected",
      cohort: "preserved_rejection",
      reason,
    });
  });
});
