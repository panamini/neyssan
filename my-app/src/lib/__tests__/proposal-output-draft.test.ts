import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT,
  PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
  PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
  readStoredProposalOutputDraft,
  writeStoredProposalOutputDraft,
} from "../proposal-output-draft";

describe("readStoredProposalOutputDraft", () => {
  afterEach(() => {
    writeStoredProposalOutputDraft(null);
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("rehydrates palette and custom accent fields when valid", () => {
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "formal",
        paletteOverride: "bordeaux",
        customAccentHex: "#A1B2C3",
      }),
    );

    expect(readStoredProposalOutputDraft()).toEqual(
      expect.objectContaining({
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "formal",
        paletteOverride: "bordeaux",
        customAccentHex: "#A1B2C3",
      }),
    );
  });

  it("drops invalid custom accent values safely", () => {
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "warm",
        paletteOverride: "not-a-palette",
        customAccentHex: "#12ZZ99",
      }),
    );

    expect(readStoredProposalOutputDraft()).toEqual(
      expect.objectContaining({
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "warm",
        paletteOverride: null,
        customAccentHex: null,
      }),
    );
  });

  it("does not dispatch an output update when the stored draft is unchanged", () => {
    const handleOutputUpdate = vi.fn();
    window.addEventListener(
      PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT,
      handleOutputUpdate,
    );

    const draft = {
      proposalContent: "Freshly generated proposal body.",
      proposalType: "cover_letter" as const,
      proposalVoicePreset: "signature" as const,
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "inherit_cv" as const,
      proposalStyleChoice: "auto" as const,
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Operations Associate Proposal",
      proposalDocumentMeta: "Cover letter · Signature",
      generatedProposalId: null,
      proposalOutputMode: "preview" as const,
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: false,
      characterLimitMode: null,
      characterLimitValue: null,
    };

    writeStoredProposalOutputDraft(draft);
    writeStoredProposalOutputDraft({ ...draft });

    expect(handleOutputUpdate).toHaveBeenCalledTimes(1);

    window.removeEventListener(
      PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT,
      handleOutputUpdate,
    );
  });

  it("falls back to a sanitized payload when full output-draft serialization fails", () => {
    const circularStyle = {} as { self?: unknown };
    circularStyle.self = circularStyle;
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    writeStoredProposalOutputDraft({
      proposalContent: "Generated proposal body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "signature",
      proposalTemplateId: "swiss_margin",
      proposalVerbatiStyle: circularStyle as never,
      proposalStyleLinkMode: "proposal_local",
      proposalStyleChoice: "formal",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Operations Associate",
      proposalDocumentTitle: "Operations Associate Proposal",
      proposalDocumentMeta: "Cover letter · Signature",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "preview",
      paletteOverride: "bordeaux",
      customAccentHex: "#A1B2C3",
      templateBundleId: "swiss_serif",
      typographyOverride: "signature",
      layoutOverride: "swiss",
      proposalDocumentTitleManual: false,
      characterLimitMode: "custom",
      characterLimitValue: 1500,
    });

    expect(window.localStorage.getItem(PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY)).toBeTruthy();
    expect(readStoredProposalOutputDraft()).toEqual(
      expect.objectContaining({
        proposalContent: "Generated proposal body.",
        proposalDocumentTitle: "Operations Associate Proposal",
        generatedProposalId: "proposal_live",
        proposalStyleChoice: "formal",
      }),
    );
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it("rehydrates an output draft from sessionStorage when localStorage is unavailable", () => {
    window.sessionStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Generated proposal body.",
        proposalType: "cover_letter",
        proposalVoicePreset: "engaging",
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "warm",
        proposalDocumentTitle: "Social Media Marketing Intern",
        generatedProposalId: "proposal_live",
        proposalOutputMode: "preview",
        sourceComposeDraft: {
          jobTitle: "Social Media Marketing Intern",
          jobDescription: "Own content planning, reporting, and campaign support.",
          proposalType: "cover_letter",
          voicePreset: "engaging",
        },
      }),
    );

    expect(readStoredProposalOutputDraft()).toEqual(
      expect.objectContaining({
        proposalContent: "Generated proposal body.",
        generatedProposalId: "proposal_live",
        sourceComposeDraft: expect.objectContaining({
          jobTitle: "Social Media Marketing Intern",
          jobDescription:
            "Own content planning, reporting, and campaign support.",
        }),
      }),
    );
  });

  it("preserves an explicit auto tone sentinel inside the stored source compose draft", () => {
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Generated proposal body.",
        proposalType: "cover_letter",
        proposalVoicePreset: "expert",
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "formal",
        proposalDocumentTitle: "Operations Associate",
        generatedProposalId: "proposal_live",
        proposalOutputMode: "preview",
        sourceComposeDraft: {
          jobTitle: "Operations Associate",
          jobDescription:
            "Support recurring processes and coordinate communication across teams.",
          proposalType: "cover_letter",
          voicePreset: null,
        },
      }),
    );

    expect(readStoredProposalOutputDraft()).toEqual(
      expect.objectContaining({
        proposalVoicePreset: "expert",
        sourceComposeDraft: expect.objectContaining({
          jobTitle: "Operations Associate",
          voicePreset: null,
        }),
      }),
    );
  });

  it("preserves source url and platform inside the stored source compose draft across reloads", () => {
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Generated proposal body.",
        proposalType: "cover_letter",
        proposalVoicePreset: "expert",
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "formal",
        proposalDocumentTitle: "Operations Associate",
        generatedProposalId: "proposal_live",
        proposalOutputMode: "preview",
        sourceComposeDraft: {
          jobTitle: "Operations Associate",
          jobDescription:
            "Support recurring processes and coordinate communication across teams.",
          proposalType: "cover_letter",
          voicePreset: null,
          sourceUrl: "https://www.linkedin.com/jobs/view/123456",
          platform: "linkedin",
        },
      }),
    );

    expect(readStoredProposalOutputDraft()).toEqual(
      expect.objectContaining({
        sourceComposeDraft: expect.objectContaining({
          sourceUrl: "https://www.linkedin.com/jobs/view/123456",
          platform: "linkedin",
        }),
      }),
    );
  });

  it("falls back to sessionStorage when localStorage persistence exceeds quota", () => {
    const originalSetItem = Storage.prototype.setItem;
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      function mockStorageSetItem(this: Storage, key: string, value: string) {
        if (
          this === window.localStorage &&
          key === PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY
        ) {
          throw new DOMException(
            "Setting the value exceeded the quota.",
            "QuotaExceededError",
          );
        }

        return originalSetItem.call(this, key, value);
      },
    );

    writeStoredProposalOutputDraft({
      proposalContent: "Generated proposal body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "engaging",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "proposal_local",
      proposalStyleChoice: "warm",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Content Designer",
      proposalDocumentTitle: "Social Media Marketing Intern",
      proposalDocumentMeta: "Letter · Engaging",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: false,
      characterLimitMode: "custom",
      characterLimitValue: 1500,
      sourceComposeDraft: {
        jobTitle: "Social Media Marketing Intern",
        jobDescription: "Own content planning, reporting, and campaign support.",
        proposalType: "cover_letter",
        voicePreset: "engaging",
        toneTuning: null,
        characterLimitMode: "custom",
        characterLimitValue: 1500,
      },
    });

    expect(window.localStorage.getItem(PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY)).toBeNull();
    expect(
      window.sessionStorage.getItem(PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY),
    ).toBeTruthy();
    expect(readStoredProposalOutputDraft()).toEqual(
      expect.objectContaining({
        proposalContent: "Generated proposal body.",
        generatedProposalId: "proposal_live",
      }),
    );
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it("stops retrying localStorage writes after quota fallback succeeds once", () => {
    const originalSetItem = Storage.prototype.setItem;
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    let localProposalOutputWriteCount = 0;

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      function mockStorageSetItem(this: Storage, key: string, value: string) {
        if (
          this === window.localStorage &&
          key === PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY
        ) {
          localProposalOutputWriteCount += 1;
          throw new DOMException(
            "Setting the value exceeded the quota.",
            "QuotaExceededError",
          );
        }

        return originalSetItem.call(this, key, value);
      },
    );

    writeStoredProposalOutputDraft({
      proposalContent: "Generated proposal body.",
      proposalType: "cover_letter",
      proposalVoicePreset: "engaging",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "proposal_local",
      proposalStyleChoice: "warm",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Content Designer",
      proposalDocumentTitle: "Editorial Assistant / Assistant Editor",
      proposalDocumentMeta: "Letter · Engaging",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: false,
      characterLimitMode: "custom",
      characterLimitValue: 1500,
      sourceComposeDraft: {
        jobTitle: "Editorial Assistant / Assistant Editor",
        jobDescription: "Support editing workflow and coordinate copy updates.",
        proposalType: "cover_letter",
        voicePreset: "engaging",
        toneTuning: null,
        characterLimitMode: "custom",
        characterLimitValue: 1500,
      },
    });

    writeStoredProposalOutputDraft({
      proposalContent: "Generated proposal body with follow-up edits.",
      proposalType: "cover_letter",
      proposalVoicePreset: "engaging",
      proposalTemplateId: null,
      proposalVerbatiStyle: null,
      proposalStyleLinkMode: "proposal_local",
      proposalStyleChoice: "warm",
      proposalApplicantName: "Alex Martin",
      proposalApplicantRole: "Content Designer",
      proposalDocumentTitle: "Editorial Assistant / Assistant Editor",
      proposalDocumentMeta: "Letter · Engaging",
      generatedProposalId: "proposal_live",
      proposalOutputMode: "preview",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual: false,
      characterLimitMode: "custom",
      characterLimitValue: 1500,
      sourceComposeDraft: {
        jobTitle: "Editorial Assistant / Assistant Editor",
        jobDescription: "Support editing workflow and coordinate copy updates.",
        proposalType: "cover_letter",
        voicePreset: "engaging",
        toneTuning: null,
        characterLimitMode: "custom",
        characterLimitValue: 1500,
      },
    });

    expect(localProposalOutputWriteCount).toBe(1);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(readStoredProposalOutputDraft()).toEqual(
      expect.objectContaining({
        proposalContent: "Generated proposal body with follow-up edits.",
      }),
    );
  });
});
