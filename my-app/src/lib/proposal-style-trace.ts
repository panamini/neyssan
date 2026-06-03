import {
  PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
  PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
  type StoredProposalOutputDraft,
} from "./proposal-output-draft";
import {
  PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
  type StoredProposalComposeDraft,
} from "./proposal-workspace-state";

export const PROPOSAL_STYLE_TRACE_MARKER = "[proposal-style-trace]";
export const PROPOSAL_STYLE_TRACE_STORAGE_KEY =
  "proposal_style_trace_enabled";

export type ProposalStyleTraceWinnerSource =
  | "server_row"
  | "local_output_draft"
  | "session_output_draft"
  | "compose_draft"
  | "cv_inherit_resolver"
  | "default_fallback";

export type ProposalStyleTraceMetadataSnapshot = {
  templateId: string | null;
  verbatiStyle: {
    layout: string | null;
    typography: string | null;
    palette: string | null;
    accentHex: string | null;
  } | null;
  sourceCvId: string | null;
  styleLinkMode: string | null;
};

export type ProposalStyleTraceSavedProposalSnapshot = {
  proposalId: string | null;
  title: string | null;
  status: string | null;
  metadata: ProposalStyleTraceMetadataSnapshot;
};

export type ProposalStyleTraceOutputDraftSnapshot = {
  proposalId: string | null;
  title: string | null;
  proposalContentPresent: boolean;
  proposalOutputMode: string | null;
  metadata: ProposalStyleTraceMetadataSnapshot;
};

