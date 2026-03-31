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

export type StoredProposalComposeDraft = {
  jobTitle?: string;
  jobDescription?: string;
  proposalType?: string;
  voicePreset?: string;
  toneTuning?: string | null;
  characterLimitMode?: string;
  characterLimitValue?: number | null;
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
      window.localStorage.setItem(
        PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
        nextRaw,
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

export function createProposalWorkspaceResetState(): Record<string, string> {
  return {
    [PROPOSAL_WORKSPACE_RESET_STATE_KEY]: `${Date.now()}`,
  };
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
