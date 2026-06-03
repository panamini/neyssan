import { describe, expect, it, vi } from "vitest";

import {
  applyFinalSavedOutputBridgeGuard,
  buildInlineMistralPrompt,
  coerceProposalFinalizationFailureToConvexError,
  evaluateProposalBodySaveability,
  finalizePremiumCoverLetterPayloadForPersistence,
  finalizeProposalForPersistence,
  finalizeProposalForSave,
  getDeterministicProposalRenderPolicy,
  inspectProposalFinalization,
  isStructuredMistralCoverLetterEnabled,
  neutralizeFinalSavedOutputBridgeSentence,
  repairProposalDraftWithConstrainedPass,
  resolveStructuredMistralCoverLetterRolloutMode,
  shouldRunProposalDraftRepair,
} from "../../../generateProposalMutation";
import {
  buildProposalWriterPlanBlock,
  type ProposalPlannerResult,
} from "../proposalPlanner";
import { analyzeProposalDraft } from "../proposalEnforcement";
import {
  validatePremiumCoverLetterBodyParts,
  validatePremiumWriterOutputV1,
} from "../premiumCoverLetter";

const BASE_ARGS = {
  jobTitle: "Example Role",
  jobDescription:
    "Join a collaborative team working on structured, detail-oriented projects.",
  proposalType: "cover_letter" as const,
};
const BASE_MESSAGE_ARGS = {
  jobTitle: "Example Role",
  jobDescription:
    "Join a collaborative team working on structured, detail-oriented projects.",
  proposalType: "application_message" as const,
};

const BASE_TONE = {
  formalityLevel: "neutral",
  creativity: "medium",
} as const;

