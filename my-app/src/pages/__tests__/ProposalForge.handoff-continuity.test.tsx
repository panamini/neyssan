import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";

const mockProposalInputFormSpy = vi.fn();

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: (query: string) => {
    if (query === "proposalHandoffs.get") {
      return {
        handoffId: "handoff_123",
        jobTitle: "Imported Product Ops Lead",
        jobDescription:
          "Own project coordination, keep handoffs clear, and maintain delivery momentum.",
        sourceUrl: "https://example.com/jobs/123",
        platform: "linkedin",
      };
    }
    if (query === "proposalsPublic.default") {
      return [];
    }
    return null;
  },
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

vi.mock("../../components/ProposalInputForm", () => ({
  default: (props: Record<string, unknown>) => {
    mockProposalInputFormSpy(props);
    return <div data-testid="proposal-input-form">Proposal input form</div>;
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

function RouteProbe(): JSX.Element {
  const location = useLocation();

  return (
    <div data-testid="route-probe">
      {location.pathname}
      {location.search}
    </div>
  );
}

describe("ProposalForge handoff continuity", () => {
  it("consumes imported handoff params once and strips handoffId from the live proposal route", async () => {
    mockProposalInputFormSpy.mockClear();

    render(
      <MemoryRouter initialEntries={["/proposal?handoffId=handoff_123"]}>
        <Routes>
          <Route
            path="/proposal"
            element={
              <>
                <ProposalForge />
                <RouteProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("route-probe")).toHaveTextContent("/proposal"),
    );
    expect(screen.getByTestId("route-probe")).not.toHaveTextContent(
      "handoffId=",
    );

    expect(
      mockProposalInputFormSpy.mock.calls.some(
        ([props]) =>
          props?.prefill &&
          typeof props.prefill === "object" &&
          (props.prefill as { handoffId?: string }).handoffId === "handoff_123",
      ),
    ).toBe(true);
  });
});
