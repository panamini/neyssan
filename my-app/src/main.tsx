import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { convexClient as convex } from "./lib/convex-client";
import App from "./App.tsx";
import { ErrorBoundary } from "./ErrorBoundary.tsx";
import "./index.css";
import { ToastProvider } from "./components/ui/toast";

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
