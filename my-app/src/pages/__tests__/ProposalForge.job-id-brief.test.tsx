import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { ProposalForge } from "../ProposalForge";
import { ForgeTemplatePanel } from "../../components/ForgeTemplatePanel";
import { ForgeTemplatePanelProvider } from "../../contexts/ForgeTemplatePanelContext";
import { PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY } from "../../lib/proposal-workspace-state";
import { PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY } from "../../lib/proposal-output-draft";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: () => vi.fn().mockResolvedValue(undefined),
  useAction: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    functions: {
      generateProposal: "functions.generateProposal",
    },
    jobsPublic: { getById: "jobsPublic.getById" },
    proposalHandoffs: { get: "proposalHandoffs.get" },
    proposalSettings: { getCurrent: "proposalSettings.getCurrent" },
    proposalsPublic: { default: "proposalsPublic.default" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

vi.mock("../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    cvs: [],
    currentCv: null,
    currentCvId: null,
    loadCv: vi.fn(),
  }),
}));

vi.mock("../../components/ui/toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: ({ onSubmit, onValuesChange }: any) => {
    const values = {
      jobTitle: "Operations Associate",
      jobDescription:
        "Support recurring processes and coordinate communication.",
      proposalType: "cover_letter",
      voicePreset: "signature",
      toneTuning: null,
      characterLimitMode: "none",
      characterLimitValue: null,
    };

    return (
      <button
        type="button"
        onClick={() => {
          onValuesChange?.(values);
          onSubmit?.(
            values,
            "Generated proposal body.",
            undefined,
            "proposal_generated",
          );
        }}
      >
        Generate proposal
      </button>
    );
  },
}));

