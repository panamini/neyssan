import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForgeTemplatePanel } from "../../components/ForgeTemplatePanel";
import {
  ForgeTemplatePanelProvider,
  useForgeTemplatePanel,
  useRegisterForgePanel,
} from "../../contexts/ForgeTemplatePanelContext";
import { SettingsPage } from "../SettingsPage";

const presetsQueryMock = vi.fn();
const savePresetMock = vi.fn(() => Promise.resolve(null));
const setActivePresetMock = vi.fn(() => Promise.resolve(null));
const setCurrentSettingsMock = vi.fn(() => Promise.resolve(null));

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
  ProposalColorPickerPopover: () => null,
}));

function SettingsPanelHarness(): null {
  const { openSurface } = useForgeTemplatePanel();

  useRegisterForgePanel(
    React.useMemo(
      () => ({
        surface: "settings" as const,
        title: "",
        ariaLabel: "Settings sections",
        renderContent: () => <div>Settings drawer content</div>,
      }),
      [],
    ),
  );

  React.useEffect(() => {
    openSurface("settings", { mode: "docked" });
  }, [openSurface]);

  return null;
}

function renderSettingsWithDrawer(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });

  return render(
    <MemoryRouter initialEntries={["/settings?tab=docstyle"]}>
      <ForgeTemplatePanelProvider>
        <SettingsPanelHarness />
        <ForgeTemplatePanel />
        <SettingsPage />
      </ForgeTemplatePanelProvider>
    </MemoryRouter>,
  );
}

describe("SettingsPage drawer docking", () => {
  beforeEach(() => {
    presetsQueryMock.mockReturnValue({
      activeSlot: 1,
      preset1: null,
      preset2: null,
      preset3: null,
    });
  });

  it("keeps a requested pinned Settings drawer in overlay mode on narrow viewports", async () => {
    const { container } = renderSettingsWithDrawer(805);

    await screen.findByText("Settings drawer content");

    await waitFor(() => {
      expect(container.querySelector(".forge-template-panel")).toHaveAttribute(
        "data-mode",
        "overlay",
      );
    });
    expect(
      container.querySelector(".dasti-page-shell--settings"),
    ).not.toHaveAttribute("data-forge-drawer-docked");
    expect(container.querySelector(".dasti-settings-layout")).not.toHaveAttribute(
      "data-forge-drawer-docked",
    );
  });

  it("keeps a requested pinned Settings drawer docked on desktop viewports", async () => {
    const { container } = renderSettingsWithDrawer(1280);

    await screen.findByText("Settings drawer content");

    await waitFor(() => {
      expect(container.querySelector(".forge-template-panel")).toHaveAttribute(
        "data-mode",
        "docked",
      );
    });
    expect(container.querySelector(".dasti-page-shell--settings")).toHaveAttribute(
      "data-forge-drawer-docked",
      "true",
    );
    expect(container.querySelector(".dasti-settings-layout")).toHaveAttribute(
      "data-forge-drawer-docked",
      "true",
    );
  });
});
