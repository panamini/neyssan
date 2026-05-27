import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  readStoredProposalLlmModel,
  useProposalLlmModelPreference,
} from "../proposal-llm-preference";

function ModelPreferenceProbe(): JSX.Element {
  const { model, setModel } = useProposalLlmModelPreference();

  return (
    <div>
      <output aria-label="selected model">{model}</output>
      <button type="button" onClick={() => setModel("mistral-large-latest")}>
        Use Mistral Large
      </button>
    </div>
  );
}

describe("proposal LLM preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to ChatGPT and updates same-tab subscribers", () => {
    render(<ModelPreferenceProbe />);

    expect(screen.getByLabelText("selected model")).toHaveTextContent(
      "mistral-medium-latest",
    );

    fireEvent.click(screen.getByRole("button", { name: "Use Mistral Large" }));

    expect(screen.getByLabelText("selected model")).toHaveTextContent(
      "mistral-large-latest",
    );
    expect(readStoredProposalLlmModel()).toBe("mistral-large-latest");
  });

  it("falls back to ChatGPT for unknown stored values", () => {
    window.localStorage.setItem("twoweeks:proposal-llm-model", "unknown");

    expect(readStoredProposalLlmModel()).toBe("mistral-medium-latest");
  });
});
