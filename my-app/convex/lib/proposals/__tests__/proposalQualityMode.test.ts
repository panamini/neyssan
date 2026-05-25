import { describe, expect, it } from "vitest";

import { analyzeCompanyValues } from "../companyValues";
import {
  DEFAULT_PROPOSAL_GENERATION_QUALITY_MODE,
  isProposalGenerationQualityLiveMode,
  isProposalGenerationQualityShadowMode,
  resolveProposalGenerationQualityMode,
} from "../proposalQualityMode";
import { buildProposalPlannerPrompt } from "../proposalPlanner";

describe("proposal generation quality mode", () => {
  it("defaults to baseline for zero final-letter behavior change", () => {
    expect(DEFAULT_PROPOSAL_GENERATION_QUALITY_MODE).toBe("baseline");
    expect(resolveProposalGenerationQualityMode(undefined)).toBe("baseline");
    expect(resolveProposalGenerationQualityMode("unknown")).toBe("baseline");
  });

  it("classifies shadow and live modes without changing prompts in baseline", () => {
    expect(isProposalGenerationQualityShadowMode("criteria_audit_shadow")).toBe(
      true,
    );
    expect(isProposalGenerationQualityShadowMode("semantic_planner_shadow")).toBe(
      true,
    );
    expect(isProposalGenerationQualityLiveMode("criteria_audit_live")).toBe(true);
    expect(isProposalGenerationQualityLiveMode("semantic_planner_live")).toBe(
      true,
    );
    expect(isProposalGenerationQualityLiveMode("baseline")).toBe(false);
  });

  it("does not add values audit context to planner prompts unless explicitly supplied", () => {
    const basePrompt = buildProposalPlannerPrompt({
      jobTitle: "Operations Coordinator",
      jobDescription:
        "Our values are reliability and customer care. Coordinate service records.",
      voicePreset: "signature",
      contextMode: "none",
      outputLanguage: "en",
      personalizationContext: null,
    });
    expect(basePrompt).not.toContain("Company values audit context");

    const livePrompt = buildProposalPlannerPrompt({
      jobTitle: "Operations Coordinator",
      jobDescription:
        "Our values are reliability and customer care. Coordinate service records.",
      voicePreset: "signature",
      contextMode: "none",
      outputLanguage: "en",
      personalizationContext: null,
      companyValuesPack: analyzeCompanyValues(
        "Our values are reliability and customer care. Coordinate service records.",
      ),
    });
    expect(livePrompt).toContain("Company values audit context");
  });
});
