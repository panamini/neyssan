import type { SavedJobState } from "./types";

const SAVED_JOB_STATE_STORAGE_PREFIX = "neyssanSavedJobState:v1:";

export function buildSavedJobStateStorageKey(url: string): string {
  return `${SAVED_JOB_STATE_STORAGE_PREFIX}${url}`;
}

export function persistSavedJobState(url: string, state: SavedJobState) {
  chrome.storage.local.set({
    [buildSavedJobStateStorageKey(url)]: state,
  });
}

export function readSavedJobState(url: string): Promise<SavedJobState | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get([buildSavedJobStateStorageKey(url)], (result) => {
      resolve(result?.[buildSavedJobStateStorageKey(url)] ?? null);
    });
  });
}

export function reconcileSavedJobState(
  currentState: SavedJobState,
  response: {
    jobId?: string;
    parseStatus?: string;
    reviewState?: string;
  },
): SavedJobState {
  return {
    ...currentState,
    jobId: response.jobId ?? currentState.jobId,
    parseStatus:
      response.parseStatus === "failed"
        ? "failed"
        : response.parseStatus === "parsed"
          ? "parsed"
          : "parsing",
    reviewState: response.reviewState ?? currentState.reviewState,
  };
}
