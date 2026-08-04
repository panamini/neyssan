import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const {
  authState,
  clearAccountLocalDataForSignedOutMock,
  prepareAccountLocalDataScopeMock,
} = vi.hoisted(() => ({
  authState: {
    isLoaded: false,
    isSignedIn: false,
    userId: null as string | null,
  },
  clearAccountLocalDataForSignedOutMock: vi.fn(),
  prepareAccountLocalDataScopeMock: vi.fn(() => ({
    ownerChanged: false,
    purged: false,
  })),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => authState,
}));

vi.mock("../../lib/account-local-data", () => ({
  clearAccountLocalDataForSignedOut: clearAccountLocalDataForSignedOutMock,
  prepareAccountLocalDataScope: prepareAccountLocalDataScopeMock,
}));

import { AccountDataBoundary } from "../AccountDataBoundary";

function AccountScopedProbe(): React.JSX.Element {
  const [mountedFor] = React.useState(authState.userId);
  return <div>Mounted for {mountedFor}</div>;
}

function renderBoundary(
  children: React.ReactNode = <div>Private account data</div>,
): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <AccountDataBoundary>
              {children}
            </AccountDataBoundary>
          }
        />
        <Route path="/sign-in" element={<div>Sign in safely</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AccountDataBoundary", () => {
  beforeEach(() => {
    authState.isLoaded = false;
    authState.isSignedIn = false;
    authState.userId = null;
    clearAccountLocalDataForSignedOutMock.mockClear();
    prepareAccountLocalDataScopeMock.mockClear();
  });

  it("does not render private children while authentication is loading", () => {
    renderBoundary();

    expect(screen.queryByText("Private account data")).not.toBeInTheDocument();
    expect(screen.getByText("Loading your workspace…")).toBeInTheDocument();
    expect(clearAccountLocalDataForSignedOutMock).not.toHaveBeenCalled();
  });

  it("purges private browser data before redirecting a signed-out visitor", () => {
    authState.isLoaded = true;

    renderBoundary();

    expect(clearAccountLocalDataForSignedOutMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Private account data")).not.toBeInTheDocument();
    expect(screen.getByText("Sign in safely")).toBeInTheDocument();
  });

  it("purges data but keeps a public continuation route visible when signed out", () => {
    authState.isLoaded = true;

    render(
      <MemoryRouter initialEntries={["/oauth/continue"]}>
        <AccountDataBoundary signedOutBehavior="render">
          <div>OAuth continuation</div>
        </AccountDataBoundary>
      </MemoryRouter>,
    );

    expect(clearAccountLocalDataForSignedOutMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("OAuth continuation")).toBeInTheDocument();
  });

  it("prepares the exact account scope before rendering private children", () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.userId = "user-a";

    renderBoundary();

    expect(prepareAccountLocalDataScopeMock).toHaveBeenCalledWith("user-a");
    expect(screen.getByText("Private account data")).toBeInTheDocument();
  });

  it("remounts private state after the authenticated account changes", () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.userId = "user-a";
    const view = renderBoundary(<AccountScopedProbe />);

    expect(screen.getByText("Mounted for user-a")).toBeInTheDocument();

    authState.userId = "user-b";
    view.rerender(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <AccountDataBoundary>
                <AccountScopedProbe />
              </AccountDataBoundary>
            }
          />
          <Route path="/sign-in" element={<div>Sign in safely</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Mounted for user-b")).toBeInTheDocument();
    expect(prepareAccountLocalDataScopeMock).toHaveBeenLastCalledWith("user-b");
  });
});
