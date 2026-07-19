import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import {
  MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER,
  MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
} from "./sign-in-return";

type ContinuationStatus = "idle" | "working" | "blocked";
type ContinuationPhase = "idle" | "requesting_token" | "requesting_continuation" | "reading_response" | "redirecting";
type ContinuationBlockReason =
  | "none"
  | "no_token"
  | "invalid_response"
  | "invalid_redirect"
  | "request_failed"
  | "owner_binding_failed"
  | "continuation_resume_failed"
  | "invalid_continuation_request";

export function McpOAuthContinuationPage(): JSX.Element {
  const location = useLocation();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [status, setStatus] = React.useState<ContinuationStatus>("idle");
  const [phase, setPhase] = React.useState<ContinuationPhase>("idle");
  const [blockReason, setBlockReason] = React.useState<ContinuationBlockReason>("none");
  const intentHandle = new URLSearchParams(location.search).get(
    MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
  );
  const browserNonce = new URLSearchParams(location.search).get(
    MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER,
  );
  const continuationHref = `${location.pathname}${location.search}`;

  React.useEffect(() => {
    if (!intentHandle) return;
    const storageKey = `mcp-oauth-continuation-document-request:${continuationHref}`;
    const clearMarker = () => {
      window.sessionStorage.removeItem(storageKey);
    };
    window.addEventListener("pagehide", clearMarker);
    window.addEventListener("beforeunload", clearMarker);
    return () => {
      window.removeEventListener("pagehide", clearMarker);
      window.removeEventListener("beforeunload", clearMarker);
    };
  }, [continuationHref, intentHandle]);

  React.useEffect(() => {
    if (
      !isLoaded ||
      !isSignedIn ||
      !intentHandle ||
      !/^https?:$/u.test(window.location.protocol)
    ) {
      return;
    }
    const storageKey = `mcp-oauth-continuation-document-request:${continuationHref}`;
    if (window.sessionStorage.getItem(storageKey) === "working:v2") return;
    window.sessionStorage.setItem(storageKey, "working:v2");
    setStatus("working");
    setPhase("requesting_token");
    setBlockReason("none");
    void (async () => {
      try {
        setPhase("requesting_continuation");
        let response = await fetchContinuation(continuationHref);
        let body: unknown;
        if (!response.ok) {
          body = await response.json().catch(() => undefined);
        }
        if (response.status === 401 || readSafeRouteReason(body) === "owner_binding_failed") {
          const token = await getToken({ template: "convex" });
          if (!token) {
            setBlockReason("no_token");
            setStatus("blocked");
            setPhase("idle");
            window.sessionStorage.removeItem(storageKey);
            return;
          }
          response = await fetchContinuation(continuationHref, token);
          body = undefined;
        }
        setPhase("reading_response");
        body ??= await response.json().catch(() => undefined);
        const redirectTo = readSafeRedirectTo(body);
        if (!response.ok) {
          setBlockReason(readSafeRouteReason(body) ?? "invalid_response");
          setStatus("blocked");
          setPhase("idle");
          window.sessionStorage.removeItem(storageKey);
          return;
        }
        if (!redirectTo) {
          setBlockReason("invalid_redirect");
          setStatus("blocked");
          setPhase("idle");
          window.sessionStorage.removeItem(storageKey);
          return;
        }
        setPhase("redirecting");
        window.location.assign(redirectTo);
      } catch {
        window.sessionStorage.removeItem(storageKey);
        setBlockReason("request_failed");
        setStatus("blocked");
        setPhase("idle");
      }
    })();
  }, [continuationHref, getToken, intentHandle, isLoaded, isSignedIn]);

  return (
    <main
      className="dasti-auth-page"
      aria-labelledby="mcp-oauth-continuation-title"
      data-mcp-oauth-intent-present={intentHandle ? "true" : "false"}
      data-mcp-oauth-browser-nonce-present={browserNonce ? "true" : "false"}
      data-mcp-oauth-continuation-status={status}
      data-mcp-oauth-continuation-phase={phase}
      data-mcp-oauth-continuation-block-reason={blockReason}
    >
      <section className="dasti-auth-card">
        <div className="dasti-auth-card__header">
          <p className="dasti-auth-card__eyebrow">two weeks account</p>
          <h1 id="mcp-oauth-continuation-title" className="dasti-auth-card__title">
            Completing sign in
          </h1>
          <p className="dasti-auth-card__subtitle">
            Your account is ready. The local MCP authorization flow can continue.
          </p>
          <Link to="/dashboard" className="dasti-auth-card__back">
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}

function fetchContinuation(continuationHref: string, token?: string): Promise<Response> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "x-mcp-oauth-browser-continuation": "1",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(continuationHref, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers,
  });
}

function readSafeRouteReason(body: unknown): ContinuationBlockReason | undefined {
  if (!body || typeof body !== "object") return undefined;
  const reason = (body as { reason?: unknown }).reason;
  if (reason === "owner_binding_failed") return "owner_binding_failed";
  if (reason === "continuation_resume_failed") return "continuation_resume_failed";
  if (reason === "invalid_continuation_request") return "invalid_continuation_request";
  return undefined;
}

function readSafeRedirectTo(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const redirectTo = (body as { redirectTo?: unknown }).redirectTo;
  if (typeof redirectTo !== "string") return undefined;
  try {
    const url = new URL(redirectTo);
    if (url.protocol !== "https:" || url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
