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

const savePresetMock = vi.fn(() => Promise.resolve(null));
const setActivePresetMock = vi.fn(() => Promise.resolve(null));
const presetsQueryMock = vi.fn();
const { workshopFlagMock } = vi.hoisted(() => ({
  workshopFlagMock: vi.fn(() => false),
}));

const { api } = vi.hoisted(() => ({
  api: {
    proposalSettings: {
      getPresets: {},
      savePreset: {},
      setActivePreset: {},
    },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: () => presetsQueryMock(),
  useMutation: (reference: unknown) => {
    if (
      reference ===
      (api.proposalSettings.savePreset as unknown)
    ) {
      return savePresetMock;
    }

    return setActivePresetMock;
  },
}));

vi.mock("../../../convex/_generated/api", () => ({ api }));

vi.mock("../../components/ProposalColorPickerPopover", () => ({
  ProposalColorPickerPopover: () => null,
}));

vi.mock("../../lib/flags", () => ({
  isWorkshopFamilyEnabled: workshopFlagMock,
}));

describe("SettingsPage preview controls", () => {
  beforeEach(() => {
    savePresetMock.mockClear();
    setActivePresetMock.mockClear();
    workshopFlagMock.mockReset();
    workshopFlagMock.mockReturnValue(false);
    presetsQueryMock.mockReturnValue({
      activeSlot: 1,
      preset1: {
        verbatiStyle: {
          familyId: "swiss",
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        },
        voicePreset: null,
        name: "Style 1",
      },
      preset2: {
        verbatiStyle: {
          familyId: "swiss",
          layout: "swiss",
          typography: "quiet-editorial",
          palette: "sauge",
        },
        voicePreset: null,
        name: "Style 2",
      },
      preset3: {
        verbatiStyle: {
          familyId: "editorial",
          layout: "editorial",
          typography: "quiet-editorial",
          palette: "sauge",
        },
        voicePreset: null,
        name: "Style 3",
      },
    });
  });

  it("updates the live preview when selecting a different font pair", async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsPage />);

    const activePair = container.querySelector(
      ".dasti-settings-font-pair-card--active",
    );

    expect(activePair).toHaveTextContent("Fraunces Bold");
    expect(activePair).toHaveTextContent("Syne Regular");
    expect(
      container.querySelector(".dasti-settings-hero-preview__chip"),
    ).toHaveTextContent("Fraunces Bold / Syne Regular");

    const fontCards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        ".dasti-settings-font-pair-card",
      ),
    );

    await user.click(fontCards[1]!);

    await waitFor(() => {
      expect(savePresetMock).toHaveBeenCalled();
    });

    const lastCall = savePresetMock.mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({
      slot: 1,
      preset: expect.objectContaining({
        verbatiStyle: expect.objectContaining({
          familyId: "swiss",
          layout: "swiss",
          typography: "civic-correspondence",
        }),
      }),
    });
    expect(
      container.querySelector(".dasti-settings-hero-preview__chip"),
    ).toHaveTextContent("Thestral Neue / BioRhyme Light");
  });

  it("renders all thirteen curated font pairs in the typography grid", () => {
    const { container } = render(<SettingsPage />);
    const grid = screen.getByRole("group", { name: "Font pair" });
    const optionButtons = within(grid).getAllByRole("button");

    expect(optionButtons).toHaveLength(13);
    expect(grid).toHaveTextContent("Grave Presse");
    expect(grid).toHaveTextContent("Nunito ExtraBold");
    expect(grid).toHaveTextContent("Doto Black");
    expect(container.querySelector(".dasti-settings-font-grid")).toBeTruthy();
  });

  it("switches style cards and refreshes the preview badge", async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsPage />);
    const previewBadge = () =>
      container.querySelector(".dasti-settings-hero-preview__style-badge");
    const editorialStyleButton = screen
      .getAllByRole("button", { name: /Editorial/ })
      .find((element) =>
        element.className.includes("dasti-settings-style-card"),
      );

    expect(previewBadge()).toHaveTextContent("Swiss Minima");
    expect(editorialStyleButton).toBeTruthy();

    await user.click(editorialStyleButton!);

    await waitFor(() => {
      expect(savePresetMock).toHaveBeenCalled();
    });

    const lastCall = savePresetMock.mock.calls.at(-1)?.[0];
    expect(lastCall).toMatchObject({
      slot: 1,
      preset: expect.objectContaining({
        verbatiStyle: expect.objectContaining({
          familyId: "editorial",
          layout: "editorial",
        }),
      }),
    });
    expect(previewBadge()).toHaveTextContent("Editorial");
  });

  it("renders the layout style cards for the available presets", () => {
    const { container } = render(<SettingsPage />);
    const familyGroup = screen.getByRole("group", { name: "Style family" });

    expect(
      container.querySelectorAll(".dasti-settings-style-card").length,
    ).toBeGreaterThanOrEqual(3);
    expect(within(familyGroup).queryByRole("button", { name: /^Auto$/i })).toBeNull();
    expect(within(familyGroup).queryByRole("button", { name: /^Warm$/i })).toBeNull();
    expect(within(familyGroup).queryByRole("button", { name: /^Technical$/i })).toBeNull();
    expect(within(familyGroup).queryByRole("button", { name: /^Formal$/i })).toBeNull();
  });

  it("shows workshop in the family list when the feature flag is enabled", () => {
    workshopFlagMock.mockReturnValue(true);

    render(<SettingsPage />);

    const familyGroup = screen.getByRole("group", { name: "Style family" });

    expect(
      within(familyGroup).getByRole("button", { name: /Workshop/i }),
    ).toBeInTheDocument();
  });

  it("preserves and displays a stored workshop family while hiding it from new selection when the flag is off", () => {
    presetsQueryMock.mockReturnValue({
      activeSlot: 1,
      preset1: {
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
        },
        voicePreset: null,
        name: "Workshop Style",
      },
      preset2: null,
      preset3: null,
    });

    const { container } = render(<SettingsPage />);
    const familyGroup = screen.getByRole("group", { name: "Style family" });

    expect(
      container.querySelector(".dasti-settings-hero-preview__style-badge"),
    ).toHaveTextContent("Workshop");
    expect(screen.getByText("Current family: Workshop")).toBeInTheDocument();
    expect(
      within(familyGroup).queryByRole("button", { name: /Workshop/i }),
    ).toBeNull();
  });

  it("updates the hero preview tilt when the pointer moves", async () => {
    const { container } = render(<SettingsPage />);
    const previewCard = container.querySelector(".dasti-settings-hero-preview");

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

    fireEvent.mouseMove(previewCard!, {
      clientX: 248,
      clientY: 42,
    });

    await waitFor(() => {
      expect(previewCard!.style.getPropertyValue("--ry")).not.toBe("0deg");
      expect(previewCard!.style.getPropertyValue("--rx")).not.toBe("0deg");
    });
  });
});
