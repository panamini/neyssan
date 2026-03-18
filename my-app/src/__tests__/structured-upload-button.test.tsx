import { render, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import StructuredUploadButton from "../components/StructuredUploadButton";

const structuredActionMock = vi.fn();
const toastMock = vi.fn();

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
  });

  it("calls structured upload action and surfaces sections", async () => {
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

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(structuredActionMock).toHaveBeenCalledTimes(1));
    expect(structuredActionMock.mock.calls[0][0]).toEqual({ rawText: "John Doe", mode: "text" });

    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalled();
  });
});
