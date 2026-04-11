import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import React from "react";
import userEvent from "@testing-library/user-event";
import StructuredUploadButton from "../StructuredUploadButton";

const mockAction = vi.fn();

vi.mock("../../../convex/_generated/api", () => ({
  api: { actions: { structuredUpload: { structuredUpload: "structuredUploadAction" } } },
}));

vi.mock("convex/react", () => ({
  useAction: (ref: unknown) =>
    ref === "structuredUploadAction" ? mockAction : undefined,
}));

const showToast = vi.fn();
vi.mock("../ui/toast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../utils/cv/mapping-utils", () => ({
  buildTypedSectionsFromNormalized: vi.fn(() => []),
  applyStrictContactToSections: vi.fn((sections) => sections),
  engineHintFromDiagnostics: vi.fn(() => null),
}));

vi.mock("../types/cvDocument", () => ({}));

describe("StructuredUploadButton empty preview", () => {
  beforeEach(() => {
    mockAction.mockReset();
    showToast.mockReset();
    Object.defineProperty(window, "__CV_EDITOR_DEBUG__", {
      configurable: true,
      writable: true,
      value: false,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(File.prototype, "arrayBuffer", {
      configurable: true,
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
  });

  it("surfaces empty_reason instead of Pdf Bytes placeholder", async () => {
    const user = userEvent.setup();
    mockAction.mockResolvedValue({
      normalized: {
        summary: { text: "Pdf Bytes=123" },
        raw: "",
      },
      diagnostics: { empty_reason: "paddle_empty_pdfplumber" },
      strict: null,
    });

    const { container } = render(<StructuredUploadButton />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "resume.pdf", { type: "application/pdf" });

    await user.click(screen.getByRole("button", { name: "Upload CV" }));
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockAction).toHaveBeenCalledTimes(1);
      expect(showToast).toHaveBeenCalledWith(
        "Parser returned empty result: paddle_empty_pdfplumber",
        { variant: "warning" },
      );
    });

    const banner = await screen.findByText(/Empty reason:/i);
    expect(banner.textContent).toContain("paddle_empty_pdfplumber");

    const previewPlaceholder = screen.queryByText(/Pdf Bytes=/i);
    expect(previewPlaceholder).toBeNull();
  });

  it("shows debug copy controls and copies normalized and raw parser payloads", async () => {
    const user = userEvent.setup();
    (window as any).__CV_EDITOR_DEBUG__ = true;
    mockAction.mockResolvedValue({
      normalized: {
        name: "Jane Debug",
        rawText: "Jane Debug\nhttps://example.dev",
      },
      diagnostics: {},
      strict: null,
      debug: {
        rawParser: {
          result: { normalized: { name: "Jane Debug" } },
        },
      },
    });

    const { container } = render(<StructuredUploadButton />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "resume.pdf", { type: "application/pdf" });

    await user.click(screen.getByRole("button", { name: "Upload CV" }));
    fireEvent.change(input, { target: { files: [file] } });

    const normalizedButton = await screen.findByRole("button", {
      name: /copy normalized json/i,
    });
    const parserButton = await screen.findByRole("button", {
      name: /copy raw parser json/i,
    });

    await user.click(normalizedButton);
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Copied normalized JSON", {
        variant: "success",
      });
      expect(
        screen.getByRole("button", { name: /copied normalized json/i }),
      ).toBeInTheDocument();
    });

    await user.click(parserButton);
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Copied raw parser JSON", {
        variant: "success",
      });
    });
  });
});
