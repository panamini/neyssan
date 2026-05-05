import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProposalsList from "../ProposalsList";

const mockUpdateProposal = vi.fn().mockResolvedValue(undefined);

const SAVED_PROPOSALS = [
  {
    _id: "proposal_a",
    _creationTime: 1710000000000,
    title: "Proposal A",
    content: "Proposal A body.",
    status: "saved",
    metadata: {
      proposalType: "cover_letter",
      applicantName: "Row A Name",
      applicantRole: "Row A Role",
      contactLine: "row-a@example.com",
      letterDate: "Paris, 1 May 2026",
      recipientDetails: "Company A",
    },
  },
  {
    _id: "proposal_b",
    _creationTime: 1710000001000,
    title: "Proposal B",
    content: "Proposal B body.",
    status: "saved",
    metadata: {
      proposalType: "cover_letter",
      applicantName: "Row B Name",
      applicantRole: "Row B Role",
      contactLine: "row-b@example.com",
      letterDate: "Paris, 2 May 2026",
      recipientDetails: "Company B",
    },
  },
] as any;

const proposalDisplayProps: any[] = [];

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: (query: string) =>
    query === "proposalsPublic.default" ? SAVED_PROPOSALS : null,
  useMutation: (reference: string) =>
    reference === "updateProposalPublic.default"
      ? mockUpdateProposal
      : vi.fn().mockResolvedValue(undefined),
  useAction: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: { generateProposal: "functions.generateProposal" },
    proposalsPublic: { default: "proposalsPublic.default" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

vi.mock("../ui/toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({ currentCv: null }),
}));

vi.mock("../../lib/proposal-personalization", () => ({
  buildAppProposalPersonalizationPayload: () => ({}),
  getActiveLocalPersonalizationSource: () => ({
    title: "Global Resume",
    personalizationContext: null,
  }),
  getLocalCvDocumentById: () => null,
  getProposalAttachedCvId: () => null,
  getProposalApplicantHeaderData: () => ({
    name: "Global Profile Name",
    role: "Global Profile Role",
    email: "global@example.com",
    phone: null,
    website: null,
    location: null,
    linkedin: null,
  }),
}));

vi.mock("../ProposalDisplay", () => ({
  default: (props: any) => {
    proposalDisplayProps.push(props);
    return (
      <div data-testid="proposal-display">
        {props.railTitle} / {props.railMeta} / {props.contactLine}
      </div>
    );
  },
}));

vi.mock("../SavedProposalForgeToolbarPreview", () => ({
  SavedProposalForgeToolbarPreview: () => <div />,
}));

describe("ProposalsList heading isolation", () => {
  beforeEach(() => {
    proposalDisplayProps.length = 0;
    mockUpdateProposal.mockClear();
  });

  it("renders saved rows from row-local heading metadata instead of active profile defaults", () => {
    render(<ProposalsList />);

    expect(screen.getAllByTestId("proposal-display")).toHaveLength(2);
    expect(proposalDisplayProps[0]).toMatchObject({
      railTitle: "Row B Name",
      railMeta: "Row B Role",
      contactLine: "row-b@example.com",
      letterDate: "Paris, 2 May 2026",
      recipientDetails: "Company B",
    });
    expect(proposalDisplayProps[1]).toMatchObject({
      railTitle: "Row A Name",
      railMeta: "Row A Role",
      contactLine: "row-a@example.com",
      letterDate: "Paris, 1 May 2026",
      recipientDetails: "Company A",
    });
    expect(
      proposalDisplayProps.flatMap((props) => [
        props.railTitle,
        props.railMeta,
        props.applicantHeader?.name,
        props.applicantHeader?.role,
      ]),
    ).not.toContain("Global Profile Name");
  });
});
