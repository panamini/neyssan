import React, { useEffect } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { CvsLibrary } from "../CvsLibrary";
import { CvLibraryProvider, useCvLibrary } from "../../contexts/CvLibraryContext";
import { convexClient } from "../../lib/convex-client";

const { authState } = vi.hoisted(() => ({
  authState: {
    isLoaded: false,
    isSignedIn: false,
  },
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isLoaded: authState.isLoaded,
    isSignedIn: authState.isSignedIn,
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

vi.mock("uuid", () => {
  return {
    v4: () => {
      const g = globalThis as any;
      g.__mock_uuid_count = (g.__mock_uuid_count || 0) + 1;
      return `mock-uuid-${g.__mock_uuid_count}`;
    },
  };
});

function TestConsumer({ setCtx }: { setCtx: (ctx: any) => void }) {
  const ctx = useCvLibrary();
  useEffect(() => {
    setCtx(ctx);
  }, [ctx, setCtx]);
  return null;
}

function renderLibrary(setCtx: (ctx: any) => void) {
  return render(
    <MemoryRouter initialEntries={["/cvs"]}>
      <CvLibraryProvider>
        <TestConsumer setCtx={setCtx} />
        <CvsLibrary />
      </CvLibraryProvider>
    </MemoryRouter>,
  );
}

function readVisibleResumeOrder(): string[] {
  return screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent?.trim() ?? "")
    .filter(Boolean);
}

describe("CvsLibrary instability reproducer", () => {
  let storage: Record<string, string>;
  const mockLocalStorage = {
    get length() {
      return Object.keys(storage).length;
    },
    key: (index: number) => Object.keys(storage)[index] ?? null,
    getItem: (key: string) => (key in storage ? storage[key] : null),
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    clear: () => {
      storage = {};
    },
  };

  beforeEach(() => {
    storage = {};
    authState.isLoaded = false;
    authState.isSignedIn = false;
    Object.defineProperty(window, "localStorage", {
      value: mockLocalStorage,
      configurable: true,
      writable: true,
    });
    (globalThis as any).__mock_uuid_count = 0;
    vi.mocked(convexClient.query).mockReset();
    vi.mocked(convexClient.query).mockResolvedValue(null);
  });

  it("keeps the visible card order stable when opening another CV from the library", async () => {
    let ctx: any;
    renderLibrary((nextCtx) => {
      ctx = nextCtx;
    });

    await waitFor(() => expect(ctx).toBeDefined());

    act(() => {
      ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.cvs).toHaveLength(1));
    const firstId = ctx.currentCvId;

    act(() => {
      ctx.renameCv(firstId, "Older Resume");
    });
    await waitFor(() => expect(ctx.currentCv.title).toBe("Older Resume"));

    await act(async () => {
      await ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.cvs).toHaveLength(2));
    const secondId = ctx.currentCvId;

    act(() => {
      ctx.renameCv(secondId, "Newer Resume");
    });
    await waitFor(() => expect(ctx.currentCv.title).toBe("Newer Resume"));

    act(() => {
      ctx.loadCv(firstId);
    });
    await waitFor(() => expect(ctx.currentCvId).toBe(firstId));

    act(() => {
      ctx.updateCurrentCv({
        sections: [
          {
            id: "dirty-section",
            title: "Dirty",
            type: "summary",
            blocks: [],
            structuredContent: [{ id: "dirty-summary", summary: "Unsaved change" }],
          },
        ],
      });
    });
    await waitFor(() => expect(ctx.isDirty).toBe(true));

    await waitFor(() =>
      expect(readVisibleResumeOrder().slice(0, 2)).toEqual([
        "Newer Resume",
        "Older Resume",
      ]),
    );

    const newerCardButton = screen.getByRole("button", { name: /Newer Resume/i });
    fireEvent.click(newerCardButton);

    await waitFor(() => expect(ctx.currentCvId).toBe(secondId));

    expect(readVisibleResumeOrder().slice(0, 2)).toEqual([
      "Newer Resume",
      "Older Resume",
    ]);
  });
});