describe("proposal writer prompt contract", () => {
  it("keeps no-context cover letters grounded in work context instead of an exact fallback formula", () => {
    const prompt = buildInlineMistralPrompt(
      BASE_ARGS,
      BASE_TONE,
      "Preset intent: improve narrative flow. Behaviors: stay vivid but grounded. Avoid: generic application padding.",
      "cover_letter",
      "English",
      "",
      "none",
      [
        "No candidate background is available for this request.",
        "Treat no-context mode as a grounded, non-claiming cover-letter body rather than a capability-based cover letter.",
      ].join(" "),
      buildProposalWriterPlanBlock(
        {
          context_mode: "none",
          domain_gap: "distant",
          credential_status: "unsupported",
          transfer_mode: "no_operational_analogy",
          output_language: "en",
          allowed_concrete_facts: [],
          allowed_transfer_themes: [
            "company-specific motivation",
            "professional curiosity",
          ],
          disallowed_claims: [],
          identity_hard_stops: [],
          proof_strategy: "none",
          opening_strategy: "storyteller_thread",
        },
        "cover_letter",
      ),
    );

    expect(prompt).toContain(
      "write a grounded, non-claiming cover-letter body rather than a capability-based cover letter",
    );
    expect(prompt).toContain(
      "let at most one sentence rely mainly on personal-interest framing",
    );
    expect(prompt).not.toContain(
      "If there is little concrete company-specific material to say, use the fallback sentence: 'I would welcome the opportunity to discuss my interest in the role.'",
    );
    expect(prompt).toContain(
      "The preset must not increase claim strength, readiness, contribution implication",
    );
    expect(
      prompt.indexOf(
        "CRITICAL OVERRIDE v2 — HIGHEST PRIORITY — VIOLATION = ERROR:",
      ),
    ).toBeLessThan(prompt.indexOf("Write a tailored employment cover letter"));
    expect(prompt).toContain("META OUTPUT FORBIDDEN — NEVER output:");
    expect(prompt).toContain("Return only the raw body text.");
    expect(prompt).toContain("Cover-letter composition priority:");
    expect(prompt).toContain(
      "The body is incomplete unless it contains at least two substantive grounded movements before the closing invitation.",
    );
    expect(prompt).toContain(
      "JD summary plus appreciation, admiration, generic communication/professionalism/reliability filler, or a generic interest sentence is incomplete and does not satisfy Movement 2.",
    );
    expect(prompt).toContain(
      "A role-summary sentence, appreciation sentence, benefit summary, or generic professionalism sentence does not count as one of those substantive movements.",
    );
    expect(prompt.indexOf("Cover-letter composition priority:")).toBeLessThan(
      prompt.indexOf("Unsupported claims blacklist:"),
    );
    expect(prompt).toContain(
      "All rules below are written in English but apply identically in the target output language.",
    );
    expect(prompt).toContain(
      "use only role context, concrete work surfaces from the job description",
    );
    expect(prompt).toContain(
      "Open from a specific work surface, workflow, operating context, employer context, or day-to-day responsibility from the job description rather than from generic admiration for the opportunity.",
    );
    expect(prompt).toContain(
      "make at least two substantive sentences about recurring responsibilities, workflow, operating context, coordination, communication, records, or team interaction from the job description before the brief close",
    );
    expect(prompt).toContain(
      "The body must still feel useful and complete before the final discussion-forward sentence; do not rely on the close to carry the main persuasive movement.",
    );
    expect(prompt).toContain(
      "Treat job-description summary plus appreciation, admiration, or a generic communication/professionalism sentence as incomplete; the second body movement must still add grounded operational consequence, dependency, or workflow substance.",
    );
    expect(prompt).toContain(
      "keep the main body substance on the work itself rather than on mission admiration, culture admiration, schedule, flexibility, growth language, or generic role-interest rhetoric",
    );
    expect(prompt).not.toContain(
      "Keep the salutation, body, and closing all in English.",
    );
    expect(prompt).toContain(
      "If the prompt forbids greetings, sign-offs, or boundary lines, do not add them.",
    );
  });

  it("keeps preset guidance claim-safe while allowing body-texture cues for cv-backed prompts", () => {
    const plan: ProposalPlannerResult = {
      context_mode: "rich",
      domain_gap: "adjacent",
      credential_status: "related_not_equivalent",
      transfer_mode: "abstract_only",
      output_language: "en",
      allowed_concrete_facts: [
        "Reduced theft by 73% through improved vigilance strategies.",
        "Supervised wire harness and control panel production.",
      ],
      allowed_transfer_themes: ["structured environments"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "direct_fast",
    };

    const prompt = buildInlineMistralPrompt(
      { ...BASE_ARGS, voicePreset: "direct" },
      BASE_TONE,
      "Preset intent: optimize for clarity, speed, and concise relevance. Tone traits: shorter sentences, low padding, plainspoken transitions, and direct movement between points without sounding abrupt. Avoid: ceremonial courtesy phrases.",
      "cover_letter",
      "English",
      "Candidate background for personalization:\n- Standout achievements: Reduced theft by 73% through improved vigilance strategies.",
      "rich",
      "",
      buildProposalWriterPlanBlock(plan, "cover_letter"),
    );

    expect(prompt).toContain(
      "do not default to opening with the only standout achievement",
    );
    expect(prompt).toContain(
      "Use the selected preset only for tone, pacing, warmth, directness, narrative smoothness, and body texture within the allowed evidence boundaries.",
    );
    expect(prompt).toContain(
      "For direct, keep the body lean and plainspoken, but still make the opening read like clear role-relevant positioning and include one grounded supporting sentence or one concrete role-relevance sentence beyond the opening proof when material exists instead of jumping straight to the close.",
    );
    expect(prompt).toContain(
      "Make the body feel complete and employer-useful even if the final discussion sentence is removed.",
    );
    expect(prompt).toContain(
      "The body is incomplete unless it contains the opening positioning move and at least one additional substantive body movement before the closing invitation.",
    );
    expect(prompt).toContain(
      "When strong supported evidence exists, use both the employer-facing relevance move and one additional supported fact or operating detail before the close rather than stopping after one proof sentence.",
    );
    expect(prompt.indexOf("Cover-letter composition priority:")).toBeLessThan(
      prompt.indexOf("Unsupported claims blacklist:"),
    );
    expect(prompt).not.toContain(
      "likely contribution within the opening lines",
    );
    expect(prompt).not.toContain(
      "open with a grounded human connection to the team",
    );
    expect(prompt).not.toContain(
      "Keep the salutation, body, and closing all in English.",
    );
  });

  it("pushes cv-backed cover-letter prompts toward concrete evidence before abstract transfer framing", () => {
    const plan: ProposalPlannerResult = {
      context_mode: "rich",
      domain_gap: "adjacent",
      credential_status: "related_not_equivalent",
      transfer_mode: "abstract_only",
      output_language: "en",
      allowed_concrete_facts: [
        "Reduced unauthorized entry by 26% through improved access control measures.",
        "Managed incident documentation for hotel operations.",
        "Background in client-facing security work across busy sites.",
      ],
      allowed_transfer_themes: [
        "cross-functional collaboration",
        "structured environments",
      ],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "expert_structured",
    };

    const prompt = buildInlineMistralPrompt(
      { ...BASE_ARGS, voicePreset: "expert" },
      BASE_TONE,
      "Preset intent: optimize for clarity, speed, and concise relevance. Tone traits: shorter sentences, low padding, plainspoken transitions, and direct movement between points without sounding abrupt. Avoid: ceremonial courtesy phrases.",
      "cover_letter",
      "English",
      "Candidate background for personalization:\n- Supported facts include access-control work, incident documentation, and client-facing security experience.",
      "rich",
      "",
      buildProposalWriterPlanBlock(plan, "cover_letter"),
    );

    expect(prompt).toContain(
      "anchor the first substantive sentence in one concrete supported evidence point or one supported scope/background fact",
    );
    expect(prompt).toContain(
      "Prefer top supported evidence, supported scope, and relevant background facts before abstract transferable traits, mission admiration, or generic transfer language.",
    );
    expect(prompt).toContain(
      "Use transferable traits only as brief secondary framing after concrete proof, not as the main body substance when stronger evidence exists.",
    );
    expect(prompt).toContain(
      "After the evidence anchor, use the next substantive sentence to explain why that supported proof matters for the role's actual work, workflow, users, team context, or operating environment rather than merely saying it aligns or is transferable.",
    );
    expect(prompt).toContain(
      "When supported evidence exists beyond the opening point, spend one additional grounded supporting sentence on a second supported scope/background fact or concrete operating detail before the close.",
    );
    expect(prompt).toContain(
      "For adjacent or distant backgrounds, make that explanation name one concrete overlap, operating constraint, or perspective the supported evidence speaks to rather than broad future-value or adaptability language.",
    );
    expect(prompt).toContain(
      "For adjacent or distant but still recoverable backgrounds, write a prudent transfer cover letter: keep one supported overlap or perspective concrete, say what part of the work it helps the reader trust, and do not imply direct target-role readiness.",
    );
    expect(prompt).toContain(
      "The employer-facing move counts only if it explains a concrete team, workflow, users, operating environment, service quality, safety, compliance, coordination, or delivery consequence the evidence is relevant to; vague alignment, fit, independence, deadline-comfort, communication, or professionalism summaries do not count.",
    );
    expect(prompt).toContain(
      "One proof cluster plus a weak relevance or fit-summary sentence is incomplete.",
    );
    expect(prompt).toContain(
      "Evidence chain requirement: each main paragraph should map job priority -> source-backed candidate fact -> recruiter case for why that fact matters in the role.",
    );
    expect(prompt).toContain(
      "Missing requirements must become gaps, omissions, or cautious non-claims; never turn job keywords into candidate proof.",
    );
    expect(prompt).toContain(
      "Do not praise company mission, culture, values, or the employer as a substitute for candidate evidence.",
    );
  });

  it("asks strong cv-backed direct-match cover-letter prompts to make an employer-facing hiring case before the close", () => {
    const prompt = buildInlineMistralPrompt(
      { ...BASE_ARGS, voicePreset: "signature" },
      BASE_TONE,
      "Preset intent: keep the voice natural and balanced. Behaviors: use clean active phrasing. Avoid: stock enthusiasm.",
      "cover_letter",
      "English",
      "Candidate background for personalization:\n- Led a design system migration used across four product squads.\n- Improved signup conversion by 11 percent through iterative UI experiments.",
      "rich",
      "",
      buildProposalWriterPlanBlock(
        {
          context_mode: "rich",
          domain_gap: "direct",
          credential_status: "exact_required",
          transfer_mode: "literal",
          output_language: "en",
          allowed_concrete_facts: [
            "Led a design system migration used across four product squads.",
            "Improved signup conversion by 11 percent through iterative UI experiments.",
            "Partnered with product and design on customer-facing workflow improvements.",
          ],
          allowed_transfer_themes: ["cross-functional collaboration"],
          disallowed_claims: [],
          identity_hard_stops: [],
          proof_strategy: "concrete_supported",
          opening_strategy: "signature_default",
        },
        "cover_letter",
      ),
    );

    expect(prompt).toContain(
      "Make the body feel complete and employer-useful even if the final discussion sentence is removed.",
    );
    expect(prompt).toContain(
      "Give the reader a reason to interview the candidate before the closing sentence arrives.",
    );
    expect(prompt).toContain("CV-backed evidence priority:");
    expect(prompt).toContain(
      "If quantified achievements, concrete operational proof, strong scope, or clearly role-relevant accomplishments are present, they must appear before weaker qualification listing or attraction language.",
    );
    expect(prompt).toContain(
      "Language proficiency, generic software familiarity, office tools, future certification interest, schedule flexibility, generic company admiration, benefits attraction, employee-experience praise, or excitement about joining are low-priority details when stronger evidence exists.",
    );
    expect(prompt.indexOf("CV-backed evidence priority:")).toBeLessThan(
      prompt.indexOf("Unsupported claims blacklist:"),
    );
    expect(prompt).toContain(
      "Open with a clear role-relevant positioning move grounded in the strongest supported proof or scope/background fact rather than a generic application formula or a bare fact dump.",
    );
    expect(prompt).toContain(
      "After the evidence anchor, include one explicit employer-facing relevance sentence that states what part of the role's work, workflow, users, team, or operating environment the supported evidence speaks to.",
    );
    expect(prompt).toContain(
      "The body must still read like a concise hiring case before the final discussion sentence; do not let the close do the work of missing body substance.",
    );
    expect(prompt).toContain(
      "Movement 2: either one additional supported fact or operating detail, or one explicit employer-facing relevance sentence that names the work, workflow, users, team context, or operating environment the evidence speaks to.",
    );
  });

  it("keeps cover-letter prompts in first person and requires complete sentence closure", () => {
    const plan: ProposalPlannerResult = {
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
    };

    const prompt = buildInlineMistralPrompt(
      { ...BASE_ARGS, voicePreset: "storyteller" },
      BASE_TONE,
      "Preset intent: keep the voice natural and connected. Behaviors: smooth transitions and light narrative texture. Avoid: theatrical flourish.",
      "cover_letter",
      "English",
      "Candidate background for personalization:\n- Coordinated cross-functional research projects.",
      "rich",
      "",
      buildProposalWriterPlanBlock(plan, "cover_letter"),
    );

    expect(prompt).toContain(
      "Keep all cover-letter body prose in first person throughout. Do not switch to he, she, they, or third-person self-reference for the candidate.",
    );
    expect(prompt).toContain(
      "Every sentence must be complete and grammatically closed. Do not leave trailing clauses, unfinished continuations, or half-finished sentences such as '... is.' or 'I look forward to discussing how my background.'.",
    );
    expect(prompt).toContain(
      "For engaging and storyteller tones, prioritize completed sentence closure and clean paragraph endings over flourish.",
    );
  });

  it("keeps shared no-context guidance concrete and non-claiming", () => {
    const prompt = buildInlineMistralPrompt(
      { ...BASE_ARGS, voicePreset: "signature" },
      BASE_TONE,
      "Preset intent: keep the voice natural and balanced. Behaviors: use clean active phrasing. Avoid: stock enthusiasm.",
      "cover_letter",
      "English",
      "",
      "none",
      "No candidate background is available for this request.",
      buildProposalWriterPlanBlock(
        {
          context_mode: "none",
          domain_gap: "distant",
          credential_status: "unsupported",
          transfer_mode: "no_operational_analogy",
          output_language: "en",
          allowed_concrete_facts: [],
          allowed_transfer_themes: ["company-specific motivation"],
          disallowed_claims: [],
          identity_hard_stops: [],
          proof_strategy: "none",
          opening_strategy: "signature_default",
        },
        "cover_letter",
      ),
    );

    expect(prompt).toContain(
      "use only role context, concrete work surfaces from the job description",
    );
    expect(prompt).toContain(
      "let at most one sentence rely mainly on personal-interest framing",
    );
    expect(prompt).not.toContain(
      "end with exactly: 'I would welcome the opportunity to discuss my interest in the role.'",
    );
  });

  it("hardens legacy no-context cover-letter prompts against weak interest rhetoric and readiness leakage", () => {
    const prompt = buildInlineMistralPrompt(
      BASE_ARGS,
      BASE_TONE,
      "Preset intent: keep the voice natural and balanced. Behaviors: use clean active phrasing. Avoid: stock enthusiasm.",
      "cover_letter",
      "English",
      "",
      "none",
      "No candidate background is available for this request.",
      buildProposalWriterPlanBlock(
        {
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
        },
        "cover_letter",
      ),
    );

    expect(prompt).toContain(
      "Aim for a body built from two grounded job-description sentences about the work itself, workflow, operating context, coordination, or employer context, plus at most one brief role-interest or curiosity sentence before the close.",
    );
    expect(prompt).toContain(
      "make the main body stand on two JD-grounded substantive sentences about the work itself, workflow, operating context, coordination, communication, records, or team interaction before the brief close",
    );
    expect(prompt).toContain(
      "make the first substantive sentence about the actual work, products, outputs, media, files, process, or operating context rather than about personal interest or admiration",
    );
    expect(prompt).toContain(
      "make the next substantive sentence about workflow, collaboration, revision, production constraints, deliverables, or coordination from the job description before any motivation-led sentence",
    );
    expect(prompt).toContain(
      "Do not use generic role-interest templates such as 'I am particularly drawn to ...', 'The opportunity to ...', 'The day-to-day work itself ...', 'prepared to adapt', 'prepared to meet the minimum requirements', 'develop skills in ...', 'particularly engaging', 'compelling', 'attractive place to grow professionally', or 'resonates with my understanding ...'.",
    );
    expect(prompt).toContain(
      "Do not let schedule, flexibility, or willingness-to-adapt language serve as one of the main supporting sentences.",
    );
    expect(prompt).toContain(
      "Do not let a role-title summary, scenic employer description, or generic paraphrase of the job description count as one of the grounded body sentences.",
    );
    expect(prompt).toContain(
      "Do not let benefit summaries, environment summaries, or generic teamwork, professionalism, reliability, or seriousness filler count as body substance.",
    );
    expect(prompt).toContain(
      "Keep mission admiration, culture admiration, schedule, flexibility, and generic interest rhetoric secondary at most; they must not carry the body.",
    );
    expect(prompt).toContain(
      "Keep challenge language, opportunity language, mission admiration, growth language, and personal-interest rhetoric secondary only; they must not carry the body or come before the concrete work/process sentences when those are available.",
    );
    expect(prompt).toContain(
      "No-context mode must be motivation and work-surface only. Do not claim traits, habits, abilities, skills, background, experience, past work, group-project history, customer-facing history, or personal work habits.",
    );
  });

  it("asks cv-backed cover-letter prompts to avoid the default proof point plus generic relevance shell", () => {
    const prompt = buildInlineMistralPrompt(
      { ...BASE_ARGS, voicePreset: "expert" },
      BASE_TONE,
      "Preset intent: keep the voice natural and balanced. Behaviors: use clean active phrasing. Avoid: stock enthusiasm.",
      "cover_letter",
      "English",
      "Candidate background for personalization:\n- Built experimentation dashboards.\n- Coordinated product and design work.",
      "sparse",
      "",
      buildProposalWriterPlanBlock(
        {
          context_mode: "sparse",
          domain_gap: "adjacent",
          credential_status: "related_not_equivalent",
          transfer_mode: "abstract_only",
          output_language: "en",
          allowed_concrete_facts: [
            "Built experimentation dashboards for growth teams.",
            "Coordinated cross-functional product work with design and product partners.",
          ],
          allowed_transfer_themes: ["structured experimentation"],
          disallowed_claims: [],
          identity_hard_stops: [],
          proof_strategy: "concrete_supported",
          opening_strategy: "expert_structured",
        },
        "cover_letter",
      ),
    );

    expect(prompt).toContain(
      "Do not let the body collapse into proof point, generic relevance sentence, and generic close only.",
    );
    expect(prompt).toContain(
      "Do not let the close do the work of a missing body sentence.",
    );
    expect(prompt).toContain(
      "After the opening evidence movement, use the next substantive movement to explain why that supported proof matters for the role's work, workflow, users, team context, or operating environment rather than reducing it to generic 'aligns with' or future-value language.",
    );
    expect(prompt).toContain(
      "If quantified achievement evidence, operational proof, or strong role-relevant scope exists, do not spend the opening or main supporting sentence on language proficiency, office software, future certification interest, schedule flexibility, or generic company enthusiasm.",
    );
    expect(prompt).toContain(
      "That employer-facing sentence does not count if it only says the background aligns, is a strong fit, ensures efficient workflows, or restates communication, professionalism, independence, or deadline comfort without a concrete operating consequence.",
    );
    expect(prompt).toContain(
      "If more supported scope, background, or operating detail exists after the opening proof, spend one additional grounded supporting sentence on it before the close rather than ending on proof plus a generic close.",
    );
    expect(prompt).toContain(
      "Secondary qualifications such as language ability, generic office tools, or future certification interest should appear only if they are central to the role and the stronger evidence has already been stated.",
    );
    expect(prompt).toContain(
      "Do not let a requirement-checklist paragraph, benefits-attraction paragraph, or company-admiration paragraph outrank stronger supported evidence.",
    );
    expect(prompt).toContain(
      "For expert, make the body feel analytical and assured by using one measured sentence that explains what the supported evidence says about the role's actual demands, workflow, or operating context; keep the opening as clear role-relevant positioning rather than a bare fact inventory, and do not let the body collapse into two factual lines plus the closing invitation when more grounded material exists.",
    );
  });

  it("adds stronger non-shell signature guidance for cover-letter prompts", () => {
    const prompt = buildInlineMistralPrompt(
      { ...BASE_ARGS, voicePreset: "signature" },
      BASE_TONE,
      "Preset intent: keep the voice natural, balanced, professional, and credible. Tone traits: even pacing, moderate sentence length, clear wording, proportionate emphasis, a body that feels substantive rather than minimal, and warm professional continuity without drifting into shell phrasing. Avoid: stiffness, generic polish, salesy enthusiasm, over-produced phrasing, and stand-alone interest or discussion fragments that do not add body substance.",
      "cover_letter",
      "English",
      "Candidate background for personalization:\n- Managed incident documentation for hotel operations.\n- Background in client-facing security work across busy sites.",
      "rich",
      "",
      buildProposalWriterPlanBlock(
        {
          context_mode: "rich",
          domain_gap: "adjacent",
          credential_status: "related_not_equivalent",
          transfer_mode: "abstract_only",
          output_language: "en",
          allowed_concrete_facts: [
            "Managed incident documentation for hotel operations.",
            "Background in client-facing security work across busy sites.",
          ],
          allowed_transfer_themes: ["structured environments"],
          disallowed_claims: [],
          identity_hard_stops: [],
          proof_strategy: "concrete_supported",
          opening_strategy: "signature_default",
        },
        "cover_letter",
      ),
    );

    expect(prompt).toContain(
      "For signature, keep the body professional, warm, and concise, but do not let it feel minimal or shell-like; make the opening read like clear professional positioning, add one grounded development or employer-facing relevance sentence after the opening point when material exists, and avoid stand-alone interest, commitment, or discussion fragments that do not add body substance.",
    );
    expect(prompt).toContain(
      "The preset may change transition style, paragraph feel, and how explicitly the body carries a through-line, but it must not change the underlying evidence boundaries.",
    );
  });

  it("adds stronger preset-specific body cues for engaging and storyteller cover-letter prompts", () => {
    const engagingPrompt = buildInlineMistralPrompt(
      { ...BASE_ARGS, voicePreset: "engaging" },
      BASE_TONE,
      "Preset intent: sound warmer, more lively, and more interpersonal while staying professional. Tone traits: natural warmth, human presence, readable flow, grounded people context when supported, and restrained emotional language. Avoid: stock enthusiasm formulas.",
      "cover_letter",
      "English",
      "Candidate background for personalization:\n- Managed incident documentation for hotel operations.\n- Background in client-facing security work across busy sites.",
      "rich",
      "",
      buildProposalWriterPlanBlock(
        {
          context_mode: "rich",
          domain_gap: "adjacent",
          credential_status: "related_not_equivalent",
          transfer_mode: "abstract_only",
          output_language: "en",
          allowed_concrete_facts: [
            "Managed incident documentation for hotel operations.",
            "Background in client-facing security work across busy sites.",
          ],
          allowed_transfer_themes: ["structured environments"],
          disallowed_claims: [],
          identity_hard_stops: [],
          proof_strategy: "concrete_supported",
          opening_strategy: "engaging_people",
        },
        "cover_letter",
      ),
    );

    const storytellerPrompt = buildInlineMistralPrompt(
      { ...BASE_ARGS, voicePreset: "storyteller" },
      BASE_TONE,
      "Preset intent: improve narrative flow and make the through-line easier to follow. Tone traits: smooth continuity, lightly narrative transitions, connected movement between supported points, and a visible supported through-line. Avoid: melodrama.",
      "cover_letter",
      "English",
      "Candidate background for personalization:\n- Managed incident documentation for hotel operations.\n- Background in client-facing security work across busy sites.",
      "rich",
      "",
      buildProposalWriterPlanBlock(
        {
          context_mode: "rich",
          domain_gap: "adjacent",
          credential_status: "related_not_equivalent",
          transfer_mode: "abstract_only",
          output_language: "en",
          allowed_concrete_facts: [
            "Managed incident documentation for hotel operations.",
            "Background in client-facing security work across busy sites.",
          ],
          allowed_transfer_themes: ["structured environments"],
          disallowed_claims: [],
          identity_hard_stops: [],
          proof_strategy: "concrete_supported",
          opening_strategy: "storyteller_thread",
        },
        "cover_letter",
      ),
    );

    expect(engagingPrompt).toContain(
      "For engaging, let one grounded sentence carry people, team, guest, user, or service context when the source or job description supports it; keep the energy human rather than enthusiastic, and make that human-facing sentence still say something concrete about the day-to-day work.",
    );
    expect(engagingPrompt).toContain(
      "Let one later body sentence carry grounded people, guest, user, or collaborative context when the evidence or job description supports it.",
    );
    expect(storytellerPrompt).toContain(
      "For storyteller, keep one visible supported thread across the body from evidence or background to a concrete reason the role makes sense now; use connected transitions, fully closed sentences, and explicit sentence-to-sentence continuity rather than fragmentary narrative beats, isolated relevance fragments, or softer wording alone.",
    );
    expect(engagingPrompt).toContain(
      "The preset must not increase claim strength, readiness, contribution implication",
    );
    expect(storytellerPrompt).toContain(
      "The preset must not increase claim strength, readiness, contribution implication",
    );
  });

  it("simplifies application-message prompt layering and removes duplicated closing pressure", () => {
    const plan: ProposalPlannerResult = {
      context_mode: "rich",
      domain_gap: "adjacent",
      credential_status: "related_not_equivalent",
      transfer_mode: "abstract_only",
      output_language: "en",
      allowed_concrete_facts: [
        "Reduced theft by 73% through improved vigilance strategies.",
      ],
      allowed_transfer_themes: ["structured environments"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "signature_default",
    };

    const prompt = buildInlineMistralPrompt(
      BASE_MESSAGE_ARGS,
      BASE_TONE,
      "Preset intent: optimize for clarity and concise relevance. Behaviors: move quickly to the main point. Avoid: stock openings.",
      "application_message",
      "English",
      "Candidate background for personalization:\n- Standout achievements: Reduced theft by 73% through improved vigilance strategies.",
      "rich",
      "",
      buildProposalWriterPlanBlock(plan, "application_message"),
    );

    expect(prompt).toContain("Application-message writer brief:");
    expect(prompt).toContain(
      "Write a short recruiter-facing note that reads like a real recruiter DM, a short email body, or a teaser note.",
    );
    expect(prompt).toContain(
      "It should open the conversation with one recruiter-useful idea, not explain the whole application.",
    );
    expect(prompt).toContain(
      "Keep the three labeled lines short, natural, and connected so they render as one short paragraph.",
    );
    expect(prompt).toContain(
      "Return exactly three labeled lines and nothing else:",
    );
    expect(prompt).toContain("opener: <one short recruiter-facing sentence>");
    expect(prompt).toContain("proof_line: <one short grounded sentence>");
    expect(prompt).toContain(
      "follow_up_line: <one short same-thread continuation sentence>",
    );
    expect(prompt).toContain(
      "opener = contact context only. Name the role or contact context naturally. Do not carry proof, years, fit language, a background summary, or interest/application formulas.",
    );
    expect(prompt).toContain(
      "proof_line = the only substantive sentence. Make it one concrete micro-proof: one real thing the candidate handled, shipped, designed, supported, operated, documented, or improved or, in no-context mode, one concrete work surface from the role.",
    );
    expect(prompt).toContain(
      "proof_line should sound like one observable proof point, workflow, artifact, deliverable, employer, or operating surface, not a broad category summary, competency list, or profile summary.",
    );
    expect(prompt).toContain(
      "Preferred CV-backed proof shapes are 'At <company>, I <action> <result>.', 'I <action> at <company> <context/result>.', or 'One relevant example: <named fact>.'",
    );
    expect(prompt).toContain(
      "When supported experience is the proof, name the employer, site, project, artifact, workflow, result, or operating surface instead of hiding it behind anonymous previous-role or previous-employer setup.",
    );
    expect(prompt).toContain(
      "Keep proof_line on one named fact that clearly maps to one employer-side work surface in the posting. Do not turn it into a resume summary, category-level experience claim, background-summary claim, record-of-results slogan, generic role label, or fit/alignment shell.",
    );
    expect(prompt).toContain(
      "Do not treat a concrete but weakly related academic, research, presentation, or profile fact as strong proof unless it clearly connects to one hiring-useful work surface in the posting.",
    );
    expect(prompt).toContain(
      "follow_up_line = one short continuation of the exact same thread. Usually name the same surface, artifact, workflow, or operating context again in lighter form.",
    );
    expect(prompt).toContain(
      "Do not open a new topic, ask for a conversation, offer extra detail, point to the profile or portfolio, repeat the proof, mention reply behavior, or summarize fit, readiness, value, or future contribution.",
    );
    expect(prompt).toContain(
      "When candidate-side and employer-side priority snapshots are present, use proof_line to connect one strongest candidate proof to one strongest employer work surface, then stop.",
    );
    expect(prompt).toContain(
      "When supported proof exists, let it carry the note. Do not convert it into a résumé-summary or category-level self-description.",
    );
    expect(prompt).toContain(
      "Presets change texture only. signature = cleaner / more premium. expert = slightly sharper / more precise. engaging = slightly warmer / more human.",
    );
    expect(prompt).toContain(
      "No preset may turn the note into a self-summary, formal application note, cover-letter fragment, or profile blurb.",
    );
    expect(prompt).toContain(
      "Apply the selected preset only as surface texture:",
    );
    expect(prompt).toContain(
      "Examples below teach feel and rhythm only. Do not reuse their wording.",
    );
    expect(prompt).toContain("Application-message examples:");
    expect(prompt).toContain(
      "Good CV-backed example: 'Reaching out about the Brand Designer role. At Northline, I built launch signage kits for seasonal drops and handed clean print files to production partners on tight timelines. That production-handoff thread is the part of the posting my Northline work maps to most clearly.'",
    );
    expect(prompt).toContain(
      "Good no-context example: 'I saw the Security Guard opening at the Miami Design District store. The entrance coverage and crowd-flow side of the posting looks like the real center of the shift there. That entrance-coverage thread is the part of the role that stood out most to me.'",
    );
    expect(prompt).toContain(
      "Bad example: 'Reaching out about the Security Guard role. My work history covers retail safety, guest support, and calm communication across busy shifts. Open to connecting whenever useful.' Reason: summary-first proof plus generic recruiter close.",
    );
    expect(prompt).toContain(
      "Bad example: 'I’m reaching out about the Graphic Designer role. My design work covers print, digital, branding, and fast-moving launches. Happy to send over more whenever useful.' Reason: category summary plus detail-offer filler.",
    );
    expect(prompt).toContain(
      "Bad example: 'I saw the Security Guard opening. The role feels like a strong fit for my professional story. I would bring a calm approach to the team.' Reason: fit-summary note, not one concrete employer-side thread.",
    );
    const goodCvExample =
      "Good CV-backed example: 'Reaching out about the Brand Designer role. At Northline, I built launch signage kits for seasonal drops and handed clean print files to production partners on tight timelines. That production-handoff thread is the part of the posting my Northline work maps to most clearly.'";
    const goodNoContextExample =
      "Good no-context example: 'I saw the Security Guard opening at the Miami Design District store. The entrance coverage and crowd-flow side of the posting looks like the real center of the shift there. That entrance-coverage thread is the part of the role that stood out most to me.'";
    expect(goodCvExample).not.toMatch(
      /As a|I have experience in|I have worked as|track record|My background includes|My experience includes|My background in/i,
    );
    expect(goodNoContextExample).not.toMatch(
      /I handled|I managed|At my previous role|In my previous position|I have experience in|introduce myself|discuss further|entry point|start the conversation/i,
    );
    expect(goodCvExample).toContain("Reaching out about");
    expect(goodNoContextExample).toContain("I saw the Security Guard opening");
    expect(goodNoContextExample).toContain(
      "The entrance coverage and crowd-flow side of the posting",
    );
    for (const forbidden of [
      "At my previous role",
      "In my previous position",
      "At my previous company",
      "I have experience in",
      "My background includes",
      "My background in",
      "track record",
      "my experience aligns",
      "I'd love to discuss",
      "discuss further",
      "share more detail",
      "profile review",
      "reply or profile review",
    ]) {
      expect(prompt).not.toContain(forbidden);
    }
    expect(prompt).toContain("Unsupported claims blacklist:");
    expect(prompt).toContain("Job-description boundary rules:");
    expect(prompt).toContain("Identity and background hard-stop rules:");
    expect(prompt.indexOf("Application-message writer brief:")).toBeLessThan(
      prompt.indexOf("Unsupported claims blacklist:"),
    );
    expect(prompt.indexOf("Application-message writer brief:")).toBeLessThan(
      prompt.indexOf("Write a short recruiter-facing application message"),
    );
    expect(prompt).not.toContain("Application-message format contract:");
    expect(prompt).not.toContain("Application-message line quality guidance:");
    expect(prompt).not.toContain("Application-message contrastive examples:");
    expect(prompt).not.toContain(
      "Application-message preset texture guidance:",
    );
    expect(prompt).not.toContain("Voice preset overlay:");
    expect(prompt).not.toContain("Closing boundary:");
    expect(prompt).not.toContain("Forbidden bridge boundary:");
    expect(prompt).not.toContain("Source-backed specificity rules:");
    expect(prompt).not.toContain("Specificity contrast example:");
    expect(prompt).not.toContain("JD-only contrast example:");
    expect(prompt).not.toContain("Identity/domain contrast example:");
    expect(prompt).not.toContain(
      "the clearest place for me to start the conversation",
    );
    expect(prompt).not.toContain("entry point");
    expect(prompt).not.toContain("start the conversation");
  });

  it("adds employer-priority structure to application-message prompts instead of flattening checklist-heavy job text", () => {
    const prompt = buildInlineMistralPrompt(
      {
        jobTitle: "Facilities Support Coordinator",
        jobDescription:
          "Coordinate maintenance requests, schedule vendors, update service records, manage Excel trackers, answer emails, support Word documentation, stay flexible, and be ready to help across office operations. Candidates should be organized, reliable, adaptable, willing to learn, and comfortable with Windows, Microsoft Word, Microsoft Excel, and general administrative support.",
        proposalType: "application_message",
      },
      BASE_TONE,
      "Preset intent: keep the voice direct and human. Behaviors: stay concise and grounded. Avoid: generic checklist paraphrases.",
      "application_message",
      "English",
      "",
      "none",
      "No candidate background is available for this request.",
      buildProposalWriterPlanBlock(
        {
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
        },
        "application_message",
      ),
    );

    expect(prompt).toContain("Application-message employer priority snapshot:");
    expect(prompt).toContain(
      "strongest_work_surfaces: update service records.",
    );
    expect(prompt).toContain("schedule vendors.");
    expect(prompt).toContain("update service records.");
    expect(prompt).toContain("lower_value_checklist_demoted:");
    expect(prompt).toMatch(
      /organized|reliable|adaptable|Microsoft Word|Microsoft Excel|Windows/i,
    );
    expect(prompt).toContain(
      "Do not lead with preferred_requirements_nonleading, lower_value_checklist_demoted, or low_signal_employer_text_ignore when stronger work surfaces exist.",
    );
    expect(prompt).toContain(
      "choose one or two strongest_work_surfaces instead of flattening the whole posting into a checklist summary.",
    );
  });

  it("keeps no-context application messages grounded instead of strict interest-first", () => {
    const prompt = buildInlineMistralPrompt(
      BASE_MESSAGE_ARGS,
      BASE_TONE,
      "Preset intent: keep the voice natural and balanced. Behaviors: use clean active phrasing. Avoid: stock enthusiasm.",
      "application_message",
      "English",
      "",
      "none",
      "No candidate background is available for this request.",
      buildProposalWriterPlanBlock(
        {
          context_mode: "none",
          domain_gap: "distant",
          credential_status: "unsupported",
          transfer_mode: "no_operational_analogy",
          output_language: "en",
          allowed_concrete_facts: [],
          allowed_transfer_themes: ["company-specific motivation"],
          disallowed_claims: [],
          identity_hard_stops: [],
          proof_strategy: "none",
          opening_strategy: "signature_default",
        },
        "application_message",
      ),
    );

    expect(prompt).toContain(
      "In no-context mode, use one honest pattern: opener names the role or contact context, proof_line names one concrete work surface, artifact, deliverable, operating context, or coordination thread from the posting, and follow_up_line stays lightly on that same surface.",
    );
    expect(prompt).toContain(
      "In no-context mode, stay honest and non-claiming: keep the note on one concrete surface from the job description with no past execution, no pseudo-proof, no self-introduction, and no profile summary.",
    );
    expect(prompt).toContain(
      "In no-context mode, keep proof_line on one concrete surface from the posting itself, not a restated checklist or a softened summary of the full job description.",
    );
    expect(prompt).toContain(
      "In no-context mode, do not use past-execution verbs in proof_line or follow_up_line unless the note is actually source-backed and not running in no-context mode.",
    );
    expect(prompt).toContain(
      "In no-context mode, keep follow_up_line tied to that same surface without turning it into a recruiter close, detail offer, candidate-summary line, or meta note about introducing yourself.",
    );
    expect(prompt).toContain(
      "In no-context mode, signature, expert, and engaging all inherit the same honest base note; only the surface texture changes.",
    );
    expect(prompt).toContain(
      "If context_mode is none, use opener for the role contact context, proof for one concrete work surface, operating context, artifact, deliverable, or coordination thread from the job description, and follow_up_line for one short continuation that stays on that same thread.",
    );
    expect(prompt).toContain(
      "If context_mode is none, keep the proof on one concrete surface from the posting itself rather than turning the note into a role summary or compressed job-description paraphrase.",
    );
    expect(prompt).toContain(
      "If context_mode is none, do not connect the lines with past-experience summary wording, background-summary wording, prior-role narration, self-introduction, or recruiter-close filler.",
    );
    expect(prompt).toContain(
      "After the work-surface anchor, the only allowed continuation is one short sentence that stays on that same named surface and makes the note more concrete, such as 'That entrance-coverage thread is the part of the role that stood out most to me.' or 'That records-and-handoff side of the posting is the part of the work that caught me first.' Do not shift into candidate history, past-execution verbs, self-introduction, fit summary, detail offers, profile or portfolio invitations, or recruiter-close filler.",
    );
    expect(prompt).toContain("Application-message no-context safety:");
    expect(prompt).toContain(
      "Let at most one sentence rely mainly on personal-interest framing; keep any later sentence on concrete work context, workflow, operating context, or team interaction from the job description.",
    );
    expect(prompt).toContain(
      "Do not turn job-description tasks into prior candidate experience or future operational capability.",
    );
    expect(prompt).not.toContain("In no-context cover-letter mode");
    expect(prompt).not.toContain("one brief discussion-forward close");
    expect(prompt).not.toContain(
      "After the evidence anchor, the only allowed bridge is one cautious relevance sentence such as 'relevant to', 'background in', 'experience in', 'may offer relevant perspective'.",
    );
    expect(prompt).not.toContain(
      "the clearest place for me to start the conversation",
    );
    expect(prompt).not.toContain("entry point");
    expect(prompt).not.toContain("start the conversation");
    for (const forbidden of [
      "At my previous role",
      "In my previous position",
      "At my previous company",
      "I have experience in",
      "background in",
      "introduce myself",
      "I'd love to discuss",
      "discuss further",
      "share more detail",
      "profile review",
      "reply or profile review",
    ]) {
      expect(prompt).not.toContain(forbidden);
    }
  });

  it("keeps freelance no-context guidance format-specific instead of using application-intro framing", () => {
    const prompt = buildInlineMistralPrompt(
      {
        jobTitle: "Landing Page Copy Refresh",
        jobDescription:
          "Revise a SaaS landing page, tighten the messaging hierarchy, and align copy with the current product positioning.",
        proposalType: "freelance_proposal",
      },
      BASE_TONE,
      "Preset intent: sound balanced and credible. Tone traits: even pacing and clear wording. Avoid: salesy language.",
      "freelance_proposal",
      "English",
      "",
      "none",
      "No candidate background is available for this request.",
      buildProposalWriterPlanBlock(
        {
          context_mode: "none",
          domain_gap: "distant",
          credential_status: "unsupported",
          transfer_mode: "no_operational_analogy",
          output_language: "en",
          allowed_concrete_facts: [],
          allowed_transfer_themes: ["project understanding"],
          disallowed_claims: [],
          identity_hard_stops: [],
          proof_strategy: "none",
          opening_strategy: "signature_default",
        },
        "freelance_proposal",
      ),
    );

    expect(prompt).toContain("Return only the raw proposal body.");
    expect(prompt).toContain(
      "write a cautious project proposal grounded in the client's described work",
    );
    expect(prompt).not.toContain("strict interest-first application intro");
    expect(prompt).not.toContain("polite closing");
  });

  it("renders deterministic salutation and closing behavior by preset and language", () => {
    expect(
      getDeterministicProposalRenderPolicy({
        format: "cover_letter",
        outputLanguage: "English",
        voicePreset: "signature",
        noContextMode: false,
      }),
    ).toMatchObject({
      salutation: "Dear Hiring Manager,",
      signOff: "Sincerely,",
      finalSentence:
        "I would welcome the opportunity to discuss the position further.",
      includeCandidateNameLine: true,
    });

    expect(
      getDeterministicProposalRenderPolicy({
        format: "cover_letter",
        outputLanguage: "French",
        voicePreset: "expert",
        noContextMode: false,
      }),
    ).toMatchObject({
      salutation: "Madame, Monsieur,",
      signOff:
        "Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
      finalSentence: "Je serais disponible pour discuter davantage du poste.",
      includeCandidateNameLine: true,
    });
  });

  it("suppresses meta output and future-value closings before final cover-letter render", () => {
    expect(() =>
      finalizeProposalForSave({
        content: [
          "Here’s a concise, interest-led cover letter for the role.",
          "",
          "My background may offer relevant perspective for this position.",
          "",
          "I’d welcome the opportunity to discuss how my skills could support your team.",
          "",
          "Sincerely,",
          "Board Ramanathapuram.",
        ].join("\n"),
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: "Board Ramanathapuram",
        voicePreset: "direct",
        noContextMode: false,
      }),
    ).toThrow(/repeated body content|substantive body content/i);
  });

  it("rescues cv-backed grounded cover letters by dropping extra non-grounded cleanup residue", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "Dear Hiring Manager,",
        "",
        "I am writing to apply for the Building Security Guard position with Travis County. I am a safety-conscious and attentive Security Guard with eight years of experience protecting people, property, and facilities, including work in military and defense-related environments. I am interested in this full-time role because it aligns well with my background in access control, patrol procedures, visitor assistance, CCTV monitoring, safety compliance, and professional response to security concerns.",
        "",
        "In my recent security roles with ADT Security and Copwatch, I have been responsible for maintaining safe environments by monitoring grounds, equipment controls, and selected areas through CCTV and smart-device applications. I have also conducted regular checks, logged in with security headquarters on required schedules, inspected restrooms and facility areas after closing for vagrants or unauthorized personnel, and reported concerns according to procedure.",
        "",
        "I understand that a Building Security Guard for Travis County serves as a first point of contact for employees, officials, and visitors. I am comfortable providing directions, assisting the public, signing visitors in and out, escorting individuals when needed, and maintaining a positive and respectful presence. My background has strengthened my ability to observe surroundings carefully, identify suspicious activity, communicate effectively, and support a secure and welcoming environment.",
        "",
        "I am also prepared for the physical and schedule requirements of this position, including standing and walking for long periods, conducting foot and vehicle patrols, working outdoors in varying conditions, and being flexible for AM, PM, overnight, weekend, and holiday shifts. I understand the importance of securing doors and windows, monitoring camera and door-lock systems, checking for maintenance concerns such as leaks, equipment issues, vandalism, or lighting problems, and reporting deficiencies to the proper authority.",
        "",
        "My skills in investigation, safety compliance, criminal justice knowledge, and physical security support my ability to respond appropriately to rule violations, emergencies, and questionable activities. I take instructions seriously, work independently and efficiently, and value strong working relationships with employees, officials, and the public. I am willing to complete required training and maintain the clearances, certifications, and standards required by the Department, including CJIS security clearance and a valid Texas Driver's License if selected.",
        "",
        "I would welcome the opportunity to contribute my experience, reliability, and commitment to safety to the Travis County Office of Security and Protection. Thank you for your time and consideration.",
        "",
        "Sincerely,",
        "Robert Cooper",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "expert",
      noContextMode: false,
      requiresCandidateEvidence: true,
    });

    expect(saved).toContain("I have also conducted regular checks");
    expect(saved).toContain(
      "I understand the importance of securing doors and windows",
    );
    expect(saved).not.toContain("Thank you for your time and consideration.");
  });

  it("rejects job-summary-only cover letters when CV-backed candidate context exists", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "Dear Hiring Manager,",
          "",
          "The High Level Security Officer role at Securitas Security centers on maintaining site safety through structured patrols, access control, and incident response—work that requires both vigilance and clear communication. The position’s emphasis on detailed reporting and team coordination ensures that security protocols are consistently applied, whether managing key checkouts, documenting observations, or escalating issues to the operations center.",
          "",
          "What stands out is the balance between independent judgment during patrols and collaboration with colleagues to meet daily site goals. The requirement to interact professionally with employees and guests while remaining alert to potential hazards reflects a role where both technical precision and interpersonal adaptability matter.",
          "",
          "I would welcome the chance to discuss my interest in the role.",
          "",
          "Kind regards,",
        ].join("\n"),
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: "Robert Cooper",
        voicePreset: "expert",
        noContextMode: false,
        requiresCandidateEvidence: true,
      }),
    ).toThrow(/candidate-backed evidence/i);
  });

  it("accepts duration-led first-person CV evidence during premium finalization", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "Dear Hiring Manager,",
        "",
        "For eight years, I’ve maintained security and vigilance in high-stakes environments by documenting conditions, following post orders, and communicating deviations through established reporting routines.",
        "",
        "That operational habit is relevant to roles that require routine patrols, accurate logs, and calm communication during each shift.",
        "",
        "I would be glad to discuss the position further.",
        "",
        "Sincerely,",
        "Robert Cooper",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "signature",
      noContextMode: false,
      requiresCandidateEvidence: true,
    });

    expect(saved).toContain("For eight years");
    expect(saved).toContain("routine patrols");
  });

  it("accepts Janice Walton premium body evidence through structural finalization", () => {
    const trace = inspectProposalFinalization({
      content: [
        "Dear Hiring Manager,",
        "",
        "I bring luxury client service experience from work where greeting and assessing clients was tied to careful attention to requested alterations.",
        "",
        "My garment alteration work included sewing and altering items to specifications, with finish quality checked against what each client requested.",
        "",
        "I also met a 99% deadline standard by coordinating requested alterations and keeping follow-through clear before the final handoff.",
        "",
        "I would be glad to discuss the position further.",
        "",
        "Sincerely,",
        "Janice Walton",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Janice Walton",
      voicePreset: "signature",
      noContextMode: false,
      requiresCandidateEvidence: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.finalOutput).toContain("garment alteration work");
    expect(trace.finalOutput).toContain("99% deadline standard");
    expect(trace.cleanedBodySelection.selectedBody).not.toBeNull();
  });

  it("accepts compact ADT/Copwatch security evidence during premium finalization", () => {
    const saved = finalizePremiumCoverLetterPayloadForPersistence({
      payload: {
        content: [
          "Dear Hiring Manager,",
          "",
          "I bring eight years of safety-conscious, attentive security experience protecting and guarding VIP individuals in military and defense settings, with Security Guard roles at ADT Security and Copwatch.",
          "",
          "My security background is grounded in careful reporting: completing reports by recording information, observations, occurrences, and surveillance activity.",
          "",
          "For an airport post where presence, routine patrols, customer service, and clear communication support a secure environment, my security background would help provide steady attention and reliable reporting for the people who depend on that post being handled carefully.",
          "",
          "I would be glad to discuss the position further.",
          "",
          "Sincerely,",
        ].join("\n"),
        sections: [] as Array<{ type: "text"; content: string }>,
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "signature",
      hasCandidateContext: true,
    }).content;

    expect(saved).toContain("I bring eight years");
    expect(saved).toContain("ADT Security and Copwatch");
    expect(saved).toContain("completing reports by recording information");
  });

  it("accepts responsibility-led CV evidence during premium finalization", () => {
    const saved = finalizePremiumCoverLetterPayloadForPersistence({
      payload: {
        content: [
          "Dear Hiring Manager,",
          "",
          "My strongest match for the High Level Security Officer role is hands-on security reporting: at ADT Security, my responsibilities included completing reports by recording information, observations, occurrences, and surveillance activity.",
          "",
          "I bring eight years of security guard experience protecting and guarding VIP individuals in military and defense settings, with Security Guard roles at ADT Security and Copwatch.",
          "",
          "In a Securitas environment with Region and Area Management Support Staff, that combination of field security experience and careful reporting would help keep communication clear for the people supporting the site and the officers on duty.",
          "",
          "I would be glad to discuss the position further.",
          "",
          "Sincerely,",
        ].join("\n"),
        sections: [] as Array<{ type: "text"; content: string }>,
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "signature",
      hasCandidateContext: true,
    }).content;

    expect(saved).toContain("responsibilities included completing reports");
    expect(saved).toContain("eight years of security guard experience");
  });

  it("reports premium quality shadow against the finalized saved cover letter", () => {
    const saved = finalizePremiumCoverLetterPayloadForPersistence({
      payload: {
        content: [
          "Dear Hiring Manager,",
          "",
          "I delivered luxury client service by warmly greeting and engaging clients, with attention to individual needs and brand standards.",
          "",
          "In garment work, I sewed and altered pieces to required specifications while meeting 99% of deadlines, and kept requested alterations moving within specified timelines and high quality standards.",
          "",
          "That mix of client service, organizational care, and deadline discipline is relevant to a store setting where sales goals depend on effective execution of daily operational tasks.",
          "",
          "I would be glad to discuss the position further.",
          "",
          "Sincerely,",
        ].join("\n"),
        sections: [] as Array<{ type: "text"; content: string }>,
        bodyParts: {
          opening:
            "I delivered luxury client service by warmly greeting and engaging clients, with attention to individual needs and brand standards.",
          proofBlock:
            "In garment work, I sewed and altered pieces to required specifications while meeting 99% of deadlines, and kept requested alterations moving within specified timelines and high quality standards.",
          employerValueBlock:
            "That mix of client service, organizational care, and deadline discipline is relevant to a store setting where sales goals depend on effective execution of daily operational tasks.",
          closeLine: "I can bring that same discipline to the store team.",
        },
        qualityShadow: {
          passed: true,
          score: 100,
          issues: [],
        },
      },
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Janice Walton",
      voicePreset: "signature",
      hasCandidateContext: true,
    });

    expect(saved.content).toContain(
      "I would be glad to discuss the position further.",
    );
    expect(saved.qualityShadow?.passed).toBe(false);
    expect(saved.qualityShadow?.issues).toContain("generic_tone");
  });

  it("applies the same candidate-evidence guard to premium persistence payloads", () => {
    const badPremiumPayload = {
      content: [
        "Dear Hiring Manager,",
        "",
        "The High Level Security Officer role at Securitas Security centers on maintaining site safety through structured patrols, access control, and incident response—work that requires both vigilance and clear communication. The position’s emphasis on detailed reporting and team coordination ensures that security protocols are consistently applied, whether managing key checkouts, documenting observations, or escalating issues to the operations center.",
        "",
        "What stands out is the balance between independent judgment during patrols and collaboration with colleagues to meet daily site goals. The requirement to interact professionally with employees and guests while remaining alert to potential hazards reflects a role where both technical precision and interpersonal adaptability matter.",
        "",
        "I would welcome the chance to discuss my interest in the role.",
        "",
        "Kind regards,",
      ].join("\n"),
      sections: [] as Array<{ type: "text"; content: string }>,
    };

    expect(() =>
      finalizePremiumCoverLetterPayloadForPersistence({
        payload: badPremiumPayload,
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: "Robert Cooper",
        voicePreset: "expert",
        hasCandidateContext: true,
      }),
    ).toThrow(/candidate-backed evidence/i);
  });

  it("fails closed on the ADT/Copwatch legacy fallback fragment with duplicate close", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "In my recent security roles with ADT Security and Copwatch, I have been responsible for maintaining safe environments by monitoring grounds and selected areas through CCTV and smart-device applications.",
          "",
          "My experience, combined with investigation skills, safety compliance knowledge, criminal justice knowledge, and physical security training.",
          "",
          "I would be glad to discuss the position further.",
          "",
          "I would be glad to discuss the position further.",
        ].join("\n"),
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: "Robert Cooper",
        voicePreset: "engaging",
        noContextMode: false,
        requiresCandidateEvidence: true,
      }),
    ).toThrow(/repeated body content|substantive body content/i);
  });

  it("fails closed when a cover letter repeats the salutation and opening body", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "Dear Hiring Manager,",
          "",
          "Eight years of focused security work protecting people in high-stakes environments has sharpened my ability to assess risks before they escalate. At ADT Security, I maintained surveillance protocols and reported updates on a fixed cadence.",
          "",
          "Dear Hiring Manager,",
          "",
          "Eight years of focused security work protecting people in high-stakes environments has sharpened my ability to assess risks before they escalate. At ADT Security, I maintained surveillance protocols and reported updates on a fixed cadence.",
          "",
          "At Copwatch, I scanned grounds for out-of-place items and monitored CCTV feeds.",
          "",
          "I would be glad to discuss the position further.",
          "",
          "Warm regards,",
        ].join("\n"),
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: "Robert Cooper",
        voicePreset: "signature",
        noContextMode: false,
        requiresCandidateEvidence: true,
      }),
    ).toThrow(/repeated/i);
  });

  it("fails closed when body content repeats after a cover-letter sign-off", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "Dear Hiring Manager,",
          "",
          "Eight years of focused security work protecting people in high-stakes environments has sharpened my ability to assess risks before they escalate. At ADT Security, I maintained surveillance protocols and reported updates on a fixed cadence.",
          "",
          "At Copwatch, I scanned grounds for out-of-place items and monitored CCTV feeds.",
          "",
          "I would be glad to discuss the position further.",
          "",
          "Warm regards,",
          "",
          "At Copwatch, I scanned grounds for out-of-place items and monitored CCTV feeds.",
          "",
          "I would be glad to discuss the position further.",
          "",
          "Warm regards,",
        ].join("\n"),
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: "Robert Cooper",
        voicePreset: "signature",
        noContextMode: false,
        requiresCandidateEvidence: true,
      }),
    ).toThrow(/repeated/i);
  });

  it("fails closed on malformed trailing noun fragments in cv-backed cover letters", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "Dear Hiring Manager,",
          "",
          "Eight years of focused security work protecting people in high-stakes environments has sharpened my ability to assess risks before they escalate.",
          "",
          "At Copwatch, I scanned grounds for out-of-place items and monitored CCTV feeds, experience.",
          "",
          "I would be glad to discuss the position further.",
          "",
          "Warm regards,",
        ].join("\n"),
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: "Robert Cooper",
        voicePreset: "signature",
        noContextMode: false,
        requiresCandidateEvidence: true,
      }),
    ).toThrow(/fragment|substantive body content|candidate-backed evidence/i);
  });

  it("fails closed for application-message shells that only survive as one weak sentence plus the local follow-up", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "The following letter is below.",
          "",
          "My experience includes work in related environments.",
          "",
          "I’d welcome the opportunity to discuss how my skills could support your team.",
          "",
          "Kind regards,",
          "Board Ramanathapuram",
        ].join("\n"),
        format: "application_message",
        outputLanguage: "English",
        candidateName: "Board Ramanathapuram",
        voicePreset: "signature",
        noContextMode: true,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("renders structured application-message parts into one short recruiter-facing paragraph", () => {
    const rendered = finalizeProposalForSave({
      content: [
        "opener: I’m reaching out about the Customer Support Specialist role because the day-to-day email and chat work is familiar ground for me.",
        "proof_line: At CloudLane, I handled daily chat and email queues and documented recurring issues into internal help content.",
        "follow_up_line: That queue-and-documentation thread is the part of the role my CloudLane work maps to most directly.",
      ].join("\n"),
      format: "application_message",
      outputLanguage: "English",
      candidateName: "Marie Lopez",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(rendered).toBe(
      "I’m reaching out about the Customer Support Specialist role because the day-to-day email and chat work is familiar ground for me. At CloudLane, I handled daily chat and email queues and documented recurring issues into internal help content. That queue-and-documentation thread is the part of the role my CloudLane work maps to most directly.",
    );
    expect(rendered).not.toContain("opener:");
    expect(rendered).not.toContain("proof_line:");
    expect(rendered).not.toContain("follow_up_line:");
  });

  it("does not treat structured fact-dump application-message parts plus a filler CTA as saveable output", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "opener: I’ve worked on maintaining computers, classroom equipment, and printers on campus.",
          "proof_line: I wrote an 8-page paper and gave multiple presentations on-campus.",
          "follow_up_line: If useful, I can share a bit more detail.",
        ].join("\n"),
        format: "application_message",
        outputLanguage: "English",
        voicePreset: "direct",
        noContextMode: false,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("rescues a structured application message when the opener is invalid but the proof and recruiter CTA are saveable", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "opener: I have 3 years of experience as a Security Guard and have managed crowds and ensured safety in a retail environment.",
        "proof_line: At Robert Cooper Security Guard, I reduced unauthorized entry by 26% through tighter access control.",
        "follow_up_line: Open to pointing you to the closest security example if helpful.",
      ].join("\n"),
      format: "application_message",
      outputLanguage: "English",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(saved).toBe(
      "At Robert Cooper Security Guard, I reduced unauthorized entry by 26% through tighter access control. Open to pointing you to the closest security example if helpful.",
    );
    expect(saved).not.toContain("I have 3 years of experience");
  });

  it("does not reinsert the deterministic filler when a structured application message loses both opener and follow-up", () => {
    const args = {
      content: [
        "opener: I'm interested in the Security Guard role and wanted to reach out.",
        "proof_line: At Robert Cooper Security Guard, I reduced unauthorized entry by 26% through tighter access control.",
        "follow_up_line: If useful, I can share a bit more detail.",
      ].join("\n"),
      format: "application_message",
      outputLanguage: "English",
      voicePreset: "direct",
      noContextMode: false,
    } as const;

    expect(() => finalizeProposalForPersistence(args)).toThrow(
      /substantive body content/i,
    );

    const trace = inspectProposalFinalization(args);
    expect(trace.errorMessage).toMatch(/substantive body content/i);
    expect(trace.deterministicBoundaryApplication?.content ?? "").not.toContain(
      "If useful, I can share a bit more detail.",
    );
    expect(trace.finalOutput ?? "").not.toContain(
      "If useful, I can share a bit more detail.",
    );
  });

  it("keeps the recovered proof line even when the invalid opener overlaps with the same underlying fact", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "opener: I have experience in security monitoring and access control work across store entrances.",
        "proof_line: At Robert Cooper Security Guard, I reduced unauthorized entry by 26% through tighter access control.",
        "follow_up_line: Open to pointing you to the closest security example if helpful.",
      ].join("\n"),
      format: "application_message",
      outputLanguage: "English",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(saved).toContain(
      "At Robert Cooper Security Guard, I reduced unauthorized entry by 26% through tighter access control.",
    );
    expect(saved).not.toContain(
      "I have experience in security monitoring and access control work across store entrances.",
    );
  });

  it("still fails closed for requirement-echo proof lines that mirror years and license requirements", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "opener: I’m interested in the Security Guard role and wanted to reach out.",
          "proof_line: With 0-3 years of security experience and a valid State Security Guard License, I meet the requirements for the role.",
          "follow_up_line: Open to sharing the closest example if helpful.",
        ].join("\n"),
        format: "application_message",
        outputLanguage: "English",
        voicePreset: "direct",
        noContextMode: false,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("fails closed for no-context fabricated prior-experience proof lines even when the opener is otherwise grounded", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "opener: I’m reaching out about the Security Guard role because entrance control and crowd flow are the parts of the work I’d want to stay close to.",
          "proof_line: At my previous position, I effectively managed crowds, performed security checks, and de-escalated conflicts during busy retail hours.",
          "follow_up_line: Open to sharing why that side of the role is the entry point for me.",
        ].join("\n"),
        format: "application_message",
        outputLanguage: "English",
        voicePreset: "direct",
        noContextMode: true,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("does not rescue no-context fabricated prior-experience proof lines when the opener is invalid", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "opener: I am interested in the Security Guard position.",
          "proof_line: At my previous position, I effectively managed crowds, performed security checks, and de-escalated conflicts during busy retail hours.",
          "follow_up_line: Open to sharing why that side of the role is the entry point for me.",
        ].join("\n"),
        format: "application_message",
        outputLanguage: "English",
        voicePreset: "direct",
        noContextMode: true,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("still allows no-context application messages grounded in one work surface without invented prior experience", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "opener: I’m reaching out about the Security Guard role because entrance control and crowd flow are the parts of the work I’d want to stay close to.",
        "proof_line: The entrance-monitoring and crowd-flow side of the role is the clearest place for me to start the conversation here.",
        "follow_up_line: Open to sharing why that side of the role is the entry point for me.",
      ].join("\n"),
      format: "application_message",
      outputLanguage: "English",
      voicePreset: "direct",
      noContextMode: true,
    });

    expect(saved).toBe(
      "I’m reaching out about the Security Guard role because entrance control and crowd flow are the parts of the work I’d want to stay close to. The entrance-monitoring and crowd-flow side of the role is the clearest place for me to start the conversation here. Open to sharing why that side of the role is the entry point for me.",
    );
    expect(saved).not.toContain("At my previous position");
  });

  it("fails closed for anonymous prior-role proof lines that read like recruiter-note weak resume summary even when concrete", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "opener: I’m reaching out about the Security Guard role because entrance control and crowd flow are the parts of the work I’d want to stay close to.",
          "proof_line: At my previous role in Los Angeles, I effectively managed lines and ensured the safety of both guests and team members during product releases and store operations.",
          "follow_up_line: Open to sharing the closest security example if helpful.",
        ].join("\n"),
        format: "application_message",
        outputLanguage: "English",
        voicePreset: "signature",
        noContextMode: false,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("fails closed for self-labeled professional-summary proof lines even when they mention concrete tasks", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "opener: I’m reaching out about the Security Guard role because entrance control and crowd flow are the parts of the work I’d want to stay close to.",
          "proof_line: As a security professional, I have experience in managing lines and crowds, ensuring the safety of guests, and monitoring entrances.",
          "follow_up_line: Open to sharing the closest security example if helpful.",
        ].join("\n"),
        format: "application_message",
        outputLanguage: "English",
        voicePreset: "signature",
        noContextMode: false,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("fails closed for generic follow-up lines that offer more about my experience instead of continuing the same example", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "opener: I’m reaching out about the Security Guard role because entrance control and crowd flow are the parts of the work I’d want to stay close to.",
          "proof_line: At Robert Cooper Security Guard, I reduced unauthorized entry by 26% through tighter access control.",
          "follow_up_line: Open to sharing more details about my experience if helpful.",
        ].join("\n"),
        format: "application_message",
        outputLanguage: "English",
        voicePreset: "signature",
        noContextMode: false,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("records rejection reason tags for resume-summary opener, previous-role proof, and filler follow-up", () => {
    const trace = inspectProposalFinalization({
      content: [
        "opener: I have 3 years of experience as a Security Guard in Los Angeles, CA.",
        "proof_line: At my previous role in Los Angeles, I managed crowds and monitored entrances to ensure the safety of both guests and team members.",
        "follow_up_line: I'd love to discuss how my experience could contribute to the safety and operations at Kith.",
      ].join("\n"),
      format: "application_message",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(trace.applicationMessageRejectionReasons).toEqual(
      expect.arrayContaining([
        "resume_summary_opener",
        "previous_role_proof",
        "filler_follow_up",
      ]),
    );
    expect(trace.errorMessage).toMatch(/substantive body content/i);
  });

  it("records rejection reason tags for profile-summary proof lines", () => {
    const trace = inspectProposalFinalization({
      content: [
        "opener: I’m reaching out about the Graphic Designer role for the Brand Studio team.",
        "proof_line: I have a proven track record of executing high-quality designs using Adobe Suite assets.",
        "follow_up_line: I’d be happy to discuss how my experience aligns with the needs of your team in more detail.",
      ].join("\n"),
      format: "application_message",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(trace.applicationMessageRejectionReasons).toEqual(
      expect.arrayContaining(["profile_summary_proof", "filler_follow_up"]),
    );
    expect(trace.errorMessage).toMatch(/substantive body content/i);
  });

  it.each([
    {
      label: "generic proof shell",
      content: [
        "opener: I’m reaching out about the Security Guard role because entrance control and crowd coverage are the parts of the work I know best.",
        "proof_line: My experience in customer-facing environments and ability to effectively communicate with both internal and external customers make me well-suited for this role.",
        "follow_up_line: Open to sharing the closest shift example if helpful.",
      ].join("\n"),
      noContextMode: false,
    },
    {
      label: "no-context abstract attraction",
      content: [
        "opener: I’m focused on embedded systems work where Rust and Linux converge.",
        "proof_line: The role's focus on real-time multithreaded embedded software in Rust and long lifecycle maintenance draws my attention.",
        "follow_up_line: Open to sharing why that operating context is the part I'd want to stay close to.",
      ].join("\n"),
      noContextMode: true,
    },
    {
      label: "malformed discussion fragment follow-up",
      content: [
        "opener: I’m reaching out about the Security Guard role because entrance control and crowd coverage are the parts of the work I’d want to stay close to.",
        "proof_line: The entrance-monitoring and crowd-flow side of the role is the clearest place for me to start the conversation here.",
        "follow_up_line: I would be happy to discuss how my skills and experience.",
      ].join("\n"),
      noContextMode: true,
    },
  ])(
    "rejects semantically weak structured application-message parts: $label",
    ({ content, noContextMode }) => {
      expect(() =>
        finalizeProposalForPersistence({
          content,
          format: "application_message",
          outputLanguage: "English",
          voicePreset: "direct",
          noContextMode,
        }),
      ).toThrow(/substantive body content/i);
    },
  );

  it("still fails closed when a structured application message has an invalid opener and an invalid proof line", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "opener: I’m interested in the Security Guard role and wanted to reach out.",
          "proof_line: My experience in customer-facing environments and ability to effectively communicate with both internal and external customers make me well-suited for this role.",
          "follow_up_line: Open to sharing the closest shift example if helpful.",
        ].join("\n"),
        format: "application_message",
        outputLanguage: "English",
        voicePreset: "direct",
        noContextMode: false,
      }),
    ).toThrow(/substantive body content/i);
  });

  it.each([
    {
      label: "year-led freeform summary",
      content:
        "I have 3 years of experience as a Security Guard and have managed crowds and provided safety support in a retail environment.",
      noContextMode: false,
    },
    {
      label: "application-letter no-context paragraph",
      content: [
        "I am interested in the Security Guard position at the Miami Design District store.",
        "My experience in customer-facing environments and ability to effectively communicate with both internal and external customers make me well-suited for this role.",
        "I would welcome the opportunity to discuss my interest in this position further.",
      ].join(" "),
      noContextMode: true,
    },
  ])(
    "fails closed for semantically weak freeform application-message output: $label",
    ({ content, noContextMode }) => {
      expect(() =>
        finalizeProposalForPersistence({
          content,
          format: "application_message",
          outputLanguage: "English",
          voicePreset: "direct",
          noContextMode,
        }),
      ).toThrow(/substantive body content/i);
    },
  );

  it("fails closed when application-message cleanup leaves only one factual sentence plus the local filler line", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "Hi there,",
          "",
          "I handled daily chat and email support for SaaS customers and documented recurring issues into internal help content.",
          "I am a talented support professional.",
          "Thank you for considering my application.",
          "",
          "Best",
        ].join("\n"),
        format: "application_message",
        outputLanguage: "English",
        candidateName: "Board Ramanathapuram",
        voicePreset: "signature",
        noContextMode: false,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("normalizes stacked sign-offs before deterministic cover-letter rendering", () => {
    const rendered = finalizeProposalForPersistence({
      content: [
        "I monitored electrical installations and coordinated with project teams on compliance reviews.",
        "",
        "I also worked with multidisciplinary teams to keep documentation aligned with project requirements.",
        "",
        "Best regards,Kind regards,",
        "Sadath Basha.a.m",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Sadath Basha.a.m",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(rendered).toContain("Sincerely,\nSadath Basha.a.m");
    expect(rendered).not.toContain("Best regards,Kind regards,");
    expect(rendered).not.toContain("Best regards,");
    expect(rendered).not.toContain("Kind regards,");
  });

  it("selects the surviving conservative candidate when aggressive legacy cleanup would collapse a valid cover letter", () => {
    const trace = inspectProposalFinalization({
      content: [
        "Developed construction-ready AutoCAD drawings and reviewed project documentation, which aligns with your need for precise documentation and stakeholder coordination.",
        "",
        "I also coordinated multidisciplinary compliance reviews for MEP project teams.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Sadath Basha.a.m",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(trace.cleanedBodySelection.aggressive.isSaveable).toBe(false);
    expect(trace.cleanedBodySelection.conservative.isSaveable).toBe(true);
    expect(trace.cleanedBodySelection.selectedCandidate).toBe("conservative");
    expect(trace.failureStage).toBeUndefined();
    expect(trace.finalOutput).toContain(
      "Developed construction-ready AutoCAD drawings and reviewed project documentation.",
    );
    expect(trace.finalOutput).toContain(
      "I also coordinated multidisciplinary compliance reviews for MEP project teams.",
    );
    expect(trace.finalOutput).not.toContain("aligns with your need for");
  });

  it("fails closed when a cover letter collapses to saved-output bridges only", () => {
    expect(() =>
      finalizeProposalForSave({
        content: [
          "My background may offer relevant perspective for this position.",
          "",
          "My experience aligns with the responsibilities you've outlined.",
        ].join("\n"),
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: "Board Ramanathapuram",
        voicePreset: "direct",
        noContextMode: false,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("reports cleaned-body selection as the collapse stage for a true empty-shell cover letter", () => {
    const trace = inspectProposalFinalization({
      content: [
        "Dear Hiring Manager,",
        "",
        "I would welcome the opportunity to discuss the position further.",
        "",
        "Sincerely,",
        "Board Ramanathapuram",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Board Ramanathapuram",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(trace.failureStage).toBe("cleaned_body_selection");
    expect(trace.cleanedBodySelection.selectedCandidate).toBeNull();
    expect(trace.errorMessage).toMatch(
      /Cleanup removed all substantive body content/,
    );
  });

  it("fails closed when saved-output bridge cleanup would otherwise collapse an application message to filler only", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "My background may offer relevant perspective for this role.",
          "",
          "My experience aligns with your emphasis on calm communication.",
        ].join("\n"),
        format: "application_message",
        outputLanguage: "English",
        candidateName: "Board Ramanathapuram",
        voicePreset: "signature",
        noContextMode: false,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("guards finalized freelance proposals without stripping unrelated project-alignment wording", () => {
    const saved = applyFinalSavedOutputBridgeGuard({
      content: [
        "**Freelance Proposal: Landing Page Redesign for B2B SaaS**",
        "",
        "I’d start with a brief discovery phase to understand your goals and ensure the final design aligns with your vision and objectives.",
        "",
        "My background may offer relevant perspective on this project.",
        "",
        "If this approach aligns with what you're looking for, I'd love to discuss how we can apply it to your project. Let me know a time that works for you.",
      ].join("\n"),
      format: "freelance_proposal",
      outputLanguage: "English",
    });

    expect(saved).toContain(
      "ensure the final design aligns with your vision and objectives.",
    );
    expect(saved).not.toContain("may offer relevant perspective");
    expect(saved).not.toContain(
      "If this approach aligns with what you're looking for",
    );
    expect(saved).toContain("Let me know a time that works for you.");
  });

  it("guards the saved tail even when only unconditional finalization ran", () => {
    const saved = applyFinalSavedOutputBridgeGuard({
      content: [
        "Dear Hiring Manager,",
        "",
        "My experience aligns with your emphasis on analytics and experimentation.",
        "",
        "I would welcome the opportunity to discuss the position further.",
        "",
        "Sincerely,",
        "Board Ramanathapuram",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
    });

    expect(saved).toBe(
      [
        "Dear Hiring Manager,",
        "",
        "I would welcome the opportunity to discuss the position further.",
        "",
        "Sincerely,",
        "Board Ramanathapuram",
      ].join("\n"),
    );
  });

  it("neutralizes reverse-direction alignment into a candidate-backed fact", () => {
    expect(
      neutralizeFinalSavedOutputBridgeSentence(
        "Developing REST APIs and managing backend systems aligns with my experience building scalable solutions.",
      ),
    ).toBe("");
  });

  it("neutralizes requirements alignment while preserving factual content", () => {
    expect(
      neutralizeFinalSavedOutputBridgeSentence(
        "Background in backend development and database management aligns with the technical requirements for this role.",
      ),
    ).toBe("");
  });

  it("neutralizes need-for alignment variants while preserving factual content", () => {
    expect(
      neutralizeFinalSavedOutputBridgeSentence(
        "My experience with API design aligns with your need for strong backend fundamentals.",
      ),
    ).toBe("");
  });

  it("neutralizes verb-led alignment bridges while preserving the factual prefix", () => {
    expect(
      neutralizeFinalSavedOutputBridgeSentence(
        "Developed a REST API using FastAPI and PostgreSQL to store data from learning management systems, which aligns with designing and maintaining scalable APIs.",
      ),
    ).toBe(
      "Developed a REST API using FastAPI and PostgreSQL to store data from learning management systems.",
    );
  });

  it("fails closed when bridge neutralization leaves only one fact sentence", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "Background in backend development and database management aligns with the technical requirements for this role.",
          "",
          "I developed REST APIs using FastAPI and PostgreSQL.",
        ].join("\n"),
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: "Board Ramanathapuram",
        voicePreset: "direct",
        noContextMode: false,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("removes known bridge patterns from final saved cover letters when factual proof remains", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "Developed construction-ready AutoCAD drawings and reviewed project documentation, which aligns with your need for precise documentation and stakeholder coordination.",
        "",
        "I coordinated monthly internal audits and compliance reviews for MEP project teams.",
        "",
        "My background may offer relevant experience for this position.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Sadath Basha.a.m",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(saved).toContain(
      "Developed construction-ready AutoCAD drawings and reviewed project documentation.",
    );
    expect(saved).toContain(
      "I coordinated monthly internal audits and compliance reviews for MEP project teams.",
    );
    expect(saved).not.toMatch(/\baligns with(?: your need for| the need)\b/i);
    expect(saved).not.toMatch(
      /\bmay offer relevant (?:experience|perspective)\b/i,
    );
  });

  it("strips may-offer-relevant-experience tails while preserving the factual prefix", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "I managed monthly internal audits and compliance reviews for MEP project teams, which may offer relevant experience for similar documentation-heavy work.",
        "",
        "I developed construction-ready AutoCAD drawings and reviewed project documentation for client requirements.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Sadath Basha.a.m",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(saved).toContain(
      "I managed monthly internal audits and compliance reviews for MEP project teams.",
    );
    expect(saved).toContain(
      "I developed construction-ready AutoCAD drawings and reviewed project documentation for client requirements.",
    );
    expect(saved).not.toMatch(/\bmay offer relevant experience\b/i);
  });

  it("strips aligns-with-the-responsibilities-described tails while preserving the factual prefix", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "Developed construction-ready AutoCAD drawings and reviewed project documentation, which aligns with the responsibilities described.",
        "",
        "I coordinated monthly internal audits and compliance reviews for MEP project teams.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Sadath Basha.a.m",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(saved).toContain(
      "Developed construction-ready AutoCAD drawings and reviewed project documentation.",
    );
    expect(saved).toContain(
      "I coordinated monthly internal audits and compliance reviews for MEP project teams.",
    );
    expect(saved).not.toMatch(
      /\baligns with the responsibilities described\b/i,
    );
  });

  it("neutralizes future-value team bridges without dropping factual prefixes", () => {
    const saved = applyFinalSavedOutputBridgeGuard({
      content: [
        "My experience with database migrations and performance tuning could support your team.",
        "",
        "My background in backend security would allow me to contribute effectively in the role.",
        "",
        "My experience in structured backend work would add value to your team.",
      ].join("\n"),
      format: "application_message",
      outputLanguage: "English",
    });

    expect(saved).toBe("");
    expect(saved).not.toContain("could support your team");
    expect(saved).not.toContain("contribute effectively");
    expect(saved).not.toContain("add value");
  });

  it("removes alignment closings without collapsing the remaining freelance paragraph", () => {
    const saved = applyFinalSavedOutputBridgeGuard({
      content: [
        "I can share a concise redesign approach based on your current landing page goals.",
        "",
        "Let me know if this aligns with your needs. I can send a first-pass outline today.",
      ].join("\n"),
      format: "freelance_proposal",
      outputLanguage: "English",
    });

    expect(saved).not.toContain("Let me know if this aligns with your needs");
    expect(saved).toContain("I can send a first-pass outline today.");
  });

  it("reuses the persistence tail helper for parse-error fallback content", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content:
          "The opportunity to work on backend systems with Rust aligns with my interest in building robust, high-performance solutions.",
        format: "application_message",
        outputLanguage: "English",
        voicePreset: "direct",
        noContextMode: true,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("still fails the cover-letter saveability floor for generic one-sentence no-context prose", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content:
          "The role involves coordinating with engineers and reviewing technical drawings for project teams.",
        format: "cover_letter",
        outputLanguage: "English",
        voicePreset: "signature",
        noContextMode: true,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("saves a thin but coherent no-context legacy cover letter when at least one grounded work-surface sentence survives", () => {
    const body = [
      "The role involves coordinating with engineers, reviewing technical drawings, and producing construction-ready documents for project teams.",
      "",
      "That kind of structured project environment is the part of the role I would want to understand more closely.",
    ].join("\n");

    expect(
      evaluateProposalBodySaveability({
        body,
        format: "cover_letter",
        noContextMode: true,
        acceptanceMode: "strict",
      }),
    ).toBe(false);
    expect(
      evaluateProposalBodySaveability({
        body,
        format: "cover_letter",
        noContextMode: true,
        acceptanceMode: "legacy_thin",
      }),
    ).toBe(true);

    const saved = finalizeProposalForPersistence({
      content: body,
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "direct",
      noContextMode: true,
    });

    expect(saved).toContain("coordinating with engineers");
    expect(saved).toContain(
      "That kind of structured project environment is the part of the role I would want to understand more closely.",
    );
  });

  it("keeps French CV-backed cover letters saveable when the evidence is grounded but not English-anchored", () => {
    const body = [
      "Dans mes fonctions de sécurité, la rédaction de rapports fait partie de mon travail, avec l’enregistrement d’informations, d’observations, d’incidents et d’activités de surveillance de façon claire et suivie.",
      "",
      "Je suis agent de sécurité attentif et conscient des enjeux de sûreté, avec huit ans d’expérience dans la protection et la garde de personnes VIP dans les secteurs militaire et de la défense.",
      "Mon parcours inclut des postes d’agent de sécurité chez ADT Security et chez Copwatch, où la vigilance quotidienne et le reporting précis étaient essentiels.",
      "",
      "Cette combinaison de vigilance, d’expérience en environnement sensible et de rapports structurés est utile dans un cadre où les équipes doivent pouvoir s’appuyer sur des informations fiables et un suivi régulier.",
      "Cela aide les responsables et collègues à comprendre rapidement ce qui s’est passé, ce qui a été observé et ce qui mérite attention.",
      "",
      "Je peux apporter une présence attentive, disciplinée et habituée aux exigences concrètes de la sécurité de haut niveau.",
    ].join("\n");

    expect(
      evaluateProposalBodySaveability({
        body,
        format: "cover_letter",
        noContextMode: false,
        acceptanceMode: "strict",
      }),
    ).toBe(true);

    const saved = finalizeProposalForPersistence({
      content: body,
      format: "cover_letter",
      outputLanguage: "French",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(saved).toContain("huit ans d’expérience");
    expect(saved).toContain("ADT Security");
  });

  it("does not treat generic French job-summary prose as CV-backed evidence", () => {
    const body = [
      "Le poste demande une vigilance constante, des rondes régulières et une communication claire avec les équipes sur site.",
      "Les rapports doivent rester précis, structurés et utiles pour comprendre les incidents et les observations importantes.",
      "La surveillance quotidienne exige aussi une présence fiable et une attention continue aux situations sensibles.",
    ].join("\n");

    expect(
      evaluateProposalBodySaveability({
        body,
        format: "cover_letter",
        noContextMode: false,
        acceptanceMode: "strict",
      }),
    ).toBe(false);
  });

  it("does not let a French courtesy tail make otherwise thin CV-backed prose saveable", () => {
    const body = [
      "Dans mes fonctions de sécurité, la rédaction de rapports fait partie de mon travail, avec l’enregistrement d’observations et d’activités de surveillance.",
      "Mon parcours inclut des postes d’agent de sécurité chez ADT Security et chez Copwatch, où la vigilance quotidienne était importante.",
      "Cette expérience est utile dans un cadre où les équipes doivent pouvoir s’appuyer sur des informations fiables.",
      "Je vous remercie pour votre temps et votre considération.",
    ].join("\n");

    expect(
      evaluateProposalBodySaveability({
        body,
        format: "cover_letter",
        noContextMode: false,
        acceptanceMode: "strict",
      }),
    ).toBe(false);
  });

  it("accepts truthful structural cover-letter evidence across languages without domain keyword gates", () => {
    const cases = [
      {
        label: "English",
        body: [
          "I reviewed client request records, updated delivery notes, and handed each resolved case to the support team before the daily deadline.",
          "That process kept customer questions traceable, reduced unclear handoffs, and gave teammates the correct status before follow-up calls.",
        ].join("\n"),
      },
      {
        label: "French",
        body: [
          "J’ai vérifié les dossiers de demande client, corrigé les notes de livraison et transmis chaque cas terminé à l’équipe avant l’échéance quotidienne.",
          "Ce processus gardait les questions clients traçables, limitait les transmissions floues et donnait aux collègues un statut fiable avant les relances.",
        ].join("\n"),
      },
      {
        label: "Spanish",
        body: [
          "Revisé registros de solicitudes de clientes, actualicé notas de entrega y pasé cada caso cerrado al equipo antes del plazo diario.",
          "Ese proceso mantenía las preguntas de usuarios trazables, evitaba traspasos confusos y daba al equipo un estado fiable para el seguimiento.",
        ].join("\n"),
      },
      {
        label: "German",
        body: [
          "Ich prüfte Kundenanfragen, aktualisierte Liefernotizen und übergab jeden abgeschlossenen Vorgang vor der täglichen Frist an das Team.",
          "Dieser Ablauf hielt Nutzerfragen nachvollziehbar, verhinderte unklare Übergaben und gab Kolleginnen einen verlässlichen Status für die Nachverfolgung.",
        ].join("\n"),
      },
      {
        label: "Arabic",
        body: [
          "راجعت سجلات طلبات العملاء، وحدّثت ملاحظات التسليم، وسلّمت كل حالة مكتملة إلى الفريق قبل الموعد اليومي.",
          "هذا المسار جعل أسئلة العملاء قابلة للتتبع، وقلّل التسليمات غير الواضحة، ومنح الزملاء حالة دقيقة للمتابعة.",
        ].join("\n"),
      },
    ];

    for (const { label, body } of cases) {
      expect(
        evaluateProposalBodySaveability({
          body,
          format: "cover_letter",
          noContextMode: false,
          acceptanceMode: "strict",
        }),
        label,
      ).toBe(true);
    }
  });

  it("accepts the retail luxury garment case through structural saveability only", () => {
    const body = [
      "I delivered luxury client service by warmly greeting and engaging clients, then taking care to assess what they needed with attention and professionalism.",
      "In garment alteration work, I kept quality and follow-through close together: sewing and altering garments to required specifications, meeting 99% of deadlines, and coordinating requested alterations through completion within specified timelines.",
      "That work required careful listening, accurate handoffs, and steady attention to both the client experience and the finished product.",
      "The same habits behind luxury service and alteration coordination—clear communication, organized follow-through, and consistent standards—sit close to store and operational task execution, where customers and teammates depend on details being handled without confusion.",
    ].join("\n");

    expect(
      evaluateProposalBodySaveability({
        body,
        format: "cover_letter",
        noContextMode: false,
        acceptanceMode: "strict",
      }),
    ).toBe(true);
  });

  it("keeps generic CTA-only cover letters below the saveability floor", () => {
    expect(
      evaluateProposalBodySaveability({
        body: "I would be glad to discuss the position further.",
        format: "cover_letter",
        noContextMode: false,
        acceptanceMode: "strict",
      }),
    ).toBe(false);
  });

  it("keeps premium hard safety blockers unchanged", () => {
    const brief = {
      language: "English",
      preset: "signature",
      contextClass: "cv_adjacent",
      candidateEvidenceAvailable: true,
      targetRole: "Operations Coordinator",
      topEvidence: [
        "I documented client requests and handed completed records to the support team.",
      ],
      supportEvidence: [
        "I kept notes current so teammates had reliable follow-up status.",
      ],
      topResponsibilities: [
        "Coordinate daily customer requests and maintain accurate records.",
      ],
      requiredMoves: [],
      forbiddenMoves: [],
    } as const;

    const baseParts = {
      opening:
        "I documented client requests and handed completed records to the support team.",
      proofBlock:
        "I kept notes current so teammates had reliable follow-up status.",
      employerValueBlock:
        "That record discipline matters where customer requests need clear ownership and accurate handoffs.",
      closeLine:
        "I bring discipline around records, handoffs, and customer follow-through.",
    };

    expect(
      validatePremiumCoverLetterBodyParts({
        bodyParts: {
          ...baseParts,
          proofBlock:
            "I documented 99% of client requests and handed completed records to the support team.",
        },
        brief,
      }).map((issue) => issue.code),
    ).toContain("unsupported_numeric_claim");

    expect(
      validatePremiumCoverLetterBodyParts({
        bodyParts: {
          ...baseParts,
          proofBlock:
            "I hold a valid driver's license and documented client request records for the support team.",
        },
        brief,
      }).map((issue) => issue.code),
    ).toContain("unsupported_license_claim");

    expect(
      validatePremiumCoverLetterBodyParts({
        bodyParts: {
          ...baseParts,
          proofBlock:
            "I managed the full operations program and documented client request records for the support team.",
        },
        brief,
      }).map((issue) => issue.code),
    ).toContain("unsupported_ownership_verb");

    expect(
      validatePremiumCoverLetterBodyParts({
        bodyParts: baseParts,
        brief: {
          ...brief,
          contextClass: "no_cv",
          candidateEvidenceAvailable: false,
          topEvidence: [],
          supportEvidence: [],
        },
      }).map((issue) => issue.code),
    ).toContain("no_cv_history_claim");

    expect(
      validatePremiumWriterOutputV1({
        writerOutput: {
          version: "premium_writer_output_v1",
          bodyParts: {
            opening: {
              section: "opening",
              text: baseParts.opening,
              claimIds: ["claim_opening"],
              factIds: ["fact_1"],
              demandIds: [],
            },
            proofBlock: {
              section: "proofBlock",
              text: "I coordinated daily customer requests and maintain accurate records.",
              claimIds: ["claim_proof"],
              factIds: ["fact_1"],
              demandIds: ["demand_1"],
            },
            employerValueBlock: {
              section: "employerValueBlock",
              text: baseParts.employerValueBlock,
              claimIds: ["claim_employer"],
              factIds: ["fact_1"],
              demandIds: [],
            },
            closeLine: {
              section: "closeLine",
              text: baseParts.closeLine,
              claimIds: ["claim_close"],
              factIds: ["fact_1"],
              demandIds: [],
            },
          },
        },
        claimPlan: {
          version: "claim_plan_v1",
          contextClass: "cv_adjacent",
          language: "English",
          targetRole: "Operations Coordinator",
          preset: "signature",
          claims: [
            {
              id: "claim_opening",
              section: "opening",
              factIds: ["fact_1"],
              demandIds: [],
              claimType: "source_backed",
              requiredElements: ["I documented client requests."],
              allowedVerbs: ["documented"],
              forbiddenVerbs: ["managed", "led", "owned"],
              forbiddenClaims: [],
              maxOwnership: "support",
              allowEmployerBridge: false,
              editorialGuideline: "Use source-backed evidence.",
            },
            {
              id: "claim_proof",
              section: "proofBlock",
              factIds: ["fact_1"],
              demandIds: ["demand_1"],
              claimType: "source_backed",
              requiredElements: ["I documented client requests."],
              allowedVerbs: ["documented"],
              forbiddenVerbs: ["managed", "led", "owned"],
              forbiddenClaims: [],
              maxOwnership: "support",
              allowEmployerBridge: false,
              editorialGuideline: "Do not rewrite job demand as history.",
            },
            {
              id: "claim_employer",
              section: "employerValueBlock",
              factIds: ["fact_1"],
              demandIds: [],
              claimType: "adjacent_safe_bridge",
              requiredElements: ["I documented client requests."],
              allowedVerbs: ["documented"],
              forbiddenVerbs: ["managed", "led", "owned"],
              forbiddenClaims: [],
              maxOwnership: "support",
              allowEmployerBridge: true,
              editorialGuideline: "Use a restrained bridge.",
            },
            {
              id: "claim_close",
              section: "closeLine",
              factIds: ["fact_1"],
              demandIds: [],
              claimType: "source_backed",
              requiredElements: ["I documented client requests."],
              allowedVerbs: ["documented"],
              forbiddenVerbs: ["managed", "led", "owned"],
              forbiddenClaims: [],
              maxOwnership: "support",
              allowEmployerBridge: false,
              editorialGuideline: "Restate grounded strengths.",
            },
          ],
          globalForbidden: [],
        },
        factGraph: {
          version: "fact_graph_v1",
          facts: [
            {
              id: "fact_1",
              text: "I documented client requests.",
              source: "cv",
              sourcePath: "recentExperience[0].highlights[0]",
              confidence: "high",
              category: "responsibility",
              metrics: [],
              entities: [],
              allowedVerbs: ["documented"],
              forbiddenUpgrades: ["managed", "led", "owned"],
              ownershipLevel: "support",
            },
          ],
        },
        jobDemandGraph: {
          version: "job_demand_graph_v1",
          demands: [
            {
              id: "demand_1",
              text: "Coordinated daily customer requests and maintain accurate records.",
              bucket: "core_responsibility",
              requiredness: "core",
              tokens: ["coordinate", "customer", "requests", "records"],
              mustNotBecomeCandidateClaim: true,
            },
          ],
          priorityTokens: ["coordinate", "customer", "requests", "records"],
        },
        brief,
      }).map((issue) => issue.code),
    ).toContain("job_demand_as_candidate_experience");
  });

  it("removes a no-context role-title opener when stronger grounded body sentences remain", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The role of Security Officer at Ascension St. Vincent’s Riverside Hospital.",
        "",
        "The role involves proactive patrols, incident management, and documenting security concerns across a diverse campus.",
        "",
        "It also requires steady coordination during emergency drills and staff safety training.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.cleanedBodySelection.aggressive.candidate).not.toContain(
      "The role of Security Officer at Ascension St. Vincent’s Riverside Hospital.",
    );
    expect(trace.cleanedBodySelection.conservative.candidate).not.toContain(
      "The role of Security Officer at Ascension St. Vincent’s Riverside Hospital.",
    );
    expect(trace.noContextLeadCleanup?.removedSentence).toBeNull();
    expect(trace.noContextLeadCleanup?.preservedForSaveability).toBe(false);
    expect(trace.finalOutput).toContain(
      "The role involves proactive patrols, incident management, and documenting security concerns across a diverse campus.",
    );
    expect(trace.finalOutput).not.toContain(
      "The role of Security Officer at Ascension St. Vincent’s Riverside Hospital.",
    );
  });

  it("removes a no-context schedule opener when stronger grounded body sentences remain", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The rotating schedule and PRN availability fit well with my availability and flexibility.",
        "",
        "The role involves proactive patrols, incident management, and documenting security concerns across a diverse campus.",
        "",
        "It also requires steady coordination during emergency drills and staff safety training.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.noContextLeadCleanup?.removedSentence).toBe(
      "The rotating schedule and PRN availability fit well with my availability and flexibility.",
    );
    expect(trace.noContextLeadCleanup?.preservedForSaveability).toBe(false);
    expect(trace.finalOutput).not.toContain(
      "The rotating schedule and PRN availability fit well with my availability and flexibility.",
    );
  });

  it("removes a no-context shell sentence when stronger body content remains", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The role involves proactive patrols, incident management, and documenting security concerns across a diverse campus.",
        "",
        "The day-to-day work itself is the part of the role that stands out to me most.",
        "It also requires steady coordination during emergency drills and staff safety training.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.noContextLeadCleanup?.removedSentences).toContain(
      "The day-to-day work itself is the part of the role that stands out to me most.",
    );
    expect(trace.finalOutput).toContain(
      "The role involves proactive patrols, incident management, and documenting security concerns across a diverse campus.",
    );
    expect(trace.finalOutput).toContain(
      "It also requires steady coordination during emergency drills and staff safety training.",
    );
    expect(trace.finalOutput).not.toContain(
      "The day-to-day work itself is the part of the role that stands out to me most.",
    );
  });

  it("neutralizes weak no-context role-understanding wording when stronger body remains", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The role’s focus on emergency preparedness, incident management, and proactive campus security aligns with my understanding of the responsibilities involved in maintaining a safe environment for staff and visitors.",
        "",
        "It also requires steady coordination during emergency drills and staff safety training.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.noContextLeadCleanup?.neutralizedSentences).toEqual([
      {
        before:
          "The role’s focus on emergency preparedness, incident management, and proactive campus security aligns with my understanding of the responsibilities involved in maintaining a safe environment for staff and visitors.",
        after:
          "The role’s focus on emergency preparedness, incident management, and proactive campus security.",
      },
    ]);
    expect(trace.finalOutput).toContain(
      "The role’s focus on emergency preparedness, incident management, and proactive campus security.",
    );
    expect(trace.finalOutput).not.toContain(
      "aligns with my understanding of the responsibilities involved",
    );
  });

  it("fails closed when a no-context role summary is followed only by appreciation and future-learning filler", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The role involves proactive patrols, incident management, and documenting security concerns across a diverse campus.",
        "",
        "I appreciate the emphasis on emergency preparedness and staff training, which reflects a commitment to comprehensive safety measures.",
        "",
        "The chance to develop skills in disaster preparedness and environment of care while working in a healthcare setting is valuable.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });

    expect(trace.failureStage).toBe("cleaned_body_selection");
    expect(trace.cleanedBodySelection?.aggressive.saveableSentences).toEqual([
      "The role involves proactive patrols, incident management, and documenting security concerns across a diverse campus.",
    ]);
  });

  it("removes an appreciate-the-opportunity future-learning sentence when stronger body content remains", () => {
    const trace = inspectProposalFinalization({
      content: [
        "I appreciate the opportunity to develop skills in disaster response and environmental safety within a mission-driven organization.",
        "",
        "The responsibilities outlined—such as conducting safety training and managing security incidents—highlight the critical role of vigilance in healthcare settings.",
        "",
        "The diverse campus setting and focus on daily safety for staff and visitors highlight the importance of vigilance and professionalism in this role.",
        "",
        "The role also requires steady coordination during emergency drills and staff safety training.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "expert",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.noContextLeadCleanup?.removedSentences).toContain(
      "I appreciate the opportunity to develop skills in disaster response and environmental safety within a mission-driven organization.",
    );
    expect(trace.finalOutput).not.toContain(
      "I appreciate the opportunity to develop skills in disaster response and environmental safety within a mission-driven organization.",
    );
  });

  it("removes a chance-to-engage future-learning sentence when stronger body content remains", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The hospital’s commitment to inclusive and supportive culture resonates in a role that protects both staff and visitors.",
        "",
        "The chance to engage with diverse teams and develop skills in disaster response would be a meaningful part of the work.",
        "",
        "The responsibilities outlined—such as conducting safety training and managing security incidents—highlight the critical role of vigilance in healthcare settings.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "engaging",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.noContextLeadCleanup?.removedSentences).toContain(
      "The chance to engage with diverse teams and develop skills in disaster response would be a meaningful part of the work.",
    );
    expect(trace.finalOutput).not.toContain(
      "The chance to engage with diverse teams and develop skills in disaster response would be a meaningful part of the work.",
    );
  });

  it("removes details-shared position padding when stronger body content remains", () => {
    const trace = inspectProposalFinalization({
      content: [
        "Daily incident documentation and coordination with staff are central to keeping hospital operations secure.",
        "",
        "The details shared about the position highlight the kind of impactful work that draws me to this opportunity.",
        "",
        "The role also requires steady coordination during emergency drills and staff safety training.",
        "",
        "Clear communication during visitor screening and shift handoffs is also part of the work.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "engaging",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.noContextLeadCleanup?.removedSentences).toContain(
      "The details shared about the position highlight the kind of impactful work that draws me to this opportunity.",
    );
    expect(trace.finalOutput).not.toContain(
      "The details shared about the position highlight the kind of impactful work that draws me to this opportunity.",
    );
  });

  it("removes a bare emphasis fragment opener when stronger body content remains", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The emphasis on emergency preparedness, staff safety, and proactive threat monitoring.",
        "",
        "The diverse responsibilities—from incident management to staff training—reflect the dynamic nature of healthcare security.",
        "",
        "The diverse campus setting and focus on daily safety for staff and visitors highlight the importance of vigilance and professionalism in this role.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "storyteller",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.noContextLeadCleanup?.removedSentences).toContain(
      "The emphasis on emergency preparedness, staff safety, and proactive threat monitoring.",
    );
    expect(trace.finalOutput).not.toContain(
      "The emphasis on emergency preparedness, staff safety, and proactive threat monitoring.",
    );
  });

  it("neutralizes aligns-with-a-commitment wording and removes the low-value fragment when stronger body remains", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The emphasis on emergency preparedness and incident management aligns with a commitment to maintaining secure and orderly operations, which is central to the hospital’s mission.",
        "",
        "The responsibilities outlined—such as conducting safety training and managing security incidents—highlight the critical role of vigilance in healthcare settings.",
        "",
        "The diverse campus setting and focus on daily safety for staff and visitors highlight the importance of vigilance and professionalism in this role.",
        "",
        "The role also requires steady coordination during emergency drills and staff safety training.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "engaging",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.noContextLeadCleanup?.neutralizedSentences).toEqual(
      expect.arrayContaining([
        {
          before:
            "The emphasis on emergency preparedness and incident management aligns with a commitment to maintaining secure and orderly operations, which is central to the hospital’s mission.",
          after:
            "The role places emphasis on emergency preparedness and incident management.",
        },
      ]),
    );
    expect(trace.finalOutput).not.toContain(
      "aligns with a commitment to maintaining secure and orderly operations",
    );
    expect(trace.finalOutput).not.toContain(
      "The emphasis on emergency preparedness and incident management.",
    );
  });

  it("removes a bare JD-summary fragment when stronger grounded no-context body remains", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The responsibilities outlined—such as emergency drills, incident management, and proactive patrols.",
        "",
        "The position requires clear documentation of security concerns across a diverse campus.",
        "",
        "It also requires steady coordination during staff safety training and daily reporting.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "expert",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.noContextLeadCleanup?.removedSentences).toContain(
      "The responsibilities outlined—such as emergency drills, incident management, and proactive patrols.",
    );
    expect(trace.finalOutput).not.toContain(
      "The responsibilities outlined—such as emergency drills, incident management, and proactive patrols.",
    );
  });

  it("drops a role-requirements fragment survivor from no-context candidates when stronger body remains", () => {
    const fragment =
      "The role’s requirements, including proactive patrols and incident management.";
    const trace = inspectProposalFinalization({
      content: [
        "The role requires steady coordination during emergency drills and staff safety training.",
        "",
        fragment,
        "",
        "Clear incident documentation and visitor screening are also part of the day-to-day work.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "expert",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.cleanedBodySelection.aggressive.candidate).not.toContain(
      fragment,
    );
    expect(trace.cleanedBodySelection.conservative.candidate).not.toContain(
      fragment,
    );
    expect(trace.finalOutput).not.toContain(fragment);
  });

  it("drops a structured-approach fragment survivor from no-context candidates when stronger body remains", () => {
    const fragment =
      "The structured approach to disaster response and staff training.";
    const trace = inspectProposalFinalization({
      content: [
        "The emphasis on emergency preparedness, incident management, and proactive campus security aligns with the importance of maintaining a secure environment for staff and visitors.",
        "",
        fragment,
        "",
        "Daily patrol coordination, incident documentation, and visitor screening are part of the work.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "engaging",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.cleanedBodySelection.aggressive.candidate).not.toContain(
      fragment,
    );
    expect(trace.cleanedBodySelection.conservative.candidate).not.toContain(
      fragment,
    );
    expect(trace.finalOutput).not.toContain(fragment);
  });

  it("neutralizes drawn-to-the-chance-to-develop-skills wording when stronger no-context body remains", () => {
    const trace = inspectProposalFinalization({
      content: [
        "Ascension’s focus on service and connection reflects values I share, and I am drawn to the chance to develop skills in disaster preparedness within a diverse campus.",
        "",
        "The role involves proactive patrols, incident management, and documenting security concerns across a diverse campus.",
        "",
        "It also requires steady coordination during emergency drills and staff safety training.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.noContextLeadCleanup?.neutralizedSentences).toEqual([
      {
        before:
          "Ascension’s focus on service and connection reflects values I share, and I am drawn to the chance to develop skills in disaster preparedness within a diverse campus.",
        after:
          "Ascension’s focus on service and connection reflects values I share.",
      },
    ]);
    expect(trace.finalOutput).toContain(
      "Ascension’s focus on service and connection reflects values I share.",
    );
    expect(trace.finalOutput).not.toContain(
      "drawn to the chance to develop skills",
    );
  });

  it("removes drawn-to-the-opportunity-to-develop-skills sentences when stronger no-context body remains", () => {
    const trace = inspectProposalFinalization({
      content: [
        "I am particularly drawn to the opportunity to develop skills in disaster preparedness and staff safety training, areas that align with the broader goals of ensuring a secure and supportive campus.",
        "",
        "The role involves proactive patrols, incident management, and documenting security concerns across a diverse campus.",
        "",
        "It also requires steady coordination during emergency drills and staff safety training.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "expert",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.noContextLeadCleanup?.removedSentences).toContain(
      "I am particularly drawn to the opportunity to develop skills in disaster preparedness and staff safety training, areas that align with the broader goals of ensuring a secure and supportive campus.",
    );
    expect(trace.finalOutput).not.toContain(
      "I am particularly drawn to the opportunity to develop skills in disaster preparedness and staff safety training",
    );
  });

  it("preserves a weak no-context opener when removing it would newly collapse the surviving body", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The rotating schedule and PRN availability fit well with my availability and flexibility.",
        "",
        "The role involves proactive patrols, incident management, and documenting security concerns across a diverse campus.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.noContextLeadCleanup?.removedSentence).toBeNull();
    expect(trace.noContextLeadCleanup?.preservedSentences).toContain(
      "The rotating schedule and PRN availability fit well with my availability and flexibility.",
    );
    expect(trace.noContextLeadCleanup?.preservedForSaveability).toBe(true);
    expect(trace.finalOutput).toContain(
      "The rotating schedule and PRN availability fit well with my availability and flexibility.",
    );
  });

  it("reports cleaned-body selection for a residual signature-style no-context collapse", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The role of Security Officer at Ascension St. Vincent’s Riverside Hospital.",
        "",
        "The day-to-day work itself is the part of the role that stands out to me most.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });

    expect(trace.finalOutput).toBeUndefined();
    expect(trace.failureStage).toBe("cleaned_body_selection");
    expect(trace.errorMessage).toMatch(
      /Cleanup removed all substantive body content/i,
    );
  });

  it("removes clipped direct no-context JD fragments when stronger grounded body remains", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The Security Officer role at Ascension St. Vincent’s Riverside Hospital.",
        "",
        "The responsibilities described—such as conducting patrols, managing incidents, and supporting staff training.",
        "",
        "Daily patrol coordination and incident documentation are part of the work.",
        "",
        "Clear communication with staff during visitor screening and emergency drills is also required.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "direct",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.noContextLeadCleanup?.removedSentences).toContain(
      "The responsibilities described—such as conducting patrols, managing incidents, and supporting staff training.",
    );
    expect(trace.finalOutput).not.toContain(
      "The Security Officer role at Ascension St. Vincent’s Riverside Hospital.",
    );
    expect(trace.finalOutput).not.toContain(
      "The responsibilities described—such as conducting patrols, managing incidents, and supporting staff training.",
    );
  });

  it("keeps traced no-context fail-closed cases at cleaned-body selection when no substantive second sentence survives", () => {
    const tracedCases = [
      [
        "The opportunity to perform emergency drills, manage security incidents, and protect a diverse campus resonates with my understanding of the critical role security plays in maintaining a safe and orderly facility. I am particularly drawn to the focus on proactive patrols and disaster preparedness, as these responsibilities.",
        "",
        "The day-to-day work itself is the part of the role that stands out to me most.",
      ].join("\n"),
      [
        "The opportunity to perform emergency drills, manage security incidents, and ensure the well-being of staff and visitors resonates with my commitment to proactive and thorough security practices.",
        "",
        "The day-to-day work itself is the part of the role that stands out to me most. I am particularly drawn to the focus on disaster preparedness and environment of care, as these areas require both technical skill and a strong sense of responsibility.",
      ].join("\n"),
    ];

    for (const content of tracedCases) {
      const trace = inspectProposalFinalization({
        content,
        format: "cover_letter",
        outputLanguage: "English",
        voicePreset: "direct",
        noContextMode: true,
      });

      expect(trace.finalOutput).toBeUndefined();
      expect(trace.failureStage).toBe("cleaned_body_selection");
      expect(trace.cleanedBodySelection.selectedBody).toBeNull();
      expect(trace.cleanedBodySelection.aggressive.saveableSentences).toEqual(
        [],
      );
    }
  });

  it("replays the Hogan Lovells direct no-context trace body without failing at cleaned-body selection", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The role at Hogan Lovells involves coordinating marketing campaigns, managing client communications, and supporting business development efforts for the Consumer and Sports, Media and Entertainment sectors. This includes drafting proposals, tracking engagement metrics, and maintaining marketing collateral like brochures and website content. The position requires collaboration with global teams to ensure cohesive marketing strategies and effective client outreach.",
        "",
        "I am interested in this opportunity because of the firm’s focus on strategic marketing and business development in dynamic sectors. The work involves a mix of creative content development, data-driven analysis, and cross-functional coordination, which aligns with my background in marketing and business development. I would welcome the chance to discuss how my skills and experience could contribute to the team’s goals.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "direct",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.cleanedBodySelection.selectedCandidate).not.toBeNull();
    expect(trace.finalOutput).toContain(
      "The role at Hogan Lovells involves coordinating marketing campaigns, managing client communications, and supporting business development efforts for the Consumer and Sports, Media and Entertainment sectors.",
    );
    expect(trace.finalOutput).toContain(
      "This includes drafting proposals, tracking engagement metrics, and maintaining marketing collateral like brochures and website content.",
    );
  });

  it("replays an additional grounded Hogan Lovells no-context trace body when two grounded role-summary sentences survive", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The role at Hogan Lovells involves coordinating marketing campaigns, managing client communications, and supporting business development initiatives for the Consumer and Sports, Media and Entertainment sectors. This includes drafting proposals, tracking pitch materials, and leveraging CRM tools to maintain client engagement. The position also requires maintaining marketing collateral, coordinating events, and analyzing sector trends to inform strategy.",
        "",
        "I am interested in contributing to a global team focused on profile raising and client development. The structured approach to marketing and business development aligns with my background in marketing and business development, where I have experience managing campaigns, coordinating communications, and analyzing market trends. I am eager to bring my skills in project management, strategic planning, and digital content development to support the firm’s objectives.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "expert",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.cleanedBodySelection.selectedCandidate).not.toBeNull();
    expect(trace.finalOutput).toContain(
      "The role at Hogan Lovells involves coordinating marketing campaigns, managing client communications, and supporting business development initiatives for the Consumer and Sports, Media and Entertainment sectors.",
    );
    expect(trace.finalOutput).toContain(
      "This includes drafting proposals, tracking pitch materials, and leveraging CRM tools to maintain client engagement.",
    );
  });

  it("preserves generic no-context role-summary shell rejection when operational detail is absent", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The role is interesting.",
        "",
        "The position sounds exciting.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });

    expect(trace.finalOutput).toBeUndefined();
    expect(trace.failureStage).toBe("cleaned_body_selection");
    expect(trace.errorMessage).toMatch(
      /Cleanup removed all substantive body content/i,
    );
  });

  it("saves a thin but coherent cv-backed legacy cover letter when two grounded fact sentences survive", () => {
    const body = [
      "I developed a REST API using FastAPI and PostgreSQL to store data from learning management systems.",
      "",
      "I also contributed over 50,000 lines of code to an established codebase using Git.",
    ].join("\n");

    expect(
      evaluateProposalBodySaveability({
        body,
        format: "cover_letter",
        noContextMode: false,
        acceptanceMode: "strict",
      }),
    ).toBe(true);
    expect(
      evaluateProposalBodySaveability({
        body,
        format: "cover_letter",
        noContextMode: false,
        acceptanceMode: "legacy_thin",
      }),
    ).toBe(true);

    const saved = finalizeProposalForPersistence({
      content: body,
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Jake Ryan",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(saved).toContain("FastAPI and PostgreSQL");
    expect(saved).toContain("50,000 lines of code");
  });

  it("recovers a wrapped expert cv draft instead of collapsing factual body content to empty", () => {
    const trace = inspectProposalFinalization({
      content: [
        "Here is the tailored employment cover letter for the Security Officer position at Ascension St. Vincent's Riverside Hospital:",
        "",
        "---",
        "",
        "My background in investigation skills and safety compliance aligns with the responsibilities of this role. At Robert Cooper Security Guard, I reduced theft by 73% through improved vigilance and installed 15 360-degree CCTV cameras to enhance monitoring. I also introduced X-ray scanning systems and improved access control, reducing unauthorized entry by 26%. This experience in loss prevention and access control may offer relevant perspective for protecting a diverse campus.",
        "",
        "I am familiar with proactive patrols and threat monitoring, as well as managing security incidents from start to finish. My criminal justice knowledge and troubleshooting skills support a structured approach to emergency drills and staff safety training. I would welcome the opportunity to discuss how my experience aligns with the needs of Ascension St. Vincent's Riverside Hospital.",
        "",
        "---",
        "",
        "This letter adheres to the strict boundaries provided, avoiding any future-value language or unsupported claims while maintaining precision and relevance.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "expert",
      noContextMode: false,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.cleanedBodySelection.selectedCandidate).not.toBeNull();
    expect(trace.finalOutput).toContain(
      "At Robert Cooper Security Guard, I reduced theft by 73% through improved vigilance and installed 15 360-degree CCTV cameras to enhance monitoring.",
    );
    expect(trace.finalOutput).toContain(
      "I also introduced X-ray scanning systems and improved access control, reducing unauthorized entry by 26%.",
    );
    expect(trace.finalOutput).not.toContain(
      "Here is the tailored employment cover letter",
    );
    expect(trace.finalOutput).not.toContain(
      "This letter adheres to the strict boundaries provided",
    );
  });

  it("keeps sentence-start employer evidence for security cover letters without metrics", () => {
    const trace = inspectProposalFinalization({
      content: [
        "Eight years of experience protecting VIPs in high-stakes military and defense environments has honed my ability to monitor surroundings with precision, detecting both human and non-human threats before they escalate. At ADT Security, this vigilance translated into structured patrol protocols-logging into headquarters hourly during day shifts and every two hours at night to ensure real-time threat assessment and rapid notification of anomalies. That disciplined approach to surveillance and incident documentation aligns with the airport's need for systematic access control, restricted-area monitoring, and clear communication under pressure.",
        "",
        "My background in criminal justice and hands-on training in restraining devices and physical combat further grounds my readiness to respond to disturbances calmly, as required for managing crowd flow and traffic control in a dynamic airport setting. Currently completing a Bachelor's degree, I bring both operational experience and a commitment to evolving security standards-qualities that complement the structured, protocol-driven environment described in the role. The opportunity to discuss how this experience applies to your team's specific patrol routes, emergency response procedures, or coordination with government operations would be welcome.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "expert",
      noContextMode: false,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.cleanedBodySelection.selectedCandidate).not.toBeNull();
    expect(trace.finalOutput).toContain("At ADT Security");
    expect(trace.finalOutput).toContain("structured patrol protocols");
    expect(trace.finalOutput).not.toContain(
      "The opportunity to discuss how this experience applies",
    );
  });

  it("preserves a richer cv-backed signature body with explicit employer-facing relevance", () => {
    const trace = inspectProposalFinalization({
      content: [
        "I have spent eight years protecting VIP individuals in military and defense environments, where vigilance, access discipline, and calm judgment were part of daily work.",
        "",
        "I installed 15 360-degree CCTV cameras and an X-ray scanning system, improving monitoring and reducing unauthorized access by 26%.",
        "",
        "This background is relevant to hospitality security work that depends on visible deterrence, detailed incident discipline, and steady guest-facing professionalism across a busy property.",
        "",
        "I would welcome the opportunity to discuss the role further.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.finalOutput).toContain(
      "I have spent eight years protecting VIP individuals in military and defense environments, where vigilance, access discipline, and calm judgment were part of daily work.",
    );
    expect(trace.finalOutput).toContain(
      "I installed 15 360-degree CCTV cameras and an X-ray scanning system, improving monitoring and reducing unauthorized access by 26%.",
    );
    expect(trace.finalOutput).toContain(
      "This background is relevant to hospitality security work that depends on visible deterrence, detailed incident discipline, and steady guest-facing professionalism across a busy property.",
    );
    expect(trace.substantiveBodyAssertion?.passed).toBe(true);
  });

  it("recovers a wrapped engaging cv draft when the inner body is saveable", () => {
    const trace = inspectProposalFinalization({
      content: [
        "Here’s a tailored cover letter based on the provided constraints and candidate background:",
        "",
        "---",
        "",
        "As a Research Associate with experience in business analytics, data mining, and predictive analysis, I have worked with structured data to derive actionable insights. My certification as a Python Developer and my work in data modeling have also required organizing technical information clearly for decision-making.",
        "",
        "I would welcome the opportunity to discuss the position further.",
        "",
        "---",
        "",
        "This version adheres to the strict constraints, avoids forbidden language, and focuses on concrete evidence while maintaining a warm, professional tone.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Stella Thatcher",
      voicePreset: "engaging",
      noContextMode: false,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.cleanedBodySelection.selectedCandidate).not.toBeNull();
    expect(trace.finalOutput).toContain(
      "As a Research Associate with experience in business analytics, data mining, and predictive analysis, I have worked with structured data to derive actionable insights.",
    );
    expect(trace.finalOutput).not.toContain(
      "Here’s a tailored cover letter based on the provided constraints and candidate background:",
    );
    expect(trace.finalOutput).not.toContain(
      "This version adheres to the strict constraints",
    );
  });

  it("still fails closed for a wrapped distant-role cv draft when the recovered body is too weak", () => {
    const trace = inspectProposalFinalization({
      content: [
        "Here’s a tailored cover letter for the Marketing & Business Development Specialist role at Hogan Lovells, grounded in the candidate’s background and the job requirements:",
        "",
        "---",
        "",
        "At Robert Cooper Security Guard, I decreased theft by 73% through vigilance and introduced systems like X-ray scanning and CCTV monitoring to enhance detection.",
        "",
        "My interest in marketing and business development, combined with a focus on operational efficiency, could contribute to maintaining marketing collateral, tracking client engagement, and supporting pitch coordination.",
        "",
        "---",
        "",
        "This version avoids forbidden language, stays within the allowed concrete facts, and uses transferable traits cautiously.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "storyteller",
      noContextMode: false,
    });

    expect(trace.failureStage).toBe("cleaned_body_selection");
    expect(trace.errorMessage).toMatch(/substantive body content/i);
    expect(trace.cleanedBodySelection.aggressive.candidate).toContain(
      "At Robert Cooper Security Guard, I decreased theft by 73%",
    );
    expect(trace.cleanedBodySelection.aggressive.candidate).not.toContain(
      "Here’s a tailored cover letter for the Marketing & Business Development Specialist role at Hogan Lovells",
    );
  });

  it("still rejects a single fact sentence plus deterministic close under legacy thin acceptance", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content:
          "I developed a REST API using FastAPI and PostgreSQL to store data from learning management systems.",
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: "Jake Ryan",
        voicePreset: "signature",
        noContextMode: false,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("fails closed instead of rendering an empty-shell cover letter", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "Dear Hiring Manager,",
          "",
          "I would welcome the opportunity to discuss the position further.",
          "",
          "Sincerely,",
          "Board Ramanathapuram",
        ].join("\n"),
        format: "cover_letter",
        outputLanguage: "English",
        candidateName: "Board Ramanathapuram",
        voicePreset: "signature",
        noContextMode: false,
      }),
    ).toThrow(/Cleanup removed all substantive body content/);
  });

  it("strips word-count lines and freelance wrapper text before persistence", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "Here’s a concise proposal for your B2B SaaS landing page redesign:",
        "",
        "(Word count: 160)",
        "",
        "I can audit the current landing page, tighten the copy hierarchy, and deliver a concise first-pass rewrite tailored to the product positioning.",
      ].join("\n"),
      format: "freelance_proposal",
      outputLanguage: "English",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(saved).toBe(
      "I can audit the current landing page, tighten the copy hierarchy, and deliver a concise first-pass rewrite tailored to the product positioning.",
    );
    expect(saved).not.toContain("Word count");
    expect(saved).not.toContain("Here’s a concise proposal");
  });

  it("drops numeric OCR-style residue while preserving the remaining cover-letter body", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "I handled client documentation and financial analysis in finance roles.",
        "",
        "I also supported records review and day-to-day coordination for client files.",
        "",
        "8 month work experience in Home Credit India Finance Pvt.",
        "",
        "7 month work experience in Hi-tech Pvt.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Atul Singh",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(saved).toContain(
      "I handled client documentation and financial analysis in finance roles.",
    );
    expect(saved).not.toContain("8 month work experience");
    expect(saved).not.toContain("7 month work experience");
  });

  it("removes standalone cover-letter headers from saved cv outputs", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "Dear Hiring Manager,",
        "",
        "Cover Letter for Security Officer Position",
        "",
        "I have experience in investigation skills, safety compliance, and criminal justice. At Robert Cooper Security Guard in Los Angeles, I reduced unauthorized entry by 26% through improved access control and decreased theft by 73% by enhancing monitoring procedures.",
        "",
        "I am familiar with the importance of emergency drills and staff safety training, and I understand the role’s emphasis on disaster preparedness.",
        "",
        "I would welcome the opportunity to discuss the position further.",
        "",
        "Best regards,",
        "Robert Cooper",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(saved).toContain(
      "I have experience in investigation skills, safety compliance, and criminal justice.",
    );
    expect(saved).toContain(
      "At Robert Cooper Security Guard in Los Angeles, I reduced unauthorized entry by 26% through improved access control and decreased theft by 73% by enhancing monitoring procedures.",
    );
    expect(saved).not.toContain("Cover Letter for Security Officer Position");
  });

  it("removes weak transfer phrasing from saved cover letters when factual proof remains", () => {
    const saved = applyFinalSavedOutputBridgeGuard({
      content: [
        "I developed REST APIs using FastAPI and PostgreSQL.",
        "",
        "The role's emphasis on evaluating developer tooling is particularly compelling.",
        "",
        "That background resonates with the work described here.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
    });

    expect(saved).toContain(
      "I developed REST APIs using FastAPI and PostgreSQL.",
    );
    expect(saved).not.toContain("particularly compelling");
    expect(saved).not.toContain("resonates with");
  });

  it("dedupes repeated evidence when the same fact returns in a different sentence shape", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "I’ve designed and maintained APIs using FastAPI and PostgreSQL, handling data validation, security, and performance optimizations.",
        "",
        "Developed a REST API using FastAPI and PostgreSQL to store data from learning management systems.",
        "",
        "Additionally, contributed over 50,000 lines of code to a collaborative codebase.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Jake Ryan",
      voicePreset: "storyteller",
      noContextMode: false,
    });

    expect(saved).toContain(
      "I’ve designed and maintained APIs using FastAPI and PostgreSQL, handling data validation, security, and performance optimizations.",
    );
    expect(saved).not.toContain(
      "Developed a REST API using FastAPI and PostgreSQL to store data from learning management systems.",
    );
    expect(saved).toContain("50,000 lines of code");
  });

  it("drops orphan noun-phrase endings and clipped factual continuations during finalization", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "I reduced theft by 73% through improved vigilance strategies.",
        "",
        "I documented incidents clearly for hotel operations.",
        "",
        "This required attention to detail and problem-solving—qualities.",
        "",
        "The 15 360-degree CCTV cameras I installed to enhance monitoring procedures.",
        "",
        "My troubleshooting background supports calm incident response, a skill.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(saved).toContain(
      "I reduced theft by 73% through improved vigilance strategies.",
    );
    expect(saved).not.toContain("problem-solving—qualities.");
    expect(saved).not.toContain(
      "The 15 360-degree CCTV cameras I installed to enhance monitoring procedures.",
    );
    expect(saved).not.toContain("a skill.");
  });

  it("drops contracted determiner-continuation fragments during finalization", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "I reduced theft by 73% through improved vigilance strategies.",
        "",
        "I documented incidents clearly for hotel operations.",
        "",
        "My work in loss prevention aligns with the hotel's focus on guest safety and operational security.",
        "",
        "The structured protocols I've developed for access control and monitoring.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(saved).toContain(
      "I reduced theft by 73% through improved vigilance strategies.",
    );
    expect(saved).toContain(
      "I documented incidents clearly for hotel operations.",
    );
    expect(saved).not.toContain(
      "The structured protocols I've developed for access control and monitoring.",
    );
  });

  it("drops truncated conjunction residue before saving the finalized cover letter", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "I reduced theft by 73% through improved vigilance strategies.",
        "",
        "Introduced X-ray scanning systems at key entry points and….",
        "",
        "I documented incidents clearly for hotel operations.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(saved).toContain(
      "I reduced theft by 73% through improved vigilance strategies.",
    );
    expect(saved).toContain(
      "I documented incidents clearly for hotel operations.",
    );
    expect(saved).not.toContain("and….");
    expect(saved).not.toMatch(/\band[.…]+/i);
  });

  it("drops bare noun-phrase skill tails during finalization", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "At Robert Cooper Security Guard, I reduced theft by 73% through improved vigilance.",
        "",
        "Investigation skills.",
        "",
        "I documented incidents clearly for hotel operations and maintained incident logs for supervisors.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(saved).toContain(
      "At Robert Cooper Security Guard, I reduced theft by 73% through improved vigilance.",
    );
    expect(saved).toContain(
      "I documented incidents clearly for hotel operations and maintained incident logs for supervisors.",
    );
    expect(saved).not.toContain("Investigation skills.");
  });

  it("drops orphan em-dash area tails during finalization", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "At Robert Cooper Security Guard, I reduced unauthorized entry by 26% through improved access control protocols.",
        "",
        "As a security professional with a background in investigation and safety compliance, I’ve developed skills in proactive threat monitoring and incident management—areas.",
        "",
        "I also documented incidents clearly for supervisors and hotel operations.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "storyteller",
      noContextMode: false,
    });

    expect(saved).toContain(
      "At Robert Cooper Security Guard, I reduced unauthorized entry by 26% through improved access control protocols.",
    );
    expect(saved).toContain(
      "I also documented incidents clearly for supervisors and hotel operations.",
    );
    expect(saved).not.toContain("incident management—areas.");
  });

  it("drops truncated ellipsis tail fragments during finalization", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "At Robert Cooper Security Guard, I reduced theft by 73% through improved vigilance and installed 15 360-degree CCTV cameras to enhance detection.",
        "",
        "Improved access control, which reduced unauthorized entry and solicitation by 26% using an announcement notif….",
        "",
        "Decreased theft of hotel items like linen, towels, decor pieces, and cutlery by 73% by improving vigilance st….",
        "",
        "I documented incidents clearly for hotel operations and maintained incident logs for supervisors.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "expert",
      noContextMode: false,
    });

    expect(saved).toContain(
      "At Robert Cooper Security Guard, I reduced theft by 73% through improved vigilance and installed 15 360-degree CCTV cameras to enhance detection.",
    );
    expect(saved).toContain(
      "I documented incidents clearly for hotel operations and maintained incident logs for supervisors.",
    );
    expect(saved).not.toContain("announcement notif….");
    expect(saved).not.toContain("vigilance st….");
  });

  it("drops an orphan role-location fragment survivor during cv finalization", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "With a background in project management and international recruitment, I have developed a keen eye for detail and a structured approach to complex workflows.",
        "",
        "The role at WilsonAI.",
        "",
        "My time in Paris and Washington D. C. involved managing diverse teams and projects, requiring both aesthetic sensitivity and operational discipline.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Marion Bonnet",
      voicePreset: "expert",
      noContextMode: false,
    });

    expect(saved).toContain(
      "With a background in project management and international recruitment, I have developed a keen eye for detail and a structured approach to complex workflows.",
    );
    expect(saved).toContain(
      "My time in Paris and Washington D. C. involved managing diverse teams and projects, requiring both aesthetic sensitivity and operational discipline.",
    );
    expect(saved).not.toContain("The role at WilsonAI.");
  });

  it("drops an orphan client-location fragment survivor during cv finalization", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "With a background in project management and international recruitment, I’ve developed a keen eye for detail and a structured approach to complex workflows.",
        "",
        "Working directly with clients in Paris and Washington D. C.",
        "",
        "My project management experience has involved collaborating with technical teams across complex workstreams.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Marion Bonnet",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(saved).toContain(
      "With a background in project management and international recruitment, I’ve developed a keen eye for detail and a structured approach to complex workflows.",
    );
    expect(saved).toContain(
      "My project management experience has involved collaborating with technical teams across complex workstreams.",
    );
    expect(saved).not.toContain(
      "Working directly with clients in Paris and Washington D. C.",
    );
  });

  it("drops could-offer-relevant-perspective bridge sentences without a factual prefix", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "At Robert Cooper Security Guard, I reduced theft by 73% through enhanced vigilance and installed 15 360-degree CCTV cameras to improve detection.",
        "",
        "I documented incidents clearly for hotel operations and maintained incident logs for supervisors.",
        "",
        "My criminal justice knowledge and hands-on experience in loss prevention could offer relevant perspective for emergency drills and incident management.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "storyteller",
      noContextMode: false,
    });

    expect(saved).toContain(
      "At Robert Cooper Security Guard, I reduced theft by 73% through enhanced vigilance and installed 15 360-degree CCTV cameras to improve detection.",
    );
    expect(saved).toContain(
      "I documented incidents clearly for hotel operations and maintained incident logs for supervisors.",
    );
    expect(saved).not.toContain("could offer relevant perspective");
    expect(saved).not.toContain(
      "My criminal justice knowledge and hands-on experience in loss prevention",
    );
  });

  it("drops align-with-required-for-this-role bridge sentences without a factual prefix", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "At Robert Cooper Security Guard, I reduced theft by 73% through enhanced vigilance and installed 15 360-degree CCTV cameras to improve detection.",
        "",
        "I documented incidents clearly for hotel operations and maintained incident logs for supervisors.",
        "",
        "These skills in safety compliance and troubleshooting align with the proactive patrols and threat monitoring required for this role.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "storyteller",
      noContextMode: false,
    });

    expect(saved).toContain(
      "At Robert Cooper Security Guard, I reduced theft by 73% through enhanced vigilance and installed 15 360-degree CCTV cameras to improve detection.",
    );
    expect(saved).toContain(
      "I documented incidents clearly for hotel operations and maintained incident logs for supervisors.",
    );
    expect(saved).not.toContain(
      "align with the proactive patrols and threat monitoring required for this role",
    );
    expect(saved).not.toContain(
      "These skills in safety compliance and troubleshooting",
    );
  });

  it("preserves factual prefixes when role-emphasis alignment bridges appear", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "At Robert Cooper Security Guard, I reduced theft by 73% through improved vigilance and installed 15 360-degree CCTV cameras to enhance monitoring.",
        "",
        "I am familiar with security systems and incident management, which aligns with the role’s emphasis on emergency drills and staff safety training.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(saved).toContain(
      "At Robert Cooper Security Guard, I reduced theft by 73% through improved vigilance and installed 15 360-degree CCTV cameras to enhance monitoring.",
    );
    expect(saved).toContain(
      "I am familiar with security systems and incident management.",
    );
    expect(saved).not.toContain("aligns with the role’s emphasis");
  });

  it("drops these-experiences alignment bridges from saved cv outputs", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "Robert Cooper here, a security professional with a focus on investigation skills and safety compliance.",
        "",
        "At Robert Cooper Security Guard in Los Angeles, I specialized in loss prevention and access control, implementing strategies that reduced theft by 73% and unauthorized entry by 26%.",
        "",
        "My background in criminal justice and troubleshooting allowed me to enhance monitoring procedures, including the installation of 360-degree CCTV cameras and X-ray scanning systems.",
        "",
        "These experiences align with the proactive patrols and threat monitoring required for the Security Officer role at Ascension St. Vincent’s Riverside Hospital.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "storyteller",
      noContextMode: false,
    });

    expect(saved).toContain(
      "At Robert Cooper Security Guard in Los Angeles, I specialized in loss prevention and access control, implementing strategies that reduced theft by 73% and unauthorized entry by 26%.",
    );
    expect(saved).toContain(
      "My background in criminal justice and troubleshooting allowed me to enhance monitoring procedures, including the installation of 360-degree CCTV cameras and X-ray scanning systems.",
    );
    expect(saved).not.toContain(
      "These experiences align with the proactive patrols and threat monitoring required for the Security Officer role",
    );
  });

  it("drops relevance-to-responsibilities bridge sentences without a factual prefix", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "At Robert Cooper Security Guard, I reduced theft by 73% through improved vigilance and installed 15 360-degree CCTV cameras to enhance detection.",
        "",
        "I documented incidents clearly for hotel operations and maintained incident logs for supervisors.",
        "",
        "My criminal justice knowledge and troubleshooting skills are relevant to the responsibilities of emergency drills, staff training, and threat monitoring.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "expert",
      noContextMode: false,
    });

    expect(saved).toContain(
      "At Robert Cooper Security Guard, I reduced theft by 73% through improved vigilance and installed 15 360-degree CCTV cameras to enhance detection.",
    );
    expect(saved).toContain(
      "I documented incidents clearly for hotel operations and maintained incident logs for supervisors.",
    );
    expect(saved).not.toContain(
      "relevant to the responsibilities of emergency drills",
    );
    expect(saved).not.toContain(
      "My criminal justice knowledge and troubleshooting skills",
    );
  });

  it("preserves factual prefixes for may-offer-a-relevant-perspective bridges", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "At Robert Cooper Security Guard, I reduced theft by 73% through improved vigilance and installed 15 360-degree CCTV cameras to enhance detection.",
        "",
        "I am familiar with safety compliance and disaster preparedness, which may offer a relevant perspective for maintaining a secure environment at Ascension.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "expert",
      noContextMode: false,
    });

    expect(saved).toContain(
      "At Robert Cooper Security Guard, I reduced theft by 73% through improved vigilance and installed 15 360-degree CCTV cameras to enhance detection.",
    );
    expect(saved).toContain(
      "I am familiar with safety compliance and disaster preparedness.",
    );
    expect(saved).not.toContain("may offer a relevant perspective");
  });

  it("drops team-focus relevance bridges without a factual prefix", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "At Robert Cooper Security Guard, I reduced unauthorized entry by 26% through improved access control protocols and implemented loss prevention systems that decreased theft by 73%.",
        "",
        "I documented incidents clearly for hotel operations and maintained incident logs for supervisors.",
        "",
        "My experience in troubleshooting and criminal justice knowledge would be relevant to your team’s focus on emergency drills and staff safety training.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "storyteller",
      noContextMode: false,
    });

    expect(saved).toContain(
      "At Robert Cooper Security Guard, I reduced unauthorized entry by 26% through improved access control protocols and implemented loss prevention systems that decreased theft by 73%.",
    );
    expect(saved).toContain(
      "I documented incidents clearly for hotel operations and maintained incident logs for supervisors.",
    );
    expect(saved).not.toContain(
      "would be relevant to your team’s focus on emergency drills and staff safety training",
    );
    expect(saved).not.toContain(
      "My experience in troubleshooting and criminal justice knowledge",
    );
  });

  it("drops managing-relevance bridge sentences from saved cv outputs", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "I have experience in security and loss prevention, including reducing theft by 73% through improved vigilance and installing CCTV systems.",
        "",
        "At Robert Cooper Security Guard, I enhanced access control and reduced unauthorized entry by 26%, demonstrating my ability to protect diverse environments.",
        "",
        "My investigative skills and troubleshooting experience would be relevant to managing security incidents at Ascension St. Vincent’s Riverside Hospital.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(saved).toContain(
      "I have experience in security and loss prevention, including reducing theft by 73% through improved vigilance and installing CCTV systems.",
    );
    expect(saved).toContain(
      "At Robert Cooper Security Guard, I enhanced access control and reduced unauthorized entry by 26%, demonstrating my ability to protect diverse environments.",
    );
    expect(saved).not.toContain(
      "would be relevant to managing security incidents",
    );
  });

  it("drops apply-these-skills opportunity bridges without a factual prefix", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "At Robert Cooper Security Guard, I decreased theft of hotel items by 73% through improved vigilance and monitoring procedures.",
        "",
        "I also enhanced detection systems by installing 360-degree CCTV cameras and X-ray scanning systems, which reduced unauthorized entry by 26%.",
        "",
        "The role at Ascension St. Vincent’s Riverside Hospital presents an opportunity to apply these skills in a healthcare setting, where safety and preparedness are critical.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(saved).toContain(
      "At Robert Cooper Security Guard, I decreased theft of hotel items by 73% through improved vigilance and monitoring procedures.",
    );
    expect(saved).toContain(
      "I also enhanced detection systems by installing 360-degree CCTV cameras and X-ray scanning systems, which reduced unauthorized entry by 26%.",
    );
    expect(saved).not.toContain(
      "presents an opportunity to apply these skills in a healthcare setting",
    );
  });

  it("normalizes third-person candidate narration back to first person in saved cover letters", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "As a Research Associate with experience in data mining, she has worked with complex datasets to generate actionable insights.",
        "",
        "Collaborating with stakeholders to define objectives and ensure data accuracy is a key part of her approach.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Stella Thatcher",
      voicePreset: "engaging",
      noContextMode: false,
    });

    expect(saved).toContain(
      "As a Research Associate with experience in data mining, I have worked with complex datasets to generate actionable insights.",
    );
    expect(saved).toContain(
      "Collaborating with stakeholders to define objectives and ensure data accuracy is a key part of my approach.",
    );
    expect(saved).not.toMatch(/\bshe has\b/i);
    expect(saved).not.toMatch(/\bher approach\b/i);
  });

  it("capitalizes repaired sentence restarts after writer-discipline normalization", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "As a Research Associate with a background in Business Analytics, I have developed a strong foundation in quantitative research and data-driven decision-making.",
        "",
        "my certification as a Python Developer demonstrates my ability to leverage data and analytical tools to support market research initiatives.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Stella Thatcher",
      voicePreset: "storyteller",
      noContextMode: false,
    });

    expect(saved).toContain(
      "My certification as a Python Developer demonstrates my ability to leverage data and analytical tools to support market research initiatives.",
    );
    expect(saved).not.toContain("\n\nmy certification");
  });

  it("drops incomplete trailing-clause survivors during finalization", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "The responsibilities—managing research projects, coordinating cross-functional teams, and synthesizing complex data into actionable insights—align with the need for structured analytical work and clear communication.",
        "",
        "The emphasis on survey design, stakeholder coordination, and clear reporting reflects a workflow that depends on precision and consistency.",
        "",
        "Working with Fortune 500 companies to improve customer experience through quantitative analytics is.",
        "",
        "I look forward to discussing how my background.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "storyteller",
      noContextMode: true,
    });

    expect(saved).toContain(
      "The responsibilities—managing research projects, coordinating cross-functional teams, and synthesizing complex data into actionable insights—align with the need for structured analytical work and clear communication.",
    );
    expect(saved).toContain(
      "The emphasis on survey design, stakeholder coordination, and clear reporting reflects a workflow that depends on precision and consistency.",
    );
    expect(saved).not.toContain(
      "Working with Fortune 500 companies to improve customer experience through quantitative analytics is.",
    );
    expect(saved).not.toContain(
      "I look forward to discussing how my background.",
    );
  });

  it("fails closed for weak no-context admiration and pseudo-capability shells while preserving rich traces", () => {
    const content = [
      "The opportunity to work in a resort-style setting with indoor and outdoor duties is particularly compelling.",
      "",
      "The physical demands of the role, including patrolling large areas and lifting up to 50 lbs, are well within my capabilities.",
      "",
      "I would welcome the chance to discuss my interest in the role.",
    ].join("\n");
    const trace = inspectProposalFinalization({
      content,
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "expert",
      noContextMode: true,
    });

    expect(trace.rawGeneratedBody).toBe(content);
    expect(trace.finalOutput).toBeUndefined();
    expect(trace.failureStage).toBe("cleaned_body_selection");
    expect(trace.cleanedBodySelection.selectedCandidate).toBeNull();
    expect(trace.cleanedBodySelection.selectedBody).toBeNull();
    expect(trace.cleanedBodySelection.aggressive.saveableSentences).toEqual([]);
    expect(trace.cleanedBodySelection.conservative.saveableSentences).toEqual(
      [],
    );
    expect(trace.noContextLeadCleanup).toBeUndefined();
    expect(trace.finalSavedOutputBridgeCleanup).toBeUndefined();
  });

  it("drops title-like role fragments and troubleshooting residue from cv-backed outputs", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "Decreased theft of hotel items by 73% through improved vigilance and monitoring procedures.",
        "",
        "The Security Officer position at Hyatt Regency Mission Bay Spa and Marina.",
        "",
        "troubleshooting.",
        "",
        "Improved access control by reducing unauthorized entry and solicitation by 26% through enhanced notification systems.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "expert",
      noContextMode: false,
    });

    expect(saved).toContain(
      "Decreased theft of hotel items by 73% through improved vigilance and monitoring procedures.",
    );
    expect(saved).toContain(
      "Improved access control by reducing unauthorized entry and solicitation by 26% through enhanced notification systems.",
    );
    expect(saved).not.toContain(
      "The Security Officer position at Hyatt Regency Mission Bay Spa and Marina.",
    );
    expect(saved).not.toContain("troubleshooting.");
  });

  it("drops unsupported duration availability physical-capability and jd-only familiarity claims from cv-backed outputs", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "Decreased theft of hotel items by 73% through improved vigilance and monitoring procedures.",
        "",
        "Improved access control by reducing unauthorized entry and solicitation by 26% through enhanced notification systems.",
        "",
        "I’ve spent years specializing in investigation skills and security work.",
        "",
        "I am available to work flexible shifts, including mornings, evenings, overnights, weekends, and holidays.",
        "",
        "I have experience patrolling large areas, monitoring surveillance systems, responding to incidents, and lifting up to 50 lbs.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "direct",
      noContextMode: false,
    });

    expect(saved).toContain(
      "Decreased theft of hotel items by 73% through improved vigilance and monitoring procedures.",
    );
    expect(saved).toContain(
      "Improved access control by reducing unauthorized entry and solicitation by 26% through enhanced notification systems.",
    );
    expect(saved).not.toContain("I’ve spent years");
    expect(saved).not.toContain("available to work flexible shifts");
    expect(saved).not.toContain("patrolling large areas");
    expect(saved).not.toContain("monitoring surveillance systems");
    expect(saved).not.toContain("lifting up to 50 lbs");
  });

  it("drops may-assist and may-apply bridge variants from saved cv outputs", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "As a Research Associate with experience in business analytics and data mining, I have worked with structured data to derive actionable insights.",
        "",
        "My certification as a Python Developer demonstrates my ability to leverage data tools for technical analysis and reporting.",
        "",
        "My proficiency in Python and data modeling may assist in tracking metrics, optimizing campaigns, and refining processes.",
        "",
        "That analytical background may apply to this position.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Stella Thatcher",
      voicePreset: "expert",
      noContextMode: false,
    });

    expect(saved).toContain(
      "As a Research Associate with experience in business analytics and data mining, I have worked with structured data to derive actionable insights.",
    );
    expect(saved).toContain(
      "My certification as a Python Developer demonstrates my ability to leverage data tools for technical analysis and reporting.",
    );
    expect(saved).not.toContain("may assist in tracking metrics");
    expect(saved).not.toContain("may apply to this position");
  });

  it("rescues grounded no-context job-understanding bodies after dropping scenic filler and jd-mirroring anywhere in the body", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "The responsibilities of patrolling the property, monitoring surveillance systems, and responding to incidents reflect the importance of vigilance and professionalism in hospitality security.",
        "",
        "Collaborating with other departments to address safety concerns would allow for a coordinated approach to maintaining order and compliance with hotel policies.",
        "",
        "The property’s vibrant location near SeaWorld and its resort-style amenities create an engaging setting.",
        "",
        "The flexible scheduling, including evenings, overnights, and holidays, underscores the commitment to maintaining safety around the clock.",
        "",
        "Assisting with guest services and package handling highlights the service-oriented demands of the role.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "expert",
      noContextMode: true,
    });

    expect(saved).toContain(
      "The responsibilities of patrolling the property, monitoring surveillance systems, and responding to incidents reflect the importance of vigilance and professionalism in hospitality security.",
    );
    expect(saved).toContain(
      "Collaborating with other departments to address safety concerns would allow for a coordinated approach to maintaining order and compliance with hotel policies.",
    );
    expect(saved).not.toContain("SeaWorld");
    expect(saved).not.toContain("resort-style amenities");
    expect(saved).not.toContain("evenings, overnights, and holidays");
    expect(saved).not.toContain("package handling");
  });

  it("preserves grounded no-context work-surface content when bridge cleanup would otherwise remove the last body sentences", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The combination of indoor and outdoor patrols, emergency response, and surveillance monitoring aligns with my interest in maintaining secure and welcoming spaces for guests and staff.",
        "",
        "The collaborative nature of the role, including coordination with other departments and incident reporting, aligns with my interest in clear operational communication.",
        "",
        "The resort’s vibrant location and waterfront amenities create an engaging setting where professionalism matters.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "engaging",
      noContextMode: true,
    });

    expect(trace.cleanedBodySelection.aggressive.saveableSentenceCount).toBe(2);
    expect(
      trace.cleanedBodySelection.aggressive.groundedOperationalSentenceCount,
    ).toBe(2);
    expect(
      trace.cleanedBodySelection.aggressive.groundedSupportSentenceCount,
    ).toBe(2);
    expect(trace.failureStage).toBeUndefined();
    expect(trace.finalSavedOutputBridgeCleanup?.after).toContain(
      "The role involves indoor and outdoor patrols, emergency response, and surveillance monitoring.",
    );
    expect(trace.finalSavedOutputBridgeCleanup?.after).toContain(
      "The role also involves coordination with other departments and incident reporting.",
    );
    expect(trace.finalSavedOutputBridgeCleanup?.removedSentenceTexts).toEqual([
      "The combination of indoor and outdoor patrols, emergency response, and surveillance monitoring aligns with my interest in maintaining secure and welcoming spaces for guests and staff.",
      "The collaborative nature of the role, including coordination with other departments and incident reporting, aligns with my interest in clear operational communication.",
    ]);
    expect(
      trace.finalSavedOutputBridgeCleanup?.removedLastGroundedSentence,
    ).toBe(false);
    expect(trace.finalOutput).toContain(
      "The role involves indoor and outdoor patrols, emergency response, and surveillance monitoring.",
    );
    expect(trace.finalOutput).toContain(
      "The role also involves coordination with other departments and incident reporting.",
    );
    expect(trace.finalOutput).not.toContain(
      "aligns with my interest in maintaining secure and welcoming spaces",
    );
    expect(trace.finalOutput).not.toContain(
      "aligns with my interest in clear operational communication",
    );
  });

  it("preserves grounded no-context emphasis content when bridge cleanup would otherwise drop the last usable sentence", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The emphasis on emergency preparedness, staff safety, and proactive threat monitoring aligns with a commitment to maintaining secure and orderly operations.",
        "",
        "The role also involves coordination with other departments and incident reporting.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "storyteller",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.finalSavedOutputBridgeCleanup?.after).toContain(
      "The role places emphasis on emergency preparedness, staff safety, and proactive threat monitoring.",
    );
    expect(trace.finalSavedOutputBridgeCleanup?.after).toContain(
      "The role also involves coordination with other departments and incident reporting.",
    );
    expect(trace.finalOutput).toContain(
      "The role places emphasis on emergency preparedness, staff safety, and proactive threat monitoring.",
    );
    expect(trace.finalOutput).toContain(
      "The role also involves coordination with other departments and incident reporting.",
    );
    expect(trace.finalOutput).not.toContain(
      "aligns with a commitment to maintaining secure and orderly operations",
    );
  });

  it("rescues cv-backed grounded bodies with two usable operational sentences at cleaned-body selection", () => {
    const trace = inspectProposalFinalization({
      content: [
        "Supervision of wire harness and control panel production across hotel engineering operations.",
        "",
        "Coordination of preventive maintenance documentation, vendor follow-up, and equipment reviews across property operations.",
        "",
        "I would welcome the opportunity to discuss how this background could support your team.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.cleanedBodySelection.selectedCandidate).toBe("rescued");
    expect(trace.finalOutput).toContain(
      "Supervision of wire harness and control panel production across hotel engineering operations.",
    );
    expect(trace.finalOutput).toContain(
      "Coordination of preventive maintenance documentation, vendor follow-up, and equipment reviews across property operations.",
    );
    expect(trace.finalOutput).not.toContain("support your team");
  });

  it("preserves grounded no-context cover letters with entity names containing initials and periods", () => {
    const trace = inspectProposalFinalization({
      content: [
        "At A. B. May, the workflow involves coordinating plumbing service calls, documenting work orders, and communicating clearly with customers and technicians.",
        "",
        "The role also depends on organized scheduling, dispatch follow-through, and accurate service documentation across day-to-day operations.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "expert",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.finalOutput).toContain(
      "At A. B. May, the workflow involves coordinating plumbing service calls, documenting work orders, and communicating clearly with customers and technicians.",
    );
    expect(trace.finalOutput).toContain(
      "The role also depends on organized scheduling, dispatch follow-through, and accurate service documentation across day-to-day operations.",
    );
    expect(trace.substantiveBodyAssertion?.passed).toBe(true);
  });

  it("allows modest but grounded no-context signature plumbing bodies to survive substantive body assertion", () => {
    const trace = inspectProposalFinalization({
      content: [
        "At A. B. May, the workflow involves coordinating plumbing service calls, keeping work orders organized, and dispatching technicians across the day.",
        "",
        "The role also depends on operational precision and steady follow-through across a busy service day.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.finalOutput).toContain(
      "At A. B. May, the workflow involves coordinating plumbing service calls, keeping work orders organized, and dispatching technicians across the day.",
    );
    expect(trace.finalOutput).toContain(
      "The role also depends on operational precision and steady follow-through across a busy service day.",
    );
    expect(trace.substantiveBodyAssertion?.passed).toBe(true);
  });

  it("allows modest grounded no-context workflow-reliance support sentences to survive finalization", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The workflow involves coordinating service calls, documenting work orders, and dispatching technicians across the day.",
        "",
        "That workflow also relies on clear communication, documentation accuracy, and steady follow-through between customers and technicians.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.finalOutput).toContain(
      "The workflow involves coordinating service calls, documenting work orders, and dispatching technicians across the day.",
    );
    expect(trace.finalOutput).toContain(
      "That workflow also relies on clear communication, documentation accuracy, and steady follow-through between customers and technicians.",
    );
    expect(trace.substantiveBodyAssertion?.passed).toBe(true);
  });

  it("preserves grounded no-context plumbing bodies that add operational consequence instead of appreciation", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The role involves coordinating residential plumbing service calls, keeping work orders accurate, and dispatching technicians across the day.",
        "",
        "Clear communication matters because the work depends on updating homeowners, confirming scheduling changes, and documenting follow-up accurately after each service visit.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.finalOutput).toContain(
      "The role involves coordinating residential plumbing service calls, keeping work orders accurate, and dispatching technicians across the day.",
    );
    expect(trace.finalOutput).toContain(
      "Clear communication matters because the work depends on updating homeowners, confirming scheduling changes, and documenting follow-up accurately after each service visit.",
    );
    expect(trace.substantiveBodyAssertion?.passed).toBe(true);
  });

  it("drops no-context first-person ability fragments after removing weak interest filler", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The Service Coordinator role at [Company Name] involves managing residential plumbing service calls with precision and coordination. Keeping work orders accurate and dispatching technicians efficiently ensures homes receive timely service, while clear communication with homeowners and field teams helps resolve issues smoothly. The detail-oriented nature of this work requires tracking follow-up to maintain service continuity and meet deadlines.",
        "",
        "I'm interested in the structured coordination this role demands, particularly the balance between administrative accuracy and on-the-ground responsiveness. My ability to prioritize tasks while maintaining clear communication.",
        "",
        "I would welcome the opportunity to discuss my interest in the role.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });

    expect(trace.failureStage).toBeUndefined();
    expect(trace.noContextLeadCleanup?.removedSentences).toContain(
      "I'm interested in the structured coordination this role demands, particularly the balance between administrative accuracy and on-the-ground responsiveness.",
    );
    expect(trace.finalOutput).not.toContain(
      "My ability to prioritize tasks while maintaining clear communication.",
    );
    expect(trace.finalOutput).toContain(
      "The detail-oriented nature of this work requires tracking follow-up to maintain service continuity and meet deadlines.",
    );
    expect(trace.substantiveBodyAssertion?.passed).toBe(true);
  });

  it("fails closed for no-context jd-summary plus appreciation shells", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "Residential plumbing work requires precision and adaptability, especially when diagnosing issues in tight spaces like crawl spaces or attics.",
          "",
          "I understand the importance of clear communication with homeowners to explain solutions and ensure their confidence in the work being done.",
        ].join("\n"),
        format: "cover_letter",
        outputLanguage: "English",
        voicePreset: "signature",
        noContextMode: true,
      }),
    ).toThrow(
      /substantive body content|Cleanup removed all substantive body content/i,
    );
  });

  it("still fails closed for no-context workflow-reliance shells without concrete work detail", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "That workflow also relies on professionalism, reliability, and a positive attitude in a welcoming environment.",
          "",
          "The opportunity to join a well-regarded team is especially appealing.",
        ].join("\n"),
        format: "cover_letter",
        outputLanguage: "English",
        voicePreset: "signature",
        noContextMode: true,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("still fails closed when bridge cleanup has no grounded prefix to preserve", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "The opportunity to work in a structured environment aligns with my interest in careful coordination.",
          "",
          "The role sounds like an engaging place to grow professionally.",
        ].join("\n"),
        format: "cover_letter",
        outputLanguage: "English",
        voicePreset: "signature",
        noContextMode: true,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("still fails closed for nearby weak shells with entity names containing initials and periods", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The opportunity at A. B. May is especially appealing.",
        "",
        "The company’s professional environment and reputation stand out to me.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "expert",
      noContextMode: true,
    });

    expect(trace.finalOutput).toBeUndefined();
    expect(trace.failureStage).toBe("cleaned_body_selection");
    expect(trace.cleanedBodySelection.selectedCandidate).toBeNull();
  });

  it("still fails closed for nearby no-context signature plumbing shells without grounded work substance", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The opportunity to work at A. B. May is especially appealing.",
        "",
        "The company’s professional environment and strong reputation stand out to me.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "signature",
      noContextMode: true,
    });

    expect(trace.finalOutput).toBeUndefined();
    expect(trace.failureStage).toBe("cleaned_body_selection");
    expect(trace.cleanedBodySelection.selectedCandidate).toBeNull();
  });

  it("still fails closed for cv-backed generic perspective shells without grounded operational detail", () => {
    const trace = inspectProposalFinalization({
      content: [
        "Background in structured environments and clear communication may offer relevant perspective for the role.",
        "",
        "My interest in the opportunity would make me glad to discuss the position further.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "storyteller",
      noContextMode: false,
    });

    expect(trace.finalOutput).toBeUndefined();
    expect(trace.failureStage).toBe("cleaned_body_selection");
    expect(trace.cleanedBodySelection.selectedCandidate).toBeNull();
  });

  it("still fails closed for no-context benefit and professionalism shells without grounded work content", () => {
    expect(() =>
      finalizeProposalForPersistence({
        content: [
          "The collaborative environment and professional culture make this role especially appealing.",
          "",
          "The opportunity to join a reliable team stands out to me.",
        ].join("\n"),
        format: "cover_letter",
        outputLanguage: "English",
        voicePreset: "signature",
        noContextMode: true,
      }),
    ).toThrow(/substantive body content/i);
  });

  it("fails closed when only a role fragment and no-context shell rhetoric survive", () => {
    const trace = inspectProposalFinalization({
      content: [
        "The role of Security Officer at Hyatt Regency Mission Bay.",
        "",
        "The resort’s unique setting with waterfront amenities makes it an attractive place to work.",
        "",
        "The flexible scheduling, including evenings and holidays, reflects the commitment to maintaining safety around the clock.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "direct",
      noContextMode: true,
    });

    expect(trace.failureStage).toBe("cleaned_body_selection");
    expect(trace.cleanedBodySelection.selectedBody).toBeNull();
    expect(trace.cleanedBodySelection.aggressive.saveableSentences).toEqual([]);
    expect(trace.cleanedBodySelection.conservative.saveableSentences).toEqual(
      [],
    );
  });

  it("drops clipped cv tails and one-line pseudo-sentences during finalization", () => {
    const saved = finalizeProposalForPersistence({
      content: [
        "Decreased theft of hotel items like linen and towels by 73% through improved vigilance and monitoring procedures.",
        "",
        "Improved access control by reducing unauthorized entry and solicitation by 26% through enhanced notification systems.",
        "",
        "Safety compliance.",
        "",
        "I am available to discuss how my experience in security and loss prevention.",
      ].join("\n"),
      format: "cover_letter",
      outputLanguage: "English",
      candidateName: "Robert Cooper",
      voicePreset: "signature",
      noContextMode: false,
    });

    expect(saved).toContain(
      "Decreased theft of hotel items like linen and towels by 73% through improved vigilance and monitoring procedures.",
    );
    expect(saved).toContain(
      "Improved access control by reducing unauthorized entry and solicitation by 26% through enhanced notification systems.",
    );
    expect(saved).not.toContain("Safety compliance.");
    expect(saved).not.toContain(
      "I am available to discuss how my experience in security and loss prevention.",
    );
  });

  it("captures the raw generated body in fail-closed finalization traces", () => {
    const content = [
      "The role of Security Officer at Ascension St. Vincent’s Riverside Hospital.",
      "",
      "The day-to-day work itself is the part of the role that stands out to me most.",
    ].join("\n");
    const trace = inspectProposalFinalization({
      content,
      format: "cover_letter",
      outputLanguage: "English",
      voicePreset: "direct",
      noContextMode: true,
    });

    expect(trace.rawGeneratedBody).toBe(content);
    expect(trace.failureStage).toBe("cleaned_body_selection");
    expect(trace.cleanedBodySelection.selectedBody).toBeNull();
    expect(trace.cleanedBodySelection.aggressive.candidate).not.toContain(
      "The role of Security Officer at Ascension St. Vincent’s Riverside Hospital.",
    );
    expect(trace.cleanedBodySelection.conservative.candidate).toContain(
      "The day-to-day work itself is the part of the role that stands out to me most.",
    );
  });

  it("defaults structured Mistral rollout to small cover letters while preserving explicit off values", () => {
    expect(resolveStructuredMistralCoverLetterRolloutMode(undefined)).toBe(
      "small_cover_letters",
    );
    expect(
      resolveStructuredMistralCoverLetterRolloutMode("small_cover_letters"),
    ).toBe("small_cover_letters");
    expect(resolveStructuredMistralCoverLetterRolloutMode("off")).toBe(
      "disabled",
    );
    expect(
      isStructuredMistralCoverLetterEnabled({
        modelType: "mistral-small-latest",
        outputFormat: "cover_letter",
      }),
    ).toBe(true);
    expect(
      isStructuredMistralCoverLetterEnabled({
        modelType: "mistral-large-latest",
        outputFormat: "cover_letter",
      }),
    ).toBe(false);
    expect(
      isStructuredMistralCoverLetterEnabled({
        modelType: "mistral-small-latest",
        outputFormat: "application_message",
      }),
    ).toBe(false);
  });

  it("coerces finalization failures into controlled fail-closed Convex errors", () => {
    const error = coerceProposalFinalizationFailureToConvexError({
      error: new Error(
        "Final saved output for cover_letter does not contain substantive body content.",
      ),
      attemptedPath: "structured fail-closed to legacy fallback",
    });

    expect(error.message).toContain(
      "Proposal generation failed closed during finalization.",
    );
    expect(error.message).toContain(
      "Attempted path: structured fail-closed to legacy fallback.",
    );
    expect(error.message).toContain("Final result: fail-closed final result.");
  });

  it("runs constrained repair for unsafe no-context drafts before deterministic fallback", async () => {
    const plan: ProposalPlannerResult = {
      context_mode: "none",
      domain_gap: "distant",
      credential_status: "unsupported",
      transfer_mode: "no_operational_analogy",
      output_language: "en",
      allowed_concrete_facts: [],
      allowed_transfer_themes: [],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "none",
      opening_strategy: "direct_fast",
    };
    const unsafe =
      "I’ve worked in roles where my ability to stay organized helped me coordinate follow-ups.";
    const analysis = analyzeProposalDraft({
      content: unsafe,
      plan,
      format: "application_message",
      outputLanguage: "English",
      jobTitle: "Sales Assistant",
      jobDescription:
        "Coordinate follow-up, keep records organized, and communicate professionally with prospects and customers.",
    });
    const repairDraftText = vi.fn(async (prompt: string) => {
      expect(prompt).toContain("FULL DRAFT SAFETY REPAIR");
      expect(prompt).toContain("no candidate background is available");
      return "The Sales Assistant role centers on coordinating follow-up, keeping records organized, and communicating professionally with prospects and customers. No candidate background details are available here, so the message should stay focused on interest in the role and willingness to learn more.";
    });

    const repaired = await repairProposalDraftWithConstrainedPass({
      mistralKey: "test",
      modelType: "mistral-medium-latest",
      content: unsafe,
      plan,
      format: "application_message",
      outputLanguage: "English",
      jobTitle: "Sales Assistant",
      jobDescription:
        "Coordinate follow-up, keep records organized, and communicate professionally with prospects and customers.",
      flaggedSentences: analysis.flaggedSentences,
      repairDraftText,
    });

    expect(repairDraftText).toHaveBeenCalledTimes(1);
    expect(repaired).toContain("Sales Assistant");
    expect(repaired).toContain("coordinating follow-up");
    expect(repaired).not.toMatch(
      /\b(?:I’ve worked|my ability|my experience|my background)\b/i,
    );
  });

  it("uses last-resort fallback when no-context constrained repair remains unsafe", async () => {
    const plan: ProposalPlannerResult = {
      context_mode: "none",
      domain_gap: "distant",
      credential_status: "unsupported",
      transfer_mode: "no_operational_analogy",
      output_language: "en",
      allowed_concrete_facts: [],
      allowed_transfer_themes: [],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "none",
      opening_strategy: "direct_fast",
    };
    const unsafe =
      "In past experiences, I’ve developed skills that would help me manage records.";
    const analysis = analyzeProposalDraft({
      content: unsafe,
      plan,
      format: "cover_letter",
      outputLanguage: "English",
      jobTitle: "Operations Associate",
      jobDescription:
        "Support recurring processes, update internal records, and assist with communication across teams.",
    });

    const repaired = await repairProposalDraftWithConstrainedPass({
      mistralKey: "test",
      modelType: "mistral-large-latest",
      content: unsafe,
      plan,
      format: "cover_letter",
      outputLanguage: "English",
      jobTitle: "Operations Associate",
      jobDescription:
        "Support recurring processes, update internal records, and assist with communication across teams.",
      flaggedSentences: analysis.flaggedSentences,
      repairDraftText: vi.fn(async () => unsafe),
    });

    expect(repaired).toContain("Operations Associate");
    expect(repaired).toContain(
      "No candidate background details are available here",
    );
    expect(repaired).toContain("focused on the role itself");
    expect(repaired).not.toMatch(
      /\b(?:past experiences|developed skills|my ability|managed)\b/i,
    );
  });

  it("production repair gate does not depend on benchmark-only post-processing", () => {
    const plan: ProposalPlannerResult = {
      context_mode: "none",
      domain_gap: "distant",
      credential_status: "unsupported",
      transfer_mode: "no_operational_analogy",
      output_language: "en",
      allowed_concrete_facts: [],
      allowed_transfer_themes: ["role interest", "records", "communication"],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "none",
      opening_strategy: "direct_fast",
    };
    const content =
      "Attention to detail matters in this Sales Assistant role because organized follow-up and clear records shape customer communication.";

    expect(
      shouldRunProposalDraftRepair({
        content,
        plan,
        format: "cover_letter",
        outputLanguage: "English",
        jobTitle: "Sales Assistant",
        jobDescription:
          "Coordinate organized follow-up, keep records clear, and communicate professionally with customers.",
        verificationResult: { issues: [], flaggedSentences: [] },
      }),
    ).toBe(true);
  });

  it("runs constrained repair for unsupported-core weak SEO drafts", async () => {
    const plan: ProposalPlannerResult = {
      context_mode: "minimal",
      domain_gap: "adjacent",
      credential_status: "unsupported",
      transfer_mode: "abstract_only",
      output_language: "en",
      allowed_concrete_facts: [
        "Frontend",
        "Landing Pages",
        "Conversion Optimization",
      ],
      allowed_transfer_themes: [],
      disallowed_claims: [
        "unsupported indexing, schema, or crawl diagnostics experience",
      ],
      identity_hard_stops: [],
      proof_strategy: "abstract_only",
      opening_strategy: "direct_fast",
    };
    const unsafe =
      "If your technical SEO specialist provides recommendations for schema markup and internal linking, I can implement those changes with precision.";
    const analysis = analyzeProposalDraft({
      content: unsafe,
      plan,
      format: "freelance_proposal",
      outputLanguage: "English",
      jobTitle: "Technical SEO Overhaul for Marketplace",
      jobDescription:
        "Audit and improve technical SEO including indexing, schema, crawl diagnostics, and internal linking recommendations.",
    });
    const repairDraftText = vi.fn(async (prompt: string) => {
      expect(prompt).toContain("adjacent-only support");
      return [
        "My background is frontend and conversion-focused, not technical SEO.",
        "Indexing, schema strategy, crawl diagnostics, and internal-linking recommendations should be led by a technical SEO specialist.",
        "I can help with landing-page structure, frontend implementation, and conversion-aware page improvements once that specialist defines the recommendations.",
      ].join("\n\n");
    });

    const repaired = await repairProposalDraftWithConstrainedPass({
      mistralKey: "test",
      modelType: "mistral-medium-latest",
      content: unsafe,
      plan,
      format: "freelance_proposal",
      outputLanguage: "English",
      jobTitle: "Technical SEO Overhaul for Marketplace",
      jobDescription:
        "Audit and improve technical SEO including indexing, schema, crawl diagnostics, and internal linking recommendations.",
      flaggedSentences: analysis.flaggedSentences,
      repairDraftText,
    });

    expect(repairDraftText).toHaveBeenCalledTimes(1);
    expect(repaired).toContain("not technical SEO");
    expect(repaired).toContain("technical SEO specialist");
    expect(repaired).not.toMatch(
      /\b(?:implement(?:ing)? schema|internal-linking execution|crawlability optimization)\b/i,
    );
  });

  it("does not force strong rich-context frontend drafts into constrained repair", async () => {
    const plan: ProposalPlannerResult = {
      context_mode: "rich",
      domain_gap: "direct",
      credential_status: "exact_required",
      transfer_mode: "literal",
      output_language: "en",
      allowed_concrete_facts: [
        "React",
        "TypeScript",
        "Led a design system migration used across 4 product squads.",
        "Reduced page load time by 28 percent through bundle and rendering optimizations.",
      ],
      allowed_transfer_themes: [],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "direct_fast",
    };
    const content =
      "I use React and TypeScript for customer-facing frontend work. Led a design system migration used across 4 product squads. Reduced page load time by 28 percent through bundle and rendering optimizations.";
    const repairDraftText = vi.fn(async () => "should not be used");

    const repaired = await repairProposalDraftWithConstrainedPass({
      mistralKey: "test",
      modelType: "mistral-medium-latest",
      content,
      plan,
      format: "cover_letter",
      outputLanguage: "English",
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Lead React and TypeScript development, improve performance, and collaborate with product and design.",
      flaggedSentences: [],
      repairDraftText,
    });

    expect(repairDraftText).not.toHaveBeenCalled();
    expect(repaired).toBe(content);
  });

  it("flags unsupported past mentoring but allows future mentoring support", () => {
    const plan: ProposalPlannerResult = {
      context_mode: "rich",
      domain_gap: "direct",
      credential_status: "exact_required",
      transfer_mode: "literal",
      output_language: "en",
      allowed_concrete_facts: [
        "React",
        "TypeScript",
        "Led a design system migration used across 4 product squads.",
        "Reduced page load time by 28 percent through bundle and rendering optimizations.",
      ],
      allowed_transfer_themes: [],
      disallowed_claims: [],
      identity_hard_stops: [],
      proof_strategy: "concrete_supported",
      opening_strategy: "direct_fast",
    };

    const bad = analyzeProposalDraft({
      content:
        "I led a design system migration used across 4 product squads. I’d welcome the chance to mentor junior engineers, as I’ve done in past roles.",
      plan,
      format: "cover_letter",
      outputLanguage: "English",
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Lead React and TypeScript development, improve performance, and mentor junior engineers.",
    });
    const good = analyzeProposalDraft({
      content:
        "I led a design system migration used across 4 product squads. I’d welcome the chance to support junior engineers through the same design-system and performance practices.",
      plan,
      format: "cover_letter",
      outputLanguage: "English",
      jobTitle: "Senior Frontend Engineer",
      jobDescription:
        "Lead React and TypeScript development, improve performance, and mentor junior engineers.",
    });

    expect(
      bad.issues.some((issue) => issue.message.includes("past mentoring")),
    ).toBe(true);
    expect(
      good.issues.some((issue) => issue.message.includes("past mentoring")),
    ).toBe(false);
  });
});
