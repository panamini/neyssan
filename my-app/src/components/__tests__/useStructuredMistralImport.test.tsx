import { renderHook } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const structuredActionMock = vi.fn();
const probeMistralMock = vi.fn();
const convexClientActionMock = vi.fn();

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

vi.mock("../../lib/convex-client", () => ({
  convexClient: {
    action: (ref: unknown, args: unknown) => convexClientActionMock(ref, args),
  },
}));

describe("useStructuredMistralImport", () => {
  beforeEach(() => {
    structuredActionMock.mockReset();
    probeMistralMock.mockReset();
    convexClientActionMock.mockReset();
    probeMistralMock.mockResolvedValue({
      ready: { status: 200 },
      parse: { status: 200 },
    });
  });

  it("keeps the direct client import path on structuredUpload without an extra probe round-trip", async () => {
    convexClientActionMock.mockImplementation(async (ref) => {
      if (ref === "structuredUpload") {
        return {
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
        };
      }
      if (ref === "probeMistral") {
        throw new Error("direct import path should not probe first");
      }
      throw new Error(`Unexpected action ref: ${String(ref)}`);
    });

    const { importStructuredMistralFileViaClient } = await import(
      "../useStructuredMistralImport"
    );

    const file = new File(["scan"], "scan.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    const outcome = await importStructuredMistralFileViaClient(file);

    expect(outcome).toMatchObject({
      status: "success",
      sections: expect.arrayContaining([
        expect.objectContaining({ type: "profile" }),
      ]),
    });
    expect(convexClientActionMock).toHaveBeenCalledTimes(1);
    expect(convexClientActionMock).toHaveBeenCalledWith(
      "structuredUpload",
      expect.any(Object),
    );
  });

  it("does not probe or replay a connection failure and returns the clear terminal message", async () => {
    const retryingMock = vi.fn();
    const retrySucceededMock = vi.fn();

    structuredActionMock.mockRejectedValueOnce(
      new Error("Connection lost while action was in flight"),
    );

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
      outcome = await result.current.importFile(file, {
        onRetrying: retryingMock,
        onRetrySucceeded: retrySucceededMock,
      });
    });

    expect(outcome).toMatchObject({
      status: "rejected",
      message: "Mistral OCR est momentanément indisponible. Réessayez.",
    });
    expect(probeMistralMock).not.toHaveBeenCalled();
    expect(structuredActionMock).toHaveBeenCalledTimes(1);
    expect(retryingMock).not.toHaveBeenCalled();
    expect(retrySucceededMock).not.toHaveBeenCalled();
  });

  it("returns the clear Mistral-unavailable message without importable sections", async () => {
    structuredActionMock.mockRejectedValueOnce(
      new Error(
        'Uncaught ConvexError: {"code":"mistral_ocr_unavailable","message":"Mistral OCR est momentanément indisponible. Réessayez."}',
      ),
    );

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
      message: "Mistral OCR est momentanément indisponible. Réessayez.",
    });
    expect(probeMistralMock).not.toHaveBeenCalled();
    expect(structuredActionMock).toHaveBeenCalledTimes(1);
  });

  it("preserves unknown action errors instead of mislabeling them as Mistral downtime", async () => {
    structuredActionMock.mockRejectedValueOnce(new Error("unauthorized"));

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

    await act(async () => {
      await expect(result.current.importFile(file)).rejects.toThrow(
        "unauthorized",
      );
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

  it("never issues a mount-time OCR probe", async () => {
    const { useStructuredMistralImport } = await import(
      "../useStructuredMistralImport"
    );
    renderHook(() => useStructuredMistralImport());

    await Promise.resolve();

    expect(probeMistralMock).not.toHaveBeenCalled();
  });
});
