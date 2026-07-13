import React from "react";
import clsx from "clsx";
import {
  Briefcase,
  CalendarDots,
  FileText,
  FileUser,
  FolderOpen,
  FolderSimple,
  Gear,
  Layout,
  type IconProps,
} from "@/lib/icons";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  type ForgeRailSurface,
  type ForgeTemplateSurface,
  useRegisterForgePanel,
  useForgeTemplatePanel,
} from "../contexts/ForgeTemplatePanelContext";
import {
  SETTINGS_TABS,
  getSettingsTabPath,
  normalizeSettingsTab,
  type SettingsTab,
} from "../lib/settings-tabs";
import { translateUi, type UiMessageKey } from "../lib/i18n";
import { useUiLanguagePreference } from "../lib/ui-preferences";
import { createProposalTemplateGalleryState } from "../lib/proposal-workspace-state";

const COMPACT_RAIL_WIDTH = 768;
const LAST_SAVED_PROPOSAL_PATH_KEY = "twoweeks:last-saved-proposal-path";

function getSavedProposalPath(pathname: string, search: string): string | null {
  if (pathname !== "/proposal") return null;

  const searchParams = new URLSearchParams(search);
  const proposalId = searchParams.get("id")?.trim();
  if (searchParams.get("view") !== "saved" || !proposalId) return null;

  const savedProposalParams = new URLSearchParams({
    view: "saved",
    id: proposalId,
  });
  return `/proposal?${savedProposalParams.toString()}`;
}

function readLastSavedProposalPath(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const storedPath = window.sessionStorage.getItem(
      LAST_SAVED_PROPOSAL_PATH_KEY,
    );
    if (!storedPath) return null;

    const storedUrl = new URL(storedPath, window.location.origin);
    if (storedUrl.origin !== window.location.origin) return null;

    return getSavedProposalPath(storedUrl.pathname, storedUrl.search);
  } catch {
    return null;
  }
}

const SETTINGS_DRAWER_GROUPS: Array<{
  labelKey: UiMessageKey;
  tabs: SettingsTab[];
}> = [
  { labelKey: "settings.drawer.group.account", tabs: ["account", "team", "danger"] },
  {
    labelKey: "settings.drawer.group.defaults",
    tabs: ["theme", "language", "docstyle", "voice"],
  },
  { labelKey: "settings.drawer.group.payment", tabs: ["billing"] },
];

const NAV_MESSAGE_KEYS = {
  today: "nav.today",
  jobs: "nav.jobs",
  cv: "nav.cv",
  proposal: "nav.proposal",
  projects: "nav.projects",
  templates: "nav.templates",
  settings: "nav.settings",
} as const satisfies Record<string, UiMessageKey>;

type RailIconComponent = React.ComponentType<IconProps>;

type SidebarRailLinkProps = {
  label: string;
  icon: RailIconComponent;
  activeIcon?: RailIconComponent;
  href: string;
  active: boolean;
  panelOpen?: boolean;
  expanded?: boolean;
  hoverEnabled?: boolean;
  compact?: boolean;
  className?: string;
  state?: Record<string, string>;
  onClick?: () => void;
  onHoverIntent?: () => void;
  onHoverLeave?: () => void;
  onFocusOpen?: () => void;
};

type SidebarRailButtonProps = {
  label: string;
  icon: RailIconComponent;
  activeIcon?: RailIconComponent;
  panelOpen: boolean;
  expanded: boolean;
  active?: boolean;
  hoverEnabled?: boolean;
  compact: boolean;
  className?: string;
  onClick: () => void;
  onHoverIntent?: () => void;
  onHoverLeave?: () => void;
  onFocusOpen?: () => void;
};

