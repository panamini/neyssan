import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { AiStageList } from "../AiStageList";
import AiSuggestionCard from "../AiSuggestionCard";
import { DiffBlock } from "../DiffBlock";

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
    expect(screen.getByText("AI · REWRITE")).toBeInTheDocument();
    expect(screen.getByText("Needs review.")).toBeInTheDocument();
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

    expect(screen.getByText("Applied.")).toBeInTheDocument();
    expect(screen.getByText("Fixed text")).toBeInTheDocument();
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
    expect(screen.getByText("Applying.")).toBeInTheDocument();
    expect(screen.getByText("Reading")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Accept" }),
    ).not.toBeInTheDocument();
  });

  it("renders error state with retry and dismiss controls", () => {
    const onRetry = vi.fn();
    const onDiscard = vi.fn();

    render(
      <AiSuggestionCard
        actionLabel="Ask"
        beforeText="Original text"
        afterText=""
        state="error"
        errorMessage="Request failed."
        onRetry={onRetry}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByText("Request failed.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});

describe("DiffBlock", () => {
  it("renders replace, add, and remove modes", () => {
    const { rerender } = render(
      <DiffBlock mode="replace" before="Before" after="After" />,
    );

    expect(screen.getByText("Before")).toHaveClass("ds-diff-block__old");
    expect(screen.getByText("After")).toHaveClass("ds-diff-block__new");

    rerender(<DiffBlock mode="add" after="Added" />);
    expect(screen.getByText("Added")).toHaveClass("ds-diff-block--added");

    rerender(<DiffBlock mode="remove" before="Removed" />);
    expect(screen.getByText("Removed")).toHaveClass("ds-diff-block--removed");
  });
});

describe("AiStageList", () => {
  const stages = [
    { id: "read", label: "Reading role" },
    { id: "match", label: "Matching profile" },
    { id: "write", label: "Writing draft" },
  ];

  it("marks exactly one stage active while running", () => {
    const { container } = render(
      <AiStageList title="Generating" stages={stages} currentIndex={1} />,
    );

    expect(container.querySelectorAll('[data-state="active"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-state="done"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-state="pending"]')).toHaveLength(1);
  });

  it("marks zero stages active when errored", () => {
    const { container } = render(
      <AiStageList
        title="Generating"
        stages={stages}
        currentIndex={1}
        errorIndex={1}
      />,
    );

    expect(container.querySelectorAll('[data-state="active"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-state="error"]')).toHaveLength(1);
  });
});
