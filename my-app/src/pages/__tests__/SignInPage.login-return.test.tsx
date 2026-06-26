import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SignInPage } from "../SignInPage";
import {
  DEFAULT_SIGN_IN_RETURN_PATH,
  MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
  MCP_OAUTH_CONTINUATION_PATH,
  MCP_OAUTH_SIGN_IN_RETURN_PARAMETER,
  resolveSignInReturnPath,
} from "../sign-in-return";

const testState = vi.hoisted(() => ({
  authenticated: false,
  signInProps: undefined as
    | {
        forceRedirectUrl?: string;
        fallbackRedirectUrl?: string;
      }
    | undefined,
}));

vi.mock("convex/react", () => ({
  Authenticated: ({ children }: { children?: React.ReactNode }) =>
    testState.authenticated ? <>{children}</> : null,
  Unauthenticated: ({ children }: { children?: React.ReactNode }) =>
    testState.authenticated ? null : <>{children}</>,
}));

vi.mock("@clerk/clerk-react", () => ({
  SignIn: (props: { forceRedirectUrl?: string; fallbackRedirectUrl?: string }) => {
    testState.signInProps = props;
    return (
      <div
        data-testid="clerk-sign-in"
        data-force-redirect-url={props.forceRedirectUrl}
        data-fallback-redirect-url={props.fallbackRedirectUrl}
      />
    );
  },
}));

function encodeMcpOAuthReturn(intentHandle = "intent_abc-123"): string {
  const continuationPath = `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${intentHandle}`;
  return `?${MCP_OAUTH_SIGN_IN_RETURN_PARAMETER}=${encodeURIComponent(continuationPath)}`;
}

function ContinuationProbe(): React.ReactElement {
  const location = useLocation();
  return <div data-testid="mcp-oauth-continuation" data-search={location.search} />;
}

describe("sign-in return convention", () => {
  beforeEach(() => {
    testState.authenticated = false;
    testState.signInProps = undefined;
  });

  it("keeps /cv as the default sign-in return path", () => {
    expect(resolveSignInReturnPath("")).toEqual({
      path: DEFAULT_SIGN_IN_RETURN_PATH,
      source: "default",
    });
  });

  it("accepts only the fixed MCP OAuth continuation path", () => {
    const search = encodeMcpOAuthReturn();

    expect(resolveSignInReturnPath(search)).toEqual({
      path: `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=intent_abc-123`,
      source: "mcp_oauth_continuation",
    });
  });

  it.each([
    ["external URL", "https://evil.example/mcp/oauth/authorize/continue"],
    ["protocol-relative URL", "//evil.example/mcp/oauth/authorize/continue"],
    ["encoded external URL", "https%3A%2F%2Fevil.example%2Fcontinue"],
    ["encoded protocol-relative URL", "%2F%2Fevil.example%2Fcontinue"],
    ["malformed path", "mcp/oauth/authorize/continue"],
    ["dot-segment continuation", "/mcp/oauth/authorize/./continue?mcp_oauth_intent=abc"],
    ["fragmented continuation", "/mcp/oauth/authorize/continue?mcp_oauth_intent=abc#fragment"],
    ["arbitrary app path", "/cv?mcp_oauth_intent=abc"],
    ["unknown continuation parameter", "/mcp/oauth/authorize/continue?mcp_oauth_intent=abc&next=/cv"],
    ["duplicate intent handles", "/mcp/oauth/authorize/continue?mcp_oauth_intent=abc&mcp_oauth_intent=def"],
    ["missing intent handle", "/mcp/oauth/authorize/continue"],
    ["unsafe intent handle", "/mcp/oauth/authorize/continue?mcp_oauth_intent=https://evil.example"],
  ])("rejects %s", (_label, returnPath) => {
    const search = `?${MCP_OAUTH_SIGN_IN_RETURN_PARAMETER}=${encodeURIComponent(returnPath)}`;

    expect(resolveSignInReturnPath(search)).toEqual({
      path: DEFAULT_SIGN_IN_RETURN_PATH,
      source: "default",
    });
  });

  it("passes the resolved return path to Clerk SignIn", () => {
    render(
      <MemoryRouter initialEntries={[`/sign-in${encodeMcpOAuthReturn("next_local-dev-123")}`]}>
        <SignInPage />
      </MemoryRouter>,
    );

    const expectedPath = `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=next_local-dev-123`;
    expect(screen.getByTestId("clerk-sign-in")).toHaveAttribute("data-force-redirect-url", expectedPath);
    expect(screen.getByTestId("clerk-sign-in")).toHaveAttribute("data-fallback-redirect-url", expectedPath);
    expect(testState.signInProps?.forceRedirectUrl).toBe(expectedPath);
    expect(testState.signInProps?.fallbackRedirectUrl).toBe(expectedPath);
  });

  it("redirects already-authenticated users to the resolved return path", () => {
    testState.authenticated = true;

    render(
      <MemoryRouter initialEntries={[`/sign-in${encodeMcpOAuthReturn("already_auth-456")}`]}>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route
            path={MCP_OAUTH_CONTINUATION_PATH}
            element={<ContinuationProbe />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("mcp-oauth-continuation")).toBeInTheDocument();
    expect(screen.getByTestId("mcp-oauth-continuation")).toHaveAttribute(
      "data-search",
      `?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=already_auth-456`,
    );
  });
});
