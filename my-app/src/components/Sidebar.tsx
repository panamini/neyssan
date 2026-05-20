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

const MOBILE_HIDE_WIDTH = 480;

const SETTINGS_DRAWER_GROUPS: Array<{
  label: string;
  tabs: SettingsTab[];
}> = [
  { label: "Account", tabs: ["account", "team", "danger"] },
  { label: "Defaults", tabs: ["preferences", "docstyle", "voice"] },
  { label: "Payment", tabs: ["billing"] },
];

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
  className?: string;
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
  className,
  onClick,
  onHoverIntent,
  onHoverLeave,
  onFocusOpen,
}: SidebarRailLinkProps): JSX.Element {
  return (
    <Link
      to={href}
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
  onSelectTab,
}: {
  activeTab: string;
  onSelectTab: (tabId: (typeof SETTINGS_TABS)[number]["id"]) => void;
}): JSX.Element {
  return (
    <div className="forge-rail-drawer forge-rail-drawer--settings">
      <div className="forge-rail-drawer__list" role="list">
        {SETTINGS_DRAWER_GROUPS.map((group) => (
          <React.Fragment key={group.label}>
            <div className="forge-rail-drawer__category-label">
              {group.label}
            </div>
            {group.tabs.map((tabId) => {
              const tab = SETTINGS_TABS.find((candidate) => candidate.id === tabId);
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
                    <strong>{tab.label}</strong>
                    <span>{tab.description}</span>
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
  const {
    activeSurface: activeTemplateSurface,
    open: templatePanelOpen,
    openSurface: openTemplateSurface,
    togglePinnedSurface,
    closePanel,
    queueOpenSurface,
    queueClosePanel,
  } = useForgeTemplatePanel();
  const activeSettingsTab = normalizeSettingsTab(
    new URLSearchParams(location.search).get("tab"),
  );
  useRegisterForgePanel(
    React.useMemo(
      () => ({
        surface: "settings" as const,
        title: "",
        ariaLabel: "Settings sections",
        renderContent: () => (
          <SettingsDrawerContent
            activeTab={activeSettingsTab}
            onSelectTab={(tabId) => {
              navigate(getSettingsTabPath(tabId));
            }}
          />
        ),
      }),
      [activeSettingsTab, navigate],
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
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
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
  const dashboardActive = pathname === "/" || isRouteActive(pathname, "/dashboard");
  const jobsActive = isRouteActive(pathname, "/jobs");
  const cvActive = isRouteActive(pathname, "/cv") || isRouteActive(pathname, "/cvs");
  const proposalActive =
    isRouteActive(pathname, "/proposal") || isRouteActive(pathname, "/proposals");
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
      openTemplateSurface("settings", { mode: "pinned" });
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [openTemplateSurface, settingsActive]);

  if (viewportWidth < MOBILE_HIDE_WIDTH) {
    return null;
  }

  const handleOpenTemplates = () => {
    if (!activeForgeSurface) {
      return;
    }
    togglePinnedSurface(activeForgeSurface, {
      unpinBehavior: finePointer ? "peek" : "close",
    });
  };

  const handleOpenProposalPanel = (surface: ForgeRailSurface) => {
    togglePinnedSurface(surface, {
      unpinBehavior: finePointer ? "peek" : "close",
    });
  };

  const handleOpenSettingsPanel = () => {
    if (!settingsActive) {
      pendingSettingsPanelOpenRef.current = true;
      navigate(getSettingsTabPath(activeSettingsTab));
      return;
    }

    togglePinnedSurface("settings", {
      unpinBehavior: finePointer ? "peek" : "close",
    });
  };

  const handleFocusPanel = (surface: ForgeRailSurface) => {
    openTemplateSurface(surface, { mode: "peek" });
  };

  const handleFocusTemplates = () => {
    if (!activeForgeSurface) {
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
    <aside className="sb" data-rail="permanent">
      <nav className="sb__nav sb__nav--rail" aria-label="Primary navigation">
        <SidebarRailLink
          label="Today"
          href="/dashboard"
          active={dashboardActive}
          icon={CalendarDots}
          onClick={closePanel}
        />
        {proposalContextualRail && finePointer ? (
          <SidebarRailLink
            label="Jobs"
            href="/jobs"
            active={jobsActive}
            panelOpen={panelOpenFor("jobs")}
            expanded={panelOpenFor("jobs")}
            hoverEnabled={finePointer}
            onFocusOpen={() => handleFocusPanel("jobs")}
            onHoverIntent={() => handleQueuePanel("jobs")}
            onHoverLeave={handleQueueClosePanel}
            icon={Briefcase}
            onClick={closePanel}
          />
        ) : proposalContextualRail ? (
          <SidebarRailButton
            label="Jobs"
            panelOpen={panelOpenFor("jobs")}
            expanded={panelOpenFor("jobs")}
            hoverEnabled={finePointer}
            onClick={() => handleOpenProposalPanel("jobs")}
            onFocusOpen={() => handleFocusPanel("jobs")}
            onHoverIntent={() => handleQueuePanel("jobs")}
            onHoverLeave={handleQueueClosePanel}
            icon={Briefcase}
          />
        ) : (
          <SidebarRailLink
            label="Jobs"
            href="/jobs"
            active={jobsActive}
            icon={Briefcase}
            onClick={closePanel}
          />
        )}
        {(proposalContextualRail || cvContextualRail) && finePointer ? (
          <SidebarRailLink
            label="CV"
            href="/cv"
            active={cvActive}
            panelOpen={panelOpenFor("cvs")}
            expanded={panelOpenFor("cvs")}
            hoverEnabled={finePointer}
            onFocusOpen={() => handleFocusPanel("cvs")}
            onHoverIntent={() => handleQueuePanel("cvs")}
            onHoverLeave={handleQueueClosePanel}
            icon={FileUser}
            onClick={closePanel}
          />
        ) : proposalContextualRail || cvContextualRail ? (
          <SidebarRailButton
            label="CV"
            panelOpen={panelOpenFor("cvs")}
            expanded={panelOpenFor("cvs")}
            active={cvActive}
            hoverEnabled={finePointer}
            onClick={() => handleOpenProposalPanel("cvs")}
            onFocusOpen={() => handleFocusPanel("cvs")}
            onHoverIntent={() => handleQueuePanel("cvs")}
            onHoverLeave={handleQueueClosePanel}
            icon={FileUser}
          />
        ) : (
          <SidebarRailLink
            label="CV"
            href="/cv"
            active={cvActive}
            icon={FileUser}
            onClick={closePanel}
          />
        )}
        {proposalContextualRail ? (
          <SidebarRailButton
            label="Proposal"
            panelOpen={panelOpenFor("proposals")}
            expanded={panelOpenFor("proposals")}
            active={proposalActive}
            hoverEnabled={finePointer}
            onClick={() => handleOpenProposalPanel("proposals")}
            onFocusOpen={() => handleFocusPanel("proposals")}
            onHoverIntent={() => handleQueuePanel("proposals")}
            onHoverLeave={handleQueueClosePanel}
            icon={FileText}
          />
        ) : (
          <SidebarRailLink
            label="Proposal"
            href="/proposal"
            active={proposalActive}
            icon={FileText}
            onClick={closePanel}
          />
        )}
        {(proposalContextualRail || cvContextualRail) && finePointer ? (
          <SidebarRailLink
            label="Projects"
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
            onClick={closePanel}
          />
        ) : proposalContextualRail ? (
          <SidebarRailButton
            label="Projects"
            panelOpen={panelOpenFor("documents")}
            expanded={panelOpenFor("documents")}
            hoverEnabled={finePointer}
            onClick={() => handleOpenProposalPanel("documents")}
            onFocusOpen={() => handleFocusPanel("documents")}
            onHoverIntent={() => handleQueuePanel("documents")}
            onHoverLeave={handleQueueClosePanel}
            icon={FolderSimple}
            activeIcon={FolderOpen}
          />
        ) : cvContextualRail ? (
          <SidebarRailButton
            label="Projects"
            panelOpen={panelOpenFor("documents")}
            expanded={panelOpenFor("documents")}
            hoverEnabled={finePointer}
            onClick={() => handleOpenProposalPanel("documents")}
            onFocusOpen={() => handleFocusPanel("documents")}
            onHoverIntent={() => handleQueuePanel("documents")}
            onHoverLeave={handleQueueClosePanel}
            icon={FolderSimple}
            activeIcon={FolderOpen}
          />
        ) : (
          <SidebarRailLink
            label="Projects"
            href="/documents"
            active={projectsActive}
            icon={FolderSimple}
            activeIcon={FolderOpen}
            onClick={closePanel}
          />
        )}
        {activeForgeSurface && finePointer ? (
          <SidebarRailLink
            label="Templates"
            href="/templates"
            active={templatesActive}
            panelOpen={templatesOpen}
            expanded={templatesOpen}
            hoverEnabled={finePointer}
            onFocusOpen={handleFocusTemplates}
            onHoverIntent={handleQueueTemplates}
            onHoverLeave={handleQueueClosePanel}
            icon={Layout}
            onClick={closePanel}
          />
        ) : activeForgeSurface ? (
          <SidebarRailButton
            label="Templates"
            panelOpen={templatesOpen}
            expanded={templatesOpen}
            hoverEnabled={finePointer}
            onClick={handleOpenTemplates}
            onFocusOpen={handleFocusTemplates}
            onHoverIntent={handleQueueTemplates}
            onHoverLeave={handleQueueClosePanel}
            icon={Layout}
          />
        ) : (
          <SidebarRailLink
            label="Templates"
            href="/templates"
            active={templatesActive}
            icon={Layout}
            onClick={closePanel}
          />
        )}
        <SidebarRailButton
          label="Settings"
          active={settingsActive}
          panelOpen={panelOpenFor("settings")}
          expanded={panelOpenFor("settings")}
          icon={Gear}
          className="sb-rail-button--bottom"
          hoverEnabled={false}
          onClick={handleOpenSettingsPanel}
        />
      </nav>
    </aside>
  );
};

export default Sidebar;
