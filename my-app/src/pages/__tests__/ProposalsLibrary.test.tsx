import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProposalsLibrary } from "../ProposalsLibrary";

const navigateMock = vi.fn();
const deleteProposalMock = vi.fn().mockResolvedValue(undefined);

const SAVED_PROPOSALS = [
  {
    _id: "proposal_1",
    _creationTime: 1710000000000,
    title: "Operations Letter",
    content: "Dear team,\n\nI support delivery.\n\nBest regards,",
    status: "saved",
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "signature",
      sourceJobDescription: "Coordinate operations and delivery.",
    },
  },
] as const;

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ search: "" }),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
  }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
  }),
  useQuery: () => SAVED_PROPOSALS,
  useMutation: () => deleteProposalMock,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    proposalsPublic: { default: "proposalsPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

describe("ProposalsLibrary empty search results", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    deleteProposalMock.mockClear();
  });

  it("keeps the search controls anchored when a search returns no proposals", () => {
    render(<ProposalsLibrary />);

    const searchInput = screen.getByRole("searchbox", {
      name: "Search all proposals",
    });

    fireEvent.change(searchInput, { target: { value: "zzz" } });

    expect(
      screen.getByRole("searchbox", { name: "Search all proposals" }),
    ).toHaveValue("zzz");
    expect(
      screen.getByRole("button", { name: "Filter all proposals by tone" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sort all proposals" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No proposals match this search")).toBeInTheDocument();
  });
});
