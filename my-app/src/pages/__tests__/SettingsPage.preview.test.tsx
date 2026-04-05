import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../SettingsPage";

const updateSettingsMock = vi.fn(() => Promise.resolve(null));
const settingsQueryMock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: () => settingsQueryMock(),
  useMutation: () => updateSettingsMock,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    proposalSettings: {
      getCurrent: {},
      setCurrent: {},
    },
  },
}));

vi.mock("../../components/ProposalColorPickerPopover", () => ({
  ProposalColorPickerPopover: () => null,
}));

describe("SettingsPage preview controls", () => {
  beforeEach(() => {
    updateSettingsMock.mockClear();
    settingsQueryMock.mockReturnValue({
      savedVoicePreset: null,
      styleChoice: "balanced",
      paletteOverride: null,
      accentHex: null,
      fontPairId: "quiet-editorial",
    });
  });

  it("updates the live preview when cycling font pairs", async () => {
    const user = userEvent.setup();

    const { container } = render(<SettingsPage />);

    expect(
      screen.getByRole("button", { name: "Automatic palette" }),
    ).toBeInTheDocument();
    expect(
      container.querySelector(".dasti-settings-font-card--current"),
    ).toHaveTextContent("Fraunces Bold");
    expect(
      container.querySelector(".dasti-settings-font-card--current"),
    ).toHaveTextContent("Geist");
    expect(
      container.querySelector(".dasti-settings-preview-stage__copy"),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Show next font pair" }),
    );

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledWith({
        fontPairId: "civic-correspondence",
      });
    });
    expect(container.querySelector(".dasti-settings-font-card--current")).toHaveTextContent(
      "Archivo Bold",
    );
    expect(
      container.querySelector(".dasti-settings-font-card--current"),
    ).toHaveTextContent("Source Serif 4");
  });

  it("shows a capped calm font drawer with five pair options", async () => {
    const user = userEvent.setup();

    const { container } = render(<SettingsPage />);

    await user.click(screen.getByRole("button", { name: /Fraunces Bold/i }));

    const drawer = screen.getByRole("group", { name: "Default font pair" });
    const optionButtons = within(drawer).getAllByRole("button");

    expect(optionButtons).toHaveLength(5);
    expect(within(drawer).queryByRole("button", { name: /Special Elite/i })).toBeNull();
    expect(container.querySelector(".dasti-settings-font-carousel")).toBeTruthy();
  });

  it("switches style cards and refreshes the preview label", async () => {
    const user = userEvent.setup();

    const { container } = render(<SettingsPage />);
    const previewEyebrow = () =>
      container.querySelector(".dasti-settings-preview-card__eyebrow");
    const editorialStyleButton = screen
      .getAllByRole("button", { name: /Editorial/ })
      .find((element) =>
        element.className.includes("dasti-settings-style-card"),
      );

    expect(previewEyebrow()).toHaveTextContent("Swiss");
    expect(editorialStyleButton).toBeTruthy();

    await user.click(editorialStyleButton!);

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledWith({
        styleChoice: "warm",
      });
    });
    expect(previewEyebrow()).toHaveTextContent("Editorial");
  });

  it("renders mini layout previews inside the style cards", () => {
    const { container } = render(<SettingsPage />);

    expect(
      container.querySelectorAll(".dasti-settings-style-card__mini").length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("updates the preview business card tilt when the pointer moves", async () => {
    const { container } = render(<SettingsPage />);
    const previewCard = container.querySelector(".dasti-settings-preview-card");

    expect(previewCard).toBeTruthy();

    Object.defineProperty(previewCard!, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 320,
        height: 196,
        right: 320,
        bottom: 196,
        toJSON: () => null,
      }),
    });

    fireEvent.pointerMove(previewCard!, {
      clientX: 248,
      clientY: 42,
    });

    await waitFor(() => {
      expect(previewCard!.style.getPropertyValue("--ry")).not.toBe("0deg");
      expect(previewCard!.style.getPropertyValue("--rx")).not.toBe("0deg");
    });
  });
});
