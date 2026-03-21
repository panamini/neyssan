import React, { useEffect, useRef, useState } from 'react';
import { Menu, FileUser, Moon, Plus, Pen, PenLine, PanelLeftDashed, FolderTree, SunMedium, X, Check, Trash } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { UserButton } from '@clerk/clerk-react';
import { api } from '../../convex/_generated/api';
import { useCvLibrary } from '../contexts/CvLibraryContext';
import { normalizeAndValidateCvDocument } from '../lib/normalize-cv';
import { formatCvDisplayTitle } from '../lib/proposal-personalization';
import CvRenameDialog from './CvRenameDialog';
import { useToast } from './ui/toast';

/** Inline dark-mode hook — reads localStorage + system preference, writes both. */
function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = React.useState(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "dark") return true;
      if (stored === "light") return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch { return false; }
  });

  /* Sync DOM class with state on mount — prevents two-click issue when
     localStorage and documentElement.classList are out of sync on load. */
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once at mount only

  const toggle = React.useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      try {
        localStorage.setItem("theme", next ? "dark" : "light");
        document.documentElement.classList.toggle("dark", next);
      } catch { /* noop */ }
      return next;
    });
  }, []);
  return [isDark, toggle];
}

/**
 * Sidebar — dasti v1
 *
 * Layout : 248px expanded / 52px collapsed (CSS transition .22s).
 * Active state : CSS classes only — .sb-nav-item + .sb-nav-item--active.
 *   bg = var(--sf2) (one step above sidebar --sf1, works light+dark alike)
 *   left accent stripe = box-shadow inset 2px (no border, no layout shift)
 */

const SB_EXPANDED = 248;
const SB_COLLAPSED = 52;
const SB_MAX_ITEMS = 5;

/* Shared appearance for Clerk UserButton — dasti tokens */
const clerkAppearance = {
  elements: {
    avatarBox: {
      width: "26px",
      height: "26px",
      borderRadius: "6px",   /* --rs */
    },
    userButtonAvatarBox: {
      width: "26px",
      height: "26px",
      borderRadius: "6px",
    },
    userButtonTrigger: {
      boxShadow: "none",
      outline: "none",
    },
  },
  variables: {
    colorPrimary: "hsl(155,22%,30%)",  /* --ac light */
    borderRadius: "6px",
  },
} as const;

