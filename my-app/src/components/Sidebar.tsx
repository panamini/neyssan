import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  Menu,
  FileUser,
  Moon,
  Plus,
  Pencil,
  Palette,
  FolderTree,
  SunMedium,
  X,
  Check,
  Trash,
} from "@/lib/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { UserButton } from "@clerk/clerk-react";
import { api } from "../../convex/_generated/api";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { normalizeAndValidateCvDocument } from "../lib/normalize-cv";
import { formatCvDisplayTitle } from "../lib/proposal-personalization";
import CvRenameDialog from "./CvRenameDialog";
import { useToast } from "./ui/toast";

/** Inline dark-mode hook — reads localStorage + system preference, writes both. */
function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = React.useState(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "dark") return true;
      if (stored === "light") return false;
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });

  /* Sync DOM class with state on mount — prevents two-click issue when
     localStorage and documentElement.classList are out of sync on load. */
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once at mount only

  const toggle = React.useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("theme", next ? "dark" : "light");
        document.documentElement.classList.toggle("dark", next);
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);
  return [isDark, toggle];
}

/**
 * Sidebar — dasti v1
 *
 * Layout : 256px expanded / 52px collapsed (CSS transition .22s).
 * Active state : CSS classes only — .sb-nav-item + .sb-nav-item--active.
 *   bg = var(--sf2) (one step above sidebar --sf1, works light+dark alike)
 *   left accent stripe = box-shadow inset 2px (no border, no layout shift)
 */

const SB_MAX_ITEMS = 5;

/* Shared appearance for Clerk UserButton — dasti tokens */
const clerkAppearance = {
  elements: {
    avatarBox: {
      width: "26px",
      height: "26px",
      borderRadius: "var(--radius-control)",
    },
    userButtonAvatarBox: {
      width: "26px",
      height: "26px",
      borderRadius: "var(--radius-control)",
    },
    userButtonTrigger: {
      boxShadow: "none",
      outline: "none",
    },
  },
  variables: {
    colorPrimary: "hsl(155,22%,30%)" /* --ac light */,
    borderRadius: "var(--radius-control)",
  },
} as const;

