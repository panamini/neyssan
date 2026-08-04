import React, { useEffect } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";
import { clearAccountLocalDataForSignedOut } from "../lib/account-local-data";

export function SignOutPage(): JSX.Element {
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    clearAccountLocalDataForSignedOut();
    void clerk.signOut({ redirectUrl: "/sign-in" });
  }, [clerk, isLoaded, isSignedIn]);

  if (!isLoaded) {
    return <div>Signing out…</div>;
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <div>Signing out…</div>;
}
