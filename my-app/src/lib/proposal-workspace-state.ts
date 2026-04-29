import {
  PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
  PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY,
  PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT,
} from "./proposal-output-draft";
import { clearProposalAttachedCvId } from "./proposal-personalization";

export const PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY =
  "dasti:proposal-compose-draft:v1";
export const PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT =
  "dasti:proposal-compose-draft-updated";
export const PROPOSAL_WORKSPACE_RESET_STATE_KEY =
  "proposalWorkspaceResetToken";
export const PROPOSAL_ENTRY_INTENT_STATE_KEY = "proposalEntryIntent";
export const PROPOSAL_JOB_IMPORT_FOCUS_STATE_KEY = "jobImportFocus";

export type ProposalEntryIntent = "cover-letter-start";
export type JobImportFocus = "supported-sites";

export type StoredProposalComposeDraft = {
  jobTitle?: string;
  jobDescription?: string;
  proposalType?: string;
  voicePreset?: string | null;
  toneTuning?: string | null;
  characterLimitMode?: string;
  characterLimitValue?: number | null;
  /** Source URL from Clerk chrome-extension handoff (persisted so it survives URL param removal) */
  sourceUrl?: string | null;
  /** Platform label from handoff (e.g. "LinkedIn", "Indeed") */
  platform?: string | null;
};

function dispatchBrowserEvent(name: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(name));
}

export function readStoredProposalComposeDraft(): StoredProposalComposeDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredProposalComposeDraft | null;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredProposalComposeDraft(
  draft: StoredProposalComposeDraft | null,
): void {
  if (typeof window === "undefined") return;

  try {
    const nextRaw = draft ? JSON.stringify(draft) : null;
    const currentRaw = window.localStorage.getItem(
      PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
    );

    if (currentRaw === nextRaw) {
      return;
    }

    if (!draft) {
      window.localStorage.removeItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY);
    } else {
      const serializedDraft = JSON.stringify(draft);
      window.localStorage.setItem(
        PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
        serializedDraft,
      );
    }
  } catch {
    /* best-effort */
  }

  dispatchBrowserEvent(PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT);
}

export function clearStoredProposalWorkspaceState(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY);
    window.localStorage.removeItem(PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY);
    window.sessionStorage.removeItem(PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY);
  } catch {
    /* best-effort */
  }
  clearProposalAttachedCvId();

  dispatchBrowserEvent(PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT);
  dispatchBrowserEvent(PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT);
}

export function startFreshProposalWorkspace(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY, JSON.stringify({}));
    window.localStorage.removeItem(PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY);
    window.sessionStorage.removeItem(PROPOSAL_OUTPUT_DRAFT_SESSION_STORAGE_KEY);
  } catch {
    /* best-effort */
  }
  clearProposalAttachedCvId();

  dispatchBrowserEvent(PROPOSAL_COMPOSE_DRAFT_UPDATED_EVENT);
  dispatchBrowserEvent(PROPOSAL_OUTPUT_DRAFT_UPDATED_EVENT);
}

export function createProposalWorkspaceResetState(options?: {
  entryIntent?: ProposalEntryIntent | null;
  jobImportFocus?: JobImportFocus | null;
}): Record<string, string> {
  const nextState: Record<string, string> = {
    [PROPOSAL_WORKSPACE_RESET_STATE_KEY]: `${Date.now()}`,
  };

  if (options?.entryIntent === "cover-letter-start") {
    nextState[PROPOSAL_ENTRY_INTENT_STATE_KEY] = options.entryIntent;
  }

  if (options?.jobImportFocus === "supported-sites") {
    nextState[PROPOSAL_JOB_IMPORT_FOCUS_STATE_KEY] = options.jobImportFocus;
  }

  return nextState;
}

export function readProposalWorkspaceResetToken(
  value: unknown,
): string | null {
  if (!value || typeof value !== "object") return null;
  const token = (value as Record<string, unknown>)[
    PROPOSAL_WORKSPACE_RESET_STATE_KEY
  ];

  if (typeof token === "string" && token.trim()) {
    return token;
  }

  if (typeof token === "number" && Number.isFinite(token)) {
    return String(token);
  }

  return null;
}

export function readProposalEntryIntent(
  value: unknown,
): ProposalEntryIntent | null {
  if (!value || typeof value !== "object") return null;
  const intent = (value as Record<string, unknown>)[PROPOSAL_ENTRY_INTENT_STATE_KEY];

  return intent === "cover-letter-start" ? intent : null;
}

export function readProposalJobImportFocus(
  value: unknown,
): JobImportFocus | null {
  if (!value || typeof value !== "object") return null;
  const focus = (value as Record<string, unknown>)[
    PROPOSAL_JOB_IMPORT_FOCUS_STATE_KEY
  ];

  return focus === "supported-sites" ? focus : null;
}
