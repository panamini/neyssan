import type { StoredProposalComposeDraft } from "./proposal-workspace-state";

export type ProposalWorkspaceSourceRecord = {
  title?: string | null;
  rawDescription?: string | null;
  sourceUrl?: string | null;
  sourceDomain?: string | null;
};

export type ProposalWorkspaceHandoffPrefill = {
  jobTitle?: string;
  jobDescription?: string;
  sourceUrl?: string | null;
  platform?: string | null;
};

export type ResolveProposalWorkspaceSourceDraftInput = {
  allowStoredDraftCandidates?: boolean;
  canonicalJobRecord?: ProposalWorkspaceSourceRecord | null;
  storedOutputSourceDraft?: StoredProposalComposeDraft | null;
  composePreviewValues?: StoredProposalComposeDraft | null;
  outputSourceComposeDraft?: StoredProposalComposeDraft | null;
  composeDraftInitialSeed?: StoredProposalComposeDraft | null;
  storedComposeDraft?: StoredProposalComposeDraft | null;
  prefill?: ProposalWorkspaceHandoffPrefill | null;
  stickyImportedSource?: {
    sourceUrl: string | null;
    platform: string | null;
  } | null;
};

export type ResolvedProposalWorkspaceSourceDraft = {
  mode:
    | "explicit-live-job"
    | "explicit-handoff"
    | "pasted-job"
    | "saved-historical-origin";
  jobTitle: string;
  jobDescription: string;
  sourceUrl: string | null;
  platform: string | null;
};

function normalizeDraftText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDraftUrl(value: string | null | undefined): string | null {
  const normalized = normalizeDraftText(value);
  return normalized || null;
}

function normalizeCandidate(
  draft: StoredProposalComposeDraft | null | undefined,
  mode: ResolvedProposalWorkspaceSourceDraft["mode"],
): ResolvedProposalWorkspaceSourceDraft | null {
  const normalized = {
    jobTitle: normalizeDraftText(draft?.jobTitle),
    jobDescription: normalizeDraftText(draft?.jobDescription),
    sourceUrl: normalizeDraftUrl(draft?.sourceUrl),
    platform: normalizeDraftUrl(draft?.platform),
  };

  return normalized.jobTitle ||
    normalized.jobDescription ||
    normalized.sourceUrl ||
    normalized.platform
    ? { mode, ...normalized }
    : null;
}

export function resolveProposalWorkspaceSourceDraft(
  input: ResolveProposalWorkspaceSourceDraftInput,
): ResolvedProposalWorkspaceSourceDraft | null {
  const canonicalJobTitle = normalizeDraftText(input.canonicalJobRecord?.title);
  const canonicalJobDescription = normalizeDraftText(
    input.canonicalJobRecord?.rawDescription,
  );
  const canonicalSourceUrl = normalizeDraftUrl(input.canonicalJobRecord?.sourceUrl);
  const canonicalPlatform = normalizeDraftUrl(input.canonicalJobRecord?.sourceDomain);

  if (
    canonicalJobTitle ||
    canonicalJobDescription ||
    canonicalSourceUrl ||
    canonicalPlatform
  ) {
    return {
      mode: "explicit-live-job",
      jobTitle: canonicalJobTitle,
      jobDescription: canonicalJobDescription,
      sourceUrl: canonicalSourceUrl,
      platform: canonicalPlatform,
    };
  }

  const prefillCandidate: StoredProposalComposeDraft | null = input.prefill
    ? {
        jobTitle: input.prefill.jobTitle,
        jobDescription: input.prefill.jobDescription,
        sourceUrl: input.prefill.sourceUrl ?? null,
        platform: input.prefill.platform ?? null,
      }
    : null;
  const stickyCandidate: StoredProposalComposeDraft | null = input.stickyImportedSource
    ? {
        sourceUrl: input.stickyImportedSource.sourceUrl,
        platform: input.stickyImportedSource.platform,
      }
    : null;

  return (
    normalizeCandidate(prefillCandidate, "explicit-handoff") ??
    normalizeCandidate(stickyCandidate, "explicit-handoff") ??
    normalizeCandidate(input.composePreviewValues, "pasted-job") ??
    normalizeCandidate(input.outputSourceComposeDraft, "pasted-job") ??
    normalizeCandidate(input.composeDraftInitialSeed, "pasted-job") ??
    (input.allowStoredDraftCandidates
      ? normalizeCandidate(input.storedOutputSourceDraft, "saved-historical-origin") ??
        normalizeCandidate(input.storedComposeDraft, "saved-historical-origin")
      : null)
  );
}
