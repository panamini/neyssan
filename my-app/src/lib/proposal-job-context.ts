import type { StoredProposalComposeDraft } from "./proposal-workspace-state";

export type ProposalWorkspaceSourceRecord = {
  title?: string | null;
  rawDescription?: string | null;
  sourceUrl?: string | null;
  sourceDomain?: string | null;
  sourceType?: string | null;
  summary?: string | null;
  visibleSummary?: string | null;
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

export type BuildProposalSourceDraftFromJobInput = {
  job: ProposalWorkspaceSourceRecord;
  existingDraft?: StoredProposalComposeDraft | null;
  proposalType?: string | null;
  voicePreset?: string | null;
  characterLimitMode?: string | null;
  characterLimitValue?: number | null;
};

export type ProposalDraftDrawerMetadataSource = {
  sourceJobTitle?: string | null;
  sourceJobDescription?: string | null;
  sourceUrl?: string | null;
  platform?: string | null;
};

export type ResolveProposalDraftDrawerSourceDraftInput = {
  activeWorkspaceSourceDraft?: ResolvedProposalWorkspaceSourceDraft | null;
  storedOutputSourceDraft?: StoredProposalComposeDraft | null;
  linkedJobSourceDraft?: StoredProposalComposeDraft | null;
  metadataSource?: ProposalDraftDrawerMetadataSource | null;
};

export type ProposalDraftDrawerCvTitleOption = {
  id: string;
  title?: string | null;
};

export type ResolveProposalDraftDrawerCvTitleInput = {
  attachedCvTitle?: string | null;
  sourceCvId?: string | null;
  resolvedSourceCvTitle?: string | null;
  sourceCvOptions?: ProposalDraftDrawerCvTitleOption[] | null;
  savedSourceCvTitle?: string | null;
  fallbackAttachedCvTitle: string;
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

export function buildProposalSourceDraftFromJob(
  input: BuildProposalSourceDraftFromJobInput,
): StoredProposalComposeDraft {
  const existingDraft = input.existingDraft ?? {};

  return {
    ...existingDraft,
    jobTitle: normalizeDraftText(input.job.title),
    jobDescription:
      normalizeDraftText(input.job.rawDescription) ||
      normalizeDraftText(input.job.summary) ||
      normalizeDraftText(input.job.visibleSummary),
    sourceUrl: normalizeDraftUrl(input.job.sourceUrl),
    platform:
      normalizeDraftUrl(input.job.sourceDomain) ??
      normalizeDraftUrl(input.job.sourceType),
    proposalType:
      input.proposalType ?? existingDraft.proposalType ?? "cover_letter",
    voicePreset: input.voicePreset ?? existingDraft.voicePreset ?? null,
    characterLimitMode:
      input.characterLimitMode ?? existingDraft.characterLimitMode,
    characterLimitValue:
      input.characterLimitValue ?? existingDraft.characterLimitValue,
  };
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

export function resolveProposalDraftDrawerSourceDraft(
  input: ResolveProposalDraftDrawerSourceDraftInput,
): ResolvedProposalWorkspaceSourceDraft | null {
  const activeWorkspaceCandidate = input.activeWorkspaceSourceDraft
    ? normalizeCandidate(
        input.activeWorkspaceSourceDraft,
        input.activeWorkspaceSourceDraft.mode,
      )
    : null;
  const metadataCandidate: StoredProposalComposeDraft | null = input.metadataSource
    ? {
        jobTitle: input.metadataSource.sourceJobTitle ?? undefined,
        jobDescription: input.metadataSource.sourceJobDescription ?? undefined,
        sourceUrl: input.metadataSource.sourceUrl ?? null,
        platform: input.metadataSource.platform ?? null,
      }
    : null;

  return (
    normalizeCandidate(input.storedOutputSourceDraft, "saved-historical-origin") ??
    normalizeCandidate(metadataCandidate, "saved-historical-origin") ??
    normalizeCandidate(input.linkedJobSourceDraft, "explicit-live-job") ??
    activeWorkspaceCandidate
  );
}

export function resolveProposalDraftDrawerCvTitle(
  input: ResolveProposalDraftDrawerCvTitleInput,
): string | null {
  const attachedCvTitle = normalizeDraftText(input.attachedCvTitle);
  if (attachedCvTitle) {
    return attachedCvTitle;
  }

  const resolvedSourceCvTitle = normalizeDraftText(input.resolvedSourceCvTitle);
  if (resolvedSourceCvTitle) {
    return resolvedSourceCvTitle;
  }

  const sourceCvId = normalizeDraftText(input.sourceCvId);
  const sourceCvOptionTitle = sourceCvId
    ? normalizeDraftText(
        input.sourceCvOptions?.find(
          (option) => normalizeDraftText(option.id) === sourceCvId,
        )?.title,
      )
    : "";
  if (sourceCvOptionTitle) {
    return sourceCvOptionTitle;
  }

  const savedSourceCvTitle = normalizeDraftText(input.savedSourceCvTitle);
  if (savedSourceCvTitle) {
    return savedSourceCvTitle;
  }

  return sourceCvId ? input.fallbackAttachedCvTitle : null;
}
