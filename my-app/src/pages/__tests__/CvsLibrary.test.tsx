import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CvsLibrary } from "../CvsLibrary";

const navigateMock = vi.fn();
const createNewCvMock = vi.fn();
const deleteCvMock = vi.fn();
const loadCvMock = vi.fn();

const mockCvLibraryState = {
  cvs: [
    {
      id: "cv_1",
      title: "Alpha Resume",
      sections: [],
      metadata: {
        updatedAt: "2026-04-06T08:00:00.000Z",
        createdAt: "2026-04-05T08:00:00.000Z",
      },
    },
  ] as Array<{
    id: string;
    title: string;
    sections: unknown[];
    metadata: {
      updatedAt: string;
      createdAt: string;
    };
  }>,
};

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    cvs: mockCvLibraryState.cvs,
    loadCv: loadCvMock,
    createNewCv: createNewCvMock,
    deleteCv: deleteCvMock,
  }),
}));

describe("CvsLibrary", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    createNewCvMock.mockReset();
    deleteCvMock.mockReset();
    loadCvMock.mockReset();
    mockCvLibraryState.cvs = [
      {
        id: "cv_1",
        title: "Alpha Resume",
        sections: [],
        metadata: {
          updatedAt: "2026-04-06T08:00:00.000Z",
          createdAt: "2026-04-05T08:00:00.000Z",
        },
      },
    ];
  });

  it("keeps the search controls visible when a search returns no resumes", () => {
    render(<CvsLibrary />);

    const searchInput = screen.getByRole("searchbox", {
      name: "Search all resumes",
    });

    fireEvent.change(searchInput, { target: { value: "zzz" } });

    expect(
      screen.getByRole("searchbox", { name: "Search all resumes" }),
    ).toHaveValue("zzz");
    expect(screen.getByRole("combobox", { name: "Sort all resumes" })).toBeInTheDocument();
    expect(screen.getByText("No resumes match this search")).toBeInTheDocument();
  });

  it("creates a normal new CV from the main create action", () => {
    render(<CvsLibrary />);

    fireEvent.click(screen.getByRole("button", { name: "Create new resume" }));

    expect(createNewCvMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/cv");
  });

  it("keeps Quick Start discoverable from the empty library state", () => {
    mockCvLibraryState.cvs = [];

    render(<CvsLibrary />);

    fireEvent.click(screen.getByRole("button", { name: "Quick Start" }));

    expect(createNewCvMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/cv?start=quick");
  });
});
