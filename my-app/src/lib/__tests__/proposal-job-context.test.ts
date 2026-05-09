import { describe, expect, it } from "vitest";
import { resolveProposalWorkspaceSourceDraft } from "../proposal-job-context";

describe("resolveProposalWorkspaceSourceDraft", () => {
  it("does not promote stored compose or output drafts when stored candidates are disabled", () => {
    expect(
      resolveProposalWorkspaceSourceDraft({
        allowStoredDraftCandidates: false,
        storedComposeDraft: {
          jobTitle: "Stale role",
          jobDescription: "Old local job context that should not hydrate.",
        },
        storedOutputSourceDraft: {
          jobTitle: "Old generated role",
          jobDescription: "Old generated source brief.",
        },
      }),
    ).toBeNull();
  });

  it("treats typed compose text as an active pasted job", () => {
    expect(
      resolveProposalWorkspaceSourceDraft({
        allowStoredDraftCandidates: false,
        composePreviewValues: {
          jobTitle: "",
          jobDescription:
            "Own proposal operations and coordinate application documents.",
        },
      }),
    ).toMatchObject({
      mode: "pasted-job",
      jobTitle: "",
      jobDescription:
        "Own proposal operations and coordinate application documents.",
    });
  });

  it("prefers explicit handoff context over pasted and stored candidates", () => {
    expect(
      resolveProposalWorkspaceSourceDraft({
        allowStoredDraftCandidates: true,
        prefill: {
          jobTitle: "Imported Product Lead",
          jobDescription: "Imported handoff brief.",
          sourceUrl: "https://example.com/jobs/imported",
          platform: "linkedin",
        },
        composePreviewValues: {
          jobTitle: "Pasted role",
          jobDescription: "Pasted job text.",
        },
        storedComposeDraft: {
          jobTitle: "Stored role",
          jobDescription: "Stored job text.",
        },
      }),
    ).toEqual({
      mode: "explicit-handoff",
      jobTitle: "Imported Product Lead",
      jobDescription: "Imported handoff brief.",
      sourceUrl: "https://example.com/jobs/imported",
      platform: "linkedin",
    });
  });

  it("uses stored drafts only as historical origin candidates when explicitly allowed", () => {
    expect(
      resolveProposalWorkspaceSourceDraft({
        allowStoredDraftCandidates: true,
        storedOutputSourceDraft: {
          jobTitle: "Saved Product Lead",
          jobDescription: "Saved generated source brief.",
          sourceUrl: "https://example.com/jobs/saved",
          platform: "linkedin",
        },
        storedComposeDraft: {
          jobTitle: "Stored role",
          jobDescription: "Stored job text.",
        },
      }),
    ).toEqual({
      mode: "saved-historical-origin",
      jobTitle: "Saved Product Lead",
      jobDescription: "Saved generated source brief.",
      sourceUrl: "https://example.com/jobs/saved",
      platform: "linkedin",
    });
  });

  it("does not combine a source-only candidate with another candidate's title", () => {
    expect(
      resolveProposalWorkspaceSourceDraft({
        allowStoredDraftCandidates: true,
        outputSourceComposeDraft: {
          sourceUrl: "https://example.com/jobs/source-only",
          platform: "linkedin",
        },
        storedComposeDraft: {
          jobTitle: "Unrelated Stored Title",
          jobDescription: "Unrelated stored description.",
          sourceUrl: "https://example.com/jobs/stored",
          platform: "company_website",
        },
      }),
    ).toEqual({
      mode: "pasted-job",
      jobTitle: "",
      jobDescription: "",
      sourceUrl: "https://example.com/jobs/source-only",
      platform: "linkedin",
    });
  });

  it("keeps explicit live jobs ahead of pasted or stored candidates", () => {
    expect(
      resolveProposalWorkspaceSourceDraft({
        allowStoredDraftCandidates: true,
        canonicalJobRecord: {
          title: "Live Operations Lead",
          rawDescription: "Current job from Job Forge.",
        },
        composePreviewValues: {
          jobTitle: "Pasted role",
          jobDescription: "Pasted job text.",
        },
      }),
    ).toMatchObject({
      mode: "explicit-live-job",
      jobTitle: "Live Operations Lead",
      jobDescription: "Current job from Job Forge.",
    });
  });
});
