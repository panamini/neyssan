import { describe, expect, it } from "vitest";

import {
  buildStructuredCoverLetterComposerPrompt,
  buildStructuredCoverLetterComposerRetryPrompt,
} from "../proposalBodyComposer";
import type { StructuredCoverLetterContentPlan } from "../proposalContentPlan";
import type { ProposalPlannerResult } from "../proposalPlanner";

const directPlannerResult: ProposalPlannerResult = {
  context_mode: "rich",
  domain_gap: "direct",
  credential_status: "exact_required",
  transfer_mode: "literal",
  output_language: "en",
  allowed_concrete_facts: [
    "Led a design system migration used across 4 product squads.",
    "Improved signup conversion by 11 percent through iterative UI experiments.",
  ],
  allowed_transfer_themes: [
    "cross-functional collaboration",
    "product-facing web apps",
  ],
  disallowed_claims: [],
  identity_hard_stops: [],
  proof_strategy: "concrete_supported",
  opening_strategy: "direct_fast",
};

const noContextPlannerResult: ProposalPlannerResult = {
  context_mode: "none",
  domain_gap: "adjacent",
  credential_status: "unsupported",
  transfer_mode: "abstract_only",
  output_language: "en",
  allowed_concrete_facts: [],
  allowed_transfer_themes: ["coordination", "clear communication"],
  disallowed_claims: [],
  identity_hard_stops: [],
  proof_strategy: "none",
  opening_strategy: "direct_fast",
};

const distantPlannerResult: ProposalPlannerResult = {
  context_mode: "minimal",
  domain_gap: "distant",
  credential_status: "unsupported",
  transfer_mode: "abstract_only",
  output_language: "en",
  allowed_concrete_facts: ["Built experimentation dashboards for growth teams."],
  allowed_transfer_themes: ["careful experimentation", "cross-functional product work"],
  disallowed_claims: ["machine learning", "statistical modeling"],
  identity_hard_stops: [],
  proof_strategy: "abstract_only",
  opening_strategy: "direct_fast",
};

const directContentPlan: StructuredCoverLetterContentPlan = {
  schema_version: 1,
  format: "cover_letter",
  language: "en",
  voice_preset: "direct",
  opening_strategy: "direct_fast",
  no_context_mode: false,
  body_paragraphs: [
    { role: "opening", fact_ids: [0], theme_ids: [0] },
    { role: "evidence", fact_ids: [1], theme_ids: [1] },
  ],
};

const storytellerContentPlan: StructuredCoverLetterContentPlan = {
  schema_version: 1,
  format: "cover_letter",
  language: "en",
  voice_preset: "storyteller",
  opening_strategy: "direct_fast",
  no_context_mode: false,
  body_paragraphs: [
    { role: "opening", fact_ids: [0], theme_ids: [0] },
    { role: "evidence", fact_ids: [1], theme_ids: [1] },
    { role: "motivation", fact_ids: [], theme_ids: [0] },
  ],
};

const noContextContentPlan: StructuredCoverLetterContentPlan = {
  schema_version: 1,
  format: "cover_letter",
  language: "en",
  voice_preset: "direct",
  opening_strategy: "direct_fast",
  no_context_mode: true,
  body_paragraphs: [
    { role: "opening", fact_ids: [], theme_ids: [0] },
    { role: "evidence", fact_ids: [], theme_ids: [0, 1] },
  ],
};

