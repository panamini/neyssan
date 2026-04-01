import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmbeddedStyleInspector } from "../EmbeddedStyleInspector";

describe("EmbeddedStyleInspector", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
    vi.restoreAllMocks();
  });

  function renderInspector() {
    return render(
      <EmbeddedStyleInspector
        stylePreset={{
          layout: "swiss",
          typography: "signature",
          palette: "sauge",
        }}
        copyMode="title-only"
        controlMode="direct"
        onSelectBundle={vi.fn()}
        onSelectLayout={vi.fn()}
        onSelectTypography={vi.fn()}
        onSelectPalette={vi.fn()}
        onSelectCustomAccent={vi.fn()}
      />,
    );
  }

  it("keeps the palette drawer mounted while the custom picker is open and outside clicks occur", async () => {
    const user = userEvent.setup();

    renderInspector();

    await user.click(
      screen.getByRole("button", { name: "Open palette controls" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Choose a custom accent" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Palette options" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Custom accent color" }),
    ).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(
      screen.getByRole("dialog", { name: "Palette options" }),
    ).toBeInTheDocument();
  });

  it("repositions the custom picker against the palette drawer when the theme class changes", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function mockRect() {
        const element = this as HTMLElement;

        if (element.getAttribute("aria-label") === "Open palette controls") {
          return {
            x: 480,
            y: 80,
            width: 34,
            height: 34,
            top: 80,
            right: 514,
            bottom: 114,
            left: 480,
            toJSON: () => ({}),
          } as DOMRect;
        }

        if (element.getAttribute("aria-label") === "Palette options") {
          const isDark = document.documentElement.classList.contains("dark");
          const left = isDark ? 430 : 448;
          const top = isDark ? 126 : 118;
          const bottom = isDark ? 176 : 160;

          return {
            x: left,
            y: top,
            width: 132,
            height: bottom - top,
            top,
            right: left + 132,
            bottom,
            left,
            toJSON: () => ({}),
          } as DOMRect;
        }

        return {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          toJSON: () => ({}),
        } as DOMRect;
      },
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(164);

    renderInspector();

    await user.click(
      screen.getByRole("button", { name: "Open palette controls" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Choose a custom accent" }),
    );

    const picker = screen.getByRole("dialog", { name: "Custom accent color" });
    expect(picker).toHaveStyle({ left: "448px", top: "162px" });

    await act(async () => {
      document.documentElement.classList.add("dark");
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(picker).toHaveStyle({ left: "430px", top: "178px" });
    });
  });

  it("can render only the shared style and color controls", () => {
    render(
      <EmbeddedStyleInspector
        stylePreset={{
          layout: "swiss",
          typography: "signature",
          palette: "sauge",
        }}
        copyMode="title-only"
        showCustomizeControl={false}
        showPromptControl={false}
        onSelectBundle={vi.fn()}
        onSelectLayout={vi.fn()}
        onSelectTypography={vi.fn()}
        onSelectPalette={vi.fn()}
        onSelectCustomAccent={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Open style presets" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open palette controls" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open layout and typography controls" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Describe a look" }),
    ).not.toBeInTheDocument();
  });

  it("uses icon-only style choices when the bundled toolbar is in title-only mode", () => {
    render(
      <EmbeddedStyleInspector
        stylePreset={{
          layout: "swiss",
          typography: "signature",
          palette: "sauge",
        }}
        copyMode="title-only"
        showCustomizeControl={false}
        showPromptControl={false}
        onSelectBundle={vi.fn()}
        onSelectLayout={vi.fn()}
        onSelectTypography={vi.fn()}
        onSelectPalette={vi.fn()}
        onSelectCustomAccent={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open style presets" }));

    const styleButtons = [
      screen.getByRole("button", { name: "Clean" }),
      screen.getByRole("button", { name: "Soft" }),
      screen.getByRole("button", { name: "Editorial" }),
      screen.getByRole("button", { name: "Bold" }),
    ];

    styleButtons.forEach((button) => {
      expect(button).toHaveClass(
        "dasti-artifact-inspector__action",
        "dasti-artifact-inspector__action--drawer",
      );
      expect(button).not.toHaveClass("dasti-proposal-chrome-option");
    });
  });
});
