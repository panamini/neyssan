import React from "react";
import { Navigate } from "react-router-dom";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignIn } from "@clerk/clerk-react";

// Dedicated web-app entrypoint for the extension popup's Clerk sync-host handoff.
export function SignInPage(): JSX.Element {
  return (
    <>
      <Authenticated>
        <Navigate to="/cv" replace />
      </Authenticated>
      <Unauthenticated>
        <div className="mx-auto max-w-md rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4">
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Continue in the web app to sync your Clerk session back to the extension.
            </p>
          </div>

          <SignIn
            path="/sign-in"
            routing="path"
            forceRedirectUrl="/cv"
            fallbackRedirectUrl="/cv"
            withSignUp={false}
          />
        </div>
      </Unauthenticated>
    </>
  );
}
