import { clearProposalPersonalizationCaches } from "./proposal-personalization";

export const ACCOUNT_LOCAL_DATA_OWNER_STORAGE_KEY =
  "twoweeks:account-local-data-owner:v1";

const SAFE_LOCAL_PREFERENCE_KEYS = new Set([
  "theme",
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

function purgeAccountLocalData(): void {
  clearProposalPersonalizationCaches();

  if (typeof window === "undefined") {
    return;
  }

  try {
    removeAccountLocalDataFromStorage(window.localStorage);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  try {
    removeAccountLocalDataFromStorage(window.sessionStorage);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
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
  try {
    previousOwner = window.localStorage.getItem(
      ACCOUNT_LOCAL_DATA_OWNER_STORAGE_KEY,
    );
  } catch {
    purgeAccountLocalData();
    return { ownerChanged: true, purged: true };
  }

  const ownerChanged = previousOwner !== normalizedUserId;
  if (ownerChanged) {
    purgeAccountLocalData();
  }

  try {
    window.localStorage.setItem(
      ACCOUNT_LOCAL_DATA_OWNER_STORAGE_KEY,
      normalizedUserId,
    );
  } catch {
    purgeAccountLocalData();
    return { ownerChanged: true, purged: true };
  }

  return { ownerChanged, purged: ownerChanged };
}
