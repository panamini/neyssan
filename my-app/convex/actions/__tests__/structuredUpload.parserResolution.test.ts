import { afterEach, describe, expect, it, vi } from "vitest";

import {
  detectHealthyLocalParserOrigin,
  MISTRAL_IMPORT_MIN_RETRY_REMAINING_MS,
  MISTRAL_IMPORT_MAX_RETRY_ELAPSED_MS,
  resetLocalParserProbeCacheForTest,
  resolveParserEndpoints,
  selectParserAttemptsForImport,
  shouldRetryMistralImportRequest,
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

  it("puts the healthy loopback origin first when localhost is the one that passed /ready", () => {
    const attempts = resolveParserEndpoints("/mistral-ocr/parse", {
      preferLoopback: true,
      preferredLoopbackOrigin: "http://localhost:8001",
      env: {
        CONVEX_PARSER_URL: "https://parser.dasti.ai",
      },
    });

    expect(attempts[0]?.label).toBe("prefer:healthy-loopback");
    expect(attempts[0]?.endpoint.toString()).toBe(
      "http://localhost:8001/mistral-ocr/parse",
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

describe("Mistral import retry policy", () => {
  it("keeps one loopback alias while preserving configured Mistral gateways", () => {
    const candidates = resolveParserEndpoints("/mistral-ocr/parse", {
      preferLoopback: true,
      includeConfiguredFallbacks: true,
      env: {
        CONVEX_PARSER_URL: "https://parser.dasti.ai",
        PARSER_ORIGIN: "https://parser-backup.dasti.ai",
      },
    });

    const mistralCandidates = selectParserAttemptsForImport(candidates, true);
    expect(mistralCandidates.map((attempt) => attempt.label)).toEqual([
      "prefer:loopback",
      "env:CONVEX_PARSER_URL",
      "env:PARSER_ORIGIN",
    ]);
    expect(selectParserAttemptsForImport(candidates, false)).toHaveLength(
      candidates.length,
    );
  });

  it("permits one quick transient retry only while enough budget remains", () => {
    expect(
      shouldRetryMistralImportRequest({
        completedAttempts: 1,
        elapsedMs: MISTRAL_IMPORT_MAX_RETRY_ELAPSED_MS,
        remainingMs: MISTRAL_IMPORT_MIN_RETRY_REMAINING_MS,
      }),
    ).toBe(true);
    expect(
      shouldRetryMistralImportRequest({
        completedAttempts: 1,
        elapsedMs: MISTRAL_IMPORT_MAX_RETRY_ELAPSED_MS,
        remainingMs: MISTRAL_IMPORT_MIN_RETRY_REMAINING_MS - 1,
      }),
    ).toBe(false);
    expect(
      shouldRetryMistralImportRequest({
        completedAttempts: 2,
        elapsedMs: 1,
        remainingMs: 60_000,
      }),
    ).toBe(false);
    expect(
      shouldRetryMistralImportRequest({
        completedAttempts: 1,
        elapsedMs: MISTRAL_IMPORT_MAX_RETRY_ELAPSED_MS + 1,
        remainingMs: 60_000,
      }),
    ).toBe(false);
  });
});
