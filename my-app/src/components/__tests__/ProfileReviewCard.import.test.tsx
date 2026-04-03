import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileReviewCard } from "../ProfileReviewCard";

const structuredActionMock = vi.fn();
const importCvMock = vi.fn();
const renameCvMock = vi.fn();
const exportCvMock = vi.fn();
const cvLibraryState = {
  currentCv: null as Record<string, unknown> | null,
};

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
  useConvex: () => ({
    query: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: cvLibraryState.currentCv,
    currentCvId: null,
    loadCv: vi.fn(),
    isLoading: false,
    isDirty: false,
    reorderSections: vi.fn(),
    addSection: vi.fn(),
    createNewCv: vi.fn(async () => {}),
    importCv: importCvMock,
    closeInspector: vi.fn(),
    renameCv: renameCvMock,
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
    renameCvMock.mockReset();
    exportCvMock.mockReset();
    cvLibraryState.currentCv = null;
    window.sessionStorage.clear();
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

    expect(screen.getByRole("button", { name: "Import CV" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Import CV" }));
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

  it("keeps the import drawer compact with one icon per route and no subtitles", async () => {
    const user = userEvent.setup();

    const { container } = render(<ProfileReviewCard />);

    await user.click(screen.getByRole("button", { name: "Import CV" }));

    const menu = container.querySelector(".dasti-import-dropdown__menu");

    expect(
      screen.getByRole("button", { name: /Import text PDF or TXT/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Import scanned PDF or image/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Selectable PDF or plain text resume/i),
    ).toBeNull();
    expect(
      screen.queryByText(/Image-based PDF, screenshot, or photo/i),
    ).toBeNull();
    expect(menu).toHaveClass("dasti-import-dropdown__menu--compact");
    expect(container.querySelectorAll(".dasti-menu-option__icon")).toHaveLength(2);
  });

  it("shows a dismissible import warning banner before the inline review list", async () => {
    const user = userEvent.setup();

    cvLibraryState.currentCv = {
      id: "cv_imported",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [],
    };

    render(<ProfileReviewCard />);

    expect(
      screen.getByRole("status", { name: "Import warning" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review flagged fields" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Import review checks"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(
      screen.queryByRole("status", { name: "Import warning" }),
    ).not.toBeInTheDocument();
    expect(
      window.sessionStorage.getItem("dasti:cv-import-warning-banner:cv_imported"),
    ).toContain("document-title-generic");
  });

  it("prompts for a real title when an imported CV keeps a generic name", async () => {
    const user = userEvent.setup();

    cvLibraryState.currentCv = {
      id: "cv_imported",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [],
    };

    render(<ProfileReviewCard />);

    expect(screen.getByText("Name this imported CV")).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText("e.g. Jane Doe — Product Manager"));
    await user.type(
      screen.getByPlaceholderText("e.g. Jane Doe — Product Manager"),
      "Jane Doe — Operations Associate",
    );
    await user.click(screen.getByRole("button", { name: "Save title" }));

    expect(renameCvMock).toHaveBeenCalledWith(
      "cv_imported",
      "Jane Doe — Operations Associate",
    );
  });

  it("blocks CV export until flagged import issues are reviewed", async () => {
    const user = userEvent.setup();

    cvLibraryState.currentCv = {
      id: "cv_imported",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [],
    };

    render(<ProfileReviewCard onRequestExport={exportCvMock} />);

    await user.click(screen.getByRole("button", { name: "Export CV as PDF" }));

    expect(exportCvMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Review flagged fields again" }),
    ).toBeInTheDocument();
  });
});
