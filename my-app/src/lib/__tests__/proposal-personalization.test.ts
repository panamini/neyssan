import { describe, expect, it } from "vitest";

import {
  buildAppProposalPersonalizationPayload,
  extractPersonalizationContextFromCvDocument,
  type ProposalPersonalizationContext,
} from "../proposal-personalization";

describe("buildAppProposalPersonalizationPayload", () => {
  it("forces explicit-only mode when no active CV context exists", () => {
    expect(
      buildAppProposalPersonalizationPayload({
        personalizationContext: null,
      }),
    ).toEqual({
      personalizationMode: "explicit_only",
    });
  });

  it("preserves active CV context and richness when available", () => {
    const personalizationContext: ProposalPersonalizationContext = {
      name: "Robert Cooper",
      topSkills: ["CCTV", "Loss Prevention"],
    };

    expect(
      buildAppProposalPersonalizationPayload({
        personalizationContext,
        richness: "sparse",
      }),
    ).toEqual({
      personalizationMode: "explicit_only",
      personalizationContext,
      personalizationRichness: "sparse",
    });
  });

  it("preserves an explicit none-richness state without injecting fallback data", () => {
    expect(
      buildAppProposalPersonalizationPayload({
        personalizationContext: null,
        richness: "none",
      }),
    ).toEqual({
      personalizationMode: "explicit_only",
      personalizationRichness: "none",
    });
  });

  it("keeps abbreviations intact and drops malformed fragments from CV-derived proposal context", () => {
    const context = extractPersonalizationContextFromCvDocument({
      id: "cv-1",
      title: "Robert Cooper CV",
      metadata: {
        createdAt: "2026-03-14T10:00:00.000Z",
        updatedAt: "2026-03-14T10:00:00.000Z",
        version: 1,
      },
      sections: [
        {
          id: "exp",
          type: "experience",
          title: "Experience",
          blocks: [],
          structuredContent: [
            {
              company: "Ascension St. Vincent",
              position: "Security Guard",
              responsibilities:
                "Documented incidents clearly for Ascension St. Vincent teams. 8 month work experience in Home Credit India Finance Pvt.",
              description:
                "The 15 360-degree CCTV cameras I installed to enhance monitoring procedures. This required attention to detail and problem-solving—qualities.",
              achievements: [
                "Reduced theft by 73% through improved vigilance strategies.",
              ],
            },
          ],
        },
      ],
    } as any);

    expect(context?.recentExperience?.[0]?.company).toBe("Ascension St. Vincent");
    expect(context?.recentExperience?.[0]?.highlights).toContain(
      "Documented incidents clearly for Ascension St. Vincent teams.",
    );
    expect(context?.recentExperience?.[0]?.highlights).not.toContain(
      "8 month work experience in Home Credit India Finance Pvt.",
    );
    expect(context?.recentExperience?.[0]?.highlights).not.toContain(
      "The 15 360-degree CCTV cameras I installed to enhance monitoring procedures.",
    );
    expect(context?.recentExperience?.[0]?.highlights).not.toContain(
      "This required attention to detail and problem-solving—qualities.",
    );
    expect(context?.standoutAchievements).toContain(
      "Reduced theft by 73% through improved vigilance strategies.",
    );
  });
});