export const Sidebar: React.FC = () => {
  const [isDarkMode, toggleDarkMode] = useDarkMode();
  const { user } = useUser();
  const [collapsed, setCollapsed] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [proposalRenameTarget, setProposalRenameTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { cvs, currentCv, loadCv, createNewCv, importCv, deleteCv, renameCv } =
    useCvLibrary();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { showToast } = useToast();
  const params = new URLSearchParams(search);
  const proposalView = params.get("view");
  const selectedProposalId = params.get("id");
  const matchesRoute = React.useCallback(
    (base: string) => pathname === base || pathname.startsWith(`${base}/`),
    [pathname],
  );
  const isCvForge = matchesRoute("/cv");
  const isProposalForge = matchesRoute("/proposal");
  const isStyle = matchesRoute("/style");
  const selectedCvId = isCvForge ? params.get("id") : null;
  const hasSelectedCv = Boolean(selectedCvId);
  const hasSelectedProposal =
    isProposalForge && proposalView === "saved" && Boolean(selectedProposalId);
  const studioTopActive = isCvForge && !hasSelectedCv;
  const composeTopActive =
    isProposalForge && !hasSelectedProposal && proposalView !== "saved";
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
  ) as
    | Array<{
        _id: string;
        _creationTime: number;
        title?: string;
        metadata?: { proposalType?: string };
      }>
    | undefined;
  const deleteProposal = useMutation(
    (api as any).deleteProposalPublic?.default,
  );
  const updateProposal = useMutation(
    (api as any).updateProposalPublic?.default,
  );

  /* ── Handlers ────────────────────────────────────────────── */

  const handleLoadCv = (id: string) => {
    try {
      loadCv(id);
    } catch (e) {
      console.error("[Sidebar] loadCv failed", e);
    }
  };

  const getStudioTarget = React.useCallback(() => {
    const activeId =
      currentCv?.id ??
      (typeof window !== "undefined"
        ? window.localStorage.getItem("cvActiveId")
        : null);
    return activeId ? `/cv?id=${encodeURIComponent(String(activeId))}` : "/cv";
  }, [currentCv?.id]);

  const handleCreate = () => {
    try {
      createNewCv(undefined, { forceV1: true });
      void navigate(getStudioTarget());
    } catch (err) {
      console.error("[Sidebar] createNewCv failed", err);
    }
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
    try {
      deleteCv(id);
    } catch (err) {
      console.error("[Sidebar] deleteCv failed", err);
      setError("Failed to delete CV");
    }
  };

  const handleDeleteProposal = async (
    e: React.MouseEvent,
    id: string,
    title: string,
  ) => {
    e.stopPropagation();
    try {
      await deleteProposal({ id });
      if (selectedProposalId === id) void navigate("/proposal?view=saved");
      showToast("Proposal deleted", { variant: "success" });
    } catch (err) {
      console.error("[Sidebar] deleteProposal failed", err);
      showToast("Failed to delete proposal", { variant: "error" });
    }
  };

  const handleRenameProposal = (
    e: React.MouseEvent,
    id: string,
    title: string,
  ) => {
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

  return (
    <>
      <div
        className={clsx(
          "sb",
          compactDensity && "sb--compact",
          forcedCollapsed && "sb--forced-collapsed",
          sidebarCollapsed && "sb--collapsed",
        )}
      >
        {/* ── Top bar — hamburger only ─────────────────────── */}
        <div className="sb__top">
          <button
            className={
              forcedCollapsed
                ? "sb-toggle"
                : sidebarCollapsed
                  ? "sb-toggle sb-toggle--expand"
                  : "sb-toggle sb-toggle--collapse"
            }
            onClick={() => {
              if (!forcedCollapsed) setCollapsed((c) => !c);
            }}
            title={
              forcedCollapsed
                ? "Auto-collapses on narrow screens"
                : collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
            }
          >
            <Menu size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* ── Nav ─────────────────────────────────────────── */}
        <nav className="sb__nav">
          {/* RESUME section */}
          <span
            className={clsx(
              "sb__section-label",
              sidebarCollapsed && "sb__section-label--hidden",
            )}
          >
            Resume
          </span>

          <div
            onClick={() => void navigate("/cv")}
            className={clsx(
              "sb-nav-item",
              studioTopActive && "sb-nav-item--active",
            )}
          >
            <div className="sb-nav-icon">
              <FileUser size={15} strokeWidth={1.5} />
            </div>
            <span
              className={clsx(
                "sb-nav-label",
                studioTopActive && "sb-nav-label--active",
                sidebarCollapsed && "sb-nav-label--hidden",
              )}
            >
              Studio
            </span>
          </div>

          {/* CV sub-items */}
          {!sidebarCollapsed &&
            cvs.slice(0, SB_MAX_ITEMS).map((cv) => {
              const isActive = isCvForge && selectedCvId === cv.id;
              const profileSection = Array.isArray(cv.sections)
                ? cv.sections.find((section) => section.type === "profile")
                : undefined;
              const profileItem = Array.isArray(
                profileSection?.structuredContent,
              )
                ? (profileSection?.structuredContent[0] as
                    | Record<string, unknown>
                    | undefined)
                : undefined;
              const displayTitle = formatCvDisplayTitle({
                title: cv.title,
                profileName:
                  typeof profileItem?.name === "string"
                    ? profileItem.name
                    : null,
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
                  onClick={() => {
                    handleLoadCv(cv.id);
                    void navigate(
                      `/cv?id=${encodeURIComponent(String(cv.id))}`,
                    );
                  }}
                  onRename={(e) => {
                    e.stopPropagation();
                    handleRenameOpen(cv.id, cv.title);
                  }}
                  onDelete={(e) => handleDelete(e, cv.id)}
                />
              );
            })}

          {!sidebarCollapsed && cvs.length > SB_MAX_ITEMS && (
            <SbViewAll
              label={`View all (${cvs.length})`}
              dense={compactDensity}
              onClick={() => void navigate("/cvs")}
            />
          )}

          {!sidebarCollapsed && (
            <SbNewAction
              label="New resume"
              dense={compactDensity}
              onClick={handleCreate}
            />
          )}

          {/* WRITE section */}
          <span
            className={clsx(
              "sb__section-label",
              sidebarCollapsed && "sb__section-label--hidden",
            )}
          >
            Proposal
          </span>

          <div
            onClick={() => void navigate("/proposal")}
            className={clsx(
              "sb-nav-item",
              composeTopActive && "sb-nav-item--active",
            )}
          >
            <div className="sb-nav-icon">
              <Pencil size={15} strokeWidth={1.5} />
            </div>
            <span
              className={clsx(
                "sb-nav-label",
                composeTopActive && "sb-nav-label--active",
                sidebarCollapsed && "sb-nav-label--hidden",
              )}
            >
              Compose
            </span>
          </div>

          {/* Proposal sub-items */}
          {!sidebarCollapsed &&
            isSignedIn &&
            proposals &&
            proposals.slice(0, SB_MAX_ITEMS).map((p) => {
              const isActive =
                isProposalForge &&
                proposalView === "saved" &&
                selectedProposalId === p._id;
              return (
                <SbDoc
                  key={p._id}
                  title={p.title ?? "Untitled"}
                  isActive={isActive}
                  dense={compactDensity}
                  onClick={() =>
                    void navigate(
                      `/proposal?view=saved&id=${encodeURIComponent(p._id)}`,
                    )
                  }
                  onRename={(e) => {
                    void handleRenameProposal(e, p._id, p.title ?? "Untitled");
                  }}
                  onDelete={(e) => {
                    void handleDeleteProposal(e, p._id, p.title ?? "Untitled");
                  }}
                />
              );
            })}

          {!sidebarCollapsed &&
            proposals &&
            proposals.length > SB_MAX_ITEMS && (
              <SbViewAll
                label={`View all (${proposals.length})`}
                dense={compactDensity}
                onClick={() => void navigate("/proposals")}
              />
            )}

          {!sidebarCollapsed && (
            <SbNewAction
              label="New letter"
              dense={compactDensity}
              onClick={() => void navigate("/proposal")}
            />
          )}

          {/* DESIGN section */}
          <span
            className={clsx(
              "sb__section-label",
              sidebarCollapsed && "sb__section-label--hidden",
            )}
          >
            Design
          </span>

          <div
            onClick={() => void navigate("/style")}
            className={clsx("sb-nav-item", isStyle && "sb-nav-item--active")}
          >
            <div className="sb-nav-icon">
              <Palette size={16} strokeWidth={1.5} />
            </div>
            <span
              className={clsx(
                "sb-nav-label",
                isStyle && "sb-nav-label--active",
                sidebarCollapsed && "sb-nav-label--hidden",
              )}
            >
              Design
            </span>
          </div>

          {/* Error display */}
          {error && !sidebarCollapsed && (
            <div
              style={{
                padding: "var(--s2)",
                fontSize: "var(--tx)",
                color: "var(--ert)",
              }}
            >
              {error}
            </div>
          )}
        </nav>

        {/* ── Footer — avatar only ─────────────────────────── */}
        <div
          className={
            sidebarCollapsed ? "sb-footer sb-footer--collapsed" : "sb-footer"
          }
        >
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            <UserButton afterSignOutUrl="/" appearance={clerkAppearance} />
          </div>
          {!sidebarCollapsed && (
            <div className="sb-footer__account">
              <div className="sb-footer__title">
                {user?.firstName ?? user?.username ?? "Account"}
              </div>
              <div className="sb-footer__subtitle">free</div>
            </div>
          )}
          {!sidebarCollapsed && (
            <div className="sb-theme-toggle">
              <button
                type="button"
                className="sb-theme-toggle__single"
                onClick={toggleDarkMode}
                aria-pressed={isDarkMode}
                aria-label={
                  isDarkMode ? "Switch to light mode" : "Switch to dark mode"
                }
                title={
                  isDarkMode ? "Switch to light mode" : "Switch to dark mode"
                }
              >
                {isDarkMode ? (
                  <SunMedium size={14} strokeWidth={1.6} />
                ) : (
                  <Moon size={14} strokeWidth={1.6} />
                )}
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
        onSave={(nextTitle) => {
          void handleProposalRenameSave(nextTitle);
        }}
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
              if (!norm.success) {
                setError(norm.errors.join("; "));
                return;
              }
              await importCv(norm.document);
            } catch (err: unknown) {
              setError(
                err instanceof Error ? err.message : "Failed to import file",
              );
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

function SbNewAction({
  label,
  dense,
  onClick,
}: {
  label: string;
  dense: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx("sb-new-action", dense && "sb-new-action--dense")}
    >
      <Plus size={14} style={{ flexShrink: 0 }} />
      <span style={{ whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   SbViewAll — "View all (N) →" link
   ───────────────────────────────────────────────────────────── */

function SbViewAll({
  label,
  dense,
  onClick,
}: {
  label: string;
  dense: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx("sb-view-all", dense && "sb-view-all--dense")}
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

function SbDoc({
  title,
  isActive,
  dense = false,
  onClick,
  onRename,
  onDelete,
  hideActions,
  hideRenameAction,
}: SbDocProps) {
  const [hovered, setHovered] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <div
      onClick={isConfirming ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setIsConfirming(false);
      }}
      className={clsx(
        "sb-doc",
        dense && "sb-doc--dense",
        isActive && "sb-doc--active",
      )}
      style={{ cursor: isConfirming ? "default" : "pointer" }}
    >
      <div className="sb-doc__row">
        <div
          className={clsx("sb-doc__title", isActive && "sb-doc__title--active")}
        >
          {title}
        </div>

        {!hideActions && (
          <div
            className={clsx(
              "sb-doc__actions-mask",
              (hovered || isConfirming) && "sb-doc__actions-mask--visible",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {isConfirming ? (
              <>
                <button
                  title="Confirm delete"
                  className="sb-doc__action sb-doc__action--confirm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(e);
                    setIsConfirming(false);
                  }}
                >
                  <Check size={10} strokeWidth={2.5} />
                </button>
                <button
                  title="Cancel"
                  className="sb-doc__action sb-doc__action--cancel"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsConfirming(false);
                  }}
                >
                  <X size={10} strokeWidth={2} />
                </button>
              </>
            ) : (
              <>
                {!hideRenameAction ? (
                  <button
                    onClick={onRename}
                    title="Rename"
                    className="sb-doc__action"
                  >
                    <Pencil size={10} strokeWidth={1.75} />
                  </button>
                ) : (
                  <span
                    className="sb-doc__action sb-doc__action--ghost"
                    aria-hidden
                  />
                )}
                <button
                  title="Delete"
                  className="sb-doc__action"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsConfirming(true);
                  }}
                >
                  <Trash size={10} strokeWidth={1.75} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Sidebar;
