import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ForgeTemplatePanel } from "../ForgeTemplatePanel";
import { Sidebar } from "../Sidebar";
import {
  ForgeTemplatePanelProvider,
  useRegisterForgePanel,
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

function RegisterProposalPanels(): null {
  const navigate = useNavigate();
  useRegisterForgePanel(
    React.useMemo(
      () => ({
        surface: "jobs",
        title: "Attach job",
        subtitle: "Select a captured job.",
        renderContent: () => <div>Job drawer content</div>,
        footer: { label: "Open Jobs page", onSelect: () => navigate("/jobs") },
      }),
      [],
    ),
  );
  useRegisterForgePanel(
    React.useMemo(
      () => ({
        surface: "cvs",
        title: "Attach CV",
        subtitle: "Attach a CV.",
        renderContent: () => <div>CV drawer content</div>,
        footer: { label: "Open CV Forge", onSelect: () => navigate("/cv") },
      }),
      [],
    ),
  );
  useRegisterForgePanel(
    React.useMemo(
      () => ({
        surface: "documents",
        title: "Library",
        subtitle: "Use saved work.",
        renderContent: () => <div>Library drawer content</div>,
        footer: { label: "Open Library", onSelect: () => navigate("/documents?type=proposals") },
      }),
      [],
    ),
  );
  useRegisterForgePanel(
    React.useMemo(
      () => ({
        surface: "proposals",
        title: "Saved proposals",
        subtitle: "Use a saved letter.",
        renderContent: () => <div>Saved proposals drawer content</div>,
        footer: { label: "Open Library", onSelect: () => navigate("/documents?type=proposals") },
      }),
      [],
    ),
  );
  return null;
}

function RegisterCvPanels(): null {
  const navigate = useNavigate();
  useRegisterForgePanel(
    React.useMemo(
      () => ({
        surface: "cvs",
        title: "CV library",
        renderContent: () => <div>CV library drawer content</div>,
        footer: { label: "Open Library", onSelect: () => navigate("/documents?type=cvs") },
      }),
      [],
    ),
  );
  useRegisterForgePanel(
    React.useMemo(
      () => ({
        surface: "proposals",
        title: "Saved proposals",
        renderContent: () => <div>Saved proposals drawer content</div>,
        footer: { label: "Open Library", onSelect: () => navigate("/documents?type=proposals") },
      }),
      [],
    ),
  );
  useRegisterForgePanel(
    React.useMemo(
      () => ({
        surface: "documents",
        title: "Library",
        renderContent: () => <div>Library drawer content</div>,
        footer: { label: "Open Library", onSelect: () => navigate("/documents?type=cvs") },
      }),
      [],
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

function mockFinePointer(matches = true) {
  const mediaQuery = {
    matches,
    media: "(hover: hover) and (pointer: fine)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
  vi.spyOn(window, "matchMedia").mockReturnValue(mediaQuery);
  return mediaQuery;
}

describe("Sidebar permanent rail", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

    const currentItem =
      path === "/proposal" || path === "/cv"
        ? screen.getByRole("button", { name: label })
        : screen.getByRole("link", { name: label });
    expect(currentItem).toHaveAttribute(
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
    expect(screen.getByRole("button", { name: "CV" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("complementary", { name: "CV templates" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cv");

    fireEvent.click(screen.getByRole("listitem", { name: "Schematic" }));
    expect(onSelect).toHaveBeenCalledWith("schematic");
  });

  it("opens the CV Forge CV drawer without navigating and keeps Proposal as page navigation", () => {
    renderSidebar("/cv", <RegisterCvPanels />);

    const cv = screen.getByRole("button", { name: "CV" });

    fireEvent.click(cv);

    expect(screen.getByRole("complementary", { name: "CV library" })).toBeInTheDocument();
    expect(screen.getByText("CV library drawer content")).toBeInTheDocument();
    expect(cv).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("location")).toHaveTextContent("/cv");

    const proposal = screen.getByRole("link", { name: "Proposal" });
    expect(proposal).toHaveAttribute("href", "/proposal");
    fireEvent.click(proposal);
    expect(screen.getByTestId("location")).toHaveTextContent("/proposal");
    expect(screen.queryByRole("complementary", { name: "CV library" })).not.toBeInTheDocument();
  });

  it("keeps CV Forge Jobs as direct navigation and Projects as mixed library", () => {
    renderSidebar("/cv", <RegisterCvPanels />);

    fireEvent.click(screen.getByRole("link", { name: "Jobs" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/jobs");
  });

  it("opens the CV Forge mixed library drawer from Projects", () => {
    renderSidebar("/cv", <RegisterCvPanels />);

    fireEvent.click(screen.getByRole("button", { name: "Projects" }));

    expect(screen.getByRole("complementary", { name: "Library" })).toBeInTheDocument();
    expect(screen.getByText("Library drawer content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CV" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/cv");
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
    expect(screen.getByRole("button", { name: "Proposal" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/proposal");
  });

  it("keeps route-active and drawer-open rail states separate on Proposal Forge", () => {
    renderSidebar("/proposal", <RegisterProposalPanels />);

    const proposal = screen.getByRole("button", { name: "Proposal" });
    const cv = screen.getByRole("button", { name: "CV" });

    expect(proposal).toHaveAttribute("aria-current", "page");
    expect(proposal).toHaveClass("sb-rail-button--route-active");
    expect(cv).not.toHaveAttribute("aria-current");

    fireEvent.click(cv);

    expect(proposal).toHaveAttribute("aria-current", "page");
    expect(proposal).toHaveClass("sb-rail-button--route-active");
    expect(cv).not.toHaveAttribute("aria-current");
    expect(cv).toHaveClass("sb-rail-button--panel-open");
    expect(screen.getByTestId("location")).toHaveTextContent("/proposal");
  });

  it.each([
    ["Jobs", "Attach job", "Job drawer content"],
    ["CV", "Attach CV", "CV drawer content"],
    ["Proposal", "Saved proposals", "Saved proposals drawer content"],
    ["Projects", "Library", "Library drawer content"],
  ])(
    "opens the proposal %s rail drawer without navigating",
    (railLabel, drawerLabel, drawerContent) => {
      renderSidebar("/proposal", <RegisterProposalPanels />);

      fireEvent.click(screen.getByRole("button", { name: railLabel }));

      expect(
        screen.getByRole("complementary", { name: drawerLabel }),
      ).toBeInTheDocument();
      expect(screen.getByText(drawerContent)).toBeInTheDocument();
      expect(screen.getByTestId("location")).toHaveTextContent("/proposal");
    },
  );

  it("opens proposal drawers from rail hover on fine pointer devices", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Jobs" }), {
      pointerType: "mouse",
    });

    expect(screen.queryByRole("complementary", { name: "Attach job" })).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByRole("complementary", { name: "Attach job" })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/proposal");
  });

  it.each([
    ["CV", "Attach CV"],
    ["Jobs", "Attach job"],
    ["Projects", "Library"],
    ["Templates", "Proposal templates"],
  ])("opens the %s drawer from desktop hover", (railLabel, drawerLabel) => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar(
      "/proposal",
      <>
        <RegisterProposalPanels />
        <RegisterTemplates surface="proposal" onSelect={vi.fn()} />
      </>,
    );

    fireEvent.pointerEnter(screen.getByRole("button", { name: railLabel }), {
      pointerType: "mouse",
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByRole("complementary", { name: drawerLabel })).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/proposal");
  });

  it("does not show the collapse handle for hover peek drawers", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    fireEvent.pointerEnter(screen.getByRole("button", { name: "CV" }), {
      pointerType: "mouse",
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.getByRole("complementary", { name: "Attach CV" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Collapse drawer" })).not.toBeInTheDocument();
  });

  it("pins the CV drawer from click and unpins the same CV rail item", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    const cv = screen.getByRole("button", { name: "CV" });

    fireEvent.click(cv);
    expect(screen.getByRole("complementary", { name: "Attach CV" })).toBeInTheDocument();
    expect(cv).toHaveClass("sb-rail-button--panel-open");

    fireEvent.click(cv);
    expect(screen.getByRole("complementary", { name: "Attach CV" })).toBeInTheDocument();

    fireEvent.pointerLeave(cv, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(screen.queryByRole("complementary", { name: "Attach CV" })).not.toBeInTheDocument();
  });

  it("closes an unpinned hover CV drawer when leaving the rail trigger", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    const cv = screen.getByRole("button", { name: "CV" });
    fireEvent.pointerEnter(cv, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByRole("complementary", { name: "Attach CV" })).toBeInTheDocument();

    fireEvent.pointerLeave(cv, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(screen.queryByRole("complementary", { name: "Attach CV" })).not.toBeInTheDocument();
  });

  it("pins drawers on rail click and keeps the pinned drawer stable across other hovers", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    const jobs = screen.getByRole("button", { name: "Jobs" });
    const cv = screen.getByRole("button", { name: "CV" });

    fireEvent.click(jobs);
    expect(screen.getByRole("complementary", { name: "Attach job" })).toBeInTheDocument();
    expect(jobs).toHaveClass("sb-rail-button--panel-open");

    fireEvent.pointerEnter(cv, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole("complementary", { name: "Attach job" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Attach CV" })).not.toBeInTheDocument();
  });

  it("unpins a clicked drawer and closes it after hover leaves", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    const jobs = screen.getByRole("button", { name: "Jobs" });

    fireEvent.click(jobs);
    expect(screen.getByRole("complementary", { name: "Attach job" })).toBeInTheDocument();

    fireEvent.click(jobs);
    expect(screen.getByRole("complementary", { name: "Attach job" })).toBeInTheDocument();

    fireEvent.pointerLeave(jobs, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(screen.queryByRole("complementary", { name: "Attach job" })).not.toBeInTheDocument();
  });

  it("closes and unpins drawers from the collapse handle", () => {
    renderSidebar("/proposal", <RegisterProposalPanels />);

    fireEvent.click(screen.getByRole("button", { name: "Jobs" }));
    expect(screen.getByRole("complementary", { name: "Attach job" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse drawer" }));

    expect(screen.queryByRole("complementary", { name: "Attach job" })).not.toBeInTheDocument();
  });

  it("keeps hover-open drawers persistent while moving from rail into panel", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    const jobs = screen.getByRole("button", { name: "Jobs" });
    fireEvent.pointerEnter(jobs, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    const drawer = screen.getByRole("complementary", { name: "Attach job" });
    fireEvent.pointerLeave(jobs, { pointerType: "mouse" });
    fireEvent.pointerEnter(drawer, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(screen.getByRole("complementary", { name: "Attach job" })).toBeInTheDocument();
  });

  it("does not open contextual drawers from hover on touch pointer devices", () => {
    vi.useFakeTimers();
    mockFinePointer(false);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    fireEvent.pointerEnter(screen.getByRole("button", { name: "Jobs" }), {
      pointerType: "touch",
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByRole("complementary", { name: "Attach job" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Jobs" }));
    expect(screen.getByRole("complementary", { name: "Attach job" })).toBeInTheDocument();
  });

  it("closes contextual drawers with Escape", () => {
    renderSidebar("/proposal", <RegisterProposalPanels />);

    fireEvent.click(screen.getByRole("button", { name: "Jobs" }));
    expect(screen.getByRole("complementary", { name: "Attach job" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("complementary", { name: "Attach job" })).not.toBeInTheDocument();
  });

  it("keeps Jobs as normal navigation from CV Forge", () => {
    renderSidebar("/cv", <RegisterTemplates surface="cv" onSelect={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute(
      "href",
      "/jobs",
    );
  });

  it("opens the mixed library drawer from Projects on CV Forge", () => {
    renderSidebar("/cv", <RegisterCvPanels />);

    fireEvent.click(screen.getByRole("button", { name: "Projects" }));

    expect(
      screen.getByRole("complementary", { name: "Library" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Library drawer content")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cv");
  });

  it.each([
    ["Jobs", "Attach job", "Open Jobs page", "/jobs"],
    ["CV", "Attach CV", "Open CV Forge", "/cv"],
    ["Proposal", "Saved proposals", "Open Library", "/documents?type=proposals"],
    ["Projects", "Library", "Open Library", "/documents?type=proposals"],
  ])(
    "uses explicit full-page header route from proposal %s drawer",
    (railLabel, drawerLabel, browseLabel, route) => {
      renderSidebar("/proposal", <RegisterProposalPanels />);

      fireEvent.click(screen.getByRole("button", { name: railLabel }));
      expect(screen.getByRole("complementary", { name: drawerLabel })).toBeInTheDocument();

      const headerAction = screen.getByRole("button", { name: browseLabel });
      expect(headerAction.querySelector("svg")).toBeTruthy();
      fireEvent.click(headerAction);

      expect(screen.getByTestId("location")).toHaveTextContent(route);
    },
  );

  it("uses canonical documents browse route from the CV Forge library drawer", () => {
    renderSidebar("/cv", <RegisterCvPanels />);

    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Library" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/documents?type=cvs");
  });

  it("contextual panel browse action navigates to all templates", () => {
    renderSidebar("/proposal", <RegisterTemplates surface="proposal" onSelect={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Templates" }));
    const headerAction = screen.getByRole("button", { name: "Open Templates" });
    expect(headerAction.querySelector("svg")).toBeTruthy();
    fireEvent.click(headerAction);

    expect(screen.getByTestId("location")).toHaveTextContent("/templates");
    expect(
      screen.queryByRole("complementary", { name: "Proposal templates" }),
    ).not.toBeInTheDocument();
  });
});
