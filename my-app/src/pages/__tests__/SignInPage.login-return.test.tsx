import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SignInPage } from "../SignInPage";
import {
  DEFAULT_SIGN_IN_RETURN_PATH,
  MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER,
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

function encodeMcpOAuthReturn(
  intentHandle = "intent_abc-123",
  browserNonce?: string,
): string {
  const params = new URLSearchParams({
    [MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER]: intentHandle,
  });
  if (browserNonce !== undefined) {
    params.set(MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER, browserNonce);
  }
  const continuationPath = `${MCP_OAUTH_CONTINUATION_PATH}?${params.toString()}`;
  return `?${MCP_OAUTH_SIGN_IN_RETURN_PARAMETER}=${encodeURIComponent(continuationPath)}`;
}

function encodeDirectMcpOAuthReturn(
  intentHandle = "0123456789abcdef".repeat(4),
  browserNonce?: string,
): string {
  const params = new URLSearchParams({
    [MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER]: intentHandle,
  });
  if (browserNonce !== undefined) {
    params.set(MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER, browserNonce);
  }
  return `?${params.toString()}`;
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

  it("accepts and preserves the browser-bound hex continuation nonce", () => {
    const intentHandle = "0123456789abcdef".repeat(4);
    const browserNonce = "fedcba9876543210".repeat(4);

    expect(resolveSignInReturnPath(encodeMcpOAuthReturn(intentHandle, browserNonce))).toEqual({
      path: `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${intentHandle}&${MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER}=${browserNonce}`,
      source: "mcp_oauth_continuation",
    });
  });

  it("accepts direct MCP OAuth continuation parameters on the sign-in URL", () => {
    const intentHandle = "0123456789abcdef".repeat(4);
    const browserNonce = "fedcba9876543210".repeat(4);

    expect(resolveSignInReturnPath(encodeDirectMcpOAuthReturn(intentHandle, browserNonce))).toEqual({
      path: `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${intentHandle}&${MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER}=${browserNonce}`,
      source: "mcp_oauth_continuation",
    });
  });

  it.each([
    ["external URL", "https://evil.example/oauth/continue"],
    ["protocol-relative URL", "//evil.example/oauth/continue"],
    ["encoded external URL", "https%3A%2F%2Fevil.example%2Fcontinue"],
    ["encoded protocol-relative URL", "%2F%2Fevil.example%2Fcontinue"],
    ["malformed path", "mcp/oauth/continue"],
    ["dot-segment continuation", "/mcp/oauth/authorize/./continue?mcp_oauth_intent=abc"],
    ["fragmented continuation", "/oauth/continue?mcp_oauth_intent=abc#fragment"],
    ["arbitrary app path", "/cv?mcp_oauth_intent=abc"],
    ["unknown continuation parameter", "/oauth/continue?mcp_oauth_intent=abc&next=/cv"],
    ["duplicate intent handles", "/oauth/continue?mcp_oauth_intent=abc&mcp_oauth_intent=def"],
    ["missing intent handle", "/oauth/continue"],
    ["unsafe intent handle", "/oauth/continue?mcp_oauth_intent=https://evil.example"],
    ["legacy browser nonce", "/oauth/continue?mcp_oauth_intent=abc&mcp_oauth_browser_nonce=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"],
  ])("rejects %s", (_label, returnPath) => {
    const search = `?${MCP_OAUTH_SIGN_IN_RETURN_PARAMETER}=${encodeURIComponent(returnPath)}`;

    expect(resolveSignInReturnPath(search)).toEqual({
      path: DEFAULT_SIGN_IN_RETURN_PATH,
      source: "default",
    });
  });

  it("passes the resolved direct return path to Clerk SignIn", () => {
    const intentHandle = "0123456789abcdef".repeat(4);

    render(
      <MemoryRouter initialEntries={[`/sign-in${encodeDirectMcpOAuthReturn(intentHandle)}`]}>
        <SignInPage />
      </MemoryRouter>,
    );

    const expectedPath = `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${intentHandle}`;
    expect(screen.getByTestId("clerk-sign-in")).toHaveAttribute("data-force-redirect-url", expectedPath);
    expect(screen.getByTestId("clerk-sign-in")).toHaveAttribute("data-fallback-redirect-url", expectedPath);
    expect(testState.signInProps?.forceRedirectUrl).toBe(expectedPath);
    expect(testState.signInProps?.fallbackRedirectUrl).toBe(expectedPath);
  });

  it("uses browser document navigation for already-authenticated MCP OAuth returns", async () => {
    testState.authenticated = true;
    const intentHandle = "fedcba9876543210".repeat(4);
    const documentNavigate = vi.fn();

    render(
      <MemoryRouter initialEntries={[`/sign-in${encodeDirectMcpOAuthReturn(intentHandle)}`]}>
        <SignInPage documentNavigate={documentNavigate} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(documentNavigate).toHaveBeenCalledWith(
        `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${intentHandle}`,
      );
    });
  });

  it("does not duplicate MCP OAuth document navigation under React StrictMode", async () => {
    testState.authenticated = true;
    const intentHandle = "abcdef0123456789".repeat(4);
    const expectedPath = `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${intentHandle}`;
    const documentNavigate = vi.fn();

    render(
      <React.StrictMode>
        <MemoryRouter initialEntries={[`/sign-in${encodeDirectMcpOAuthReturn(intentHandle)}`]}>
          <SignInPage documentNavigate={documentNavigate} />
        </MemoryRouter>
      </React.StrictMode>,
    );

    await waitFor(() => {
      expect(documentNavigate).toHaveBeenCalledWith(expectedPath);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(documentNavigate).toHaveBeenCalledTimes(1);
  });

  it("keeps React Router navigation for already-authenticated default returns", () => {
    testState.authenticated = true;
    const documentNavigate = vi.fn();

    render(
      <MemoryRouter initialEntries={["/sign-in"]}>
        <Routes>
          <Route
            path="/sign-in"
            element={<SignInPage documentNavigate={documentNavigate} />}
          />
          <Route path={DEFAULT_SIGN_IN_RETURN_PATH} element={<div data-testid="default-return" />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("default-return")).toBeInTheDocument();
    expect(documentNavigate).not.toHaveBeenCalled();
  });
});