describe("structured body composer prompt", () => {
  it("uses tone traits and sparse examples instead of fixed opening families", () => {
    const prompt = buildStructuredCoverLetterComposerPrompt({
      plannerResult: directPlannerResult,
      contentPlan: directContentPlan,
      jobTitle: "Senior Frontend Engineer",
      jobDescription: "Lead React and TypeScript development.",
    });

    expect(prompt).toContain("Style traits:");
    expect(prompt).toContain(
      "Direct preset contract: keep exactly two body paragraphs and move from strongest fact to second fact",
    );
    expect(prompt).not.toContain("Positive anchor examples:");
    expect(prompt).not.toContain("I built...");
    expect(prompt).not.toContain("I improved...");
    expect(prompt).not.toContain("What stands out to me about the work is...");
    expect(prompt).not.toContain(
      "The design-system migration I led across four product squads",
    );
    expect(prompt).toContain(
      "Reusable UI work and close product-design collaboration have been at the center",
    );
  });

  it("adds anti-convergence guidance when multiple supported facts exist", () => {
    const prompt = buildStructuredCoverLetterComposerPrompt({
      plannerResult: directPlannerResult,
      contentPlan: directContentPlan,
      jobTitle: "Senior Frontend Engineer",
      jobDescription: "Lead React and TypeScript development.",
    });

    expect(prompt).toContain(
      "do not default every preset to the same lead fact and the same rhetorical opening job",
    );
  });

  it("rewrites no-context guidance around concrete work surfaces instead of abstract fallback traits", () => {
    const prompt = buildStructuredCoverLetterComposerPrompt({
      plannerResult: noContextPlannerResult,
      contentPlan: noContextContentPlan,
      jobTitle: "Operations Associate",
      jobDescription:
        "Support recurring processes, update records, and coordinate communication across teams.",
    });

    expect(prompt).toContain("recurring work, workflow, operating context, coordination, communication, or accuracy");
    expect(prompt).not.toContain(
      "role understanding, job relevance, reliability, communication, willingness to learn",
    );
    expect(prompt).toContain(
      "The opening may begin from role context, supported scope, or concrete work context.",
    );
  });

  it("uses factual distant-role guidance instead of abstract transfer-policy wording", () => {
    const prompt = buildStructuredCoverLetterComposerPrompt({
      plannerResult: distantPlannerResult,
      contentPlan: directContentPlan,
      jobTitle: "Data Scientist",
      jobDescription:
        "Seeking a Data Scientist with machine learning, experimentation design, Python data tooling, and strong statistical modeling experience.",
    });

    expect(prompt).toContain(
      "For adjacent or distant-role cases, state only factual overlap supported by the plan. If relevance is limited, keep it limited.",
    );
    expect(prompt).toContain(
      "Do not imply target-role readiness or use abstract transfer rhetoric when the plan does not support it.",
    );
    expect(prompt).not.toContain(
      "Prefer honest partial relevance over abstract transfer claims.",
    );
  });

  it("gives storyteller evidence paragraphs a thread-continuation job instead of resetting into abstract setup", () => {
    const prompt = buildStructuredCoverLetterComposerPrompt({
      plannerResult: directPlannerResult,
      contentPlan: storytellerContentPlan,
      jobTitle: "Senior Frontend Engineer",
      jobDescription: "Lead React and TypeScript development.",
    });

    expect(prompt).toContain(
      "Continue the same concrete thread from the opening with another supported detail or consequence. Do not reset with a new abstract setup.",
    );
    expect(prompt).toContain(
      "Storyteller preset contract: keep one concrete supported thread across paragraphs rather than resetting into scenic filler.",
    );
  });

  it("keeps the retry prompt focused on the failure without reintroducing dense rhetorical control", () => {
    const prompt = buildStructuredCoverLetterComposerRetryPrompt({
      plannerResult: directPlannerResult,
      contentPlan: directContentPlan,
      jobTitle: "Senior Frontend Engineer",
      jobDescription: "Lead React and TypeScript development.",
      failureReason: "Repeated rhetorical opening across paragraphs.",
    });

    expect(prompt).toContain(
      "Fix the validation failure without falling back to generic interest phrasing or recycling the same setup across paragraphs.",
    );
    expect(prompt).not.toContain(
      "Remove repeated rhetorical openings, repeated interest framing, duplicated setup, and repeated motivation lines.",
    );
  });
});
