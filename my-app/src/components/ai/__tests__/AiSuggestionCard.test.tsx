import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import AiSuggestionCard from "../AiSuggestionCard";

describe("AiSuggestionCard", () => {
  it("renders before and after text with accept and discard controls", () => {
    const onAccept = vi.fn();
    const onDiscard = vi.fn();

    render(
      <AiSuggestionCard
        actionLabel="Rewrite"
        beforeText="Original text"
        afterText="Improved text"
        onAccept={onAccept}
        onDiscard={onDiscard}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Rewrite suggestion" }),
    ).toBeInTheDocument();
    expect(screen.getByText("AI draft")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Current text" }),
    ).toHaveTextContent("Original text");
    expect(
      screen.getByRole("group", { name: "Proposed text" }),
    ).toHaveTextContent("Improved text");
    expect(screen.getByText("Original text")).toBeInTheDocument();
    expect(screen.getByText("Improved text")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("renders undo after a suggestion has been accepted", () => {
    const onUndo = vi.fn();

    render(
      <AiSuggestionCard
        actionLabel="Fix"
        beforeText="Original text"
        afterText="Fixed text"
        status="accepted"
        onUndo={onUndo}
      />,
    );

    expect(screen.getByText("Applied")).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Proposed text" }),
    ).toHaveTextContent("Fixed text");
    expect(
      screen.queryByRole("button", { name: "Accept" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("keeps action controls disabled while applying", () => {
    render(
      <AiSuggestionCard
        actionLabel="Tailor"
        beforeText="Original text"
        afterText="Tailored text"
        isApplying
      />,
    );

    expect(screen.getByRole("region", { name: "Tailor suggestion" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByText("Applying")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
  });
});
