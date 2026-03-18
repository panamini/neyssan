import { describe, expect, it } from "vitest";

import {
  APPLICATION_MESSAGE_VOICE_PRESET_IDS,
  CHATGPT_FREELANCE_VOICE_PRESET_IDS,
  IDENTITY_BACKGROUND_HARD_STOP_RULES,
  JOB_DESCRIPTION_TO_CANDIDATE_RULES,
  NO_CONTEXT_CANDIDATE_CLAIM_RULES,
  PREMIUM_COVER_LETTER_VOICE_PRESET_IDS,
  PROPOSAL_VOICE_PRESET_DEFINITIONS,
  SOURCE_BACKED_SPECIFICITY_RULES,
  UNSUPPORTED_PROPOSAL_CLAIMS_BLACKLIST,
  getSupportedProposalVoicePresetIds,
  normalizeProposalVoicePresetForMode,
} from "../voicePresets";

describe("proposal voice preset definitions", () => {
  it("keeps each preset guidance structured and compact", () => {
    for (const preset of PROPOSAL_VOICE_PRESET_DEFINITIONS) {
      expect(preset.guidance).toContain("Preset intent:");
      expect(preset.guidance).toContain("Tone traits:");
      expect(preset.guidance).toContain("Avoid:");
    }
  });

  it("gives direct, engaging, and storyteller stronger differentiation cues", () => {
    const signature = PROPOSAL_VOICE_PRESET_DEFINITIONS.find(
      (preset) => preset.id === "signature",
    );
    const expert = PROPOSAL_VOICE_PRESET_DEFINITIONS.find(
      (preset) => preset.id === "expert",
    );
    const direct = PROPOSAL_VOICE_PRESET_DEFINITIONS.find(
      (preset) => preset.id === "direct",
    );
    const engaging = PROPOSAL_VOICE_PRESET_DEFINITIONS.find(
      (preset) => preset.id === "engaging",
    );
    const storyteller = PROPOSAL_VOICE_PRESET_DEFINITIONS.find(
      (preset) => preset.id === "storyteller",
    );

    expect(signature?.guidance).toContain("substantive rather than minimal");
    expect(signature?.guidance).toContain("shell phrasing");
    expect(expert?.guidance).toContain("analytical movement");
    expect(expert?.guidance).toContain("interpreting sentence");
    expect(direct?.guidance).toContain("shorter sentences");
    expect(direct?.guidance).toContain("low padding");
    expect(engaging?.guidance).toContain("natural warmth");
    expect(engaging?.guidance).toContain("human presence");
    expect(engaging?.guidance).toContain("grounded people context");
    expect(storyteller?.guidance).toContain("smooth continuity");
    expect(storyteller?.guidance).toContain("lightly narrative transitions");
    expect(storyteller?.guidance).toContain("visible supported through-line");
    expect(storyteller?.guidance).toContain("fragmentary connective beats");
  });

  it("preserves source-backed specificity while blocking unsupported inference", () => {
    expect(
      SOURCE_BACKED_SPECIFICITY_RULES.some((entry) =>
        entry.includes("Preserve concrete source-backed detail"),
      ),
    ).toBe(true);
    expect(
      SOURCE_BACKED_SPECIFICITY_RULES.some((entry) =>
        entry.includes("keep it concrete instead of generalizing it away"),
      ),
    ).toBe(true);
    expect(
      SOURCE_BACKED_SPECIFICITY_RULES.some((entry) =>
        entry.includes("Prefer exact source-backed wording"),
      ),
    ).toBe(true);
    expect(
      SOURCE_BACKED_SPECIFICITY_RULES.some((entry) =>
        entry.includes(
          "Do not narrow, expand, upgrade, or reinterpret a detail",
        ),
      ),
    ).toBe(true);
  });

  it("includes explicit JD-to-candidate boundary rules", () => {
    expect(
      JOB_DESCRIPTION_TO_CANDIDATE_RULES.some((entry) =>
        entry.includes("appears only in the job description"),
      ),
    ).toBe(true);
    expect(
      JOB_DESCRIPTION_TO_CANDIDATE_RULES.some((entry) =>
        entry.includes("not prior experience unless"),
      ),
    ).toBe(true);
  });

  it("hardens the no-context branch against invented candidate history", () => {
    expect(
      NO_CONTEXT_CANDIDATE_CLAIM_RULES.some((entry) =>
        entry.includes("do not claim prior work experience"),
      ),
    ).toBe(true);
    expect(
      NO_CONTEXT_CANDIDATE_CLAIM_RULES.some((entry) =>
        entry.includes("Do not use negative-history disclaimers"),
      ),
    ).toBe(true);
    expect(
      NO_CONTEXT_CANDIDATE_CLAIM_RULES.some((entry) =>
        entry.includes("Do not claim prior systems used, incidents handled"),
      ),
    ).toBe(true);
    expect(
      NO_CONTEXT_CANDIDATE_CLAIM_RULES.some((entry) =>
        entry.includes("Do not claim familiarity with CCTV, access control"),
      ),
    ).toBe(true);
    expect(
      NO_CONTEXT_CANDIDATE_CLAIM_RULES.some((entry) =>
        entry.includes("Do not use soft acquired-practice language"),
      ),
    ).toBe(true);
    expect(
      NO_CONTEXT_CANDIDATE_CLAIM_RULES.some((entry) =>
        entry.includes("Do not claim direct operational capability"),
      ),
    ).toBe(true);
    expect(
      NO_CONTEXT_CANDIDATE_CLAIM_RULES.some((entry) =>
        entry.includes("Do not infer generic security experience"),
      ),
    ).toBe(true);
  });

  it("includes identity and background hard-stop rules", () => {
    expect(
      IDENTITY_BACKGROUND_HARD_STOP_RULES.some((entry) =>
        entry.includes(
          "veteran status, military service, public-service background",
        ),
      ),
    ).toBe(true);
    expect(
      IDENTITY_BACKGROUND_HARD_STOP_RULES.some((entry) =>
        entry.includes(
          "accreditation/licensing, completed degree status, or direct domain-practice background",
        ),
      ),
    ).toBe(true);
    expect(
      IDENTITY_BACKGROUND_HARD_STOP_RULES.some((entry) =>
        entry.includes("adjacent sector exposure"),
      ),
    ).toBe(true);
  });

  it("includes the explicit unsupported-claims blacklist entries", () => {
    expect(
      UNSUPPORTED_PROPOSAL_CLAIMS_BLACKLIST.some((entry) =>
        entry.includes("attached CV or resume"),
      ),
    ).toBe(true);
    expect(
      UNSUPPORTED_PROPOSAL_CLAIMS_BLACKLIST.some((entry) =>
        entry.includes("portfolio, demo reel, case study, or work samples"),
      ),
    ).toBe(true);
    expect(
      UNSUPPORTED_PROPOSAL_CLAIMS_BLACKLIST.some((entry) =>
        entry.includes("client names, project lists, shipped products"),
      ),
    ).toBe(true);
    expect(
      UNSUPPORTED_PROPOSAL_CLAIMS_BLACKLIST.some((entry) =>
        entry.includes("unsupported domain expertise"),
      ),
    ).toBe(true);
  });

  it("exposes explicit supported preset sets for premium cover letters, application messages, and chatgpt freelance proposals", () => {
    expect(
      getSupportedProposalVoicePresetIds({
        proposalType: "cover_letter",
        modelType: "chatgpt",
      }),
    ).toEqual(PREMIUM_COVER_LETTER_VOICE_PRESET_IDS);
    expect(
      getSupportedProposalVoicePresetIds({
        proposalType: "freelance_proposal",
        modelType: "chatgpt",
      }),
    ).toEqual(CHATGPT_FREELANCE_VOICE_PRESET_IDS);
    expect(
      getSupportedProposalVoicePresetIds({
        proposalType: "application_message",
        modelType: "chatgpt",
      }),
    ).toEqual(APPLICATION_MESSAGE_VOICE_PRESET_IDS);
  });

  it("normalizes unsupported application_message and chatgpt freelance presets back to the format default boundary", () => {
    expect(
      normalizeProposalVoicePresetForMode({
        value: "direct",
        proposalType: "application_message",
        modelType: "chatgpt",
      }),
    ).toBeUndefined();
    expect(
      normalizeProposalVoicePresetForMode({
        value: "storyteller",
        proposalType: "application_message",
        modelType: "mistral-small-latest",
      }),
    ).toBeUndefined();
    expect(
      normalizeProposalVoicePresetForMode({
        value: "engaging",
        proposalType: "application_message",
        modelType: "chatgpt",
      }),
    ).toBe("engaging");
    expect(
      normalizeProposalVoicePresetForMode({
        value: "engaging",
        proposalType: "freelance_proposal",
        modelType: "chatgpt",
      }),
    ).toBe("engaging");
    expect(
      normalizeProposalVoicePresetForMode({
        value: "storyteller",
        proposalType: "freelance_proposal",
        modelType: "chatgpt",
      }),
    ).toBeUndefined();
    expect(
      normalizeProposalVoicePresetForMode({
        value: "direct",
        proposalType: "freelance_proposal",
        modelType: "chatgpt",
      }),
    ).toBeUndefined();
  });
});
