import { describe, expect, it } from "vitest";

import {
  buildStructuredCoverLetterContentPlanPrompt,
  parseStructuredCoverLetterBody,
  validateStructuredCoverLetterContentPlan,
  type StructuredCoverLetterContentPlan,
} from "../proposalContentPlan";
import type { ProposalPlannerResult } from "../proposalPlanner";

const basePlan: ProposalPlannerResult = {
  context_mode: "rich",
  domain_gap: "direct",
  credential_status: "exact_required",
  transfer_mode: "literal",
  output_language: "en",
  allowed_concrete_facts: [
    "Improved signup conversion by 11 percent after iterative UI experiments.",
    "Led a design system migration used across 4 product squads.",
    "Built experimentation dashboards used by product and growth teams.",
  ],
  allowed_transfer_themes: [
    "cross-functional collaboration",
    "design systems",
    "product-facing web apps",
  ],
  disallowed_claims: [],
  identity_hard_stops: [],
  proof_strategy: "concrete_supported",
  opening_strategy: "direct_fast",
};

const validContentPlan: StructuredCoverLetterContentPlan = {
  schema_version: 1,
  format: "cover_letter",
  language: "en",
  voice_preset: "expert",
  opening_strategy: "direct_fast",
  no_context_mode: false,
  body_paragraphs: [
    {
      role: "opening",
      fact_ids: [1],
      theme_ids: [0],
      intent_label: "Lead with supported frontend scope",
    },
    {
      role: "evidence",
      fact_ids: [0, 2],
      theme_ids: [1],
      intent_label: "Keep concrete achievement proof",
    },
    {
      role: "motivation",
      fact_ids: [],
      theme_ids: [2],
      intent_label: "Close on grounded role motivation",
    },
  ],
};

const noContextPlan: ProposalPlannerResult = {
  context_mode: "none",
  domain_gap: "adjacent",
  credential_status: "unsupported",
  transfer_mode: "abstract_only",
  output_language: "en",
  allowed_concrete_facts: [],
  allowed_transfer_themes: [
    "role understanding",
    "reliability",
    "clear communication",
    "willingness to learn",
  ],
  disallowed_claims: [],
  identity_hard_stops: [],
  proof_strategy: "none",
  opening_strategy: "direct_fast",
};

const noContextContentPlan: StructuredCoverLetterContentPlan = {
  schema_version: 1,
  format: "cover_letter",
  language: "en",
  voice_preset: "direct",
  opening_strategy: "direct_fast",
  no_context_mode: true,
  body_paragraphs: [
    {
      role: "opening",
      fact_ids: [],
      theme_ids: [0, 2],
      intent_label: "Lead with grounded interest in the work",
    },
    {
      role: "evidence",
      fact_ids: [],
      theme_ids: [1, 3],
      intent_label: "Keep role-relevance grounded without inventing experience",
    },
  ],
};

const distantRolePlan: ProposalPlannerResult = {
  context_mode: "minimal",
  domain_gap: "distant",
  credential_status: "unsupported",
  transfer_mode: "abstract_only",
  output_language: "en",
  allowed_concrete_facts: [
    "Built experimentation dashboards for growth teams.",
  ],
  allowed_transfer_themes: [
    "careful experimentation",
    "cross-functional product work",
  ],
  disallowed_claims: [
    "machine learning",
    "production machine learning systems",
    "statistical modeling",
  ],
  identity_hard_stops: [],
  proof_strategy: "abstract_only",
  opening_strategy: "direct_fast",
};

const distantRoleContentPlan: StructuredCoverLetterContentPlan = {
  schema_version: 1,
  format: "cover_letter",
  language: "en",
  voice_preset: "direct",
  opening_strategy: "direct_fast",
  no_context_mode: false,
  body_paragraphs: [
    {
      role: "opening",
      fact_ids: [0],
      theme_ids: [1],
    },
    {
      role: "evidence",
      fact_ids: [0],
      theme_ids: [0],
    },
    {
      role: "motivation",
      fact_ids: [],
      theme_ids: [1],
    },
  ],
};

