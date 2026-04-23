import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProposalForge } from "../ProposalForge";

const {
  authState,
  queryState,
  queryCalls,
  mockMutation,
  mockAction,
  mockLoadCv,
  generatedApiModule,
} = vi.hoisted(() => {
  const mutation = vi.fn().mockResolvedValue(undefined);
  const mutationHook = Object.assign(
    (...args: any[]) => mutation(...args),
    { withOptimisticUpdate: () => {} },
  );

  return {
    authState: {
      isLoading: true,
      isAuthenticated: false,
    },
    queryState: {
      canonicalJobRecord: undefined as Record<string, unknown> | undefined,
    },
    queryCalls: [] as Array<{ query: unknown; args: unknown }>,
    mockMutation: mutationHook,
    mockAction: vi.fn().mockResolvedValue(null),
    mockLoadCv: vi.fn(() => true),
    generatedApiModule: {
      api: {
        functions: {
          generateProposal: "functions.generateProposal",
        },
        jobs: {
          requestProposalGenerationCancel:
            "jobs.requestProposalGenerationCancel",
        },
        jobsPublic: {
          getById: "jobsPublic.getById",
          approveReviewItem: "jobsPublic.approveReviewItem",
          updateField: "jobsPublic.updateField",
        },
        proposalHandoffs: { get: "proposalHandoffs.get" },
        proposalSettings: {
          getCurrent: "proposalSettings.getCurrent",
          setCurrent: "proposalSettings.setCurrent",
        },
        proposalsPublic: { default: "proposalsPublic.default" },
        updateProposalPublic: { default: "updateProposalPublic.default" },
        createProposalPublic: { default: "createProposalPublic.default" },
        deleteProposalPublic: { default: "deleteProposalPublic.default" },
        activeCvSnapshots: { setCurrent: "activeCvSnapshots.setCurrent" },
      },
    },
  };
});

vi.mock("convex/react", () => ({
  useConvexAuth: () => authState,
  useQuery: (query: unknown, args?: unknown) => {
    queryCalls.push({ query, args });

    if (query === generatedApiModule.api.jobsPublic.getById) {
      if (args === "skip") {
        return undefined;
      }

      return queryState.canonicalJobRecord;
    }

    if (query === generatedApiModule.api.proposalHandoffs.get) {
      return null;
    }

    if (query === generatedApiModule.api.proposalSettings.getCurrent) {
      return undefined;
    }

    if (query === generatedApiModule.api.proposalsPublic.default) {
      return [];
    }

    return null;
  },
  useMutation: () => mockMutation,
  useAction: () => mockAction,
}));

vi.mock("../../../convex/_generated/api", () => generatedApiModule);
vi.mock("../../../convex/_generated/api.js", () => generatedApiModule);

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    cvs: [],
    currentCv: null,
    currentCvId: null,
    loadCv: mockLoadCv,
  }),
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: () => <div>Proposal output</div>,
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

vi.mock("../../components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogActions: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("../../lib/proposal-personalization", () => ({
  buildAppProposalPersonalizationPayload: () => ({}),
  clearActiveLocalCvId: vi.fn(),
  formatCvDisplaySubtitle: ({ title }: { title?: string | null }) =>
    title ?? "",
  getActiveLocalPersonalizationSource: () => ({
    title: null,
    personalizationContext: null,
  }),
  getLocalPersonalizationSourceByCvId: () => ({
    title: null,
    personalizationContext: null,
  }),
  getLocalActiveCvSnapshotById: () => null,
  getLocalCvDocumentById: () => null,
  getProposalApplicantHeaderData: () => ({
    name: "Alex Martin",
    role: "Operations Associate",
    email: "alex@example.com",
    location: "Paris",
    phone: "",
    website: "",
  }),
  getProposalApplicantIdentity: () => ({
    name: "Alex Martin",
    role: "Operations Associate",
    email: "alex@example.com",
    location: "Paris",
    phone: "",
    website: "",
  }),
  getProposalAttachedCvId: () => null,
  getProposalAttachedCvLocalDocument: () => null,
  listLocalCvPickerOptions: () => [],
  PROPOSAL_ATTACHED_CV_UPDATED_EVENT: "proposal-attached-cv-updated",
  setActiveLocalCvId: vi.fn(),
  setProposalAttachedCvId: vi.fn(),
}));

function renderProposalForge() {
  return (
    <MemoryRouter initialEntries={["/proposal?jobId=job_123"]}>
      <ProposalForge />
    </MemoryRouter>
  );
}

describe("ProposalForge jobId auth hydration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    authState.isLoading = true;
    authState.isAuthenticated = false;
    queryState.canonicalJobRecord = undefined;
    queryCalls.length = 0;
    mockLoadCv.mockReset().mockReturnValue(true);
  });

  it("hydrates the real compose inputs after auth becomes ready and the canonical job resolves", async () => {
    const view = render(renderProposalForge());

    expect(screen.getByText("Loading saved job brief…")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Enter Job Title")).not.toBeInTheDocument();

    const initialCanonicalCalls = queryCalls
      .filter((entry) => entry.query === generatedApiModule.api.jobsPublic.getById)
      .map((entry) => entry.args);
    expect(initialCanonicalCalls).toContain("skip");

    await act(async () => {
      authState.isLoading = false;
      authState.isAuthenticated = true;
      view.rerender(renderProposalForge());
    });

    expect(screen.getByText("Loading saved job brief…")).toBeInTheDocument();

    await act(async () => {
      queryState.canonicalJobRecord = {
        id: "job_123",
        title: "Operations Associate",
        company: "Studio North",
        sourceUrl: "https://example.com/jobs/123",
        sourceDomain: "example.com",
        sourceType: "extension",
        applicationUrl: "https://example.com/jobs/123",
        parseStatus: "parsed",
        reviewState: "needs_review",
        summary:
          "Operations Associate role focused on recurring launches and structured handoffs.",
        rawDescription:
          "Coordinate recurring launches, keep handoffs clear, and maintain documentation.",
        responsibilities: ["Coordinate recurring launches"],
        keywords: ["operations", "handoffs"],
        mustHaves: ["documentation"],
        toneCues: ["structured"],
        contacts: [],
        status: "ready",
        linkedProposalCount: 0,
        linkedProposals: [],
        reviewItems: [],
      };
      view.rerender(renderProposalForge());
    });

    const jobTitleInput = await screen.findByPlaceholderText("Enter Job Title");
    await waitFor(() =>
      expect(jobTitleInput).toHaveValue("Operations Associate"),
    );

    const jobDescriptionInput = await screen.findByPlaceholderText(
      "Paste or write the job offer here…",
    );
    expect(jobDescriptionInput).toHaveValue(
      "Coordinate recurring launches, keep handoffs clear, and maintain documentation.",
    );

    const authenticatedCanonicalCalls = queryCalls
      .filter((entry) => entry.query === generatedApiModule.api.jobsPublic.getById)
      .map((entry) => entry.args);
    expect(authenticatedCanonicalCalls).toContainEqual({ jobId: "job_123" });

    await act(async () => {
      view.rerender(renderProposalForge());
    });

    expect(screen.getByPlaceholderText("Enter Job Title")).toHaveValue(
      "Operations Associate",
    );
    expect(
      screen.getByPlaceholderText("Paste or write the job offer here…"),
    ).toHaveValue(
      "Coordinate recurring launches, keep handoffs clear, and maintain documentation.",
    );
  });
});
