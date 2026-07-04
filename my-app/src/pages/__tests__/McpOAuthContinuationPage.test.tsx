import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { McpOAuthContinuationPage } from "../McpOAuthContinuationPage";

const authState = vi.hoisted(() => ({
  getToken: vi.fn(),
  isLoaded: true,
  isSignedIn: false,
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => authState,
}));

describe("McpOAuthContinuationPage", () => {
  beforeEach(() => {
    authState.getToken.mockReset();
    authState.isLoaded = true;
    authState.isSignedIn = false;
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps the continuation handle out of rendered text", () => {
    window.sessionStorage.setItem(
      "mcp-oauth-continuation-document-request:/oauth/continue?mcp_oauth_intent=secret_handle-123",
      "1",
    );
    render(
      <MemoryRouter initialEntries={["/oauth/continue?mcp_oauth_intent=secret_handle-123"]}>
        <McpOAuthContinuationPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("main")).toHaveAttribute("data-mcp-oauth-intent-present", "true");
    expect(screen.queryByText("secret_handle-123")).not.toBeInTheDocument();
  });

  it("tries credentialed cookie continuation before requesting a Clerk bearer token", async () => {
    authState.isSignedIn = true;
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ reason: "owner_binding_failed" }),
      ok: false,
      status: 409,
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter
        initialEntries={[
          "/oauth/continue?mcp_oauth_intent=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&mcp_oauth_browser_nonce=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ]}
      >
        <McpOAuthContinuationPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(authState.getToken).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/oauth/continue"),
      expect.objectContaining({
        credentials: "include",
        headers: expect.not.objectContaining({
          authorization: expect.any(String),
        }),
      }),
    );
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-mcp-oauth-continuation-block-reason",
      "owner_binding_failed",
    );
  });
});
