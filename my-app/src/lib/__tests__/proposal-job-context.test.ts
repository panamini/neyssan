import { describe, expect, it } from "vitest";
import {
  resolveProposalWorkspaceSourceDraft,
} from "../proposal-job-context";

describe("resolveProposalWorkspaceSourceDraft", () => {
  it("prefers the current compose preview over a stale stored compose draft", () => {
    const resolved = resolveProposalWorkspaceSourceDraft({
      composePreviewValues: {
        jobTitle: "Current Operations Lead",
        jobDescription: "Current source brief.",
        sourceUrl: "https://example.com/jobs/current",
        platform: "linkedin",
      },
      storedComposeDraft: {
        jobTitle: "Stale Operations Lead",
        jobDescription: "Stale source brief.",
        sourceUrl: "https://example.com/jobs/stale",
        platform: "linkedin",
      },
    });

    expect(resolved).toEqual({
      jobTitle: "Current Operations Lead",
      jobDescription: "Current source brief.",
      sourceUrl: "https://example.com/jobs/current",
      platform: "linkedin",
    });
  });

  it("prefers the stored output source brief over later unsent compose edits", () => {
    const resolved = resolveProposalWorkspaceSourceDraft({
      storedOutputSourceDraft: {
        jobTitle: "Saved Product Lead",
        jobDescription: "Saved generated source brief.",
        sourceUrl: "https://example.com/jobs/saved",
        platform: "linkedin",
      },
      composePreviewValues: {
        jobTitle: "Later Unsaved Edit",
        jobDescription: "Later unsaved edit.",
        sourceUrl: "https://example.com/jobs/edit",
        platform: "linkedin",
      },
    });

    expect(resolved).toEqual({
      jobTitle: "Saved Product Lead",
      jobDescription: "Saved generated source brief.",
      sourceUrl: "https://example.com/jobs/saved",
      platform: "linkedin",
    });
  });

  it("does not combine a sparse source-only draft with another candidate's title", () => {
    const resolved = resolveProposalWorkspaceSourceDraft({
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
      prefill: {
        jobTitle: "Unrelated Prefill Title",
        jobDescription: "Unrelated prefill description.",
        sourceUrl: "https://example.com/jobs/prefill",
        platform: "indeed",
      },
    });

    expect(resolved).toEqual({
      jobTitle: "",
      jobDescription: "",
      sourceUrl: "https://example.com/jobs/source-only",
      platform: "linkedin",
    });
  });

  it("uses the canonical job record when the active route has one", () => {
    const resolved = resolveProposalWorkspaceSourceDraft({
      canonicalJobRecord: {
        title: "Canonical Operations Lead",
        rawDescription: "Canonical description.",
        sourceUrl: "https://example.com/jobs/canonical",
        sourceDomain: "example.com",
      },
      composePreviewValues: {
        jobTitle: "Draft title",
        jobDescription: "Draft description.",
        sourceUrl: "https://example.com/jobs/draft",
        platform: "linkedin",
      },
    });

    expect(resolved).toEqual({
      jobTitle: "Canonical Operations Lead",
      jobDescription: "Canonical description.",
      sourceUrl: "https://example.com/jobs/canonical",
      platform: "example.com",
    });
  });
});
