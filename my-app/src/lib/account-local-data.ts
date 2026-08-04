import { clearProposalPersonalizationCaches } from "./proposal-personalization";

export const ACCOUNT_LOCAL_DATA_OWNER_STORAGE_KEY =
  "twoweeks:account-local-data-owner:v1";
export const ACCOUNT_LOCAL_DATA_SESSION_OWNER_STORAGE_KEY =
  "twoweeks:account-local-data-session-owner:v1";

const SAFE_LOCAL_PREFERENCE_KEYS = new Set([
  "theme",
  "dasti:cv-forge-workspace-mode:v1",
  "dasti:proposal-preview-zoom-index:v1",
  "dasti:style-forge-render-mode:v1",
  "twoweeks:document-language",
  "twoweeks:document-page-size-preference",
  "twoweeks:motion-preference",
  "twoweeks:proposal-llm-model",
  "twoweeks:quick-start-completed",
  "twoweeks:tone-preference",
  "twoweeks:ui-accent",
  "twoweeks:ui-custom-accent",
  "twoweeks:ui-language",
]);

const ACCOUNT_LOCAL_EXACT_KEYS = new Set([
  "cvActiveId",
  "cvDocuments",
  "cvLibrary",
  "pdf_ingest_last_parsed",
]);

const ACCOUNT_LOCAL_KEY_PREFIXES = [
  "cv:",
  "cv-doc:",
  "cv-backup-",
  "dasti:",
  "mcp-oauth-continuation-document-request:",
  "twoweeks:",
] as const;

type AccountLocalDataScopeResult = {
  ownerChanged: boolean;
  purged: boolean;
};

function isAccountLocalDataKey(key: string): boolean {
  if (SAFE_LOCAL_PREFERENCE_KEYS.has(key)) {
    return false;
  }

  return (
    ACCOUNT_LOCAL_EXACT_KEYS.has(key) ||
    ACCOUNT_LOCAL_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

function removeAccountLocalDataFromStorage(storage: Storage): void {
  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && isAccountLocalDataKey(key)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}

function purgeStorage(storage: Storage): void {
  try {
    removeAccountLocalDataFromStorage(storage);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

function purgeAccountLocalData(): void {
  clearProposalPersonalizationCaches();

  if (typeof window === "undefined") {
    return;
  }

  purgeStorage(window.localStorage);
  purgeStorage(window.sessionStorage);
}

export function clearAccountLocalDataForSignedOut(): void {
  purgeAccountLocalData();
}

export function prepareAccountLocalDataScope(
  userId: string,
): AccountLocalDataScopeResult {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId || typeof window === "undefined") {
    purgeAccountLocalData();
    return { ownerChanged: true, purged: true };
  }

  let previousOwner: string | null = null;
  let previousSessionOwner: string | null = null;
  try {
    previousOwner = window.localStorage.getItem(
      ACCOUNT_LOCAL_DATA_OWNER_STORAGE_KEY,
    );
    previousSessionOwner = window.sessionStorage.getItem(
      ACCOUNT_LOCAL_DATA_SESSION_OWNER_STORAGE_KEY,
    );
  } catch {
    purgeAccountLocalData();
    return { ownerChanged: true, purged: true };
  }

  const localOwnerChanged = previousOwner !== normalizedUserId;
  const sessionOwnerChanged = previousSessionOwner !== normalizedUserId;
  const ownerChanged = localOwnerChanged || sessionOwnerChanged;
  if (ownerChanged) {
    clearProposalPersonalizationCaches();
  }
  if (localOwnerChanged) {
    purgeStorage(window.localStorage);
  }
  if (sessionOwnerChanged) {
    purgeStorage(window.sessionStorage);
  }

  try {
    window.localStorage.setItem(
      ACCOUNT_LOCAL_DATA_OWNER_STORAGE_KEY,
      normalizedUserId,
    );
    window.sessionStorage.setItem(
      ACCOUNT_LOCAL_DATA_SESSION_OWNER_STORAGE_KEY,
      normalizedUserId,
    );
  } catch {
    purgeAccountLocalData();
    return { ownerChanged: true, purged: true };
  }

  return { ownerChanged, purged: ownerChanged };
}
