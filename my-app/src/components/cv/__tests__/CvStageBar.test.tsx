import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CvStageBar from "../CvStageBar";

describe("CvStageBar command layer", () => {
  it("renders CV document tools without Draft or toolbar Ask", () => {
    render(
      <CvStageBar
        mode="preview"
        onModeChange={vi.fn()}
        onOpenSections={vi.fn()}
        onOpenDesign={vi.fn()}
        onOpenTemplates={vi.fn()}
        onOpenAsk={vi.fn()}
      />,
    );

    const toolbar = screen.getByTestId("cv-toolbar");

    expect(
      within(toolbar).getByRole("button", { name: "Edit" }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).getByRole("button", { name: "Page preview" }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).getByRole("button", { name: "Sections" }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).getByRole("button", { name: "Design" }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).getByRole("button", { name: "Templates" }),
    ).toBeInTheDocument();
    expect(
      within(toolbar).queryByRole("button", { name: /Draft/i }),
    ).not.toBeInTheDocument();
    expect(
      within(toolbar).queryByRole("button", { name: "Ask" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("cv-ask-handle")).toHaveAttribute(
      "aria-label",
      "Ask",
    );
  });

  it("wires document toolbar actions to left-drawer modes and Ask to the side handle", () => {
    const onOpenSections = vi.fn();
    const onOpenDesign = vi.fn();
    const onOpenTemplates = vi.fn();
    const onOpenAsk = vi.fn();

    render(
      <CvStageBar
        mode="edit"
        onModeChange={vi.fn()}
        onOpenSections={onOpenSections}
        onOpenDesign={onOpenDesign}
        onOpenTemplates={onOpenTemplates}
        onOpenAsk={onOpenAsk}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sections" }));
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Templates" }));
    fireEvent.click(screen.getByTestId("cv-ask-handle"));

    expect(onOpenSections).toHaveBeenCalledTimes(1);
    expect(onOpenDesign).toHaveBeenCalledTimes(1);
    expect(onOpenTemplates).toHaveBeenCalledTimes(1);
    expect(onOpenAsk).toHaveBeenCalledTimes(1);
  });
});
