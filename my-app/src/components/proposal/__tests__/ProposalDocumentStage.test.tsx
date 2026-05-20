import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProposalDocumentStage from "../ProposalDocumentStage";

const baseProps = {
  toneLabel: "Warm tone",
  toneValue: "warm" as const,
  mode: "preview" as const,
  hasProposalContent: true,
  onModeChange: vi.fn(),
};

function renderStage(props: Partial<React.ComponentProps<typeof ProposalDocumentStage>> = {}) {
  return render(
    <ProposalDocumentStage {...baseProps} {...props}>
      <div>Paper body</div>
    </ProposalDocumentStage>,
  );
}

describe("ProposalDocumentStage proposal actions", () => {
  it("keeps the local toolbar focused on tone, mode, heading, design, and templates", () => {
    renderStage({
      onOpenHeading: vi.fn(),
      onOpenDesign: vi.fn(),
      onOpenTemplates: vi.fn(),
    });

    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
    expect(screen.queryByText("Proposal text")).not.toBeInTheDocument();
    expect(screen.queryByText("Preparing")).not.toBeInTheDocument();
    expect(screen.queryByText("Standard")).not.toBeInTheDocument();
    expect(screen.queryByText("Concise")).not.toBeInTheDocument();
    expect(screen.queryByText("Detailed")).not.toBeInTheDocument();
    expect(screen.queryByText("standard")).not.toBeInTheDocument();
    expect(screen.queryByText("concise")).not.toBeInTheDocument();
    expect(screen.queryByText("detailed")).not.toBeInTheDocument();
    expect(screen.getByText("Warm tone")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit proposal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preview proposal" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heading" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Design" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Templates" })).toBeInTheDocument();
    const preview = screen.getByRole("button", { name: "Preview proposal" });
    const heading = screen.getByRole("button", { name: "Heading" });
    const design = screen.getByRole("button", { name: "Design" });
    const templates = screen.getByRole("button", { name: "Templates" });
    const tone = screen.getByText("Warm tone");
    expect(
      preview.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(
      heading.compareDocumentPosition(design) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(
      design.compareDocumentPosition(templates) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(
      templates.compareDocumentPosition(tone) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
  });

  it("wires the Heading action in preview and edit modes", () => {
    const onOpenHeading = vi.fn();
    const { rerender } = renderStage({ onOpenHeading, mode: "preview" });

    const heading = screen.getByRole("button", { name: "Heading" });
    expect(heading).toHaveAttribute("data-toolbar-tooltip", "Heading");
    expect(heading).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(heading);
    expect(onOpenHeading).toHaveBeenCalledTimes(1);

    rerender(
      <ProposalDocumentStage
        {...baseProps}
        mode="edit"
        headingOpen
        onOpenHeading={onOpenHeading}
      >
        <div>Paper body</div>
      </ProposalDocumentStage>,
    );

    expect(screen.getByRole("button", { name: "Heading" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("cycles tone on click and opens settings on long press", () => {
    vi.useFakeTimers();
    const onCycleTone = vi.fn();
    const onOpenToneSettings = vi.fn();

    try {
      renderStage({ onCycleTone, onOpenToneSettings });

      const tone = screen.getByRole("button", { name: "Tone: Warm tone" });
      expect(tone).toHaveAttribute(
        "data-toolbar-tooltip",
        "Click to change tone. Hold for settings.",
      );

      fireEvent.click(tone);
      expect(onCycleTone).toHaveBeenCalledTimes(1);
      expect(onOpenToneSettings).not.toHaveBeenCalled();

      fireEvent.pointerDown(tone);
      vi.advanceTimersByTime(450);
      expect(onOpenToneSettings).toHaveBeenCalledTimes(1);
      fireEvent.pointerUp(tone);
      fireEvent.click(tone);
      expect(onCycleTone).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("wires the Design action in preview and edit modes", () => {
    const onOpenDesign = vi.fn();
    const { rerender } = renderStage({ onOpenDesign, mode: "preview" });

    const design = screen.getByRole("button", { name: "Design" });
    expect(design).toHaveAttribute("data-toolbar-tooltip", "Design");
    expect(design).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(design);
    expect(onOpenDesign).toHaveBeenCalledTimes(1);

    rerender(
      <ProposalDocumentStage
        {...baseProps}
        mode="edit"
        designOpen
        onOpenDesign={onOpenDesign}
      >
        <div>Paper body</div>
      </ProposalDocumentStage>,
    );

    expect(screen.getByRole("button", { name: "Design" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("shows undo and redo only while editing", () => {
    const { rerender } = renderStage({ mode: "preview" });

    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redo" })).not.toBeInTheDocument();

    rerender(
      <ProposalDocumentStage {...baseProps} mode="edit">
        <div>Paper body</div>
      </ProposalDocumentStage>,
    );

    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redo" })).toBeInTheDocument();
  });

  it("uses shared app tooltips without native titles for stage mode triggers", () => {
    renderStage();

    const edit = screen.getByRole("button", { name: "Edit proposal" });
    const preview = screen.getByRole("button", { name: "Preview proposal" });

    expect(edit).toHaveAttribute("data-toolbar-tooltip", "Edit");
    expect(preview).toHaveAttribute("data-toolbar-tooltip", "Preview");
    expect(edit).not.toHaveAttribute("title");
    expect(preview).not.toHaveAttribute("title");
    expect(edit.closest(".dasti-toolbar--surface-tooltips")).toBeTruthy();
  });
});
