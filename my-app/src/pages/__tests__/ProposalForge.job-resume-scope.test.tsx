import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ProposalForge } from "../ProposalForge";
import { createProposalWorkspaceResetState } from "../../lib/proposal-workspace-state";

const setJobResumeMock = vi.fn().mockResolvedValue(null);

const queryState = vi.hoisted(() => ({
  jobsById: {
    job_alpha: {
      id: "job_alpha",
      title: "Operations Associate",
      company: "Acme",
      sourceUrl: "https://example.com/jobs/alpha",
      sourceDomain: "example.com",
      sourceType: "extension",
      applicationUrl: "https://example.com/jobs/alpha",
      parseStatus: "parsed",
      reviewState: "needs_review",
      summary: "Support recurring operations and unblock coordination work.",
      rawDescription: "Coordinate internal workflows and keep teams aligned.",
      responsibilities: [],
      keywords: [],
      mustHaves: [],
      toneCues: [],
      contacts: [],
      status: "active",
      linkedProposalCount: 0,
      linkedProposals: [],
      reviewItems: [],
      resumeId: undefined,
      resumeName: undefined,
      resumeSource: undefined,
    },
    job_beta: {
      id: "job_beta",
      title: "Support Specialist",
      company: "Northwind",
      sourceUrl: "https://example.com/jobs/beta",
      sourceDomain: "example.com",
      sourceType: "extension",
      applicationUrl: "https://example.com/jobs/beta",
      parseStatus: "parsed",
      reviewState: "ready",
      summary: "Handle support requests and keep cases moving.",
      rawDescription: "Work support tickets and maintain clean handoffs.",
      responsibilities: [],
      keywords: [],
      mustHaves: [],
      toneCues: [],
      contacts: [],
      status: "active",
      linkedProposalCount: 0,
      linkedProposals: [],
      reviewItems: [],
      resumeId: undefined,
      resumeName: undefined,
      resumeSource: undefined,
    },
  } as Record<string, any>,
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (reference: string, args?: { jobId?: string } | "skip") => {
    if (reference === "jobsPublic.getById") {
      if (args === "skip" || !args?.jobId) {
        return undefined;
      }

      return queryState.jobsById[args.jobId] ?? null;
    }

    if (reference === "proposalSettings.getCurrent") {
      return undefined;
    }

    if (reference === "proposalsPublic.default") {
      return [];
    }

    return null;
  },
  useMutation: (reference: string) => {
    if (reference === "jobsPublic.setResumeForJob") {
      return setJobResumeMock;
    }

    return vi.fn().mockResolvedValue(undefined);
  },
  useAction: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: {
      generateProposal: "functions.generateProposal",
    },
    jobsPublic: {
      getById: "jobsPublic.getById",
      setResumeForJob: "jobsPublic.setResumeForJob",
      approveReviewItem: "jobsPublic.approveReviewItem",
      updateField: "jobsPublic.updateField",
    },
    proposalHandoffs: { get: "proposalHandoffs.get" },
    proposalSettings: { getCurrent: "proposalSettings.getCurrent" },
    proposalsPublic: { default: "proposalsPublic.default" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    createProposalPublic: { default: "createProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: null,
    currentCvId: null,
    cvs: [],
    loadCv: vi.fn(),
    importCv: vi.fn(),
  }),
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../lib/proposal-personalization", () => ({
  buildAppProposalPersonalizationPayload: () => ({}),
  getProposalApplicantHeaderData: () => ({
    name: "Alex Martin",
    role: "Operations Associate",
    email: "alex@example.com",
    phone: null,
    linkedin: null,
    website: null,
    location: null,
    tag: null,
  }),
  getProposalApplicantIdentity: () => ({
    name: "Alex Martin",
    role: "Operations Associate",
  }),
  getLocalPersonalizationSourceByCvId: (id: string | null | undefined) =>
    id === "cv_alpha"
      ? {
          title: "Operations Associate — Alex Martin",
          personalizationContext: {
            name: "Alex Martin",
            desiredPosition: "Operations Associate",
          },
          richness: "rich",
        }
      : {
          title: null,
          personalizationContext: null,
          richness: "none",
        },
  getLocalActiveCvSnapshotById: (id: string) =>
    id === "cv_alpha"
      ? { title: "Operations Associate — Alex Martin" }
      : null,
  getLocalCvDocumentById: () => null,
  listLocalCvPickerOptions: (activeCvId?: string | null) => [
    {
      id: "cv_alpha",
      title: "Operations Associate — Alex Martin",
      isActive: activeCvId === "cv_alpha",
    },
  ],
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: ({
    onActiveCvChange,
    activeCvId,
    canonicalJobId,
  }: {
    onActiveCvChange?: (cvId: string | null) => void;
    activeCvId?: string | null;
    canonicalJobId?: string | null;
  }) => (
    <div>
      <div data-testid="proposal-input-active-cv">{activeCvId ?? "none"}</div>
      <div data-testid="proposal-input-job">{canonicalJobId ?? "none"}</div>
      <button type="button" onClick={() => onActiveCvChange?.("cv_alpha")}>
        Attach CV from form
      </button>
      <button type="button" onClick={() => onActiveCvChange?.(null)}>
        Remove CV from form
      </button>
    </div>
  ),
}));

