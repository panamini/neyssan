import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { ForgeTemplatePanel } from "../ForgeTemplatePanel";
import { Sidebar } from "../Sidebar";
import {
  ForgeTemplatePanelProvider,
  useRegisterForgePanel,
  useRegisterForgeTemplates,
} from "../../contexts/ForgeTemplatePanelContext";

function LocationProbe(): JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
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
        footer: {
          label: "Open Library",
          onSelect: () => navigate("/documents?type=proposals"),
        },
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
        footer: {
          label: "Open Library",
          onSelect: () => navigate("/documents?type=proposals"),
        },
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
        footer: {
          label: "Open Library",
          onSelect: () => navigate("/documents?type=cvs"),
        },
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
        footer: {
          label: "Open Library",
          onSelect: () => navigate("/documents?type=proposals"),
        },
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
        footer: {
          label: "Open Library",
          onSelect: () => navigate("/documents?type=cvs"),
        },
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
  const mediaQueries: MediaQueryList[] = [];
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
    const mediaQuery = {
      matches:
        query === "(hover: hover) and (pointer: fine)"
          ? matches
          : query === "(max-width: 767px)"
            ? window.innerWidth <= 767
            : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
    mediaQueries.push(mediaQuery);
    return mediaQuery;
  });
  return mediaQueries;
}

