import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuickStartFlow } from "./QuickStartFlow";

const importCvMock = vi.fn();
const createNewCvMock = vi.fn();
const navigateMock = vi.fn();
const withSpansMock = vi.fn();
const strictOnlyMock = vi.fn();
const importStructuredMistralFileViaClientMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("convex/react", () => ({
  useAction: (ref: unknown) => {
    if (ref === "withSpans") return withSpansMock;
    if (ref === "strictOnly") return strictOnlyMock;
    return undefined;
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    actions: {
      extractProfileStrictWithSpans: "withSpans",
      extractProfileStrict: "strictOnly",
    },
  },
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    importCv: importCvMock,
    createNewCv: createNewCvMock,
  }),
}));

vi.mock("../useStructuredMistralImport", () => ({
  importStructuredMistralFileViaClient: importStructuredMistralFileViaClientMock,
}));

vi.mock("../../lib/onboarding-state", () => ({
  TONE_OPTIONS: [],
  markQuickStartCompleted: vi.fn(),
  writeTonePreference: vi.fn(),
}));

describe("QuickStartFlow PDF import", () => {
  beforeEach(() => {
    importCvMock.mockReset();
    createNewCvMock.mockReset();
    navigateMock.mockReset();
    withSpansMock.mockReset();
    strictOnlyMock.mockReset();
    importStructuredMistralFileViaClientMock.mockReset();
  });

  it("keeps the current UI but imports PDFs through the shared Mistral routine", async () => {
    importStructuredMistralFileViaClientMock.mockResolvedValue({
      status: "success",
      payload: {
        authoritativeResume: {
          source: "mistral_v3",
          trusted: true,
          fallbackToLegacy: false,
          normalized: {
            profile: {
              name: "Quick Candidate",
              desiredPosition: "Designer",
            },
          },
        },
      },
      authoritativeResume: {
        source: "mistral_v3",
        trusted: true,
        fallbackToLegacy: false,
        normalized: {
          profile: {
            name: "Quick Candidate",
            desiredPosition: "Designer",
          },
        },
      },
      sections: [
        {
          id: "profile-1",
          type: "profile",
          title: "Profile",
          blocks: [],
          collapsed: false,
          structuredContent: [
            {
              id: "profile-item-1",
              name: "Quick Candidate",
              desiredPosition: "Designer",
            },
          ],
        },
        {
          id: "summary-1",
          type: "summary",
          title: "Summary",
          blocks: [],
          collapsed: false,
          structuredContent: [{ id: "summary-item-1", summary: "Imported" }],
        },
      ],
      emptyReason: null,
    });

    render(<QuickStartFlow onExit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Upload a PDF");

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["pdf"], "resume.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(importStructuredMistralFileViaClientMock).toHaveBeenCalledTimes(1),
    );
    expect(importStructuredMistralFileViaClientMock).toHaveBeenCalledWith(file);
    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));
    expect(importCvMock.mock.calls[0][0]).toMatchObject({
      title: "Quick Candidate — Designer",
      metadata: expect.objectContaining({
        authoritativeResume: expect.objectContaining({
          source: "mistral_v3",
          trusted: true,
          fallbackToLegacy: false,
        }),
      }),
      sections: expect.arrayContaining([
        expect.objectContaining({ type: "profile" }),
        expect.objectContaining({ type: "summary" }),
      ]),
    });
    expect(withSpansMock).not.toHaveBeenCalled();
    expect(strictOnlyMock).not.toHaveBeenCalled();
  });

  it("keeps Quick Start on step 2 when OCR is fallback/untrusted", async () => {
    importStructuredMistralFileViaClientMock.mockResolvedValue({
      status: "rejected",
      payload: {
        diagnostics: {
          mistral_fallback: true,
          mistral_runtime: "local_fallback",
        },
      },
      message:
        "OCR import rejected (fallback/untrusted). Local fallback output is debug-only.",
    });

    render(<QuickStartFlow onExit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Upload a PDF");

    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["pdf"], "resume.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(
        screen.getByText(/OCR import rejected \(fallback\/untrusted\)/i),
      ).toBeInTheDocument(),
    );
    expect(importCvMock).not.toHaveBeenCalled();
    expect(screen.getByText("Upload a PDF")).toBeInTheDocument();
  });

  it("does not initialize the shared OCR import path before the user picks a PDF", async () => {
    render(<QuickStartFlow onExit={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText("Upload a PDF");

    expect(importStructuredMistralFileViaClientMock).not.toHaveBeenCalled();
  });
});
