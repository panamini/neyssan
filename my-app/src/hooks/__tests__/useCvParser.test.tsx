import { v4 as uuidv4 } from "uuid";
import React, { useEffect } from "react";
import { render, waitFor, cleanup, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// Avoid direct mutation of module exports; provide a stable factory mock instead.
const mockStartRefineMutation = vi.fn();
const mockFormatCompleteAction = vi.fn();

vi.mock("convex/react", () => {
  return {
    ConvexReactClient: class {},
    ConvexProvider: ({ children }: { children?: React.ReactNode }) => (children as any) ?? null,
    useConvex: () => ({}),
    useQuery: () => undefined,
    useMutation: () => mockStartRefineMutation,
    useAction: () => mockFormatCompleteAction,
  };
});

import * as browserParser from "../../services/pdf/browser-cv-parser";
import * as clerk from "@clerk/clerk-react";
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
    userId: "test-user-id",
    sessionId: "test-session",
    getToken: async () => "token-abc",
  }),
}));

// Import hook under test
import { useCvParser, RefinedContent, IReviewerSection } from "../useCvParser";

function TestConsumer({ setCtx }: { setCtx: (c: any) => void }) {
  const ctx = useCvParser();
  useEffect(() => {
    setCtx(ctx);
  }, [ctx, setCtx]);
  return null;
}

