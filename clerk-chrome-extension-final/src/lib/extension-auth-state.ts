import { isUsableAuthToken } from "./auth-token";

export const EXTENSION_AUTH_STORAGE_KEYS = ["authToken", "userName", "userEmail"] as const;
const AUTH_STORAGE_DEBUG_PREFIX = "[clerk-sync][storage]";

export type ExtensionAuthSnapshot = {
  authToken: string | null;
  userName: string | null;
  userEmail: string | null;
};

export function hasUsableExtensionAuth(authToken?: string | null, minValiditySeconds = 30): authToken is string {
  return isUsableAuthToken(authToken, minValiditySeconds);
}

export function getUsableExtensionAuthSnapshot(
  snapshot: ExtensionAuthSnapshot,
  minValiditySeconds = 30
): ExtensionAuthSnapshot | null {
  if (!hasUsableExtensionAuth(snapshot.authToken, minValiditySeconds)) {
    return null;
  }

  return snapshot;
}

export function readExtensionAuthSnapshot(): Promise<ExtensionAuthSnapshot> {
  return new Promise((resolve) => {
    chrome.storage.local.get(EXTENSION_AUTH_STORAGE_KEYS as unknown as string[], (result) => {
      resolve({
        authToken: result.authToken || null,
        userName: result.userName || null,
        userEmail: result.userEmail || null
      });
    });
  });
}

function logExtensionAuthStorage(event: string, details: Record<string, unknown>) {
  console.info(AUTH_STORAGE_DEBUG_PREFIX, event, details);
}

export function writeSignedInExtensionAuthState(
  authToken: string,
  userName?: string | null,
  userEmail?: string | null,
  reason = "unknown"
) {
  logExtensionAuthStorage("updated", {
    reason,
    hasToken: true,
    hasUserName: Boolean(userName),
    hasUserEmail: Boolean(userEmail)
  });

  return chrome.storage.local.set({
    authToken,
    userName: userName || null,
    userEmail: userEmail || null
  });
}

export function writeClearedExtensionAuthState(reason = "unknown") {
  logExtensionAuthStorage("cleared", { reason });

  return chrome.storage.local.set({
    authToken: null,
    userName: null,
    userEmail: null
  });
}
