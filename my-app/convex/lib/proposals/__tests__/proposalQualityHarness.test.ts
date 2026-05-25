import { describe, expect, it } from "vitest";

import { analyzeCompanyValues } from "../companyValues";
import {
  DEFAULT_PROPOSAL_QUALITY_HARNESS_HARDNESS,
  PROPOSAL_QUALITY_FIXTURES,
  PROPOSAL_QUALITY_HARNESS_ARCHITECTURE,
  PROPOSAL_QUALITY_NEGATIVE_CONTROL_FIXTURES,
  assertProposalQualityHardGates,
  runProposalQualityHarness,
} from "../proposalQualityHarness";

describe("proposal quality harness", () => {
  it("labels the deterministic harness as static safety with standard default hardness", () => {
    const results = runProposalQualityHarness({
      variants: ["baseline", "criteria_audit_shadow"],
    });

    expect(DEFAULT_PROPOSAL_QUALITY_HARNESS_HARDNESS).toBe("standard");
    expect(PROPOSAL_QUALITY_HARNESS_ARCHITECTURE.static_safety.status).toBe(
      "implemented",
    );
    expect(PROPOSAL_QUALITY_HARNESS_ARCHITECTURE.pipeline_mocked.status).toBe(
      "designed",
    );
    expect(PROPOSAL_QUALITY_HARNESS_ARCHITECTURE.future_llm_eval.status).toBe(
      "designed",
    );
    expect(results.every((result) => result.harnessKind === "static_safety")).toBe(true);
    expect(results.every((result) => result.harnessHardness === "standard")).toBe(true);
    expect(
      results
        .filter((result) => result.variant === "criteria_audit_shadow")
        .every(
          (result) => result.comparisonKind === "shadow_parity_safety_check",
        ),
    ).toBe(true);
  });

  it("contains selector-ready fixtures for baseline and criteria shadow comparison", () => {
    expect(PROPOSAL_QUALITY_FIXTURES.map((fixture) => fixture.id)).toEqual([
      "strong-fit",
      "weak-candidate-ambitious-job",
      "no-context",
      "explicit-company-values",
      "generic-employer-fluff",
      "implicit-values",
      "missing-hard-credential",
      "unsupported-tool",
      "transferable-adjacent",
      "seniority-mismatch",
      "ats-keyword-heavy",
    ]);

    for (const fixture of PROPOSAL_QUALITY_FIXTURES) {
      expect(fixture.jobTitle).toBeTruthy();
      expect(fixture.jobDescription).toBeTruthy();
      expect(fixture.expectedCriticalRequirements.length).toBeGreaterThan(0);
      expect(fixture.expectedForbiddenPhrases).toContain("I share your values");
      expect(fixture.topJobPriorities.length).toBeGreaterThan(0);
      expect(fixture.sourceBackedCandidateFacts).toHaveLength(
        fixture.candidateFacts.length,
      );
      expect(fixture.blockedClaims.length).toBe(
        fixture.expectedBlockedKeywords.length,
      );
      expect(fixture.letters.baseline).toBeTruthy();
      expect(fixture.letters.criteria_audit_shadow).toBeTruthy();
    }
  });

  it("compares baseline with criteria_audit_shadow without regressions", () => {
    const results = runProposalQualityHarness({
      variants: ["baseline", "criteria_audit_shadow"],
    });
    const failures = assertProposalQualityHardGates(results);

    expect(failures).toEqual([]);
    expect(results).toHaveLength(PROPOSAL_QUALITY_FIXTURES.length * 2);
    expect(
      results.filter((result) => result.variant === "criteria_audit_shadow"),
    ).toHaveLength(PROPOSAL_QUALITY_FIXTURES.length);
    expect(results.every((result) => result.inventedClaimFree)).toBe(true);
    expect(results.every((result) => !result.worseThanBaseline)).toBe(true);
    expect(
      results
        .filter((result) => result.variant === "criteria_audit_shadow")
        .every((result) => result.criteriaAudit !== null),
    ).toBe(true);
  });

  it("does not claim quality improvement when shadow uses the same letter text", () => {
    for (const fixture of PROPOSAL_QUALITY_FIXTURES) {
      expect(fixture.letters.criteria_audit_shadow).toBe(
        fixture.letters.baseline,
      );
    }
    expect(
      runProposalQualityHarness()
        .filter((result) => result.variant === "criteria_audit_shadow")
        .every(
          (result) => result.comparisonKind === "shadow_parity_safety_check",
        ),
    ).toBe(true);
  });

  it("requires every paragraph to have candidate evidence or a role-specific transition", () => {
    const results = runProposalQualityHarness();

    for (const result of results) {
      expect(
        result.paragraphGrounding.every(
          (paragraph) =>
            paragraph.hasSourceBackedFact ||
            paragraph.hasJustifiedRoleTransition,
        ),
      ).toBe(true);
    }
  });

  it("flags no-context personal approach claims in generated text", () => {
    const fixture = PROPOSAL_QUALITY_FIXTURES.find(
      (candidate) => candidate.id === "no-context",
    );
    expect(fixture).toBeTruthy();
    const letter =
      "The role’s focus on structure and clarity aligns with how I approach new responsibilities.";
    const [result] = runProposalQualityHarness({
      variants: ["baseline"],
      fixtures: [
        {
          ...fixture!,
          letters: {
            baseline: letter,
            criteria_audit_shadow: letter,
          },
        },
      ],
    });

    expect(result.noContextViolation).toBe(true);
    expect(result.inventedClaimFree).toBe(false);
  });

  it("reports fact mapping and unsupported criteria for final reports", () => {
    const results = runProposalQualityHarness();
    const strongFit = results.find(
      (result) =>
        result.fixtureId === "strong-fit" &&
        result.variant === "criteria_audit_shadow",
    );
    const missingCredential = results.find(
      (result) =>
        result.fixtureId === "missing-hard-credential" &&
        result.variant === "criteria_audit_shadow",
    );

    expect(strongFit?.topCandidateFactsUsed[0]).toEqual(
      expect.objectContaining({
        source: "profile",
        jobPriority: "improve experimentation workflows",
      }),
    );
    expect(missingCredential?.unsupportedOrWeaklySupportedCriteria).toContain(
      "PMP certification",
    );
    expect(missingCredential?.credentialInflation).toBe(false);
  });

  it("exposes criteria audit fields in criteria shadow results", () => {
    const shadow = runProposalQualityHarness().find(
      (result) =>
        result.fixtureId === "ats-keyword-heavy" &&
        result.variant === "criteria_audit_shadow",
    );

    expect(shadow?.criteriaAudit?.keywordReusePolicy.supported).toEqual(
      expect.arrayContaining(["pipeline dashboards", "stakeholder follow-up"]),
    );
    expect(shadow?.criteriaAudit?.keywordReusePolicy.blocked).toEqual(
      expect.arrayContaining(["SQL analysis", "Salesforce reporting"]),
    );
  });

  it("attaches truthPlan only to semantic planner shadow results without changing scored output", () => {
    const fixture = PROPOSAL_QUALITY_FIXTURES.find(
      (candidate) => candidate.id === "strong-fit",
    );
    expect(fixture).toBeTruthy();

    const [baseline, semanticShadow] = runProposalQualityHarness({
      variants: ["baseline", "semantic_planner_shadow"],
      fixtures: [fixture!],
    });

    expect(baseline.truthPlan).toBeNull();
    expect(semanticShadow.truthPlan?.planVersion).toBe("proposal_truth_plan_v1");
    expect(semanticShadow.truthPlan?.writingMode).toBe("normal");
    expect(semanticShadow.criteriaAudit).not.toBeNull();
    expect(semanticShadow.recruiterCaseScore).toBe(baseline.recruiterCaseScore);
    expect(semanticShadow.topCandidateFactsUsed).toEqual(
      baseline.topCandidateFactsUsed,
    );
    expect(fixture!.letters.criteria_audit_shadow).toBe(fixture!.letters.baseline);
  });

  it("classifies semantic planner shadow fixture families without affecting hard gates", () => {
    const weakSeoFixture = {
      id: "freelance-weak-seo",
      label: "Weak freelance match: technical SEO overhaul",
      jobTitle: "Technical SEO Overhaul for Marketplace",
      jobDescription:
        "Looking for a freelancer to audit and improve technical SEO for a large marketplace site, including indexing, schema, crawl diagnostics, and internal linking recommendations.",
      contextMode: "minimal" as const,
      candidateFacts: [
        {
          id: "f1",
          text: "Frontend",
          source: "profile" as const,
          mapsTo: ["frontend execution"],
          priority: "tool" as const,
        },
        {
          id: "f2",
          text: "Landing Pages",
          source: "profile" as const,
          mapsTo: ["landing-page structure"],
          priority: "workflow" as const,
        },
        {
          id: "f3",
          text: "Conversion Optimization",
          source: "profile" as const,
          mapsTo: ["conversion-aware page improvements"],
          priority: "workflow" as const,
        },
      ],
      expectedCriticalRequirements: [
        "indexing fixes",
        "schema strategy / schema implementation",
        "crawl diagnostics",
        "internal-linking recommendations",
      ],
      expectedSupportedKeywords: ["Frontend", "Landing Pages"],
      expectedBlockedKeywords: ["indexing fixes", "schema strategy / schema implementation", "crawl diagnostics", "internal-linking recommendations"],
      expectedForbiddenPhrases: ["I share your values"],
      safeRoleTransitions: ["should be led by a technical SEO specialist"],
      letters: {
        baseline:
          "Frontend and landing-page work are the supported areas here.\n\nIndexing, schema strategy, crawl diagnostics, and internal-linking recommendations should be led by a technical SEO specialist.",
        criteria_audit_shadow:
          "Frontend and landing-page work are the supported areas here.\n\nIndexing, schema strategy, crawl diagnostics, and internal-linking recommendations should be led by a technical SEO specialist.",
      },
    };

    const [result] = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: [weakSeoFixture],
    });

    expect(result.truthPlan?.writingMode).toBe("adjacent_only");
    expect(result.truthPlan?.blockedClaims.map((claim) => claim.claim)).toEqual(
      expect.arrayContaining([
        "technical SEO specialist",
        "indexing fixes",
        "schema strategy / schema implementation",
        "crawl diagnostics",
        "internal-linking recommendations",
      ]),
    );
    expect(result.truthPlan?.missingCriticalRequirements.map((entry) => entry.requirement)).toEqual(
      expect.arrayContaining([
        "indexing fixes",
        "schema strategy / schema implementation",
        "crawl diagnostics",
        "internal-linking recommendations",
      ]),
    );
    expect(assertProposalQualityHardGates([result])).toEqual([]);
  });

  it("catches negative-control bad letters with hard gates", () => {
    const results = runProposalQualityHarness({
      variants: ["baseline"],
      fixtures: PROPOSAL_QUALITY_NEGATIVE_CONTROL_FIXTURES,
      hardness: "adversarial",
    });
    const failures = assertProposalQualityHardGates(results);

    for (const fixture of PROPOSAL_QUALITY_NEGATIVE_CONTROL_FIXTURES) {
      expect(fixture.expectedFailureCodes?.length).toBeGreaterThan(0);
      for (const expectedFailure of fixture.expectedFailureCodes ?? []) {
        expect(failures).toContain(expectedFailure);
      }
    }
    expect(
      results.some((result) => result.fixtureId === "negative-ungrounded-paragraph"),
    ).toBe(true);
  });

  it("keeps company values bounded in harness safety checks", () => {
    expect(
      analyzeCompanyValues(
        "Support users on a fast-paced team and keep customer questions moving.",
      ).confidence,
    ).toBe("none");
    expect(
      analyzeCompanyValues(
        "Maintain compliance logs and review safety records. Keep compliance documentation current and verify safety handoffs.",
      ).confidence,
    ).toBe("implicit");
    expect(
      analyzeCompanyValues(
        "We offer a dynamic, world-class, innovative, high-performing, great culture.",
      ).confidence,
    ).toBe("none");
    expect(
      analyzeCompanyValues(
        "Our principles are trust and customer care. Coordinate client records.",
      ).confidence,
    ).toBe("explicit");
  });

  it("keeps no-context shadow output free of fake evidence and alignment", () => {
    const noContext = runProposalQualityHarness().find(
      (result) =>
        result.fixtureId === "no-context" &&
        result.variant === "criteria_audit_shadow",
    );

    expect(noContext?.noContextViolation).toBe(false);
    expect(noContext?.bannedCompanyPraise).toBe(0);
    expect(noContext?.topCandidateFactsUsed).toEqual([]);
  });
});
