import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ProposalForge } from "../ProposalForge";

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
    functions: { generateProposal: "functions.generateProposal" },
    proposalHandoffs: { get: "proposalHandoffs.get" },
    proposalSettings: { getCurrent: "proposalSettings.getCurrent" },
    proposalsPublic: { default: "proposalsPublic.default" },
    updateProposalPublic: { default: "updateProposalPublic.default" },
    deleteProposalPublic: { default: "deleteProposalPublic.default" },
  },
}));

vi.mock("@radix-ui/themes", () => ({
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock("../../components/ProposalInputForm", () => ({
  default: ({ onStart, onSubmit, onError }: any) => {
    const values = {
      proposalType: "cover_letter",
      jobTitle: "Operations Associate",
      jobDescription:
        "Support recurring processes, update internal records, and coordinate communication across teams.",
      voicePreset: "signature",
      formalityLevel: "neutral",
      creativity: "medium",
      modelType: "mistral-small-latest",
    };

    return (
      <div>
        <button
          type="button"
          onClick={() => {
            onStart?.(values);
            onSubmit?.(
              values,
              "Dear Hiring Manager,\n\nI am writing with interest in the Operations Associate role.\n\nBest regards,",
              {
                requestedModelType: "mistral-small-latest",
                actualModelType: "mistral-small-latest",
                fallbackTriggerCode: null,
              },
            );
          }}
        >
          Trigger success
        </button>
        <button
          type="button"
          onClick={() => {
            onStart?.(values);
            onSubmit?.(
              values,
              "Dear Hiring Manager,\n\nI am writing with interest in the Operations Associate role.\n\nBest regards,",
              {
                requestedModelType: "mistral-small-latest",
                actualModelType: "chatgpt",
                fallbackTriggerCode: "proposal_generation_provider_busy",
              },
            );
          }}
        >
          Trigger fallback success
        </button>
        <button
          type="button"
          onClick={() => {
            onStart?.(values);
            onError?.(
              "Proposal generation is temporarily busy because the model provider is rate limited. Please wait a moment and try again.",
              values,
            );
          }}
        >
          Trigger provider busy
        </button>
        <button
          type="button"
          onClick={() => {
            onStart?.(values);
            onError?.(
              "Proposal generation is temporarily unavailable because the model provider request could not be completed. Please try again.",
              values,
            );
          }}
        >
          Trigger transport error
        </button>
      </div>
    );
  },
}));

vi.mock("../../components/ProposalsList", () => ({
  default: () => <div>Saved proposals</div>,
}));

describe("ProposalForge controlled failure integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "dasti:proposal-compose-draft:v1",
      JSON.stringify({
        jobTitle: "Operations Associate",
        jobDescription:
          "Support recurring processes, update internal records, and coordinate communication across teams.",
      }),
    );
  });

  it("shows a visible provider-busy failure state in the result panel and clears stale proposal content", () => {
    render(
      <MemoryRouter>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Trigger success" }));

    expect(
      screen.getAllByText(
        "I am writing with interest in the Operations Associate role.",
      ).length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Trigger provider busy" }),
    );

    const alertText = screen
      .getAllByRole("alert")
      .map((alert) => alert.textContent ?? "")
      .join("\n");
    expect(alertText).toContain("Generation failed.");
    expect(alertText).toContain(
      "Proposal generation is temporarily busy because the model provider is rate limited. Please wait a moment and try again.",
    );
    expect(
      screen.queryByText(
        "I am writing with interest in the Operations Associate role.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Generate a proposal to see the results here."),
    ).not.toBeInTheDocument();
  });

  it("shows a visible transport failure state in the result panel", () => {
    render(
      <MemoryRouter>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Trigger transport error" }),
    );

    const alertText = screen
      .getAllByRole("alert")
      .map((alert) => alert.textContent ?? "")
      .join("\n");
    expect(alertText).toContain("Generation failed.");
    expect(alertText).toContain(
      "Proposal generation is temporarily unavailable because the model provider request could not be completed. Please try again.",
    );
    expect(
      screen.queryByText("Generate a proposal to see the results here."),
    ).not.toBeInTheDocument();
  });

  it("shows a single successful-result fallback disclosure in the result panel", () => {
    render(
      <MemoryRouter>
        <ProposalForge />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Trigger fallback success" }),
    );

    expect(
      screen.getByText(
        "Generated with ChatGPT because Mistral was temporarily busy.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "I am writing with interest in the Operations Associate role.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
