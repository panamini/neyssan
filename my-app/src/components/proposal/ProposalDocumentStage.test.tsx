import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProposalDocumentStage } from "./ProposalDocumentStage";

describe("ProposalDocumentStage Ask handle", () => {
  it("renders one icon-only Ask surface and keeps the drawer opener wired", () => {
    const onOpenAsk = vi.fn();

    render(
      <ProposalDocumentStage
        mode="preview"
        hasProposalContent
        onModeChange={vi.fn()}
        onOpenAsk={onOpenAsk}
      >
        <div className="dasti-proposal-sheet__preview-page">Proposal paper</div>
      </ProposalDocumentStage>,
    );

    const handle = screen.getByTestId("proposal-ask-handle");
    const layer = handle.closest(".dasti-proposal-skeleton-stage__ask-handle-layer");

    expect(handle.tagName).toBe("BUTTON");
    expect(handle).toHaveAttribute("aria-label", "Ask");
    expect(handle).toHaveAttribute("title", "Ask");
    expect(handle).toHaveClass("dasti-icon-button");
    expect(handle).not.toHaveClass("dasti-proposal-skeleton-stage__primary-action--ask");
    expect(handle.textContent?.trim()).toBe("");
    expect(handle.querySelector("svg")).toBeInTheDocument();
    expect(handle.querySelector("button")).toBeNull();
    expect(layer).not.toBeNull();
    expect(within(layer as HTMLElement).getAllByRole("button")).toHaveLength(1);

    fireEvent.click(handle);
    expect(onOpenAsk).toHaveBeenCalledTimes(1);
  });
});
