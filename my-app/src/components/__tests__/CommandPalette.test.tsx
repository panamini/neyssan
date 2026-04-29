import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

    fireEvent.click(screen.getByRole("option", { name: /Dashboard/i }));

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
    fireEvent.click(screen.getByRole("option", { name: /Replay onboarding/i }));

    expect(onReplayOnboarding).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.click(screen.getByRole("option", { name: /Toggle light or dark/i }));

    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });
});
