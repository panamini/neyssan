import { describe, expect, it } from "vitest";

import {
  analyzeProposalDraft,
  applyProposalSentencePatches,
  buildProposalRepairPrompt,
  extractProposalBodyForRepair,
  extractFinalProposalContent,
  normalizeFinalProposalOutput,
  repairProposalSentenceLocally,
  verifyProposalDraft,
} from "../proposalEnforcement";
import type { ProposalPlannerResult } from "../proposalPlanner";
import { finalizeProposalForSave } from "../../../generateProposalMutation";

const basePlan: ProposalPlannerResult = {
  context_mode: "rich",
  domain_gap: "direct",
  credential_status: "exact_required",
  transfer_mode: "literal",
  output_language: "en",
  allowed_concrete_facts: [
    "Security Guard at ADT Security",
    "Decreased theft by 73% by improving vigilance strategies.",
    "Monitoring selected areas via CCTV app on smart devices.",
  ],
  allowed_transfer_themes: ["reliability", "attention to detail"],
  disallowed_claims: [],
  identity_hard_stops: ["veteran status"],
  proof_strategy: "concrete_supported",
  opening_strategy: "signature_default",
};

type SupportedIssueType =
  | "no_context_readiness"
  | "unsupported_operational_history"
  | "credential_inflation";

type ClaimFixture = {
  name: string;
  sentence: string;
  planFixture: "no_context" | "adjacent_cv" | "same_domain_cv" | "security_cv";
  expectedIssueTypes: SupportedIssueType[];
};

const CLAIM_PLAN_FIXTURES: Record<
  ClaimFixture["planFixture"],
  {
    plan: ProposalPlannerResult;
    jobTitle: string;
    jobDescription: string;
    candidateName: string | null;
  }
> = {
  no_context: {
    plan: {
      ...basePlan,
      context_mode: "none",
      domain_gap: "distant",
      credential_status: "unsupported",
      transfer_mode: "no_operational_analogy",
      allowed_concrete_facts: [],
      allowed_transfer_themes: ["willingness to learn", "reliability"],
      proof_strategy: "none",
    },
    jobTitle: "Electronics Technician",
    jobDescription:
      "Design and test electronic systems, support prototyping and development, and coordinate engineering projects.",
    candidateName: null,
  },
  adjacent_cv: {
    plan: {
      ...basePlan,
      context_mode: "rich",
      domain_gap: "adjacent",
      credential_status: "related_not_equivalent",
      transfer_mode: "abstract_only",
      allowed_concrete_facts: [
        "I worked as a Production Supervisor at Lakshmi Electrical Control Systems.",
        "I hold a B.E. in Electrical and Electronics Engineering.",
        "I supervised wire harness and control panel production.",
        "I managed wire harness and control panel production workflows.",
        "My background has required coordination and consistency in structured production settings.",
      ],
      allowed_transfer_themes: [
        "coordination",
        "consistency",
        "reliability",
        "attention to detail",
      ],
      proof_strategy: "abstract_only",
    },
    jobTitle: "Electronics Technician",
    jobDescription:
      "Design and test electronic systems, support prototyping and development, and coordinate engineering projects.",
    candidateName: "Alex Doe",
  },
  same_domain_cv: {
    plan: {
      ...basePlan,
      context_mode: "rich",
      domain_gap: "direct",
      credential_status: "exact_required",
      transfer_mode: "literal",
      allowed_concrete_facts: [
        "I have experience designing and testing electronic systems.",
        "I developed and validated mixed-signal circuit designs in my previous role.",
      ],
      allowed_transfer_themes: ["reliability", "attention to detail"],
      proof_strategy: "concrete_supported",
    },
    jobTitle: "Electronics Technician",
    jobDescription:
      "Design and test electronic systems, support prototyping and development, and validate mixed-signal circuit work.",
    candidateName: "Alex Doe",
  },
  security_cv: {
    plan: {
      ...basePlan,
      context_mode: "rich",
      domain_gap: "direct",
      credential_status: "exact_required",
      transfer_mode: "literal",
      allowed_concrete_facts: [
        "At Robert Cooper Security Guard, I decreased theft of hotel items by 73% through improved vigilance.",
        "I installed 15 360-degree CCTV cameras to expand monitoring coverage.",
      ],
      allowed_transfer_themes: ["reliability", "attention to detail"],
      proof_strategy: "concrete_supported",
    },
    jobTitle: "Security Officer",
    jobDescription:
      "Perform patrols, manage incidents, support emergency drills, and document security concerns across a hospital campus.",
    candidateName: "Robert Cooper",
  },
};

const NO_CONTEXT_FIXTURES: ClaimFixture[] = [
  {
    name: "allows pure interest in no-context mode",
    sentence:
      "I’m interested in this role and would welcome the opportunity to discuss it further.",
    planFixture: "no_context",
    expectedIssueTypes: [],
  },
  {
    name: "allows company-specific interest in no-context mode",
    sentence:
      "I’m drawn to your company’s work in gaming and display systems.",
    planFixture: "no_context",
    expectedIssueTypes: [],
  },
  {
    name: "blocks no-context readiness about contribution",
    sentence: "I’m ready to contribute to hardware design and prototyping.",
    planFixture: "no_context",
    expectedIssueTypes: ["no_context_readiness"],
  },
  {
    name: "blocks no-context capability language",
    sentence:
      "I can support your team’s innovation with a detail-oriented approach.",
    planFixture: "no_context",
    expectedIssueTypes: ["no_context_readiness"],
  },
  {
    name: "blocks no-context adaptation confidence",
    sentence:
      "I’m confident I could quickly adapt to the technical demands of the role.",
    planFixture: "no_context",
    expectedIssueTypes: ["no_context_readiness"],
  },
  {
    name: "blocks no-context target-task ownership",
    sentence:
      "I’m ready to take ownership of prototyping and testing efforts.",
    planFixture: "no_context",
    expectedIssueTypes: ["no_context_readiness"],
  },
  {
    name: "blocks no-context qualification inflation",
    sentence: "I’m well qualified for this opportunity.",
    planFixture: "no_context",
    expectedIssueTypes: ["credential_inflation"],
  },
  {
    name: "blocks no-context degree-to-fit qualification claim",
    sentence: "My background positions me well for this role.",
    planFixture: "no_context",
    expectedIssueTypes: ["credential_inflation"],
  },
];

const ADJACENT_SAFE_FIXTURES: ClaimFixture[] = [
  {
    name: "allows adjacent past fact job title",
    sentence:
      "I worked as a Production Supervisor at Lakshmi Electrical Control Systems.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: [],
  },
  {
    name: "allows adjacent past fact degree",
    sentence: "I hold a B.E. in Electrical and Electronics Engineering.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: [],
  },
  {
    name: "allows source-backed achievement scope",
    sentence: "I supervised wire harness and control panel production.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: [],
  },
  {
    name: "allows cautious transferable trait without target task bridge",
    sentence:
      "My background has required coordination and consistency in structured production settings.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: [],
  },
  {
    name: "allows cautious interest about relevance",
    sentence:
      "I’m interested in learning more about how my background may relate to this role.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: [],
  },
];