export const Sidebar: React.FC = () => {
  const [isDarkMode, toggleDarkMode] = useDarkMode();
  const { user } = useUser();
  const [collapsed, setCollapsed] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [proposalRenameTarget, setProposalRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { cvs, currentCv, loadCv, createNewCv, importCv, deleteCv, renameCv } = useCvLibrary();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { showToast } = useToast();
  const params = new URLSearchParams(search);
  const proposalView = params.get("view");
  const selectedProposalId = params.get("id");
  const isProposal = pathname.startsWith('/proposal');
  const isStyle = pathname.startsWith('/style');
  const isResume = pathname.startsWith('/cv');
  const forcedCollapsed = viewportWidth < 768;
  const sidebarCollapsed = collapsed || forcedCollapsed;
  const compactDensity = viewportWidth < 1360;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* ── Proposals query ────────────────────────────────────── */
  const { isLoaded, isSignedIn } = useAuth();
  const proposals = useQuery(
    api.proposalsPublic.default as any,
    isLoaded && isSignedIn ? {} : "skip",
  ) as Array<{ _id: string; _creationTime: number; title?: string; metadata?: { proposalType?: string } }> | undefined;
  const deleteProposal = useMutation((api as any).deleteProposalPublic?.default);
  const updateProposal = useMutation((api as any).updateProposalPublic?.default);

  /* ── Handlers ────────────────────────────────────────────── */

  const handleLoadCv = (id: string) => {
    try { loadCv(id); }
    catch (e) { console.error("[Sidebar] loadCv failed", e); }
  };

  const getStudioTarget = React.useCallback(() => {
    const activeId =
      currentCv?.id ??
      (typeof window !== "undefined" ? window.localStorage.getItem("cvActiveId") : null);
    return activeId ? `/cv?id=${encodeURIComponent(String(activeId))}` : "/cv";
  }, [currentCv?.id]);

  const handleCreate = () => {
    try {
      createNewCv(undefined, { forceV1: true });
      void navigate(getStudioTarget());
    }
    catch (err) { console.error("[Sidebar] createNewCv failed", err); }
  };

  const handleRenameOpen = (id: string, title: string) => {
    setError(null);
    setRenameTarget({ id, title });
  };

  const handleRenameSave = (nextTitle: string) => {
    if (!renameTarget) return;
    try {
      renameCv(renameTarget.id, nextTitle);
      setRenameTarget(null);
    } catch (err) {
      console.error("[Sidebar] renameCv failed", err);
      setError("Failed to rename CV");
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try { deleteCv(id); }
    catch (err) {
      console.error("[Sidebar] deleteCv failed", err);
      setError("Failed to delete CV");
    }
  };

  const handleDeleteProposal = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    try {
      await deleteProposal({ id });
      if (selectedProposalId === id) void navigate('/proposal?view=saved');
      showToast("Proposal deleted", { variant: "success" });
    } catch (err) {
      console.error("[Sidebar] deleteProposal failed", err);
      showToast("Failed to delete proposal", { variant: "error" });
    }
  };

  const handleRenameProposal = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setProposalRenameTarget({ id, title });
  };

  const handleProposalRenameSave = async (nextTitle: string) => {
    if (!proposalRenameTarget) return;
    try {
      await updateProposal({ id: proposalRenameTarget.id, title: nextTitle });
      setProposalRenameTarget(null);
      showToast("Proposal renamed", { variant: "success" });
    } catch (err) {
      console.error("[Sidebar] renameProposal failed", err);
      showToast("Failed to rename proposal", { variant: "error" });
    }
  };

  /* ── Styles (tokens dasti) ───────────────────────────────── */

  const sb: React.CSSProperties = {
    width: sidebarCollapsed ? SB_COLLAPSED : compactDensity ? 232 : SB_EXPANDED,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    borderRight: "1px solid var(--bo)",
    background: "var(--sf1)",
    transition: "width .22s var(--ez)",
    overflow: "hidden",
    position: "relative",
    zIndex: 10,
  };

  const sbTop: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    padding: sidebarCollapsed ? 0 : "0 var(--s2)",
    justifyContent: sidebarCollapsed ? "center" : "flex-start",
    height: "var(--hdr)",
    borderBottom: "1px solid var(--bo)",
    flexShrink: 0,
  };

  const sbSec: React.CSSProperties = sidebarCollapsed
    ? { opacity: 0, maxHeight: 0, overflow: "hidden", padding: 0, pointerEvents: "none" }
    : {
        fontSize: 10,
        fontWeight: 600,
        color: "var(--tg2)",
        letterSpacing: ".12em",
        textTransform: "uppercase",
        padding: compactDensity ? "var(--s3) var(--s2) var(--s2)" : "var(--s4) var(--s2) var(--s3)",
        whiteSpace: "nowrap",
        transition: "opacity .18s var(--ez), max-height .22s var(--ez)",
        maxHeight: 40,
      };

  /* Shared structural style for the three main nav items.
     Visual states (bg, shadow, border) are handled by CSS classes
     .sb-nav-item and .sb-nav-item--active in globals.css.          */
  const navItemBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: sidebarCollapsed ? "center" : "flex-start",
    gap: sidebarCollapsed ? 0 : "var(--s3)",
    padding: sidebarCollapsed ? 0 : "var(--s2)",
    borderRadius: "var(--rs)",
    cursor: "pointer",
    height: compactDensity ? 32 : 34,
    width: "100%",
    alignSelf: "stretch",
    overflow: "hidden",
    userSelect: "none",
  };

  /* Shared text span style for nav item labels */
  function navLabel(active: boolean): React.CSSProperties {
    return {
      fontSize: "var(--ts)",
      fontWeight: active ? 600 : 500,
      color: active ? "var(--ti)" : "var(--tm2)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      flex: 1,
      maxWidth: sidebarCollapsed ? 0 : 200,
      opacity: sidebarCollapsed ? 0 : 1,
      transition: "opacity .15s var(--ez), max-width .22s var(--ez)",
      pointerEvents: sidebarCollapsed ? "none" : "auto",
    };
  }

  return (
    <>
      <div style={sb}>
        {/* ── Top bar — hamburger only ─────────────────────── */}
        <div style={sbTop}>
          <button
            className={
              forcedCollapsed
                ? "sb-toggle"
                : sidebarCollapsed
                ? "sb-toggle sb-toggle--expand"
                : "sb-toggle sb-toggle--collapse"
            }
            onClick={() => { if (!forcedCollapsed) setCollapsed((c) => !c); }}
            title={forcedCollapsed ? "Auto-collapses on narrow screens" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* ── Nav ─────────────────────────────────────────── */}
        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: sidebarCollapsed ? "var(--s2) 0" : "var(--s2)",
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          {/* RESUME section */}
          <span style={sbSec as React.CSSProperties}>Resume</span>

          <div
            onClick={() => void navigate(getStudioTarget())}
            className={isResume ? "sb-nav-item sb-nav-item--active" : "sb-nav-item"}
            style={navItemBase}
          >
            <div className="sb-nav-icon">
              <FileUser size={15} strokeWidth={1.5} />
            </div>
            <span style={navLabel(isResume)}>Studio</span>
          </div>

          {/* CV sub-items */}
          {!sidebarCollapsed && cvs.slice(0, SB_MAX_ITEMS).map((cv) => {
            const isActive = currentCv?.id === cv.id;
            const profileSection = Array.isArray(cv.sections)
              ? cv.sections.find((section) => section.type === "profile")
              : undefined;
            const profileItem = Array.isArray(profileSection?.structuredContent)
              ? (profileSection?.structuredContent[0] as Record<string, unknown> | undefined)
              : undefined;
            const displayTitle = formatCvDisplayTitle({
              title: cv.title,
              profileName: typeof profileItem?.name === "string" ? profileItem.name : null,
              desiredPosition:
                typeof profileItem?.desiredPosition === "string"
                  ? profileItem.desiredPosition
                  : typeof profileItem?.title === "string"
                    ? profileItem.title
                    : null,
            });
            return (
              <SbDoc
                key={cv.id}
                title={displayTitle}
                isActive={isActive}
                dense={compactDensity}
                onClick={() => { handleLoadCv(cv.id); void navigate(`/cv?id=${encodeURIComponent(String(cv.id))}`); }}
                onRename={(e) => { e.stopPropagation(); handleRenameOpen(cv.id, cv.title); }}
                onDelete={(e) => handleDelete(e, cv.id)}
              />
            );
          })}

          {!sidebarCollapsed && cvs.length > SB_MAX_ITEMS && (
            <SbViewAll label={`View all (${cvs.length})`} dense={compactDensity} onClick={() => void navigate('/cvs')} />
          )}

          {!sidebarCollapsed && (
            <SbNewAction label="New resume" dense={compactDensity} onClick={handleCreate} />
          )}

          {/* WRITE section */}
          <span style={sbSec as React.CSSProperties}>Write</span>

          <div
            onClick={() => void navigate('/proposal')}
            className={isProposal ? "sb-nav-item sb-nav-item--active" : "sb-nav-item"}
            style={navItemBase}
          >
            <div className="sb-nav-icon">
              <PenLine size={15} strokeWidth={1.5} />
            </div>
            <span style={navLabel(isProposal)}>Compose</span>
          </div>

          {/* Proposal sub-items */}
          {!sidebarCollapsed && isSignedIn && proposals && proposals.slice(0, SB_MAX_ITEMS).map((p) => {
            const isActive = isProposal && proposalView === "saved" && selectedProposalId === p._id;
            return (
              <SbDoc
                key={p._id}
                title={p.title ?? "Untitled"}
                isActive={isActive}
                dense={compactDensity}
                onClick={() => void navigate(`/proposal?view=saved&id=${encodeURIComponent(p._id)}`)}
                onRename={(e) => { void handleRenameProposal(e, p._id, p.title ?? "Untitled"); }}
                onDelete={(e) => { void handleDeleteProposal(e, p._id, p.title ?? "Untitled"); }}
              />
            );
          })}

          {!sidebarCollapsed && proposals && proposals.length > SB_MAX_ITEMS && (
            <SbViewAll label={`View all (${proposals.length})`} dense={compactDensity} onClick={() => void navigate('/proposals')} />
          )}

          {!sidebarCollapsed && (
            <SbNewAction label="New letter" dense={compactDensity} onClick={() => void navigate('/proposal')} />
          )}

          {/* SETTINGS section */}
          <span style={sbSec as React.CSSProperties}>Settings</span>

          <div
            onClick={() => void navigate('/style')}
            className={isStyle ? "sb-nav-item sb-nav-item--active" : "sb-nav-item"}
            style={navItemBase}
          >
            <div className="sb-nav-icon">
              <PanelLeftDashed size={16} strokeWidth={1.5} />
            </div>
            <span style={navLabel(isStyle)}>Style</span>
          </div>

          {/* Error display */}
          {error && !sidebarCollapsed && (
            <div style={{ padding: "var(--s2)", fontSize: "var(--tx)", color: "var(--ert)" }}>
              {error}
            </div>
          )}
        </nav>

        {/* ── Footer — avatar only ─────────────────────────── */}
        <div className={sidebarCollapsed ? "sb-footer sb-footer--collapsed" : "sb-footer"}>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            <UserButton afterSignOutUrl="/" appearance={clerkAppearance} />
          </div>
          {!sidebarCollapsed && (
            <div className="sb-footer__account" style={{ flex: 1 }}>
              <div className="sb-footer__title">
                {user?.firstName ?? user?.username ?? "Account"}
              </div>
              <div className="sb-footer__subtitle">
                free
              </div>
            </div>
          )}
          {!sidebarCollapsed && (
            <div className="sb-theme-toggle" role="group" aria-label="Theme">
              <button
                type="button"
                className={isDarkMode ? "sb-theme-toggle__option" : "sb-theme-toggle__option sb-theme-toggle__option--active"}
                onClick={toggleDarkMode}
                aria-pressed={!isDarkMode}
                title="Light mode"
              >
                <SunMedium size={14} strokeWidth={1.6} />
              </button>
              <button
                type="button"
                className={isDarkMode ? "sb-theme-toggle__option sb-theme-toggle__option--active" : "sb-theme-toggle__option"}
                onClick={toggleDarkMode}
                aria-pressed={isDarkMode}
                title="Dark mode"
              >
                <Moon size={14} strokeWidth={1.6} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Rename dialogs ───────────────────────────────── */}
      <CvRenameDialog
        open={renameTarget !== null}
        currentTitle={renameTarget?.title ?? ""}
        onClose={() => setRenameTarget(null)}
        onSave={handleRenameSave}
      />
      <CvRenameDialog
        open={proposalRenameTarget !== null}
        currentTitle={proposalRenameTarget?.title ?? ""}
        title="Rename proposal"
        placeholder="Proposal title"
        onClose={() => setProposalRenameTarget(null)}
        onSave={(nextTitle) => { void handleProposalRenameSave(nextTitle); }}
      />

      {/* Hidden file input for JSON import */}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,text/json"
        className="hidden"
        onChange={(e) => {
          void (async () => {
            setError(null);
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const text = await file.text();
              const parsed: unknown = JSON.parse(text);
              const norm = normalizeAndValidateCvDocument(parsed, file.name);
              if (!norm.success) { setError(norm.errors.join("; ")); return; }
              await importCv(norm.document);
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : "Failed to import file");
            } finally {
              if (fileRef.current) fileRef.current.value = "";
            }
          })();
        }}
      />
    </>
  );
};

