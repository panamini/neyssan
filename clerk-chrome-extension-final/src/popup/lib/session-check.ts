export type ExtensionSessionStatus = {
  success: boolean;
  signedIn: boolean;
  token?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  error?: string;
};

const SESSION_CHECK_TIMEOUT_MS = 5000;

export function checkExtensionSession(): Promise<ExtensionSessionStatus> {
  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      resolve({
        success: false,
        signedIn: false,
        error: "Session check timed out."
      });
    }, SESSION_CHECK_TIMEOUT_MS);

    chrome.runtime.sendMessage({ action: "checkSession" }, (response) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);

      if (chrome.runtime.lastError) {
        resolve({
          success: false,
          signedIn: false,
          error: chrome.runtime.lastError.message
        });
        return;
      }

      resolve(
        response && typeof response === "object"
          ? (response as ExtensionSessionStatus)
          : {
              success: false,
              signedIn: false,
              error: "Invalid session check response."
            }
      );
    });
  });
}
