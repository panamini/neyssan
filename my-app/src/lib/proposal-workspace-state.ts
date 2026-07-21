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
export const PROPOSAL_TEMPLATE_RETURN_TO_STATE_KEY = "proposalReturnTo";
export const PROPOSAL_DRAWER_QUERY_PARAM = "drawer";
export const PROPOSAL_DRAFT_DRAWER_QUERY_VALUE = "proposal-draft";

const PROPOSAL_TEMPLATE_ONE_SHOT_QUERY_PARAMS = [
  "templateId",
  "pageSize",
  "styleSlot",
  "templateStart",
] as const;

export function clearProposalTemplateOneShotParams(
  params: URLSearchParams,
): void {
  for (const param of PROPOSAL_TEMPLATE_ONE_SHOT_QUERY_PARAMS) {
    params.delete(param);
  }
}

export type ProposalEntryIntent = "cover-letter-start";
export type JobImportFocus = "supported-sites";
export type ProposalDrawerRouteIntent =
  typeof PROPOSAL_DRAFT_DRAWER_QUERY_VALUE;

export function createProposalTemplateGalleryState(
  pathname: string,
  search: string,
): Record<string, string> | undefined {
  if (pathname !== "/proposal") return undefined;

  const params = new URLSearchParams(search);
  clearProposalTemplateOneShotParams(params);
  const nextSearch = params.toString();

  return {
    [PROPOSAL_TEMPLATE_RETURN_TO_STATE_KEY]: `/proposal${
      nextSearch ? `?${nextSearch}` : ""
    }`,
  };
}

export function readProposalTemplateReturnTo(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const route = (value as Record<string, unknown>)[
    PROPOSAL_TEMPLATE_RETURN_TO_STATE_KEY
  ];
  if (typeof route !== "string" || !route.startsWith("/")) return null;

  try {
    const parsed = new URL(route, "https://twoweeks.local");
    if (
      parsed.origin !== "https://twoweeks.local" ||
      parsed.pathname !== "/proposal"
    ) {
      return null;
    }

    clearProposalTemplateOneShotParams(parsed.searchParams);
    const nextSearch = parsed.searchParams.toString();
    return `/proposal${nextSearch ? `?${nextSearch}` : ""}`;
  } catch {
    return null;
  }
}

export function buildProposalTemplateApplyRoute(
  locationState: unknown,
  templateId: string,
  styleSlot?: "minimal" | "direct" | "editorial",
): string {
  const returnTo = readProposalTemplateReturnTo(locationState) ?? "/proposal";
  const parsed = new URL(returnTo, "https://twoweeks.local");
  parsed.searchParams.set("templateId", templateId);
  if (styleSlot) {
    parsed.searchParams.set("styleSlot", styleSlot);
  }
  return `${parsed.pathname}?${parsed.searchParams.toString()}`;
}

export type StoredProposalComposeDraft = {
  jobTitle?: string;
  jobDescription?: string;
  targetEmployerName?: string | null;
  proposalType?: string;
  modelType?: string | null;
  voicePreset?: string | null;
  toneTuning?: string | null;
  characterLimitMode?: string | null;
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

export function readProposalDrawerRouteIntent(
  search: string,
): ProposalDrawerRouteIntent | null {
  const value = new URLSearchParams(search).get(PROPOSAL_DRAWER_QUERY_PARAM);

  return value === PROPOSAL_DRAFT_DRAWER_QUERY_VALUE ? value : null;
}
