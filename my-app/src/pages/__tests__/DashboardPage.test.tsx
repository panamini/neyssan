import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { DashboardPage } from "../DashboardPage";

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="dashboard-location">
      {`${location.pathname}${location.search}::${JSON.stringify(location.state ?? null)}`}
    </div>
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the PR1 dashboard blocks and the Capture jobs quick-start step", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <>
                <DashboardPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Quick start/i })).toBeInTheDocument();
    expect(screen.getAllByText("Capture jobs").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Review match evidence/i })).toBeInTheDocument();
    expect(screen.getByText("Recent activity")).toBeInTheDocument();
  });

  it("routes Import CV through the existing quick-start state", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <>
                <DashboardPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Import CV" })[0]);

    expect(screen.getByTestId("dashboard-location")).toHaveTextContent(
      '"resumeMode":"upload-only"',
    );
  });
});
