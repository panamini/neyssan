import React from "react";
import { useAuth } from "@clerk/clerk-react";
import { Navigate, useLocation } from "react-router-dom";
import {
  clearAccountLocalDataForSignedOut,
  prepareAccountLocalDataScope,
} from "../lib/account-local-data";

export function AccountDataBoundary({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const location = useLocation();
  const { isLoaded, isSignedIn, userId } = useAuth();

  if (!isLoaded) {
    return (
      <main className="dasti-auth-page" aria-live="polite">
        <section className="dasti-auth-card">Loading your workspace…</section>
      </main>
    );
  }

  if (!isSignedIn || !userId) {
    clearAccountLocalDataForSignedOut();
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ returnTo: `${location.pathname}${location.search}` }}
      />
    );
  }

  prepareAccountLocalDataScope(userId);
  return <React.Fragment key={userId}>{children}</React.Fragment>;
}
