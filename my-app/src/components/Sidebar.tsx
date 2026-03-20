import React, { useEffect, useRef, useState } from 'react';
import { Menu, FileText, Plus, Pencil, Settings, X, Check } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { useAuth } from '@clerk/clerk-react';
import { UserButton } from '@clerk/clerk-react';
import { api } from '../../convex/_generated/api';
import { useCvLibrary } from '../contexts/CvLibraryContext';
import { normalizeAndValidateCvDocument } from '../lib/normalize-cv';
import CvRenameDialog from './CvRenameDialog';
import DarkModeToggle from './dark-mode-toggle/DarkModeToggle';
import { useToast } from './ui/toast';

/**
 * Sidebar — dasti v1
 *
 * Layout : 248px expanded / 52px collapsed (CSS transition .22s).
 * Sections : RESUME (CV library) — WRITE et SETTINGS sont des chantiers séparés.
 * Logique métier : loadCv, createNewCv, renameCv, deleteCv, importCv — intacte.
 *
 * §12 dasti-spec-v1 : sidebar structure, collapse, sb-doc items, footer.
 */

const SB_EXPANDED = 248;
const SB_COLLAPSED = 52;
const SB_MAX_ITEMS = 5;

/** IDs currently waiting for a second-click delete confirmation */
type ConfirmingMap = Record<string, true>;

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [proposalRenameTarget, setProposalRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCv, setConfirmingCv] = useState<ConfirmingMap>({});
  const [confirmingProposal, setConfirmingProposal] = useState<ConfirmingMap>({});
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
  const forcedCollapsed = viewportWidth < 1220;
  const sidebarCollapsed = collapsed || forcedCollapsed;
  const compactDensity = viewportWidth < 1360;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* ── Proposals query (même source que ProposalsList) ────────── */
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const userInitials = user
    ? ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() || user.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || "?"
    : "?";
  const proposals = useQuery(
    api.proposalsPublic.default as any,
    isLoaded && isSignedIn ? {} : "skip",
  ) as Array<{ _id: string; _creationTime: number; title?: string; metadata?: { proposalType?: string } }> | undefined;
  const deleteProposal = useMutation((api as any).deleteProposalPublic?.default);
  const updateProposal = useMutation((api as any).updateProposalPublic?.default);

  /* ── Handlers (logique métier intacte) ───────────────────── */

  const handleLoadCv = (id: string) => {
    try { loadCv(id); }
    catch (e) { console.error("[Sidebar] loadCv failed", e); }
  };

  const handleCreate = () => {
    try { createNewCv(undefined, { forceV1: true }); }
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

  const handleDeleteCancel = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteProposal({ id });
      if (selectedProposalId === id) {
        void navigate('/proposal?view=saved');
      }
      showToast("Proposal deleted", { variant: "success" });
    } catch (err) {
      console.error("[Sidebar] deleteProposal failed", err);
      showToast("Failed to delete proposal", { variant: "error" });
    }
  };

  const handleDeleteProposalCancel = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmingProposal((prev) => { const n = { ...prev }; delete n[id]; return n; });
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

  const footerHint = (() => {
    if (isProposal) {
      const activeProposal = proposals?.find((proposal) => proposal._id === selectedProposalId);
      return activeProposal?.title ?? "Proposal library";
    }
    return currentCv?.title ?? "No resume selected";
  })();

  /* ── Styles inline (tokens dasti) ───────────────────────── */

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
    gap: "var(--s2)",
    padding: "0 var(--s2)",
    height: "var(--hdr)",
    borderBottom: "1px solid var(--bo)",
    flexShrink: 0,
    justifyContent: sidebarCollapsed ? "center" : "flex-start",
  };

  const sbSec: React.CSSProperties = sidebarCollapsed
    ? { opacity: 0, maxHeight: 0, overflow: "hidden", padding: 0, pointerEvents: "none" }
    : {
        fontSize: "var(--tx)",
        fontWeight: 600,
        color: "var(--tg2)",
        letterSpacing: ".12em",
        textTransform: "uppercase",
        padding: compactDensity ? "var(--s3) var(--s2) var(--s2)" : "var(--s4) var(--s2) var(--s3)",
        whiteSpace: "nowrap",
        transition: "opacity .18s var(--ez), max-height .22s var(--ez)",
        maxHeight: 40,
      };

  return (
    <>
      <div style={sb}>
        {/* ── Top bar ─────────────────────────────────────── */}
        <div style={sbTop}>
          {/* Hamburger toggle — single button, always top-left */}
          <button
            className="sb-toggle"
            onClick={() => { if (!forcedCollapsed) setCollapsed((c) => !c); }}
            title={forcedCollapsed ? "Sidebar auto-collapses on narrow widths" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu size={16} strokeWidth={1.5} />
          </button>

          {/* Wordmark — hidden when collapsed */}
          {!sidebarCollapsed && (
            <span
              style={{
                fontFamily: '"Fraunces", serif',
                fontSize: "15px",
                fontWeight: 600,
                letterSpacing: "-.02em",
                color: "var(--ti)",
                whiteSpace: "nowrap",
              }}
            >
              dasti
            </span>
          )}
        </div>

        {/* ── Nav ─────────────────────────────────────────── */}
        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "var(--s2)",
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          {/* Section label RESUME */}
          <span style={sbSec as React.CSSProperties}>Resume</span>

          {/* Resume nav item */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { void navigate('/cv'); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void navigate('/cv'); }}
            className={`sb-nav-item sb-tooltip-wrap${isResume ? " sb-nav-item--active" : ""}`}
            style={{
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              gap: "var(--s3)",
              padding: sidebarCollapsed ? 0 : "var(--s2)",
              borderRadius: "var(--rs)",
              border: isResume ? "1px solid var(--bo)" : "1px solid transparent",
              cursor: "pointer",
              height: 34,
              width: sidebarCollapsed ? 36 : "100%",
              alignSelf: sidebarCollapsed ? "center" : "stretch",
            }}
          >
            <div style={{ width: 16, height: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: isResume ? "var(--ac)" : "var(--tm2)" }}>
              <FileText size={16} strokeWidth={1.5} />
            </div>
            {!sidebarCollapsed && (
              <span style={{ fontSize: "var(--ts)", fontWeight: isResume ? 600 : 500, color: isResume ? "var(--ti)" : "var(--tm2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                Studio
              </span>
            )}
            {sidebarCollapsed && <span className="sb-tooltip">Studio</span>}
          </div>

          {/* CV document sub-items — capped at SB_MAX_ITEMS */}
          {!sidebarCollapsed && cvs.slice(0, SB_MAX_ITEMS).map((cv) => {
            const isActive = currentCv?.id === cv.id;
            const updatedAt = new Date(
              cv.metadata?.updatedAt ?? cv.metadata?.createdAt ?? Date.now()
            ).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
            return (
              <SbDoc
                key={cv.id}
                title={cv.title}
                date={updatedAt}
                isActive={isActive}
                dense={compactDensity}
                isConfirming={Boolean(confirmingCv[cv.id])}
                onClick={() => { handleLoadCv(cv.id); void navigate('/cv'); }}
                onRename={(e) => { e.stopPropagation(); handleRenameOpen(cv.id, cv.title); }}
                onDelete={(e) => handleDelete(e, cv.id)}
              />
            );
          })}

          {/* View all CVs — shown when list is capped */}
          {!sidebarCollapsed && cvs.length > SB_MAX_ITEMS && (
            <SbViewAll
              label={`View all (${cvs.length})`}
              dense={compactDensity}
              onClick={() => { void navigate('/cv'); }}
            />
          )}

          {/* New CV */}
          {!sidebarCollapsed && (
            <SbNewAction label="New resume" dense={compactDensity} onClick={handleCreate} />
          )}

          {/* Section label WRITE */}
          <span style={sbSec as React.CSSProperties}>Write</span>

          {/* Compose nav item */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { void navigate('/proposal'); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void navigate('/proposal'); }}
            className={`sb-nav-item sb-tooltip-wrap${isProposal ? " sb-nav-item--active" : ""}`}
            style={{
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              gap: "var(--s3)",
              padding: sidebarCollapsed ? 0 : "var(--s2)",
              borderRadius: "var(--rs)",
              border: isProposal ? "1px solid var(--bo)" : "1px solid transparent",
              cursor: "pointer",
              height: 34,
              width: sidebarCollapsed ? 36 : "100%",
              alignSelf: sidebarCollapsed ? "center" : "stretch",
            }}
          >
            <div style={{ width: 16, height: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: isProposal ? "var(--ac)" : "var(--tm2)" }}>
              <Pencil size={16} strokeWidth={1.5} />
            </div>
            {!sidebarCollapsed && (
              <span style={{ fontSize: "var(--ts)", fontWeight: isProposal ? 600 : 500, color: isProposal ? "var(--ti)" : "var(--tm2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                Compose
              </span>
            )}
            {sidebarCollapsed && <span className="sb-tooltip">Compose</span>}
          </div>

          {/* Proposal sub-items — capped at SB_MAX_ITEMS */}
          {!sidebarCollapsed && isSignedIn && proposals && proposals.slice(0, SB_MAX_ITEMS).map((p) => {
            const date = new Date(p._creationTime).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
            const typeLabel = p.metadata?.proposalType === "cover_letter" ? "Letter"
              : p.metadata?.proposalType === "freelance_proposal" ? "Proposal"
              : p.metadata?.proposalType === "application_message" ? "Message"
              : "Letter";
            const isActive = isProposal && proposalView === "saved" && selectedProposalId === p._id;
            return (
              <SbDoc
                key={p._id}
                title={p.title ?? "Untitled"}
                date={date}
                docType={typeLabel}
                isActive={isActive}
                dense={compactDensity}
                isConfirming={Boolean(confirmingProposal[p._id])}
                onClick={() => { void navigate(`/proposal?view=saved&id=${encodeURIComponent(p._id)}`); }}
                onRename={(e) => { void handleRenameProposal(e, p._id, p.title ?? "Untitled"); }}
                onDelete={(e) => { void handleDeleteProposal(e, p._id, p.title ?? "Untitled"); }}
              />
            );
          })}

          {/* View all proposals — shown when list is capped */}
          {!sidebarCollapsed && proposals && proposals.length > SB_MAX_ITEMS && (
            <SbViewAll
              label={`View all (${proposals.length})`}
              dense={compactDensity}
              onClick={() => { void navigate('/proposal?view=saved'); }}
            />
          )}

          {/* New letter */}
          {!sidebarCollapsed && (
            <SbNewAction label="New letter" dense={compactDensity} onClick={() => { void navigate('/proposal'); }} />
          )}

          {/* Section label SETTINGS */}
          <span style={sbSec as React.CSSProperties}>Settings</span>

          {/* Style nav item */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { void navigate('/style'); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void navigate('/style'); }}
            className={`sb-nav-item sb-tooltip-wrap${isStyle ? " sb-nav-item--active" : ""}`}
            style={{
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              gap: "var(--s3)",
              padding: sidebarCollapsed ? 0 : "var(--s2)",
              borderRadius: "var(--rs)",
              border: isStyle ? "1px solid var(--bo)" : "1px solid transparent",
              cursor: "pointer",
              height: 34,
              width: sidebarCollapsed ? 36 : "100%",
              alignSelf: sidebarCollapsed ? "center" : "stretch",
            }}
          >
            <div style={{ width: 16, height: 16, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: isStyle ? "var(--ac)" : "var(--tg2)" }}>
              <Settings size={16} strokeWidth={1.5} />
            </div>
            {!sidebarCollapsed && (
              <span style={{ fontSize: "var(--ts)", fontWeight: isStyle ? 600 : 500, color: isStyle ? "var(--ti)" : "var(--tm2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                Style
              </span>
            )}
            {sidebarCollapsed && <span className="sb-tooltip">Style</span>}
          </div>

          {/* Error display */}
          {error && !sidebarCollapsed && (
            <div style={{ padding: "var(--s2) var(--s2)", fontSize: "var(--tx)", color: "var(--ert)" }}>
              {error}
            </div>
          )}
        </nav>

        {/* ── Footer — avatar + theme toggle ──────────────── */}
        <div
          style={{
            flexShrink: 0,
            padding: "var(--s3)",
            borderTop: "1px solid var(--bo)",
            display: "flex",
            alignItems: "center",
            gap: sidebarCollapsed ? 0 : "var(--s3)",
            overflow: "hidden",
            justifyContent: sidebarCollapsed ? "center" : "flex-start",
          }}
        >
          {/* Avatar — Clerk UserButton */}
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
            <UserButton afterSignOutUrl="/" />
          </div>

          {/* Name + hint — hidden in collapsed (C06) */}
          {!sidebarCollapsed && (
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <div style={{ fontSize: "var(--ts)", fontWeight: 600, color: "var(--ti)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                Profile
              </div>
              <div style={{ fontSize: "var(--tx)", color: "var(--tg2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {footerHint}
              </div>
            </div>
          )}

          {/* Theme toggle — hidden in collapsed */}
          {!sidebarCollapsed && <DarkModeToggle />}
        </div>
      </div>

      {/* ── Rename dialog — logique intacte ─────────────── */}
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

      {/* Hidden file input for JSON import (legacy) */}
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
   SbNewAction — "+ New …" button (aligned with nav icons)
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
        transition: "all .12s var(--ez)",
        background: "transparent",
        border: "none",
        width: "100%",
        textAlign: "left",
        fontFamily: "inherit",
      }}
      onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "var(--am)"; b.style.background = "var(--sf2)"; }}
      onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.color = "var(--tg2)"; b.style.background = "transparent"; }}
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
      <span style={{ whiteSpace: "nowrap" }}>{label} →</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   SbDoc — sous-document sidebar (CV item)
   §11 dasti-spec-v1 : .sb-doc style
   ───────────────────────────────────────────────────────────── */

interface SbDocProps {
  title: string;
  date: string;
  docType?: string;
  isActive: boolean;
  dense?: boolean;
  isConfirming?: boolean;
  onClick: () => void;
  onRename: (e: React.MouseEvent) => void;
  onDeleteRequest: (e: React.MouseEvent) => void;
  onDeleteConfirm: (e: React.MouseEvent) => void;
  onDeleteCancel: (e: React.MouseEvent) => void;
  hideActions?: boolean;
  hideRenameAction?: boolean;
}

function SbDoc({
  title, date, docType, isActive, dense = false, isConfirming = false,
  onClick, onRename, onDeleteRequest, onDeleteConfirm, onDeleteCancel,
  hideActions, hideRenameAction,
}: SbDocProps) {
  const [hovered, setHovered] = useState(false);
  const [renHovered, setRenHovered] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const btnBase: React.CSSProperties = {
    width: 20, height: 20,
    display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 3, border: "none", background: "transparent",
    color: "var(--tg2)", cursor: "pointer", padding: 0,
    transition: "color .1s var(--ez), background .1s var(--ez)",
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
        padding: dense ? "7px var(--s2) 7px var(--s5)" : "var(--s2) var(--s2) var(--s2) var(--s5)",
        borderRadius: "var(--rs)",
        cursor: isConfirming ? "default" : "pointer",
        transition: "all .12s var(--ez)",
        position: "relative",
        background: isActive ? "var(--sfr)" : hovered ? "var(--sf2)" : "transparent",
        boxShadow: isActive ? "var(--sha)" : "none",
      }}
    >
      <div
        style={{
          fontSize: "var(--ts)",
          fontWeight: isActive ? 600 : 500,
          color: "var(--ti)",
          lineHeight: 1.24,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          paddingRight: hovered && !hideActions ? 48 : 0,
          transition: "padding-right .1s var(--ez)",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 10, color: "var(--tg2)", marginTop: 1, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", lineHeight: 1.28 }}>
        {date}
        {docType && <span>·</span>}
        {docType && <span style={{ color: "var(--tm2)", fontWeight: 500 }}>{docType}</span>}
      </div>

      {/* Action buttons — appear on hover */}
      {!hideActions && (hovered || isConfirming) && (
        <div
          style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 2 }}
          onClick={(e) => e.stopPropagation()}
        >
          {isConfirming ? (
            /* Inline confirm: ✓ (neutral) + ✗ */
            <>
              <button
                title="Confirm delete"
                style={btnBase}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--sf2)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                onClick={(e) => { e.stopPropagation(); onDelete(e); setIsConfirming(false); }}
              >
                <Check size={10} strokeWidth={2.5} />
              </button>
              <button
                title="Cancel"
                style={btnBase}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--sf2)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                onClick={(e) => { e.stopPropagation(); setIsConfirming(false); }}
              >
                <X size={10} strokeWidth={2} />
              </button>
            </>
          ) : (
            /* Normal hover actions: rename + delete trigger */
            <>
              {!hideRenameAction && (
                <button
                  onClick={onRename}
                  onMouseEnter={() => setRenHovered(true)}
                  onMouseLeave={() => setRenHovered(false)}
                  title="Rename"
                  style={{ ...btnBase, background: renHovered ? "var(--sf2)" : "transparent", color: renHovered ? "var(--ti)" : "var(--tg2)" }}
                >
                  <Pencil size={10} />
                </button>
              )}
              <button
                title="Delete"
                style={btnBase}
                onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--erb)"; b.style.color = "var(--ert)"; }}
                onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "transparent"; b.style.color = "var(--tg2)"; }}
                onClick={(e) => { e.stopPropagation(); setIsConfirming(true); }}
              >
                <X size={10} strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default Sidebar;
