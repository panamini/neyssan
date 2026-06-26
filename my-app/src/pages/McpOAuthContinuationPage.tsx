import React from "react";
import { Link, useLocation } from "react-router-dom";
import { MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER } from "./sign-in-return";

export function McpOAuthContinuationPage(): JSX.Element {
  const location = useLocation();
  const intentHandle = new URLSearchParams(location.search).get(
    MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
  );

  return (
    <main
      className="dasti-auth-page"
      aria-labelledby="mcp-oauth-continuation-title"
      data-mcp-oauth-intent-present={intentHandle ? "true" : "false"}
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
