import React from "react";
import fs from "node:fs";
import path from "node:path";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "../SettingsPage";

const savePresetMock = vi.fn(() => Promise.resolve(null));
const setActivePresetMock = vi.fn(() => Promise.resolve(null));
const setCurrentSettingsMock = vi.fn(() => Promise.resolve(null));
const presetsQueryMock = vi.fn();

function getLastSavePresetPayload(): unknown {
  return (savePresetMock.mock.calls as unknown as Array<[unknown]>).at(-1)?.[0];
}

const { api } = vi.hoisted(() => ({
  api: {
    proposalSettings: {
      getPresets: {},
      getCurrent: {},
      savePreset: {},
      setActivePreset: {},
      setCurrent: {},
    },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: () => presetsQueryMock(),
  useMutation: (reference: unknown) => {
    if (reference === (api.proposalSettings.savePreset as unknown)) {
      return savePresetMock;
    }

    if (reference === (api.proposalSettings.setCurrent as unknown)) {
      return setCurrentSettingsMock;
    }

    return setActivePresetMock;
  },
}));

vi.mock("../../../convex/_generated/api", () => ({ api }));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true }),
  useUser: () => ({ user: null }),
}));

vi.mock("../../components/ProposalColorPickerPopover", () => ({
  ProposalColorPickerPopover: ({
    isOpen,
    onHexChange,
  }: {
    isOpen: boolean;
    onHexChange: (hex: string) => void;
  }) =>
    isOpen ? (
      <button type="button" onClick={() => onHexChange("#A1B2C3")}>
        Pick custom #A1B2C3
      </button>
    ) : null,
}));

function renderSettings(initialEntry = "/settings?tab=docstyle") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

