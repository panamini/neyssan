import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";

import StructuredUploadButton from "../components/StructuredUploadButton";

const structuredActionMock = vi.fn();
const probeMistralMock = vi.fn();
const toastMock = vi.fn();
const consoleInfoMock = vi.spyOn(console, "info").mockImplementation(() => {});

vi.mock("../../convex/_generated/api", () => ({
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
}))

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
}))

vi.mock("../components/ui/toast", () => ({
  useToast: () => ({ showToast: toastMock }),
}))

vi.mock("../services/pdf/browser-cv-parser", () => ({
  parsePdfArrayBuffer: vi.fn(),
}))

describe("StructuredUploadButton", () => {
  beforeEach(() => {
    structuredActionMock.mockReset();
    probeMistralMock.mockReset();
    toastMock.mockReset();
    consoleInfoMock.mockClear();
    probeMistralMock.mockResolvedValue({
      ready: { status: 200 },
      parse: { status: 200 },
    });
    Object.defineProperty(File.prototype, "text", {
      configurable: true,
      value: vi.fn().mockResolvedValue("John Doe"),
    });
    Object.defineProperty(File.prototype, "arrayBuffer", {
      configurable: true,
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
  });

  it("calls OCR import when the scanned route is selected", async () => {
    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Scanned import",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
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
            name: "Scan Candidate",
          },
          summary: {
            text: "Scanned import",
          },
        },
      },
    });

    render(<StructuredUploadButton />);
    const file = new File(["scan"], "scan.png", { type: "image/png" });
    const importButton = await screen.findByRole("button", {
      name: "Scanned PDF / Image",
    });

    fireEvent.drop(importButton, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(structuredActionMock).toHaveBeenCalledTimes(1));
    expect(structuredActionMock.mock.calls[0][0]).toMatchObject({
      fileName: "scan.png",
      mimeType: "image/png",
      mode: "auto",
      useMistral: true,
    });
    expect(consoleInfoMock).toHaveBeenCalledWith(
      "[StructuredUploadButton][mistral] evidence",
      expect.objectContaining({
        ocr_request_path: "/mistral-ocr/parse",
        ocr_engine: "mistral",
        mistral_model: "mistral-ocr-latest",
        mistral_fallback: false,
        mistral_runtime: "mistral",
      }),
    );
  });

  it("surfaces top-level Mistral diagnostics to onResult", async () => {
    const onResult = vi.fn();
    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Scanned import",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
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
            name: "Scan Candidate",
          },
        },
      },
    });

    render(<StructuredUploadButton onResult={onResult} />);
    const file = new File(["scan"], "scan.png", { type: "image/png" });
    const importButton = await screen.findByRole("button", {
      name: "Scanned PDF / Image",
    });

    fireEvent.drop(importButton, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    expect(onResult.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        diagnostics: expect.objectContaining({
          ocr_request_path: "/mistral-ocr/parse",
          ocr_engine: "mistral",
          mistral_model: "mistral-ocr-latest",
          mistral_fallback: false,
          mistral_runtime: "mistral",
        }),
      }),
    );
  });

  it("imports scanned OCR only from trusted authoritative Mistral output", async () => {
    const onApply = vi.fn();
    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Fallback normalized should stay debug-only",
      },
      strict: {
        email: "scan@example.com",
      },
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
            name: "Trusted Scan",
            email: "scan@example.com",
          },
          summary: {
            text: "Trusted OCR summary",
          },
        },
      },
    });

    render(<StructuredUploadButton onApplyToSections={onApply} />);
    const file = new File(["scan"], "scan.png", { type: "image/png" });
    const importButton = await screen.findByRole("button", {
      name: "Scanned PDF / Image",
    });

    fireEvent.drop(importButton, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(onApply.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "profile" }),
        expect.objectContaining({ type: "summary" }),
      ]),
    );
    expect(
      screen.queryByText(/OCR import rejected \(fallback\/untrusted\)/i),
    ).toBeNull();
  });

  it("rejects fallback OCR payloads instead of importing normalized sections or opening recovery", async () => {
    const onApply = vi.fn();
    structuredActionMock.mockResolvedValue({
      normalized: {
        profile: {
          name: "Fallback Candidate",
        },
        summary: "Broken fallback normalized payload",
        achievements: [{ text: "Fragmented item" }],
      },
      strict: null,
      diagnostics: {
        ocr_request_path: "/mistral-ocr/parse",
        ocr_engine: "mistral",
        mistral_model: "mistral-ocr-latest",
        mistral_fallback: true,
        mistral_runtime: "local_fallback",
      },
      recovery: {
        reviewRequired: true,
        items: [
          {
            blockId: "ocr-recovery-1",
            rawText: "Fragmented item",
            cleanedText: "Fragmented item",
            displayTextSource: "cleaned",
            predictedSection: "achievements",
            selectedSection: "achievements",
            confidenceScore: "low",
            confidenceValue: 0.4,
            issueFlags: ["weakSectionMatch"],
            reviewStatus: "pending",
            sourceSectionTitle: "Achievements",
            sourceFieldKey: "achievements",
            fragmentAssignments: [],
          },
        ],
        totalItems: 1,
        overflowCount: 0,
        reviewLimit: 12,
        reviewNormalized: {
          summary: "Fallback base summary",
        },
      },
      authoritativeResume: {
        source: "mistral_v3",
        trusted: false,
        fallbackToLegacy: true,
        normalized: null,
      },
    });

    render(<StructuredUploadButton onApplyToSections={onApply} />);
    const file = new File(["scan"], "scan.png", { type: "image/png" });
    const importButton = await screen.findByRole("button", {
      name: "Scanned PDF / Image",
    });

    fireEvent.drop(importButton, { dataTransfer: { files: [file] } });

    await waitFor(() =>
      expect(
        screen.getByText(/OCR import rejected \(fallback\/untrusted\)/i),
      ).toBeInTheDocument(),
    );
    expect(onApply).not.toHaveBeenCalled();
  });

  it("keeps scanned import clickable when the probe says the OCR parse route is unhealthy", async () => {
    probeMistralMock.mockResolvedValueOnce({
      ready: { status: 200 },
      parse: { status: 0 },
    });

    render(<StructuredUploadButton />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Scanned PDF / Image" })).toBeEnabled(),
    );
  });

  it("re-probes Mistral on scanned upload instead of trusting stale cached success", async () => {
    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Scanned import",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
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
          summary: {
            text: "Scanned import",
          },
        },
      },
    });

    render(<StructuredUploadButton />);
    const file = new File(["scan"], "scan.png", { type: "image/png" });

    await waitFor(() => expect(probeMistralMock).toHaveBeenCalledTimes(1));
    fireEvent.drop(screen.getByRole("button", { name: "Scanned PDF / Image" }), {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => expect(structuredActionMock).toHaveBeenCalledTimes(1));
    expect(probeMistralMock).toHaveBeenCalledTimes(2);
  });

  it("continues scanned upload when the click-time probe fails transiently", async () => {
    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Scanned import",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
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
          summary: {
            text: "Scanned import",
          },
        },
      },
    });
    probeMistralMock
      .mockResolvedValueOnce({
        ready: { status: 200 },
        parse: { status: 200 },
      })
      .mockResolvedValueOnce({
        ready: { status: 200 },
        parse: { status: 0 },
      });

    render(<StructuredUploadButton />);
    const file = new File(["scan"], "scan.png", { type: "image/png" });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Scanned PDF / Image" })).toBeEnabled(),
    );
    fireEvent.drop(screen.getByRole("button", { name: "Scanned PDF / Image" }), {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => expect(structuredActionMock).toHaveBeenCalledTimes(1));
    expect(probeMistralMock).toHaveBeenCalledTimes(2);
  });
});
