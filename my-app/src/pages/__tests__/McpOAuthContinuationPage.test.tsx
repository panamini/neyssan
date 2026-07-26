import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router-dom";
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

  it("retries owner binding with a Clerk bearer token after a stale cookie failure", async () => {
    authState.isSignedIn = true;
    authState.getToken.mockResolvedValue("safe-test-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ reason: "owner_binding_failed" }),
        ok: false,
        status: 409,
      })
      .mockResolvedValueOnce({
        json: async () => ({ reason: "owner_binding_failed" }),
        ok: false,
        status: 409,
      });
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

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(authState.getToken).toHaveBeenCalledWith({ template: "convex" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/oauth/continue"),
      expect.objectContaining({
        credentials: "include",
        headers: expect.not.objectContaining({
          authorization: expect.any(String),
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/oauth/continue"),
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          authorization: "Bearer safe-test-token",
        }),
      }),
    );
    expect(screen.getByRole("main")).toHaveAttribute(
      "data-mcp-oauth-continuation-block-reason",
      "owner_binding_failed",
    );
  });

  it("keeps one continuation request in flight across React StrictMode cleanup", async () => {
    authState.isSignedIn = true;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));

    render(
      <React.StrictMode>
        <MemoryRouter
          initialEntries={[
            "/oauth/continue?mcp_oauth_intent=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          ]}
        >
          <McpOAuthContinuationPage />
        </MemoryRouter>
      </React.StrictMode>,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(window.sessionStorage.getItem(
      "mcp-oauth-continuation-document-request:/oauth/continue?mcp_oauth_intent=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    )).toBe("working:v2");
  });

  it("clears the continuation marker when the page is abandoned", async () => {
    authState.isSignedIn = true;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    const storageKey =
      "mcp-oauth-continuation-document-request:/oauth/continue?mcp_oauth_intent=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    render(
      <MemoryRouter
        initialEntries={[
          "/oauth/continue?mcp_oauth_intent=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ]}
      >
        <McpOAuthContinuationPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(window.sessionStorage.getItem(storageKey)).toBe("working:v2");
    window.dispatchEvent(new Event("pagehide"));
    expect(window.sessionStorage.getItem(storageKey)).toBeNull();
  });

  it("does not continue a pending request after the route is unmounted", async () => {
    authState.isSignedIn = true;
    let resolveFetch: ((response: Response) => void) | undefined;
    const responseJson = vi.fn(async () => ({
      redirectTo: "https://chatgpt.com/oauth/callback",
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const storageKey =
      "mcp-oauth-continuation-document-request:/oauth/continue?mcp_oauth_intent=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    const view = render(
      <MemoryRouter
        initialEntries={[
          "/oauth/continue?mcp_oauth_intent=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ]}
      >
        <McpOAuthContinuationPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    view.unmount();
    resolveFetch?.({
      json: responseJson,
      ok: true,
      status: 200,
    } as Response);

    await waitFor(() => expect(window.sessionStorage.getItem(storageKey)).toBeNull());
    expect(responseJson).not.toHaveBeenCalled();
  });

  it("clears the previous marker when the mounted route changes continuation href", async () => {
    authState.isSignedIn = true;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    const firstStorageKey =
      "mcp-oauth-continuation-document-request:/oauth/continue?mcp_oauth_intent=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const secondStorageKey =
      "mcp-oauth-continuation-document-request:/oauth/continue?mcp_oauth_intent=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    function RouteHarness(): JSX.Element {
      const navigate = useNavigate();
      return (
        <>
          <button
            type="button"
            onClick={() =>
              navigate(
                "/oauth/continue?mcp_oauth_intent=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              )
            }
          >
            Change continuation
          </button>
          <McpOAuthContinuationPage />
        </>
      );
    }

    render(
      <MemoryRouter
        initialEntries={[
          "/oauth/continue?mcp_oauth_intent=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        ]}
      >
        <RouteHarness />
      </MemoryRouter>,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(window.sessionStorage.getItem(firstStorageKey)).toBe("working:v2");
    fireEvent.click(screen.getByRole("button", { name: "Change continuation" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(window.sessionStorage.getItem(firstStorageKey)).toBeNull());
    expect(window.sessionStorage.getItem(secondStorageKey)).toBe("working:v2");
  });
});