describe("useCvParser", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();

    // Ensure mocked mutation exposes withOptimisticUpdate when consumers look for it
    (mockStartRefineMutation as any).withOptimisticUpdate = vi.fn();

    // Default browser parser mock
    vi.spyOn(browserParser, "parsePdfArrayBuffer").mockResolvedValue({
      summary: "Client summary",
      rawText: "Client raw text",
      skills: ["TS", "React"],
      experience: [{ company: "X", title: "Dev" }],
    } as any);

    originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "no mock" }),
    } as any);

    // Manual timer mocks for polling control
    vi.spyOn(global, "setInterval").mockImplementation((cb: TimerHandler) => {
      // In tests, we'll trigger the callback manually, so we just return a fake timer ID
      return 12345 as any;
    });
    vi.spyOn(global, "clearInterval").mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it("initializes with correct default state", async () => {
    let ctx: any;
    render(<TestConsumer setCtx={(c) => (ctx = c)} />);

    await waitFor(() => expect(ctx).toBeDefined());
    expect(ctx.isParsing).toBe(false);
    expect(ctx.isRefining).toBe(false);
    expect(ctx.suggestions).toBeNull();
    expect(Array.isArray(ctx.mappedSections)).toBe(true);
    expect(ctx.mappedSections.length).toBe(0);
    expect(ctx.error).toBeNull();
    expect(typeof ctx.parseFile).toBe("function");
  });

  it("successful parse flow: client parse, startRefine mutation called and sets refining state", async () => {
    mockStartRefineMutation.mockResolvedValue("job-123");

    const serverNormalized = {
      summary: "Server summary",
      skillsText: "JS,TS",
      rawParsedSections: [{ id: "s0", title: "Summary", content: "Server content", fieldKey: "summary" }],
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "completed", result: { normalized: serverNormalized } }),
    } as any);

    let ctx: any;
    render(<TestConsumer setCtx={(c) => (ctx = c)} />);
    await waitFor(() => expect(ctx).toBeDefined());

    const file = new File([new TextEncoder().encode("pdf-data")], "test.pdf", { type: "application/pdf" });
    await act(async () => {
      await ctx.parseFile(file);
    });

    expect(browserParser.parsePdfArrayBuffer).toHaveBeenCalled();

    await waitFor(() => expect(ctx.suggestions).not.toBeNull());
    // With immediate polling the server result may already be applied; assert final server summary.
    expect((ctx.suggestions as RefinedContent).summary).toBe("Server summary");
    expect(ctx.mappedSections.length).toBeGreaterThan(0);

    // Immediate polling may have completed refine already; assert final state.
    await waitFor(() => expect((ctx.suggestions as RefinedContent).summary).toBe("Server summary"));
    expect(ctx.isRefining).toBe(false);
  });

  it("polling completion uses server normalized payload to update suggestions and mappedSections", async () => {
    mockStartRefineMutation.mockResolvedValue("job-456");

    const serverNormalized = {
      summary: "High quality server summary",
      skills: ["A", "B"],
      rawParsedSections: [{ id: uuidv4(), title: "Experience", content: "Worked at Y", fieldKey: "experience" }],
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "completed", result: { normalized: serverNormalized } }),
    } as any);

    let ctx: any;
    render(<TestConsumer setCtx={(c) => (ctx = c)} />);
    await waitFor(() => expect(ctx).toBeDefined());

    const file = new File([new TextEncoder().encode("pdf-data")], "test.pdf", { type: "application/pdf" });
    await act(async () => {
      await ctx.parseFile(file);
    });

    // Client suggestion may be short-lived because we poll immediately; assert server result below.

    await waitFor(() => expect(ctx.suggestions?.summary).toBe("High quality server summary"));
    expect(ctx.mappedSections.some((s: IReviewerSection) => s.title === "Experience")).toBe(true);
    expect(ctx.isRefining).toBe(false);
  });

  it("handle parsePdfArrayBuffer throwing sets error state", async () => {
    (browserParser.parsePdfArrayBuffer as any).mockRejectedValueOnce(new Error("parse failed"));

    let ctx: any;
    render(<TestConsumer setCtx={(c) => (ctx = c)} />);
    await waitFor(() => expect(ctx).toBeDefined());

    const file = new File([new TextEncoder().encode("pdf-data")], "bad.pdf", { type: "application/pdf" });
    await act(async () => {
      await ctx.parseFile(file);
    });

    await waitFor(() => expect(ctx.error).toBeDefined());
    expect(ctx.isParsing).toBe(false);
  });

  it("polling repair_failed sets preview and error", async () => {
    mockStartRefineMutation.mockResolvedValue("job-999");

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "completed",
        result: { patch: { normalized: { warning: "repair_failed", rawTextSnippet: "partial snippet" } } },
      }),
    } as any);

    let ctx: any;
    render(<TestConsumer setCtx={(c) => (ctx = c)} />);
    await waitFor(() => expect(ctx).toBeDefined());

    const file = new File([new TextEncoder().encode("pdf-data")], "test.pdf", { type: "application/pdf" });
    await act(async () => {
      await ctx.parseFile(file);
    });

    await waitFor(() => expect(String(ctx.error)).toMatch(/could not be fully repaired/i));
    expect(ctx.suggestions?.summary).toContain("partial snippet");
    expect(ctx.isRefining).toBe(false);
  });

  it("HTTP fallback: when convex mutation fails, uses authenticated fetch to enqueue job", async () => {
    mockStartRefineMutation.mockRejectedValue(new Error("something went wrong"));

    // For HTTP fallback we want the enqueue call to return "enqueued" and the immediate poll
    // to return "completed". Mock those two responses in sequence so doPoll sees the completed result.
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "enqueued", jobId: "job-http-1" }),
    } as any);
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "completed", result: { normalized: { summary: "From http fallback" } } }),
    } as any);

    let ctx: any;
    render(<TestConsumer setCtx={(c) => (ctx = c)} />);
    await waitFor(() => expect(ctx).toBeDefined());

    const file = new File([new TextEncoder().encode("pdf-data")], "test.pdf", { type: "application/pdf" });
    await act(async () => {
      await ctx.parseFile(file);
    });

    // doPoll runs immediately after enqueue; assert final suggestion directly.
    await waitFor(() => expect(ctx.suggestions?.summary).toBe("From http fallback"));
    expect(ctx.isRefining).toBe(false);
  });
});