import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CvsLibrary } from "../CvsLibrary";
import { createQuickStartLocationState } from "../../lib/quick-start-routing";

const navigateMock = vi.fn();
const createNewCvMock = vi.fn();
const deleteCvMock = vi.fn();
const loadCvMock = vi.fn();
const locationState = {
  pathname: "/cvs",
  search: "",
  state: null as unknown,
};

const mockCvLibraryState = {
  currentCvId: null as string | null,
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
  useLocation: () => locationState,
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    cvs: mockCvLibraryState.cvs,
    currentCvId: mockCvLibraryState.currentCvId,
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
    loadCvMock.mockReturnValue(true);
    locationState.pathname = "/cvs";
    locationState.search = "";
    locationState.state = null;
    mockCvLibraryState.currentCvId = null;
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

  it("opens an existing cv with /cv?id=<cvId>", () => {
    render(<CvsLibrary />);

    fireEvent.click(screen.getByRole("button", { name: /Alpha Resume/i }));

    expect(loadCvMock).toHaveBeenCalledWith("cv_1");
    expect(navigateMock).toHaveBeenCalledWith("/cv?id=cv_1");
  });

  it("creates a normal new CV from the main create action", async () => {
    createNewCvMock.mockImplementation(() => {
      mockCvLibraryState.currentCvId = "cv_new";
      return Promise.resolve();
    });

    const { rerender } = render(<CvsLibrary />);

    fireEvent.click(screen.getByRole("button", { name: "Create new resume" }));

    expect(createNewCvMock).toHaveBeenCalledTimes(1);
    rerender(<CvsLibrary />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/cv?id=cv_new");
    });
  });

  it("keeps Quick Start discoverable from the empty library state", () => {
    mockCvLibraryState.cvs = [];

    render(<CvsLibrary />);

    fireEvent.click(screen.getByRole("button", { name: "Quick Start" }));

    expect(createNewCvMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith(
      {
        pathname: "/cvs",
        search: "",
      },
      {
        state: createQuickStartLocationState(null),
      },
    );
  });

  it("navigates with /cv?id=<cvId> after create from the empty library state", async () => {
    mockCvLibraryState.cvs = [];
    createNewCvMock.mockImplementation(() => {
      mockCvLibraryState.currentCvId = "cv_empty_new";
      return Promise.resolve();
    });

    const { rerender } = render(<CvsLibrary />);

    fireEvent.click(screen.getByRole("button", { name: "Create your first resume" }));

    expect(createNewCvMock).toHaveBeenCalledTimes(1);
    rerender(<CvsLibrary />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/cv?id=cv_empty_new");
    });
  });
});