vi.mock("../../components/ProposalDisplay", () => ({
  default: () => <div>Proposal output</div>,
  fallbackCopyText: () => "",
  getDisplayedProposalText: (value: string) => value,
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="proposal-location">{`${location.pathname}${location.search}`}</div>
  );
}

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

describe("ProposalForge canonical job brief", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUseQuery.mockReset();
    mockUseQuery.mockImplementation((query: string, args: unknown) => {
      if (query === "jobsPublic.getById" && args && args !== "skip") {
        return {
          id: "job_123",
          title: "Operations Associate",
          company: "Studio North",
          sourceUrl: "https://example.com/jobs/123",
          sourceDomain: "example.com",
          sourceType: "extension",
          parseStatus: "parsed",
          reviewState: "needs_review",
          rawDescription:
            "Coordinate recurring launches, keep handoffs clear, and maintain documentation.",
          summary:
            "Operations Associate role focused on recurring launches and structured handoffs.",
          responsibilities: [
            "Coordinate recurring launches",
            "Maintain documentation",
          ],
          keywords: ["operations", "handoffs"],
          mustHaves: ["documentation"],
          toneCues: ["structured"],
          linkedProposalCount: 2,
          linkedProposals: [
            {
              id: "proposal_alpha",
              title: "Operations Associate cover letter",
              status: "saved",
              updatedAt: 1710000000000,
            },
            {
              id: "proposal_beta",
              title: "Operations Associate follow-up note",
              status: "draft",
              updatedAt: 1700000000000,
            },
          ],
          reviewItems: [
            {
              id: "review_1",
              fieldKey: "responsibilities",
              label: "Responsibilities",
              reviewStatus: "pending",
              suggestedValue: ["Coordinate recurring launches"],
              sourceText:
                "Coordinate recurring launches, keep handoffs clear, and maintain documentation.",
            },
          ],
        };
      }

      return null;
    });
  });

  it("renders the canonical job brief as collapsed rail context without the full brief card", async () => {
    window.localStorage.setItem(
      PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes and coordinate communication.",
        proposalType: "cover_letter",
        voicePreset: "signature",
      }),
    );
    window.localStorage.setItem(
      PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
      JSON.stringify({
        proposalContent: "Generated proposal body.",
        proposalType: "cover_letter",
        proposalVoicePreset: "signature",
        proposalTemplateId: null,
        proposalVerbatiStyle: null,
        proposalStyleLinkMode: "inherit_cv",
        proposalStyleChoice: "auto",
        proposalApplicantName: "Alex Martin",
        proposalApplicantRole: "Operations Associate",
        proposalDocumentTitle: "Operations Associate",
        proposalDocumentMeta: "Cover letter",
        generatedProposalId: "proposal_generated",
        proposalOutputMode: "preview",
        paletteOverride: null,
        customAccentHex: null,
        templateBundleId: null,
        typographyOverride: null,
        layoutOverride: null,
        proposalDocumentTitleManual: false,
        characterLimitMode: null,
        characterLimitValue: null,
      }),
    );

    const { container } = render(
      <MemoryRouter initialEntries={["/proposal?jobId=job_123"]}>
        <Routes>
          <Route
            path="/proposal"
            element={
              <>
                <ProposalForge />
                <LocationProbe />
              </>
            }
          />
          <Route path="/jobs/:jobId" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("button", {
        name: /Job context Operations Associate/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Operations Associate role focused on recurring launches and structured handoffs.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
    expect(screen.queryByText("Review state")).not.toBeInTheDocument();
    expect(screen.queryByText("Extracted summary")).not.toBeInTheDocument();
    expect(screen.queryByText("Linked documents")).not.toBeInTheDocument();
    expect(screen.queryByText("Raw source")).not.toBeInTheDocument();
    expect(screen.queryByText("Responsibilities")).not.toBeInTheDocument();
    expect(screen.queryByText("operations")).not.toBeInTheDocument();
    expect(
      container.querySelector(".dasti-brief-card"),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".dasti-brief-card__summary"),
    ).not.toBeInTheDocument();

  });

  it("opens and consumes the Draft drawer route intent for canonical jobs", async () => {
    setViewportWidth(1024);
    render(
      <MemoryRouter
        initialEntries={["/proposal?jobId=job_123&drawer=proposal-draft"]}
      >
        <ForgeTemplatePanelProvider>
          <ForgeTemplatePanel />
          <Routes>
            <Route
              path="/proposal"
              element={
                <>
                  <ProposalForge />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </ForgeTemplatePanelProvider>
      </MemoryRouter>,
    );

    const drawer = await screen.findByRole("complementary", {
      name: "Proposal draft drawer",
    });
    expect(drawer).toHaveAttribute("data-mode", "overlay");
    expect(
      within(drawer).getByRole("button", { name: "Pin drawer" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("button", {
        name: /Change job: Operations Associate/i,
      }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("proposal-location")).toHaveTextContent(
        "/proposal?jobId=job_123",
      );
    });
    expect(screen.getByTestId("proposal-location")).not.toHaveTextContent(
      "drawer=",
    );

    fireEvent.click(within(drawer).getByRole("button", { name: "Pin drawer" }));
    expect(drawer).toHaveAttribute("data-mode", "docked");
    expect(
      within(drawer).getByRole("button", { name: "Collapse drawer" }),
    ).toBeInTheDocument();
  });

  it("docks the page when Draft proposal opens at a dockable width", async () => {
    setViewportWidth(1280);
    const { container } = render(
      <MemoryRouter initialEntries={["/proposal?jobId=job_123"]}>
        <ForgeTemplatePanelProvider>
          <ForgeTemplatePanel />
          <Routes>
            <Route
              path="/proposal"
              element={
                <>
                  <ProposalForge />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </ForgeTemplatePanelProvider>
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Draft proposal" }),
    );

    const drawer = await screen.findByRole("complementary", {
      name: "Proposal draft drawer",
    });
    expect(drawer).toHaveAttribute("data-mode", "docked");
    expect(
      container.querySelector(".dasti-proposal-skeleton-forge"),
    ).toHaveAttribute("data-forge-drawer-docked", "true");
  });

  it("opens the in-page Jobs drawer from the empty job context action", async () => {
    render(
      <MemoryRouter initialEntries={["/proposal"]}>
        <ForgeTemplatePanelProvider>
          <ForgeTemplatePanel />
          <Routes>
            <Route
              path="/proposal"
              element={
                <>
                  <ProposalForge />
                  <LocationProbe />
                </>
              }
            />
            <Route path="/jobs" element={<LocationProbe />} />
          </Routes>
        </ForgeTemplatePanelProvider>
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Choose from Job Forge" }),
    );

    expect(screen.getByTestId("proposal-location")).toHaveTextContent(
      "/proposal",
    );
    expect(
      screen.getByRole("complementary", { name: "Attach job" }),
    ).toBeInTheDocument();
  });
});