describe("structured cover letter content plan", () => {
  it("accepts a valid cover letter plan", () => {
    expect(
      validateStructuredCoverLetterContentPlan({
        plan: validContentPlan,
        plannerResult: basePlan,
        voicePreset: "expert",
      }),
    ).toEqual(validContentPlan);
  });

  it("rejects invalid fact and theme indexes", () => {
    const contentPlan: StructuredCoverLetterContentPlan = {
      schema_version: 1,
      format: "cover_letter",
      language: "en",
      voice_preset: "direct",
      opening_strategy: "direct_fast",
      no_context_mode: false,
      body_paragraphs: [
        {
          role: "opening",
          fact_ids: [5],
          theme_ids: [],
        },
        {
          role: "evidence",
          fact_ids: [0],
          theme_ids: [9],
        },
      ],
    };

    expect(() =>
      validateStructuredCoverLetterContentPlan({
        plan: contentPlan,
        plannerResult: basePlan,
        voicePreset: "direct",
      }),
    ).toThrow(/out of range/i);
  });

  it("rejects plans without an evidence paragraph in the second slot", () => {
    const contentPlan: StructuredCoverLetterContentPlan = {
      schema_version: 1,
      format: "cover_letter",
      language: "en",
      voice_preset: "direct",
      opening_strategy: "direct_fast",
      no_context_mode: false,
      body_paragraphs: [
        {
          role: "opening",
          fact_ids: [1],
          theme_ids: [0],
        },
        {
          role: "motivation",
          fact_ids: [0],
          theme_ids: [1],
        },
      ],
    };

    expect(() =>
      validateStructuredCoverLetterContentPlan({
        plan: contentPlan,
        plannerResult: basePlan,
        voicePreset: "direct",
      }),
    ).toThrow(/evidence paragraph second/i);
  });

  it("rejects missing achievement linkage when concrete supported achievements exist", () => {
    const contentPlan: StructuredCoverLetterContentPlan = {
      schema_version: 1,
      format: "cover_letter",
      language: "en",
      voice_preset: "direct",
      opening_strategy: "direct_fast",
      no_context_mode: false,
      body_paragraphs: [
        {
          role: "opening",
          fact_ids: [1],
          theme_ids: [0],
        },
        {
          role: "evidence",
          fact_ids: [2],
          theme_ids: [1],
        },
      ],
    };

    expect(() =>
      validateStructuredCoverLetterContentPlan({
        plan: contentPlan,
        plannerResult: basePlan,
        voicePreset: "direct",
      }),
    ).toThrow(/achievement facts/i);
  });

  it("rejects direct plans that add a third motivation paragraph", () => {
    const contentPlan: StructuredCoverLetterContentPlan = {
      schema_version: 1,
      format: "cover_letter",
      language: "en",
      voice_preset: "direct",
      opening_strategy: "direct_fast",
      no_context_mode: false,
      body_paragraphs: [
        {
          role: "opening",
          fact_ids: [0],
          theme_ids: [0],
        },
        {
          role: "evidence",
          fact_ids: [1],
          theme_ids: [1],
        },
        {
          role: "motivation",
          fact_ids: [],
          theme_ids: [2],
        },
      ],
    };

    expect(() =>
      validateStructuredCoverLetterContentPlan({
        plan: contentPlan,
        plannerResult: basePlan,
        voicePreset: "direct",
      }),
    ).toThrow(/exactly two body paragraphs/i);
  });

  it("rejects opening and evidence paragraphs that reuse the same fact set when multiple supported facts exist", () => {
    const contentPlan: StructuredCoverLetterContentPlan = {
      schema_version: 1,
      format: "cover_letter",
      language: "en",
      voice_preset: "expert",
      opening_strategy: "direct_fast",
      no_context_mode: false,
      body_paragraphs: [
        {
          role: "opening",
          fact_ids: [0],
          theme_ids: [0],
        },
        {
          role: "evidence",
          fact_ids: [0],
          theme_ids: [1],
        },
      ],
    };

    expect(() =>
      validateStructuredCoverLetterContentPlan({
        plan: contentPlan,
        plannerResult: basePlan,
        voicePreset: "expert",
      }),
    ).toThrow(/same fact set/i);
  });

  it("adds preset-specific paragraph contracts and anti-convergence guidance to the content-plan prompt", () => {
    const prompt = buildStructuredCoverLetterContentPlanPrompt({
      plannerResult: basePlan,
      voicePreset: "direct",
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Lead React and TypeScript development for a customer-facing SaaS platform with experimentation support.",
    });

    expect(prompt).toContain(
      "preset_contract_direct: use exactly 2 body paragraphs.",
    );
    expect(prompt).toContain(
      "Do not default every preset to the same lead fact and same rhetorical job.",
    );
  });

  it("rejects malformed sentence fragments in generated body text", () => {
    expect(() =>
      parseStructuredCoverLetterBody({
        content: [
          "I led a design system migration used across 4 product squads and improved frontend consistency.",
          "",
          "which.",
          "",
          "What interests me about this role is the combination of reusable UI systems and close product collaboration.",
        ].join("\n"),
        expectedParagraphCount: 3,
        candidateName: "Alex Martin",
        contentPlan: validContentPlan,
        plannerResult: basePlan,
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development for a customer-facing SaaS platform with experimentation support.",
      }),
    ).toThrow(/malformed sentence fragment/i);
  });

  it("rejects malformed lowercase sentence starts with a narrow heuristic", () => {
    expect(() =>
      parseStructuredCoverLetterBody({
        content: [
          "I led a design system migration used across 4 product squads and helped standardize UI work across teams.",
          "",
          "experience with iterative UI experiments helped me improve signup conversion by 11 percent.",
          "",
          "What interests me about this role is the combination of reusable UI systems and close product collaboration.",
        ].join("\n"),
        expectedParagraphCount: 3,
        candidateName: "Alex Martin",
        contentPlan: validContentPlan,
        plannerResult: basePlan,
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development for a customer-facing SaaS platform with experimentation support.",
      }),
    ).toThrow(/lowercase sentence start/i);
  });

  it("rejects cliche structured body phrasing before boundaries are rendered", () => {
    expect(() =>
      parseStructuredCoverLetterBody({
        content: [
          "I led a design system migration used across 4 product squads and improved frontend consistency.",
          "",
          "Improving signup conversion by 11 percent after iterative UI experiments makes me particularly compelling for this role.",
          "",
          "What interests me about this role is the combination of reusable UI systems and close product collaboration.",
        ].join("\n"),
        expectedParagraphCount: 3,
        candidateName: "Alex Martin",
        contentPlan: validContentPlan,
        plannerResult: basePlan,
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development for a customer-facing SaaS platform with experimentation support.",
      }),
    ).toThrow(/cliche phrasing/i);
  });

  it("rejects leaked sign-off, signature, and trailing body text", () => {
    expect(() =>
      parseStructuredCoverLetterBody({
        content: [
          "I led a design system migration used across 4 product squads and improved frontend consistency.",
          "",
          [
            "I improved signup conversion by 11 percent after iterative UI experiments.",
            "Best regards,",
            "Alex MartinThe remote engagement model requires clear async collaboration.",
          ].join("\n"),
          "",
          "What interests me about this role is the combination of reusable UI systems and close product collaboration.",
        ].join("\n"),
        expectedParagraphCount: 3,
        candidateName: "Alex Martin",
        contentPlan: validContentPlan,
        plannerResult: basePlan,
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development for a customer-facing SaaS platform with experimentation support.",
      }),
    ).toThrow(/forbidden boundary|candidate name/i);
  });

  it("requires strong-fact evidence paragraphs to keep at least one concrete achievement", () => {
    expect(() =>
      parseStructuredCoverLetterBody({
        content: [
          "I led a design system migration used across 4 product squads and helped standardize frontend work across teams.",
          "",
          "I worked closely with product and design teams on web experience improvements and collaborative delivery.",
          "",
          "What interests me about this role is the combination of reusable UI systems and close product collaboration.",
        ].join("\n"),
        expectedParagraphCount: 3,
        candidateName: "Alex Martin",
        contentPlan: validContentPlan,
        plannerResult: basePlan,
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development for a customer-facing SaaS platform with experimentation support.",
      }),
    ).toThrow(/required achievement substance/i);
  });

  it("rejects repeated sentences across structured body paragraphs", () => {
    expect(() =>
      parseStructuredCoverLetterBody({
        content: [
          "I led a design system migration used across 4 product squads and helped standardize frontend work across teams.",
          "",
          "I led a design system migration used across 4 product squads and helped standardize frontend work across teams.",
          "",
          "What interests me about this role is the combination of reusable UI systems and close product collaboration.",
        ].join("\n"),
        expectedParagraphCount: 3,
        candidateName: "Alex Martin",
        contentPlan: validContentPlan,
        plannerResult: basePlan,
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development for a customer-facing SaaS platform with experimentation support.",
      }),
    ).toThrow(/repeats the same sentence/i);
  });

  it("rejects repeated rhetorical openings across paragraphs", () => {
    expect(() =>
      parseStructuredCoverLetterBody({
        content: [
          "What stands out to me about this work is the design system migration I led across 4 product squads and the reusable UI systems it supported.",
          "",
          "What stands out to me in the evidence is the 11 percent signup conversion improvement I delivered through iterative UI experiments and dashboards used by product and growth teams.",
          "",
          "The mix of product-facing web apps and close collaboration with design is the part of the role I would like to keep working on.",
        ].join("\n"),
        expectedParagraphCount: 3,
        candidateName: "Alex Martin",
        contentPlan: validContentPlan,
        plannerResult: basePlan,
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development for a customer-facing SaaS platform with experimentation support.",
      }),
    ).toThrow(/repeats the same rhetorical opening/i);
  });

  it("rejects a motivation paragraph that repeats the opening instead of closing on grounded fit", () => {
    expect(() =>
      parseStructuredCoverLetterBody({
        content: [
          "This role stands out to me for the mix of reusable UI systems, performance work, and close collaboration with product and design.",
          "",
          "I improved signup conversion by 11 percent through iterative UI experiments and built dashboards used by product and growth teams.",
          "",
          "This role stands out to me for the same mix of reusable UI systems, performance work, and product-facing collaboration with design in day-to-day work.",
        ].join("\n"),
        expectedParagraphCount: 3,
        candidateName: "Alex Martin",
        contentPlan: validContentPlan,
        plannerResult: basePlan,
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development for a customer-facing SaaS platform with experimentation support.",
      }),
    ).toThrow(/motivation paragraph repeats the opening/i);
  });

  it("accepts safe no-context body output when it stays grounded and non-empty", () => {
    expect(
      parseStructuredCoverLetterBody({
        content: [
          "What interests me about this Operations Associate role is the chance to support recurring processes, keep records accurate, and help communication move cleanly across teams.",
          "",
          "The emphasis on reliability, clear communication, and willingness to learn stands out to me, and I would bring a careful, organized approach to that day-to-day work.",
        ].join("\n"),
        expectedParagraphCount: 2,
        contentPlan: noContextContentPlan,
        plannerResult: noContextPlan,
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes, update internal records, and assist with communication across teams.",
      }),
    ).toEqual([
      "What interests me about this Operations Associate role is the chance to support recurring processes, keep records accurate, and help communication move cleanly across teams.",
      "The emphasis on reliability, clear communication, and willingness to learn stands out to me, and I would bring a careful, organized approach to that day-to-day work.",
    ]);
  });

  it("rejects no-context bodies that collapse into repeated interest-only paragraphs", () => {
    expect(() =>
      parseStructuredCoverLetterBody({
        content: [
          "What interests me about this Operations Associate role is the chance to support recurring processes and keep communication clear across teams.",
          "",
          "I am interested in a role where reliability, clear communication, and willingness to learn matter in the day-to-day work.",
        ].join("\n"),
        expectedParagraphCount: 2,
        contentPlan: noContextContentPlan,
        plannerResult: noContextPlan,
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes, update internal records, and assist with communication across teams.",
      }),
    ).toThrow(/repeated interest-only paragraphs/i);
  });

  it("rejects unsupported distant-role claims even when a paragraph also contains one allowed fact", () => {
    expect(() =>
      parseStructuredCoverLetterBody({
        content: [
          "I worked as a Product Engineer at Northline Labs, where I collaborated closely with product and design teams.",
          "",
          "I built experimentation dashboards for growth teams and developed statistical modeling workflows for machine learning systems.",
          "",
          "What interests me about this role is the opportunity to own production machine learning systems.",
        ].join("\n\n"),
        expectedParagraphCount: 3,
        candidateName: "Alex Martin",
        contentPlan: distantRoleContentPlan,
        plannerResult: distantRolePlan,
        jobTitle: "Data Scientist",
        jobDescription:
          "Seeking a Data Scientist with machine learning, experimentation design, Python data tooling, and strong statistical modeling experience.",
      }),
    ).toThrow(/disallowed claim/i);
  });

  it("rejects weak distant-role transfer cliches even without an explicit forbidden claim phrase", () => {
    expect(() =>
      parseStructuredCoverLetterBody({
        content: [
          "I worked as a Product Engineer at Northline Labs, where I collaborated closely with product and design teams.",
          "",
          "I built experimentation dashboards for growth teams and stayed close to careful experimentation in product work.",
          "",
          "That background translates directly to this role and provides a strong foundation for the work.",
        ].join("\n\n"),
        expectedParagraphCount: 3,
        candidateName: "Alex Martin",
        contentPlan: distantRoleContentPlan,
        plannerResult: distantRolePlan,
        jobTitle: "Data Scientist",
        jobDescription:
          "Seeking a Data Scientist with machine learning, experimentation design, Python data tooling, and strong statistical modeling experience.",
      }),
    ).toThrow(/weak abstract transfer framing/i);
  });

  it("accepts a globally coherent body with a distinct motivation close", () => {
    expect(
      parseStructuredCoverLetterBody({
        content: [
          "I led a design system migration used across 4 product squads, which kept me close to reusable UI work and day-to-day collaboration with product and design.",
          "",
          "I improved signup conversion by 11 percent through iterative UI experiments and built experimentation dashboards used by product and growth teams.",
          "",
          "What stands out to me about this role is the chance to keep working on reusable interfaces, performance, and customer-facing workflows in close partnership with product and design.",
        ].join("\n"),
        expectedParagraphCount: 3,
        candidateName: "Alex Martin",
        contentPlan: validContentPlan,
        plannerResult: basePlan,
        jobTitle: "Senior Frontend Engineer",
        jobDescription:
          "Lead React and TypeScript development for a customer-facing SaaS platform with experimentation support.",
      }),
    ).toEqual([
      "I led a design system migration used across 4 product squads, which kept me close to reusable UI work and day-to-day collaboration with product and design.",
      "I improved signup conversion by 11 percent through iterative UI experiments and built experimentation dashboards used by product and growth teams.",
      "What stands out to me about this role is the chance to keep working on reusable interfaces, performance, and customer-facing workflows in close partnership with product and design.",
    ]);
  });
});
