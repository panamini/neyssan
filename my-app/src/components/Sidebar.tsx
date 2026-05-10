import React from "react";
import clsx from "clsx";
import {
  Briefcase,
  FileText,
  FileUser,
  FolderTree,
  Gear,
  type IconProps,
  ImagesSquare,
  SquaresFour,
} from "@/lib/icons";
import { Link, useLocation } from "react-router-dom";
import {
  type ForgeRailSurface,
  type ForgeTemplateSurface,
  useForgeTemplatePanel,
} from "../contexts/ForgeTemplatePanelContext";

const MOBILE_HIDE_WIDTH = 480;

type RailIconComponent = React.ComponentType<IconProps>;

type SidebarRailLinkProps = {
  label: string;
  icon: RailIconComponent;
  href: string;
  active: boolean;
  className?: string;
};

type SidebarRailButtonProps = {
  label: string;
  icon: RailIconComponent;
  panelOpen: boolean;
  expanded: boolean;
  active?: boolean;
  hoverEnabled?: boolean;
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
}: {
  icon: RailIconComponent;
}): JSX.Element {
  return (
    <span className="sb-rail-button__icon" aria-hidden="true">
      <Icon
        className="sb-rail-button__glyph sb-rail-button__glyph--regular"
        size={20}
        weight="regular"
      />
      <Icon
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
  href,
  active,
  className,
}: SidebarRailLinkProps): JSX.Element {
  return (
    <Link
      to={href}
      className={clsx(
        "sb-rail-button",
        active && "sb-rail-button--route-active",
        active && "sb-rail-button--active",
        className,
      )}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      <SidebarRailIcon icon={icon} />
      <span className="sb-rail-button__label">{label}</span>
    </Link>
  );
}

function SidebarRailButton({
  label,
  icon,
  panelOpen,
  expanded,
  active = false,
  hoverEnabled = true,
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
      <SidebarRailIcon icon={icon} />
      <span className="sb-rail-button__label">{label}</span>
    </button>
  );
}

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const {
    activeSurface: activeTemplateSurface,
    open: templatePanelOpen,
    openSurface: openTemplateSurface,
    togglePinnedSurface,
    queueOpenSurface,
    queueClosePanel,
  } = useForgeTemplatePanel();
  const [finePointer, setFinePointer] = React.useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(hover: hover) and (pointer: fine)").matches
      : false,
  );
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );

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

  if (viewportWidth < MOBILE_HIDE_WIDTH) {
    return null;
  }

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
          icon={SquaresFour}
        />
        {proposalContextualRail ? (
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
          />
        )}
        {proposalContextualRail ? (
          <SidebarRailButton
            label="CV"
            panelOpen={panelOpenFor("cvs")}
            expanded={panelOpenFor("cvs")}
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
          />
        )}
        {proposalContextualRail ? (
          <SidebarRailButton
            label="Projects"
            panelOpen={panelOpenFor("documents")}
            expanded={panelOpenFor("documents")}
            hoverEnabled={finePointer}
            onClick={() => handleOpenProposalPanel("documents")}
            onFocusOpen={() => handleFocusPanel("documents")}
            onHoverIntent={() => handleQueuePanel("documents")}
            onHoverLeave={handleQueueClosePanel}
            icon={FolderTree}
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
            icon={FolderTree}
          />
        ) : (
          <SidebarRailLink
            label="Projects"
            href="/documents"
            active={projectsActive}
            icon={FolderTree}
          />
        )}
        {activeForgeSurface ? (
          <SidebarRailButton
            label="Templates"
            panelOpen={templatesOpen}
            expanded={templatesOpen}
            hoverEnabled={finePointer}
            onClick={handleOpenTemplates}
            onFocusOpen={handleFocusTemplates}
            onHoverIntent={handleQueueTemplates}
            onHoverLeave={handleQueueClosePanel}
            icon={ImagesSquare}
          />
        ) : (
          <SidebarRailLink
            label="Templates"
            href="/templates"
            active={templatesActive}
            icon={ImagesSquare}
          />
        )}
        <SidebarRailLink
          label="Settings"
          href="/settings"
          active={settingsActive}
          icon={Gear}
          className="sb-rail-button--bottom"
        />
      </nav>
    </aside>
  );
};

export default Sidebar;