const ADJACENT_BLOCKED_BRIDGES: ClaimFixture[] = [
  {
    name: "blocks trait to target-task bridge via design and testing",
    sentence:
      "My attention to detail aligns with your need for someone who can design and test electronic systems.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: ["unsupported_operational_history"],
  },
  {
    name: "blocks bringing skills to target projects",
    sentence:
      "I would bring my skills to your display and gaming hardware projects.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: ["unsupported_operational_history"],
  },
  {
    name: "blocks support for prototyping and development",
    sentence: "I can support prototyping and development efforts.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: ["unsupported_operational_history"],
  },
  {
    name: "blocks structured trait bridged into hardware work",
    sentence:
      "My structured approach would help me contribute to hardware development.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: ["unsupported_operational_history"],
  },
  {
    name: "blocks collaboration trait bridged into engineering projects",
    sentence:
      "My collaboration skills would support your engineering projects.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: ["unsupported_operational_history"],
  },
];

const QUALIFICATION_FIXTURES: ClaimFixture[] = [
  {
    name: "blocks degree equipped me for role",
    sentence:
      "My degree has equipped me for the hands-on demands of this position.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: ["credential_inflation"],
  },
  {
    name: "blocks background strong fit claim",
    sentence: "My background makes me a strong fit for this role.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: ["credential_inflation"],
  },
  {
    name: "blocks education positions me well claim",
    sentence: "My education positions me well for this opportunity.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: ["credential_inflation"],
  },
  {
    name: "blocks strengthened my expertise wording",
    sentence:
      "My related education has strengthened my expertise for this role.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: ["credential_inflation"],
  },
];

const ACHIEVEMENT_FIXTURES: ClaimFixture[] = [
  {
    name: "allows source-backed responsibility achievement",
    sentence: "I managed wire harness and control panel production workflows.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: [],
  },
  {
    name: "blocks unsupported impact inflation",
    sentence: "I improved production efficiency across the line.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: ["unsupported_operational_history"],
  },
  {
    name: "blocks unsupported reliability improvement claim",
    sentence: "I improved production reliability through my supervision work.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: ["unsupported_operational_history"],
  },
  {
    name: "blocks unsupported revenue impact claim",
    sentence: "I increased revenue through production improvements.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: ["unsupported_operational_history"],
  },
  {
    name: "blocks unsupported business growth claim",
    sentence: "I drove business growth and measurable commercial impact.",
    planFixture: "adjacent_cv",
    expectedIssueTypes: ["unsupported_operational_history"],
  },
];

const SAME_DOMAIN_PASS_FIXTURES: ClaimFixture[] = [
  {
    name: "preserves source-backed same-domain fact",
    sentence: "I have experience designing and testing electronic systems.",
    planFixture: "same_domain_cv",
    expectedIssueTypes: [],
  },
  {
    name: "preserves source-backed same-domain achievement",
    sentence:
      "I developed and validated mixed-signal circuit designs in my previous role.",
    planFixture: "same_domain_cv",
    expectedIssueTypes: [],
  },
];

function runClaimFixture(
  fixture: ClaimFixture,
): SupportedIssueType[] {
  const fixtureConfig = CLAIM_PLAN_FIXTURES[fixture.planFixture];
  const issues = verifyProposalDraft({
    content: `Dear Hiring Manager,\n\n${fixture.sentence}\n\nSincerely,${
      fixtureConfig.candidateName ? `\n${fixtureConfig.candidateName}` : ""
    }`,
    plan: fixtureConfig.plan,
    format: "cover_letter",
    outputLanguage: "English",
    candidateName: fixtureConfig.candidateName,
    jobTitle: fixtureConfig.jobTitle,
    jobDescription: fixtureConfig.jobDescription,
  });

  return Array.from(
    new Set(
      issues
        .map((issue) => issue.code)
        .filter((code): code is SupportedIssueType =>
          [
            "no_context_readiness",
            "unsupported_operational_history",
            "credential_inflation",
          ].includes(code),
        ),
    ),
  ).sort();
}

function runLocalRepairFlow(args: {
  content: string;
  plan: ProposalPlannerResult;
  outputLanguage: "English" | "French";
  candidateName: string | null;
  jobTitle: string;
  jobDescription: string;
}) {
  const analysis = analyzeProposalDraft({
    content: args.content,
    plan: args.plan,
    format: "cover_letter",
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
  });
  const patches = analysis.flaggedSentences.map((flaggedSentence) => ({
    sentenceIndex: flaggedSentence.sentenceIndex,
    originalSentence: flaggedSentence.originalSentence,
    replacementSentence:
      repairProposalSentenceLocally({
        flaggedSentence,
        plan: args.plan,
        outputLanguage: args.outputLanguage,
      }) ?? "",
  }));
  const repairedBody = applyProposalSentencePatches({
    content: args.content,
    format: "cover_letter",
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
    patches,
  });
  const finalized = finalizeProposalForSave({
    content: repairedBody,
    format: "cover_letter",
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName ?? undefined,
    voicePreset: "signature",
    noContextMode: args.plan.context_mode === "none",
  });
  const repairedAnalysis = analyzeProposalDraft({
    content: finalized,
    plan: args.plan,
    format: "cover_letter",
    outputLanguage: args.outputLanguage,
    candidateName: args.candidateName,
    jobTitle: args.jobTitle,
    jobDescription: args.jobDescription,
  });

  return {
    analysis,
    patches,
    repairedBody,
    finalized,
    repairedAnalysis,
  };
}