/* ─────────────────────────────────────────────────────────────
   SbNewAction — "+ New …" row
   ───────────────────────────────────────────────────────────── */

function SbNewAction({ label, dense, onClick }: { label: string; dense: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--s3)",
        padding: "var(--s2)",
        borderRadius: "var(--rs)",
        cursor: "pointer",
        height: dense ? 28 : 30,
        color: "var(--tg2)",
        fontSize: "var(--tx)",
        transition: "color .12s var(--ez)",
        background: "var(--sf1)",
        border: "none",
        width: "100%",
        textAlign: "left",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "var(--am)"; b.style.background = "var(--sf2)"; }}
      onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "var(--tg2)"; b.style.background = "var(--sf1)"; }}
    >
      <Plus size={14} style={{ flexShrink: 0 }} />
      <span style={{ whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   SbViewAll — "View all (N) →" link
   ───────────────────────────────────────────────────────────── */

function SbViewAll({ label, dense, onClick }: { label: string; dense: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--s2)",
        padding: dense ? "2px var(--s2) 2px 34px" : "2px var(--s2) 2px 40px",
        borderRadius: "var(--rs)",
        cursor: "pointer",
        height: 22,
        color: "var(--tg2)",
        fontSize: "var(--tx)",
        transition: "color .1s var(--ez)",
        background: "transparent",
        border: "none",
        width: "100%",
        textAlign: "left",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--am)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--tg2)"; }}
    >
      <FolderTree size={13} strokeWidth={1.6} style={{ flexShrink: 0 }} />
      <span style={{ whiteSpace: "nowrap" }}>{label} →</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   SbDoc — document sub-item
   ───────────────────────────────────────────────────────────── */

interface SbDocProps {
  title: string;
  isActive: boolean;
  dense?: boolean;
  onClick: () => void;
  onRename: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  hideActions?: boolean;
  hideRenameAction?: boolean;
}

function SbDoc({ title, isActive, dense = false, onClick, onRename, onDelete, hideActions, hideRenameAction }: SbDocProps) {
  const [hovered, setHovered] = useState(false);
  const [renHovered, setRenHovered] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const actionMaskSurface = "var(--sf2)";

  const btnBase: React.CSSProperties = {
    width: "var(--s4)", height: "var(--s4)",
    display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: "var(--rx)", border: "none", background: "transparent",
    color: "var(--tm2)", cursor: "pointer", padding: 0,
    transition: "background .1s var(--ez), color .1s var(--ez)",
    fontFamily: "inherit", flexShrink: 0,
  };

  return (
    <div
      onClick={isConfirming ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setIsConfirming(false); }}
      style={{
        display: "flex",
        flexDirection: "column",
        padding: dense ? "7px var(--s2) 7px 32px" : "var(--s2) var(--s2) var(--s2) 38px",
        borderRadius: "var(--rs)",
        cursor: isConfirming ? "default" : "pointer",
        position: "relative",
        /* active = slight bg lift + left accent stripe via inset box-shadow */
        background: isActive ? "var(--sf2)" : hovered ? "var(--sf2)" : "var(--sf1)",
        boxShadow: "none",
      }}
    >
      <div
        style={{
          fontSize: "var(--ts)",
          fontWeight: isActive ? 600 : 500,
          color: isActive ? "var(--ti)" : "var(--tm2)",
          lineHeight: 1.24,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: dense ? 150 : 160,
        }}
      >
        {title}
      </div>

      {!hideActions && (hovered || isConfirming) && (
        <div
          className="dasti-icon-cluster dasti-icon-cluster--flush"
          style={{ position: "absolute", right: "var(--s1)", top: "50%", transform: "translateY(-50%)", background: "transparent", paddingLeft: 0, boxShadow: `-10px 0 8px 4px ${actionMaskSurface}` }}
          onClick={(e) => e.stopPropagation()}
        >
          {isConfirming ? (
            <>
              <button
                title="Confirm delete"
                style={{ ...btnBase, borderRadius: "var(--rx)", background: "var(--erb)", color: "var(--ert)" }}
                onMouseEnter={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.background = "var(--er)";
                  b.style.color = "var(--op)";
                }}
                onMouseLeave={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.background = "var(--erb)";
                  b.style.color = "var(--ert)";
                }}
                onClick={(e) => { e.stopPropagation(); onDelete(e); setIsConfirming(false); }}
              >
                <Check size={10} strokeWidth={2.5} />
              </button>
              <button
                title="Cancel"
                style={{ ...btnBase, borderRadius: "var(--rx)", background: "var(--sf2)", color: "var(--ti)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--sf2)"; }}
                onMouseLeave={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.background = "var(--sf2)";
                  b.style.color = "var(--ti)";
                }}
                onClick={(e) => { e.stopPropagation(); setIsConfirming(false); }}
              >
                <X size={10} strokeWidth={2} />
              </button>
            </>
          ) : (
            <>
              {!hideRenameAction && (
                <button
                  onClick={onRename}
                  onMouseEnter={() => setRenHovered(true)}
                  onMouseLeave={() => setRenHovered(false)}
                title="Rename"
                style={{ ...btnBase, background: renHovered ? "var(--sfr)" : "transparent", color: renHovered ? "var(--ti)" : "var(--tm2)" }}
              >
                  <Pen size={10} strokeWidth={1.75} />
                </button>
              )}
              <button
                title="Delete"
                style={btnBase}
                onMouseEnter={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.background = "var(--sfr)";
                  b.style.color = "var(--ti)";
                }}
                onMouseLeave={(e) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.style.background = "transparent";
                  b.style.color = "var(--tm2)";
                }}
                onClick={(e) => { e.stopPropagation(); setIsConfirming(true); }}
              >
                <Trash size={10} strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default Sidebar;
