import { afterEach, describe, expect, it, vi } from "vitest";

import {
  detectHealthyLocalParserOrigin,
  resetLocalParserProbeCacheForTest,
  resolveParserEndpoints,
} from "../structuredUpload";

afterEach(() => {
  resetLocalParserProbeCacheForTest();
  vi.restoreAllMocks();
});

describe("resolveParserEndpoints", () => {
  it("prefers local loopback in local dev when configured", () => {
    const attempts = resolveParserEndpoints("/mistral-ocr/parse", {
      preferLoopback: true,
      env: {
        CONVEX_PARSER_URL: "https://parser.dasti.ai",
      },
    });

    expect(attempts[0]?.label).toBe("prefer:loopback");
    expect(attempts[0]?.endpoint.toString()).toBe(
      "http://127.0.0.1:8001/mistral-ocr/parse",
    );
    expect(attempts.map((attempt) => attempt.label)).toEqual([
      "prefer:loopback",
      "prefer:localhost",
      "env:CONVEX_PARSER_URL",
    ]);
  });

  it("keeps env-first selection by default", () => {
    const attempts = resolveParserEndpoints("/mistral-ocr/parse", {
      env: {
        CONVEX_PARSER_URL: "https://parser.dasti.ai",
      },
    });

    expect(attempts[0]?.label).toBe("env:CONVEX_PARSER_URL");
    expect(attempts[0]?.endpoint.toString()).toBe(
      "https://parser.dasti.ai/mistral-ocr/parse",
    );
  });

  it("allows local dev to resolve loopback without a remote parser env", () => {
    const attempts = resolveParserEndpoints("/parse-cv", {
      preferLoopback: true,
      env: {},
    });

    expect(attempts.map((attempt) => attempt.label)).toEqual([
      "prefer:loopback",
      "prefer:localhost",
    ]);
  });

  it("preserves the existing error when no parser origin is configured outside local-dev mode", () => {
    expect(() =>
      resolveParserEndpoints("/parse-cv", {
        env: {},
      }),
    ).toThrow(/requires CONVEX_PARSER_URL/);
  });

  it("detects a healthy loopback parser on 127.0.0.1", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true } as Response);

    await expect(detectHealthyLocalParserOrigin()).resolves.toBe(
      "http://127.0.0.1:8001",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBeInstanceOf(URL);
    expect((fetchMock.mock.calls[0]?.[0] as URL).toString()).toBe(
      "http://127.0.0.1:8001/ready",
    );
  });

  it("falls back to localhost when the first loopback origin is unavailable", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockResolvedValueOnce({ ok: true } as Response);

    await expect(detectHealthyLocalParserOrigin()).resolves.toBe(
      "http://localhost:8001",
    );
  });

  it("returns null when no local parser origin is healthy", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("connection refused"));

    await expect(detectHealthyLocalParserOrigin()).resolves.toBeNull();
  });
});
