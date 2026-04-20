import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { CvLibraryProvider } from "../CvLibraryContext";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isLoaded: false,
    isSignedIn: false,
  }),
}));

vi.mock("../../lib/convex-client", () => ({
  convexClient: {
    query: vi.fn(async () => null),
    mutation: vi.fn(async () => null),
    action: vi.fn(async () => null),
    setAuth: vi.fn(async () => undefined),
    clearAuth: vi.fn(async () => undefined),
  },
}));

vi.mock("uuid", () => ({
  v4: () => "mock-uuid-1",
}));

describe("CvLibraryContext debug controls", () => {
  beforeEach(() => {
    const storage: Record<string, string> = {};
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      writable: true,
      value: {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, value: string) => {
          storage[key] = value;
        },
        removeItem: (key: string) => {
          delete storage[key];
        },
        clear: () => {
          Object.keys(storage).forEach((key) => delete storage[key]);
        },
      },
    });
    Object.defineProperty(window, "__CV_EDITOR_DEBUG__", {
      configurable: true,
      writable: true,
      value: false,
    });
    vi.unstubAllEnvs();
    vi.stubEnv("DEV", "true");
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as Window & { localStorage?: Storage }).localStorage;
    delete (window as Window & { __CV_EDITOR_DEBUG__?: boolean }).__CV_EDITOR_DEBUG__;
  });

  it("does not render legacy debug controls in local/dev mode", () => {
    render(
      <CvLibraryProvider>
        <div>child</div>
      </CvLibraryProvider>,
    );

    expect(
      screen.queryByRole("button", { name: /toggle cv editor debug/i }),
    ).toBeNull();
    expect(screen.queryByText(/cv editor debug panel/i)).toBeNull();
  });

  it("keeps the debug control hidden in production unless explicitly enabled", () => {
    vi.stubEnv("DEV", "false");
    vi.stubEnv("NODE_ENV", "production");

    render(
      <CvLibraryProvider>
        <div>child</div>
      </CvLibraryProvider>,
    );

    expect(
      screen.queryByRole("button", { name: /toggle cv editor debug/i }),
    ).toBeNull();
    expect(screen.queryByText(/cv editor debug panel/i)).toBeNull();
  });

  it("does not render the debug panel even when the runtime debug flag is on", () => {
    (window as Window & { __CV_EDITOR_DEBUG__?: boolean }).__CV_EDITOR_DEBUG__ = true;

    render(
      <CvLibraryProvider>
        <div>child</div>
      </CvLibraryProvider>,
    );

    expect(
      screen.queryByRole("button", { name: /toggle cv editor debug/i }),
    ).toBeNull();
    expect(screen.queryByText(/cv editor debug panel/i)).toBeNull();
  });
});
