import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { PROPOSAL_OUTPUT_LANGUAGES } from "../../../convex/lib/proposals/proposalOutput";
import {
  buildCoverLetterPolicyShadowMatrix,
  evaluateCoverLetterPolicyShadowCase,
  runCoverLetterPolicyShadowMatrix,
} from "../cover-letter-policy-shadow";
import {
  COVER_LETTER_POLICY_SHADOW_CASES,
  COVER_LETTER_POLICY_SHADOW_COHORTS,
  COVER_LETTER_POLICY_SHADOW_INSUFFICIENT_CASES,
} from "../cases/cover-letter/policy-shadow-cases";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cover-letter Policy Shadow offline matrix", () => {
  it("covers all five cohorts for each of the 14 output languages", () => {
    expect(PROPOSAL_OUTPUT_LANGUAGES).toHaveLength(14);
    expect(COVER_LETTER_POLICY_SHADOW_CASES).toHaveLength(70);
    expect(
      new Set(COVER_LETTER_POLICY_SHADOW_CASES.map((item) => item.id)).size,
    ).toBe(70);

    for (const outputLanguage of PROPOSAL_OUTPUT_LANGUAGES) {
      const languageCases = COVER_LETTER_POLICY_SHADOW_CASES.filter(
        (item) => item.outputLanguage === outputLanguage,
      );
      expect(languageCases.map((item) => item.cohort).sort()).toEqual(
        [...COVER_LETTER_POLICY_SHADOW_COHORTS].sort(),
      );
    }
    expect(
      COVER_LETTER_POLICY_SHADOW_INSUFFICIENT_CASES.map(
        (item) => item.outputLanguage,
      ),
    ).toEqual([...PROPOSAL_OUTPUT_LANGUAGES]);
  });

  it("shares current production eligibility and builds valid ClaimPlanV1 records without network access", () => {
    const fetchSpy = vi.fn(() => {
      throw new Error(
        "network access is forbidden in Policy Shadow evaluation",
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    const records = runCoverLetterPolicyShadowMatrix();
    const allCases = [
      ...COVER_LETTER_POLICY_SHADOW_CASES,
      ...COVER_LETTER_POLICY_SHADOW_INSUFFICIENT_CASES,
    ];

    expect(COVER_LETTER_POLICY_SHADOW_INSUFFICIENT_CASES).toHaveLength(14);
    expect(records).toHaveLength(84);
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const [index, record] of records.entries()) {
      const input = allCases[index]!;
      expect(record).toMatchObject({
        version: "cover_letter_policy_shadow_record_v1",
        caseId: input.id,
        cohort: input.cohort,
        outputLanguage: input.outputLanguage,
        currentEligibility: input.expectedCurrentEligibility,
        graphSummary: {
          factGraphVersion: "fact_graph_v1",
          jobDemandGraphVersion: "job_demand_graph_v1",
        },
      });
      expect(record.recordHash).toMatch(/^[a-f0-9]{64}$/);
      expect(record.candidateDecision.cohort).toBe(
        input.expectedCandidateCohort,
      );

      if (input.cohort === "insufficient_input") {
        expect(record.candidateDecision).toMatchObject({
          status: "rejected",
          cohort: "insufficient_input",
          reason: "insufficient_input",
        });
        expect(record.claimPlan).toBeNull();
        expect(record.claimPlanValidationIssues).toEqual([]);
        continue;
      }

      expect(record.candidateDecision).toMatchObject({
        status: "planned",
        planningContextClass: input.expectedPlanningContextClass,
      });
      expect(record.claimPlan).toMatchObject({
        version: "claim_plan_v1",
        contextClass: input.expectedPlanningContextClass,
        language: input.outputLanguage,
      });
      expect(record.claimPlanValidationIssues).toEqual([]);
    }
  });

  it("keeps distant plans cautious and no-CV plans free of candidate fact references", () => {
    const distant = COVER_LETTER_POLICY_SHADOW_CASES.find(
      (item) => item.cohort === "distant" && item.outputLanguage === "English",
    )!;
    const distantRecord = evaluateCoverLetterPolicyShadowCase(distant);

    expect(distantRecord.currentEligibility).toEqual({
      eligible: false,
      reason: "unsupported_context_class",
    });
    expect(distantRecord.candidateDecision).toMatchObject({
      status: "planned",
      cohort: "distant_cautious",
      planningContextClass: "cv_adjacent",
    });
    expect(
      distantRecord.claimPlan?.claims.some((claim) => claim.factIds.length > 0),
    ).toBe(true);
    expect(
      distantRecord.claimPlan?.claims.find(
        (claim) => claim.section === "employerValueBlock",
      )?.claimType,
    ).toBe("adjacent_safe_bridge");

    for (const cohort of ["cv_unusable", "no_cv"] as const) {
      const input = COVER_LETTER_POLICY_SHADOW_CASES.find(
        (item) => item.cohort === cohort && item.outputLanguage === "Arabic",
      )!;
      const record = evaluateCoverLetterPolicyShadowCase(input);
      expect(record.claimPlan?.contextClass).toBe("no_cv");
      expect(
        record.claimPlan?.claims.every((claim) => claim.factIds.length === 0),
      ).toBe(true);
      expect(
        record.claimPlan?.claims.every(
          (claim) => claim.claimType === "job_surface_only_no_cv",
        ),
      ).toBe(true);
    }
  });

  it("routes localized distant offers while exposing the ClaimPlanV1 demand-anchor gap", () => {
    const localizedDistantRecords = COVER_LETTER_POLICY_SHADOW_CASES.filter(
      (item) => item.cohort === "distant",
    ).map(evaluateCoverLetterPolicyShadowCase);

    expect(localizedDistantRecords).toHaveLength(14);
    for (const record of localizedDistantRecords) {
      expect(record.currentEligibility).toEqual({
        eligible: false,
        reason: "unsupported_context_class",
      });
      expect(record.candidateDecision).toMatchObject({
        status: "planned",
        cohort: "distant_cautious",
        planningContextClass: "cv_adjacent",
      });
      expect(record.graphSummary.usableJobSurfaceDemandCount).toBeGreaterThan(
        0,
      );
      expect(record.claimPlanValidationIssues).toEqual([]);

      if (record.outputLanguage === "English") {
        expect(record.claimPlanDemandAnchorCount).toBeGreaterThan(0);
      } else {
        expect(record.claimPlanDemandAnchorCount).toBe(0);
      }
    }
  });

  it("is byte-stable for identical inputs", () => {
    const firstArtifact = buildCoverLetterPolicyShadowMatrix();
    const secondArtifact = buildCoverLetterPolicyShadowMatrix();
    const first = JSON.stringify(firstArtifact);
    const second = JSON.stringify(secondArtifact);

    expect(second).toBe(first);
    expect(firstArtifact).toEqual({
      version: "cover_letter_policy_shadow_matrix_v1",
      records: expect.any(Array),
      matrixHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(secondArtifact.matrixHash).toBe(firstArtifact.matrixHash);
  });

  it("keeps the evaluation seam free of generation and finalization dependencies", () => {
    const runnerSource = readFileSync(
      join(process.cwd(), "scripts/evals/cover-letter-policy-shadow.ts"),
      "utf8",
    );
    const casesSource = readFileSync(
      join(
        process.cwd(),
        "scripts/evals/cases/cover-letter/policy-shadow-cases.ts",
      ),
      "utf8",
    );
    const evalSource = `${runnerSource}\n${casesSource}`;

    expect(evalSource).not.toMatch(
      /attemptPremiumCoverLetterGeneration|PremiumCoverLetterWriter|finalizePremiumCoverLetter|\bfetch\s*\(|OPENAI_API_KEY|MISTRAL_API_KEY|ChatOpenAI|ChatMistralAI|Date\.now|Math\.random/,
    );
  });
});
