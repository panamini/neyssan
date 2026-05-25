import { describe, expect, it } from "vitest";

import {
  buildProposalEvidenceSummary,
  buildProposalPlannerPrompt,
  buildProposalSourceFactBank,
  buildProposalTruthPlanV1,
  buildProposalWriterPlanBlock,
  containsForbiddenProposalBridge,
  computeProposalPlannerContextMode,
  getProposalPlannerOpeningStrategy,
  normalizeProposalPlannerResult,
  validateProposalTruthPlanV1,
  type ProposalPlannerResult,
  type ProposalTruthPlanV1,
} from "../proposalPlanner";

describe("proposal planner helpers", () => {
  it("maps preset selection to stable opening strategies", () => {
    expect(getProposalPlannerOpeningStrategy("signature")).toBe(
      "signature_default",
    );
    expect(getProposalPlannerOpeningStrategy("expert")).toBe(
      "expert_structured",
    );
    expect(getProposalPlannerOpeningStrategy("direct")).toBe("direct_fast");
    expect(getProposalPlannerOpeningStrategy("engaging")).toBe(
      "engaging_people",
    );
    expect(getProposalPlannerOpeningStrategy("storyteller")).toBe(
      "storyteller_thread",
    );
  });

  it("builds the compact ProposalTruthPlanV1 schema shape", () => {
    const plan = buildProposalTruthPlanV1({
      jobTitle: "Sales Assistant",
      jobDescription:
        "Coordinate follow-ups, keep records organized, and communicate professionally with customers.",
      contextMode: "none",
    });

    expect(plan.planVersion).toBe("proposal_truth_plan_v1");
    expect(["normal", "adjacent_only", "no_context_safe"]).toContain(
      plan.writingMode,
    );
    expect(["high", "medium", "low"]).toContain(plan.modeConfidence);
    expect([
      "normal_writer",
      "constrained_writer",
      "bypass_writer_use_fallback",
    ]).toContain(plan.writerPolicy);
    expect(Array.isArray(plan.jobPriorities)).toBe(true);
    expect(Array.isArray(plan.candidateFacts)).toBe(true);
    expect(Array.isArray(plan.allowedClaims)).toBe(true);
    expect(Array.isArray(plan.blockedClaims)).toBe(true);
    expect(Array.isArray(plan.missingCriticalRequirements)).toBe(true);
    expect(validateProposalTruthPlanV1(plan)).toEqual([]);
  });

  it("flags empty factIds on direct candidate truth-plan claims", () => {
    const invalidPlan: ProposalTruthPlanV1 = {
      planVersion: "proposal_truth_plan_v1",
      writingMode: "normal",
      modeConfidence: "high",
      writerPolicy: "normal_writer",
      jobPriorities: [],
      candidateFacts: [],
      allowedClaims: [
        {
          claim: "React development",
          factIds: [],
          strength: "direct",
          claimType: "candidate_fact",
        },
      ],
      blockedClaims: [],
      missingCriticalRequirements: [],
    };

    expect(validateProposalTruthPlanV1(invalidPlan).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "direct_claim_missing_fact_ids",
        "candidate_claim_missing_fact_ids",
      ]),
    );
  });

  it("classifies no-context Sales Assistant plans as safe fallback plans", () => {
    const plan = buildProposalTruthPlanV1({
      jobTitle: "Sales Assistant",
      jobDescription:
        "We are looking for a Sales Assistant who can coordinate follow-up, keep records organized, and communicate professionally with prospects and customers.",
      contextMode: "none",
    });

    expect(plan.writingMode).toBe("no_context_safe");
    expect(plan.writerPolicy).toBe("bypass_writer_use_fallback");
    expect(plan.candidateFacts).toEqual([]);
    expect(plan.allowedClaims.every((claim) => claim.strength === "soft")).toBe(true);
    expect(
      plan.allowedClaims.every((claim) =>
        ["role_interest", "job_surface", "discussion_forward"].includes(
          claim.claimType,
        ),
      ),
    ).toBe(true);
    expect(plan.allowedClaims.some((claim) => claim.factIds.length === 0)).toBe(true);
    expect(plan.allowedClaims.map((claim) => claim.claim).join(" ")).toContain(
      "Sales Assistant",
    );
    const blocked = plan.blockedClaims.map((claim) => claim.claim).join(" ");
    expect(blocked).toContain("prior sales experience");
    expect(blocked).toContain("CRM expertise");
    expect(blocked).toContain("quota ownership");
    expect(blocked).toContain("how I approach new responsibilities");
    expect(blocked).toContain("attention to detail");
    expect(blocked).toContain("confidence or comfort");
    expect(blocked).toContain("personal work-style claims");
    expect(validateProposalTruthPlanV1(plan)).toEqual([]);
  });

  it("classifies weak technical SEO as adjacent-only with SEO gaps blocked", () => {
    const plan = buildProposalTruthPlanV1({
      jobTitle: "Technical SEO Overhaul for Marketplace",
      jobDescription:
        "Looking for a freelancer to audit and improve technical SEO for a large marketplace site, including indexing, schema, crawl diagnostics, and internal linking recommendations.",
      contextMode: "minimal",
      personalizationContext: {
        summary:
          "Frontend-focused freelance designer-developer with conversion and landing page experience.",
        desiredPosition: "Freelance Product Designer",
        topSkills: ["Frontend", "Landing Pages", "Conversion Optimization"],
      },
    });

    expect(plan.writingMode).toBe("adjacent_only");
    expect(plan.candidateFacts.map((fact) => fact.fact)).toEqual(
      expect.arrayContaining([
        "Frontend",
        "Landing Pages",
        "Conversion Optimization",
      ]),
    );
    const blocked = plan.blockedClaims.map((claim) => claim.claim).join(" | ");
    expect(blocked).toContain("technical SEO specialist");
    expect(blocked).toContain("indexing fixes");
    expect(blocked).toContain("schema strategy / schema implementation");
    expect(blocked).toContain("crawl diagnostics");
    expect(blocked).toContain("internal-linking recommendations");
    expect(plan.missingCriticalRequirements.map((entry) => entry.requirement)).toEqual(
      expect.arrayContaining([
        "indexing fixes",
        "schema strategy / schema implementation",
        "crawl diagnostics",
        "internal-linking recommendations",
      ]),
    );
    expect(
      plan.allowedClaims
        .filter((claim) => /frontend|landing|conversion/i.test(claim.claim))
        .every((claim) => claim.strength !== "direct" || claim.factIds.length > 0),
    ).toBe(true);
    expect(
      plan.allowedClaims.some(
        (claim) =>
          claim.strength === "adjacent" &&
          /indexing|schema|crawl|internal/i.test(claim.claim),
      ),
    ).toBe(true);
  });

  it("classifies strong frontend as normal and keeps unsupported leadership blocked", () => {
    const plan = buildProposalTruthPlanV1({
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "We are hiring a Senior Frontend Engineer to lead React and TypeScript development for a customer-facing SaaS platform. The role includes building reusable UI systems, improving performance, collaborating with product and design, and mentoring junior engineers. Experience with analytics instrumentation and experimentation is a plus.",
      contextMode: "rich",
      personalizationContext: {
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
    });

    expect(plan.writingMode).toBe("normal");
    expect(
      plan.allowedClaims
        .filter((claim) => claim.strength === "direct")
        .every((claim) => claim.factIds.length > 0),
    ).toBe(true);
    expect(plan.allowedClaims.map((claim) => claim.claim)).toEqual(
      expect.arrayContaining([
        "React development",
        "TypeScript development",
        "reusable UI systems",
        "performance optimization",
        "experimentation workflows",
      ]),
    );
    expect(plan.blockedClaims.map((claim) => claim.claim)).toEqual(
      expect.arrayContaining([
        "mentoring or people-management experience",
        "analytics instrumentation as direct experience",
      ]),
    );
    expect(validateProposalTruthPlanV1(plan)).toEqual([]);
  });

  it("builds a compact source fact bank from candidate context", () => {
    const facts = buildProposalSourceFactBank({
      summary:
        "Presently finishing a bachelor's in criminal justice and qualified as a CPO.",
      topSkills: ["Investigation skills", "Safety compliance"],
      recentExperience: [
        {
          company: "ADT Security",
          position: "Security Guard",
          highlights: [
            "Monitoring selected areas via CCTV app on smart devices.",
          ],
        },
      ],
      standoutAchievements: [
        "Decreased theft by 73% by improving vigilance strategies.",
      ],
    });

    expect(facts).toContain(
      "Presently finishing a bachelor's in criminal justice and qualified as a CPO.",
    );
    expect(facts).toContain("Investigation skills");
    expect(facts).toContain("Security Guard at ADT Security");
    expect(facts).toContain(
      "Monitoring selected areas via CCTV app on smart devices.",
    );
    expect(facts).toContain(
      "Decreased theft by 73% by improving vigilance strategies.",
    );
  });

  it("keeps entity abbreviations intact and drops numeric OCR residue from the fact bank", () => {
    const facts = buildProposalSourceFactBank({
      summary:
        "Worked with Home Credit India Finance Pvt. Ltd. on client documentation.",
      topSkills: [],
      recentExperience: [
        {
          company: "Ascension St. Vincent",
          position: "Coordinator",
          highlights: [
            "Supported records review for Ascension St. Vincent teams.",
            "8 month work experience in Home Credit India Finance Pvt.",
          ],
        },
      ],
      standoutAchievements: [],
    });

    expect(facts).toContain(
      "Worked with Home Credit India Finance Pvt. Ltd. on client documentation.",
    );
    expect(facts).toContain("Coordinator at Ascension St. Vincent");
    expect(facts).toContain(
      "Supported records review for Ascension St. Vincent teams.",
    );
    expect(facts).not.toContain(
      "8 month work experience in Home Credit India Finance Pvt.",
    );
  });

  it("drops malformed snippets from the source fact bank before they reach proposal generation", () => {
    const facts = buildProposalSourceFactBank({
      summary: "Reduced theft by 73% through improved vigilance strategies.",
      topSkills: [],
      recentExperience: [
        {
          company: "Robert Cooper Security Guard",
          position: "Security Guard",
          highlights: [
            "The 15 360-degree CCTV cameras I installed to enhance monitoring procedures.",
            "This required attention to detail and problem-solving—qualities.",
            "Documented incidents clearly for hotel operations.",
          ],
        },
      ],
      standoutAchievements: [],
    });

    expect(facts).toContain("Security Guard at Robert Cooper Security Guard");
    expect(facts).toContain("Documented incidents clearly for hotel operations.");
    expect(facts).not.toContain(
      "The 15 360-degree CCTV cameras I installed to enhance monitoring procedures.",
    );
    expect(facts).not.toContain(
      "This required attention to detail and problem-solving—qualities.",
    );
  });

  it("forces the no-context plan into a non-claiming configuration", () => {
    const rawPlan: ProposalPlannerResult = {
      context_mode: "rich",
      domain_gap: "direct",
      credential_status: "exact_required",
      transfer_mode: "literal",
      output_language: "fr",
      allowed_concrete_facts: ["Implemented visitor management procedures"],
      allowed_transfer_themes: ["reliability", "willingness to learn"],
      disallowed_claims: ["none"],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "signature_default",
    };

    const normalized = normalizeProposalPlannerResult({
      rawPlan,
      voicePreset: "signature",
      contextMode: "none",
      sourceFactBank: [],
      outputLanguage: "en",
      jobTitle: "Veterans Service Officer I",
      jobDescription:
        "Support veterans, dependents, and survivors in accessing benefits.",
    });

    expect(normalized.context_mode).toBe("none");
    expect(normalized.domain_gap).toBe("distant");
    expect(normalized.credential_status).toBe("unsupported");
    expect(normalized.transfer_mode).toBe("no_operational_analogy");
    expect(normalized.output_language).toBe("en");
    expect(normalized.proof_strategy).toBe("none");
    expect(normalized.allowed_concrete_facts).toEqual([]);
    expect(normalized.allowed_transfer_themes).toContain(
      "company-specific motivation",
    );
    expect(normalized.disallowed_claims.join(" ")).toContain(
      "Do not claim prior roles, prior systems used, prior incidents handled",
    );
    expect(normalized.disallowed_claims.join(" ")).toContain(
      "Do not use invented negative-history disclaimers",
    );
    expect(normalized.disallowed_claims.join(" ")).toContain(
      "Do not use phrases such as 'while I may not have direct experience'",
    );
  });

  it("filters concrete facts to the source bank and normalizes weak-overlap plans conservatively", () => {
    const rawPlan: ProposalPlannerResult = {
      context_mode: "rich",
      domain_gap: "adjacent",
      credential_status: "related_not_equivalent",
      transfer_mode: "literal",
      output_language: "fr",
      allowed_concrete_facts: [
        "Security Guard at ADT Security",
        "As a veteran",
        "Decreased theft by 73% by improving vigilance strategies.",
      ],
      allowed_transfer_themes: [
        "documentation discipline",
        "client communication",
      ],
      disallowed_claims: ["veteran status", "exact required certification"],
      identity_hard_stops: ["veteran status"],
      proof_strategy: "concrete_supported",
      opening_strategy: "signature_default",
    };

    const normalized = normalizeProposalPlannerResult({
      rawPlan,
      voicePreset: "storyteller",
      contextMode: "rich",
      sourceFactBank: [
        "Security Guard at ADT Security",
        "Decreased theft by 73% by improving vigilance strategies.",
      ],
      outputLanguage: "en",
      jobTitle: "Veterans Service Officer I",
      jobDescription:
        "Interpret VA regulations and help veterans with benefit claims.",
    });

    expect(normalized.allowed_concrete_facts).toEqual([
      "Security Guard at ADT Security",
      "Decreased theft by 73% by improving vigilance strategies.",
    ]);
    expect(normalized.domain_gap).toBe("distant");
    expect(normalized.transfer_mode).toBe("no_operational_analogy");
    expect(normalized.output_language).toBe("en");
    expect(normalized.opening_strategy).toBe("storyteller_thread");
    expect(normalized.identity_hard_stops).toContain("veteran status");
  });

  it("adds direct-mode fidelity guardrails without overhauling the plan", () => {
    const rawPlan: ProposalPlannerResult = {
      context_mode: "rich",
      domain_gap: "direct",
      credential_status: "related_not_equivalent",
      transfer_mode: "literal",
      output_language: "en",
      allowed_concrete_facts: [
        "Security Guard at ADT Security",
        "Monitoring selected areas via CCTV app on smart devices.",
      ],
      allowed_transfer_themes: ["reliability"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "direct_fast",
    };

    const normalized = normalizeProposalPlannerResult({
      rawPlan,
      voicePreset: "direct",
      contextMode: "rich",
      sourceFactBank: [
        "Security Guard at ADT Security",
        "Monitoring selected areas via CCTV app on smart devices.",
      ],
      outputLanguage: "en",
      jobTitle: "Security Guard",
      jobDescription:
        "Patrol assigned areas and monitor CCTV systems for suspicious activity.",
    });

    expect(normalized.disallowed_claims.join(" ")).toContain(
      "Do not sharpen supported details into stronger operational ownership",
    );
    expect(normalized.disallowed_claims.join(" ")).toContain(
      "Do not synthesize employer-style names",
    );
  });

  it("does not surface a lone standout achievement as a top-achievement prompt anchor when scope evidence exists", () => {
    const plan: ProposalPlannerResult = {
      context_mode: "rich",
      domain_gap: "direct",
      credential_status: "exact_required",
      transfer_mode: "literal",
      output_language: "en",
      allowed_concrete_facts: [
        "Improved signup conversion by 11 percent through iterative UI experiments.",
        "Collaborated with design and product on customer workflow improvements.",
      ],
      allowed_transfer_themes: ["cross-functional collaboration"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "signature_default",
    };

    const block = buildProposalWriterPlanBlock(plan, "cover_letter");

    expect(block).toContain(
      "lone_achievement_handling: do not default to opening with the single standout achievement",
    );
    expect(block).toContain(
      "top_scope_point: Collaborated with design and product on customer workflow improvements.",
    );
    expect(block).toContain("top_achievement: none");
  });

  it("uses source/job overlap to normalize same-domain plans back to direct", () => {
    const rawPlan: ProposalPlannerResult = {
      context_mode: "rich",
      domain_gap: "distant",
      credential_status: "related_not_equivalent",
      transfer_mode: "no_operational_analogy",
      output_language: "en",
      allowed_concrete_facts: [
        "Security Guard at ADT Security",
        "Monitoring selected areas via CCTV app on smart devices.",
      ],
      allowed_transfer_themes: ["reliability"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "abstract_only",
      opening_strategy: "signature_default",
    };

    const normalized = normalizeProposalPlannerResult({
      rawPlan,
      voicePreset: "signature",
      contextMode: "rich",
      sourceFactBank: [
        "Security Guard at ADT Security",
        "Monitoring selected areas via CCTV app on smart devices.",
        "Safety compliance",
      ],
      outputLanguage: "en",
      jobTitle: "Security Guard",
      jobDescription:
        "Monitor CCTV systems and patrol assigned areas to maintain a secure environment.",
    });

    expect(normalized.domain_gap).toBe("direct");
    expect(normalized.transfer_mode).toBe("no_operational_analogy");
  });

  it("builds a planner prompt and writer block with the required sections", () => {
    const plannerPrompt = buildProposalPlannerPrompt({
      jobTitle: "Veterans Service Officer I",
      jobDescription: "Help veterans, dependents, and survivors access benefits.",
      voicePreset: "engaging",
      contextMode: computeProposalPlannerContextMode("sparse", true),
      outputLanguage: "en",
      personalizationContext: {
        summary:
          "Worked in military and defense sectors and is presently finishing a bachelor's in criminal justice.",
      },
    });

    expect(plannerPrompt).toContain("Task: return only a compact JSON");
    expect(plannerPrompt).toContain("Source fact bank");
    expect(plannerPrompt).toContain("JD-only");
    expect(plannerPrompt).toContain("output_language: en | fr");
    expect(plannerPrompt).toContain(
      "grounded, non-claiming cover-letter body centered on concrete work surfaces",
    );
    expect(plannerPrompt).not.toContain(
      "strict interest-first application intro",
    );
    expect(plannerPrompt).toContain(
      "Identity/domain not acceptable: 'As a veteran'",
    );
    expect(plannerPrompt).toContain(
      "Voice presets may change rhythm, sentence length, rhetorical texture",
    );

    const writerBlock = buildProposalWriterPlanBlock({
      context_mode: "sparse",
      domain_gap: "adjacent",
      credential_status: "in_progress_only",
      transfer_mode: "abstract_only",
      output_language: "en",
      allowed_concrete_facts: ["Worked in military and defense sectors."],
      allowed_transfer_themes: ["documentation discipline"],
      disallowed_claims: ["completed degree status"],
      identity_hard_stops: ["veteran status"],
      proof_strategy: "abstract_only",
      opening_strategy: "engaging_people",
    }, "cover_letter");

    expect(writerBlock).toContain("Writing plan (must obey as a hard contract):");
    expect(writerBlock).toContain("context_mode: sparse");
    expect(writerBlock).toContain("opening_strategy: engaging_people");
    expect(writerBlock).toContain("- evidence_summary:");
    expect(writerBlock).toContain("top_evidence_point:");
    expect(writerBlock).toContain("If a claim is not present in allowed_concrete_facts");
    expect(writerBlock).toContain(
      "If wording implies a stronger level of experience, qualification, operational readiness",
    );
    expect(writerBlock).toContain(
      "Use voice presets only to alter rhythm, sentence length, rhetorical texture",
    );
    expect(writerBlock).toContain(
      "If credential_status is in_progress_only, education or credentials may be mentioned only as in progress",
    );
    expect(writerBlock).toContain("Write the final prose in English only.");
  });

  it("strengthens the planner prompt toward evidence-led cv-backed cover letters", () => {
    const plannerPrompt = buildProposalPlannerPrompt({
      jobTitle: "Security Officer",
      jobDescription:
        "Monitor access, document incidents, and coordinate with staff across a busy campus.",
      voicePreset: "expert",
      contextMode: "rich",
      outputLanguage: "en",
      personalizationContext: {
        summary:
          "Reduced unauthorized entry by 26% through improved access control measures.",
        recentExperience: [
          {
            company: "Robert Cooper Security Guard",
            position: "Security Guard",
            highlights: [
              "Managed incident documentation for hotel operations.",
            ],
          },
        ],
      },
    });

    expect(plannerPrompt).toContain(
      "anchor the body in the strongest available evidence first: achievements, then scope or responsibility facts, then relevant background facts, and only then brief abstract transfer themes if still useful.",
    );
    expect(plannerPrompt).toContain(
      "the first substantive movement should prefer one concrete supported evidence point or one supported scope/background fact rather than generic transfer rhetoric, mission admiration, or ceremonial interest framing.",
    );
    expect(plannerPrompt).toContain(
      "after the evidence anchor, the next substantive movement should explain why that supported proof matters for the role's actual work, workflow, users, deliverables, team context, or operating environment rather than defaulting to generic transfer or future-value language.",
    );
    expect(plannerPrompt).toContain(
      "when more supported scope, background, or operating detail exists, the writer should spend one additional grounded supporting sentence on that material before the close rather than ending after one proof point and a generic close.",
    );
    expect(plannerPrompt).toContain(
      "For adjacent-domain moves, use concrete proof only as relevant background or cautious perspective, never as direct target-role readiness, team support, or task ownership.",
    );
    expect(plannerPrompt).toContain(
      "Transferable themes are secondary framing only. They must not become the main body substance when stronger supported facts exist.",
    );
  });

  it("hardens the writer block for no-context mode against soft readiness language", () => {
    const writerBlock = buildProposalWriterPlanBlock({
      context_mode: "none",
      domain_gap: "distant",
      credential_status: "unsupported",
      transfer_mode: "no_operational_analogy",
      output_language: "en",
      allowed_concrete_facts: [],
      allowed_transfer_themes: ["willingness to learn"],
      disallowed_claims: ["soft capability wording"],
      identity_hard_stops: ["veteran status"],
      proof_strategy: "none",
      opening_strategy: "signature_default",
    }, "cover_letter");

    expect(writerBlock).toContain(
      "write a grounded, non-claiming cover-letter body",
    );
    expect(writerBlock).toContain(
      "make at least two substantive sentences about recurring responsibilities, workflow, operating context, coordination, communication, records, or team interaction from the job description before the brief close",
    );
    expect(writerBlock).toContain(
      "make the first substantive sentence describe the actual work, products, outputs, media, files, process, or operating context rather than personal interest or admiration",
    );
    expect(writerBlock).toContain(
      "make the next substantive sentence describe workflow, collaboration, revision, production constraints, deliverables, or coordination from the job description before any motivation-led sentence",
    );
    expect(writerBlock).toContain(
      "let at most one sentence rely mainly on personal-interest framing",
    );
    expect(writerBlock).not.toContain(
      "I would welcome the opportunity to discuss my interest in the role.",
    );
    expect(writerBlock).toContain(
      "do not use phrases such as 'I am particularly drawn to', 'The opportunity to', 'The day-to-day work itself', 'prepared to adapt', 'prepared to meet the minimum requirements', 'develop skills in', 'particularly engaging', 'compelling', 'attractive place to grow professionally', or 'resonates with my understanding'",
    );
    expect(writerBlock).toContain(
      "do not let schedule, flexibility, or willingness-to-adapt language serve as one of the main supporting sentences",
    );
    expect(writerBlock).toContain(
      "keep challenge language, opportunity language, mission admiration, growth language, and personal-interest rhetoric secondary only; they must not carry the body or come before the concrete work/process sentences when those are available",
    );
    expect(writerBlock).toContain("I am capable of");
    expect(writerBlock).toContain(
      "do not mention contribution to safety, mission, operations, team value",
    );
    expect(writerBlock).toContain(
      "do not mention secure environments, scenarios, patrols, access control, conflict resolution",
    );
  });

  it("strengthens the planner prompt toward work-first no-context cover letters when jd detail exists", () => {
    const plannerPrompt = buildProposalPlannerPrompt({
      jobTitle: "Product Illustrator",
      jobDescription:
        "Create print-ready artwork for journals, hand soaps, and writing sets, refine concepts with feedback, and prepare files across packaging and paper products.",
      voicePreset: "signature",
      contextMode: "none",
      outputLanguage: "en",
      personalizationContext: null,
    });

    expect(plannerPrompt).toContain(
      "the body should resolve into two grounded job-description movements about the actual work, workflow, employer context, outputs, deliverables, or coordination, plus at most one brief curiosity or role-interest movement before the close.",
    );
    expect(plannerPrompt).toContain(
      "when the job description contains concrete products, outputs, media, files, processes, workflow, collaboration, or production constraints, the writer should spend the first substantive movement on the actual work and the next substantive movement on workflow, revision, production, deliverables, or coordination before generic motivation",
    );
    expect(plannerPrompt).toContain(
      "challenge language, opportunity language, mission admiration, growth language, and other personal-interest rhetoric should remain secondary only; they must not carry the body when concrete work/process detail is available.",
    );
    expect(plannerPrompt).toContain(
      "do not let a role-title shell, scenic employer description, or generic paraphrase of the job description stand in for one of the grounded body movements.",
    );
    expect(plannerPrompt).toContain(
      "do not let benefit-summary shells, environment-summary shells, or generic teamwork, professionalism, reliability, or seriousness filler stand in for one of the grounded body movements.",
    );
  });

  it("adds first-person and completion discipline to cover-letter writer plans", () => {
    const writerBlock = buildProposalWriterPlanBlock({
      context_mode: "rich",
      domain_gap: "adjacent",
      credential_status: "related_not_equivalent",
      transfer_mode: "abstract_only",
      output_language: "en",
      allowed_concrete_facts: [
        "Coordinated cross-functional research projects.",
      ],
      allowed_transfer_themes: ["structured communication"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "storyteller_thread",
    }, "cover_letter");

    expect(writerBlock).toContain(
      "Keep the final cover-letter body in first person throughout. Do not use he, she, they, or third-person self-reference for the candidate.",
    );
    expect(writerBlock).toContain(
      "Every sentence must be complete and grammatically closed. Do not leave unfinished trailing clauses or half-finished continuations such as '... is.' or 'I look forward to discussing how my background.'.",
    );
    expect(writerBlock).toContain(
      "If opening_strategy is engaging_people or storyteller_thread, prioritize completed sentence closure and clean paragraph endings over flourish.",
    );
  });

  it("uses scope and background facts before transfer themes when achievements are absent", () => {
    const writerBlock = buildProposalWriterPlanBlock({
      context_mode: "rich",
      domain_gap: "adjacent",
      credential_status: "related_not_equivalent",
      transfer_mode: "abstract_only",
      output_language: "en",
      allowed_concrete_facts: [
        "Managed incident documentation for hotel operations.",
        "Degree in Communication Studies.",
      ],
      allowed_transfer_themes: ["structured environments", "reliability"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "direct_fast",
    }, "cover_letter");

    expect(writerBlock).toContain(
      "Use evidence_summary as the body priority order: top_evidence_point, then top_achievement, then top_scope_point, then relevant_background_fact, and only then transferable_trait if it still helps.",
    );
    expect(writerBlock).toContain(
      "If top_achievement items are absent, use top_scope_point or relevant_background_fact instead of generic fit language.",
    );
    expect(writerBlock).toContain(
      "Use transferable_trait only as brief secondary support after concrete supported facts; do not let transferable traits become the main body substance when stronger evidence exists.",
    );
    expect(writerBlock).toContain(
      "After the opening evidence movement, use the next substantive movement to explain why that supported proof matters for the role's work, workflow, users, team context, or operating environment rather than reducing it to generic 'aligns with' or future-value language.",
    );
    expect(writerBlock).toContain(
      "If more supported scope, background, or operating detail exists after the opening proof, spend one additional grounded supporting sentence on it before the close rather than ending on proof plus a generic close.",
    );
    expect(writerBlock).toContain(
      "top_scope_point: Managed incident documentation for hotel operations.",
    );
    expect(writerBlock).toContain(
      "relevant_background_fact: Degree in Communication Studies.",
    );
  });

  it("does not reproduce the old strict interest-first no-context planner contradiction", () => {
    const plannerPrompt = buildProposalPlannerPrompt({
      jobTitle: "Electrical Designer",
      jobDescription:
        "Prepare construction-ready drawings, coordinate with engineers, and review AutoCAD and Revit documentation for commercial projects.",
      voicePreset: "storyteller",
      contextMode: "none",
      outputLanguage: "en",
      personalizationContext: null,
    });
    const writerBlock = buildProposalWriterPlanBlock({
      context_mode: "none",
      domain_gap: "distant",
      credential_status: "unsupported",
      transfer_mode: "no_operational_analogy",
      output_language: "en",
      allowed_concrete_facts: [],
      allowed_transfer_themes: ["role understanding"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "none",
      opening_strategy: "signature_default",
    }, "cover_letter");

    expect(plannerPrompt).not.toContain(
      "strict interest-first application intro",
    );
    expect(writerBlock).not.toContain(
      "strict interest-first application intro",
    );
    expect(writerBlock).toContain(
      "let at most one sentence rely mainly on personal-interest framing",
    );
  });

  it("adds claim-safe body differentiation for signature, engaging, expert, and storyteller cover-letter plans", () => {
    const signatureBlock = buildProposalWriterPlanBlock({
      context_mode: "rich",
      domain_gap: "adjacent",
      credential_status: "related_not_equivalent",
      transfer_mode: "abstract_only",
      output_language: "en",
      allowed_concrete_facts: ["Managed incident documentation for hotel operations."],
      allowed_transfer_themes: ["structured environments"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "signature_default",
    }, "cover_letter");
    const engagingBlock = buildProposalWriterPlanBlock({
      context_mode: "rich",
      domain_gap: "adjacent",
      credential_status: "related_not_equivalent",
      transfer_mode: "abstract_only",
      output_language: "en",
      allowed_concrete_facts: ["Managed incident documentation for hotel operations."],
      allowed_transfer_themes: ["structured environments"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "engaging_people",
    }, "cover_letter");
    const expertBlock = buildProposalWriterPlanBlock({
      context_mode: "rich",
      domain_gap: "adjacent",
      credential_status: "related_not_equivalent",
      transfer_mode: "abstract_only",
      output_language: "en",
      allowed_concrete_facts: ["Managed incident documentation for hotel operations."],
      allowed_transfer_themes: ["structured environments"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "expert_structured",
    }, "cover_letter");
    const storytellerBlock = buildProposalWriterPlanBlock({
      context_mode: "rich",
      domain_gap: "adjacent",
      credential_status: "related_not_equivalent",
      transfer_mode: "abstract_only",
      output_language: "en",
      allowed_concrete_facts: ["Managed incident documentation for hotel operations."],
      allowed_transfer_themes: ["structured environments"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "storyteller_thread",
    }, "cover_letter");

    expect(signatureBlock).toContain(
      "Keep the body warm, concise, and substantive rather than minimal, do not let it stop at one proof sentence plus the close, and avoid stand-alone interest, commitment, or discussion fragments that do not add body substance.",
    );
    expect(engagingBlock).toContain(
      "Let one later body sentence carry grounded people, guest, user, or collaborative context when the evidence or job description supports it.",
    );
    expect(expertBlock).toContain(
      "Let the body include one analytical sentence explaining what the supported evidence says about the role's actual demands or operating context, and do not let it collapse into two factual inventory lines and the closing sentence when more grounded material exists.",
    );
    expect(storytellerBlock).toContain(
      "Carry one visible supported thread across the body so the next movement feels like a continuation rather than a detached inventory line, keep those transitions in complete sentences rather than fragmentary narrative beats, and avoid isolated relevance fragments that break continuity.",
    );
  });

  it("balances lone achievements with scope points in thin-input evidence summaries", () => {
    const summary = buildProposalEvidenceSummary({
      context_mode: "rich",
      domain_gap: "adjacent",
      credential_status: "related_not_equivalent",
      transfer_mode: "abstract_only",
      output_language: "en",
      allowed_concrete_facts: [
        "Reduced theft by 73% through improved vigilance strategies.",
        "Supervised wire harness and control panel production.",
        "B.E. in Electrical and Electronics Engineering.",
      ],
      allowed_transfer_themes: ["structured environments", "reliability"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "expert_structured",
    });

    expect(summary.topAchievements).toEqual([
      "Reduced theft by 73% through improved vigilance strategies.",
    ]);
    expect(summary.topEvidencePoints[0]).toBe(
      "Supervised wire harness and control panel production.",
    );
    expect(summary.topScopePoints).toContain(
      "Supervised wire harness and control panel production.",
    );
    expect(summary.transferableTraits).toContain("structured environments");
  });

  it("hardens adjacent-mode writer plans against target-role bridging", () => {
    const writerBlock = buildProposalWriterPlanBlock({
      context_mode: "rich",
      domain_gap: "adjacent",
      credential_status: "related_not_equivalent",
      transfer_mode: "abstract_only",
      output_language: "en",
      allowed_concrete_facts: [
        "Supervised wire harness and control panel production.",
      ],
      allowed_transfer_themes: ["structured environments", "reliability"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "abstract_only",
      opening_strategy: "direct_fast",
    }, "cover_letter");

    expect(writerBlock).toContain(
      "the only allowed bridge is one cautious relevance sentence",
    );
    expect(writerBlock).toContain(
      "not as direct target-role readiness, task ownership, mission support, team value, operational support, or ability transfer into the target environment",
    );
    expect(writerBlock).toContain("forbidden_bridge: would allow me to contribute");
    expect(writerBlock).toContain("forbidden_bridge: I can help with");
    expect(writerBlock).toContain("forbidden_bridge: aligns with your need for");
    expect(writerBlock).toContain("forbidden_bridge: would help ensure");
    expect(writerBlock).toContain("forbidden_bridge: support your mission");
    expect(writerBlock).toContain("the only allowed bridge is one cautious relevance sentence");
  });

  it("keeps no-context application-message planner blocks on one work-surface thread instead of discussion-forward bridge language", () => {
    const writerBlock = buildProposalWriterPlanBlock({
      context_mode: "none",
      domain_gap: "distant",
      credential_status: "unsupported",
      transfer_mode: "no_operational_analogy",
      output_language: "en",
      allowed_concrete_facts: [],
      allowed_transfer_themes: ["role understanding"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "none",
      opening_strategy: "signature_default",
    }, "application_message");

    expect(writerBlock).toContain(
      "If context_mode is none, use opener for the role contact context, proof for one concrete work surface, operating context, artifact, deliverable, or coordination thread from the job description, and follow_up_line for one short continuation that stays on that same thread.",
    );
    expect(writerBlock).toContain(
      "If context_mode is none, keep the proof on one concrete surface from the posting itself rather than turning the note into a role summary or compressed job-description paraphrase.",
    );
    expect(writerBlock).toContain(
      "If context_mode is none, do not connect the lines with past-experience summary wording, background-summary wording, prior-role narration, self-introduction, or recruiter-close filler.",
    );
    expect(writerBlock).toContain(
      "After the work-surface anchor, the only allowed continuation is one short sentence that stays on that same named surface and makes the note more concrete, such as 'That entrance-coverage thread is the part of the role that stood out most to me.' or 'That records-and-handoff side of the posting is the part of the work that caught me first.' Do not shift into candidate history, past-execution verbs, self-introduction, fit summary, detail offers, profile or portfolio invitations, or recruiter-close filler.",
    );
    expect(writerBlock).not.toContain("one brief discussion-forward close");
    expect(writerBlock).not.toContain(
      "the only allowed bridge is one cautious relevance sentence such as 'relevant to', 'background in', 'experience in', 'may offer relevant perspective'",
    );
    for (const forbidden of [
      "At my previous role",
      "In my previous position",
      "At my previous company",
      "I have experience in",
      "My background in",
      "discuss further",
      "share more detail",
      "introduce myself",
    ]) {
      expect(writerBlock).not.toContain(forbidden);
    }
  });

  it("keeps application-message planner fallbacks concrete instead of nudging anonymous summary proof", () => {
    const writerBlock = buildProposalWriterPlanBlock({
      context_mode: "rich",
      domain_gap: "adjacent",
      credential_status: "related_not_equivalent",
      transfer_mode: "abstract_only",
      output_language: "en",
      allowed_concrete_facts: ["Managed incident documentation for hotel operations."],
      allowed_transfer_themes: ["structured environments"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "signature_default",
    }, "application_message");

    expect(writerBlock).toContain(
      "In CV-backed application messages, teach one named-fact proof sentence rather than a profile summary.",
    );
    expect(writerBlock).toContain(
      "Preferred proof shapes are 'At <company>, I <action> <result>.', 'I <action> at <company> <context/result>.', or 'One relevant example: <named fact>.'",
    );
    expect(writerBlock).toContain(
      "Prefer a named employer, site, artifact, file, workflow, or operating surface over anonymous previous-role or previous-employer setup.",
    );
    expect(writerBlock).toContain(
      "If no top_achievement exists, use the strongest supported scope, responsibility, or named background fact early instead.",
    );
    expect(writerBlock).toContain(
      "Keep proof_line on one named fact that clearly maps to one employer-side work surface in the posting; a concrete but weakly related academic, research, presentation, or profile fact is not strong proof unless that mapping is explicit and hiring-useful.",
    );
    expect(writerBlock).toContain(
      "Keep fallback proof concrete and named; do not turn it into a role-history summary, category-level skill summary, broad background statement, record-of-results slogan, or fit-summary bridge.",
    );
    expect(writerBlock).toContain(
      "After the proof anchor, the only allowed continuation is one short sentence that stays on the same named proof and same work surface, such as 'That production-handoff thread is the part of the posting my Northline work maps to most clearly.' or 'That documentation-heavy side of the posting is where the hotel incident work is most relevant.' Do not switch into category summaries, anonymous role-history phrasing, fit summaries, detail offers, profile or portfolio invitations, or recruiter-close filler.",
    );
    expect(writerBlock).not.toContain("one brief discussion-forward close");
    for (const forbidden of [
      "At my previous role",
      "In my previous position",
      "At my previous company",
      "I have experience in",
      "My background includes",
      "My background in",
      "track record",
      "my experience aligns",
    ]) {
      expect(writerBlock).not.toContain(forbidden);
    }
  });

  it("uses the canonical forbidden bridge source for exact and generic future-value blocking", () => {
    expect(
      containsForbiddenProposalBridge(
        "I’d welcome the opportunity to discuss how my skills could support your team.",
      ),
    ).toBe(true);
    expect(
      containsForbiddenProposalBridge(
        "My experience might fit with your team’s goals.",
      ),
    ).toBe(true);
    expect(
      containsForbiddenProposalBridge(
        "My background could help your clients’ sites and strategies.",
      ),
    ).toBe(true);
    expect(
      containsForbiddenProposalBridge(
        "My background may offer relevant perspective for this role.",
      ),
    ).toBe(false);
  });

  it("hardens distant-mode writer plans against soft future operational value", () => {
    const writerBlock = buildProposalWriterPlanBlock({
      context_mode: "rich",
      domain_gap: "distant",
      credential_status: "unsupported",
      transfer_mode: "no_operational_analogy",
      output_language: "en",
      allowed_concrete_facts: ["Worked in structured service environments."],
      allowed_transfer_themes: ["relevant perspective"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "abstract_only",
      opening_strategy: "signature_default",
    }, "cover_letter");

    expect(writerBlock).toContain(
      "remain interest-led and cautiously relevant only; do not project future operational value",
    );
    expect(writerBlock).toContain(
      "first substantive movement should come from one of those supported facts rather than from generic transfer framing, mission admiration, or role-interest language",
    );
    expect(writerBlock).toContain(
      "Any closing sentence must stay brief and limited to discussing the role further.",
    );
  });
});
