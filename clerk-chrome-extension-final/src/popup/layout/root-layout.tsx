import React, { useEffect } from "react";
import { ClerkProvider } from "@clerk/chrome-extension";
import { Outlet } from "react-router-dom";
import { resolveSyncHost } from "../../lib/app-base-url";

const PUBLISHABLE_KEY = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const SYNC_HOST = resolveSyncHost(process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST ?? "");
const POPUP_URL = chrome.runtime.getURL("popup.html");

export function RootLayout() {
  useEffect(() => {
    console.info("[clerk-sync][popup]", "using sync host", { syncHost: SYNC_HOST, popupUrl: POPUP_URL });
  }, []);

  if (!PUBLISHABLE_KEY || !SYNC_HOST) {
    console.error("Missing PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY or PLASMO_PUBLIC_CLERK_SYNC_HOST");
    return <div>Error: Environment variables missing</div>;
  }

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      syncHost={SYNC_HOST}
      afterSignOutUrl={POPUP_URL}
      signInFallbackRedirectUrl={POPUP_URL}
      signUpFallbackRedirectUrl={POPUP_URL}
      allowedRedirectProtocols={["chrome-extension:"]}
      __experimental_syncHostListener={true}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "400px",
          minHeight: "600px",
          backgroundColor: "#fff"
        }}
      >
        <main style={{ flexGrow: 1, padding: "20px" }}>
          <Outlet />
        </main>
      </div>
    </ClerkProvider>
  );
}
