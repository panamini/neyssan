import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposalForge } from "../ProposalForge";

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isLoading: false,
    isAuthenticated: true,
  }),
  useQuery: () => null,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    proposalHandoffs: { get: "proposalHandoffs.get" },
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
  it("shows a visible provider-busy failure state in the result panel and clears stale proposal content", () => {
    render(<ProposalForge />);

    expect(
      screen.getByText("Generate a proposal to see the results here."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Trigger success" }));

    expect(
      screen.getByText("I am writing with interest in the Operations Associate role."),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Trigger provider busy" }),
    );

    expect(
      screen.getByRole("alert", { name: "" }),
    ).toHaveTextContent("Proposal generation failed");
    expect(screen.getByRole("alert")).toHaveTextContent(
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
    render(<ProposalForge />);

    fireEvent.click(
      screen.getByRole("button", { name: "Trigger transport error" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Proposal generation failed",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Proposal generation is temporarily unavailable because the model provider request could not be completed. Please try again.",
    );
    expect(
      screen.queryByText("Generate a proposal to see the results here."),
    ).not.toBeInTheDocument();
  });

  it("shows a single successful-result fallback disclosure in the result panel", () => {
    render(<ProposalForge />);

    fireEvent.click(
      screen.getByRole("button", { name: "Trigger fallback success" }),
    );

    expect(
      screen.getByText(
        "Generated with ChatGPT because Mistral was temporarily busy.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "I am writing with interest in the Operations Associate role.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
