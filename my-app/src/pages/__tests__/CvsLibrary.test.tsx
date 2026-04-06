import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CvsLibrary } from "../CvsLibrary";

const navigateMock = vi.fn();
const createNewCvMock = vi.fn();
const deleteCvMock = vi.fn();
const loadCvMock = vi.fn();

const CVS = [
  {
    id: "cv_1",
    title: "Alpha Resume",
    sections: [],
    metadata: {
      updatedAt: "2026-04-06T08:00:00.000Z",
      createdAt: "2026-04-05T08:00:00.000Z",
    },
  },
] as const;

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    cvs: CVS,
    loadCv: loadCvMock,
    createNewCv: createNewCvMock,
    deleteCv: deleteCvMock,
  }),
}));

describe("CvsLibrary empty search results", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    createNewCvMock.mockReset();
    deleteCvMock.mockReset();
    loadCvMock.mockReset();
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
});
