import { describe, expect, it } from "vitest";

import { buildProposalGenerationControlsBlock } from "../generationControls";
import { buildProposalPlannerPrompt } from "../proposalPlanner";

describe("proposal generation controls", () => {
  it.each([
    ["custom", 1200],
    ["custom", 1800],
    ["custom", 3200],
    ["linkedin_note_200", 200],
    ["indeed_cover_letter_4000", 4000],
  ] as const)(
    "does not inject Length selector instructions into initial generation for %s",
    (characterLimitMode, characterLimit) => {
      const controls = buildProposalGenerationControlsBlock({
        toneTuning: "more_direct",
        characterLimitMode,
        characterLimit,
      });

      expect(controls).toBe("Tone tuning: more_direct.");
      expect(controls).not.toContain("Keep the output within");
      expect(controls).not.toContain("character-limit");
      expect(controls).not.toContain(String(characterLimit));
    },
  );

  it("keeps normal planner grounding context while omitting Length instructions", () => {
    const controls = buildProposalGenerationControlsBlock({
      toneTuning: "more_structured",
      characterLimitMode: "custom",
      characterLimit: 1200,
    });
    const prompt = buildProposalPlannerPrompt({
      jobTitle: "Building Security Guard",
      jobDescription:
        "Monitor facilities, assist visitors, patrol assigned buildings, and report security violations.",
      voicePreset: "expert",
      contextMode: "rich",
      outputLanguage: "en",
      personalizationContext: {
        summary:
          "Security guard with visitor assistance and access-control experience.",
        topSkills: ["building patrol", "incident reporting"],
      },
      generationControlsBlock: controls,
    });

    expect(prompt).toContain("Target role: Building Security Guard");
    expect(prompt).toContain("Job description:");
    expect(prompt).toContain("Source fact bank");
    expect(prompt).toContain("Security guard with visitor assistance");
    expect(prompt).toContain("Tone tuning: more_structured.");
    expect(prompt).not.toContain("Keep the output within");
    expect(prompt).not.toContain("character-limit");
    expect(prompt).not.toContain("1200 characters");
  });
});