describe("proposal enforcement helpers", () => {
  it("flags no-context negative-history and soft-readiness phrasing", () => {
    const issues = verifyProposalDraft({
      content:
        "Dear Hiring Manager,\n\nWhile I may not have direct experience, I am prepared to monitor CCTV systems and respond to incidents with professionalism.\n\nSincerely,",
      plan: {
        ...basePlan,
        context_mode: "none",
        domain_gap: "distant",
        credential_status: "unsupported",
        transfer_mode: "no_operational_analogy",
        allowed_concrete_facts: [],
        allowed_transfer_themes: ["willingness to learn"],
        proof_strategy: "none",
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: null,
      jobTitle: "Veterans Service Officer I",
      jobDescription:
        "Support veterans, dependents, and survivors in accessing benefits.",
    });

    expect(issues.some((issue) => issue.code === "no_context_phrase")).toBe(
      true,
    );
    expect(issues.some((issue) => issue.code === "no_context_readiness")).toBe(
      true,
    );
  });

  it("flags synthesized employer naming that is not present in allowed facts", () => {
    const issues = verifyProposalDraft({
      content:
        "Dear Hiring Manager,\n\nAt Robert Cooper Security Guard, I reduced theft by 73% by refining monitoring strategies.\n\nSincerely,\nRobert Cooper",
      plan: basePlan,
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      jobTitle: "Security Guard",
      jobDescription: "Monitor security systems and patrol assigned areas.",
    });

    expect(issues.some((issue) => issue.code === "employer_synthesis")).toBe(
      true,
    );
  });

  it("does not treat the target employer in an application sentence as candidate history", () => {
    const issues = verifyProposalDraft({
      content:
        "Dear Hiring Manager,\n\nI am writing to apply for the Security Guard position at Cobra Shield Investigations Security & Training.\n\nSincerely,\nRobert Cooper",
      plan: basePlan,
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      jobTitle: "Security Guard",
      jobDescription: "Monitor security systems and patrol assigned areas.",
    });

    expect(issues.some((issue) => issue.code === "employer_synthesis")).toBe(
      false,
    );
  });

  it("flags adjacent-domain readiness that over-translates concrete proof", () => {
    const issues = verifyProposalDraft({
      content:
        "Dear Hiring Manager,\n\nMy security background directly prepares me to interpret regulations, review documentation, and track claims work effectively.\n\nSincerely,\nRobert Cooper",
      plan: {
        ...basePlan,
        domain_gap: "adjacent",
        transfer_mode: "abstract_only",
        allowed_concrete_facts: [
          "Decreased theft by 73% by improving vigilance strategies.",
        ],
        allowed_transfer_themes: ["documentation discipline", "reliability"],
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      jobTitle: "Veterans Service Officer I",
      jobDescription:
        "Interpret VA regulations, review documentation, and support benefit claims.",
    });

    expect(issues.some((issue) => issue.code === "adjacent_readiness")).toBe(
      true,
    );
  });

  it("allows forward-looking no-context motivation without operational pseudo-readiness", () => {
    const issues = verifyProposalDraft({
      content:
        "Dear Hiring Manager,\n\nI am interested in this role because it offers the opportunity to contribute with professionalism, reliability, and a willingness to learn.\n\nSincerely,",
      plan: {
        ...basePlan,
        context_mode: "none",
        domain_gap: "distant",
        credential_status: "unsupported",
        transfer_mode: "no_operational_analogy",
        allowed_concrete_facts: [],
        allowed_transfer_themes: ["willingness to learn", "reliability"],
        proof_strategy: "none",
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: null,
      jobTitle: "Security Guard",
      jobDescription: "Patrol assigned areas and monitor security systems.",
    });

    expect(
      issues.some(
        (issue) =>
          issue.code === "no_context_phrase" ||
          issue.code === "no_context_readiness",
      ),
    ).toBe(false);
  });

  it("flags no-context capability language that implies supported readiness", () => {
    const issues = verifyProposalDraft({
      content:
        "Dear Hiring Manager,\n\nI am eager to bring my technical aptitude and problem-solving skills to your team and contribute meaningfully to your projects.\n\nSincerely,",
      plan: {
        ...basePlan,
        context_mode: "none",
        domain_gap: "distant",
        credential_status: "unsupported",
        transfer_mode: "no_operational_analogy",
        allowed_concrete_facts: [],
        allowed_transfer_themes: ["willingness to learn", "reliability"],
        proof_strategy: "none",
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: null,
      jobTitle: "Security Guard",
      jobDescription: "Patrol assigned areas and monitor security systems.",
    });

    expect(issues.some((issue) => issue.code === "no_context_readiness")).toBe(
      true,
    );
  });

  it("flags no-context invented customer communication experience", () => {
    const issues = verifyProposalDraft({
      content:
        "Dear Hiring Manager,\n\nMy experience has required clear, professional communication with customers, and I am comfortable adapting to new sales processes.\n\nSincerely,",
      plan: {
        ...basePlan,
        context_mode: "none",
        domain_gap: "distant",
        credential_status: "unsupported",
        transfer_mode: "no_operational_analogy",
        allowed_concrete_facts: [],
        allowed_transfer_themes: ["role understanding"],
        proof_strategy: "none",
      },
      format: "application_message",
      outputLanguage: "English",
      candidateName: null,
      jobTitle: "Sales Assistant",
      jobDescription:
        "Coordinate follow-ups, keep records organized, and communicate clearly with customers.",
    });

    expect(issues.some((issue) => issue.code === "no_context_phrase")).toBe(
      true,
    );
  });

  it("flags no-context generic invented-history phrases", () => {
    const forbiddenSentences = [
      "In past experiences, I’ve taken initiative to document workflows.",
      "These are skills I’ve developed through administrative and customer-facing tasks.",
      "I’ve worked in roles where tracking details and maintaining professional interactions were key.",
      "My ability to stay organized would help the team.",
      "The role’s focus on structure and clarity aligns with how I approach new responsibilities.",
      "My approach is to keep records accurate and follow up clearly.",
      "My strengths are organization and customer communication.",
      "I am confident I can handle the follow-up process.",
      "I am comfortable learning new sales tools.",
      "I prioritize clear customer communication.",
      "I value organized records.",
    ];

    for (const sentence of forbiddenSentences) {
      const issues = verifyProposalDraft({
        content: `Dear Hiring Manager,\n\n${sentence}\n\nSincerely,`,
        plan: {
          ...basePlan,
          context_mode: "none",
          domain_gap: "distant",
          credential_status: "unsupported",
          transfer_mode: "no_operational_analogy",
          allowed_concrete_facts: [],
          allowed_transfer_themes: ["role understanding"],
          proof_strategy: "none",
        },
        format: "application_message",
        outputLanguage: "English",
        candidateName: null,
        jobTitle: "Sales Assistant",
        jobDescription:
          "Coordinate follow-ups, keep records organized, and communicate clearly with customers.",
      });

      expect(
        issues.some(
          (issue) =>
            issue.code === "no_context_phrase" ||
            issue.code === "no_context_readiness",
        ),
      ).toBe(true);
    }
  });

  it("flags repeated no-context fallback filler sentences", () => {
    const repeated =
      "The day-to-day work itself is the part of the role that stands out to me most.";
    const issues = verifyProposalDraft({
      content: `${repeated}\n\n${repeated}`,
      plan: {
        ...basePlan,
        context_mode: "none",
        domain_gap: "distant",
        credential_status: "unsupported",
        transfer_mode: "no_operational_analogy",
        allowed_concrete_facts: [],
        allowed_transfer_themes: ["role understanding"],
        proof_strategy: "none",
      },
      format: "application_message",
      outputLanguage: "English",
      candidateName: null,
      jobTitle: "Sales Assistant",
      jobDescription:
        "Coordinate follow-ups, keep records organized, and communicate clearly with customers.",
    });

    expect(issues.some((issue) => issue.code === "no_context_phrase")).toBe(
      true,
    );
  });

  it("allows a no-context message that stays on motivation and work surfaces", () => {
    const issues = verifyProposalDraft({
      content:
        "I’m interested in the Sales Assistant role because the work centers on organized follow-up, clear records, and careful communication with customers. I would welcome the chance to learn your process and discuss the role further.",
      plan: {
        ...basePlan,
        context_mode: "none",
        domain_gap: "distant",
        credential_status: "unsupported",
        transfer_mode: "no_operational_analogy",
        allowed_concrete_facts: [],
        allowed_transfer_themes: ["role understanding", "willingness to learn"],
        proof_strategy: "none",
      },
      format: "application_message",
      outputLanguage: "English",
      candidateName: null,
      jobTitle: "Sales Assistant",
      jobDescription:
        "Coordinate follow-ups, keep records organized, and communicate clearly with customers.",
    });

    expect(
      issues.some(
        (issue) =>
          issue.code === "no_context_phrase" ||
          issue.code === "no_context_readiness",
      ),
    ).toBe(false);
  });

  it("does not overblock sourced rich-context approach or strength language", () => {
    const issues = verifyProposalDraft({
      content:
        "My approach to customer communication is grounded in documented sales operations work. My strength in record organization comes from maintaining CRM updates for the sales team.",
      plan: {
        ...basePlan,
        context_mode: "rich",
        domain_gap: "direct",
        credential_status: "exact_required",
        transfer_mode: "literal",
        allowed_concrete_facts: [
          "My approach to customer communication is grounded in documented sales operations work.",
          "My strength in record organization comes from maintaining CRM updates for the sales team.",
        ],
        allowed_transfer_themes: [],
        proof_strategy: "concrete_supported",
      },
      format: "application_message",
      outputLanguage: "English",
      candidateName: null,
      jobTitle: "Sales Assistant",
      jobDescription:
        "Coordinate follow-ups, keep records organized, and communicate clearly with customers.",
    });

    expect(issues).toEqual([]);
  });

  it("flags unsupported technical SEO claims in adjacent-only weak matches", () => {
    const seoPlan: ProposalPlannerResult = {
      ...basePlan,
      context_mode: "minimal",
      domain_gap: "adjacent",
      credential_status: "unsupported",
      transfer_mode: "abstract_only",
      allowed_concrete_facts: [
        "Frontend-focused freelance designer-developer focused on landing pages and conversion flows.",
        "Frontend",
        "Landing Pages",
        "Conversion Optimization",
      ],
      allowed_transfer_themes: ["frontend execution", "conversion-aware page improvements"],
      disallowed_claims: [
        "worked closely with SEO teams",
        "optimized crawlability",
        "schema placement",
        "crawl budget",
        "canonicalization",
        "internal linking patterns",
        "technical SEO diagnosis",
        "search visibility familiarity",
        "marketplace-style SEO implementation",
      ],
      proof_strategy: "abstract_only",
    };
    const badSentences = [
      "I’ve worked closely with SEO teams to implement structural improvements.",
      "I can review schema placement and internal linking patterns.",
      "My frontend SEO diagnosis can improve crawl budget and search visibility.",
      "I have optimized crawlability and canonicalization for marketplace-style SEO implementation.",
    ];

    for (const sentence of badSentences) {
      const issues = verifyProposalDraft({
        content: sentence,
        plan: seoPlan,
        format: "freelance_proposal",
        outputLanguage: "English",
        candidateName: "Jordan Lee",
        jobTitle: "Technical SEO Overhaul for Marketplace",
        jobDescription:
          "We need indexing, schema, crawl diagnostics, and internal linking recommendations for a marketplace.",
      });

      expect(
        issues.some((issue) => issue.code === "unsupported_operational_history"),
      ).toBe(true);
    }
  });

  it("allows adjacent-only SEO support that avoids unsupported technical SEO claims", () => {
    const issues = verifyProposalDraft({
      content:
        "My background is frontend and conversion-focused, not technical SEO. Indexing, schema strategy, crawl diagnostics, and internal-linking recommendations should be led by a technical SEO specialist. I could support frontend execution once that specialist defines the audit and recommendations.",
      plan: {
        ...basePlan,
        context_mode: "minimal",
        domain_gap: "adjacent",
        credential_status: "unsupported",
        transfer_mode: "abstract_only",
        allowed_concrete_facts: [
          "Frontend-focused freelance designer-developer focused on landing pages and conversion flows.",
          "Frontend",
          "Landing Pages",
          "Conversion Optimization",
        ],
        allowed_transfer_themes: [
          "frontend execution",
          "conversion-aware page improvements",
        ],
        disallowed_claims: [
          "worked closely with SEO teams",
          "optimized crawlability",
          "schema placement",
          "crawl budget",
          "canonicalization",
          "internal linking patterns",
          "technical SEO diagnosis",
          "search visibility familiarity",
          "marketplace-style SEO implementation",
        ],
        proof_strategy: "abstract_only",
      },
      format: "freelance_proposal",
      outputLanguage: "English",
      candidateName: "Jordan Lee",
      jobTitle: "Technical SEO Overhaul for Marketplace",
      jobDescription:
        "We need indexing, schema, crawl diagnostics, and internal linking recommendations for a marketplace.",
    });

    expect(
      issues.some((issue) => issue.code === "unsupported_operational_history"),
    ).toBe(false);
  });

  it("does not flag a no-context application intro that names only the target employer", () => {
    const issues = verifyProposalDraft({
      content:
        "Dear Hiring Manager,\n\nI am interested in the Security Guard position at Cobra Shield Investigations Security & Training and would welcome the opportunity to contribute with professionalism and reliability.\n\nSincerely,",
      plan: {
        ...basePlan,
        context_mode: "none",
        domain_gap: "distant",
        credential_status: "unsupported",
        transfer_mode: "no_operational_analogy",
        allowed_concrete_facts: [],
        allowed_transfer_themes: ["willingness to learn", "reliability"],
        proof_strategy: "none",
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: null,
      jobTitle: "Security Guard",
      jobDescription: "Patrol assigned areas and monitor security systems.",
    });

    expect(
      issues.some(
        (issue) =>
          issue.code === "employer_synthesis" ||
          issue.code === "no_context_phrase" ||
          issue.code === "no_context_readiness",
      ),
    ).toBe(false);
  });

  it("flags credential inflation when exact_required is not allowed", () => {
    const issues = verifyProposalDraft({
      content:
        "Dear Hiring Manager,\n\nI am licensed and hold the required certification for this position.\n\nSincerely,\nRobert Cooper",
      plan: {
        ...basePlan,
        credential_status: "related_not_equivalent",
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      jobTitle: "Armed Security Officer",
      jobDescription:
        "Florida Class D & G Security Licenses required for this position.",
    });

    expect(issues.some((issue) => issue.code === "credential_inflation")).toBe(
      true,
    );
  });

  it("flags qualification-strengthening language when exact credential fit is not supported", () => {
    const issues = verifyProposalDraft({
      content:
        "Dear Hiring Manager,\n\nMy degree in electrical engineering has strengthened my expertise in hardware design and development, and I am well qualified to support your team.\n\nSincerely,\nRobert Cooper",
      plan: {
        ...basePlan,
        domain_gap: "adjacent",
        credential_status: "related_not_equivalent",
        transfer_mode: "abstract_only",
        allowed_concrete_facts: [
          "B.E. in Electrical and Electronics Engineering from Anna Ranganathan Engineering College.",
          "Production Supervisor at Lakshmi Electrical Control Systems.",
        ],
        allowed_transfer_themes: ["reliability", "attention to detail"],
        proof_strategy: "abstract_only",
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      jobTitle: "Technical Coordinator",
      jobDescription:
        "Coordinate documentation and communication across teams.",
    });

    expect(issues.some((issue) => issue.code === "credential_inflation")).toBe(
      true,
    );
  });

  it("does not flag allowed same-domain proof as transfer overreach", () => {
    const issues = verifyProposalDraft({
      content:
        "Dear Hiring Manager,\n\nI am writing to apply for the Security Guard position at Cobra Shield Investigations Security & Training. At ADT Security, I monitored selected areas via CCTV app on smart devices and improved vigilance strategies that decreased theft by 73%.\n\nSincerely,\nRobert Cooper",
      plan: {
        ...basePlan,
        domain_gap: "direct",
        transfer_mode: "literal",
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      jobTitle: "Security Guard",
      jobDescription:
        "Patrol assigned areas, monitor CCTV systems, and respond to incidents.",
    });

    expect(
      issues.some((issue) =>
        [
          "employer_synthesis",
          "unsupported_operational_history",
          "adjacent_readiness",
          "distant_readiness",
        ].includes(issue.code),
      ),
    ).toBe(false);
  });

  it("flags direct-mode sharpening that translates supported background into unsupported target-role tasks", () => {
    const issues = verifyProposalDraft({
      content:
        "Dear Hiring Manager,\n\nAt Lakshmi Electrical Control Systems, I supervised production for wire harnesses and control panels, ensuring precision in assembly and troubleshooting. This role honed my attention to detail and reliability in electronic systems, a skill I would bring to prototyping and testing for your team.\n\nSincerely,\nRobert Cooper",
      plan: {
        ...basePlan,
        domain_gap: "direct",
        transfer_mode: "literal",
        allowed_concrete_facts: [
          "Production Supervisor at Lakshmi Electrical Control Systems.",
          "Managed wire harness and control panel production.",
          "B.E. in Electrical and Electronics Engineering from Anna Ranganathan Engineering College.",
        ],
        allowed_transfer_themes: ["reliability", "attention to detail"],
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      jobTitle: "Electronics Technician",
      jobDescription:
        "Prototype and test electronic systems while coordinating with engineering teams.",
    });

    expect(
      issues.some((issue) => issue.code === "unsupported_operational_history"),
    ).toBe(true);
  });

  it("flags adjacent-domain capability language that implies direct role readiness without source-backed proof", () => {
    const issues = verifyProposalDraft({
      content:
        "Dear Hiring Manager,\n\nMy background gives me a strong foundation for documentation review and claims tracking, and I am well qualified to support your team.\n\nSincerely,\nRobert Cooper",
      plan: {
        ...basePlan,
        domain_gap: "adjacent",
        credential_status: "related_not_equivalent",
        transfer_mode: "abstract_only",
        allowed_concrete_facts: [
          "Production Supervisor at Lakshmi Electrical Control Systems.",
        ],
        allowed_transfer_themes: ["documentation discipline", "reliability"],
        proof_strategy: "abstract_only",
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      jobTitle: "Benefits Coordinator",
      jobDescription:
        "Review documentation, track claims, and coordinate support communication.",
    });

    expect(issues.some((issue) => issue.code === "adjacent_readiness")).toBe(
      true,
    );
  });

  it("flags final-language mismatch against the planner language", () => {
    const issues = verifyProposalDraft({
      content:
        "Madame, Monsieur,\n\nJe vous écris pour proposer ma candidature.\n\nCordialement,\nRobert Cooper",
      plan: basePlan,
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      jobTitle: "Security Guard",
      jobDescription: "We are looking for a security guard to join our team.",
    });

    expect(issues.some((issue) => issue.code === "language_mismatch")).toBe(
      true,
    );
  });

  describe("verifyProposalDraft claim ceiling - no context", () => {
    it.each(NO_CONTEXT_FIXTURES)("$name", ({ sentence, planFixture, expectedIssueTypes }) => {
      expect(
        runClaimFixture({
          name: "",
          sentence,
          planFixture,
          expectedIssueTypes,
        }),
      ).toEqual([...expectedIssueTypes].sort());
    });
  });

  describe("verifyProposalDraft claim ceiling - adjacent safe cases", () => {
    it.each(ADJACENT_SAFE_FIXTURES)("$name", ({ sentence, planFixture, expectedIssueTypes }) => {
      expect(
        runClaimFixture({
          name: "",
          sentence,
          planFixture,
          expectedIssueTypes,
        }),
      ).toEqual([...expectedIssueTypes].sort());
    });
  });

  describe("verifyProposalDraft claim ceiling - adjacent blocked bridges", () => {
    it.each(ADJACENT_BLOCKED_BRIDGES)("$name", ({ sentence, planFixture, expectedIssueTypes }) => {
      expect(
        runClaimFixture({
          name: "",
          sentence,
          planFixture,
          expectedIssueTypes,
        }),
      ).toEqual([...expectedIssueTypes].sort());
    });
  });

  describe("verifyProposalDraft claim ceiling - qualification inflation", () => {
    it.each(QUALIFICATION_FIXTURES)("$name", ({ sentence, planFixture, expectedIssueTypes }) => {
      expect(
        runClaimFixture({
          name: "",
          sentence,
          planFixture,
          expectedIssueTypes,
        }),
      ).toEqual([...expectedIssueTypes].sort());
    });
  });

  describe("verifyProposalDraft claim ceiling - achievement inflation", () => {
    it.each(ACHIEVEMENT_FIXTURES)("$name", ({ sentence, planFixture, expectedIssueTypes }) => {
      expect(
        runClaimFixture({
          name: "",
          sentence,
          planFixture,
          expectedIssueTypes,
        }),
      ).toEqual([...expectedIssueTypes].sort());
    });
  });

  describe("verifyProposalDraft claim ceiling - same-domain pass preservation", () => {
    it.each(SAME_DOMAIN_PASS_FIXTURES)("$name", ({ sentence, planFixture, expectedIssueTypes }) => {
      expect(
        runClaimFixture({
          name: "",
          sentence,
          planFixture,
          expectedIssueTypes,
        }),
      ).toEqual([...expectedIssueTypes].sort());
    });
  });

  it("preserves extracted cover-letter boundaries without restoring them", () => {
    const normalized = normalizeFinalProposalOutput({
      content:
        "Dear Hiring Manager,\n\nMy background in security and investigation has prepared me to contribute effectively.\n\nSincerely,\nRobert Cooper",
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
    });

    expect(normalized).toBe(
      "Dear Hiring Manager,\n\nMy background in security and investigation has prepared me to contribute effectively.\n\nSincerely,\nRobert Cooper",
    );
  });

  it("strips repair wrappers and trailing editorial sections from a cover letter", () => {
    const extracted = extractFinalProposalContent({
      content:
        "Here is the corrected final proposal\n\n---\n\nDear Hiring Manager,\n\nI am writing to express my interest in this role and would welcome the opportunity to contribute with reliability and clear communication.\n\nSincerely,\nAlex Doe\n\n---\n\nKey Corrections\n- Removed unsupported claims.\n- Tightened the closing.",
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Alex Doe",
    });

    expect(extracted).toBe(
      "Dear Hiring Manager,\n\nI am writing to express my interest in this role and would welcome the opportunity to contribute with reliability and clear communication.\n\nSincerely,\nAlex Doe",
    );
  });

  it("recovers the central body from assistant-style tailored cover-letter wrappers", () => {
    const extracted = extractFinalProposalContent({
      content:
        "Here’s a tailored cover letter based on the provided constraints and candidate background:\n\n---\n\nI have experience in business analytics and data mining, with work focused on deriving actionable insights from structured datasets. My certification as a Python Developer and my work in data modeling have also required organizing technical information clearly for decision-making.\n\nI would welcome the opportunity to discuss the position further.\n\n---\n\nThis version adheres to the strict constraints, avoids forbidden language, and focuses on concrete evidence while maintaining a warm, professional tone.",
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Stella Thatcher",
    });

    expect(extracted).toBe(
      "Dear Hiring Manager,\n\nI have experience in business analytics and data mining, with work focused on deriving actionable insights from structured datasets. My certification as a Python Developer and my work in data modeling have also required organizing technical information clearly for decision-making.\n\nI would welcome the opportunity to discuss the position further.\n\nSincerely,\nStella Thatcher",
    );
  });

  it("keeps only the first closing and signature block in a repaired cover letter", () => {
    const extracted = extractFinalProposalContent({
      content:
        "Dear Hiring Manager,\n\nI am interested in the opportunity and would welcome the chance to contribute with strong organization and follow-through.\n\nSincerely,\nAlex Doe\n\nSincerely,\nAlex Doe\n\nKey Corrections\nRemoved duplicate closing.",
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Alex Doe",
    });

    expect(extracted).toBe(
      "Dear Hiring Manager,\n\nI am interested in the opportunity and would welcome the chance to contribute with strong organization and follow-through.\n\nSincerely,\nAlex Doe",
    );
  });

  it("prefers the cover-letter block with real body content over a near-empty wrapper block", () => {
    const extracted = extractFinalProposalContent({
      content:
        "Here’s the corrected final proposal...\n\nDear Hiring Manager,\n\nSincerely,\n[Your Name]\n\nDear Hiring Manager,\n\nI am excited about the opportunity to contribute with careful coordination, clear communication, and consistent follow-through.\n\nSincerely,\nAlex Doe",
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Alex Doe",
    });

    expect(extracted).toBe(
      "Dear Hiring Manager,\n\nI am excited about the opportunity to contribute with careful coordination, clear communication, and consistent follow-through.\n\nSincerely,\nAlex Doe",
    );
  });

  it("removes duplicate salutations and placeholder signatures from repaired cover letters", () => {
    const extracted = extractFinalProposalContent({
      content:
        "Here is the corrected final proposal...\n\nDear Hiring Manager,\n\nDear Hiring Manager,\n\nI would welcome the opportunity to contribute with reliable execution and thoughtful communication.\n\nSincerely,\n[Candidate Name]",
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: null,
    });

    expect(extracted).toBe(
      "Dear Hiring Manager,\n\nI would welcome the opportunity to contribute with reliable execution and thoughtful communication.\n\nSincerely,",
    );
  });

  it("strips markdown and invisible-character duplicate boundary lines", () => {
    const extracted = extractFinalProposalContent({
      content:
        "Dear Hiring Manager,\n\n**Dear Hiring Manager,**\n\nI would welcome the opportunity to contribute with reliable execution and thoughtful communication.\n\n\u200BSincerely,\n\nSincerely,\nAlex Doe",
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Alex Doe",
    });

    expect(extracted).toBe(
      "Dear Hiring Manager,\n\nI would welcome the opportunity to contribute with reliable execution and thoughtful communication.\n\nSincerely,\nAlex Doe",
    );
  });

  it("strips punctuation and whitespace salutation/closing variants inside chosen body", () => {
    const extracted = extractFinalProposalContent({
      content:
        "Dear Hiring Manager,\n\nDear   Hiring   Manager!!!\n\nI am eager to contribute with reliable execution and clear communication.\n\nSincerely...\n\nSincerely,",
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: null,
    });

    expect(extracted).toBe(
      "Dear Hiring Manager,\n\nI am eager to contribute with reliable execution and clear communication.\n\nSincerely,",
    );
  });

  it("strips alternate closing formulas and stray candidate-name lines from the body before canonical rebuild", () => {
    const extracted = extractFinalProposalContent({
      content:
        "Dear Hiring Manager,\n\nI would welcome the chance to contribute with reliable execution and clear communication.\n\nBoard Ramanathapuram,\n\nBest regards,\n\nSincerely,\nBoard Ramanathapuram.",
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Board Ramanathapuram.",
    });

    expect(extracted).toBe(
      "Dear Hiring Manager,\n\nI would welcome the chance to contribute with reliable execution and clear communication.\n\nSincerely,\nBoard Ramanathapuram.",
    );
  });

  it("keeps a no-name cover letter to one clean canonical closing even when alternate closings appear in the body", () => {
    const extracted = extractFinalProposalContent({
      content:
        "Dear Hiring Manager,\n\nI would welcome the chance to contribute with reliable execution and clear communication.\n\nBest regards,\n\nKind regards,\n\nSincerely,",
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: null,
    });

    expect(extracted).toBe(
      "Dear Hiring Manager,\n\nI would welcome the chance to contribute with reliable execution and clear communication.\n\nSincerely,",
    );
  });

  it("treats corrected-and-verified wrapper text as non-content and finalizes one canonical letter", () => {
    const finalized = normalizeFinalProposalOutput({
      content: extractFinalProposalContent({
        content:
          "Here is the corrected and verified final proposal:\n\nDear Hiring Manager,\n\nSincerely,\n[Candidate Name]\n\nDear Hiring Manager,\n\nI would welcome the opportunity to contribute with thoughtful communication and dependable follow-through.\n\nSincerely,\nAlex Doe\n\nSincerely,\nAlex Doe",
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: "Alex Doe",
      }),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Alex Doe",
    });

    expect(finalized).toBe(
      "Dear Hiring Manager,\n\nI would welcome the opportunity to contribute with thoughtful communication and dependable follow-through.\n\nSincerely,\nAlex Doe",
    );
  });

  it("strips corrected-and-refined repair wrapper text from a near-empty cover letter", () => {
    const extracted = extractFinalProposalContent({
      content:
        "Dear Hiring Manager,\n\nHere is the corrected and refined proposal draft, adhering strictly to the allowed facts and constraints:\n\nSincerely,\nBoard Ramanathapuram.",
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Board Ramanathapuram.",
    });

    expect(extracted).toBe(
      "Dear Hiring Manager,\n\nSincerely,\nBoard Ramanathapuram.",
    );
  });

  it("prefers a later real cover letter over an earlier corrected-and-refined wrapper block", () => {
    const extracted = extractFinalProposalContent({
      content:
        "Dear Hiring Manager,\n\nHere is the corrected and refined proposal draft, adhering strictly to the allowed facts and constraints:\n\nSincerely,\nBoard Ramanathapuram.\n\nDear Hiring Manager,\n\nI am drawn to the opportunity to contribute with careful troubleshooting, clear documentation, and dependable collaboration. I would welcome the chance to discuss how that approach could support your team.\n\nSincerely,\nBoard Ramanathapuram.",
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Board Ramanathapuram.",
    });

    expect(extracted).toBe(
      "Dear Hiring Manager,\n\nI am drawn to the opportunity to contribute with careful troubleshooting, clear documentation, and dependable collaboration. I would welcome the chance to discuss how that approach could support your team.\n\nSincerely,\nBoard Ramanathapuram.",
    );
  });

  it("strips trailing separator commentary from non-cover-letter output", () => {
    const extracted = extractFinalProposalContent({
      content:
        "Final proposal\n\nI can help deliver a concise response tailored to your brief.\n\nPlease let me know if you would like a short kickoff call.\n\n---\nThis version removes unsupported claims and keeps the message concise.",
      format: "application_message",
    });

    expect(extracted).toBe(
      "I can help deliver a concise response tailored to your brief.\n\nPlease let me know if you would like a short kickoff call.",
    );
  });

  it("repairs one flagged sentence without rewriting surrounding valid sentences", () => {
    const fixture = CLAIM_PLAN_FIXTURES.adjacent_cv;
    const result = runLocalRepairFlow({
      content:
        "Dear Hiring Manager,\n\nI worked as a Production Supervisor at Lakshmi Electrical Control Systems. My degree has equipped me for the hands-on demands of this position. I’m interested in learning more about how my background may relate to this role.\n\nSincerely,\nAlex Doe",
      plan: fixture.plan,
      outputLanguage: "English",
      candidateName: fixture.candidateName,
      jobTitle: fixture.jobTitle,
      jobDescription: fixture.jobDescription,
    });

    expect(result.analysis.flaggedSentences).toHaveLength(1);
    expect(result.repairedBody).toBe(
      "I worked as a Production Supervisor at Lakshmi Electrical Control Systems. I hold a B.E. in Electrical and Electronics Engineering. I’m interested in learning more about how my background may relate to this role.",
    );
    expect(result.repairedAnalysis.issues).toEqual([]);
  });

  it("downgrades no-context readiness to interest-only language", () => {
    const fixture = CLAIM_PLAN_FIXTURES.no_context;
    const replacement = repairProposalSentenceLocally({
      flaggedSentence: {
        sentenceIndex: 0,
        originalSentence:
          "I’m ready to contribute to hardware design and prototyping.",
        issueCode: "no_context_readiness",
        reason: "No-context outputs must avoid unsupported readiness wording.",
        safeRewriteMode: "interest_only",
      },
      plan: fixture.plan,
      outputLanguage: "English",
    });

    expect(replacement).toMatch(
      /\b(?:reliability|communication|day-to-day work|consistency|organization)\b/i,
    );
    expect(replacement).not.toContain("ready to contribute");
    const finalized = finalizeProposalForSave({
      content: replacement ?? "",
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });
    expect(finalized).toContain(replacement);
    expect(finalized).not.toMatch(/ready to contribute|hardware design|prototyping/i);
  });

  it("keeps no-context repair template-safe and fact-free", () => {
    const fixture = CLAIM_PLAN_FIXTURES.no_context;
    const replacement = repairProposalSentenceLocally({
      flaggedSentence: {
        sentenceIndex: 0,
        originalSentence: "My background makes me a strong fit for this Rust role.",
        issueCode: "credential_inflation",
        reason: "No-context outputs must avoid unsupported qualification claims.",
        safeRewriteMode: "interest_only",
      },
      plan: fixture.plan,
      outputLanguage: "English",
    });

    expect(replacement).toBe(
      "The role appears to depend on steady follow-through, clear communication, and organized day-to-day coordination.",
    );
    expect(replacement).not.toMatch(
      /\b(?:background|experience with|skills in|my background includes|my experience includes|rust|python)\b/i,
    );
    const finalized = finalizeProposalForSave({
      content: replacement ?? "",
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });
    expect(finalized).toContain(replacement);
    expect(finalized).not.toMatch(
      /\b(?:background|experience with|skills in|rust|python|strong fit)\b/i,
    );
  });

  it("removes qualification conclusions while preserving factual degree background", () => {
    const fixture = CLAIM_PLAN_FIXTURES.adjacent_cv;
    const result = runLocalRepairFlow({
      content:
        "Dear Hiring Manager,\n\nMy degree has equipped me for the hands-on demands of this position.\n\nSincerely,\nAlex Doe",
      plan: fixture.plan,
      outputLanguage: "English",
      candidateName: fixture.candidateName,
      jobTitle: fixture.jobTitle,
      jobDescription: fixture.jobDescription,
    });

    expect(result.patches[0]?.replacementSentence).toBe(
      "I hold a B.E. in Electrical and Electronics Engineering.",
    );
    expect(result.finalized).not.toContain("equipped me");
    expect(result.repairedAnalysis.issues).toEqual([]);
  });

  it("downgrades unsupported achievement language to supported background scope", () => {
    const fixture = CLAIM_PLAN_FIXTURES.adjacent_cv;
    const result = runLocalRepairFlow({
      content:
        "Dear Hiring Manager,\n\nI improved production efficiency across the line. I hold a B.E. in Electrical and Electronics Engineering.\n\nSincerely,\nAlex Doe",
      plan: fixture.plan,
      outputLanguage: "English",
      candidateName: fixture.candidateName,
      jobTitle: fixture.jobTitle,
      jobDescription: fixture.jobDescription,
    });

    expect(result.patches[0]?.replacementSentence).toMatch(
      /(Lakshmi Electrical Control Systems|production)/,
    );
    expect(result.patches[0]?.replacementSentence).not.toMatch(
      /\b(?:improv|revenue|growth|efficiency)\b/i,
    );
    expect(result.repairedAnalysis.issues).toEqual([]);
  });

  it("patches multiple flagged sentences individually without adding stronger claims", () => {
    const fixture = CLAIM_PLAN_FIXTURES.adjacent_cv;
    const result = runLocalRepairFlow({
      content:
        "Dear Hiring Manager,\n\nI worked as a Production Supervisor at Lakshmi Electrical Control Systems. My degree has equipped me for the hands-on demands of this position. I improved production efficiency across the line.\n\nSincerely,\nAlex Doe",
      plan: fixture.plan,
      outputLanguage: "English",
      candidateName: fixture.candidateName,
      jobTitle: fixture.jobTitle,
      jobDescription: fixture.jobDescription,
    });

    expect(result.analysis.flaggedSentences.map((sentence) => sentence.sentenceIndex)).toEqual([1, 2]);
    expect(result.repairedBody).toContain(
      "I worked as a Production Supervisor at Lakshmi Electrical Control Systems.",
    );
    expect(result.finalized).not.toMatch(
      /\b(?:equipped me|strong fit|improved production efficiency|revenue|growth|ready to|support your)\b/i,
    );
    expect(result.repairedAnalysis.issues).toEqual([]);
  });

  it("flags and repairs a supported fact sentence with an unsupported security-process tail", () => {
    const fixture = CLAIM_PLAN_FIXTURES.security_cv;
    const result = runLocalRepairFlow({
      content: [
        "Dear Hiring Manager,",
        "",
        "At Robert Cooper Security Guard, I decreased theft of hotel items by 73% through improved vigilance, and I am familiar with emergency drills and staff training.",
        "I installed 15 360-degree CCTV cameras to expand monitoring coverage.",
        "",
        "Sincerely,",
        "Robert Cooper",
      ].join("\n"),
      plan: fixture.plan,
      outputLanguage: "English",
      candidateName: fixture.candidateName,
      jobTitle: fixture.jobTitle,
      jobDescription: fixture.jobDescription,
    });

    expect(result.analysis.flaggedSentences).toHaveLength(1);
    expect(result.analysis.flaggedSentences[0]?.issueCode).toBe(
      "unsupported_operational_history",
    );
    expect(result.patches[0]?.replacementSentence).toBe(
      "At Robert Cooper Security Guard, I decreased theft of hotel items by 73% through improved vigilance.",
    );
    expect(result.repairedBody).toContain(
      "I installed 15 360-degree CCTV cameras to expand monitoring coverage.",
    );
    expect(result.repairedBody).not.toMatch(
      /\bfamiliar with emergency drills and staff training\b/i,
    );
    expect(result.repairedAnalysis.issues).toEqual([]);
  });

  it("flags and repairs a supported fact sentence with an unsupported requirement tail without dropping nearby facts", () => {
    const fixture = CLAIM_PLAN_FIXTURES.security_cv;
    const result = runLocalRepairFlow({
      content: [
        "Dear Hiring Manager,",
        "",
        "I installed 15 360-degree CCTV cameras to expand monitoring coverage.",
        "At Robert Cooper Security Guard, I decreased theft of hotel items by 73% through improved vigilance, and I’m prepared to meet the minimum requirements, including a valid driver’s license and the preferred BLS certification.",
        "",
        "Sincerely,",
        "Robert Cooper",
      ].join("\n"),
      plan: fixture.plan,
      outputLanguage: "English",
      candidateName: fixture.candidateName,
      jobTitle: fixture.jobTitle,
      jobDescription: fixture.jobDescription,
    });

    expect(result.analysis.flaggedSentences).toHaveLength(1);
    expect(result.analysis.flaggedSentences[0]?.issueCode).toBe(
      "credential_inflation",
    );
    expect(result.patches[0]?.replacementSentence).toBe(
      "At Robert Cooper Security Guard, I decreased theft of hotel items by 73% through improved vigilance.",
    );
    expect(result.repairedBody).toContain(
      "I installed 15 360-degree CCTV cameras to expand monitoring coverage.",
    );
    expect(result.repairedBody).not.toMatch(
      /\b(?:prepared to meet the minimum requirements|driver['’]s license|bls certification)\b/i,
    );
    expect(result.repairedAnalysis.issues).toEqual([]);
  });

  it("removes exact duplicate adjacent sentences introduced by patching", () => {
    const fixture = CLAIM_PLAN_FIXTURES.no_context;
    const replacement = repairProposalSentenceLocally({
      flaggedSentence: {
        sentenceIndex: 1,
        originalSentence:
          "I’m ready to contribute to hardware design and prototyping.",
        issueCode: "no_context_readiness",
        reason: "No-context outputs must avoid unsupported readiness wording.",
        safeRewriteMode: "interest_only",
      },
      plan: fixture.plan,
      outputLanguage: "English",
    });
    const repairedBody = applyProposalSentencePatches({
      content:
        "Dear Hiring Manager,\n\nI’m interested in learning more about the role. I’m ready to contribute to hardware design and prototyping.\n\nSincerely,",
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: fixture.candidateName,
      patches: [
        {
          sentenceIndex: 1,
          originalSentence:
            "I’m ready to contribute to hardware design and prototyping.",
          replacementSentence: replacement ?? "",
        },
      ],
    });

    expect(repairedBody).not.toMatch(/ready to contribute/i);
    expect(repairedBody).not.toMatch(/I’m interested in learning more about the role\.\s+I’m interested in learning more about the role\./i);
    expect(repairedBody).toMatch(
      /\b(?:reliability|communication|day-to-day work|consistency|organization)\b/i,
    );
    const finalized = finalizeProposalForSave({
      content: repairedBody,
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });
    expect(finalized).toContain(repairedBody);
    expect(finalized).not.toMatch(/ready to contribute|hardware design|prototyping/i);
  });

  it("keeps one salutation and one closing after sentence-level repair", () => {
    const fixture = CLAIM_PLAN_FIXTURES.adjacent_cv;
    const result = runLocalRepairFlow({
      content:
        "Dear Hiring Manager,\n\nMy degree has equipped me for the hands-on demands of this position.\n\nSincerely,\nAlex Doe",
      plan: fixture.plan,
      outputLanguage: "English",
      candidateName: fixture.candidateName,
      jobTitle: fixture.jobTitle,
      jobDescription: fixture.jobDescription,
    });

    expect(result.finalized.match(/Dear Hiring Manager,/g)?.length ?? 0).toBe(1);
    expect(result.finalized.match(/Sincerely,/g)?.length ?? 0).toBe(1);
    expect(result.finalized.match(/Alex Doe/g)?.length ?? 0).toBe(1);
  });

  it("stays conservative when no safe fact-backed replacement exists", () => {
    const fixture = CLAIM_PLAN_FIXTURES.no_context;
    const replacement = repairProposalSentenceLocally({
      flaggedSentence: {
        sentenceIndex: 0,
        originalSentence: "My background makes me a strong fit for this role.",
        issueCode: "credential_inflation",
        reason: "No-context outputs must avoid unsupported qualification claims.",
        safeRewriteMode: "interest_only",
      },
      plan: fixture.plan,
      outputLanguage: "English",
    });

    expect(replacement).toMatch(
      /\b(?:reliability|communication|day-to-day work|consistency|organization)\b/i,
    );
    expect(replacement).not.toMatch(/\b(?:strong fit|qualified|equipped)\b/i);
    const finalized = finalizeProposalForSave({
      content: replacement ?? "",
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });
    expect(finalized).toContain(replacement);
    expect(finalized).not.toMatch(/\b(?:strong fit|qualified|equipped|background)\b/i);
  });

  it("keeps distant-role repair wording non-projective", () => {
    const replacement = repairProposalSentenceLocally({
      flaggedSentence: {
        sentenceIndex: 0,
        originalSentence:
          "My background aligns with the role and may offer relevant perspective.",
        issueCode: "distant_readiness",
        reason:
          "Distant-domain outputs must avoid direct target-domain verbs and operational analogy unless the exact claim is source-backed.",
        safeRewriteMode: "interest_only",
      },
      plan: {
        ...basePlan,
        context_mode: "rich",
        domain_gap: "distant",
        credential_status: "unsupported",
        transfer_mode: "no_operational_analogy",
        allowed_concrete_facts: [],
        allowed_transfer_themes: ["professional curiosity"],
        proof_strategy: "none",
      },
      outputLanguage: "English",
    });

    expect(replacement).toBe(
      "The role appears to depend on steady follow-through, clear communication, and organized day-to-day coordination.",
    );
    expect(replacement).not.toMatch(
      /\b(?:aligns with|may offer relevant perspective|eager to apply)\b/i,
    );
  });

  it("strips wrapper and word-count lines from non-cover-letter repair extraction", () => {
    const extracted = extractProposalBodyForRepair({
      content:
        "Here’s a concise proposal for your B2B SaaS landing page redesign:\n\n(Word count: 160)\n\nI can tighten the messaging hierarchy, refine the page structure, and deliver a concise first-pass rewrite.\n\n---\nRemoved unsupported claims.",
      format: "freelance_proposal",
      outputLanguage: "English",
      candidateName: null,
    });

    expect(extracted).toBe(
      "I can tighten the messaging hierarchy, refine the page structure, and deliver a concise first-pass rewrite.",
    );
    expect(extracted).not.toContain("Here’s a concise proposal");
    expect(extracted).not.toContain("Word count");
  });

  it("builds a local repair prompt for exactly one flagged sentence", () => {
    const prompt = buildProposalRepairPrompt({
      flaggedSentence: {
        sentenceIndex: 0,
        originalSentence:
          "While I may not have direct experience, I am confident in my ability to adapt.",
        issueCode: "no_context_phrase",
        reason:
          "Remove negative-history disclaimers and keep the output forward-looking.",
        safeRewriteMode: "interest_only",
      },
      plan: {
        ...basePlan,
        context_mode: "none",
        domain_gap: "distant",
        credential_status: "unsupported",
        transfer_mode: "no_operational_analogy",
        allowed_concrete_facts: [],
        allowed_transfer_themes: ["willingness to learn"],
        proof_strategy: "none",
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: null,
      previousSentence: null,
      nextSentence: "I would welcome the opportunity to discuss the role.",
    });

    expect(prompt.startsWith("CRITICAL OVERRIDE — REPAIR ONLY:")).toBe(true);
    expect(prompt).toContain("Rewrite EXACTLY one flagged sentence only.");
    expect(prompt).toContain(
      "Return only the replacement sentence text for the flagged target.",
    );
    expect(prompt).toContain("NO-CONTEXT REPAIR HARD LOCK");
    expect(prompt).toContain("Respect the shared canonical forbidden bridges list");
    expect(prompt).toContain(
      "Remove negative-history disclaimers and keep the output forward-looking.",
    );
    expect(prompt).toContain("safe_rewrite_mode: interest_only");
    expect(prompt).toContain("previous_sentence_read_only: none");
    expect(prompt).toContain(
      "next_sentence_read_only: I would welcome the opportunity to discuss the role.",
    );
    expect(prompt).toContain("Flagged sentence to rewrite:");
    expect(prompt).not.toContain("Draft to repair:");
    expect(prompt).not.toContain("Return only the repaired proposal text.");
  });

  it("explicitly bans over-projective wording in distant-role repair prompts", () => {
    const prompt = buildProposalRepairPrompt({
      flaggedSentence: {
        sentenceIndex: 0,
        originalSentence:
          "My background aligns with the role and may offer relevant perspective.",
        issueCode: "distant_readiness",
        reason:
          "Distant-domain outputs must avoid direct target-domain verbs and operational analogy unless the exact claim is source-backed.",
        safeRewriteMode: "interest_only",
      },
      plan: {
        ...basePlan,
        context_mode: "rich",
        domain_gap: "distant",
        credential_status: "unsupported",
        transfer_mode: "no_operational_analogy",
        allowed_concrete_facts: [],
        allowed_transfer_themes: ["professional curiosity"],
        proof_strategy: "none",
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: null,
      previousSentence: null,
      nextSentence: null,
    });

    expect(prompt).toContain("do not use 'aligns with'");
    expect(prompt).toContain("do not use 'aligns with', 'may offer relevant perspective', or 'eager to apply'");
  });
});
