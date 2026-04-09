import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";

import StructuredUploadButton from "../components/StructuredUploadButton";

const structuredActionMock = vi.fn();
const toastMock = vi.fn();
const consoleInfoMock = vi.spyOn(console, "info").mockImplementation(() => {});

vi.mock("../../convex/_generated/api", () => ({
  api: {
    actions: {
      structuredUpload: {
        structuredUpload: "structuredUpload",
      },
    },
  },
}))

vi.mock("convex/react", () => ({
  useAction: (ref: unknown) => {
    if (ref === "structuredUpload") {
      return structuredActionMock;
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
    toastMock.mockReset();
    consoleInfoMock.mockClear();
    Object.defineProperty(File.prototype, "text", {
      configurable: true,
      value: vi.fn().mockResolvedValue("John Doe"),
    });
    Object.defineProperty(File.prototype, "arrayBuffer", {
      configurable: true,
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
  });

  it("calls structured upload action and surfaces sections", async () => {
    const user = userEvent.setup();
    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Summary text",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
      },
      strict: {
        email: "john@example.com",
      },
    });

    const onApply = vi.fn();

    const { container } = render(
      <StructuredUploadButton
        onApplyToSections={onApply}
        onResult={() => {}}
      />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["John Doe"], "resume.txt", { type: "text/plain" });

    await user.click(screen.getByRole("button", { name: "Upload CV" }));
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(structuredActionMock).toHaveBeenCalledTimes(1));
    expect(structuredActionMock.mock.calls[0][0]).toEqual({
      rawText: "John Doe",
      mode: "text",
      useMistral: false,
    });

    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalled();
  });

  it("calls OCR import when the scanned route is selected", async () => {
    const user = userEvent.setup();
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
    });

    const { container } = render(<StructuredUploadButton />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["scan"], "scan.png", { type: "image/png" });

    await user.click(screen.getByRole("button", { name: "Scanned PDF / Image" }));
    fireEvent.change(fileInput, { target: { files: [file] } });

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
    const user = userEvent.setup();
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
    });

    const { container } = render(<StructuredUploadButton onResult={onResult} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["scan"], "scan.png", { type: "image/png" });

    await user.click(screen.getByRole("button", { name: "Scanned PDF / Image" }));
    fireEvent.change(fileInput, { target: { files: [file] } });

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

  it("holds low-confidence imports for recovery review instead of auto-applying", async () => {
    const user = userEvent.setup();
    structuredActionMock.mockResolvedValue({
      normalized: {
        summary: "Full summary",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [{ text: "Recovered achievement" }],
      },
      strict: null,
      recovery: {
        reviewRequired: true,
        items: [
          {
            blockId: "recovery-1",
            rawText: "Recovered achievement",
            cleanedText: "Recovered achievement",
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
          summary: "Base summary",
          experience: [],
          education: [],
          skillsText: "",
          languagesText: "",
          achievements: [],
        },
      },
    });

    const onApply = vi.fn();
    const onRecoveryRequired = vi.fn();

    const { container } = render(
      <StructuredUploadButton
        onApplyToSections={onApply}
        onRecoveryRequired={onRecoveryRequired}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["John Doe"], "resume.txt", { type: "text/plain" });

    await user.click(screen.getByRole("button", { name: "Upload CV" }));
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(onRecoveryRequired).toHaveBeenCalledTimes(1));
    expect(onApply).not.toHaveBeenCalled();
    expect(onRecoveryRequired.mock.calls[0][0].baseSections).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "summary" })]),
    );
    expect(onRecoveryRequired.mock.calls[0][0].fullSections).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "achievements" })]),
    );
  });
});
