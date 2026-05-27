import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { CommandPalette } from "../CommandPalette";

vi.mock("@clerk/clerk-react", () => ({
  useClerk: () => ({
    signOut: vi.fn(),
  }),
}));

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="palette-location">
      {`${location.pathname}${location.search}::${JSON.stringify(location.state ?? null)}`}
    </div>
  );
}

function PaletteHarness({
  onReplayOnboarding = vi.fn(),
  onToggleTheme = vi.fn(),
}: {
  onReplayOnboarding?: () => void;
  onToggleTheme?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        onReplayOnboarding={onReplayOnboarding}
        onToggleTheme={onToggleTheme}
      />
      <LocationProbe />
    </>
  );
}

describe("CommandPalette", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders command palette shell chrome in English by default", () => {
    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <Routes>
          <Route path="*" element={<PaletteHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(
      screen.getByRole("dialog", { name: "Command palette" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: "Commands" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search"), {
      target: { value: "zzzz" },
    });

    expect(screen.getByText("No commands found.")).toBeInTheDocument();
  });

  it.each([
    {
      locale: "fr",
      title: "Palette de commandes",
      emptyState: "Aucune commande trouvée.",
      placeholder: "Rechercher",
      oldPlaceholder: ["Rechercher", " ou lancer", " une commande..."].join(""),
    },
    {
      locale: "es",
      title: "Paleta de comandos",
      emptyState: "No se encontraron comandos.",
      placeholder: "Buscar",
      oldPlaceholder: ["Buscar", " o ejecutar", " un comando..."].join(""),
    },
  ])(
    "renders command palette shell chrome and replay action in $locale",
    ({ locale, title, emptyState, placeholder, oldPlaceholder }) => {
      window.localStorage.setItem("twoweeks:ui-language", locale);
      window.localStorage.setItem("twoweeks:document-language", "ar");

      render(
        <MemoryRouter initialEntries={["/cv"]}>
          <Routes>
            <Route path="*" element={<PaletteHarness />} />
          </Routes>
        </MemoryRouter>,
      );

      fireEvent.keyDown(window, { key: "k", metaKey: true });

      expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
      expect(
        screen.getByRole("listbox", {
          name: locale === "fr" ? "Commandes" : "Comandos",
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /Today/i })).toBeInTheDocument();

      expect(screen.queryByPlaceholderText(oldPlaceholder)).not.toBeInTheDocument();
      expect(
        screen.getByRole("option", {
          name: locale === "fr" ? /Visite guidée/i : /Guía inicial/i,
        }),
      ).toBeInTheDocument();

      fireEvent.change(screen.getByPlaceholderText(placeholder), {
        target: { value: "zzzz" },
      });

      expect(screen.getByText(emptyState)).toBeInTheDocument();
      expect(window.localStorage.getItem("twoweeks:document-language")).toBe(
        "ar",
      );
    },
  );

  it("opens with Cmd/Ctrl+K and navigates with go-to commands", () => {
    render(
      <MemoryRouter initialEntries={["/cv"]}>
        <Routes>
          <Route path="*" element={<PaletteHarness />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: /Today/i }));

    expect(screen.queryByRole("dialog", { name: "Command palette" })).not.toBeInTheDocument();
    expect(screen.getByTestId("palette-location")).toHaveTextContent("/dashboard::null");
  });

  it("exposes onboarding replay and theme actions", () => {
    const onReplayOnboarding = vi.fn();
    const onToggleTheme = vi.fn();

    render(
      <MemoryRouter initialEntries={["/jobs"]}>
        <Routes>
          <Route
            path="*"
            element={
              <PaletteHarness
                onReplayOnboarding={onReplayOnboarding}
                onToggleTheme={onToggleTheme}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.click(screen.getByRole("option", { name: /Starter tour/i }));

    expect(onReplayOnboarding).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.click(screen.getByRole("option", { name: /Toggle light or dark/i }));

    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it("runs localized onboarding replay without changing document language", () => {
    const onReplayOnboarding = vi.fn();
    window.localStorage.setItem("twoweeks:ui-language", "fr");
    window.localStorage.setItem("twoweeks:document-language", "es");

    render(
      <MemoryRouter initialEntries={["/jobs"]}>
        <Routes>
          <Route
            path="*"
            element={<PaletteHarness onReplayOnboarding={onReplayOnboarding} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.click(
      screen.getByRole("option", { name: /Visite guidée/i }),
    );

    expect(onReplayOnboarding).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe(
      "es",
    );
  });
});
