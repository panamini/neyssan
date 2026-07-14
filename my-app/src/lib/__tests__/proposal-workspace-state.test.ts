import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildProposalTemplateApplyRoute,
  clearStoredProposalWorkspaceState,
  createProposalTemplateGalleryState,
  PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT,
  PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
  readProposalTemplateReturnTo,
  readStoredProposalComposeDraft,
  startFreshProposalWorkspace,
  writeStoredProposalComposeDraft,
} from "../proposal-workspace-state";
import {
  PROPOSAL_ATTACHED_CV_STORAGE_KEY,
} from "../proposal-personalization";
import {
  PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
  PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
} from "../proposal-output-draft";

describe("proposal workspace state", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("clears proposal-only state without clearing the active resume identity", () => {
    window.localStorage.setItem(
      PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
      JSON.stringify({ jobTitle: "Operations Associate" }),
    );
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({ proposalContent: "Freshly generated proposal body." }),
    );
    window.sessionStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
      JSON.stringify({ proposalContent: "Session fallback proposal body." }),
    );
    window.localStorage.setItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY, "cv_alpha");
    window.localStorage.setItem("cvActiveId", "cv_beta");

    clearStoredProposalWorkspaceState();

    expect(
      window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY),
    ).toBeNull();
    expect(
      window.localStorage.getItem(PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY),
    ).toBeNull();
    expect(
      window.sessionStorage.getItem(PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY),
    ).toBeNull();
    expect(
      window.localStorage.getItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY),
    ).toBeNull();
    expect(window.localStorage.getItem("cvActiveId")).toBe("cv_beta");
  });

  it("starts a fresh proposal workspace without reusing the attached proposal CV", () => {
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({ proposalContent: "Freshly generated proposal body." }),
    );
    window.sessionStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
      JSON.stringify({ proposalContent: "Session fallback proposal body." }),
    );
    window.localStorage.setItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY, "cv_alpha");
    window.localStorage.setItem("cvActiveId", "cv_beta");

    startFreshProposalWorkspace();

    expect(
      window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY),
    ).toBe("{}");
    expect(
      window.localStorage.getItem(PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY),
    ).toBeNull();
    expect(
      window.sessionStorage.getItem(PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY),
    ).toBeNull();
    expect(
      window.localStorage.getItem(PROPOSAL_ATTACHED_CV_STORAGE_KEY),
    ).toBeNull();
    expect(window.localStorage.getItem("cvActiveId")).toBe("cv_beta");
  });

  it("does not dispatch a compose update when the stored draft is unchanged", () => {
    const handleComposeUpdate = vi.fn();
    window.addEventListener(
      PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT,
      handleComposeUpdate,
    );

    const draft = {
      jobTitle: "Operations Associate",
      jobDescription: "Support recurring processes and coordinate communication.",
      proposalType: "cover_letter",
      voicePreset: "signature",
    };

    writeStoredProposalComposeDraft(draft);
    writeStoredProposalComposeDraft({ ...draft });

    expect(handleComposeUpdate).toHaveBeenCalledTimes(1);

    window.removeEventListener(
      PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT,
      handleComposeUpdate,
    );
  });

  it("preserves an explicit auto tone sentinel in the compose draft", () => {
    writeStoredProposalComposeDraft({
      jobTitle: "Operations Associate",
      proposalType: "cover_letter",
      voicePreset: null,
    });

    expect(readStoredProposalComposeDraft()).toEqual(
      expect.objectContaining({
        jobTitle: "Operations Associate",
        proposalType: "cover_letter",
        voicePreset: null,
      }),
    );
  });

  it("round-trips a saved proposal through the template gallery", () => {
    const galleryState = createProposalTemplateGalleryState(
      "/proposal",
      "?view=saved&id=proposal_beta&templateId=swiss_margin",
    );

    expect(galleryState).toEqual({
      proposalReturnTo: "/proposal?view=saved&id=proposal_beta",
    });
    expect(
      buildProposalTemplateApplyRoute(galleryState, "modernist_signal"),
    ).toBe(
      "/proposal?view=saved&id=proposal_beta&templateId=modernist_signal",
    );
  });

  it("drops stale one-shot template intents before applying another template", () => {
    const galleryState = createProposalTemplateGalleryState(
      "/proposal",
      "?draftId=proposal_draft&templateId=workshop_proposal_margin&pageSize=letter&styleSlot=minimal&templateStart=1",
    );

    expect(galleryState).toEqual({
      proposalReturnTo: "/proposal?draftId=proposal_draft",
    });
    expect(
      buildProposalTemplateApplyRoute(
        galleryState,
        "modernist_signal",
        "direct",
      ),
    ).toBe(
      "/proposal?draftId=proposal_draft&templateId=modernist_signal&styleSlot=direct",
    );
  });

  it("rejects unsafe template return routes and falls back to a fresh proposal", () => {
    const externalState = {
      proposalReturnTo: "https://example.com/proposal?view=saved&id=proposal_beta",
    };
    const unrelatedState = {
      proposalReturnTo: "/templates?view=saved&id=proposal_beta",
    };

    expect(readProposalTemplateReturnTo(externalState)).toBeNull();
    expect(readProposalTemplateReturnTo(unrelatedState)).toBeNull();
    expect(
      buildProposalTemplateApplyRoute(externalState, "modernist_signal"),
    ).toBe("/proposal?templateId=modernist_signal");
  });
});
