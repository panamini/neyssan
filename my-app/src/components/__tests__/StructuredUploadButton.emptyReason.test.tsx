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
});