describe("SettingsPage preview controls", () => {
  beforeEach(() => {
    savePresetMock.mockClear();
    setActivePresetMock.mockClear();
    setCurrentSettingsMock.mockClear();
    window.localStorage.clear();
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.reduceMotion = "false";
    document.documentElement.removeAttribute("data-ui-accent");
    document.documentElement.removeAttribute("data-ui-language");
    document.documentElement.classList.remove(
      "pal-cobalt",
      "pal-sauge",
      "pal-plum",
      "pal-ochre",
      "pal-ink",
    );
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

  it("opens account by default and routes to docstyle via tab query", () => {
    renderSettings("/settings");

    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Connected accounts")).toBeInTheDocument();

    renderSettings("/settings?tab=docstyle");
    expect(
      screen.getByRole("heading", { name: "Style profiles" }),
    ).toBeInTheDocument();
  });

  it("keeps tone out of document style and saves it from Voice & tone", async () => {
    const user = userEvent.setup();
    renderSettings("/settings?tab=docstyle");

    expect(
      screen.queryByRole("group", { name: "Default tone" }),
    ).not.toBeInTheDocument();

    renderSettings("/settings?tab=voice");
    const toneGroup = screen.getByRole("group", { name: "Default tone" });

    await user.click(within(toneGroup).getByRole("button", { name: "Warm" }));

    await waitFor(() => {
      expect(setCurrentSettingsMock).toHaveBeenCalledWith({
        voicePreset: "engaging",
      });
    });
    expect(savePresetMock).not.toHaveBeenCalled();
  });

  it("activates theme, UI accent, language, and motion preferences", async () => {
    const user = userEvent.setup();
    const themeRender = renderSettings("/settings?tab=theme");

    const darkThemeButton = screen.getByRole("button", { name: "Dark" });
    await user.click(darkThemeButton);
    expect(darkThemeButton).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.theme).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Light" }));
    expect(darkThemeButton).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.dataset.theme).toBe("light");

    await user.click(screen.getByRole("button", { name: "Cobalt" }));
    expect(document.documentElement.dataset.uiAccent).toBe("cobalt");
    expect(document.documentElement.classList.contains("pal-cobalt")).toBe(
      true,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Open custom interface accent color picker",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Pick custom #A1B2C3" }),
    );
    expect(document.documentElement.dataset.uiAccent).toBe("custom");
    expect(document.documentElement.style.getPropertyValue("--ac")).toBe(
      "#a1b2c3",
    );
    await user.click(screen.getByRole("button", { name: "Reduce motion" }));
    expect(
      screen.getByRole("button", { name: "Reduce motion" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.reduceMotion).toBe("true");
    themeRender.unmount();

    const languageRender = renderSettings("/settings?tab=language");
    await user.click(screen.getByRole("button", { name: /Spanish Espanol/ }));
    expect(document.documentElement.dataset.uiLanguage).toBe("es");
    expect(document.documentElement.lang).toBe("es");
    expect(document.documentElement.dir).toBe("ltr");
    languageRender.unmount();
  });

  it("shows only production UI languages in Settings", () => {
    renderSettings("/settings?tab=language");

    const group = screen.getByRole("group", { name: "Interface language" });
    expect(within(group).getByRole("button", { name: "Auto Auto" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: /English English/ })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: /French Francais/ })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: /Spanish Espanol/ })).toBeInTheDocument();
    expect(within(group).queryByRole("button", { name: /German/ })).not.toBeInTheDocument();
    expect(within(group).queryByRole("button", { name: /Arabic/ })).not.toBeInTheDocument();
    expect(within(group).queryByRole("button", { name: /Irish/ })).not.toBeInTheDocument();
  });

  it("hydrates default style slots from the onboarding document style set", () => {
    presetsQueryMock.mockReturnValue({
      activeSlot: 1,
      preset1: null,
      preset2: null,
      preset3: null,
    });

    const { container } = renderSettings();

    expect(
      container.querySelector(".dasti-settings-hero-preview__chip"),
    ).toHaveTextContent("Geist Bold / Baskervville");

    const cards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        ".dasti-settings-slot-card",
      ),
    );

    expect(cards[0]).toHaveTextContent("Style 1");
    expect(cards[1]).toHaveTextContent("Style 2");
    expect(cards[2]).toHaveTextContent("Style 3");
  });

  it("selects a saved slot color from verbatiStyle when legacy top-level palette is null", async () => {
    presetsQueryMock.mockReturnValue({
      activeSlot: 2,
      preset1: null,
      preset2: {
        fontPairId: "quiet-editorial",
        styleChoice: "balanced",
        paletteOverride: null,
        accentHex: null,
        voicePreset: null,
        name: "Style 2",
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "ink",
          accentHex: null,
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
      },
      preset3: null,
    });
    const user = userEvent.setup();
    const { container } = renderSettings();
    const cards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        ".dasti-settings-slot-card",
      ),
    );

    await user.click(cards[1]!);

    expect(
      within(screen.getByRole("group", { name: "Color" })).getByRole("button", {
        name: "Ink",
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("saves Style 2 Cobalt into both top-level palette and verbatiStyle", async () => {
    presetsQueryMock.mockReturnValue({
      activeSlot: 2,
      preset1: null,
      preset2: {
        fontPairId: "quiet-editorial",
        styleChoice: "balanced",
        paletteOverride: "sauge",
        accentHex: null,
        voicePreset: null,
        name: "Style 2",
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "sauge",
          accentHex: null,
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
      },
      preset3: null,
    });
    const user = userEvent.setup();
    const { container } = renderSettings();
    const cards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        ".dasti-settings-slot-card",
      ),
    );

    await user.click(cards[1]!);
    await user.click(
      within(screen.getByRole("group", { name: "Color" })).getByRole("button", {
        name: "Cobalt",
      }),
    );

    const colorGroup = within(screen.getByRole("group", { name: "Color" }));
    expect(colorGroup.getByRole("button", { name: "Cobalt" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(colorGroup.getByRole("button", { name: "Sage" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await waitFor(() => {
      expect(getLastSavePresetPayload()).toMatchObject({
        slot: 2,
        preset: expect.objectContaining({
          paletteOverride: "cobalt",
          accentHex: null,
          verbatiStyle: expect.objectContaining({
            palette: "cobalt",
            accentHex: null,
            typography: "quiet-editorial",
            layout: "workshop",
            resumeTemplateId: "workshop_resume_twocol_ats",
          }),
        }),
      });
    });
  });

  it("saves a custom Style 2 color through accentHex and custom verbatiStyle", async () => {
    presetsQueryMock.mockReturnValue({
      activeSlot: 2,
      preset1: null,
      preset2: {
        fontPairId: "quiet-editorial",
        styleChoice: "balanced",
        paletteOverride: "cobalt",
        accentHex: null,
        voicePreset: null,
        name: "Style 2",
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "quiet-editorial",
          palette: "cobalt",
          accentHex: null,
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
      },
      preset3: null,
    });
    const user = userEvent.setup();
    const { container } = renderSettings();
    const cards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        ".dasti-settings-slot-card",
      ),
    );

    await user.click(cards[1]!);
    await user.click(
      within(screen.getByRole("group", { name: "Color" })).getByRole("button", {
        name: "Open custom color picker",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Pick custom #A1B2C3" }),
    );

    const colorGroup = within(screen.getByRole("group", { name: "Color" }));
    expect(
      colorGroup.getByRole("button", { name: "Open custom color picker" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(colorGroup.getByRole("button", { name: "Cobalt" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await waitFor(() => {
      expect(getLastSavePresetPayload()).toMatchObject({
        slot: 2,
        preset: expect.objectContaining({
          paletteOverride: null,
          accentHex: "#A1B2C3",
          verbatiStyle: expect.objectContaining({
            palette: "custom",
            accentHex: "#a1b2c3",
            typography: "quiet-editorial",
            layout: "workshop",
            resumeTemplateId: "workshop_resume_twocol_ats",
          }),
        }),
      });
    });
  });

  it("resets the edited Settings style slot back to factory defaults", async () => {
    presetsQueryMock.mockReturnValue({
      activeSlot: 2,
      preset1: null,
      preset2: {
        fontPairId: "studio-grotesk",
        styleChoice: "balanced",
        paletteOverride: null,
        accentHex: "#A1B2C3",
        voicePreset: null,
        name: "Style 2",
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "studio-grotesk",
          palette: "custom",
          accentHex: "#A1B2C3",
          resumeTemplateId: "workshop_resume_onecol_ats",
        },
      },
      preset3: null,
    });
    const user = userEvent.setup();
    const { container } = renderSettings();
    const cards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        ".dasti-settings-slot-card",
      ),
    );

    await user.click(cards[1]!);
    await user.click(screen.getByRole("button", { name: "Reset Style 2" }));

    await waitFor(() => {
      expect(getLastSavePresetPayload()).toMatchObject({
        slot: 2,
        preset: expect.objectContaining({
          fontPairId: "quiet-editorial",
          paletteOverride: "ink",
          accentHex: null,
          verbatiStyle: expect.objectContaining({
            palette: "ink",
            accentHex: null,
            typography: "quiet-editorial",
            resumeTemplateId: "workshop_resume_twocol_ats",
          }),
        }),
      });
    });
  });

  it("keeps Style 3 factory Ink when saving another field without an explicit palette override", async () => {
    presetsQueryMock.mockReturnValue({
      activeSlot: 3,
      preset1: null,
      preset2: null,
      preset3: {
        fontPairId: "ledger-sans",
        styleChoice: "balanced",
        paletteOverride: null,
        accentHex: null,
        voicePreset: null,
        name: "Style 3",
      },
    });
    const user = userEvent.setup();
    const { container } = renderSettings();
    const cards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        ".dasti-settings-slot-card",
      ),
    );

    await user.click(cards[2]!);

    const colorGroup = within(screen.getByRole("group", { name: "Color" }));
    expect(colorGroup.getByRole("button", { name: "Ink" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(colorGroup.getByRole("button", { name: "Sage" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(
      container.querySelectorAll<HTMLButtonElement>(
        ".dasti-settings-font-pair-card",
      )[0]!,
    );

    await waitFor(() => {
      expect(getLastSavePresetPayload()).toMatchObject({
        slot: 3,
        preset: expect.objectContaining({
          paletteOverride: null,
          verbatiStyle: expect.objectContaining({
            palette: "ink",
          }),
        }),
      });
    });
  });

  it("does not let late preset hydration overwrite a local Style 2 color or font edit", async () => {
    let presetsResponse: unknown;
    presetsQueryMock.mockImplementation(() => presetsResponse);
    const user = userEvent.setup();
    const { container, rerender } = render(
      <MemoryRouter initialEntries={["/settings?tab=docstyle"]}>
        <SettingsPage />
      </MemoryRouter>,
    );
    const cards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        ".dasti-settings-slot-card",
      ),
    );

    await user.click(cards[1]!);
    await user.click(
      within(screen.getByRole("group", { name: "Color" })).getByRole("button", {
        name: "Cobalt",
      }),
    );
    await user.click(
      container.querySelectorAll<HTMLButtonElement>(
        ".dasti-settings-font-pair-card",
      )[0]!,
    );

    presetsResponse = {
      activeSlot: 2,
      preset1: null,
      preset2: {
        fontPairId: "classic-script",
        styleChoice: "balanced",
        paletteOverride: "sauge",
        accentHex: null,
        voicePreset: null,
        name: "Style 2",
        verbatiStyle: {
          familyId: "workshop",
          layout: "workshop",
          typography: "classic-script",
          palette: "sauge",
          accentHex: null,
          resumeTemplateId: "workshop_resume_twocol_ats",
        },
      },
      preset3: null,
    };
    rerender(
      <MemoryRouter initialEntries={["/settings?tab=docstyle"]}>
        <SettingsPage />
      </MemoryRouter>,
    );

    const colorGroup = within(screen.getByRole("group", { name: "Color" }));
    expect(colorGroup.getByRole("button", { name: "Cobalt" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(colorGroup.getByRole("button", { name: "Sage" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      container.querySelector(".dasti-settings-hero-preview__chip"),
    ).toHaveTextContent("Fraunces Bold / Syne Regular");
    expect(
      container.querySelector(".dasti-settings-hero-preview__chip"),
    ).not.toHaveTextContent("Parisienne");
  });

  it("keeps the default badge pinned until the user sets a slot as default", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();

    const cards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        ".dasti-settings-slot-card",
      ),
    );

    expect(cards[0]).toHaveTextContent("Default");
    expect(cards[1]).not.toHaveTextContent("Default");
    expect(
      container.querySelector(".dasti-settings-builder__active-badge"),
    ).toBeNull();

    await user.click(cards[1]!);

    expect(setActivePresetMock).not.toHaveBeenCalled();
    expect(cards[0]).toHaveTextContent("Default");
    expect(cards[1]).not.toHaveTextContent("Default");
    expect(
      screen.getByRole("button", { name: "Set as default" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Set as default" }));

    await waitFor(() => {
      expect(setActivePresetMock).toHaveBeenCalledWith({ slot: 2 });
    });
    await waitFor(() => {
      expect(cards[1]).toHaveTextContent("Default");
    });
  });

  it("shows only one default label in the style rail while switching slots", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();

    const getCards = () =>
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          ".dasti-settings-slot-card",
        ),
      );
    const getDefaultTexts = () =>
      Array.from(
        screen
          .getByRole("group", { name: "Style preset slots" })
          .querySelectorAll(".dasti-settings-slot-card__active-badge"),
      );

    expect(getDefaultTexts()).toHaveLength(1);

    await user.click(getCards()[1]!);

    expect(getDefaultTexts()).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Set as default" }));

    await waitFor(() => {
      expect(getDefaultTexts()).toHaveLength(1);
    });

    await user.click(getCards()[2]!);

    expect(getDefaultTexts()).toHaveLength(1);
  });

  it("keeps exactly one default after setting Style 2 then browsing other slots", async () => {
    presetsQueryMock.mockReturnValue({
      activeSlot: 3,
      preset1: {
        fontPairId: "geist-baskervville",
        styleChoice: "balanced",
        paletteOverride: null,
        accentHex: null,
        voicePreset: null,
        name: "Style 1",
      },
      preset2: {
        fontPairId: "quiet-editorial",
        styleChoice: "balanced",
        paletteOverride: null,
        accentHex: null,
        voicePreset: null,
        name: "Style 2",
      },
      preset3: {
        fontPairId: "ledger-sans",
        styleChoice: "balanced",
        paletteOverride: null,
        accentHex: null,
        voicePreset: null,
        name: "Style 3",
      },
    });
    const user = userEvent.setup();
    const { container } = renderSettings();

    const getCards = () =>
      Array.from(
        container.querySelectorAll<HTMLButtonElement>(
          ".dasti-settings-slot-card",
        ),
      );
    const getDefaultTexts = () =>
      Array.from(
        screen
          .getByRole("group", { name: "Style preset slots" })
          .querySelectorAll(".dasti-settings-slot-card__active-badge"),
      );

    expect(getDefaultTexts()).toHaveLength(1);
    expect(getCards()[2]).toHaveTextContent("Default");
    expect(getCards()[2]).toHaveAttribute("aria-pressed", "true");

    await user.click(getCards()[1]!);
    await user.click(screen.getByRole("button", { name: "Set as default" }));

    await waitFor(() => {
      expect(setActivePresetMock).toHaveBeenCalledWith({ slot: 2 });
      expect(getDefaultTexts()).toHaveLength(1);
      expect(getCards()[1]).toHaveTextContent("Default");
    });

    await user.click(getCards()[0]!);
    await user.click(getCards()[2]!);

    expect(getDefaultTexts()).toHaveLength(1);
    expect(getCards()[1]).toHaveTextContent("Default");
    expect(getCards()[2]).not.toHaveTextContent("Default");
    expect(
      container.querySelectorAll(".dasti-settings-slot-card--active"),
    ).toHaveLength(1);
    expect(
      container.querySelectorAll(".dasti-settings-slot-card--editing"),
    ).toHaveLength(1);
  });

  it("does not show a fallback default while saved presets are loading", () => {
    presetsQueryMock.mockReturnValue(undefined);
    const { container } = renderSettings();

    expect(
      within(
        screen.getByRole("group", { name: "Style preset slots" }),
      ).queryAllByText(/default/i),
    ).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Set as default" })).toBeNull();
    expect(
      container.querySelectorAll(".dasti-settings-slot-card--active"),
    ).toHaveLength(0);
    expect(
      container.querySelectorAll(".dasti-settings-slot-card--editing"),
    ).toHaveLength(0);
  });

  it("does not move the default badge when setting the active slot fails", async () => {
    setActivePresetMock.mockRejectedValueOnce(
      new Error("Server rejected active slot"),
    );
    const user = userEvent.setup();
    const { container } = renderSettings();

    const cards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        ".dasti-settings-slot-card",
      ),
    );

    await user.click(cards[1]!);
    await user.click(screen.getByRole("button", { name: "Set as default" }));

    await waitFor(() => {
      expect(
        screen.getByText("Server rejected active slot"),
      ).toBeInTheDocument();
    });
    expect(cards[0]).toHaveTextContent("Default");
    expect(cards[1]).not.toHaveTextContent("Default");
  });

  it("updates the live preview when selecting a different font pair", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();

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
    const { container } = renderSettings();
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

  it("uses tokenized line-height for the Grave Presse and Borel settings preview", () => {
    renderSettings();
    const grid = screen.getByRole("group", { name: "Font pair" });
    const specialCorrespondenceCard = within(grid)
      .getByText("Grave Presse", {
        selector: ".dasti-settings-font-pair-card__heading",
      })
      .closest(".dasti-settings-font-pair-card");

    expect(specialCorrespondenceCard).toHaveAttribute(
      "data-font-pair-id",
      "special-correspondence",
    );

    const stylesPath = path.resolve(
      __dirname,
      "../../styles/product-settings.css",
    );
    const styles = fs.readFileSync(stylesPath, "utf8");
    expect(styles).toMatch(
      /\.dasti-settings-font-pair-card\[data-font-pair-id="special-correspondence"\][\s\S]*\.dasti-settings-font-pair-card__heading\s*\{[\s\S]*line-height:\s*var\(--text-body-sm-line\);/,
    );
    expect(styles).toMatch(
      /\.dasti-settings-font-pair-card\[data-font-pair-id="special-correspondence"\][\s\S]*\.dasti-settings-font-pair-card__body\s*\{[\s\S]*line-height:\s*var\(--text-caption-line\);/,
    );
    expect(styles).toMatch(
      /\.dasti-settings-hero-preview\[data-font-pair-id="special-correspondence"\][\s\S]*\.dasti-settings-hero-preview__body-text\s*\{[\s\S]*line-height:\s*var\(--text-body-line\);/,
    );
  });

  it("saves an explicit signature font on the current preset", async () => {
    const user = userEvent.setup();
    const imageDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP8z8AARQAHAQGByp7K7wAAAABJRU5ErkJggg==";
    presetsQueryMock.mockReturnValue({
      activeSlot: 1,
      preset1: {
        fontPairId: "geist-baskervville",
        styleChoice: "balanced",
        paletteOverride: null,
        accentHex: null,
        voicePreset: null,
        signatureSettings: {
          mode: "image",
          fontId: null,
          imageDataUrl,
        },
        name: "Style 1",
      },
      preset2: null,
      preset3: null,
    });
    renderSettings();

    const signatureGroup = screen.getByRole("group", { name: "Printed name" });
    await user.click(
      within(signatureGroup).getByRole("button", {
        name: "FD Garamond printed name",
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
          imageDataUrl,
        },
      }),
    });
  });

  it("shows auto plus both template style cards", () => {
    const { container } = renderSettings();
    const previewBadge = () =>
      container.querySelector(".dasti-settings-hero-preview__style-badge");
    const styleCardLabels = Array.from(
      container.querySelectorAll(".layout-card__name"),
    ).map((element) => element.textContent);
    const uniqueStyleCardLabels = Array.from(new Set(styleCardLabels));

    expect(previewBadge()).toHaveTextContent("Minimal");
    expect(uniqueStyleCardLabels).toEqual(["Auto", "Minimal", "French"]);
  });

  it("saves the Minimal template as canonical verbatiStyle on the preset slot", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    const minimalStyleButton = screen
      .getAllByRole("button", { name: "Minimal" })
      .find((element) => element.className.includes("layout-card"));
    const previewBadge = () =>
      container.querySelector(".dasti-settings-hero-preview__style-badge");

    expect(minimalStyleButton).toBeTruthy();

    await user.click(minimalStyleButton!);

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
    expect(previewBadge()).toHaveTextContent("Minimal");
  });

  it("saves the French template id from settings", async () => {
    const user = userEvent.setup();
    renderSettings();
    const frenchButton = screen
      .getAllByRole("button", { name: "French" })
      .find((element) => element.className.includes("layout-card"));

    expect(frenchButton).toBeTruthy();

    await user.click(frenchButton!);

    await waitFor(() => {
      expect(savePresetMock).toHaveBeenCalled();
    });

    expect(getLastSavePresetPayload()).toMatchObject({
      slot: 1,
      preset: expect.objectContaining({
        styleChoice: "balanced",
        verbatiStyle: expect.objectContaining({
          familyId: "workshop",
          layout: "workshop",
          resumeTemplateId: "workshop_resume_twocol_ats",
        }),
      }),
    });
  });

  it("keeps the selected CV layout when saving a font pair on a style slot", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    const frenchButton = screen
      .getAllByRole("button", { name: "French" })
      .find((element) => element.className.includes("layout-card"));

    expect(frenchButton).toBeTruthy();

    await user.click(frenchButton!);
    await waitFor(() => {
      expect(getLastSavePresetPayload()).toMatchObject({
        preset: expect.objectContaining({
          verbatiStyle: expect.objectContaining({
            resumeTemplateId: "workshop_resume_twocol_ats",
          }),
        }),
      });
    });

    savePresetMock.mockClear();
    const fontCards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        ".dasti-settings-font-pair-card",
      ),
    );
    await user.click(fontCards[0]!);

    await waitFor(() => {
      expect(getLastSavePresetPayload()).toMatchObject({
        slot: 1,
        preset: expect.objectContaining({
          fontPairId: "quiet-editorial",
          verbatiStyle: expect.objectContaining({
            layout: "workshop",
            typography: "quiet-editorial",
            resumeTemplateId: "workshop_resume_twocol_ats",
          }),
        }),
      });
    });
  });

  it("renders the layout style cards for the available presets", () => {
    const { container } = renderSettings();

    expect(
      Array.from(container.querySelectorAll(".layout-card__name")).map(
        (element) => element.textContent,
      ),
    ).toEqual(["Auto", "Minimal", "French"]);
  });

  it("updates the hero preview tilt when the pointer moves", async () => {
    const { container } = renderSettings();
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
