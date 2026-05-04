import React from "react";
import { Link, Navigate } from "react-router-dom";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignIn } from "@clerk/clerk-react";

const signInAppearance = {
  elements: {
    rootBox: {
      width: "100%",
    },
    cardBox: {
      width: "100%",
      boxShadow: "none",
      border: "0",
      borderRadius: "0",
      background: "transparent",
    },
    card: {
      width: "100%",
      boxShadow: "none",
      border: "0",
      borderRadius: "0",
      background: "transparent",
      padding: "0",
      fontFamily: "var(--font-body-family)",
    },
    header: {
      display: "none",
    },
    socialButtonsBlockButton: {
      minHeight: "var(--control-md)",
      borderRadius: "var(--radius-control)",
      borderColor: "var(--color-border-strong)",
      background: "var(--color-surface-raised)",
      color: "var(--color-text)",
      fontFamily: "var(--font-body-family)",
      fontSize: "var(--text-body-sm-size)",
      fontWeight: "var(--font-label-weight)",
      boxShadow: "var(--shadow-sm)",
    },
    dividerLine: {
      background: "var(--color-border)",
    },
    dividerText: {
      color: "var(--color-text-subtle)",
      fontFamily: "var(--font-body-family)",
      fontSize: "var(--text-caption-size)",
    },
    formFieldLabel: {
      color: "var(--color-text)",
      fontFamily: "var(--font-body-family)",
      fontSize: "var(--text-label-size)",
      fontWeight: "var(--font-label-weight)",
    },
    formFieldInput: {
      minHeight: "var(--control-md)",
      borderRadius: "var(--radius-control)",
      borderColor: "var(--color-border-strong)",
      background: "var(--color-surface-raised)",
      color: "var(--color-text)",
      fontFamily: "var(--font-body-family)",
      fontSize: "var(--text-body-sm-size)",
      boxShadow: "none",
    },
    formButtonPrimary: {
      minHeight: "var(--control-md)",
      borderRadius: "var(--radius-control)",
      background: "var(--color-accent)",
      color: "var(--color-on-accent)",
      fontFamily: "var(--font-body-family)",
      fontSize: "var(--text-body-sm-size)",
      fontWeight: "var(--font-label-weight)",
      boxShadow: "var(--shadow-sm)",
    },
    footer: {
      background: "transparent",
      borderTop: "1px solid var(--color-border)",
      fontFamily: "var(--font-body-family)",
    },
    footerActionText: {
      color: "var(--color-text-subtle)",
      fontFamily: "var(--font-body-family)",
      fontSize: "var(--text-body-sm-size)",
    },
    footerActionLink: {
      color: "var(--color-text)",
      fontFamily: "var(--font-body-family)",
      fontSize: "var(--text-body-sm-size)",
      fontWeight: "var(--font-label-weight)",
    },
    footerPagesLink: {
      color: "var(--color-text)",
    },
    footerPages: {
      background: "transparent",
    },
  },
  variables: {
    colorPrimary: "var(--color-accent)",
    colorText: "var(--color-text)",
    colorTextSecondary: "var(--color-text-muted)",
    colorBackground: "transparent",
    colorInputBackground: "var(--color-surface-raised)",
    colorInputText: "var(--color-text)",
    borderRadius: "var(--radius-control)",
    fontFamily: "var(--font-body-family)",
  },
} as const;

// Dedicated web-app entrypoint for the extension popup's Clerk sync-host handoff.
export function SignInPage(): JSX.Element {
  return (
    <>
      <Authenticated>
        <Navigate to="/cv" replace />
      </Authenticated>
      <Unauthenticated>
        <section className="dasti-auth-page" aria-labelledby="dasti-auth-title">
          <div className="dasti-auth-card">
            <div className="dasti-auth-card__header">
              <Link to="/dashboard" className="dasti-auth-card__back">
                Back to dashboard
              </Link>
              <p className="dasti-auth-card__eyebrow">two weeks account</p>
              <h1 id="dasti-auth-title" className="dasti-auth-card__title">
                Sign in
              </h1>
              <p className="dasti-auth-card__subtitle">
                Save drafts, resumes, jobs, and cover letters across sessions.
              </p>
              <ul className="dasti-auth-card__list" aria-label="Account benefits">
                <li>Sync document libraries</li>
                <li>Recover work across browsers</li>
                <li>Keep extension captures attached to your workspace</li>
              </ul>
            </div>

            <SignIn
              path="/sign-in"
              routing="path"
              forceRedirectUrl="/cv"
              fallbackRedirectUrl="/cv"
              withSignUp={false}
              appearance={signInAppearance}
            />
          </div>
        </section>
      </Unauthenticated>
    </>
  );
}