export type ProposalStyleTraceComposeDraftSnapshot = {
  jobTitle: string | null;
  proposalType: string | null;
  voicePreset: string | null;
  sourceUrl: string | null;
  platform: string | null;
  metadata: ProposalStyleTraceMetadataSnapshot;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function snapshotMetadataLike(
  metadata: {
    templateId?: unknown;
    verbatiStyle?: {
      layout?: unknown;
      typography?: unknown;
      palette?: unknown;
      accentHex?: unknown;
    } | null;
    sourceCvId?: unknown;
    styleLinkMode?: unknown;
  } | null | undefined,
): ProposalStyleTraceMetadataSnapshot {
  const style = metadata?.verbatiStyle;
  const normalizedStyle =
    style && typeof style === "object"
      ? {
          layout: normalizeString(style.layout),
          typography: normalizeString(style.typography),
          palette: normalizeString(style.palette),
          accentHex: normalizeString(style.accentHex),
        }
      : null;

  return {
    templateId: normalizeString(metadata?.templateId),
    verbatiStyle:
      normalizedStyle &&
      (normalizedStyle.layout ||
        normalizedStyle.typography ||
        normalizedStyle.palette ||
        normalizedStyle.accentHex)
        ? normalizedStyle
        : null,
    sourceCvId: normalizeString(metadata?.sourceCvId),
    styleLinkMode: normalizeString(metadata?.styleLinkMode),
  };
}

export function snapshotSavedProposalRecord(
  record:
    | {
        _id?: unknown;
        title?: unknown;
        status?: unknown;
        metadata?: {
          templateId?: unknown;
          verbatiStyle?: {
            layout?: unknown;
            typography?: unknown;
            palette?: unknown;
            accentHex?: unknown;
          } | null;
          sourceCvId?: unknown;
          styleLinkMode?: unknown;
        } | null;
      }
    | null
    | undefined,
): ProposalStyleTraceSavedProposalSnapshot | null {
  if (!record || typeof record !== "object") {
    return null;
  }

  return {
    proposalId: normalizeString(record._id),
    title: normalizeString(record.title),
    status: normalizeString(record.status),
    metadata: snapshotMetadataLike(record.metadata),
  };
}

export function snapshotStoredOutputDraft(
  draft: StoredProposalOutputDraft | null | undefined,
): ProposalStyleTraceOutputDraftSnapshot | null {
  if (!draft) {
    return null;
  }

  return {
    proposalId: normalizeString(draft.generatedProposalId),
    title: normalizeString(draft.proposalDocumentTitle),
    proposalContentPresent: Boolean(draft.proposalContent?.trim()),
    proposalOutputMode: normalizeString(draft.proposalOutputMode),
    metadata: snapshotMetadataLike({
      templateId: draft.proposalTemplateId,
      verbatiStyle: draft.proposalVerbatiStyle,
      sourceCvId: null,
      styleLinkMode: draft.proposalStyleLinkMode,
    }),
  };
}

export function snapshotStoredComposeDraft(
  draft: StoredProposalComposeDraft | null | undefined,
): ProposalStyleTraceComposeDraftSnapshot | null {
  if (!draft) {
    return null;
  }

  return {
    jobTitle: normalizeString(draft.jobTitle),
    proposalType: normalizeString(draft.proposalType),
    voicePreset: normalizeString(draft.voicePreset),
    sourceUrl: normalizeString(draft.sourceUrl),
    platform: normalizeString(draft.platform),
    metadata: snapshotMetadataLike(null),
  };
}

function safeParseJson(raw: string | null): unknown {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function snapshotRawOutputDraft(raw: string | null): ProposalStyleTraceOutputDraftSnapshot | null {
  const parsed = safeParseJson(raw) as Partial<StoredProposalOutputDraft> | null;
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  return {
    proposalId: normalizeString(parsed.generatedProposalId),
    title: normalizeString(parsed.proposalDocumentTitle),
    proposalContentPresent: Boolean(
      typeof parsed.proposalContent === "string" && parsed.proposalContent.trim(),
    ),
    proposalOutputMode: normalizeString(parsed.proposalOutputMode),
    metadata: snapshotMetadataLike({
      templateId: parsed.proposalTemplateId,
      verbatiStyle:
        parsed.proposalVerbatiStyle &&
        typeof parsed.proposalVerbatiStyle === "object"
          ? parsed.proposalVerbatiStyle
          : null,
      sourceCvId: null,
      styleLinkMode: parsed.proposalStyleLinkMode,
    }),
  };
}

function snapshotRawComposeDraft(
  raw: string | null,
): ProposalStyleTraceComposeDraftSnapshot | null {
  const parsed = safeParseJson(raw) as Partial<StoredProposalComposeDraft> | null;
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  return {
    jobTitle: normalizeString(parsed.jobTitle),
    proposalType: normalizeString(parsed.proposalType),
    voicePreset: normalizeString(parsed.voicePreset),
    sourceUrl: normalizeString(parsed.sourceUrl),
    platform: normalizeString(parsed.platform),
    metadata: snapshotMetadataLike(null),
  };
}

export function readProposalStyleTraceStorageSnapshots(): {
  rawLocalOutputDraft: ProposalStyleTraceOutputDraftSnapshot | null;
  rawSessionOutputDraft: ProposalStyleTraceOutputDraftSnapshot | null;
  rawComposeDraft: ProposalStyleTraceComposeDraftSnapshot | null;
} {
  if (typeof window === "undefined") {
    return {
      rawLocalOutputDraft: null,
      rawSessionOutputDraft: null,
      rawComposeDraft: null,
    };
  }

  return {
    rawLocalOutputDraft: snapshotRawOutputDraft(
      window.localStorage.getItem(PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY),
    ),
    rawSessionOutputDraft: snapshotRawOutputDraft(
      window.sessionStorage.getItem(PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY),
    ),
    rawComposeDraft: snapshotRawComposeDraft(
      window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY),
    ),
  };
}

export function resolveOutputDraftWinnerSource(args: {
  localDraft: ProposalStyleTraceOutputDraftSnapshot | null;
  sessionDraft: ProposalStyleTraceOutputDraftSnapshot | null;
}): ProposalStyleTraceWinnerSource | null {
  if (args.localDraft) {
    return "local_output_draft";
  }

  if (args.sessionDraft) {
    return "session_output_draft";
  }

  return null;
}

export function logProposalStyleTrace(payload: Record<string, unknown>): void {
  if (
    typeof window !== "undefined" &&
    window.localStorage.getItem(PROPOSAL_STYLE_TRACE_STORAGE_KEY) !== "true"
  ) {
    return;
  }

  console.info(PROPOSAL_STYLE_TRACE_MARKER, payload);
}
