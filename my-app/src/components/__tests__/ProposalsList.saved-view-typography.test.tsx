import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProposalsList from "../ProposalsList";

const proposalDisplaySpy = vi.fn();

const SAVED_PROPOSALS = [
  {
    _id: "proposal_custom",
    _creationTime: 1710000000000,
    title: "Saved custom proposal",
    content: "Dear On-site,\n\nCustom proposal body.",
    status: "saved",
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "signature",
      sourceCvId: "cv_alpha",
      templateId: "swiss_margin",
      templateBundleId: "magazine_editorial",
      styleLinkMode: "proposal_local",
      verbatiStyle: {
        layout: "swiss",
        typography: "studio-grotesk",
        palette: "pierre",
      },
    },
    sections: [{ type: "text", content: "Custom proposal body." }],
  },
  {
    _id: "proposal_inherit",
    _creationTime: 1710000001000,
    title: "Saved inherited proposal",
    content: "Dear On-site,\n\nInherited proposal body.",
    status: "saved",
    metadata: {
      proposalType: "cover_letter",
      voicePreset: "signature",
      sourceCvId: "cv_alpha",
      templateId: "swiss_margin",
      templateBundleId: "swiss_serif",
      styleLinkMode: "inherit_cv",
      verbatiStyle: {
        layout: "swiss",
        typography: "doto-code",
        palette: "pierre",
      },
    },
    sections: [{ type: "text", content: "Inherited proposal body." }],
  },
] as const;

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (query: string) =>
    query === "proposalsPublic.default" ? SAVED_PROPOSALS : null,
  useMutation: () => vi.fn().mockResolvedValue(undefined),
  useAction: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    proposalsPublic: { default: "proposalsPublic.default" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
    functions: {
      generateProposal: "functions.generateProposal",
    },
  },
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: true,
  }),
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: null,
  }),
}));

vi.mock("../ProposalDisplay", () => ({
  default: (props: Record<string, unknown>) => {
    proposalDisplaySpy(props);
    return <div data-testid="proposal-display" />;
  },
}));

describe("ProposalsList saved-view typography", () => {
  function getMainProposalDisplayCall() {
    return [...proposalDisplaySpy.mock.calls]
      .reverse()
      .find(([props]) => props.documentHeaderMode === "actions-only")
      ?.[0] as Record<string, unknown> | undefined;
  }

  beforeEach(() => {
    proposalDisplaySpy.mockClear();
    window.localStorage.clear();
  });

  it("preserves persisted custom typography instead of replacing it with a bundle default", async () => {
    render(
      <ProposalsList
        selectedProposalId="proposal_custom"
        onSelectedProposalIdChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(getMainProposalDisplayCall()?.stylePreset).toEqual(
        expect.objectContaining({
          layout: "swiss",
          typography: "studio-grotesk",
          palette: "pierre",
        }),
      );
    });
  });

  it("preserves persisted inherited typography instead of replacing it with a bundle default", async () => {
    render(
      <ProposalsList
        selectedProposalId="proposal_inherit"
        onSelectedProposalIdChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(getMainProposalDisplayCall()?.stylePreset).toEqual(
        expect.objectContaining({
          layout: "swiss",
          typography: "doto-code",
          palette: "pierre",
        }),
      );
    });
  });
});
