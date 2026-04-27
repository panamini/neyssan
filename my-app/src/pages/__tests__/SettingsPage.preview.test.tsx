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

function getLastSavePresetPayload(): unknown {
  return (savePresetMock.mock.calls as unknown as Array<[unknown]>).at(-1)?.[0];
}

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

describe("SettingsPage preview controls", () => {
  beforeEach(() => {
    savePresetMock.mockClear();
    setActivePresetMock.mockClear();
    presetsQueryMock.mockReturnValue({
      activeSlot: 1,
      preset1: {
        fontPairId: "geist-baskervville",
        styleChoice: "balanced",
        paletteOverride: null,
        accentHex: null,
        voicePreset: null,
        name: "Style 1",
      },
      preset2: {
        fontPairId: "geist-baskervville",
        styleChoice: "balanced",
        paletteOverride: null,
        accentHex: null,
        voicePreset: null,
        name: "Style 2",
      },
      preset3: {
        fontPairId: "geist-baskervville",
        styleChoice: "warm",
        paletteOverride: null,
        accentHex: null,
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

    expect(activePair).toHaveTextContent("Geist Bold");
    expect(activePair).toHaveTextContent("Baskervville");
    expect(
      container.querySelector(".dasti-settings-hero-preview__chip"),
    ).toHaveTextContent("Geist Bold / Baskervville");

    const fontCards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        ".dasti-settings-font-pair-card",
      ),
    );

    await user.click(fontCards[0]!);

    await waitFor(() => {
      expect(savePresetMock).toHaveBeenCalled();
    });

    const lastCall = getLastSavePresetPayload();
    expect(lastCall).toMatchObject({
      slot: 1,
      preset: expect.objectContaining({
        styleChoice: "balanced",
        fontPairId: "quiet-editorial",
      }),
    });
    expect(
      container.querySelector(".dasti-settings-hero-preview__chip"),
    ).toHaveTextContent("Fraunces Bold / Syne Regular");
  });

  it("renders all curated font pairs in the typography grid", () => {
    const { container } = render(<SettingsPage />);
    const grid = screen.getByRole("group", { name: "Font pair" });
    const optionButtons = within(grid).getAllByRole("button");

    expect(optionButtons).toHaveLength(15);
    expect(grid).toHaveTextContent("Geist Bold");
    expect(grid).toHaveTextContent("Grave Presse");
    expect(grid).toHaveTextContent("Nunito ExtraBold");
    expect(grid).toHaveTextContent("Doto Black");
    expect(grid).toHaveTextContent("FD Garamond");
    expect(container.querySelector(".dasti-settings-font-grid")).toBeTruthy();
  });

  it("saves an explicit signature font on the current preset", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const signatureGroup = screen.getByRole("group", { name: "Signature" });
    await user.click(
      within(signatureGroup).getByRole("button", {
        name: "FD Garamond signature",
      }),
    );

    await waitFor(() => {
      expect(savePresetMock).toHaveBeenCalled();
    });

    const lastCall = getLastSavePresetPayload();
    expect(lastCall).toMatchObject({
      slot: 1,
      preset: expect.objectContaining({
        signatureSettings: {
          mode: "font",
          fontId: "fd-garamond",
          imageDataUrl: null,
        },
      }),
    });
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

    expect(previewBadge()).toHaveTextContent("Swiss");
    expect(editorialStyleButton).toBeTruthy();

    await user.click(editorialStyleButton!);

    await waitFor(() => {
      expect(savePresetMock).toHaveBeenCalled();
    });

    const lastCall = getLastSavePresetPayload();
    expect(lastCall).toMatchObject({
      slot: 1,
      preset: expect.objectContaining({
        styleChoice: "warm",
      }),
    });
    expect(previewBadge()).toHaveTextContent("Editorial");
  });

  it("saves workshop as canonical verbatiStyle on the preset slot", async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsPage />);
    const workshopStyleButton = screen
      .getAllByRole("button", { name: /Workshop/ })
      .find((element) =>
        element.className.includes("dasti-settings-style-card"),
      );
    const previewBadge = () =>
      container.querySelector(".dasti-settings-hero-preview__style-badge");

    expect(workshopStyleButton).toBeTruthy();

    await user.click(workshopStyleButton!);

    await waitFor(() => {
      expect(savePresetMock).toHaveBeenCalled();
    });

    const lastCall = getLastSavePresetPayload();
    expect(lastCall).toMatchObject({
      slot: 1,
      preset: expect.objectContaining({
        styleChoice: "balanced",
        fontPairId: "geist-baskervville",
        verbatiStyle: expect.objectContaining({
          familyId: "workshop",
          layout: "workshop",
          typography: "geist-baskervville",
        }),
      }),
    });
    expect(previewBadge()).toHaveTextContent("Workshop");
  });

  it("renders the layout style cards for the available presets", () => {
    const { container } = render(<SettingsPage />);

    expect(
      container.querySelectorAll(".dasti-settings-style-card").length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("updates the hero preview tilt when the pointer moves", async () => {
    const { container } = render(<SettingsPage />);
    const previewCard = container.querySelector<HTMLElement>(
      ".dasti-settings-hero-preview",
    );

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
