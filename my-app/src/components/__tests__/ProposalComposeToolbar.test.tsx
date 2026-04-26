import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProposalComposeToolbar } from "../ProposalComposeToolbar";

describe("ProposalComposeToolbar", () => {
  it("keeps the top toolbar tone as a selected status badge", () => {
    const handleChange = vi.fn();

    const { rerender, container } = render(
      <ProposalComposeToolbar
        value={null}
        resolvedValue="expert"
        onChange={handleChange}
        onToggleCvPicker={vi.fn()}
        cvTitle={null}
        isCvPickerOpen={false}
        onCollapseCompose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Formal" })).toBeNull();
    expect(handleChange).not.toHaveBeenCalled();

    rerender(
      <ProposalComposeToolbar
        value="expert"
        resolvedValue="expert"
        onChange={handleChange}
        onToggleCvPicker={vi.fn()}
        cvTitle="Mohamed Ismail J."
        isCvPickerOpen={false}
        onCollapseCompose={vi.fn()}
      />,
    );

    expect(
      container.querySelector(".dasti-compose-toolbar__tone-chip")?.textContent,
    ).toContain("Formal");
    expect(
      container.querySelector(".dasti-compose-toolbar__tone-chip"),
    ).toHaveAttribute("aria-label", "Selected tone Formal");
    expect(
      container.querySelectorAll(".dasti-compose-toolbar__group-divider"),
    ).toHaveLength(1);
  });

  it("opens the collapsed tone popover and closes it on escape", async () => {
    const user = userEvent.setup();
    render(
      <ProposalComposeToolbar
        value="signature"
        onChange={vi.fn()}
        onToggleCvPicker={vi.fn()}
        cvTitle={null}
        isCvPickerOpen={false}
        collapsed
        onRestoreCompose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Tone of voice Natural" }));
    expect(screen.getByRole("dialog", { name: "Tone of voice" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Tone of voice" })).not.toBeInTheDocument();
  });

  it("uses app tooltips without native title attributes on the compose and CV controls", () => {
    const { container } = render(
      <ProposalComposeToolbar
        value="expert"
        onChange={vi.fn()}
        onToggleCvPicker={vi.fn()}
        onClearCv={vi.fn()}
        cvTitle="Mohamed Ismail J."
        isCvPickerOpen={false}
        onCollapseCompose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Hide compose panel" }),
    ).not.toHaveAttribute("title");
    expect(
      screen.getByRole("button", { name: "Remove CV" }),
    ).not.toHaveAttribute("title");
    expect(
      screen.getByRole("button", {
        name: "Switch CV. Attached CV: Mohamed Ismail J.",
      }),
    ).not.toHaveAttribute("title");
    expect(
      container.querySelector(".dasti-compose-toolbar__bar"),
    ).toBeTruthy();
    expect(
      container.querySelector(
        ".dasti-compose-toolbar__bar.dasti-toolbar--surface-tooltips",
      ),
    ).toBeTruthy();

    expect(screen.queryByRole("button", { name: "Formal" })).toBeNull();
    expect(
      container.querySelector(".dasti-compose-toolbar__tone-chip"),
    ).toHaveAttribute("data-toolbar-tooltip", "Formal");
  });

  it("clears the attached CV without reopening the picker and falls back to the attach state", async () => {
    const user = userEvent.setup();
    const handleClearCv = vi.fn();
    const handleToggleCvPicker = vi.fn();

    const { rerender } = render(
      <ProposalComposeToolbar
        value="expert"
        onChange={vi.fn()}
        onToggleCvPicker={handleToggleCvPicker}
        onClearCv={handleClearCv}
        cvTitle="Mohamed Ismail J."
        isCvPickerOpen={false}
        onCollapseCompose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove CV" }));
    expect(handleClearCv).toHaveBeenCalledTimes(1);
    expect(handleToggleCvPicker).not.toHaveBeenCalled();

    rerender(
      <ProposalComposeToolbar
        value="expert"
        onChange={vi.fn()}
        onToggleCvPicker={handleToggleCvPicker}
        cvTitle={null}
        isCvPickerOpen={false}
        onCollapseCompose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Remove CV" })).toBeNull();
    expect(screen.getByRole("button", { name: "Attach CV" })).toBeInTheDocument();
  });

  it("marks the collapsed floating shell as a surface-anchored tooltip host", () => {
    const { container } = render(
      <ProposalComposeToolbar
        value="signature"
        onChange={vi.fn()}
        onToggleCvPicker={vi.fn()}
        cvTitle={null}
        isCvPickerOpen={false}
        collapsed
        onRestoreCompose={vi.fn()}
      />,
    );

    expect(
      container.querySelector(
        ".dasti-compose-toolbar__collapsed-shell.dasti-toolbar--surface-tooltips",
      ),
    ).toBeTruthy();
  });

  it("renders the collapsed brief generate action as an icon-only toolbar control", async () => {
    const user = userEvent.setup();
    const handleGenerateFromBrief = vi.fn();
    const { container } = render(
      <ProposalComposeToolbar
        value="signature"
        onChange={vi.fn()}
        onToggleCvPicker={vi.fn()}
        cvTitle={null}
        isCvPickerOpen={false}
        collapsed
        onRestoreCompose={vi.fn()}
        onGenerateFromBrief={handleGenerateFromBrief}
        generateLabel="Generate"
        generateDisabled={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Generate" }));
    expect(handleGenerateFromBrief).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector(".dasti-compose-toolbar__generate-button"),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-compose-toolbar__generate-button .dasti-proposal-submit__glyph"),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-compose-toolbar__generate-button .dasti-proposal-submit__label"),
    ).toBeNull();
    expect(
      container.querySelector(
        ".dasti-compose-toolbar__generate-button.dasti-icon-button.dasti-compose-toolbar__icon-button",
      ),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-compose-toolbar__generate-button.dasti-button"),
    ).toBeNull();
    const collapsedActions = container.querySelector(
      ".dasti-compose-toolbar__collapsed-actions",
    );
    expect(collapsedActions).toBeTruthy();
    expect(
      collapsedActions?.querySelector(".dasti-compose-toolbar__tone-anchor"),
    ).toBeTruthy();
    expect(
      collapsedActions?.querySelector(".dasti-compose-toolbar__generate-button"),
    ).toBeTruthy();
  });

  it("marks compact no-collapse layouts with the stable left-anchor class", () => {
    const { container } = render(
      <ProposalComposeToolbar
        value="signature"
        onChange={vi.fn()}
        onToggleCvPicker={vi.fn()}
        cvTitle={null}
        isCvPickerOpen={false}
        compact
      />,
    );

    expect(
      container.querySelector(".dasti-compose-toolbar--no-collapse-anchor"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Hide compose panel" }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".dasti-compose-toolbar__group--collapse"),
    ).toBeNull();
  });

  it("renders the compact save capsule as the final proposal action", () => {
    const { container } = render(
      <ProposalComposeToolbar
        value="signature"
        onChange={vi.fn()}
        onToggleCvPicker={vi.fn()}
        cvTitle="Mohamed Ismail J."
        isCvPickerOpen={false}
        onCollapseCompose={vi.fn()}
        styleStatusLabel="CV"
        rightActions={<button type="button">Export proposal</button>}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("CV");
    expect(
      container.querySelector(".dasti-compose-toolbar__group--context"),
    ).toBeNull();
    expect(
      container.querySelector(".dasti-compose-toolbar__group--actions"),
    ).toBeTruthy();
    expect(
      container.querySelector(".dasti-compose-toolbar__group--actions")
        ?.lastElementChild,
    ).toHaveClass("dasti-compose-toolbar__context-slot--save");
  });

  it("keeps the source cv button visible while saving owns the far-right save slot", () => {
    const { container } = render(
      <ProposalComposeToolbar
        value="signature"
        onChange={vi.fn()}
        onToggleCvPicker={vi.fn()}
        cvTitle="Mohamed Ismail J."
        isCvPickerOpen={false}
        onCollapseCompose={vi.fn()}
        styleStatusLabel="CV"
        saveStatus="saving"
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Switch CV. Attached CV: Mohamed Ismail J.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Saving…");
    expect(screen.queryByText("CV")).toBeNull();
    expect(
      container.querySelector(".dasti-compose-toolbar__group--actions")
        ?.lastElementChild,
    ).toHaveClass("dasti-compose-toolbar__context-slot--save");
  });

  it("prioritizes transient save status before returning to the resting contextual capsule", () => {
    vi.useFakeTimers();

    render(
      <ProposalComposeToolbar
        value="signature"
        onChange={vi.fn()}
        onToggleCvPicker={vi.fn()}
        cvTitle="Mohamed Ismail J."
        isCvPickerOpen={false}
        onCollapseCompose={vi.fn()}
        styleStatusLabel="CV"
        saveStatus="saved"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.queryByText("CV")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByRole("status")).toHaveTextContent("CV");
    vi.useRealTimers();
  });
});
