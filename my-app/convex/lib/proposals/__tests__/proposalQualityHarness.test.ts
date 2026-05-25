import { describe, expect, it } from "vitest";

import { analyzeCompanyValues } from "../companyValues";
import {
  COVER_LETTER_WRITING_CANON_V1,
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
      "employment-strong-frontend",
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

  it("defines CoverLetterWritingCanonV1 with the strong frontend gold target", () => {
    const gold =
      COVER_LETTER_WRITING_CANON_V1.goldTargets["employment-strong-frontend"];
    const wordCount = gold.letter.split(/\s+/).filter(Boolean).length;

    expect(COVER_LETTER_WRITING_CANON_V1.version).toBe(
      "CoverLetterWritingCanonV1",
    );
    expect(Object.keys(COVER_LETTER_WRITING_CANON_V1.openingModes)).toEqual([
      "job_thesis",
      "proof_first",
      "company_problem",
      "direct_match",
      "human_short",
      "adjacent_boundary",
      "no_context_work_surface",
    ]);
    expect(COVER_LETTER_WRITING_CANON_V1.priorityOrder).toEqual([
      "Hard job requirements",
      "Core role responsibilities",
      "Candidate CV evidence",
      "Claim boundaries",
      "Company/product context",
      "Grounded company values / working principles",
      "Natural ATS terms",
      "Tone / format mode",
    ]);
    expect(COVER_LETTER_WRITING_CANON_V1.bannedOpeningStarts).toEqual(
      expect.arrayContaining([
        "I am excited to apply",
        "I'm excited to apply",
        "I am writing to express my interest",
        "Your role requires",
        "My background aligns with",
        "The role's focus aligns with",
        "What interests me about this role",
      ]),
    );
    expect(gold.openingMode).toBe("job_thesis");
    expect(wordCount).toBeGreaterThanOrEqual(120);
    expect(wordCount).toBeLessThanOrEqual(230);
    expect(gold.letter).toBe(
      "Dear Hiring Manager,\n\nYour frontend role sits where product UI, design systems, performance, and experimentation meet. That is where my work has been strongest. At BrightLayer, I led a design-system migration used across four product squads, then reduced page-load time by 28 percent through bundle and rendering improvements.\n\nAt Northline Labs, I built experimentation dashboards for product and growth teams and partnered directly with design on customer-facing workflow improvements. The same product loop carried into signup, where targeted UI experiments improved conversion by 11 percent.\n\nI would bring React and TypeScript depth, design-system discipline, and a rigorous performance habit to your team. I have worked from the frontend side of experimentation, and I can partner cleanly with product and data teams on the analytics layer behind it.\n\nSincerely,  \nAlex Martin",
    );
    expect(gold.letter).toContain("improved conversion by 11 percent");
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

  it("passes the strong frontend gold target through writing-canon checks", () => {
    const result = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: PROPOSAL_QUALITY_FIXTURES.filter(
        (fixture) => fixture.id === "employment-strong-frontend",
      ),
    })[0];

    expect(result.coverLetterWritingCanon).toEqual(
      expect.objectContaining({
        version: "CoverLetterWritingCanonV1",
        openingMode: "job_thesis",
        hardFailures: [],
        warnings: [],
      }),
    );
    expect(assertProposalQualityHardGates([result])).toEqual([]);
  });

  it("detects banned openings, unsupported claims, and checklist prose for strong frontend outputs", () => {
    const fixture = PROPOSAL_QUALITY_FIXTURES.find(
      (candidate) => candidate.id === "employment-strong-frontend",
    );
    expect(fixture).toBeTruthy();

    const badLetter = [
      "I am writing to express my interest in the Senior Frontend Engineer role. My background aligns with the opportunity and directly aligns with your needs.",
      "The role requires React and TypeScript; I have React and TypeScript; therefore I can contribute. I own backend architecture, mobile development, and analytics instrumentation.",
      "I enjoy mentoring junior engineers and people management.",
    ].join("\n\n");
    const [result] = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: [
        {
          ...fixture!,
          letters: {
            baseline: badLetter,
            criteria_audit_shadow: badLetter,
          },
        },
      ],
    });

    expect(result.coverLetterWritingCanon.hardFailures).toEqual(
      expect.arrayContaining([
        "banned_opening_start",
        "unsupported_mentoring",
        "people_management",
        "backend_mobile_ownership",
        "analytics_instrumentation_ownership",
      ]),
    );
    expect(result.coverLetterWritingCanon.warnings).toEqual(
      expect.arrayContaining([
        "overused_aligns_with",
        "visible_checklist_rhythm",
        "sounds_like_job_description_paraphrase",
        "missing_sourced_metric",
        "missing_design_system_evidence",
        "missing_performance_evidence",
      ]),
    );
    expect(assertProposalQualityHardGates([result])).toEqual(
      expect.arrayContaining([
        "employment-strong-frontend:semantic_planner_shadow:banned_opening_start",
        "employment-strong-frontend:semantic_planner_shadow:unsupported_mentoring",
      ]),
    );
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

  it("exposes RoleThesis and generalized criteria signals on semantic planner output", () => {
    const result = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: PROPOSAL_QUALITY_FIXTURES.filter(
        (fixture) => fixture.id === "employment-strong-frontend",
      ),
    })[0];

    expect(result.truthPlan?.roleThesis).toEqual(
      expect.objectContaining({
        role_type: "frontend engineer",
        hard_job_requirements: expect.arrayContaining([
          "React and TypeScript development",
        ]),
        format_mode: "full_cover_letter",
      }),
    );
    expect(result.criteriaSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "hard_requirement",
          priority_rank: 1,
          allowed_use: "role_thesis",
        }),
        expect.objectContaining({
          category: "candidate_evidence",
          priority_rank: 3,
          allowed_use: "evidence_selection",
        }),
        expect.objectContaining({
          category: "claim_boundary",
          priority_rank: 4,
          allowed_use: "claim_boundary",
        }),
      ]),
    );
    expect(result.internalScoringRubric.groundingAccuracy).toBe(5);
    expect(result.internalScoringRubric.claimBoundaryDiscipline).toBe(5);
  });

  it("hard-fails normal-mode candidate claims without matching CV evidence", () => {
    const fixture = PROPOSAL_QUALITY_FIXTURES.find(
      (candidate) => candidate.id === "strong-fit",
    )!;
    const letter =
      "Improved signup conversion by 11 percent after iterative UI experiments. I built payroll systems and owned finance automation.";

    const [result] = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: [
        {
          ...fixture,
          letters: { baseline: letter, criteria_audit_shadow: letter },
        },
      ],
    });

    expect(result.truthPlan?.writingMode).toBe("normal");
    expect(result.truthPlanOutputCheck.status).toBe("fail");
    expect(result.truthPlanOutputCheck.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "direct_claim_without_fact",
          severity: "high",
        }),
      ]),
    );
    expect(assertProposalQualityHardGates([result])).toContain(
      "strong-fit:semantic_planner_shadow:direct_claim_without_fact",
    );
  });

  it("hard-fails blocked claims used as candidate capability while allowing safe boundary wording", () => {
    const fixture = PROPOSAL_QUALITY_FIXTURES.find(
      (candidate) => candidate.id === "unsupported-tool",
    )!;
    const unsafeLetter =
      "Maintained incident trackers and escalation handoffs for operations teams. I have Kubernetes reliability work and AWS incident response experience.";
    const safeLetter =
      "Maintained incident trackers and escalation handoffs for operations teams. Kubernetes reliability work is not source-backed here, and AWS incident response should stay as a topic to discuss.";

    const [unsafeResult, safeResult] = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: [
        {
          ...fixture,
          letters: { baseline: unsafeLetter, criteria_audit_shadow: unsafeLetter },
        },
        {
          ...fixture,
          id: "unsupported-tool-safe-boundary",
          letters: { baseline: safeLetter, criteria_audit_shadow: safeLetter },
        },
      ],
    });

    expect(unsafeResult.truthPlanOutputCheck.status).toBe("fail");
    expect(unsafeResult.truthPlanOutputCheck.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "blocked_claim_used",
          severity: "high",
        }),
      ]),
    );
    expect(assertProposalQualityHardGates([unsafeResult])).toContain(
      "unsupported-tool:semantic_planner_shadow:blocked_claim_used",
    );
    expect(safeResult.truthPlanOutputCheck.violations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "blocked_claim_used",
        }),
      ]),
    );
  });

  it("does not let fixture-safe fragments bypass unsupported capability claims", () => {
    const fixture = {
      id: "fragment-bypass-admin",
      label: "fragment bypass admin",
      jobTitle: "Administrative Coordinator",
      jobDescription:
        "Coordinate calendars, keep documentation current, and own vendor procurement.",
      contextMode: "rich" as const,
      candidateFacts: [
        {
          id: "f1",
          text: "Coordinated schedules and kept stakeholder documentation current.",
          source: "cv" as const,
          mapsTo: ["calendar coordination", "documentation"],
          priority: "workflow" as const,
        },
      ],
      expectedCriticalRequirements: [
        "calendar coordination",
        "documentation",
        "vendor procurement ownership",
      ],
      expectedSupportedKeywords: ["documentation"],
      expectedBlockedKeywords: [],
      expectedForbiddenPhrases: [],
      safeRoleTransitions: ["documentation"],
      letters: {
        baseline:
          "Coordinated schedules and kept stakeholder documentation current. That is where my work has been strongest. I can partner with vendor procurement ownership.",
        criteria_audit_shadow:
          "Coordinated schedules and kept stakeholder documentation current. That is where my work has been strongest. I can partner with vendor procurement ownership.",
      },
    };

    const [result] = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: [fixture],
    });

    expect(result.truthPlanOutputCheck.status).toBe("fail");
    expect(result.truthPlanOutputCheck.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "missing_requirement_claimed",
          severity: "high",
        }),
      ]),
    );
    expect(assertProposalQualityHardGates([result])).toContain(
      "fragment-bypass-admin:semantic_planner_shadow:missing_requirement_claimed",
    );
  });

  it("matches company-value signals only to genuinely supporting candidate evidence", () => {
    const matchingFixture = {
      id: "company-value-matched-evidence",
      label: "company value matched evidence",
      jobTitle: "Client Operations Coordinator",
      jobDescription:
        "Our principles are customer trust and accountability. Coordinate client updates and issue follow-up.",
      contextMode: "rich" as const,
      candidateFacts: [
        {
          id: "f1",
          text: "Managed weekly stakeholder updates and issue tracking for client operations.",
          source: "cv" as const,
          mapsTo: ["client updates", "issue follow-up"],
          priority: "responsibility" as const,
        },
      ],
      expectedCriticalRequirements: ["client updates"],
      expectedSupportedKeywords: ["client updates", "issue tracking"],
      expectedBlockedKeywords: [],
      expectedForbiddenPhrases: [],
      safeRoleTransitions: ["issue follow-up"],
      letters: {
        baseline:
          "Managed weekly stakeholder updates and issue tracking for client operations.",
        criteria_audit_shadow:
          "Managed weekly stakeholder updates and issue tracking for client operations.",
      },
    };
    const unmatchedFixture = {
      ...matchingFixture,
      id: "company-value-unmatched-evidence",
      jobDescription:
        "Our principles are security and trust. Maintain secure audit workflows and privacy controls.",
      candidateFacts: [
        {
          id: "f1",
          text: "Created brand campaign copy for seasonal launches.",
          source: "cv" as const,
          mapsTo: ["campaign copy"],
          priority: "responsibility" as const,
        },
      ],
      expectedCriticalRequirements: ["secure audit workflows"],
      expectedSupportedKeywords: ["campaign copy"],
      safeRoleTransitions: ["secure audit workflows"],
      letters: {
        baseline: "Created brand campaign copy for seasonal launches.",
        criteria_audit_shadow:
          "Created brand campaign copy for seasonal launches.",
      },
    };

    const [matchedResult, unmatchedResult] = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: [matchingFixture, unmatchedFixture],
    });
    const matchedValueSignals = matchedResult.criteriaSignals.filter(
      (signal) => signal.category === "company_value",
    );
    const unmatchedValueSignals = unmatchedResult.criteriaSignals.filter(
      (signal) => signal.category === "company_value",
    );

    expect(matchedValueSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allowed_use: "company_bridge",
          matched_candidate_evidence_ids: ["f1"],
        }),
      ]),
    );
    expect(
      unmatchedValueSignals.every(
        (signal) =>
          signal.allowed_use !== "company_bridge" &&
          signal.matched_candidate_evidence_ids.length === 0,
      ),
    ).toBe(true);
    expect(
      [...matchedValueSignals, ...unmatchedValueSignals]
        .filter((signal) => signal.confidence === "low")
        .every((signal) => signal.allowed_use !== "company_bridge"),
    ).toBe(true);
  });

  it("treats the frontend fixture opening as fixture-only", () => {
    const salesFixture = {
      ...PROPOSAL_QUALITY_FIXTURES.find((fixture) => fixture.id === "strong-fit")!,
      id: "sales-fixture-template-reuse",
      jobTitle: "Sales Executive",
      jobDescription:
        "Sell annual software contracts, manage prospect follow-up, and update CRM records.",
      candidateFacts: [
        {
          id: "f1",
          text: "Managed prospect follow-up and CRM records.",
          source: "cv" as const,
          mapsTo: ["prospect follow-up", "CRM records"],
          priority: "responsibility" as const,
        },
      ],
      expectedCriticalRequirements: ["prospect follow-up"],
      expectedSupportedKeywords: ["prospect follow-up", "CRM records"],
      expectedBlockedKeywords: [],
      safeRoleTransitions: ["prospect follow-up"],
      letters: {
        baseline:
          "Your frontend role sits where product UI, design systems, performance, and experimentation meet. Managed prospect follow-up and CRM records.",
        criteria_audit_shadow:
          "Your frontend role sits where product UI, design systems, performance, and experimentation meet. Managed prospect follow-up and CRM records.",
      },
    };

    const [result] = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: [salesFixture],
    });

    expect(result.coverLetterWritingCanon.hardFailures).toEqual(
      expect.arrayContaining([
        "fixture_sentence_reused_outside_fixture",
        "intersection_hook_reused_outside_fixture",
        "tech_language_on_non_tech_role",
      ]),
    );
  });

  it("fails defensive gaps, recruiter meta commentary, ATS lists, and unsupported mission praise", () => {
    const fixture = PROPOSAL_QUALITY_FIXTURES.find(
      (candidate) => candidate.id === "strong-fit",
    )!;
    const letter =
      "Although I do not have every requirement, this letter shows the evidence is strong. Skills: React, TypeScript, dashboards, A/B testing, analytics, performance. Your mission resonates with me.";

    const [result] = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: [
        {
          ...fixture,
          letters: { baseline: letter, criteria_audit_shadow: letter },
        },
      ],
    });

    expect(result.coverLetterWritingCanon.hardFailures).toEqual(
      expect.arrayContaining([
        "defensive_gap_language",
        "recruiter_meta_commentary",
        "ats_keyword_list",
        "fabricated_company_value_or_mission_claim",
      ]),
    );
  });

  it("keeps non-tech and thin-JD checks role-agnostic", () => {
    const healthcareFixture = {
      ...PROPOSAL_QUALITY_FIXTURES.find((fixture) => fixture.id === "strong-fit")!,
      id: "healthcare-tech-language",
      jobTitle: "Nurse",
      jobDescription:
        "Provide patient intake support, maintain clinical records, and communicate with care teams.",
      candidateFacts: [
        {
          id: "f1",
          text: "Maintained patient intake records.",
          source: "cv" as const,
          mapsTo: ["patient intake support", "clinical records"],
          priority: "responsibility" as const,
        },
      ],
      expectedCriticalRequirements: ["patient intake support", "clinical records"],
      expectedSupportedKeywords: ["patient intake", "records"],
      expectedBlockedKeywords: [],
      safeRoleTransitions: ["clinical records"],
      letters: {
        baseline:
          "Maintained patient intake records. I would bring React and product UI discipline to this startup-style healthcare role.",
        criteria_audit_shadow:
          "Maintained patient intake records. I would bring React and product UI discipline to this startup-style healthcare role.",
      },
    };

    const [result] = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: [healthcareFixture],
    });

    expect(result.coverLetterWritingCanon.hardFailures).toContain(
      "tech_language_on_non_tech_role",
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
    expect(baseline.plannedWritingMode).toBeNull();
    expect(baseline.plannedBlockedClaimsCount).toBeNull();
    expect(baseline.plannedMissingCriticalRequirementsCount).toBeNull();
    expect(baseline.truthPlanValidationWarnings).toEqual([]);
    expect(baseline.truthPlanOutputCheck).toEqual({
      status: "not_run",
      violations: [],
    });
    expect(baseline.truthPlanRepairAnalysis).toEqual({
      status: "not_run",
      recommendedAction: "none",
      reasons: [],
    });
    expect(semanticShadow.truthPlan?.planVersion).toBe("proposal_truth_plan_v1");
    expect(semanticShadow.truthPlan?.writingMode).toBe("normal");
    expect(semanticShadow.plannedWritingMode).toBe("normal");
    expect(semanticShadow.plannedBlockedClaimsCount).toBe(
      semanticShadow.truthPlan?.blockedClaims.length,
    );
    expect(semanticShadow.plannedMissingCriticalRequirementsCount).toBe(
      semanticShadow.truthPlan?.missingCriticalRequirements.length,
    );
    expect(semanticShadow.truthPlanValidationWarnings).toEqual([]);
    expect(semanticShadow.truthPlanOutputCheck.status).toBe("pass");
    expect(semanticShadow.truthPlanOutputCheck.violations).toEqual([]);
    expect(semanticShadow.truthPlanRepairAnalysis).toEqual({
      status: "pass",
      recommendedAction: "keep_output",
      reasons: [],
    });
    expect(semanticShadow.criteriaAudit).not.toBeNull();
    expect({
      unsupportedClaims: semanticShadow.unsupportedClaims,
      bannedCompanyPraise: semanticShadow.bannedCompanyPraise,
      missingCriticalRequirements: semanticShadow.missingCriticalRequirements,
      supportedKeywordCoverage: semanticShadow.supportedKeywordCoverage,
      advisoryKeywordLeakage: semanticShadow.advisoryKeywordLeakage,
      credentialInflation: semanticShadow.credentialInflation,
      noContextViolation: semanticShadow.noContextViolation,
      recruiterCaseScore: semanticShadow.recruiterCaseScore,
      selectorReadiness: semanticShadow.selectorReadiness,
      worseThanBaseline: semanticShadow.worseThanBaseline,
      topCandidateFactsUsed: semanticShadow.topCandidateFactsUsed,
      unsupportedOrWeaklySupportedCriteria:
        semanticShadow.unsupportedOrWeaklySupportedCriteria,
      companyValuesLanguageUsed: semanticShadow.companyValuesLanguageUsed,
      inventedClaimFree: semanticShadow.inventedClaimFree,
      paragraphGrounding: semanticShadow.paragraphGrounding,
    }).toEqual({
      unsupportedClaims: baseline.unsupportedClaims,
      bannedCompanyPraise: baseline.bannedCompanyPraise,
      missingCriticalRequirements: baseline.missingCriticalRequirements,
      supportedKeywordCoverage: baseline.supportedKeywordCoverage,
      advisoryKeywordLeakage: baseline.advisoryKeywordLeakage,
      credentialInflation: baseline.credentialInflation,
      noContextViolation: baseline.noContextViolation,
      recruiterCaseScore: baseline.recruiterCaseScore,
      selectorReadiness: baseline.selectorReadiness,
      worseThanBaseline: baseline.worseThanBaseline,
      topCandidateFactsUsed: baseline.topCandidateFactsUsed,
      unsupportedOrWeaklySupportedCriteria:
        baseline.unsupportedOrWeaklySupportedCriteria,
      companyValuesLanguageUsed: baseline.companyValuesLanguageUsed,
      inventedClaimFree: baseline.inventedClaimFree,
      paragraphGrounding: baseline.paragraphGrounding,
    });
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

  it("flags weak SEO ownership claims while allowing adjacent frontend support", () => {
    const fixture = {
      id: "freelance-weak-seo-output-check",
      label: "Weak SEO output check",
      jobTitle: "Technical SEO Overhaul for Marketplace",
      jobDescription:
        "Audit and improve technical SEO for a marketplace site, including indexing, schema, crawl diagnostics, and internal linking recommendations.",
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
      expectedCriticalRequirements: ["indexing fixes", "schema strategy", "crawl diagnostics"],
      expectedSupportedKeywords: ["Frontend", "Landing Pages"],
      expectedBlockedKeywords: ["indexing fixes", "schema strategy", "crawl diagnostics"],
      expectedForbiddenPhrases: [],
      safeRoleTransitions: ["frontend execution once a specialist defines the audit"],
      letters: {
        baseline:
          "I can handle indexing fixes, schema implementation, and crawl diagnostics. I can also support frontend execution once a specialist defines the audit.",
        criteria_audit_shadow:
          "I can handle indexing fixes, schema implementation, and crawl diagnostics. I can also support frontend execution once a specialist defines the audit.",
      },
    };

    const [result] = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: [fixture],
    });

    expect(result.truthPlanOutputCheck.status).toBe("fail");
    expect(result.truthPlanOutputCheck.violations.map((violation) => violation.type)).toEqual(
      expect.arrayContaining([
        "blocked_claim_used",
        "missing_requirement_claimed",
        "adjacent_mode_overclaim",
      ]),
    );
    expect(
      result.truthPlanOutputCheck.violations.some((violation) =>
        /frontend execution/i.test(violation.claim),
      ),
    ).toBe(false);
    expect(result.truthPlanRepairAnalysis.status).toBe("fail");
    expect(result.truthPlanRepairAnalysis.recommendedAction).toBe(
      "repair_with_truth_plan",
    );
    expect(result.truthPlanRepairAnalysis.reasons.map((reason) => reason.type)).toEqual(
      expect.arrayContaining([
        "repair_should_remove_blocked_claim",
        "missing_requirement_should_remain_gap",
        "adjacent_mode_requires_reframe",
      ]),
    );
  });

  it("flags no-context personal claims while allowing safe role interest", () => {
    const safeFixture = {
      id: "application-no-context-support-safe-output-check",
      label: "No-context safe output check",
      jobTitle: "Sales Assistant",
      jobDescription:
        "Coordinate follow-ups, keep records organized, and communicate professionally with prospects and customers.",
      contextMode: "none" as const,
      candidateFacts: [],
      expectedCriticalRequirements: ["follow-up coordination", "organized records"],
      expectedSupportedKeywords: [],
      expectedBlockedKeywords: [],
      expectedForbiddenPhrases: [],
      safeRoleTransitions: ["follow-ups", "records", "professional communication"],
      letters: {
        baseline:
          "I'm interested in the Sales Assistant role. The role centers on follow-up, records, and professional communication. I would welcome the opportunity to discuss the team process.",
        criteria_audit_shadow:
          "I'm interested in the Sales Assistant role. The role centers on follow-up, records, and professional communication. I would welcome the opportunity to discuss the team process.",
      },
    };
    const unsafeFixture = {
      ...safeFixture,
      id: "application-no-context-support-unsafe-output-check",
      letters: {
        baseline:
          "I'm interested in the Sales Assistant role because it matches how I approach new responsibilities and my attention to detail.",
        criteria_audit_shadow:
          "I'm interested in the Sales Assistant role because it matches how I approach new responsibilities and my attention to detail.",
      },
    };

    const [safeResult, unsafeResult] = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: [safeFixture, unsafeFixture],
    });

    expect(safeResult.truthPlanOutputCheck).toEqual({
      status: "pass",
      violations: [],
    });
    expect(safeResult.truthPlanRepairAnalysis).toEqual({
      status: "pass",
      recommendedAction: "keep_output",
      reasons: [],
    });
    expect(unsafeResult.truthPlanOutputCheck.status).toBe("fail");
    expect(unsafeResult.truthPlanOutputCheck.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "no_context_personal_claim",
        }),
      ]),
    );
    expect(unsafeResult.truthPlanRepairAnalysis.status).toBe("fail");
    expect(unsafeResult.truthPlanRepairAnalysis.recommendedAction).toBe("fallback");
    expect(unsafeResult.truthPlanRepairAnalysis.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "fallback_preferred_for_no_context",
          severity: "high",
        }),
      ]),
    );
  });

  it("allows backed frontend claims and flags unsupported mentoring claims", () => {
    const backedFixture = {
      id: "employment-strong-frontend-backed-output-check",
      label: "Strong frontend backed output check",
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Lead React and TypeScript development, build reusable UI systems, improve performance, and mentor junior engineers.",
      contextMode: "rich" as const,
      candidateFacts: [
        {
          id: "f1",
          text: "React",
          source: "profile" as const,
          mapsTo: ["React development"],
          priority: "tool" as const,
        },
        {
          id: "f2",
          text: "TypeScript",
          source: "profile" as const,
          mapsTo: ["TypeScript development"],
          priority: "tool" as const,
        },
        {
          id: "f3",
          text: "Led a design system migration used across 4 product squads.",
          source: "profile" as const,
          mapsTo: ["reusable UI systems"],
          priority: "responsibility" as const,
        },
        {
          id: "f4",
          text: "Reduced page load time by 28 percent through bundle and rendering optimizations.",
          source: "profile" as const,
          mapsTo: ["performance optimization"],
          priority: "achievement" as const,
        },
      ],
      expectedCriticalRequirements: ["React development", "TypeScript development", "reusable UI systems", "performance optimization"],
      expectedSupportedKeywords: ["React", "TypeScript", "design system", "28 percent"],
      expectedBlockedKeywords: [],
      expectedForbiddenPhrases: [],
      safeRoleTransitions: ["customer-facing performance"],
      letters: {
        baseline:
          "My React and TypeScript work maps to reusable UI systems. I led a design system migration used across 4 product squads and reduced page load time by 28 percent through bundle and rendering optimizations.",
        criteria_audit_shadow:
          "My React and TypeScript work maps to reusable UI systems. I led a design system migration used across 4 product squads and reduced page load time by 28 percent through bundle and rendering optimizations.",
      },
    };
    const mentoringFixture = {
      ...backedFixture,
      id: "employment-strong-frontend-mentoring-output-check",
      letters: {
        baseline:
          "My React and TypeScript work maps to reusable UI systems. I also mentor junior engineers and manage people development.",
        criteria_audit_shadow:
          "My React and TypeScript work maps to reusable UI systems. I also mentor junior engineers and manage people development.",
      },
    };

    const [backedResult, mentoringResult] = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: [backedFixture, mentoringFixture],
    });

    expect(backedResult.truthPlanOutputCheck).toEqual({
      status: "pass",
      violations: [],
    });
    expect(backedResult.truthPlanRepairAnalysis).toEqual({
      status: "pass",
      recommendedAction: "keep_output",
      reasons: [],
    });
    expect(mentoringResult.truthPlanOutputCheck.status).toBe("fail");
    expect(mentoringResult.truthPlanOutputCheck.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "unsupported_leadership_claim",
          claim: "mentoring or people-management experience",
        }),
      ]),
    );
    expect(mentoringResult.truthPlanRepairAnalysis.status).toBe("fail");
    expect(mentoringResult.truthPlanRepairAnalysis.recommendedAction).toBe(
      "repair_with_truth_plan",
    );
    expect(mentoringResult.truthPlanRepairAnalysis.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "unsupported_leadership_should_be_removed",
          severity: "high",
        }),
      ]),
    );
  });

  it("flags adjacent admin vendor ownership while allowing coordination and documentation", () => {
    const allowedFixture = {
      id: "application-adjacent-admin-allowed-output-check",
      label: "Adjacent admin allowed output check",
      jobTitle: "Administrative Coordinator",
      jobDescription:
        "Manage schedules, documentation, vendor communication, procurement, and general office support.",
      contextMode: "minimal" as const,
      candidateFacts: [
        {
          id: "f1",
          text: "Coordination",
          source: "profile" as const,
          mapsTo: ["schedule management"],
          priority: "workflow" as const,
        },
        {
          id: "f2",
          text: "Documentation",
          source: "profile" as const,
          mapsTo: ["documentation"],
          priority: "workflow" as const,
        },
        {
          id: "f3",
          text: "Stakeholder Communication",
          source: "profile" as const,
          mapsTo: ["communication"],
          priority: "workflow" as const,
        },
      ],
      expectedCriticalRequirements: ["schedule management", "documentation", "vendor procurement ownership"],
      expectedSupportedKeywords: ["Coordination", "Documentation"],
      expectedBlockedKeywords: ["vendor procurement ownership"],
      expectedForbiddenPhrases: [],
      safeRoleTransitions: ["coordination", "documentation"],
      letters: {
        baseline:
          "My coordination, documentation, and stakeholder communication experience are the relevant areas here. Vendor procurement ownership should stay as a topic to discuss.",
        criteria_audit_shadow:
          "My coordination, documentation, and stakeholder communication experience are the relevant areas here. Vendor procurement ownership should stay as a topic to discuss.",
      },
    };
    const vendorFixture = {
      ...allowedFixture,
      id: "application-adjacent-admin-vendor-output-check",
      letters: {
        baseline:
          "My coordination and documentation experience are relevant. I can own vendor procurement and office management.",
        criteria_audit_shadow:
          "My coordination and documentation experience are relevant. I can own vendor procurement and office management.",
      },
    };

    const [allowedResult, vendorResult] = runProposalQualityHarness({
      variants: ["semantic_planner_shadow"],
      fixtures: [allowedFixture, vendorFixture],
    });

    expect(allowedResult.truthPlanOutputCheck).toEqual({
      status: "pass",
      violations: [],
    });
    expect(allowedResult.truthPlanRepairAnalysis).toEqual({
      status: "pass",
      recommendedAction: "keep_output",
      reasons: [],
    });
    expect(vendorResult.truthPlanOutputCheck.status).toBe("fail");
    expect(vendorResult.truthPlanOutputCheck.violations.map((violation) => violation.type)).toEqual(
      expect.arrayContaining([
        "blocked_claim_used",
        "missing_requirement_claimed",
        "adjacent_mode_overclaim",
      ]),
    );
    expect(vendorResult.truthPlanRepairAnalysis.status).toBe("fail");
    expect(vendorResult.truthPlanRepairAnalysis.recommendedAction).toBe(
      "repair_with_truth_plan",
    );
    expect(vendorResult.truthPlanRepairAnalysis.reasons.map((reason) => reason.type)).toEqual(
      expect.arrayContaining([
        "repair_should_remove_blocked_claim",
        "missing_requirement_should_remain_gap",
        "adjacent_mode_requires_reframe",
      ]),
    );
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
