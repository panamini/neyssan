import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CvStageBar from "../CvStageBar";

const baseProps = {
  mode: "edit" as const,
  exporting: false,
  tone: "natural" as const,
  onModeChange: vi.fn(),
};

describe("CvStageBar", () => {
  it("keeps document switching out of the stage bar", () => {
    render(
      <CvStageBar
        {...baseProps}
        onOpenSections={vi.fn()}
        onOpenDesign={vi.fn()}
        onOpenTemplates={vi.fn()}
      />,
    );

    expect(screen.queryByText("Pick resume")).not.toBeInTheDocument();
    expect(
      screen
        .getByRole("button", { name: "Edit" })
        .closest(".dasti-toolbar--surface-tooltips"),
    ).toBeTruthy();
    const editTrigger = screen.getByRole("button", { name: "Edit" });
    const previewTrigger = screen.getByRole("button", {
      name: "Page preview",
    });
    expect(editTrigger).toHaveAttribute("data-toolbar-tooltip", "Edit");
    expect(previewTrigger).toHaveAttribute("data-toolbar-tooltip", "Preview");
    expect(editTrigger).not.toHaveAttribute("title");
    expect(previewTrigger).not.toHaveAttribute("title");
    expect(screen.getByText("Natural")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sections" })).toHaveAttribute(
      "data-stage-tooltip-mode",
      "compact",
    );
    expect(screen.getByRole("button", { name: "Templates" })).toHaveAttribute(
      "data-stage-tooltip-mode",
      "compact",
    );
    expect(
      previewTrigger.compareDocumentPosition(
        screen.getByRole("button", { name: "Sections" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(
      screen
        .getByRole("button", { name: "Sections" })
        .compareDocumentPosition(screen.getByRole("button", { name: "Design" })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(
      screen
        .getByRole("button", { name: "Design" })
        .compareDocumentPosition(screen.getByRole("button", { name: "Templates" })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(
      screen
        .getByRole("button", { name: "Templates" })
        .compareDocumentPosition(screen.getByText("Natural")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Redo" })).not.toBeInTheDocument();
    expect(screen.queryByText("Natural tone")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    expect(screen.queryByText("ATS-ready")).not.toBeInTheDocument();
    expect(screen.queryByText("OK")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Import CV/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /New CV/i }),
    ).not.toBeInTheDocument();
  });
});
