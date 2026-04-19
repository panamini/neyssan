import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfileReviewCard } from "../ProfileReviewCard";

const structuredActionMock = vi.fn();
const importCvMock = vi.fn();
const reorderSectionsMock = vi.fn();
const renameCvMock = vi.fn();
const cvLibraryState = {
  currentCv: null as Record<string, unknown> | null,
  isLibraryHydrated: true,
};

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    actions: {
      structuredUpload: {
        structuredUpload: "structuredUpload",
      },
    },
    functions: {
      transformEditorSelection: "transformEditorSelection",
    },
  },
}));

vi.mock("convex/react", () => ({
  useAction: (ref: unknown) => {
    if (ref === "structuredUpload") {
      return structuredActionMock;
    }
    if (ref === "transformEditorSelection") {
      return vi.fn().mockResolvedValue({ text: "" });
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
    isLibraryHydrated: cvLibraryState.isLibraryHydrated,
    isDirty: false,
    reorderSections: reorderSectionsMock,
    addSection: vi.fn(),
    createNewCv: vi.fn(async () => {}),
    importCv: importCvMock,
    closeInspector: vi.fn(),
    renameCv: renameCvMock,
    registerBlockFlushCallback: () => () => {},
    isV1Active: true,
  }),
}));

vi.mock("../ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

describe("ProfileReviewCard rename prompt", () => {
  beforeEach(() => {
    structuredActionMock.mockReset();
    importCvMock.mockReset();
    reorderSectionsMock.mockReset();
    renameCvMock.mockReset();
    cvLibraryState.currentCv = null;
    cvLibraryState.isLibraryHydrated = true;
    window.sessionStorage.clear();
    Object.defineProperty(window, "__CV_EDITOR_DEBUG__", {
      configurable: true,
      writable: true,
      value: false,
    });
  });

  afterEach(() => {
    delete (window as Window & { __CV_EDITOR_DEBUG__?: boolean })
      .__CV_EDITOR_DEBUG__;
  });

  it("does not auto-open the rename dialog when reopening a generic imported CV", () => {
    cvLibraryState.currentCv = {
      id: "cv_imported",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [
        {
          id: "profile-1",
          type: "profile",
          title: "Profile",
          blocks: [],
          structuredContent: [
            {
              id: "profile-item-1",
              name: "Jane Doe",
              desiredPosition: "Operations Associate",
            },
          ],
        },
      ],
    };

    render(<ProfileReviewCard />);

    expect(screen.queryByText("Rename CV")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("e.g. Jane Doe — Product Manager"),
    ).not.toBeInTheDocument();
  });

  it("does not auto-open the rename dialog for a blank imported skeleton CV", () => {
    cvLibraryState.currentCv = {
      id: "cv_blank",
      title: "Imported CV",
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      sections: [],
    };

    render(<ProfileReviewCard />);

    expect(screen.queryByText("Rename CV")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("e.g. Jane Doe — Product Manager"),
    ).not.toBeInTheDocument();
  });
});