function isRouteActive(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function SidebarRailIcon({
  icon: Icon,
  activeIcon: ActiveIcon,
}: {
  icon: RailIconComponent;
  activeIcon?: RailIconComponent;
}): JSX.Element {
  const FillIcon = ActiveIcon ?? Icon;

  return (
    <span className="sb-rail-button__icon" aria-hidden="true">
      <Icon
        className="sb-rail-button__glyph sb-rail-button__glyph--regular"
        size={20}
        weight="regular"
      />
      <FillIcon
        className="sb-rail-button__glyph sb-rail-button__glyph--fill"
        size={20}
        weight="fill"
      />
    </span>
  );
}

function SidebarRailLink({
  label,
  icon,
  activeIcon,
  href,
  active,
  panelOpen = false,
  expanded,
  hoverEnabled = true,
  compact = false,
  className,
  state,
  onClick,
  onHoverIntent,
  onHoverLeave,
  onFocusOpen,
}: SidebarRailLinkProps): JSX.Element {
  return (
    <Link
      to={href}
      state={state}
      className={clsx(
        "sb-rail-button",
        active && "sb-rail-button--route-active",
        active && "sb-rail-button--active",
        panelOpen && "sb-rail-button--panel-open",
        className,
      )}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      aria-expanded={expanded}
      data-toolbar-tooltip={compact ? label : undefined}
      data-toolbar-tooltip-placement={compact ? "below" : undefined}
      onClick={onClick}
      onFocus={onFocusOpen}
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") return;
        if (!hoverEnabled && event.pointerType !== "mouse") return;
        onHoverIntent?.();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "touch") return;
        if (!hoverEnabled && event.pointerType !== "mouse") return;
        onHoverLeave?.();
      }}
    >
      <SidebarRailIcon icon={icon} activeIcon={activeIcon} />
      <span className="sb-rail-button__label">{label}</span>
    </Link>
  );
}

function SidebarRailButton({
  label,
  icon,
  activeIcon,
  panelOpen,
  expanded,
  active = false,
  hoverEnabled = true,
  compact,
  className,
  onClick,
  onHoverIntent,
  onHoverLeave,
  onFocusOpen,
}: SidebarRailButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={clsx(
        "sb-rail-button",
        active && "sb-rail-button--route-active",
        active && "sb-rail-button--active",
        panelOpen && "sb-rail-button--panel-open",
        className,
      )}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      aria-expanded={expanded}
      data-toolbar-tooltip={compact ? label : undefined}
      data-toolbar-tooltip-placement={compact ? "below" : undefined}
      onClick={onClick}
      onFocus={onFocusOpen}
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") return;
        if (!hoverEnabled && event.pointerType !== "mouse") return;
        onHoverIntent?.();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "touch") return;
        if (!hoverEnabled && event.pointerType !== "mouse") return;
        onHoverLeave?.();
      }}
    >
      <SidebarRailIcon icon={icon} activeIcon={activeIcon} />
      <span className="sb-rail-button__label">{label}</span>
    </button>
  );
}

