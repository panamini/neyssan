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
      screen.queryByRole("button", { name: "Accept" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
