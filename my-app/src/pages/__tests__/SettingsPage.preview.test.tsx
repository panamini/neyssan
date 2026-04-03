import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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

    render(<SettingsPage />);

    expect(
      screen.getByRole("button", { name: "Automatic palette" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Fraunces Bold + Geist")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Show next font pair" }),
    );

    await waitFor(() => {
      expect(updateSettingsMock).toHaveBeenCalledWith({
        fontPairId: "ledger-sans",
      });
    });
    expect(screen.getByText("Hepta Slab + Geist")).toBeInTheDocument();
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
});
