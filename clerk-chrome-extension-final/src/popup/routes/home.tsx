import React, { useCallback, useEffect, useRef, useState } from "react";
import { buildAppUrl, resolveAppBaseUrl, resolveSyncHost } from "../../lib/app-base-url";
import { hasUsableExtensionAuth, readExtensionAuthSnapshot } from "../../lib/extension-auth-state";
import { checkExtensionSession } from "../lib/session-check";

const SYNC_HOST = resolveSyncHost(process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST ?? "");
const APP_BASE_URL = resolveAppBaseUrl(
  process.env.PLASMO_PUBLIC_APP_BASE_URL ?? process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST ?? ""
);
const SIGN_IN_URL = buildAppUrl("/sign-in", APP_BASE_URL);
const SIGN_OUT_URL = buildAppUrl("/sign-out", APP_BASE_URL);

export function Home() {
  const [authStatus, setAuthStatus] = useState<string | null>(null);
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [storedUserName, setStoredUserName] = useState<string | null>(null);
  const [storedUserEmail, setStoredUserEmail] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const hasAttemptedInitialSyncRef = useRef(false);
  const CONVEX_URL = process.env.PLASMO_PUBLIC_CONVEX_URL || "Unknown Convex URL";

  const effectiveSignedIn = hasUsableExtensionAuth(storedToken);
  const effectiveUserIdentifier = storedUserEmail || storedUserName;

  const loadStoredAuthState = useCallback(async () => {
    const result = await readExtensionAuthSnapshot();
    setStoredToken(result.authToken);
    setStoredUserName(result.userName);
    setStoredUserEmail(result.userEmail);
    return result;
  }, []);

  const requestSessionCheck = useCallback(async (silent = false) => {
    setIsCheckingSession(true);
    if (!silent) {
      setAuthStatus(null);
    }

    try {
      const result = await checkExtensionSession();
      await loadStoredAuthState();

      if (result.signedIn) {
        if (!silent) {
          setAuthStatus("Session synced from Clerk.");
        }
        return;
      }

      if (!silent) {
        setAuthStatus(result.error || "No synced Clerk session found yet.");
      }
    } finally {
      setIsCheckingSession(false);
    }
  }, [loadStoredAuthState]);

  useEffect(() => {
    let isActive = true;

    const updateStoredAuth = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.authToken) setStoredToken(changes.authToken.newValue || null);
      if (changes.userName) setStoredUserName(changes.userName.newValue || null);
      if (changes.userEmail) setStoredUserEmail(changes.userEmail.newValue || null);
    };

    void loadStoredAuthState()
      .then(() => {
        if (!isActive) {
          return;
        }

        if (!hasAttemptedInitialSyncRef.current) {
          hasAttemptedInitialSyncRef.current = true;
          return requestSessionCheck(true);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsReady(true);
        }
      });

    chrome.storage.onChanged.addListener(updateStoredAuth);

    const handleWindowFocus = () => {
      void requestSessionCheck(true);
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => {
      isActive = false;
      chrome.storage.onChanged.removeListener(updateStoredAuth);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [loadStoredAuthState, requestSessionCheck]);

  return (
    <div style={{ padding: "10px", textAlign: "left" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.5rem" }}>Welcome</h1>
      <div style={{ marginBottom: "0.75rem", color: "#111827", fontSize: 14 }}>
        {!isReady ? (
          <>
            <div style={{ fontWeight: 600 }}>Loading session</div>
            <div style={{ color: "#6b7280" }}>Reading background-owned auth state.</div>
          </>
        ) : effectiveSignedIn ? (
          <>
            <div style={{ fontWeight: 600 }}>Signed in</div>
            <div style={{ color: "#374151", wordBreak: "break-word" }}>
              {effectiveUserIdentifier || "Signed-in user"}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 600 }}>Not signed in</div>
            <div style={{ color: "#6b7280" }}>
              Sign in through the web app, then sync the session back to the extension.
            </div>
          </>
        )}
      </div>

      <div
        style={{
          marginBottom: "1rem",
          padding: "10px",
          borderRadius: "8px",
          backgroundColor: "#f9fafb",
          border: "1px solid #e5e7eb"
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
          Sync host
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", wordBreak: "break-all" }}>{SYNC_HOST}</div>
      </div>

      <div
        style={{
          marginBottom: "1rem",
          padding: "10px",
          borderRadius: "8px",
          backgroundColor: "#f9fafb",
          border: "1px solid #e5e7eb"
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
          Convex URL
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", wordBreak: "break-all" }}>{CONVEX_URL}</div>
      </div>

      {authStatus && (
        <div style={{ marginBottom: "1rem", fontSize: 12, color: "#6b7280" }}>{authStatus}</div>
      )}

      {!effectiveSignedIn && (
        <button
          type="button"
          onClick={() => chrome.tabs.create({ url: SIGN_IN_URL })}
          style={{
            marginBottom: "0.75rem",
            width: "100%",
            backgroundColor: "#2563eb",
            color: "#fff",
            padding: "10px 12px",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600
          }}
        >
          Open web app sign-in
        </button>
      )}

      {!effectiveSignedIn && (
        <button
          type="button"
          onClick={() => void requestSessionCheck()}
          disabled={isCheckingSession || !isReady}
          style={{
            marginBottom: "1rem",
            width: "100%",
            backgroundColor: "#f3f4f6",
            color: "#111827",
            padding: "10px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            cursor: isCheckingSession || !isReady ? "default" : "pointer",
            opacity: isCheckingSession || !isReady ? 0.7 : 1
          }}
        >
          {isCheckingSession ? "Checking session..." : "Check session"}
        </button>
      )}

      {effectiveSignedIn && (
        <button
          type="button"
          onClick={() => chrome.tabs.create({ url: SIGN_OUT_URL })}
          style={{
            marginBottom: "1rem",
            width: "100%",
            backgroundColor: "#fef2f2",
            color: "#991b1b",
            padding: "10px 12px",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Open web app sign-out
        </button>
      )}

      <p style={{ marginBottom: 0, color: "#374151" }}>
        Use the popup to sync Clerk auth and hand off into the web app. Scraping tools still
        appear on supported job pages.
      </p>
    </div>
  );
}
