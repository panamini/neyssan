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
  active: boolean;
  expanded: boolean;
  onClick: () => void;
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
  active,
  expanded,
  onClick,
}: SidebarRailButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={clsx(
        "sb-rail-button",
        active && "sb-rail-button--active",
        expanded && "sb-rail-button--panel-open",
      )}
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
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
  } = useForgeTemplatePanel();
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
  const settingsActive = isRouteActive(pathname, "/settings");
  const activeForgeSurface: ForgeTemplateSurface | null = cvActive
    ? "cv"
    : proposalActive
      ? "proposal"
      : null;
  const templatesOpen =
    Boolean(activeForgeSurface) &&
    templatePanelOpen &&
    activeTemplateSurface === activeForgeSurface;

  const handleOpenTemplates = () => {
    if (!activeForgeSurface) {
      return;
    }
    openTemplateSurface(activeForgeSurface);
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
        <SidebarRailLink
          label="Jobs"
          href="/jobs"
          active={jobsActive}
          icon={Briefcase}
        />
        <SidebarRailLink
          label="CV"
          href="/cv"
          active={cvActive}
          icon={FileUser}
        />
        <SidebarRailLink
          label="Proposal"
          href="/proposal"
          active={proposalActive}
          icon={FileText}
        />
        <SidebarRailLink
          label="Projects"
          href="/documents"
          active={projectsActive}
          icon={FolderTree}
        />
        {activeForgeSurface ? (
          <SidebarRailButton
            label="Templates"
            active={templatesOpen}
            expanded={templatesOpen}
            onClick={handleOpenTemplates}
            icon={ImagesSquare}
          />
        ) : null}
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