function SettingsDrawerContent({
  activeTab,
  labelFor,
  onSelectTab,
}: {
  activeTab: string;
  labelFor: (key: UiMessageKey) => string;
  onSelectTab: (tabId: (typeof SETTINGS_TABS)[number]["id"]) => void;
}): JSX.Element {
  return (
    <div className="forge-rail-drawer forge-rail-drawer--settings">
      <div className="forge-rail-drawer__list" role="list">
        {SETTINGS_DRAWER_GROUPS.map((group) => (
          <React.Fragment key={group.labelKey}>
            <div className="forge-rail-drawer__category-label">
              {labelFor(group.labelKey)}
            </div>
            {group.tabs.map((tabId) => {
              const tab = SETTINGS_TABS.find(
                (candidate) => candidate.id === tabId,
              );
              if (!tab) return null;
              const active = activeTab === tab.id;
              return (
                <article
                  key={tab.id}
                  className="forge-rail-drawer__row"
                  data-state={active ? "current" : undefined}
                  role="listitem"
                >
                  <button
                    type="button"
                    className="forge-rail-drawer__row-main"
                    aria-current={active ? "page" : undefined}
                    onClick={() => onSelectTab(tab.id)}
                  >
                    <strong>{labelFor(tab.labelKey)}</strong>
                    <span>{labelFor(tab.descriptionKey)}</span>
                  </button>
                </article>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentSavedProposalPath = React.useMemo(
    () => getSavedProposalPath(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const [lastSavedProposalPath, setLastSavedProposalPath] = React.useState(
    () => currentSavedProposalPath ?? readLastSavedProposalPath(),
  );
  const { resolvedLanguage } = useUiLanguagePreference();
  const navLabel = React.useCallback(
    (key: UiMessageKey) => translateUi(resolvedLanguage, key),
    [resolvedLanguage],
  );
  const {
    activeSurface: activeTemplateSurface,
    open: templatePanelOpen,
    openMode: templatePanelOpenMode,
    openSurface: openTemplateSurface,
    closePanel,
    queueOpenSurface,
    queueClosePanel,
  } = useForgeTemplatePanel();
  const activeSettingsTab = normalizeSettingsTab(
    new URLSearchParams(location.search).get("tab"),
  );
  const proposalTemplateGalleryState = React.useMemo(
    () =>
      createProposalTemplateGalleryState(
        location.pathname,
        location.search,
      ),
    [location.pathname, location.search],
  );
  const settingsSectionsLabel = navLabel("settings.drawer.sections");
  useRegisterForgePanel(
    React.useMemo(
      () => ({
        surface: "settings" as const,
        title: "",
        ariaLabel: settingsSectionsLabel,
        renderContent: () => (
          <SettingsDrawerContent
            activeTab={activeSettingsTab}
            labelFor={navLabel}
            onSelectTab={(tabId) => {
              navigate(getSettingsTabPath(tabId));
            }}
          />
        ),
      }),
      [activeSettingsTab, navigate, settingsSectionsLabel, navLabel],
    ),
  );
  const [finePointer, setFinePointer] = React.useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(hover: hover) and (pointer: fine)").matches
      : false,
  );
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );
  const pendingSettingsPanelOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (currentSavedProposalPath) {
      setLastSavedProposalPath(currentSavedProposalPath);
      try {
        window.sessionStorage.setItem(
          LAST_SAVED_PROPOSAL_PATH_KEY,
          currentSavedProposalPath,
        );
      } catch {
        // Navigation continuity is best effort when browser storage is unavailable.
      }
      return;
    }

    if (location.pathname !== "/proposal") return;

    const params = new URLSearchParams(location.search);
    if (params.get("view") !== "saved" || params.get("id")?.trim()) return;

    setLastSavedProposalPath(null);
    try {
      window.sessionStorage.removeItem(LAST_SAVED_PROPOSAL_PATH_KEY);
    } catch {
      // Navigation continuity is best effort when browser storage is unavailable.
    }
  }, [currentSavedProposalPath, location.pathname, location.search]);

  React.useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  React.useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const handleChange = () => {
      setFinePointer(mediaQuery.matches);
    };
    handleChange();
    mediaQuery.addEventListener?.("change", handleChange);
    return () => {
      mediaQuery.removeEventListener?.("change", handleChange);
    };
  }, []);

  const { pathname } = location;
  const dashboardActive =
    pathname === "/" || isRouteActive(pathname, "/dashboard");
  const jobsActive = isRouteActive(pathname, "/jobs");
  const cvActive =
    isRouteActive(pathname, "/cv") || isRouteActive(pathname, "/cvs");
  const proposalActive =
    isRouteActive(pathname, "/proposal") ||
    isRouteActive(pathname, "/proposals");
  const projectsActive = isRouteActive(pathname, "/documents");
  const templatesActive = isRouteActive(pathname, "/templates");
  const settingsActive = isRouteActive(pathname, "/settings");
  const activeForgeSurface: ForgeTemplateSurface | null = cvActive
    ? "cv"
    : proposalActive
      ? "proposal"
      : null;
  const proposalContextualRail = pathname === "/proposal";
  const cvContextualRail = pathname === "/cv";
  const templatesOpen =
    Boolean(activeForgeSurface) &&
    templatePanelOpen &&
    activeTemplateSurface === activeForgeSurface;
  const panelOpenFor = (surface: ForgeRailSurface) =>
    templatePanelOpen && activeTemplateSurface === surface;

  React.useEffect(() => {
    if (!settingsActive || !pendingSettingsPanelOpenRef.current) {
      return;
    }
    pendingSettingsPanelOpenRef.current = false;
    const timer = window.setTimeout(() => {
      openTemplateSurface("settings");
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [openTemplateSurface, settingsActive]);

  const compactRail = viewportWidth < COMPACT_RAIL_WIDTH;

  const openOrDockPanel = (surface: ForgeRailSurface) => {
    if (
      templatePanelOpen &&
      activeTemplateSurface === surface &&
      templatePanelOpenMode === "peek"
    ) {
      openTemplateSurface(surface, { mode: "docked" });
      return;
    }

    if (
      templatePanelOpen &&
      activeTemplateSurface === surface &&
      templatePanelOpenMode === "docked"
    ) {
      if (finePointer) {
        openTemplateSurface(surface, { mode: "peek" });
      } else {
        closePanel();
      }
      return;
    }

    openTemplateSurface(surface);
  };

  const handleOpenTemplates = () => {
    if (!activeForgeSurface) {
      return;
    }
    openOrDockPanel(activeForgeSurface);
  };

  const handleOpenProposalPanel = (surface: ForgeRailSurface) => {
    openOrDockPanel(surface);
  };

  const handleOpenSettingsPanel = () => {
    if (!settingsActive) {
      pendingSettingsPanelOpenRef.current = true;
      navigate(getSettingsTabPath(activeSettingsTab));
      return;
    }

    if (
      templatePanelOpen &&
      activeTemplateSurface === "settings" &&
      templatePanelOpenMode === "docked"
    ) {
      return;
    }

    openTemplateSurface("settings", { mode: "docked" });
  };

  const handleFocusPanel = (surface: ForgeRailSurface) => {
    if (
      templatePanelOpenMode === "overlay" ||
      templatePanelOpenMode === "docked"
    ) {
      return;
    }
    openTemplateSurface(surface, { mode: "peek" });
  };

  const handleFocusTemplates = () => {
    if (!activeForgeSurface) {
      return;
    }
    if (
      templatePanelOpenMode === "overlay" ||
      templatePanelOpenMode === "docked"
    ) {
      return;
    }
    openTemplateSurface(activeForgeSurface, { mode: "peek" });
  };

  const handleQueuePanel = (surface: ForgeRailSurface) => {
    queueOpenSurface(surface);
  };

  const handleQueueTemplates = () => {
    if (!activeForgeSurface) return;
    queueOpenSurface(activeForgeSurface);
  };

  const handleQueueClosePanel = () => {
    queueClosePanel();
  };

  return (
    <aside
      className="sb"
      data-rail="permanent"
      data-rail-compact={compactRail ? "true" : undefined}
    >
      <nav className="sb__nav sb__nav--rail" aria-label="Primary navigation">
        <SidebarRailLink
          label={navLabel(NAV_MESSAGE_KEYS.today)}
          href="/dashboard"
          active={dashboardActive}
          icon={CalendarDots}
          compact={compactRail}
          onClick={closePanel}
        />
        {proposalContextualRail && finePointer ? (
          <SidebarRailLink
            label={navLabel(NAV_MESSAGE_KEYS.jobs)}
            href="/jobs"
            active={jobsActive}
            panelOpen={panelOpenFor("jobs")}
            expanded={panelOpenFor("jobs")}
            hoverEnabled={finePointer}
            onFocusOpen={() => handleFocusPanel("jobs")}
            onHoverIntent={() => handleQueuePanel("jobs")}
            onHoverLeave={handleQueueClosePanel}
            icon={Briefcase}
            compact={compactRail}
            onClick={closePanel}
          />
        ) : proposalContextualRail ? (
          <SidebarRailButton
            label={navLabel(NAV_MESSAGE_KEYS.jobs)}
            panelOpen={panelOpenFor("jobs")}
            expanded={panelOpenFor("jobs")}
            hoverEnabled={finePointer}
            onClick={() => handleOpenProposalPanel("jobs")}
            onFocusOpen={() => handleFocusPanel("jobs")}
            onHoverIntent={() => handleQueuePanel("jobs")}
            onHoverLeave={handleQueueClosePanel}
            icon={Briefcase}
            compact={compactRail}
          />
        ) : (
          <SidebarRailLink
            label={navLabel(NAV_MESSAGE_KEYS.jobs)}
            href="/jobs"
            active={jobsActive}
            icon={Briefcase}
            compact={compactRail}
            onClick={closePanel}
          />
        )}
        {proposalContextualRail && finePointer ? (
          <SidebarRailLink
            label={navLabel(NAV_MESSAGE_KEYS.cv)}
            href="/cv"
            active={cvActive}
            panelOpen={panelOpenFor("cvs")}
            expanded={panelOpenFor("cvs")}
            hoverEnabled={finePointer}
            onFocusOpen={() => handleFocusPanel("cvs")}
            onHoverIntent={() => handleQueuePanel("cvs")}
            onHoverLeave={handleQueueClosePanel}
            icon={FileUser}
            compact={compactRail}
            onClick={closePanel}
          />
        ) : cvContextualRail ? (
          <SidebarRailButton
            label={navLabel(NAV_MESSAGE_KEYS.cv)}
            panelOpen={panelOpenFor("cvs")}
            expanded={panelOpenFor("cvs")}
            active={cvActive}
            hoverEnabled={finePointer}
            onClick={() => handleOpenProposalPanel("cvs")}
            onFocusOpen={() => handleFocusPanel("cvs")}
            onHoverIntent={() => handleQueuePanel("cvs")}
            onHoverLeave={handleQueueClosePanel}
            icon={FileUser}
            compact={compactRail}
          />
        ) : proposalContextualRail || cvContextualRail ? (
          <SidebarRailButton
            label={navLabel(NAV_MESSAGE_KEYS.cv)}
            panelOpen={panelOpenFor("cvs")}
            expanded={panelOpenFor("cvs")}
            active={cvActive}
            hoverEnabled={finePointer}
            onClick={() => handleOpenProposalPanel("cvs")}
            onFocusOpen={() => handleFocusPanel("cvs")}
            onHoverIntent={() => handleQueuePanel("cvs")}
            onHoverLeave={handleQueueClosePanel}
            icon={FileUser}
            compact={compactRail}
          />
        ) : (
          <SidebarRailLink
            label={navLabel(NAV_MESSAGE_KEYS.cv)}
            href="/cv"
            active={cvActive}
            icon={FileUser}
            compact={compactRail}
            onClick={closePanel}
          />
        )}
        {proposalContextualRail ? (
          <SidebarRailButton
            label={navLabel(NAV_MESSAGE_KEYS.proposal)}
            panelOpen={panelOpenFor("proposals")}
            expanded={panelOpenFor("proposals")}
            active={proposalActive}
            hoverEnabled={finePointer}
            onClick={() => handleOpenProposalPanel("proposals")}
            onFocusOpen={() => handleFocusPanel("proposals")}
            onHoverIntent={() => handleQueuePanel("proposals")}
            onHoverLeave={handleQueueClosePanel}
            icon={FileText}
            compact={compactRail}
          />
        ) : (
          <SidebarRailLink
            label={navLabel(NAV_MESSAGE_KEYS.proposal)}
            href={lastSavedProposalPath ?? "/proposal"}
            active={proposalActive}
            icon={FileText}
            compact={compactRail}
            onClick={closePanel}
          />
        )}
        {(proposalContextualRail || cvContextualRail) && finePointer ? (
          <SidebarRailLink
            label={navLabel(NAV_MESSAGE_KEYS.projects)}
            href="/documents"
            active={projectsActive}
            panelOpen={panelOpenFor("documents")}
            expanded={panelOpenFor("documents")}
            hoverEnabled={finePointer}
            onFocusOpen={() => handleFocusPanel("documents")}
            onHoverIntent={() => handleQueuePanel("documents")}
            onHoverLeave={handleQueueClosePanel}
            icon={FolderSimple}
            activeIcon={FolderOpen}
            compact={compactRail}
            onClick={closePanel}
          />
        ) : proposalContextualRail ? (
          <SidebarRailButton
            label={navLabel(NAV_MESSAGE_KEYS.projects)}
            panelOpen={panelOpenFor("documents")}
            expanded={panelOpenFor("documents")}
            hoverEnabled={finePointer}
            onClick={() => handleOpenProposalPanel("documents")}
            onFocusOpen={() => handleFocusPanel("documents")}
            onHoverIntent={() => handleQueuePanel("documents")}
            onHoverLeave={handleQueueClosePanel}
            icon={FolderSimple}
            activeIcon={FolderOpen}
            compact={compactRail}
          />
        ) : cvContextualRail ? (
          <SidebarRailButton
            label={navLabel(NAV_MESSAGE_KEYS.projects)}
            panelOpen={panelOpenFor("documents")}
            expanded={panelOpenFor("documents")}
            hoverEnabled={finePointer}
            onClick={() => handleOpenProposalPanel("documents")}
            onFocusOpen={() => handleFocusPanel("documents")}
            onHoverIntent={() => handleQueuePanel("documents")}
            onHoverLeave={handleQueueClosePanel}
            icon={FolderSimple}
            activeIcon={FolderOpen}
            compact={compactRail}
          />
        ) : (
          <SidebarRailLink
            label={navLabel(NAV_MESSAGE_KEYS.projects)}
            href="/documents"
            active={projectsActive}
            icon={FolderSimple}
            activeIcon={FolderOpen}
            compact={compactRail}
            onClick={closePanel}
          />
        )}
        {activeForgeSurface && finePointer ? (
          <SidebarRailLink
            label={navLabel(NAV_MESSAGE_KEYS.templates)}
            href="/templates"
            state={proposalTemplateGalleryState}
            active={templatesActive}
            panelOpen={templatesOpen}
            expanded={templatesOpen}
            hoverEnabled={finePointer}
            onFocusOpen={handleFocusTemplates}
            onHoverIntent={handleQueueTemplates}
            onHoverLeave={handleQueueClosePanel}
            icon={Layout}
            compact={compactRail}
            onClick={closePanel}
          />
        ) : activeForgeSurface ? (
          <SidebarRailButton
            label={navLabel(NAV_MESSAGE_KEYS.templates)}
            panelOpen={templatesOpen}
            expanded={templatesOpen}
            hoverEnabled={finePointer}
            onClick={handleOpenTemplates}
            onFocusOpen={handleFocusTemplates}
            onHoverIntent={handleQueueTemplates}
            onHoverLeave={handleQueueClosePanel}
            icon={Layout}
            compact={compactRail}
          />
        ) : (
          <SidebarRailLink
            label={navLabel(NAV_MESSAGE_KEYS.templates)}
            href="/templates"
            active={templatesActive}
            icon={Layout}
            compact={compactRail}
            onClick={closePanel}
          />
        )}
        <SidebarRailButton
          label={navLabel(NAV_MESSAGE_KEYS.settings)}
          active={settingsActive}
          panelOpen={panelOpenFor("settings")}
          expanded={panelOpenFor("settings")}
          icon={Gear}
          className="sb-rail-button--bottom"
          hoverEnabled={false}
          compact={compactRail}
          onClick={handleOpenSettingsPanel}
        />
      </nav>
    </aside>
  );
};

export default Sidebar;
