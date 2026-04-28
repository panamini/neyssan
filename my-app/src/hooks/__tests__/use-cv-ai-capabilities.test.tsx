import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCvAiCapabilities } from "../use-cv-ai-capabilities";

const mockConvexQuery = vi.fn();
const mockConvexClient = {
  query: mockConvexQuery,
};

vi.mock("convex/react", () => ({
  useConvex: () => mockConvexClient,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: {
      getCvAiCapabilities: "getCvAiCapabilities",
    },
  },
}));

vi.mock("../../../convex/_generated/api.js", () => ({
  api: {
    functions: {
      getCvAiCapabilities: "getCvAiCapabilities",
    },
  },
}));

describe("useCvAiCapabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps experience responsibilities AI available when the capabilities query is unavailable", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockConvexQuery.mockRejectedValue(new Error("capabilities unavailable"));

    const { result } = renderHook(() => useCvAiCapabilities());

    await waitFor(() => {
      expect(result.current.status).toBe("stale");
    });

    expect(
      result.current.isSupported("improve_experience_responsibilities"),
    ).toBe(true);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});
