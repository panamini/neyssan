import { afterEach, describe, expect, it, vi } from "vitest";

import {
  logProposalStyleTrace,
  PROPOSAL_STYLE_TRACE_STORAGE_KEY,
  readProposalStyleTraceStorageSnapshots,
  resolveOutputDraftWinnerSource,
  snapshotSavedProposalRecord,
  snapshotStoredComposeDraft,
  snapshotStoredOutputDraft,
} from "../proposal-style-trace";
import {
  PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
  PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
} from "../proposal-output-draft";
import { PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY } from "../proposal-workspace-state";

describe("proposal-style-trace", () => {
  afterEach(() => {
    window.localStorage.removeItem(PROPOSAL_STYLE_TRACE_STORAGE_KEY);
    vi.restoreAllMocks();
  });

  it("summarizes saved proposal metadata fields without conflating raw and resolved values", () => {
    expect(
      snapshotSavedProposalRecord({
        _id: "proposal_123",
        title: "Saved proposal",
        status: "saved",
        metadata: {
          templateId: "swiss_margin",
          verbatiStyle: {
            layout: "swiss",
            typography: "signature",
            palette: "bordeaux",
            accentHex: "#7a1f2b",
          },
          sourceCvId: "cv_alpha",
          styleLinkMode: "proposal_local",
        },
      }),
    ).toEqual({
      proposalId: "proposal_123",
      title: "Saved proposal",
      status: "saved",
      metadata: {
        templateId: "swiss_margin",
        verbatiStyle: {
          layout: "swiss",
          typography: "signature",
          palette: "bordeaux",
          accentHex: "#7a1f2b",
        },
        sourceCvId: "cv_alpha",
        styleLinkMode: "proposal_local",
      },
    });
  });

  it("reads local and session output drafts separately and resolves the winner source", () => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Local draft body.",
        proposalDocumentTitle: "Local draft",
        generatedProposalId: "proposal_local",
        proposalTemplateId: "swiss_margin",
        proposalVerbatiStyle: {
          layout: "swiss",
          typography: "signature",
          palette: "bordeaux",
        },
        proposalStyleLinkMode: "proposal_local",
        proposalOutputMode: "preview",
      }),
    );
    window.sessionStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Session draft body.",
        proposalDocumentTitle: "Session draft",
        generatedProposalId: "proposal_session",
        proposalTemplateId: "two_column_rail",
        proposalVerbatiStyle: {
          layout: "editorial",
          typography: "engaging",
          palette: "encre",
        },
        proposalStyleLinkMode: "inherit_cv",
        proposalOutputMode: "edit",
      }),
    );
    window.localStorage.setItem(
      PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        jobTitle: "Operations Associate",
        proposalType: "cover_letter",
        voicePreset: "signature",
        sourceUrl: "https://example.com/job",
        platform: "linkedin",
      }),
    );

    const snapshots = readProposalStyleTraceStorageSnapshots();

    expect(snapshots.rawLocalOutputDraft).toEqual({
      proposalId: "proposal_local",
      title: "Local draft",
      proposalContentPresent: true,
      proposalOutputMode: "preview",
      metadata: {
        templateId: "swiss_margin",
        verbatiStyle: {
          layout: "swiss",
          typography: "signature",
          palette: "bordeaux",
          accentHex: null,
        },
        sourceCvId: null,
        styleLinkMode: "proposal_local",
      },
    });
    expect(snapshots.rawSessionOutputDraft).toEqual({
      proposalId: "proposal_session",
      title: "Session draft",
      proposalContentPresent: true,
      proposalOutputMode: "edit",
      metadata: {
        templateId: "two_column_rail",
        verbatiStyle: {
          layout: "editorial",
          typography: "engaging",
          palette: "encre",
          accentHex: null,
        },
        sourceCvId: null,
        styleLinkMode: "inherit_cv",
      },
    });
    expect(snapshots.rawComposeDraft).toEqual({
      jobTitle: "Operations Associate",
      proposalType: "cover_letter",
      voicePreset: "signature",
      sourceUrl: "https://example.com/job",
      platform: "linkedin",
      metadata: {
        templateId: null,
        verbatiStyle: null,
        sourceCvId: null,
        styleLinkMode: null,
      },
    });
    expect(
      resolveOutputDraftWinnerSource({
        localDraft: snapshots.rawLocalOutputDraft,
        sessionDraft: snapshots.rawSessionOutputDraft,
      }),
    ).toBe("local_output_draft");
  });

  it("summarizes explicit output and compose drafts for trace logs", () => {
    expect(
      snapshotStoredOutputDraft({
        proposalContent: "Body",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: "swiss_margin",
        proposalVerbatiStyle: {
          layout: "swiss",
          typography: "signature",
          palette: "bordeaux",
        },
        proposalStyleLinkMode: "proposal_local",
        proposalStyleChoice: "auto",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Styled draft",
        proposalDocumentMeta: "Meta",
        generatedProposalId: "proposal_live" as any,
        proposalOutputMode: "edit",
        paletteOverride: null,
        customAccentHex: null,
        templateBundleId: null,
        typographyOverride: null,
        layoutOverride: null,
        proposalDocumentTitleManual: false,
        characterLimitMode: null,
        characterLimitValue: null,
      }),
    ).toEqual({
      proposalId: "proposal_live",
      title: "Styled draft",
      proposalContentPresent: true,
      proposalOutputMode: "edit",
      metadata: {
        templateId: "swiss_margin",
        verbatiStyle: {
          layout: "swiss",
          typography: "signature",
          palette: "bordeaux",
          accentHex: null,
        },
        sourceCvId: null,
        styleLinkMode: "proposal_local",
      },
    });

    expect(
      snapshotStoredComposeDraft({
        jobTitle: "Operations Associate",
        proposalType: "cover_letter",
        voicePreset: "signature",
        sourceUrl: "https://example.com/job",
        platform: "linkedin",
      }),
    ).toEqual({
      jobTitle: "Operations Associate",
      proposalType: "cover_letter",
      voicePreset: "signature",
      sourceUrl: "https://example.com/job",
      platform: "linkedin",
      metadata: {
        templateId: null,
        verbatiStyle: null,
        sourceCvId: null,
        styleLinkMode: null,
      },
    });
  });

  it("keeps trace logging off by default", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    logProposalStyleTrace({ step: "unit-test" });

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("logs the trace marker when explicitly enabled", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    window.localStorage.setItem(PROPOSAL_STYLE_TRACE_STORAGE_KEY, "true");

    expect(() => {
      logProposalStyleTrace({ step: "unit-test" });
    }).not.toThrow();
    expect(infoSpy).toHaveBeenCalledWith("[proposal-style-trace]", {
      step: "unit-test",
    });
  });
});
