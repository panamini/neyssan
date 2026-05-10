import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ForgeTemplatePanel } from "../ForgeTemplatePanel";
import { Sidebar } from "../Sidebar";
import {
  ForgeTemplatePanelProvider,
  useRegisterForgeTemplates,
} from "../../contexts/ForgeTemplatePanelContext";

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function RegisterTemplates({
  surface,
  onSelect,
}: {
  surface: "cv" | "proposal";
  onSelect: (itemId: string) => void;
}): null {
  useRegisterForgeTemplates(
    React.useMemo(
      () => ({
        surface,
        title: surface === "cv" ? "CV templates" : "Proposal templates",
        subtitle: "A4 · 21 × 29.7 cm",
        activeItemId: "schematic",
        items: [
          {
            id: "schematic",
            label: "Schematic",
            meta: "A4 · 21 × 29.7 cm",
          },
        ],
        onSelect,
      }),
      [onSelect, surface],
    ),
  );
  return null;
}

function renderSidebar(initialPath = "/dashboard", children?: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ForgeTemplatePanelProvider>
        <Sidebar />
        {children}
        <ForgeTemplatePanel />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </ForgeTemplatePanelProvider>
    </MemoryRouter>,
  );
}

function primaryNavItems(): HTMLElement[] {
  const navigation = screen.getByRole("navigation", {
    name: "Primary navigation",
  });
  return Array.from(navigation.querySelectorAll<HTMLElement>("a, button"));
}

describe("Sidebar permanent rail", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });
  });

  it("renders Templates as a global link outside forge routes", () => {
    renderSidebar();

    expect(primaryNavItems().map((item) => item.getAttribute("aria-label"))).toEqual([
      "Today",
      "Jobs",
      "CV",
      "Proposal",
      "Projects",
      "Templates",
      "Settings",
    ]);
    expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute(
      "href",
      "/templates",
    );
  });

  it.each(["/cv", "/proposal"])(
    "renders Templates between Projects and Settings on %s",
    (path) => {
      renderSidebar(path);

      expect(
        primaryNavItems().map((item) => item.getAttribute("aria-label")),
      ).toEqual([
        "Today",
        "Jobs",
        "CV",
        "Proposal",
        "Projects",
        "Templates",
        "Settings",
      ]);
    },
  );

  it("keeps Settings anchored at the bottom of the rail", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: "Settings" })).toHaveClass(
      "sb-rail-button--bottom",
    );
  });

  it("does not render expanded sidebar controls or legacy expanded content", () => {
    renderSidebar();

    expect(
      screen.queryByRole("button", { name: /open sidebar|close sidebar/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("Library")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();
  });

  it.each([
    ["/dashboard", "Today"],
    ["/jobs", "Jobs"],
    ["/cv", "CV"],
    ["/proposal", "Proposal"],
    ["/documents", "Projects"],
    ["/templates", "Templates"],
    ["/settings", "Settings"],
  ])("marks %s as the current route", (path, label) => {
    renderSidebar(path);

    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("links Projects to the documents surface", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "/documents",
    );
  });

  it("opens the CV template panel without navigating", () => {
    const onSelect = vi.fn();
    renderSidebar("/cv", <RegisterTemplates surface="cv" onSelect={onSelect} />);

    const templates = screen.getByRole("button", { name: "Templates" });
    expect(templates).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(templates);

    expect(templates).toHaveAttribute("aria-expanded", "true");
    expect(templates).toHaveClass("sb-rail-button--panel-open");
    expect(screen.getByRole("link", { name: "CV" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("complementary", { name: "CV templates" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cv");

    fireEvent.click(screen.getByRole("listitem", { name: "Schematic" }));
    expect(onSelect).toHaveBeenCalledWith("schematic");
  });

  it.each(["/dashboard", "/documents"])(
    "navigates Templates to the global templates page from %s",
    (path) => {
      renderSidebar(path);

      fireEvent.click(screen.getByRole("link", { name: "Templates" }));

      expect(screen.getByTestId("location")).toHaveTextContent("/templates");
    },
  );

  it("opens the proposal template panel without navigating", () => {
    const onSelect = vi.fn();
    renderSidebar(
      "/proposal",
      <RegisterTemplates surface="proposal" onSelect={onSelect} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Templates" }));

    expect(
      screen.getByRole("complementary", { name: "Proposal templates" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Proposal" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/proposal");
  });

  it("contextual panel browse action navigates to all templates", () => {
    renderSidebar("/proposal", <RegisterTemplates surface="proposal" onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Templates" }));
    fireEvent.click(screen.getByRole("button", { name: "Browse all templates" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/templates");
    expect(
      screen.queryByRole("complementary", { name: "Proposal templates" }),
    ).not.toBeInTheDocument();
  });
});
