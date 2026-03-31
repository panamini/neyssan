import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProposalComposeToolbar } from "../ProposalComposeToolbar";

describe("ProposalComposeToolbar", () => {
  it("keeps the tone group trailing and updates the selected tone chip when controlled", async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole("button", { name: "Formal" }));
    expect(handleChange).toHaveBeenCalledWith("expert");

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
      container.querySelectorAll(".dasti-compose-toolbar__group-divider"),
    ).toHaveLength(2);
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
      screen.getByRole("button", { name: "Attached CV Mohamed Ismail J." }),
    ).not.toHaveAttribute("title");
    expect(
      container.querySelector(".dasti-compose-toolbar__bar"),
    ).toBeTruthy();
    expect(
      container.querySelector(
        ".dasti-compose-toolbar__bar.dasti-toolbar--surface-tooltips",
      ),
    ).toBeTruthy();

    expect(screen.getByRole("button", { name: "Formal" })).toHaveAttribute(
      "data-toolbar-tooltip",
      "Formal",
    );
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
});
