import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileReviewCard } from "../ProfileReviewCard";

const structuredActionMock = vi.fn();
const importCvMock = vi.fn();

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    actions: {
      structuredUpload: {
        structuredUpload: "structuredUpload",
      },
    },
  },
}));

vi.mock("convex/react", () => ({
  useAction: (ref: unknown) => {
    if (ref === "structuredUpload") {
      return structuredActionMock;
    }
    return undefined;
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: null,
    currentCvId: null,
    loadCv: vi.fn(),
    isLoading: false,
    isDirty: false,
    reorderSections: vi.fn(),
    addSection: vi.fn(),
    createNewCv: vi.fn(async () => {}),
    importCv: importCvMock,
    closeInspector: vi.fn(),
    renameCv: vi.fn(),
    isV1Active: true,
  }),
}));

vi.mock("../ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

describe("ProfileReviewCard import", () => {
  beforeEach(() => {
    structuredActionMock.mockReset();
    importCvMock.mockReset();
    Object.defineProperty(File.prototype, "text", {
      configurable: true,
      value: vi.fn().mockResolvedValue("Imported CV text"),
    });
  });

  it("imports into a fresh CV when the workspace is empty", async () => {
    const user = userEvent.setup();

    structuredActionMock.mockResolvedValue({
      normalized: {
        profile: {
          name: "Jane Doe",
          email: "jane@example.com",
          title: "Product Manager",
        },
        summary: "Summary text",
        experience: [],
        education: [],
        skillsText: "",
        languagesText: "",
        achievements: [],
      },
      strict: null,
    });

    const { container } = render(<ProfileReviewCard />);

    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Import" }));
    await user.click(
      screen.getByRole("button", { name: /Import text PDF or TXT/i }),
    );
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    const file = new File(["Imported CV text"], "resume.txt", {
      type: "text/plain",
    });

    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => expect(importCvMock).toHaveBeenCalledTimes(1));
    expect(importCvMock.mock.calls[0][0]).toMatchObject({
      title: "Jane Doe — Product Manager",
    });
    expect(importCvMock.mock.calls[0][0].sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "profile" }),
        expect.objectContaining({ type: "summary" }),
      ]),
    );
  });
});
