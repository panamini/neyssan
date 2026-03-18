import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, useAuth, SignInButton } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { convexClient as convex } from "./lib/convex-client";
import App from "./App.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import "./styles/tailwind.css";
import "./index.css";
import "remirror/styles/all.css";
import { ToastProvider } from "./components/ui/toast";

if (import.meta.env.DEV) {
  const parserUrl = import.meta.env.VITE_PARSER_URL ?? import.meta.env.VITE_CONVEX_PARSER_URL;
  if (parserUrl) {
    // Helps devs confirm uploads are routed through the expected parser instance.
    console.info(`[structuredUpload] Using parser URL: ${parserUrl}`);
  } else {
    console.warn("[structuredUpload] Parser URL unresolved. Ensure start-parser-service.sh has populated .parser-tunnel-url.");
  }
}

/**
 * Global app entry.
 * Render a small fixed Sign in button so the Clerk modal is available
 * from anywhere (including CVForge).
 */

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ToastProvider>
            {/* Fixed top-right sign-in button visible across the app */}
            <div className="pointer-events-none">
              <div className="fixed top-4 right-4 z-50 pointer-events-auto">
                <SignInButton mode="modal">
                  <button
                    type="button"
                    aria-label="Sign in"
                    className="[background:var(--sfr)] border border-[color:var(--bm)] [color:var(--ti)] px-3 py-2 rounded-[var(--rs)] [box-shadow:var(--sha)] hover:[background:var(--sf2)] focus:outline-none focus:[box-shadow:0_0_0_3px_var(--fr)]"
                  >
                    Sign in
                  </button>
                </SignInButton>
              </div>
            </div>

            <App />
          </ToastProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
