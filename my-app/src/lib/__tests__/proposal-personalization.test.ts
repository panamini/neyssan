import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAppProposalPersonalizationPayload,
  buildActiveCvSnapshotFromCvDocument,
  clearProposalAttachedCvId,
  extractPersonalizationContextFromCvDocument,
  getActiveLocalPersonalizationSource,
  getProposalAttachedCvLocalDocument,
  getProposalAttachedCvId,
  listLocalCvPickerOptions,
  PROPOSAL_ATTACHED_CV_UPDATED_EVENT,
  PROPOSAL_ATTACHED_CV_STORAGE_KEY,
  setProposalAttachedCvId,
  type ProposalPersonalizationContext,
} from "../proposal-personalization";

const CV_ALPHA = {
  id: "cv_alpha",
  title: "Alex Martin Resume",
  metadata: {
    createdAt: "2026-03-14T10:00:00.000Z",
    updatedAt: "2026-03-14T10:00:00.000Z",
    version: 1,
  },
  sections: [
    {
      id: "profile_alpha",
      type: "profile",
      title: "Profile",
      blocks: [],
      structuredContent: [
        {
          id: "profile_alpha_item",
          name: "Alex Martin",
          desiredPosition: "Operations Associate",
        },
      ],
    },
  ],
} as const;

const CV_BETA = {
  id: "cv_beta",
  title: "Blake Stone Resume",
  metadata: {
    createdAt: "2026-03-15T10:00:00.000Z",
    updatedAt: "2026-03-15T10:00:00.000Z",
    version: 1,
  },
  sections: [
    {
      id: "profile_beta",
      type: "profile",
      title: "Profile",
      blocks: [],
      structuredContent: [
        {
          id: "profile_beta_item",
          name: "Blake Stone",
          desiredPosition: "Program Manager",
        },
      ],
    },
  ],
} as const;

describe("buildAppProposalPersonalizationPayload", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

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

  it("isolates the proposal-attached CV key from the resume active CV key", () => {
    window.localStorage.setItem("cvDocuments", JSON.stringify([CV_ALPHA, CV_BETA]));
    window.localStorage.setItem(`cv:${CV_ALPHA.id}`, JSON.stringify(CV_ALPHA));
    window.localStorage.setItem(`cv:${CV_BETA.id}`, JSON.stringify(CV_BETA));
    window.localStorage.setItem("cvActiveId", CV_BETA.id);

    setProposalAttachedCvId(CV_ALPHA.id);

    expect(window.localStorage.getItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY)).toBe(
      CV_ALPHA.id,
    );
    expect(window.localStorage.getItem("cvActiveId")).toBe(CV_BETA.id);
    expect(getProposalAttachedCvId()).toBe(CV_ALPHA.id);
    expect(getActiveLocalPersonalizationSource().title).toBe(
      "Operations Associate — Alex Martin",
    );
    expect(listLocalCvPickerOptions().find((option) => option.isActive)?.id).toBe(
      CV_ALPHA.id,
    );
    expect(getProposalAttachedCvLocalDocument()).toMatchObject({
      id: CV_ALPHA.id,
      title: CV_ALPHA.title,
    });
  });

  it("keeps the display title split between stored CV title and sidebar/library title", () => {
    const snapshot = buildActiveCvSnapshotFromCvDocument(CV_ALPHA as any);

    expect(CV_ALPHA.title).toBe("Alex Martin Resume");
    expect(snapshot.title).toBe("Operations Associate — Alex Martin");
  });

  it("migrates the legacy active CV once and keeps proposal detach independent", () => {
    window.localStorage.setItem("cvDocuments", JSON.stringify([CV_ALPHA]));
    window.localStorage.setItem(`cv:${CV_ALPHA.id}`, JSON.stringify(CV_ALPHA));
    window.localStorage.setItem("cvActiveId", CV_ALPHA.id);

    expect(getProposalAttachedCvId()).toBe(CV_ALPHA.id);
    expect(window.localStorage.getItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY)).toBe(
      CV_ALPHA.id,
    );

    clearProposalAttachedCvId();

    expect(getProposalAttachedCvId()).toBeNull();
    expect(window.localStorage.getItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem("cvActiveId")).toBe(CV_ALPHA.id);
    expect(getActiveLocalPersonalizationSource()).toEqual({
      title: null,
      personalizationContext: null,
    });
  });

  it("dispatches an update event whenever the proposal attachment changes", () => {
    const handler = vi.fn();
    window.addEventListener(PROPOSAL_ATTACHED_CV_UPDATED_EVENT, handler);

    setProposalAttachedCvId(CV_ALPHA.id);
    clearProposalAttachedCvId();

    expect(handler).toHaveBeenCalledTimes(2);

    window.removeEventListener(PROPOSAL_ATTACHED_CV_UPDATED_EVENT, handler);
  });
});
