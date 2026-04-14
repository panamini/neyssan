import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

const LOCAL_STORAGE_KEY = "cvDocuments";

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

  it("shows the debug control in local/dev mode", async () => {
    render(
      <CvLibraryProvider>
        <div>child</div>
      </CvLibraryProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /toggle cv editor debug/i }),
      ).toBeInTheDocument();
    });
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
  });

  it("reveals the existing debug panel after enabling debug", async () => {
    const user = userEvent.setup();

    render(
      <CvLibraryProvider>
        <div>child</div>
      </CvLibraryProvider>,
    );

    await user.click(
      await screen.findByRole("button", { name: /toggle cv editor debug/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/cv editor debug panel/i)).toBeInTheDocument();
    });
  });

  it("does not hide the debug control for trusted or untrusted local CVs", async () => {
    window.localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([
        {
          id: "cv-trusted",
          title: "Trusted CV",
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
            authoritativeResume: {
              source: "mistral_v3",
              trusted: true,
              fallbackToLegacy: false,
              normalized: { profile: { name: "Trusted Person" } },
            },
          },
          sections: [],
        },
        {
          id: "cv-standard",
          title: "Standard CV",
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
          },
          sections: [],
        },
      ]),
    );

    render(
      <CvLibraryProvider>
        <div>child</div>
      </CvLibraryProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /toggle cv editor debug/i }),
      ).toBeInTheDocument();
    });
  });
});