vi.mock("../../components/ProposalComposeToolbar", () => ({
  ProposalComposeToolbar: ({ cvTitle }: { cvTitle?: string | null }) => (
    <button type="button" aria-label={cvTitle ? `CV: ${cvTitle}` : "Pick CV"}>
      {cvTitle ?? "Pick CV"}
    </button>
  ),
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: () => <div>Proposal output</div>,
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

function renderRoute(
  route:
    | string
    | {
        pathname: string;
        search?: string;
        state?: unknown;
      },
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ProposalForge />
    </MemoryRouter>,
  );
}

describe("ProposalForge job resume scope", () => {
  beforeEach(() => {
    setJobResumeMock.mockClear();
    queryState.jobsById.job_alpha = {
      ...queryState.jobsById.job_alpha,
      resumeId: undefined,
      resumeName: undefined,
      resumeSource: undefined,
    };
    queryState.jobsById.job_beta = {
      ...queryState.jobsById.job_beta,
      resumeId: undefined,
      resumeName: undefined,
      resumeSource: undefined,
    };
  });

  it("persists the selected CV on the current job record and does not leak it to another job", async () => {
    const view = renderRoute("/proposal?jobId=job_alpha");

    expect(screen.getByTestId("proposal-input-job")).toHaveTextContent(
      "job_alpha",
    );
    expect(screen.getByRole("button", { name: "Pick CV" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Attach CV from form" }));

    await waitFor(() => {
      expect(setJobResumeMock).toHaveBeenCalledWith({
        jobId: "job_alpha",
        resumeId: "cv_alpha",
        resumeName: "Operations Associate — Alex Martin",
      });
    });

    expect(
      screen.getByRole("button", {
        name: "CV: Operations Associate — Alex Martin",
      }),
    ).toBeInTheDocument();

    view.unmount();
    renderRoute("/proposal?jobId=job_beta");

    await waitFor(() => {
      expect(screen.getByTestId("proposal-input-job")).toHaveTextContent(
        "job_beta",
      );
    });
    expect(screen.getByRole("button", { name: "Pick CV" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "CV: Operations Associate — Alex Martin",
      }),
    ).not.toBeInTheDocument();
  });

  it("hydrates the attached CV directly from the current job record", async () => {
    queryState.jobsById.job_alpha = {
      ...queryState.jobsById.job_alpha,
      resumeId: "cv_alpha",
      resumeName: "Operations Associate — Alex Martin",
      resumeSource: "job",
    };

    renderRoute("/proposal?jobId=job_alpha");

    await waitFor(() => {
      expect(screen.getByTestId("proposal-input-active-cv")).toHaveTextContent(
        "cv_alpha",
      );
    });
    expect(
      screen.getByRole("button", {
        name: "CV: Operations Associate — Alex Martin",
      }),
    ).toBeInTheDocument();
  });

  it("keeps the canonical jobId when opened from the jobs page reset-navigation path", async () => {
    queryState.jobsById.job_alpha = {
      ...queryState.jobsById.job_alpha,
      resumeId: "cv_alpha",
      resumeName: "Operations Associate — Alex Martin",
      resumeSource: "job",
    };

    renderRoute({
      pathname: "/proposal",
      search: "?jobId=job_alpha",
      state: createProposalWorkspaceResetState({
        entryIntent: "cover-letter-start",
      }),
    });

    await waitFor(() => {
      expect(screen.getByTestId("proposal-input-job")).toHaveTextContent(
        "job_alpha",
      );
    });
    expect(
      screen.getByTestId("proposal-input-active-cv"),
    ).toHaveTextContent("cv_alpha");
    expect(
      screen.getByRole("button", {
        name: "CV: Operations Associate — Alex Martin",
      }),
    ).toBeInTheDocument();
  });
});