describe("Sidebar permanent rail", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
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

    const items = primaryNavItems();
    expect(items.map((item) => item.getAttribute("aria-label"))).toEqual([
      "Today",
      "Jobs",
      "CV",
      "Letter",
      "Projects",
      "Templates",
      "Settings",
    ]);
    expect(
      items.every((item) => !item.hasAttribute("data-toolbar-tooltip")),
    ).toBe(true);
    expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute(
      "href",
      "/templates",
    );
  });

  it("keeps default English nav labels and route hrefs stable", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute(
      "href",
      "/jobs",
    );
    expect(screen.getByRole("link", { name: "CV" })).toHaveAttribute(
      "href",
      "/cv",
    );
    expect(screen.getByRole("link", { name: "Letter" })).toHaveAttribute(
      "href",
      "/proposal",
    );
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "/documents",
    );
    expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute(
      "href",
      "/templates",
    );
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("renders primary nav labels from the French UI locale", () => {
    window.localStorage.setItem("twoweeks:ui-language", "fr");
    window.localStorage.setItem("twoweeks:document-language", "ar");

    renderSidebar();

    expect(
      primaryNavItems().map((item) => item.getAttribute("aria-label")),
    ).toEqual([
      "Aujourd'hui",
      "Offres",
      "CV",
      "Lettre",
      "Projets",
      "Modèles",
      "Paramètres",
    ]);
    expect(screen.getByRole("link", { name: "Offres" })).toHaveAttribute(
      "href",
      "/jobs",
    );
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe(
      "ar",
    );
  });

  it("renders primary nav labels from the Spanish UI locale and keeps active state", () => {
    window.localStorage.setItem("twoweeks:ui-language", "es");

    renderSidebar("/jobs");

    expect(
      primaryNavItems().map((item) => item.getAttribute("aria-label")),
    ).toEqual([
      "Hoy",
      "Empleos",
      "CV",
      "Carta",
      "Proyectos",
      "Plantillas",
      "Ajustes",
    ]);
    expect(screen.getByRole("link", { name: "Empleos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Empleos" })).toHaveAttribute(
      "href",
      "/jobs",
    );
  });

  it("does not use document language storage as the nav locale", () => {
    window.localStorage.setItem("twoweeks:document-language", "fr");

    renderSidebar();

    expect(screen.getByRole("link", { name: "Today" })).toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:ui-language")).toBeNull();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe(
      "fr",
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
        "Letter",
        "Projects",
        "Templates",
        "Settings",
      ]);
    },
  );

  it("keeps Settings anchored at the bottom of the rail", () => {
    renderSidebar();

    expect(screen.getByRole("button", { name: "Settings" })).toHaveClass(
      "sb-rail-button--bottom",
    );
  });

  it("keeps the compact rail rendered and discoverable at 390px", () => {
    window.innerWidth = 390;
    mockFinePointer(true);

    const { container } = renderSidebar("/proposal");

    const sidebar = container.querySelector(".sb");
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveAttribute("data-rail-compact", "true");

    const items = primaryNavItems();
    expect(items.map((item) => item.getAttribute("aria-label"))).toEqual([
      "Today",
      "Jobs",
      "CV",
      "Letter",
      "Projects",
      "Templates",
      "Settings",
    ]);
    for (const item of items) {
      expect(item).toHaveAttribute("aria-label");
      expect(item).toHaveAttribute(
        "data-toolbar-tooltip",
        item.getAttribute("aria-label"),
      );
      expect(item).toHaveAttribute(
        "data-toolbar-tooltip-placement",
        "below",
      );
    }

    expect(screen.getByRole("button", { name: "Letter" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Settings" })).toHaveClass(
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
    ["/proposal", "Letter"],
    ["/documents", "Projects"],
    ["/templates", "Templates"],
    ["/settings", "Settings"],
  ])("marks %s as the current route", (path, label) => {
    renderSidebar(path);

    const currentItem =
      path === "/proposal" || path === "/cv" || path === "/settings"
        ? screen.getByRole("button", { name: label })
        : screen.getByRole("link", { name: label });
    expect(currentItem).toHaveAttribute("aria-current", "page");
  });

  it("opens Settings in the shared rail drawer and switches settings panes", async () => {
    renderSidebar("/dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/settings");
    await waitFor(() => {
      expect(
        screen.getByRole("complementary", { name: "Settings sections" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /Document style/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Document style/ }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/settings?tab=docstyle",
    );
    expect(screen.getByRole("button", { name: "Settings" })).toHaveClass(
      "sb-rail-button--panel-open",
    );
  });

  it("keeps the Settings drawer docked when the active Settings rail item is clicked again", async () => {
    renderSidebar("/settings");

    const settings = screen.getByRole("button", { name: "Settings" });
    fireEvent.click(settings);

    await waitFor(() => {
      expect(
        screen.getByRole("complementary", { name: "Settings sections" }),
      ).toHaveAttribute("data-mode", "docked");
    });

    fireEvent.click(settings);

    expect(
      screen.getByRole("complementary", { name: "Settings sections" }),
    ).toHaveAttribute("data-mode", "docked");
    expect(settings).toHaveClass("sb-rail-button--panel-open");
  });

  it("renders translated Settings drawer chrome in French", async () => {
    window.localStorage.setItem("twoweeks:ui-language", "fr");
    renderSidebar("/dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Paramètres" }));

    await waitFor(() => {
      expect(
        screen.getByRole("complementary", { name: "Sections des paramètres" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /Style du document/ }),
    ).toBeInTheDocument();
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
    renderSidebar(
      "/cv",
      <RegisterTemplates surface="cv" onSelect={onSelect} />,
    );

    const templates = screen.getByRole("button", { name: "Templates" });
    expect(templates).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(templates);

    expect(templates).toHaveAttribute("aria-expanded", "true");
    expect(templates).toHaveClass("sb-rail-button--panel-open");
    expect(screen.getByRole("button", { name: "CV" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("complementary", { name: "CV templates" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cv");

    fireEvent.click(screen.getByRole("listitem", { name: "Schematic" }));
    expect(onSelect).toHaveBeenCalledWith("schematic");
  });

  it("opens the CV Forge CV drawer without navigating and keeps Proposal as page navigation", () => {
    renderSidebar("/cv", <RegisterCvPanels />);

    const cv = screen.getByRole("button", { name: "CV" });

    fireEvent.click(cv);

    expect(
      screen.getByRole("complementary", { name: "CV library" }),
    ).toBeInTheDocument();
    expect(screen.getByText("CV library drawer content")).toBeInTheDocument();
    expect(cv).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("location")).toHaveTextContent("/cv");

    const proposal = screen.getByRole("link", { name: "Letter" });
    expect(proposal).toHaveAttribute("href", "/proposal");
    fireEvent.click(proposal);
    expect(screen.getByTestId("location")).toHaveTextContent("/proposal");
    expect(
      screen.queryByRole("complementary", { name: "CV library" }),
    ).not.toBeInTheDocument();
  });

  it("pins the active CV peek drawer from the active CV rail item", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/cv", <RegisterCvPanels />);

    const cv = screen.getByRole("button", { name: "CV" });
    expect(cv).toHaveAttribute("aria-current", "page");
    expect(cv).toHaveAttribute("aria-expanded", "false");

    fireEvent.pointerEnter(cv, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(
      screen.getByRole("complementary", { name: "CV library" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Collapse drawer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pin drawer" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cv");

    fireEvent.click(cv);

    expect(cv).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("complementary", { name: "CV library" }),
    ).toHaveAttribute("data-mode", "docked");
    expect(
      screen.queryByRole("button", { name: "Pin drawer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse drawer" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/cv");
  });

  it("keeps a direct CV rail click as overlay without requiring a second click", () => {
    mockFinePointer(true);
    renderSidebar("/cv", <RegisterCvPanels />);

    const cv = screen.getByRole("button", { name: "CV" });
    fireEvent.click(cv);
    expect(
      screen.getByRole("complementary", { name: "CV library" }),
    ).toHaveAttribute("data-mode", "overlay");
    expect(
      screen.getByRole("button", { name: "Pin drawer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse drawer" }),
    ).toBeInTheDocument();
  });

  it("keeps CV Forge Jobs as direct navigation and Projects as mixed library", () => {
    renderSidebar("/cv", <RegisterCvPanels />);

    fireEvent.click(screen.getByRole("link", { name: "Jobs" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/jobs");
  });

  it("opens the CV Forge mixed library drawer from Projects", () => {
    renderSidebar("/cv", <RegisterCvPanels />);

    fireEvent.click(screen.getByRole("button", { name: "Projects" }));

    expect(
      screen.getByRole("complementary", { name: "Library" }),
    ).toBeInTheDocument();
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

  it("returns to the last opened saved letter after navigating to another page", async () => {
    mockFinePointer(true);
    const savedLetterPath =
      "/proposal?view=saved&id=jn76drefbk099524d4cgjdm8x984tme3";
    renderSidebar(savedLetterPath, <RegisterProposalPanels />);

    await waitFor(() => {
      expect(window.sessionStorage.getItem("twoweeks:last-saved-proposal-path")).toBe(
        savedLetterPath,
      );
    });

    fireEvent.click(screen.getByRole("link", { name: "Templates" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/templates");

    fireEvent.click(screen.getByRole("link", { name: "Letter" }));
    expect(screen.getByTestId("location")).toHaveTextContent(savedLetterPath);
  });

  it("opens the proposal template panel from hover and navigates on click", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    const onSelect = vi.fn();
    renderSidebar(
      "/proposal",
      <RegisterTemplates surface="proposal" onSelect={onSelect} />,
    );

    const templates = screen.getByRole("link", { name: "Templates" });
    fireEvent.pointerEnter(templates, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(
      screen.getByRole("complementary", { name: "Proposal templates" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Letter" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/proposal");

    fireEvent.click(templates);
    expect(screen.getByTestId("location")).toHaveTextContent("/templates");
  });

  it("keeps route-active and drawer-open rail states separate on Proposal Forge", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    const proposal = screen.getByRole("button", { name: "Letter" });
    const cv = screen.getByRole("link", { name: "CV" });

    expect(proposal).toHaveAttribute("aria-current", "page");
    expect(proposal).toHaveClass("sb-rail-button--route-active");
    expect(cv).not.toHaveAttribute("aria-current");

    fireEvent.pointerEnter(cv, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(proposal).toHaveAttribute("aria-current", "page");
    expect(proposal).toHaveClass("sb-rail-button--route-active");
    expect(cv).not.toHaveAttribute("aria-current");
    expect(cv).toHaveClass("sb-rail-button--panel-open");
    expect(screen.getByTestId("location")).toHaveTextContent("/proposal");
  });

  it.each([
    ["Jobs", "/jobs"],
    ["CV", "/cv"],
    ["Projects", "/documents"],
    ["Templates", "/templates"],
  ])(
    "navigates from Proposal Forge to %s on desktop click",
    (railLabel, route) => {
      mockFinePointer(true);
      renderSidebar(
        "/proposal",
        <>
          <RegisterProposalPanels />
          <RegisterTemplates surface="proposal" onSelect={vi.fn()} />
        </>,
      );

      fireEvent.click(screen.getByRole("link", { name: railLabel }));

      expect(screen.getByTestId("location")).toHaveTextContent(route);
    },
  );

  it("opens the saved proposals drawer as overlay from Proposal click on Proposal Forge", () => {
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    fireEvent.click(screen.getByRole("button", { name: "Letter" }));

    expect(
      screen.getByRole("complementary", { name: "Saved proposals" }),
    ).toHaveAttribute("data-mode", "overlay");
    expect(
      screen.getByRole("button", { name: "Collapse drawer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pin drawer" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/proposal");
  });

  it("pins the saved proposals peek drawer from Proposal rail click", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    const proposal = screen.getByRole("button", { name: "Letter" });
    fireEvent.pointerEnter(proposal, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(
      screen.getByRole("complementary", { name: "Saved proposals" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pin drawer" }),
    ).toBeInTheDocument();

    fireEvent.click(proposal);

    expect(
      screen.getByRole("complementary", { name: "Saved proposals" }),
    ).toHaveAttribute("data-mode", "docked");
    expect(
      screen.queryByRole("button", { name: "Pin drawer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse drawer" }),
    ).toBeInTheDocument();
  });

  it("opens proposal drawers from rail hover on fine pointer devices", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    fireEvent.pointerEnter(screen.getByLabelText("Jobs"), {
      pointerType: "mouse",
    });

    expect(
      screen.queryByRole("complementary", { name: "Attach job" }),
    ).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(
      screen.getByRole("complementary", { name: "Attach job" }),
    ).toBeInTheDocument();
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

    fireEvent.pointerEnter(screen.getByLabelText(railLabel), {
      pointerType: "mouse",
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(
      screen.getByRole("complementary", { name: drawerLabel }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/proposal");
  });

  it("does not show the collapse handle for hover peek drawers", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    fireEvent.pointerEnter(screen.getByLabelText("CV"), {
      pointerType: "mouse",
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(
      screen.getByRole("complementary", { name: "Attach CV" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Collapse drawer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pin drawer" }),
    ).toBeInTheDocument();
  });

  it("switches to pinned drawer chrome without physical reflow when the viewport is narrow", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    window.innerWidth = 900;
    renderSidebar("/proposal", <RegisterProposalPanels />);

    fireEvent.pointerEnter(screen.getByLabelText("CV"), {
      pointerType: "mouse",
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(
      screen.getByRole("complementary", { name: "Attach CV" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pin drawer" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pin drawer" }));

    expect(
      screen.getByRole("complementary", { name: "Attach CV" }),
    ).toHaveAttribute("data-mode", "docked");
    expect(
      screen.queryByRole("button", { name: "Pin drawer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse drawer" }),
    ).toBeInTheDocument();
  });

  it("docks a peek drawer from the drawer pin action when width supports it", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    const cv = screen.getByRole("link", { name: "CV" });

    fireEvent.pointerEnter(cv, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(
      screen.getByRole("complementary", { name: "Attach CV" }),
    ).toBeInTheDocument();
    expect(cv).toHaveClass("sb-rail-button--panel-open");

    fireEvent.click(screen.getByRole("button", { name: "Pin drawer" }));
    expect(
      screen.getByRole("complementary", { name: "Attach CV" }),
    ).toHaveAttribute("data-mode", "docked");
    expect(
      screen.getByRole("button", { name: "Collapse drawer" }),
    ).toBeInTheDocument();

    fireEvent.pointerLeave(cv, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(
      screen.getByRole("complementary", { name: "Attach CV" }),
    ).toBeInTheDocument();
  });

  it("closes an unpinned hover CV drawer when leaving the rail trigger", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    const cv = screen.getByRole("link", { name: "CV" });
    fireEvent.pointerEnter(cv, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(
      screen.getByRole("complementary", { name: "Attach CV" }),
    ).toBeInTheDocument();

    fireEvent.pointerLeave(cv, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(360);
    });

    expect(
      screen.queryByRole("complementary", { name: "Attach CV" }),
    ).not.toBeInTheDocument();
  });

  it("does not flicker closed immediately after leaving a hover trigger", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    const cv = screen.getByRole("link", { name: "CV" });
    fireEvent.pointerEnter(cv, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(
      screen.getByRole("complementary", { name: "Attach CV" }),
    ).toBeInTheDocument();

    fireEvent.pointerLeave(cv, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(
      screen.getByRole("complementary", { name: "Attach CV" }),
    ).toBeInTheDocument();
  });

  it("keeps a docked drawer stable across other hovers", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    const jobs = screen.getByRole("link", { name: "Jobs" });
    const cv = screen.getByRole("link", { name: "CV" });

    fireEvent.pointerEnter(jobs, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(
      screen.getByRole("complementary", { name: "Attach job" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pin drawer" }));
    expect(jobs).toHaveClass("sb-rail-button--panel-open");

    fireEvent.pointerEnter(cv, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(
      screen.getByRole("complementary", { name: "Attach job" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "Attach CV" }),
    ).not.toBeInTheDocument();
  });

  it("closes docked drawers from the collapse handle", () => {
    renderSidebar("/proposal", <RegisterProposalPanels />);

    fireEvent.click(screen.getByRole("button", { name: "Jobs" }));
    expect(
      screen.getByRole("complementary", { name: "Attach job" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pin drawer" }));
    expect(
      screen.getByRole("button", { name: "Collapse drawer" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse drawer" }));

    expect(
      screen.queryByRole("complementary", { name: "Attach job" }),
    ).not.toBeInTheDocument();
  });

  it("keeps hover-open drawers persistent while moving from rail into panel", () => {
    vi.useFakeTimers();
    mockFinePointer(true);
    renderSidebar("/proposal", <RegisterProposalPanels />);

    const jobs = screen.getByRole("link", { name: "Jobs" });
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

    expect(
      screen.getByRole("complementary", { name: "Attach job" }),
    ).toBeInTheDocument();
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

    expect(
      screen.queryByRole("complementary", { name: "Attach job" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Jobs" }));
    expect(
      screen.getByRole("complementary", { name: "Attach job" }),
    ).toBeInTheDocument();
  });

  it("closes contextual drawers with Escape", () => {
    renderSidebar("/proposal", <RegisterProposalPanels />);

    fireEvent.click(screen.getByRole("button", { name: "Jobs" }));
    expect(
      screen.getByRole("complementary", { name: "Attach job" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("complementary", { name: "Attach job" }),
    ).not.toBeInTheDocument();
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
    [
      "Letter",
      "Saved proposals",
      "Open Library",
      "/documents?type=proposals",
    ],
    ["Projects", "Library", "Open Library", "/documents?type=proposals"],
  ])(
    "uses explicit full-page header route from proposal %s drawer",
    (railLabel, drawerLabel, browseLabel, route) => {
      renderSidebar("/proposal", <RegisterProposalPanels />);

      fireEvent.click(screen.getByRole("button", { name: railLabel }));
      expect(
        screen.getByRole("complementary", { name: drawerLabel }),
      ).toBeInTheDocument();

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

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/documents?type=cvs",
    );
  });

  it("contextual panel browse action navigates to all templates", () => {
    renderSidebar(
      "/proposal",
      <RegisterTemplates surface="proposal" onSelect={vi.fn()} />,
    );

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
