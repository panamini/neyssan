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
      publicHandoffRecord: {
        handoffId: "handoff_123",
        jobTitle: "Imported Product Ops Lead",
        jobDescription:
          "Own project coordination, keep handoffs clear, and maintain delivery momentum.",
        sourceUrl: "https://example.com/jobs/123",
        platform: "linkedin",
      } as Record<string, unknown> | null | undefined,
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
        proposalHandoffs: {
          get: "proposalHandoffs.get",
          getPublic: "proposalHandoffs.getPublic",
        },
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

    if (query === generatedApiModule.api.proposalHandoffs.getPublic) {
      if (args === "skip") {
        return undefined;
      }

      return queryState.publicHandoffRecord;
    }

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
    <MemoryRouter
      initialEntries={[
        "/proposal?jobId=job_123&handoffId=handoff_123&handoffToken=token_123",
      ]}
    >
      <ProposalForge />
    </MemoryRouter>
  );
}

function buildCanonicalJobRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "job_123",
    title: "Canonical Operations Lead",
    company: "Studio North",
    sourceUrl: "https://example.com/jobs/123",
    sourceDomain: "example.com",
    sourceType: "extension",
    applicationUrl: "https://example.com/jobs/123",
    parseStatus: "parsed",
    reviewState: "needs_review",
    summary: "Canonical summary",
    rawDescription: "Canonical job description that should not replace the editor seed.",
    responsibilities: ["Canonical responsibility"],
    keywords: ["canonical"],
    mustHaves: ["canonical"],
    toneCues: ["structured"],
    contacts: [],
    status: "ready",
    linkedProposalCount: 0,
    linkedProposals: [],
    reviewItems: [],
    ...overrides,
  };
}

describe("ProposalForge public handoff hydration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    authState.isLoading = true;
    authState.isAuthenticated = false;
    queryState.publicHandoffRecord = {
      handoffId: "handoff_123",
      jobTitle: "Imported Product Ops Lead",
      jobDescription:
        "Own project coordination, keep handoffs clear, and maintain delivery momentum.",
      sourceUrl: "https://example.com/jobs/123",
      platform: "linkedin",
    };
    queryState.canonicalJobRecord = undefined;
    queryCalls.length = 0;
    mockLoadCv.mockReset().mockReturnValue(true);
  });

  it("hydrates the real visible compose inputs from the public handoff before auth is ready", async () => {
    render(renderProposalForge());

    const jobTitleInput = await screen.findByPlaceholderText("Job title");
    const jobDescriptionInput = await screen.findByPlaceholderText(
      "Paste job offer",
    );

    expect(jobTitleInput).toHaveValue("Imported Product Ops Lead");
    expect(jobDescriptionInput).toHaveValue(
      "Own project coordination, keep handoffs clear, and maintain delivery momentum.",
    );
    expect(
      screen.queryByText("Loading saved job brief…"),
    ).not.toBeInTheDocument();

    const canonicalCalls = queryCalls
      .filter((entry) => entry.query === generatedApiModule.api.jobsPublic.getById)
      .map((entry) => entry.args);
    expect(canonicalCalls).toContain("skip");
  });

  it("keeps the visible fields populated when auth becomes ready and the canonical job resolves", async () => {
    const view = render(renderProposalForge());

    await screen.findByDisplayValue("Imported Product Ops Lead");
    await screen.findByDisplayValue(
      "Own project coordination, keep handoffs clear, and maintain delivery momentum.",
    );

    await act(async () => {
      authState.isLoading = false;
      authState.isAuthenticated = true;
      queryState.canonicalJobRecord = buildCanonicalJobRecord();
      view.rerender(renderProposalForge());
    });

    expect(screen.getByPlaceholderText("Job title")).toHaveValue(
      "Imported Product Ops Lead",
    );
    expect(
      screen.getByPlaceholderText("Paste job offer"),
    ).toHaveValue(
      "Own project coordination, keep handoffs clear, and maintain delivery momentum.",
    );
  });

  it("preserves user edits when the canonical job resolves after handoff hydration", async () => {
    const view = render(renderProposalForge());

    const jobTitleInput = await screen.findByPlaceholderText("Job title");
    const jobDescriptionInput = await screen.findByPlaceholderText(
      "Paste job offer",
    );

    fireEvent.change(jobTitleInput, { target: { value: "Edited Product Ops Lead" } });
    fireEvent.change(jobDescriptionInput, {
      target: {
        value:
          "Edited job description that should remain visible after canonical hydration.",
      },
    });

    await act(async () => {
      authState.isLoading = false;
      authState.isAuthenticated = true;
      queryState.canonicalJobRecord = buildCanonicalJobRecord({
        title: "Canonical Replacement Title",
        rawDescription: "Canonical replacement description.",
      });
      view.rerender(renderProposalForge());
    });

    await waitFor(() =>
      expect(screen.getByPlaceholderText("Job title")).toHaveValue(
        "Edited Product Ops Lead",
      ),
    );
    expect(
      screen.getByPlaceholderText("Paste job offer"),
    ).toHaveValue(
      "Edited job description that should remain visible after canonical hydration.",
    );
  });
});
