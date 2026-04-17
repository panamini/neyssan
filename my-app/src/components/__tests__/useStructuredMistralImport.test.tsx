import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const structuredActionMock = vi.fn();
const probeMistralMock = vi.fn();

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    actions: {
      structuredUpload: {
        structuredUpload: "structuredUpload",
      },
      _probeMistral: {
        probe: "probeMistral",
      },
    },
  },
}));

vi.mock("convex/react", () => ({
  useAction: (ref: unknown) => {
    if (ref === "structuredUpload") {
      return structuredActionMock;
    }
    if (ref === "probeMistral") {
      return probeMistralMock;
    }
    return undefined;
  },
}));

describe("useStructuredMistralImport", () => {
  beforeEach(() => {
    structuredActionMock.mockReset();
    probeMistralMock.mockReset();
    probeMistralMock.mockResolvedValue({
      ready: { status: 200 },
      parse: { status: 200 },
    });
  });

  it("re-probes and retries transient network failures before returning trusted sections", async () => {
    const retryingMock = vi.fn();
    const retrySucceededMock = vi.fn();

    structuredActionMock
      .mockRejectedValueOnce(
        new Error("Connection lost while action was in flight"),
      )
      .mockResolvedValueOnce({
        normalized: {
          summary: "Scanned import",
        },
        strict: null,
        diagnostics: {
          ocr_request_path: "/mistral-ocr/parse",
          ocr_engine: "mistral",
          mistral_model: "mistral-ocr-latest",
          mistral_fallback: false,
          mistral_runtime: "mistral",
        },
        authoritativeResume: {
          source: "mistral_v3",
          trusted: true,
          fallbackToLegacy: false,
          normalized: {
            profile: {
              name: "Shared Candidate",
            },
            summary: {
              text: "Scanned import",
            },
          },
        },
      });

    const { useStructuredMistralImport } = await import(
      "../useStructuredMistralImport"
    );
    const { result } = renderHook(() => useStructuredMistralImport());
    await waitFor(() => expect(probeMistralMock).toHaveBeenCalledTimes(1));
    const file = new File(["scan"], "scan.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    let outcome: Awaited<ReturnType<typeof result.current.importFile>> | null =
      null;
    await act(async () => {
      outcome = await result.current.importFile(file, {
        onRetrying: retryingMock,
        onRetrySucceeded: retrySucceededMock,
      });
    });

    expect(probeMistralMock).toHaveBeenCalledTimes(2);
    expect(structuredActionMock).toHaveBeenCalledTimes(2);
    expect(retryingMock).toHaveBeenCalledTimes(1);
    expect(retrySucceededMock).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({
      status: "success",
      sections: expect.arrayContaining([
        expect.objectContaining({ type: "profile" }),
        expect.objectContaining({ type: "summary" }),
      ]),
    });
  });

  it("rejects fallback OCR without returning importable sections", async () => {
    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Broken fallback normalized payload",
      },
      strict: null,
      diagnostics: {
        ocr_request_path: "/mistral-ocr/parse",
        ocr_engine: "mistral",
        mistral_model: "mistral-ocr-latest",
        mistral_fallback: true,
        mistral_runtime: "local_fallback",
      },
      authoritativeResume: {
        source: "mistral_v3",
        trusted: false,
        fallbackToLegacy: true,
        normalized: null,
      },
    });

    const { useStructuredMistralImport } = await import(
      "../useStructuredMistralImport"
    );
    const { result } = renderHook(() => useStructuredMistralImport());
    const file = new File(["scan"], "scan.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    let outcome: Awaited<ReturnType<typeof result.current.importFile>> | null =
      null;
    await act(async () => {
      outcome = await result.current.importFile(file);
    });

    expect(outcome).toMatchObject({
      status: "rejected",
      message: expect.stringMatching(/fallback\/untrusted/i),
    });
  });

  it("can skip the mount-time probe for surfaces that should stay inert until upload", async () => {
    const { useStructuredMistralImport } = await import(
      "../useStructuredMistralImport"
    );
    renderHook(() => useStructuredMistralImport({ probeOnMount: false }));

    await Promise.resolve();

    expect(probeMistralMock).not.toHaveBeenCalled();
  });
});
