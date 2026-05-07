import React from "react";
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

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
  useUser: () => ({ user: null }),
}));

vi.mock("../../components/ProposalColorPickerPopover", () => ({
  ProposalColorPickerPopover: () => null,
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
    window.localStorage.clear();
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.reduceMotion = "false";
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

  it("renders skeleton settings navigation and opens account by default", async () => {
    const user = userEvent.setup();
    renderSettings("/settings");

    expect(screen.getAllByRole("button").slice(0, 7).map((button) => button.textContent)).toEqual([
      "Account",
      "Preferences",
      "Document style",
      "Voice & tone",
      "Billing",
      "Team",
      "Danger zone",
    ]);
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Connected accounts")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Document style" }));

    expect(screen.getByRole("heading", { name: "Style profiles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Document style" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("activates theme and reduce-motion preferences from preferences", async () => {
    const user = userEvent.setup();
    renderSettings("/settings?tab=preferences");

    await user.click(screen.getByRole("button", { name: "Dark" }));
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(document.documentElement.dataset.theme).toBe("dark");

    await user.click(screen.getByRole("button", { name: "System" }));
    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Reduce motion" }));
    expect(screen.getByRole("button", { name: "Reduce motion" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(document.documentElement.dataset.reduceMotion).toBe("true");
  });

  it("hydrates default style slots from the onboarding document style set", () => {
    presetsQueryMock.mockReturnValue({
      activeSlot: 1,
      preset1: null,
      preset2: null,
      preset3: null,
    });

    const { container } = renderSettings();

    expect(container.querySelector(".dasti-settings-hero-preview__chip")).toHaveTextContent(
      "Fraunces Bold / Syne Regular",
    );

    const cards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".dasti-settings-slot-card"),
    );

    expect(cards[0]).toHaveTextContent("Style 1");
    expect(cards[1]).toHaveTextContent("Style 2");
    expect(cards[2]).toHaveTextContent("Style 3");
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

  it("saves an explicit signature font on the current preset", async () => {
    const user = userEvent.setup();
    renderSettings();

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

  it("shows auto plus both Workshop style cards", () => {
    const { container } = renderSettings();
    const previewBadge = () =>
      container.querySelector(".dasti-settings-hero-preview__style-badge");
    const styleCardLabels = Array.from(
      container.querySelectorAll(".layout-card__name"),
    ).map((element) => element.textContent);
    const uniqueStyleCardLabels = Array.from(new Set(styleCardLabels));

    expect(previewBadge()).toHaveTextContent("Workshop");
    expect(uniqueStyleCardLabels).toEqual(["Auto", "Workshop", "Workshop 2-col"]);
  });

  it("saves workshop as canonical verbatiStyle on the preset slot", async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    const workshopStyleButton = screen
      .getAllByRole("button", { name: /Workshop/ })
      .find((element) => element.className.includes("layout-card"));
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

  it("saves the two-column Workshop template id from settings", async () => {
    const user = userEvent.setup();
    renderSettings();
    const workshopTwoColumnButton = screen
      .getAllByRole("button", { name: /Workshop 2-col/ })
      .find((element) => element.className.includes("layout-card"));

    expect(workshopTwoColumnButton).toBeTruthy();

    await user.click(workshopTwoColumnButton!);

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

  it("renders the layout style cards for the available presets", () => {
    const { container } = renderSettings();

    expect(
      Array.from(container.querySelectorAll(".layout-card__name")).map(
        (element) => element.textContent,
      ),
    ).toEqual(["Auto", "Workshop", "Workshop 2-col"]);
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
