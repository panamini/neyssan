import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { convexClient as convex } from "./lib/convex-client";
import App from "./App.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import "./styles/tailwind.css";
import "./index.css";
import "remirror/styles/all.css";
import { ToastProvider } from "./components/ui/toast";
import { ensureLocalFontFacesLoaded } from "./features/verbati/fontCatalog";
import { applyStoredUiAccent } from "./lib/ui-preferences";

if (import.meta.env.DEV) {
  const parserUrl =
    import.meta.env.VITE_PARSER_URL ?? import.meta.env.VITE_CONVEX_PARSER_URL;
  if (parserUrl) {
    // Helps devs confirm uploads are routed through the expected parser instance.
    console.info(`[structuredUpload] Using parser URL: ${parserUrl}`);
  } else {
    console.warn(
      "[structuredUpload] Parser URL unresolved. Ensure start-parser-service.sh has populated .parser-tunnel-url.",
    );
  }
}

ensureLocalFontFacesLoaded();
applyStoredUiAccent();

/**
 * Global app entry.
 * Render a small fixed Sign in button so the Clerk modal is available
 * from anywhere (including CVForge).
 */

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClerkProvider
        publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
