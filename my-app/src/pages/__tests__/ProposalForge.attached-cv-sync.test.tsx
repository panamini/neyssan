import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";

const mockLoadCv = vi.fn();

let mockActiveCvId: string | null = null;
const mockAttachedCv = {
  id: "cv_alpha",
  title: "Alex Martin Resume",
  metadata: {
    updatedAt: "2026-03-31T00:00:00.000Z",
  },
  sections: [
    {
      id: "profile",
      type: "profile",
      title: "Profile",
      blocks: [],
      structuredContent: [
        {
          id: "profile_1",
          name: "Alex Martin",
          desiredPosition: "Operations Associate",
        },
      ],
    },
  ],
} as any;

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: () => null,
  useMutation: () => vi.fn().mockResolvedValue(undefined),
  useAction: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: {
      generateProposal: "functions.generateProposal",
    },
    proposalHandoffs: { get: "proposalHandoffs.get" },
    proposalSettings: { getCurrent: "proposalSettings.getCurrent" },
    proposalsPublic: { default: "proposalsPublic.default" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../lib/proposal-personalization", () => ({
  buildAppProposalPersonalizationPayload: () => ({}),
  clearActiveLocalCvId: () => {
    mockActiveCvId = null;
  },
  getProposalApplicantIdentity: () => ({
    name: "Alex Martin",
    role: "Operations Associate",
  }),
  getProposalAttachedCvId: () => mockActiveCvId,
  getLocalActiveCvSnapshotById: (id: string) =>
    id === "cv_alpha"
      ? { title: "Operations Associate — Alex Martin" }
      : null,
  getProposalAttachedCvLocalDocument: () =>
    mockActiveCvId === "cv_alpha" ? mockAttachedCv : null,
  getActiveLocalPersonalizationSource: () => ({
    title: mockActiveCvId === "cv_alpha" ? "Operations Associate — Alex Martin" : null,
    personalizationContext:
      mockActiveCvId === "cv_alpha"
        ? {
            name: "Alex Martin",
            desiredPosition: "Operations Associate",
          }
        : null,
  }),
  listLocalCvPickerOptions: () =>
    mockActiveCvId === "cv_alpha"
      ? [
          {
            id: "cv_alpha",
            title: "Operations Associate — Alex Martin",
            isActive: true,
          },
        ]
      : [],
  PROPOSAL_ATTACHED_CV_UPDATED_EVENT: "dasti:proposal-attached-cv-updated",
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: null,
    loadCv: mockLoadCv,
  }),
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: ({
    onActiveCvChange,
  }: {
    onActiveCvChange?: (cvId: string | null) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => {
          mockActiveCvId = "cv_alpha";
          onActiveCvChange?.("cv_alpha");
        }}
      >
        Attach CV from form
      </button>
      <button
        type="button"
        onClick={() => {
          mockActiveCvId = null;
          onActiveCvChange?.(null);
        }}
      >
        Remove CV from form
      </button>
    </div>
  ),
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: () => <div>Proposal output</div>,
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalComposeToolbar", () => ({
  ProposalComposeToolbar: ({
    onClearCv,
    cvTitle,
  }: {
    onClearCv?: () => void;
    cvTitle?: string | null;
  }) => (
    <div>
      <button type="button" aria-label={cvTitle ? `CV: ${cvTitle}` : "Pick CV"}>
        {cvTitle ?? "Pick CV"}
      </button>
      <button type="button" onClick={() => onClearCv?.()}>
        Remove CV from toolbar
      </button>
    </div>
  ),
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge attached CV sync", () => {
  beforeEach(() => {
    mockActiveCvId = null;
    mockLoadCv.mockReset();
    window.localStorage.clear();
  });

  it("keeps the proposal-level CV source control in sync with attach and remove actions", () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Pick CV" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Attach CV from form" }));

    expect(
      screen.getByRole("button", {
        name: /CV: Operations Associate — Alex Martin/i,
      }),
    ).toBeInTheDocument();
    expect(mockLoadCv).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove CV from form" }));

    expect(screen.getByRole("button", { name: "Pick CV" })).toBeInTheDocument();
  });

  it("clears the attached CV when the workspace toolbar remove action is used", () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Attach CV from form" }));

    expect(screen.getByText("Operations Associate — Alex Martin")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove CV from toolbar" }));

    expect(screen.getByRole("button", { name: "Pick CV" })).toBeInTheDocument();
  });
});
